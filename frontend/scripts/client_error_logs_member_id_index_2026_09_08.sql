-- ─────────────────────────────────────────────────────────────────────────
-- client_error_logs.member_id index (2026-09-08)
-- ─────────────────────────────────────────────────────────────────────────
-- Supabase's performance advisor flagged this FK as unindexed right after
-- client_error_logs_2026_09_08.sql created the table. Closing it out before
-- Supabase MCP access is revoked for this session.
-- ─────────────────────────────────────────────────────────────────────────

create index if not exists client_error_logs_member_id_idx on public.client_error_logs (member_id);
