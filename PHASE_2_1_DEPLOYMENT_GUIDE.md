# Phase 2.1: Accounts Receivable (AR) Implementation - Deployment Guide

## Overview
Phase 2.1 implements complete customer invoicing and AR aging with automatic GL posting. This guide covers deployment and verification steps.

---

## Step 1: Deploy Schema Changes

**File:** `supabase-schema-accounting-extensions.sql`

1. Open Supabase > SQL Editor
2. Copy **entire contents** of `supabase-schema-accounting-extensions.sql`
3. Paste into SQL Editor
4. Click "RUN" to execute

**What This Creates:**
- ✅ `customers` table - Customer master data
- ✅ `customer_credit_terms` table - Per-branch credit config (credit limit, payment terms)
- ✅ `sales_invoices` table - Customer invoices (DRAFT → ISSUED → PAID)
- ✅ `ar_detail` table - Denormalized aging table for reporting
- ✅ `customer_payments` table - Payment tracking
- ✅ `payment_allocations` table - Link payments to specific invoices
- ✅ GL Account 1500 (Accounts Receivable) - Created automatically for each branch
- ✅ GL Account 1510 (Allowance for Doubtful Accounts)
- ✅ GL Account 2000 (Accounts Payable - already exists from purchasing)

**Verify Success:**
```sql
-- Check tables created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('customers', 'customer_credit_terms', 'sales_invoices', 'ar_detail', 'customer_payments');

-- Should return 5 rows
```

---

## Step 2: Deploy RPC Functions

**File:** `supabase-ar-functions.sql`

1. Open Supabase > SQL Editor
2. Copy **entire contents** of `supabase-ar-functions.sql`
3. Paste into SQL Editor
4. Click "RUN" to execute

**Functions Created:**
1. `create_sales_invoice()` - Create draft invoice
2. `issue_sales_invoice()` - Issue invoice & post GL (Dr. AR 1500, Cr. Revenue 4100)
3. `record_customer_payment()` - Record payment & post GL (Dr. Cash 1000, Cr. AR 1500)
4. `get_ar_aging_report()` - Fast aging query (CURRENT/1-30/31-60/61-90/91+)
5. `update_ar_aging()` - Nightly batch to recalculate aging
6. `get_customer_ar_summary()` - Dashboard function for customer AR
7. `get_top_overdue_customers()` - Overdue AR alerts
8. `calculate_dso()` - Days Sales Outstanding metric

**Verify Success:**
```sql
-- Check functions created
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%sales_invoice%' OR routine_name LIKE '%ar_%' OR routine_name LIKE '%dso%'
OR routine_name LIKE '%customer_ar%' OR routine_name LIKE '%overdue%';

-- Should return 8 rows
```

---

## Step 3: Verify GL Accounts Exist

Run this SQL to confirm GL accounts created:

```sql
SELECT account_code, account_name, account_type, COUNT(*) as branch_count
FROM public.chart_of_accounts
WHERE account_code IN ('1500', '1510', '2000')
GROUP BY account_code, account_name, account_type
ORDER BY account_code;
```

**Expected Result:**
```
account_code | account_name                          | account_type | branch_count
1500         | Accounts Receivable                   | ASSET        | N
1510         | Allowance for Doubtful Accounts      | ASSET        | N
2000         | Accounts Payable                     | LIABILITY    | N
```

If accounts missing, run this:
```sql
INSERT INTO public.chart_of_accounts (account_code, account_name, account_type)
VALUES 
  ('1500', 'Accounts Receivable', 'ASSET'),
  ('1510', 'Allowance for Doubtful Accounts', 'ASSET'),
  ('2000', 'Accounts Payable', 'LIABILITY');
```

---

## Step 4: Create Test Data & Verify Functions

### 4.1 Create Test Customer
```sql
INSERT INTO public.customers (name, email, phone, address, city)
VALUES ('ABC Trading Limited', 'info@abctrading.zm', '+260123456789', '123 Cairo Road', 'Lusaka')
RETURNING id;

-- Note the returned ID (e.g., 1) - use it below
```

### 4.2 Set Up Customer Credit Terms
```sql
INSERT INTO public.customer_credit_terms (branch_id, customer_id, credit_limit, payment_terms_days, status)
VALUES (1, 1, 50000.00, 30, 'ACTIVE');

-- Adjust branch_id=1 if your branch ID is different
```

### 4.3 Create & Issue Test Invoice
```sql
-- Create invoice in DRAFT status
SELECT * FROM public.create_sales_invoice(
  p_branch_id := 1,
  p_sale_id := NULL,
  p_customer_id := 1,
  p_total_amount := 10000.00,
  p_tax_amount := 1600.00,
  p_notes := 'Test Invoice'
);

-- Get the invoice_id from response (e.g., 1), then issue it
SELECT * FROM public.issue_sales_invoice(
  p_sales_invoice_id := 1,
  p_branch_id := 1
);

-- Verify GL posted
SELECT je.reference, je.description, jl.debit, jl.credit, ca.account_code
FROM public.journal_entries je
JOIN public.journal_lines jl ON je.id = jl.journal_id
JOIN public.chart_of_accounts ca ON jl.account_id = ca.id
WHERE je.reference = 'INV-1'
ORDER BY ca.account_code;

-- Expected: Dr. 1500 (10,000 + 1,600 = 11,600), Cr. 4100 (11,600)
```

### 4.4 Record Customer Payment
```sql
-- Insert payment record
INSERT INTO public.customer_payments (branch_id, customer_id, sales_invoice_id, payment_amount, payment_method, reference_number)
VALUES (1, 1, 1, 11600.00, 'BANK_TRANSFER', 'TRF-001')
RETURNING id;

-- Record payment and post GL (use payment_id from above response)
SELECT * FROM public.record_customer_payment(
  p_customer_payment_id := 1,
  p_branch_id := 1
);

-- Verify GL posted
SELECT je.reference, je.description, jl.debit, jl.credit, ca.account_code
FROM public.journal_entries je
JOIN public.journal_lines jl ON je.id = jl.journal_id
JOIN public.chart_of_accounts ca ON jl.account_id = ca.id
WHERE je.reference = 'PMT-1'
ORDER BY ca.account_code;

-- Expected: Dr. 1000 (11,600), Cr. 1500 (11,600)
```

### 4.5 Verify AR Aging Report
```sql
SELECT * FROM public.get_ar_aging_report(p_branch_id := 1);

-- After payment, should show 0 CURRENT (invoice paid)
-- Try issuing multiple invoices with different due dates to test aging buckets
```

---

## Step 5: Update Nightly Batch Job

The `update_ar_aging()` function should be called nightly at midnight (00:30).

**In Supabase, create an Edge Function or use a cron job:**

```sql
-- Option 1: Using Postgres cron (if available)
-- This updates aging for all branches
SELECT cron.schedule('update-ar-aging', '30 0 * * *', $$
  SELECT public.update_ar_aging(id) FROM public.branches WHERE status = 'ACTIVE';
$$);
```

**Or use external scheduler (Zapier, n8n, custom webhook):**
```javascript
// Daily at 00:30 UTC, call:
fetch('https://your-supabase-url/functions/v1/update-ar-aging', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer your-service-role-key' },
  body: JSON.stringify({ branch_ids: [1, 2, 3] })
});
```

---

## Step 6: Verify Multi-Tenant Isolation

```sql
-- This should only return AR for branch 1
SELECT * FROM public.ar_detail WHERE branch_id = 1;

-- This should return nothing (branch 2 has no AR)
SELECT * FROM public.ar_detail WHERE branch_id = 2;

-- Verify customer_credit_terms are per-branch
SELECT * FROM public.customer_credit_terms WHERE branch_id = 1;
```

---

## Multi-Tenant Architecture

**Scoping Pattern:**
- `customers` table: Global (shared across all branches)
- `customer_credit_terms` table: **Branch-scoped** (each branch sets own credit limits)
- `sales_invoices` table: **Branch-scoped** (invoices belong to specific branch)
- `ar_detail` table: **Branch-scoped** (aging reports per branch)
- `customer_payments` table: **Branch-scoped** (payments per branch)

**Why This Works:**
- Customer "ABC Trading" may be in system globally (created once)
- But Branch A gives them K 50,000 credit, Branch B gives K 100,000 credit
- Invoices issued by Branch A don't affect Branch B's AR aging
- Each branch sees only its own AR data

---

## Next Steps After Deployment

1. ✅ **Update Sales UI** - Add "Issue Invoice" button to sales detail view
2. ✅ **Create AR Reports** - Aging report, DSO metric, customer credit status
3. ✅ **Add Dashboard Widgets** - Overdue AR, DSO, top customers by aging
4. ✅ **Run Integration Tests** - End-to-end invoice lifecycle
5. ✅ **Train Users** - How to issue invoices, record payments, view aging

---

## Troubleshooting

### Error: "relation 'customers' does not exist"
- Schema file wasn't executed, or execution failed
- Run `supabase-schema-accounting-extensions.sql` again

### Error: "function 'issue_sales_invoice' does not exist"
- RPC functions file wasn't executed
- Run `supabase-ar-functions.sql` again

### GL accounts not created
- Manual schema file execution failed for GL accounts
- Run this SQL:
```sql
INSERT INTO public.chart_of_accounts (account_code, account_name, account_type, branch_id)
SELECT '1500', 'Accounts Receivable', 'ASSET', id FROM public.branches
WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE account_code = '1500' AND branch_id = branches.id);
```

### Invoice issued but GL not posted
- Check that GL accounts 1500 (AR) and 4100 (Revenue) exist for the branch
- Verify function ran without errors: `SELECT * FROM public.issue_sales_invoice(...)` and check response
- Check journal_entries table: `SELECT * FROM journal_entries WHERE reference = 'INV-N'`

---

## Files Reference

| File | Purpose | Status |
|------|---------|--------|
| `supabase-schema-accounting-extensions.sql` | Create all AR tables and GL accounts | ✅ Created |
| `supabase-ar-functions.sql` | Create 8 RPC functions for AR mgmt | ✅ Created |
| `PHASE_2_1_DEPLOYMENT_GUIDE.md` | This deployment guide | ✅ Created |

---

**Deployment Status: READY FOR TESTING**

Once you confirm:
1. Both SQL files executed successfully
2. All 5 tables created
3. All 8 functions created
4. GL accounts 1500, 1510, 2000 exist
5. Test invoice created and GL posted

Then proceed to Phase 2.1 UI integration (sales module updates).

