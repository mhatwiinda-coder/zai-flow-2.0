-- ============================================================================
-- ONE-OFF: MERGE THE DUPLICATE "SYS-" EMPLOYEE RECORDS INTO THE REAL ONES
-- ============================================================================
-- ONBOARD_UNLINKED_USERS_TO_HR.sql was run before
-- LINK_ADMIN_TO_EXISTING_EMPLOYEE.sql, which is the exact scenario that file
-- warned about: users whose login email didn't match their existing HR record
-- got a second, auto-generated "SYS-<user id>" employee row. The result is two
-- rows for the same person:
--
--     01      MAINZA HATWIINDA    HEAD OPERATIONS   ACTIVE    <- real record
--     SYS-49  Admin User          Admin             INACTIVE  <- duplicate
--
--     02      LODIA CHIKAMBWE     HEAD SALES        ACTIVE    <- real record
--     SYS-50  Supervisor Supervisor  Supervisor     INACTIVE  <- duplicate
--
-- This merges each pair: the login email moves onto the real HR record (so the
-- users -> employees email bridge finally resolves), then the duplicate row is
-- removed. The `users` logins themselves are untouched - only the redundant HR
-- rows go.
--
-- SYS-51 (Inventory Officer) is deliberately NOT touched. It is a genuinely
-- unlinked login and goes through the normal onboarding workflow.
--
-- Run PART A first and read the output before running PART B.
-- ============================================================================


-- ============================================================================
-- PART A: VERIFY (read-only - run this on its own first)
-- ============================================================================

-- A1. The four rows in question, side by side. Confirm the pairing is right
--     and note which email each side currently holds.
SELECT employee_code, first_name, last_name, email, "position", status,
       branch_id, business_id, department_id
FROM public.employees
WHERE employee_code IN ('01', '02', 'SYS-49', 'SYS-50')
ORDER BY employee_code;

-- A2. The logins behind the SYS- rows. These stay; only the HR duplicates go.
SELECT id, name, email, role, business_id
FROM public.users
WHERE id IN (49, 50)
ORDER BY id;

-- A3. Does anything already reference the duplicate rows? Attendance, payroll,
--     leave, tasks - anything with a foreign key to employees. PART B moves
--     these onto the real record, but you want to know they exist first.
--     Zero rows here means the merge is a clean delete.
DROP TABLE IF EXISTS tmp_dup_refs;
CREATE TEMP TABLE tmp_dup_refs (
  referencing_table TEXT,
  referencing_column TEXT,
  duplicate_code TEXT,
  row_count BIGINT
);

DO $$
DECLARE
  v_fk  RECORD;
  v_dup RECORD;
  v_n   BIGINT;
BEGIN
  FOR v_dup IN
    SELECT id, employee_code FROM public.employees
    WHERE employee_code IN ('SYS-49', 'SYS-50')
  LOOP
    FOR v_fk IN
      SELECT c.conrelid::regclass::TEXT AS tbl, a.attname::TEXT AS col
      FROM pg_constraint c
      JOIN pg_attribute a
        ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
      WHERE c.contype = 'f'
        AND c.confrelid = 'public.employees'::regclass
    LOOP
      EXECUTE format('SELECT COUNT(*) FROM %s WHERE %I = $1', v_fk.tbl, v_fk.col)
        INTO v_n USING v_dup.id;

      IF v_n > 0 THEN
        INSERT INTO tmp_dup_refs
        VALUES (v_fk.tbl, v_fk.col, v_dup.employee_code, v_n);
      END IF;
    END LOOP;
  END LOOP;
END $$;

SELECT * FROM tmp_dup_refs ORDER BY referencing_table, duplicate_code;


-- ============================================================================
-- PART B: MERGE (writes - only after PART A looks right)
-- ============================================================================
-- Order matters: dependants are repointed, then the duplicate is deleted, then
-- the email is moved onto the real record. Freeing the email before reusing it
-- keeps this working whether or not employees.email carries a unique index.
--
-- Runs as one transaction: if any repoint collides with a unique constraint
-- (say both rows have attendance for the same day) the whole thing rolls back
-- rather than half-merging.

BEGIN;

DO $$
DECLARE
  v_pair      RECORD;
  v_fk        RECORD;
  v_dup_id    INTEGER;
  v_dup_email TEXT;
  v_real_id   INTEGER;
  v_moved     BIGINT;
BEGIN
  FOR v_pair IN
    SELECT * FROM (VALUES ('SYS-49', '01'), ('SYS-50', '02')) AS t(dup_code, real_code)
  LOOP
    SELECT id, email INTO v_dup_id, v_dup_email
    FROM public.employees WHERE employee_code = v_pair.dup_code;

    SELECT id INTO v_real_id
    FROM public.employees WHERE employee_code = v_pair.real_code;

    IF v_dup_id IS NULL OR v_real_id IS NULL THEN
      RAISE NOTICE 'Skipping % -> %: one side not found (already merged?)',
        v_pair.dup_code, v_pair.real_code;
      CONTINUE;
    END IF;

    FOR v_fk IN
      SELECT c.conrelid::regclass::TEXT AS tbl, a.attname::TEXT AS col
      FROM pg_constraint c
      JOIN pg_attribute a
        ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
      WHERE c.contype = 'f'
        AND c.confrelid = 'public.employees'::regclass
    LOOP
      EXECUTE format('UPDATE %s SET %I = $1 WHERE %I = $2', v_fk.tbl, v_fk.col, v_fk.col)
        USING v_real_id, v_dup_id;
      GET DIAGNOSTICS v_moved = ROW_COUNT;
      IF v_moved > 0 THEN
        RAISE NOTICE 'Moved % row(s) in %.% from % to %',
          v_moved, v_fk.tbl, v_fk.col, v_pair.dup_code, v_pair.real_code;
      END IF;
    END LOOP;

    DELETE FROM public.employees WHERE id = v_dup_id;

    UPDATE public.employees SET email = v_dup_email WHERE id = v_real_id;

    RAISE NOTICE 'Merged % into % and moved login email % onto it',
      v_pair.dup_code, v_pair.real_code, v_dup_email;
  END LOOP;
END $$;

COMMIT;


-- ============================================================================
-- PART C: VERIFY
-- ============================================================================

-- C1. The SYS-49 / SYS-50 rows are gone; 01 and 02 now carry the login emails.
SELECT employee_code, first_name, last_name, email, "position", status
FROM public.employees
WHERE employee_code IN ('01', '02', 'SYS-49', 'SYS-50')
ORDER BY employee_code;

-- C2. Both logins now resolve to exactly one HR record each.
SELECT u.id AS user_id, u.name AS login_name, u.email,
       e.employee_code, e.first_name || ' ' || e.last_name AS hr_record, e.status
FROM public.users u
JOIN public.employees e ON LOWER(e.email) = LOWER(u.email)
WHERE u.id IN (49, 50)
ORDER BY u.id;

-- C3. Who is still unlinked? Expect SYS-51's login and any other genuinely
--     un-onboarded user - and nobody who now has a real record.
SELECT u.id, u.name, u.email, u.role
FROM public.users u
LEFT JOIN public.employees e ON LOWER(e.email) = LOWER(u.email)
WHERE e.id IS NULL
ORDER BY u.name;
