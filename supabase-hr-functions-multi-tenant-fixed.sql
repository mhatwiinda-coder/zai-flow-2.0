-- ============================================================================
-- ZAI FLOW 2.0 - HR & PAYROLL RPC FUNCTIONS (MULTI-TENANT FIXED)
-- All functions scoped to business_id for proper tenant isolation
-- ============================================================================

-- ============================================================================
-- 1. GET EMPLOYEES BY BUSINESS
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_business_employees(INTEGER);
CREATE OR REPLACE FUNCTION public.get_business_employees(p_business_id INTEGER)
RETURNS TABLE (
  employee_id INTEGER,
  employee_code TEXT,
  first_name TEXT,
  last_name TEXT,
  department_id INTEGER,
  "position" TEXT,
  status TEXT,
  hire_date DATE
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.employee_code,
    e.first_name,
    e.last_name,
    e.department_id,
    e."position",
    e.status,
    e.hire_date
  FROM public.employees e
  WHERE e.business_id = p_business_id
  ORDER BY e.employee_code;
END;
$$;

-- ============================================================================
-- 2. CREATE EMPLOYEE (MULTI-TENANT)
-- ============================================================================
DROP FUNCTION IF EXISTS public.create_employee(INTEGER, TEXT, TEXT, TEXT, INTEGER, TEXT, DATE, TEXT);
CREATE OR REPLACE FUNCTION public.create_employee(
  p_business_id INTEGER,
  p_employee_code TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_department_id INTEGER,
  p_position TEXT,
  p_hire_date DATE,
  p_email TEXT
)
RETURNS TABLE (
  employee_id INTEGER,
  employee_code TEXT,
  message TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_employee_id INTEGER;
BEGIN
  -- Validate business exists
  IF NOT EXISTS (SELECT 1 FROM public.business_entities WHERE id = p_business_id) THEN
    RETURN QUERY SELECT NULL::INTEGER, NULL::TEXT, 'Business not found'::TEXT;
    RETURN;
  END IF;

  -- Check if employee code already exists in this business
  IF EXISTS (SELECT 1 FROM public.employees WHERE employee_code = p_employee_code AND business_id = p_business_id) THEN
    RETURN QUERY SELECT NULL::INTEGER, NULL::TEXT, 'Employee code already exists in this business'::TEXT;
    RETURN;
  END IF;

  -- Create employee
  INSERT INTO public.employees (business_id, employee_code, first_name, last_name, department_id, "position", hire_date, email, status)
  VALUES (p_business_id, p_employee_code, p_first_name, p_last_name, p_department_id, p_position, p_hire_date, p_email, 'ACTIVE')
  RETURNING id INTO v_employee_id;

  RETURN QUERY SELECT v_employee_id, p_employee_code, 'Employee created successfully'::TEXT;
END;
$$;

-- ============================================================================
-- 3. GET DEPARTMENTS (MULTI-TENANT)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_business_departments(INTEGER);
CREATE OR REPLACE FUNCTION public.get_business_departments(p_business_id INTEGER)
RETURNS TABLE (
  department_id INTEGER,
  name TEXT,
  description TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.name,
    d.description
  FROM public.departments d
  WHERE d.business_id = p_business_id
  ORDER BY d.name;
END;
$$;

-- ============================================================================
-- 4. PROCESS PAYROLL (MULTI-TENANT)
-- ============================================================================
DROP FUNCTION IF EXISTS public.process_payroll(INTEGER, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION public.process_payroll(
  p_business_id INTEGER,
  p_month INTEGER,
  p_year INTEGER
)
RETURNS TABLE (
  payroll_run_id INTEGER,
  total_gross NUMERIC,
  total_deductions NUMERIC,
  total_net NUMERIC,
  employee_count INTEGER,
  message TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_payroll_run_id INTEGER;
  v_employee RECORD;
  v_gross NUMERIC;
  v_paye NUMERIC;
  v_pension NUMERIC;
  v_net NUMERIC;
  v_total_gross NUMERIC := 0;
  v_total_paye NUMERIC := 0;
  v_total_pension NUMERIC := 0;
  v_total_net NUMERIC := 0;
  v_employee_count INTEGER := 0;
BEGIN
  -- Validate business exists
  IF NOT EXISTS (SELECT 1 FROM public.business_entities WHERE id = p_business_id) THEN
    RETURN QUERY SELECT NULL::INTEGER, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, 0, 'Business not found'::TEXT;
    RETURN;
  END IF;

  -- Check if payroll already exists for this month/year
  IF EXISTS (SELECT 1 FROM public.payroll_runs
             WHERE business_id = p_business_id AND month = p_month AND year = p_year AND status != 'REVERSED') THEN
    RETURN QUERY SELECT NULL::INTEGER, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, 0, 'Payroll already exists for this period'::TEXT;
    RETURN;
  END IF;

  -- Create payroll run
  INSERT INTO public.payroll_runs (business_id, month, year, status, run_date)
  VALUES (p_business_id, p_month, p_year, 'PROCESSING', NOW())
  RETURNING id INTO v_payroll_run_id;

  -- Process each active employee
  FOR v_employee IN
    SELECT e.id, e.first_name, e.last_name
    FROM public.employees e
    WHERE e.business_id = p_business_id AND e.status = 'ACTIVE'
  LOOP
    v_employee_count := v_employee_count + 1;

    -- Get salary structure and calculate deductions
    -- (Assuming basic salary for now - can be extended)
    v_gross := 5000; -- Placeholder basic salary
    v_paye := v_gross * 0.15; -- 15% PAYE (simplified)
    v_pension := v_gross * 0.10; -- 10% pension
    v_net := v_gross - v_paye - v_pension;

    -- Insert payroll deduction record
    INSERT INTO public.payroll_deductions (payroll_run_id, employee_id, gross_salary, paye_tax, pension_contribution, net_salary)
    VALUES (v_payroll_run_id, v_employee.id, v_gross, v_paye, v_pension, v_net);

    v_total_gross := v_total_gross + v_gross;
    v_total_paye := v_total_paye + v_paye;
    v_total_pension := v_total_pension + v_pension;
    v_total_net := v_total_net + v_net;
  END LOOP;

  -- Update payroll run with totals
  UPDATE public.payroll_runs
  SET
    total_gross = v_total_gross,
    total_deductions = (v_total_paye + v_total_pension),
    total_net = v_total_net,
    status = 'COMPLETED'
  WHERE id = v_payroll_run_id;

  RETURN QUERY SELECT
    v_payroll_run_id,
    v_total_gross,
    (v_total_paye + v_total_pension),
    v_total_net,
    v_employee_count,
    'Payroll processed successfully for ' || v_employee_count::TEXT || ' employees'::TEXT;
END;
$$;

-- ============================================================================
-- 5. GET PAYROLL SUMMARY (MULTI-TENANT)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_payroll_summary(INTEGER, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION public.get_payroll_summary(
  p_business_id INTEGER,
  p_month INTEGER,
  p_year INTEGER
)
RETURNS TABLE (
  payroll_run_id INTEGER,
  status TEXT,
  total_gross NUMERIC,
  total_net NUMERIC,
  employee_count INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.id,
    pr.status,
    pr.total_gross,
    pr.total_net,
    (SELECT COUNT(*) FROM public.payroll_deductions WHERE payroll_run_id = pr.id)::INTEGER
  FROM public.payroll_runs pr
  WHERE pr.business_id = p_business_id
    AND pr.month = p_month
    AND pr.year = p_year;
END;
$$;

-- ============================================================================
-- 6. GET ATTENDANCE BY BUSINESS (MULTI-TENANT)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_attendance_summary(INTEGER, DATE, DATE);
CREATE OR REPLACE FUNCTION public.get_attendance_summary(
  p_business_id INTEGER,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  employee_id INTEGER,
  employee_code TEXT,
  first_name TEXT,
  last_name TEXT,
  total_present INTEGER,
  total_absent INTEGER,
  total_leave INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.employee_code,
    e.first_name,
    e.last_name,
    COALESCE((SELECT COUNT(*) FROM public.attendance a
              WHERE a.employee_id = e.id AND a.status = 'PRESENT'
              AND a.attendance_date BETWEEN p_start_date AND p_end_date), 0)::INTEGER,
    COALESCE((SELECT COUNT(*) FROM public.attendance a
              WHERE a.employee_id = e.id AND a.status = 'ABSENT'
              AND a.attendance_date BETWEEN p_start_date AND p_end_date), 0)::INTEGER,
    COALESCE((SELECT COUNT(*) FROM public.attendance a
              WHERE a.employee_id = e.id AND a.status = 'LEAVE'
              AND a.attendance_date BETWEEN p_start_date AND p_end_date), 0)::INTEGER
  FROM public.employees e
  WHERE e.business_id = p_business_id
  ORDER BY e.employee_code;
END;
$$;

-- ============================================================================
-- 7. RECORD ATTENDANCE (MULTI-TENANT)
-- ============================================================================
DROP FUNCTION IF EXISTS public.record_attendance(INTEGER, INTEGER, DATE, TEXT);
CREATE OR REPLACE FUNCTION public.record_attendance(
  p_employee_id INTEGER,
  p_business_id INTEGER,
  p_attendance_date DATE,
  p_status TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- Validate employee belongs to business
  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id = p_employee_id AND business_id = p_business_id) THEN
    RETURN QUERY SELECT FALSE, 'Employee not found in this business'::TEXT;
    RETURN;
  END IF;

  -- Check if attendance already recorded
  SELECT EXISTS(SELECT 1 FROM public.attendance
                WHERE employee_id = p_employee_id AND attendance_date = p_attendance_date)
  INTO v_exists;

  IF v_exists THEN
    -- Update existing
    UPDATE public.attendance
    SET status = p_status
    WHERE employee_id = p_employee_id AND attendance_date = p_attendance_date;
  ELSE
    -- Insert new
    INSERT INTO public.attendance (employee_id, attendance_date, status)
    VALUES (p_employee_id, p_attendance_date, p_status);
  END IF;

  RETURN QUERY SELECT TRUE, 'Attendance recorded successfully'::TEXT;
END;
$$;

-- ============================================================================
-- 8. REQUEST LEAVE (MULTI-TENANT)
-- ============================================================================
DROP FUNCTION IF EXISTS public.request_leave(INTEGER, INTEGER, INTEGER, DATE, DATE, TEXT);
CREATE OR REPLACE FUNCTION public.request_leave(
  p_employee_id INTEGER,
  p_business_id INTEGER,
  p_leave_type_id INTEGER,
  p_start_date DATE,
  p_end_date DATE,
  p_notes TEXT
)
RETURNS TABLE (
  leave_request_id INTEGER,
  message TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_leave_request_id INTEGER;
  v_days_requested INTEGER;
BEGIN
  -- Validate employee belongs to business
  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id = p_employee_id AND business_id = p_business_id) THEN
    RETURN QUERY SELECT NULL::INTEGER, 'Employee not found'::TEXT;
    RETURN;
  END IF;

  -- Calculate days
  v_days_requested := (p_end_date - p_start_date) + 1;

  -- Create leave request
  INSERT INTO public.leave_requests (employee_id, leave_type_id, start_date, end_date, days_requested, status, notes)
  VALUES (p_employee_id, p_leave_type_id, p_start_date, p_end_date, v_days_requested, 'PENDING', p_notes)
  RETURNING id INTO v_leave_request_id;

  RETURN QUERY SELECT v_leave_request_id, 'Leave request submitted successfully'::TEXT;
END;
$$;

-- ============================================================================
-- 9. APPROVE LEAVE (MULTI-TENANT)
-- ============================================================================
DROP FUNCTION IF EXISTS public.approve_leave(INTEGER, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION public.approve_leave(
  p_leave_request_id INTEGER,
  p_business_id INTEGER,
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
  -- Get leave request details
  SELECT lr.employee_id, lr.start_date, lr.end_date
  INTO v_employee_id, v_start_date, v_end_date
  FROM public.leave_requests lr
  WHERE lr.id = p_leave_request_id
  AND EXISTS (SELECT 1 FROM public.employees e WHERE e.id = lr.employee_id AND e.business_id = p_business_id);

  IF v_employee_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Leave request not found'::TEXT;
    RETURN;
  END IF;

  -- Update leave request
  UPDATE public.leave_requests
  SET status = 'APPROVED', approved_by = p_approved_by, approved_at = NOW()
  WHERE id = p_leave_request_id;

  -- Mark attendance as LEAVE for each day
  v_current_date := v_start_date;
  WHILE v_current_date <= v_end_date LOOP
    INSERT INTO public.attendance (employee_id, attendance_date, status)
    VALUES (v_employee_id, v_current_date, 'LEAVE')
    ON CONFLICT (employee_id, attendance_date) DO UPDATE SET status = 'LEAVE';

    v_current_date := v_current_date + INTERVAL '1 day';
  END LOOP;

  RETURN QUERY SELECT TRUE, 'Leave approved successfully'::TEXT;
END;
$$;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- All HR/Payroll RPC functions have been updated to:
-- 1. Accept business_id as parameter
-- 2. Filter queries by business_id for tenant isolation
-- 3. Have SECURITY DEFINER for RLS bypass
-- 4. Return appropriate status/message columns
-- ============================================================================
