-- ============================================================================
-- ZAI FLOW 2.0 - POPULATE auth_id FROM SUPABASE AUTH
-- Maps database users to their Supabase Auth UUIDs
-- Run this AFTER FIX-UUID-INTEGER-MISMATCH.sql
-- ============================================================================

-- Update users table to populate auth_id from Supabase Auth by matching email
UPDATE public.users u
SET auth_id = au.id
FROM auth.users au
WHERE u.email = au.email
  AND u.auth_id IS NULL;

-- Verify the mapping
SELECT
  u.id as db_user_id,
  u.name,
  u.email,
  u.auth_id,
  'OK' as status
FROM public.users u
WHERE u.auth_id IS NOT NULL
ORDER BY u.id;

-- Show any users without auth_id (potential issues)
SELECT
  u.id as db_user_id,
  u.name,
  u.email,
  'WARNING: No auth_id mapped' as status
FROM public.users u
WHERE u.auth_id IS NULL
ORDER BY u.id;

-- Verify user_roles still has correct data
SELECT COUNT(*) as total_role_assignments FROM public.user_roles;
SELECT user_id, COUNT(*) as role_count FROM public.user_roles GROUP BY user_id;
