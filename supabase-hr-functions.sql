-- ============================================================================
-- ZAI FLOW 2.0 - HR & Payroll RPC Functions
-- Run ALL of these in Supabase SQL Editor to create payroll business logic
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTION 1: Calculate PAYE Tax
-- ============================================================================
DROP FUNCTION IF EXISTS calculate_paye_tax(NUMERIC);
CREATE OR REPLACE FUNCTION calculate_paye_tax(p_gross_salary NUMERIC)
RETURNS NUMERIC AS $$
DECLARE
  v_tax NUMERIC := 0;
  v_bracket RECORD;
  v_bracket_income NUMERIC;
  v_bracket_tax NUMERIC;
BEGIN
  -- Loop through tax brackets and calculate tax for each bracket
  FOR v_bracket IN
    SELECT min_income, max_income, tax_rate
    FROM public.tax_rules
    ORDER BY min_income ASC
  LOOP
    -- Skip if salary is below this bracket's minimum
    IF p_gross_salary <= v_bracket.min_income THEN
      CONTINUE;
    END IF;

    -- Calculate income within this bracket
    IF p_gross_salary <= v_bracket.max_income THEN
      v_bracket_income := p_gross_salary - v_bracket.min_income;
    ELSE
      v_bracket_income := v_bracket.max_income - v_bracket.min_income;
    END IF;

    -- Calculate tax for this bracket
    v_bracket_tax := (v_bracket_income * v_bracket.tax_rate) / 100;
    v_tax := v_tax + v_bracket_tax;
  END LOOP;

  RETURN ROUND(v_tax, 2);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- HELPER FUNCTION 2: Calculate Deductions for Employee
-- ============================================================================
DROP FUNCTION IF EXISTS calculate_deductions(INTEGER, NUMERIC);
CREATE OR REPLACE FUNCTION calculate_deductions(p_employee_id INTEGER, p_basic_salary NUMERIC)
RETURNS TABLE (
  gross_salary NUMERIC,
  paye_tax NUMERIC,
  pension_contribution NUMERIC,
  other_deductions NUMERIC,
  net_salary NUMERIC
) AS $$
DECLARE
  v_gross_salary NUMERIC;
  v_paye_tax NUMERIC;
  v_pension_contribution NUMERIC;
  v_other_deductions NUMERIC := 0;
  v_net_salary NUMERIC;
  v_salary_structure RECORD;
  v_allowance_total NUMERIC := 0;
  v_pension_rate NUMERIC;
BEGIN
  -- Get salary structure for employee
  SELECT * INTO v_salary_structure
  FROM public.salary_structures
  WHERE employee_id = p_employee_id
  AND effective_date <= CURRENT_DATE
  ORDER BY effective_date DESC
  LIMIT 1;

  IF v_salary_structure IS NULL THEN
    RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;

  -- Calculate total allowances from JSONB
  IF v_salary_structure.allowances IS NOT NULL AND v_salary_structure.allowances != '{}'::JSONB THEN
    SELECT COALESCE(SUM((value::text)::NUMERIC), 0) INTO v_allowance_total
    FROM jsonb_each(v_salary_structure.allowances);
  END IF;

  -- Calculate gross salary (basic + allowances)
  v_gross_salary := ROUND(p_basic_salary + v_allowance_total, 2);

  -- Calculate PAYE tax using configurable tax brackets
  v_paye_tax := calculate_paye_tax(v_gross_salary);

  -- Calculate pension contribution (configurable rate)
  v_pension_rate := COALESCE(v_salary_structure.pension_rate, 10.00);
  v_pension_contribution := ROUND((v_gross_salary * v_pension_rate) / 100, 2);

  -- Calculate other deductions from JSONB
  IF v_salary_structure.deductions IS NOT NULL AND v_salary_structure.deductions != '{}'::JSONB THEN
    SELECT COALESCE(SUM((value::text)::NUMERIC), 0) INTO v_other_deductions
    FROM jsonb_each(v_salary_structure.deductions);
  END IF;
  v_other_deductions := ROUND(v_other_deductions, 2);

  -- Calculate net salary
  v_net_salary := ROUND(v_gross_salary - v_paye_tax - v_pension_contribution - v_other_deductions, 2);

  RETURN QUERY SELECT v_gross_salary, v_paye_tax, v_pension_contribution, v_other_deductions, v_net_salary;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MAIN FUNCTION 1: Process Monthly Payroll
-- ============================================================================
DROP FUNCTION IF EXISTS process_payroll(INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION process_payroll(p_month INTEGER, p_year INTEGER)
RETURNS TABLE (
  payroll_run_id INTEGER,
  total_gross NUMERIC,
  total_net NUMERIC,
  total_deductions NUMERIC,
  employee_count INTEGER,
  status TEXT
) AS $$
DECLARE
  v_payroll_run_id INTEGER;
  v_employee RECORD;
  v_deductions RECORD;
  v_total_gross NUMERIC := 0;
  v_total_net NUMERIC := 0;
  v_total_paye NUMERIC := 0;
  v_total_pension NUMERIC := 0;
  v_total_deductions NUMERIC := 0;
  v_employee_count INTEGER := 0;
  v_salary_structure RECORD;
  v_basic_salary NUMERIC;
BEGIN
  -- Check if payroll already exists for this month/year
  SELECT id INTO v_payroll_run_id
  FROM public.payroll_runs
  WHERE month = p_month AND year = p_year AND status != 'REVERSED'
  LIMIT 1;

  IF v_payroll_run_id IS NOT NULL THEN
    RAISE EXCEPTION 'Payroll already exists for this month/year: %-%', p_month, p_year;
  END IF;

  -- Create payroll run record
  INSERT INTO public.payroll_runs (month, year, run_date, status)
  VALUES (p_month, p_year, CURRENT_DATE, 'PROCESSING')
  RETURNING id INTO v_payroll_run_id;

  -- Process each ACTIVE employee
  FOR v_employee IN
    SELECT e.id, e.employee_code, e.first_name, e.last_name
    FROM public.employees e
    WHERE e.status = 'ACTIVE'
    ORDER BY e.employee_code
  LOOP
    -- Get latest salary structure
    SELECT * INTO v_salary_structure
    FROM public.salary_structures
    WHERE employee_id = v_employee.id
    AND effective_date <= CURRENT_DATE
    ORDER BY effective_date DESC
    LIMIT 1;

    IF v_salary_structure IS NULL THEN
      CONTINUE; -- Skip employees without salary structure
    END IF;

    v_basic_salary := v_salary_structure.basic_salary;

    -- Calculate deductions for this employee
    SELECT * INTO v_deductions
    FROM calculate_deductions(v_employee.id, v_basic_salary);

    -- Insert payroll deduction record
    INSERT INTO public.payroll_deductions
      (payroll_run_id, employee_id, gross_salary, paye_tax, pension_contribution, other_deductions, net_salary)
    VALUES
      (v_payroll_run_id, v_employee.id, v_deductions.gross_salary, v_deductions.paye_tax,
       v_deductions.pension_contribution, v_deductions.other_deductions, v_deductions.net_salary);

    -- Accumulate totals
    v_total_gross := v_total_gross + v_deductions.gross_salary;
    v_total_net := v_total_net + v_deductions.net_salary;
    v_total_paye := v_total_paye + v_deductions.paye_tax;
    v_total_pension := v_total_pension + v_deductions.pension_contribution;
    v_total_deductions := v_total_deductions + (v_deductions.paye_tax + v_deductions.pension_contribution + v_deductions.other_deductions);
    v_employee_count := v_employee_count + 1;
  END LOOP;

  -- Update payroll run with totals
  UPDATE public.payroll_runs
  SET
    total_gross = v_total_gross,
    total_net = v_total_net,
    total_deductions = v_total_deductions,
    status = 'COMPLETED'
  WHERE id = v_payroll_run_id;

  -- Create journal entries for accounting
  PERFORM process_payroll_entries(v_payroll_run_id);

  RETURN QUERY SELECT v_payroll_run_id, v_total_gross, v_total_net, v_total_deductions, v_employee_count, 'SUCCESS'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MAIN FUNCTION 2: Post Payroll to GL (Journal Entries)
-- ============================================================================
DROP FUNCTION IF EXISTS process_payroll_entries(INTEGER);
CREATE OR REPLACE FUNCTION process_payroll_entries(p_payroll_run_id INTEGER)
RETURNS TABLE (
  journal_id INTEGER,
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_journal_id INTEGER;
  v_payroll_run RECORD;
  v_total_paye NUMERIC;
  v_total_pension NUMERIC;
  v_account_id_cash INTEGER;
  v_account_id_expense INTEGER;
  v_account_id_paye INTEGER;
  v_account_id_pension INTEGER;
BEGIN
  -- Get payroll run details
  SELECT * INTO v_payroll_run
  FROM public.payroll_runs
  WHERE id = p_payroll_run_id;

  IF v_payroll_run IS NULL THEN
    RAISE EXCEPTION 'Payroll run not found: %', p_payroll_run_id;
  END IF;

  -- Calculate total PAYE and pension
  SELECT
    COALESCE(SUM(paye_tax), 0),
    COALESCE(SUM(pension_contribution), 0)
  INTO v_total_paye, v_total_pension
  FROM public.payroll_deductions
  WHERE payroll_run_id = p_payroll_run_id;

  -- Get account IDs
  SELECT id INTO v_account_id_cash FROM public.chart_of_accounts WHERE account_code = '1000';
  SELECT id INTO v_account_id_expense FROM public.chart_of_accounts WHERE account_code = '5200';
  SELECT id INTO v_account_id_paye FROM public.chart_of_accounts WHERE account_code = '2100';
  SELECT id INTO v_account_id_pension FROM public.chart_of_accounts WHERE account_code = '2200';

  IF v_account_id_cash IS NULL OR v_account_id_expense IS NULL OR
     v_account_id_paye IS NULL OR v_account_id_pension IS NULL THEN
    RAISE EXCEPTION 'Chart of accounts incomplete. Missing required account codes.';
  END IF;

  -- Create journal entry
  INSERT INTO public.journal_entries (reference, description)
  VALUES (
    'PAYROLL-' || v_payroll_run.year || LPAD(v_payroll_run.month::text, 2, '0'),
    'Payroll for ' ||
    TO_CHAR(TO_DATE(v_payroll_run.month::text || '-' || v_payroll_run.year::text, 'MM-YYYY'), 'Month YYYY')
  )
  RETURNING id INTO v_journal_id;

  -- Dr. Salaries & Wages Expense (5200)
  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit)
  VALUES (v_journal_id, v_account_id_expense, v_payroll_run.total_gross, 0);

  -- Cr. Cash (1000)
  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit)
  VALUES (v_journal_id, v_account_id_cash, 0, v_payroll_run.total_net);

  -- Cr. PAYE Tax Payable (2100)
  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit)
  VALUES (v_journal_id, v_account_id_paye, 0, v_total_paye);

  -- Cr. Pension Contributions Payable (2200)
  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit)
  VALUES (v_journal_id, v_account_id_pension, 0, v_total_pension);

  RETURN QUERY SELECT v_journal_id, TRUE, 'Journal entries posted successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MAIN FUNCTION 3: Reverse Payroll Run
-- ============================================================================
DROP FUNCTION IF EXISTS reverse_payroll(INTEGER);
CREATE OR REPLACE FUNCTION reverse_payroll(p_payroll_run_id INTEGER)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_payroll_run RECORD;
  v_journal_entry RECORD;
  v_journal_line RECORD;
  v_new_journal_id INTEGER;
BEGIN
  -- Get payroll run
  SELECT * INTO v_payroll_run
  FROM public.payroll_runs
  WHERE id = p_payroll_run_id;

  IF v_payroll_run IS NULL THEN
    RAISE EXCEPTION 'Payroll run not found: %', p_payroll_run_id;
  END IF;

  IF v_payroll_run.status = 'REVERSED' THEN
    RAISE EXCEPTION 'Payroll run already reversed';
  END IF;

  -- Find associated journal entry
  SELECT * INTO v_journal_entry
  FROM public.journal_entries
  WHERE reference = 'PAYROLL-' || v_payroll_run.year || LPAD(v_payroll_run.month::text, 2, '0')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_journal_entry IS NOT NULL THEN
    -- Create reversal journal entry
    INSERT INTO public.journal_entries (reference, description)
    VALUES (
      'PAYROLL-REV-' || v_payroll_run.year || LPAD(v_payroll_run.month::text, 2, '0'),
      'Reversal of ' || v_journal_entry.description
    )
    RETURNING id INTO v_new_journal_id;

    -- Copy and reverse all journal lines
    FOR v_journal_line IN
      SELECT * FROM public.journal_lines
      WHERE journal_id = v_journal_entry.id
    LOOP
      INSERT INTO public.journal_lines (journal_id, account_id, debit, credit)
      VALUES (v_new_journal_id, v_journal_line.account_id, v_journal_line.credit, v_journal_line.debit);
    END LOOP;
  END IF;

  -- Update payroll run status
  UPDATE public.payroll_runs
  SET status = 'REVERSED'
  WHERE id = p_payroll_run_id;

  RETURN QUERY SELECT TRUE, 'Payroll run reversed successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- UTILITY FUNCTION 1: Get Payroll Summary
-- ============================================================================
DROP FUNCTION IF EXISTS get_payroll_summary(INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION get_payroll_summary(p_month INTEGER, p_year INTEGER)
RETURNS TABLE (
  payroll_run_id INTEGER,
  total_gross NUMERIC,
  total_net NUMERIC,
  total_paye NUMERIC,
  total_pension NUMERIC,
  employee_count INTEGER,
  status TEXT
) AS $$
DECLARE
  v_payroll_run RECORD;
  v_total_paye NUMERIC;
  v_total_pension NUMERIC;
  v_employee_count INTEGER;
BEGIN
  -- Get payroll run
  SELECT * INTO v_payroll_run
  FROM public.payroll_runs
  WHERE month = p_month AND year = p_year
  LIMIT 1;

  IF v_payroll_run IS NULL THEN
    RETURN QUERY SELECT 0::INTEGER, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::INTEGER, 'NOT_FOUND'::TEXT;
    RETURN;
  END IF;

  -- Calculate totals from payroll deductions
  SELECT
    COALESCE(SUM(paye_tax), 0),
    COALESCE(SUM(pension_contribution), 0),
    COUNT(DISTINCT employee_id)
  INTO v_total_paye, v_total_pension, v_employee_count
  FROM public.payroll_deductions
  WHERE payroll_run_id = v_payroll_run.id;

  RETURN QUERY SELECT
    v_payroll_run.id,
    v_payroll_run.total_gross,
    v_payroll_run.total_net,
    v_total_paye,
    v_total_pension,
    v_employee_count,
    v_payroll_run.status;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- UTILITY FUNCTION 2: Approve Leave Request
-- ============================================================================
DROP FUNCTION IF EXISTS approve_leave(INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION approve_leave(p_leave_request_id INTEGER, p_approved_by INTEGER)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_leave_request RECORD;
  v_current_date DATE;
BEGIN
  -- Get leave request
  SELECT * INTO v_leave_request
  FROM public.leave_requests
  WHERE id = p_leave_request_id;

  IF v_leave_request IS NULL THEN
    RAISE EXCEPTION 'Leave request not found: %', p_leave_request_id;
  END IF;

  -- Update leave request status
  UPDATE public.leave_requests
  SET
    status = 'APPROVED',
    approved_by = p_approved_by,
    approved_at = NOW()
  WHERE id = p_leave_request_id;

  -- Mark attendance as LEAVE for each day in the leave period
  FOR v_current_date IN
    SELECT (v_leave_request.start_date + INTERVAL '1 day' * (i))::DATE
    FROM generate_series(0, (v_leave_request.end_date - v_leave_request.start_date)::INTEGER) AS i
  LOOP
    INSERT INTO public.attendance (employee_id, attendance_date, status)
    VALUES (v_leave_request.employee_id, v_current_date, 'LEAVE')
    ON CONFLICT (employee_id, attendance_date)
    DO UPDATE SET status = 'LEAVE';
  END LOOP;

  RETURN QUERY SELECT TRUE, 'Leave request approved and attendance marked'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- UTILITY FUNCTION 3: Reject Leave Request
-- ============================================================================
DROP FUNCTION IF EXISTS reject_leave(INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION reject_leave(p_leave_request_id INTEGER, p_approved_by INTEGER)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) AS $$
BEGIN
  UPDATE public.leave_requests
  SET
    status = 'REJECTED',
    approved_by = p_approved_by,
    approved_at = NOW()
  WHERE id = p_leave_request_id;

  RETURN QUERY SELECT TRUE, 'Leave request rejected'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- UTILITY FUNCTION 4: Get Employee Payslip
-- ============================================================================
DROP FUNCTION IF EXISTS get_employee_payslip(INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION get_employee_payslip(p_employee_id INTEGER, p_payroll_run_id INTEGER)
RETURNS TABLE (
  employee_code TEXT,
  employee_name TEXT,
  position TEXT,
  department_name TEXT,
  month_year TEXT,
  gross_salary NUMERIC,
  paye_tax NUMERIC,
  pension_contribution NUMERIC,
  other_deductions NUMERIC,
  net_salary NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.employee_code,
    (e.first_name || ' ' || e.last_name)::TEXT,
    e."position",
    d.name,
    TO_CHAR(TO_DATE(pr.month::text || '-' || pr.year::text, 'MM-YYYY'), 'Month YYYY'),
    pd.gross_salary,
    pd.paye_tax,
    pd.pension_contribution,
    pd.other_deductions,
    pd.net_salary
  FROM public.payroll_deductions pd
  JOIN public.payroll_runs pr ON pd.payroll_run_id = pr.id
  JOIN public.employees e ON pd.employee_id = e.id
  LEFT JOIN public.departments d ON e.department_id = d.id
  WHERE pd.employee_id = p_employee_id AND pd.payroll_run_id = p_payroll_run_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TEST QUERIES
-- ============================================================================

-- Test process_payroll for April 2026
-- SELECT * FROM process_payroll(4, 2026);

-- Test get_payroll_summary
-- SELECT * FROM get_payroll_summary(4, 2026);

-- Test get_employee_payslip
-- SELECT * FROM get_employee_payslip(1, 1);

-- Test calculate_deductions for employee ID 1 with basic salary 10000
-- SELECT * FROM calculate_deductions(1, 10000);

-- Test PAYE calculation for gross salary of 10000
-- SELECT calculate_paye_tax(10000);

-- ============================================================================
-- PAYROLL FUNCTIONS CREATED SUCCESSFULLY
-- ============================================================================
