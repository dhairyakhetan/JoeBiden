-- 2026-10-24: Blogs hidden from the Marketing page too.
--
-- APPLIED LIVE on 2026-10-24 by the daily routine (data only, reversible, nothing deleted).
--
-- Source: bug report 3a70c769 ("Remove the blogs team from under social media; social media only includes
-- reels, design and LinkedIn"). It was solved on 2026-10-19 by hiding Blogs under Social Media (team 9, sub_team 7).
-- A leader reopened it on 2026-10-23 with no note. The audit found a second, separate Blogs sub-department
-- (sub_team 37) under Marketing (team 18) that was still active and has no members. The owner confirmed on
-- 2026-10-24 that hiding it is what was meant.
--
-- To undo: set is_active back to true. The is_active !== false filter in teamService.ts means no code change
-- is needed either way.

update public.sub_teams
   set is_active = false
 where sub_team_id = 37
   and team_id = 18
   and slug = 'blogs'
   and is_active = true;
