-- ============================================================================
-- FIX: Add missing branch_id column to attendance and leave_requests
-- ============================================================================
-- An earlier migration (supabase-hr-multi-tenant-fix.sql) added business_id
-- to these two tables, from a design phase before the module settled on
-- branch_id as the tenant-scoping column everywhere else (employees,
-- departments, payroll_runs all already use branch_id and work correctly).
-- attendance and leave_requests never got the same branch_id column added,
-- so every query/RPC that filters them by branch_id fails with
-- "column ... branch_id does not exist".
-- ============================================================================

-- ============================================================================
-- STEP 1: attendance.branch_id
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance' AND column_name = 'branch_id'
  ) THEN
    ALTER TABLE public.attendance ADD COLUMN branch_id INTEGER REFERENCES public.branches(id) ON DELETE CASCADE;

    -- Backfill from the employee's branch (employees.branch_id already exists and is reliable)
    UPDATE public.attendance a
    SET branch_id = e.branch_id
    FROM public.employees e
    WHERE a.employee_id = e.id AND a.branch_id IS NULL;

    ALTER TABLE public.attendance ALTER COLUMN branch_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_attendance_branch_id ON public.attendance(branch_id);

    RAISE NOTICE 'branch_id added to attendance and backfilled';
  ELSE
    RAISE NOTICE 'attendance.branch_id already exists';
  END IF;
END $$;

-- Fix the unique constraint to include branch_id (drop any stale
-- (employee_id, attendance_date)-only constraint left over from before)
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT con.conname INTO v_constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'attendance'
    AND con.contype = 'u'
    AND con.conname != 'unique_attendance_per_day';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.attendance DROP CONSTRAINT %I', v_constraint_name);
    RAISE NOTICE 'Dropped stale attendance constraint: %', v_constraint_name;
  END IF;
END $$;

ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS unique_attendance_per_day;
ALTER TABLE public.attendance ADD CONSTRAINT unique_attendance_per_day UNIQUE (branch_id, employee_id, attendance_date);

-- ============================================================================
-- STEP 2: leave_requests.branch_id
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leave_requests' AND column_name = 'branch_id'
  ) THEN
    ALTER TABLE public.leave_requests ADD COLUMN branch_id INTEGER REFERENCES public.branches(id) ON DELETE CASCADE;

    UPDATE public.leave_requests lr
    SET branch_id = e.branch_id
    FROM public.employees e
    WHERE lr.employee_id = e.id AND lr.branch_id IS NULL;

    ALTER TABLE public.leave_requests ALTER COLUMN branch_id SET NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_leave_requests_branch_id ON public.leave_requests(branch_id);

    RAISE NOTICE 'branch_id added to leave_requests and backfilled';
  ELSE
    RAISE NOTICE 'leave_requests.branch_id already exists';
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT table_name, column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name IN ('attendance', 'leave_requests') AND column_name = 'branch_id';
-- Should return 2 rows, both is_nullable = 'NO'

-- Confirm no orphaned rows (employee had no branch_id to backfill from)
SELECT 'attendance' AS table_name, COUNT(*) AS orphaned FROM public.attendance WHERE branch_id IS NULL
UNION ALL
SELECT 'leave_requests', COUNT(*) FROM public.leave_requests WHERE branch_id IS NULL;
-- Should show 0 for both
