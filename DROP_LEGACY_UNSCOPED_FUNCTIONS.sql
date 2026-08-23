-- ============================================================================
-- REMOVE LEGACY UNSCOPED FUNCTION OVERLOADS
-- ============================================================================
-- Your own Test 6 output showed several functions existing TWICE - a correct
-- branch-scoped version alongside an older overload with no tenant parameter:
--
--   get_general_ledger  ()                                NO TENANT PARAMETER
--   get_general_ledger  (p_branch_id integer)             branch-scoped
--   get_profit_loss     ()                                NO TENANT PARAMETER
--   get_profit_loss     (p_branch_id integer)             branch-scoped
--   get_trial_balance   ()                                NO TENANT PARAMETER
--   get_trial_balance   (p_branch_id integer)             branch-scoped
--   process_payroll     (p_month, p_year)                 NO TENANT PARAMETER
--   process_payroll     (p_branch_id, p_month, p_year)    branch-scoped
--
-- Why they survived: every fix script I wrote used
--   DROP FUNCTION IF EXISTS public.get_trial_balance(INTEGER);
-- which only drops the one-INTEGER overload. Postgres treats a different
-- argument list as a DIFFERENT function, so the zero-argument original was
-- never touched and has been sitting there the whole time.
--
-- Confirmed from source: the legacy get_trial_balance() body is
--
--     FROM chart_of_accounts coa
--     LEFT JOIN journal_lines jl ON coa.id = jl.account_id
--     GROUP BY ...
--
-- with no join to journal_entries and no filter of any kind. It returns every
-- business's ledger combined, by design, because it predates multi-tenancy.
--
-- The most dangerous of these is process_payroll(p_month, p_year): it takes no
-- branch, so invoking it would attempt payroll across every branch in the
-- system at once.
--
-- SAFETY CHECK ALREADY DONE: the frontend calls all four of these with named
-- parameters (p_branch_id / p_month / p_year), so PostgREST resolves to the
-- scoped overloads. Nothing in the application calls the legacy signatures -
-- dropping them removes a trap without changing current behaviour.
-- ============================================================================


-- ============================================================================
-- STEP 1: REVIEW before dropping - what exists right now
-- ============================================================================
SELECT p.oid::regprocedure AS full_signature,
       CASE
         WHEN pg_get_function_arguments(p.oid) LIKE '%p_branch_id%' THEN 'KEEP - branch-scoped'
         ELSE 'DROP - no tenant filter'
       END AS action
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('get_trial_balance','get_profit_loss','get_general_ledger','process_payroll')
ORDER BY p.proname, full_signature;


-- ============================================================================
-- STEP 2: DROP the unscoped overloads
-- ============================================================================
-- Dropped by exact signature so the branch-scoped versions are untouched.
DROP FUNCTION IF EXISTS public.get_trial_balance();
DROP FUNCTION IF EXISTS public.get_profit_loss();
DROP FUNCTION IF EXISTS public.get_general_ledger();
DROP FUNCTION IF EXISTS public.process_payroll(INTEGER, INTEGER);

-- Older builds also carried business-scoped variants. Business scope is wider
-- than branch scope, so these would silently show one business's combined
-- figures where a single branch was expected.
DROP FUNCTION IF EXISTS public.get_trial_balance(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.get_profit_loss(INTEGER, INTEGER);


-- ============================================================================
-- STEP 2b: WRITE-side legacy overloads found by the Step 4 sweep
-- ============================================================================
-- create_sale(p_total, p_payment_method, p_items) predates multi-tenancy and
-- never sets branch_id. Any sale written through it lands with branch_id NULL:
-- invisible to every branch-scoped report, but still counted by anything
-- reading the table unscoped. That is the exact mechanism behind the phantom
-- ledger figures. The live version is
-- create_sale(p_branch_id, p_total, p_payment_method, p_items).
DROP FUNCTION IF EXISTS public.create_sale(NUMERIC, TEXT, JSONB);
DROP FUNCTION IF EXISTS create_sale(NUMERIC, TEXT, JSONB);

-- approve_leave/reject_leave: the 2-argument originals take no branch, so a
-- leave request from any branch could be actioned. Superseded by the
-- 3-argument (p_leave_request_id, p_branch_id, p_approved_by) versions in
-- FIX_HR_BUSINESS_BRANCH_MISMATCH.sql.
DROP FUNCTION IF EXISTS public.approve_leave(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS approve_leave(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.reject_leave(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS reject_leave(INTEGER, INTEGER);


-- ============================================================================
-- STEP 3: VERIFY - exactly one signature per function, all branch-scoped
-- ============================================================================
SELECT p.proname,
       COUNT(*) AS overloads,
       string_agg(pg_get_function_arguments(p.oid), '  |  ') AS signatures
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('get_trial_balance','get_profit_loss','get_general_ledger',
                    'process_payroll','create_sale','approve_leave','reject_leave')
GROUP BY p.proname
ORDER BY p.proname;
-- Every row must show overloads = 1, and every signature must contain
-- p_branch_id.


-- ============================================================================
-- STEP 3b: Are there orphaned sales from the legacy create_sale?
-- ============================================================================
-- Sales written by the unscoped overload have no branch and belong to no
-- tenant. They must be assigned or removed - they will never appear in any
-- branch's reports, yet they inflate anything that reads the table unscoped.
SELECT COUNT(*) AS orphaned_sales,
       COALESCE(SUM(total), 0) AS orphaned_value
FROM public.sales WHERE branch_id IS NULL;

SELECT COUNT(*) AS orphaned_sale_items FROM public.sale_items WHERE branch_id IS NULL;


-- ============================================================================
-- STEP 4: Catch any OTHER unscoped overload hiding in the schema
-- ============================================================================
-- Generic sweep - not limited to the four above, so it will surface anything
-- similar that I have not thought to name.
SELECT p.oid::regprocedure AS full_signature,
       pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  -- Functions that read tenant-scoped tables...
  AND pg_get_functiondef(p.oid) ~* '(journal_lines|journal_entries|sales|products|employees|attendance|purchase_orders)'
  -- ...but take no tenant parameter at all
  AND pg_get_function_arguments(p.oid) !~* '(branch_id|business_id)'
  AND p.proname NOT LIKE 'zf_%'
ORDER BY p.proname;
-- Ideally zero rows. Anything listed reads tenant data without a tenant
-- parameter and should be reviewed before a live demo.
