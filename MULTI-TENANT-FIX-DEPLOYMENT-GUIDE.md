# Multi-Tenant Data Isolation Fix - Deployment Guide

## Problem Summary
All modules (Sales, Accounting, Purchasing, HR) are showing data from ALL businesses instead of being scoped to the user's business. This is a critical data isolation issue.

**Root Cause:** RPC functions do not filter by `business_id`, so all queries return unfiltered results.

---

## Solution Overview

We have created TWO new SQL files with corrected RPC functions:

1. **supabase-rpc-functions-multi-tenant-fixed.sql** - Sales, Accounting, Purchasing modules
2. **supabase-hr-functions-multi-tenant-fixed.sql** - HR & Payroll module

All functions now:
- Accept `business_id` or `branch_id` as parameters
- Filter queries by `business_id` for tenant isolation
- Have `SECURITY DEFINER` for RLS bypass
- Return status/message columns

---

## STEP 1: Deploy Updated RPC Functions to Supabase

### 1a. Deploy Core RPC Functions (Sales, Accounting, Purchasing)

1. **Open Supabase Dashboard**
2. **Go to SQL Editor**
3. **Copy ALL content** from: `supabase-rpc-functions-multi-tenant-fixed.sql`
4. **Paste it into the SQL Editor**
5. **Click Run** (execute entire script)
6. **Wait for completion** (should see "Query successful")

### 1b. Deploy HR/Payroll Functions

1. **In the same SQL Editor**
2. **Copy ALL content** from: `supabase-hr-functions-multi-tenant-fixed.sql`
3. **Paste it below the previous query**
4. **Click Run** (execute)
5. **Wait for completion**

✅ All RPC functions are now deployed with multi-tenant filtering.

---

## STEP 2: Update Frontend to Pass business_id

### Update 2a: dashboard.html (Sales Dashboard)

**Find the code that calls `create_sale` RPC and update it:**

**OLD CODE:**
```javascript
const { data, error } = await supabase.rpc('create_sale', {
  p_total: total,
  p_payment_method: paymentMethod,
  p_items: items
});
```

**NEW CODE:**
```javascript
const { data, error } = await supabase.rpc('create_sale', {
  p_branch_id: currentBranchId,  // ADD THIS
  p_total: total,
  p_payment_method: paymentMethod,
  p_items: items
});
```

**Where `currentBranchId` comes from localStorage or the branch selector:**
```javascript
const currentBranchId = parseInt(localStorage.getItem('current_branch_id'));
const currentBusinessId = parseInt(localStorage.getItem('current_business_id'));
```

---

### Update 2b: accounting.html (Accounting Module)

**Find all RPC calls and update them:**

**For get_trial_balance:**
```javascript
// OLD
const { data } = await supabase.rpc('get_trial_balance');

// NEW
const { data } = await supabase.rpc('get_trial_balance', {
  p_business_id: currentBusinessId
});
```

**For get_profit_loss:**
```javascript
// OLD
const { data } = await supabase.rpc('get_profit_loss');

// NEW
const { data } = await supabase.rpc('get_profit_loss', {
  p_business_id: currentBusinessId
});
```

**For get_general_ledger:**
```javascript
// OLD
const { data } = await supabase.rpc('get_general_ledger');

// NEW
const { data } = await supabase.rpc('get_general_ledger', {
  p_business_id: currentBusinessId
});
```

---

### Update 2c: suppliers.html (Purchasing Module)

**For create_purchase_order:**
```javascript
// OLD
const { data, error } = await supabase.rpc('create_purchase_order', {
  p_supplier_id: supplierId,
  p_items: poItems,
  p_expected_delivery_date: deliveryDate,
  p_notes: notes
});

// NEW
const { data, error } = await supabase.rpc('create_purchase_order', {
  p_branch_id: currentBranchId,  // ADD THIS
  p_supplier_id: supplierId,
  p_items: poItems,
  p_expected_delivery_date: deliveryDate,
  p_notes: notes
});
```

**For receive_purchase_order:**
```javascript
// Already correct - no change needed
// (it uses po_id which is already scoped)
```

---

### Update 2d: hr.html (HR & Payroll Module)

**For get_business_employees:**
```javascript
// OLD (if using generic get_employees)
const { data } = await supabase.from('employees').select();

// NEW
const { data, error } = await supabase.rpc('get_business_employees', {
  p_business_id: currentBusinessId
});
```

**For create_employee:**
```javascript
// OLD
const { data, error } = await supabase.from('employees').insert([...]);

// NEW
const { data, error } = await supabase.rpc('create_employee', {
  p_business_id: currentBusinessId,
  p_employee_code: employeeCode,
  p_first_name: firstName,
  p_last_name: lastName,
  p_department_id: departmentId,
  p_position: position,
  p_hire_date: hireDate,
  p_email: email
});
```

**For process_payroll:**
```javascript
// OLD
const { data, error } = await supabase.rpc('process_payroll', {
  p_month: month,
  p_year: year
});

// NEW
const { data, error } = await supabase.rpc('process_payroll', {
  p_business_id: currentBusinessId,
  p_month: month,
  p_year: year
});
```

**For get_attendance_summary:**
```javascript
// OLD
const { data } = await supabase.from('attendance').select();

// NEW
const { data, error } = await supabase.rpc('get_attendance_summary', {
  p_business_id: currentBusinessId,
  p_start_date: startDate,
  p_end_date: endDate
});
```

---

## STEP 3: Add Global Variable for Business/Branch Context

Add this to the `<script>` section of ALL HTML files (dashboard.html, accounting.html, suppliers.html, hr.html, etc.):

```javascript
// Get current context from login response stored in localStorage
let currentUserId = null;
let currentBusinessId = null;
let currentBranchId = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Retrieve from localStorage (set during login)
  const authData = localStorage.getItem('auth_data');
  if (authData) {
    const user = JSON.parse(authData);
    currentUserId = user.id;
    currentBusinessId = user.business_id;
    currentBranchId = user.current_branch_id;
  }
  
  // If not found, redirect to login
  if (!currentBusinessId || !currentBranchId) {
    window.location.href = 'login.html';
    return;
  }
});
```

---

## STEP 4: Verify Data Isolation Works

### Test with Lodiachi Enterprises:
1. **Login as:** admin@lodiachi-enterprises-ltd.local / Admin@0006
2. **Check Purchasing & Supplier Management**
   - Should show 0 purchase orders (or only Lodiachi's POs)
   - Should NOT see ZAI's 2 POs
3. **Check HR & Payroll**
   - Should show 0 employees (or only Lodiachi's employees)
   - Should NOT see ZAI's 2 employees (MAINZA HATWIINDA, LODIA CHIKAMBWE)

### Test with ZAI Digital:
1. **Login as:** carol@proc.com / Proc@1234 (or other ZAI user)
2. **Check Purchasing & Supplier Management**
   - Should show ZAI's data ONLY
   - Should NOT see Lodiachi's data
3. **Check HR & Payroll**
   - Should show ZAI's employees ONLY
   - Should NOT see Lodiachi's employees

---

## STEP 5: Database Query Validation (For Your Reference)

After deployment, you can manually verify in Supabase SQL Editor:

```sql
-- Test 1: Verify RPC function exists and has SECURITY DEFINER
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_name = 'create_sale' AND routine_schema = 'public';

-- Test 2: Test function with business_id parameter
SELECT * FROM public.get_trial_balance(6);  -- business_id = 6 (Lodiachi)

-- Test 3: Verify it only returns Lodiachi data
SELECT COUNT(*) FROM public.journal_lines jl
JOIN public.journal_entries je ON jl.journal_id = je.id
JOIN public.branches b ON je.branch_id = b.id
WHERE b.business_id = 6;
```

---

## STEP 6: File Checklist

- [ ] Deploy `supabase-rpc-functions-multi-tenant-fixed.sql` to Supabase
- [ ] Deploy `supabase-hr-functions-multi-tenant-fixed.sql` to Supabase
- [ ] Update `dashboard.html` RPC calls with `p_branch_id`
- [ ] Update `accounting.html` RPC calls with `p_business_id`
- [ ] Update `suppliers.html` RPC calls with `p_branch_id`
- [ ] Update `hr.html` RPC calls with `p_business_id`
- [ ] Add global variable initialization to all HTML files
- [ ] Test login with Lodiachi Enterprises
- [ ] Verify data isolation (no bleeding)
- [ ] Test login with ZAI Digital
- [ ] Verify ZAI data isolated correctly

---

## CRITICAL CHANGES SUMMARY

| Module | Old Function | New Parameter | Purpose |
|--------|--------------|---------------|---------|
| Sales | `create_sale()` | `p_branch_id` | Scope sales to branch |
| Accounting | `get_trial_balance()` | `p_business_id` | Scope GL to business |
| Accounting | `get_profit_loss()` | `p_business_id` | Scope P&L to business |
| Accounting | `get_general_ledger()` | `p_business_id` | Scope ledger to business |
| Purchasing | `create_purchase_order()` | `p_branch_id` | Scope POs to branch |
| HR | `get_business_employees()` | `p_business_id` | Scope employees to business |
| HR | `create_employee()` | `p_business_id` | Scope new employees to business |
| HR | `process_payroll()` | `p_business_id` | Scope payroll to business |
| HR | `get_attendance_summary()` | `p_business_id` | Scope attendance to business |

---

## Troubleshooting

### Issue: "Function doesn't exist" error
**Solution:** Make sure you ran the SQL deployment scripts in Supabase. Verify in Database → Functions.

### Issue: Still seeing other business's data
**Solution:** 
- Verify `currentBusinessId` and `currentBranchId` are being passed
- Check browser console for errors
- Verify RPC parameters match function definition

### Issue: RPC returns "Business not found"
**Solution:** Ensure the business_id and branch_id passed are valid for the logged-in user.

---

## Deployment Complete ✅

Once all steps are completed, your ZAI FLOW system will have:
- ✅ True multi-tenant data isolation
- ✅ No data bleeding between businesses
- ✅ SECURITY DEFINER RPC functions bypassing RLS safely
- ✅ Proper business_id scoping at database layer

Each user will only see their own business's data!
