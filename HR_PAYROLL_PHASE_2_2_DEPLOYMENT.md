# HR & PAYROLL MODULE - Phase 2.2 Deployment Guide
## ZAI FLOW 2.0 - Complete Employee & Payroll Management
**Date:** 28 April 2026  
**Status:** Ready for Deployment  
**Estimated Deployment Time:** 2-3 hours

---

## 📋 OVERVIEW

Phase 2.2 implements a complete HR & Payroll system for ZAI FLOW 2.0 with:

✅ **Employee Master Data Management**
- Employee profiles with departments, positions, hire dates
- Salary structures with flexible allowances and deductions
- Multi-tenant support (per-branch employee rosters)

✅ **Automated Payroll Processing**
- Monthly payroll runs with configurable tax brackets
- Automatic PAYE tax calculation (Zambia 2026 brackets)
- Pension contribution tracking (10% default)
- Automatic GL posting to Salaries & Wages account

✅ **Attendance & Leave Management**
- Daily attendance tracking (Present, Absent, Leave, Sick, Late, Half-Day)
- Leave request workflow with manager approval
- Leave balance tracking per employee per year
- Auto-attendance marking when leave is approved

✅ **HR Analytics & Reporting**
- Employee directory with tenure tracking
- Payroll summary dashboards
- Attendance and leave utilization reports
- Department-level HR metrics

---

## 🗄️ DATABASE LAYER (Phase 2.2.1)

### Step 1: Deploy HR Schema

**File:** `supabase-schema-hr.sql`

**What it creates:**
1. **departments** - Branch-based organizational structure
2. **leave_types** - Leave configuration (Annual, Sick, Maternity, etc.)
3. **employees** - Master employee data (code, name, department, status)
4. **tax_rules** - Configurable PAYE brackets for Zambia
5. **salary_structures** - Employee compensation (basic + allowances + deductions)
6. **payroll_runs** - Monthly payroll execution records
7. **payroll_deductions** - Individual employee deduction details
8. **attendance** - Daily attendance tracking
9. **leave_requests** - Leave request workflow

**Plus:**
- 3 reporting views (v_employee_summary, v_payroll_summary, v_attendance_summary, v_leave_balance)
- Auto-timestamp triggers for all tables
- Multi-tenant support with branch_id on all relevant tables
- 50+ performance indexes

### Step 2: Deploy HR RPC Functions

**File:** `supabase-hr-functions.sql`

**Functions created:**

1. **calculate_deductions(employee_id, basic_salary)**
   - Calculates gross, PAYE, pension, net for an employee
   - Uses configurable tax brackets
   - Returns: gross_salary, paye_tax, pension_contribution, other_deductions, net_salary

2. **process_payroll(branch_id, month, year, processed_by)**
   - Creates a complete monthly payroll run
   - Loops through all active employees
   - Calls calculate_deductions for each
   - Inserts payroll_deductions records
   - Updates totals and calls process_payroll_entries()
   - Returns: payroll_run_id, employee_count, total_gross, total_paye, total_pension, total_net

3. **process_payroll_entries(payroll_run_id)**
   - Posts journal entries to GL
   - Creates double-entry GL records:
     - Dr. Salaries & Wages (5200) - total gross
     - Cr. Cash (1000) - net salaries
     - Cr. PAYE Payable (2100) - paye taxes
     - Cr. Pension Payable (2200) - pension contributions
   - Returns: journal_entry_id, success status

4. **reverse_payroll(payroll_run_id)**
   - Reverses a completed payroll
   - Marks payroll as REVERSED
   - Creates reversing GL entries
   - Returns: success status

5. **get_payroll_summary(branch_id, month, year)**
   - Retrieves payroll metrics for reporting
   - Returns: payroll_run_id, totals, employee_count, status

6. **approve_leave(leave_request_id, approved_by)**
   - Approves a pending leave request
   - Auto-creates attendance records for leave dates
   - Skips weekends
   - Returns: success, attendance records created count

7. **reject_leave(leave_request_id, rejection_reason)**
   - Rejects a pending leave request
   - Records rejection reason
   - Returns: success status

8. **mark_attendance(branch_id, employee_id, attendance_date, status, hours_worked, notes)**
   - Marks/updates daily attendance
   - Status: PRESENT, ABSENT, LEAVE, SICK, LATE, HALF_DAY
   - Validates employee exists in branch
   - Returns: success status

---

### Deployment Steps

```sql
-- STEP 1: In Supabase SQL Editor, run entire supabase-schema-hr.sql
-- This creates all 9 tables + views + triggers + seed data

-- STEP 2: In Supabase SQL Editor, run entire supabase-hr-functions.sql
-- This creates all 8 RPC functions

-- STEP 3: Verify in Supabase Database section
-- Tables should show: departments, leave_types, employees, tax_rules, salary_structures, payroll_runs, payroll_deductions, attendance, leave_requests

-- STEP 4: Verify RPC functions
-- Functions should show: calculate_deductions, process_payroll, process_payroll_entries, reverse_payroll, get_payroll_summary, approve_leave, reject_leave, mark_attendance
```

**Estimated Time:** 15-20 minutes

---

## 🎨 FRONTEND LAYER (Phase 2.2.2)

### Files to Create

1. **frontend/hr.html** (500+ lines)
   - Main HR dashboard with tab navigation
   - Tabs: Employee Directory, Payroll, Attendance, Leave, Analytics
   - Branch dropdown (inherited from branch-context.js)

2. **frontend/js/hr.js** (600+ lines)
   - Employee CRUD operations
   - Employee list filtering and search
   - Employee detail view/edit modals

3. **frontend/js/payroll.js** (700+ lines)
   - Payroll run processing
   - Payroll summary display
   - Payroll reversal functionality
   - Payslip generation

4. **frontend/js/attendance.js** (400+ lines)
   - Daily attendance marking
   - Attendance calendar/table view
   - Batch marking (mark all present, mark all absent)
   - Monthly attendance report

5. **frontend/js/leave.js** (500+ lines)
   - Leave request creation
   - Leave approval/rejection workflow
   - Leave balance display
   - Leave history reporting

6. **frontend/js/hr-analytics.js** (300+ lines)
   - Employee count metrics
   - Headcount by department
   - Attendance rate calculation
   - Turnover metrics
   - Chart.js integration

### UI Structure

#### Tab 1: Employee Directory
```
┌─ Search / Filter ────────────────────────────────────┐
│ By Name | By Department | By Status (Active/Inactive)│
│ [Search] [Reset] [+ Add Employee]                    │
├──────────────────────────────────────────────────────┤
│ Employee Code | Name | Department | Position | Status│
│ ─────────────────────────────────────────────────────│
│ EMP-001       | John | Finance    | Manager  | Active│
│ EMP-002       | Jane | Sales      | Officer  | Active│
│ ...                                                   │
├──────────────────────────────────────────────────────┤
│ [View] [Edit] [Deactivate] [Delete]                  │
└──────────────────────────────────────────────────────┘
```

#### Tab 2: Payroll Processing
```
┌─ Payroll Run ─────────────────────────────────────────┐
│ Month: [April    ▼] Year: [2026 ▼]                    │
│ [Run Payroll] [View Details] [Reverse] [Download]     │
├───────────────────────────────────────────────────────┤
│ Status: COMPLETED (26 April 2026)                      │
│                                                        │
│ Employees: 47 | Gross: K123,456.78 | Net: K98,234.56 │
│ PAYE Tax: K18,765.43 | Pension: K9,876.54             │
├───────────────────────────────────────────────────────┤
│ Deduction Details:                                     │
│ Name | Basic | Allowances | Gross | PAYE | Pension | Net
│ ─────────────────────────────────────────────────────┤
│ John | 10,000| 1,500      | 11,500| ...  | ...     | ...
│ ...                                                   │
└───────────────────────────────────────────────────────┘
```

#### Tab 3: Attendance
```
┌─ Mark Attendance ─────────────────────────────────────┐
│ Date: [27 April 2026] [◄ Prev] [Next ►]               │
│ [Mark All Present] [Mark All Absent]                  │
├───────────────────────────────────────────────────────┤
│ ☑ John Doe         - PRESENT                          │
│ ☐ Jane Smith       - ABSENT                           │
│ ☑ Mike Johnson     - PRESENT                          │
│ ☑ Sarah Williams   - LEAVE (Annual)                   │
│ ☑ Tom Brown        - SICK                             │
├───────────────────────────────────────────────────────┤
│ [Save Changes]                                         │
└───────────────────────────────────────────────────────┘
```

#### Tab 4: Leave Management
```
┌─ Leave Requests ──────────────────────────────────────┐
│ Filter: [All] [Pending] [Approved] [Rejected]          │
│ [+ Request Leave] [Approve] [Reject]                  │
├───────────────────────────────────────────────────────┤
│ Employee | Type | Dates | Days | Status | Actions     │
│ ───────────────────────────────────────────────────────│
│ John     | Annual | 1-5 May | 5 | PENDING | [✓] [✗]  │
│ Jane     | Sick | 25 Apr | 1 | APPROVED | -          │
│ ...                                                   │
└───────────────────────────────────────────────────────┘
```

#### Tab 5: HR Analytics
```
┌─ HR Metrics Dashboard ────────────────────────────────┐
│                                                        │
│ ┌─────────────┬─────────────┬─────────────┐           │
│ │ Total       │ Active      │ On Leave    │           │
│ │ Employees   │ Employees   │ Today       │           │
│ │    47       │    46       │     3       │           │
│ └─────────────┴─────────────┴─────────────┘           │
│                                                        │
│ ┌─ Headcount by Department ──────────────┐           │
│ │ Finance: 12  Operations: 15  Sales: 20 │           │
│ │  [Pie Chart]                            │           │
│ └──────────────────────────────────────────┘           │
│                                                        │
│ ┌─ Monthly Attendance Rate ──────────────┐           │
│ │ April: 96.5%  May: 94.2%  June: 97.1% │           │
│ │  [Line Chart]                          │           │
│ └──────────────────────────────────────────┘           │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Implementation Pattern

**hr.js structure:**
```javascript
// Load all HR data on page load
document.addEventListener("DOMContentLoaded", () => {
  initHRDashboard();
  setupTabHandlers();
});

// Initialize all data
function initHRDashboard() {
  loadEmployeeList();
  loadPayrollSummary();
  loadAttendanceData();
  loadHRAnalytics();
}

// Load employees with branch filtering
async function loadEmployeeList() {
  const context = getBranchContext();
  const { data, error } = await withBranchFilter(
    supabase.from('employees').select('*')
  ).eq('status', 'ACTIVE');
  
  // Render employee table
}

// Run monthly payroll
async function runPayroll() {
  const context = getBranchContext();
  const month = parseInt(document.getElementById('payrollMonth').value);
  const year = parseInt(document.getElementById('payrollYear').value);
  
  const { data, error } = await supabase.rpc('process_payroll', {
    p_branch_id: context.branch_id,
    p_month: month,
    p_year: year,
    p_processed_by: JSON.parse(localStorage.user).id
  });
  
  if (error) throw error;
  alert(`Payroll processed for ${data[0].employee_count} employees`);
  loadPayrollSummary();
}

// Approve leave
async function approveLeave(leaveRequestId) {
  const userId = JSON.parse(localStorage.user).id;
  const { data, error } = await supabase.rpc('approve_leave', {
    p_leave_request_id: leaveRequestId,
    p_approved_by: userId
  });
  
  if (error) throw error;
  loadLeaveRequests();
}
```

---

## 📊 END-TO-END VERIFICATION TEST

### Test Scenario: Complete Monthly Payroll Cycle

**Duration:** 30-45 minutes

#### Phase 1: Employee Setup (5 minutes)

1. Navigate to HR Dashboard → Employee Directory
2. Create 3 test employees:
   - **EMP-001:** John Smith | Finance | K12,000/month
   - **EMP-002:** Jane Doe | Operations | K15,000/month
   - **EMP-003:** Mike Johnson | Sales | K18,000/month
3. For each employee, set:
   - Basic salary
   - House allowance (K500)
   - Transport allowance (K300)
   - Pension rate: 10%

**Expected Result:** ✅ 3 active employees created, viewable in directory

#### Phase 2: Attendance Marking (5 minutes)

1. Go to Attendance tab
2. Mark attendance for April:
   - EMP-001: Present for 20 days, Absent 2 days
   - EMP-002: Present for 20 days, Leave 2 days
   - EMP-003: Present for 19 days, Sick 1 day, Absent 1 day

**Expected Result:** ✅ Attendance records created for all dates

#### Phase 3: Leave Management (5 minutes)

1. Go to Leave tab
2. Create leave request for EMP-002 (May 1-5, Annual Leave)
3. Approve the leave request

**Expected Result:** ✅ Leave approved, attendance auto-marked as LEAVE for May 1-5

#### Phase 4: Payroll Processing (10 minutes)

1. Go to Payroll tab
2. Select Month: April, Year: 2026
3. Click "Run Payroll"
4. Verify calculations:
   ```
   Employee: John Smith (EMP-001)
   Basic:        K12,000.00
   Allowances:   K  800.00 (House + Transport)
   Gross:        K12,800.00
   
   PAYE Calculation (15% bracket for 2,089-5,000):
   - Income in 0-2,088 bracket: 2,088 * 0% = K0.00
   - Income in 2,089-5,000 bracket: (5,000-2,089) * 15% = K435.15
   Total PAYE: K435.15
   
   Pension (10%): K1,280.00
   
   Net: K12,800 - K435.15 - K1,280 = K11,084.85
   ```

5. Verify payroll summary shows:
   - Employee Count: 3
   - Total Gross: K45,600.00
   - Total PAYE: ~K3,105.45 (sum of all employees)
   - Total Pension: K4,560.00 (10% of total gross)
   - Total Net: ~K37,934.55

**Expected Result:** ✅ Payroll processed correctly with accurate tax calculations

#### Phase 5: Accounting Integration Verification (10 minutes)

1. Navigate to Accounting → General Ledger
2. Filter by date: April 2026
3. Find entry: "PAYROLL-2026-04-28"
4. Verify journal lines:
   ```
   Dr. Salaries & Wages (5200)    K45,600.00
   Cr. Cash (1000)                           K37,934.55
   Cr. PAYE Payable (2100)                   K3,105.45
   Cr. Pension Payable (2200)                K4,560.00
   ─────────────────────────────────────────────────
   Totals:                         K45,600.00  K45,600.00
   ```

5. Verify in Trial Balance: Check that liabilities increased

**Expected Result:** ✅ GL entries created with balanced debits/credits

#### Phase 6: Payroll Reversal (5 minutes)

1. Go back to Payroll tab
2. Find completed April payroll
3. Click "Reverse Payroll"
4. Go to GL and verify reversing entries created with opposite debits/credits

**Expected Result:** ✅ Payroll reversed, GL entries reversed automatically

#### Phase 7: Reports & Analytics (5 minutes)

1. Go to HR Analytics dashboard
2. Verify displays:
   - Total Employees: 3
   - Attendance Rate: ~97% (59 present out of 60 workdays)
   - Department breakdown
   - Leave utilization

**Expected Result:** ✅ Analytics calculated correctly from underlying data

---

## ✅ DEPLOYMENT CHECKLIST

### Database Layer
- [ ] supabase-schema-hr.sql executed in Supabase SQL Editor
- [ ] All 9 tables created (verify in Tables section)
- [ ] Views created (verify in Views section)
- [ ] Triggers created (verify in Functions section)
- [ ] Seed data inserted (verify departments, leave_types, tax_rules)

### RPC Functions
- [ ] supabase-hr-functions.sql executed in Supabase SQL Editor
- [ ] All 8 functions created (verify in Functions section)
- [ ] Test function: SELECT * FROM public.calculate_deductions(1)
- [ ] Verify return values match expected types

### Frontend Files
- [ ] frontend/hr.html created with all 5 tabs
- [ ] frontend/js/hr.js created with load functions
- [ ] frontend/js/payroll.js created with payroll logic
- [ ] frontend/js/attendance.js created with attendance marking
- [ ] frontend/js/leave.js created with leave workflow
- [ ] frontend/js/hr-analytics.js created with charts

### Navigation
- [ ] Add HR link to all main HTML files sidebar:
  ```html
  <a href="hr.html">👥 HR & Payroll</a>
  ```
- [ ] Test navigation from sales.html → hr.html → back

### Testing
- [ ] Employee directory loads and filters work
- [ ] Create test employee with salary structure
- [ ] Mark attendance for test dates
- [ ] Create and approve leave request
- [ ] Run payroll and verify calculations
- [ ] Verify GL entries posted correctly
- [ ] Run payroll reversal
- [ ] Verify analytics dashboard loads

---

## 🚀 DEPLOYMENT TIMELINE

| Phase | Task | Time | Status |
|-------|------|------|--------|
| 1 | Create HR schema SQL | 20 min | ✅ Complete |
| 2 | Create HR RPC functions SQL | 20 min | ✅ Complete |
| 3 | Deploy schema in Supabase | 10 min | ⏳ User does |
| 4 | Deploy RPC functions | 10 min | ⏳ User does |
| 5 | Create hr.html and js files | 90 min | ⏳ Next |
| 6 | Test end-to-end | 45 min | ⏳ After FE |
| 7 | UAT and adjustments | 30 min | ⏳ Final |
| **TOTAL** | | **225 min (3.75 hrs)** | |

---

## 📝 KEY INTEGRATION POINTS

### With Branch-Context (Multi-Tenant)
- All employee queries filter by `branch_id` using `withBranchFilter()`
- Payroll runs are per-branch (different employees per branch)
- Users only see employees in their assigned branch(es)

### With Chart of Accounts
- Ensure these accounts exist before payroll:
  - 1000: Cash
  - 2100: PAYE Tax Payable (Liability)
  - 2200: Pension Contributions Payable (Liability)
  - 5200: Salaries & Wages Expense
  - 5300: Employee Benefits Expense

### With General Ledger
- Payroll automatically posts to GL via `process_payroll_entries()`
- GL entries visible in Accounting → General Ledger
- Monthly totals appear in P&L under Salaries & Wages

---

## 🔒 SECURITY & PERMISSIONS

**RLS (Row-Level Security):**
- Currently skipped, using application-level filtering (as per Phase 2.1 pattern)
- Ensure branch_id filtering applied in JavaScript before queries

**User Roles:**
- **Admin:** Full HR access (employee CRUD, payroll runs, all reports)
- **HR Manager:** Employee CRUD, payroll runs, leave approval, reports
- **Employee:** View own profile, request leave, view attendance
- **Manager:** Approve/reject team member leave, view team attendance

---

## 📞 TROUBLESHOOTING

| Issue | Solution |
|-------|----------|
| "Payroll already exists for month" | Check payroll_runs table, may need to reverse previous run |
| "Employee not found" error | Verify employee assigned to correct branch, employee status is ACTIVE |
| "PAYE calculation incorrect" | Verify tax_rules table has correct brackets, ensure effective_date <= CURRENT_DATE |
| "GL entries not created" | Verify process_payroll_entries() called from process_payroll() |
| "Leave approval doesn't mark attendance" | Ensure approve_leave() RPC is being called (not just table UPDATE) |
| "Analytics show zero employees" | Verify branch_id filtering in v_employee_summary view |

---

## ✨ WHAT'S NEXT (Phase 2.3)

Optional enhancements after Phase 2.2:
- [ ] Payslip PDF generation and email delivery
- [ ] Employee self-service portal (view payslips, apply leave)
- [ ] Integration with NAPSA pension provider
- [ ] ZRA tax reporting export
- [ ] Biometric attendance system integration
- [ ] Performance rating and bonus calculations
- [ ] Org chart visualization
- [ ] Payroll forecasting tools

---

## 🎯 SUCCESS CRITERIA

Phase 2.2 is **COMPLETE** when:

✅ All 9 HR tables created in Supabase  
✅ All 8 RPC functions deployed  
✅ hr.html loads with 5 functional tabs  
✅ Employees can be created/edited/viewed  
✅ Attendance can be marked daily  
✅ Leave requests can be created and approved  
✅ Monthly payroll runs successfully  
✅ GL entries auto-post with correct amounts  
✅ Payroll can be reversed if needed  
✅ Analytics dashboard displays metrics  
✅ End-to-end test scenario passes  

---

**Status:** Phase 2.2 Core Infrastructure Ready ✅  
**Current Date:** 28 April 2026  
**Next Step:** Deploy schema and functions, then build frontend  

