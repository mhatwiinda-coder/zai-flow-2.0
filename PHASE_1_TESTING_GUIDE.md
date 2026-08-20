# ZAI FLOW 2.0 - PHASE 1 TESTING & VERIFICATION GUIDE

## Quick Start Testing (5 minutes)

### 1. Deploy Phase 1 Code
```sql
-- Step 1: Update schema with new GL accounts
-- Copy all content from: supabase-schema.sql
-- Paste into Supabase SQL Editor > Run

-- Step 2: Update HR Functions  
-- Copy all content from: supabase-hr-functions-multi-tenant-fixed.sql
-- Paste into Supabase SQL Editor > Run

-- Step 3: Update RPC Functions (close_cash_drawer only)
-- Copy lines 166-248 from: supabase-rpc-functions-multi-tenant-fixed.sql
-- Or copy entire file into Supabase SQL Editor > Run
```

---

## IMMEDIATE VALIDATION TESTS

### TEST 1: Payroll GL Posting ✅
**What it tests:** Payroll creates correct GL entries

**Run this SQL:**
```sql
-- Get a branch ID (usually 1 for default branch)
SELECT * FROM branches LIMIT 1;

-- Get the branch_id and run payroll
SELECT * FROM public.process_payroll(1, 5, 2026);

-- Expected Output:
-- payroll_run_id: (some ID, e.g., 5)
-- total_gross: (should show gross amount)
-- total_deductions: (should show PAYE + Pension)
-- total_net: (should show gross - deductions)
-- employee_count: (should show number of employees processed)
-- journal_entry_id: (should have a value, not NULL)
-- message: "Payroll processed successfully for X employees"

-- Save the payroll_run_id for next tests (e.g., 5)
```

**Verify GL Entries Were Created:**
```sql
-- Check that journal entry exists
SELECT * FROM journal_entries 
WHERE reference LIKE 'PAYROLL%' 
ORDER BY created_at DESC LIMIT 1;

-- Expected: 1 row with reference like "PAYROLL-202605"

-- Check the GL lines
SELECT 
  je.reference,
  coa.account_code,
  coa.account_name,
  jl.debit,
  jl.credit
FROM journal_lines jl
JOIN journal_entries je ON jl.journal_id = je.id
JOIN chart_of_accounts coa ON jl.account_id = coa.id
WHERE je.reference LIKE 'PAYROLL%'
ORDER BY je.created_at DESC;

-- Expected: 4 lines like:
-- PAYROLL-202605 | 5100 | Salary & Wages Exp | 75000.00 | 0.00
-- PAYROLL-202605 | 1000 | Cash               | 0.00     | 62500.00
-- PAYROLL-202605 | 2100 | PAYE Payable       | 0.00     | 7500.00
-- PAYROLL-202605 | 2200 | Pension Payable    | 0.00     | 5000.00
```

**Verify GL is Balanced:**
```sql
-- For the journal entry created above
SELECT 
  je.id,
  je.reference,
  SUM(jl.debit) as total_debit,
  SUM(jl.credit) as total_credit,
  (SUM(jl.debit) - SUM(jl.credit)) as balance
FROM journal_lines jl
JOIN journal_entries je ON jl.journal_id = je.id
WHERE je.reference LIKE 'PAYROLL%'
GROUP BY je.id, je.reference
ORDER BY je.created_at DESC LIMIT 1;

-- Expected: 
-- total_debit: 75000.00
-- total_credit: 75000.00
-- balance: 0.00 (BALANCED!)
```

**Verify Trial Balance Now Includes Salary Expense:**
```sql
-- Get trial balance (need to know how get_trial_balance is called in your system)
-- Or manually check:
SELECT 
  coa.account_code,
  coa.account_name,
  coa.account_type,
  SUM(COALESCE(jl.debit, 0) - COALESCE(jl.credit, 0)) as balance
FROM chart_of_accounts coa
LEFT JOIN journal_lines jl ON jl.account_id = coa.id
WHERE coa.branch_id = 1
GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type
ORDER BY coa.account_code;

-- Expected: Should see:
-- 1000 | Cash              | ASSET     | -62500.00 (reduced by payroll)
-- 2100 | PAYE Payable      | LIABILITY | 7500.00 (payroll liability created)
-- 2200 | Pension Payable   | LIABILITY | 5000.00 (payroll liability created)
-- 5100 | Salary Expense    | EXPENSE   | 75000.00 (expense recorded)
```

---

### TEST 2: Till Variance GL Posting ✅
**What it tests:** Till closure creates GL entries for surpluses/shortages

**Setup: Create Test Till Record**
```sql
-- First, insert a cash drawer record if doesn't exist
-- Assuming branch_id = 1, user_id = 1

INSERT INTO cash_drawer (branch_id, user_id, opening_balance, status, opened_at)
VALUES (1, 1, 2000.00, 'OPEN', NOW())
RETURNING id;

-- Save the drawer_id (e.g., 10)
```

**Run Till Closure - Surplus Case:**
```sql
-- Close drawer with surplus (declared more than expected)
-- opening_balance: 2000
-- expected sales (from WHERE clause): let's say 400
-- expected total: 2400
-- declared_balance: 2450 (surplus of 50)

SELECT * FROM public.close_cash_drawer(10, 2450.00);

-- Expected Output:
-- closed: true
-- balanced: false (difference > 1 ZMW)
-- expected: 2400.00
-- declared: 2450.00
-- difference: 50.00
-- journal_entry_id: (should have value, not NULL)

-- Save the journal_entry_id
```

**Verify GL Entry for Surplus:**
```sql
-- Check GL entry
SELECT 
  je.reference,
  coa.account_code,
  coa.account_name,
  jl.debit,
  jl.credit
FROM journal_lines jl
JOIN journal_entries je ON jl.journal_id = je.id
JOIN chart_of_accounts coa ON jl.account_id = coa.id
WHERE je.reference LIKE 'DRAWER%'
ORDER BY je.created_at DESC LIMIT 10;

-- Expected for SURPLUS:
-- DRAWER-10 | 1000 | Cash           | 50.00 | 0.00
-- DRAWER-10 | 4100 | Other Income   | 0.00  | 50.00
```

**Run Till Closure - Shortage Case:**
```sql
-- Create another till and close with shortage
INSERT INTO cash_drawer (branch_id, user_id, opening_balance, status, opened_at)
VALUES (1, 1, 1000.00, 'OPEN', NOW())
RETURNING id;

-- Close with shortage
-- opening_balance: 1000
-- expected sales: 200
-- expected total: 1200
-- declared_balance: 1150 (shortage of 50)

SELECT * FROM public.close_cash_drawer(11, 1150.00);

-- Expected Output:
-- difference: -50.00 (negative = shortage)
-- journal_entry_id: (should have value)
```

**Verify GL Entry for Shortage:**
```sql
-- Check GL entry
SELECT 
  je.reference,
  coa.account_code,
  coa.account_name,
  jl.debit,
  jl.credit
FROM journal_lines jl
JOIN journal_entries je ON jl.journal_id = je.id
JOIN chart_of_accounts coa ON jl.account_id = coa.id
WHERE je.reference = 'DRAWER-11'
ORDER BY je.created_at DESC;

-- Expected for SHORTAGE:
-- DRAWER-11 | 5200 | Till Variance  | 50.00 | 0.00
-- DRAWER-11 | 1000 | Cash           | 0.00  | 50.00
```

---

### TEST 3: Multi-Tenant Isolation ✅
**What it tests:** Data in one branch doesn't leak to another

**Run this to verify:**
```sql
-- Create test employees in two branches
-- First, get two branch IDs
SELECT id FROM branches LIMIT 2;  -- Let's say we get 1 and 2

-- Create employee in branch 1
SELECT public.create_employee(
  1, 'EMP001', 'John', 'Doe', NULL, 'Manager', '2026-01-01', 'john@test.com'
);

-- Create employee in branch 2
SELECT public.create_employee(
  2, 'EMP002', 'Jane', 'Smith', NULL, 'Cashier', '2026-01-01', 'jane@test.com'
);

-- Now get employees from branch 1
SELECT * FROM public.get_business_employees(1);
-- Expected: Only EMP001 (John Doe)

-- Get employees from branch 2
SELECT * FROM public.get_business_employees(2);
-- Expected: Only EMP002 (Jane Smith)

-- Cross-check: employees table should show correct branch_id
SELECT branch_id, employee_code, first_name FROM employees WHERE employee_code IN ('EMP001', 'EMP002');
-- Expected:
-- branch_id | employee_code | first_name
-- 1         | EMP001        | John
-- 2         | EMP002        | Jane
```

---

### TEST 4: GL Account Auto-Creation ✅
**What it tests:** Missing GL accounts are created automatically during payroll

**Run this test:**
```sql
-- Get trial balance BEFORE payroll (to see which accounts exist)
SELECT account_code FROM chart_of_accounts WHERE branch_id = 1 ORDER BY account_code;

-- Should see: 1000, 1100, 1200, 2000, 2100, 2200, 3000, 4000, 4100, 5000, 5100, 5200

-- If any are missing, they'll be auto-created when you run payroll:
SELECT * FROM public.process_payroll(1, 6, 2026);

-- After running payroll, check again:
SELECT account_code, account_name FROM chart_of_accounts WHERE branch_id = 1 ORDER BY account_code;

-- All accounts should now exist (5100, 2100, 2200 will be created if missing)
```

---

## COMPREHENSIVE VALIDATION (30 minutes)

### SCENARIO 1: Full Month Payroll with Multiple Employees

```sql
-- Scenario: Process May 2026 payroll for branch 1 with 5 employees

-- Step 1: Verify employees exist
SELECT COUNT(*) FROM employees WHERE branch_id = 1 AND status = 'ACTIVE';
-- Expected: >= 5 employees

-- Step 2: Process payroll
SELECT * FROM public.process_payroll(1, 5, 2026);
-- Expected: Returns summary with journal_entry_id

-- Step 3: Check payroll_runs table
SELECT 
  id, month, year, status, total_gross, total_net, 
  employee_count, journal_entry_id
FROM payroll_runs
WHERE branch_id = 1 AND month = 5 AND year = 2026;

-- Expected: 
-- status: COMPLETED
-- employee_count: 5 (or however many were active)
-- journal_entry_id: NOT NULL

-- Step 4: Verify GL Entry Details
SELECT 
  je.reference,
  je.description,
  COUNT(jl.id) as line_count,
  SUM(jl.debit) as total_debit,
  SUM(jl.credit) as total_credit
FROM journal_entries je
JOIN journal_lines jl ON jl.journal_id = je.id
WHERE je.reference = 'PAYROLL-202605'
GROUP BY je.id, je.reference, je.description;

-- Expected:
-- line_count: 4 (Dr Salary, Cr Cash, Cr PAYE, Cr Pension)
-- total_debit: total_gross from payroll
-- total_credit: total_gross from payroll
-- total_debit = total_credit (BALANCED)

-- Step 5: Verify P&L Includes Salary Expense
SELECT 
  account_code, account_name,
  SUM(debit - credit) as balance
FROM journal_lines jl
JOIN chart_of_accounts coa ON jl.account_id = coa.id
WHERE branch_id = 1 AND account_type = 'EXPENSE'
GROUP BY coa.id, account_code, account_name;

-- Expected: Account 5100 should show debit balance (expense)

-- Step 6: Verify Balance Sheet Includes Liabilities
SELECT 
  account_code, account_name,
  SUM(credit - debit) as balance
FROM journal_lines jl
JOIN chart_of_accounts coa ON jl.account_id = coa.id
WHERE branch_id = 1 AND account_type = 'LIABILITY'
GROUP BY coa.id, account_code, account_name;

-- Expected: 2100 and 2200 should show credit balances
```

---

### SCENARIO 2: Till Closure with Real Data

```sql
-- Scenario: Close till after a day of sales

-- Step 1: Check current cash in till
SELECT 
  cd.id, cd.opening_balance, cd.status,
  (SELECT SUM(total) FROM sales WHERE branch_id = cd.branch_id AND payment_method = 'Cash' AND created_at >= cd.opened_at) as sales_total
FROM cash_drawer cd
WHERE cd.branch_id = 1 AND cd.status = 'OPEN'
ORDER BY cd.opened_at DESC
LIMIT 1;

-- Example output:
-- id: 15, opening_balance: 5000, sales_total: 3200

-- Step 2: Close till with actual count
-- Expected balance: 5000 + 3200 = 8200
-- Actual count: 8250 (surplus 50)
SELECT * FROM public.close_cash_drawer(15, 8250.00);

-- Step 3: Verify GL Entry
SELECT 
  je.reference,
  (SELECT account_code FROM chart_of_accounts WHERE id = jl.account_id) as account,
  jl.debit, jl.credit
FROM journal_lines jl
JOIN journal_entries je ON jl.journal_id = je.id
WHERE je.reference = 'DRAWER-15'
ORDER BY jl.id;

-- Expected: 
-- DRAWER-15 | 1000 | 50.00 | NULL (Dr Cash)
-- DRAWER-15 | 4100 | NULL  | 50.00 (Cr Other Income)

-- Step 4: Verify cash drawer status
SELECT id, status, declared_balance, difference FROM cash_drawer WHERE id = 15;

-- Expected:
-- status: CLOSED
-- declared_balance: 8250.00
-- difference: 50.00
```

---

## TROUBLESHOOTING

### Issue: "function public.process_payroll(integer, integer, integer) does not exist"
**Solution:** 
- Re-run the supabase-hr-functions-multi-tenant-fixed.sql file
- Make sure to DROP and CREATE the function
- Verify no syntax errors in the SQL

### Issue: "Column 'business_id' doesn't exist in employees"
**Solution:**
- Your schema is using branch_id (correct)
- Make sure all three files are deployed:
  1. supabase-schema.sql (GL accounts)
  2. supabase-hr-functions-multi-tenant-fixed.sql (HR functions)
  3. supabase-rpc-functions-multi-tenant-fixed.sql (close_cash_drawer)

### Issue: "PAYE Tax Payable account not found"
**Solution:**
- process_payroll() auto-creates missing accounts
- If this error occurs, run payroll once and it will create the account
- Then subsequent payrolls will use the existing account

### Issue: GL entry created but not showing in trial balance
**Solution:**
- Run SQL directly in Supabase to verify:
  ```sql
  SELECT * FROM journal_entries WHERE reference LIKE 'PAYROLL%';
  SELECT * FROM journal_lines WHERE journal_id IN (
    SELECT id FROM journal_entries WHERE reference LIKE 'PAYROLL%'
  );
  ```
- Verify the account_id exists in chart_of_accounts
- Verify branch_id matches your current branch

---

## SUCCESS CRITERIA

| Test | Pass/Fail | Notes |
|------|-----------|-------|
| Payroll GL entry created | ✅ | journal_entry_id not NULL |
| Payroll GL balanced (Dr = Cr) | ✅ | Totals match exactly |
| Till variance GL entry created | ✅ | journal_entry_id not NULL |
| Till GL balanced | ✅ | Variance amount matches |
| P&L shows salary expense | ✅ | Account 5100 has debit balance |
| Balance sheet shows PAYE liability | ✅ | Account 2100 has credit balance |
| Balance sheet shows pension liability | ✅ | Account 2200 has credit balance |
| Multi-tenant isolation working | ✅ | Branch 1 employees ≠ Branch 2 employees |
| No data corruption | ✅ | All GL entries are valid |

---

**All tests passing = Phase 1 Ready for Production! ✅**
