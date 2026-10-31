-- ────────────────────────────────────────────────────────────────────────────
-- Performance: drop redundant duplicate indexes + add missing FK covering indexes
-- ────────────────────────────────────────────────────────────────────────────
-- Sourced from Supabase's performance advisor (database linter). All changes are
-- behavior-preserving and safe:
--   * Each dropped index is an EXACT duplicate of another index that remains, so
--     query plans are unaffected — this only removes redundant write/maintenance
--     overhead and disk usage.
--   * Each created index covers a foreign key that had no covering index, which
--     speeds up joins and ON DELETE SET NULL cascades against the referenced
--     posts/members rows.
--
-- STATUS: APPLIED to the live project (community-platform-aq / hzowuwffjqtgszecngpe)
-- via the Supabase MCP on 2026-07-17. Checked in for the record per the repo's
-- manual-migration convention.

-- ── Duplicate indexes: keep one of each identical pair, drop the redundant one ──
DROP INDEX IF EXISTS public.notifications_member_unread_idx;   -- dup of idx_notifications_unread
DROP INDEX IF EXISTS public.idx_team_join_req_member;          -- dup of idx_join_requests_member
DROP INDEX IF EXISTS public.idx_team_join_req_team;            -- dup of idx_join_requests_team

-- ── Covering indexes for previously-unindexed foreign keys ──
CREATE INDEX IF NOT EXISTS idx_blogs_linked_post_id
  ON public.blogs (linked_post_id);
CREATE INDEX IF NOT EXISTS idx_welfare_projects_linked_post_id
  ON public.welfare_projects (linked_post_id);
CREATE INDEX IF NOT EXISTS idx_arcade_trivia_questions_created_by
  ON public.arcade_trivia_questions (created_by);
