-- ============================================================================
-- ZAI FLOW 2.0 - Purchasing Module RPC Functions
-- Run ALL of these in Supabase SQL Editor to create Purchasing RPC functions
-- ============================================================================

-- ============================================================================
-- 1. CREATE PURCHASE ORDER (Generate PO with auto-numbering)
-- ============================================================================
DROP FUNCTION IF EXISTS public.create_purchase_order(INTEGER, JSONB, DATE, TEXT);
CREATE OR REPLACE FUNCTION public.create_purchase_order(
  p_supplier_id INTEGER,
  p_items JSONB,
  p_expected_delivery_date DATE,
  p_notes TEXT
)
RETURNS TABLE (
  po_id INTEGER,
  po_number TEXT,
  total_amount NUMERIC,
  status TEXT
) AS $$
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
  -- Validate supplier exists
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id) THEN
    RAISE EXCEPTION 'Supplier ID % does not exist', p_supplier_id;
  END IF;

  -- Generate PO number (PO-YYYY-NNNN)
  SELECT COALESCE(MAX(CAST(SUBSTRING(public.purchase_orders.po_number, 10) AS INTEGER)), 0) + 1
  INTO v_max_seq
  FROM public.purchase_orders
  WHERE public.purchase_orders.po_number LIKE 'PO-' || v_year || '-%';

  v_po_number := 'PO-' || v_year || '-' || LPAD(v_max_seq::TEXT, 4, '0');

  -- Insert purchase_orders header
  INSERT INTO public.purchase_orders (po_number, supplier_id, status, expected_delivery_date, notes)
  VALUES (v_po_number, p_supplier_id, 'DRAFT', p_expected_delivery_date, p_notes)
  RETURNING id INTO v_po_id;

  -- Insert line items from JSONB array
  FOR v_item IN SELECT jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::INTEGER;
    v_qty := (v_item->>'quantity')::INTEGER;
    v_unit_price := (v_item->>'unit_price')::NUMERIC;
    v_line_total := v_qty * v_unit_price;
    v_total := v_total + v_line_total;

    INSERT INTO public.purchase_order_items (po_id, product_id, quantity_ordered, unit_price, line_total)
    VALUES (v_po_id, v_product_id, v_qty, v_unit_price, v_line_total);
  END LOOP;

  -- Update total amount
  UPDATE public.purchase_orders SET total_amount = v_total WHERE id = v_po_id;

  -- Return result with explicit column aliases
  RETURN QUERY SELECT v_po_id as po_id, v_po_number as po_number, v_total as total_amount, 'DRAFT'::TEXT as status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. RECEIVE PURCHASE ORDER (Update inventory, post GL entries)
-- ============================================================================
DROP FUNCTION IF EXISTS public.receive_purchase_order(INTEGER, JSONB);
CREATE OR REPLACE FUNCTION public.receive_purchase_order(
  p_po_id INTEGER,
  p_received_items JSONB
)
RETURNS TABLE (
  po_id INTEGER,
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_po_status TEXT;
  v_item JSONB;
  v_po_item_id INTEGER;
  v_received_qty INTEGER;
  v_product_id INTEGER;
  v_unit_price NUMERIC(12,2);
  v_received_total NUMERIC(12,2) := 0;
  v_journal_id INTEGER;
  v_ref_no TEXT;
BEGIN
  -- Validate PO exists and is CONFIRMED
  SELECT "status" INTO v_po_status FROM public.purchase_orders WHERE id = p_po_id;

  IF v_po_status IS NULL THEN
    RAISE EXCEPTION 'Purchase Order ID % does not exist', p_po_id;
  END IF;

  IF v_po_status != 'CONFIRMED' THEN
    RAISE EXCEPTION 'Purchase Order must be CONFIRMED status to receive goods (current: %)', v_po_status;
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

    -- Validate received qty <= ordered qty
    IF EXISTS (
      SELECT 1 FROM public.purchase_order_items
      WHERE id = v_po_item_id AND v_received_qty > quantity_ordered
    ) THEN
      RAISE EXCEPTION 'Received quantity exceeds ordered quantity for line item %', v_po_item_id;
    END IF;

    -- Update received quantity in line item
    UPDATE public.purchase_order_items
    SET quantity_received = quantity_received + v_received_qty
    WHERE id = v_po_item_id;

    -- Update product stock
    UPDATE public.products
    SET stock = stock + v_received_qty
    WHERE id = v_product_id;

    -- Record inventory movement
    INSERT INTO public.inventory_movements (product_id, type, quantity, reason)
    VALUES (v_product_id, 'IN', v_received_qty, 'PO #' || p_po_id);

    -- Accumulate received total for GL entry
    v_received_total := v_received_total + (v_received_qty * v_unit_price);
  END LOOP;

  -- Post GL entries: Dr. Inventory (1200), Cr. Accounts Payable (2000)
  v_ref_no := 'PO-' || p_po_id || '-RCV';

  INSERT INTO public.journal_entries (reference, description)
  VALUES (v_ref_no, 'Goods received for PO #' || p_po_id)
  RETURNING id INTO v_journal_id;

  -- Debit Inventory
  INSERT INTO public.journal_lines (journal_id, account_id, debit)
  VALUES (v_journal_id, 3, v_received_total);

  -- Credit Accounts Payable
  INSERT INTO public.journal_lines (journal_id, account_id, credit)
  VALUES (v_journal_id, 4, v_received_total);

  -- Update PO status to RECEIVED
  UPDATE public.purchase_orders SET "status" = 'RECEIVED' WHERE id = p_po_id;

  RETURN QUERY SELECT p_po_id, true, 'Goods received successfully and inventory updated'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. RECORD PURCHASE INVOICE (Three-way match validation)
-- ============================================================================
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
) AS $$
DECLARE
  v_po_status TEXT;
  v_po_total NUMERIC(12,2);
  v_variance NUMERIC(12,2);
  v_variance_pct NUMERIC(5,2);
  v_invoice_id INTEGER;
  v_matched BOOLEAN;
BEGIN
  -- Validate PO exists and is RECEIVED
  SELECT "status", total_amount
  INTO v_po_status, v_po_total
  FROM public.purchase_orders WHERE id = p_po_id;

  IF v_po_status IS NULL THEN
    RAISE EXCEPTION 'Purchase Order ID % does not exist', p_po_id;
  END IF;

  IF v_po_status != 'RECEIVED' THEN
    RAISE EXCEPTION 'Purchase Order must be RECEIVED status to record invoice (current: %)', v_po_status;
  END IF;

  -- Calculate variance and check three-way match (±2% tolerance)
  v_variance := ABS(p_amount - v_po_total);
  v_variance_pct := (v_variance / v_po_total * 100);
  v_matched := v_variance_pct <= 2.00;

  -- Insert invoice
  INSERT INTO public.purchase_invoices (po_id, supplier_invoice_no, invoice_date, amount, "status")
  VALUES (
    p_po_id,
    p_supplier_invoice_no,
    p_invoice_date,
    p_amount,
    CASE WHEN v_matched THEN 'MATCHED' ELSE 'PENDING' END
  )
  RETURNING id INTO v_invoice_id;

  -- Update PO status to INVOICED if matched
  IF v_matched THEN
    UPDATE public.purchase_orders SET "status" = 'INVOICED' WHERE id = p_po_id;
  END IF;

  RETURN QUERY SELECT
    v_invoice_id,
    v_matched,
    CASE
      WHEN v_matched THEN 'Invoice matched successfully (variance: ' || ROUND(v_variance_pct, 2) || '%)'
      ELSE 'Invoice variance exceeds tolerance (' || ROUND(v_variance_pct, 2) || '%). Requires manual review.'
    END::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. PROCESS PURCHASE PAYMENT (Post GL entries)
-- ============================================================================
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
) AS $$
DECLARE
  v_invoice_exists BOOLEAN;
  v_po_id INTEGER;
  v_payment_id INTEGER;
  v_journal_id INTEGER;
  v_ref_no TEXT;
  v_credit_account TEXT;
BEGIN
  -- Validate invoice exists
  SELECT po_id INTO v_po_id
  FROM public.purchase_invoices WHERE id = p_invoice_id;

  IF v_po_id IS NULL THEN
    RAISE EXCEPTION 'Invoice ID % does not exist', p_invoice_id;
  END IF;

  -- Determine credit account based on payment method
  v_credit_account := CASE
    WHEN p_method = 'Bank Transfer' THEN '1100'  -- Bank account
    WHEN p_method = 'Check' THEN '1000'          -- Cash
    WHEN p_method = 'Cash' THEN '1000'           -- Cash
    WHEN p_method = 'Credit Card' THEN '1000'    -- Cash (simplified)
    ELSE '1000'
  END;

  -- Insert payment record
  INSERT INTO public.purchase_payments (po_id, invoice_id, amount, payment_date, payment_method, reference_number)
  VALUES (v_po_id, p_invoice_id, p_amount, p_payment_date, p_method, p_reference)
  RETURNING id INTO v_payment_id;

  -- Post GL entries: Dr. Accounts Payable (2000), Cr. Cash/Bank
  v_ref_no := 'PO-' || v_po_id || '-PAY-' || v_payment_id;

  INSERT INTO public.journal_entries (reference, description)
  VALUES (v_ref_no, 'Payment for PO #' || v_po_id || ' via ' || p_method)
  RETURNING id INTO v_journal_id;

  -- Debit Accounts Payable
  INSERT INTO public.journal_lines (journal_id, account_id, debit)
  VALUES (v_journal_id, 4, p_amount);

  -- Credit Cash/Bank
  INSERT INTO public.journal_lines (journal_id, account_id, credit)
  VALUES (v_journal_id, 1, p_amount);

  -- Update invoice status to PAID
  UPDATE public.purchase_invoices SET "status" = 'PAID' WHERE id = p_invoice_id;

  -- Update PO status to PAID
  UPDATE public.purchase_orders SET "status" = 'PAID' WHERE id = v_po_id;

  RETURN QUERY SELECT v_payment_id, true, 'Payment processed successfully and GL entries posted'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RPC FUNCTIONS CREATION COMPLETE
-- ============================================================================
