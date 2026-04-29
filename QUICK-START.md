# 🚀 ZAI FLOW 2.0 - Quick Start Guide

## System Status: ✅ FULLY OPERATIONAL

All systems are tested and ready to use. Here's how to get started:

---

## 1. Start the Server

The server should be running on port 5000. If not:

```bash
cd "D:\mainza\ZAI FLOW 2.0"
npm start
```

**Expected Output:**
```
✅ Server ready to serve frontend (Supabase-native mode)
🚀 ZAI Flow running on http://localhost:5000
```

---

## 2. Access the Login Page

Open your browser and navigate to:
```
http://localhost:5000/login.html
```

---

## 3. Login with These Credentials

### Admin User (Full Access)
```
Email: admin@lodiachi-enterprises-ltd.local
Password: Admin@0006
```

**What you'll see:**
- All 16 ERP modules
- Employee dashboard with full functionality
- Role management access
- All user permissions

---

## 4. Employee Landing Page

After login, you'll be redirected to the **Employee Landing Dashboard** which shows:

### 🎯 Welcome Section
- User name and title
- Business and branch information
- Current role

### ⏰ Clock In/Out Widget
- Current time display
- Clock in/out buttons
- Elapsed time tracker
- Status indicator

### 📋 Task Management
- View all tasks assigned to you
- Create new tasks
- Update task status (TODO → IN PROGRESS → COMPLETED)
- Delete tasks with confirmation
- Filter by status

### 🔔 Notifications
- View unread notifications
- Mark individual notifications as read
- Mark all as read
- Notification count badge

### 📊 Personal Metrics
- Today's clock status
- Total task count
- Unread notification count
- Accessible modules count

### 🔗 Module Quick Links
- All accessible modules displayed with icons
- Click to navigate to that module
- Only shows modules based on your role
- Organized by module type

---

## 5. Key Features to Test

### Clock In/Out
1. Click the **"Clock In"** button
2. Modal will show confirmation
3. Click "Confirm" to clock in
4. Timer will start showing elapsed time
5. Click **"Clock Out"** to end your shift

### Task Management
1. Click **"New Task"** button
2. Fill in: Title, Description, Due Date, Priority
3. Click "Create Task"
4. Task appears in the task list
5. Click task status buttons to change status
6. Click delete button to remove task

### Notifications
1. Check notification count in Personal Metrics
2. Unread notifications appear in "Notifications" section
3. Click notification to view full details
4. Click "Mark as Read" to dismiss
5. Click "Mark All As Read" to clear all

### Module Access
1. Scroll to "Module Quick Links" section
2. See 16 modules available for admin role
3. Click any module icon to navigate
4. Module should load in new tab/page

---

## 6. Test Different User Roles

Switch users to see different access levels:

### Admin (Currently Logged In)
- **Credentials:** admin@lodiachi-enterprises-ltd.local / Admin@0006
- **Modules:** All 16 modules
- **Permissions:** Full system access
- **Can:** Manage roles, view all data, run payroll

### Supervisor
- **Email:** supervisor@zai.com
- **Modules:** Dashboard, Sales, Inventory
- **Permissions:** Operate and read data
- **Can:** Process sales, manage inventory

### Inventory Staff
- **Email:** inventory@zai.com
- **Modules:** Dashboard, Inventory only
- **Permissions:** Inventory operations
- **Can:** Manage stock and inventory

### Cashier
- **Email:** cashier@zai.com
- **Modules:** Dashboard, Sales (POS only)
- **Permissions:** Process sales transactions
- **Can:** Ring up sales

---

## 7. What's Working Now

✅ **Complete Workflow:**
- Login with secure UUID conversion
- Multi-tenant business isolation
- Role-based module access
- Employee dashboard with all widgets
- Clock in/out functionality
- Task management CRUD
- Notification system
- Real-time attendance tracking

✅ **Database Layer:**
- 9 tables fully functional
- 15 RPC functions deployed and tested
- Type safety verified
- Performance optimized

✅ **Frontend:**
- Employee landing page with responsive design
- Admin role management interface
- Branch context management
- Proper error handling
- Real-time data updates

---

## 8. Troubleshooting

### "Can't reach server"
```
✓ Verify server is running: npm start
✓ Check port 5000 is available
✓ Check firewall settings
```

### "Login fails"
```
✓ Verify email and password are exact (case-sensitive)
✓ Check user exists in database
✓ Verify PostgreSQL connection (check .env)
```

### "No modules showing"
```
✓ Verify user has role assignment
✓ Check role_functions table has entries
✓ Verify role has associated functions
```

### "Clock in returns error"
```
✓ This is normal if you already clocked in today
✓ Clock out first, then clock in again
✓ Time resets at midnight
```

### "Tasks/Notifications not showing"
```
✓ Verify data was created (check database)
✓ Refresh the page
✓ Clear browser cache (Ctrl+Shift+Delete)
✓ Check browser console for errors (F12)
```

---

## 9. Browser Developer Tools

To debug any issues, use your browser's developer tools:

**Open with:** F12 or Ctrl+Shift+I

**Check:**
1. **Console Tab** - Look for JavaScript errors (red messages)
2. **Network Tab** - Monitor API calls to /api/login and RPC functions
3. **Application Tab** - Verify localStorage contains user data
4. **Storage → localStorage** - View stored user context

**Common Debug Steps:**
```javascript
// In console, check if user is stored:
localStorage.getItem('user')

// Check branch context:
getBranchContext()

// Test RPC function:
window.supabase.rpc('get_unread_notifications', {
  p_user_id: '00000000-0000-0000-0000-000000000148',
  p_business_id: 6
})
```

---

## 10. Test Data

### Pre-Configured Test Users
| Email | Password | Role | Business | Branch |
|-------|----------|------|----------|--------|
| admin@lodiachi-enterprises-ltd.local | Admin@0006 | Admin | LODIACHI ENTERPRISES | Main Branch |
| supervisor@zai.com | [Check DB] | Supervisor | ZAI | Main |
| inventory@zai.com | [Check DB] | Inventory | ZAI | Main |
| cashier@zai.com | [Check DB] | Cashier | ZAI | Main |

### Sample Data
- ✅ 1 unread notification (Welcome message)
- ✅ 1 task (Review System Configuration - HIGH priority)
- ✅ 1 clock in today (for admin user)
- ✅ 16 modules available
- ✅ 1 role (Administrator)

---

## 11. Next Steps

### For Development:
1. Review code in `/frontend/js/employee-landing.js`
2. Add more test users as needed
3. Customize styling in `/frontend/style.css`
4. Add additional modules by updating database

### For Deployment:
1. Review security settings (currently basic auth)
2. Implement JWT tokens for session management
3. Hash passwords with bcrypt
4. Enable RLS policies on all tables
5. Set up SSL/TLS certificates
6. Configure production database connection

### For Features:
1. Add more RPC functions as needed
2. Create additional modules (Finance, HR, etc.)
3. Implement dashboard analytics
4. Add export/reporting features
5. Build mobile app

---

## 12. Key Files Reference

| File | Purpose |
|------|---------|
| `server.js` | Express backend, login endpoint |
| `/frontend/employee-landing.html` | Main dashboard UI |
| `/frontend/js/employee-landing.js` | Dashboard functionality |
| `/frontend/branch-context.js` | User context management |
| `/frontend/js/auth.js` | Authentication & redirects |
| `supabase-role-permissions-schema.sql` | Database tables |
| `supabase-role-permissions-functions.sql` | RPC functions |

---

## 13. Support

**Having issues?**
1. Check the SYSTEM-VERIFICATION-REPORT.md for detailed troubleshooting
2. Review browser console for error messages (F12)
3. Check database directly in Supabase dashboard
4. Verify .env file has correct credentials

**Need to modify something?**
1. Update database tables in Supabase SQL Editor
2. Update RPC functions with new business logic
3. Update frontend HTML/JavaScript
4. Clear browser cache and refresh

---

## 🎉 You're Ready!

The system is fully operational. Login and start exploring the employee landing page!

**URL:** http://localhost:5000/login.html

---

**Last Updated:** April 28, 2026  
**System Status:** ✅ Operational  
**Build:** 2.0 RBAC Complete
