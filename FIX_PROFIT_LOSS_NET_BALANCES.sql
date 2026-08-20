-- ============================================================================
-- FIX: get_profit_loss() overstated expenses and could miss revenue
-- ============================================================================
-- Verified against branch 8's actual trial balance:
--
--   4000 Sales Revenue      debit        0.00   credit  825,242.00
--   5100 Utilities Expense  debit  285,000.00   credit   10,000.00
--   5200 Salaries & Wages   debit   50,000.00   credit   50,000.00
--
-- The function summed only ONE side of each account:
--   revenue  = SUM(total_credit)  -> ignored any debits (refunds/reversals)
--   expenses = SUM(total_debit)   -> 285,000 + 50,000 = 335,000
--
-- But 5200's 50,000 debit was fully reversed by a 50,000 credit (net 0), and
-- 5100 had a 10,000 credit. Real expenses are 275,000, not 335,000 - so net
-- income was reported as 490,242 instead of the correct 550,242.
--
-- Proof this is right: with expenses at 275,000, net income is 550,242, and
--   Liabilities (90,703.96) + Current Period Earnings (550,242.00)
--     = 640,945.96
--   = Total Assets (640,945.96)
-- The balance sheet balances to the cent. It could not before.
--
-- Also switched classification from hardcoded account codes to account_type.
-- The old "account_code LIKE '51%' OR '52%'" missed any other expense range,
-- and revenue matched only '4000' - so AR invoices posting to 4100 would
-- never have counted as revenue.
-- ============================================================================

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
  -- Revenue is credit-normal: credit - debit
  SELECT COALESCE(SUM(total_credit - total_debit), 0) INTO v_revenue
  FROM (SELECT * FROM get_trial_balance(p_branch_id)) tb
  WHERE UPPER(account_type) = 'REVENUE';

  -- COGS is broken out separately on the P&L
  SELECT COALESCE(SUM(total_debit - total_credit), 0) INTO v_cogs
  FROM (SELECT * FROM get_trial_balance(p_branch_id)) tb
  WHERE account_code = '5000';

  -- All other operating expenses (debit-normal: debit - credit)
  SELECT COALESCE(SUM(total_debit - total_credit), 0) INTO v_expenses
  FROM (SELECT * FROM get_trial_balance(p_branch_id)) tb
  WHERE UPPER(account_type) = 'EXPENSE' AND account_code <> '5000';

  RETURN QUERY SELECT
    v_revenue,
    v_cogs,
    (v_revenue - v_cogs),
    v_expenses,
    (v_revenue - v_cogs - v_expenses);
END;
$$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT * FROM public.get_profit_loss(8);
-- Expect for branch 8: revenue 825242.00, cogs 0.00, expenses 275000.00,
-- net_profit 550242.00
