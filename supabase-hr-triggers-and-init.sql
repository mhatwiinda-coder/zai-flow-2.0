-- ============================================================================
-- ZAI FLOW 2.0 - HR Auto-Creation Triggers & Initialization
-- Auto-creates employee records when users are created
-- Auto-creates default departments for businesses
-- ============================================================================

-- ============================================================================
-- FUNCTION: Auto-create employee record when user is created
-- ============================================================================
DROP FUNCTION IF EXISTS create_employee_from_user();
CREATE OR REPLACE FUNCTION create_employee_from_user()
RETURNS TRIGGER AS $$
DECLARE
  v_branch_id INTEGER;
  v_employee_code TEXT;
  v_next_emp_num INTEGER;
BEGIN
  -- Get the primary branch for this user
  SELECT branch_id INTO v_branch_id
  FROM public.user_branch_access
  WHERE user_id = NEW.id AND status = 'ACTIVE'
  LIMIT 1;

  -- If no branch found, get the first branch of the business
  IF v_branch_id IS NULL THEN
    SELECT b.id INTO v_branch_id
    FROM public.branches b
    WHERE b.business_id = NEW.business_id
    LIMIT 1;
  END IF;

  -- If still no branch, exit gracefully
  IF v_branch_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Generate employee code (EMP-YYYYMMDD-XXXX)
  SELECT COUNT(*) + 1 INTO v_next_emp_num
  FROM public.employees
  WHERE branch_id = v_branch_id;

  v_employee_code := 'EMP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(v_next_emp_num::TEXT, 4, '0');

  -- Create employee record
  INSERT INTO public.employees (
    branch_id,
    employee_code,
    first_name,
    last_name,
    email,
    "position",
    hire_date,
    status
  ) VALUES (
    v_branch_id,
    v_employee_code,
    COALESCE(SPLIT_PART(NEW.name, ' ', 1), 'New'),
    COALESCE(SPLIT_PART(NEW.name, ' ', 2), 'Employee'),
    NEW.email,
    NEW.role,
    CURRENT_DATE,
    'ACTIVE'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Call auto-employee creation on user insert
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_create_employee_on_user_create ON public.users;
CREATE TRIGGER trigger_create_employee_on_user_create
AFTER INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION create_employee_from_user();

-- ============================================================================
-- FUNCTION: Initialize default departments for a business
-- ============================================================================
DROP FUNCTION IF EXISTS init_default_departments(INTEGER);
CREATE OR REPLACE FUNCTION init_default_departments(p_branch_id INTEGER)
RETURNS TABLE(department_id INTEGER, department_name TEXT) AS $$
DECLARE
  v_dept_id INTEGER;
BEGIN
  -- Create Management department
  INSERT INTO public.departments (branch_id, name, description)
  VALUES (p_branch_id, 'Management', 'Executive and management staff')
  ON CONFLICT (branch_id, name) DO NOTHING
  RETURNING id INTO v_dept_id;
  RETURN QUERY SELECT v_dept_id, 'Management'::TEXT;

  -- Create Finance department
  INSERT INTO public.departments (branch_id, name, description)
  VALUES (p_branch_id, 'Finance', 'Accounting and financial management')
  ON CONFLICT (branch_id, name) DO NOTHING
  RETURNING id INTO v_dept_id;
  RETURN QUERY SELECT v_dept_id, 'Finance'::TEXT;

  -- Create HR department
  INSERT INTO public.departments (branch_id, name, description)
  VALUES (p_branch_id, 'Human Resources', 'HR and recruitment')
  ON CONFLICT (branch_id, name) DO NOTHING
  RETURNING id INTO v_dept_id;
  RETURN QUERY SELECT v_dept_id, 'Human Resources'::TEXT;

  -- Create Sales department
  INSERT INTO public.departments (branch_id, name, description)
  VALUES (p_branch_id, 'Sales', 'Sales and business development')
  ON CONFLICT (branch_id, name) DO NOTHING
  RETURNING id INTO v_dept_id;
  RETURN QUERY SELECT v_dept_id, 'Sales'::TEXT;

  -- Create Operations department
  INSERT INTO public.departments (branch_id, name, description)
  VALUES (p_branch_id, 'Operations', 'Operations and logistics')
  ON CONFLICT (branch_id, name) DO NOTHING
  RETURNING id INTO v_dept_id;
  RETURN QUERY SELECT v_dept_id, 'Operations'::TEXT;

  -- Create Customer Service department
  INSERT INTO public.departments (branch_id, name, description)
  VALUES (p_branch_id, 'Customer Service', 'Customer support and relations')
  ON CONFLICT (branch_id, name) DO NOTHING
  RETURNING id INTO v_dept_id;
  RETURN QUERY SELECT v_dept_id, 'Customer Service'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INITIALIZATION: Create default departments for existing branches
-- ============================================================================
-- Run this to initialize departments for all existing branches
DO $$
DECLARE
  v_branch RECORD;
BEGIN
  FOR v_branch IN SELECT id FROM public.branches LOOP
    PERFORM init_default_departments(v_branch.id);
  END LOOP;
  RAISE NOTICE 'Default departments initialized for all branches';
END $$;

-- ============================================================================
-- AUTO-CREATE: Create employee records for users without them
-- ============================================================================
-- This ensures existing users get employee records
DO $$
DECLARE
  v_user RECORD;
  v_branch_id INTEGER;
  v_employee_code TEXT;
  v_next_emp_num INTEGER;
BEGIN
  FOR v_user IN
    SELECT u.id, u.name, u.email, u.role, u.business_id
    FROM public.users u
    WHERE NOT EXISTS (
      SELECT 1 FROM public.employees e WHERE e.email = u.email
    )
  LOOP
    -- Get the primary branch for this user
    SELECT branch_id INTO v_branch_id
    FROM public.user_branch_access
    WHERE user_id = v_user.id AND status = 'ACTIVE'
    LIMIT 1;

    -- If no branch, get first branch of business
    IF v_branch_id IS NULL THEN
      SELECT id INTO v_branch_id
      FROM public.branches
      WHERE business_id = v_user.business_id
      LIMIT 1;
    END IF;

    -- If branch found, create employee
    IF v_branch_id IS NOT NULL THEN
      SELECT COUNT(*) + 1 INTO v_next_emp_num
      FROM public.employees
      WHERE branch_id = v_branch_id;

      v_employee_code := 'EMP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(v_next_emp_num::TEXT, 4, '0');

      INSERT INTO public.employees (
        branch_id,
        employee_code,
        first_name,
        last_name,
        email,
        "position",
        hire_date,
        status
      ) VALUES (
        v_branch_id,
        v_employee_code,
        COALESCE(SPLIT_PART(v_user.name, ' ', 1), 'New'),
        COALESCE(SPLIT_PART(v_user.name, ' ', 2), 'Employee'),
        v_user.email,
        v_user.role,
        CURRENT_DATE,
        'ACTIVE'
      );
    END IF;
  END LOOP;
  RAISE NOTICE 'Employee records created for existing users';
END $$;

-- ============================================================================
-- HR INITIALIZATION COMPLETE
-- ============================================================================
