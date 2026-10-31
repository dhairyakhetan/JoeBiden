-- Team tree, slice 1a: the HR director's sub-team lists for the teams where it is safe to apply them.
--
-- WHY: report 5ce843ba (the HR director's family tree) and the owner's decisions of 2026-10-09: her
-- tree wins over the sub-teams already on the site, and old sub-teams are hidden (is_active = false),
-- never deleted. Plan: docs/plans/teams-as-categories.md. Marketing as a parent team is slice 1b.
--
-- STATUS: APPLIED LIVE 2026-10-09 (project hzowuwffjqtgszecngpe). Data only; no schema change, no delete.
-- The page already reads is_active (services/teamService.ts), so nothing in the app changed.
--
-- WHAT WAS NOT TOUCHED, ON PURPOSE (people are assigned to these sub-teams, so hiding them would orphan
-- real assignments; waiting on the owner's mapping):
--   Welfare Team: Backend & Records (2 members), Dog Feeding (2), Other Campaigns (25),
--                 Rotaract Curriculum (2), Teaching Internship (16), Workshops (19).
--   Social Media: Instagram (22), Blogs (1), LinkedIn (3). Only Design Team and Reels Team were ADDED.
--   Crftd: not in the tree's sub-team lists.
--   Collabs Team: not in the tree.
-- Also not applied: Account Manager, Internal HR, Welfare Coordinator and the Ventures "Head of" lines
-- (unclear whether they are teams or roles).

-- 1. add her sub-teams (idempotent: unique on (team_id, slug)).
insert into public.sub_teams (team_id, name, slug, display_order) values
  (7,  'Experiences', 'experiences', 1),
  (7,  'Operations', 'operations', 2),
  (7,  'Stalls and Sponsorships', 'stalls-and-sponsorships', 3),
  (7,  'Marketing', 'marketing', 4),
  (13, 'Paper Verification', 'paper-verification', 1),
  (13, 'Tutor Onboarding', 'tutor-onboarding', 2),
  (13, 'Revision Games', 'revision-games', 3),
  (13, 'Frontend Development', 'frontend-development', 4),
  (13, 'Research and Agentic Dev', 'research-and-agentic-dev', 5),
  (17, 'Tech Team', 'tech-team', 1),
  (17, 'Design Team', 'design-team', 2),
  (17, 'Blogs', 'blogs', 3),
  (12, 'Socials', 'socials', 1),
  (12, 'Creatives', 'creatives', 2),
  (9,  'Design Team', 'design-team', 4),
  (9,  'Reels Team', 'reels-team', 5)
on conflict (team_id, slug) do nothing;

-- 2. hide the old Events (team 7) and ShikshAQ (team 13) sub-teams. Guarded: a sub-team with any member
--    assigned is never hidden by this statement. Both teams had zero assignments when this ran.
update public.sub_teams s set is_active = false
 where s.team_id in (7, 13)
   and s.sub_team_id in (10,11,12,13,14,15,16,17,18,19,20)
   and not exists (select 1 from public.team_member_sub_teams m where m.sub_team_id = s.sub_team_id);

-- 3. owner's mapping answers, applied live later the same day (2026-10-09):
--    Welfare: add her two missing sub-teams BESIDE the existing six; nobody moves, nothing hidden.
insert into public.sub_teams (team_id, name, slug, display_order) values
  (8, 'Campaigns', 'campaigns', 7),
  (8, 'Backend and Curriculum', 'backend-and-curriculum', 8)
on conflict (team_id, slug) do nothing;
--    Social Media: Instagram (22 members) is renamed Reels Team. The slug stays 'instagram' so existing
--    links keep working; the empty duplicate Reels Team added in step 1 (id 41) is hidden.
update public.sub_teams set is_active = false
 where sub_team_id = 41 and team_id = 9 and name = 'Reels Team'
   and not exists (select 1 from public.team_member_sub_teams m where m.sub_team_id = 41);
update public.sub_teams set name = 'Reels Team' where sub_team_id = 8 and team_id = 9 and slug = 'instagram';
--    Account Manager, Internal HR, Welfare Coordinator and the Ventures "Head of" lines are ROLES, not teams:
--    nothing created.

-- UNDO (reversible, no delete): bring the old ones back and hide the new ones.
--   update public.sub_teams set is_active = true  where sub_team_id in (10,11,12,13,14,15,16,17,18,19,20);
--   update public.sub_teams set name = 'Instagram' where sub_team_id = 8 and team_id = 9;
--   update public.sub_teams set is_active = true where sub_team_id = 41;
--   update public.sub_teams set is_active = false where team_id = 8 and slug in ('campaigns','backend-and-curriculum');
--   update public.sub_teams set is_active = false where team_id in (7,13) and slug in
--     ('experiences','operations','stalls-and-sponsorships','marketing','paper-verification',
--      'tutor-onboarding','revision-games','frontend-development','research-and-agentic-dev');
