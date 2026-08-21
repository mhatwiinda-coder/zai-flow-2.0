-- ============================================================================
-- ONBOARD USERS WHO HAVE SYSTEM ACCESS BUT NO HR RECORD
-- ============================================================================
-- Creates an `employees` row for every user whose email doesn't already match
-- one, so nobody with a login is invisible to HR.
--
-- Created INACTIVE on purpose. process_payroll() pays every ACTIVE employee in
-- a branch, so onboarding people straight to ACTIVE would silently enrol them
-- in payroll at the K5,000 basic_salary default. HR reviews each record, sets a
-- real salary and department, then activates.
--
-- Idempotent - re-running creates nothing new.
-- ============================================================================


-- ============================================================================
-- STEP 1: PREVIEW - exactly what will be created. Run this on its own first.
-- ============================================================================
SELECT
  u.id AS user_id,
  u.name,
  u.email,
  u.role,
  COALESCE(u.business_id, br.business_id)             AS resolved_business_id,
  uba.branch_id                                       AS resolved_branch_id,
  br.name                                             AS branch_name,
  'SYS-' || u.id                                      AS proposed_employee_code,
  CASE
    WHEN COALESCE(u.business_id, br.business_id) IS NULL
      THEN 'SKIPPED - no business could be resolved'
    WHEN uba.branch_id IS NULL
      THEN 'will create, but NO BRANCH - HR screens filter by branch so it will not be listed until assigned'
    ELSE 'will create (INACTIVE)'
  END                                                 AS outcome
FROM public.users u
LEFT JOIN public.employees e
       ON LOWER(e.email) = LOWER(u.email)
LEFT JOIN LATERAL (
  SELECT x.branch_id
  FROM public.user_branch_access x
  WHERE x.user_id = u.id AND x.status = 'ACTIVE'
  ORDER BY x.is_primary_branch DESC, x.branch_id
  LIMIT 1
) uba ON TRUE
LEFT JOIN public.branches br ON br.id = uba.branch_id
WHERE e.id IS NULL
ORDER BY u.name;


-- ============================================================================
-- STEP 2: CREATE the HR records
-- ============================================================================
INSERT INTO public.employees (
  business_id, branch_id, employee_code,
  first_name, last_name, email,
  "position", hire_date, status
)
SELECT
  COALESCE(u.business_id, br.business_id),
  uba.branch_id,
  'SYS-' || u.id,
  -- Split "Firstname Lastname"; last_name is NOT NULL so fall back sensibly.
  COALESCE(NULLIF(SPLIT_PART(TRIM(u.name), ' ', 1), ''), 'Unknown'),
  COALESCE(
    NULLIF(TRIM(SUBSTRING(TRIM(u.name) FROM POSITION(' ' IN TRIM(u.name)))), ''),
    '-'
  ),
  u.email,
  -- position is NOT NULL - seed a readable title from the access role.
  INITCAP(REPLACE(COALESCE(u.role, 'employee'), '_', ' ')),
  -- hire_date is NOT NULL - use when the login was created where known.
  COALESCE(u.created_at::DATE, CURRENT_DATE),
  'INACTIVE'
FROM public.users u
LEFT JOIN public.employees e ON LOWER(e.email) = LOWER(u.email)
LEFT JOIN LATERAL (
  SELECT x.branch_id
  FROM public.user_branch_access x
  WHERE x.user_id = u.id AND x.status = 'ACTIVE'
  ORDER BY x.is_primary_branch DESC, x.branch_id
  LIMIT 1
) uba ON TRUE
LEFT JOIN public.branches br ON br.id = uba.branch_id
WHERE e.id IS NULL
  -- business_id is NOT NULL on employees; skip anyone we can't place.
  AND COALESCE(u.business_id, br.business_id) IS NOT NULL;


-- ============================================================================
-- STEP 3: VERIFY
-- ============================================================================
-- Everyone now linked? This should return ZERO rows.
SELECT u.id, u.name, u.email, u.role
FROM public.users u
LEFT JOIN public.employees e ON LOWER(e.email) = LOWER(u.email)
WHERE e.id IS NULL;

-- The newly created records, for HR to work through.
SELECT e.id, e.employee_code, e.first_name, e.last_name, e.email,
       e."position", e.status, e.branch_id, e.business_id, e.basic_salary
FROM public.employees e
WHERE e.employee_code LIKE 'SYS-%'
ORDER BY e.employee_code;

-- Sanity: nobody INACTIVE can be swept into payroll.
SELECT status, COUNT(*) FROM public.employees GROUP BY status;


-- ============================================================================
-- STEP 4 (OPTIONAL): retire the leftover demo logins
-- ============================================================================
-- You confirmed the four @zai.com accounts are leftover seed accounts.
-- admin@zai.com in particular still holds FULL ADMIN ACCESS - an unowned
-- administrator login is a standing security exposure, so it is worth closing
-- once you are certain nothing depends on it.
--
-- Review first:
SELECT u.id, u.name, u.email, u.role,
       (SELECT COUNT(*) FROM public.user_branch_access x WHERE x.user_id = u.id) AS branch_grants
FROM public.users u
WHERE u.email ILIKE '%@zai.com'
ORDER BY u.email;
--
-- Then, to revoke their access without deleting history, uncomment:
--
-- UPDATE public.user_branch_access
-- SET status = 'INACTIVE'
-- WHERE user_id IN (SELECT id FROM public.users WHERE email ILIKE '%@zai.com');
--
-- Deliberately left commented: make sure you are not signed in as one of these
-- accounts, and that a real admin account exists, before running it.
