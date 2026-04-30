-- ============================================================================
-- ZAI FLOW 2.0 - HR MODULE ROW-LEVEL SECURITY (RLS) POLICIES
-- Enforces multi-tenant data isolation for HR tables
-- Run AFTER supabase-hr-multi-tenant-fix.sql
-- ============================================================================

-- ============================================================================
-- ENABLE RLS ON HR TABLES
-- ============================================================================
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_deductions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES FOR EMPLOYEES TABLE
-- ============================================================================

-- Admin/Manager can see all employees in their business/branches
CREATE POLICY employees_visibility ON employees
  FOR SELECT
  USING (
    -- User has access to this business
    business_id IN (
      SELECT DISTINCT b.business_id FROM user_branch_access uba
      JOIN branches b ON uba.branch_id = b.id
      WHERE uba.user_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1) AND uba.status = 'ACTIVE'
    )
    OR
    -- Admin can see all employees
    (SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1) = 'admin'
  );

-- Admin/HR can create employees for their business
CREATE POLICY employees_insert ON employees
  FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT DISTINCT b.business_id FROM user_branch_access uba
      JOIN branches b ON uba.branch_id = b.id
      WHERE uba.user_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
        AND uba.role IN ('admin', 'manager', 'hr')
        AND uba.status = 'ACTIVE'
    )
    OR
    (SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1) = 'admin'
  );

-- Admin/HR can update employees in their business
CREATE POLICY employees_update ON employees
  FOR UPDATE
  USING (
    business_id IN (
      SELECT DISTINCT b.business_id FROM user_branch_access uba
      JOIN branches b ON uba.branch_id = b.id
      WHERE uba.user_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
        AND uba.role IN ('admin', 'manager', 'hr')
        AND uba.status = 'ACTIVE'
    )
    OR
    (SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1) = 'admin'
  );

-- ============================================================================
-- RLS POLICIES FOR ATTENDANCE TABLE
-- ============================================================================

-- Users can see attendance for their business/branches
CREATE POLICY attendance_visibility ON attendance
  FOR SELECT
  USING (
    business_id IN (
      SELECT DISTINCT b.business_id FROM user_branch_access uba
      JOIN branches b ON uba.branch_id = b.id
      WHERE uba.user_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1) AND uba.status = 'ACTIVE'
    )
    OR
    (SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1) = 'admin'
  );

-- Employees can create own attendance records (clock in/out)
CREATE POLICY attendance_insert_own ON attendance
  FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT DISTINCT b.business_id FROM user_branch_access uba
      JOIN branches b ON uba.branch_id = b.id
      WHERE uba.user_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1) AND uba.status = 'ACTIVE'
    )
    OR
    (SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1) = 'admin'
  );

-- Employees can update own attendance records (clock out)
CREATE POLICY attendance_update_own ON attendance
  FOR UPDATE
  USING (
    business_id IN (
      SELECT DISTINCT b.business_id FROM user_branch_access uba
      JOIN branches b ON uba.branch_id = b.id
      WHERE uba.user_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1) AND uba.status = 'ACTIVE'
    )
    OR
    (SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1) = 'admin'
  );

-- ============================================================================
-- RLS POLICIES FOR LEAVE_REQUESTS TABLE
-- ============================================================================

-- Users can see leave requests for their business
CREATE POLICY leave_requests_visibility ON leave_requests
  FOR SELECT
  USING (
    business_id IN (
      SELECT DISTINCT b.business_id FROM user_branch_access uba
      JOIN branches b ON uba.branch_id = b.id
      WHERE uba.user_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1) AND uba.status = 'ACTIVE'
    )
    OR
    (SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1) = 'admin'
  );

-- Employees can create leave requests for their business
CREATE POLICY leave_requests_insert ON leave_requests
  FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT DISTINCT b.business_id FROM user_branch_access uba
      JOIN branches b ON uba.branch_id = b.id
      WHERE uba.user_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1) AND uba.status = 'ACTIVE'
    )
    OR
    (SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1) = 'admin'
  );

-- Managers/HR can update leave requests
CREATE POLICY leave_requests_update ON leave_requests
  FOR UPDATE
  USING (
    business_id IN (
      SELECT DISTINCT b.business_id FROM user_branch_access uba
      JOIN branches b ON uba.branch_id = b.id
      WHERE uba.user_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
        AND uba.role IN ('admin', 'manager', 'hr')
        AND uba.status = 'ACTIVE'
    )
    OR
    (SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1) = 'admin'
  );

-- ============================================================================
-- RLS POLICIES FOR DEPARTMENTS TABLE
-- ============================================================================

-- Users can see departments for their business
CREATE POLICY departments_visibility ON departments
  FOR SELECT
  USING (
    business_id IN (
      SELECT DISTINCT b.business_id FROM user_branch_access uba
      JOIN branches b ON uba.branch_id = b.id
      WHERE uba.user_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1) AND uba.status = 'ACTIVE'
    )
    OR
    (SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1) = 'admin'
  );

-- HR can create/update departments
CREATE POLICY departments_modify ON departments
  FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT DISTINCT b.business_id FROM user_branch_access uba
      JOIN branches b ON uba.branch_id = b.id
      WHERE uba.user_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
        AND uba.role IN ('admin', 'manager', 'hr')
        AND uba.status = 'ACTIVE'
    )
    OR
    (SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1) = 'admin'
  );

-- ============================================================================
-- RLS POLICIES FOR SALARY_STRUCTURES TABLE
-- ============================================================================

-- Users can see salary structures for their business
CREATE POLICY salary_structures_visibility ON salary_structures
  FOR SELECT
  USING (
    employee_id IN (
      SELECT id FROM employees
      WHERE business_id IN (
        SELECT DISTINCT b.business_id FROM user_branch_access uba
        JOIN branches b ON uba.branch_id = b.id
        WHERE uba.user_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1) AND uba.status = 'ACTIVE'
      )
    )
    OR
    (SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1) = 'admin'
  );

-- HR can create salary structures
CREATE POLICY salary_structures_insert ON salary_structures
  FOR INSERT
  WITH CHECK (
    employee_id IN (
      SELECT e.id FROM employees e
      WHERE e.business_id IN (
        SELECT DISTINCT b.business_id FROM user_branch_access uba
        JOIN branches b ON uba.branch_id = b.id
        WHERE uba.user_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
          AND uba.role IN ('admin', 'manager', 'hr', 'payroll')
          AND uba.status = 'ACTIVE'
      )
    )
    OR
    (SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1) = 'admin'
  );

-- ============================================================================
-- RLS POLICIES FOR PAYROLL_RUNS TABLE
-- ============================================================================

-- Users can see payroll runs for their business
CREATE POLICY payroll_runs_visibility ON payroll_runs
  FOR SELECT
  USING (
    business_id IN (
      SELECT DISTINCT b.business_id FROM user_branch_access uba
      JOIN branches b ON uba.branch_id = b.id
      WHERE uba.user_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1) AND uba.status = 'ACTIVE'
    )
    OR
    (SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1) = 'admin'
  );

-- Payroll can create payroll runs
CREATE POLICY payroll_runs_insert ON payroll_runs
  FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT DISTINCT b.business_id FROM user_branch_access uba
      JOIN branches b ON uba.branch_id = b.id
      WHERE uba.user_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
        AND uba.role IN ('admin', 'manager', 'payroll')
        AND uba.status = 'ACTIVE'
    )
    OR
    (SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1) = 'admin'
  );

-- ============================================================================
-- RLS POLICIES FOR PAYROLL_DEDUCTIONS TABLE
-- ============================================================================

-- Users can see payroll deductions for their business
CREATE POLICY payroll_deductions_visibility ON payroll_deductions
  FOR SELECT
  USING (
    business_id IN (
      SELECT DISTINCT b.business_id FROM user_branch_access uba
      JOIN branches b ON uba.branch_id = b.id
      WHERE uba.user_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1) AND uba.status = 'ACTIVE'
    )
    OR
    (SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1) = 'admin'
  );

-- Payroll can create deductions
CREATE POLICY payroll_deductions_insert ON payroll_deductions
  FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT DISTINCT b.business_id FROM user_branch_access uba
      JOIN branches b ON uba.branch_id = b.id
      WHERE uba.user_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
        AND uba.role IN ('admin', 'manager', 'payroll')
        AND uba.status = 'ACTIVE'
    )
    OR
    (SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1) = 'admin'
  );

-- ============================================================================
-- ALL HR RLS POLICIES CREATED SUCCESSFULLY
-- ============================================================================
