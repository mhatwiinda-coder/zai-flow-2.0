-- ============================================================================
-- ZAI FLOW 2.0 - ROLE-BASED ACCESS CONTROL (RBAC) SYSTEM
-- Complete role, permission, and function registry schema
-- ============================================================================

-- ============================================================================
-- 1. ROLES TABLE - Define all roles in the system
-- ============================================================================
DROP TABLE IF EXISTS public.roles CASCADE;
CREATE TABLE public.roles (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  hierarchy_level INTEGER NOT NULL DEFAULT 99,
  -- Lower number = higher privilege (0=admin, 99=lowest)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.roles (code, name, description, hierarchy_level) VALUES
  ('admin', 'Administrator', 'Full system access, can manage all modules and users', 0),
  ('manager', 'Manager', 'Can access most modules, manage their team', 20),
  ('supervisor', 'Supervisor', 'Can supervise operations, limited modifications', 40),
  ('cashier', 'Cashier', 'Can operate POS and cash drawer only', 70),
  ('inventory_staff', 'Inventory Staff', 'Can manage inventory and stock', 70),
  ('hr_staff', 'HR Staff', 'Can manage HR and payroll', 70),
  ('procurement_staff', 'Procurement Staff', 'Can manage purchasing and suppliers', 70),
  ('employee', 'Employee', 'Basic access - can clock in/out and view own data', 99);

-- ============================================================================
-- 2. FUNCTIONS TABLE - Registry of all ERP functions/modules
-- ============================================================================
DROP TABLE IF EXISTS public.functions CASCADE;
CREATE TABLE public.functions (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  module TEXT NOT NULL,
  -- Module: 'sales', 'inventory', 'accounting', 'hr_payroll', 'purchasing', 'dashboard'
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  url TEXT,
  -- URL path for the module (e.g., '/frontend/sales.html')
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.functions (code, module, name, description, icon, url) VALUES
  ('dashboard', 'dashboard', 'Dashboard', 'Main dashboard - KPIs and overview', '📊', 'dashboard.html'),
  ('sales_pos', 'sales', 'Point of Sale (POS)', 'Manage sales transactions', '🛒', 'sales.html'),
  ('sales_reports', 'sales', 'Sales Reports', 'View sales analytics', '📈', 'bi.html'),

  ('inventory_products', 'inventory', 'Product Inventory', 'Manage products and stock', '📦', 'inventory.html'),
  ('inventory_movements', 'inventory', 'Stock Movements', 'Track inventory movements', '↔️', 'inventory.html'),

  ('accounting_ledger', 'accounting', 'General Ledger', 'View financial transactions', '📋', 'accounting.html'),
  ('accounting_reports', 'accounting', 'Financial Reports', 'P&L, Balance Sheet, Trial Balance', '📊', 'accounting.html'),
  ('accounting_journal', 'accounting', 'Journal Entries', 'Create and manage journal entries', '✏️', 'accounting.html'),

  ('hr_employees', 'hr_payroll', 'Employee Directory', 'Manage employees and records', '👥', 'hr.html'),
  ('hr_payroll', 'hr_payroll', 'Payroll Processing', 'Run payroll cycles', '💰', 'hr.html'),
  ('hr_attendance', 'hr_payroll', 'Attendance Tracking', 'Track employee attendance', '📅', 'hr.html'),
  ('hr_leave', 'hr_payroll', 'Leave Management', 'Manage leave requests', '🏖️', 'hr.html'),

  ('purchasing_po', 'purchasing', 'Purchase Orders', 'Create and manage POs', '📄', 'purchasing.html'),
  ('purchasing_suppliers', 'purchasing', 'Supplier Management', 'Manage suppliers', '🏢', 'purchasing.html'),
  ('purchasing_invoices', 'purchasing', 'Purchase Invoices', 'Manage supplier invoices', '💳', 'purchasing.html'),
  ('purchasing_payments', 'purchasing', 'Supplier Payments', 'Track supplier payments', '💵', 'purchasing.html');

-- ============================================================================
-- 3. FUNCTION ACTIONS TABLE - Define what actions are available per function
-- ============================================================================
DROP TABLE IF EXISTS public.function_actions CASCADE;
CREATE TABLE public.function_actions (
  id SERIAL PRIMARY KEY,
  function_id INTEGER NOT NULL REFERENCES public.functions(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  -- Actions: view, create, edit, delete, approve, export
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(function_id, action)
);

-- Insert default actions for each function
INSERT INTO public.function_actions (function_id, action, description)
SELECT id, 'view', 'Can view this function' FROM public.functions
UNION ALL
SELECT id, 'create', 'Can create new records' FROM public.functions WHERE code NOT LIKE '%reports%'
UNION ALL
SELECT id, 'edit', 'Can edit existing records' FROM public.functions WHERE code NOT LIKE '%reports%'
UNION ALL
SELECT id, 'delete', 'Can delete records' FROM public.functions WHERE code NOT LIKE '%reports%'
UNION ALL
SELECT id, 'approve', 'Can approve transactions' FROM public.functions WHERE code IN ('accounting_journal', 'purchasing_po', 'hr_payroll')
UNION ALL
SELECT id, 'export', 'Can export data' FROM public.functions WHERE code LIKE '%reports%';

-- ============================================================================
-- 4. ROLE_FUNCTIONS TABLE - Maps which roles can access which functions
-- ============================================================================
DROP TABLE IF EXISTS public.role_functions CASCADE;
CREATE TABLE public.role_functions (
  id SERIAL PRIMARY KEY,
  role_id INTEGER NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  function_id INTEGER NOT NULL REFERENCES public.functions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, function_id)
);

-- ============================================================================
-- 5. ROLE_FUNCTION_ACTIONS TABLE - Fine-grained permission control
-- ============================================================================
DROP TABLE IF EXISTS public.role_function_actions CASCADE;
CREATE TABLE public.role_function_actions (
  id SERIAL PRIMARY KEY,
  role_id INTEGER NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  function_id INTEGER NOT NULL REFERENCES public.functions(id) ON DELETE CASCADE,
  action_id INTEGER NOT NULL REFERENCES public.function_actions(id) ON DELETE CASCADE,
  allowed BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, function_id, action_id)
);

-- ============================================================================
-- 6. USER_ROLES TABLE - Assign roles to users (supports multi-role)
-- ============================================================================
DROP TABLE IF EXISTS public.user_roles CASCADE;
CREATE TABLE public.user_roles (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  business_id INTEGER NOT NULL REFERENCES public.business_entities(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID,
  UNIQUE(user_id, business_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_business ON public.user_roles(business_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role_id);

-- ============================================================================
-- 7. EMPLOYEE_ATTENDANCE TABLE - Clock in/out tracking
-- ============================================================================
DROP TABLE IF EXISTS public.employee_attendance CASCADE;
CREATE TABLE public.employee_attendance (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  business_id INTEGER NOT NULL REFERENCES public.business_entities(id) ON DELETE CASCADE,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  hours_worked NUMERIC(5, 2),
  status TEXT DEFAULT 'ACTIVE',
  -- ACTIVE, BREAK, OFFLINE
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_user ON public.employee_attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_business ON public.employee_attendance(business_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.employee_attendance(clock_in);

-- ============================================================================
-- 8. EMPLOYEE_TASKS TABLE - Task/todo management
-- ============================================================================
DROP TABLE IF EXISTS public.employee_tasks CASCADE;
CREATE TABLE public.employee_tasks (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  business_id INTEGER NOT NULL REFERENCES public.business_entities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  priority TEXT DEFAULT 'NORMAL',
  -- LOW, NORMAL, HIGH, URGENT
  status TEXT DEFAULT 'TODO',
  -- TODO, IN_PROGRESS, COMPLETED, CANCELLED
  assigned_to UUID,
  assigned_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user ON public.employee_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_business ON public.employee_tasks(business_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.employee_tasks(status);

-- ============================================================================
-- 9. NOTIFICATIONS TABLE - System notifications
-- ============================================================================
DROP TABLE IF EXISTS public.notifications CASCADE;
CREATE TABLE public.notifications (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  business_id INTEGER NOT NULL REFERENCES public.business_entities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info',
  -- info, warning, error, success
  action_url TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at);

-- ============================================================================
-- DEFAULT ROLE ASSIGNMENTS
-- ============================================================================

-- Admin role gets all functions with all actions
INSERT INTO public.role_functions (role_id, function_id)
SELECT (SELECT id FROM public.roles WHERE code = 'admin'), id FROM public.functions;

-- Manager gets all except admin functions
INSERT INTO public.role_functions (role_id, function_id)
SELECT (SELECT id FROM public.roles WHERE code = 'manager'), id FROM public.functions
WHERE code NOT IN ('admin_settings', 'admin_users');

-- Supervisor gets sales, inventory, hr (read only)
INSERT INTO public.role_functions (role_id, function_id)
SELECT (SELECT id FROM public.roles WHERE code = 'supervisor'), id FROM public.functions
WHERE module IN ('sales', 'inventory', 'dashboard');

-- Cashier gets POS only
INSERT INTO public.role_functions (role_id, function_id)
SELECT (SELECT id FROM public.roles WHERE code = 'cashier'), id FROM public.functions
WHERE code IN ('sales_pos', 'dashboard');

-- Inventory Staff gets inventory modules
INSERT INTO public.role_functions (role_id, function_id)
SELECT (SELECT id FROM public.roles WHERE code = 'inventory_staff'), id FROM public.functions
WHERE module IN ('inventory', 'dashboard');

-- HR Staff gets HR modules
INSERT INTO public.role_functions (role_id, function_id)
SELECT (SELECT id FROM public.roles WHERE code = 'hr_staff'), id FROM public.functions
WHERE module IN ('hr_payroll', 'dashboard');

-- Procurement Staff gets purchasing modules
INSERT INTO public.role_functions (role_id, function_id)
SELECT (SELECT id FROM public.roles WHERE code = 'procurement_staff'), id FROM public.functions
WHERE module IN ('purchasing', 'dashboard');

-- Employee gets dashboard only
INSERT INTO public.role_functions (role_id, function_id)
SELECT (SELECT id FROM public.roles WHERE code = 'employee'), id FROM public.functions
WHERE code = 'dashboard';

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Tables created:
-- 1. roles - All available roles
-- 2. functions - All ERP modules/functions
-- 3. function_actions - What actions are possible (view, create, edit, delete, approve)
-- 4. role_functions - Which roles can access which functions
-- 5. role_function_actions - Fine-grained permission control per action
-- 6. user_roles - Assign roles to users (multi-role support)
-- 7. employee_attendance - Clock in/out tracking
-- 8. employee_tasks - Task/todo management
-- 9. notifications - System notifications
-- ============================================================================
