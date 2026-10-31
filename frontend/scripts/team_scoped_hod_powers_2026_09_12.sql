-- APPLIED LIVE 2026-09-12 via Supabase MCP (migration name: team_scoped_hod_powers)
--
-- Role model redesign: HoD is the only leadership role that exists, and it is
-- team-scoped (a `team_members.role = 'lead'` membership), not a separate
-- global tier. This migration gives a team lead real, RLS-enforced power
-- over their OWN team's posts and members - moderation and status/archive
-- management - without touching org-wide account approvals (still
-- super_admin/HR only - see members_update_allow_team_lead_2026_09_12.sql
-- for the companion policy widening this required).
--
-- Verified live afterwards via:
--   select tablename, policyname, cmd, qual from pg_policies
--    where tablename in ('members','posts') and cmd='UPDATE';

-- A member counts as "the team lead OF a given member" when they are an
-- active lead on any team the target member is also actively on.
create or replace function public.is_team_lead_of_member(p_member_id integer)
returns boolean
language sql
stable
security definer
set search_path = 'public', 'pg_temp'
as $$
  select exists (
    select 1
    from public.team_members lead_tm
    join public.team_members target_tm
      on target_tm.team_id = lead_tm.team_id
     and target_tm.member_id = p_member_id
     and target_tm.is_active
    where lead_tm.member_id = public.get_current_member_id()
      and lead_tm.role = 'lead'
      and lead_tm.is_active
  );
$$;
grant execute on function public.is_team_lead_of_member(integer) to authenticated;

-- posts: a team lead may now moderate (approve/reject) posts made under
-- their own team, in addition to the existing author-self-edit and
-- category-scoped director/hod paths. `posts.team_id` is an integer FK
-- (NOT a `team_uuid` - checked live against information_schema.columns
-- before writing this), so this reuses the existing integer-based
-- is_team_lead(team_id) RPC rather than a new uuid variant.
drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts
for update
using (
  (author_id = get_current_member_id() and status in ('pending_review','rejected'))
  or is_director_for_category(category)
  or (team_id is not null and is_team_lead(team_id))
)
with check (
  (author_id = get_current_member_id() and status in ('pending_review','rejected'))
  or is_director_for_category(category)
  or (team_id is not null and is_team_lead(team_id))
);

-- members: the BEFORE UPDATE trigger that guards privileged columns
-- (role/status/is_active/approved_by/approved_at) now distinguishes two
-- cases within "privileged status change":
--   1. Deciding a brand-new sign-up (old.status = 'pending_approval') stays
--      super_admin/HR only - a first-time applicant isn't on any team yet,
--      so there is nothing for a team-scoped lead to be scoped BY.
--   2. Any other status/is_active change (e.g. archiving an existing member
--      of your own team, putting them on a break) may now also be done by
--      that member's own team lead, not just a director/hod/super_admin.
-- `role` itself is UNCHANGED here - still super_admin-only in every case,
-- deliberately not opened to team leads (org-wide role assignment is a
-- bigger privilege-escalation surface than what was asked for).
create or replace function public.members_guard_privileged_cols()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
begin
  if auth.uid() is null then return new; end if;

  if new.role is distinct from old.role and not is_super_admin() then
    raise exception
      'Only an HR or super admin account can change a member''s role.'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status
  or new.is_active   is distinct from old.is_active
  or new.approved_by is distinct from old.approved_by
  or new.approved_at is distinct from old.approved_at then

    if old.status = 'pending_approval' and new.status is distinct from old.status then
      if not is_super_admin() then
        raise exception
          'Only an HR or super admin account can decide on a new sign-up.'
          using errcode = '42501';
      end if;
    else
      if not (is_director() or is_super_admin() or is_team_lead_of_member(new.member_id)) then
        raise exception
          'Only a director, HoD, HR, super admin, or that member''s team lead can change a member''s status.'
          using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$$;
