-- ──────────────────────────────────────────────────────────────────────────
-- Paradox: add `limited_spots` boolean to paradox_events
-- ──────────────────────────────────────────────────────────────────────────
-- Run this once against the Paradox Supabase project
-- (drvucogrjphctwfealxd) via the SQL editor.
--
-- Why this column:
-- The participant-facing UI used to show "{X} left" using
-- `paradox_events.max_participants` minus the current registration count.
-- That leaked the cap and stoked unhealthy urgency, so we hide every
-- numeric count site-wide. Admins still get a way to mark an event as
-- "filling up" via this independent boolean — when true, event cards
-- render a stylised "limited spots available" badge with NO number.
--
-- Independence from max_participants:
-- - `max_participants` continues to enforce the actual cap (registration
--   blocked once hit).
-- - `limited_spots` is the urgency cue admins toggle when they want.
-- - The two are decoupled so admins can promote an event without
--   committing to a numeric cap, and vice versa.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.paradox_events
  ADD COLUMN IF NOT EXISTS limited_spots BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.paradox_events.limited_spots IS
  'When true, the event card / detail page shows a non-numeric "limited spots available" badge. Independent of max_participants.';

-- Verify
SELECT id, name, slug, max_participants, limited_spots
  FROM public.paradox_events
  ORDER BY sort_order NULLS LAST, name
  LIMIT 5;
