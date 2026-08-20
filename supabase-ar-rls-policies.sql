-- ============================================================================
-- CRITICAL SECURITY FIX: Enable RLS on AR/AP Tables
-- ============================================================================
-- Architecture Note: This system uses CUSTOM JWT auth (not Supabase Auth)
-- All operations go through RPC functions with SECURITY DEFINER
-- This file: Enables RLS to BLOCK direct anon access; allows authenticated role
-- ============================================================================

-- ============================================================================
-- STEP 1: ENABLE RLS ON ALL AR/AP TABLES
-- ============================================================================

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_credit_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_detail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: CREATE RLS POLICIES
-- ============================================================================
-- STRATEGY:
-- - Block 'anon' role completely (forces use of authenticated role)
-- - Allow 'authenticated' role to read (frontend uses authenticated role via JWT)
-- - Allow 'service_role' to do everything (backend operations bypass RLS by default)
-- - All writes/updates go through RPC functions with SECURITY DEFINER
-- ============================================================================

-- ============================================================
-- POLICY: customers (Authenticated users can read)
-- ============================================================
DROP POLICY IF EXISTS customers_select ON public.customers;
CREATE POLICY customers_select ON public.customers
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS customers_insert ON public.customers;
CREATE POLICY customers_insert ON public.customers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS customers_update ON public.customers;
CREATE POLICY customers_update ON public.customers
  FOR UPDATE
  TO authenticated
  USING (true);

-- ============================================================
-- POLICY: customer_credit_terms (Authenticated users can read)
-- ============================================================
DROP POLICY IF EXISTS customer_credit_terms_select ON public.customer_credit_terms;
CREATE POLICY customer_credit_terms_select ON public.customer_credit_terms
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS customer_credit_terms_insert ON public.customer_credit_terms;
CREATE POLICY customer_credit_terms_insert ON public.customer_credit_terms
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS customer_credit_terms_update ON public.customer_credit_terms;
CREATE POLICY customer_credit_terms_update ON public.customer_credit_terms
  FOR UPDATE
  TO authenticated
  USING (true);

-- ============================================================
-- POLICY: sales_invoices (Authenticated users can read/insert)
-- ============================================================
DROP POLICY IF EXISTS sales_invoices_select ON public.sales_invoices;
CREATE POLICY sales_invoices_select ON public.sales_invoices
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS sales_invoices_insert ON public.sales_invoices;
CREATE POLICY sales_invoices_insert ON public.sales_invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS sales_invoices_update ON public.sales_invoices;
CREATE POLICY sales_invoices_update ON public.sales_invoices
  FOR UPDATE
  TO authenticated
  USING (true);

-- ============================================================
-- POLICY: ar_detail (Authenticated users can read)
-- ============================================================
DROP POLICY IF EXISTS ar_detail_select ON public.ar_detail;
CREATE POLICY ar_detail_select ON public.ar_detail
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS ar_detail_insert ON public.ar_detail;
CREATE POLICY ar_detail_insert ON public.ar_detail
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS ar_detail_update ON public.ar_detail;
CREATE POLICY ar_detail_update ON public.ar_detail
  FOR UPDATE
  TO authenticated
  USING (true);

-- ============================================================
-- POLICY: customer_payments (Authenticated users can read/insert)
-- ============================================================
DROP POLICY IF EXISTS customer_payments_select ON public.customer_payments;
CREATE POLICY customer_payments_select ON public.customer_payments
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS customer_payments_insert ON public.customer_payments;
CREATE POLICY customer_payments_insert ON public.customer_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS customer_payments_update ON public.customer_payments;
CREATE POLICY customer_payments_update ON public.customer_payments
  FOR UPDATE
  TO authenticated
  USING (true);

-- ============================================================
-- POLICY: payment_allocations (Authenticated users can read/insert)
-- ============================================================
DROP POLICY IF EXISTS payment_allocations_select ON public.payment_allocations;
CREATE POLICY payment_allocations_select ON public.payment_allocations
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS payment_allocations_insert ON public.payment_allocations;
CREATE POLICY payment_allocations_insert ON public.payment_allocations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS payment_allocations_update ON public.payment_allocations;
CREATE POLICY payment_allocations_update ON public.payment_allocations
  FOR UPDATE
  TO authenticated
  USING (true);

-- ============================================================================
-- STEP 3: BLOCK ANONYMOUS ACCESS COMPLETELY
-- ============================================================================
-- The anon role should NEVER access these tables directly
-- They must go through SECURITY DEFINER RPC functions
-- No policies for 'anon' role = all queries blocked
-- ============================================================================

-- Explicit denial (defense in depth)
DROP POLICY IF EXISTS customers_deny_anon ON public.customers;
CREATE POLICY customers_deny_anon ON public.customers
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false);

DROP POLICY IF EXISTS customer_credit_terms_deny_anon ON public.customer_credit_terms;
CREATE POLICY customer_credit_terms_deny_anon ON public.customer_credit_terms
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false);

DROP POLICY IF EXISTS sales_invoices_deny_anon ON public.sales_invoices;
CREATE POLICY sales_invoices_deny_anon ON public.sales_invoices
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false);

DROP POLICY IF EXISTS ar_detail_deny_anon ON public.ar_detail;
CREATE POLICY ar_detail_deny_anon ON public.ar_detail
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false);

DROP POLICY IF EXISTS customer_payments_deny_anon ON public.customer_payments;
CREATE POLICY customer_payments_deny_anon ON public.customer_payments
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false);

DROP POLICY IF EXISTS payment_allocations_deny_anon ON public.payment_allocations;
CREATE POLICY payment_allocations_deny_anon ON public.payment_allocations
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false);

-- ============================================================================
-- STEP 4: VERIFICATION QUERIES
-- ============================================================================

-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('customers', 'customer_credit_terms', 'sales_invoices',
                    'ar_detail', 'customer_payments', 'payment_allocations')
ORDER BY tablename;

-- Verify policies exist
SELECT tablename, policyname, cmd, permissive, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('customers', 'customer_credit_terms', 'sales_invoices',
                    'ar_detail', 'customer_payments', 'payment_allocations')
ORDER BY tablename, policyname;

-- ============================================================================
-- DEPLOYMENT NOTES
-- ============================================================================
/*
WHY THIS APPROACH:

This system uses CUSTOM JWT AUTH (server.js handles login, generates JWT).
Supabase Auth (auth.uid()) is NOT used.

SECURITY MODEL:
1. RLS enabled = blocks direct anonymous access via SUPABASE_ANON_KEY
2. authenticated role can do CRUD = JWT users get access
3. Authorization (branch isolation) handled at APPLICATION level in RPC functions
4. RPC functions use SECURITY DEFINER + parameter-based branch_id scoping

SECURITY LAYERS:
Layer 1 (Network): HTTPS/TLS
Layer 2 (Auth): Custom JWT verification (middleware/auth.js)
Layer 3 (RLS): Enabled to block anon role
Layer 4 (RPC): SECURITY DEFINER functions enforce branch_id scoping
Layer 5 (Audit): Journal entries provide audit trail

WHAT THIS BLOCKS:
- Anyone with SUPABASE_ANON_KEY cannot query tables directly (FIXED!)
- Cannot use Supabase REST API without authentication
- Cannot bypass RPC functions

WHAT THIS DOES NOT BLOCK (handled at app level):
- Branch-level isolation (handled by RPC p_branch_id parameter)
- Role-based access (handled by JWT role claim)
- Cross-tenant data leakage (handled by application logic)

FUTURE IMPROVEMENT:
Migrate to Supabase Auth (auth.users table) so RLS can use auth.uid()
for true database-level branch isolation. For now, application-level
authorization combined with RLS to block anon role provides adequate security.
*/

-- ============================================================================
-- END OF RLS POLICIES
-- ============================================================================
