-- ============================================================================
-- STATUS: APPLIED 2026-07-24 via Supabase MCP (project hzowuwffjqtgszecngpe).
-- Migration name: drop_redundant_indexes_2026_07
--
-- WHY (from the audit's database-optimizer lens, verified live via pg_indexes):
--  * posts carried BOTH idx_posts_uuid (btree uuid) AND posts_uuid_key
--    (UNIQUE btree uuid) — the plain index is an exact duplicate of the unique
--    one and is never preferred over it, so it is pure insert/update overhead.
--  * notifications carried idx_notifications_member (btree member_id) alongside
--    notifications_member_created_idx (member_id, created_at DESC) — any lookup
--    by member_id alone is already served by the composite's leading column, so
--    the single-column index is prefix-redundant (and advisor-flagged unused).
--
-- Both drops remove write/maintenance overhead on two of the busiest tables
-- with zero read impact. Kept: posts_uuid_key, notifications_member_created_idx,
-- and the partial idx_notifications_unread.
--
-- NOTE: the 23 broader "unused index" advisor hits were deliberately NOT bulk-
-- dropped — several are FK-covering (protect ON DELETE cascade latency) or only
-- used on rarely-hit admin screens; re-check get_advisors after real traffic.
-- ============================================================================

drop index if exists public.idx_posts_uuid;
drop index if exists public.idx_notifications_member;