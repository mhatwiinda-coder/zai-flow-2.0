-- ============================================================================
-- DIAGNOSE: "Could not find the function public.get_daily_attendance"
-- ============================================================================
-- Run each section separately - the Supabase editor only shows the LAST result.
-- ============================================================================


-- ============================================================================
-- Q0: EVERYTHING IN ONE RESULT SET - run this alone, it answers Q1 + Q2
-- ============================================================================
-- The editor only renders the LAST statement's result, so running this file
-- top-to-bottom hides Q1/Q2 behind Q4. This single query returns the tables,
-- columns, functions and constraints that get_daily_attendance depends on -
-- plus the employee-profile objects from ADD_HR_EMPLOYEE_PROFILE.sql, since
-- whether that migration landed is the same question one step later. Nothing
-- here errors if a table is missing; it reports ">>> MISSING" instead.
WITH tabs AS (
  -- Reports MISSING explicitly, rather than leaving you to notice an absent row.
  SELECT 'table: ' || t AS item,
         CASE WHEN to_regclass('public.' || t) IS NULL THEN '>>> MISSING' ELSE 'exists' END AS detail
  FROM unnest(ARRAY['attendance','employees','departments','users',
                    'employee_employment_history','employee_performance_reviews',
                    'employee_disciplinary_records','employee_training_records',
                    'employee_documents','employee_medical_records',
                    'employee_profile_access_log','employee_tasks','notifications']) AS t
),
cols AS (
  SELECT 'column: ' || table_name || '.' || column_name AS item,
         data_type || CASE WHEN is_nullable = 'YES' THEN ' (nullable)' ELSE ' (not null)' END AS detail
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('attendance', 'employees', 'departments')
    AND column_name IN ('branch_id','business_id','clock_in','clock_out',
                        'attendance_date','employee_id','status','hours_worked',
                        'notes','department_id','manager_user_id','email','employee_code')
),
fns AS (
  SELECT 'function: ' || p.proname AS item,
         pg_get_function_identity_arguments(p.oid) AS detail
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND (p.proname LIKE '%attendance%'
         OR p.proname IN ('zf_uuid_to_user_id','zf_is_admin','zf_resolve_employee',
                          'clock_in','clock_out','send_task_to_employee',
                          'get_employee_profile','get_employee_medical_records',
                          'add_disciplinary_record','add_performance_review',
                          'add_training_record'))
),
cons AS (
  SELECT 'constraint: ' || c.conrelid::regclass::TEXT AS item,
         pg_get_constraintdef(c.oid) AS detail
  FROM pg_constraint c
  WHERE c.conrelid = to_regclass('public.attendance')
    AND c.contype IN ('p', 'u')
)
SELECT * FROM tabs
UNION ALL SELECT * FROM cols
UNION ALL SELECT * FROM fns
UNION ALL SELECT * FROM cons
ORDER BY item;


-- ============================================================================
-- Q1: Do the prerequisite COLUMNS exist?
-- ============================================================================
-- get_daily_attendance selects a.clock_in / a.clock_out. Those are added by
-- FIX_CLOCK_IN_HR_INTEGRATION.sql (STEP 0). If they're missing, creating the
-- function fails with "column a.clock_in does not exist" and you end up with
-- exactly the PGRST202 error the app is showing.
SELECT
  COUNT(*) FILTER (WHERE column_name = 'clock_in')  AS has_clock_in,
  COUNT(*) FILTER (WHERE column_name = 'clock_out') AS has_clock_out,
  COUNT(*) FILTER (WHERE column_name = 'branch_id') AS has_branch_id
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'attendance';
-- All three must be 1. If clock_in/clock_out are 0, run
-- FIX_CLOCK_IN_HR_INTEGRATION.sql, THEN re-run ADD_MISSED_CLOCKIN_ALERTS.sql.


-- ============================================================================
-- Q2: Which of the new functions actually got created?
-- ============================================================================
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (
    p.proname IN (
      'zf_uuid_to_user_id','zf_is_admin','zf_resolve_employee',
      'clock_in','clock_out','get_attendance_status',
      'get_daily_attendance','raise_missed_clockin_alerts',
      'set_attendance_status','send_task_to_employee',
      'get_employee_profile','get_employee_medical_records'
    )
    -- Catch near-miss names too. PostgREST's "perhaps you meant
    -- get_business_attendance(p_branch_id, p_date)" hint implies the live DB
    -- carries an attendance function this list never knew about - and with
    -- branch params under a business-era name, which is the kind of drift
    -- that makes the tracked .sql files untrustworthy on their own.
    OR p.proname LIKE '%attendance%'
  )
ORDER BY p.proname;
-- Anything absent from this list did not get created.
-- zf_uuid_to_user_id / zf_is_admin come from APPROVAL_WORKFLOW_FUNCTIONS.sql
-- and MUST exist before ADD_MISSED_CLOCKIN_ALERTS.sql and
-- ADD_HR_EMPLOYEE_PROFILE.sql will succeed.


-- ============================================================================
-- Q3: Force PostgREST to reload its schema cache
-- ============================================================================
-- Supabase caches the API schema. A function can exist in Postgres yet still
-- 404 through the REST API until the cache refreshes. This is harmless to run
-- even if the cache is already current.
NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- Q4: Prove it works from the database side
-- ============================================================================
-- If this returns rows (or an empty set) rather than an error, the function
-- exists and the problem was purely the API cache.
-- Replace 1 with a real branch_id.
SELECT * FROM public.get_daily_attendance(1, CURRENT_DATE);
