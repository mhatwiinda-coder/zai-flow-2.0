# ⚡ Quick Deploy Reference - UUID Fix

## Files to Deploy (in order)

### 1️⃣ FIX-UUID-INTEGER-MISMATCH.sql
**What it does**: Fixes all RPC function type mismatches
- Adds `auth_id` column to users table
- Creates helper function `get_user_id_from_auth()`
- Converts `user_roles.user_id` from UUID to INTEGER
- Updates 8 RPC functions for proper UUID-to-INTEGER conversion

**Deployment**: 
- Supabase → SQL Editor
- Copy entire file
- Run

### 2️⃣ POPULATE-AUTH-IDS.sql
**What it does**: Maps Supabase Auth UUIDs to database user records
- Updates users table auth_id column
- Verifies mapping success
- Shows any unmapped users (would need manual fix)

**Deployment**:
- Supabase → SQL Editor
- Copy entire file
- Run

### 3️⃣ Test in Frontend
**After deployment**:
1. Clear browser cache: `Ctrl+Shift+Delete`
2. Go to Netlify URL
3. Login with test credentials
4. Check console (F12): Should have NO errors
5. You should see Employee Landing page with modules

---

## Expected Results

### ✅ After Step 1 & 2:
- auth_id column added to users
- Helper function created
- user_roles.user_id is now INTEGER
- All RPC functions updated
- Auth IDs populated from Supabase Auth

### ✅ After Frontend Test:
- Login works
- No type mismatch errors
- Modules load in sidebar
- Dashboard accessible
- No "operator does not exist" errors

---

## Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| "Column auth_id already exists" | Safe to ignore, means re-deploying. Continue to next script. |
| "Function get_user_id_from_auth already exists" | Safe to ignore, means re-deploying. Continue to next script. |
| Still seeing module errors | Clear cache, reload page |
| "No auth_id mapped" warning | Check that users exist in Supabase Auth table |
| Blank page after login | Check console for errors, verify user_roles populated |

---

## Verification Commands (Run in Supabase SQL Editor)

```sql
-- Check auth_id population
SELECT id, name, email, auth_id FROM public.users;

-- Check user_roles data
SELECT COUNT(*) FROM public.user_roles;

-- Check specific user's roles
SELECT ur.user_id, r.code, r.name
FROM public.user_roles ur
JOIN public.roles r ON ur.role_id = r.id
WHERE ur.business_id = 1;
```

---

## Rollback (If Needed)

If you need to undo these changes:

```sql
-- Drop the helper function
DROP FUNCTION IF EXISTS public.get_user_id_from_auth(UUID);

-- Restore original RPC functions
-- (Re-run supabase-role-permissions-functions.sql)
```

---

## Performance Impact

- **No significant impact**
- Helper function is minimal (simple UUID→INTEGER lookup)
- All operations use indexed columns
- No changes to data structure (just column type change)

---

## Timeline

- **Step 1**: 2-3 minutes
- **Step 2**: 1 minute
- **Test**: 5 minutes
- **Total**: ~10 minutes

---

## Success Checklist

- [ ] FIX-UUID-INTEGER-MISMATCH.sql deployed
- [ ] No errors in SQL deployment
- [ ] POPULATE-AUTH-IDS.sql deployed
- [ ] All users show auth_id in verification query
- [ ] Browser cache cleared
- [ ] Can login to app
- [ ] No console errors
- [ ] Dashboard visible
- [ ] Modules list populates in sidebar

---

## Next Steps After Success

1. ✅ Add test data (businesses, employees)
2. ✅ Test each module
3. ✅ Set up custom domain
4. ✅ Configure admin panel
5. ✅ Share demo link

---

**Ready to deploy?** → Start with FIX-UUID-INTEGER-MISMATCH.sql
