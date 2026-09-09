-- ============================================================================
-- LEAVE STAGE 1: statutory leave types, accrual, and balances
-- ============================================================================
-- Verified live on 2026-09-09: public.leave_types is EMPTY. leave_requests and
-- request_leave() both exist, so the reason HR's queue has never had anything
-- in it is simply that there is no leave type to request.
--
-- ============================================================================
-- ⚠️  VERIFY THESE NUMBERS BEFORE RELYING ON THEM
-- ============================================================================
-- The entitlements below are drafted from the Employment Code Act No. 3 of
-- 2019, but they are a STARTING POINT, not legal advice. Several carry service
-- length qualifications that are deliberately NOT encoded here (maternity in
-- particular is conditional on continuous service). Have your accountant or a
-- labour consultant confirm each line before payroll depends on it.
--
-- Everything is seeded from the single VALUES block in STEP 2, so correcting a
-- number is a one-line edit followed by a re-run.
-- ============================================================================


-- ============================================================================
-- STEP 1: accrual support
-- ============================================================================
-- Annual leave under the Act accrues per month of service rather than landing
-- as a lump sum in January. Without this, someone hired in October shows a
-- full year's entitlement on their first day.
--
-- NULL accrual_days_per_month = the full days_per_year is available up front,
-- which is the right behaviour for maternity, paternity and compassionate.
ALTER TABLE public.leave_types
  ADD COLUMN IF NOT EXISTS accrual_days_per_month NUMERIC(4,2);

ALTER TABLE public.leave_types
  ADD COLUMN IF NOT EXISTS description TEXT;

-- reject_leave has nowhere to record WHY something was refused - the column the
-- schema file claims exists was never actually created.
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;


-- ============================================================================
-- STEP 2: seed the statutory types
-- ============================================================================
-- Idempotent on name (leave_types.name is UNIQUE), so re-running corrects
-- values rather than creating duplicates.
INSERT INTO public.leave_types (name, days_per_year, is_paid, accrual_days_per_month, description)
VALUES
  -- 2 days per month of service, so 24 over a full year.
  ('Annual Leave',        24,  TRUE,  2.00,
   'Accrues at 2 days per month of service (Employment Code Act 2019).'),

  -- Expressed in days because days_per_year is an integer column.
  -- Commonly summarised as 3 months full pay then 3 months half pay; only the
  -- full-pay portion is modelled here. Half-pay handling is NOT implemented.
  ('Sick Leave',          90,  TRUE,  NULL,
   'Full-pay portion only (~3 months). Half-pay continuation is not modelled - handle manually.'),

  -- 14 weeks.
  ('Maternity Leave',     98,  TRUE,  NULL,
   '14 weeks. Subject to a continuous-service qualification NOT enforced here.'),

  ('Paternity Leave',      5,  TRUE,  NULL,
   '5 continuous days.'),

  ('Compassionate Leave', 12,  TRUE,  NULL,
   'Bereavement of a close family member.'),

  ('Family Responsibility Leave', 7, TRUE, NULL,
   'Subject to a qualifying service period NOT enforced here.'),

  ('Unpaid Leave',         0,  FALSE, NULL,
   'No entitlement cap - every day taken is unpaid.')
ON CONFLICT (name) DO UPDATE
SET days_per_year          = EXCLUDED.days_per_year,
    is_paid                = EXCLUDED.is_paid,
    accrual_days_per_month = EXCLUDED.accrual_days_per_month,
    description            = EXCLUDED.description;


-- ============================================================================
-- STEP 3: balances, computed rather than stored
-- ============================================================================
-- Deliberately NOT a balances table. A stored balance has to be kept in step
-- with every approval, rejection, cancellation and correction, and drifts the
-- first time one of those paths forgets to update it. Deriving it from
-- leave_requests means it is always right by construction.
--
-- PENDING is reported separately from TAKEN so HR can see committed days
-- before approving something that would overdraw the balance.
CREATE OR REPLACE FUNCTION public.get_leave_balance(
  p_employee_id INTEGER,
  p_year INTEGER DEFAULT NULL
)
RETURNS TABLE (
  leave_type_id INTEGER,
  leave_type TEXT,
  is_paid BOOLEAN,
  days_entitled NUMERIC,
  days_taken NUMERIC,
  days_pending NUMERIC,
  days_remaining NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_year      INTEGER := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER);
  v_hire_date DATE;
  v_months    NUMERIC;
BEGIN
  SELECT e.hire_date INTO v_hire_date FROM public.employees e WHERE e.id = p_employee_id;
  IF v_hire_date IS NULL THEN RETURN; END IF;

  -- Months of service WITHIN the requested year: a full 12 for someone who
  -- started before it began, fewer for a mid-year joiner, and capped at the
  -- current month so nobody accrues into the future.
  v_months := GREATEST(0, LEAST(
    12,
    CASE WHEN v_year > EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER THEN 0
         WHEN v_year = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER THEN EXTRACT(MONTH FROM CURRENT_DATE)::NUMERIC
         ELSE 12 END
    - CASE WHEN EXTRACT(YEAR FROM v_hire_date)::INTEGER = v_year
           THEN EXTRACT(MONTH FROM v_hire_date)::NUMERIC - 1
           WHEN EXTRACT(YEAR FROM v_hire_date)::INTEGER > v_year THEN 12
           ELSE 0 END
  ));

  RETURN QUERY
  SELECT
    lt.id,
    lt.name::TEXT,
    lt.is_paid,
    CASE
      WHEN lt.accrual_days_per_month IS NOT NULL
        THEN LEAST(lt.days_per_year::NUMERIC, ROUND(lt.accrual_days_per_month * v_months, 1))
      ELSE lt.days_per_year::NUMERIC
    END AS entitled,
    COALESCE(taken.days, 0),
    COALESCE(pending.days, 0),
    CASE
      WHEN lt.accrual_days_per_month IS NOT NULL
        THEN LEAST(lt.days_per_year::NUMERIC, ROUND(lt.accrual_days_per_month * v_months, 1))
      ELSE lt.days_per_year::NUMERIC
    END - COALESCE(taken.days, 0) - COALESCE(pending.days, 0)
  FROM public.leave_types lt
  LEFT JOIN LATERAL (
    SELECT SUM(lr.days_requested)::NUMERIC AS days
    FROM public.leave_requests lr
    WHERE lr.employee_id = p_employee_id
      AND lr.leave_type_id = lt.id
      AND lr.status = 'APPROVED'
      AND EXTRACT(YEAR FROM lr.start_date)::INTEGER = v_year
  ) taken ON TRUE
  LEFT JOIN LATERAL (
    SELECT SUM(lr.days_requested)::NUMERIC AS days
    FROM public.leave_requests lr
    WHERE lr.employee_id = p_employee_id
      AND lr.leave_type_id = lt.id
      AND lr.status = 'PENDING'
      AND EXTRACT(YEAR FROM lr.start_date)::INTEGER = v_year
  ) pending ON TRUE
  ORDER BY lt.name;
END;
$$;


-- ============================================================================
-- STEP 4: branch-scoped request_leave
-- ============================================================================
-- The existing one is business-scoped, the same legacy pattern that made
-- clock_in write rows HR could not see. leave_requests.branch_id is NOT NULL,
-- so the branch has to be resolved properly rather than guessed.
--
-- Named distinctly rather than replacing the business-scoped original: that one
-- may still be called from somewhere not yet audited, and an overload with the
-- same name would make PostgREST ambiguous.
CREATE OR REPLACE FUNCTION public.request_leave_for_user(
  p_user_id       UUID,
  p_business_id   INTEGER,
  p_leave_type_id INTEGER,
  p_start_date    DATE,
  p_end_date      DATE,
  p_notes         TEXT DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, message TEXT, leave_request_id INTEGER)
LANGUAGE plpgsql SECURITY DEFINER AS $$
#variable_conflict use_column
DECLARE
  v          RECORD;
  v_days     INTEGER;
  v_balance  RECORD;
  v_new_id   INTEGER;
BEGIN
  -- Same resolver clock-in uses, so it accepts either uuid convention.
  SELECT * INTO v FROM public.zf_resolve_employee(p_user_id, p_business_id);

  IF v.employee_id IS NULL THEN
    RETURN QUERY SELECT FALSE,
      'No HR employee record is linked to your login. Ask HR to complete your onboarding.'::TEXT,
      NULL::INTEGER;
    RETURN;
  END IF;

  IF v.branch_id IS NULL THEN
    RETURN QUERY SELECT FALSE,
      'Your employee record has no branch assigned. Ask HR to set one.'::TEXT, NULL::INTEGER;
    RETURN;
  END IF;

  IF p_end_date < p_start_date THEN
    RETURN QUERY SELECT FALSE, 'The end date cannot be before the start date.'::TEXT, NULL::INTEGER;
    RETURN;
  END IF;

  -- Calendar days inclusive. Working-day and public-holiday handling is NOT
  -- implemented - if you need it, it belongs here rather than in the UI.
  v_days := (p_end_date - p_start_date) + 1;

  -- Overlap guard: without it the same days can be booked twice across two
  -- requests and the balance silently double-counts.
  IF EXISTS (
    SELECT 1 FROM public.leave_requests lr
    WHERE lr.employee_id = v.employee_id
      AND lr.status IN ('PENDING','APPROVED')
      AND lr.start_date <= p_end_date
      AND lr.end_date   >= p_start_date
  ) THEN
    RETURN QUERY SELECT FALSE,
      'You already have leave requested or approved that overlaps these dates.'::TEXT, NULL::INTEGER;
    RETURN;
  END IF;

  -- Unpaid leave has no cap, so it is exempt from the balance check.
  SELECT * INTO v_balance
  FROM public.get_leave_balance(v.employee_id, EXTRACT(YEAR FROM p_start_date)::INTEGER)
  WHERE leave_type_id = p_leave_type_id;

  IF v_balance.leave_type_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'That leave type does not exist.'::TEXT, NULL::INTEGER;
    RETURN;
  END IF;

  IF v_balance.days_entitled > 0 AND v_days > v_balance.days_remaining THEN
    RETURN QUERY SELECT FALSE,
      ('That is ' || v_days || ' day(s) but you have only ' || v_balance.days_remaining ||
       ' day(s) of ' || v_balance.leave_type || ' left this year.')::TEXT, NULL::INTEGER;
    RETURN;
  END IF;

  INSERT INTO public.leave_requests (
    branch_id, employee_id, leave_type_id, start_date, end_date,
    days_requested, status, notes
  ) VALUES (
    v.branch_id, v.employee_id, p_leave_type_id, p_start_date, p_end_date,
    v_days, 'PENDING', p_notes
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT TRUE,
    ('Leave requested: ' || v_days || ' day(s), awaiting approval.')::TEXT, v_new_id;
END;
$$;


-- ============================================================================
-- STEP 5: the employee's own leave history
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_my_leave_requests(
  p_user_id     UUID,
  p_business_id INTEGER
)
RETURNS TABLE (
  id INTEGER,
  leave_type TEXT,
  start_date DATE,
  end_date DATE,
  days_requested INTEGER,
  status TEXT,
  notes TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
#variable_conflict use_column
DECLARE
  v RECORD;
BEGIN
  SELECT * INTO v FROM public.zf_resolve_employee(p_user_id, p_business_id);
  IF v.employee_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT lr.id, lt.name::TEXT, lr.start_date, lr.end_date, lr.days_requested,
         COALESCE(lr.status, 'PENDING')::TEXT, lr.notes, lr.rejection_reason, lr.created_at
  FROM public.leave_requests lr
  JOIN public.leave_types lt ON lt.id = lr.leave_type_id
  WHERE lr.employee_id = v.employee_id
  ORDER BY lr.start_date DESC;
END;
$$;


-- ============================================================================
-- STEP 6: balance lookup for the employee's own page
-- ============================================================================
-- get_leave_balance takes an employee_id, but the employee landing page only
-- ever holds a user uuid - it has no way to learn its own employee_id without
-- exposing a lookup that would also let it read anyone else's. This wrapper
-- resolves the caller and returns only their own balance.
CREATE OR REPLACE FUNCTION public.get_my_leave_balance(
  p_user_id     UUID,
  p_business_id INTEGER
)
RETURNS TABLE (
  leave_type_id INTEGER,
  leave_type TEXT,
  is_paid BOOLEAN,
  days_entitled NUMERIC,
  days_taken NUMERIC,
  days_pending NUMERIC,
  days_remaining NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v RECORD;
BEGIN
  SELECT * INTO v FROM public.zf_resolve_employee(p_user_id, p_business_id);
  IF v.employee_id IS NULL THEN RETURN; END IF;

  RETURN QUERY SELECT * FROM public.get_leave_balance(v.employee_id, NULL);
END;
$$;


NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT name, days_per_year, is_paid, accrual_days_per_month
FROM public.leave_types ORDER BY name;
-- Expect 7 rows.

-- Balance for employee 01 (Mainza). Annual Leave entitlement should reflect
-- months of service so far this year, not a flat 24.
-- SELECT * FROM public.get_leave_balance(
--   (SELECT id FROM public.employees WHERE employee_code = '01'));
