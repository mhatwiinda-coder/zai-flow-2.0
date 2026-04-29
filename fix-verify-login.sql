-- Fixed verify_login function that returns JSON

DROP FUNCTION IF EXISTS verify_login(TEXT, TEXT);

CREATE OR REPLACE FUNCTION verify_login(p_email TEXT, p_password TEXT)
RETURNS JSON AS $$
BEGIN
  RETURN COALESCE(
    (SELECT json_build_object(
      'id', users.id,
      'name', users.name,
      'email', users.email,
      'role', users.role,
      'success', (users.password = p_password),
      'message', CASE
        WHEN users.password = p_password THEN 'Login successful'
        ELSE 'Invalid email or password'
      END
    ) FROM public.users WHERE users.email = p_email),
    json_build_object(
      'success', false,
      'message', 'Invalid email or password'
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Test it
SELECT verify_login('admin@zai.com', 'Admin@1234');
