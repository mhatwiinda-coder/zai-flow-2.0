-- ============================================================================
-- FIX: approve_leave() and reject_leave() reference employees.business_id,
-- which does not exist (employees is branch-scoped only). Every call to
-- either function was failing server-side with "column e.business_id does
-- not exist". This also fixes the attendance INSERT inside approve_leave,
-- which was missing the required branch_id and used an ON CONFLICT target
-- that didn't match the real UNIQUE(branch_id, employee_id, attendance_date)
-- constraint.
--
-- Run this AFTER deploying the matching frontend fix to hr.js (which now
-- calls these with p_branch_id instead of p_business_id).
-- ============================================================================

DROP FUNCTION IF EXISTS public.approve_leave(INTEGER, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION public.approve_leave(
  p_leave_request_id INTEGER,
  p_branch_id INTEGER,
  p_approved_by INTEGER
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_employee_id INTEGER;
  v_start_date DATE;
  v_end_date DATE;
  v_current_date DATE;
BEGIN
  -- leave_requests is branch-scoped directly, no need to join employees
  SELECT lr.employee_id, lr.start_date, lr.end_date
  INTO v_employee_id, v_start_date, v_end_date
  FROM public.leave_requests lr
  WHERE lr.id = p_leave_request_id
  AND lr.branch_id = p_branch_id;

  IF v_employee_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Leave request not found'::TEXT;
    RETURN;
  END IF;

  UPDATE public.leave_requests
  SET status = 'APPROVED', approved_by = p_approved_by, approved_at = NOW()
  WHERE id = p_leave_request_id;

  v_current_date := v_start_date;
  WHILE v_current_date <= v_end_date LOOP
    INSERT INTO public.attendance (branch_id, employee_id, attendance_date, status)
    VALUES (p_branch_id, v_employee_id, v_current_date, 'LEAVE')
    ON CONFLICT (branch_id, employee_id, attendance_date) DO UPDATE SET status = 'LEAVE';

    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;

  RETURN QUERY SELECT TRUE, 'Leave approved successfully'::TEXT;
END;
$$;

DROP FUNCTION IF EXISTS public.reject_leave(INTEGER, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION public.reject_leave(
  p_leave_request_id INTEGER,
  p_branch_id INTEGER,
  p_approved_by INTEGER
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_employee_id INTEGER;
BEGIN
  SELECT lr.employee_id
  INTO v_employee_id
  FROM public.leave_requests lr
  WHERE lr.id = p_leave_request_id
  AND lr.branch_id = p_branch_id;

  IF v_employee_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Leave request not found'::TEXT;
    RETURN;
  END IF;

  UPDATE public.leave_requests
  SET
    status = 'REJECTED',
    approved_by = p_approved_by,
    approved_at = NOW()
  WHERE id = p_leave_request_id;

  RETURN QUERY SELECT TRUE, 'Leave request rejected successfully'::TEXT;
END;
$$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT routine_name, string_agg(parameter_name, ', ' ORDER BY ordinal_position) AS params
FROM information_schema.routines r
JOIN information_schema.parameters p ON p.specific_name = r.specific_name
WHERE r.routine_name IN ('approve_leave', 'reject_leave')
GROUP BY routine_name;
-- Both should show: p_leave_request_id, p_branch_id, p_approved_by
