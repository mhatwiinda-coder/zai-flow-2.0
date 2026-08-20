-- ============================================================================
-- FIX: Payroll reversal + allow re-running a reversed period
-- ============================================================================
-- Two problems, both blocking the "reverse then re-run payroll" workflow that
-- you need in order to include newly-added employees in an existing period.
--
-- PROBLEM 1 - reverse_payroll() could reverse ANOTHER BRANCH's journal entry.
--   It located the GL entry to reverse by matching
--   reference = 'PAYROLL-YYYYMM' with NO branch filter, then took
--   ORDER BY created_at DESC LIMIT 1. Every branch generates that exact same
--   reference string for a given month, so it grabbed whichever branch
--   happened to post most recently. It also created the reversing
--   journal_entries/journal_lines rows with NO branch_id, producing exactly
--   the kind of orphaned GL rows that were polluting reports earlier.
--   Fix: use payroll_runs.journal_entry_id (already stored by
--   process_payroll) and stamp branch_id on the reversal rows.
--
-- PROBLEM 2 - the UNIQUE(branch_id, month, year) constraint added in
--   FIX_PAYROLL_RUNS_CONSTRAINT.sql was too strict. A REVERSED run stays in
--   the table, so re-running the same period hit a duplicate key error.
--   process_payroll's own duplicate check already ignores REVERSED rows
--   ("AND status != 'REVERSED'"), so the database constraint must match that
--   intent: a PARTIAL unique index that excludes reversed runs.
-- ============================================================================

-- ============================================================================
-- STEP 1: Replace the too-strict constraint with a partial unique index
-- ============================================================================
ALTER TABLE public.payroll_runs
  DROP CONSTRAINT IF EXISTS unique_payroll_per_branch;

-- Belt and suspenders: also clear the old global one if it somehow returned
ALTER TABLE public.payroll_runs
  DROP CONSTRAINT IF EXISTS payroll_runs_month_year_key;

DROP INDEX IF EXISTS public.idx_payroll_runs_unique_active;
CREATE UNIQUE INDEX idx_payroll_runs_unique_active
  ON public.payroll_runs (branch_id, month, year)
  WHERE status != 'REVERSED';

-- ============================================================================
-- STEP 2: Correct, branch-safe payroll reversal
-- ============================================================================
DROP FUNCTION IF EXISTS public.reverse_payroll(INTEGER);
CREATE OR REPLACE FUNCTION public.reverse_payroll(p_payroll_run_id INTEGER)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_payroll_run RECORD;
  v_journal_line RECORD;
  v_new_journal_id INTEGER;
BEGIN
  SELECT * INTO v_payroll_run
  FROM public.payroll_runs
  WHERE id = p_payroll_run_id;

  IF v_payroll_run IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Payroll run not found'::TEXT;
    RETURN;
  END IF;

  IF v_payroll_run.status = 'REVERSED' THEN
    RETURN QUERY SELECT FALSE, 'Payroll run is already reversed'::TEXT;
    RETURN;
  END IF;

  -- Reverse the GL entry using the stored journal_entry_id - NOT a lookup by
  -- reference string, which is identical across branches for a given month.
  IF v_payroll_run.journal_entry_id IS NOT NULL THEN
    INSERT INTO public.journal_entries (reference, description, branch_id)
    SELECT
      'PAYROLL-REV-' || v_payroll_run.year || LPAD(v_payroll_run.month::TEXT, 2, '0'),
      'Reversal of ' || COALESCE(je.description, 'payroll run ' || p_payroll_run_id),
      v_payroll_run.branch_id
    FROM public.journal_entries je
    WHERE je.id = v_payroll_run.journal_entry_id
    RETURNING id INTO v_new_journal_id;

    -- Mirror each line with debit/credit swapped, stamped with the branch
    FOR v_journal_line IN
      SELECT * FROM public.journal_lines
      WHERE journal_id = v_payroll_run.journal_entry_id
    LOOP
      INSERT INTO public.journal_lines (journal_id, account_id, debit, credit, branch_id)
      VALUES (v_new_journal_id, v_journal_line.account_id,
              v_journal_line.credit, v_journal_line.debit,
              v_payroll_run.branch_id);
    END LOOP;
  END IF;

  UPDATE public.payroll_runs
  SET status = 'REVERSED'
  WHERE id = p_payroll_run_id;

  RETURN QUERY SELECT TRUE, 'Payroll run reversed successfully'::TEXT;
END;
$$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Confirm only the partial index remains (reversed runs may coexist):
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'payroll_runs' AND indexdef ILIKE '%UNIQUE%';
-- Expect idx_payroll_runs_unique_active ... WHERE (status <> 'REVERSED'::text)

SELECT conname FROM pg_constraint
WHERE conrelid = 'public.payroll_runs'::regclass AND contype = 'u';
-- Expect ZERO rows (the partial index replaces the constraint)
