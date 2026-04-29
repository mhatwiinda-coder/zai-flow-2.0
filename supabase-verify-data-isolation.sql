-- ============================================================================
-- ZAI FLOW 2.0 - DATA ISOLATION VERIFICATION & MIGRATION
-- Run this in Supabase SQL Editor to verify multi-tenant data integrity
-- ============================================================================

/* ========== STEP 1: VERIFY PURCHASE ORDERS MIGRATION ========== */
-- Check if all purchase_orders now have branch_id set
SELECT
  'purchase_orders' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN branch_id IS NOT NULL THEN 1 END) as with_branch_id,
  COUNT(CASE WHEN branch_id IS NULL THEN 1 END) as null_branch_id
FROM public.purchase_orders;

/* ========== STEP 2: CHECK ALL PURCHASING-RELATED TABLES ========== */
-- Verify goods_receipt has branch_id scoped
SELECT
  'goods_receipt' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN branch_id IS NOT NULL THEN 1 END) as with_branch_id,
  COUNT(CASE WHEN branch_id IS NULL THEN 1 END) as null_branch_id
FROM public.goods_receipt;

-- Verify purchase_invoices has branch_id scoped
SELECT
  'purchase_invoices' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN branch_id IS NOT NULL THEN 1 END) as with_branch_id,
  COUNT(CASE WHEN branch_id IS NULL THEN 1 END) as null_branch_id
FROM public.purchase_invoices;

-- Verify supplier_payments has branch_id scoped
SELECT
  'supplier_payments' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN branch_id IS NOT NULL THEN 1 END) as with_branch_id,
  COUNT(CASE WHEN branch_id IS NULL THEN 1 END) as null_branch_id
FROM public.supplier_payments;

/* ========== STEP 3: CHECK SALES-RELATED TABLES ========== */
-- Verify sales have branch_id
SELECT
  'sales' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN branch_id IS NOT NULL THEN 1 END) as with_branch_id,
  COUNT(CASE WHEN branch_id IS NULL THEN 1 END) as null_branch_id
FROM public.sales;

-- Verify products have branch_id (if scoped by branch)
SELECT
  'products' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN branch_id IS NOT NULL THEN 1 END) as with_branch_id,
  COUNT(CASE WHEN branch_id IS NULL THEN 1 END) as null_branch_id
FROM public.products;

/* ========== STEP 4: CHECK ACCOUNTING TABLES ========== */
-- Verify chart_of_accounts has business_id
SELECT
  'chart_of_accounts' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN business_id IS NOT NULL THEN 1 END) as with_business_id,
  COUNT(CASE WHEN business_id IS NULL THEN 1 END) as null_business_id
FROM public.chart_of_accounts;

-- Verify journal_entries have business_id
SELECT
  'journal_entries' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN business_id IS NOT NULL THEN 1 END) as with_business_id,
  COUNT(CASE WHEN business_id IS NULL THEN 1 END) as null_business_id
FROM public.journal_entries;

-- Verify journal_lines have business_id (if implemented)
SELECT
  'journal_lines' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN business_id IS NOT NULL THEN 1 END) as with_business_id,
  COUNT(CASE WHEN business_id IS NULL THEN 1 END) as null_business_id
FROM public.journal_lines;

/* ========== STEP 5: CHECK HR TABLES ========== */
-- Verify employees have business_id
SELECT
  'employees' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN business_id IS NOT NULL THEN 1 END) as with_business_id,
  COUNT(CASE WHEN business_id IS NULL THEN 1 END) as null_business_id
FROM public.employees;

-- Verify payroll_runs have business_id
SELECT
  'payroll_runs' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN business_id IS NOT NULL THEN 1 END) as with_business_id,
  COUNT(CASE WHEN business_id IS NULL THEN 1 END) as null_business_id
FROM public.payroll_runs;

/* ========== STEP 6: MIGRATION QUERIES (IF NEEDED) ========== */
-- Execute these ONLY if you see NULL counts above

-- Migrate any NULL branch_id in purchase_orders
UPDATE public.purchase_orders
SET branch_id = 1
WHERE branch_id IS NULL;

-- Migrate any NULL branch_id in goods_receipt
UPDATE public.goods_receipt
SET branch_id = 1
WHERE branch_id IS NULL;

-- Migrate any NULL branch_id in purchase_invoices
UPDATE public.purchase_invoices
SET branch_id = 1
WHERE branch_id IS NULL;

-- Migrate any NULL branch_id in supplier_payments
UPDATE public.supplier_payments
SET branch_id = 1
WHERE branch_id IS NULL;

-- Migrate any NULL branch_id in sales
UPDATE public.sales
SET branch_id = 1
WHERE branch_id IS NULL;

-- Migrate any NULL branch_id in products
UPDATE public.products
SET branch_id = 1
WHERE branch_id IS NULL;

-- Migrate any NULL business_id in chart_of_accounts
UPDATE public.chart_of_accounts
SET business_id = 1
WHERE business_id IS NULL;

-- Migrate any NULL business_id in journal_entries
UPDATE public.journal_entries
SET business_id = 1
WHERE business_id IS NULL;

-- Migrate any NULL business_id in journal_lines
UPDATE public.journal_lines
SET business_id = 1
WHERE business_id IS NULL;

-- Migrate any NULL business_id in employees
UPDATE public.employees
SET business_id = 1
WHERE business_id IS NULL;

-- Migrate any NULL business_id in payroll_runs
UPDATE public.payroll_runs
SET business_id = 1
WHERE business_id IS NULL;

/* ========== STEP 7: VERIFICATION QUERIES ========== */
-- View sample purchase orders for each branch to verify filtering
SELECT
  po.id,
  po.po_number,
  po.branch_id,
  CASE
    WHEN po.branch_id = 1 THEN 'ZAI Digital'
    WHEN po.branch_id = 3 THEN 'ZAI Digital (Branch 3)'
    WHEN po.branch_id = 4 THEN 'ZAI Digital (Branch 4)'
    WHEN po.branch_id = 6 THEN 'Lodiachi Enterprises'
    ELSE 'Unknown Branch'
  END as branch_name,
  po.total_amount,
  po.status
FROM public.purchase_orders po
ORDER BY po.branch_id, po.created_at DESC;

-- View sample sales for each branch
SELECT
  s.id,
  s.receipt_number,
  s.branch_id,
  CASE
    WHEN s.branch_id = 1 THEN 'ZAI Digital'
    WHEN s.branch_id = 3 THEN 'ZAI Digital (Branch 3)'
    WHEN s.branch_id = 4 THEN 'ZAI Digital (Branch 4)'
    WHEN s.branch_id = 6 THEN 'Lodiachi Enterprises'
    ELSE 'Unknown Branch'
  END as branch_name,
  s.total,
  s.payment_method
FROM public.sales s
ORDER BY s.branch_id, s.created_at DESC
LIMIT 20;

-- Verify journal entries are scoped by business
SELECT
  je.id,
  je.reference,
  je.business_id,
  CASE
    WHEN je.business_id = 1 THEN 'ZAI Digital'
    WHEN je.business_id = 6 THEN 'Lodiachi Enterprises'
    ELSE 'Unknown Business'
  END as business_name,
  je.description,
  je.created_at
FROM public.journal_entries je
ORDER BY je.business_id, je.created_at DESC
LIMIT 20;
