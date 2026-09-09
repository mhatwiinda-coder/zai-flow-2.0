-- ============================================================================
-- LEAVE STAGE 2: approval rules, sick-day recording, rejection reasons
-- ============================================================================
-- What was already right, verified on the live database before touching it:
-- approve_leave ALREADY loops the date range and writes attendance rows with
-- ON CONFLICT handling. The missed-clock-in problem that looked likely does
-- not exist, so none of that behaviour is being replaced - it is preserved
-- below and three gaps are added around it.
--
-- 1. Approval never checked the balance. It could not - balances did not exist
--    until ADD_LEAVE_TYPES_AND_BALANCES.sql. HR could approve 30 days of
--    annual leave against 12 accrued.
-- 2. Every leave type recorded as attendance status 'LEAVE', so sick days were
--    indistinguishable from annual leave. "Days lost to sickness" is a
--    different number from "days on holiday" and absence reporting needs both.
-- 3. reject_leave had no reason parameter, so a refusal reached the employee
--    with no explanation.
--
-- Run AFTER ADD_LEAVE_TYPES_AND_BALANCES.sql.
-- ============================================================================


-- ============================================================================
-- STEP 1: each leave type says how it shows on the attendance board
-- ============================================================================
-- attendance.status already permits SICK; nothing was ever writing it.
-- Configurable per type rather than a hardcoded CASE, so adding a leave type
-- later does not mean editing a function.
ALTER TABLE public.leave_types
  ADD COLUMN IF NOT EXISTS attendance_status TEXT NOT NULL DEFAULT 'LEAVE';

-- Must match attendance's CHECK constraint or approval fails at the INSERT.
ALTER TABLE public.leave_types DROP CONSTRAINT IF EXISTS leave_types_attendance_status_check;
ALTER TABLE public.leave_types ADD CONSTRAINT leave_types_attendance_status_check
  CHECK (attendance_status IN ('PRESENT','ABSENT','LEAVE','SICK','LATE','HALF_DAY'));

UPDATE public.leave_types SET attendance_status = 'SICK' WHERE name = 'Sick Leave';


-- ============================================================================
-- STEP 2: approve_leave - balance enforced, with a deliberate override
-- ============================================================================
-- Straight blocking is too rigid: HR does grant leave ahead of accrual,
-- particularly near year end. Silently allowing an overdraw makes the balance
-- decorative. So it refuses by default, names the shortfall, and accepts an
-- explicit override that is recorded against the request - the decision stays
-- possible but never accidental, and leaves a trail.
DROP FUNCTION IF EXISTS public.approve_leave(INTEGER, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.approve_leave(
  p_leave_request_id INTEGER,
  p_branch_id        INTEGER,
  p_approved_by      INTEGER,
  p_override_balance BOOLEAN DEFAULT FALSE
)
-- needs_override is returned as its own column rather than left for the UI to
-- detect by matching on the message text - a refusal that can be retried is a
-- different thing from one that cannot, and that distinction should not depend
-- on the wording of a sentence.
RETURNS TABLE (success BOOLEAN, message TEXT, needs_override BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
#variable_conflict use_column
DECLARE
  v_req      RECORD;
  v_balance  RECORD;
  v_status   TEXT;
  v_day      DATE;
BEGIN
  -- Branch-scoped read: an id from another branch must not be approvable here.
  SELECT lr.*, lt.name AS type_name, lt.attendance_status, lt.days_per_year
  INTO v_req
  FROM public.leave_requests lr
  JOIN public.leave_types lt ON lt.id = lr.leave_type_id
  WHERE lr.id = p_leave_request_id AND lr.branch_id = p_branch_id;

  IF v_req.id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Leave request not found for this branch.'::TEXT, FALSE;
    RETURN;
  END IF;

  IF COALESCE(v_req.status, 'PENDING') <> 'PENDING' THEN
    RETURN QUERY SELECT FALSE,
      ('That request is already ' || LOWER(v_req.status) || '.')::TEXT, FALSE;
    RETURN;
  END IF;

  -- Balance check. days_entitled = 0 means uncapped (unpaid leave), so exempt.
  -- The request itself is still PENDING here, so its own days are inside
  -- days_pending - compare against entitled minus taken, not days_remaining,
  -- or the request would be counted against itself.
  SELECT * INTO v_balance
  FROM public.get_leave_balance(v_req.employee_id,
                               EXTRACT(YEAR FROM v_req.start_date)::INTEGER)
  WHERE leave_type_id = v_req.leave_type_id;

  IF v_balance.days_entitled > 0
     AND v_req.days_requested > (v_balance.days_entitled - v_balance.days_taken)
     AND NOT p_override_balance THEN
    RETURN QUERY SELECT FALSE,
      ('Over balance: ' || v_req.days_requested || ' day(s) requested but only ' ||
       (v_balance.days_entitled - v_balance.days_taken) || ' day(s) of ' ||
       v_req.type_name || ' remain this year.')::TEXT, TRUE;
    RETURN;
  END IF;

  UPDATE public.leave_requests
  SET status      = 'APPROVED',
      approved_by = p_approved_by,
      approved_at = NOW(),
      notes       = CASE
                      WHEN p_override_balance
                        THEN COALESCE(notes || ' | ', '') || 'Approved over balance by user ' || p_approved_by
                      ELSE notes
                    END
  WHERE id = p_leave_request_id;

  -- Mark every day of the range on the attendance board. Preserved from the
  -- original, with the status now coming from the leave type instead of being
  -- hardcoded, so sick days read as SICK.
  v_status := COALESCE(v_req.attendance_status, 'LEAVE');
  v_day := v_req.start_date;

  WHILE v_day <= v_req.end_date LOOP
    INSERT INTO public.attendance (branch_id, employee_id, attendance_date, status, notes)
    VALUES (p_branch_id, v_req.employee_id, v_day, v_status,
            v_req.type_name || ' (approved leave)')
    ON CONFLICT (branch_id, employee_id, attendance_date)
    DO UPDATE SET status = v_status,
                  notes  = v_req.type_name || ' (approved leave)';
    v_day := v_day + 1;
  END LOOP;

  RETURN QUERY SELECT TRUE,
    ('Approved ' || v_req.days_requested || ' day(s) of ' || v_req.type_name ||
     CASE WHEN p_override_balance THEN ' (over balance)' ELSE '' END)::TEXT, FALSE;
END;
$$;


-- ============================================================================
-- STEP 3: reject_leave - with a reason, and cleaning up after itself
-- ============================================================================
-- The 3-argument version has to go: with p_reason defaulting, a 3-argument
-- call would be ambiguous between the two overloads and PostgREST would fail.
DROP FUNCTION IF EXISTS public.reject_leave(INTEGER, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.reject_leave(
  p_leave_request_id INTEGER,
  p_branch_id        INTEGER,
  p_approved_by      INTEGER,
  p_reason           TEXT DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
#variable_conflict use_column
DECLARE
  v_req RECORD;
BEGIN
  SELECT lr.*, lt.attendance_status
  INTO v_req
  FROM public.leave_requests lr
  JOIN public.leave_types lt ON lt.id = lr.leave_type_id
  WHERE lr.id = p_leave_request_id AND lr.branch_id = p_branch_id;

  IF v_req.id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Leave request not found for this branch.'::TEXT;
    RETURN;
  END IF;

  IF COALESCE(TRIM(p_reason), '') = '' THEN
    RETURN QUERY SELECT FALSE,
      'Please give a reason - the employee sees this and otherwise has nothing to go on.'::TEXT;
    RETURN;
  END IF;

  UPDATE public.leave_requests
  SET status           = 'REJECTED',
      approved_by      = p_approved_by,
      approved_at      = NOW(),
      rejection_reason = TRIM(p_reason)
  WHERE id = p_leave_request_id;

  -- If this was already approved, its attendance rows are still standing and
  -- would leave someone marked on leave they no longer have. Only clears days
  -- that still look untouched - a row somebody has since clocked into, or that
  -- HR amended to something else, is left alone rather than silently undone.
  IF v_req.status = 'APPROVED' THEN
    DELETE FROM public.attendance a
    WHERE a.branch_id = p_branch_id
      AND a.employee_id = v_req.employee_id
      AND a.attendance_date BETWEEN v_req.start_date AND v_req.end_date
      AND a.status = COALESCE(v_req.attendance_status, 'LEAVE')
      AND a.clock_in IS NULL;
  END IF;

  RETURN QUERY SELECT TRUE, 'Leave request rejected.'::TEXT;
END;
$$;


NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Sick Leave should read SICK, everything else LEAVE.
SELECT name, attendance_status FROM public.leave_types ORDER BY name;

-- Each should appear ONCE, approve_leave with 4 arguments and reject_leave
-- with 4. Two rows for a name means an old overload survived.
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('approve_leave','reject_leave')
ORDER BY p.proname;
