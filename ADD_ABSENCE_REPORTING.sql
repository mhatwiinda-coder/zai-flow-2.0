-- ============================================================================
-- LEAVE STAGE 3: absence reporting
-- ============================================================================
-- Turns the attendance rows into the numbers a management pack actually asks
-- for: how many days were lost, to what, by whom, and whether the pattern
-- looks like illness or looks like long weekends.
--
-- Depends on ADD_LEAVE_APPROVAL_RULES.sql, which is what makes sick days
-- record as SICK rather than every absence reading as LEAVE. Without that
-- split, "days lost to sickness" is not a number this schema can produce.
--
-- ⚠️  PUBLIC HOLIDAYS ARE NOT MODELLED. Working days below means Monday to
-- Friday. There is no holiday calendar in this system, so a Zambian public
-- holiday counts as a working day and will slightly depress attendance rates
-- for the month it falls in. Worth adding a holidays table before these
-- figures go into anything external.
-- ============================================================================


-- ============================================================================
-- Shared: working days in a range
-- ============================================================================
-- The denominator for every rate below. Kept as its own function so the three
-- reports cannot disagree about what a working day is.
CREATE OR REPLACE FUNCTION public.zf_working_days(p_from DATE, p_to DATE)
RETURNS INTEGER LANGUAGE sql IMMUTABLE AS $$
  SELECT COUNT(*)::INTEGER
  FROM generate_series(p_from, p_to, INTERVAL '1 day') AS d
  WHERE EXTRACT(DOW FROM d) BETWEEN 1 AND 5;
$$;


-- ============================================================================
-- 1. Per-employee absence
-- ============================================================================
-- HALF_DAY counts as half a day lost rather than a whole one - counting it as
-- a full day overstates absence, ignoring it understates it.
--
-- "Unexcused" is an ABSENT row with no APPROVED leave covering that date.
-- Approval writes LEAVE/SICK rows, so in normal flow an approved day is never
-- ABSENT; the leave check catches the case where HR marked someone absent
-- first and approved their leave afterwards.
CREATE OR REPLACE FUNCTION public.get_absence_by_employee(
  p_branch_id INTEGER,
  p_from      DATE,
  p_to        DATE
)
RETURNS TABLE (
  employee_id INTEGER,
  employee_code TEXT,
  full_name TEXT,
  department TEXT,
  annual_days NUMERIC,
  sick_days NUMERIC,
  unexcused_days NUMERIC,
  other_days NUMERIC,
  total_days NUMERIC,
  working_days INTEGER,
  absence_rate NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_working INTEGER := public.zf_working_days(p_from, p_to);
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.employee_code,
    (e.first_name || ' ' || e.last_name)::TEXT,
    COALESCE(d.name, 'Unassigned')::TEXT,
    COALESCE(SUM(CASE WHEN a.status = 'LEAVE'    THEN 1 ELSE 0 END), 0)::NUMERIC,
    COALESCE(SUM(CASE WHEN a.status = 'SICK'     THEN 1 ELSE 0 END), 0)::NUMERIC,
    COALESCE(SUM(CASE WHEN a.status = 'ABSENT'
                       AND NOT EXISTS (
                         SELECT 1 FROM public.leave_requests lr
                         WHERE lr.employee_id = e.id
                           AND lr.status = 'APPROVED'
                           AND a.attendance_date BETWEEN lr.start_date AND lr.end_date
                       )
                      THEN 1 ELSE 0 END), 0)::NUMERIC,
    COALESCE(SUM(CASE WHEN a.status = 'HALF_DAY' THEN 0.5 ELSE 0 END), 0)::NUMERIC,
    COALESCE(SUM(CASE WHEN a.status IN ('LEAVE','SICK','ABSENT') THEN 1
                      WHEN a.status = 'HALF_DAY' THEN 0.5
                      ELSE 0 END), 0)::NUMERIC,
    v_working,
    CASE WHEN v_working = 0 THEN 0
         ELSE ROUND(
           COALESCE(SUM(CASE WHEN a.status IN ('LEAVE','SICK','ABSENT') THEN 1
                             WHEN a.status = 'HALF_DAY' THEN 0.5
                             ELSE 0 END), 0)::NUMERIC * 100 / v_working, 1)
    END
  FROM public.employees e
  LEFT JOIN public.departments d ON d.id = e.department_id
  LEFT JOIN public.attendance a
    ON a.employee_id = e.id
   AND a.branch_id = p_branch_id
   AND a.attendance_date BETWEEN p_from AND p_to
  WHERE e.branch_id = p_branch_id
    AND e.status = 'ACTIVE'
  GROUP BY e.id, e.employee_code, e.first_name, e.last_name, d.name
  ORDER BY 9 DESC, e.employee_code;
END;
$$;


-- ============================================================================
-- 2. Per-department rollup
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_absence_by_department(
  p_branch_id INTEGER,
  p_from      DATE,
  p_to        DATE
)
RETURNS TABLE (
  department TEXT,
  headcount INTEGER,
  annual_days NUMERIC,
  sick_days NUMERIC,
  unexcused_days NUMERIC,
  total_days NUMERIC,
  absence_rate NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_working INTEGER := public.zf_working_days(p_from, p_to);
BEGIN
  RETURN QUERY
  SELECT
    r.department,
    COUNT(*)::INTEGER,
    SUM(r.annual_days),
    SUM(r.sick_days),
    SUM(r.unexcused_days),
    SUM(r.total_days),
    -- Rate against the whole department's available days, not an average of
    -- individual rates: averaging rates weights a one-person department the
    -- same as a twenty-person one.
    CASE WHEN v_working = 0 OR COUNT(*) = 0 THEN 0
         ELSE ROUND(SUM(r.total_days) * 100 / (v_working * COUNT(*))::NUMERIC, 1)
    END
  FROM public.get_absence_by_employee(p_branch_id, p_from, p_to) r
  GROUP BY r.department
  ORDER BY 6 DESC;
END;
$$;


-- ============================================================================
-- 3. Patterns worth a conversation
-- ============================================================================
-- The report that actually changes behaviour. Two signals:
--   * absences clustering on Mondays and Fridays (long weekends)
--   * sick days landing next to a weekend
--
-- Deliberately reports counts and lets a human judge. A threshold that
-- automatically labels someone is the kind of thing that ends up in a
-- disciplinary meeting without anyone having looked at the underlying days.
-- mon_fri_share is only meaningful above a handful of absences - with two
-- absences it is either 0%, 50% or 100% and means nothing.
CREATE OR REPLACE FUNCTION public.get_absence_patterns(
  p_branch_id INTEGER,
  p_from      DATE,
  p_to        DATE
)
RETURNS TABLE (
  employee_id INTEGER,
  employee_code TEXT,
  full_name TEXT,
  total_absences INTEGER,
  mon_fri_absences INTEGER,
  mon_fri_share NUMERIC,
  weekend_adjacent_sick INTEGER,
  separate_occasions INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH days AS (
    SELECT a.employee_id, a.attendance_date, a.status,
           EXTRACT(DOW FROM a.attendance_date)::INTEGER AS dow,
           -- Consecutive days are one occasion. Ten single days off is a very
           -- different picture from one two-week absence, and a raw day count
           -- cannot tell them apart.
           a.attendance_date
             - (ROW_NUMBER() OVER (PARTITION BY a.employee_id ORDER BY a.attendance_date))::INTEGER
             AS streak_key
    FROM public.attendance a
    WHERE a.branch_id = p_branch_id
      AND a.attendance_date BETWEEN p_from AND p_to
      AND a.status IN ('ABSENT','SICK')
  )
  SELECT
    e.id,
    e.employee_code,
    (e.first_name || ' ' || e.last_name)::TEXT,
    COUNT(days.attendance_date)::INTEGER,
    COUNT(*) FILTER (WHERE days.dow IN (1, 5))::INTEGER,
    CASE WHEN COUNT(days.attendance_date) = 0 THEN 0
         ELSE ROUND(COUNT(*) FILTER (WHERE days.dow IN (1, 5))::NUMERIC * 100
                    / COUNT(days.attendance_date), 0)
    END,
    COUNT(*) FILTER (WHERE days.status = 'SICK' AND days.dow IN (1, 5))::INTEGER,
    COUNT(DISTINCT days.streak_key)::INTEGER
  FROM public.employees e
  JOIN days ON days.employee_id = e.id
  WHERE e.branch_id = p_branch_id
  GROUP BY e.id, e.employee_code, e.first_name, e.last_name
  HAVING COUNT(days.attendance_date) > 0
  ORDER BY 6 DESC, 4 DESC;
END;
$$;


NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('zf_working_days','get_absence_by_employee',
                    'get_absence_by_department','get_absence_patterns')
ORDER BY p.proname;
-- Expect 4 rows.

-- Month to date for branch 1:
-- SELECT * FROM public.get_absence_by_employee(1, DATE_TRUNC('month', CURRENT_DATE)::DATE, CURRENT_DATE);
