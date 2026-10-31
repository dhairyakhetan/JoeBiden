-- 2026-10-29: give openings their team_id (report 875f0da1).
--
-- APPLIED LIVE on 2026-10-29 by the daily routine (data only, additive: it only fills NULLs, nothing is
-- deleted or overwritten).
--
-- Report 875f0da1: HoDs are notified about new applications, but cannot see the applicants' answers in the
-- Hiring desk. Cause: the apply notification finds a team's leads by job_openings.team_name, while the desk
-- scopes a HoD's view by job_openings.team_id (director/deskAccess.ts scopeToMyTeams, which hides an opening with
-- no team_id). jobOpenings.create/update only ever wrote team_name, so 17 of 18 openings had team_id NULL and
-- were invisible to every scoped HoD. RLS was never the problem: is_director() can read every application.
--
-- This fills team_id from team_name where an active team of that exact name exists. Two open openings have no
-- team_name at all ("Podcast Research & Outreach", "Video Editor"); no team can be inferred, so they stay unscoped
-- (visible to super admin and HR) until a leader edits them and picks a team.
--
-- To undo: set team_id back to NULL for the rows listed by the select below (all have team_id from this script).

update public.job_openings o
   set team_id = t.team_id
  from public.teams t
 where o.team_id is null
   and o.team_name is not null
   and t.name = o.team_name
   and t.is_active;
