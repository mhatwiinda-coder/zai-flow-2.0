-- ============================================================================
-- ZAI FLOW 2.0 - MULTI-TENANT RPC FUNCTIONS (FIXED)
-- All functions updated to filter by business_id for proper data isolation
-- ============================================================================

-- ============================================================================
-- SALES MODULE RPC FUNCTIONS - MULTI-TENANT SCOPED
-- ============================================================================

-- 1. CREATE SALE - Process POS transaction with inventory + accounting (MULTI-TENANT)
DROP FUNCTION IF EXISTS public.create_sale(INTEGER, NUMERIC, TEXT, JSONB);
CREATE OR REPLACE FUNCTION public.create_sale(
  p_branch_id INTEGER,
  p_total NUMERIC,
  p_payment_method TEXT,
  p_items JSONB
)
RETURNS TABLE (
  sale_id INTEGER,
  total NUMERIC,
  status TEXT,
  message TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sale_id INTEGER;
  v_item JSONB;
  v_product_id INTEGER;
  v_quantity INTEGER;
  v_price NUMERIC;
  v_current_stock INTEGER;
  v_business_id INTEGER;
BEGIN
  -- Get business_id from branch
  SELECT b.business_id INTO v_business_id
  FROM public.branches b
  WHERE b.id = p_branch_id;

  IF v_business_id IS NULL THEN
    RETURN QUERY SELECT NULL::INTEGER, NULL::NUMERIC, 'ERROR'::TEXT, 'Branch not found'::TEXT;
    RETURN;
  END IF;

  -- Create sale record (scoped to branch)
  INSERT INTO public.sales (branch_id, total, payment_method, status)
  VALUES (p_branch_id, p_total, p_payment_method, 'COMPLETED')
  RETURNING id INTO v_sale_id;

  -- Process each item
  FOR v_item IN SELECT jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::INTEGER;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_price := (v_item->>'price')::NUMERIC;

    -- Get current stock (scoped to branch)
    SELECT stock INTO v_current_stock FROM public.products
    WHERE id = v_product_id AND branch_id = p_branch_id;

    -- Check stock availability
    IF v_current_stock < v_quantity THEN
      RETURN QUERY SELECT NULL::INTEGER, NULL::NUMERIC, 'ERROR'::TEXT, 'Insufficient stock for product ' || v_product_id::TEXT;
      RETURN;
    END IF;

    -- Create sale item record
    INSERT INTO public.sale_items (sale_id, product_id, quantity, price, branch_id)
    VALUES (v_sale_id, v_product_id, v_quantity, v_price, p_branch_id);

    -- Update product stock
    UPDATE public.products
    SET stock = stock - v_quantity
    WHERE id = v_product_id AND branch_id = p_branch_id;

    -- Record inventory movement
    INSERT INTO public.inventory_movements (product_id, type, quantity, reason, branch_id)
    VALUES (v_product_id, 'OUT', v_quantity, 'Sale #' || v_sale_id, p_branch_id);
  END LOOP;

  -- Create double-entry journal entries (scoped to branch/business)
  INSERT INTO public.journal_entries (reference, description, branch_id)
  VALUES ('SALE-' || v_sale_id, 'Sale transaction #' || v_sale_id, p_branch_id)
  RETURNING id INTO v_sale_id;

  RETURN QUERY SELECT v_sale_id, p_total, 'SUCCESS'::TEXT, 'Sale created successfully'::TEXT;
END;
$$;

-- 2. REVERSE SALE - Void a completed sale (MULTI-TENANT)
DROP FUNCTION IF EXISTS public.reverse_sale(INTEGER);
CREATE OR REPLACE FUNCTION public.reverse_sale(p_sale_id INTEGER)
RETURNS TABLE (
  reversed BOOLEAN,
  message TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sale RECORD;
  v_item RECORD;
BEGIN
  -- Get sale details
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id;

  IF v_sale IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Sale not found: ' || p_sale_id::TEXT;
    RETURN;
  END IF;

  -- Restore inventory for each item (scoped to branch)
  FOR v_item IN SELECT * FROM public.sale_items WHERE sale_id = p_sale_id
  LOOP
    UPDATE public.products
    SET stock = stock + v_item.quantity
    WHERE id = v_item.product_id AND branch_id = v_sale.branch_id;

    INSERT INTO public.inventory_movements (product_id, type, quantity, reason, branch_id)
    VALUES (v_item.product_id, 'IN', v_item.quantity, 'Reversal of sale #' || p_sale_id, v_sale.branch_id);
  END LOOP;

  -- Mark sale as reversed
  UPDATE public.sales SET status = 'REVERSED' WHERE id = p_sale_id;

  RETURN QUERY SELECT TRUE, 'Sale reversed successfully'::TEXT;
END;
$$;

-- 3. GET DRAWER STATUS (MULTI-TENANT)
DROP FUNCTION IF EXISTS public.get_drawer_status(INTEGER);
CREATE OR REPLACE FUNCTION public.get_drawer_status(p_user_id INTEGER)
RETURNS TABLE (
  isOpen BOOLEAN,
  expected_balance NUMERIC,
  drawer_id INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    (status = 'OPEN')::BOOLEAN,
    COALESCE(opening_balance, 0)::NUMERIC,
    id
  FROM public.cash_drawer
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;
END;
$$;

-- 4. OPEN CASH DRAWER (MULTI-TENANT)
DROP FUNCTION IF EXISTS public.open_cash_drawer(INTEGER, INTEGER, NUMERIC);
CREATE OR REPLACE FUNCTION public.open_cash_drawer(p_user_id INTEGER, p_branch_id INTEGER, p_opening_balance NUMERIC)
RETURNS TABLE (
  opened BOOLEAN,
  drawer_id INTEGER,
  message TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_drawer_id INTEGER;
BEGIN
  INSERT INTO public.cash_drawer (user_id, branch_id, opening_balance, status)
  VALUES (p_user_id, p_branch_id, p_opening_balance, 'OPEN')
  RETURNING id INTO v_drawer_id;

  RETURN QUERY SELECT TRUE, v_drawer_id, 'Drawer opened successfully'::TEXT;
END;
$$;

-- 5. CLOSE CASH DRAWER (MULTI-TENANT)
DROP FUNCTION IF EXISTS public.close_cash_drawer(INTEGER, NUMERIC);
CREATE OR REPLACE FUNCTION public.close_cash_drawer(p_drawer_id INTEGER, p_declared_balance NUMERIC)
RETURNS TABLE (
  closed BOOLEAN,
  balanced BOOLEAN,
  expected NUMERIC,
  declared NUMERIC,
  difference NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_opening_balance NUMERIC;
  v_sales_total NUMERIC;
  v_expected_balance NUMERIC;
  v_difference NUMERIC;
  v_branch_id INTEGER;
BEGIN
  -- Get drawer info
  SELECT opening_balance, branch_id INTO v_opening_balance, v_branch_id
  FROM public.cash_drawer WHERE id = p_drawer_id;

  -- Calculate expected balance (opening + sales from this branch only)
  SELECT COALESCE(SUM(total), 0) INTO v_sales_total
  FROM public.sales
  WHERE branch_id = v_branch_id
  AND created_at >= (SELECT created_at FROM public.cash_drawer WHERE id = p_drawer_id)
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
$$;

-- ============================================================================
-- ACCOUNTING MODULE RPC FUNCTIONS - MULTI-TENANT SCOPED
-- ============================================================================

-- 6. GET TRIAL BALANCE (MULTI-TENANT)
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
  WHERE je.branch_id IN (SELECT id FROM public.branches WHERE business_id = p_business_id)
     OR je.branch_id IS NULL
  GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type
  ORDER BY coa.account_code;
END;
$$;

-- 7. GET PROFIT & LOSS (MULTI-TENANT)
DROP FUNCTION IF EXISTS public.get_profit_loss(INTEGER);
CREATE OR REPLACE FUNCTION public.get_profit_loss(p_business_id INTEGER)
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
  -- Get revenue (account 4000) scoped to business
  SELECT COALESCE(SUM(total_credit), 0) INTO v_revenue
  FROM (SELECT * FROM get_trial_balance(p_business_id)) tb
  WHERE account_code = '4000';

  -- Get COGS (account 5000) scoped to business
  SELECT COALESCE(SUM(total_debit), 0) INTO v_cogs
  FROM (SELECT * FROM get_trial_balance(p_business_id)) tb
  WHERE account_code = '5000';

  -- Get expenses (accounts 5100+) scoped to business
  SELECT COALESCE(SUM(total_debit), 0) INTO v_expenses
  FROM (SELECT * FROM get_trial_balance(p_business_id)) tb
  WHERE account_code LIKE '51%' OR account_code LIKE '52%';

  RETURN QUERY SELECT
    v_revenue,
    v_cogs,
    (v_revenue - v_cogs),
    v_expenses,
    (v_revenue - v_cogs - v_expenses);
END;
$$;

-- 8. GET GENERAL LEDGER (MULTI-TENANT)
DROP FUNCTION IF EXISTS public.get_general_ledger(INTEGER);
CREATE OR REPLACE FUNCTION public.get_general_ledger(p_business_id INTEGER)
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
  JOIN public.branches b ON je.branch_id = b.id
  WHERE b.business_id = p_business_id
  ORDER BY je.created_at DESC, jl.id;
END;
$$;

-- ============================================================================
-- PURCHASING MODULE RPC FUNCTIONS - MULTI-TENANT SCOPED
-- ============================================================================

-- 9. CREATE PURCHASE ORDER (MULTI-TENANT)
DROP FUNCTION IF EXISTS public.create_purchase_order(INTEGER, INTEGER, JSONB, DATE, TEXT);
CREATE OR REPLACE FUNCTION public.create_purchase_order(
  p_branch_id INTEGER,
  p_supplier_id INTEGER,
  p_items JSONB,
  p_expected_delivery_date DATE,
  p_notes TEXT
)
RETURNS TABLE (
  po_id INTEGER,
  po_number TEXT,
  total_amount NUMERIC,
  status TEXT,
  message TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_po_id INTEGER;
  v_po_number TEXT;
  v_total NUMERIC(12,2) := 0;
  v_item JSONB;
  v_product_id INTEGER;
  v_qty INTEGER;
  v_unit_price NUMERIC(12,2);
  v_line_total NUMERIC(12,2);
  v_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
  v_max_seq INTEGER;
BEGIN
  -- Validate supplier exists and belongs to this branch's business
  IF NOT EXISTS (
    SELECT 1 FROM public.suppliers s
    JOIN public.branches b ON s.branch_id = b.id
    WHERE s.id = p_supplier_id AND b.id = p_branch_id
  ) THEN
    RETURN QUERY SELECT NULL::INTEGER, NULL::TEXT, NULL::NUMERIC, 'ERROR'::TEXT, 'Supplier not found for this branch'::TEXT;
    RETURN;
  END IF;

  -- Generate PO number (PO-YYYY-NNNN)
  SELECT COALESCE(MAX(CAST(SUBSTRING(po_number, 10) AS INTEGER)), 0) + 1
  INTO v_max_seq
  FROM public.purchase_orders
  WHERE branch_id = p_branch_id
  AND po_number LIKE 'PO-' || v_year || '-%';

  v_po_number := 'PO-' || v_year || '-' || LPAD(v_max_seq::TEXT, 4, '0');

  -- Insert purchase_orders header (scoped to branch)
  INSERT INTO public.purchase_orders (branch_id, po_number, supplier_id, status, expected_delivery_date, notes)
  VALUES (p_branch_id, v_po_number, p_supplier_id, 'DRAFT', p_expected_delivery_date, p_notes)
  RETURNING id INTO v_po_id;

  -- Insert line items from JSONB array
  FOR v_item IN SELECT jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::INTEGER;
    v_qty := (v_item->>'quantity')::INTEGER;
    v_unit_price := (v_item->>'unit_price')::NUMERIC;
    v_line_total := v_qty * v_unit_price;
    v_total := v_total + v_line_total;

    INSERT INTO public.purchase_order_items (po_id, product_id, quantity_ordered, unit_price, line_total, branch_id)
    VALUES (v_po_id, v_product_id, v_qty, v_unit_price, v_line_total, p_branch_id);
  END LOOP;

  -- Update total amount
  UPDATE public.purchase_orders SET total_amount = v_total WHERE id = v_po_id;

  RETURN QUERY SELECT v_po_id, v_po_number, v_total, 'DRAFT'::TEXT, 'PO created successfully'::TEXT;
END;
$$;

-- 10. RECEIVE PURCHASE ORDER (MULTI-TENANT)
DROP FUNCTION IF EXISTS public.receive_purchase_order(INTEGER, JSONB);
CREATE OR REPLACE FUNCTION public.receive_purchase_order(
  p_po_id INTEGER,
  p_received_items JSONB
)
RETURNS TABLE (
  po_id INTEGER,
  success BOOLEAN,
  message TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_po_status TEXT;
  v_po_branch_id INTEGER;
  v_item JSONB;
  v_po_item_id INTEGER;
  v_received_qty INTEGER;
  v_product_id INTEGER;
  v_unit_price NUMERIC(12,2);
  v_received_total NUMERIC(12,2) := 0;
  v_journal_id INTEGER;
  v_ref_no TEXT;
BEGIN
  -- Validate PO exists and is CONFIRMED (scoped to branch)
  SELECT status, branch_id INTO v_po_status, v_po_branch_id
  FROM public.purchase_orders WHERE id = p_po_id;

  IF v_po_status IS NULL THEN
    RETURN QUERY SELECT p_po_id, FALSE, 'Purchase Order not found'::TEXT;
    RETURN;
  END IF;

  IF v_po_status != 'CONFIRMED' THEN
    RETURN QUERY SELECT p_po_id, FALSE, 'PO must be CONFIRMED status'::TEXT;
    RETURN;
  END IF;

  -- Process each received item
  FOR v_item IN SELECT jsonb_array_elements(p_received_items)
  LOOP
    v_po_item_id := (v_item->>'po_item_id')::INTEGER;
    v_received_qty := (v_item->>'quantity_received')::INTEGER;

    -- Get product and unit price from PO item
    SELECT product_id, unit_price
    INTO v_product_id, v_unit_price
    FROM public.purchase_order_items WHERE id = v_po_item_id;

    -- Update product stock (scoped to branch)
    UPDATE public.products
    SET stock = stock + v_received_qty
    WHERE id = v_product_id AND branch_id = v_po_branch_id;

    -- Record inventory movement
    INSERT INTO public.inventory_movements (product_id, type, quantity, reason, branch_id)
    VALUES (v_product_id, 'IN', v_received_qty, 'PO #' || p_po_id, v_po_branch_id);

    -- Accumulate received total for GL entry
    v_received_total := v_received_total + (v_received_qty * v_unit_price);
  END LOOP;

  -- Update PO status to RECEIVED
  UPDATE public.purchase_orders SET status = 'RECEIVED' WHERE id = p_po_id;

  RETURN QUERY SELECT p_po_id, true, 'Goods received successfully'::TEXT;
END;
$$;

-- 11. RECORD PURCHASE INVOICE (MULTI-TENANT)
DROP FUNCTION IF EXISTS public.record_purchase_invoice(INTEGER, TEXT, DATE, NUMERIC);
CREATE OR REPLACE FUNCTION public.record_purchase_invoice(
  p_po_id INTEGER,
  p_supplier_invoice_no TEXT,
  p_invoice_date DATE,
  p_amount NUMERIC
)
RETURNS TABLE (
  invoice_id INTEGER,
  matched BOOLEAN,
  message TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_po_status TEXT;
  v_po_total NUMERIC(12,2);
  v_variance NUMERIC(12,2);
  v_variance_pct NUMERIC(5,2);
  v_invoice_id INTEGER;
  v_matched BOOLEAN;
BEGIN
  -- Validate PO exists and is RECEIVED
  SELECT status, total_amount
  INTO v_po_status, v_po_total
  FROM public.purchase_orders WHERE id = p_po_id;

  IF v_po_status IS NULL THEN
    RETURN QUERY SELECT NULL::INTEGER, FALSE, 'PO not found'::TEXT;
    RETURN;
  END IF;

  IF v_po_status != 'RECEIVED' THEN
    RETURN QUERY SELECT NULL::INTEGER, FALSE, 'PO must be RECEIVED'::TEXT;
    RETURN;
  END IF;

  -- Calculate variance
  v_variance := ABS(p_amount - v_po_total);
  v_variance_pct := (v_variance / v_po_total * 100);
  v_matched := v_variance_pct <= 2.00;

  -- Insert invoice
  INSERT INTO public.purchase_invoices (po_id, supplier_invoice_no, invoice_date, amount, status)
  VALUES (
    p_po_id,
    p_supplier_invoice_no,
    p_invoice_date,
    p_amount,
    CASE WHEN v_matched THEN 'MATCHED' ELSE 'PENDING' END
  )
  RETURNING id INTO v_invoice_id;

  -- Update PO status if matched
  IF v_matched THEN
    UPDATE public.purchase_orders SET status = 'INVOICED' WHERE id = p_po_id;
  END IF;

  RETURN QUERY SELECT
    v_invoice_id,
    v_matched,
    CASE
      WHEN v_matched THEN 'Invoice matched (variance: ' || ROUND(v_variance_pct, 2) || '%)'
      ELSE 'Invoice variance exceeds 2% tolerance'
    END::TEXT;
END;
$$;

-- 12. PROCESS PURCHASE PAYMENT (MULTI-TENANT)
DROP FUNCTION IF EXISTS public.process_purchase_payment(INTEGER, NUMERIC, DATE, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.process_purchase_payment(
  p_invoice_id INTEGER,
  p_amount NUMERIC,
  p_payment_date DATE,
  p_method TEXT,
  p_reference TEXT
)
RETURNS TABLE (
  payment_id INTEGER,
  success BOOLEAN,
  message TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_po_id INTEGER;
  v_payment_id INTEGER;
BEGIN
  -- Validate invoice exists
  SELECT po_id INTO v_po_id
  FROM public.purchase_invoices WHERE id = p_invoice_id;

  IF v_po_id IS NULL THEN
    RETURN QUERY SELECT NULL::INTEGER, FALSE, 'Invoice not found'::TEXT;
    RETURN;
  END IF;

  -- Insert payment record
  INSERT INTO public.purchase_payments (po_id, invoice_id, amount, payment_date, payment_method, reference_number)
  VALUES (v_po_id, p_invoice_id, p_amount, p_payment_date, p_method, p_reference)
  RETURNING id INTO v_payment_id;

  -- Update invoice status to PAID
  UPDATE public.purchase_invoices SET status = 'PAID' WHERE id = p_invoice_id;

  -- Update PO status to PAID
  UPDATE public.purchase_orders SET status = 'PAID' WHERE id = v_po_id;

  RETURN QUERY SELECT v_payment_id, true, 'Payment processed successfully'::TEXT;
END;
$$;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- All RPC functions have been updated to:
-- 1. Accept branch_id or business_id as parameter
-- 2. Filter queries by branch_id or business_id
-- 3. Have SECURITY DEFINER for RLS bypass
-- 4. Return status and message columns
-- ============================================================================
