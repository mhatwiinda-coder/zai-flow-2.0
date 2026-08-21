-- ============================================================================
-- LINK admin@zai.com TO THE EXISTING "MAINZA HATWIINDA" EMPLOYEE RECORD
-- ============================================================================
-- admin@zai.com is a real, actively-used login (Head of Operations on the
-- default business) - not a leftover seed account as first assumed. The
-- employee record for Mainza Hatwiinda (employee_code 01, position "HEAD
-- OPERATIONS") already exists but its email doesn't match admin@zai.com,
-- which is why the identity bridge didn't recognise them as the same person.
--
-- Fixing the email match here means ONBOARD_UNLINKED_USERS_TO_HR.sql will
-- correctly SKIP this user instead of creating a duplicate "SYS-49 / Admin
-- User" record. Run this BEFORE that script's Step 2.
-- ============================================================================


-- ============================================================================
-- STEP 1: CONFIRM - is this really the same person, and is there any conflict?
-- ============================================================================
-- What email does the employee record currently have?
SELECT id, employee_code, first_name, last_name, email, "position", branch_id, business_id
FROM public.employees
WHERE employee_code = '01' OR (first_name ILIKE 'Mainza' AND last_name ILIKE 'Hatwiinda');

-- What does the user record look like?
SELECT id, name, email, role, business_id
FROM public.users
WHERE email = 'admin@zai.com';

-- Safety check: does any OTHER employee already have this email? (should be 0 rows)
SELECT id, employee_code, first_name, last_name, email
FROM public.employees
WHERE LOWER(email) = LOWER('admin@zai.com');


-- ============================================================================
-- STEP 2: LINK - only run after confirming Step 1 looks right
-- ============================================================================
-- Update the EXACT employee row by id - fill in the id from Step 1's first
-- query before running (replace <EMPLOYEE_ID> below).
--
-- UPDATE public.employees
-- SET email = 'admin@zai.com'
-- WHERE id = <EMPLOYEE_ID>;


-- ============================================================================
-- STEP 3: VERIFY
-- ============================================================================
-- Should now show exactly one row: Mainza Hatwiinda linked to admin@zai.com.
SELECT e.id, e.employee_code, e.first_name, e.last_name, e.email, e."position"
FROM public.employees e
JOIN public.users u ON LOWER(u.email) = LOWER(e.email)
WHERE u.email = 'admin@zai.com';

-- Re-run the original reconciliation - admin@zai.com should now be GONE from
-- this list (still expect the other 3 @zai.com demo accounts, Carol, Sarah).
SELECT u.id AS user_id, u.name, u.email, u.role
FROM public.users u
LEFT JOIN public.employees e ON LOWER(e.email) = LOWER(u.email)
WHERE e.id IS NULL
ORDER BY u.name;
