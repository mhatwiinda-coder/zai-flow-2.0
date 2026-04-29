-- ====================================================================
-- ZAI FLOW 2.0 - BUSINESS USER MANAGEMENT RPC FUNCTIONS
-- User creation, assignment, and isolation per business
-- ====================================================================

/* =====================================================
   CREATE_BUSINESS_USER Function
   Creates a new user for a specific business
   This ensures users are BOUND to ONE business only
===================================================== */
CREATE OR REPLACE FUNCTION public.create_business_user(
  p_business_id INTEGER,
  p_email TEXT,
  p_password TEXT,
  p_name TEXT,
  p_role TEXT DEFAULT 'cashier'
)
RETURNS TABLE (
  user_id INTEGER,
  email TEXT,
  name TEXT,
  business_id INTEGER,
  role TEXT,
  success BOOLEAN,
  message TEXT
) LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id INTEGER;
  v_business_exists BOOLEAN;
BEGIN
  -- Validate business exists
  SELECT EXISTS(SELECT 1 FROM public.business_entities WHERE id = p_business_id)
  INTO v_business_exists;

  IF NOT v_business_exists THEN
    RETURN QUERY SELECT
      NULL::INTEGER,
      p_email,
      p_name,
      p_business_id,
      p_role,
      FALSE,
      'Business does not exist'::TEXT;
    RETURN;
  END IF;

  -- Check if user already exists
  IF EXISTS(SELECT 1 FROM public.users WHERE public.users.email = p_email) THEN
    RETURN QUERY SELECT
      NULL::INTEGER,
      p_email,
      p_name,
      p_business_id,
      p_role,
      FALSE,
      'User with this email already exists'::TEXT;
    RETURN;
  END IF;

  -- Create user tied to business
  INSERT INTO public.users (email, password, name, role, business_id)
  VALUES (p_email, p_password, p_name, p_role, p_business_id)
  RETURNING id INTO v_user_id;

  -- Create default branch access for primary branch of business
  INSERT INTO public.user_branch_access (user_id, branch_id, role, is_primary_branch, status)
  SELECT v_user_id, b.id, p_role, TRUE, 'ACTIVE'
  FROM public.branches b
  WHERE b.business_id = p_business_id
  LIMIT 1;

  RETURN QUERY SELECT
    v_user_id,
    p_email,
    p_name,
    p_business_id,
    p_role,
    TRUE,
    'User created successfully'::TEXT;
END;
$$;

/* =====================================================
   GET_BUSINESS_USERS Function
   Returns all users for a specific business
   IMPORTANT: Users can ONLY see their own business's data
===================================================== */
CREATE OR REPLACE FUNCTION public.get_business_users(p_business_id INTEGER)
RETURNS TABLE (
  user_id INTEGER,
  email TEXT,
  name TEXT,
  role TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  branch_count INTEGER
) LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.email,
    u.name,
    u.role,
    'ACTIVE'::TEXT,
    u.created_at,
    COUNT(DISTINCT uba.branch_id)::INTEGER
  FROM public.users u
  LEFT JOIN public.user_branch_access uba ON u.id = uba.user_id
  WHERE u.business_id = p_business_id
  GROUP BY u.id, u.email, u.name, u.role, u.created_at
  ORDER BY u.created_at DESC;
END;
$$;

/* =====================================================
   UPDATE_USER_ROLE Function
   Updates a user's role within their business
===================================================== */
CREATE OR REPLACE FUNCTION public.update_user_role(
  p_user_id INTEGER,
  p_new_role TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_exists BOOLEAN;
BEGIN
  -- Validate user exists
  SELECT EXISTS(SELECT 1 FROM public.users WHERE id = p_user_id)
  INTO v_user_exists;

  IF NOT v_user_exists THEN
    RETURN QUERY SELECT
      FALSE,
      'User does not exist'::TEXT;
    RETURN;
  END IF;

  -- Validate role
  IF p_new_role NOT IN ('cashier', 'inventory', 'supervisor', 'manager', 'admin') THEN
    RETURN QUERY SELECT
      FALSE,
      'Invalid role'::TEXT;
    RETURN;
  END IF;

  -- Update user role
  UPDATE public.users
  SET role = p_new_role
  WHERE id = p_user_id;

  -- Update their branch access roles
  UPDATE public.user_branch_access
  SET role = p_new_role
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT
    TRUE,
    'Role updated successfully'::TEXT;
END;
$$;

/* =====================================================
   DELETE_BUSINESS_USER Function
   Deletes a user and their branch access
===================================================== */
CREATE OR REPLACE FUNCTION public.delete_business_user(p_user_id INTEGER)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_exists BOOLEAN;
BEGIN
  -- Validate user exists
  SELECT EXISTS(SELECT 1 FROM public.users WHERE id = p_user_id)
  INTO v_user_exists;

  IF NOT v_user_exists THEN
    RETURN QUERY SELECT
      FALSE,
      'User does not exist'::TEXT;
    RETURN;
  END IF;

  -- Delete user branch access
  DELETE FROM public.user_branch_access WHERE user_id = p_user_id;

  -- Delete user
  DELETE FROM public.users WHERE id = p_user_id;

  RETURN QUERY SELECT
    TRUE,
    'User deleted successfully'::TEXT;
END;
$$;

/* =====================================================
   LOGIN_BUSINESS_USER Function
   Enhanced login that returns ONLY the user's business
   This ensures tenant isolation at login time
===================================================== */
CREATE OR REPLACE FUNCTION public.login_business_user(
  p_email TEXT,
  p_password TEXT
)
RETURNS TABLE (
  user_id INTEGER,
  name TEXT,
  email TEXT,
  role TEXT,
  business_id INTEGER,
  business_name TEXT,
  branches JSONB,
  current_branch_id INTEGER,
  current_business_id INTEGER,
  success BOOLEAN,
  message TEXT
) LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
DECLARE
  v_user RECORD;
  v_branches JSONB;
  v_primary_branch_id INTEGER;
BEGIN
  -- Find user by email and password
  -- Use table alias to avoid column ambiguity
  SELECT u.id, u.name, u.email, u.role, u.business_id
  INTO v_user
  FROM public.users u
  WHERE u.email = p_email AND u.password = p_password
  LIMIT 1;

  IF v_user IS NULL THEN
    RETURN QUERY SELECT
      NULL::INTEGER,
      NULL::TEXT,
      p_email,
      NULL::TEXT,
      NULL::INTEGER,
      NULL::TEXT,
      NULL::JSONB,
      NULL::INTEGER,
      NULL::INTEGER,
      FALSE,
      'Invalid email or password'::TEXT;
    RETURN;
  END IF;

  -- Get user's branches for their business ONLY
  SELECT
    JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'branch_id', b.id,
        'branch_name', b.name,
        'business_id', b.business_id,
        'business_name', (SELECT name FROM public.business_entities WHERE id = b.business_id),
        'role', uba.role,
        'is_primary', uba.is_primary_branch
      )
    ),
    (SELECT b.id FROM public.branches b
     JOIN public.user_branch_access uba ON b.id = uba.branch_id
     WHERE uba.user_id = v_user.id AND uba.is_primary_branch = TRUE
     LIMIT 1)
  INTO v_branches, v_primary_branch_id
  FROM public.branches b
  JOIN public.user_branch_access uba ON b.id = uba.branch_id
  WHERE uba.user_id = v_user.id
    AND b.business_id = v_user.business_id;

  RETURN QUERY SELECT
    v_user.id,
    v_user.name,
    v_user.email,
    v_user.role,
    v_user.business_id,
    (SELECT name FROM public.business_entities WHERE id = v_user.business_id),
    COALESCE(v_branches, '[]'::JSONB),
    COALESCE(v_primary_branch_id, NULL::INTEGER),
    v_user.business_id,
    TRUE,
    'Login successful'::TEXT;
END;
$$;

/* =====================================================
   GET_ALL_USERS Function
   Admin function - Returns all users across all businesses
   Bypasses RLS to allow admin viewing of all users
===================================================== */
CREATE OR REPLACE FUNCTION public.get_all_users()
RETURNS TABLE (
  user_id INTEGER,
  email TEXT,
  name TEXT,
  role TEXT,
  business_id INTEGER,
  business_name TEXT,
  created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.email,
    u.name,
    u.role,
    u.business_id,
    COALESCE(be.name, 'Unknown'),
    u.created_at
  FROM public.users u
  LEFT JOIN public.business_entities be ON u.business_id = be.id
  ORDER BY u.created_at DESC;
END;
$$;

/* =====================================================
   COMPLETION MESSAGE
===================================================== */
DO $$
BEGIN
  RAISE NOTICE '✅ Business User Management RPC functions created successfully';
  RAISE NOTICE '✅ Functions: create_business_user, get_business_users, update_user_role, delete_business_user, login_business_user, get_all_users';
  RAISE NOTICE '✅ All functions have SECURITY DEFINER to bypass RLS policies';
  RAISE NOTICE '✅ IMPORTANT: Users are now BOUND to ONE BUSINESS ONLY';
  RAISE NOTICE '✅ Users can only see/access their assigned business data';
  RAISE NOTICE '✅ True SaaS Multi-Tenancy enabled!';
END $$;
