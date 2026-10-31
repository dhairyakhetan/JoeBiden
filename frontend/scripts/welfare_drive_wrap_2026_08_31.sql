-- ============================================================================
-- ✅ APPLIED live 2026-08-31
-- Depends on welfare_check_in_2026_08_31.sql already being applied first
-- (this adds a sibling RPC, no new tables).
--
-- Step 2 of handoff/16-welfare-record.md's build order: the drive-wrap
-- screen ("/drive/:id/wrap" — attendance summary, typed outcome numbers,
-- then post to the feed... replaces the current guess-and-verify loop,
-- because a HoD reviewing the post can now see the roster behind it").
--
-- WHY A NEW RPC, NOT A PLAIN CLIENT UPDATE: every welfare_projects row's
-- mirrored post (mirror_welfare_project_to_post()) is authored by the
-- 'official@ngoaquaterra.com' system account, not by whoever leads the
-- drive. posts' own UPDATE RLS ("Authors can update pending posts" / "
-- Directors can update posts") means a plain team lead — the exact person
-- this screen is for — has NO way to update that post's stats directly.
-- Same shape as complete_drive_attendance(): a narrow SECURITY DEFINER
-- exception, authorized by "are you this drive's assigned lead, or a
-- director/super admin", not by post authorship.
-- ============================================================================

create or replace function public.update_drive_post_stats(p_welfare_project_id integer, p_stats jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_id integer;
  v_is_lead   boolean;
  v_post_uuid uuid;
begin
  select member_id into v_member_id from public.members where auth_uid = auth.uid();
  if v_member_id is null then
    raise exception 'not authenticated';
  end if;

  select (wp.drive_lead_member_id = v_member_id), wp.linked_post_id
    into v_is_lead, v_post_uuid
  from public.welfare_projects wp
  where wp.id = p_welfare_project_id;

  if not found then
    raise exception 'drive not found';
  end if;

  if not (coalesce(v_is_lead, false) or public.is_director() or public.is_super_admin()) then
    raise exception 'only this drive''s assigned lead, a director, or a super admin can update its outcome numbers';
  end if;

  if v_post_uuid is null then
    raise exception 'this drive has no linked post yet — publish it first';
  end if;

  update public.posts
     set stats = p_stats
   where uuid = v_post_uuid;
end;
$$;

comment on function public.update_drive_post_stats(integer, jsonb) is
  'SECURITY DEFINER. Lets a drive''s assigned lead (or director/super_admin) overwrite the linked post''s stats with real, attendance-backed outcome numbers, bypassing posts'' own author-or-director UPDATE RLS — the mirrored post is authored by the official@ngoaquaterra.com system account, not the lead. p_stats matches the existing posts.stats shape: a jsonb array of {value, label}, max 2 (see feedService.createPost).';

revoke all on function public.update_drive_post_stats(integer, jsonb) from public, anon;
grant execute on function public.update_drive_post_stats(integer, jsonb) to authenticated;

-- ============================================================================
-- VERIFICATION — run after applying. Every line should report OK.
-- ============================================================================
-- Expect: SECURITY DEFINER, authenticated-only
--   select prosecdef from pg_proc where proname = 'update_drive_post_stats';
--   select grantee, privilege_type from information_schema.routine_privileges
--    where routine_name = 'update_drive_post_stats';
-- ============================================================================
