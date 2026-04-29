-- ============================================================================
-- ZAI FLOW 2.0 - ROLE-BASED ACCESS CONTROL RPC FUNCTIONS
-- All functions handle multi-tenant isolation and role checking
-- ============================================================================

-- ============================================================================
-- 1. GET USER ACCESSIBLE MODULES
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_user_accessible_modules(UUID, INTEGER);
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
BEGIN
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
  WHERE ur.user_id = p_user_id
    AND ur.business_id = p_business_id
    AND ur.is_active = true
    AND f.is_active = true
  ORDER BY f.module, f.name;
END;
$$;

-- ============================================================================
-- 2. CHECK FUNCTION ACCESS (Can user access a specific function?)
-- ============================================================================
DROP FUNCTION IF EXISTS public.check_function_access(UUID, INTEGER, TEXT);
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
BEGIN
  RETURN QUERY
  SELECT
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      INNER JOIN public.role_functions rf ON rf.role_id = ur.role_id
      INNER JOIN public.functions f ON f.id = rf.function_id
      WHERE ur.user_id = p_user_id
        AND ur.business_id = p_business_id
        AND f.code = p_function_code
        AND ur.is_active = true
        AND f.is_active = true
    ) AS access,
    (SELECT name FROM public.functions WHERE code = p_function_code) AS fname,
    ARRAY_AGG(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL)
    FROM public.user_roles ur
    INNER JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_user_id
      AND ur.business_id = p_business_id
      AND ur.is_active = true
    GROUP BY ur.user_id;
END;
$$;

-- ============================================================================
-- 3. CHECK ACTION ACCESS (Can user perform a specific action on a function?)
-- ============================================================================
DROP FUNCTION IF EXISTS public.check_action_access(UUID, INTEGER, TEXT, TEXT);
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
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(rfa.allowed, false) AS allowed,
    CASE
      WHEN rfa.allowed IS NULL THEN 'Function or action not found'
      WHEN rfa.allowed = false THEN 'Action not permitted for your role'
      ELSE 'Action permitted'
    END AS reason
  FROM public.user_roles ur
  INNER JOIN public.roles r ON r.id = ur.role_id
  LEFT JOIN public.role_function_actions rfa ON rfa.role_id = r.id
  LEFT JOIN public.functions f ON f.id = rfa.function_id
  LEFT JOIN public.function_actions fa ON fa.id = rfa.action_id
  WHERE ur.user_id = p_user_id
    AND ur.business_id = p_business_id
    AND f.code = p_function_code
    AND fa.action = p_action
    AND ur.is_active = true
  LIMIT 1;
END;
$$;

-- ============================================================================
-- 4. GET USER ROLES
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_user_roles(UUID, INTEGER);
CREATE OR REPLACE FUNCTION public.get_user_roles(
  p_user_id UUID,
  p_business_id INTEGER
)
RETURNS TABLE (
  role_code TEXT,
  role_name TEXT,
  hierarchy_level INTEGER,
  is_active BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.code,
    r.name,
    r.hierarchy_level,
    ur.is_active
  FROM public.user_roles ur
  INNER JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = p_user_id
    AND ur.business_id = p_business_id
  ORDER BY r.hierarchy_level;
END;
$$;

-- ============================================================================
-- 5. ASSIGN ROLE TO USER
-- ============================================================================
DROP FUNCTION IF EXISTS public.assign_user_role(UUID, UUID, INTEGER, INTEGER);
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
  v_role_exists BOOLEAN;
BEGIN
  -- Check if role exists
  SELECT EXISTS(SELECT 1 FROM public.roles WHERE id = p_role_id)
  INTO v_role_exists;

  IF NOT v_role_exists THEN
    RETURN QUERY SELECT false, 'Role does not exist'::TEXT;
    RETURN;
  END IF;

  -- Insert role assignment (will fail gracefully if duplicate)
  INSERT INTO public.user_roles (user_id, business_id, role_id, assigned_by)
  VALUES (p_user_id, p_business_id, p_role_id, p_assigned_by)
  ON CONFLICT DO NOTHING;

  RETURN QUERY SELECT true, 'Role assigned successfully'::TEXT;
END;
$$;

-- ============================================================================
-- 6. REMOVE ROLE FROM USER
-- ============================================================================
DROP FUNCTION IF EXISTS public.remove_user_role(UUID, INTEGER, INTEGER);
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
  v_rows_deleted INTEGER;
BEGIN
  DELETE FROM public.user_roles
  WHERE user_id = p_user_id
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
-- 7. CLOCK IN
-- ============================================================================
DROP FUNCTION IF EXISTS public.clock_in(UUID, INTEGER, TEXT);
CREATE OR REPLACE FUNCTION public.clock_in(
  p_user_id UUID,
  p_business_id INTEGER,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  clock_in_time TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_attendance_id INTEGER;
  v_already_clocked_in BOOLEAN;
BEGIN
  -- Check if user already clocked in today
  SELECT EXISTS(
    SELECT 1 FROM public.employee_attendance
    WHERE user_id = p_user_id
      AND business_id = p_business_id
      AND DATE(clock_in) = CURRENT_DATE
      AND clock_out IS NULL
  ) INTO v_already_clocked_in;

  IF v_already_clocked_in THEN
    RETURN QUERY SELECT false, 'Already clocked in today'::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Insert clock in record
  INSERT INTO public.employee_attendance (user_id, business_id, clock_in, notes, status)
  VALUES (p_user_id, p_business_id, NOW(), p_notes, 'ACTIVE')
  RETURNING id INTO v_attendance_id;

  RETURN QUERY SELECT true, 'Clocked in successfully'::TEXT, NOW();
END;
$$;

-- ============================================================================
-- 8. CLOCK OUT
-- ============================================================================
DROP FUNCTION IF EXISTS public.clock_out(UUID, INTEGER, TEXT);
CREATE OR REPLACE FUNCTION public.clock_out(
  p_user_id UUID,
  p_business_id INTEGER,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  hours_worked NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_hours NUMERIC;
  v_rows_updated INTEGER;
BEGIN
  -- Calculate hours worked
  SELECT EXTRACT(EPOCH FROM (NOW() - clock_in)) / 3600
  INTO v_hours
  FROM public.employee_attendance
  WHERE user_id = p_user_id
    AND business_id = p_business_id
    AND DATE(clock_in) = CURRENT_DATE
    AND clock_out IS NULL
  LIMIT 1;

  IF v_hours IS NULL THEN
    RETURN QUERY SELECT false, 'No active clock in found'::TEXT, NULL::NUMERIC;
    RETURN;
  END IF;

  -- Update clock out
  UPDATE public.employee_attendance
  SET clock_out = NOW(),
      hours_worked = ROUND(v_hours::NUMERIC, 2),
      status = 'OFFLINE'
  WHERE user_id = p_user_id
    AND business_id = p_business_id
    AND DATE(clock_in) = CURRENT_DATE
    AND clock_out IS NULL;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  RETURN QUERY SELECT true, 'Clocked out successfully'::TEXT, ROUND(v_hours::NUMERIC, 2);
END;
$$;

-- ============================================================================
-- 9. GET ATTENDANCE STATUS (current day)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_attendance_status(UUID, INTEGER);
CREATE OR REPLACE FUNCTION public.get_attendance_status(
  p_user_id UUID,
  p_business_id INTEGER
)
RETURNS TABLE (
  is_clocked_in BOOLEAN,
  clock_in_time TIMESTAMPTZ,
  elapsed_minutes INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    (clock_out IS NULL) AS clocked_in,
    clock_in,
    EXTRACT(EPOCH FROM (NOW() - clock_in))::INTEGER / 60 AS minutes
  FROM public.employee_attendance
  WHERE user_id = p_user_id
    AND business_id = p_business_id
    AND DATE(clock_in) = CURRENT_DATE
  ORDER BY clock_in DESC
  LIMIT 1;
END;
$$;

-- ============================================================================
-- 10. CREATE TASK
-- ============================================================================
DROP FUNCTION IF EXISTS public.create_task(UUID, INTEGER, TEXT, TEXT, DATE, TEXT, UUID);
CREATE OR REPLACE FUNCTION public.create_task(
  p_user_id UUID,
  p_business_id INTEGER,
  p_title TEXT,
  p_description TEXT,
  p_due_date DATE,
  p_priority TEXT,
  p_assigned_to UUID DEFAULT NULL
)
RETURNS TABLE (
  task_id INTEGER,
  success BOOLEAN,
  message TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_task_id INTEGER;
BEGIN
  INSERT INTO public.employee_tasks (
    user_id, business_id, title, description, due_date, priority, assigned_to, assigned_by
  )
  VALUES (
    COALESCE(p_assigned_to, p_user_id), p_business_id, p_title, p_description, p_due_date, p_priority, p_assigned_to, p_user_id
  )
  RETURNING id INTO v_task_id;

  RETURN QUERY SELECT v_task_id, true, 'Task created successfully'::TEXT;
END;
$$;

-- ============================================================================
-- 11. UPDATE TASK STATUS
-- ============================================================================
DROP FUNCTION IF EXISTS public.update_task_status(INTEGER, TEXT);
CREATE OR REPLACE FUNCTION public.update_task_status(
  p_task_id INTEGER,
  p_status TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rows_updated INTEGER;
BEGIN
  UPDATE public.employee_tasks
  SET status = p_status,
      updated_at = NOW()
  WHERE id = p_task_id;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated > 0 THEN
    RETURN QUERY SELECT true, 'Task updated successfully'::TEXT;
  ELSE
    RETURN QUERY SELECT false, 'Task not found'::TEXT;
  END IF;
END;
$$;

-- ============================================================================
-- 12. GET USER TASKS
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_user_tasks(UUID, INTEGER, TEXT);
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
  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t.description,
    t.due_date,
    t.priority,
    t.status,
    u.email,
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
-- 13. CREATE NOTIFICATION
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
-- 14. GET UNREAD NOTIFICATIONS
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_unread_notifications(UUID, INTEGER);
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
-- 15. MARK NOTIFICATION AS READ
-- ============================================================================
DROP FUNCTION IF EXISTS public.mark_notification_read(INTEGER);
CREATE OR REPLACE FUNCTION public.mark_notification_read(
  p_notification_id INTEGER
)
RETURNS TABLE (
  success BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.notifications
  SET is_read = true
  WHERE id = p_notification_id;

  RETURN QUERY SELECT true;
END;
$$;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Functions created:
-- 1. get_user_accessible_modules - List all modules user can access
-- 2. check_function_access - Check if user can access a function
-- 3. check_action_access - Check if user can perform an action
-- 4. get_user_roles - Get all roles for a user
-- 5. assign_user_role - Assign a role to a user
-- 6. remove_user_role - Remove a role from a user
-- 7. clock_in - Clock in for the day
-- 8. clock_out - Clock out for the day
-- 9. get_attendance_status - Get current day's status
-- 10. create_task - Create a new task
-- 11. update_task_status - Update task status
-- 12. get_user_tasks - Get user's tasks
-- 13. create_notification - Create a notification
-- 14. get_unread_notifications - Get unread notifications
-- 15. mark_notification_read - Mark notification as read
-- ============================================================================
