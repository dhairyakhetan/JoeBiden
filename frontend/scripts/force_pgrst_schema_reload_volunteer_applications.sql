-- ──────────────────────────────────────────────────────────────────────────
-- AquaTerra community: force PostgREST schema-cache reload for
-- volunteer_applications
-- ──────────────────────────────────────────────────────────────────────────
-- Applied to the main AquaTerra Supabase project (hzowuwffjqtgszecngpe)
-- on 2026-05-18 via the supabase MCP. This file is the source-of-truth
-- copy committed to git.
--
-- Symptom this fixes:
--   The director-side Volunteer Applications page kept getting
--   "column volunteer_applications.<X> does not exist" errors against
--   columns that DO exist in the live catalog. First it was
--   `review_note`, then after switching to `reviewed` it was `reviewed`.
--   PostgREST's column-list cache was lagging behind the table's actual
--   schema, and plain `NOTIFY pgrst, 'reload schema'` didn't reliably
--   force it to refresh.
--
-- Why this works:
--   PostgREST detects DDL events on tracked tables and refreshes its
--   cache when one happens. A `NOTIFY` alone doesn't always trip the
--   detection. A real catalog write — even a no-op SET DEFAULT / DROP
--   DEFAULT pair — guarantees the cache invalidation path runs. We
--   also re-apply column COMMENTs so the metadata round-trip is
--   unambiguous.
--
-- Belt-and-suspenders: the client-side fetch (`VolunteerApplications.tsx`)
-- was also refactored to fetch all rows with `select('*')` and filter
-- in React, removing every column-name-aware filter call. That makes
-- the page immune to future cache lag even if this migration drifts.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.volunteer_applications
  ALTER COLUMN reviewed SET DEFAULT false;

ALTER TABLE public.volunteer_applications
  ALTER COLUMN reviewed DROP DEFAULT;

COMMENT ON COLUMN public.volunteer_applications.reviewed IS
  'Director-side review status. NULL/false = pending; true = reviewed.';

COMMENT ON COLUMN public.volunteer_applications.review_note IS
  'Optional free-text reviewer note. Independent of the `reviewed` flag.';

NOTIFY pgrst, 'reload schema';

-- Verify
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'volunteer_applications'
  AND column_name IN ('reviewed', 'review_note')
ORDER BY column_name;
