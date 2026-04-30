-- ============================================================================
-- ZAI FLOW 2.0 - Employee Attendance Clock In/Out RPC Functions
-- Manages employee clock in/out and attendance record creation
-- ============================================================================

-- ============================================================================
-- RPC FUNCTION 1: Clock In Employee
-- ============================================================================
DROP FUNCTION IF EXISTS clock_in(UUID, INTEGER, TEXT);
CREATE OR REPLACE FUNCTION clock_in(
  p_user_id UUID,
  p_business_id INTEGER,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  employee_id INTEGER,
  clock_in_time TIMESTAMPTZ
) AS $$
DECLARE
  v_user_id INTEGER;
  v_employee_id INTEGER;
  v_branch_id INTEGER;
  v_attendance_id INTEGER;
  v_existing_record RECORD;
BEGIN
  -- Step 1: Find the internal user ID from auth_id (UUID)
  SELECT id INTO v_user_id
  FROM public.users
  WHERE auth_id = p_user_id AND business_id = p_business_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'User not found in system'::TEXT, NULL::INTEGER, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Step 2: Find the employee record by email
  SELECT e.id, e.branch_id
  INTO v_employee_id, v_branch_id
  FROM public.employees e
  JOIN public.users u ON u.email = e.email
  WHERE u.id = v_user_id AND e.business_id = p_business_id
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Employee record not found. HR setup may be incomplete.'::TEXT, NULL::INTEGER, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Step 3: Check if attendance record already exists for today
  SELECT * INTO v_existing_record
  FROM public.attendance
  WHERE employee_id = v_employee_id
  AND attendance_date = CURRENT_DATE
  LIMIT 1;

  IF v_existing_record IS NOT NULL THEN
    -- Already clocked in today
    RETURN QUERY SELECT FALSE, 'Already clocked in today'::TEXT, v_employee_id, NOW();
    RETURN;
  END IF;

  -- Step 4: Create new attendance record for today
  INSERT INTO public.attendance (
    branch_id,
    employee_id,
    attendance_date,
    status,
    notes,
    created_at,
    updated_at
  ) VALUES (
    v_branch_id,
    v_employee_id,
    CURRENT_DATE,
    'PRESENT',
    'Clock in at ' || NOW()::TEXT || CASE WHEN p_notes IS NOT NULL THEN '. Notes: ' || p_notes ELSE '' END,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_attendance_id;

  RETURN QUERY SELECT TRUE, 'Clocked in successfully at ' || NOW()::TIME::TEXT::TEXT, v_employee_id, NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RPC FUNCTION 2: Clock Out Employee
-- ============================================================================
DROP FUNCTION IF EXISTS clock_out(UUID, INTEGER, TEXT);
CREATE OR REPLACE FUNCTION clock_out(
  p_user_id UUID,
  p_business_id INTEGER,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  employee_id INTEGER,
  hours_worked NUMERIC,
  clock_out_time TIMESTAMPTZ
) AS $$
DECLARE
  v_user_id INTEGER;
  v_employee_id INTEGER;
  v_attendance_record RECORD;
  v_hours_worked NUMERIC;
  v_clock_in_time TIMESTAMPTZ;
BEGIN
  -- Step 1: Find the internal user ID from auth_id (UUID)
  SELECT id INTO v_user_id
  FROM public.users
  WHERE auth_id = p_user_id AND business_id = p_business_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'User not found in system'::TEXT, NULL::INTEGER, NULL::NUMERIC, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Step 2: Find the employee record by email
  SELECT id INTO v_employee_id
  FROM public.employees
  WHERE business_id = p_business_id
  AND email = (SELECT email FROM public.users WHERE id = v_user_id)
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Employee record not found'::TEXT, NULL::INTEGER, NULL::NUMERIC, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Step 3: Find today's attendance record
  SELECT * INTO v_attendance_record
  FROM public.attendance
  WHERE employee_id = v_employee_id
  AND attendance_date = CURRENT_DATE
  LIMIT 1;

  IF v_attendance_record IS NULL THEN
    RETURN QUERY SELECT FALSE, 'No clock in record found for today. Please clock in first.'::TEXT, v_employee_id, NULL::NUMERIC, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Step 4: Extract clock in time from notes (format: "Clock in at HH:MM:SS")
  -- Calculate hours worked from created_at to now
  v_hours_worked := EXTRACT(EPOCH FROM (NOW() - v_attendance_record.created_at)) / 3600;

  -- Step 5: Update attendance record with clock out info
  UPDATE public.attendance
  SET
    status = 'PRESENT',
    hours_worked = ROUND(v_hours_worked::NUMERIC, 2),
    notes = CASE
      WHEN notes IS NOT NULL THEN notes || ' | Clock out at ' || NOW()::TIME::TEXT || CASE WHEN p_notes IS NOT NULL THEN '. Notes: ' || p_notes ELSE '' END
      ELSE 'Clock out at ' || NOW()::TEXT || CASE WHEN p_notes IS NOT NULL THEN '. Notes: ' || p_notes ELSE '' END
    END,
    updated_at = NOW()
  WHERE id = v_attendance_record.id;

  RETURN QUERY SELECT TRUE, 'Clocked out successfully at ' || NOW()::TIME::TEXT::TEXT, v_employee_id, ROUND(v_hours_worked::NUMERIC, 2), NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ALL ATTENDANCE RPC FUNCTIONS CREATED SUCCESSFULLY
-- ============================================================================
