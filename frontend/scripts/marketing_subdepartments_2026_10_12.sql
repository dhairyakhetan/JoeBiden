-- Marketing sub-departments: Account Managers, Welfare Coordinators, Team Operations.
--
-- WHY: bug report 30f662a0 (a leader, 2026-10-12): "Under the marketing department add more sub departments,
-- existing departments should remain, add these as well." The HR director's family tree already put Account
-- Manager and Welfare Coordinator under Marketing; Team Operations is new in this request.
--
-- STATUS: APPLIED LIVE 2026-10-12 (project hzowuwffjqtgszecngpe). Data only, additive, idempotent
-- (unique on (team_id, slug)). Marketing is teams.team_id 18 (teams_parent_marketing_2026_10_09.sql). The
-- page already reads sub_teams, so no app change was needed.
--
-- Assumed: these are sub-departments (groups inside Marketing, empty until HoDs assign people), not new
-- top-level teams. That is how the report words it and it keeps the 2026-10-09 answer that they are not
-- top-level teams. Nobody was assigned to them.

insert into public.sub_teams (team_id, name, slug, display_order)
select 18, v.name, v.slug, v.ord
  from (values ('Account Managers', 'account-managers', 1),
               ('Welfare Coordinators', 'welfare-coordinators', 2),
               ('Team Operations', 'team-operations', 3)) as v(name, slug, ord)
 where exists (select 1 from public.teams where team_id = 18 and name = 'Marketing')
on conflict (team_id, slug) do nothing;

-- SUPERSEDED 2026-10-13: the owner answered that Account Managers, Welfare Coordinators and Team Operations
-- are roles inside Marketing, not sub-departments. Applied live the same day (data only, reversible, guarded so a
-- sub-team with anyone assigned is never hidden; none had anyone):
--   update public.sub_teams set is_active = false where team_id = 18
--      and slug in ('account-managers','welfare-coordinators','team-operations')
--      and not exists (select 1 from public.team_member_sub_teams m where m.sub_team_id = sub_teams.sub_team_id);
-- The rows still exist, hidden. To bring them back, set is_active = true.
--
-- UNDO (no delete): hide them.
--   update public.sub_teams set is_active = false where team_id = 18 and slug in ('account-managers','welfare-coordinators','team-operations');
