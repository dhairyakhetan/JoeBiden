-- ============================================================================
-- ✅ APPLIED live 2026-08-30 (via Supabase MCP). related_drive_id/created_by
-- confirmed integer (matching welfare_projects.id/members.member_id) before
-- applying, per the pre-flight check below. FK to welfare_projects(id) and
-- the member_id index both confirmed present after applying.
--
-- Points ledger.
-- Per the Aug 2026 redesign handoff, member surfaces spec.
--
-- WHY: members earn/redeem points (opening balance on joining, points per
-- welfare drive, redemptions against something spendable). A member's BALANCE
-- is deliberately never stored as a counter column anywhere — it is always
-- DERIVED as `sum(points_ledger.points) where member_id = ...`. A stored
-- running-balance column is the classic way this kind of feature drifts out
-- of sync with its own history (a failed write, a manual DB fix, a retried
-- redemption); an append-only ledger with a derived sum can't drift, because
-- there is nothing else to be out of sync WITH. Recommended read pattern for
-- the app: `select coalesce(sum(points), 0) from points_ledger where
-- member_id = $1` (or a view, if/when this becomes a hot path — not added
-- here since no query pattern has been observed yet).
--
-- related_drive_id — TYPE DEVIATION FROM THE FEATURE SPEC, FLAGGED FOR REVIEW:
-- The spec for this migration describes `related_drive_id uuid null -- FK to
-- welfare_projects`. That does not match the live schema: welfare_projects
-- rows are identified by an integer `id` (see `WelfareProject.id: number` in
-- frontend/src/lib/supabase.ts — there is no uuid column on welfare_projects
-- at all, and the table isn't even in database.types.ts yet post-consolidation
-- to regenerate against). Every other cross-table FK in this schema that
-- points at an entity with an integer primary key uses that integer (see
-- approved_by/reviewed_by/assigned_by -> members.member_id, team_id ->
-- teams.team_id) — never a uuid alias. Per CLAUDE.md's own "verify the live
-- schema, not the .sql files" postmortem, this migration follows the
-- confirmed live shape (integer) rather than the spec's literal wording.
-- created_by has the same deviation for the same reason (members.member_id is
-- integer, not uuid) and is documented once here rather than twice.
--
-- ⚠ BEFORE APPLYING: confirm welfare_projects.id's actual Postgres type with
--   select data_type from information_schema.columns
--    where table_name = 'welfare_projects' and column_name = 'id';
-- If it comes back bigint rather than integer, change the FK column below to
-- bigint before running this file — a mismatched FK type will fail to create.
--
-- RLS: append-only audit trail. SELECT is member-own-rows-or-leadership;
-- INSERT is director/super_admin only (covers both "opening balance on
-- join" and "redemption" — a system/trigger-driven award for drive
-- completion, if/when that's built, would run as a SECURITY DEFINER
-- function and bypass RLS entirely, the same way mirror_welfare_project_
-- to_post() does, so it doesn't need its own INSERT policy here). There is
-- NO update or delete policy at all, on purpose — with RLS enabled and no
-- USING clause for a command, that command is simply refused for every role
-- except the table owner/service role. That is the enforcement mechanism for
-- "immutable ledger, no policy grants UPDATE/DELETE" — a wrong entry gets
-- corrected with a new, opposite-signed row, never an edit.
-- ============================================================================

create table if not exists public.points_ledger (
  id               integer generated always as identity primary key,
  member_id        integer not null references public.members(member_id) on delete cascade,
  points           numeric not null check (points <> 0),
  reason           text not null,
  related_drive_id integer null references public.welfare_projects(id) on delete set null,
  created_at       timestamptz not null default now(),
  created_by       integer null references public.members(member_id)
);

comment on table public.points_ledger is
  'Append-only. Balance = sum(points) per member_id, never a stored counter. No UPDATE/DELETE policy exists on this table by design — see migration header.';

comment on column public.points_ledger.points is
  'Positive = earned, negative = spent/redeemed. Zero is disallowed (a check constraint) since a zero-point row records nothing.';

comment on column public.points_ledger.reason is
  'Free text, e.g. ''joined'' (opening balance), ''drive:<uuid or slug>'', ''redemption:<what>''. Not an enum — matches how job_openings.category and similar free-text classification columns work elsewhere in this schema.';

create index if not exists idx_points_ledger_member_id on public.points_ledger(member_id);

alter table public.points_ledger enable row level security;

drop policy if exists "points_ledger_select" on public.points_ledger;
create policy "points_ledger_select"
  on public.points_ledger for select
  using (
    member_id = public.get_current_member_id()
    or public.is_director()
    or public.is_super_admin()
  );

drop policy if exists "points_ledger_insert_leaders" on public.points_ledger;
create policy "points_ledger_insert_leaders"
  on public.points_ledger for insert
  with check (
    public.is_director()
    or public.is_super_admin()
  );

-- No UPDATE policy. No DELETE policy. Intentional — see header.

-- ============================================================================
-- VERIFICATION — run after applying. Every line should report OK.
-- ============================================================================
-- Expect: table exists, RLS enabled
--   select relrowsecurity from pg_class where relname = 'points_ledger';
--
-- Expect: exactly 2 policies (select, insert) — zero for update/delete
--   select policyname, cmd from pg_policies where tablename = 'points_ledger';
--
-- Expect: FK to welfare_projects(id) actually created (would error at apply
-- time if the type guess above was wrong, so reaching this query means it
-- matched)
--   select confrelid::regclass from pg_constraint
--    where conname = 'points_ledger_related_drive_id_fkey';
--
-- Expect: index present
--   select indexname from pg_indexes
--    where tablename = 'points_ledger' and indexname = 'idx_points_ledger_member_id';
