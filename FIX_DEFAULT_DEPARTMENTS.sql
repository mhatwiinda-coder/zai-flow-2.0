-- ============================================================================
-- FIX: Auto-seed default departments for every branch
-- ============================================================================
-- Problem: New branches have zero rows in `departments`, so the HR "Add/Edit
-- Employee" modal shows an empty "Select Department" dropdown.
-- Fix: (1) backfill standard departments for every existing branch that has
-- none, and (2) add a trigger so every NEW branch gets them automatically.
-- ============================================================================

-- ============================================================================
-- STEP 0: FIX SCHEMA DRIFT - the live table has a leftover global
-- UNIQUE(name) constraint from before multi-tenancy was added, instead of
-- the correct per-branch UNIQUE(branch_id, name). This blocks the same
-- department name (e.g. "Human Resources") from existing in two branches.
-- ============================================================================
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Find and drop any single-column UNIQUE constraint on departments.name
  SELECT con.conname INTO v_constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'departments'
    AND con.contype = 'u'
    AND con.conname != 'unique_dept_per_branch'
    AND array_length(con.conkey, 1) = 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.departments DROP CONSTRAINT %I', v_constraint_name);
    RAISE NOTICE 'Dropped stale constraint: %', v_constraint_name;
  END IF;
END $$;

-- Ensure the correct per-branch composite constraint exists
ALTER TABLE public.departments
  DROP CONSTRAINT IF EXISTS unique_dept_per_branch;
ALTER TABLE public.departments
  ADD CONSTRAINT unique_dept_per_branch UNIQUE (branch_id, name);

-- ============================================================================
-- STEP 1: BACKFILL - seed standard departments for branches that have none
-- ============================================================================
INSERT INTO public.departments (branch_id, name, description)
SELECT b.id, d.name, d.description
FROM public.branches b
CROSS JOIN (VALUES
  ('Human Resources', 'HR, payroll, and staff administration'),
  ('Sales', 'Sales and point-of-sale operations'),
  ('Accounting', 'Bookkeeping, GL, and financial reporting'),
  ('Purchasing', 'Procurement and supplier management'),
  ('Inventory', 'Stock and warehouse management'),
  ('Administration', 'General management and operations')
) AS d(name, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.departments existing WHERE existing.branch_id = b.id
);

-- Verify backfill
SELECT b.name AS branch_name, COUNT(d.id) AS department_count
FROM public.branches b
LEFT JOIN public.departments d ON d.branch_id = b.id
GROUP BY b.id, b.name
ORDER BY b.name;

-- ============================================================================
-- STEP 2: TRIGGER - auto-seed departments whenever a new branch is created
-- ============================================================================
CREATE OR REPLACE FUNCTION public.seed_default_departments()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.departments (branch_id, name, description)
  VALUES
    (NEW.id, 'Human Resources', 'HR, payroll, and staff administration'),
    (NEW.id, 'Sales', 'Sales and point-of-sale operations'),
    (NEW.id, 'Accounting', 'Bookkeeping, GL, and financial reporting'),
    (NEW.id, 'Purchasing', 'Procurement and supplier management'),
    (NEW.id, 'Inventory', 'Stock and warehouse management'),
    (NEW.id, 'Administration', 'General management and operations')
  ON CONFLICT (branch_id, name) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_seed_default_departments ON public.branches;
CREATE TRIGGER trg_seed_default_departments
  AFTER INSERT ON public.branches
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_departments();

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Every branch should now show 6 departments:
SELECT b.id, b.name, COUNT(d.id) AS departments
FROM public.branches b
LEFT JOIN public.departments d ON d.branch_id = b.id
GROUP BY b.id, b.name
HAVING COUNT(d.id) = 0;
-- Should return ZERO rows (no branch without departments)
