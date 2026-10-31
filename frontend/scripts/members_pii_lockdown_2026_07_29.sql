-- Closes a live hole: `authenticated` has base-table SELECT on
-- members.email/phone/auth_uid/google_id, and the "Anyone can view active
-- members" RLS policy (USING status='active') has no column restriction —
-- so any logged-in member can read every other active member's email/phone
-- by querying the base table (or member_directory_view / pending_member_
-- approvals, which are security_invoker views and were just as exposed
-- through the same broad column grant).
--
-- STAGE 1 (this file, safe to run immediately): additive only. Adds a
-- self-access RPC and re-gates the two director-facing views as
-- SECURITY DEFINER-style (security_invoker=false) with an explicit
-- is_director()/is_super_admin() check baked into the view itself — this
-- alone closes the "any authenticated member can query the directory
-- view directly" leak, with zero frontend changes required (existing
-- callers of these two views are already director-gated pages and get
-- identical data back).
--
-- STAGE 2 (members_pii_lockdown_stage2_revoke.sql, apply ONLY after the
-- updated frontend — which stops doing `select('*')`/`select(email,...)`
-- directly on `members` for cross-member reads — is deployed and login is
-- confirmed working): revokes SELECT (email, phone, auth_uid, google_id)
-- from authenticated on the members base table. Applying stage 2 before
-- the frontend ships breaks login for every user still on the old bundle.

-- ---------------------------------------------------------------------
-- 1. Self-access: return the caller's own full row, bypassing column
--    grants entirely (SECURITY DEFINER runs as the function owner).
--    SETOF members (not a hand-enumerated column list) so it stays
--    correct if the table gains columns later.
-- ---------------------------------------------------------------------
create or replace function public.get_own_member()
returns setof public.members
language sql
security definer
stable
set search_path to 'public', 'pg_temp'
as $$
  select * from public.members where auth_uid = auth.uid();
$$;

revoke all on function public.get_own_member() from public;
grant execute on function public.get_own_member() to authenticated;

-- ---------------------------------------------------------------------
-- 2. member_directory_view: was security_invoker=on (so it just re-ran
--    the query as the caller, with all the caller's own RLS + column
--    grants — no different from querying members directly). Flip to
--    security_invoker=false (runs as the view owner) and add an explicit
--    director/super_admin gate in the WHERE clause, since bypassing RLS
--    without one would let ANY authenticated caller see ALL members
--    regardless of status. Column set unchanged from the prior definition.
-- ---------------------------------------------------------------------
create or replace view public.member_directory_view
with (security_invoker = false)
as
select
  member_id,
  uuid,
  email,
  full_name,
  avatar_url,
  class_grade,
  role,
  status,
  created_at,
  case role
    when 'super_admin' then 0
    when 'director' then 1
    when 'hod' then 2
    else 3
  end as role_rank
from public.members m
where (is_director() or is_super_admin());

revoke all on public.member_directory_view from public, anon, authenticated;
grant select on public.member_directory_view to authenticated;

-- ---------------------------------------------------------------------
-- 3. pending_member_approvals: same treatment. Original WHERE kept,
--    director/super_admin gate added.
-- ---------------------------------------------------------------------
create or replace view public.pending_member_approvals
with (security_invoker = false)
as
select
  member_id,
  uuid,
  email,
  full_name,
  avatar_url,
  class_grade,
  phone,
  join_reason,
  bio,
  created_at
from public.members
where status = 'pending_approval'
  and is_active = true
  and (is_director() or is_super_admin())
order by created_at;

revoke all on public.pending_member_approvals from public, anon, authenticated;
grant select on public.pending_member_approvals to authenticated;

-- ---------------------------------------------------------------------
-- 4. Team-scoped contact lookup: teamService.getJoinRequests() needs a
--    join requester's email for the team lead reviewing it, but a team
--    lead is not necessarily a global director — is_director() alone
--    would wrongly zero this out for ordinary leads. Batch by member_id
--    array since a team's pending-requests list can be >1 row.
-- ---------------------------------------------------------------------
create or replace function public.get_team_member_contacts(p_member_ids int[], p_team_id int)
returns table(member_id int, email character varying, phone character varying)
language sql
security definer
stable
set search_path to 'public', 'pg_temp'
as $$
  select m.member_id, m.email, m.phone
  from public.members m
  where m.member_id = any(p_member_ids)
    and (
      is_director() or is_super_admin()
      or exists (
        select 1 from public.team_members tm
        where tm.team_id = p_team_id
          and tm.member_id = current_member_id()
          and tm.role = 'lead'
          and tm.is_active = true
      )
    )
$$;

revoke all on function public.get_team_member_contacts(int[], int) from public;
grant execute on function public.get_team_member_contacts(int[], int) to authenticated;
