-- APPLIED LIVE 2026-09-13 via Supabase MCP (migration name: mom_restore_on_team_check)
--
-- Revert of `mom_pick_any_active_member` (2026-09-11, walkthrough item 5.4 -
-- see scripts/mom_any_member_and_loud_role_guard_2026_09_11.sql). That
-- migration deliberately widened Member of the Month so a HoD could name
-- ANY active member as a team's pick, not just someone on that team's
-- roster, per an explicit owner request at the time.
--
-- The owner has now reversed that decision, having found it live: picking a
-- ShikshaQ HoD's "member of the month," the search let them choose Krish
-- Goenka - flagged "not on this team" in the UI, but the write went through
-- anyway. Reported as wrong, not as the flexibility it was built to be.
--
-- This restores `mom_target_on_team(member_id, team_id)` in both
-- `mom_insert_leaders` and `mom_update_leaders`'s WITH CHECK, exactly as the
-- 2026-09-11 migration's own "TO REVERT" note said to. Both functions
-- (mom_target_on_team, mom_target_is_active_member) were kept live and
-- unchanged throughout - only the policies moved.
--
-- Verified live via:
--   select policyname, with_check from pg_policies
--    where tablename='member_of_the_month' and policyname like 'mom_%_leaders';

drop policy if exists mom_insert_leaders on public.member_of_the_month;
create policy mom_insert_leaders on public.member_of_the_month
  for insert to authenticated
  with check (
    can_pick_mom_for_team(team_id)
    and mom_target_is_active_member(member_id)
    and mom_target_on_team(member_id, team_id)
    and (is_super_admin() or mom_period_is_open(period))
  );

drop policy if exists mom_update_leaders on public.member_of_the_month;
create policy mom_update_leaders on public.member_of_the_month
  for update to authenticated
  using (can_pick_mom_for_team(team_id))
  with check (
    can_pick_mom_for_team(team_id)
    and mom_target_is_active_member(member_id)
    and mom_target_on_team(member_id, team_id)
    and (is_super_admin() or mom_period_is_open(period))
  );
