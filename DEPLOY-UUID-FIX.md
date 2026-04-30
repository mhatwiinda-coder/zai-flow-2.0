# ZAI FLOW 2.0 - UUID-INTEGER Type Mismatch Fix

## Problem Summary

The RPC functions were receiving Supabase Auth UUIDs from the frontend but the database `user_roles` table was storing INTEGER user IDs. This caused type mismatch errors:

```
ERROR: invalid input syntax for type integer: '99e39ddc-6f8a-4199-b74c-7fd8b44e1467'
```

## Root Cause

1. **Frontend sends**: Supabase Auth UUID (e.g., `99e39ddc-6f8a-4199-b74c-7fd8b44e1467`)
2. **RPC functions accept**: UUID parameter
3. **Database stores**: INTEGER user_id (from `users.id` which is SERIAL)
4. **Type mismatch**: UUID ≠ INTEGER

## Solution

Create a mapping function that converts Supabase Auth UUIDs to database INTEGER user_ids by:
1. Adding `auth_id` column to `users` table to store Supabase Auth UUID
2. Creating helper function `get_user_id_from_auth()` for UUID→INTEGER lookup
3. Updating all RPC functions to use the helper function
4. Populating `auth_id` by matching email addresses with `auth.users`

## Deployment Steps

### Step 1: Deploy the UUID Fix SQL

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Create a new query
3. Copy the entire contents of `FIX-UUID-INTEGER-MISMATCH.sql`
4. Paste into the SQL Editor
5. Click **Run**
6. Wait for all statements to complete successfully

**Expected Output:**
```
✅ ALTER TABLE users ADD COLUMN auth_id UUID UNIQUE;
✅ Function get_user_id_from_auth() created
✅ user_roles.user_id converted to INTEGER
✅ All RPC functions updated with UUID conversion
```

### Step 2: Populate Auth IDs

1. In the same SQL Editor
2. Create a new query
3. Copy the entire contents of `POPULATE-AUTH-IDS.sql`
4. Paste into the SQL Editor
5. Click **Run**

**Expected Output:**
```
UPDATE 4  ← or however many users have auth accounts
SELECT COUNT:
  user_id | name | email | auth_id | status
  1 | Admin User | admin@zai.com | [UUID] | OK
  2 | Supervisor | supervisor@zai.com | [UUID] | OK
  3 | Inventory Officer | inventory@zai.com | [UUID] | OK
  4 | Cashier One | cashier@zai.com | [UUID] | OK

COUNT: 4 total_role_assignments
```

### Step 3: Test the Frontend

1. Clear browser cache (Ctrl+Shift+Delete)
2. Go to your Netlify URL
3. Login with test credentials
4. Check browser console (F12 → Console)
5. Verify **no errors** about:
   - "operator does not exist"
   - "invalid input syntax for type integer"
   - Type mismatch errors

**Expected Console Output:**
```
✅ Supabase initialized: https://jzhwlablyxaeupvtpdce.supabase.co
✅ Login successful
✅ Modules loaded: [list of modules]
```

### Step 4: Verify Module Loading

1. After login, you should see the **Employee Landing** page
2. The sidebar should show available modules:
   - Dashboard
   - Sales
   - Inventory
   - Accounting
   - HR & Payroll
   - Purchasing
   - BI Analytics
3. Click each module to verify they load without errors

## What Changed

### New Files:
- `FIX-UUID-INTEGER-MISMATCH.sql` - Main fix script
- `POPULATE-AUTH-IDS.sql` - Auth ID population script
- `DEPLOY-UUID-FIX.md` - This guide

### Database Changes:
1. **users table**: Added `auth_id UUID UNIQUE` column
2. **user_roles table**: Changed `user_id` from UUID to INTEGER
3. **New function**: `get_user_id_from_auth(UUID) RETURNS INTEGER`
4. **RPC functions updated**:
   - `get_user_accessible_modules()` - Now converts UUID→INTEGER
   - `check_function_access()` - Now converts UUID→INTEGER
   - `check_action_access()` - Now converts UUID→INTEGER
   - `get_user_tasks()` - Fixed email type casting
   - `get_user_roles()` - Now converts UUID→INTEGER
   - `get_user_profile()` - New function for user info
   - `create_notification()` - Simplified UUID handling
   - `get_unread_notifications()` - Simplified UUID handling

## Troubleshooting

### Error: "Column 'auth_id' already exists"
- The `auth_id` column was already added
- Continue to Step 2 (POPULATE-AUTH-IDS.sql)
- This is safe to run again (uses `IF NOT EXISTS`)

### Error: "Function get_user_id_from_auth already exists"
- The function was already created
- This is safe - just means you're redeploying
- Continue with Step 2

### Still seeing module loading errors after deployment
1. **Clear browser cache**: Ctrl+Shift+Delete, reload page
2. **Check Supabase Auth**: Verify users exist in Supabase Auth table
3. **Check user_roles**: Verify records exist with INTEGER user_ids
4. **Check logs**: Go to Supabase → Edge Function Logs for errors

### Auth IDs not populated
If `POPULATE-AUTH-IDS.sql` shows "WARNING: No auth_id mapped", it means:
- User exists in database but not in Supabase Auth
- Users may have been created in database but not synced to Auth
- **Solution**: Create the users in Supabase Auth first, then run the population script again

## Rollback (If Needed)

If something goes wrong, you can restore the previous state:

```sql
-- Restore user_roles.user_id to UUID
ALTER TABLE public.user_roles
ALTER COLUMN user_id TYPE UUID USING user_id::UUID;

-- Drop the helper function
DROP FUNCTION IF EXISTS public.get_user_id_from_auth(UUID);

-- Restore RPC functions to previous versions
-- (Original versions are in supabase-role-permissions-functions.sql)
```

## Verification Checklist

- [ ] FIX-UUID-INTEGER-MISMATCH.sql deployed successfully
- [ ] POPULATE-AUTH-IDS.sql shows 4 users with auth_ids
- [ ] Browser console shows no type errors
- [ ] Login works and redirects to Employee Landing
- [ ] At least one module loads (e.g., Dashboard)
- [ ] Dashboard displays (no blank page)
- [ ] No "operator does not exist" errors
- [ ] No "invalid input syntax" errors

## Next Steps

After this fix is deployed:

1. ✅ **Module Loading** should now work (Salesup from blank page)
2. ✅ **User Tasks** should load in dashboard
3. ✅ **Notifications** should work
4. ✅ **Role-based Access** should function correctly

Then proceed with:
- Adding test data
- Configuring custom domain
- Setting up admin panel
- Testing all modules

## Support

If you encounter issues:
1. Check browser console (F12) for exact error messages
2. Run the verification query in POPULATE-AUTH-IDS.sql
3. Check Supabase SQL Editor logs for deployment errors
4. Ensure all statements in both SQL files completed without errors

---

**Deployment Date**: [When you deploy]
**Status**: Ready to deploy
