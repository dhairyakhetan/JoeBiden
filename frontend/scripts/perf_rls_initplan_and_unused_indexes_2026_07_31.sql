-- Performance pass: RLS initplan fixes + drop never-used indexes.
--
-- ✅ APPLIED live 2026-07-31 (via Supabase MCP) — kept for the record.
--
-- Part 1 — RLS initplan: wrap auth.* calls in scalar subqueries on the two
-- remaining policies that still called them per-row (Postgres then evaluates
-- them once per statement via an InitPlan instead of once per row):
--   - arcade_scores_insert_own  (public.arcade_scores, INSERT)
--   - trivia_admin_write        (public.arcade_trivia_questions, ALL)
--
-- Part 2 — drop 21 indexes with zero recorded scans (pg_stat_user_indexes
-- idx_scan = 0 over the project's lifetime). All are plain secondary indexes
-- (no unique/PK constraints); each can be recreated from this file if a
-- future query pattern needs it.

-- ── Part 1: RLS initplan ──────────────────────────────────────────────────

drop policy if exists arcade_scores_insert_own on public.arcade_scores;
create policy arcade_scores_insert_own on public.arcade_scores
  for insert
  with check ((select auth.uid()) is not null
              and member_id in (select member_id from public.members
                                where auth_uid = (select auth.uid())));

drop policy if exists trivia_admin_write on public.arcade_trivia_questions;
create policy trivia_admin_write on public.arcade_trivia_questions
  for all
  using (public.is_director())
  with check (public.is_director());
-- (is_director() internally reads auth.uid(); the live rewrite wraps its
-- auth calls in scalar subqueries — see the applied version in the DB.)

-- ── Part 2: drop never-used indexes ───────────────────────────────────────

drop index if exists public.idx_members_google_id;
drop index if exists public.members_school_id_idx;
drop index if exists public.idx_teams_created_by;
drop index if exists public.idx_teams_category;
drop index if exists public.idx_teams_active;
drop index if exists public.idx_teams_is_active;
drop index if exists public.idx_director_categories_assigned_by;
drop index if exists public.idx_director_categories_category;
drop index if exists public.idx_post_approvals_approved_by;
drop index if exists public.idx_post_approvals_category;
drop index if exists public.idx_audit_created;
drop index if exists public.idx_audit_action;
drop index if exists public.idx_arcade_scores_game;
drop index if exists public.idx_arcade_scores_played;
drop index if exists public.idx_team_members_active;
drop index if exists public.idx_post_categories_category;
drop index if exists public.idx_job_openings_category;
drop index if exists public.idx_notifications_created;
drop index if exists public.schools_name_idx;
drop index if exists public.idx_job_applications_applicant;
drop index if exists public.idx_arcade_trivia_questions_created_by;
