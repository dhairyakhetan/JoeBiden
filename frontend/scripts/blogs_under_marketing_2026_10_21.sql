-- 2026-10-21: Blogs becomes a direct sub-team of Marketing.
--
-- Owner decision (chat, 2026-10-21): "Move it under Marketing". Before this, the active Blogs sub-team (sub_team_id 37) sat under
-- Digital Magazine (team_id 17, itself inside Marketing, team_id 18); the old Social Media copy (sub_team_id 7) was already inactive.
-- It had no members assigned (the only assignment, Hiya Khara, was on the inactive Social Media copy and an inactive membership),
-- so nobody moves. The guard refuses the move if Marketing already has a sub-team with the same slug.
--
-- STATUS: APPLIED LIVE 2026-10-21, verified: Marketing now lists Account Managers, Blogs, Team Operations, Welfare Coordinators.
-- Safe to re-run: the guard makes a second run a no-op.
update public.sub_teams
   set team_id = 18
 where sub_team_id = 37
   and team_id = 17
   and is_active
   and not exists (
     select 1 from public.sub_teams x
      where x.team_id = 18
        and x.slug = (select slug from public.sub_teams where sub_team_id = 37)
   );
