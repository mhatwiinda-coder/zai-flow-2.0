# Multi-Tenant SaaS Implementation - TEST PLAN
## ZAI FLOW 2.0 Phase 2.1 - Verification Steps

**Status**: Implementation 90% Complete - Ready for Testing

---

## 🎯 CRITICAL PREREQUISITE

### Backend Login Response Update ⚠️ REQUIRED
Before testing, your backend `/login` endpoint MUST return:

```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "role": "cashier",
  "branches": [
    {
      "branch_id": 1,
      "branch_name": "Main Branch",
      "business_id": 1,
      "business_name": "DEFAULT_BUSINESS",
      "role": "cashier",
      "is_primary": true
    }
  ],
  "current_branch_id": 1,
  "current_business_id": 1
}
```

**If this is NOT returned**, the branch dropdown will show "No branches available" and multi-tenant will not function.

---

## ✅ VERIFICATION CHECKLIST

### Phase 1: Database Layer (COMPLETED ✅)
- [x] SQL migrations ran successfully
- [x] Tables created: business_entities, branches, user_branch_access, business_settings
- [x] branch_id added to 18 existing tables
- [x] RPC functions updated with branch_id parameter
- [x] Data migrated to DEFAULT_BUSINESS

### Phase 2: Frontend HTML Updates (COMPLETED ✅)
- [x] All 10 HTML files updated with branch selector dropdown
- [x] branch-context.js included in each page
- [x] Correct script load order: supabase-init.js → branch-context.js → page-specific js

**Files Updated:**
- [x] sales.html
- [x] dashboard.html
- [x] accounting.html
- [x] purchasing.html
- [x] inventory.html
- [x] hr.html
- [x] zra.html
- [x] suppliers.html
- [x] bi.html

### Phase 3: JavaScript Query Updates (COMPLETED ✅)
- [x] sales.js - Product lookups, sales transactions, GL entries
- [x] purchasing.js - PO creation (RPC), PO listing, supplier listing
- [x] dashboard.js - Sales/inventory metrics, recent sales
- [x] inventory.js - Product listing, inventory metrics
- [x] bi.js - BI dashboard queries
- [x] receiving.js - Goods receipt listing
- [x] admin-business.js - Business/branch management (already done)

**Pattern Applied:** `withBranchFilter(supabase.from('table').select('*'))`

### Phase 4: RPC Function Updates (COMPLETED ✅)
- [x] create_purchase_order - Now accepts p_branch_id parameter
- [x] open_cash_drawer - Now accepts p_branch_id parameter
- [x] Updated in sales.js and purchasing.js

---

## 🧪 STEP-BY-STEP TEST PROCEDURE

### Test 1: Branch Dropdown Displays Correctly

**How to test:**
1. Login to the application
2. Navigate to any page (sales.html, dashboard.html, etc.)
3. Look at the header/topbar for the branch selector dropdown

**Expected Result:**
- ✅ Dropdown shows "📍 Branch: [Business Name] - [Branch Name]"
- ✅ Dropdown populated with user's assigned branches
- ✅ Current branch is selected by default

**If failing:**
- [ ] Check browser console (F12) for JavaScript errors
- [ ] Verify login response includes `branches[]` array
- [ ] Verify localStorage contains user with `current_branch_id`
- [ ] Confirm branch-context.js loaded before page-specific scripts

---

### Test 2: Branch Switching Works

**How to test:**
1. From any page, open the branch dropdown
2. Select a different branch
3. Wait for page to reload

**Expected Result:**
- ✅ Page reloads
- ✅ New branch is now selected in dropdown
- ✅ Data displayed is from the new branch
- ✅ localStorage.user.current_branch_id updated to new branch

**If failing:**
- [ ] Check console for "Cannot read property 'branches'" error
- [ ] Verify user object in localStorage has branches array
- [ ] Check that getBranchContext() returns valid branch context

---

### Test 3: Data Isolation Between Branches

**Prerequisites:** You have at least 2 branches with different data

**How to test:**
1. Login and view sales in Branch A
2. Note the sales counts and data shown
3. Switch to Branch B
4. Verify the sales/data shown is different from Branch A
5. Switch back to Branch A
6. Verify Branch A data matches what you saw initially

**Expected Result:**
- ✅ Branch A shows only Branch A sales
- ✅ Branch B shows only Branch B sales  
- ✅ No cross-branch data leakage
- ✅ Switching back to Branch A shows same data as before

**If failing:**
- [ ] Verify all `.from('table').select()` queries use `withBranchFilter()`
- [ ] Check that branch_id column exists and is populated in all tables
- [ ] Verify branch_id filtering is applied BEFORE other filters
- [ ] Clear browser cache (Ctrl+Shift+Delete) and reload

---

### Test 4: Organization-Level Access Control

**Prerequisites:** You have 2 different businesses/organizations

**How to test:**
1. Login as User A (assigned to Business A)
2. Verify they can ONLY see their assigned branch(es) in dropdown
3. Verify they CANNOT select branches from Business B
4. Login as User B (assigned to Business B)
5. Verify they can ONLY see Business B branches

**Expected Result:**
- ✅ Users can ONLY see branches they've been explicitly granted access to
- ✅ Cross-organization data is completely hidden
- ✅ Dropdown only shows: "Business A - Main", not Business B branches
- ✅ Users cannot change access level (access is admin-controlled)

**If failing:**
- [ ] Verify user_branch_access table has correct role-based assignments
- [ ] Check that login endpoint only returns branches user has access to
- [ ] Verify database RLS policies are correctly set (if using RLS)

---

### Test 5: Sales POS Operations Work

**How to test:**
1. Login and navigate to sales.html
2. Open cash drawer with opening balance (e.g., K1000)
3. Scan a product and add to cart
4. Complete a sale with cash payment
5. Balance till (enter actual cash amount)

**Expected Result:**
- ✅ Opening drawer succeeds with branch_id passed to RPC
- ✅ Product lookup works (filters by current branch)
- ✅ Sale is recorded with current branch_id
- ✅ Till closure GL entries include branch_id
- ✅ No console errors

**If failing:**
- [ ] Check that open_cash_drawer RPC call includes p_branch_id
- [ ] Verify product queries use withBranchFilter()
- [ ] Check sales INSERT includes branch_id
- [ ] Verify GL entry posts with correct branch_id

---

### Test 6: Purchasing Operations Work

**How to test:**
1. Navigate to purchasing.html
2. Create a new Purchase Order
3. Confirm PO
4. Record goods receipt
5. Record invoice
6. Process payment

**Expected Result:**
- ✅ Create PO succeeds with branch_id parameter
- ✅ PO only appears in current branch's PO list
- ✅ RPC functions accept and validate branch_id
- ✅ GL entries posted with branch_id
- ✅ No console errors

**If failing:**
- [ ] Verify create_purchase_order RPC accepts p_branch_id
- [ ] Check that PO queries filter by branch_id
- [ ] Verify supplier is assigned to current branch
- [ ] Check GL entry functions validate branch

---

### Test 7: Admin Panel Works

**How to test:**
1. Login as admin user
2. Navigate to /frontend/admin-business.html
3. View dashboard metrics
4. Create a new business
5. Create a new branch
6. Assign user to branch with role

**Expected Result:**
- ✅ Dashboard shows correct metrics
- ✅ Can create new business and branch
- ✅ Can grant user access to branch with role
- ✅ Branch appears in user's dropdown after assignment
- ✅ User can access assigned branch but not others

**If failing:**
- [ ] Verify admin-business.js loads without errors
- [ ] Check that create_business() and grant_branch_access() RPC functions work
- [ ] Verify user_branch_access table has correct entries

---

## 🔍 CONSOLE CHECKS

Open browser console (F12) and verify:

**On every page load:**
```
✅ Branch selector initialized with X branches
✅ Switched to branch: [Branch Name]
```

**On page navigation:**
```
No "Cannot read property" errors
No "branch_id is not defined" errors
No "withBranchFilter is not a function" errors
```

---

## ⚠️ CRITICAL ERRORS TO WATCH FOR

| Error | Cause | Fix |
|-------|-------|-----|
| "Branch dropdown not appearing" | branch-context.js not loaded | Check script include order |
| "Cannot read property 'branches'" | Login response missing branches[] | Update backend login endpoint |
| "withBranchFilter is not a function" | branch-context.js loaded after other scripts | Move before page-specific js |
| "Data from other branches visible" | Missing withBranchFilter() on queries | Add to all .from() queries |
| "User sees no branches" | user_branch_access records not created | Admin must grant access |
| "RPC function error" | RPC not updated with p_branch_id | Run supabase-multi-tenant-rpc-updates.sql |

---

## ✨ SUCCESS CRITERIA

Multi-tenant implementation is **COMPLETE** when:

- [x] SQL migrations executed
- [x] HTML files updated with branch selector
- [x] JavaScript queries filter by branch_id
- [x] RPC functions accept and validate branch_id
- [ ] **Branch dropdown displays correctly** ← TEST THIS
- [ ] **Switching branches reloads with new data** ← TEST THIS
- [ ] **Data is isolated per branch** ← TEST THIS
- [ ] **Organization-level access control works** ← TEST THIS
- [ ] **POS sales operations work** ← TEST THIS
- [ ] **Purchasing operations work** ← TEST THIS
- [ ] **Admin panel functional** ← TEST THIS
- [ ] No console errors on any page

---

## 📋 TEST EXECUTION CHECKLIST

### Pre-Testing Preparation
- [ ] Ensure backend login endpoint returns branches[] array
- [ ] Verify SQL migrations completed successfully
- [ ] Confirm test users exist with different branch assignments
- [ ] Have test data ready (products, branches, businesses)
- [ ] Open browser DevTools (F12) for console monitoring

### Testing Sequence
- [ ] Test 1: Branch Dropdown Display ✅ or ❌
- [ ] Test 2: Branch Switching ✅ or ❌
- [ ] Test 3: Data Isolation ✅ or ❌
- [ ] Test 4: Organization Access Control ✅ or ❌
- [ ] Test 5: Sales POS Operations ✅ or ❌
- [ ] Test 6: Purchasing Operations ✅ or ❌
- [ ] Test 7: Admin Panel ✅ or ❌

### Sign-Off
- **Tested By:** _______________
- **Date:** _______________
- **All Tests Passed:** ☐ Yes ☐ No
- **Issues Found:** _______________

---

## 🚀 NEXT STEPS AFTER TESTING

If ALL tests pass ✅:
1. Deploy to staging environment
2. Perform UAT with business users
3. Test with real data volume
4. Monitor performance metrics
5. Deploy to production

If ANY test fails ❌:
1. Review error messages in console
2. Check corresponding verification step in this document
3. Fix identified issue
4. Re-run failed test
5. Repeat until all pass

---

## 📞 TROUBLESHOOTING GUIDE

**Q: Branch dropdown shows "No branches available"**
A: Check that login endpoint returns `branches[]` array with proper structure

**Q: Switching branches doesn't reload page**
A: Verify switchBranch() function completes without errors in console

**Q: Sales from other branches visible**
A: Add `withBranchFilter()` to the specific query that's missing it

**Q: Admin panel not loading**
A: Ensure user.role === 'admin', check admin-business.js loads

**Q: RPC functions fail**
A: Verify supabase-multi-tenant-rpc-updates.sql was executed

---

*Test Plan Created: 2026-04-28*  
*Implementation Status: 90% Complete - Ready for Testing*
