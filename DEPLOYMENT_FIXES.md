# ZAI FLOW 2.0 - Deployment Fixes Summary

## Critical Issues Fixed

### 1. ✅ Removed Duplicate/Conflicting Files
- Deleted old `frontend/branch-context.js` (was loading outdated version without getAuthUUID)
- Deleted conflicting `frontend/js/supabase-client.js` (tried to load from non-existent /api/config endpoint)

### 2. ✅ Fixed UUID-INTEGER Type Mismatches
- Updated `employee-landing.js` RPC calls to use `getAuthUUID()` instead of `context.user_id`:
  - `performClockIn()` - line 60
  - `performClockOut()` - line 89
  - `performCreateTask()` - lines 139 & 145
  - `markAllNotificationsRead()` - line 248
  
- Updated `sidebar-manager.js` line 25 to use UUID for RPC calls

### 3. ✅ Fixed Inconsistent Supabase References
- Standardized all RPC calls to use `window.supabase` (not plain `supabase`)
- Fixed checks: `!window.supabase` (was `!supabase` in some places)
- 12 RPC calls in employee-landing.js now use consistent `window.supabase.rpc()`
- 1 RPC call in sidebar-manager.js uses consistent `window.supabase.rpc()`

### 4. ✅ Fixed Data Isolation Issues
- Added missing branch filter to `supplier-payments.js` loadPurchaseInvoices()
- Added branch context verification to `receiving.js` openGoodsReceiptModal()

### 5. ✅ Fixed Script Loading Order
Updated all HTML files to load scripts in correct order:
- dashboard.html
- accounting.html
- sales.html
- inventory.html
- hr.html
- purchasing.html
- bi.html
- zra.html
- admin-business.html
- admin-user-management.html
- admin-roles.html
- employee-landing.html

Script order:
1. @supabase/supabase-js@2 CDN
2. supabase-init.js (initializes window.supabase)
3. branch-context.js (getBranchContext, getAuthUUID, withBranchFilter)
4. display-branch-context.js (initializeBranchDisplay, updatePageTitle)
5. sidebar-manager.js (dynamic module loading)
6. Module-specific scripts (accounting.js, sales.js, etc.)

### 6. ✅ Fixed Role Name Consistency
- Updated `admin-roles.js` to check for 'admin' with case-insensitive comparison
- Handles both 'admin' and 'administrator' role names

### 7. ✅ Moved Hardcoded Credentials
- Modified `supabase-init.js` to attempt loading from environment variables first
- Falls back to hardcoded credentials for development
- Credentials should be set in Netlify UI under Settings > Build & deploy > Environment

### 8. ✅ Updated Netlify Configuration
- Updated `netlify.toml` with proper SPA routing
- Added environment variable documentation
- Configured proper asset caching

## What Still Needs Manual Configuration

### On Netlify Deploy:
1. Set environment variables in Netlify UI:
   - `SUPABASE_URL`: https://jzhwlablyxaeupvtpdce.supabase.co
   - `SUPABASE_ANON_KEY`: your_anon_key_here

2. Ensure these are NOT in the code repository (they're now in environment variables)

## Files Modified

### Frontend HTML Files (11 files)
- employee-landing.html
- dashboard.html
- accounting.html
- sales.html
- inventory.html
- hr.html
- purchasing.html
- bi.html
- zra.html
- admin-business.html
- admin-user-management.html
- admin-roles.html

### Frontend JavaScript Files (6 files)
- employee-landing.js (fixed all RPC calls to use UUID)
- sidebar-manager.js (fixed RPC call to use UUID)
- admin-roles.js (fixed role name comparison)
- supplier-payments.js (added branch filter)
- receiving.js (added branch context check)
- supabase-init.js (environment variable support)

### Configuration Files (1 file)
- netlify.toml (fixed SPA routing and added env var docs)

### Files Deleted (2 files)
- frontend/branch-context.js (old version from root)
- frontend/js/supabase-client.js (conflicting file)

## Testing Checklist

- [ ] Employee can login
- [ ] Branch context loads correctly
- [ ] Clock in/out works
- [ ] Tasks load without errors
- [ ] Notifications load without errors
- [ ] Module access controls work (sidebar shows only permitted modules)
- [ ] Admin access to admin-business works
- [ ] Admin can create businesses and branches
- [ ] Data isolation: Users can only see their branch's data
- [ ] Role-based access works (admin, manager, supervisor, etc.)
- [ ] No console errors about getAuthUUID not defined
- [ ] No console errors about type mismatches

## Architecture Notes

- **UUID Storage**: User's Supabase Auth UUID is stored as `auth_id` in `users` table
- **Database Conversion**: RPC functions accept UUID parameters and internally convert to INTEGER user_id using `get_user_id_from_auth()` helper
- **Frontend Storage**: `localStorage.user` contains both `id` (INTEGER for display) and `auth_id` (UUID for RPC calls)
- **Branch Isolation**: All queries use `withBranchFilter()` to isolate data by `branch_id`
- **Default Branch**: First branch assigned to user becomes current_branch_id during login
