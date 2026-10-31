-- ============================================================================
-- members.joined_on - a correctable joining date
--
-- STATUS: **NOT YET APPLIED.** Written 2026-09-21. Run this in the Supabase SQL
-- editor. Do NOT merge frontend code that selects this column before this file
-- has run: the directory read would fail outright.
--
-- (It was not applied from the session that wrote it because the GRANT
-- statements were blocked by a permission gate, not because anything about it
-- is uncertain.)
--
-- WHY A NEW COLUMN AND NOT AN EDITABLE created_at
--
-- The profile's "JOINED JUNE 2026" is `members.created_at`, the row-insert
-- timestamp. That column is not just a display value: MemberDirectory sorts
-- newest/oldest on it, membershipDuration() derives tenure from it, and
-- receiptRecord.ts stamps it. Making it writable means an edit silently
-- reorders the directory and rewrites history, and there is no precedent in
-- this repo for granting UPDATE on it. So `joined_on` is a separate,
-- display-only correction.
--
-- NULL IS THE DEFAULT AND IT MEANS SOMETHING
--
-- Deliberately NOT backfilled. NULL means "no correction recorded" and every
-- read falls back to created_at, so the column only ever holds a date a human
-- actually asserted. Backfilling 1,327 rows with coalesce(approved_at,
-- created_at) would fill the column with a guess that then reads as a
-- verified fact.
--
-- WHO MAY SET IT: HR/super_admin only (is_super_admin() covers both).
--
-- This is a membership record, not a profile preference - a member editing
-- their own would be claiming seniority. The guard below is REQUIRED, not
-- belt-and-braces: members_update's RLS lets a member write their own row, so
-- the column grant alone would let anyone backdate their own joining date.
--
-- `date`, not timestamptz: the UI only ever formats month + year.
--
-- A NEW COLUMN HERE STARTS WITH ZERO PRIVILEGES. There is no table-level grant
-- on `members` to inherit (the PII lockdown removed it), so without the
-- explicit grants below the app could never read or write this column. That is
-- the "too narrow, loud failure" trap in CLAUDE.md - `team_nudge_seen_at`
-- shipped with only REFERENCES and was silently unwritable.
--
-- The grants are column-list form. A bare `grant select on public.members`
-- would hand out the whole table and void the PII lockdown.
-- ============================================================================

begin;

alter table public.members add column if not exists joined_on date;

comment on column public.members.joined_on is
  'The date the member actually joined AquaTerra, when it differs from created_at (the row-insert timestamp). NULL means no correction recorded and reads fall back to created_at. HR/super_admin only, enforced in members_guard_privileged_cols().';

grant select (joined_on) on public.members to authenticated;
grant select (joined_on) on public.members to anon;
grant update (joined_on) on public.members to authenticated;

commit;

-- == The guard ===============================================================
-- Adds ONE clause to the existing trigger function, mirroring the `role` rule.
-- Everything else is the function exactly as it stood live on 2026-09-21;
-- re-paste it whole so nothing is lost.
create or replace function public.members_guard_privileged_cols()
 returns trigger
 language plpgsql
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

  -- ADDED 2026-09-21. joined_on is a membership record, not a profile field.
  if new.joined_on is distinct from old.joined_on and not is_super_admin() then
    raise exception
      'Only an HR or super admin account can change a member''s joining date.'
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
    elsif current_setting('aq.appeal_self_service', true) = 'true'
       and auth.uid() = old.auth_uid
       and old.status in ('deleted', 'suspended', 'rejected')
       and new.status = 'pending_approval'
    then
      null; -- allowed
    else
      if not (is_director() or is_super_admin() or is_team_lead_of_member(new.member_id)) then
        raise exception
          'Only a director, HoD, HR, super admin, or that member''s team lead can change a member''s status.'
          using errcode = '42501';
      end if;
    end if;
  end if;

  -- Team-lead column allowlist. `to_jsonb(x) - text[]` drops the listed keys
  -- before comparing, so joined_on is automatically protected here too without
  -- being named - a new column is denied to a team lead by default.
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

-- == The directory view ======================================================
-- Surfaces joined_on so the desk can show and edit it. Re-paste whole: a
-- `create or replace view` resets reloptions AND the ACL, so security_barrier
-- and the grant must be repeated every time. (See memory
-- view-acl-inherits-default-grant.)
--
-- This body already includes the instagram gate applied earlier the same day
-- in members_instagram_hr_super_admin_only_2026_09_21.sql - do not run that
-- file after this one or you will drop joined_on back off the view.
create or replace view public.member_directory_view as
 SELECT m.member_id, m.uuid, m.email, m.full_name, m.avatar_url, m.class_grade,
        CASE WHEN is_super_admin() THEN m.phone ELSE NULL::character varying END::character varying(20) AS phone,
        CASE WHEN is_super_admin() THEN m.instagram ELSE NULL::text END AS instagram,
    m.linkedin, s.name AS school_name, m.role, m.status, m.is_active, m.created_at,
    m.joined_on,
        CASE m.role
            WHEN 'super_admin'::text THEN 0
            WHEN 'hr'::text THEN 0
            WHEN 'director'::text THEN 1
            WHEN 'hod'::text THEN 2
            WHEN 'lead'::text THEN 3
            ELSE 4
        END AS role_rank,
    m.break_end
   FROM members m
     LEFT JOIN schools s ON s.school_id = m.school_id
  WHERE is_director() OR is_super_admin();

alter view public.member_directory_view set (security_barrier = true);
revoke all on public.member_directory_view from public, anon, authenticated;
grant select on public.member_directory_view to authenticated;

-- == Verification ============================================================
-- Expect readable 32 / closed 9 (joined_on joins the readable set; instagram
-- stays closed):
-- select count(*) filter (where has_column_privilege('authenticated','public.members',column_name,'SELECT')) as readable,
--        count(*) filter (where not has_column_privilege('authenticated','public.members',column_name,'SELECT')) as closed
--   from information_schema.columns where table_schema='public' and table_name='members';
--
-- Expect true:
-- select has_column_privilege('authenticated','public.members','joined_on','UPDATE');
--
-- Expect NO leading `r` for authenticated (no table-level SELECT crept back):
-- select relacl::text from pg_class where oid='public.members'::regclass;
