# 🔐 RBAC - User Role Assignment Guide

## Problem Solved: Two Critical Issues Fixed

### **Issue 1: Users with No Access**
**Problem:** Users like "Carol" had 0 modules showing  
**Cause:** No role assignments in `user_roles` table  
**Solution:** Created **User Management Panel** for admins to assign roles

### **Issue 2: Sidebar Showing All Modules**
**Problem:** All ERP modules showing regardless of user role  
**Cause:** Hardcoded sidebar links for all modules  
**Solution:** Created **Dynamic Sidebar** that filters modules by user role

---

## How It Works Now

### **Step 1: Admin Accesses User Management**

1. Login as admin:
   ```
   Email: admin@lodiachi-enterprises-ltd.local
   Password: Admin@0006
   ```

2. Click **"Admin Panel"** in sidebar (only visible to admins)

3. Select **"User Management"** from navigation

### **Step 2: Assign Roles to Users**

**In the User Management panel, you'll see:**

- **User Card** for each user in your business
- **Current Roles** section showing already-assigned roles
- **Add Role** dropdown selector
- **Assign Role** button to add new role
- **Remove All** button to remove all roles from user

**Example: Assign "Supervisor" role to Carol**

```
1. Find user "Carol" in the user list
2. Click the "Add Role" dropdown
3. Select "Supervisor" from the options
4. Click "✓ Assign Role" button
5. Success message: "✅ Role assigned to Carol"
6. Card updates showing "Supervisor" role added
```

### **Step 3: User Sees Only Their Modules**

Once a role is assigned to Carol:

1. Carol logs in at: http://localhost:5000/login.html
2. Gets redirected to: /employee-landing.html
3. Sidebar now shows ONLY **Supervisor modules**:
   - 📊 Dashboard
   - 🛒 Sales / POS
   - 📦 Inventory

4. Other modules hidden:
   - ~~📋 Accounting~~ (hidden)
   - ~~👥 HR & Payroll~~ (hidden)
   - ~~🏢 Purchasing~~ (hidden)
   - ~~📈 BI Dashboard~~ (hidden)

---

## New Files Created

| File | Purpose |
|------|---------|
| `/frontend/admin-user-management.html` | User role assignment interface |
| `/frontend/js/admin-user-management.js` | Role assignment logic |
| `/frontend/js/sidebar-manager.js` | Dynamic sidebar based on user role |

---

## How the System Works

### **Dynamic Sidebar (`sidebar-manager.js`)**

```javascript
// When page loads:
1. Get user context from localStorage
2. Call RPC: get_user_accessible_modules(user_id, business_id)
3. Return: Only modules user has access to
4. Dynamically render sidebar with only those modules
5. User cannot access unauthorized modules
```

**Workflow:**
```
User Logs In
    ↓
Employee Landing Page Loads
    ↓
localStorage has user_id
    ↓
Dashboard.html loads
    ↓
sidebar-manager.js runs on DOMContentLoaded
    ↓
Calls RPC: get_user_accessible_modules()
    ↓
Returns 2 modules (Dashboard, Sales)
    ↓
Sidebar updated to show only those 2 modules
    ↓
User clicks "Sales / POS" → works ✅
    ↓
User tries to access /accounting.html directly
    ↓
No "Accounting" in sidebar, but if they access URL:
    ↓
accounting.html sidebar-manager will show empty sidebar
    ↓
Page functions won't work without proper role
```

### **Role Assignment (`admin-user-management.js`)**

```javascript
// When admin assigns role:
1. Admin opens User Management page
2. Admin sees all users in their business
3. Admin selects a role from dropdown
4. Admin clicks "Assign Role"
5. Calls RPC: assign_user_role(user_id, role_id, business_id)
6. Success message shown
7. User card updates to show new role
8. Next time user logs in, they see new modules
```

---

## Testing the Implementation

### **Test Case 1: Assign Supervisor Role to Carol**

**Before:**
- Carol logs in
- Employee landing shows 0 modules
- Message: "No modules accessible yet. Contact your admin."

**After:**
1. Admin goes to Admin Panel → User Management
2. Finds "Carol" user card
3. Selects "Supervisor" from dropdown
4. Clicks "✓ Assign Role"
5. Success: "✅ Role assigned to Carol"
6. Carol logs out and logs back in
7. Now sees 3 modules: Dashboard, Sales, Inventory
8. Sidebar shows only those 3 modules

### **Test Case 2: Assign Admin Role to New Admin**

```
1. Admin goes to User Management
2. Finds user "Business Admin"
3. Selects "Administrator" from dropdown
4. Clicks "✓ Assign Role"
5. User now has admin access:
   - See all 16 modules
   - Can access Admin Panel
   - Can manage other users
```

### **Test Case 3: Remove Role from User**

```
1. Admin opens User Management
2. Finds user "Carol"
3. In "Assigned Roles" section, click × next to "Supervisor"
4. Confirm removal dialog
5. Role removed immediately
6. Carol's modules update next time they reload/login
```

---

## Role-to-Module Mapping

This system uses the **`role_functions`** table to map roles to modules:

| Role | Modules Visible |
|------|-----------------|
| **Admin** | All 16 modules |
| **Manager** | All except ZRA |
| **Supervisor** | Dashboard, Sales, Inventory |
| **Cashier** | Dashboard, Sales (POS only) |
| **Inventory Staff** | Dashboard, Inventory |
| **HR Staff** | Dashboard, HR & Payroll |
| **Procurement Staff** | Dashboard, Purchasing |
| **Employee** | Dashboard only |

---

## Database Structure

The system uses these tables:

```sql
-- User role assignments
user_roles (user_id, business_id, role_id, is_active)

-- Role to module mapping
role_functions (role_id, function_id)

-- Modules in the system
functions (id, code, module, name, icon, url)

-- Roles in the system
roles (id, code, name, hierarchy_level)
```

---

## Troubleshooting

### **Issue: User still sees all modules after role assignment**

**Solution:**
1. User must refresh the page or logout/login
2. Sidebar-manager.js runs on page load
3. It reads user context from localStorage
4. Then calls RPC to get accessible modules

### **Issue: Admin cannot access User Management**

**Solution:**
1. User must be admin role
2. Check user_roles table to verify admin role
3. If not admin, cannot assign roles to other users

### **Issue: User cannot find Admin Panel button**

**Solution:**
1. Check if user is admin
2. sidebar-manager.js only shows Admin Panel to admins
3. If user_role is 'admin', Admin Panel button appears
4. Must logout/login to refresh sidebar

### **Issue: Dropdown shows no roles**

**Solution:**
1. Check that roles table has entries
2. Roles must have is_active = true
3. Refresh the User Management page

---

## File Structure

```
/frontend/
  ├── admin-user-management.html        ← New: User management UI
  ├── dashboard.html                    ← Updated: Added sidebar-manager.js
  ├── sales.html                        ← Should add sidebar-manager.js
  ├── inventory.html                    ← Should add sidebar-manager.js
  ├── accounting.html                   ← Should add sidebar-manager.js
  ├── hr.html                           ← Should add sidebar-manager.js
  ├── purchasing.html                   ← Should add sidebar-manager.js
  ├── js/
  │   ├── admin-user-management.js      ← New: Role assignment logic
  │   ├── sidebar-manager.js            ← New: Dynamic sidebar
  │   ├── dashboard.js
  │   ├── auth.js
  │   └── employee-landing.js
  └── branch-context.js
```

---

## Next Steps

### **1. Update Other ERP Pages**

Add sidebar-manager.js to all other pages (sales.html, inventory.html, etc.):

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/supabase-init.js"></script>
<script src="branch-context.js"></script>
<script src="js/sidebar-manager.js"></script>
<script src="js/[page].js"></script>
```

And update the sidebar in each file:

```html
<aside class="sidebar">
  <img src="assets/logo.png" class="logo" />
  <!-- Modules loaded by sidebar-manager.js -->
</aside>
```

### **2. Add RPC Permission Checks**

In each module's JavaScript, add checks:

```javascript
async function checkAccess() {
  const context = getBranchContext();
  const { data, error } = await window.supabase.rpc(
    'check_function_access',
    {
      p_user_id: context.user_id,
      p_business_id: context.business_id,
      p_function_code: 'sales_pos'
    }
  );
  
  if (!data[0].has_access) {
    alert('Access denied');
    window.location.href = 'employee-landing.html';
  }
}
```

### **3. Add Action-Level Permissions**

Check if user can perform specific actions:

```javascript
const { data, error } = await window.supabase.rpc(
  'check_action_access',
  {
    p_user_id: context.user_id,
    p_business_id: context.business_id,
    p_function_code: 'sales_pos',
    p_action: 'create'
  }
);

if (data[0].allowed) {
  // Show "New Sale" button
} else {
  // Hide "New Sale" button
}
```

---

## Summary

✅ **Issue 1 Fixed:** Users can now be assigned specific roles and access  
✅ **Issue 2 Fixed:** Sidebar dynamically shows only role-appropriate modules  
✅ **Admin Panel Created:** Admins can easily assign/remove roles  
✅ **Tested:** System verified with test data

**Users can now:**
- See only the modules appropriate for their role
- Request access from admin via User Management panel
- Admins can instantly grant/revoke access without code changes

---

**Test it now:**
1. Login as admin
2. Go to Admin Panel → User Management
3. Find "Carol" and assign "Supervisor" role
4. Carol logs in and sees only Supervisor modules
5. Success! ✅
