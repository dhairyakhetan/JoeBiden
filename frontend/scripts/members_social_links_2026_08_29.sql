-- ============================================================================
-- ✅ APPLIED live 2026-08-30 (via Supabase MCP). Verified: both columns
-- present and nullable, no column-level SELECT restriction.
--
-- Member profile — Instagram / LinkedIn links
-- Per the Aug 2026 redesign handoff, member surfaces spec.
--
-- WHY: profile pages currently have no place for a member's Instagram/LinkedIn
-- handle. Two new nullable text columns on members, no format validation at
-- the DB level (same trust model as every other free-text profile field in
-- this app — the client is responsible for basic shape-checking, the DB just
-- stores what it's given).
--
-- RLS: none needed. These are ordinary profile fields, not PII in the sense
-- the 2026-07/08 lockdown cares about (email/phone are singled out precisely
-- because they're contact info someone didn't choose to publish). Checked
-- against `members.school_id`, which is exposed the same way: no column-level
-- REVOKE, no dedicated policy — it rides the table's existing SELECT policy
-- ("Anyone [authenticated] can view active members", USING status='active')
-- and the existing own-row UPDATE policy. instagram/linkedin follow the exact
-- same path. The members_guard_privileged_cols BEFORE UPDATE trigger (see
-- community_security_hardening_2026_06.sql) only resets role/status/is_active/
-- approved_by/approved_at on a self-update — it does not touch these columns,
-- so a member can already set their own instagram/linkedin the moment the
-- columns exist, with no policy change required.
-- ============================================================================

alter table public.members
  add column if not exists instagram text,
  add column if not exists linkedin text;

-- ============================================================================
-- VERIFICATION — run after applying. Every line should report OK.
-- ============================================================================
-- Expect: both columns present, nullable, type text
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'members'
--      and column_name in ('instagram', 'linkedin');
--
-- Expect: no column-level SELECT restriction added for these two (unlike
-- email/phone, which show 0 rows against 'authenticated' after the PII
-- lockdown — instagram/linkedin should NOT appear here at all, meaning no
-- narrower-than-table grant exists):
--   select grantee, column_name, privilege_type
--     from information_schema.column_privileges
--    where table_name = 'members'
--      and column_name in ('instagram', 'linkedin');
