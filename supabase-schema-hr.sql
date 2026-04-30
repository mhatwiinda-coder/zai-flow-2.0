-- ============================================================================
-- ZAI FLOW 2.0 - HR & Payroll Module Database Schema
-- Phase 2.2 - Multi-Tenant HR & Payroll Implementation
-- Run ALL of these in Supabase SQL Editor to create HR tables
-- Date: 28 April 2026
-- ============================================================================

-- ============================================================================
-- 1. DEPARTMENTS TABLE - Multi-Tenant
-- ============================================================================
DROP TABLE IF EXISTS public.departments CASCADE;
CREATE TABLE public.departments (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_dept_per_branch UNIQUE(branch_id, name)
);

CREATE INDEX idx_departments_branch_id ON public.departments(branch_id);
CREATE INDEX idx_departments_name ON public.departments(name);

-- ============================================================================
-- 2. LEAVE TYPES TABLE
-- ============================================================================
DROP TABLE IF EXISTS public.leave_types CASCADE;
CREATE TABLE public.leave_types (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  days_per_year INTEGER NOT NULL DEFAULT 20,
  is_paid BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. EMPLOYEES TABLE - Multi-Tenant
-- ============================================================================
DROP TABLE IF EXISTS public.employees CASCADE;
CREATE TABLE public.employees (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  employee_code TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  department_id INTEGER REFERENCES public.departments(id),
  "position" TEXT NOT NULL,
  hire_date DATE NOT NULL,
  termination_date DATE,
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'TERMINATED')),
  identity_number TEXT,
  tax_pin TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_emp_code_per_branch UNIQUE(branch_id, employee_code)
);

CREATE INDEX idx_employees_branch_id ON public.employees(branch_id);
CREATE INDEX idx_employees_employee_code ON public.employees(employee_code);
CREATE INDEX idx_employees_status ON public.employees(status);
CREATE INDEX idx_employees_department_id ON public.employees(department_id);

-- ============================================================================
-- 4. TAX RULES TABLE (Configurable PAYE Brackets)
-- ============================================================================
DROP TABLE IF EXISTS public.tax_rules CASCADE;
CREATE TABLE public.tax_rules (
  id SERIAL PRIMARY KEY,
  min_income NUMERIC(12,2) NOT NULL,
  max_income NUMERIC(12,2) NOT NULL,
  tax_rate NUMERIC(5,2) NOT NULL,
  description TEXT,
  effective_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tax_rules_effective_date ON public.tax_rules(effective_date);

-- Insert default Zambia 2026 PAYE tax brackets
INSERT INTO public.tax_rules (min_income, max_income, tax_rate, description, effective_date)
VALUES
  (0, 2088, 0, '0-2,088 (0% bracket)', '2026-01-01'),
  (2089, 5000, 15, '2,089-5,000 (15% bracket)', '2026-01-01'),
  (5001, 999999999, 25, '5,001+ (25% bracket)', '2026-01-01');

-- ============================================================================
-- 5. SALARY STRUCTURES TABLE
-- ============================================================================
DROP TABLE IF EXISTS public.salary_structures CASCADE;
CREATE TABLE public.salary_structures (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  basic_salary NUMERIC(12,2) NOT NULL,
  allowances JSONB DEFAULT '{}', -- e.g., {"house": 500, "transport": 300}
  deductions JSONB DEFAULT '{}', -- e.g., {"loan": 100, "pension": 50}
  pension_rate NUMERIC(5,2) DEFAULT 10.00,
  effective_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_salary_structures_employee_id ON public.salary_structures(employee_id);
CREATE INDEX idx_salary_structures_effective_date ON public.salary_structures(effective_date);

-- ============================================================================
-- 6. PAYROLL RUNS TABLE - Multi-Tenant
-- ============================================================================
DROP TABLE IF EXISTS public.payroll_runs CASCADE;
CREATE TABLE public.payroll_runs (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  run_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PROCESSING', 'COMPLETED', 'REVERSED')),
  total_gross NUMERIC(12,2) DEFAULT 0,
  total_paye NUMERIC(12,2) DEFAULT 0,
  total_pension NUMERIC(12,2) DEFAULT 0,
  total_deductions NUMERIC(12,2) DEFAULT 0,
  total_net NUMERIC(12,2) DEFAULT 0,
  employee_count INTEGER DEFAULT 0,
  processed_by INTEGER REFERENCES public.users(id),
  journal_entry_id INTEGER REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_payroll_per_branch UNIQUE(branch_id, month, year)
);

CREATE INDEX idx_payroll_runs_branch_id ON public.payroll_runs(branch_id);
CREATE INDEX idx_payroll_runs_month_year ON public.payroll_runs(month, year);
CREATE INDEX idx_payroll_runs_status ON public.payroll_runs(status);
CREATE UNIQUE INDEX idx_payroll_runs_unique_active ON public.payroll_runs(branch_id, month, year) WHERE status != 'REVERSED';

-- ============================================================================
-- 7. PAYROLL DEDUCTIONS TABLE - Multi-Tenant
-- ============================================================================
DROP TABLE IF EXISTS public.payroll_deductions CASCADE;
CREATE TABLE public.payroll_deductions (
  id SERIAL PRIMARY KEY,
  payroll_run_id INTEGER NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  basic_salary NUMERIC(12,2) NOT NULL,
  allowances NUMERIC(12,2) DEFAULT 0,
  gross_salary NUMERIC(12,2) NOT NULL,
  paye_tax NUMERIC(12,2) DEFAULT 0,
  pension_contribution NUMERIC(12,2) DEFAULT 0,
  other_deductions NUMERIC(12,2) DEFAULT 0,
  net_salary NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_salary_calculation CHECK (
    gross_salary = (basic_salary + allowances) AND
    net_salary = (gross_salary - paye_tax - pension_contribution - other_deductions)
  )
);

CREATE INDEX idx_payroll_deductions_payroll_run_id ON public.payroll_deductions(payroll_run_id);
CREATE INDEX idx_payroll_deductions_employee_id ON public.payroll_deductions(employee_id);
CREATE UNIQUE INDEX idx_payroll_deductions_unique ON public.payroll_deductions(payroll_run_id, employee_id);

-- ============================================================================
-- 8. ATTENDANCE TABLE - Multi-Tenant
-- ============================================================================
DROP TABLE IF EXISTS public.attendance CASCADE;
CREATE TABLE public.attendance (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status TEXT DEFAULT 'ABSENT' CHECK (status IN ('PRESENT', 'ABSENT', 'LEAVE', 'SICK', 'LATE', 'HALF_DAY')),
  hours_worked NUMERIC(4,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_attendance_per_day UNIQUE(branch_id, employee_id, attendance_date)
);

CREATE INDEX idx_attendance_branch_id ON public.attendance(branch_id);
CREATE INDEX idx_attendance_employee_id ON public.attendance(employee_id);
CREATE INDEX idx_attendance_date ON public.attendance(attendance_date);
CREATE INDEX idx_attendance_status ON public.attendance(status);

-- ============================================================================
-- 9. LEAVE REQUESTS TABLE - Multi-Tenant
-- ============================================================================
DROP TABLE IF EXISTS public.leave_requests CASCADE;
CREATE TABLE public.leave_requests (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id INTEGER NOT NULL REFERENCES public.leave_types(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_requested INTEGER NOT NULL,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  approved_by INTEGER REFERENCES public.users(id),
  approval_date TIMESTAMPTZ,
  notes TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_dates CHECK (end_date >= start_date),
  CONSTRAINT positive_days CHECK (days_requested > 0)
);

CREATE INDEX idx_leave_requests_branch_id ON public.leave_requests(branch_id);
CREATE INDEX idx_leave_requests_employee_id ON public.leave_requests(employee_id);
CREATE INDEX idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX idx_leave_requests_date_range ON public.leave_requests(start_date, end_date);
CREATE INDEX idx_leave_requests_approved_by ON public.leave_requests(approved_by);

-- ============================================================================
-- ENSURE CHART OF ACCOUNTS HAS HR ACCOUNT CODES
-- ============================================================================

-- Check if account codes exist, insert if missing
INSERT INTO public.chart_of_accounts (account_code, account_name, account_type)
SELECT '1000', 'Cash', 'ASSET'
WHERE NOT EXISTS (SELECT 1 FROM public.chart_of_accounts WHERE account_code = '1000');

INSERT INTO public.chart_of_accounts (account_code, account_name, account_type)
SELECT '2100', 'PAYE Tax Payable', 'LIABILITY'
WHERE NOT EXISTS (SELECT 1 FROM public.chart_of_accounts WHERE account_code = '2100');

INSERT INTO public.chart_of_accounts (account_code, account_name, account_type)
SELECT '2200', 'Pension Contributions Payable', 'LIABILITY'
WHERE NOT EXISTS (SELECT 1 FROM public.chart_of_accounts WHERE account_code = '2200');

INSERT INTO public.chart_of_accounts (account_code, account_name, account_type)
SELECT '5200', 'Salaries & Wages Expense', 'EXPENSE'
WHERE NOT EXISTS (SELECT 1 FROM public.chart_of_accounts WHERE account_code = '5200');

INSERT INTO public.chart_of_accounts (account_code, account_name, account_type)
SELECT '5300', 'Employee Benefits Expense', 'EXPENSE'
WHERE NOT EXISTS (SELECT 1 FROM public.chart_of_accounts WHERE account_code = '5300');

-- ============================================================================
-- DATA CONSISTENCY CHECKS
-- ============================================================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER employees_update_timestamp
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- SEED DEFAULT DATA
-- ============================================================================

-- Seed departments for each branch (if not already seeded)
INSERT INTO public.departments (branch_id, name, description)
SELECT b.id, 'Finance', 'Finance & Accounting Department'
FROM public.branches b
WHERE NOT EXISTS (SELECT 1 FROM public.departments WHERE branch_id = b.id AND name = 'Finance')
ON CONFLICT DO NOTHING;

INSERT INTO public.departments (branch_id, name, description)
SELECT b.id, 'Operations', 'Operations & Management Department'
FROM public.branches b
WHERE NOT EXISTS (SELECT 1 FROM public.departments WHERE branch_id = b.id AND name = 'Operations')
ON CONFLICT DO NOTHING;

INSERT INTO public.departments (branch_id, name, description)
SELECT b.id, 'Sales', 'Sales & Marketing Department'
FROM public.branches b
WHERE NOT EXISTS (SELECT 1 FROM public.departments WHERE branch_id = b.id AND name = 'Sales')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VIEWS FOR HR REPORTING
-- ============================================================================

-- Employee Summary View
CREATE OR REPLACE VIEW v_employee_summary AS
SELECT
  e.id,
  e.branch_id,
  e.employee_code,
  (e.first_name || ' ' || e.last_name) as full_name,
  e.email,
  e.phone,
  COALESCE(d.name, 'Unassigned') as department,
  e."position",
  e.hire_date,
  e.status,
  EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.hire_date)) as years_employed,
  COALESCE(ss.basic_salary, 0) as basic_salary,
  COALESCE(ss.pension_rate, 10.00) as pension_rate,
  e.created_at
FROM public.employees e
LEFT JOIN public.departments d ON e.department_id = d.id
LEFT JOIN public.salary_structures ss ON e.id = ss.employee_id
  AND ss.effective_date <= CURRENT_DATE
  AND (ss.end_date IS NULL OR ss.end_date > CURRENT_DATE)
ORDER BY e.employee_code;

-- Payroll Summary View
CREATE OR REPLACE VIEW v_payroll_summary AS
SELECT
  pr.id,
  pr.branch_id,
  pr.month,
  pr.year,
  pr.status,
  COUNT(DISTINCT pd.employee_id) as employee_count,
  SUM(pd.basic_salary) as total_basic,
  SUM(pd.allowances) as total_allowances,
  SUM(pd.gross_salary) as total_gross,
  SUM(pd.paye_tax) as total_paye,
  SUM(pd.pension_contribution) as total_pension,
  SUM(pd.other_deductions) as total_other,
  SUM(pd.net_salary) as total_net,
  pr.run_date,
  pr.processed_by,
  pr.created_at
FROM public.payroll_runs pr
LEFT JOIN public.payroll_deductions pd ON pr.id = pd.payroll_run_id
GROUP BY pr.id, pr.branch_id, pr.month, pr.year, pr.status, pr.run_date, pr.processed_by, pr.created_at;

-- Attendance Summary View
CREATE OR REPLACE VIEW v_attendance_summary AS
SELECT
  EXTRACT(YEAR FROM attendance_date)::INTEGER as year,
  EXTRACT(MONTH FROM attendance_date)::INTEGER as month,
  branch_id,
  employee_id,
  COUNT(*) as total_days,
  SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) as present_days,
  SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END) as absent_days,
  SUM(CASE WHEN status = 'LEAVE' THEN 1 ELSE 0 END) as leave_days,
  SUM(CASE WHEN status = 'SICK' THEN 1 ELSE 0 END) as sick_days,
  ROUND(100.0 * SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) /
    NULLIF(COUNT(*), 0), 2) as attendance_rate_percent
FROM public.attendance
GROUP BY year, month, branch_id, employee_id;

-- Leave Balance View
CREATE OR REPLACE VIEW v_leave_balance AS
SELECT
  e.id,
  e.branch_id,
  e.employee_code,
  (e.first_name || ' ' || e.last_name) as full_name,
  lt.name as leave_type,
  lt.days_per_year,
  COALESCE(SUM(CASE WHEN lr.status = 'APPROVED' THEN lr.days_requested ELSE 0 END), 0) as days_taken,
  (lt.days_per_year - COALESCE(SUM(CASE WHEN lr.status = 'APPROVED' THEN lr.days_requested ELSE 0 END), 0)) as days_remaining
FROM public.employees e
CROSS JOIN public.leave_types lt
LEFT JOIN public.leave_requests lr ON e.id = lr.employee_id
  AND lr.leave_type_id = lt.id
  AND lr.status = 'APPROVED'
  AND EXTRACT(YEAR FROM lr.start_date) = EXTRACT(YEAR FROM CURRENT_DATE)
GROUP BY e.id, e.branch_id, e.employee_code, e.first_name, e.last_name, lt.id, lt.name, lt.days_per_year;

-- ============================================================================
-- AUTO-UPDATE TIMESTAMP FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for all tables with updated_at
DROP TRIGGER IF EXISTS departments_update_timestamp ON public.departments;
CREATE TRIGGER departments_update_timestamp
BEFORE UPDATE ON public.departments
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS employees_update_timestamp ON public.employees;
CREATE TRIGGER employees_update_timestamp
BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS salary_structures_update_timestamp ON public.salary_structures;
CREATE TRIGGER salary_structures_update_timestamp
BEFORE UPDATE ON public.salary_structures
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS payroll_runs_update_timestamp ON public.payroll_runs;
CREATE TRIGGER payroll_runs_update_timestamp
BEFORE UPDATE ON public.payroll_runs
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS payroll_deductions_update_timestamp ON public.payroll_deductions;
CREATE TRIGGER payroll_deductions_update_timestamp
BEFORE UPDATE ON public.payroll_deductions
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS attendance_update_timestamp ON public.attendance;
CREATE TRIGGER attendance_update_timestamp
BEFORE UPDATE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS leave_requests_update_timestamp ON public.leave_requests;
CREATE TRIGGER leave_requests_update_timestamp
BEFORE UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- SCHEMA CREATION COMPLETE
-- ============================================================================
--
-- Tables created (multi-tenant):
--  1. departments (with branch_id)
--  2. leave_types (organization-wide)
--  3. employees (with branch_id)
--  4. tax_rules (organization-wide)
--  5. salary_structures
--  6. payroll_runs (with branch_id)
--  7. payroll_deductions
--  8. attendance (with branch_id)
--  9. leave_requests (with branch_id)
--
-- Views created:
--  - v_employee_summary: Employee directory with current salary
--  - v_payroll_summary: Monthly payroll with totals
--  - v_attendance_summary: Monthly attendance metrics
--  - v_leave_balance: Leave taken vs available
--
-- Ready for: supabase-hr-functions.sql (RPC functions)
-- ============================================================================
