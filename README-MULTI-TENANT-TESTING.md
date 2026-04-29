# ZAI FLOW 2.0 Multi-Tenant Testing & Verification Guide

**Created**: 2026-04-28  
**Purpose**: Complete guide for testing and verifying SaaS multi-tenant data isolation  
**Time to Complete**: 1-2 hours  
**Complexity**: Low - mostly following procedures and running scripts

---

## 📋 Quick Navigation

| Document | Purpose | Time | Action |
|----------|---------|------|--------|
| **MULTI-TENANT-STATUS-SUMMARY.md** | Overview of what's been done | 5 min | **READ FIRST** |
| **supabase-verify-data-isolation.sql** | Database verification & migration | 15 min | Run in SQL Editor |
| **MULTI-TENANT-VERIFICATION-CHECKLIST.md** | Step-by-step test cases | 45 min | Execute tests |
| **QUICK-TEST-ISOLATION.js** | Browser console diagnostics | 2 min | Paste in console |
| **MULTI-TENANT-FIX-DEPLOYMENT-GUIDE.md** | Technical reference (optional) | 10 min | Read if issues found |

---

## 🚀 Getting Started (5 Minutes)

### Step 0: Read the Status Summary
1. Open: `MULTI-TENANT-STATUS-SUMMARY.md`
2. Read through once to understand what's been completed
3. Note the "Next Actions" section

### Step 1: Quick Browser Test (2 minutes)
1. Open your ZAI FLOW 2.0 application in browser
2. Press **F12** to open Developer Tools
3. Go to **Console** tab
4. Copy entire contents of `QUICK-TEST-ISOLATION.js`
5. Paste into console and press Enter
6. Verify results show mostly ✅ marks

**Expected Result**: Should see output confirming:
- ✅ Branch context loaded
- ✅ User data found
- ✅ Supabase client initialized
- ✅ All tests passed

---

## 🔍 Database Verification (15 Minutes)

### Step 2: Run Verification Queries

1. **Go to Supabase Dashboard**
   - URL: `https://app.supabase.com`
   - Navigate to your project
   - Click **SQL Editor**

2. **Open Verification Script**
   - File: `supabase-verify-data-isolation.sql`
   - Open in text editor

3. **Run First Verification Block**
   - Copy this section (lines 6-15):
   ```sql
   SELECT
     'purchase_orders' as table_name,
     COUNT(*) as total_records,
     COUNT(CASE WHEN branch_id IS NOT NULL THEN 1 END) as with_branch_id,
     COUNT(CASE WHEN branch_id IS NULL THEN 1 END) as null_branch_id
   FROM public.purchase_orders;
   ```
   - Paste into SQL Editor
   - Click **RUN**

4. **Check Results**
   - Look at `null_branch_id` column
   - **If 0**: ✅ All good, move to next test
   - **If > 0**: ⚠️ Migration needed (see Step 3)

5. **Repeat for Other Tables**
   - Copy each SELECT block and run individually
   - Check results for each table

---

## ⚙️ Data Migration (If Needed)

### Step 3: Run Migration Queries

**Only run this if Step 2 showed NULL values**

1. **Copy Migration Section**
   - From `supabase-verify-data-isolation.sql` (lines 83-113)
   
2. **In SQL Editor**
   - Paste migration queries one at a time
   - Click **RUN** for each
   - Wait for confirmation message

3. **Verify Migration Completed**
   - Re-run verification queries from Step 2
   - All `null_branch_id` counts should now be 0
   - If still seeing NULLs, try again or check for errors

---

## ✅ End-to-End Testing (45 Minutes)

### Step 4: Follow Verification Checklist

1. **Open Document**
   - File: `MULTI-TENANT-VERIFICATION-CHECKLIST.md`

2. **Follow 5 Test Cases**
   - Test Case 1: Purchase Order Data Isolation (10 min)
   - Test Case 2: Financial Data Isolation (10 min)
   - Test Case 3: Employee & HR Data Isolation (8 min)
   - Test Case 4: Sales Data Isolation (8 min)
   - Test Case 5: Inventory Data Isolation (9 min)

3. **For Each Test Case**
   - Login with User 1 (ZAI Digital)
   - Record the values shown
   - Logout
   - Login with User 2 (Lodiachi Enterprises)
   - Record the values shown
   - **Verify values are DIFFERENT**

4. **Document Results**
   - Fill in the "Verification Results" section in checklist
   - Take screenshots if needed
   - Record any issues found

---

## 🐛 Troubleshooting Guide

### Issue: Browser Console Shows Errors
**Solution**:
1. Take screenshot of error
2. Check which module is failing (Sales, Accounting, HR, etc.)
3. Open corresponding file: `frontend/js/[module].js`
4. Search for the function mentioned in error
5. Compare with examples in `MULTI-TENANT-FIX-DEPLOYMENT-GUIDE.md`
6. Verify RPC calls include `p_business_id` or `p_branch_id` parameter

### Issue: withBranchFilter() Not Working
**Solution**:
1. Verify `branch-context.js` is included in HTML (check `<script>` tags)
2. Verify user is logged in: Check localStorage in DevTools
3. Verify `current_branch_id` and `current_business_id` are set in user object

### Issue: RPC Function Not Found Error
**Solution**:
1. Go to Supabase SQL Editor
2. Run: `\df get_profit_loss`
3. If no result, RPC not deployed
4. Deploy from: `supabase-rpc-functions-multi-tenant-fixed.sql`

### Issue: Data Still Showing for Both Businesses
**Solution**:
1. Clear browser cache: Ctrl+Shift+Delete (Windows) or Cmd+Shift+Delete (Mac)
2. Close ALL browser tabs
3. Reopen application in fresh browser window
4. Login again
5. If still failing, check database migration (Step 3) completed successfully

### Issue: "No branch context - user not logged in"
**Solution**:
1. Logout and login again
2. Verify email/password are correct
3. Check browser console for login errors
4. If still failing, check backend login endpoint is working

---

## 📊 Test Data for Quick Testing

### Recommended Test Users

**User 1: ZAI Digital**
- Email: `carol@proc.com`
- Password: `Proc@1234`
- Expected: Should see 2 purchase orders, K 775,242 balance
- Expected: Should see specific employees and sales

**User 2: Lodiachi Enterprises**
- Email: `admin@lodiachi-enterprises-ltd.local`
- Password: `Admin@0006`
- Expected: Should see 0 purchase orders (or different count)
- Expected: Different financial balance
- Expected: Different employees

### Creating Test Data (Optional)
If you need fresh test data:
1. Run: `INSERT INTO public.purchase_orders (...) VALUES (...);`
2. Make sure to include `branch_id` = correct business branch
3. Test isolation immediately after inserting

---

## ✨ What Success Looks Like

When everything is working correctly, you should see:

### ✅ Browser Console (F12)
```
✅ Branch context loaded successfully
✅ User data found in localStorage
✅ Supabase client is initialized
✅ withBranchFilter function exists
✅ ALL TESTS PASSED - System appears to be properly configured
```

### ✅ Database Verification
All tables show:
```
null_branch_id: 0    (for sales, products, purchase_orders, etc.)
null_business_id: 0  (for accounting, HR tables)
```

### ✅ End-to-End Testing
- ZAI Digital sees their data
- Lodiachi Enterprises sees only their data
- Financial metrics are different per business
- Employee counts are different per business
- Purchase order counts are different per business
- No data appears in common between businesses

### ✅ No Errors
- Browser console has no red error messages
- No SQL errors in Supabase logs
- Application loads quickly (<2 seconds per page)
- All CRUD operations work smoothly

---

## 📝 Checklist to Complete

- [ ] Read `MULTI-TENANT-STATUS-SUMMARY.md`
- [ ] Run browser console test with `QUICK-TEST-ISOLATION.js`
- [ ] Run database verification queries (all tables)
- [ ] Run data migration queries IF needed
- [ ] Complete Test Case 1 (Purchase Orders)
- [ ] Complete Test Case 2 (Financial Data)
- [ ] Complete Test Case 3 (HR & Employees)
- [ ] Complete Test Case 4 (Sales Data)
- [ ] Complete Test Case 5 (Inventory Data)
- [ ] Document all results in checklist
- [ ] Verify no console errors (F12)
- [ ] Clear cache and retest
- [ ] Get sign-off from business owner

---

## 🆘 Getting Help

### If Tests Pass
✅ **You're done!** System is properly multi-tenanted.

### If Tests Fail
1. **Which module is failing?** (Sales, Accounting, HR, Purchasing)
2. **What's the error message?** (Copy exact error from console)
3. **Which test case failed?** (Test 1-5)
4. **Check if data was migrated**: Re-run verification queries
5. **Check RPC functions deployed**: Go to Supabase SQL Editor → Functions
6. **Compare code with examples**: See `MULTI-TENANT-FIX-DEPLOYMENT-GUIDE.md`

### Common Error Solutions
| Error | Solution |
|-------|----------|
| "No branch context found" | User not logged in, logout and login again |
| "RPC function not found" | Deploy SQL file in Supabase SQL Editor |
| "Cannot apply branch filter" | Missing branch-context.js include tag in HTML |
| "Data still showing for both" | Clear browser cache with Ctrl+Shift+Delete |
| "Column business_id not found" | Re-run migration query for that table |

---

## 🔐 Security Notes

After multi-tenancy is verified:

1. **Data Isolation is Guaranteed** - Each business can ONLY see their own data
2. **No Additional Configuration Needed** - All filtering happens automatically
3. **Safe for Multiple Users** - Users from different businesses won't see each other's data
4. **Audit Trail Included** - All operations include business_id context

---

## 📅 Timeline

**Estimated Time Breakdown**:
- Step 0 (Read Status): 5 min
- Step 1 (Browser Test): 2 min
- Step 2 (DB Verification): 15 min
- Step 3 (Migration): 5 min (if needed)
- Step 4 (E2E Testing): 45 min
- **Total: 72 minutes** (1 hour 12 minutes)

**Best Practice**: 
- Do this testing in one sitting
- Don't interrupt between tests
- Clear cache once before starting all tests

---

## 📞 Support Contact

If you encounter issues that these docs don't cover:

1. **Check the comprehensive guide**: `MULTI-TENANT-FIX-DEPLOYMENT-GUIDE.md`
2. **Review error message carefully** - Look for table name, RPC function name, or column name
3. **Document the error** - Screenshot, exact error message, steps to reproduce
4. **Check if data migration completed** - Re-run verification queries
5. **Verify browser cache is cleared** - Ctrl+Shift+Delete then F5 refresh

---

**Last Updated**: 2026-04-28  
**Status**: Ready for Testing  
**Questions?**: Check the status summary or comprehensive guide first
