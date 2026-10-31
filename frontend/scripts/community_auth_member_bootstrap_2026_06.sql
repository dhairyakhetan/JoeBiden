-- ──────────────────────────────────────────────────────────────────────────
-- Community DB auth/member bootstrap fix (hzowuwffjqtgszecngpe) — 2026-06.
-- APPLIED LIVE via Supabase migrations:
--   • fix_member_bootstrap_fullname_notnull
--   • add_ensure_member_self_heal_rpc  (superseded by the fix migration above)
-- This file is the versioned record.
--
-- ROOT CAUSE (Google login "does nothing / bounces to recruitment|home"):
--   1) public.members.full_name is NOT NULL with no default, but the
--      on_auth_user_created → handle_new_user() trigger INSERTed without
--      full_name. Its AFTER INSERT error rolled back the whole signup, so a
--      brand-new Google sign-up failed with "Database error saving new user".
--   2) The trigger only fires at first-ever auth.users INSERT. An existing auth
--      user whose members row was later removed (the table is curated to ~27
--      active) — e.g. calcuttatraders393@gmail.com — could authenticate but had
--      no members row. The app derives isAuthenticated from the members row, so
--      that valid session was treated as logged-OUT and stranded on /_login.
--   3) members has NO INSERT RLS policy, so the client cannot self-create a row.
--
-- FIX: populate full_name from Google identity metadata in BOTH bootstrap paths,
-- and add a SECURITY DEFINER self-heal RPC the client calls when a session has
-- no members row (creates only the caller's own pending row, despite the missing
-- INSERT policy). A one-time backfill created rows for any existing orphan auth
-- users (1 row: Vishal Agarwal → pending_approval).
-- ──────────────────────────────────────────────────────────────────────────

-- 1) Signup trigger — never leave full_name null (was crashing new Google signups).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.members (auth_uid, email, full_name, status, role, created_at)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'name'), ''),
      nullif(split_part(coalesce(new.email,''), '@', 1), ''),
      'Member'
    ),
    'pending_approval',
    'member',
    now()
  )
  on conflict (auth_uid) do nothing;
  return new;
end;
$$;

-- 2) Self-heal RPC — bootstrap a pending row for a valid session that has none.
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
  insert into public.members (auth_uid, email, full_name, status, role, created_at)
  values (
    v_uid,
    v_email,
    coalesce(
      nullif(trim(v_meta->>'full_name'), ''),
      nullif(trim(v_meta->>'name'), ''),
      nullif(split_part(coalesce(v_email,''), '@', 1), ''),
      'Member'
    ),
    'pending_approval',
    'member',
    now()
  )
  on conflict (auth_uid) do nothing;
end;
$$;

revoke all on function public.ensure_member() from public, anon;
grant execute on function public.ensure_member() to authenticated;

-- 3) One-time backfill for any existing orphan auth users.
insert into public.members (auth_uid, email, full_name, status, role, created_at)
select u.id, u.email,
  coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'),''),
           nullif(trim(u.raw_user_meta_data->>'name'),''),
           nullif(split_part(coalesce(u.email,''),'@',1),''),
           'Member'),
  'pending_approval', 'member', now()
from auth.users u
where not exists (select 1 from public.members m where m.auth_uid = u.id);
