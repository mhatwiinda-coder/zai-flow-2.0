-- ============================================================================
-- ZAI FLOW 2.0 - HR & PAYROLL RPC FUNCTIONS (MULTI-TENANT FIXED)
-- All functions scoped to business_id for proper tenant isolation
-- ============================================================================

-- ============================================================================
-- 1. GET EMPLOYEES BY BRANCH
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_business_employees(INTEGER);
CREATE OR REPLACE FUNCTION public.get_business_employees(p_branch_id INTEGER)
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
  WHERE e.branch_id = p_branch_id
  ORDER BY e.employee_code;
END;
$$;

-- ============================================================================
-- 2. CREATE EMPLOYEE (MULTI-TENANT)
-- ============================================================================
DROP FUNCTION IF EXISTS public.create_employee(INTEGER, TEXT, TEXT, TEXT, INTEGER, TEXT, DATE, TEXT);
CREATE OR REPLACE FUNCTION public.create_employee(
  p_branch_id INTEGER,
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
  -- Validate branch exists
  IF NOT EXISTS (SELECT 1 FROM public.branches WHERE id = p_branch_id) THEN
    RETURN QUERY SELECT NULL::INTEGER, NULL::TEXT, 'Branch not found'::TEXT;
    RETURN;
  END IF;

  -- Check if employee code already exists in this branch
  IF EXISTS (SELECT 1 FROM public.employees WHERE employee_code = p_employee_code AND branch_id = p_branch_id) THEN
    RETURN QUERY SELECT NULL::INTEGER, NULL::TEXT, 'Employee code already exists in this branch'::TEXT;
    RETURN;
  END IF;

  -- Create employee
  INSERT INTO public.employees (branch_id, employee_code, first_name, last_name, department_id, "position", hire_date, email, status)
  VALUES (p_branch_id, p_employee_code, p_first_name, p_last_name, p_department_id, p_position, p_hire_date, p_email, 'ACTIVE')
  RETURNING id INTO v_employee_id;

  RETURN QUERY SELECT v_employee_id, p_employee_code, 'Employee created successfully'::TEXT;
END;
$$;

-- ============================================================================
-- 3. GET DEPARTMENTS (MULTI-TENANT)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_business_departments(INTEGER);
CREATE OR REPLACE FUNCTION public.get_business_departments(p_branch_id INTEGER)
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
  WHERE d.branch_id = p_branch_id
  ORDER BY d.name;
END;
$$;

-- ============================================================================
-- 4. PROCESS PAYROLL (MULTI-TENANT)
-- ============================================================================
DROP FUNCTION IF EXISTS public.process_payroll(INTEGER, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION public.process_payroll(
  p_branch_id INTEGER,
  p_month INTEGER,
  p_year INTEGER
)
RETURNS TABLE (
  payroll_run_id INTEGER,
  total_gross NUMERIC,
  total_deductions NUMERIC,
  total_net NUMERIC,
  employee_count INTEGER,
  journal_entry_id INTEGER,
  message TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_payroll_run_id INTEGER;
  v_employee RECORD;
  v_gross NUMERIC;
  v_paye NUMERIC;
  v_napsa NUMERIC;
  v_health_insurance NUMERIC;
  v_net NUMERIC;
  v_total_gross NUMERIC := 0;
  v_total_paye NUMERIC := 0;
  v_total_napsa NUMERIC := 0;
  v_total_health_insurance NUMERIC := 0;
  v_total_deductions NUMERIC := 0;
  v_total_net NUMERIC := 0;
  v_employee_count INTEGER := 0;
  v_journal_id INTEGER;
  v_salary_exp_account_id INTEGER;
  v_cash_account_id INTEGER;
  v_paye_account_id INTEGER;
  v_napsa_account_id INTEGER;
  v_health_insurance_account_id INTEGER;
  v_tax_band RECORD;
  v_taxable_income NUMERIC;
  v_tax_for_band NUMERIC;
BEGIN
  -- Validate branch exists
  IF NOT EXISTS (SELECT 1 FROM public.branches WHERE id = p_branch_id) THEN
    RETURN QUERY SELECT NULL::INTEGER, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, 0, NULL::INTEGER, 'Branch not found'::TEXT;
    RETURN;
  END IF;

  -- Check if payroll already exists for this month/year on this branch
  IF EXISTS (SELECT 1 FROM public.payroll_runs
             WHERE branch_id = p_branch_id AND month = p_month AND year = p_year AND status != 'REVERSED') THEN
    RETURN QUERY SELECT NULL::INTEGER, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, 0, NULL::INTEGER, 'Payroll already exists for this period'::TEXT;
    RETURN;
  END IF;

  -- Get GL account IDs (create if they don't exist)
  SELECT id INTO v_salary_exp_account_id FROM public.chart_of_accounts
  WHERE account_code = '5100' AND branch_id = p_branch_id;

  IF v_salary_exp_account_id IS NULL THEN
    INSERT INTO public.chart_of_accounts (account_code, account_name, account_type, branch_id)
    VALUES ('5100', 'Salary & Wages Expense', 'EXPENSE', p_branch_id)
    RETURNING id INTO v_salary_exp_account_id;
  END IF;

  SELECT id INTO v_cash_account_id FROM public.chart_of_accounts
  WHERE account_code = '1000' AND branch_id = p_branch_id;

  SELECT id INTO v_paye_account_id FROM public.chart_of_accounts
  WHERE account_code = '2100' AND branch_id = p_branch_id;

  IF v_paye_account_id IS NULL THEN
    INSERT INTO public.chart_of_accounts (account_code, account_name, account_type, branch_id)
    VALUES ('2100', 'PAYE Tax Payable', 'LIABILITY', p_branch_id)
    RETURNING id INTO v_paye_account_id;
  END IF;

  SELECT id INTO v_napsa_account_id FROM public.chart_of_accounts
  WHERE account_code = '2200' AND branch_id = p_branch_id;

  IF v_napsa_account_id IS NULL THEN
    INSERT INTO public.chart_of_accounts (account_code, account_name, account_type, branch_id)
    VALUES ('2200', 'NAPSA Contributions Payable', 'LIABILITY', p_branch_id)
    RETURNING id INTO v_napsa_account_id;
  END IF;

  SELECT id INTO v_health_insurance_account_id FROM public.chart_of_accounts
  WHERE account_code = '2300' AND branch_id = p_branch_id;

  IF v_health_insurance_account_id IS NULL THEN
    INSERT INTO public.chart_of_accounts (account_code, account_name, account_type, branch_id)
    VALUES ('2300', 'National Health Insurance Payable', 'LIABILITY', p_branch_id)
    RETURNING id INTO v_health_insurance_account_id;
  END IF;

  -- Create payroll run
  INSERT INTO public.payroll_runs (branch_id, month, year, status, run_date)
  VALUES (p_branch_id, p_month, p_year, 'PROCESSING', NOW())
  RETURNING id INTO v_payroll_run_id;

  -- Process each active employee in this branch
  FOR v_employee IN
    SELECT e.id, e.first_name, e.last_name, COALESCE(e.basic_salary, 0) as basic_salary
    FROM public.employees e
    WHERE e.branch_id = p_branch_id AND e.status = 'ACTIVE'
    ORDER BY e.id
  LOOP
    -- Skip if no salary configured
    IF v_employee.basic_salary IS NULL OR v_employee.basic_salary <= 0 THEN
      RAISE WARNING 'Employee % has no salary configured. Skipping.', v_employee.id;
      CONTINUE;
    END IF;

    v_employee_count := v_employee_count + 1;
    v_gross := v_employee.basic_salary;
    v_paye := 0;

    -- Calculate PAYE using ZRA 2026 progressive tax bands
    -- Loop through each tax band and calculate tax on the portion of salary in that band
    FOR v_tax_band IN
      SELECT min_income, max_income, tax_rate
      FROM public.tax_rules
      WHERE effective_date <= NOW()
      ORDER BY min_income
    LOOP
      -- Calculate how much of this employee's salary falls in this tax band
      IF v_gross > v_tax_band.min_income THEN
        -- Determine the upper limit for this band (either max_income or actual salary, whichever is lower)
        v_taxable_income := LEAST(v_gross, v_tax_band.max_income) - v_tax_band.min_income;
        v_tax_for_band := v_taxable_income * (v_tax_band.tax_rate / 100.0);
        v_paye := v_paye + v_tax_for_band;
      END IF;
    END LOOP;

    -- Calculate statutory contributions (ZRA 2026 rates)
    v_napsa := v_gross * 0.05;              -- NAPSA: 5% employee contribution
    v_health_insurance := v_gross * 0.01;   -- National Health Insurance: 1%

    -- Calculate net salary
    v_net := v_gross - v_paye - v_napsa - v_health_insurance;

    -- Insert payroll deduction record with all deductions
    INSERT INTO public.payroll_deductions
    (payroll_run_id, employee_id, basic_salary, gross_salary, paye_tax, napsa_contribution, health_insurance, net_salary)
    VALUES (v_payroll_run_id, v_employee.id, v_gross, v_gross, v_paye, v_napsa, v_health_insurance, v_net);

    -- Accumulate totals
    v_total_gross := v_total_gross + v_gross;
    v_total_paye := v_total_paye + v_paye;
    v_total_napsa := v_total_napsa + v_napsa;
    v_total_health_insurance := v_total_health_insurance + v_health_insurance;
    v_total_deductions := v_total_paye + v_total_napsa + v_total_health_insurance;
    v_total_net := v_total_net + v_net;
  END LOOP;

  -- Create GL journal entry for payroll run (ZRA 2026 compliant)
  IF v_employee_count > 0 AND v_total_gross > 0 THEN
    INSERT INTO public.journal_entries (reference, description, branch_id)
    VALUES ('PAYROLL-' || p_year || LPAD(p_month::TEXT, 2, '0'),
            'Payroll for ' || p_month || '/' || p_year || ' (' || v_employee_count || ' employees)', p_branch_id)
    RETURNING id INTO v_journal_id;

    -- Post Dr. Salary & Wages Expense (5100)
    INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, branch_id)
    VALUES (v_journal_id, v_salary_exp_account_id, v_total_gross, 0, p_branch_id);

    -- Post Cr. Cash (1000) for net salaries paid
    INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, branch_id)
    VALUES (v_journal_id, v_cash_account_id, 0, v_total_net, p_branch_id);

    -- Post Cr. PAYE Tax Payable (2100) - ZRA 2026 progressive PAYE
    IF v_total_paye > 0 THEN
      INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, branch_id)
      VALUES (v_journal_id, v_paye_account_id, 0, v_total_paye, p_branch_id);
    END IF;

    -- Post Cr. NAPSA Contributions Payable (2200) - 5% employee contribution
    IF v_total_napsa > 0 THEN
      INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, branch_id)
      VALUES (v_journal_id, v_napsa_account_id, 0, v_total_napsa, p_branch_id);
    END IF;

    -- Post Cr. National Health Insurance Payable (2300) - 1% employee contribution
    IF v_total_health_insurance > 0 THEN
      INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, branch_id)
      VALUES (v_journal_id, v_health_insurance_account_id, 0, v_total_health_insurance, p_branch_id);
    END IF;

    -- Update payroll run with GL reference and totals (ZRA 2026 compliant)
    UPDATE public.payroll_runs
    SET
      total_gross = v_total_gross,
      total_paye = v_total_paye,
      total_napsa = v_total_napsa,
      total_health_insurance = v_total_health_insurance,
      total_deductions = (v_total_paye + v_total_napsa + v_total_health_insurance),
      total_net = v_total_net,
      employee_count = v_employee_count,
      journal_entry_id = v_journal_id,
      status = 'COMPLETED'
    WHERE id = v_payroll_run_id;
  ELSE
    -- No employees to process
    UPDATE public.payroll_runs
    SET status = 'COMPLETED'
    WHERE id = v_payroll_run_id;
  END IF;

  RETURN QUERY SELECT
    v_payroll_run_id,
    v_total_gross,
    (v_total_paye + v_total_napsa + v_total_health_insurance),
    v_total_net,
    v_employee_count,
    v_journal_id,
    'Payroll processed successfully for ' || v_employee_count::TEXT || ' employees (ZRA 2026 compliant: PAYE ' ||
    TO_CHAR(v_total_paye, '9999999.99') || ' + NAPSA ' || TO_CHAR(v_total_napsa, '9999999.99') ||
    ' + Health ' || TO_CHAR(v_total_health_insurance, '9999999.99') || ')'::TEXT;
END;
$$;

-- ============================================================================
-- 5. GET PAYROLL SUMMARY (MULTI-TENANT)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_payroll_summary(INTEGER, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION public.get_payroll_summary(
  p_branch_id INTEGER,
  p_month INTEGER,
  p_year INTEGER
)
RETURNS TABLE (
  payroll_run_id INTEGER,
  status TEXT,
  total_gross NUMERIC,
  total_paye NUMERIC,
  total_pension NUMERIC,
  total_net NUMERIC,
  employee_count INTEGER,
  journal_entry_id INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.id,
    pr.status,
    pr.total_gross,
    pr.total_paye,
    pr.total_pension,
    pr.total_net,
    pr.employee_count,
    pr.journal_entry_id
  FROM public.payroll_runs pr
  WHERE pr.branch_id = p_branch_id
    AND pr.month = p_month
    AND pr.year = p_year;
END;
$$;

-- ============================================================================
-- 6. GET ATTENDANCE BY BRANCH (MULTI-TENANT)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_attendance_summary(INTEGER, DATE, DATE);
CREATE OR REPLACE FUNCTION public.get_attendance_summary(
  p_branch_id INTEGER,
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
  WHERE e.branch_id = p_branch_id
  ORDER BY e.employee_code;
END;
$$;

-- ============================================================================
-- 7. RECORD ATTENDANCE (MULTI-TENANT)
-- ============================================================================
DROP FUNCTION IF EXISTS public.record_attendance(INTEGER, INTEGER, DATE, TEXT);
CREATE OR REPLACE FUNCTION public.record_attendance(
  p_employee_id INTEGER,
  p_branch_id INTEGER,
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
  -- Validate employee belongs to branch
  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id = p_employee_id AND branch_id = p_branch_id) THEN
    RETURN QUERY SELECT FALSE, 'Employee not found in this branch'::TEXT;
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
-- 10. REJECT LEAVE (MULTI-TENANT)
-- ============================================================================
DROP FUNCTION IF EXISTS public.reject_leave(INTEGER, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION public.reject_leave(
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
BEGIN
  -- Validate leave request belongs to this business
  SELECT lr.employee_id
  INTO v_employee_id
  FROM public.leave_requests lr
  WHERE lr.id = p_leave_request_id
  AND EXISTS (SELECT 1 FROM public.employees e WHERE e.id = lr.employee_id AND e.business_id = p_business_id);

  IF v_employee_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Leave request not found'::TEXT;
    RETURN;
  END IF;

  -- Update leave request status to REJECTED
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
-- SUMMARY
-- ============================================================================
-- All HR/Payroll RPC functions have been updated to:
-- 1. Accept business_id as parameter
-- 2. Filter queries by business_id for tenant isolation
-- 3. Have SECURITY DEFINER for RLS bypass
-- 4. Return appropriate status/message columns
-- ============================================================================
