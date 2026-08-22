-- ============================================================================
-- MISSED CLOCK-IN ALERTS + HR ATTENDANCE VIEW
-- ============================================================================
-- "the clock in feature should automatically populate on the HR page and a log
--  should be kept such that it sends an alert to HR and the manager if an
--  employee has not clocked in. HR can then either send the task to the
--  employees in tray or amend if employee is sick or absent."
--
-- Run FIX_CLOCK_IN_HR_INTEGRATION.sql first - this depends on the clock_in /
-- clock_out columns it adds.
-- ============================================================================


-- ============================================================================
-- 1. HR live attendance board
-- ============================================================================
-- Every ACTIVE employee for a branch on a given day, with their clock state -
-- so HR sees who is in, who is late, and who has not shown up, rather than
-- only those who happen to have a row.
DROP FUNCTION IF EXISTS public.get_daily_attendance(INTEGER, DATE);
CREATE OR REPLACE FUNCTION public.get_daily_attendance(
  p_branch_id INTEGER,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  employee_id INTEGER,
  employee_code TEXT,
  full_name TEXT,
  department TEXT,
  status TEXT,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  hours_worked NUMERIC,
  notes TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.employee_code,
    (e.first_name || ' ' || e.last_name)::TEXT,
    COALESCE(d.name, 'Unassigned')::TEXT,
    -- No row at all means nobody recorded anything: report NOT_CLOCKED_IN
    -- rather than leaving a blank the HR page has to guess about.
    COALESCE(a.status, 'NOT_CLOCKED_IN')::TEXT,
    a.clock_in,
    a.clock_out,
    a.hours_worked,
    a.notes
  FROM public.employees e
  LEFT JOIN public.departments d ON d.id = e.department_id
  LEFT JOIN public.attendance a
    ON a.employee_id = e.id AND a.attendance_date = p_date AND a.branch_id = p_branch_id
  WHERE e.branch_id = p_branch_id
    AND e.status = 'ACTIVE'
  ORDER BY e.employee_code;
END;
$$;


-- ============================================================================
-- 2. Raise alerts for employees who have not clocked in
-- ============================================================================
-- Notifies the HR department manager and the employee's own manager. Safe to
-- run repeatedly - it will not duplicate alerts for the same employee/day.
DROP FUNCTION IF EXISTS public.raise_missed_clockin_alerts(INTEGER, DATE);
CREATE OR REPLACE FUNCTION public.raise_missed_clockin_alerts(
  p_branch_id INTEGER,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (alerted_count INTEGER, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_business_id INTEGER;
  v_hr_manager UUID;
  v_emp RECORD;
  v_count INTEGER := 0;
  v_recipient UUID;
BEGIN
  SELECT b.business_id INTO v_business_id FROM public.branches b WHERE b.id = p_branch_id;
  IF v_business_id IS NULL THEN
    RETURN QUERY SELECT 0, 'Branch not found'::TEXT; RETURN;
  END IF;

  SELECT d.manager_user_id INTO v_hr_manager
  FROM public.departments d
  WHERE d.branch_id = p_branch_id AND d.name = 'Human Resources';

  FOR v_emp IN
    SELECT e.id, e.employee_code, e.first_name, e.last_name, e.department_id,
           dm.manager_user_id AS dept_manager
    FROM public.employees e
    LEFT JOIN public.departments dm ON dm.id = e.department_id
    LEFT JOIN public.attendance a
      ON a.employee_id = e.id AND a.attendance_date = p_date AND a.branch_id = p_branch_id
    WHERE e.branch_id = p_branch_id
      AND e.status = 'ACTIVE'
      -- Not clocked in, and not already excused by HR (leave/sick/absent)
      AND (a.id IS NULL OR (a.clock_in IS NULL AND COALESCE(a.status,'') NOT IN ('LEAVE','SICK','ABSENT','HALF_DAY')))
  LOOP
    FOREACH v_recipient IN ARRAY ARRAY[v_hr_manager, v_emp.dept_manager]
    LOOP
      CONTINUE WHEN v_recipient IS NULL;

      -- Idempotent: one alert per recipient per employee per day.
      CONTINUE WHEN EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = v_recipient
          AND n.title = 'Missed clock-in: ' || v_emp.first_name || ' ' || v_emp.last_name
          AND n.created_at::DATE = p_date
      );

      INSERT INTO public.notifications (user_id, business_id, title, message, type, action_url)
      VALUES (
        v_recipient, v_business_id,
        'Missed clock-in: ' || v_emp.first_name || ' ' || v_emp.last_name,
        v_emp.employee_code || ' has not clocked in for ' || TO_CHAR(p_date, 'DD Mon YYYY') ||
          '. Mark them sick, on leave or absent in HR, or send them a task.',
        'warning', 'hr.html'
      );
      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT v_count,
    ('Raised ' || v_count || ' missed clock-in alert(s) for ' || TO_CHAR(p_date, 'DD Mon YYYY'))::TEXT;
END;
$$;


-- ============================================================================
-- 3. HR amends an employee's day (sick / leave / absent / present)
-- ============================================================================
DROP FUNCTION IF EXISTS public.set_attendance_status(INTEGER, INTEGER, DATE, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.set_attendance_status(
  p_branch_id INTEGER,
  p_employee_id INTEGER,
  p_date DATE,
  p_status TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_status NOT IN ('PRESENT','ABSENT','LEAVE','SICK','LATE','HALF_DAY') THEN
    RETURN QUERY SELECT FALSE, ('Invalid status: ' || p_status)::TEXT; RETURN;
  END IF;

  INSERT INTO public.attendance (branch_id, employee_id, attendance_date, status, notes)
  VALUES (p_branch_id, p_employee_id, p_date, p_status, p_notes)
  ON CONFLICT (branch_id, employee_id, attendance_date)
  DO UPDATE SET status = EXCLUDED.status,
                notes = COALESCE(EXCLUDED.notes, public.attendance.notes),
                updated_at = NOW();

  RETURN QUERY SELECT TRUE, ('Marked ' || p_status || ' for ' || TO_CHAR(p_date, 'DD Mon YYYY'))::TEXT;
END;
$$;


-- ============================================================================
-- 4. HR sends a task to an employee's in-tray
-- ============================================================================
-- employee_tasks is keyed by the same synthesized user uuid convention used
-- elsewhere, so resolve the employee back to their login first.
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

  v_uuid := ('00000000-0000-0000-0000-' || LPAD(v_user_id::TEXT, 12, '0'))::UUID;
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
-- VERIFICATION
-- ============================================================================
SELECT routine_name FROM information_schema.routines
WHERE routine_schema='public' AND routine_name IN
  ('get_daily_attendance','raise_missed_clockin_alerts','set_attendance_status','send_task_to_employee')
ORDER BY routine_name;
-- Expect 4 rows.

-- Try the board for a branch (replace 1 with a real branch id):
-- SELECT * FROM public.get_daily_attendance(1);
-- SELECT * FROM public.raise_missed_clockin_alerts(1);
