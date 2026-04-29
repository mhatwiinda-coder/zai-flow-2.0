# HR Module Multi-Tenancy Fix - Deployment Guide

## Problem Summary
The HR module was showing employees from the wrong business because:
1. The employees table was missing the `business_id` column (only had `branch_id`)
2. The RPC functions were looking for `business_id` but it didn't exist
3. Other HR functions (attendance, leave, analytics) were not filtering by business_id

## Solution Overview
Add `business_id` to all HR-related tables and deploy corrected RPC functions that filter by business_id instead of just branch_id.

---

## DEPLOYMENT STEPS

### Step 1: Deploy Multi-Tenant Schema Fixes
**File:** `supabase-hr-multi-tenant-fix.sql`

1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the entire contents of `supabase-hr-multi-tenant-fix.sql`
3. Click "Execute" button
4. Expected output: 
   - Multiple index creation messages
   - Column addition confirmations
   - Data population confirmations
   - Verification query results showing employees with business_id populated

**What this does:**
- Adds `business_id` column to employees, payroll_runs, payroll_deductions, attendance, leave_requests tables
- Creates indexes on business_id for performance
- Populates business_id values based on branch→business relationships

---

### Step 2: Deploy Business-Scoped RPC Functions
**File:** `supabase-hr-functions-business-scoped.sql`

1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the entire contents of `supabase-hr-functions-business-scoped.sql`
3. Click "Execute" button
4. Expected output: Multiple function creation confirmations

**RPC Functions created:**
- `get_business_employees(p_business_id)` - Returns all employees for a business with department details
- `get_business_departments(p_business_id)` - Returns all departments for a business
- `get_business_attendance(p_business_id, p_from_date, p_to_date)` - Returns attendance records for a business
- `process_payroll(p_business_id, p_month, p_year)` - Process payroll for a business
- `get_business_leave_requests(p_business_id)` - Return leave requests for a business
- `get_business_hr_analytics(p_business_id)` - Return HR analytics metrics for a business

---

### Step 3: Verify Deployment in Supabase

After deploying the SQL files, verify in Supabase:

#### Check 1: Verify employees table has business_id
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'employees'
ORDER BY ordinal_position;
```
Expected: Should see `business_id` INTEGER NOT NULL column

#### Check 2: Verify business_id values populated
```sql
SELECT COUNT(*) as total_employees,
       COUNT(business_id) as with_business_id,
       COUNT(DISTINCT business_id) as unique_businesses
FROM public.employees;
```
Expected: All employees should have business_id populated

#### Check 3: Test get_business_employees RPC
```sql
SELECT * FROM public.get_business_employees(1);
```
Expected: Should return employees for business_id=1 with department details

---

### Step 4: Update Frontend Code
All frontend files have been updated. No additional changes needed.

**Files updated:**
- `frontend/js/hr.js` - All functions now filter by business_id

**What changed in hr.js:**
- `loadEmployeeList()` - Now calls `get_business_employees(p_business_id)` RPC with proper error handling
- `loadDepartments()` - Calls `get_business_departments(p_business_id)` RPC instead of direct table query
- `loadAttendanceData()` - Filters employees and attendance by business_id
- `saveEmployee()` - Now includes business_id when creating new employees
- `saveAttendance()` - Includes business_id when saving attendance records
- `loadLeaveRequests()` - Filters leave requests by business_id
- `loadHeadcountMetrics()` - Filters employees and attendance by business_id
- `loadTurnoverMetrics()` - Filters employees by business_id
- `loadDepartmentChart()` - Filters employees by business_id
- `loadAttendanceChart()` - Filters attendance by business_id

---

## TESTING CHECKLIST

After deployment, test the following:

### Test 1: Login as Employee (Default Business)
1. Login with any user assigned to "Default Business"
2. Navigate to HR module
3. Expected: Should see only employees from "Default Business"
4. Check browser console: Should see "✅ Loaded X employees" messages

### Test 2: Create New Employee
1. In HR module, click "Add Employee" button
2. Fill form with:
   - Employee Code: EMP-TEST-001
   - First Name: Test
   - Last Name: Employee
   - Department: (select any)
   - Position: Test Position
   - Hire Date: (any date)
   - Basic Salary: 5000
3. Click Save
4. Expected: 
   - Success alert
   - New employee appears in employee list
   - New employee only visible in correct business

### Test 3: View Attendance
1. Go to Attendance tab in HR module
2. Set date range (e.g., current month)
3. Expected: Should see only employees from current business
4. Console should show: "✅ Loaded attendance data"

### Test 4: View Leave Requests
1. Go to Leave Management tab
2. Expected: Should see leave requests only for current business employees

### Test 5: HR Analytics
1. Check dashboard metrics (Headcount, Active Employees, etc.)
2. Expected: All metrics should show only data from current business

### Test 6: Multi-Business Verification
1. Create a second business in Admin panel
2. Create users assigned to that business
3. Login as user from second business
4. Navigate to HR module
5. Expected: Should see only employees from second business

---

## CONSOLE DEBUGGING MESSAGES

The updated hr.js includes extensive console logging. Open browser DevTools (F12) to see:

```
📡 Loading employees for business_id: 1
✅ Loaded 5 employees
📡 Loading departments for business_id: 1
✅ Loaded 3 departments
📝 Creating employee for business_id: 1, branch_id: 1
✅ Employee created successfully with ID: 45
```

If you see errors instead:
```
❌ No branch context available
❌ RPC Error: ...error details...
❌ No employees found for business
```

Check:
1. Is user properly logged in?
2. Is branch context being set correctly?
3. Did you deploy the RPC functions?
4. Does the business_id exist in database?

---

## ROLLBACK PLAN

If something goes wrong and you need to rollback:

### Option 1: Keep columns but drop constraints
```sql
-- Remove foreign key constraint if causing issues
ALTER TABLE public.employees 
DROP CONSTRAINT IF EXISTS employees_business_id_fkey;
```

### Option 2: Full rollback (not recommended)
Drop the columns you added:
```sql
ALTER TABLE public.employees DROP COLUMN IF EXISTS business_id;
ALTER TABLE public.payroll_runs DROP COLUMN IF EXISTS business_id;
ALTER TABLE public.payroll_deductions DROP COLUMN IF EXISTS business_id;
ALTER TABLE public.attendance DROP COLUMN IF EXISTS business_id;
ALTER TABLE public.leave_requests DROP COLUMN IF EXISTS business_id;
```

---

## NEXT STEPS AFTER DEPLOYMENT

1. **Assign Roles to Test User**
   - Go to Admin → Users & Roles
   - Find the test user (e.g., MWIZA KAMANGA)
   - Assign them the "HR Staff" or "HR Manager" role
   - This enables them to see the HR module in sidebar

2. **Create Test Data**
   - Create 2-3 test employees in HR module
   - Create 1-2 test departments
   - Test creating attendance records
   - Test requesting leave

3. **Monitor Logs**
   - Keep browser console open while testing
   - Watch for any errors in RPC calls
   - Report any issues with specific error messages

---

## FILES MODIFIED/CREATED

| File | Status | Purpose |
|------|--------|---------|
| `supabase-hr-multi-tenant-fix.sql` | NEW | Schema migration to add business_id |
| `supabase-hr-functions-business-scoped.sql` | NEW | RPC functions for business-scoped queries |
| `frontend/js/hr.js` | MODIFIED | Updated all functions to filter by business_id |
| `DEPLOYMENT_HR_MULTI_TENANT_FIX.md` | NEW | This deployment guide |

---

## SUPPORT

If you encounter issues:

1. Check browser console (F12) for error messages
2. Check Supabase logs for RPC errors
3. Verify business_id values are populated in database:
   ```sql
   SELECT id, employee_code, first_name, business_id FROM public.employees LIMIT 5;
   ```
4. Test RPC functions directly in Supabase SQL Editor
5. Report the exact error message you're seeing
