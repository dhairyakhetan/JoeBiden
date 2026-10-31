-- ============================================================================
-- Two policy changes for walkthrough items 5.4 and 5.7 — 2026-09-11
-- STATUS: **APPLIED** to the community project (hzowuwffjqtgszecngpe) via the
--         Supabase MCP connector, as migrations
--           `mom_pick_any_active_member`
--           `members_guard_raises_instead_of_silently_reverting`
--         Verify live before trusting this header; paper trails in this repo
--         have drifted before.
-- ============================================================================


-- ── 5.4 · Member of the Month can be anyone active ──────────────────────────
--
-- "Must be able to search active members, including people outside the team,
-- not only team members."
--
-- The blocker was not the UI. `mom_insert_leaders` / `mom_update_leaders`
-- carried `mom_target_on_team(member_id, team_id)` in their WITH CHECK, so the
-- database refused any pick whose subject was not on that team's roster. The
-- 2026-09-05 migration that added it called it "a data-integrity rule, not an
-- authorization one". The owner has now decided it is not a rule at all.
--
-- What replaces it is the weaker check that still matters: the subject must be
-- a real, ACTIVE member. Picking a pending_approval, rejected or deleted
-- account is a genuine integrity failure and stays blocked.
--
-- UNCHANGED, deliberately:
--   · can_pick_mom_for_team(team_id) - WHO may pick, and for which team. The
--     authorization half is untouched. A Social Media HoD still cannot write a
--     pick for Welfare; they can now name a Welfare PERSON as Social Media's
--     member of the month, which is what was asked for.
--   · mom_period_is_open(period) for non-super pickers.
--   · UNIQUE(period, team_id): still one pick per team per month.
--
-- `mom_target_on_team` is KEPT although no policy now calls it - it is a
-- correct, cheap predicate the desk may still want for a hint, and dropping a
-- function to make a point costs more than leaving it.

create or replace function public.mom_target_is_active_member(p_member_id integer)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1 from public.members
    where member_id = p_member_id and status = 'active'
  );
$function$;

revoke all on function public.mom_target_is_active_member(integer) from anon;
grant execute on function public.mom_target_is_active_member(integer) to authenticated;

drop policy if exists mom_insert_leaders on public.member_of_the_month;
create policy mom_insert_leaders on public.member_of_the_month
  for insert to authenticated
  with check (
    can_pick_mom_for_team(team_id)
    and mom_target_is_active_member(member_id)
    and (is_super_admin() or mom_period_is_open(period))
  );

drop policy if exists mom_update_leaders on public.member_of_the_month;
create policy mom_update_leaders on public.member_of_the_month
  for update to authenticated
  using (can_pick_mom_for_team(team_id))
  with check (
    can_pick_mom_for_team(team_id)
    and mom_target_is_active_member(member_id)
    and (is_super_admin() or mom_period_is_open(period))
  );

-- VERIFIED LIVE, in a rolled-back transaction, as a real super_admin session:
--   picking member 468, ACTIVE but NOT on Social Media   ALLOWED  (was blocked)
--   picking member 1408, status <> 'active'              BLOCKED  (as intended)


-- ── 5.7 · the role guard raises instead of silently reverting ───────────────
--
-- "Manage HoDs: role assignment must actually work."
--
-- It does work for the people who can reach that desk - verified by simulating
-- a super_admin promoting a member: ROW_COUNT 1 and the role really became
-- 'hod'. What was broken is what happened when someone NOT allowed tried, and
-- it was broken in the most dangerous direction:
--
--     if not is_super_admin() then new.role := old.role; end if;
--
-- A SILENT REVERT. Simulated as the one live hod, promoting a member to
-- super_admin: ROW_COUNT 1, role still 'member' afterwards. PostgREST returns
-- the row, the service sees no error, and directorService.promoteToDirector /
-- demoteToMember / changeRole selected back only `member_id` - so the desk
-- would toast "promoted to HoD" over a database that had done nothing. A
-- permission failure that presents as success is worse than one that errors,
-- because nobody goes looking.
--
-- `is distinct from` matters: an update that merely CARRIES the same value -
-- what a full-row save from a profile form does - is not an attempt and still
-- passes silently. Only a real attempted change raises.
--
-- Checked before applying that nothing legitimate relied on the silent clamp.
-- Every `members` UPDATE in the frontend: RegisterPage (name/class/phone),
-- breakService, profileService, profileNudgeService, wallService,
-- ChooseTeamPage - none privileged; directorService approve/reject (status,
-- director-gated, allowed) and promote/demote/changeRole (role,
-- super-admin-gated, allowed). None attempt a change they are not entitled to.
--
-- The `auth.uid() is null` early return is kept: service-role jobs and the SQL
-- editor still bypass, as they must for backfills.

create or replace function public.members_guard_privileged_cols()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null then return new; end if;          -- service role / direct SQL

  if new.role is distinct from old.role and not is_super_admin() then
    raise exception
      'Only an HR or super admin account can change a member''s role.'
      using errcode = '42501';
  end if;

  if not (is_director() or is_super_admin()) then
    if new.status      is distinct from old.status
    or new.is_active   is distinct from old.is_active
    or new.approved_by is distinct from old.approved_by
    or new.approved_at is distinct from old.approved_at then
      raise exception
        'Only a director, HoD, HR or super admin account can change a member''s status or approval.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$function$;

-- VERIFIED LIVE, in rolled-back transactions, one simulated session each:
--   A  super_admin sets role='hod'                       role really becomes hod
--   B  hod sets role='super_admin'                       raises 42501 (was a silent no-op)
--   C1 member saves own profile (full_name only)         1 row, OK
--   C2 member saves a full row CARRYING role and status  1 row, OK - no raise
--   C3 member sets own role='super_admin'                raises 42501
--
-- C1/C2 are the regression test that matters: the guard must not turn ordinary
-- profile saves into errors, and it does not.
--
-- A NOTE ON A FALSE ALARM, so it is not "fixed" later: an early version of
-- test C failed with `permission denied for table members`. That was not this
-- trigger and not a regression - the test's WHERE clause read `auth_uid`, a
-- column `authenticated` has no SELECT grant on under the PII lockdown. The
-- grant error is thrown before any trigger runs. `authenticated` DOES hold
-- column-level UPDATE on `role` and `status`; this trigger, not the grant, is
-- what gates them.
--
-- The app carries a second layer now too (directorService): all three role
-- writers select `role` back and throw if it is not what was asked for, so a
-- future silent clamp becomes a visible failure rather than a lie.
--
-- ── TO REVERT ───────────────────────────────────────────────────────────────
-- 5.4: restore `mom_target_on_team(member_id, team_id)` in both WITH CHECKs.
-- 5.7: replace the two `raise exception` blocks with the original
--      `new.role := old.role` / `new.status := old.status` assignments. Do not,
--      though - the app's read-back check would then surface it as an error
--      anyway, which is the outcome this change was making honest.
-- ============================================================================
