# Till Variance Feature Verification Guide

## Overview
This document outlines the complete till balance validation workflow with 3-attempt strategy and automatic GL posting on attempt 3.

## Feature Summary
- **Attempt 1-2**: Prevent drawer closing if till doesn't balance. Show variance amount and attempt counter.
- **Attempt 3**: Allow drawer closing despite imbalance and automatically post a GL entry for the variance.
- **GL Posting**: Creates a journal entry with proper debit/credit based on shortage (variance > 0) vs overage (variance < 0).

## Prerequisites
✓ Till Variance Expense account (5200) added to chart_of_accounts
✓ sales.js updated with dynamic account lookup
✓ journal_lines using correct column name: journal_id

## Test Scenario: Complete Till Closing Workflow

### Step 1: Initialize Test Environment
1. Open browser and go to POS module (pos.html)
2. Log in as cashier user
3. Click "Open Drawer" to open a cash drawer
4. Verify status shows "OPEN"

### Step 2: Create a Sale (Optional but Recommended)
1. Add a product to cart via barcode
2. Enter payment amount (e.g., K 500)
3. Complete sale
4. This creates a transaction for the drawer to match

### Step 3: Test Till Balance Workflow

#### Scenario A: Till Balances (Positive Path)
1. Click "Close Drawer" button
2. Enter declared balance = expected balance (should match opening balance + sales)
3. Should say "Drawer successfully closed"
4. Drawer status changes to "CLOSED"
5. Verify in database: cash_drawer.status = 'CLOSED', declared_balance filled in

#### Scenario B: Till Doesn't Balance (First Attempt)
1. Click "Close Drawer"
2. Enter declared balance that is LESS than expected (e.g., K 100 less)
3. Alert shows:
   ```
   ❌ TILL DOES NOT BALANCE
   
   Expected: K [amount]
   Declared: K [amount]
   Variance: K [difference]
   
   Attempt: 1/3
   Please recount and try again.
   ```
4. Verify attempt counter shows 1/3
5. Drawer remains OPEN
6. No GL entry posted yet
7. Close alert

#### Scenario C: Till Doesn't Balance (Second Attempt)
1. Click "Close Drawer" again
2. Enter a different declared balance (still not matching)
3. Alert shows:
   ```
   ❌ TILL DOES NOT BALANCE
   
   Expected: K [amount]
   Declared: K [amount]
   Variance: K [difference]
   
   Attempt: 2/3
   Please recount and try again.
   ```
4. Verify attempt counter shows 2/3
5. Drawer still remains OPEN
6. No GL entry posted yet

#### Scenario D: Till Doesn't Balance (Third Attempt - GL Posting)
1. Click "Close Drawer" a third time
2. Enter a declared balance (still not matching)
3. Confirm dialog appears:
   ```
   ⚠️ TILL VARIANCE - ATTEMPT 3
   
   Expected: K [amount]
   Declared: K [amount]
   Variance: K [difference]
   
   [SHORTAGE/OVERAGE]
   
   Allow closing with variance GL entry?
   ```
4. Click "OK" to confirm
5. System performs:
   - Creates journal_entries record with reference like "TILL-VAR-1714252145000"
   - Creates journal_lines records:
     - If variance > 0 (shortage): Dr. Till Variance (5200), Cr. Cash (1000)
     - If variance < 0 (overage): Dr. Cash (1000), Cr. Till Variance (5200)
   - Updates cash_drawer to CLOSED
   - Resets attempt counter
   - Shows success message: "Drawer successfully closed"
6. Verify drawer status changes to CLOSED

## Database Verification Checklist

### 1. Verify Till Variance Account Exists
Run in Supabase SQL Editor:
```sql
SELECT id, account_code, account_name FROM chart_of_accounts 
WHERE account_code IN ('1000', '5200');
```

Expected result:
```
id | account_code | account_name
1  | 1000         | Cash
9  | 5200         | Till Variance
```

### 2. Verify GL Entry Created
After completing Scenario D, run:
```sql
SELECT id, reference, description 
FROM journal_entries 
WHERE reference LIKE 'TILL-VAR-%' 
ORDER BY created_at DESC LIMIT 1;
```

Expected: 1 record with reference starting with "TILL-VAR-"

### 3. Verify Journal Lines Created
```sql
SELECT 
  jl.id,
  jl.journal_id,
  jl.account_id,
  ca.account_code,
  ca.account_name,
  jl.debit,
  jl.credit
FROM journal_lines jl
JOIN chart_of_accounts ca ON jl.account_id = ca.id
WHERE jl.journal_id = [JOURNAL_ID_FROM_STEP_2]
ORDER BY jl.id;
```

Expected: 2 records (one for Cash, one for Till Variance)
- If shortage (variance > 0):
  - Row 1: account_id=9 (Till Variance), debit=[variance], credit=0
  - Row 2: account_id=1 (Cash), debit=0, credit=[variance]
- If overage (variance < 0):
  - Row 1: account_id=1 (Cash), debit=[variance], credit=0
  - Row 2: account_id=9 (Till Variance), debit=0, credit=[variance]

### 4. Verify Journal Balances
```sql
SELECT 
  je.id,
  je.reference,
  SUM(COALESCE(jl.debit, 0)) as total_debit,
  SUM(COALESCE(jl.credit, 0)) as total_credit
FROM journal_entries je
JOIN journal_lines jl ON je.id = jl.journal_id
WHERE je.reference LIKE 'TILL-VAR-%'
GROUP BY je.id, je.reference;
```

Expected: For each TILL-VAR entry, total_debit MUST EQUAL total_credit (double-entry accounting)

### 5. Verify Cash Drawer Record
```sql
SELECT 
  id,
  status,
  opening_balance,
  expected_balance,
  declared_balance,
  opened_at,
  closed_at
FROM cash_drawer
WHERE status = 'CLOSED'
ORDER BY closed_at DESC LIMIT 1;
```

Expected: Most recent record has:
- status = 'CLOSED'
- declared_balance = value you entered
- closed_at = recent timestamp

## Browser Console Verification

After closing drawer in Scenario D, check browser console (F12):
1. Should see log: `✅ Till variance GL entry posted: TILL-VAR-[timestamp]`
2. No error messages
3. No red exceptions

Check for errors:
```javascript
// In browser console
// Should see success message
// Check for any network errors in Network tab
```

## Performance & Edge Cases

### Edge Case 1: Shortage (Variance > 0)
- Declared balance is LESS than expected
- GL posting should debit Till Variance Expense (increase expense)
- Credit Cash (decrease cash asset)

### Edge Case 2: Overage (Variance < 0)
- Declared balance is MORE than expected
- GL posting should debit Cash (increase cash asset)
- Credit Till Variance Expense (decrease expense - acts as income recovery)

### Edge Case 3: Large Variance
- Test with large variances (e.g., K 10,000 shortage)
- Verify GL entry still posts correctly
- No decimal rounding issues

### Edge Case 4: Attempt 3 Rejection
- On Attempt 3, click "Cancel" instead of "OK"
- Drawer should remain OPEN
- Attempt counter should still be at 3
- No GL entry created

## Failure Mode Verification

### If Till Variance Account Missing
- Closing drawer on attempt 3 will fail with alert:
  ```
  Warning: Could not post GL entry - Required accounts not found in chart of 
  accounts (Cash: 1000, Till Variance: 5200)
  
  But drawer is being closed
  ```
- Drawer will still close (fail-safe)
- User can manually create Till Variance account and re-run

### If GL Database Unavailable
- Same as above - fail-safe to close drawer
- Warning shown to user
- IT can verify GL entry status later in journal_entries table

## Sign-Off Checklist

- [ ] Till Variance account exists in chart_of_accounts
- [ ] Scenario A (balanced till): Closes immediately without prompts
- [ ] Scenario B (attempt 1): Shows variance, prevents closing, shows "1/3"
- [ ] Scenario C (attempt 2): Shows variance, prevents closing, shows "2/3"
- [ ] Scenario D (attempt 3): Shows confirmation dialog, creates GL entry, closes drawer
- [ ] Database verification: GL entries created with correct debit/credit
- [ ] Journal entries balance (debit = credit)
- [ ] Cash drawer record shows CLOSED status and declared_balance
- [ ] Browser console shows success message, no errors
- [ ] Edge case: Overage scenario posts GL correctly (debit Cash, credit Variance)
- [ ] Edge case: Large variances handled correctly
- [ ] Fail-safe: Drawer closes even if GL posting fails

## Next Steps After Verification

If all tests pass:
1. Document in ZAI FLOW system guide
2. Train cashiers on till balance workflow
3. Set up daily till reconciliation process
4. Monitor GL entries for unusual patterns
5. Back up all test data before going to production

## Notes
- The attempt counter resets after drawer closes successfully
- Each drawer opening can have up to 3 closing attempts
- GL entries are immutable once created (audit trail)
- Till Variance appears as an Expense on the P&L Statement
