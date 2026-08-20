-- ============================================================================
-- FIX: process_payroll() fails for any branch after the first one that runs
-- payroll, with "duplicate key value violates unique constraint
-- chart_of_accounts_account_code_key".
-- ============================================================================
-- Root cause: chart_of_accounts.account_code is GLOBALLY unique (one shared
-- chart of accounts across every branch/business - actual separation of
-- transactions happens via journal_entries.branch_id, not by duplicating
-- account rows per branch). But this function's GL-account lookups filtered
-- by "account_code = X AND branch_id = p_branch_id", so for a second branch
-- it always found nothing (correctly - no row exists for THAT branch_id)
-- and tried to INSERT a duplicate account_code that already existed for the
-- first branch that ever ran payroll.
--
-- Fix: look up and create these accounts by account_code alone, matching
-- the same global-chart-of-accounts pattern already used elsewhere
-- (supabase-schema-accounting-extensions.sql for the AR accounts).
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

  -- Get GL account IDs (create if they don't exist).
  -- chart_of_accounts.account_code is GLOBALLY unique - do not filter or
  -- set branch_id here.
  SELECT id INTO v_salary_exp_account_id FROM public.chart_of_accounts
  WHERE account_code = '5100';

  IF v_salary_exp_account_id IS NULL THEN
    INSERT INTO public.chart_of_accounts (account_code, account_name, account_type)
    VALUES ('5100', 'Salary & Wages Expense', 'EXPENSE')
    RETURNING id INTO v_salary_exp_account_id;
  END IF;

  SELECT id INTO v_cash_account_id FROM public.chart_of_accounts
  WHERE account_code = '1000';

  SELECT id INTO v_paye_account_id FROM public.chart_of_accounts
  WHERE account_code = '2100';

  IF v_paye_account_id IS NULL THEN
    INSERT INTO public.chart_of_accounts (account_code, account_name, account_type)
    VALUES ('2100', 'PAYE Tax Payable', 'LIABILITY')
    RETURNING id INTO v_paye_account_id;
  END IF;

  SELECT id INTO v_napsa_account_id FROM public.chart_of_accounts
  WHERE account_code = '2200';

  IF v_napsa_account_id IS NULL THEN
    INSERT INTO public.chart_of_accounts (account_code, account_name, account_type)
    VALUES ('2200', 'NAPSA Contributions Payable', 'LIABILITY')
    RETURNING id INTO v_napsa_account_id;
  END IF;

  SELECT id INTO v_health_insurance_account_id FROM public.chart_of_accounts
  WHERE account_code = '2300';

  IF v_health_insurance_account_id IS NULL THEN
    INSERT INTO public.chart_of_accounts (account_code, account_name, account_type)
    VALUES ('2300', 'National Health Insurance Payable', 'LIABILITY')
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
    FOR v_tax_band IN
      SELECT min_income, max_income, tax_rate
      FROM public.tax_rules
      WHERE effective_date <= NOW()
      ORDER BY min_income
    LOOP
      IF v_gross > v_tax_band.min_income THEN
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
-- VERIFICATION
-- ============================================================================
-- Confirm the 5 payroll GL accounts exist exactly once each (globally)
SELECT account_code, account_name, COUNT(*) AS row_count
FROM public.chart_of_accounts
WHERE account_code IN ('5100', '1000', '2100', '2200', '2300')
GROUP BY account_code, account_name
ORDER BY account_code;
-- Every account_code should show row_count = 1
