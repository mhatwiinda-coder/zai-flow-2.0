-- ============================================================================
-- ZAI FLOW 2.0 - Accounts Receivable (AR) RPC Functions
-- Phase 2.1: Accounts Receivable/Payable Management
-- Run ALL of these in Supabase SQL Editor to create AR functions
-- ============================================================================

-- ============================================================================
-- 1. CREATE CUSTOMER INVOICE (DRAFT status, no GL posting yet)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_sales_invoice(
  p_branch_id INTEGER,
  p_sale_id INTEGER,
  p_customer_id INTEGER,
  p_total_amount NUMERIC,
  p_tax_amount NUMERIC,
  p_notes TEXT DEFAULT NULL
) RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  invoice_id INTEGER,
  invoice_number TEXT
) AS $$
DECLARE
  v_invoice_id INTEGER;
  v_invoice_number TEXT;
  v_payment_terms_days INTEGER;
  v_due_date DATE;
  v_seq_number INTEGER;
BEGIN
  -- Get customer credit terms (default to 0 days = cash)
  SELECT COALESCE(payment_terms_days, 0) INTO v_payment_terms_days
  FROM public.customer_credit_terms
  WHERE branch_id = p_branch_id AND customer_id = p_customer_id;

  -- Generate sequence number for invoice: INV-YEAR-SEQNUM (e.g., INV-2026-001234)
  SELECT COALESCE(COUNT(*), 0) + 1 INTO v_seq_number
  FROM public.sales_invoices si
  WHERE si.branch_id = p_branch_id
  AND si.invoice_number LIKE 'INV-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-%';

  v_invoice_number := 'INV-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' || LPAD(v_seq_number::TEXT, 6, '0');

  -- Calculate due date
  v_due_date := CURRENT_DATE + (v_payment_terms_days || ' days')::INTERVAL;

  -- Create invoice
  INSERT INTO public.sales_invoices (
    branch_id, sale_id, customer_id, invoice_number, invoice_date, due_date,
    total_amount, tax_amount, amount_due, status
  ) VALUES (
    p_branch_id, p_sale_id, p_customer_id, v_invoice_number, CURRENT_DATE, v_due_date,
    p_total_amount, p_tax_amount, p_total_amount + p_tax_amount, 'DRAFT'
  ) RETURNING id INTO v_invoice_id;

  RETURN QUERY SELECT
    true,
    'Invoice created in DRAFT status - ID: ' || v_invoice_id,
    v_invoice_id,
    v_invoice_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. ISSUE CUSTOMER INVOICE (Posts GL: Dr. AR 1500, Cr. Revenue 4100)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.issue_sales_invoice(
  p_sales_invoice_id INTEGER,
  p_branch_id INTEGER
) RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  journal_entry_id INTEGER
) AS $$
DECLARE
  v_journal_id INTEGER;
  v_amount NUMERIC(12,2);
  v_customer_id INTEGER;
  v_ar_account_id INTEGER;
  v_revenue_account_id INTEGER;
BEGIN
  -- Get invoice details
  SELECT amount_due, customer_id INTO v_amount, v_customer_id
  FROM public.sales_invoices
  WHERE id = p_sales_invoice_id AND branch_id = p_branch_id;

  IF v_amount IS NULL THEN
    RETURN QUERY SELECT false, 'Invoice not found', NULL::INTEGER;
    RETURN;
  END IF;

  -- Get GL account IDs
  SELECT id INTO v_ar_account_id
  FROM public.chart_of_accounts
  WHERE branch_id = p_branch_id AND account_code = '1500';

  SELECT id INTO v_revenue_account_id
  FROM public.chart_of_accounts
  WHERE branch_id = p_branch_id AND account_code = '4100';

  IF v_ar_account_id IS NULL OR v_revenue_account_id IS NULL THEN
    RETURN QUERY SELECT false, 'Required GL accounts (1500 or 4100) not found', NULL::INTEGER;
    RETURN;
  END IF;

  -- Update invoice status to ISSUED
  UPDATE public.sales_invoices
  SET status = 'ISSUED', issued_at = NOW()
  WHERE id = p_sales_invoice_id;

  -- Create GL journal entry
  INSERT INTO public.journal_entries (branch_id, reference, description)
  VALUES (p_branch_id, 'INV-' || p_sales_invoice_id, 'Customer invoice issued')
  RETURNING id INTO v_journal_id;

  -- Post Dr. AR (1500)
  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit)
  VALUES (v_journal_id, v_ar_account_id, v_amount, 0);

  -- Post Cr. Revenue (4100)
  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit)
  VALUES (v_journal_id, v_revenue_account_id, 0, v_amount);

  -- Create AR detail record
  INSERT INTO public.ar_detail (
    branch_id, customer_id, sales_invoice_id, original_amount, amount_pending,
    invoice_date, due_date, status, days_outstanding, aging_bucket
  )
  SELECT
    p_branch_id, customer_id, id, amount_due, amount_due,
    invoice_date, due_date, 'OPEN', 0, 'CURRENT'
  FROM public.sales_invoices
  WHERE id = p_sales_invoice_id;

  -- Update sales_invoice with journal entry reference
  UPDATE public.sales_invoices
  SET journal_entry_id = v_journal_id
  WHERE id = p_sales_invoice_id;

  RETURN QUERY SELECT true, 'Invoice issued - AR posted to GL', v_journal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. RECORD CUSTOMER PAYMENT (Posts GL: Dr. Cash 1000, Cr. AR 1500)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_customer_payment(
  p_customer_payment_id INTEGER,
  p_branch_id INTEGER
) RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  journal_entry_id INTEGER,
  invoices_paid INTEGER
) AS $$
DECLARE
  v_journal_id INTEGER;
  v_payment_amount NUMERIC(12,2);
  v_customer_id INTEGER;
  v_sales_invoice_id INTEGER;
  v_cash_account_id INTEGER;
  v_ar_account_id INTEGER;
  v_invoices_updated INTEGER := 0;
BEGIN
  -- Get payment details
  SELECT payment_amount, customer_id, sales_invoice_id INTO v_payment_amount, v_customer_id, v_sales_invoice_id
  FROM public.customer_payments
  WHERE id = p_customer_payment_id AND branch_id = p_branch_id;

  IF v_payment_amount IS NULL THEN
    RETURN QUERY SELECT false, 'Payment not found', NULL::INTEGER, 0;
    RETURN;
  END IF;

  -- Get GL account IDs
  SELECT id INTO v_cash_account_id
  FROM public.chart_of_accounts
  WHERE branch_id = p_branch_id AND account_code = '1000';

  SELECT id INTO v_ar_account_id
  FROM public.chart_of_accounts
  WHERE branch_id = p_branch_id AND account_code = '1500';

  IF v_cash_account_id IS NULL OR v_ar_account_id IS NULL THEN
    RETURN QUERY SELECT false, 'Required GL accounts (1000 or 1500) not found', NULL::INTEGER, 0;
    RETURN;
  END IF;

  -- Create GL journal entry
  INSERT INTO public.journal_entries (branch_id, reference, description)
  VALUES (p_branch_id, 'PMT-' || p_customer_payment_id, 'Customer payment received')
  RETURNING id INTO v_journal_id;

  -- Post Dr. Cash (1000)
  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit)
  VALUES (v_journal_id, v_cash_account_id, v_payment_amount, 0);

  -- Post Cr. AR (1500)
  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit)
  VALUES (v_journal_id, v_ar_account_id, 0, v_payment_amount);

  -- Update customer_payment with journal entry
  UPDATE public.customer_payments
  SET journal_entry_id = v_journal_id
  WHERE id = p_customer_payment_id;

  -- Update ar_detail for allocated invoices
  UPDATE public.ar_detail
  SET
    amount_paid = LEAST(original_amount, amount_paid + v_payment_amount),
    amount_pending = GREATEST(0, original_amount - (amount_paid + v_payment_amount)),
    status = CASE
      WHEN (amount_paid + v_payment_amount) >= original_amount THEN 'PAID'
      WHEN (amount_paid + v_payment_amount) > 0 THEN 'PARTIAL_PAID'
      ELSE status
    END,
    paid_date = CASE
      WHEN (amount_paid + v_payment_amount) >= original_amount THEN NOW()
      ELSE paid_date
    END,
    updated_at = NOW()
  WHERE branch_id = p_branch_id
    AND customer_id = v_customer_id
    AND (v_sales_invoice_id IS NULL OR sales_invoice_id = v_sales_invoice_id)
    AND status NOT IN ('PAID', 'WRITTEN_OFF');

  GET DIAGNOSTICS v_invoices_updated = ROW_COUNT;

  RETURN QUERY SELECT true, 'Payment recorded - GL posted', v_journal_id, v_invoices_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. GET AR AGING REPORT (Fast query for dashboards and reports)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_ar_aging_report(
  p_branch_id INTEGER,
  p_as_of_date DATE DEFAULT CURRENT_DATE
) RETURNS TABLE (
  aging_bucket TEXT,
  customer_count INTEGER,
  invoice_count INTEGER,
  total_amount NUMERIC,
  avg_days_outstanding NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN days_outstanding <= 0 THEN 'CURRENT'
      WHEN days_outstanding <= 30 THEN '1-30 Days'
      WHEN days_outstanding <= 60 THEN '31-60 Days'
      WHEN days_outstanding <= 90 THEN '61-90 Days'
      ELSE '91+ Days'
    END as aging_bucket,
    COUNT(DISTINCT customer_id)::INTEGER as customer_count,
    COUNT(DISTINCT sales_invoice_id)::INTEGER as invoice_count,
    SUM(amount_pending)::NUMERIC(12,2) as total_amount,
    AVG(days_outstanding)::NUMERIC(5,2) as avg_days_outstanding
  FROM public.ar_detail
  WHERE branch_id = p_branch_id
    AND status IN ('OPEN', 'PARTIAL_PAID', 'OVERDUE')
  GROUP BY aging_bucket
  ORDER BY
    CASE
      WHEN days_outstanding <= 0 THEN 1
      WHEN days_outstanding <= 30 THEN 2
      WHEN days_outstanding <= 60 THEN 3
      WHEN days_outstanding <= 90 THEN 4
      ELSE 5
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. UPDATE AR AGING (Batch job - run nightly to recalculate aging buckets)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_ar_aging(p_branch_id INTEGER)
RETURNS TABLE (records_updated INTEGER, message TEXT) AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  UPDATE public.ar_detail
  SET
    days_outstanding = EXTRACT(DAY FROM (CURRENT_DATE - due_date))::INTEGER,
    days_past_due = CASE
      WHEN EXTRACT(DAY FROM (CURRENT_DATE - due_date)) > 0
      THEN EXTRACT(DAY FROM (CURRENT_DATE - due_date))::INTEGER
      ELSE 0
    END,
    aging_bucket = CASE
      WHEN EXTRACT(DAY FROM (CURRENT_DATE - due_date)) <= 0 THEN 'CURRENT'
      WHEN EXTRACT(DAY FROM (CURRENT_DATE - due_date)) <= 30 THEN '1-30'
      WHEN EXTRACT(DAY FROM (CURRENT_DATE - due_date)) <= 60 THEN '31-60'
      WHEN EXTRACT(DAY FROM (CURRENT_DATE - due_date)) <= 90 THEN '61-90'
      ELSE '91+'
    END,
    status = CASE
      WHEN status = 'PAID' THEN 'PAID'
      WHEN EXTRACT(DAY FROM (CURRENT_DATE - due_date)) > 0 AND amount_pending > 0 THEN 'OVERDUE'
      ELSE status
    END,
    updated_at = NOW()
  WHERE branch_id = p_branch_id
    AND status NOT IN ('PAID', 'WRITTEN_OFF');

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN QUERY SELECT v_count, 'AR aging updated for ' || v_count || ' records';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. GET CUSTOMER AR SUMMARY (Balance and aging for specific customer)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_customer_ar_summary(
  p_branch_id INTEGER,
  p_customer_id INTEGER
) RETURNS TABLE (
  customer_id INTEGER,
  customer_name TEXT,
  credit_limit NUMERIC,
  outstanding_ar NUMERIC,
  credit_available NUMERIC,
  days_sales_outstanding NUMERIC,
  invoice_count INTEGER,
  overdue_count INTEGER,
  overdue_amount NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    COALESCE(cct.credit_limit, 0)::NUMERIC,
    COALESCE(SUM(CASE WHEN ard.status IN ('OPEN', 'PARTIAL_PAID', 'OVERDUE') THEN ard.amount_pending ELSE 0 END), 0)::NUMERIC,
    GREATEST(0, COALESCE(cct.credit_limit, 0) - COALESCE(SUM(CASE WHEN ard.status IN ('OPEN', 'PARTIAL_PAID', 'OVERDUE') THEN ard.amount_pending ELSE 0 END), 0))::NUMERIC,
    COALESCE(AVG(CASE WHEN ard.status IN ('OPEN', 'PARTIAL_PAID', 'OVERDUE') THEN ard.days_outstanding ELSE NULL END), 0)::NUMERIC,
    COUNT(DISTINCT CASE WHEN ard.status IN ('OPEN', 'PARTIAL_PAID', 'OVERDUE') THEN ard.sales_invoice_id END)::INTEGER,
    COUNT(DISTINCT CASE WHEN ard.status = 'OVERDUE' THEN ard.sales_invoice_id END)::INTEGER,
    COALESCE(SUM(CASE WHEN ard.status = 'OVERDUE' THEN ard.amount_pending ELSE 0 END), 0)::NUMERIC
  FROM public.customers c
  LEFT JOIN public.customer_credit_terms cct ON c.id = cct.customer_id AND cct.branch_id = p_branch_id
  LEFT JOIN public.ar_detail ard ON c.id = ard.customer_id AND ard.branch_id = p_branch_id
  WHERE c.id = p_customer_id
  GROUP BY c.id, c.name, cct.credit_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. GET TOP OVERDUE CUSTOMERS (For dashboard alerts)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_top_overdue_customers(
  p_branch_id INTEGER,
  p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  customer_id INTEGER,
  customer_name TEXT,
  overdue_amount NUMERIC,
  days_overdue INTEGER,
  oldest_invoice_days INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ard.customer_id,
    c.name,
    SUM(ard.amount_pending)::NUMERIC,
    MAX(ard.days_past_due)::INTEGER,
    MAX(ard.days_outstanding)::INTEGER
  FROM public.ar_detail ard
  JOIN public.customers c ON ard.customer_id = c.id
  WHERE ard.branch_id = p_branch_id
    AND ard.status = 'OVERDUE'
  GROUP BY ard.customer_id, c.name
  ORDER BY SUM(ard.amount_pending) DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. CALCULATE DAYS SALES OUTSTANDING (DSO) METRIC
-- ============================================================================
CREATE OR REPLACE FUNCTION public.calculate_dso(
  p_branch_id INTEGER,
  p_days_back INTEGER DEFAULT 30
) RETURNS TABLE (
  dso NUMERIC,
  daily_sales NUMERIC,
  ar_outstanding NUMERIC,
  period_days INTEGER
) AS $$
DECLARE
  v_total_revenue NUMERIC(12,2);
  v_total_ar NUMERIC(12,2);
BEGIN
  -- Calculate revenue for last N days
  SELECT COALESCE(SUM(l.credit), 0) INTO v_total_revenue
  FROM public.journal_lines l
  JOIN public.journal_entries e ON l.journal_id = e.id
  JOIN public.chart_of_accounts a ON l.account_id = a.id
  WHERE e.branch_id = p_branch_id
    AND a.account_code = '4100'
    AND e.created_at >= CURRENT_DATE - (p_days_back || ' days')::INTERVAL;

  -- Calculate current AR outstanding
  SELECT COALESCE(SUM(amount_pending), 0) INTO v_total_ar
  FROM public.ar_detail
  WHERE branch_id = p_branch_id
    AND status IN ('OPEN', 'PARTIAL_PAID', 'OVERDUE');

  RETURN QUERY SELECT
    CASE
      WHEN v_total_revenue > 0 THEN (v_total_ar / v_total_revenue * p_days_back)::NUMERIC
      ELSE 0::NUMERIC
    END,
    (v_total_revenue / p_days_back)::NUMERIC,
    v_total_ar,
    p_days_back;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- DEPLOYMENT NOTES
-- ============================================================================
/*
FUNCTION DEPLOYMENT ORDER:
1. create_sales_invoice() - Creates draft invoice (no GL posting)
2. issue_sales_invoice() - Issues invoice and posts GL (Dr. AR, Cr. Revenue)
3. record_customer_payment() - Records payment and posts GL (Dr. Cash, Cr. AR)
4. get_ar_aging_report() - Queries ar_detail for aging buckets
5. update_ar_aging() - Batch job to update aging buckets nightly
6. get_customer_ar_summary() - Dashboard function for customer AR status
7. get_top_overdue_customers() - Dashboard alerts for overdue AR
8. calculate_dso() - Key metric for working capital management

SCHEDULING:
- update_ar_aging(p_branch_id) should be called nightly at 00:30 (after end of business day)
- SQL: SELECT public.update_ar_aging(branch_id) FOR EACH branch

TESTING:
1. Create test invoice: SELECT public.create_sales_invoice(1, NULL, 123, 10000, 1600, 'Test')
2. Issue test invoice: SELECT public.issue_sales_invoice(1, 1)
3. Verify GL posting: SELECT * FROM journal_entries WHERE reference = 'INV-1'
4. Record test payment: INSERT INTO customer_payments ... RETURNING id; then SELECT public.record_customer_payment(1, 1)
5. Verify AR aging: SELECT * FROM public.get_ar_aging_report(1)
6. Verify DSO: SELECT * FROM public.calculate_dso(1, 30)
*/

-- ============================================================================
-- END OF AR FUNCTIONS
-- ============================================================================
