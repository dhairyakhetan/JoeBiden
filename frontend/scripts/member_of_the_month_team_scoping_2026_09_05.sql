-- ────────────────────────────────────────────────────────────────────────────
-- FR11-b · Member of the month — per-team picks, an open/close workflow, and
-- the winner's own photo-upload step.
--
-- STATUS: APPLIED to project hzowuwffjqtgszecngpe on 2026-09-05 via the
--         Supabase MCP connector (migration name
--         `member_of_the_month_team_scoping_2026_09_05`), PLUS a required
--         follow-up (`member_of_the_month_revoke_anon_execute_2026_09_05`,
--         also applied same day — see WHY A FOLLOW-UP WAS NEEDED below).
--         Verified live afterwards with a direct
--         information_schema/pg_policies/pg_proc requery — see
--         VERIFIED-LIVE RESULT at the bottom of this file.
--
-- WHY A FOLLOW-UP WAS NEEDED
-- `get_advisors(type: security)`, run immediately after the first apply,
-- flagged all four new functions as anon-executable via PostgREST
-- (anon_security_definer_function_executable). This migration's own
-- `revoke all on function ... from public` did NOT prevent that: Supabase's
-- project-level default privileges grant EXECUTE on every newly created
-- public-schema function directly to the anon/authenticated/service_role
-- ROLES at creation time — a role-specific grant that revoking from the
-- PUBLIC pseudo-role does not touch. A second migration explicitly ran
-- `revoke execute on function ... from anon` for all four; re-verified via
-- information_schema.routine_privileges that anon is gone and only
-- authenticated/postgres/service_role remain. Real-world exposure was low
-- either way (every function here reads auth.uid(), which is null for anon,
-- so each one degrades to "false"/"not authenticated" rather than leaking
-- anything) — but it contradicted this file's own stated intent ("grant
-- execute only to authenticated"), so it is fixed rather than left as a
-- known-harmless discrepancy between what this file says and what is live.
--
-- WHAT CHANGED FROM member_of_the_month_2026_09_05.sql
-- That migration shipped ONE global pick per calendar month, settable by any
-- leader (is_director()), with no team scoping, no notification-triggered
-- photo step, and nowhere public-facing it was actually wired up yet. This
-- migration rebuilds it into the real flow: one pick PER TEAM per month, a
-- HOD/director restricted to their own team, an explicit "is this month open
-- for picking" gate HR/super_admin controls, and a self-service photo upload
-- the winner performs themselves (via a SECURITY DEFINER RPC, not a raw
-- UPDATE grant — see WHY A RPC, NOT RLS below).
--
-- LIVE-VERIFIED BEFORE WRITING THIS (2026-09-05, project hzowuwffjqtgszecngpe)
--   · public.member_of_the_month had ZERO rows. No pre-existing picks to
--     migrate or preserve under the new per-team shape — this is why team_id
--     below is NOT NULL from the start instead of a nullable backfill column:
--     there was nothing to backfill, and the new mental model ("one pick per
--     TEAM") doesn't have a coherent no-team case to keep open for.
--   · Exactly one live member holds role='hod' (member_id 1134, Pratyaksh
--     Singhania) and zero hold role='director'. That one hod IS on a team
--     (an active team_members row for team_id 8 / Welfare Team) but with
--     team_role = 'member', not 'lead'. No hod/director is a team_members
--     'lead' of anything live today.
--   · director_categories (the OTHER existing team-scoping pattern in this
--     codebase, used for post moderation via is_assigned_to_category()) does
--     NOT map cleanly to a single team: category 'operations' alone covers 3
--     different teams (Collabs Team, AQ.Ventures, Human Resources) and
--     'content' covers 2 (Social Media, Crftd). Scoping a HOD's pick by their
--     director_categories assignment would let them pick across several
--     unrelated teams' rosters at once — not "their own team" — so this
--     migration does not use that pattern for the write gate below.
--
-- TEAM-SCOPING DECISION (flagged assumption — genuinely ambiguous today)
-- "Their own team" is defined as: any team the HOD/director holds an ACTIVE
-- team_members row for, regardless of that row's own role ('member' or
-- 'lead'). Requiring team_members.role = 'lead' specifically was considered
-- and rejected — it would leave the one real live HOD unable to pick for ANY
-- team at all (he is a plain 'member' of Welfare Team, not its 'lead'), which
-- would make the rebuilt feature unusable for the one person it exists for
-- today. team_members.role ('lead' vs 'member') governs TEAM-ROSTER admin
-- powers (is_team_lead(), used by teams/team_members RLS already) and is a
-- separate, orthogonal concept from members.role ('hod'/'director') used
-- here — a plain team lead with members.role='member' gets NO member-of-the-
-- month power under this migration; only members.role IN ('hod','director')
-- does, scoped to whichever team(s) team_members says they belong to.
-- A HOD/director who belongs to zero teams can pick for none — only
-- super_admin/hr can act for them in that case. A HOD/director on multiple
-- teams may pick for each of them. Revisit this if AquaTerra ever adds a real
-- "this HOD owns this team" column; team_members membership is a reasonable
-- stand-in, not a perfect model of the org chart.
--
-- WHAT THIS ADDS
--  1. member_of_the_month.team_id — NOT NULL, references teams(team_id). The
--     UNIQUE(period) constraint becomes UNIQUE(period, team_id): one pick per
--     TEAM per month instead of one pick, period.
--  2. member_of_the_month.photo_url / photo_uploaded_at — the winner's own
--     upload, set ONLY via the submit_mom_photo() RPC below.
--  3. member_of_the_month_periods — one row per calendar month, is_open bool.
--     HR/super_admin flips it; a HOD/director's insert/update is rejected by
--     RLS while their month is closed. Simple by design — this is an internal
--     desk workflow, not a public feature.
--  4. Three SECURITY DEFINER helper functions (can_pick_mom_for_team,
--     mom_target_on_team, mom_period_is_open) so the RLS predicates below
--     stay readable, mirroring is_director()/is_assigned_to_category()'s own
--     shape and SET search_path discipline.
--  5. submit_mom_photo(p_pick_id, p_photo_url) RPC.
--
-- WHY A RPC, NOT RLS, FOR THE PHOTO UPLOAD
-- The winner is very often a plain member, who otherwise has NO write grant
-- on this table at all (writes are leaders-only). Declarative RLS has no
-- clean way to say "the row's own subject may update these two columns and
-- no others" — a WITH CHECK clause sees only the proposed new row, not a
-- column-by-column diff against the old one. Every other narrow
-- member-initiated mutation in this schema that isn't "any column, if you're
-- the owner" already solves this the same way (complete_drive_attendance,
-- update_drive_post_stats, create_notification) — a SECURITY DEFINER function
-- that does the one specific update and nothing else. This follows that
-- precedent instead of inventing a new one.
--
-- SELECT POLICIES ARE UNCHANGED, DELIBERATELY
-- mom_select_current / mom_select_leaders (from the original migration) are
-- left exactly as they were — not filtered by team. Any signed-in member
-- reads any pick whose month has started, now across every team, which is
-- exactly what the home rail needs ("one per team, all shown"). Any leader
-- additionally sees every queued future pick across every team, not just
-- their own team — a HOD can see (but not touch) what other teams have
-- queued. Team scoping is enforced on WRITE only, to keep this simple per the
-- brief, rather than adding row-level read filtering nobody asked for.
-- ────────────────────────────────────────────────────────────────────────────

-- ── 1. member_of_the_month_periods — the "is this month open" state ────────
create table if not exists public.member_of_the_month_periods (
  period      date primary key,
  is_open     boolean not null default false,
  opened_at   timestamptz,
  opened_by   integer references public.members(member_id) on delete set null,
  closed_at   timestamptz,
  closed_by   integer references public.members(member_id) on delete set null,

  constraint mom_periods_period_is_first_of_month
    check (period = date_trunc('month', period)::date)
);

alter table public.member_of_the_month_periods enable row level security;

revoke all on public.member_of_the_month_periods from anon, public;
grant select, insert, update on public.member_of_the_month_periods to authenticated;
-- Same Supabase-default over-grant cleanup the original migration called out:
-- take back TRUNCATE/TRIGGER/REFERENCES (RLS doesn't gate any of them) and
-- there is no DELETE workflow (closing a period is `is_open = false`, not
-- removing history), so that never gets granted either.
revoke truncate, delete, trigger, references on public.member_of_the_month_periods from authenticated;

drop policy if exists mom_periods_select_leaders on public.member_of_the_month_periods;
drop policy if exists mom_periods_insert_admins on public.member_of_the_month_periods;
drop policy if exists mom_periods_update_admins on public.member_of_the_month_periods;

-- Any leader can READ period state — a HOD needs to know "is this month open"
-- before they try to pick.
create policy mom_periods_select_leaders on public.member_of_the_month_periods
  for select to authenticated
  using (public.is_director());

-- Only super_admin/hr can open or close a month — NOT is_director(), since a
-- HOD opening their own picking window would defeat the point of the gate.
create policy mom_periods_insert_admins on public.member_of_the_month_periods
  for insert to authenticated
  with check (public.is_super_admin());

create policy mom_periods_update_admins on public.member_of_the_month_periods
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ── 2. member_of_the_month: team_id + photo columns ─────────────────────────
alter table public.member_of_the_month
  add column if not exists team_id integer references public.teams(team_id) on delete cascade,
  add column if not exists photo_url text,
  add column if not exists photo_uploaded_at timestamptz;

-- Table was verified EMPTY immediately before this migration (see header) —
-- safe to lock NOT NULL in the same migration, no backfill step needed and no
-- data at risk.
alter table public.member_of_the_month
  alter column team_id set not null;

alter table public.member_of_the_month
  drop constraint if exists member_of_the_month_period_key;

alter table public.member_of_the_month
  add constraint member_of_the_month_period_team_key unique (period, team_id);

create index if not exists member_of_the_month_team_id_idx
  on public.member_of_the_month (team_id);

-- ── 3. Helper functions ──────────────────────────────────────────────────────

-- True when the CURRENT caller may write a member_of_the_month row for
-- p_team_id: super_admin/hr always can (mirrors the table's existing
-- is_super_admin() carve-out, "Super_admin/hr can still pick for any team");
-- a hod/director can ONLY when they hold an active team_members row for that
-- exact team_id (see the team-scoping decision in the header comment).
create or replace function public.can_pick_mom_for_team(p_team_id integer)
returns boolean
language sql
stable security definer
set search_path = public, pg_temp
as $$
  select
    public.is_super_admin()
    or exists (
      select 1
      from public.team_members tm
      join public.members m on m.member_id = tm.member_id
      where tm.team_id = p_team_id
        and tm.is_active = true
        and m.auth_uid = auth.uid()
        and m.role in ('director', 'hod')
        and m.status = 'active'
    );
$$;

revoke all on function public.can_pick_mom_for_team(integer) from public;
grant execute on function public.can_pick_mom_for_team(integer) to authenticated;
-- Belt-and-braces: `revoke ... from public` does not touch Supabase's
-- project-level default grant straight to the `anon` role — see WHY A
-- FOLLOW-UP WAS NEEDED at the top of this file. Folded in here so re-running
-- this file end to end on a fresh project reaches the correct state in one
-- pass, without needing the separate follow-up migration too.
revoke execute on function public.can_pick_mom_for_team(integer) from anon;

-- True when p_member_id is an active roster member of p_team_id — "the winner
-- must actually be on the team this pick is for," enforced for every picker
-- including super_admin/hr, not just hod/director. A data-integrity rule, not
-- an authorization one.
create or replace function public.mom_target_on_team(p_member_id integer, p_team_id integer)
returns boolean
language sql
stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.team_members
    where member_id = p_member_id and team_id = p_team_id and is_active = true
  );
$$;

revoke all on function public.mom_target_on_team(integer, integer) from public;
grant execute on function public.mom_target_on_team(integer, integer) to authenticated;
revoke execute on function public.mom_target_on_team(integer, integer) from anon;

-- True when p_period has been opened by HR/super_admin and not since closed.
create or replace function public.mom_period_is_open(p_period date)
returns boolean
language sql
stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.member_of_the_month_periods
    where period = p_period and is_open = true
  );
$$;

revoke all on function public.mom_period_is_open(date) from public;
grant execute on function public.mom_period_is_open(date) to authenticated;
revoke execute on function public.mom_period_is_open(date) from anon;

-- ── 4. member_of_the_month RLS, rebuilt for per-team picks ──────────────────
drop policy if exists mom_insert_leaders on public.member_of_the_month;
drop policy if exists mom_update_leaders on public.member_of_the_month;
drop policy if exists mom_delete_leaders on public.member_of_the_month;

-- INSERT: picker must be authorized for team_id, the target member must
-- actually be on that team, and — for a hod/director specifically, not
-- super_admin/hr — the month must be open.
create policy mom_insert_leaders on public.member_of_the_month
  for insert to authenticated
  with check (
    public.can_pick_mom_for_team(team_id)
    and public.mom_target_on_team(member_id, team_id)
    and (public.is_super_admin() or public.mom_period_is_open(period))
  );

create policy mom_update_leaders on public.member_of_the_month
  for update to authenticated
  using (public.can_pick_mom_for_team(team_id))
  with check (
    public.can_pick_mom_for_team(team_id)
    and public.mom_target_on_team(member_id, team_id)
    and (public.is_super_admin() or public.mom_period_is_open(period))
  );

-- DELETE (clearing a wrong pick) is NOT gated on is_open — treated as an
-- "undo" that stays available to whoever could have picked, even after the
-- month closes.
create policy mom_delete_leaders on public.member_of_the_month
  for delete to authenticated
  using (public.can_pick_mom_for_team(team_id));

-- mom_select_current / mom_select_leaders are intentionally NOT recreated
-- here — they still exist exactly as member_of_the_month_2026_09_05.sql left
-- them and need no team-aware change (see SELECT POLICIES ARE UNCHANGED
-- above).

-- ── 5. submit_mom_photo RPC — the winner's own self-service step ───────────
-- The one path by which photo_url/photo_uploaded_at can ever be set. Scoped
-- to the picked member only — not leaders — because this step is explicitly
-- the winner's own action (reachable from their notification and their own
-- profile); a leader who needs to help someone who can't access the site
-- should do it with them, not around them, which this migration does not
-- special-case.
create or replace function public.submit_mom_photo(p_pick_id bigint, p_photo_url text)
returns public.member_of_the_month
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_id integer;
  v_row       public.member_of_the_month;
begin
  select member_id into v_member_id from public.members where auth_uid = auth.uid();
  if v_member_id is null then
    raise exception 'not authenticated';
  end if;

  if p_photo_url is null or length(trim(p_photo_url)) = 0 then
    raise exception 'a photo URL is required';
  end if;

  select * into v_row from public.member_of_the_month where id = p_pick_id;
  if not found then
    raise exception 'pick not found';
  end if;

  if v_row.member_id <> v_member_id then
    raise exception 'only the picked member can upload their own photo';
  end if;

  update public.member_of_the_month
     set photo_url = p_photo_url,
         photo_uploaded_at = now(),
         updated_at = now()
   where id = p_pick_id
   returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.submit_mom_photo(bigint, text) from public;
grant execute on function public.submit_mom_photo(bigint, text) to authenticated;
revoke execute on function public.submit_mom_photo(bigint, text) from anon;

-- ── Verification (run after applying) ──────────────────────────────────────
-- select column_name, is_nullable from information_schema.columns
--  where table_name='member_of_the_month' and column_name in ('team_id','photo_url','photo_uploaded_at');
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--  where conrelid = 'public.member_of_the_month'::regclass;
-- select relrowsecurity from pg_class where oid = 'public.member_of_the_month_periods'::regclass;
-- select policyname, cmd, qual, with_check from pg_policies
--  where tablename in ('member_of_the_month','member_of_the_month_periods');
-- select proname from pg_proc where proname in
--  ('can_pick_mom_for_team','mom_target_on_team','mom_period_is_open','submit_mom_photo');
--
-- ── VERIFIED-LIVE RESULT (2026-09-05, immediately after apply) ─────────────
-- · member_of_the_month.team_id: integer, is_nullable = NO.
-- · member_of_the_month.photo_url: text, is_nullable = YES.
-- · member_of_the_month.photo_uploaded_at: timestamptz, is_nullable = YES.
-- · Constraints on member_of_the_month include
--     member_of_the_month_period_team_key  UNIQUE (period, team_id)
--     member_of_the_month_team_id_fkey     FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE
--   and member_of_the_month_period_key (the old UNIQUE(period)) is GONE.
-- · member_of_the_month_periods: relrowsecurity = true.
-- · pg_policies has exactly: member_of_the_month {mom_select_current,
--   mom_select_leaders, mom_insert_leaders, mom_update_leaders,
--   mom_delete_leaders} and member_of_the_month_periods
--   {mom_periods_select_leaders, mom_periods_insert_admins,
--   mom_periods_update_admins} — 8 policies total, matching this file.
-- · pg_proc has can_pick_mom_for_team, mom_target_on_team, mom_period_is_open,
--   submit_mom_photo, all present.
-- · information_schema.routine_privileges on all four new functions, AFTER
--   the anon-revoke follow-up: grantee ∈ {authenticated, postgres,
--   service_role} only. anon confirmed absent (re-queried after the fix).
-- · get_advisors(security) re-run after the follow-up no longer lists any of
--   these four functions under anon_security_definer_function_executable.
-- (Full raw query output captured in the applying session; re-run the four
-- verification queries above any time to re-confirm against live truth.)
