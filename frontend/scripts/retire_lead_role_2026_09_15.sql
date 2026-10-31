-- APPLIED LIVE 2026-09-15 via Supabase MCP (two migrations, both included
-- here: retire_team_lead_role_promote_to_hod, then
-- retire_lead_role_members_check)
--
-- Owner decision: "directors should have the exact same powers as HoDs, just
-- the name difference" (already true - both app-side via lib/roles.ts's
-- LEADER_ROLES and DB-side via is_director(), which treats
-- role in ('director','hod','super_admin','hr') identically) "and remove the
-- lead role in existence".
--
-- Two unrelated things were both called "lead" before this:
--   1. members.role = 'lead' - a global tier one step below hod/director.
--      Zero live holders already. Pure cleanup.
--   2. team_members.role = 'lead' - a per-team marker granting
--      is_team_lead()/is_team_lead_of_member()-gated access to that one
--      team (roster management, join-request review, team-scoped post
--      moderation, a members.status/break RLS grant). 25 live rows across
--      11 unique people. Of those, 7 already held hod/hr/super_admin
--      org-wide (no functional change). The remaining 4 - Anvi Goenka
--      (#1305), Diya Poddar (#44), Sania khan (#843), Satavisha Dutta (#750)
--      - are promoted to 'hod' here per the owner's explicit answer
--      ("promote to HoD/director") rather than losing what they had.

update public.members
set role = 'hod'
where member_id in (1305, 44, 843, 750)
  and role = 'member';

insert into public.community_audit_logs (member_id, action, entity_type, entity_id, details)
select null, 'member_role_changed', 'member', member_id,
       jsonb_build_object('role', 'hod', 'reason', 'team_lead_role_retired_promoted_to_hod')
from public.members
where member_id in (1305, 44, 843, 750);

update public.team_members
set role = 'member'
where role = 'lead';

alter table public.team_members drop constraint team_members_role_check;
alter table public.team_members add constraint team_members_role_check
  check (role::text = 'member'::text);

comment on column public.team_members.role is
  'Always ''member'' - the per-team ''lead'' tier was retired 2026-09-15 (owner decision: directors/HoDs are the only leadership tier, team-scoped or otherwise). Column kept rather than dropped since many FKs/queries still reference it, and is_team_lead()/is_team_lead_of_member() are left in place as permanently-false no-ops rather than rewriting the ~10 RLS policies that OR against them (team_members insert/update/delete, teams update, job_openings insert/update/delete, job_applications select/update, posts update, team_join_requests select/update, members update, member_breaks select) - all of them fall back to is_director(), which the newly-promoted HoDs satisfy directly, so nobody''s access narrowed.';

-- Second migration - missed in the first pass: members_role_check still
-- listed 'lead' as a valid global members.role value even after the above.
alter table public.members drop constraint members_role_check;
alter table public.members add constraint members_role_check
  check (role::text = any (array['member','director','hod','super_admin','hr']::text[]));

-- Verified live afterward:
--   select count(*) from team_members where role='lead'  -> 0
--   select role from members where member_id in (1305,44,843,750)  -> all 'hod'
-- get_advisors (security): no new/regressed findings from either migration.
--
-- Frontend swept in the same pass: every UI path that could WRITE
-- team_members.role='lead' or members.role='lead' was removed (the
-- AddMemberModal "make them LEAD" toggle, TeamManagement's auto-assign-
-- creator-as-lead on team creation, teamService.getRoles() narrowed to
-- ['member'] so TeamDetailPage's change-role menu self-hides). Read-only
-- display branches that check `role === 'lead'` (team roster "Team Leads"
-- section, role badges) were left in place where removing them would ripple
-- into type changes with zero behavior difference - they simply never match
-- again, same reasoning as leaving the SQL is_team_lead() functions in place
-- as no-ops rather than rewriting every RLS policy that ORs against them.
