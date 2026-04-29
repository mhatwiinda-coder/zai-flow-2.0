-- ============================================================================
-- ZAI FLOW 2.0 - FIX RPC TYPE MISMATCHES
-- Deploy to Supabase SQL Editor to fix notification type errors
-- ============================================================================
-- ISSUE: RPC functions were declaring BIGINT for notification IDs,
--        but notifications table uses SERIAL (INTEGER)
-- FIX: Updated all three notification-related RPC functions
-- ============================================================================

-- ============================================================================
-- 1. FIX: CREATE NOTIFICATION
-- Changed: BIGINT → INTEGER for notification_id
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
-- 2. FIX: GET UNREAD NOTIFICATIONS
-- Changed: BIGINT → INTEGER for notification_id return type
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
-- 3. FIX: MARK NOTIFICATION AS READ
-- Changed: Function parameter from BIGINT → INTEGER for notification_id
-- ============================================================================
DROP FUNCTION IF EXISTS public.mark_notification_read(BIGINT);
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
-- DEPLOYMENT COMPLETE
-- All RPC functions now have correct data types matching the database schema
-- ============================================================================
