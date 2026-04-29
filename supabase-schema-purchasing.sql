-- ============================================================================
-- ZAI FLOW 2.0 - Purchasing Module Database Schema
-- Run ALL of these in Supabase SQL Editor to create Purchasing tables
-- ============================================================================

-- ============================================================================
-- 1. EXTEND SUPPLIERS TABLE
-- ============================================================================
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS
  payment_terms TEXT DEFAULT 'Net 30';

ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS
  tax_id TEXT;

ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS
  account_code TEXT;

ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS
  is_active BOOLEAN DEFAULT true;

ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS
  address TEXT;

ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS
  city TEXT;

ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS
  postal_code TEXT;

ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS
  bank_account JSONB;

-- ============================================================================
-- 2. PURCHASE ORDERS TABLE (Header)
-- ============================================================================
DROP TABLE IF EXISTS public.purchase_orders CASCADE;
CREATE TABLE public.purchase_orders (
  id SERIAL PRIMARY KEY,
  po_number TEXT UNIQUE NOT NULL,
  supplier_id INTEGER NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  "status" TEXT DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT', 'SUBMITTED', 'CONFIRMED', 'RECEIVED', 'INVOICED', 'PAID')),
  total_amount NUMERIC(12,2) DEFAULT 0,
  expected_delivery_date DATE,
  notes TEXT,
  created_by INTEGER REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_purchase_orders_supplier_id ON public.purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders("status");
CREATE INDEX idx_purchase_orders_po_number ON public.purchase_orders(po_number);

-- ============================================================================
-- 3. PURCHASE ORDER ITEMS TABLE (Line Items)
-- ============================================================================
DROP TABLE IF EXISTS public.purchase_order_items CASCADE;
CREATE TABLE public.purchase_order_items (
  id SERIAL PRIMARY KEY,
  po_id INTEGER NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity_ordered INTEGER NOT NULL CHECK (quantity_ordered > 0),
  quantity_received INTEGER DEFAULT 0 CHECK (quantity_received >= 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_purchase_order_items_po_id ON public.purchase_order_items(po_id);
CREATE INDEX idx_purchase_order_items_product_id ON public.purchase_order_items(product_id);

-- ============================================================================
-- 4. PURCHASE INVOICES TABLE (Three-Way Match)
-- ============================================================================
DROP TABLE IF EXISTS public.purchase_invoices CASCADE;
CREATE TABLE public.purchase_invoices (
  id SERIAL PRIMARY KEY,
  po_id INTEGER NOT NULL REFERENCES public.purchase_orders(id) ON DELETE RESTRICT,
  supplier_invoice_no TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  "status" TEXT DEFAULT 'PENDING' CHECK ("status" IN ('PENDING', 'MATCHED', 'PAID')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_purchase_invoices_po_id ON public.purchase_invoices(po_id);
CREATE INDEX idx_purchase_invoices_status ON public.purchase_invoices("status");

-- ============================================================================
-- 5. PURCHASE PAYMENTS TABLE (Payment Tracking)
-- ============================================================================
DROP TABLE IF EXISTS public.purchase_payments CASCADE;
CREATE TABLE public.purchase_payments (
  id SERIAL PRIMARY KEY,
  po_id INTEGER NOT NULL REFERENCES public.purchase_orders(id) ON DELETE RESTRICT,
  invoice_id INTEGER REFERENCES public.purchase_invoices(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('Check', 'Bank Transfer', 'Cash', 'Credit Card')),
  reference_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_purchase_payments_po_id ON public.purchase_payments(po_id);
CREATE INDEX idx_purchase_payments_invoice_id ON public.purchase_payments(invoice_id);
CREATE INDEX idx_purchase_payments_payment_date ON public.purchase_payments(payment_date);

-- ============================================================================
-- ENSURE CHART OF ACCOUNTS HAS PURCHASING ACCOUNT CODES
-- ============================================================================

INSERT INTO public.chart_of_accounts (account_code, account_name, account_type)
SELECT '1200', 'Inventory', 'ASSET'
WHERE NOT EXISTS (SELECT 1 FROM public.chart_of_accounts WHERE account_code = '1200');

INSERT INTO public.chart_of_accounts (account_code, account_name, account_type)
SELECT '2000', 'Accounts Payable', 'LIABILITY'
WHERE NOT EXISTS (SELECT 1 FROM public.chart_of_accounts WHERE account_code = '2000');

INSERT INTO public.chart_of_accounts (account_code, account_name, account_type)
SELECT '5010', 'Purchases Expense', 'EXPENSE'
WHERE NOT EXISTS (SELECT 1 FROM public.chart_of_accounts WHERE account_code = '5010');

-- ============================================================================
-- SCHEMA CREATION COMPLETE
-- Test queries to verify tables:
-- SELECT * FROM purchase_orders;
-- SELECT * FROM purchase_order_items;
-- SELECT * FROM purchase_invoices;
-- SELECT * FROM purchase_payments;
-- ============================================================================
