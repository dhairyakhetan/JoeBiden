-- ──────────────────────────────────────────────────────────────────────────
-- HoD desk audit fixes, database half (owner approved 2026-11-02).
--
-- STATUS: APPLIED 2026-11-02 via the Supabase connector (migration name
-- hod_desk_audit_fixes). Verified live with a rolled-back DO block that set the JWT
-- sub per sample user: a scoped HoD gets tagged-outside-scope=false and untagged=true;
-- an unscoped HoD, a category-only HoD and HR/super admin get true for both; a plain
-- member gets false for both. log_action: anon cannot execute, authenticated can.
-- certificate_requests_no_reopen trigger is present.
--
-- 1) log_action(): ANY signed-in account could call it with any action name and
--    write rows into the audit log (and anon held EXECUTE). The row is stamped
--    with the caller, so it cannot name someone else, but a throwaway signup
--    could still fill the Activity Log with noise that reads as real. Now: the
--    caller must be an ACTIVE, non-deleted member; the action must be lowercase
--    snake_case (every caller in the app already is); details are capped at 4 KB;
--    EXECUTE is revoked from public and anon. Existing callers (leaders, team
--    leads, org posts) are all active members, so none of them change.
--
-- 2) can_moderate_post(): posts_update used is_director_for_category(), which
--    reads director_categories. The queue the leader SEES is scoped by
--    director_scopes (teams) plus untagged posts, and categories are no longer
--    read by the app (lib/postScope.ts, "slice 4"; PRD: categories are retired
--    from moderation). So the two disagreed in both directions: a leader with a
--    leftover category row and no team scope saw the whole queue but could only
--    update posts in that category (their approve silently touched zero rows),
--    and a leader with a team scope but no category row could update anything.
--    The new rule mirrors the app exactly:
--      super admin / HR            any post
--      director / HoD, no scopes   any post (unscoped, as the app treats them)
--      director / HoD, scoped      posts tagged to a scope team or to a team
--                                  directly inside one, plus untagged posts
--    The author-own and team-lead clauses of posts_update are unchanged.
--    Live effect when applied: 19 HoDs with no scope rows keep full access; 1
--    HoD with only a category row now gets what their queue shows (everything);
--    10 leaders who hold team scopes are now limited to their teams' posts and
--    untagged ones at the DATABASE too, matching their queue.
--
-- 3) certificate_requests: a decided request (issued or declined) could be
--    flipped by a second HR user or a stale tab, and nothing recorded it. A
--    BEFORE UPDATE trigger now refuses any change of status once it has left
--    'pending'. Notes and the like on a decided row are still editable.
--
-- TO REVERSE: restore the previous posts_update policy text (it called
-- is_director_for_category(category) in USING and WITH CHECK), drop function
-- can_moderate_post(integer), drop trigger certificate_requests_no_reopen and
-- function certificate_requests_no_reopen(), and re-create log_action() from
-- log_action_and_hr_set_member_break_2026_09_12.sql.
-- ──────────────────────────────────────────────────────────────────────────

-- 1) log_action ---------------------------------------------------------------
create or replace function public.log_action(
  p_action      character varying,
  p_entity_type character varying default null,
  p_entity_id   integer default null,
  p_details     jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_id integer;
begin
  select m.member_id into v_member_id
    from public.members m
   where m.auth_uid = auth.uid()
     and m.status = 'active'
     and m.deleted_at is null;

  if v_member_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_action is null or p_action !~ '^[a-z][a-z0-9_]{2,63}$' then
    raise exception 'invalid audit action';
  end if;
  if p_details is not null and pg_column_size(p_details) > 4096 then
    raise exception 'audit details too large';
  end if;

  insert into public.community_audit_logs (member_id, action, entity_type, entity_id, details)
  values (v_member_id, p_action, p_entity_type, p_entity_id, p_details);
end;
$$;

revoke all on function public.log_action(character varying, character varying, integer, jsonb) from public, anon;
grant execute on function public.log_action(character varying, character varying, integer, jsonb) to authenticated;

-- 2) can_moderate_post ----------------------------------------------------------
create or replace function public.can_moderate_post(p_post_id integer)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.members m
     where m.auth_uid = auth.uid()
       and m.role in ('director', 'hod', 'super_admin', 'hr')
       and m.status = 'active'
       and (
            m.role in ('super_admin', 'hr')
         or not exists (select 1 from public.director_scopes ds where ds.member_id = m.member_id)
         or not exists (select 1 from public.post_teams pt where pt.post_id = p_post_id)
         or exists (
              select 1
                from public.post_teams pt
                join public.director_scopes ds on ds.member_id = m.member_id
                left join public.teams t on t.team_id = pt.team_id
               where pt.post_id = p_post_id
                 and (pt.team_id = ds.team_id or t.parent_team_id = ds.team_id)
            )
       )
  );
$$;

revoke all on function public.can_moderate_post(integer) from public, anon;
grant execute on function public.can_moderate_post(integer) to authenticated;

drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts
  for update
  using (
    ((author_id = get_current_member_id()) and ((status)::text = any (array['pending_review', 'rejected'])))
    or can_moderate_post(post_id)
    or ((team_id is not null) and is_team_lead(team_id) and ((status)::text = any (array['pending_review', 'rejected'])))
  )
  with check (
    ((author_id = get_current_member_id()) and ((status)::text = any (array['pending_review', 'rejected'])))
    or can_moderate_post(post_id)
    or ((team_id is not null) and is_team_lead(team_id))
  );

-- 3) certificates cannot be reopened -----------------------------------------
create or replace function public.certificate_requests_no_reopen()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status <> 'pending' and new.status is distinct from old.status then
    raise exception 'certificate_already_decided' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists certificate_requests_no_reopen on public.certificate_requests;
create trigger certificate_requests_no_reopen
  before update on public.certificate_requests
  for each row execute function public.certificate_requests_no_reopen();
