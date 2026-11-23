-- Account-deletion job (handoff C-28; owner chose "build it, dry run first", 4 Nov 2026).
--
-- STATUS: APPLIED 4 Nov 2026. Dry run reviewed, run for real once on the one eligible account (member 1435), and SCHEDULED daily at
-- 03:17 UTC as pg_cron job 'wipe-deleted-members' (job id 5). Verified after: 0 targets left, the row kept with the name, email, phone,
-- google_id and auth_uid cleared, 1 audit row, member counts unchanged (1,564 rows, 1,424 active). Unschedule: select cron.unschedule('wipe-deleted-members');
--
-- Settings promises that a deleted account's profile and private data are wiped within 30 days. Until now nothing did that:
-- soft_delete_member() only sets status 'deleted' and deleted_at.
--
-- public.wipe_deleted_members(p_dry_run boolean default true, p_days int default 30)
--   Targets: members with status 'deleted' and deleted_at older than p_days, not already wiped.
--   Dry run (the default) changes nothing and returns one row per target: member_id, days since deletion, and which kinds of
--   personal data are still held (true/false only, never the values).
--   A real run (p_dry_run = false) overwrites on the member row: email -> deleted-<id>@removed.invalid, full_name -> 'Former member',
--   and sets phone, guardian_phone, instagram, linkedin, bio, avatar_url, birthday, join_reason, rejection_note, google_id and
--   auth_uid to NULL (the sign-in link is cut). It keeps member_id, uuid, role, status 'deleted', created_at and deleted_at so
--   posts and team records keep working, with the name gone. One community_audit_logs row per wipe (ids only).
--   It does NOT touch the sign-in identity in Supabase Auth (auth.users keeps the Google email); removing that needs the Auth
--   admin API or dashboard and is reported by the dry run as auth_user_linked.
-- Only the database owner and service role can run it (no grant to anon or authenticated). Not scheduled: to schedule once the dry run
-- has been reviewed, run: select cron.schedule('wipe-deleted-members', '17 3 * * *', $$select public.wipe_deleted_members(false, 30)$$);
-- Rollback: drop function public.wipe_deleted_members(boolean, int).  A wipe itself cannot be undone; that is its purpose.

create or replace function public.wipe_deleted_members(p_dry_run boolean default true, p_days int default 30)
returns table(member_id int, days_since_deleted int, had_email boolean, had_phone boolean, had_guardian_phone boolean,
              had_social boolean, had_bio_or_photo boolean, auth_user_linked boolean, wiped boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_days < 30 then
    raise exception 'refusing to wipe sooner than 30 days after deletion';
  end if;
  return query
    select m.member_id, (current_date - m.deleted_at::date)::int,
           m.email !~ '^deleted-[0-9]+@removed\.invalid$',
           coalesce(btrim(m.phone), '') <> '', coalesce(btrim(m.guardian_phone), '') <> '',
           coalesce(btrim(m.instagram), '') <> '' or coalesce(btrim(m.linkedin), '') <> '',
           coalesce(btrim(m.bio), '') <> '' or coalesce(btrim(m.avatar_url), '') <> '',
           m.auth_uid is not null, not p_dry_run
      from public.members m
     where m.status = 'deleted' and m.deleted_at is not null
       and m.deleted_at < now() - make_interval(days => p_days)
       and (m.email !~ '^deleted-[0-9]+@removed\.invalid$' or m.phone is not null or m.guardian_phone is not null
            or m.instagram is not null or m.linkedin is not null or m.bio is not null or m.avatar_url is not null
            or m.birthday is not null or m.join_reason is not null or m.google_id is not null or m.auth_uid is not null)
     order by m.member_id;
  if not p_dry_run then
    with w as (
      update public.members m
         set email = 'deleted-' || m.member_id || '@removed.invalid', full_name = 'Former member',
             phone = null, guardian_phone = null, instagram = null, linkedin = null, bio = null, avatar_url = null,
             birthday = null, join_reason = null, rejection_note = null, google_id = null, auth_uid = null
       where m.status = 'deleted' and m.deleted_at is not null and m.deleted_at < now() - make_interval(days => p_days)
         and (m.email !~ '^deleted-[0-9]+@removed\.invalid$' or m.phone is not null or m.guardian_phone is not null
              or m.instagram is not null or m.linkedin is not null or m.bio is not null or m.avatar_url is not null
              or m.birthday is not null or m.join_reason is not null or m.google_id is not null or m.auth_uid is not null)
      returning m.member_id)
    insert into public.community_audit_logs (member_id, action, entity_type, entity_id)
      select null, 'member_data_wiped', 'member', w.member_id from w;
  end if;
end $$;
revoke all on function public.wipe_deleted_members(boolean, int) from public, anon, authenticated;
