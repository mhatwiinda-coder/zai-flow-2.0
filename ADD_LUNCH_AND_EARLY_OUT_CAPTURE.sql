-- ============================================================================
-- CAPTURE LUNCH BREAKS AND EARLY CLOCK-OUT REASONS
-- ============================================================================
-- "it needs to ask why early clock out and if lunch was taken and for how long
--  and if not why"
--
-- Decisions this implements:
--   * "Early" = worked less than a minimum-hours threshold (not a wall-clock
--     finish time), so staggered start times don't produce false positives.
--   * Lunch is RECORDED ONLY - it is not deducted from hours_worked, so
--     process_payroll() is unaffected by this change.
--   * Answers are REQUIRED when triggered. Enforced in the function, not just
--     the UI, so calling the RPC directly cannot skip the questions.
--
-- Run AFTER FIX_CLOCK_IN_HR_INTEGRATION.sql.
-- ============================================================================


-- ============================================================================
-- STEP 1: columns
-- ============================================================================
-- Kept as discrete columns rather than free text in `notes`, because the whole
-- point is to be able to query "who skipped lunch", "who left early and why"
-- for a payroll or disciplinary conversation. That is exactly what the old
-- clock_in got wrong by writing times into notes as prose.
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS lunch_taken      BOOLEAN;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS lunch_minutes    INTEGER;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS no_lunch_reason  TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS early_out_reason TEXT;


-- ============================================================================
-- STEP 2: one definition of "a full day"
-- ============================================================================
-- Both clock_out (which enforces) and get_attendance_status (which tells the
-- UI whether to show the "why early" field) need this number. Defining it in
-- one function keeps them from drifting apart. To make it configurable per
-- business later, give this a p_business_id argument and read a settings row -
-- every caller already passes a business id.
CREATE OR REPLACE FUNCTION public.zf_min_shift_hours()
RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
  SELECT 8.0::NUMERIC;
$$;


-- ============================================================================
-- STEP 3: clock_out, now asking the questions
-- ============================================================================
-- The 3-argument version must go, or PostgREST sees two overloads and cannot
-- decide which to call when the frontend sends only the original arguments.
DROP FUNCTION IF EXISTS public.clock_out(UUID, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.clock_out(
  p_user_id         UUID,
  p_business_id     INTEGER,
  p_notes           TEXT    DEFAULT NULL,
  p_lunch_taken     BOOLEAN DEFAULT NULL,
  p_lunch_minutes   INTEGER DEFAULT NULL,
  p_no_lunch_reason TEXT    DEFAULT NULL,
  p_early_reason    TEXT    DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, message TEXT, employee_id INTEGER, hours_worked NUMERIC, clock_out_time TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER AS $$
-- Same ambiguity guard as clock_in: employee_id and hours_worked are OUT
-- variables here and also columns on attendance.
#variable_conflict use_column
DECLARE
  v         RECORD;
  v_rec     RECORD;
  v_hours   NUMERIC;
  v_min     NUMERIC := public.zf_min_shift_hours();
  v_is_early BOOLEAN;
BEGIN
  SELECT * INTO v FROM public.zf_resolve_employee(p_user_id, p_business_id);

  IF v.employee_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'No HR employee record is linked to your login.'::TEXT,
      NULL::INTEGER, NULL::NUMERIC, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  SELECT * INTO v_rec FROM public.attendance a
  WHERE a.employee_id = v.employee_id AND a.attendance_date = CURRENT_DATE
  LIMIT 1;

  IF v_rec.id IS NULL OR v_rec.clock_in IS NULL THEN
    RETURN QUERY SELECT FALSE, 'You have not clocked in today'::TEXT,
      v.employee_id, NULL::NUMERIC, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF v_rec.clock_out IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, 'Already clocked out today'::TEXT,
      v.employee_id, v_rec.hours_worked, v_rec.clock_out;
    RETURN;
  END IF;

  v_hours    := ROUND(EXTRACT(EPOCH FROM (NOW() - v_rec.clock_in)) / 3600.0, 2);
  v_is_early := v_hours < v_min;

  -- ---- Required answers -------------------------------------------------
  -- Returned as success=false with a plain message rather than RAISE, so the
  -- existing frontend shows it in the same alert it already uses for
  -- "Already clocked out today".
  IF p_lunch_taken IS NULL THEN
    RETURN QUERY SELECT FALSE,
      'Please say whether you took a lunch break.'::TEXT,
      v.employee_id, NULL::NUMERIC, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF p_lunch_taken AND COALESCE(p_lunch_minutes, 0) <= 0 THEN
    RETURN QUERY SELECT FALSE,
      'Please enter how many minutes your lunch break lasted.'::TEXT,
      v.employee_id, NULL::NUMERIC, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF NOT p_lunch_taken AND COALESCE(TRIM(p_no_lunch_reason), '') = '' THEN
    RETURN QUERY SELECT FALSE,
      'Please give a reason for not taking a lunch break.'::TEXT,
      v.employee_id, NULL::NUMERIC, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF v_is_early AND COALESCE(TRIM(p_early_reason), '') = '' THEN
    RETURN QUERY SELECT FALSE,
      ('You are clocking out after ' || v_hours || ' hours, under the ' || v_min ||
       '-hour day. Please give a reason.')::TEXT,
      v.employee_id, NULL::NUMERIC, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- ---- Record -----------------------------------------------------------
  -- hours_worked deliberately stays the full clock-in to clock-out span:
  -- lunch is recorded for HR, not deducted from pay.
  UPDATE public.attendance
  SET clock_out        = NOW(),
      hours_worked     = v_hours,
      lunch_taken      = p_lunch_taken,
      lunch_minutes    = CASE WHEN p_lunch_taken THEN p_lunch_minutes ELSE NULL END,
      no_lunch_reason  = CASE WHEN p_lunch_taken THEN NULL ELSE TRIM(p_no_lunch_reason) END,
      early_out_reason = CASE WHEN v_is_early THEN TRIM(p_early_reason) ELSE NULL END,
      notes            = COALESCE(p_notes, notes)
  WHERE id = v_rec.id;

  RETURN QUERY SELECT TRUE,
    ('Clocked out - ' || v_hours || ' hours today')::TEXT, v.employee_id, v_hours, NOW();
END;
$$;


-- ============================================================================
-- STEP 4: tell the UI what a full day is
-- ============================================================================
-- The employee page already polls this for the running timer, so it is the
-- natural place to hand over the threshold. The UI uses it to decide whether
-- to show the "why early" field BEFORE submitting - the check in clock_out is
-- the backstop, not the prompt.
DROP FUNCTION IF EXISTS public.get_attendance_status(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.get_attendance_status(
  p_user_id UUID,
  p_business_id INTEGER
)
RETURNS TABLE (is_clocked_in BOOLEAN, elapsed_minutes INTEGER, min_hours NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER AS $$
#variable_conflict use_column
DECLARE
  v     RECORD;
  v_rec RECORD;
BEGIN
  SELECT * INTO v FROM public.zf_resolve_employee(p_user_id, p_business_id);
  IF v.employee_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, public.zf_min_shift_hours(); RETURN;
  END IF;

  SELECT * INTO v_rec FROM public.attendance a
  WHERE a.employee_id = v.employee_id AND a.attendance_date = CURRENT_DATE
  LIMIT 1;

  IF v_rec.id IS NULL OR v_rec.clock_in IS NULL OR v_rec.clock_out IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, 0, public.zf_min_shift_hours(); RETURN;
  END IF;

  RETURN QUERY SELECT TRUE,
    GREATEST(0, EXTRACT(EPOCH FROM (NOW() - v_rec.clock_in))::INTEGER / 60),
    public.zf_min_shift_hours();
END;
$$;


-- ============================================================================
-- STEP 5: surface it all on the HR attendance board
-- ============================================================================
-- Capturing the answers is only half the feature - HR has to be able to see
-- them. Supersedes the definition in ADD_MISSED_CLOCKIN_ALERTS.sql.
DROP FUNCTION IF EXISTS public.get_daily_attendance(INTEGER, DATE);

CREATE OR REPLACE FUNCTION public.get_daily_attendance(
  p_branch_id INTEGER,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  employee_id INTEGER,
  employee_code TEXT,
  full_name TEXT,
  department TEXT,
  status TEXT,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  hours_worked NUMERIC,
  lunch_taken BOOLEAN,
  lunch_minutes INTEGER,
  no_lunch_reason TEXT,
  early_out_reason TEXT,
  notes TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.employee_code,
    (e.first_name || ' ' || e.last_name)::TEXT,
    COALESCE(d.name, 'Unassigned')::TEXT,
    COALESCE(a.status, 'NOT_CLOCKED_IN')::TEXT,
    a.clock_in,
    a.clock_out,
    a.hours_worked,
    a.lunch_taken,
    a.lunch_minutes,
    a.no_lunch_reason,
    a.early_out_reason,
    a.notes
  FROM public.employees e
  LEFT JOIN public.departments d ON d.id = e.department_id
  LEFT JOIN public.attendance a
    ON a.employee_id = e.id AND a.attendance_date = p_date AND a.branch_id = p_branch_id
  WHERE e.branch_id = p_branch_id
    AND e.status = 'ACTIVE'
  ORDER BY e.employee_code;
END;
$$;


NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- clock_out should appear ONCE, with seven arguments.
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('clock_in','clock_out','get_attendance_status',
                    'get_daily_attendance','zf_min_shift_hours')
ORDER BY p.proname;
