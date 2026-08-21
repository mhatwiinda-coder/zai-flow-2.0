-- ============================================================================
-- EMPLOYEE PROFILE FIELDS + SELF-SERVICE PROFILE RPCs
-- ============================================================================
-- Adds the personalisation fields employees maintain themselves, stored on
-- `employees` - the canonical HR record - so anything an employee updates
-- auto-populates their HR profile rather than living in a separate copy.
--
-- The employee landing page is user-centric (users.id) while HR is
-- employee-centric (employees.id). These are bridged on email, which is the
-- same link item 4 needs for "is this person already onboarded in HR?".
--
-- Safe to re-run: every statement is guarded.
-- ============================================================================


-- ============================================================================
-- STEP 1: Profile columns on employees
-- ============================================================================
ALTER TABLE public.employees
  -- Identity / personalisation
  ADD COLUMN IF NOT EXISTS avatar_url                     TEXT,
  ADD COLUMN IF NOT EXISTS preferred_name                 TEXT,
  ADD COLUMN IF NOT EXISTS personal_email                 TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth                  DATE,
  ADD COLUMN IF NOT EXISTS gender                         TEXT,
  ADD COLUMN IF NOT EXISTS marital_status                 TEXT,
  ADD COLUMN IF NOT EXISTS nationality                    TEXT,
  ADD COLUMN IF NOT EXISTS address                        TEXT,
  ADD COLUMN IF NOT EXISTS city                           TEXT,
  -- Emergency contact / next of kin
  ADD COLUMN IF NOT EXISTS emergency_contact_name         TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone        TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT,
  -- Preferences
  ADD COLUMN IF NOT EXISTS theme_preference               TEXT DEFAULT 'dark',
  ADD COLUMN IF NOT EXISTS notification_prefs             JSONB DEFAULT
    '{"task_assigned":true,"leave_status":true,"clock_in_reminder":true,"payroll_ready":true}'::JSONB,
  ADD COLUMN IF NOT EXISTS profile_updated_at             TIMESTAMPTZ;

-- Email is how a login is matched to an HR record, so it needs to be fast
-- and case-insensitive.
CREATE INDEX IF NOT EXISTS idx_employees_email_lower
  ON public.employees (LOWER(email));


-- ============================================================================
-- STEP 2: Fetch the signed-in user's own employee profile
-- ============================================================================
-- Matched on email (case-insensitive). Returns no row when the person has a
-- login but has never been onboarded into HR - the landing page shows a
-- "profile not linked" state rather than failing.
DROP FUNCTION IF EXISTS public.get_my_employee_profile(TEXT);
CREATE OR REPLACE FUNCTION public.get_my_employee_profile(p_email TEXT)
RETURNS TABLE (
  employee_id INTEGER,
  branch_id INTEGER,
  employee_code TEXT,
  first_name TEXT,
  last_name TEXT,
  preferred_name TEXT,
  email TEXT,
  personal_email TEXT,
  phone TEXT,
  "position" TEXT,
  department_id INTEGER,
  department_name TEXT,
  hire_date DATE,
  status TEXT,
  avatar_url TEXT,
  date_of_birth DATE,
  gender TEXT,
  marital_status TEXT,
  nationality TEXT,
  address TEXT,
  city TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relationship TEXT,
  theme_preference TEXT,
  notification_prefs JSONB
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id, e.branch_id, e.employee_code, e.first_name, e.last_name,
    e.preferred_name, e.email, e.personal_email, e.phone, e."position",
    e.department_id, d.name,
    e.hire_date, e.status, e.avatar_url,
    e.date_of_birth, e.gender, e.marital_status, e.nationality,
    e.address, e.city,
    e.emergency_contact_name, e.emergency_contact_phone, e.emergency_contact_relationship,
    e.theme_preference, e.notification_prefs
  FROM public.employees e
  LEFT JOIN public.departments d ON d.id = e.department_id
  WHERE LOWER(e.email) = LOWER(TRIM(p_email))
  LIMIT 1;
END;
$$;


-- ============================================================================
-- STEP 3: Update the signed-in user's own profile
-- ============================================================================
-- Deliberately limited to self-service fields. An employee cannot change their
-- own position, salary, department, employee_code or status - those stay with
-- HR. NULL means "leave unchanged", so the page can send partial updates.
DROP FUNCTION IF EXISTS public.update_my_employee_profile(
  TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB);
CREATE OR REPLACE FUNCTION public.update_my_employee_profile(
  p_email                          TEXT,
  p_preferred_name                 TEXT DEFAULT NULL,
  p_personal_email                 TEXT DEFAULT NULL,
  p_phone                          TEXT DEFAULT NULL,
  p_avatar_url                     TEXT DEFAULT NULL,
  p_date_of_birth                  DATE DEFAULT NULL,
  p_gender                         TEXT DEFAULT NULL,
  p_marital_status                 TEXT DEFAULT NULL,
  p_nationality                    TEXT DEFAULT NULL,
  p_address                        TEXT DEFAULT NULL,
  p_city                           TEXT DEFAULT NULL,
  p_emergency_contact_name         TEXT DEFAULT NULL,
  p_emergency_contact_phone        TEXT DEFAULT NULL,
  p_emergency_contact_relationship TEXT DEFAULT NULL,
  p_theme_preference               TEXT DEFAULT NULL,
  p_notification_prefs             JSONB DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, message TEXT, employee_id INTEGER)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_employee_id INTEGER;
BEGIN
  SELECT e.id INTO v_employee_id
  FROM public.employees e
  WHERE LOWER(e.email) = LOWER(TRIM(p_email))
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RETURN QUERY SELECT FALSE,
      'No HR employee record is linked to this email. Ask HR to onboard you.'::TEXT,
      NULL::INTEGER;
    RETURN;
  END IF;

  -- Guard against oversized avatars. Images are resized client-side to ~256px
  -- (typically 20-40KB); this is a backstop against someone posting a raw
  -- multi-megabyte photo straight into the row.
  IF p_avatar_url IS NOT NULL AND LENGTH(p_avatar_url) > 500000 THEN
    RETURN QUERY SELECT FALSE,
      'Profile image is too large. Please choose a smaller image.'::TEXT,
      v_employee_id;
    RETURN;
  END IF;

  UPDATE public.employees e SET
    preferred_name                 = COALESCE(p_preferred_name,                 e.preferred_name),
    personal_email                 = COALESCE(p_personal_email,                 e.personal_email),
    phone                          = COALESCE(p_phone,                          e.phone),
    avatar_url                     = COALESCE(p_avatar_url,                     e.avatar_url),
    date_of_birth                  = COALESCE(p_date_of_birth,                  e.date_of_birth),
    gender                         = COALESCE(p_gender,                         e.gender),
    marital_status                 = COALESCE(p_marital_status,                 e.marital_status),
    nationality                    = COALESCE(p_nationality,                    e.nationality),
    address                        = COALESCE(p_address,                        e.address),
    city                           = COALESCE(p_city,                           e.city),
    emergency_contact_name         = COALESCE(p_emergency_contact_name,         e.emergency_contact_name),
    emergency_contact_phone        = COALESCE(p_emergency_contact_phone,        e.emergency_contact_phone),
    emergency_contact_relationship = COALESCE(p_emergency_contact_relationship, e.emergency_contact_relationship),
    theme_preference               = COALESCE(p_theme_preference,               e.theme_preference),
    notification_prefs             = COALESCE(p_notification_prefs,             e.notification_prefs),
    profile_updated_at             = NOW(),
    updated_at                     = NOW()
  WHERE e.id = v_employee_id;

  RETURN QUERY SELECT TRUE, 'Profile updated'::TEXT, v_employee_id;
END;
$$;


-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'employees'
  AND column_name IN ('avatar_url','preferred_name','emergency_contact_name',
                      'theme_preference','notification_prefs')
ORDER BY column_name;
-- Expect 5 rows.

-- Who has a login but NO HR record? (preview of item 4's reconciliation)
SELECT u.id AS user_id, u.name, u.email, u.role
FROM public.users u
LEFT JOIN public.employees e ON LOWER(e.email) = LOWER(u.email)
WHERE e.id IS NULL
ORDER BY u.name;
