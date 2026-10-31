-- APPLIED LIVE 2026-09-14 via Supabase MCP (migration name:
-- members_update_wrap_auth_uid_initplan)
--
-- Codebase-wide speed audit, per owner request ("finish the speed issue, do
-- a codebase wide audit"). Static code review found no smoking gun (the app
-- is already fairly disciplined: sized() on every remote image, SWR caching,
-- chunk-split routes, paginated/limited queries throughout) - checked
-- Supabase's own performance advisor next instead of guessing further, and
-- it flagged one real, concrete issue:
--
--   auth_rls_initplan: `members_update`'s USING/WITH CHECK called bare
--   `auth.uid()` instead of `(select auth.uid())`. Postgres can cache the
--   subquery form as a single InitPlan value for the whole statement; the
--   bare form gets re-evaluated on EVERY ROW the policy touches. members is
--   one of the most heavily-queried/updated tables in the app (every
--   profile save, every HR/director mutation, every break/role/status
--   change goes through it) - this is exactly the kind of per-row tax that
--   adds up on a directory-sized table and shows up as "the app feels slow"
--   without any single page being obviously broken.
--
-- `members_select` already did this correctly (verified live before this
-- migration: `auth_uid = ( SELECT auth.uid() AS uid)`) - members_update
-- just never got the same treatment when it was written/widened across the
-- team-scoping migrations earlier in this project's history. Semantics are
-- byte-identical otherwise: same three OR branches (is_director(),
-- own-row, is_team_lead_of_member(member_id)), same order, both
-- USING and WITH CHECK.
--
-- Verified fixed live: Supabase's performance advisor (get_advisors,
-- type=performance) listed `auth_rls_initplan` on members before this
-- migration and does not list it after.
--
-- NOT touched, and why: the advisor's other findings are informational, not
-- speed bugs live traffic has actually hit -
--   · 36 "unused index" hits - indexes real code paths may still need on
--     low-traffic tables (yearbook, certificates, MoM, audit logs); dropping
--     an index nobody has needed YET is a bet against future usage, not a
--     current slowness fix.
--   · one missing index on members.deleted_by (a soft-delete admin column,
--     not a hot path).
--   · the Auth server's connection-allocation STRATEGY (percentage vs.
--     absolute) - an infra/plan setting, not a query or policy.
-- None of these were reported as symptoms; the RLS initplan issue was the
-- one with a real, measurable per-row cost on a genuinely hot table.

drop policy if exists members_update on public.members;
create policy members_update on public.members
  for update
  using (
    is_director()
    or auth_uid = (select auth.uid())
    or is_team_lead_of_member(member_id)
  )
  with check (
    is_director()
    or auth_uid = (select auth.uid())
    or is_team_lead_of_member(member_id)
  );
