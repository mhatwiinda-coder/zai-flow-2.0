-- ============================================================================
-- TENANT ISOLATION TEST - works for ANY number of businesses and branches
-- ============================================================================
-- Nothing here is hardcoded to a particular branch. Every check enumerates
-- whatever businesses and branches exist at the time it runs, so it stays
-- valid as you add more.
--
-- Run this before a live demo, and again after adding a business, to prove
-- each tenant sees only its own numbers.
--
-- The bug this is designed to catch: a scoped function that accepts a branch
-- parameter but doesn't actually apply it. That failure is invisible on a
-- single-tenant dataset - it only shows when two tenants return the same
-- answer, or when a function's answer disagrees with the raw data.
-- ============================================================================


-- ============================================================================
-- TEST 1: Does each function agree with the raw data, per branch?
-- ============================================================================
-- The definitive check. For every branch, compare what get_trial_balance()
-- reports against a directly-filtered query over the same ledger. Any row
-- that says MISMATCH means the function is not honouring its parameter.
SELECT
  b.id                                   AS branch_id,
  be.name                                AS business,
  b.name                                 AS branch,
  COALESCE(fn.debits, 0)                 AS function_reports,
  COALESCE(raw.debits, 0)                AS ground_truth,
  CASE
    WHEN COALESCE(fn.debits,0) = COALESCE(raw.debits,0) THEN 'OK'
    ELSE 'MISMATCH - function is not filtering by branch'
  END                                    AS verdict
FROM public.branches b
JOIN public.business_entities be ON be.id = b.business_id
LEFT JOIN LATERAL (
  SELECT SUM(total_debit) AS debits FROM public.get_trial_balance(b.id)
) fn ON TRUE
LEFT JOIN LATERAL (
  SELECT SUM(jl.debit) AS debits
  FROM public.journal_lines jl
  JOIN public.journal_entries je ON je.id = jl.journal_id
  WHERE je.branch_id = b.id
) raw ON TRUE
ORDER BY be.name, b.name;
-- EVERY row must read OK.


-- ============================================================================
-- TEST 2: Do any two different branches report identical totals?
-- ============================================================================
-- Two unrelated tenants producing byte-identical ledgers is the signature of
-- an inert filter. (Genuinely empty branches both reporting 0 is expected and
-- excluded below.)
WITH per_branch AS (
  SELECT b.id, b.name,
         (SELECT COALESCE(SUM(total_debit),0) FROM public.get_trial_balance(b.id)) AS debits
  FROM public.branches b
)
SELECT a.id AS branch_a, a.name AS branch_a_name,
       c.id AS branch_b, c.name AS branch_b_name,
       a.debits AS identical_total,
       'SUSPICIOUS - two branches report the same non-zero total' AS verdict
FROM per_branch a
JOIN per_branch c ON c.id > a.id AND c.debits = a.debits
WHERE a.debits <> 0;
-- Expect ZERO rows. Non-zero rows warrant investigation (it is possible but
-- unlikely for two real branches to coincidentally match to the cent).


-- ============================================================================
-- TEST 3: Same check for the P&L
-- ============================================================================
SELECT
  b.id AS branch_id, be.name AS business, b.name AS branch,
  pl.revenue, pl.expenses, pl.net_profit
FROM public.branches b
JOIN public.business_entities be ON be.id = b.business_id
LEFT JOIN LATERAL (SELECT * FROM public.get_profit_loss(b.id)) pl ON TRUE
ORDER BY be.name, b.name;
-- Read across the rows: different businesses must show different figures.
-- Identical revenue across unrelated businesses = the same class of bug.


-- ============================================================================
-- TEST 4: Trial balance vs general ledger, per branch
-- ============================================================================
-- These two totals are produced by independent code paths, so agreement is
-- meaningful evidence rather than a tautology.
SELECT
  b.id AS branch_id, b.name AS branch,
  COALESCE(tb.d, 0) AS trial_balance_debits,
  COALESCE(gl.d, 0) AS general_ledger_debits,
  CASE WHEN COALESCE(tb.d,0) = COALESCE(gl.d,0) THEN 'OK' ELSE 'MISMATCH' END AS verdict
FROM public.branches b
LEFT JOIN LATERAL (SELECT SUM(total_debit) AS d FROM public.get_trial_balance(b.id)) tb ON TRUE
LEFT JOIN LATERAL (SELECT SUM(debit)       AS d FROM public.get_general_ledger(b.id)) gl ON TRUE
ORDER BY b.id;
-- EVERY row must read OK.


-- ============================================================================
-- TEST 5: Operational tables - is anything unassigned?
-- ============================================================================
-- Rows with a NULL branch_id belong to no tenant. They are invisible to
-- correctly-scoped queries, and are how "phantom" figures appear when a
-- query is NOT correctly scoped.
SELECT 'sales'               AS table_name, COUNT(*) AS unassigned_rows FROM public.sales               WHERE branch_id IS NULL
UNION ALL SELECT 'sale_items',              COUNT(*) FROM public.sale_items          WHERE branch_id IS NULL
UNION ALL SELECT 'products',                COUNT(*) FROM public.products            WHERE branch_id IS NULL
UNION ALL SELECT 'journal_entries',         COUNT(*) FROM public.journal_entries     WHERE branch_id IS NULL
UNION ALL SELECT 'journal_lines',           COUNT(*) FROM public.journal_lines       WHERE branch_id IS NULL
UNION ALL SELECT 'inventory_movements',     COUNT(*) FROM public.inventory_movements WHERE branch_id IS NULL
UNION ALL SELECT 'purchase_orders',         COUNT(*) FROM public.purchase_orders     WHERE branch_id IS NULL
UNION ALL SELECT 'suppliers',               COUNT(*) FROM public.suppliers           WHERE branch_id IS NULL
UNION ALL SELECT 'employees',               COUNT(*) FROM public.employees           WHERE branch_id IS NULL
UNION ALL SELECT 'attendance',              COUNT(*) FROM public.attendance          WHERE branch_id IS NULL
ORDER BY unassigned_rows DESC;
-- Ideally all zero. Anything non-zero should be assigned or removed before a
-- live demo, since it will never appear under any tenant.


-- ============================================================================
-- TEST 6: Every scoped function takes a branch parameter
-- ============================================================================
-- Catches a function that was rebuilt with a business_id parameter, or none
-- at all, which would silently widen its scope.
SELECT p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       CASE
         WHEN pg_get_function_arguments(p.oid) LIKE '%p_branch_id%' THEN 'branch-scoped'
         WHEN pg_get_function_arguments(p.oid) LIKE '%p_business_id%' THEN 'BUSINESS-scoped - wider than branch'
         ELSE 'NO TENANT PARAMETER'
       END AS scoping
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'get_trial_balance','get_profit_loss','get_general_ledger',
    'get_business_employees','get_business_departments','get_daily_attendance',
    'process_payroll','get_ar_aging_report','get_pending_approvals'
  )
ORDER BY p.proname;
-- Anything reporting NO TENANT PARAMETER returns data across all tenants.
