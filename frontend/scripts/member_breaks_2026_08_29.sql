-- ============================================================================
-- ✅ APPLIED live 2026-08-30 (via Supabase MCP). Verified: member_breaks
-- exists with RLS enabled, 4 policies, is_lead_of_member() is SECURITY
-- DEFINER.
--
-- Exam breaks — welfare record.
-- Per the Aug 2026 redesign handoff, member surfaces / welfare record spec.
--
-- WHY: members go on planned breaks (board exams, school/college exams,
-- family reasons, etc.) and the org wants that visible to leads/directors
-- without it reading as "this person left" — a break is explicitly NOT a
-- deletion or deactivation of the member (is_active / status are untouched).
--
-- Two things ship together:
--   1. members.break_start / break_end / break_reason — a denormalized
--      "current/most recent break" for cheap display on a member's card
--      without a join.
--   2. member_breaks — the actual history. Every break a member has ever
--      logged, kept even after it ends, for a real record over time. The
--      app is expected to keep members.break_* in sync with the member's
--      most relevant member_breaks row (e.g. on insert/update of a break),
--      but that sync is app logic, not a DB trigger — no trigger is added
--      here so a future "the app forgot to update the summary columns" bug
--      stays a client bug, not a hidden DB side effect no one remembers.
--
-- RLS model: "own row" for writes, wider for reads.
--   - members.break_* — no new RLS needed. These are ordinary columns on the
--     member's own row, covered by the same existing own-row UPDATE policy
--     that already lets a member edit their bio/class_grade/etc., and by the
--     same "Anyone [authenticated] can view active members" SELECT policy
--     that already exposes school_id and (as of members_social_links_2026_08
--     _29.sql) instagram/linkedin to any signed-in member. members_guard_
--     privileged_cols does not touch break_start/break_end/break_reason, so
--     self-editing already works once the columns exist.
--   - member_breaks — a NEW table, RLS enabled from creation:
--       SELECT: the member's own rows, any director/super_admin, or any
--               ACTIVE LEAD of a team the target member is also an active
--               member of (so a lead can see a break on THEIR team, not
--               everyone's). That last check needs a member-to-member join
--               across team_members, which — per this repo's own postmortem
--               in CLAUDE.md ("Verify the live schema...") and the twice-
--               repeated raw-subquery-against-members bug — must not be a
--               raw EXISTS in the policy body if it were querying members.
--               It only touches team_members here (no PII columns, no
--               revoked grants), but for consistency with is_team_lead()
--               (security_and_correctness_fixes_2026_08_10.sql) it's still
--               wrapped in its own SECURITY DEFINER helper below rather than
--               inlined, so policy bodies stay declarative and the "is this
--               person allowed to see that person's stuff" logic lives in
--               one reusable place.
--       INSERT/UPDATE/DELETE: the member's own rows ONLY. Team leads and
--               directors can look but not touch — matches the spec exactly
--               ("team leads/directors can SELECT but not modify another
--               member's break").
-- ============================================================================

-- ── 1. members: current/most-recent break summary ──────────────────────────
alter table public.members
  add column if not exists break_start  date,
  add column if not exists break_end    date,
  add column if not exists break_reason text;

alter table public.members drop constraint if exists members_break_reason_check;
alter table public.members
  add constraint members_break_reason_check
  check (break_reason is null or break_reason in (
    'boards', 'school exams', 'college exams', 'family', 'other'
  ));

alter table public.members drop constraint if exists members_break_dates_check;
alter table public.members
  add constraint members_break_dates_check
  check (break_end is null or break_start is null or break_end >= break_start);

-- ── 2. member_breaks: full history ──────────────────────────────────────────
create table if not exists public.member_breaks (
  id         integer generated always as identity primary key,
  member_id  integer not null references public.members(member_id) on delete cascade,
  start      date not null,
  "end"      date not null,
  reason     text not null check (reason in (
               'boards', 'school exams', 'college exams', 'family', 'other'
             )),
  note       text,
  created_at timestamptz not null default now(),
  constraint member_breaks_dates_check check ("end" >= start)
);

create index if not exists idx_member_breaks_member_id on public.member_breaks(member_id);

alter table public.member_breaks enable row level security;

-- ── 3. helper: "am I an active lead of a team this member is also on?" ─────
-- SECURITY DEFINER, mirroring is_team_lead()'s reasoning: this only reads
-- team_members (no PII, no revoked grants), but it's a cross-member check,
-- so it gets its own named, reusable function rather than being inlined
-- into every policy that needs "can I see this OTHER member's stuff".
create or replace function public.is_lead_of_member(p_member_id integer)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.team_members tm_self
    join public.team_members tm_target
      on tm_target.team_id = tm_self.team_id
     and tm_target.member_id = p_member_id
     and tm_target.is_active = true
    where tm_self.member_id = public.get_current_member_id()
      and tm_self.role = 'lead'
      and tm_self.is_active = true
  );
$$;

comment on function public.is_lead_of_member(integer) is
  'True if the caller is an ACTIVE lead of at least one team that p_member_id is also an ACTIVE member of. Used to scope leader read-access on another member''s data (e.g. member_breaks) to just their own team, instead of every member org-wide.';

grant execute on function public.is_lead_of_member(integer) to authenticated;

-- ── 4. member_breaks policies ───────────────────────────────────────────────
drop policy if exists "member_breaks_select" on public.member_breaks;
create policy "member_breaks_select"
  on public.member_breaks for select
  using (
    member_id = public.get_current_member_id()
    or public.is_director()
    or public.is_super_admin()
    or public.is_lead_of_member(member_id)
  );

drop policy if exists "member_breaks_insert_own" on public.member_breaks;
create policy "member_breaks_insert_own"
  on public.member_breaks for insert
  with check (member_id = public.get_current_member_id());

drop policy if exists "member_breaks_update_own" on public.member_breaks;
create policy "member_breaks_update_own"
  on public.member_breaks for update
  using (member_id = public.get_current_member_id())
  with check (member_id = public.get_current_member_id());

drop policy if exists "member_breaks_delete_own" on public.member_breaks;
create policy "member_breaks_delete_own"
  on public.member_breaks for delete
  using (member_id = public.get_current_member_id());

-- ============================================================================
-- VERIFICATION — run after applying. Every line should report OK.
-- ============================================================================
-- Expect: 3 columns on members, all nullable
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'members'
--      and column_name in ('break_start', 'break_end', 'break_reason');
--
-- Expect: table exists with RLS enabled
--   select relrowsecurity from pg_class where relname = 'member_breaks';
--
-- Expect: exactly 4 policies, none referencing a raw `members.auth_uid`
-- subquery (would throw "permission denied for table members" in prod)
--   select policyname, cmd, qual, with_check from pg_policies
--    where tablename = 'member_breaks';
--
-- Expect: is_lead_of_member exists, SECURITY DEFINER
--   select prosecdef from pg_proc where proname = 'is_lead_of_member';
