-- ============================================================================
-- FIX: payroll_runs has a stale global UNIQUE(month, year) constraint
-- ============================================================================
-- Same drift pattern as the earlier departments fix: the live table still
-- has a constraint from before branch_id scoping was added (payroll_runs
-- has branch_id NOT NULL and the schema file already specifies the correct
-- UNIQUE(branch_id, month, year) - but the live constraint was never
-- migrated). This blocks running payroll for a second branch in any month
-- a different branch already processed, e.g. "duplicate key value violates
-- unique constraint payroll_runs_month_year_key".
-- ============================================================================

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  -- Find any UNIQUE or unique-index constraint on payroll_runs that does NOT
  -- include branch_id (i.e. is scoped too broadly)
  SELECT con.conname INTO v_constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'payroll_runs'
    AND con.contype = 'u'
    AND con.conname != 'unique_payroll_per_branch'
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(con.conkey) AS colnum
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = colnum
      WHERE att.attname = 'branch_id'
    );

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.payroll_runs DROP CONSTRAINT %I', v_constraint_name);
    RAISE NOTICE 'Dropped stale payroll_runs constraint: %', v_constraint_name;
  ELSE
    RAISE NOTICE 'No stale non-branch-scoped unique constraint found on payroll_runs';
  END IF;
END $$;

-- Ensure the correct per-branch composite constraint exists
ALTER TABLE public.payroll_runs
  DROP CONSTRAINT IF EXISTS unique_payroll_per_branch;
ALTER TABLE public.payroll_runs
  ADD CONSTRAINT unique_payroll_per_branch UNIQUE (branch_id, month, year);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.payroll_runs'::regclass AND contype = 'u';
-- Should show exactly one row: unique_payroll_per_branch, UNIQUE (branch_id, month, year)
