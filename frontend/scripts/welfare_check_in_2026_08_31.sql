-- ============================================================================
-- ✅ APPLIED live 2026-08-31
--
-- The welfare check-in sheet, step 1 of handoff/16-welfare-record.md's
-- explicit build order ("nothing else works without it"). Two product
-- decisions confirmed with the user 2026-08-31 before writing this:
--
-- 1. "A drive" reuses `welfare_projects` directly (no new drives table) -
--    every welfare_projects row IS a drive. Chosen over a separate `drives`
--    table for simplicity; the tradeoff (one welfare_projects campaign like
--    "medical camps this year" can't cleanly represent 8 separate dated
--    occurrences with 8 separate rosters under this model) is accepted.
-- 2. Whoever is assigned as a drive's lead can BOTH run check-in AND mark the
--    drive complete, which is the exact moment points are awarded - no
--    second-person sign-off required. Matches how team creation already
--    auto-assigns the creator as lead: one person's word is trusted for
--    their own drive, same trust level as the paper attendance sheet this
--    replaces.
--
-- This migration:
--   (a) adds drive scheduling + lead-assignment columns to welfare_projects
--   (b) creates drive_attendance (the roster table)
--   (c) creates complete_drive_attendance() - the SECURITY DEFINER payout RPC
--       points_ledger_2026_08_29.sql's own header already anticipated this
--       exact function ("a system/trigger-driven award for drive completion,
--       if/when that's built, would run as a SECURITY DEFINER function and
--       bypass RLS entirely") - this is that function.
-- ============================================================================

-- ── (a) welfare_projects additions ──────────────────────────────────────────
alter table public.welfare_projects
  add column if not exists drive_lead_member_id integer references public.members(member_id) on delete set null,
  add column if not exists scheduled_end timestamptz,
  add column if not exists attendance_completed_at timestamptz;

comment on column public.welfare_projects.drive_lead_member_id is
  'Who runs check-in for THIS drive and can mark it complete (triggers points). Deliberately separate from posts.author_id via linked_post_id - the person who writes up a drive is not always the person who physically ran it. Null = attendance not yet set up for this drive (paper still, per handoff/16 §1).';

comment on column public.welfare_projects.scheduled_end is
  'Paired with the existing workshop_date (treated as scheduled start) for the hours fallback: "Hours fall back to the drives scheduled duration when check-out is missing" (handoff/16 §2 rule 3). Null if no schedule was ever set - hours fallback is then simply unavailable for that drive''s no-checkout rows.';

comment on column public.welfare_projects.attendance_completed_at is
  'Set once, by complete_drive_attendance(). Idempotency marker - a drive can only pay out points once. Also the desk signal for "/director/drives": null = still open/on paper, set = closed and paid out.';

-- ── (b) drive_attendance — the roster ───────────────────────────────────────
create table if not exists public.drive_attendance (
  id                  integer generated always as identity primary key,
  welfare_project_id  integer not null references public.welfare_projects(id) on delete cascade,
  member_id           integer references public.members(member_id) on delete set null,
  -- Walk-up (handoff/16 §2 rule 5): "+ add someone takes a name and nothing
  -- else" - unregistered community volunteers have no member row at all.
  walkup_name         text,
  status              text not null default 'expected'
                       check (status in ('expected', 'here', 'left', 'no_show', 'walk_up')),
  checked_in_at        timestamptz,
  checked_out_at       timestamptz,
  -- handoff/16 §2 rule 4: "The consent tick lives here... the only moment it
  -- is obtainable." One column, not a separate table - it's a per-person,
  -- per-drive fact, same shape as the roster row it lives beside.
  consent_signed       boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  updated_by           integer references public.members(member_id) on delete set null,
  -- Exactly one of member_id / walkup_name - a registered attendee has no
  -- walk-up name, a walk-up has no member row.
  constraint drive_attendance_person_xor check (
    (member_id is not null and walkup_name is null)
    or (member_id is null and walkup_name is not null)
  )
);

comment on table public.drive_attendance is
  'The roster for one welfare_projects row ("drive"). One row per person per drive. Registered members get a full row pre-seeded as expected (from the team roster, app-side); walk-ups are inserted on the fly with only a name. Only here/left earn hours+points (handoff/16 §2, §3).';

comment on column public.drive_attendance.status is
  'expected/here/left/no_show/walk_up (handoff/16 §2). Only here and left earn hours - see complete_drive_attendance() and the hours-derivation read pattern in application code.';

-- A registered member can only have ONE roster row per drive (prevents a
-- flaky offline retry from creating duplicate check-ins for the same
-- person) - partial unique index since walk-ups (member_id null) are
-- deliberately allowed to repeat.
create unique index if not exists idx_drive_attendance_unique_member
  on public.drive_attendance (welfare_project_id, member_id)
  where member_id is not null;

create index if not exists idx_drive_attendance_welfare_project_id
  on public.drive_attendance (welfare_project_id);

drop trigger if exists drive_attendance_set_updated_at on public.drive_attendance;
create trigger drive_attendance_set_updated_at
  before update on public.drive_attendance
  for each row execute function public.update_updated_at_column();

alter table public.drive_attendance enable row level security;

-- SELECT: the assigned lead, any director/hod (oversight + the /director/
-- drives desk), or super_admin. Not category-scoped (is_director() isn't
-- either, matching points_ledger's own insert policy) - a director already
-- sees every department's queues elsewhere in this schema.
-- Also lets a member see their OWN rows (member_id = self) - added for
-- handoff/16 §4's hours derivation ("sum(check-out − check-in) across
-- here/left"), which every member needs to read for their own profile.
-- This does NOT expose the rest of a drive's roster to them - only rows
-- where they themselves are the attendee.
drop policy if exists "drive_attendance_select" on public.drive_attendance;
create policy "drive_attendance_select"
  on public.drive_attendance for select
  using (
    member_id = public.get_current_member_id()
    or exists (
      select 1 from public.welfare_projects wp
      where wp.id = drive_attendance.welfare_project_id
        and wp.drive_lead_member_id = public.get_current_member_id()
    )
    or public.is_director()
    or public.is_super_admin()
  );

-- INSERT/UPDATE: same rule - the assigned lead runs their own roster, a
-- director/super_admin can step in to fix a mistake. Regular members
-- (including the volunteers being checked in) get no write access at all -
-- only the assigned lead's own tap does. No DELETE policy: a wrong tap is
-- corrected by changing status, not by removing the row - keeps the roster
-- an honest record of what actually happened during the drive, matching the
-- append-only philosophy already used for points_ledger.
drop policy if exists "drive_attendance_write_lead" on public.drive_attendance;
create policy "drive_attendance_write_lead"
  on public.drive_attendance for insert
  with check (
    exists (
      select 1 from public.welfare_projects wp
      where wp.id = drive_attendance.welfare_project_id
        and wp.drive_lead_member_id = public.get_current_member_id()
    )
    or public.is_director()
    or public.is_super_admin()
  );

drop policy if exists "drive_attendance_update_lead" on public.drive_attendance;
create policy "drive_attendance_update_lead"
  on public.drive_attendance for update
  using (
    exists (
      select 1 from public.welfare_projects wp
      where wp.id = drive_attendance.welfare_project_id
        and wp.drive_lead_member_id = public.get_current_member_id()
    )
    or public.is_director()
    or public.is_super_admin()
  )
  with check (
    exists (
      select 1 from public.welfare_projects wp
      where wp.id = drive_attendance.welfare_project_id
        and wp.drive_lead_member_id = public.get_current_member_id()
    )
    or public.is_director()
    or public.is_super_admin()
  );

-- ── (c) the payout RPC ───────────────────────────────────────────────────────
create or replace function public.complete_drive_attendance(p_welfare_project_id integer)
returns table(attendees_paid integer, already_completed boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_id   integer;
  v_is_lead     boolean;
  v_already     timestamptz;
  v_paid        integer := 0;
begin
  select member_id into v_member_id from public.members where auth_uid = auth.uid();
  if v_member_id is null then
    raise exception 'not authenticated';
  end if;

  select (wp.drive_lead_member_id = v_member_id), wp.attendance_completed_at
    into v_is_lead, v_already
  from public.welfare_projects wp
  where wp.id = p_welfare_project_id;

  if not found then
    raise exception 'drive not found';
  end if;

  if not (coalesce(v_is_lead, false) or public.is_director() or public.is_super_admin()) then
    raise exception 'only this drive''s assigned lead, a director, or a super admin can complete it';
  end if;

  if v_already is not null then
    attendees_paid := 0;
    already_completed := true;
    return next;
    return;
  end if;

  -- One point per here/left attendee (handoff/16 §3: "1 point per
  -- volunteering activity... Earned on here/left, once per drive, when the
  -- drive is marked complete. Not on check-in - an aborted drive should not
  -- pay out."). Walk-ups (member_id null) have no members row to credit -
  -- they simply don't earn points, same as they don't have a profile.
  insert into public.points_ledger (member_id, points, reason, related_drive_id, created_by)
  select da.member_id, 1, 'drive:' || p_welfare_project_id, p_welfare_project_id, v_member_id
  from public.drive_attendance da
  where da.welfare_project_id = p_welfare_project_id
    and da.status in ('here', 'left')
    and da.member_id is not null;

  get diagnostics v_paid = row_count;

  update public.welfare_projects
     set attendance_completed_at = now()
   where id = p_welfare_project_id;

  attendees_paid := v_paid;
  already_completed := false;
  return next;
end;
$$;

comment on function public.complete_drive_attendance(integer) is
  'SECURITY DEFINER. Caller must be the drive''s assigned lead (welfare_projects.drive_lead_member_id), or director/super_admin. Idempotent - a second call on an already-completed drive returns already_completed=true and pays nothing again. Awards 1 point per here/left attendee with a real member_id (walk-ups excluded) via points_ledger, then stamps welfare_projects.attendance_completed_at.';

revoke all on function public.complete_drive_attendance(integer) from public, anon;
grant execute on function public.complete_drive_attendance(integer) to authenticated;

-- ============================================================================
-- VERIFICATION — run after applying. Every line should report OK.
-- ============================================================================
-- Expect: 3 new welfare_projects columns
--   select column_name from information_schema.columns
--    where table_name='welfare_projects'
--      and column_name in ('drive_lead_member_id','scheduled_end','attendance_completed_at');
--
-- Expect: drive_attendance exists, RLS enabled, 3 policies (select/insert/update)
--   select relrowsecurity from pg_class where relname = 'drive_attendance';
--   select policyname, cmd from pg_policies where tablename = 'drive_attendance';
--
-- Expect: complete_drive_attendance is SECURITY DEFINER, authenticated-only
--   select prosecdef from pg_proc where proname = 'complete_drive_attendance';
--   select grantee, privilege_type from information_schema.routine_privileges
--    where routine_name = 'complete_drive_attendance';
--
-- Expect: no policy references a raw members.auth_uid/email/phone subquery
--   select policyname from pg_policies
--    where tablename = 'drive_attendance'
--      and (qual ilike '%auth_uid%' or with_check ilike '%auth_uid%');
--   -- should return 0 rows
-- ============================================================================
