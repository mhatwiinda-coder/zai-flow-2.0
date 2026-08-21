-- ============================================================================
-- APPROVAL WORKFLOW - SCHEMA
-- ============================================================================
-- Item 4: managers can view and authorize actions in their department, but
-- not perform them directly. Gates two workflows:
--   - HR: running payroll (always requires approval, no threshold)
--   - Purchasing: confirming a PO, recording/matching a supplier invoice, and
--     processing a supplier payment (each gated above a configurable Kwacha
--     threshold, default K5,000 per the Zambia SME research)
--
-- Built generically (action_type + JSONB payload) so more gated actions can
-- be added later without another schema change.
-- ============================================================================

-- ============================================================================
-- STEP 1: One manager per department, per branch
-- ============================================================================
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS manager_user_id UUID;

COMMENT ON COLUMN public.departments.manager_user_id IS
  'Synthesized user UUID (00000000-0000-0000-0000-<zero-padded users.id>), matching the convention used by employee_tasks/notifications/employee_attendance. NULL until an admin assigns a manager - requests for that department queue with no approver until then.';


-- ============================================================================
-- STEP 2: The approval queue itself
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  department_id INTEGER REFERENCES public.departments(id),

  action_type TEXT NOT NULL CHECK (action_type IN (
    'RUN_PAYROLL',
    'CONFIRM_PURCHASE_ORDER',
    'RECORD_PURCHASE_INVOICE',
    'PROCESS_SUPPLIER_PAYMENT'
  )),
  -- Everything the approval handler needs to actually perform the action once
  -- approved, e.g. {"month": 8, "year": 2026} or {"po_id": 42}.
  action_payload JSONB NOT NULL,
  -- For display and audit. NULL for payroll, which has no natural per-request amount.
  amount NUMERIC(12,2),

  title TEXT NOT NULL,
  description TEXT,

  requested_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),

  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  -- What happened when the underlying action actually ran (e.g.
  -- process_payroll's own message), or the error if it failed on approval.
  result_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_branch ON public.approval_requests(branch_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_department ON public.approval_requests(department_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON public.approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_requested_by ON public.approval_requests(requested_by);


-- ============================================================================
-- STEP 3: Default approval thresholds
-- ============================================================================
-- Stored per-business in business_settings.settings (JSONB) rather than
-- hardcoded, since this ERP serves businesses of very different scale - a
-- K5,000 threshold makes sense for a shop this size, not necessarily for a
-- much larger operation using the same platform later.
--
-- The RPCs read this with COALESCE(..., 5000) fallbacks, so this backfill is
-- optional - it just makes the default explicit and easy to find/edit rather
-- than implicit in code. Only fills it in where it's not already set.
UPDATE public.business_settings
SET settings = settings || jsonb_build_object(
  'approval_thresholds', jsonb_build_object(
    'po_threshold', 5000,
    'supplier_payment_threshold', 5000,
    'supplier_invoice_threshold', 5000
  )
)
WHERE NOT (settings ? 'approval_thresholds');

-- Businesses created after this schema runs won't have a business_settings
-- row automatically extended above - the RPCs' COALESCE fallback covers
-- that case, but backfilling here keeps things explicit for existing ones.


-- ============================================================================
-- STEP 4: Register the Approvals page in the sidebar RBAC registry
-- ============================================================================
-- get_user_accessible_modules() drives the sidebar entirely off
-- functions/role_functions/user_roles - a hardcoded HTML link would be wiped
-- out on load (sidebar-manager.js clears and rebuilds every link). Grant it
-- to admin and manager, the two roles who review approvals.
INSERT INTO public.functions (code, module, name, description, icon, url)
SELECT 'approvals_inbox', 'approvals', 'Approvals', 'Review and action pending approval requests', '✅', 'approvals.html'
WHERE NOT EXISTS (SELECT 1 FROM public.functions WHERE code = 'approvals_inbox');

INSERT INTO public.role_functions (role_id, function_id)
SELECT r.id, f.id
FROM public.roles r
CROSS JOIN public.functions f
WHERE r.code IN ('admin', 'manager') AND f.code = 'approvals_inbox'
  AND NOT EXISTS (
    SELECT 1 FROM public.role_functions
    WHERE role_id = r.id AND function_id = f.id
  );


-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'departments' AND column_name = 'manager_user_id';

SELECT table_name FROM information_schema.tables WHERE table_name = 'approval_requests';

SELECT be.name AS business, bs.settings->'approval_thresholds' AS thresholds
FROM public.business_settings bs
JOIN public.business_entities be ON be.id = bs.business_id;

SELECT r.code AS role, f.code AS function_code
FROM public.role_functions rf
JOIN public.roles r ON r.id = rf.role_id
JOIN public.functions f ON f.id = rf.function_id
WHERE f.code = 'approvals_inbox';
-- Should show two rows: admin and manager
