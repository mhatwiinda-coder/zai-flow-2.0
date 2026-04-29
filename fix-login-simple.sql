-- Drop the problematic function
DROP FUNCTION IF EXISTS verify_login(TEXT, TEXT) CASCADE;

-- Create a simple SQL function (no PL/pgSQL)
CREATE OR REPLACE FUNCTION verify_login(
  email_param TEXT,
  password_param TEXT
)
RETURNS JSON AS $$
SELECT CASE
  WHEN password = password_param THEN
    json_build_object(
      'id', id,
      'name', name,
      'email', email,
      'role', role,
      'success', true,
      'message', 'Login successful'
    )
  ELSE
    json_build_object(
      'success', false,
      'message', 'Invalid email or password'
    )
END
FROM public.users
WHERE email = email_param
LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- Test it
SELECT verify_login('admin@zai.com', 'Admin@1234');
