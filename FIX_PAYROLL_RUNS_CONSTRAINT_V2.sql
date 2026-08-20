-- ============================================================================
-- FIX v2: Directly drop the exact stale constraint by name
-- ============================================================================
-- The previous fix (FIX_PAYROLL_RUNS_CONSTRAINT.sql) tried to auto-detect
-- the stale constraint dynamically, but it evidently didn't match - the
-- error still references "payroll_runs_month_year_key" by that exact name
-- after running it. This targets it directly instead of guessing.
-- ============================================================================

-- STEP 1: See exactly what unique constraints currently exist (run this
-- first and check the output before continuing, out of curiosity/records -
-- the DROP below is safe either way since it uses IF EXISTS)
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.payroll_runs'::regclass AND contype = 'u';

-- STEP 2: Drop the stale constraint by its exact reported name
ALTER TABLE public.payroll_runs DROP CONSTRAINT IF EXISTS payroll_runs_month_year_key;

-- STEP 3: Also drop it in case it exists as a plain unique INDEX rather
-- than a named constraint (belt and suspenders - harmless if it doesn't exist)
DROP INDEX IF EXISTS public.payroll_runs_month_year_key;

-- STEP 4: Ensure the correct per-branch composite constraint exists
ALTER TABLE public.payroll_runs
  DROP CONSTRAINT IF EXISTS unique_payroll_per_branch;
ALTER TABLE public.payroll_runs
  ADD CONSTRAINT unique_payroll_per_branch UNIQUE (branch_id, month, year);

-- ============================================================================
-- VERIFICATION - run this and paste the result back
-- ============================================================================
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.payroll_runs'::regclass AND contype = 'u';
-- Should show EXACTLY ONE row now: unique_payroll_per_branch, UNIQUE (branch_id, month, year)
-- If you still see payroll_runs_month_year_key here, paste the full result back to me.
