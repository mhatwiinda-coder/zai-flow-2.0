# ⚡ QUICK START - RBAC DEPLOYMENT (60 MINUTES)

**Start Time**: [Write time here]  
**Target Completion**: [Add 60 minutes]  
**Demo Time**: Tonight! 🎉

---

## 📋 IMMEDIATE ACTION ITEMS (Do These NOW)

### ✅ STEP 1: Deploy Database (10 minutes)

- [ ] Open https://app.supabase.com
- [ ] Go to your project
- [ ] Click **SQL Editor**
- [ ] **COPY ALL TEXT** from: `supabase-role-permissions-schema.sql`
- [ ] Paste into SQL Editor
- [ ] Click **RUN** (wait for ✅ success)
- [ ] **COPY ALL TEXT** from: `supabase-role-permissions-functions.sql`
- [ ] Paste into SQL Editor  
- [ ] Click **RUN** (wait for ✅ success)
- [ ] Verify in SQL Editor:
  ```sql
  SELECT COUNT(*) FROM public.roles;
  -- Should return: 8
  ```

**Status**: ⏱️ _____ min | ✅ / ❌

---

### ✅ STEP 2: Update Login Page (5 minutes)

- [ ] Open `frontend/login.html` (or wherever login success happens)
- [ ] Find the line with: `window.location.href = 'dashboard.html'`
- [ ] Replace with: `window.location.href = 'employee-landing.html'`
- [ ] **Save file**

**Status**: ⏱️ _____ min | ✅ / ❌

---

### ✅ STEP 3: Update Navigation (10 minutes)

**For EACH HTML file** (dashboard.html, sales.html, inventory.html, accounting.html, hr.html, purchasing.html, bi.html):

- [ ] Find the `<nav>` or navigation section
- [ ] Replace static links with dynamic loading (see RBAC-DEPLOYMENT-GUIDE.md Step 3)
- [ ] Add script that calls `get_user_accessible_modules()` RPC
- [ ] Save file

**Files to Update**:
- [ ] dashboard.html
- [ ] sales.html
- [ ] inventory.html
- [ ] accounting.html
- [ ] hr.html (if exists)
- [ ] purchasing.html
- [ ] bi.html

**Status**: ⏱️ _____ min | ✅ / ❌

---

### ✅ STEP 4: Add Permission Checks (15 minutes)

**Focus on these critical modules first**:

**Sales Module** (sales.html):
- [ ] Find "Create Sale" button
- [ ] Add permission check: `check_action_access('sales_pos', 'create')`
- [ ] Hide button if no permission

**Inventory Module** (inventory.html):
- [ ] Find "Create Product" button
- [ ] Add permission check: `check_action_access('inventory_products', 'create')`

**Accounting Module** (accounting.html):
- [ ] Find "Create Journal Entry" button
- [ ] Add permission check: `check_action_access('accounting_journal', 'create')`

**Purchasing Module** (purchasing.html):
- [ ] Find "Create PO" button
- [ ] Add permission check: `check_action_access('purchasing_po', 'create')`

See RBAC-DEPLOYMENT-GUIDE.md Step 4 for exact code.

**Status**: ⏱️ _____ min | ✅ / ❌

---

### ✅ STEP 5: Assign Initial Roles (5 minutes)

In **Supabase SQL Editor**:

- [ ] Run this query to find your user ID:
  ```sql
  SELECT id, email FROM auth.users LIMIT 5;
  ```
- [ ] Copy the user_id of your main admin account
- [ ] Find admin role ID:
  ```sql
  SELECT id, code, name FROM public.roles WHERE code = 'admin';
  ```
- [ ] Insert role assignment:
  ```sql
  INSERT INTO public.user_roles (user_id, business_id, role_id, assigned_by)
  VALUES ('YOUR-USER-ID-HERE', 1, 1, 'YOUR-USER-ID-HERE')
  ON CONFLICT DO NOTHING;
  ```
- [ ] Verify it worked:
  ```sql
  SELECT * FROM public.user_roles WHERE user_id = 'YOUR-USER-ID-HERE';
  ```

**Status**: ⏱️ _____ min | ✅ / ❌

---

### ✅ STEP 6: Test System (15 minutes)

#### Test 6a: Login & Employee Dashboard
- [ ] Clear browser cache (Ctrl+Shift+Delete)
- [ ] Close all browser tabs
- [ ] Go to login page
- [ ] Login as your main user
- [ ] **Verify**: Lands on employee-landing.html
- [ ] **Verify**: Clock display shows current time
- [ ] Click "Clock In" button
- [ ] **Verify**: Modal appears with time
- [ ] Click "Clock In" in modal
- [ ] **Verify**: Success message appears
- [ ] **Verify**: Button changes to "Clock Out"

**Status**: ⏱️ _____ min | ✅ / ❌

#### Test 6b: Create Task
- [ ] Click "New Task" button
- [ ] Enter: Title = "Test Task"
- [ ] Set Priority = "URGENT"
- [ ] Click "Create Task"
- [ ] **Verify**: Success message appears
- [ ] **Verify**: Task appears in "To Do" tab

**Status**: ⏱️ _____ min | ✅ / ❌

#### Test 6c: Admin Panel
- [ ] Navigate to `http://your-domain/admin-roles.html`
- [ ] **Verify**: Page loads (not 403 error)
- [ ] **Verify**: See "Users & Roles" tab
- [ ] **Verify**: See user listed in table
- [ ] Click "👥 Users & Roles" tab
- [ ] **Verify**: Can see role assignments

**Status**: ⏱️ _____ min | ✅ / ❌

#### Test 6d: Assign Role to New User
- [ ] In admin panel, find "Quick Role Assignment" section
- [ ] Select a test user
- [ ] Select a role (e.g., "Cashier")
- [ ] Click "Assign Role"
- [ ] **Verify**: Success message
- [ ] Refresh page
- [ ] **Verify**: Role now shows for user in table

**Status**: ⏱️ _____ min | ✅ / ❌

#### Test 6e: Multi-Tenant Isolation
- [ ] Logout completely
- [ ] Clear cache (Ctrl+Shift+Delete)
- [ ] Login as User A (Business 1)
- [ ] Note the tasks shown
- [ ] Logout completely
- [ ] Login as User B (Business 2 - different business)
- [ ] **Verify**: COMPLETELY different tasks appear
- [ ] **Verify**: ZERO overlap with User A's data

**Status**: ⏱️ _____ min | ✅ / ❌

---

## 🎯 FINAL VERIFICATION (Before Demo)

- [ ] All 9 database tables exist (check Supabase Tables view)
- [ ] All 15 RPC functions exist (check Supabase Functions)
- [ ] Employee landing page loads instantly (<2 seconds)
- [ ] Admin panel loads instantly (<2 seconds)
- [ ] Browser console has NO red errors (F12)
- [ ] Clock in/out works and shows elapsed time
- [ ] Tasks save and update status
- [ ] Admin can assign roles
- [ ] Role assignment immediately works
- [ ] Module access changes based on role
- [ ] Different businesses see completely different data

---

## ⏰ TIME TRACKING

| Step | Est. Time | Actual Time | Status |
|------|-----------|-------------|--------|
| 1. Deploy SQL | 10 min | _____ | ⏱️ |
| 2. Update Login | 5 min | _____ | ⏱️ |
| 3. Update Nav | 10 min | _____ | ⏱️ |
| 4. Permission Checks | 15 min | _____ | ⏱️ |
| 5. Assign Roles | 5 min | _____ | ⏱️ |
| 6. Testing | 15 min | _____ | ⏱️ |
| **TOTAL** | **60 min** | **_____ min** | ✅ |

---

## 🚨 IF SOMETHING BREAKS

**Error**: "RPC function not found"
→ SQL files didn't deploy. Go back to Step 1, verify both files ran.

**Error**: "Cannot apply branch filter"  
→ branch-context.js not included. Add `<script src="branch-context.js"></script>` to HTML.

**Error**: "No branch context"
→ User not logged in. Logout, clear cache, login again.

**Error**: Admin panel shows "Loading..."
→ RPC functions not working. Check Supabase SQL Editor - Functions tab.

**Error**: Clock in didn't save
→ Check Supabase table `employee_attendance` - verify it exists and has records.

**For other errors**: 
→ Read RBAC-DEPLOYMENT-GUIDE.md "Troubleshooting" section

---

## 🎉 READY FOR DEMO!

Once all ✅ checks pass:

1. **Pre-Demo Setup** (5 min before)
   - Logout
   - Clear cache
   - Refresh page
   - Login fresh as admin

2. **Demo Flow** (5 minutes)
   - Show employee dashboard with clock in/out
   - Show admin panel with user role assignments
   - Assign a new role to a test user
   - Show permissions matrix
   - Highlight: "Zero hardcoding, fully automatic"

3. **Key Talking Points**
   - "Complete role-based access control system"
   - "Multi-tenant data isolation verified"
   - "Supports unlimited role combinations"
   - "Real-time permission updates"
   - "Attendance tracking built-in"
   - "Task management for all users"

---

**Good Luck! 🚀 You've got this!**

---

**Questions During Deployment?**
→ Refer to: RBAC-DEPLOYMENT-GUIDE.md (detailed step-by-step)
→ Or check: RBAC-IMPLEMENTATION-COMPLETE.md (architecture overview)
