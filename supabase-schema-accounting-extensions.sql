-- ============================================================================
-- ZAI FLOW 2.0 - Accounting Module Extensions (AR/AP, Bank Reconciliation, etc.)
-- Phase 2.1: Accounts Receivable/Payable Management
-- Run ALL of these in Supabase SQL Editor to create Accounting Extension tables
-- ============================================================================

-- ============================================================================
-- 0. CREATE CUSTOMERS TABLE (if not exists) - Required for AR
-- ============================================================================
DROP TABLE IF EXISTS public.customers CASCADE;
CREATE TABLE public.customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'Zambia',
  tax_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_name ON public.customers(name);
CREATE INDEX idx_customers_email ON public.customers(email);

-- ============================================================================
-- 1. CUSTOMER CREDIT TERMS (Customer-specific credit configuration)
-- ============================================================================
DROP TABLE IF EXISTS public.customer_credit_terms CASCADE;
CREATE TABLE public.customer_credit_terms (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  credit_limit NUMERIC(12,2) DEFAULT 0,
  payment_terms_days INTEGER DEFAULT 0,  -- 0 = Cash, 30 = Net 30, 60 = Net 60
  discount_percent NUMERIC(5,2) DEFAULT 0,  -- Early payment discount (2% for early payment)
  discount_days INTEGER DEFAULT 0,  -- Days to qualify for discount
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'BLOCKED')),
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(branch_id, customer_id)
);

CREATE INDEX idx_customer_credit_terms_branch_id ON public.customer_credit_terms(branch_id);
CREATE INDEX idx_customer_credit_terms_customer_id ON public.customer_credit_terms(customer_id);
CREATE INDEX idx_customer_credit_terms_status ON public.customer_credit_terms(status);

-- ============================================================================
-- 2. SALES INVOICES TABLE (Customer Invoices - mirrors purchasing_invoices)
-- ============================================================================
DROP TABLE IF EXISTS public.sales_invoices CASCADE;
CREATE TABLE public.sales_invoices (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  sale_id INTEGER REFERENCES public.sales(id) ON DELETE RESTRICT,  -- Link to original POS sale
  customer_id INTEGER NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL,  -- e.g., INV-2026-001234 (unique per branch)
  invoice_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,  -- Calculated from invoice_date + payment_terms_days
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
  tax_amount NUMERIC(12,2) DEFAULT 0,
  amount_due NUMERIC(12,2) NOT NULL CHECK (amount_due > 0),  -- total_amount + tax_amount
  status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ISSUED', 'PARTIAL_PAID', 'PAID', 'CANCELLED', 'WRITTEN_OFF')),
  issued_at TIMESTAMPTZ,  -- When invoice was formally issued (GL posting happens here)
  journal_entry_id INTEGER REFERENCES public.journal_entries(id),  -- GL posting on issue
  notes TEXT,
  created_by INTEGER REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(branch_id, invoice_number)
);

CREATE INDEX idx_sales_invoices_branch_id ON public.sales_invoices(branch_id);
CREATE INDEX idx_sales_invoices_customer_id ON public.sales_invoices(customer_id);
CREATE INDEX idx_sales_invoices_sale_id ON public.sales_invoices(sale_id);
CREATE INDEX idx_sales_invoices_status ON public.sales_invoices(status);
CREATE INDEX idx_sales_invoices_due_date ON public.sales_invoices(due_date);
CREATE INDEX idx_sales_invoices_invoice_number ON public.sales_invoices(invoice_number);

-- ============================================================================
-- 3. ACCOUNTS RECEIVABLE DETAIL (Denormalized aging table for fast reporting)
-- ============================================================================
DROP TABLE IF EXISTS public.ar_detail CASCADE;
CREATE TABLE public.ar_detail (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sales_invoice_id INTEGER NOT NULL REFERENCES public.sales_invoices(id) ON DELETE CASCADE,
  original_amount NUMERIC(12,2) NOT NULL,  -- amount_due at invoice date
  amount_paid NUMERIC(12,2) DEFAULT 0,
  amount_pending NUMERIC(12,2) NOT NULL,  -- original_amount - amount_paid
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,  -- NULL if not fully paid
  status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'OVERDUE', 'PAID', 'PARTIAL_PAID', 'WRITTEN_OFF')),
  days_outstanding INTEGER DEFAULT 0,  -- DATEDIFF(TODAY(), due_date) if OPEN/OVERDUE
  days_past_due INTEGER DEFAULT 0,  -- DATEDIFF(TODAY(), due_date) if > 0
  aging_bucket TEXT DEFAULT 'CURRENT' CHECK (aging_bucket IN ('CURRENT', '1-30', '31-60', '61-90', '91+')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ar_detail_branch_id ON public.ar_detail(branch_id);
CREATE INDEX idx_ar_detail_customer_id ON public.ar_detail(customer_id);
CREATE INDEX idx_ar_detail_status ON public.ar_detail(status);
CREATE INDEX idx_ar_detail_aging_bucket ON public.ar_detail(aging_bucket);
CREATE INDEX idx_ar_detail_due_date ON public.ar_detail(due_date);
CREATE INDEX idx_ar_detail_invoice_date ON public.ar_detail(invoice_date);

-- ============================================================================
-- 4. CUSTOMER PAYMENTS TABLE (Payment tracking)
-- ============================================================================
DROP TABLE IF EXISTS public.customer_payments CASCADE;
CREATE TABLE public.customer_payments (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  sales_invoice_id INTEGER REFERENCES public.sales_invoices(id) ON DELETE SET NULL,  -- Can be NULL for advance payments
  payment_date DATE DEFAULT CURRENT_DATE,
  payment_amount NUMERIC(12,2) NOT NULL CHECK (payment_amount > 0),
  payment_method TEXT CHECK (payment_method IN ('CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'CREDIT_NOTE', 'OTHER')),
  reference_number TEXT,  -- Bank transaction ID, cheque #, etc.
  notes TEXT,
  journal_entry_id INTEGER REFERENCES public.journal_entries(id),  -- GL posting
  created_by INTEGER REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customer_payments_branch_id ON public.customer_payments(branch_id);
CREATE INDEX idx_customer_payments_customer_id ON public.customer_payments(customer_id);
CREATE INDEX idx_customer_payments_sales_invoice_id ON public.customer_payments(sales_invoice_id);
CREATE INDEX idx_customer_payments_payment_date ON public.customer_payments(payment_date);

-- ============================================================================
-- 5. PAYMENT ALLOCATIONS (Link payments to invoices; 1 payment may cover multiple invoices)
-- ============================================================================
DROP TABLE IF EXISTS public.payment_allocations CASCADE;
CREATE TABLE public.payment_allocations (
  id SERIAL PRIMARY KEY,
  payment_id INTEGER NOT NULL REFERENCES public.customer_payments(id) ON DELETE CASCADE,
  sales_invoice_id INTEGER NOT NULL REFERENCES public.sales_invoices(id) ON DELETE CASCADE,
  allocated_amount NUMERIC(12,2) NOT NULL CHECK (allocated_amount > 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_allocations_payment_id ON public.payment_allocations(payment_id);
CREATE INDEX idx_payment_allocations_sales_invoice_id ON public.payment_allocations(sales_invoice_id);

-- ============================================================================
-- 6. EXTEND CHART OF ACCOUNTS WITH NEW AR/AP ACCOUNTS
-- ============================================================================
-- Account 1500: Accounts Receivable (if not already exists)
INSERT INTO public.chart_of_accounts (account_code, account_name, account_type)
SELECT '1500', 'Accounts Receivable', 'ASSET'
WHERE NOT EXISTS (
  SELECT 1 FROM public.chart_of_accounts WHERE account_code = '1500'
);

-- Account 1510: Allowance for Doubtful Accounts (if not already exists)
INSERT INTO public.chart_of_accounts (account_code, account_name, account_type)
SELECT '1510', 'Allowance for Doubtful Accounts', 'ASSET'
WHERE NOT EXISTS (
  SELECT 1 FROM public.chart_of_accounts WHERE account_code = '1510'
);

-- Account 2000: Accounts Payable (if not already exists)
INSERT INTO public.chart_of_accounts (account_code, account_name, account_type)
SELECT '2000', 'Accounts Payable', 'LIABILITY'
WHERE NOT EXISTS (
  SELECT 1 FROM public.chart_of_accounts WHERE account_code = '2000'
);

-- Verify AR/AP accounts exist
SELECT account_code, account_name, account_type
FROM public.chart_of_accounts
WHERE account_code IN ('1500', '1510', '2000')
ORDER BY account_code;

-- ============================================================================
-- SECTION NOTES FOR PHASE 2.1 IMPLEMENTATION
-- ============================================================================
/*
DEPLOYMENT CHECKLIST:
✅ 1. Run this entire script in Supabase SQL Editor (Database > SQL Editor > paste & execute)
✅ 2. Verify all tables created: customer_credit_terms, sales_invoices, ar_detail, customer_payments, payment_allocations
✅ 3. Verify GL accounts created: 1500 (AR), 1510 (Allowance), 2000 (AP)
✅ 4. Next: Deploy RPC functions from supabase-ar-functions.sql
✅ 5. Next: Update sales UI to add "Issue Invoice" and "Record Payment" buttons
✅ 6. Next: Create AR reports and dashboard widgets

MULTI-TENANT SCOPING:
- All tables include branch_id for multi-tenant isolation
- All RPC functions require p_branch_id parameter
- AR/AP data visible only within same branch

KEY RELATIONSHIPS:
- sales_invoices: branch_id (org), customer_id, sale_id (optional, if from POS)
- ar_detail: denormalized copy of sales_invoices + payment_allocations for fast aging reports
- customer_payments: branch_id, customer_id, sales_invoice_id (may be NULL for advance payments)
- payment_allocations: maps payments to specific invoices (1 payment → multiple invoices)

GL POSTING FLOW:
1. Issue Invoice: Dr. AR 1500, Cr. Revenue 4100 (when status='DRAFT' → 'ISSUED')
2. Record Payment: Dr. Cash 1000, Cr. AR 1500 (when customer_payment created)
3. Adjust for Bad Debt: Dr. Bad Debt Expense, Cr. Allowance for Doubtful Accounts 1510

AGING BUCKET LOGIC (calculated nightly by update_ar_aging RPC):
- CURRENT: due_date >= today
- 1-30: due_date < today, days_past_due <= 30
- 31-60: due_date < today, days_past_due 31-60
- 61-90: due_date < today, days_past_due 61-90
- 91+: due_date < today, days_past_due > 90
*/

-- ============================================================================
-- END OF ACCOUNTING MODULE EXTENSIONS SCHEMA
-- ============================================================================
