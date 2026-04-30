-- ============================================================================
-- ZAI FLOW 2.0 - CLEANUP DUPLICATE RPC FUNCTIONS
-- Removes old function versions that are causing overloading conflicts
-- ============================================================================

-- Drop all versions of functions that have duplicates
-- The v2 versions (with UUID parameters) are the correct ones

DROP FUNCTION IF EXISTS public.get_user_accessible_modules(text, INTEGER);
DROP FUNCTION IF EXISTS public.check_function_access(text, INTEGER, text);
DROP FUNCTION IF EXISTS public.check_action_access(text, INTEGER, text, text);
DROP FUNCTION IF EXISTS public.get_user_roles(text, INTEGER);
DROP FUNCTION IF EXISTS public.assign_user_role(text, text, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.remove_user_role(text, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.get_user_tasks(text, INTEGER, text);
DROP FUNCTION IF EXISTS public.get_unread_notifications(text, INTEGER);
DROP FUNCTION IF EXISTS public.create_notification(text, INTEGER, text, text, text, text, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_user_profile(text);

-- Verify only UUID versions remain
SELECT
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as parameters
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'get_user_accessible_modules',
    'check_function_access',
    'check_action_access',
    'get_user_roles',
    'assign_user_role',
    'remove_user_role',
    'get_user_tasks',
    'get_unread_notifications',
    'create_notification',
    'get_user_profile'
  )
ORDER BY p.proname;
