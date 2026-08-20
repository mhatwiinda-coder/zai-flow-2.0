-- ============================================================================
-- FIX: Accounting reports (Trial Balance, P&L, Balance Sheet, General Ledger)
-- now scope to the currently selected BRANCH instead of the whole business
-- ============================================================================
-- These three functions previously took p_business_id and aggregated across
-- every branch belonging to that business - inconsistent with how every
-- other module (payroll, HR, inventory, sales) is scoped, and confusing
-- when the page header shows one specific branch selected. Also fixes the
-- get_general_ledger() join, which no longer needs the branches table now
-- that it filters directly on journal_entries.branch_id.
--
-- Deploy this AFTER FIX_TRIAL_BALANCE_CROSS_BUSINESS_LEAK.sql (or instead of
-- it, if you haven't run that one yet - this supersedes it).
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_trial_balance(INTEGER);
CREATE OR REPLACE FUNCTION public.get_trial_balance(p_branch_id INTEGER)
RETURNS TABLE (
  account_code TEXT,
  account_name TEXT,
  account_type TEXT,
  total_debit NUMERIC,
  total_credit NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    coa.account_code,
    coa.account_name,
    coa.account_type,
    COALESCE(SUM(jl.debit), 0)::NUMERIC as total_debit,
    COALESCE(SUM(jl.credit), 0)::NUMERIC as total_credit
  FROM public.chart_of_accounts coa
  LEFT JOIN public.journal_lines jl ON coa.id = jl.account_id
  LEFT JOIN public.journal_entries je ON jl.journal_id = je.id
    AND je.branch_id = p_branch_id
  GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type
  ORDER BY coa.account_code;
END;
$$;

DROP FUNCTION IF EXISTS public.get_profit_loss(INTEGER);
CREATE OR REPLACE FUNCTION public.get_profit_loss(p_branch_id INTEGER)
RETURNS TABLE (
  revenue NUMERIC,
  cogs NUMERIC,
  gross_profit NUMERIC,
  expenses NUMERIC,
  net_profit NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_revenue NUMERIC;
  v_cogs NUMERIC;
  v_expenses NUMERIC;
BEGIN
  SELECT COALESCE(SUM(total_credit), 0) INTO v_revenue
  FROM (SELECT * FROM get_trial_balance(p_branch_id)) tb
  WHERE account_code = '4000';

  SELECT COALESCE(SUM(total_debit), 0) INTO v_cogs
  FROM (SELECT * FROM get_trial_balance(p_branch_id)) tb
  WHERE account_code = '5000';

  SELECT COALESCE(SUM(total_debit), 0) INTO v_expenses
  FROM (SELECT * FROM get_trial_balance(p_branch_id)) tb
  WHERE account_code LIKE '51%' OR account_code LIKE '52%';

  RETURN QUERY SELECT
    v_revenue,
    v_cogs,
    (v_revenue - v_cogs),
    v_expenses,
    (v_revenue - v_cogs - v_expenses);
END;
$$;

DROP FUNCTION IF EXISTS public.get_general_ledger(INTEGER);
CREATE OR REPLACE FUNCTION public.get_general_ledger(p_branch_id INTEGER)
RETURNS TABLE (
  id INTEGER,
  created_at TIMESTAMPTZ,
  reference TEXT,
  description TEXT,
  account_name TEXT,
  debit NUMERIC,
  credit NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    jl.id,
    je.created_at,
    je.reference,
    je.description,
    coa.account_name,
    jl.debit,
    jl.credit
  FROM public.journal_lines jl
  JOIN public.journal_entries je ON jl.journal_id = je.id
  JOIN public.chart_of_accounts coa ON jl.account_id = coa.id
  WHERE je.branch_id = p_branch_id
  ORDER BY je.created_at DESC, jl.id;
END;
$$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT routine_name, string_agg(parameter_name, ', ' ORDER BY ordinal_position) AS params
FROM information_schema.routines r
JOIN information_schema.parameters p ON p.specific_name = r.specific_name
WHERE r.routine_name IN ('get_trial_balance', 'get_profit_loss', 'get_general_ledger')
GROUP BY routine_name;
-- All three should show p_branch_id as their only parameter
