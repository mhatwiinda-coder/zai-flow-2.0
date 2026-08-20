-- ============================================================================
-- DIAGNOSTIC: where did branch 8's journal entries actually come from?
-- ============================================================================
-- Branch 8 (ROYALTY MAKEUP AND HAIR - KABWATA BRANCH) has 2 products worth
-- ~K630 and 2 employees, but its ledger shows K825,242 revenue and K285,000
-- expenses. Those transactions cannot be its own. This finds their origin.
--
-- Run each query separately - the Supabase editor only shows the LAST result.
-- ============================================================================


-- ============================================================================
-- Q1: When were the business and branch created?
-- ============================================================================
-- Any journal entry dated BEFORE this cannot legitimately belong to branch 8.
SELECT b.id AS branch_id, b.name AS branch_name, b.created_at AS branch_created,
       be.id AS business_id, be.name AS business_name, be.created_at AS business_created
FROM public.branches b
JOIN public.business_entities be ON b.business_id = be.id
WHERE b.id = 8;


-- ============================================================================
-- Q2: Every journal entry on branch 8, oldest first
-- ============================================================================
-- The `reference` column identifies the source: SALE-x, PAYROLL-x, PO-x, INV-x.
-- Compare created_at against the branch creation date from Q1 - entries older
-- than the branch are proof of foreign data.
SELECT je.id, je.reference, je.description, je.created_at,
       SUM(jl.debit) AS total_debit, SUM(jl.credit) AS total_credit
FROM public.journal_entries je
JOIN public.journal_lines jl ON jl.journal_id = je.id
WHERE je.branch_id = 8
GROUP BY je.id, je.reference, je.description, je.created_at
ORDER BY je.created_at;


-- ============================================================================
-- Q3: How many entries predate the branch itself?
-- ============================================================================
SELECT
  COUNT(*) FILTER (WHERE je.created_at < b.created_at) AS entries_older_than_branch,
  COUNT(*)                                             AS entries_total,
  MIN(je.created_at)                                   AS oldest_entry,
  b.created_at                                         AS branch_created
FROM public.journal_entries je
CROSS JOIN (SELECT created_at FROM public.branches WHERE id = 8) b
WHERE je.branch_id = 8
GROUP BY b.created_at;


-- ============================================================================
-- Q4: Do journal_lines disagree with their parent entry about the branch?
-- ============================================================================
-- journal_lines also carries branch_id. If a line says one branch and its
-- entry says another, some posting code is stamping them inconsistently -
-- which would let one business's activity surface in another's reports.
SELECT je.branch_id AS entry_branch, jl.branch_id AS line_branch,
       COUNT(*) AS line_count
FROM public.journal_lines jl
JOIN public.journal_entries je ON jl.journal_id = je.id
WHERE je.branch_id = 8 OR jl.branch_id = 8
GROUP BY je.branch_id, jl.branch_id
ORDER BY line_count DESC;


-- ============================================================================
-- Q5: How is branch_id distributed across the WHOLE ledger?
-- ============================================================================
-- Shows whether branch 8 is an outlier, and whether other branches have data.
-- If nearly everything sits on branch 8, some code is defaulting to it.
SELECT je.branch_id,
       COALESCE(b.name, '(no such branch / NULL)') AS branch_name,
       COUNT(DISTINCT je.id) AS entries,
       SUM(jl.debit)         AS total_debit
FROM public.journal_entries je
LEFT JOIN public.journal_lines jl ON jl.journal_id = je.id
LEFT JOIN public.branches b ON b.id = je.branch_id
GROUP BY je.branch_id, b.name
ORDER BY entries DESC;


-- ============================================================================
-- Q6: Does branch 8 actually have sales to justify K825,242 revenue?
-- ============================================================================
SELECT COUNT(*) AS sale_count,
       COALESCE(SUM(total), 0) AS sales_total
FROM public.sales
WHERE branch_id = 8;
-- If this is near zero while the GL shows 825,242 in revenue, the GL entries
-- did not originate from this branch's sales.
