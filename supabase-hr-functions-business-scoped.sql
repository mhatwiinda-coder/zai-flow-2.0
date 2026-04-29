-- ============================================================================
-- ZAI FLOW 2.0 - HR & PAYROLL RPC FUNCTIONS (BUSINESS-SCOPED, MULTI-TENANT)
-- All functions scoped to business_id for proper tenant isolation
-- Includes all necessary fields for HR module frontend
-- ============================================================================

-- ============================================================================
-- 1. GET EMPLOYEES BY BUSINESS (with department details)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_business_employees(INTEGER);
CREATE OR REPLACE FUNCTION public.get_business_employees(p_business_id INTEGER)
RETURNS TABLE (
  id INTEGER,
  employee_code TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  department_id INTEGER,
  "position" TEXT,
  status TEXT,
  hire_date DATE,
  departments JSONB
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.employee_code,
    e.first_name,
    e.last_name,
    e.email,
    e.phone,
    e.department_id,
    e."position",
    e.status,
    e.hire_date,
    jsonb_build_object('id', d.id, 'name', d.name) as departments
  FROM public.employees e
  LEFT JOIN public.departments d ON e.department_id = d.id
  WHERE e.business_id = p_business_id
  ORDER BY e.employee_code;
END;
$$;

-- ============================================================================
-- 2. GET DEPARTMENTS BY BUSINESS
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_business_departments(INTEGER);
CREATE OR REPLACE FUNCTION public.get_business_departments(p_business_id INTEGER)
RETURNS TABLE (
  id INTEGER,
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
-- 3. GET ATTENDANCE DATA BY BUSINESS (for date range)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_business_attendance(INTEGER, DATE, DATE);
CREATE OR REPLACE FUNCTION public.get_business_attendance(
  p_business_id INTEGER,
  p_from_date DATE,
  p_to_date DATE
)
RETURNS TABLE (
  employee_id INTEGER,
  employee_code TEXT,
  first_name TEXT,
  last_name TEXT,
  attendance_date DATE,
  status TEXT,
  hours_worked NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.employee_code,
    e.first_name,
    e.last_name,
    a.attendance_date,
    a.status,
    a.hours_worked
  FROM public.employees e
  LEFT JOIN public.attendance a ON e.id = a.employee_id
    AND a.attendance_date >= p_from_date
    AND a.attendance_date <= p_to_date
  WHERE e.business_id = p_business_id
    AND e.status = 'ACTIVE'
  ORDER BY e.employee_code, a.attendance_date;
END;
$$;

-- ============================================================================
-- 4. PROCESS PAYROLL BY BUSINESS (MULTI-TENANT)
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
  v_branch_id INTEGER;
  v_employee RECORD;
  v_deductions RECORD;
  v_total_gross NUMERIC := 0;
  v_total_paye NUMERIC := 0;
  v_total_pension NUMERIC := 0;
  v_total_deductions NUMERIC := 0;
  v_total_net NUMERIC := 0;
  v_employee_count INTEGER := 0;
  v_basic_salary NUMERIC;
BEGIN
  -- Validate business exists
  IF NOT EXISTS (SELECT 1 FROM public.business_entities WHERE id = p_business_id) THEN
    RETURN QUERY SELECT NULL::INTEGER, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, 0, 'Business not found'::TEXT;
    RETURN;
  END IF;

  -- Get the primary branch for this business (should have a main branch)
  SELECT id INTO v_branch_id
  FROM public.branches
  WHERE business_id = p_business_id
  LIMIT 1;

  IF v_branch_id IS NULL THEN
    RETURN QUERY SELECT NULL::INTEGER, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, 0, 'No branch found for business'::TEXT;
    RETURN;
  END IF;

  -- Check if payroll already exists for this month/year
  IF EXISTS (SELECT 1 FROM public.payroll_runs
             WHERE business_id = p_business_id AND month = p_month AND year = p_year AND status != 'REVERSED') THEN
    RETURN QUERY SELECT NULL::INTEGER, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, 0, 'Payroll already exists for this period'::TEXT;
    RETURN;
  END IF;

  -- Create payroll run
  INSERT INTO public.payroll_runs (branch_id, business_id, month, year, status, run_date)
  VALUES (v_branch_id, p_business_id, p_month, p_year, 'PROCESSING', CURRENT_DATE)
  RETURNING id INTO v_payroll_run_id;

  -- Process each active employee in this business
  FOR v_employee IN
    SELECT e.id, e.employee_code, e.first_name, e.last_name
    FROM public.employees e
    WHERE e.business_id = p_business_id AND e.status = 'ACTIVE'
    ORDER BY e.employee_code
  LOOP
    -- Get latest salary structure
    SELECT ss.* INTO v_deductions
    FROM public.salary_structures ss
    WHERE ss.employee_id = v_employee.id
    AND ss.effective_date <= CURRENT_DATE
    ORDER BY ss.effective_date DESC
    LIMIT 1;

    IF v_deductions IS NULL THEN
      CONTINUE; -- Skip employees without salary structure
    END IF;

    v_basic_salary := v_deductions.basic_salary;

    -- For now, use simplified deduction calculation
    -- In production, call calculate_deductions() function
    v_employee_count := v_employee_count + 1;
    v_total_gross := v_total_gross + v_basic_salary;
    v_total_net := v_total_net + v_basic_salary;

    -- Insert payroll deduction record
    INSERT INTO public.payroll_deductions (payroll_run_id, employee_id, business_id, basic_salary, gross_salary, net_salary)
    VALUES (v_payroll_run_id, v_employee.id, p_business_id, v_basic_salary, v_basic_salary, v_basic_salary);
  END LOOP;

  -- Update payroll run with totals
  UPDATE public.payroll_runs
  SET
    total_gross = v_total_gross,
    total_deductions = v_total_deductions,
    total_net = v_total_net,
    employee_count = v_employee_count,
    status = 'COMPLETED'
  WHERE id = v_payroll_run_id;

  RETURN QUERY SELECT
    v_payroll_run_id,
    v_total_gross,
    v_total_deductions,
    v_total_net,
    v_employee_count,
    'Payroll processed successfully for ' || v_employee_count::TEXT || ' employees'::TEXT;
END;
$$;

-- ============================================================================
-- 5. GET LEAVE REQUESTS BY BUSINESS
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_business_leave_requests(INTEGER);
CREATE OR REPLACE FUNCTION public.get_business_leave_requests(p_business_id INTEGER)
RETURNS TABLE (
  id INTEGER,
  employee_id INTEGER,
  employee_name TEXT,
  leave_type_id INTEGER,
  leave_type_name TEXT,
  start_date DATE,
  end_date DATE,
  days_requested INTEGER,
  status TEXT,
  approved_by INTEGER,
  created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    lr.id,
    lr.employee_id,
    e.first_name || ' ' || e.last_name,
    lr.leave_type_id,
    lt.name,
    lr.start_date,
    lr.end_date,
    lr.days_requested,
    lr.status,
    lr.approved_by,
    lr.created_at
  FROM public.leave_requests lr
  JOIN public.employees e ON lr.employee_id = e.id
  LEFT JOIN public.leave_types lt ON lr.leave_type_id = lt.id
  WHERE e.business_id = p_business_id
  ORDER BY lr.created_at DESC;
END;
$$;

-- ============================================================================
-- 6. GET HR ANALYTICS DATA BY BUSINESS
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_business_hr_analytics(INTEGER);
CREATE OR REPLACE FUNCTION public.get_business_hr_analytics(p_business_id INTEGER)
RETURNS TABLE (
  total_employees INTEGER,
  active_employees INTEGER,
  inactive_employees INTEGER,
  terminated_employees INTEGER,
  on_leave_today INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total INTEGER;
  v_active INTEGER;
  v_inactive INTEGER;
  v_terminated INTEGER;
  v_on_leave_today INTEGER;
BEGIN
  -- Get total employees
  SELECT COUNT(*) INTO v_total
  FROM public.employees
  WHERE business_id = p_business_id;

  -- Get active employees
  SELECT COUNT(*) INTO v_active
  FROM public.employees
  WHERE business_id = p_business_id AND status = 'ACTIVE';

  -- Get inactive employees
  SELECT COUNT(*) INTO v_inactive
  FROM public.employees
  WHERE business_id = p_business_id AND status = 'INACTIVE';

  -- Get terminated employees
  SELECT COUNT(*) INTO v_terminated
  FROM public.employees
  WHERE business_id = p_business_id AND status = 'TERMINATED';

  -- Get employees on leave today
  SELECT COUNT(DISTINCT e.id) INTO v_on_leave_today
  FROM public.employees e
  LEFT JOIN public.attendance a ON e.id = a.employee_id
    AND a.attendance_date = CURRENT_DATE
  WHERE e.business_id = p_business_id
    AND a.status = 'LEAVE';

  RETURN QUERY SELECT v_total, v_active, v_inactive, v_terminated, COALESCE(v_on_leave_today, 0);
END;
$$;
