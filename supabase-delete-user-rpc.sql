-- ============================================================================
-- ZAI FLOW 2.0 - DELETE USER RPC FUNCTION
-- Complete user deletion with all related records cleanup
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_user_complete(p_user_id INTEGER)
RETURNS JSON AS $$
DECLARE
  v_user_record RECORD;
  v_delete_count INTEGER := 0;
BEGIN
  -- Get user details
  SELECT id, auth_id, email INTO v_user_record FROM users WHERE id = p_user_id;

  IF v_user_record.id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'User not found');
  END IF;

  -- Delete employee records for this user
  DELETE FROM employees WHERE email = v_user_record.email;
  GET DIAGNOSTICS v_delete_count = ROW_COUNT;

  -- Delete attendance records (via employee deletion)
  -- Delete leave requests (via employee deletion)

  -- Delete user_branch_access records
  DELETE FROM user_branch_access WHERE user_id = p_user_id;

  -- Delete user record
  DELETE FROM users WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'message', 'User ' || v_user_record.email || ' deleted successfully',
    'deleted_employees', v_delete_count
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'message', 'Error deleting user: ' || SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (for admin users)
GRANT EXECUTE ON FUNCTION delete_user_complete(INTEGER) TO authenticated;
