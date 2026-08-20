-- ============================================================================
-- TENANT DATA INTEGRITY AUDIT
-- ============================================================================
-- Finds cross-tenant data bleeds across ALL businesses and branches.
-- No hardcoded IDs - every query derives its own scope, so this stays valid
-- as businesses and branches are added.
--
-- Run each query separately: the Supabase SQL editor only shows the LAST
-- result when several statements are executed together.
-- ============================================================================


-- ============================================================================
-- Q1: Tenant map - what businesses and branches exist, and when
-- ============================================================================
SELECT be.id AS business_id, be.name AS business_name, be.created_at AS business_created,
       b.id  AS branch_id,   b.name  AS branch_name,   b.created_at  AS branch_created
FROM public.business_entities be
LEFT JOIN public.branches b ON b.business_id = be.id
ORDER BY be.id, b.id;


-- ============================================================================
-- Q2: Ledger distribution per branch, vs that branch's real activity
-- ============================================================================
-- A branch whose GL revenue dwarfs its actual recorded sales is holding data
-- that did not originate there.
SELECT
  je.branch_id,
  COALESCE(b.name, '(NULL / orphaned)') AS branch_name,
  COALESCE(be.name, '-')                AS business_name,
  COUNT(DISTINCT je.id)                 AS journal_entries,
  COALESCE(SUM(jl.credit) FILTER (WHERE coa.account_type = 'REVENUE'), 0) AS gl_revenue,
  (SELECT COUNT(*)          FROM public.sales s WHERE s.branch_id = je.branch_id) AS sales_rows,
  (SELECT COALESCE(SUM(s.total),0) FROM public.sales s WHERE s.branch_id = je.branch_id) AS sales_total
FROM public.journal_entries je
LEFT JOIN public.journal_lines jl     ON jl.journal_id = je.id
LEFT JOIN public.chart_of_accounts coa ON coa.id = jl.account_id
LEFT JOIN public.branches b            ON b.id = je.branch_id
LEFT JOIN public.business_entities be  ON be.id = b.business_id
GROUP BY je.branch_id, b.name, be.name
ORDER BY gl_revenue DESC;


-- ============================================================================
-- Q3: Journal entries older than the branch they claim to belong to
-- ============================================================================
-- An entry cannot legitimately predate its own branch. Any row here is
-- migrated/legacy data that was stamped onto a branch after the fact.
SELECT je.branch_id, b.name AS branch_name, be.name AS business_name,
       COUNT(*)           AS entries_predating_branch,
       MIN(je.created_at) AS oldest_entry,
       b.created_at       AS branch_created
FROM public.journal_entries je
JOIN public.branches b           ON b.id = je.branch_id
JOIN public.business_entities be ON be.id = b.business_id
WHERE je.created_at < b.created_at
GROUP BY je.branch_id, b.name, be.name, b.created_at
ORDER BY entries_predating_branch DESC;


-- ============================================================================
-- Q4: Entries listed by source, for any branch flagged above
-- ============================================================================
-- `reference` reveals the origin: SALE-x, PAYROLL-x, PO-x, INV-x, DRAWER-x.
-- Shows only entries that predate their branch, across all tenants.
SELECT be.name AS business_name, b.name AS branch_name,
       je.id, je.reference, je.description, je.created_at,
       SUM(jl.debit) AS total_debit, SUM(jl.credit) AS total_credit
FROM public.journal_entries je
JOIN public.branches b           ON b.id = je.branch_id
JOIN public.business_entities be ON be.id = b.business_id
JOIN public.journal_lines jl     ON jl.journal_id = je.id
WHERE je.created_at < b.created_at
GROUP BY be.name, b.name, je.id, je.reference, je.description, je.created_at
ORDER BY je.created_at
LIMIT 200;


-- ============================================================================
-- Q5: Orphaned GL rows (no branch at all)
-- ============================================================================
-- These belong to no tenant. They previously leaked into every business's
-- reports via the old "OR je.branch_id IS NULL" filter.
SELECT COUNT(DISTINCT je.id) AS orphaned_entries,
       COALESCE(SUM(jl.debit), 0)  AS total_debit,
       COALESCE(SUM(jl.credit), 0) AS total_credit
FROM public.journal_entries je
LEFT JOIN public.journal_lines jl ON jl.journal_id = je.id
WHERE je.branch_id IS NULL;


-- ============================================================================
-- Q6: journal_lines whose branch disagrees with their parent entry
-- ============================================================================
-- Both tables carry branch_id. A mismatch means some posting path stamps them
-- inconsistently, which can surface one tenant's activity inside another's.
SELECT je.branch_id AS entry_branch, jl.branch_id AS line_branch, COUNT(*) AS line_count
FROM public.journal_lines jl
JOIN public.journal_entries je ON jl.journal_id = je.id
WHERE jl.branch_id IS DISTINCT FROM je.branch_id
GROUP BY je.branch_id, jl.branch_id
ORDER BY line_count DESC;


-- ============================================================================
-- Q7: Same NULL/mismatch sweep across the other tenant-scoped tables
-- ============================================================================
-- Rows with no branch_id are invisible to correctly-scoped queries and are
-- how "phantom" totals appear elsewhere.
SELECT 'products'            AS table_name, COUNT(*) AS rows_missing_branch FROM public.products            WHERE branch_id IS NULL
UNION ALL SELECT 'sales',                   COUNT(*) FROM public.sales                   WHERE branch_id IS NULL
UNION ALL SELECT 'sale_items',              COUNT(*) FROM public.sale_items              WHERE branch_id IS NULL
UNION ALL SELECT 'inventory_movements',     COUNT(*) FROM public.inventory_movements     WHERE branch_id IS NULL
UNION ALL SELECT 'journal_entries',         COUNT(*) FROM public.journal_entries         WHERE branch_id IS NULL
UNION ALL SELECT 'journal_lines',           COUNT(*) FROM public.journal_lines           WHERE branch_id IS NULL
UNION ALL SELECT 'purchase_orders',         COUNT(*) FROM public.purchase_orders         WHERE branch_id IS NULL
UNION ALL SELECT 'suppliers',               COUNT(*) FROM public.suppliers               WHERE branch_id IS NULL
UNION ALL SELECT 'employees',               COUNT(*) FROM public.employees               WHERE branch_id IS NULL
ORDER BY rows_missing_branch DESC;
