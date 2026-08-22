-- ============================================================================
-- ROOT CAUSE: get_trial_balance() ignores its branch parameter entirely
-- ============================================================================
-- The branch filter was placed on the journal_entries LEFT JOIN, but the
-- totals aggregate journal_lines:
--
--     FROM chart_of_accounts coa
--     LEFT JOIN journal_lines   jl ON coa.id = jl.account_id        <-- unfiltered
--     LEFT JOIN journal_entries je ON jl.journal_id = je.id
--       AND je.branch_id = p_branch_id                              <-- filter here
--     ...
--     SUM(jl.debit), SUM(jl.credit)                                 <-- sums jl
--
-- In a LEFT JOIN, a row that fails the ON condition is NOT removed - the left
-- side is kept and the right side's columns come back NULL. So journal lines
-- belonging to other branches survive the join (only `je` goes NULL) and are
-- still counted by SUM(jl.debit)/SUM(jl.credit).
--
-- Net effect: p_branch_id has NO influence on the numbers. Every business sees
-- the sum of every business's ledger. Because DEFAULT_BUSINESS holds nearly
-- all the data, that total looks like "DEFAULT_BUSINESS's figures" showing up
-- under Royalty Makeup and Hair.
--
-- get_profit_loss() calls get_trial_balance() internally, so it inherits the
-- same fault - which is why Net Income, Total Assets and Total Revenue are all
-- wrong together. get_general_ledger() uses INNER JOINs with a real WHERE
-- clause and is unaffected, which is the tell: on the same page, for the same
-- branch, the General Ledger tab and the Trial Balance tab disagree.
--
-- This was introduced by my own earlier change. Moving the filter from WHERE
-- into the JOIN's ON clause was meant to stop zero-balance accounts being
-- dropped from the report; it did that, but it also stopped the filter doing
-- any filtering.
-- ============================================================================


-- ============================================================================
-- STEP 1: PROOF - run this BEFORE applying the fix
-- ============================================================================
-- If the branch parameter worked, these two calls would return different
-- numbers. They will return IDENTICAL rows, because the parameter is inert.
SELECT 'branch 1' AS scope, account_code, total_debit, total_credit
FROM public.get_trial_balance(1)
WHERE total_debit <> 0 OR total_credit <> 0
UNION ALL
SELECT 'branch 8', account_code, total_debit, total_credit
FROM public.get_trial_balance(8)
WHERE total_debit <> 0 OR total_credit <> 0
ORDER BY account_code, scope;
-- EXPECTED (bug present): every account_code appears TWICE with identical
-- debit/credit values for both branches.


-- ============================================================================
-- STEP 2: PROOF - what branch 8 actually owns
-- ============================================================================
-- The honest figure, filtered properly. Compare against what the UI shows.
SELECT
  coa.account_code, coa.account_name,
  SUM(jl.debit) AS total_debit, SUM(jl.credit) AS total_credit
FROM public.journal_lines jl
JOIN public.journal_entries je ON je.id = jl.journal_id
JOIN public.chart_of_accounts coa ON coa.id = jl.account_id
WHERE je.branch_id = 8
GROUP BY coa.account_code, coa.account_name
ORDER BY coa.account_code;
-- If this returns little or nothing while the dashboard shows 825,242 in
-- revenue, the numbers on screen were never branch 8's.


-- ============================================================================
-- STEP 3: THE FIX
-- ============================================================================
-- Filter journal_lines BEFORE joining them to the chart of accounts. The
-- LEFT JOIN is preserved so accounts with no activity still appear on the
-- report with zeros, which is what the ON-clause version was reaching for.
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
    COALESCE(SUM(bl.debit), 0)::NUMERIC  AS total_debit,
    COALESCE(SUM(bl.credit), 0)::NUMERIC AS total_credit
  FROM public.chart_of_accounts coa
  LEFT JOIN (
    -- Only this branch's lines. INNER JOIN here so lines whose entry belongs
    -- to another branch are genuinely removed rather than merely NULL-ed.
    SELECT jl.account_id, jl.debit, jl.credit
    FROM public.journal_lines jl
    JOIN public.journal_entries je ON je.id = jl.journal_id
    WHERE je.branch_id = p_branch_id
  ) bl ON bl.account_id = coa.id
  GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type
  ORDER BY coa.account_code;
END;
$$;


-- ============================================================================
-- STEP 4: VERIFY THE FIX
-- ============================================================================
-- Re-run the Step 1 comparison. The two branches must now differ.
SELECT 'branch 1' AS scope, account_code, total_debit, total_credit
FROM public.get_trial_balance(1)
WHERE total_debit <> 0 OR total_credit <> 0
UNION ALL
SELECT 'branch 8', account_code, total_debit, total_credit
FROM public.get_trial_balance(8)
WHERE total_debit <> 0 OR total_credit <> 0
ORDER BY account_code, scope;

-- And the P&L, which reads through the same function:
SELECT 'branch 1' AS scope, * FROM public.get_profit_loss(1)
UNION ALL
SELECT 'branch 8', * FROM public.get_profit_loss(8);
-- Branch 8 should now report only its own activity.

-- Cross-check: the trial balance total must equal the general ledger total
-- for the same branch. These two came from different code paths, so agreeing
-- is meaningful.
SELECT
  (SELECT COALESCE(SUM(total_debit),0) FROM public.get_trial_balance(8)) AS trial_balance_debits,
  (SELECT COALESCE(SUM(debit),0)       FROM public.get_general_ledger(8)) AS general_ledger_debits;
-- These two numbers must match.
