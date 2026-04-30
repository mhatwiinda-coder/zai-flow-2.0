-- ============================================================================
-- ZAI FLOW 2.0 - FIX UUID-INTEGER USER ID MISMATCH (v2)
-- UPDATED: Uses p_user_id parameter name for frontend compatibility
-- This script resolves the core issue where RPC functions receive Supabase Auth
-- UUIDs from the frontend but the database uses INTEGER user_ids in user_roles
-- ============================================================================

-- ============================================================================
-- STEP 1: ADD auth_id COLUMN TO users TABLE
-- This stores the Supabase Auth UUID for lookup
-- ============================================================================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE;

-- ============================================================================
-- STEP 2: CREATE HELPER FUNCTION TO MAP UUID TO INTEGER user_id
-- This function looks up the INTEGER database user_id from Supabase Auth UUID
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_user_id_from_auth(UUID);
CREATE OR REPLACE FUNCTION public.get_user_id_from_auth(p_auth_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_user_id INTEGER;
BEGIN
  SELECT u.id INTO v_user_id
  FROM public.users u
  WHERE u.auth_id = p_auth_id
  LIMIT 1;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 3: UPDATE user_roles TABLE TO USE INTEGER user_id CONSISTENTLY
-- ============================================================================
-- Change the column type from UUID to INTEGER
-- First, drop dependent functions
DROP FUNCTION IF EXISTS public.get_user_accessible_modules(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.check_function_access(UUID, INTEGER, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.check_action_access(UUID, INTEGER, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_roles(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.assign_user_role(UUID, UUID, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.remove_user_role(UUID, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_tasks(UUID, INTEGER, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_unread_notifications(UUID, INTEGER) CASCADE;

-- Alter the column
ALTER TABLE public.user_roles
ALTER COLUMN user_id TYPE INTEGER USING user_id::INTEGER;

-- ============================================================================
-- STEP 4: RECREATE RPC FUNCTIONS WITH PROPER UUID-TO-INTEGER CONVERSION
-- IMPORTANT: Parameter names stay the same (p_user_id) for frontend compatibility
-- ============================================================================

-- ============================================================================
-- 1. GET USER ACCESSIBLE MODULES
-- Accepts p_user_id (Supabase Auth UUID from frontend) and converts to INTEGER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_accessible_modules(
  p_user_id UUID,
  p_business_id INTEGER
)
RETURNS TABLE (
  function_code TEXT,
  module TEXT,
  function_name TEXT,
  icon TEXT,
  url TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id INTEGER;
BEGIN
  -- Convert Supabase Auth UUID to database user_id
  v_user_id := public.get_user_id_from_auth(p_user_id);

  -- Return empty result if user not found
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT
    f.code,
    f.module,
    f.name,
    f.icon,
    f.url
  FROM public.functions f
  INNER JOIN public.role_functions rf ON rf.function_id = f.id
  INNER JOIN public.user_roles ur ON ur.role_id = rf.role_id
  WHERE ur.user_id = v_user_id
    AND ur.business_id = p_business_id
    AND ur.is_active = true
    AND f.is_active = true
  ORDER BY f.module, f.name;
END;
$$;

-- ============================================================================
-- 2. CHECK FUNCTION ACCESS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_function_access(
  p_user_id UUID,
  p_business_id INTEGER,
  p_function_code TEXT
)
RETURNS TABLE (
  has_access BOOLEAN,
  function_name TEXT,
  roles TEXT[]
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id INTEGER;
BEGIN
  v_user_id := public.get_user_id_from_auth(p_user_id);

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, ''::TEXT, ARRAY[]::TEXT[];
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      INNER JOIN public.role_functions rf ON rf.role_id = ur.role_id
      INNER JOIN public.functions f ON f.id = rf.function_id
      WHERE ur.user_id = v_user_id
        AND ur.business_id = p_business_id
        AND f.code = p_function_code
        AND ur.is_active = true
        AND f.is_active = true
    ) AS access,
    (SELECT name FROM public.functions WHERE code = p_function_code) AS fname,
    ARRAY_AGG(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL)
    FROM public.user_roles ur
    INNER JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = v_user_id
      AND ur.business_id = p_business_id
      AND ur.is_active = true
    GROUP BY ur.user_id;
END;
$$;

-- ============================================================================
-- 3. CHECK ACTION ACCESS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_action_access(
  p_user_id UUID,
  p_business_id INTEGER,
  p_function_code TEXT,
  p_action TEXT
)
RETURNS TABLE (
  allowed BOOLEAN,
  reason TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id INTEGER;
BEGIN
  v_user_id := public.get_user_id_from_auth(p_user_id);

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'User not found'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(rfa.allowed, false) AS allowed,
    CASE
      WHEN rfa.allowed IS NULL THEN 'Function or action not found'
      WHEN rfa.allowed = false THEN 'Action not permitted for your role'
      ELSE 'Action permitted'
    END AS reason
  FROM public.user_roles ur
  INNER JOIN public.role_function_actions rfa ON rfa.role_id = ur.role_id
  INNER JOIN public.function_actions fa ON fa.id = rfa.action_id
  INNER JOIN public.functions f ON f.id = fa.function_id
  WHERE ur.user_id = v_user_id
    AND ur.business_id = p_business_id
    AND f.code = p_function_code
    AND fa.action = p_action
    AND ur.is_active = true
    AND f.is_active = true
  LIMIT 1;
END;
$$;

-- ============================================================================
-- 4. GET USER ROLES
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_roles(
  p_user_id UUID,
  p_business_id INTEGER
)
RETURNS TABLE (
  role_id INTEGER,
  role_code TEXT,
  role_name TEXT,
  hierarchy_level INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id INTEGER;
BEGIN
  v_user_id := public.get_user_id_from_auth(p_user_id);

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.code,
    r.name,
    r.hierarchy_level
  FROM public.user_roles ur
  INNER JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = v_user_id
    AND ur.business_id = p_business_id
    AND ur.is_active = true;
END;
$$;

-- ============================================================================
-- 5. ASSIGN ROLE TO USER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.assign_user_role(
  p_user_id UUID,
  p_assigned_by UUID,
  p_business_id INTEGER,
  p_role_id INTEGER
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id INTEGER;
  v_assigned_by_id INTEGER;
  v_role_exists BOOLEAN;
BEGIN
  -- Convert auth UUIDs to integer user_ids
  v_user_id := public.get_user_id_from_auth(p_user_id);
  v_assigned_by_id := public.get_user_id_from_auth(p_assigned_by);

  -- Validate user exists
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'User to assign role to was not found'::TEXT;
    RETURN;
  END IF;

  -- Validate assigner exists
  IF v_assigned_by_id IS NULL THEN
    RETURN QUERY SELECT false, 'Admin user assigning role was not found'::TEXT;
    RETURN;
  END IF;

  -- Check if role exists
  SELECT EXISTS(SELECT 1 FROM public.roles WHERE id = p_role_id)
  INTO v_role_exists;

  IF NOT v_role_exists THEN
    RETURN QUERY SELECT false, 'Role does not exist'::TEXT;
    RETURN;
  END IF;

  -- Insert role assignment (will fail gracefully if duplicate)
  INSERT INTO public.user_roles (user_id, business_id, role_id, assigned_by)
  VALUES (v_user_id, p_business_id, p_role_id, p_assigned_by)
  ON CONFLICT DO NOTHING;

  RETURN QUERY SELECT true, 'Role assigned successfully'::TEXT;
END;
$$;

-- ============================================================================
-- 6. REMOVE ROLE FROM USER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.remove_user_role(
  p_user_id UUID,
  p_business_id INTEGER,
  p_role_id INTEGER
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id INTEGER;
  v_rows_deleted INTEGER;
BEGIN
  -- Convert auth UUID to integer user_id
  v_user_id := public.get_user_id_from_auth(p_user_id);

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'User not found'::TEXT;
    RETURN;
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = v_user_id
    AND business_id = p_business_id
    AND role_id = p_role_id;

  GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;

  IF v_rows_deleted > 0 THEN
    RETURN QUERY SELECT true, 'Role removed successfully'::TEXT;
  ELSE
    RETURN QUERY SELECT false, 'Role assignment not found'::TEXT;
  END IF;
END;
$$;

-- ============================================================================
-- 7. GET USER TASKS
-- Fixed: Accept UUID and ensure email column type is TEXT
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_tasks(
  p_user_id UUID,
  p_business_id INTEGER,
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE (
  task_id INTEGER,
  title TEXT,
  description TEXT,
  due_date DATE,
  priority TEXT,
  status TEXT,
  assigned_by_email TEXT,
  created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Note: employee_tasks.user_id is UUID (Supabase Auth), not INTEGER
  -- So we use p_user_id directly without conversion
  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t.description,
    t.due_date,
    t.priority,
    t.status,
    COALESCE(u.email, '')::TEXT as assigned_by_email,
    t.created_at
  FROM public.employee_tasks t
  LEFT JOIN auth.users u ON u.id = t.assigned_by
  WHERE t.user_id = p_user_id
    AND t.business_id = p_business_id
    AND (p_status IS NULL OR t.status = p_status)
  ORDER BY
    CASE
      WHEN t.priority = 'URGENT' THEN 1
      WHEN t.priority = 'HIGH' THEN 2
      WHEN t.priority = 'NORMAL' THEN 3
      ELSE 4
    END,
    t.due_date ASC,
    t.created_at DESC;
END;
$$;

-- ============================================================================
-- 8. GET UNREAD NOTIFICATIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_unread_notifications(
  p_user_id UUID,
  p_business_id INTEGER
)
RETURNS TABLE (
  notification_id INTEGER,
  title TEXT,
  message TEXT,
  type TEXT,
  action_url TEXT,
  created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.title,
    n.message,
    n.type,
    n.action_url,
    n.created_at
  FROM public.notifications n
  WHERE n.user_id = p_user_id
    AND n.business_id = p_business_id
    AND n.is_read = false
    AND (n.expires_at IS NULL OR n.expires_at > NOW())
  ORDER BY n.created_at DESC
  LIMIT 10;
END;
$$;

-- ============================================================================
-- 9. CREATE NOTIFICATION
-- ============================================================================
DROP FUNCTION IF EXISTS public.create_notification(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ);
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_business_id INTEGER,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT,
  p_action_url TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  notification_id INTEGER,
  success BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_notification_id INTEGER;
BEGIN
  INSERT INTO public.notifications (
    user_id, business_id, title, message, type, action_url, expires_at
  )
  VALUES (
    p_user_id, p_business_id, p_title, p_message, p_type, p_action_url, p_expires_at
  )
  RETURNING id INTO v_notification_id;

  RETURN QUERY SELECT v_notification_id, true;
END;
$$;

-- ============================================================================
-- 10. GET USER PROFILE
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_user_profile(UUID);
CREATE OR REPLACE FUNCTION public.get_user_profile(
  p_user_id UUID
)
RETURNS TABLE (
  user_id INTEGER,
  name TEXT,
  email TEXT,
  role TEXT,
  created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id INTEGER;
BEGIN
  v_user_id := public.get_user_id_from_auth(p_user_id);

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.name,
    u.email,
    u.role,
    u.created_at
  FROM public.users u
  WHERE u.id = v_user_id;
END;
$$;

-- ============================================================================
-- DEPLOYMENT COMPLETE
-- All RPC functions now properly handle UUID-to-INTEGER conversion
-- The get_user_id_from_auth() helper function maps Supabase Auth UUIDs
-- to database user_ids for proper lookups in user_roles
-- Parameter names are compatible with frontend (p_user_id, p_business_id)
-- ============================================================================
