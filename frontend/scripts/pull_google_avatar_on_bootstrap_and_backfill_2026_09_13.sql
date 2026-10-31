-- APPLIED LIVE 2026-09-13 via Supabase MCP (migration name:
-- pull_google_avatar_on_bootstrap_and_backfill)
--
-- Owner: "in general, will the members' google acc pic be pulled directly as
-- their website's profile pic? ... we wanna pull google acc and then give
-- them an option to upload and use that with higher preference as well."
--
-- Verified live before this change: 1387 members, only 19 had avatar_url set
-- (the ones who manually uploaded via EditProfilePage) - ensure_member()
-- never read Google's picture at all. Every real Google-OAuth row's
-- raw_user_meta_data carries both `avatar_url` and `picture` (Google sets
-- both keys to the same URL) - confirmed against three live rows.
--
-- 1) ensure_member() now seeds avatar_url from Google metadata on first
--    bootstrap, same coalesce pattern already used for full_name. This runs
--    exactly once per member (guarded by the function's existing "already
--    exists" early return), so it can never later overwrite a manual
--    upload - "upload takes higher preference" falls out of that for free:
--    profileService.uploadAvatar() unconditionally sets avatar_url, and
--    nothing after signup ever touches the column again except that call.
--
-- 2) One-time backfill for members that already existed with avatar_url
--    still null, filled from their own auth.users row (joined on auth_uid).
--    Members who already had an uploaded avatar_url are untouched by the
--    `where avatar_url is null` clause - this can only fill a gap, never
--    replace a real upload. Result live: 19 -> 115 members with an
--    avatar_url. The remaining ~1270 have no matching auth.users row (bulk
--    HR-imported roster members who have never signed in with Google) or no
--    picture in their metadata - nothing more to backfill for those until
--    they log in for the first time, which now runs the fixed function above.
--
-- Verified live via:
--   select count(*), count(*) filter (where avatar_url is not null) from members;

create or replace function public.ensure_member()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_meta  jsonb;
begin
  if v_uid is null then
    return;
  end if;
  if exists (select 1 from public.members where auth_uid = v_uid) then
    return;
  end if;
  select email, raw_user_meta_data into v_email, v_meta
  from auth.users where id = v_uid;
  insert into public.members (auth_uid, email, full_name, avatar_url, status, role, created_at)
  values (
    v_uid,
    v_email,
    coalesce(
      nullif(trim(v_meta->>'full_name'), ''),
      nullif(trim(v_meta->>'name'), ''),
      nullif(split_part(coalesce(v_email,''), '@', 1), ''),
      'Member'
    ),
    nullif(trim(coalesce(v_meta->>'avatar_url', v_meta->>'picture')), ''),
    'pending_approval',
    'member',
    now()
  )
  on conflict (auth_uid) do nothing;
end;
$$;

update public.members m
set avatar_url = nullif(trim(coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture')), '')
from auth.users u
where u.id = m.auth_uid
  and m.avatar_url is null
  and coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture') is not null;
