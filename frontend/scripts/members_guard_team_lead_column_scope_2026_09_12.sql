-- APPLIED LIVE 2026-09-12 via Supabase MCP (migration name: members_guard_team_lead_column_scope)
--
-- Bug fix, found by code review of the same day's members_update_allow_team_lead
-- migration: widening the `members_update` RLS policy's row-level check to
-- include `is_team_lead_of_member(member_id)` has no column granularity of
-- its own - it let a team lead's UPDATE reach a teammate's row AT ALL, for
-- ANY column, not just the status/break fields the change was meant to
-- cover. A team lead could call
--   supabase.from('members').update({ phone: '...', bio: '...' }).eq('member_id', <teammate>)
-- directly and it would pass RLS, silently overwriting a teammate's phone,
-- bio, full_name, class_grade, etc. - well beyond "status/archive
-- management", the scope actually asked for.
--
-- Fix: `members_guard_privileged_cols()` (the existing BEFORE UPDATE
-- trigger) gets one more check, additive to the role/status guards already
-- there. An actor who reaches this row ONLY via is_team_lead_of_member()
-- (not is_director()/is_super_admin(), and not updating their own row) may
-- only change columns in an explicit allowlist (status, is_active,
-- approved_by, approved_at, break_start/end/reason, contacted_at,
-- updated_at) - `to_jsonb(x) - text[]` drops those keys before comparing
-- OLD and NEW, so anything else that differs raises. This also means a
-- FUTURE column added to `members` is automatically protected from a team
-- lead's write without anyone needing to update this list.
--
-- Verified live via a functional read-back:
--   select pg_get_functiondef(oid) from pg_proc where proname='members_guard_privileged_cols';
create or replace function public.members_guard_privileged_cols()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null then return new; end if;          -- service role / direct SQL

  -- `role` is a super-admin-only column - even directors/HoDs/team leads may not change it.
  if new.role is distinct from old.role and not is_super_admin() then
    raise exception
      'Only an HR or super admin account can change a member''s role.'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status
  or new.is_active   is distinct from old.is_active
  or new.approved_by is distinct from old.approved_by
  or new.approved_at is distinct from old.approved_at then

    -- Approving/rejecting a brand-new sign-up (leaving pending_approval) is
    -- HR/super_admin only now - a new applicant isn't on any team yet, so
    -- there is nothing to scope a team lead's access by.
    if old.status = 'pending_approval' and new.status is distinct from old.status then
      if not is_super_admin() then
        raise exception
          'Only an HR or super admin account can decide on a new sign-up.'
          using errcode = '42501';
      end if;
    else
      -- Managing an EXISTING member's status (archive/restore/suspend) -
      -- org-wide director/hod/super_admin/hr keep this unchanged, and a
      -- team lead can now do it for members on their own team.
      if not (is_director() or is_super_admin() or is_team_lead_of_member(new.member_id)) then
        raise exception
          'Only a director, HoD, HR, super admin, or that member''s team lead can change a member''s status.'
          using errcode = '42501';
      end if;
    end if;
  end if;

  if auth.uid() != old.auth_uid
     and not is_director()
     and not is_super_admin()
     and is_team_lead_of_member(new.member_id)
  then
    if (to_jsonb(new) - array['status','is_active','approved_by','approved_at',
                              'break_start','break_end','break_reason',
                              'contacted_at','updated_at'])
       is distinct from
       (to_jsonb(old) - array['status','is_active','approved_by','approved_at',
                              'break_start','break_end','break_reason',
                              'contacted_at','updated_at'])
    then
      raise exception
        'A team lead may only change a teammate''s status, break, or contacted fields.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$function$;
