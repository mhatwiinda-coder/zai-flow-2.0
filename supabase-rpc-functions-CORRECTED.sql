-- ============================================================================
-- ZAI FLOW 2.0 - Supabase RPC Functions (CORRECTED)
-- Run ALL of these in Supabase SQL Editor to create the business logic layer
-- ============================================================================

-- ============================================================================
-- SALES MODULE RPC FUNCTIONS
-- ============================================================================

-- 1. CREATE SALE - Process POS transaction with inventory + accounting
DROP FUNCTION IF EXISTS create_sale(NUMERIC, TEXT, JSONB);
CREATE OR REPLACE FUNCTION create_sale(
  p_total NUMERIC,
  p_payment_method TEXT,
  p_items JSONB
)
RETURNS TABLE (
  sale_id INTEGER,
  total NUMERIC,
  status TEXT
) AS $$
DECLARE
  v_sale_id INTEGER;
  v_item JSONB;
  v_product_id INTEGER;
  v_quantity INTEGER;
  v_price NUMERIC;
  v_current_stock INTEGER;
  v_cogs NUMERIC;
BEGIN
  -- Create sale record
  INSERT INTO public.sales (total, payment_method, status)
  VALUES (p_total, p_payment_method, 'COMPLETED')
  RETURNING id INTO v_sale_id;

  -- Process each item
  FOR v_item IN SELECT jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::INTEGER;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_price := (v_item->>'price')::NUMERIC;

    -- Get current stock
    SELECT stock INTO v_current_stock FROM public.products WHERE id = v_product_id;

    -- Check stock availability
    IF v_current_stock < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_product_id;
    END IF;

    -- Create sale item record
    INSERT INTO public.sale_items (sale_id, product_id, quantity, price)
    VALUES (v_sale_id, v_product_id, v_quantity, v_price);

    -- Update product stock
    UPDATE public.products
    SET stock = stock - v_quantity
    WHERE id = v_product_id;

    -- Record inventory movement
    INSERT INTO public.inventory_movements (product_id, type, quantity, reason)
    VALUES (v_product_id, 'OUT', v_quantity, 'Sale #' || v_sale_id);

    -- Get COGS from cost_price
    SELECT cost_price INTO v_cogs FROM public.products WHERE id = v_product_id;
  END LOOP;

  -- Create double-entry journal entries
  -- Dr. Cash, Cr. Sales
  INSERT INTO public.journal_entries (reference, description)
  VALUES ('SALE-' || v_sale_id, 'Sale transaction #' || v_sale_id)
  RETURNING id INTO v_sale_id;

  -- Dr. Cash (1000)
  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit)
  SELECT v_sale_id, id, p_total, 0 FROM public.chart_of_accounts WHERE account_code = '1000';

  -- Cr. Sales Revenue (4000)
  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit)
  SELECT v_sale_id, id, 0, p_total FROM public.chart_of_accounts WHERE account_code = '4000';

  RETURN QUERY SELECT v_sale_id, p_total, 'SUCCESS'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 2. REVERSE SALE - Void a completed sale
DROP FUNCTION IF EXISTS reverse_sale(INTEGER);
CREATE OR REPLACE FUNCTION reverse_sale(p_sale_id INTEGER)
RETURNS TABLE (
  reversed BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_sale RECORD;
  v_item RECORD;
BEGIN
  -- Get sale details
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id;

  IF v_sale IS NULL THEN
    RAISE EXCEPTION 'Sale not found: %', p_sale_id;
  END IF;

  -- Restore inventory for each item
  FOR v_item IN SELECT * FROM public.sale_items WHERE sale_id = p_sale_id
  LOOP
    UPDATE public.products
    SET stock = stock + v_item.quantity
    WHERE id = v_item.product_id;

    INSERT INTO public.inventory_movements (product_id, type, quantity, reason)
    VALUES (v_item.product_id, 'IN', v_item.quantity, 'Reversal of sale #' || p_sale_id);
  END LOOP;

  -- Mark sale as reversed
  UPDATE public.sales SET status = 'REVERSED' WHERE id = p_sale_id;

  RETURN QUERY SELECT TRUE, 'Sale reversed successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 3. GET DRAWER STATUS (CORRECTED: Calculate expected_balance from opening + sales)
DROP FUNCTION IF EXISTS get_drawer_status(TEXT);
DROP FUNCTION IF EXISTS get_drawer_status(INTEGER);
CREATE OR REPLACE FUNCTION get_drawer_status(p_user_id TEXT)
RETURNS TABLE (
  isOpen BOOLEAN,
  expected_balance NUMERIC,
  drawer_id INTEGER
) AS $$
DECLARE
  v_drawer RECORD;
  v_sales_total NUMERIC;
BEGIN
  -- Get the most recent drawer for this user
  SELECT * INTO v_drawer FROM public.cash_drawer
  WHERE user_id = p_user_id
  ORDER BY opened_at DESC
  LIMIT 1;

  IF v_drawer IS NULL THEN
    RETURN QUERY SELECT FALSE::BOOLEAN, 0::NUMERIC, NULL::INTEGER;
    RETURN;
  END IF;

  -- Calculate total cash sales since drawer opened
  SELECT COALESCE(SUM(total), 0) INTO v_sales_total
  FROM public.sales
  WHERE created_at >= v_drawer.opened_at
  AND payment_method = 'Cash'
  AND status = 'COMPLETED';

  -- Return drawer status with expected balance (opening + sales)
  RETURN QUERY
  SELECT
    (v_drawer.status = 'OPEN')::BOOLEAN,
    (COALESCE(v_drawer.opening_balance, 0) + v_sales_total)::NUMERIC,
    v_drawer.id::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- 4. OPEN CASH DRAWER (CORRECTED: TEXT parameter, add opened_at timestamp)
DROP FUNCTION IF EXISTS open_cash_drawer(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS open_cash_drawer(INTEGER, NUMERIC);
CREATE OR REPLACE FUNCTION open_cash_drawer(p_user_id TEXT, p_opening_balance NUMERIC)
RETURNS TABLE (
  opened BOOLEAN,
  drawer_id INTEGER
) AS $$
DECLARE
  v_drawer_id INTEGER;
BEGIN
  INSERT INTO public.cash_drawer (user_id, opening_balance, status, opened_at)
  VALUES (p_user_id, p_opening_balance, 'OPEN', NOW())
  RETURNING id INTO v_drawer_id;

  RETURN QUERY SELECT TRUE, v_drawer_id;
END;
$$ LANGUAGE plpgsql;

-- 5. CLOSE CASH DRAWER (CORRECTED: use opened_at instead of created_at)
DROP FUNCTION IF EXISTS close_cash_drawer(INTEGER, NUMERIC);
CREATE OR REPLACE FUNCTION close_cash_drawer(p_drawer_id INTEGER, p_declared_balance NUMERIC)
RETURNS TABLE (
  closed BOOLEAN,
  balanced BOOLEAN,
  expected NUMERIC,
  declared NUMERIC,
  difference NUMERIC
) AS $$
DECLARE
  v_opening_balance NUMERIC;
  v_sales_total NUMERIC;
  v_expected_balance NUMERIC;
  v_difference NUMERIC;
BEGIN
  -- Get drawer opening balance
  SELECT opening_balance INTO v_opening_balance
  FROM public.cash_drawer WHERE id = p_drawer_id;

  -- Calculate expected balance (opening + sales)
  SELECT COALESCE(SUM(total), 0) INTO v_sales_total
  FROM public.sales
  WHERE created_at >= (SELECT opened_at FROM public.cash_drawer WHERE id = p_drawer_id)
  AND payment_method = 'Cash'
  AND status = 'COMPLETED';

  v_expected_balance := v_opening_balance + v_sales_total;
  v_difference := p_declared_balance - v_expected_balance;

  -- Update drawer
  UPDATE public.cash_drawer
  SET
    status = 'CLOSED',
    declared_balance = p_declared_balance,
    difference = v_difference,
    closed_at = NOW()
  WHERE id = p_drawer_id;

  RETURN QUERY
  SELECT
    TRUE,
    (ABS(v_difference) < 1)::BOOLEAN,
    v_expected_balance,
    p_declared_balance,
    v_difference;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ACCOUNTING MODULE RPC FUNCTIONS
-- ============================================================================

-- 6. GET TRIAL BALANCE
DROP FUNCTION IF EXISTS get_trial_balance();
CREATE OR REPLACE FUNCTION get_trial_balance()
RETURNS TABLE (
  account_code TEXT,
  account_name TEXT,
  account_type TEXT,
  total_debit NUMERIC,
  total_credit NUMERIC
) AS $$
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
  GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type
  ORDER BY coa.account_code;
END;
$$ LANGUAGE plpgsql;

-- 7. GET PROFIT & LOSS
DROP FUNCTION IF EXISTS get_profit_loss();
CREATE OR REPLACE FUNCTION get_profit_loss()
RETURNS TABLE (
  revenue NUMERIC,
  cogs NUMERIC,
  gross_profit NUMERIC,
  expenses NUMERIC,
  net_profit NUMERIC
) AS $$
DECLARE
  v_revenue NUMERIC;
  v_cogs NUMERIC;
  v_expenses NUMERIC;
BEGIN
  -- Get revenue (account 4000)
  SELECT COALESCE(SUM(total_credit), 0) INTO v_revenue
  FROM (SELECT * FROM get_trial_balance()) tb
  WHERE account_code = '4000';

  -- Get COGS (account 5000)
  SELECT COALESCE(SUM(total_debit), 0) INTO v_cogs
  FROM (SELECT * FROM get_trial_balance()) tb
  WHERE account_code = '5000';

  -- Get expenses (accounts 5100+)
  SELECT COALESCE(SUM(total_debit), 0) INTO v_expenses
  FROM (SELECT * FROM get_trial_balance()) tb
  WHERE account_code LIKE '51%' OR account_code LIKE '52%';

  RETURN QUERY SELECT
    v_revenue,
    v_cogs,
    (v_revenue - v_cogs),
    v_expenses,
    (v_revenue - v_cogs - v_expenses);
END;
$$ LANGUAGE plpgsql;

-- 8. GET GENERAL LEDGER
DROP FUNCTION IF EXISTS get_general_ledger();
CREATE OR REPLACE FUNCTION get_general_ledger()
RETURNS TABLE (
  id INTEGER,
  created_at TIMESTAMPTZ,
  reference TEXT,
  description TEXT,
  account_name TEXT,
  debit NUMERIC,
  credit NUMERIC
) AS $$
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
  ORDER BY je.created_at DESC, jl.id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TEST QUERIES (run these to verify functions work)
-- ============================================================================

-- Test get_trial_balance
-- SELECT * FROM get_trial_balance();

-- Test get_profit_loss
-- SELECT * FROM get_profit_loss();

-- Test get_general_ledger
-- SELECT * FROM get_general_ledger() LIMIT 5;

-- Test get_drawer_status (user_id is now TEXT)
-- SELECT * FROM get_drawer_status('1');

-- Test open_cash_drawer
-- SELECT * FROM open_cash_drawer('1', 1000);

-- Test close_cash_drawer
-- SELECT * FROM close_cash_drawer(1, 1050);

-- ============================================================================
-- CORRECTIONS APPLIED:
-- 1. get_drawer_status: Changed p_user_id from INTEGER to TEXT
-- 2. get_drawer_status: Changed ORDER BY from created_at to opened_at
-- 3. open_cash_drawer: Changed p_user_id from INTEGER to TEXT
-- 4. open_cash_drawer: Added opened_at timestamp on insert
-- 5. close_cash_drawer: Changed reference from created_at to opened_at
-- All drawer functions now match the actual cash_drawer table schema
-- ============================================================================
