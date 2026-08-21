-- ============================================================================
-- APPROVAL WORKFLOW - RPC FUNCTIONS
-- ============================================================================
-- Run APPROVAL_WORKFLOW_SCHEMA.sql first.
--
-- Generic engine: create_approval_request() / approve_approval_request() /
-- reject_approval_request() / get_pending_approvals(). Four thin,
-- action-specific wrappers file requests through the generic engine:
--   request_payroll_approval()
--   request_po_confirmation()
--   request_supplier_invoice_approval()
--   request_supplier_payment_approval()
-- Each wrapper does its own "would this even succeed?" pre-check before
-- filing, so a manager never approves something that then fails.
--
-- Authorization: a reviewer may approve/reject a request only if they are
-- that department's manager_user_id, OR their users.role = 'admin'.
-- ============================================================================

-- ============================================================================
-- HELPER: reverse the synthesized UUID back to users.id
-- ============================================================================
-- The frontend builds user UUIDs as 00000000-0000-0000-0000-<users.id padded
-- to 12 digits> (see server.js login). This undoes that so SQL can look the
-- user up by their real integer id (e.g. to check users.role).
CREATE OR REPLACE FUNCTION public.zf_uuid_to_user_id(p_uuid UUID)
RETURNS INTEGER LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(SUBSTRING(p_uuid::TEXT FROM 25), '')::INTEGER;
$$;

CREATE OR REPLACE FUNCTION public.zf_is_admin(p_user_uuid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = public.zf_uuid_to_user_id(p_user_uuid) AND role = 'admin'
  );
$$;


-- ============================================================================
-- 1. CREATE APPROVAL REQUEST (generic)
-- ============================================================================
DROP FUNCTION IF EXISTS public.create_approval_request(INTEGER, TEXT, TEXT, JSONB, NUMERIC, UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.create_approval_request(
  p_branch_id INTEGER,
  p_department_name TEXT,
  p_action_type TEXT,
  p_action_payload JSONB,
  p_amount NUMERIC,
  p_requested_by UUID,
  p_title TEXT,
  p_description TEXT
)
RETURNS TABLE (request_id INTEGER, success BOOLEAN, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_department_id INTEGER;
  v_manager_user_id UUID;
  v_request_id INTEGER;
BEGIN
  SELECT id, manager_user_id INTO v_department_id, v_manager_user_id
  FROM public.departments
  WHERE branch_id = p_branch_id AND name = p_department_name;

  IF v_department_id IS NULL THEN
    RETURN QUERY SELECT NULL::INTEGER, FALSE,
      ('Department "' || p_department_name || '" not found for this branch')::TEXT;
    RETURN;
  END IF;

  INSERT INTO public.approval_requests (
    branch_id, department_id, action_type, action_payload, amount,
    title, description, requested_by, status
  ) VALUES (
    p_branch_id, v_department_id, p_action_type, p_action_payload, p_amount,
    p_title, p_description, p_requested_by, 'PENDING'
  )
  RETURNING id INTO v_request_id;

  IF v_manager_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, business_id, title, message, type, action_url)
    SELECT v_manager_user_id, b.business_id,
           'Approval needed: ' || p_title,
           COALESCE(p_description, ''),
           'warning',
           'approvals.html'
    FROM public.branches b WHERE b.id = p_branch_id;
  END IF;

  RETURN QUERY SELECT v_request_id, TRUE,
    CASE WHEN v_manager_user_id IS NULL
      THEN 'Request filed, but this department has no manager assigned yet - ask an admin to assign one.'
      ELSE 'Request sent for approval.'
    END::TEXT;
END;
$$;


-- ============================================================================
-- 2. GET PENDING APPROVALS (for a manager's inbox)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_pending_approvals(INTEGER, UUID);
CREATE OR REPLACE FUNCTION public.get_pending_approvals(
  p_branch_id INTEGER,
  p_reviewer_id UUID
)
RETURNS TABLE (
  id INTEGER, department_name TEXT, action_type TEXT, title TEXT,
  description TEXT, amount NUMERIC, requested_by_name TEXT,
  created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    ar.id, d.name, ar.action_type, ar.title, ar.description, ar.amount,
    COALESCE(e.first_name || ' ' || e.last_name, u.name, 'Unknown'),
    ar.created_at
  FROM public.approval_requests ar
  JOIN public.departments d ON d.id = ar.department_id
  LEFT JOIN public.users u ON u.id = public.zf_uuid_to_user_id(ar.requested_by)
  LEFT JOIN public.employees e ON LOWER(e.email) = LOWER(u.email)
  WHERE ar.branch_id = p_branch_id
    AND ar.status = 'PENDING'
    AND (d.manager_user_id = p_reviewer_id OR public.zf_is_admin(p_reviewer_id))
  ORDER BY ar.created_at;
END;
$$;


-- ============================================================================
-- 3. APPROVE - validates authority, then EXECUTES the underlying action
-- ============================================================================
DROP FUNCTION IF EXISTS public.approve_approval_request(INTEGER, UUID, TEXT);
CREATE OR REPLACE FUNCTION public.approve_approval_request(
  p_request_id INTEGER,
  p_reviewed_by UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_req RECORD;
  -- Single tracked outcome, set by whichever branch runs below, with
  -- exactly ONE `RETURN QUERY` at the very end. RETURN QUERY appends a row
  -- and keeps executing rather than exiting - using it more than once in a
  -- single call would emit multiple rows, and the caller only reads the
  -- first, silently discarding the rest.
  v_success BOOLEAN := TRUE;
  v_result_message TEXT;
  v_payroll RECORD;
  v_po_row RECORD;
  v_invoice RECORD;
  v_payment RECORD;
BEGIN
  SELECT ar.*, d.manager_user_id
  INTO v_req
  FROM public.approval_requests ar
  JOIN public.departments d ON d.id = ar.department_id
  WHERE ar.id = p_request_id
  FOR UPDATE OF ar;

  IF v_req.id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Approval request not found'::TEXT;
    RETURN;
  END IF;

  IF v_req.status != 'PENDING' THEN
    RETURN QUERY SELECT FALSE, ('This request was already ' || LOWER(v_req.status))::TEXT;
    RETURN;
  END IF;

  IF v_req.manager_user_id IS DISTINCT FROM p_reviewed_by AND NOT public.zf_is_admin(p_reviewed_by) THEN
    RETURN QUERY SELECT FALSE, 'You are not the manager for this department'::TEXT;
    RETURN;
  END IF;

  -- Dispatch: execute the actual action now that it's approved. Each branch
  -- only sets v_success/v_result_message - no early RETURN - so the request
  -- always gets marked reviewed below, even when the underlying action fails.
  IF v_req.action_type = 'RUN_PAYROLL' THEN
    SELECT * INTO v_payroll FROM public.process_payroll(
      v_req.branch_id,
      (v_req.action_payload->>'month')::INTEGER,
      (v_req.action_payload->>'year')::INTEGER
    );
    v_success := v_payroll.payroll_run_id IS NOT NULL;
    v_result_message := CASE WHEN v_success THEN v_payroll.message
      ELSE 'Approved, but payroll could not run: ' || v_payroll.message END;

  ELSIF v_req.action_type = 'CONFIRM_PURCHASE_ORDER' THEN
    UPDATE public.purchase_orders
    SET status = 'CONFIRMED'
    WHERE id = (v_req.action_payload->>'po_id')::INTEGER AND status = 'DRAFT'
    RETURNING * INTO v_po_row;

    v_success := v_po_row.id IS NOT NULL;
    v_result_message := CASE WHEN v_success
      THEN 'PO ' || v_po_row.po_number || ' confirmed and sent to supplier'
      ELSE 'Approved, but PO was not in DRAFT status - could not confirm'
    END;

  ELSIF v_req.action_type = 'RECORD_PURCHASE_INVOICE' THEN
    SELECT * INTO v_invoice FROM public.record_purchase_invoice(
      (v_req.action_payload->>'po_id')::INTEGER,
      v_req.action_payload->>'supplier_invoice_no',
      (v_req.action_payload->>'invoice_date')::DATE,
      (v_req.action_payload->>'amount')::NUMERIC
    );
    v_success := v_invoice.invoice_id IS NOT NULL;
    v_result_message := v_invoice.message;

  ELSIF v_req.action_type = 'PROCESS_SUPPLIER_PAYMENT' THEN
    SELECT * INTO v_payment FROM public.process_purchase_payment(
      (v_req.action_payload->>'invoice_id')::INTEGER,
      (v_req.action_payload->>'amount')::NUMERIC,
      (v_req.action_payload->>'payment_date')::DATE,
      v_req.action_payload->>'method',
      v_req.action_payload->>'reference'
    );
    v_success := v_payment.success;
    v_result_message := v_payment.message;

  ELSE
    v_success := FALSE;
    v_result_message := 'Unknown action type: ' || v_req.action_type;
  END IF;

  -- Marked APPROVED either way: the manager's decision to approve stands
  -- even if the underlying action then failed to execute - result_message
  -- (and v_success in the response below) records what actually happened.
  UPDATE public.approval_requests
  SET status = 'APPROVED', reviewed_by = p_reviewed_by, reviewed_at = NOW(),
      review_notes = p_notes, result_message = v_result_message
  WHERE id = p_request_id;

  INSERT INTO public.notifications (user_id, business_id, title, message, type)
  SELECT v_req.requested_by, b.business_id,
         (CASE WHEN v_success THEN 'Approved: ' ELSE 'Approved (but failed): ' END) || v_req.title,
         COALESCE(v_result_message, 'Approved'),
         CASE WHEN v_success THEN 'success' ELSE 'error' END
  FROM public.branches b WHERE b.id = v_req.branch_id;

  RETURN QUERY SELECT v_success, COALESCE(v_result_message, 'Approved')::TEXT;
END;
$$;


-- ============================================================================
-- 4. REJECT - sends a task back to the requester's in-tray, per your
--    decision, rather than just a notification.
-- ============================================================================
DROP FUNCTION IF EXISTS public.reject_approval_request(INTEGER, UUID, TEXT);
CREATE OR REPLACE FUNCTION public.reject_approval_request(
  p_request_id INTEGER,
  p_reviewed_by UUID,
  p_notes TEXT
)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_req RECORD;
BEGIN
  SELECT ar.*, d.manager_user_id
  INTO v_req
  FROM public.approval_requests ar
  JOIN public.departments d ON d.id = ar.department_id
  WHERE ar.id = p_request_id
  FOR UPDATE OF ar;

  IF v_req.id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Approval request not found'::TEXT; RETURN;
  END IF;

  IF v_req.status != 'PENDING' THEN
    RETURN QUERY SELECT FALSE, ('This request was already ' || LOWER(v_req.status))::TEXT; RETURN;
  END IF;

  IF v_req.manager_user_id IS DISTINCT FROM p_reviewed_by AND NOT public.zf_is_admin(p_reviewed_by) THEN
    RETURN QUERY SELECT FALSE, 'You are not the manager for this department'::TEXT; RETURN;
  END IF;

  IF p_notes IS NULL OR TRIM(p_notes) = '' THEN
    RETURN QUERY SELECT FALSE, 'A reason is required when rejecting a request'::TEXT; RETURN;
  END IF;

  UPDATE public.approval_requests
  SET status = 'REJECTED', reviewed_by = p_reviewed_by, reviewed_at = NOW(), review_notes = p_notes
  WHERE id = p_request_id;

  -- Send it back to the requester's in-tray to amend and resend.
  INSERT INTO public.employee_tasks (
    user_id, business_id, title, description, priority, status, assigned_to, assigned_by
  )
  SELECT
    v_req.requested_by, b.business_id,
    'Rejected: ' || v_req.title,
    'Your manager rejected this request:' || E'\n\n' || p_notes ||
      E'\n\nAmend and resubmit through the normal screen when ready.',
    'HIGH', 'TODO', v_req.requested_by, p_reviewed_by
  FROM public.branches b WHERE b.id = v_req.branch_id;

  RETURN QUERY SELECT TRUE, 'Rejected - sent back to the requester''s tasks to amend and resend'::TEXT;
END;
$$;


-- ============================================================================
-- 5a. PAYROLL WRAPPER
-- ============================================================================
DROP FUNCTION IF EXISTS public.request_payroll_approval(INTEGER, INTEGER, INTEGER, UUID);
CREATE OR REPLACE FUNCTION public.request_payroll_approval(
  p_branch_id INTEGER,
  p_month INTEGER,
  p_year INTEGER,
  p_requested_by UUID
)
RETURNS TABLE (request_id INTEGER, success BOOLEAN, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Same pre-check process_payroll() itself does - fail fast rather than
  -- making a manager approve something that can't succeed.
  IF EXISTS (
    SELECT 1 FROM public.payroll_runs
    WHERE branch_id = p_branch_id AND month = p_month AND year = p_year AND status != 'REVERSED'
  ) THEN
    RETURN QUERY SELECT NULL::INTEGER, FALSE, 'Payroll already exists for this period'::TEXT;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.approval_requests
    WHERE branch_id = p_branch_id AND action_type = 'RUN_PAYROLL' AND status = 'PENDING'
      AND (action_payload->>'month')::INTEGER = p_month
      AND (action_payload->>'year')::INTEGER = p_year
  ) THEN
    RETURN QUERY SELECT NULL::INTEGER, FALSE, 'A payroll approval for this period is already pending'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT * FROM public.create_approval_request(
    p_branch_id, 'Human Resources', 'RUN_PAYROLL',
    jsonb_build_object('month', p_month, 'year', p_year),
    NULL,
    p_requested_by,
    'Run payroll for ' || p_month || '/' || p_year,
    'Payroll runs always require manager approval before processing.'
  );
END;
$$;


-- ============================================================================
-- 5b. CONFIRM PURCHASE ORDER WRAPPER (threshold-gated)
-- ============================================================================
DROP FUNCTION IF EXISTS public.request_po_confirmation(INTEGER, UUID);
CREATE OR REPLACE FUNCTION public.request_po_confirmation(
  p_po_id INTEGER,
  p_requested_by UUID
)
-- Executes immediately (returns confirmed=TRUE) if under threshold; otherwise
-- files an approval request (confirmed=FALSE, request_id set).
RETURNS TABLE (confirmed BOOLEAN, request_id INTEGER, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_po RECORD;
  v_threshold NUMERIC;
  v_req RECORD;
BEGIN
  SELECT po.*, b.business_id INTO v_po
  FROM public.purchase_orders po
  JOIN public.branches b ON b.id = po.branch_id
  WHERE po.id = p_po_id;

  IF v_po.id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::INTEGER, 'PO not found'::TEXT; RETURN;
  END IF;

  IF v_po.status != 'DRAFT' THEN
    RETURN QUERY SELECT FALSE, NULL::INTEGER, ('PO must be DRAFT status (currently ' || v_po.status || ')')::TEXT; RETURN;
  END IF;

  SELECT COALESCE((bs.settings->'approval_thresholds'->>'po_threshold')::NUMERIC, 5000)
  INTO v_threshold
  FROM public.business_settings bs WHERE bs.business_id = v_po.business_id;
  v_threshold := COALESCE(v_threshold, 5000);

  IF v_po.total_amount < v_threshold THEN
    UPDATE public.purchase_orders SET status = 'CONFIRMED' WHERE id = p_po_id;
    RETURN QUERY SELECT TRUE, NULL::INTEGER,
      ('PO ' || v_po.po_number || ' confirmed (K' || v_po.total_amount || ' is under the K' || v_threshold || ' approval threshold)')::TEXT;
    RETURN;
  END IF;

  SELECT * INTO v_req FROM public.create_approval_request(
    v_po.branch_id, 'Purchasing', 'CONFIRM_PURCHASE_ORDER',
    jsonb_build_object('po_id', v_po.id),
    v_po.total_amount,
    p_requested_by,
    'Confirm PO ' || v_po.po_number || ' - K' || v_po.total_amount,
    'PO total is at or above the K' || v_threshold || ' approval threshold.'
  );
  RETURN QUERY SELECT FALSE, v_req.request_id, v_req.message;
END;
$$;


-- ============================================================================
-- 5c. RECORD SUPPLIER INVOICE WRAPPER (threshold-gated)
-- ============================================================================
DROP FUNCTION IF EXISTS public.request_supplier_invoice_approval(INTEGER, TEXT, DATE, NUMERIC, UUID);
CREATE OR REPLACE FUNCTION public.request_supplier_invoice_approval(
  p_po_id INTEGER,
  p_supplier_invoice_no TEXT,
  p_invoice_date DATE,
  p_amount NUMERIC,
  p_requested_by UUID
)
RETURNS TABLE (recorded BOOLEAN, request_id INTEGER, matched BOOLEAN, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_po RECORD;
  v_threshold NUMERIC;
  v_result RECORD;
  v_req RECORD;
BEGIN
  SELECT po.*, b.business_id INTO v_po
  FROM public.purchase_orders po
  JOIN public.branches b ON b.id = po.branch_id
  WHERE po.id = p_po_id;

  IF v_po.id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::INTEGER, FALSE, 'PO not found'::TEXT; RETURN;
  END IF;

  SELECT COALESCE((bs.settings->'approval_thresholds'->>'supplier_invoice_threshold')::NUMERIC, 5000)
  INTO v_threshold
  FROM public.business_settings bs WHERE bs.business_id = v_po.business_id;
  v_threshold := COALESCE(v_threshold, 5000);

  IF p_amount < v_threshold THEN
    SELECT * INTO v_result FROM public.record_purchase_invoice(p_po_id, p_supplier_invoice_no, p_invoice_date, p_amount);
    RETURN QUERY SELECT TRUE, NULL::INTEGER, v_result.matched, v_result.message;
    RETURN;
  END IF;

  SELECT * INTO v_req FROM public.create_approval_request(
    v_po.branch_id, 'Purchasing', 'RECORD_PURCHASE_INVOICE',
    jsonb_build_object(
      'po_id', p_po_id, 'supplier_invoice_no', p_supplier_invoice_no,
      'invoice_date', p_invoice_date, 'amount', p_amount
    ),
    p_amount,
    p_requested_by,
    'Record supplier invoice ' || p_supplier_invoice_no || ' - K' || p_amount,
    'Invoice amount is at or above the K' || v_threshold || ' approval threshold.'
  );
  RETURN QUERY SELECT FALSE, v_req.request_id, NULL::BOOLEAN, v_req.message;
END;
$$;


-- ============================================================================
-- 5d. SUPPLIER PAYMENT WRAPPER (threshold-gated)
-- ============================================================================
DROP FUNCTION IF EXISTS public.request_supplier_payment_approval(INTEGER, NUMERIC, DATE, TEXT, TEXT, UUID);
CREATE OR REPLACE FUNCTION public.request_supplier_payment_approval(
  p_invoice_id INTEGER,
  p_amount NUMERIC,
  p_payment_date DATE,
  p_method TEXT,
  p_reference TEXT,
  p_requested_by UUID
)
RETURNS TABLE (paid BOOLEAN, request_id INTEGER, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_invoice RECORD;
  v_branch_id INTEGER;
  v_business_id INTEGER;
  v_threshold NUMERIC;
  v_result RECORD;
  v_req RECORD;
BEGIN
  SELECT pi.*, po.branch_id, b.business_id
  INTO v_invoice
  FROM public.purchase_invoices pi
  JOIN public.purchase_orders po ON po.id = pi.po_id
  JOIN public.branches b ON b.id = po.branch_id
  WHERE pi.id = p_invoice_id;

  IF v_invoice.id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::INTEGER, 'Invoice not found'::TEXT; RETURN;
  END IF;

  SELECT COALESCE((bs.settings->'approval_thresholds'->>'supplier_payment_threshold')::NUMERIC, 5000)
  INTO v_threshold
  FROM public.business_settings bs WHERE bs.business_id = v_invoice.business_id;
  v_threshold := COALESCE(v_threshold, 5000);

  IF p_amount < v_threshold THEN
    SELECT * INTO v_result FROM public.process_purchase_payment(p_invoice_id, p_amount, p_payment_date, p_method, p_reference);
    RETURN QUERY SELECT TRUE, NULL::INTEGER, v_result.message;
    RETURN;
  END IF;

  SELECT * INTO v_req FROM public.create_approval_request(
    v_invoice.branch_id, 'Purchasing', 'PROCESS_SUPPLIER_PAYMENT',
    jsonb_build_object(
      'invoice_id', p_invoice_id, 'amount', p_amount, 'payment_date', p_payment_date,
      'method', p_method, 'reference', p_reference
    ),
    p_amount,
    p_requested_by,
    'Supplier payment - K' || p_amount || ' (' || p_method || ')',
    'Payment amount is at or above the K' || v_threshold || ' approval threshold.'
  );
  RETURN QUERY SELECT FALSE, v_req.request_id, v_req.message;
END;
$$;


-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name IN (
  'zf_uuid_to_user_id', 'zf_is_admin', 'create_approval_request',
  'get_pending_approvals', 'approve_approval_request', 'reject_approval_request',
  'request_payroll_approval', 'request_po_confirmation',
  'request_supplier_invoice_approval', 'request_supplier_payment_approval'
)
ORDER BY routine_name;
-- Should return all 10.
