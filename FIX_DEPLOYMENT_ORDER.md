# HR Module Deployment - Correct Order

## Error You Saw
```
Failed to run sql query: ERROR: 42703: column e.branch_id does not exist
```

This error means the HR schema tables don't exist yet. You need to deploy them in the correct order.

---

## CORRECT DEPLOYMENT SEQUENCE

### Step 1: Deploy HR Schema (if not already done)
**File:** `supabase-schema-hr.sql`

This creates all the HR tables (employees, departments, payroll_runs, etc.)

1. Open Supabase Dashboard → SQL Editor
2. Copy entire contents of `supabase-schema-hr.sql`
3. Click Execute
4. **Wait for completion** - You should see many table creation confirmations

✅ **Expected Success:** All 9 HR tables created with proper columns and indexes

---

### Step 2: Deploy Multi-Tenant Fix
**File:** `supabase-hr-multi-tenant-fix.sql` (UPDATED VERSION)

This adds `business_id` column to HR tables and populates it.

1. Open Supabase Dashboard → SQL Editor
2. Copy entire contents of `supabase-hr-multi-tenant-fix.sql` (the updated version with DO blocks)
3. Click Execute
4. **Wait for completion** - You should see NOTICE messages about columns being added

✅ **Expected Success:** business_id columns added to 5 tables

---

### Step 3: Deploy Business-Scoped RPC Functions
**File:** `supabase-hr-functions-business-scoped.sql`

These are the RPC functions that filter by business_id.

1. Open Supabase Dashboard → SQL Editor
2. Copy entire contents of `supabase-hr-functions-business-scoped.sql`
3. Click Execute
4. **Wait for completion** - You should see 6 function creation confirmations

✅ **Expected Success:** All 6 RPC functions created

---

## Verification Query (Optional)

After all 3 files are deployed, run this in Supabase SQL Editor to verify:

```sql
-- Check if business_id column exists in employees
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'employees' AND column_name = 'business_id';

-- Should return: business_id | integer
```

---

## If Still Getting Errors

### Error: "employees table does not exist"
→ You haven't run `supabase-schema-hr.sql` yet. Run it first!

### Error: "column employees.branch_id does not exist"  
→ The HR schema table structure changed. Delete and re-create HR tables by running `supabase-schema-hr.sql`

### Error: "column employees.business_id does not exist" when testing RPC
→ Re-run `supabase-hr-multi-tenant-fix.sql` to add the column

---

## Next Steps After Deployment

1. **Verify RPC Works:**
   ```sql
   -- Test the RPC function
   SELECT * FROM public.get_business_employees(1);
   ```
   
2. **Check Frontend Configuration:**
   - Ensure `hr.js` is updated with business_id filtering
   - Check browser console for debug messages

3. **Test with User:**
   - Have user logout and login again
   - Check if modules now appear correctly

---

## Quick Troubleshooting Checklist

- [ ] supabase-schema-hr.sql deployed successfully
- [ ] supabase-hr-multi-tenant-fix.sql deployed without errors
- [ ] supabase-hr-functions-business-scoped.sql deployed without errors
- [ ] get_business_employees() RPC returns results
- [ ] User re-logged in (to refresh context from backend)
- [ ] Browser console shows "✅ Loaded X employees" messages
- [ ] HR module shows employees from correct business only
