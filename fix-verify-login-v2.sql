-- Simplified verify_login function (v2)
-- Uses a simpler approach that should work better with REST API

DROP FUNCTION IF EXISTS verify_login(TEXT, TEXT);

CREATE OR REPLACE FUNCTION verify_login(p_email TEXT, p_password TEXT)
RETURNS JSON AS $$
DECLARE
  v_user_id INTEGER;
  v_user_name TEXT;
  v_user_role TEXT;
  v_stored_password TEXT;
BEGIN
  -- Simple SELECT to fetch user
  SELECT id, name, role, password INTO v_user_id, v_user_name, v_user_role, v_stored_password
  FROM public.users
  WHERE email = p_email
  LIMIT 1;

  -- Check if user exists
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Invalid email or password');
  END IF;

  -- Check password
  IF v_stored_password = p_password THEN
    RETURN json_build_object(
      'id', v_user_id,
      'name', v_user_name,
      'email', p_email,
      'role', v_user_role,
      'success', true,
      'message', 'Login successful'
    );
  ELSE
    RETURN json_build_object('success', false, 'message', 'Invalid email or password');
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Test it
SELECT verify_login('admin@zai.com', 'Admin@1234');
