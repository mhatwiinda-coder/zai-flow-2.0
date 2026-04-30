# ZAI FLOW 2.0 - Deep Scan: Critical Issues Found

**Date**: May 1, 2026  
**Status**: Issues identified and ready to fix (NOT DEPLOYED)

---

## Issue #1: HR Leave Requests - Database Column Error 🔴

**Location**: `frontend/js/hr.js` line 480

**Error Message**: 
```
Failed to load leave requests: column leave_requests.business_id does not exist
```

**Root Cause**:
The query tries to filter `leave_requests` table directly by `business_id`, but this column doesn't exist in the table.

**Current Code**:
```javascript
let query = supabase
  .from('leave_requests')
  .select('*, employees(first_name, last_name, business_id), leave_types(name)')
  .eq('business_id', context.business_id)  // ❌ WRONG - column doesn't exist
  .order('created_at', { ascending: false });
```

**Problem**: 
- `leave_requests` table doesn't have `business_id` directly
- Business_id comes through the `employees` relationship

**Solution**:
Remove the direct `.eq('business_id')` filter since it will be filtered through the employees relationship

---

## Issue #2: POS Drawer - UUID Type Mismatch 🔴

**Location**: `frontend/js/sales.js` lines 381, 385

**Error**: `400 Bad Request` when opening drawer

**Root Cause**:
Passing INTEGER `user.id` instead of UUID for `p_user_id` parameter

**Current Code** (Line 381, 385):
```javascript
const { data, error } = await supabase.rpc('open_cash_drawer', {
  p_branch_id: context.branch_id,
  p_user_id: user?.id,              // ❌ INTEGER 49, should be UUID
  p_opening_balance: opening
});
```

**Additional Issues**:
- Line 385: Using plain `supabase` instead of `window.supabase`
- Line 288: checkDrawerStatus() also uses plain `supabase`

**Solution**:
1. Change `p_user_id: user?.id` to `p_user_id: getAuthUUID()`
2. Change `supabase.rpc` to `window.supabase.rpc`

---

## Issue #3: POS Drawer Status Check - Supabase Reference 🔴

**Location**: `frontend/js/sales.js` lines 288-289

**Current Code**:
```javascript
const { data: drawers, error: drawerError } = await withBranchFilter(
  supabase.from('cash_drawer').select('*')  // ❌ Plain supabase
)
```

**Solution**:
Change `supabase.from` to `window.supabase.from`

---

## Issue #4: Analytics Charts - Canvas Reuse Error 🔴

**Location**: `frontend/js/supplier-payments.js` lines 300-317, 334-350

**Error Message**:
```
Canvas is already in use. Chart with ID 'D' must be destroyed before the canvas with ID 'topSuppliersChart' can be reused
```

**Root Cause**:
When the page reloads or analytics tab is clicked again, new Chart instances are created without destroying the previous ones.

**Current Code**:
```javascript
const topSupplierCtx = document.getElementById('topSuppliersChart');
if (topSupplierCtx && topSuppliers.length > 0) {
  new Chart(topSupplierCtx, {      // ❌ Creates new chart without destroying old one
    type: 'pie',
    // ...
  });
}

const statusCtx = document.getElementById('spendByStatusChart');
if (statusCtx) {
  new Chart(statusCtx, {            // ❌ Creates new chart without destroying old one
    type: 'bar',
    // ...
  });
}
```

**Solution**:
Add chart instance tracking and destroy before recreating:

```javascript
// At module level (top of supplier-payments.js)
let topSuppliersChartInstance = null;
let spendByStatusChartInstance = null;

// Before creating chart
if (topSuppliersChartInstance) {
  topSuppliersChartInstance.destroy();
}
topSuppliersChartInstance = new Chart(topSupplierCtx, {...});
```

---

## Issue #5: Analytics Query - Plain Supabase Reference 🔴

**Location**: `frontend/js/supplier-payments.js` line 354

**Current Code**:
```javascript
const { data: invoices, error: invoiceError } = await supabase
  .from('purchase_invoices')
  .select('invoice_date, amount, status')
  .eq('status', 'MATCHED');
```

**Problem**: Using plain `supabase` instead of `window.supabase`

**Solution**: Change to `window.supabase`

---

## Issue #6: POS Balance Not Updating After Transactions 🟡

**Location**: `frontend/js/sales.js` line 414

**Description**: After opening drawer, the balance display doesn't update properly

**Root Cause**: The `checkDrawerStatus()` function is called, but it may have timing issues or the UI elements aren't being updated correctly after the RPC call completes.

**Investigation Needed**:
- Check if `checkDrawerStatus()` is properly awaiting async operations
- Verify that UI elements are updated before returning

**Temporary Observation**: The function exists and is called, but needs async/await verification

---

## Summary of Fixes Needed

| Issue | File | Line | Type | Fix |
|-------|------|------|------|-----|
| Leave requests filter | hr.js | 480 | Schema | Remove .eq('business_id') |
| Drawer UUID type | sales.js | 381 | Type mismatch | Use getAuthUUID() |
| Drawer Supabase ref | sales.js | 385 | Reference | Use window.supabase |
| Drawer check Supabase | sales.js | 288 | Reference | Use window.supabase |
| Charts canvas reuse | supplier-payments.js | 300, 334 | Resource leak | Destroy before recreate |
| Analytics Supabase ref | supplier-payments.js | 354 | Reference | Use window.supabase |

---

## Testing After Fixes

### Test #1: HR Leave Requests
```
1. Open HR module
2. Go to Leave Requests tab
3. Should load without error
4. Verify employees and leave types display
```

### Test #2: POS Drawer
```
1. Open POS module
2. Enter opening balance and click "Open Drawer"
3. Should succeed without 400 error
4. Drawer status should show as OPEN
5. Create a sale and verify balance updates
```

### Test #3: Analytics
```
1. Open Purchasing module
2. Go to Analytics tab
3. Should load without chart canvas error
4. Switch between tabs multiple times
5. No "Canvas already in use" error should appear
```

---

## What's Not Being Deployed

All fixes are local only. Ready to test but waiting for:
1. Verification in development environment
2. Confirmation that fixes are working
3. Then commit and push
