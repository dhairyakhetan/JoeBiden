-- members_team_nudge_seen_2026_09_07.sql
--
-- STATUS: **APPLIED 2026-09-07** to project hzowuwffjqtgszecngpe, via the
-- Supabase MCP connector, and VERIFIED live afterwards:
--   information_schema.columns -> team_nudge_seen_at | timestamp without time
--   zone | is_nullable YES
-- Status updated in the same action that ran it. This repo has a documented
-- recurring failure where APPLIED/NOT-APPLIED comments drift from database
-- truth (see CLAUDE.md, "Verify the live schema, not the .sql files") — a
-- checked-in .sql file is not evidence the migration ran, and this header is
-- not either. Re-check live before trusting it.
--
-- WHAT / WHY
-- ----------
-- The post-approval "choose your team" nudge (frontend/src/onboarding/
-- ChooseTeamPage.tsx) fires on a member's FIRST authenticated visit after a
-- director flips members.status pending_approval -> active. "First visit"
-- needs a durable marker, and there was no column on `members` that meant
-- this — checked live 2026-09-07 against information_schema.columns: the row
-- carries approved_at / last_login / join_reason / is_active and nothing about
-- onboarding nudges. localStorage alone loses the flag on a device change, so
-- a member who skipped on their phone would be nudged again on a laptop.
--
-- This adds ONE nullable timestamp. NULL = never seen. It is written by the
-- member themselves (skip, ask-to-join, or opening a role's brief) under the
-- existing "Users can update own member row" RLS policy
-- (auth_uid = auth.uid(), both USING and WITH CHECK) — no new policy, no
-- policy change, no grant change. The table-level UPDATE grant for
-- `authenticated` already covers a new column; the 2026-07-29 PII lockdown
-- revoked column privileges only on email/phone/auth_uid/google_id.
--
-- get_own_member() is `RETURNS SETOF members` (verified live), so the new
-- column reaches AuthContext's `member` object with no function change.
--
-- The frontend FEATURE-DETECTS this column: markTeamChoiceSeen() ignores
-- Postgres error 42703 (undefined_column) and degrades to a localStorage-only
-- flag, so shipping the UI before this migration runs is safe — it just isn't
-- durable across devices until it does.

alter table public.members
  add column if not exists team_nudge_seen_at timestamp without time zone;

comment on column public.members.team_nudge_seen_at is
  'When this member dismissed or acted on the post-approval "choose your team" nudge. NULL = not yet seen. Self-written by the member under the existing own-row UPDATE policy.';

-- VERIFY (run after applying):
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_name = 'members' and column_name = 'team_nudge_seen_at';
--
--   select grantee, privilege_type
--     from information_schema.column_privileges
--    where table_name = 'members' and column_name = 'team_nudge_seen_at'
--      and grantee = 'authenticated';
