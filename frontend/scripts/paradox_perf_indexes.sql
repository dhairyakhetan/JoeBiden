-- ──────────────────────────────────────────────────────────────────────────
-- Paradox 2026 — forward-looking performance indexes
--
-- Run in the PARADOX Supabase project SQL editor (drvucogrjphctwfealxd),
-- NOT the community project. Defensive only: at current volume the tables
-- are tiny, but during a live event registrations can spike into the
-- thousands and these back the hot lookups:
--   • Ticket page  → paradox_registrations by `token`
--   • Admin lists  → ordered by `created_at`, grouped/filtered by `event_id`
--   • After-party  → paradox_afterparty_registrations by `ap_id`, by date
--
-- All idempotent (CREATE INDEX IF NOT EXISTS) → safe to re-run. Pure
-- read-path optimization; no schema/behavior change. CONCURRENTLY avoids
-- locking the table during creation (run each statement on its own; some
-- SQL editors require not wrapping these in a txn — if it errors, drop the
-- CONCURRENTLY keyword).
-- ──────────────────────────────────────────────────────────────────────────

-- Per-ticket lookup (Ticket.tsx loads a registration by its share token).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_paradox_registrations_token
  ON public.paradox_registrations (token);

-- Admin event-wise counts + filters group on event_id.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_paradox_registrations_event
  ON public.paradox_registrations (event_id);

-- Admin registrations list orders newest-first.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_paradox_registrations_created
  ON public.paradox_registrations (created_at DESC);

-- After-party check-in / search by the short AP-ID.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_paradox_afterparty_ap_id
  ON public.paradox_afterparty_registrations (ap_id);

-- After-party admin list orders newest-first.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_paradox_afterparty_created
  ON public.paradox_afterparty_registrations (created_at DESC);

-- Verify — list the indexes afterwards
SELECT tablename, indexname
  FROM pg_indexes
 WHERE schemaname = 'public'
   AND tablename IN ('paradox_registrations', 'paradox_afterparty_registrations')
 ORDER BY tablename, indexname;
