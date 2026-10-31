-- APPLIED LIVE 2026-09-14 via Supabase MCP (migration name:
-- member_appeal_after_removal)
--
-- Owner request: an "appeal" button on the removed-account page
-- (auth/RejectedPage.tsx) that a member can use themselves to re-apply,
-- without needing a super admin to notice and restore them - plus a red
-- flag on the HoD's pending queue so a reviewer can see "this one was
-- removed before", not just a plain new application.
--
-- New column starts with ZERO privileges (CLAUDE.md's own hard-won lesson),
-- so it needs an explicit grant. pending_member_approvals is a VIEW with an
-- explicit column list, not `select *`, so it has to be recreated to expose
-- the new column - also switched to `security_invoker = true` in the same
-- pass (it was SECURITY DEFINER with no reason to be; get_advisors'
-- security_definer_view finding for it cleared after this).
alter table public.members
  add column if not exists previously_removed boolean not null default false;

grant select on public.members to authenticated;
comment on column public.members.previously_removed is
  'True once this member has ever been soft-deleted (or appealed back in) - shown as a flag on the HoD pending queue. Never cleared automatically once set.';

drop view if exists public.pending_member_approvals;
create view public.pending_member_approvals
  with (security_invoker = true)
  as
  select member_id, uuid, email, full_name, avatar_url, class_grade, phone,
         join_reason, bio, created_at, contacted_at, previously_removed
  from public.members
  where status = 'pending_approval' and is_active = true and (is_director() or is_super_admin());

grant select on public.pending_member_approvals to authenticated;

-- soft_delete_member now also stamps previously_removed = true at delete
-- time (not just on appeal), so the flag is set even before anyone appeals.
create or replace function public.soft_delete_member(p_member_id integer)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_actor_id integer;
begin
  if not is_super_admin() then
    raise exception 'Only HR/super_admin can delete a member';
  end if;
  v_actor_id := get_current_member_id();
  if v_actor_id = p_member_id then
    raise exception 'You cannot delete your own account this way';
  end if;

  update public.members
  set status = 'deleted', deleted_at = now(), deleted_by = v_actor_id, previously_removed = true
  where member_id = p_member_id;

  insert into public.community_audit_logs (member_id, action, entity_type, entity_id)
  values (v_actor_id, 'member_soft_deleted', 'member', p_member_id);
end;
$function$;

-- Self-service appeal: the member's OWN session, not an admin's. Only moves
-- a row that is currently deleted/suspended/rejected, and only ever INTO
-- pending_approval - never into active (that still requires a director's
-- review, same as any other application). Deliberately no params: it
-- always acts on auth.uid()'s own row, so there is no id to pass that
-- could target someone else's account.
create or replace function public.appeal_removed_account()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_member_id integer;
  v_status text;
begin
  select member_id, status into v_member_id, v_status
  from public.members where auth_uid = auth.uid();

  if v_member_id is null then
    raise exception 'no account to appeal';
  end if;
  if v_status not in ('deleted', 'suspended', 'rejected') then
    raise exception 'this account is not in a removed state';
  end if;

  update public.members
  set status = 'pending_approval', deleted_at = null, deleted_by = null, previously_removed = true
  where member_id = v_member_id;

  insert into public.community_audit_logs (member_id, action, entity_type, entity_id)
  values (v_member_id, 'member_appealed', 'member', v_member_id);
end;
$function$;

grant execute on function public.appeal_removed_account() to authenticated;

-- Verified live: authenticated has SELECT on members.previously_removed;
-- pending_member_approvals returns the new column; get_advisors (security)
-- no longer lists pending_member_approvals as a SECURITY DEFINER view.

-- ─────────────────────────────────────────────────────────────────────────
-- APPLIED LIVE 2026-09-14 via Supabase MCP (migration name:
-- appeal_removed_account_bypass_status_guard)
--
-- Bug found live the same day, first real use of the appeal button: pressing
-- "appeal" toasted "Only a director, HoD, HR, super admin, or that member's
-- team lead can change a member's status." SECURITY DEFINER changes which
-- ROLE runs the UPDATE, not what auth.uid() resolves to (that comes from the
-- request JWT, unchanged) - so members_guard_privileged_cols (BEFORE UPDATE
-- trigger on members) correctly saw "the applicant themself, not a
-- director" and raised 42501, exactly as it should for anyone editing their
-- own row through any other path. It just didn't know this one self-service
-- path is legitimate.
--
-- Fix is a transaction-local GUC flag ('aq.appeal_self_service'), set only
-- inside appeal_removed_account() right before its own UPDATE -
-- set_config(..., true) is local to the transaction and clears
-- automatically on commit, never leaking to another statement or session.
-- The trigger only honours it when auth.uid() matches the row's OWN
-- auth_uid AND the transition is exactly removed-state -> pending_approval,
-- so even if this GUC were ever set elsewhere it could not touch anyone
-- else's row or move a row anywhere but pending_approval - the same
-- restriction the RPC itself already enforces, this is defense in depth,
-- not the only guard.
create or replace function public.members_guard_privileged_cols()
returns trigger
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
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
    -- Self-service appeal (appeal_removed_account()): the removed member's
    -- own row, own session, and only ever a removed-state -> pending_approval
    -- move - never into active, never targeting anyone else's row.
    elsif current_setting('aq.appeal_self_service', true) = 'true'
       and auth.uid() = old.auth_uid
       and old.status in ('deleted', 'suspended', 'rejected')
       and new.status = 'pending_approval'
    then
      null; -- allowed
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

  -- 2026-09-12 fix: `members_update`'s RLS policy widened to let a team lead
  -- write ANY column on a teammate's row (adding is_team_lead_of_member() to
  -- the row-level check has no column granularity of its own) - the intent
  -- was only status/archive management and breaks, but a team lead who is
  -- not also a director/self could otherwise silently overwrite a
  -- teammate's phone, bio, full_name, etc. This closes that gap: an actor
  -- who reaches this row ONLY via is_team_lead_of_member() (not
  -- is_director()/is_super_admin(), and not their own row) may not change
  -- anything outside this explicit allowlist. `to_jsonb(x) - text[]` drops
  -- the listed keys before comparing, so a FUTURE column added to members
  -- is automatically protected too - nothing to remember to update here.
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

create or replace function public.appeal_removed_account()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_member_id integer;
  v_status text;
begin
  select member_id, status into v_member_id, v_status
  from public.members where auth_uid = auth.uid();

  if v_member_id is null then
    raise exception 'no account to appeal';
  end if;
  if v_status not in ('deleted', 'suspended', 'rejected') then
    raise exception 'this account is not in a removed state';
  end if;

  perform set_config('aq.appeal_self_service', 'true', true);

  update public.members
  set status = 'pending_approval', deleted_at = null, deleted_by = null, previously_removed = true
  where member_id = v_member_id;

  insert into public.community_audit_logs (member_id, action, entity_type, entity_id)
  values (v_member_id, 'member_appealed', 'member', v_member_id);
end;
$function$;

grant execute on function public.appeal_removed_account() to authenticated;

-- Verified live: simulated an authenticated session for the deleted test
-- account inside a rolled-back transaction (set_config('request.jwt.claims',
-- ...) + set local role authenticated) and confirmed
-- appeal_removed_account() now succeeds end to end (status ->
-- pending_approval, previously_removed -> true) instead of raising 42501.
-- get_advisors (security) re-checked after this fix: no new/regressed
-- findings.
