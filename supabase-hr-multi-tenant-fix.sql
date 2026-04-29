-- ============================================================================
-- ZAI FLOW 2.0 - HR MODULE MULTI-TENANT FIX
-- Add business_id to HR tables for proper multi-tenancy filtering
-- Run this in Supabase SQL Editor AFTER supabase-schema-hr.sql
-- ============================================================================

-- ============================================================================
-- PRE-CHECK: Ensure HR tables exist
-- ============================================================================
-- This script assumes employees table exists with branch_id column
-- If you get "column e.branch_id does not exist" error, run supabase-schema-hr.sql first!

-- ============================================================================
-- STEP 1: Add business_id column to employees table
-- ============================================================================
DO $$
BEGIN
  -- Check if employees table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employees') THEN
    -- Add business_id column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'employees' AND column_name = 'business_id'
    ) THEN
      ALTER TABLE public.employees
      ADD COLUMN business_id INTEGER REFERENCES public.business_entities(id) ON DELETE CASCADE;

      -- Create index for performance
      CREATE INDEX idx_employees_business_id ON public.employees(business_id);

      -- Populate business_id from branch relationship
      UPDATE public.employees e
      SET business_id = b.business_id
      FROM public.branches b
      WHERE e.branch_id = b.id AND e.business_id IS NULL;

      RAISE NOTICE 'business_id column added to employees and populated';
    ELSE
      RAISE NOTICE 'business_id column already exists in employees';
    END IF;
  ELSE
    RAISE NOTICE 'employees table does not exist - run supabase-schema-hr.sql first!';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Add business_id column to payroll_runs table
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payroll_runs') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'payroll_runs' AND column_name = 'business_id'
    ) THEN
      ALTER TABLE public.payroll_runs
      ADD COLUMN business_id INTEGER REFERENCES public.business_entities(id) ON DELETE CASCADE;

      CREATE INDEX idx_payroll_runs_business_id ON public.payroll_runs(business_id);

      UPDATE public.payroll_runs pr
      SET business_id = b.business_id
      FROM public.branches b
      WHERE pr.branch_id = b.id AND pr.business_id IS NULL;

      RAISE NOTICE 'business_id column added to payroll_runs and populated';
    ELSE
      RAISE NOTICE 'business_id column already exists in payroll_runs';
    END IF;
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Add business_id column to payroll_deductions table
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payroll_deductions') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'payroll_deductions' AND column_name = 'business_id'
    ) THEN
      ALTER TABLE public.payroll_deductions
      ADD COLUMN business_id INTEGER REFERENCES public.business_entities(id) ON DELETE CASCADE;

      CREATE INDEX idx_payroll_deductions_business_id ON public.payroll_deductions(business_id);

      UPDATE public.payroll_deductions pd
      SET business_id = e.business_id
      FROM public.employees e
      WHERE pd.employee_id = e.id AND pd.business_id IS NULL;

      RAISE NOTICE 'business_id column added to payroll_deductions and populated';
    ELSE
      RAISE NOTICE 'business_id column already exists in payroll_deductions';
    END IF;
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Add business_id column to attendance table
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attendance') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'attendance' AND column_name = 'business_id'
    ) THEN
      ALTER TABLE public.attendance
      ADD COLUMN business_id INTEGER REFERENCES public.business_entities(id) ON DELETE CASCADE;

      CREATE INDEX idx_attendance_business_id ON public.attendance(business_id);

      UPDATE public.attendance a
      SET business_id = e.business_id
      FROM public.employees e
      WHERE a.employee_id = e.id AND a.business_id IS NULL;

      RAISE NOTICE 'business_id column added to attendance and populated';
    ELSE
      RAISE NOTICE 'business_id column already exists in attendance';
    END IF;
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Add business_id column to leave_requests table
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leave_requests') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'leave_requests' AND column_name = 'business_id'
    ) THEN
      ALTER TABLE public.leave_requests
      ADD COLUMN business_id INTEGER REFERENCES public.business_entities(id) ON DELETE CASCADE;

      CREATE INDEX idx_leave_requests_business_id ON public.leave_requests(business_id);

      UPDATE public.leave_requests lr
      SET business_id = e.business_id
      FROM public.employees e
      WHERE lr.employee_id = e.id AND lr.business_id IS NULL;

      RAISE NOTICE 'business_id column added to leave_requests and populated';
    ELSE
      RAISE NOTICE 'business_id column already exists in leave_requests';
    END IF;
  END IF;
END $$;

-- ============================================================================
-- STEP 6: Verify the updates
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employees') THEN
    RAISE NOTICE '=== VERIFICATION RESULTS ===';
    PERFORM count(*) FROM (
      SELECT COUNT(*) as total_employees,
             COUNT(business_id) as employees_with_business_id
      FROM public.employees
    ) AS emp_check;
    RAISE NOTICE 'Employee migration complete';
  END IF;
END $$;
