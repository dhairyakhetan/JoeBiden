-- ============================================================================
-- ✅ APPLIED live 2026-09-10 (via the Supabase MCP connector).
--
-- Verified after applying: members.last_birthday_notice_year exists (integer,
-- nullable); create_birthday_notice() is SECURITY DEFINER with EXECUTE granted
-- to `authenticated` only (revoked from public/anon).
--
-- Until this was applied, services/profileService.ts:483 had been calling a
-- function that did not exist on EVERY own-profile visit, returning PGRST202,
-- which ProfilePage.tsx:216 swallowed into console.error - so the feature was
-- silently dead and nothing surfaced it. Fourth instance of this project's
-- documented "code shipped, migration never ran" failure mode.
--
-- NOTE, measured at apply time: 9 of 1,379 members have a birthday on file and
-- ZERO have birthday_public = true (the column defaults to false). The RPC no
-- longer errors, but the notice board stays dormant until members opt in -
-- that is the opt-in working as designed, not a remaining fault.
--
-- Public birthday notice-board post (handoff/21-member-surfaces.md §2.3):
-- "The public half is a notice-board post. Wishes are `comments` on that
-- post — reuse the table, do not invent a wishes table. Reactions use the
-- existing likes." No new tables for comments/likes - they already work on
-- any posts row. This migration adds only what's missing: a safe way to
-- CREATE that posts row.
--
-- WHY A NEW RPC, NOT A PLAIN CLIENT INSERT (product decision, confirmed with
-- the user 2026-08-31): feedService.createPost() sets status='published' only
-- for director/hod/super_admin; every other member's post starts
-- 'pending_review'. If the birthday member's own client inserted a plain
-- post, it would sit invisible in a moderation queue until a director
-- manually approved it - defeating "everyone sees it that day" - or, if the
-- client instead inserted status='published' directly (RLS technically
-- allows it - the INSERT policy only checks author_id/active status, not
-- status itself), that would be the first plain-member auto-publish path in
-- the codebase, undermining the invariant asserted elsewhere (see
-- HomePublicMoments.tsx's comment: "'Verified' means a leader already
-- reviewed it before it went live"). A SECURITY DEFINER RPC keeps that
-- invariant intact for every OTHER post while whitelisting exactly this one
-- narrow, templated, system-composed case - the member never supplies body
-- text, so there's nothing free-form to moderate.
--
-- Idempotency: members.last_birthday_notice_year stops a second post from
-- being created if the member revisits later the same day, or if the client
-- effect double-fires (StrictMode, a slow network retry, etc.). Compared
-- against IST (the org's timezone), not UTC, since "today" for a Kolkata
-- birthday must mean the Kolkata calendar date.
--
-- Category: reuses the existing 'content' category rather than adding a 6th
-- value to posts_category_check - a birthday notice isn't an operational
-- department, and widening that CHECK constraint ripples into
-- lib/categories.ts's department-anchor mapping, every category filter chip,
-- and director_categories' moderation scoping, which is a bigger, separate
-- decision than this migration's scope.
-- ============================================================================

alter table public.members
  add column if not exists last_birthday_notice_year integer;

comment on column public.members.last_birthday_notice_year is
  'IST calendar year the birthday notice-board post was last auto-created for this member. Null = never. Prevents create_birthday_notice() from double-posting on a repeat visit the same day.';

create or replace function public.create_birthday_notice()
returns table(post_uuid uuid, created boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_id       integer;
  v_full_name       text;
  v_birthday        date;
  v_birthday_public boolean;
  v_last_year       integer;
  v_today           date;
  v_this_year       integer;
  v_post_uuid       uuid;
begin
  select member_id, full_name, birthday, birthday_public, last_birthday_notice_year
    into v_member_id, v_full_name, v_birthday, v_birthday_public, v_last_year
  from public.members
  where auth_uid = auth.uid();

  if v_member_id is null or v_birthday is null then
    return; -- not signed in, or no birthday on file
  end if;

  if not coalesce(v_birthday_public, false) then
    return; -- opted out of the PUBLIC notice (private card is unaffected - separate code path)
  end if;

  v_today := (now() at time zone 'Asia/Kolkata')::date;
  v_this_year := extract(year from v_today)::integer;

  if extract(month from v_birthday) <> extract(month from v_today)
     or extract(day from v_birthday) <> extract(day from v_today) then
    return; -- not actually their birthday today (IST)
  end if;

  if v_last_year is not distinct from v_this_year then
    return; -- already posted this year - idempotent no-op, not an error
  end if;

  insert into public.posts (author_id, category, body, status)
  values (
    v_member_id,
    'content',
    '🎂 It''s ' || v_full_name || '''s birthday today! Wish them a happy one below.',
    'published'
  )
  returning uuid into v_post_uuid;

  update public.members
     set last_birthday_notice_year = v_this_year
   where member_id = v_member_id;

  post_uuid := v_post_uuid;
  created := true;
  return next;
end;
$$;

comment on function public.create_birthday_notice() is
  'SECURITY DEFINER. Resolves the CALLING member''s own row (auth.uid(), never a parameter). If it is genuinely their birthday today (IST), birthday_public=true, and no notice was already created this year, inserts one auto-published posts row (category=content) and stamps last_birthday_notice_year. Idempotent no-op otherwise - safe to call on every visit. The only status=''published'' path for a non-leader member anywhere in the schema; deliberately narrow (system-composed body, no client-supplied text) - see migration header for why this needed a decision rather than a plain client insert.';

revoke all on function public.create_birthday_notice() from public, anon;
grant execute on function public.create_birthday_notice() to authenticated;

-- ============================================================================
-- VERIFICATION — run after applying. Every line should report OK.
-- ============================================================================
-- Expect: column exists, nullable, integer
--   select column_name, data_type, is_nullable from information_schema.columns
--    where table_name='members' and column_name='last_birthday_notice_year';
--
-- Expect: SECURITY DEFINER, executable by authenticated only
--   select prosecdef from pg_proc where proname = 'create_birthday_notice';
--   select grantee, privilege_type from information_schema.routine_privileges
--    where routine_name = 'create_birthday_notice';
-- ============================================================================
