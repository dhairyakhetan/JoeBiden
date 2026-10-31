-- Social Media under Marketing: sub-department naming.
--
-- WHY: bug report 07b32d75 (a leader, 2026-10-12): "Remove Social Media as a separate team from Teams. Instead
-- add it as a sub department under Marketing. Social Media will further be categorised into Reels Team,
-- Design Team and LinkedIn Team."
--
-- The structure itself needed no database change: Social Media already points at Marketing through
-- teams.parent_team_id (teams_parent_marketing_2026_10_09.sql), and its Reels Team and Design Team sub-teams
-- already exist (team_tree_subteams_2026_10_09.sql). The app now lists only top-level departments on /teams
-- and shows a department inside another under its parent (teamService.getTeams topLevelOnly).
--
-- STATUS: APPLIED LIVE 2026-10-12 (project hzowuwffjqtgszecngpe). One data rename, reversible, no delete.
--
-- Assumed: (1) Digital Magazine, also a Marketing child in the same family tree, is treated the same way and
-- also leaves the top-level /teams list; the other reading hides only Social Media. (2) Social Media keeps
-- its own team row (members, posts, Member of the Month, roles all hang off it), so it is nested, not
-- converted into a sub-team. (3) The existing Blogs sub-team (1 member assigned) is left in place: it is not
-- in the report's list, but hiding it would orphan that assignment.

update public.sub_teams set name = 'LinkedIn Team'
 where sub_team_id = 9 and team_id = 9 and slug = 'linkedin' and name = 'LinkedIn';

-- UNDO:
--   update public.sub_teams set name = 'LinkedIn' where sub_team_id = 9 and team_id = 9;
