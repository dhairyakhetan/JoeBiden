-- ──────────────────────────────────────────────────────────────────────────
-- One-off data correction — ROOTS stall posts and fundraiser/fete posts are
-- currently mistagged (ROOTS stalls landed in 'labs'; fundraisers/fetes
-- didn't land in 'events'). This is a data-quality fix, not a schema change
-- — there is no auto-classification code anywhere in the frontend (checked;
-- category is always a manual dropdown on post creation), so these are
-- individually mistagged rows, not a systemic bug to fix in code.
--
-- Run the two SELECTs FIRST and eyeball the results before running either
-- UPDATE — keyword matching on free text is inherently approximate, and a
-- human should confirm the matched set is actually right before writing.
-- Both UPDATEs are scoped to `deleted_at IS NULL` and only touch rows
-- currently NOT already in the target category, so re-running is safe.
-- ──────────────────────────────────────────────────────────────────────────

-- ── Preview: ROOTS stall posts miscategorized as 'labs' ──
SELECT post_id, uuid, category, left(body, 140) AS preview, created_at
FROM public.posts
WHERE deleted_at IS NULL
  AND category = 'labs'
  AND body ILIKE '%roots%'
  AND body ILIKE '%stall%'
ORDER BY created_at DESC;

-- ── Preview: fundraiser / fete posts not currently in 'events' ──
SELECT post_id, uuid, category, left(body, 140) AS preview, created_at
FROM public.posts
WHERE deleted_at IS NULL
  AND category <> 'events'
  AND (body ILIKE '%fundraiser%' OR body ILIKE '%fete%' OR body ILIKE '%fête%')
ORDER BY created_at DESC;

-- ── Apply — only after reviewing both previews above ──
-- UPDATE public.posts
-- SET category = 'events'
-- WHERE deleted_at IS NULL
--   AND category = 'labs'
--   AND body ILIKE '%roots%'
--   AND body ILIKE '%stall%';

-- UPDATE public.posts
-- SET category = 'events'
-- WHERE deleted_at IS NULL
--   AND category <> 'events'
--   AND (body ILIKE '%fundraiser%' OR body ILIKE '%fete%' OR body ILIKE '%fête%');
