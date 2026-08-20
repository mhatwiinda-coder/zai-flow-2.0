-- ============================================================================
-- FIX: Payroll was posting salary expense to 5100 "Utilities Expense"
-- ============================================================================
-- The live chart of accounts is:
--     5100  Utilities Expense
--     5200  Salaries & Wages Expense
--
-- process_payroll() looked up account_code '5100' and only created it (named
-- "Salary & Wages Expense") if missing. Since 5100 already existed as
-- Utilities Expense, every payroll run was booked as utilities - which is why
-- branch 8 shows ~285,000 sitting in Utilities.
--
-- This file does two things:
--   STEP 1  repoints process_payroll() at 5200 for all future runs
--   STEP 2  reclassifies payroll journal lines already sitting in 5100
--
-- Totals and net income are unaffected either way (both are EXPENSE accounts);
-- this is about the expense being labelled correctly.
-- ============================================================================

-- ============================================================================
-- STEP 1: Repoint process_payroll() at 5200
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
  -- chart_of_accounts.account_code is GLOBALLY unique (one shared chart of
  -- accounts across all branches/businesses) - actual per-branch separation
  -- happens via journal_entries.branch_id, not by duplicating account rows.
  -- So these lookups/inserts must NOT filter or set branch_id.
  -- Salary expense posts to 5200 "Salaries & Wages Expense". It previously
  -- used 5100, which in this chart of accounts is "Utilities Expense" -
  -- payroll was being booked as utilities.
  SELECT id INTO v_salary_exp_account_id FROM public.chart_of_accounts
  WHERE account_code = '5200';

  IF v_salary_exp_account_id IS NULL THEN
    INSERT INTO public.chart_of_accounts (account_code, account_name, account_type)
    VALUES ('5200', 'Salaries & Wages Expense', 'EXPENSE')
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

    -- Post Dr. Salaries & Wages Expense (5200)
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
-- STEP 2: Reclassify existing payroll postings from 5100 to 5200
-- ============================================================================
-- 2a. PREVIEW FIRST - review this before running the UPDATE below.
-- Only journal lines belonging to payroll entries (reference 'PAYROLL-%',
-- which also covers 'PAYROLL-REV-%' reversals) are targeted, so any genuine
-- utilities postings in 5100 are left alone.
SELECT
  je.branch_id,
  je.reference,
  je.description,
  je.created_at,
  jl.id AS journal_line_id,
  jl.debit,
  jl.credit
FROM public.journal_lines jl
JOIN public.journal_entries je ON jl.journal_id = je.id
JOIN public.chart_of_accounts coa ON jl.account_id = coa.id
WHERE coa.account_code = '5100'
  AND je.reference LIKE 'PAYROLL-%'
ORDER BY je.branch_id, je.created_at;

-- 2b. Sanity check: anything in 5100 that is NOT payroll stays put.
SELECT COUNT(*) AS non_payroll_lines_left_in_5100
FROM public.journal_lines jl
JOIN public.journal_entries je ON jl.journal_id = je.id
JOIN public.chart_of_accounts coa ON jl.account_id = coa.id
WHERE coa.account_code = '5100'
  AND je.reference NOT LIKE 'PAYROLL-%';

-- 2c. THE UPDATE - deliberately commented out.
-- Running this whole file executes every statement at once, and Supabase's
-- editor only shows the LAST result - so you would never actually see the
-- preview before the data changed. Run the file as-is first, read 2a, then
-- uncomment the statement below and run just that.
--
-- UPDATE public.journal_lines jl
-- SET account_id = (SELECT id FROM public.chart_of_accounts WHERE account_code = '5200')
-- FROM public.journal_entries je, public.chart_of_accounts coa
-- WHERE jl.journal_id = je.id
--   AND jl.account_id = coa.id
--   AND coa.account_code = '5100'
--   AND je.reference LIKE 'PAYROLL-%';
--
-- To undo it later, run the same statement with '5100' and '5200' swapped.

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT coa.account_code, coa.account_name,
       SUM(jl.debit) AS total_debit, SUM(jl.credit) AS total_credit
FROM public.journal_lines jl
JOIN public.journal_entries je ON jl.journal_id = je.id
JOIN public.chart_of_accounts coa ON jl.account_id = coa.id
WHERE je.branch_id = 8 AND coa.account_code IN ('5100', '5200')
GROUP BY coa.account_code, coa.account_name
ORDER BY coa.account_code;
-- Expect the payroll amounts to have moved from 5100 into 5200.
-- Total expenses (and therefore net income) should be unchanged.
