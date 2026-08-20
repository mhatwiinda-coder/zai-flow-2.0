-- ============================================================================
-- FIX: get_trial_balance() leaked orphaned journal entries into every
-- business's financial reports
-- ============================================================================
-- The function included "OR je.branch_id IS NULL" - meaning ANY journal
-- entry ever posted without a branch_id (from before branch_id was added
-- to journal_entries, or from any GL-posting code with a similar bug to the
-- ones fixed earlier today) got pulled into EVERY business's Balance Sheet,
-- P&L, and Trial Balance simultaneously. This is almost certainly the
-- source of the unexplained Cash/Net Income figures on Kabwata Branch's
-- Balance Sheet - they likely include stray transactions from testing done
-- under a different business entirely.
--
-- get_profit_loss() calls get_trial_balance() internally, so this fixes
-- both reports. get_general_ledger() already used a correct INNER JOIN and
-- was not affected.
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_trial_balance(INTEGER);
CREATE OR REPLACE FUNCTION public.get_trial_balance(p_business_id INTEGER)
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
    AND je.branch_id IN (SELECT id FROM public.branches WHERE business_id = p_business_id)
  GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type
  ORDER BY coa.account_code;
END;
$$;

-- ============================================================================
-- DIAGNOSTIC: find orphaned journal entries (branch_id IS NULL)
-- ============================================================================
-- Run this to see what was actually leaking into every business's reports.
-- These entries are now invisible to ALL businesses until reassigned to the
-- correct branch (they still exist in the database, untouched).
SELECT
  je.id, je.reference, je.description, je.created_at, je.branch_id,
  (SELECT SUM(debit) FROM journal_lines WHERE journal_id = je.id) AS total_debit,
  (SELECT SUM(credit) FROM journal_lines WHERE journal_id = je.id) AS total_credit
FROM public.journal_entries je
WHERE je.branch_id IS NULL
ORDER BY je.created_at DESC;

-- If the above shows real transactions that belong to a specific branch,
-- reassign them once you know which branch_id they belong to, e.g.:
--   UPDATE public.journal_entries SET branch_id = <correct_branch_id>
--   WHERE id IN (<ids from the diagnostic above>);
-- If they're stray test data with no real owner, they can be left as-is -
-- they simply won't appear in any business's reports anymore.

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Re-check Kabwata Branch's trial balance after this fix - Cash and Net
-- Income should now reflect only Kabwata's own transactions.
