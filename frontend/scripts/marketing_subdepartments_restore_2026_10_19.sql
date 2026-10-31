-- 2026-10-19: Marketing sub-departments restored, Blogs hidden from Social Media.
--
-- APPLIED LIVE on 2026-10-19 by the nightly sheet triage run (data only, reversible, nothing deleted).
--
-- Source: bug_reports 02f6f40e (Marketing has Social Media, Digital Magazine, Account Manager,
-- Welfare Coordinator, Team Operations as sub departments) and 3a70c769 (remove Blogs from under
-- Social Media; Social Media is reels, design and LinkedIn). Report de1e055b (Social Media and Digital
-- Magazine nested under Marketing) needed no change: both already have parent Marketing.
--
-- Assumed: these two requests replace the owner decision of 2026-10-13 recorded in
-- docs/plans/teams-as-categories.md ("Blogs stays under Social Media; Account Managers, Welfare
-- Coordinators and Team Operations are roles, so the three sub-departments are hidden").
-- The reporter is a super_admin and the requests are approved, so the newer answer wins.
--
-- To undo: swap true and false in the two statements below. The sub_teams filter in
-- teamService.ts (is_active !== false) means no code change is needed either way.

update public.sub_teams
   set is_active = true
 where team_id = 18
   and slug in ('account-managers', 'welfare-coordinators', 'team-operations')
   and is_active = false;

update public.sub_teams
   set is_active = false
 where team_id = 9
   and slug = 'blogs'
   and is_active = true;
