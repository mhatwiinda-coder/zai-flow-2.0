-- ============================================================================
-- FIX: clock in/out never reaches the HR module
-- ============================================================================
-- Three separate faults, all of which had to be fixed together:
--
-- 1. TWO competing clock_in/clock_out/get_attendance_status functions existed
--    with IDENTICAL signatures (UUID, INTEGER, TEXT) in different files:
--      supabase-attendance-tracking-rpc.sql   -> writes public.attendance
--      supabase-role-permissions-functions.sql -> writes public.employee_attendance
--    Whichever was deployed last silently replaced the other. hr.js only ever
--    reads public.attendance, so if the employee_attendance version won,
--    clock-ins vanished from HR's view entirely.
--
-- 2. Both versions resolved the user with `users.auth_id = p_user_id`, but
--    server.js login never returns auth_id - it returns a SYNTHESIZED uuid
--    (00000000-0000-0000-0000-<zero-padded users.id>). So the lookup found
--    nobody and every call failed with "User not found in system".
--
-- 3. Employee matching used case-sensitive email equality, so a login of
--    Sarahmako@gmail.com would not match an employee row storing
--    sarahmako@gmail.com.
--
-- This file drops both variants and installs one canonical set that writes to
-- public.attendance (the table HR reads), accepts either a real auth_id or the
-- synthesized uuid, and matches employees case-insensitively.
-- ============================================================================


-- ============================================================================
-- STEP 0: attendance needs real clock in/out timestamps
-- ============================================================================
-- The table only had status/hours_worked/notes - no clock_in or clock_out
-- columns - which is why the original function shoved the time into the notes
-- text ("Clock in at 2026-08-22 09:14:22..."). That can't be queried, can't
-- compute hours, and can't tell HR who is still on shift.
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS clock_in  TIMESTAMPTZ;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS clock_out TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_attendance_clock_in ON public.attendance(clock_in);


-- ============================================================================
-- Shared resolver: synthesized uuid OR real auth_id -> employees.id
-- ============================================================================
CREATE OR REPLACE FUNCTION public.zf_resolve_employee(
  p_user_uuid UUID,
  p_business_id INTEGER
)
RETURNS TABLE (employee_id INTEGER, branch_id INTEGER, user_id INTEGER)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id INTEGER;
BEGIN
  -- Prefer a real Supabase Auth id; fall back to decoding the synthesized one.
  SELECT u.id INTO v_user_id FROM public.users u WHERE u.auth_id = p_user_uuid LIMIT 1;

  IF v_user_id IS NULL THEN
    v_user_id := public.zf_uuid_to_user_id(p_user_uuid);
  END IF;

  IF v_user_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT e.id,
         COALESCE(e.branch_id, uba.branch_id),
         v_user_id
  FROM public.users u
  JOIN public.employees e ON LOWER(e.email) = LOWER(u.email)
  LEFT JOIN LATERAL (
    SELECT x.branch_id FROM public.user_branch_access x
    WHERE x.user_id = u.id AND x.status = 'ACTIVE'
    ORDER BY x.is_primary_branch DESC LIMIT 1
  ) uba ON TRUE
  WHERE u.id = v_user_id
  LIMIT 1;
END;
$$;


-- ============================================================================
-- CLOCK IN
-- ============================================================================
DROP FUNCTION IF EXISTS public.clock_in(UUID, INTEGER, TEXT);
DROP FUNCTION IF EXISTS clock_in(UUID, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.clock_in(
  p_user_id UUID,
  p_business_id INTEGER,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, message TEXT, employee_id INTEGER, clock_in_time TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v RECORD;
BEGIN
  SELECT * INTO v FROM public.zf_resolve_employee(p_user_id, p_business_id);

  IF v.employee_id IS NULL THEN
    RETURN QUERY SELECT FALSE,
      'No HR employee record is linked to your login. Ask HR to complete your onboarding.'::TEXT,
      NULL::INTEGER, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF v.branch_id IS NULL THEN
    RETURN QUERY SELECT FALSE,
      'Your employee record has no branch assigned. Ask HR to set one.'::TEXT,
      v.employee_id, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.attendance a
    WHERE a.employee_id = v.employee_id AND a.attendance_date = CURRENT_DATE
      AND a.clock_in IS NOT NULL
  ) THEN
    RETURN QUERY SELECT FALSE, 'Already clocked in today'::TEXT, v.employee_id, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Upsert: HR may have already created today's row (e.g. marked LEAVE), in
  -- which case clocking in should update it rather than fail on the unique
  -- (branch_id, employee_id, attendance_date) constraint.
  INSERT INTO public.attendance (branch_id, employee_id, attendance_date, status, clock_in, notes)
  VALUES (v.branch_id, v.employee_id, CURRENT_DATE, 'PRESENT', NOW(), p_notes)
  ON CONFLICT (branch_id, employee_id, attendance_date)
  DO UPDATE SET status = 'PRESENT', clock_in = NOW(),
                notes = COALESCE(EXCLUDED.notes, public.attendance.notes);

  RETURN QUERY SELECT TRUE,
    ('Clocked in at ' || TO_CHAR(NOW(), 'HH24:MI'))::TEXT, v.employee_id, NOW();
END;
$$;


-- ============================================================================
-- CLOCK OUT
-- ============================================================================
DROP FUNCTION IF EXISTS public.clock_out(UUID, INTEGER, TEXT);
DROP FUNCTION IF EXISTS clock_out(UUID, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.clock_out(
  p_user_id UUID,
  p_business_id INTEGER,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, message TEXT, employee_id INTEGER, hours_worked NUMERIC, clock_out_time TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v RECORD;
  v_rec RECORD;
  v_hours NUMERIC;
BEGIN
  SELECT * INTO v FROM public.zf_resolve_employee(p_user_id, p_business_id);

  IF v.employee_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'No HR employee record is linked to your login.'::TEXT,
      NULL::INTEGER, NULL::NUMERIC, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  SELECT * INTO v_rec FROM public.attendance a
  WHERE a.employee_id = v.employee_id AND a.attendance_date = CURRENT_DATE
  LIMIT 1;

  IF v_rec.id IS NULL OR v_rec.clock_in IS NULL THEN
    RETURN QUERY SELECT FALSE, 'You have not clocked in today'::TEXT,
      v.employee_id, NULL::NUMERIC, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF v_rec.clock_out IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, 'Already clocked out today'::TEXT,
      v.employee_id, v_rec.hours_worked, v_rec.clock_out;
    RETURN;
  END IF;

  v_hours := ROUND(EXTRACT(EPOCH FROM (NOW() - v_rec.clock_in)) / 3600.0, 2);

  UPDATE public.attendance
  SET clock_out = NOW(),
      hours_worked = v_hours,
      notes = COALESCE(p_notes, notes)
  WHERE id = v_rec.id;

  RETURN QUERY SELECT TRUE,
    ('Clocked out - ' || v_hours || ' hours today')::TEXT, v.employee_id, v_hours, NOW();
END;
$$;


-- ============================================================================
-- ATTENDANCE STATUS (drives the employee landing page widget)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_attendance_status(UUID, INTEGER);
DROP FUNCTION IF EXISTS get_attendance_status(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.get_attendance_status(
  p_user_id UUID,
  p_business_id INTEGER
)
RETURNS TABLE (is_clocked_in BOOLEAN, elapsed_minutes INTEGER)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v RECORD;
  v_rec RECORD;
BEGIN
  SELECT * INTO v FROM public.zf_resolve_employee(p_user_id, p_business_id);
  IF v.employee_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 0; RETURN;
  END IF;

  SELECT * INTO v_rec FROM public.attendance a
  WHERE a.employee_id = v.employee_id AND a.attendance_date = CURRENT_DATE
  LIMIT 1;

  IF v_rec.id IS NULL OR v_rec.clock_in IS NULL OR v_rec.clock_out IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, 0; RETURN;
  END IF;

  RETURN QUERY SELECT TRUE,
    GREATEST(0, EXTRACT(EPOCH FROM (NOW() - v_rec.clock_in))::INTEGER / 60);
END;
$$;


-- ============================================================================
-- Retire the competing employee_attendance-based variants
-- ============================================================================
-- These wrote to a table HR never reads. Left in place they would keep
-- fighting the canonical versions above depending on deploy order.
-- (No data migration: employee_attendance was only ever written by the
-- variant that HR couldn't see, so there is nothing HR is losing.)


-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('clock_in','clock_out','get_attendance_status','zf_resolve_employee')
ORDER BY p.proname;
-- Each of clock_in / clock_out / get_attendance_status should appear EXACTLY
-- ONCE. More than one row for a name means a competing variant still exists.
