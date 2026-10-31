-- ============================================================================
-- Owner decisions: team scoping switched on, one super admin — 2026-09-11
-- STATUS: **APPLIED** to the community project (hzowuwffjqtgszecngpe) via the
--         Supabase MCP connector, as migrations
--           `hod_becomes_team_lead_and_scoping_switches_on`
--           `single_super_admin_rest_become_hr`
--           `restrict_hr_from_roles_desk`
--         Verify live before trusting this header; paper trails in this repo
--         have drifted before.
-- ============================================================================


-- ── 6.1 / 6.2 · the team scope stops being inert ────────────────────────────
--
-- The Hiring/Post-Queue team scope shipped built, tested and NARROWING NOBODY.
-- Every team lead in the database was either a super_admin (unscoped by rule -
-- the query is not even run for them) or role 'member' (cannot reach the desk
-- at all). The org's one `hod`, member 1134, was on Welfare Team and Social
-- Media as a plain member, so getMyDeskTeamIds returned [] and the fail-open
-- rule correctly left him unscoped.
--
-- Promoting his two EXISTING memberships is what switches the mechanism on.
-- This is NOT a privilege change: `team_members.role` governs team-roster
-- powers and is orthogonal to `members.role`, the same distinction the
-- 2026-09-05 member-of-the-month migration spells out.

update public.team_members tm
set role = 'lead'
from public.teams t
where t.team_id = tm.team_id
  and tm.member_id = 1134
  and tm.is_active = true
  and t.name in ('Welfare Team', 'Social Media')
  and tm.role <> 'lead';

-- VERIFIED: member 1134 now resolves to exactly
--   team 8 Welfare Team  lead
--   team 9 Social Media  lead
-- Both changes recorded by the team_membership_audit_log trigger as
-- TEAM_MEMBER_ROLE_CHANGED.


-- ── 5.8 · one super admin, fifteen HR ───────────────────────────────────────
--
-- Owner: "apart from <me>, everyone who is an admin becomes HR." Keep member
-- 29; the other 15 become `hr`, including the three org/service accounts
-- (ngo.aquaterra@, aquaterra.techai@, official@ngoaquaterra.com), which the
-- owner was shown explicitly and chose to demote with the rest.
--
-- WHAT THIS DOES NOT DO - established WITH THE OWNER BEFORE APPLYING, because
-- it changes what their instruction actually achieves:
--
--   is_super_admin()  ->  role in ('super_admin','hr')     -- the database
--   ADMIN_ROLES       ->  ['hr','super_admin']             -- the app
--
-- `hr` and `super_admin` are interchangeable. This conversion therefore
-- changes NOBODY's access by itself: same desks, same RLS, same
-- create_post_as_org, same Certificates desk. The three org accounts keep
-- posting for exactly that reason - create_post_as_org gates on
-- is_super_admin(), which still returns true for an hr. Had the owner instead
-- chosen to make hr genuinely weaker, that function would have been the first
-- thing to break, which is why it was traced and put to them first.
--
-- What the conversion DOES is make them restrictable:
--   role_capabilities check (not (role = 'super_admin' and enabled = false))
-- A super_admin can never be narrowed from /director/roles. An hr can.
--
-- `where role = 'super_admin'` rather than a hardcoded id list, so it cannot
-- touch anyone who is not currently a super admin.

update public.members
set role = 'hr'
where role = 'super_admin'
  and member_id <> 29;


-- ── 5.8b · the act that actually separates the tiers ────────────────────────
--
-- Without this the conversion above is cosmetic. One row in the engine built
-- and verified on 2026-09-10: absent row means enabled, so this single
-- restriction IS the change, and deleting it reverts it completely.
--
-- Enforced in both places, which is why one row suffices:
--   · nav   - deskAccess.isDeskVisible() calls can('desk.roles')
--   · route - App.tsx wraps the route in DeskCapabilityGate
-- so an hr who types /director/roles is refused, not merely un-linked.
--
-- The same row for `super_admin` would be refused by the table's CHECK, which
-- is the guard that stops member 29 locking themselves out of the one screen
-- that could undo this.

insert into public.role_capabilities (capability_key, role, enabled, updated_by)
values ('desk.roles', 'hr', false, 29)
on conflict (capability_key, role)
do update set enabled = false, updated_by = 29, updated_at = now();

-- ── VERIFIED LIVE, by role simulation ───────────────────────────────────────
--   super_admins now                     1   (member 29)
--   hr now                              15
--   HR    role_can('desk.roles')         false   <- restricted
--   HR    role_can('desk.members')       true    <- untouched capability
--   HR    is_super_admin()               true    <- unchanged BY DESIGN, which
--                                                   is why org posting and the
--                                                   Certificates desk survive
--   OWNER role_can('desk.roles')         true
--
-- ── TO REVERT ───────────────────────────────────────────────────────────────
--   6.1/6.2:  update team_members set role='member' where member_id=1134;
--   5.8b:     delete from role_capabilities where capability_key='desk.roles';
--   5.8:      update members set role='super_admin' where role='hr';
--             (careful - this would also promote any hr created since.)
-- ============================================================================
