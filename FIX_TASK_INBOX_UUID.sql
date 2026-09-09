-- ============================================================================
-- FIX: tasks and notifications sent from HR never reach the employee's in-tray
-- ============================================================================
-- send_task_to_employee always addressed the in-tray with a SYNTHESIZED uuid:
--
--   v_uuid := ('00000000-0000-0000-0000-' || LPAD(v_user_id::TEXT, 12, '0'))
--
-- But the frontend's getAuthUUID() PREFERS a real Supabase auth_id and only
-- falls back to the synthesized form when the account hasn't got one. Accounts
-- created through the Netlify create-user function do have one, so for those
-- users HR filed the task under ...000000000049 while the landing page queried
-- for 99e39ddc-6f8a-4199-b74c-7fd8b44e1467. No match, no error, no task.
--
-- Confirmed on 2026-09-09: employee_tasks held both forms for user 49 - task 1
-- under the real auth_id (visible) and task 7 "keep working" under the
-- synthesized one (invisible).
--
-- This is the same class of bug zf_resolve_employee was written to fix for
-- clock-in. The lesson is that the uuid convention must be resolved in ONE
-- place, not re-derived per function.
-- ============================================================================


-- ============================================================================
-- STEP 1: one definition of "which uuid addresses this user's in-tray"
-- ============================================================================
-- Mirrors getAuthUUID() exactly: real auth_id when present, synthesized
-- otherwise. Anything writing to employee_tasks or notifications must go
-- through this rather than building the uuid itself.
CREATE OR REPLACE FUNCTION public.zf_user_inbox_uuid(p_user_id INTEGER)
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
           u.auth_id::UUID,
           ('00000000-0000-0000-0000-' || LPAD(u.id::TEXT, 12, '0'))::UUID
         )
  FROM public.users u
  WHERE u.id = p_user_id;
$$;


-- ============================================================================
-- STEP 2: send_task_to_employee uses it
-- ============================================================================
DROP FUNCTION IF EXISTS public.send_task_to_employee(INTEGER, INTEGER, TEXT, TEXT, DATE, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.send_task_to_employee(
  p_branch_id INTEGER,
  p_employee_id INTEGER,
  p_title TEXT,
  p_description TEXT,
  p_due_date DATE,
  p_priority TEXT,
  p_assigned_by UUID
)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id INTEGER;
  v_uuid UUID;
  v_business_id INTEGER;
BEGIN
  SELECT u.id INTO v_user_id
  FROM public.employees e
  JOIN public.users u ON LOWER(u.email) = LOWER(e.email)
  WHERE e.id = p_employee_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE,
      'That employee has no system login yet, so they have no in-tray to receive tasks.'::TEXT;
    RETURN;
  END IF;

  v_uuid := public.zf_user_inbox_uuid(v_user_id);
  SELECT b.business_id INTO v_business_id FROM public.branches b WHERE b.id = p_branch_id;

  INSERT INTO public.employee_tasks (
    user_id, business_id, title, description, due_date, priority, status, assigned_to, assigned_by
  ) VALUES (
    v_uuid, v_business_id, p_title, p_description, p_due_date,
    COALESCE(NULLIF(p_priority,''), 'NORMAL'), 'TODO', v_uuid, p_assigned_by
  );

  INSERT INTO public.notifications (user_id, business_id, title, message, type, action_url)
  VALUES (v_uuid, v_business_id, 'New task: ' || p_title, COALESCE(p_description,''), 'info', 'employee-landing.html');

  RETURN QUERY SELECT TRUE, 'Task sent to the employee''s in-tray'::TEXT;
END;
$$;


-- ============================================================================
-- STEP 3: PREVIEW the orphaned rows - run this on its own first
-- ============================================================================
-- Every row addressed to a synthesized uuid belonging to a user who actually
-- has an auth_id. These are the invisible ones.
SELECT 'employee_tasks' AS table_name, t.id, t.title AS detail,
       t.user_id AS currently_addressed_to, u.auth_id AS should_be
FROM public.employee_tasks t
JOIN public.users u
  ON u.auth_id IS NOT NULL
 AND t.user_id = ('00000000-0000-0000-0000-' || LPAD(u.id::TEXT, 12, '0'))::UUID
UNION ALL
SELECT 'notifications', n.id, n.title,
       n.user_id, u.auth_id
FROM public.notifications n
JOIN public.users u
  ON u.auth_id IS NOT NULL
 AND n.user_id = ('00000000-0000-0000-0000-' || LPAD(u.id::TEXT, 12, '0'))::UUID
ORDER BY table_name, id;


-- ============================================================================
-- STEP 4: RE-POINT them - only after STEP 3 looks right
-- ============================================================================
-- Re-addressing rather than deleting: these are real tasks somebody sent and
-- expected to be actioned, they were simply filed in an unreachable drawer.

BEGIN;

UPDATE public.employee_tasks t
SET user_id = u.auth_id::UUID
FROM public.users u
WHERE u.auth_id IS NOT NULL
  AND t.user_id = ('00000000-0000-0000-0000-' || LPAD(u.id::TEXT, 12, '0'))::UUID;

-- assigned_to drives "my tasks" filtering in some views, so it has to move too.
UPDATE public.employee_tasks t
SET assigned_to = u.auth_id::UUID
FROM public.users u
WHERE u.auth_id IS NOT NULL
  AND t.assigned_to = ('00000000-0000-0000-0000-' || LPAD(u.id::TEXT, 12, '0'))::UUID;

-- assigned_by is display-only ("who sent this"), but leaving it in the old
-- form means the two columns disagree about how a user is identified.
UPDATE public.employee_tasks t
SET assigned_by = u.auth_id::UUID
FROM public.users u
WHERE u.auth_id IS NOT NULL
  AND t.assigned_by = ('00000000-0000-0000-0000-' || LPAD(u.id::TEXT, 12, '0'))::UUID;

UPDATE public.notifications n
SET user_id = u.auth_id::UUID
FROM public.users u
WHERE u.auth_id IS NOT NULL
  AND n.user_id = ('00000000-0000-0000-0000-' || LPAD(u.id::TEXT, 12, '0'))::UUID;

COMMIT;


NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- STEP 5: VERIFY
-- ============================================================================
-- Should return ZERO rows - nothing left addressed to an unreachable uuid.
SELECT 'employee_tasks' AS table_name, t.id, t.user_id
FROM public.employee_tasks t
JOIN public.users u
  ON u.auth_id IS NOT NULL
 AND t.user_id = ('00000000-0000-0000-0000-' || LPAD(u.id::TEXT, 12, '0'))::UUID
UNION ALL
SELECT 'notifications', n.id, n.user_id
FROM public.notifications n
JOIN public.users u
  ON u.auth_id IS NOT NULL
 AND n.user_id = ('00000000-0000-0000-0000-' || LPAD(u.id::TEXT, 12, '0'))::UUID;

-- What user 49 should now see in their in-tray.
SELECT t.id, t.title, t.status, t.user_id
FROM public.employee_tasks t
JOIN public.users u ON u.id = 49
WHERE t.user_id = public.zf_user_inbox_uuid(49)
ORDER BY t.id;
