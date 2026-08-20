# ZAI FLOW 2.0 - PHASE 1 DEPLOYMENT CHECKLIST

**Status:** Ready for Deployment ✅  
**Date:** May 11, 2026  
**Version:** Phase 1.0

---

## PRE-DEPLOYMENT VERIFICATION

### Files Modified (3 files)
- [ ] `/supabase-schema.sql` - GL account seed data updated
- [ ] `/supabase-hr-functions-multi-tenant-fixed.sql` - HR functions refactored
- [ ] `/supabase-rpc-functions-multi-tenant-fixed.sql` - close_cash_drawer enhanced

### Backup Reminder
- [ ] Backup current Supabase database (Project Settings → Backups)
- [ ] Document current GL account codes (SELECT * FROM chart_of_accounts)
- [ ] Document current payroll runs (SELECT * FROM payroll_runs)

---

## DEPLOYMENT STEPS (In Order)

### STEP 1: Deploy GL Account Schema
**Duration:** < 1 minute  
**Risk:** Low (uses ON CONFLICT, idempotent)

```
Action:
1. Open Supabase SQL Editor
2. Copy entire content of: supabase-schema.sql
3. Paste into SQL Editor
4. Click "Run"
5. Verify: 8 rows inserted (or 0 conflicts)
```

**Expected Output:**
```
INSERT 0 8
or
INSERT 0 0 (if accounts already exist)
```

### STEP 2: Deploy HR Functions
**Duration:** 2-3 minutes  
**Risk:** Medium (drops functions, schema must be compatible)

```
Action:
1. Open Supabase SQL Editor
2. Copy entire content of: supabase-hr-functions-multi-tenant-fixed.sql
3. Paste into SQL Editor
4. Click "Run" 
5. Watch for completion (no errors)
```

**Expected Output:**
```
CREATE FUNCTION
DROP FUNCTION  (repeated for each function)
CREATE OR REPLACE FUNCTION (repeated)
```

**Verify Functions Created:**
```sql
SELECT proname FROM pg_proc WHERE proname LIKE 'get_%' OR proname LIKE 'process_%' OR proname LIKE 'record_%';
-- Should list: get_business_employees, get_business_departments, process_payroll, etc.
```

### STEP 3: Deploy RPC Functions
**Duration:** < 1 minute  
**Risk:** Low (single function update)

**Option A: Deploy Entire File (Recommended)**
```
Action:
1. Open Supabase SQL Editor
2. Copy entire content of: supabase-rpc-functions-multi-tenant-fixed.sql
3. Paste into SQL Editor
4. Click "Run"
```

**Option B: Deploy Only close_cash_drawer (If careful)**
```
Action:
1. Open Supabase SQL Editor
2. Copy lines 166-248 from: supabase-rpc-functions-multi-tenant-fixed.sql
3. Paste into SQL Editor
4. Click "Run"
```

**Verify Function Updated:**
```sql
\df+ close_cash_drawer
-- Should show updated function with journal_entry_id return column
```

---

## POST-DEPLOYMENT VERIFICATION

### Quick Health Check (2 minutes)
Run these queries in order:

**1. Verify GL Accounts Created:**
```sql
SELECT account_code, account_name, account_type FROM chart_of_accounts 
WHERE account_code IN ('2100', '2200', '4100', '5100')
ORDER BY account_code;
```
Expected: 4 rows
```
2100 | PAYE Tax Payable              | LIABILITY
2200 | Pension Contribution Payable  | LIABILITY
4100 | Other Income                  | REVENUE
5100 | Salary & Wages Expense        | EXPENSE
```

**2. Verify HR Functions Exist:**
```sql
SELECT 
  'get_business_employees' as func,
  COUNT(*) FROM pg_proc WHERE proname = 'get_business_employees'
UNION ALL SELECT 'process_payroll', COUNT(*) FROM pg_proc WHERE proname = 'process_payroll'
UNION ALL SELECT 'close_cash_drawer', COUNT(*) FROM pg_proc WHERE proname = 'close_cash_drawer';
```
Expected: All counts = 1

**3. Verify Process Payroll Returns Correct Columns:**
```sql
-- This will fail but show the function signature
SELECT * FROM public.process_payroll(1, 5, 2026);
-- If error says "No rows" - that's OK, function signature is correct
-- If error says "function doesn't exist" - deployment failed
```

**4. Verify Close Cash Drawer Updated:**
```sql
-- Test with dummy drawer ID (will fail but shows signature)
SELECT * FROM public.close_cash_drawer(999, 1000);
-- Should return 6 columns including journal_entry_id
-- If journal_entry_id column missing - deployment failed
```

### Full Integration Test (5 minutes)

**Setup Test Data:**
```sql
-- Get default branch
SELECT id FROM branches WHERE location_code = 'DEFAULT-001' LIMIT 1;
-- Note the branch_id (usually 1)

-- Make sure at least one active employee exists in that branch
SELECT COUNT(*) FROM employees 
WHERE branch_id = 1 AND status = 'ACTIVE';
-- If 0, create test employee:
-- SELECT public.create_employee(1, 'TEST001', 'Test', 'User', NULL, 'Tester', '2026-01-01', 'test@test.com');
```

**Run Payroll Test:**
```sql
SELECT * FROM public.process_payroll(1, 5, 2026);
```

**Verify Result:**
```
Expected columns:
- payroll_run_id: NOT NULL integer
- total_gross: numeric (e.g., 5000.00)
- total_deductions: numeric (e.g., 1150.00)
- total_net: numeric (e.g., 3850.00)
- employee_count: integer > 0
- journal_entry_id: NOT NULL integer ← THIS IS KEY
- message: text like "Payroll processed successfully..."
```

**If journal_entry_id is NULL:**
- Error occurred during GL posting
- Check `/var/log/supabase/` for error details
- Rollback and redeploy

---

## ROLLBACK PLAN

If deployment fails, rollback in 5 minutes:

### Option 1: Revert to Previous Schema
```sql
-- Restore from backup using Supabase Dashboard
-- Project Settings → Backups → Restore
-- Choose backup from before deployment
-- Estimated time: 10-15 minutes
```

### Option 2: Manual Rollback (If confident)
```sql
-- Drop new functions (careful!)
DROP FUNCTION IF EXISTS public.process_payroll(INTEGER, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.close_cash_drawer(INTEGER, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.get_business_employees(INTEGER) CASCADE;
-- ... etc for all functions

-- Then redeploy previous version from backup
```

---

## PRODUCTION SAFETY MEASURES

### Before Going Live
- [ ] Test in staging environment first
- [ ] Run full test suite (see PHASE_1_TESTING_GUIDE.md)
- [ ] Document current system state (backup)
- [ ] Inform accounting team of changes
- [ ] Schedule deployment during off-hours
- [ ] Have rollback plan ready
- [ ] Have DBA or Supabase support on standby

### During Deployment
- [ ] Deploy only one component at a time
- [ ] Verify each deployment before moving to next
- [ ] Keep SQL Editor window open for rollback
- [ ] Monitor error logs in real-time
- [ ] Document any warnings or non-critical errors

### After Deployment
- [ ] Run post-deployment verification (all 4 quick checks)
- [ ] Run integration test (payroll processing)
- [ ] Verify GL entries in accounting module
- [ ] Check trial balance includes new accounts
- [ ] Get accounting team sign-off
- [ ] Enable monitoring/alerting for GL posting

---

## MONITORING & ALERTS (Post-Deployment)

### Set Up Alerts For:
```sql
-- Monitor for GL entry failures
-- If journal_entry_id ever NULL after payroll
CREATE TRIGGER monitor_payroll_gl
AFTER INSERT ON payroll_runs
FOR EACH ROW
WHEN (NEW.journal_entry_id IS NULL AND NEW.status = 'COMPLETED')
EXECUTE FUNCTION notify_accounting('ALERT: Payroll GL posting failed');
```

### Regular Audits:
```sql
-- Weekly: Verify all payrolls have GL entries
SELECT COUNT(*) as payrolls_without_gl 
FROM payroll_runs 
WHERE status = 'COMPLETED' AND journal_entry_id IS NULL;

-- Weekly: Verify GL is always balanced
SELECT COUNT(*) as unbalanced_entries
FROM journal_entries je
WHERE (SELECT SUM(COALESCE(debit, 0)) - SUM(COALESCE(credit, 0)) 
       FROM journal_lines WHERE journal_id = je.id) != 0;
```

---

## TEAM COMMUNICATION

### Before Deployment
**Message to Accounting Team:**
```
NOTICE: System Update - Payroll GL Integration

We're deploying enhancements to the accounting module:
1. Payroll now automatically posts to GL
2. Till variances now post to GL
3. Better audit trail for accounting transactions

Expected changes:
- Salary Expense (5100) account now shows actual payroll amounts
- PAYE & Pension liabilities (2100, 2200) now auto-calculated
- Other Income (4100) may show till surpluses

Your action required:
- Verify trial balance is correct after payroll
- Check P&L shows salary expenses
- Confirm balance sheet shows payroll liabilities

Deployment window: [DATE] [TIME] 
Estimated downtime: < 5 minutes
Contact: [DBA/SUPPORT]
```

### After Deployment
**Confirmation Message:**
```
NOTICE: Payroll GL Integration Deployed Successfully ✅

System changes are live. 
Key features:
- Payroll GL posting: ACTIVE
- Till variance GL posting: ACTIVE  
- Multi-tenant isolation: VERIFIED
- All tests: PASSING

Next steps:
1. Run sample payroll to verify GL entries
2. Review trial balance
3. Confirm P&L accuracy
4. Send feedback to [CONTACT]

No user action required. System is fully functional.
```

---

## COMMON ISSUES & SOLUTIONS

| Issue | Cause | Solution |
|-------|-------|----------|
| "function doesn't exist" | Deployment failed | Redeploy from step 1 |
| journal_entry_id is NULL | GL posting failed | Check Supabase logs, rollback |
| GL entry not balanced | SQL error in function | Manual fix or redeploy |
| Accounts already exist | Schema ran twice | No action, idempotent |
| Permission denied | Supabase SECURITY DEFINER | Verify Supabase role has permissions |

---

## ESTIMATED TIMELINE

| Phase | Duration | Notes |
|-------|----------|-------|
| Pre-deployment backup | 5 min | Automatic via Supabase |
| Deploy schema | 1 min | Fast, idempotent |
| Deploy HR functions | 3 min | Watch for errors |
| Deploy RPC functions | 1 min | Single function |
| Quick health checks | 2 min | Verify all 4 checks |
| Full integration test | 5 min | Run payroll test |
| **TOTAL** | **17 minutes** | Can be run in off-hours |

---

## SUCCESS CRITERIA

✅ All 4 quick health checks pass  
✅ Payroll GL entry created with all 4 lines  
✅ Till variance GL entry created  
✅ Trial balance includes new accounts  
✅ GL entries are balanced (Dr = Cr)  
✅ No data corruption detected  
✅ Accounting team confirms accuracy  

---

## SIGN-OFF

| Role | Name | Date | Status |
|------|------|------|--------|
| Developer | Claude Code | 2026-05-11 | ✅ Ready |
| DBA | [Name] | [Date] | ⬜ Pending |
| Accountant | [Name] | [Date] | ⬜ Pending |
| Manager | [Name] | [Date] | ⬜ Pending |

---

**Ready to deploy Phase 1? Let's go!** 🚀

For questions, see:
- Implementation details: `PHASE_1_IMPLEMENTATION_SUMMARY.md`
- Testing procedures: `PHASE_1_TESTING_GUIDE.md`
- Technical architecture: `/plans/atomic-nibbling-pebble.md`
