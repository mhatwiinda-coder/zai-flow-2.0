-- ============================================================================
-- 10 sale_items rows have branch_id IS NULL, but sales has ZERO orphans.
-- ============================================================================
-- That combination means: every one of these 10 items belongs to a sale that
-- DOES have a valid branch_id - it just wasn't copied onto the line item row
-- when it was inserted. Different bug from create_sale; smaller blast radius.
--
-- Any report reading sale_items.branch_id directly (rather than joining back
-- to sales.branch_id) will silently miss these 10 rows.
-- ============================================================================


-- ============================================================================
-- STEP 1: IDENTIFY - which sales do these items actually belong to?
-- ============================================================================
SELECT si.id AS sale_item_id, si.sale_id, s.branch_id AS parent_sale_branch_id,
       s.created_at, si.product_id, si.quantity, si.price
FROM public.sale_items si
JOIN public.sales s ON s.id = si.sale_id
WHERE si.branch_id IS NULL
ORDER BY s.created_at;
-- Confirms every orphaned item's parent sale has a real branch_id.


-- ============================================================================
-- STEP 2: BACKFILL - copy branch_id down from the parent sale
-- ============================================================================
UPDATE public.sale_items si
SET branch_id = s.branch_id
FROM public.sales s
WHERE si.sale_id = s.id
  AND si.branch_id IS NULL
  AND s.branch_id IS NOT NULL;


-- ============================================================================
-- STEP 3: VERIFY
-- ============================================================================
SELECT COUNT(*) AS remaining_orphaned_sale_items
FROM public.sale_items WHERE branch_id IS NULL;
-- Should now be 0.
