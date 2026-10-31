-- ============================================================================
-- AquaTerra — security + correctness fixes, 2026-08-10
--
-- STATUS: ✅ **APPLIED 2026-08-10** to project hzowuwffjqtgszecngpe, as eight
--         separate named migrations (one per section), and verified — every check
--         in the VERIFICATION block at the bottom of this file passes.
--         Kept as the readable record of the change. Idempotent and safe to
--         re-run, but there is no need to.
--
--         Applied migration names:
--           job_applications_insert_ownership
--           team_lead_helper_respects_active_membership
--           fix_category_scoping_and_drop_broken_approval_overload
--           create_notification_fix_lead_check_and_dedupe
--           welfare_project_unpublish_retracts_mirrored_post
--           posts_authors_can_revise_rejected
--           close_retired_intake_and_harden_storage_buckets
--           document_pii_view_gates
--
-- Everything here was found by running scenarios against the LIVE database and
-- reading the live policy/function definitions, not from these .sql files —
-- several checked-in migrations turned out never to have been applied.
--
-- ALREADY APPLIED SEPARATELY (do not redo): the members PII column lockdown
--   (migration `restore_members_pii_column_lockdown`). `authenticated` had
--   table-level SELECT on members, exposing 1314 emails + 37 phone numbers to
--   any signed-in account. Verified closed.
--
-- Contents
--   1. job_applications INSERT — bind the row to the caller (impersonation fix)
--   2. is_team_lead() helper — lead checks that honour is_active / left_at
--   3. is_assigned_to_category() — include the 'hod' role
--   4. approve_post_category — drop the BROKEN overload
--   5. create_notification — fix the lead check + stop like-notification floods
--   6. welfare_projects — un-publishing now retracts the mirrored post
--   7. posts — authors may revise a REJECTED post (auto re-queues)
--   8. legacy_volunteer_applications — revoke anon INSERT on a retired form
--   9. storage buckets — size caps + MIME allow-lists
--  10. COMMENTs documenting the two load-bearing view gates
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. job_applications INSERT: bind the application to the caller
--
-- WAS: WITH CHECK (auth.role() = 'authenticated')
-- Any signed-in user could insert a row with ANY applicant_id / name / email —
-- so an unapproved account could apply, and could apply AS SOMEBODY ELSE. The
-- only accidental guard was UNIQUE (opening_id, applicant_id).
-- Measured 2026-08-10: 0 of 5 live rows had a mismatched email, so the hole is
-- real but has not been exercised.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER POLICY job_applications_auth_insert ON public.job_applications
  WITH CHECK (applicant_id = public.get_current_member_id());


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. is_team_lead(): one helper, and it honours soft removal
--
-- Six policies hand-rolled the same EXISTS check against team_members, and every
-- one matched on role = 'lead' ALONE — ignoring is_active and left_at. A lead who
-- had been soft-removed kept full lead powers until their row was hard-deleted.
-- Centralised here, matching the codebase's own rule that role checks live in
-- helpers (is_director / is_super_admin) and are never inlined.
--
-- SECURITY DEFINER so a policy ON team_members does not re-enter team_members' RLS.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_team_lead(p_team_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.team_id    = p_team_id
      AND tm.member_id  = public.get_current_member_id()
      AND tm.role::text = 'lead'
      AND tm.is_active IS TRUE
      AND tm.left_at IS NULL
  );
$fn$;

COMMENT ON FUNCTION public.is_team_lead(integer) IS
  'True if the caller is an ACTIVE lead of the given team. Use this instead of inlining a team_members EXISTS check — it is the only version that honours is_active/left_at.';

GRANT EXECUTE ON FUNCTION public.is_team_lead(integer) TO anon, authenticated;

ALTER POLICY "Team leads and directors can update teams" ON public.teams
  USING (public.is_director() OR public.is_team_lead(team_id));

ALTER POLICY "Team leads and directors can insert team members" ON public.team_members
  WITH CHECK (public.is_director() OR public.is_team_lead(team_id));

ALTER POLICY "Team leads can update their team members" ON public.team_members
  USING (public.is_director() OR public.is_team_lead(team_id));

ALTER POLICY "Can delete team members" ON public.team_members
  USING (
    member_id = public.get_current_member_id()
    OR public.is_director()
    OR public.is_team_lead(team_id)
  );

ALTER POLICY "Team leads and directors can view join requests for their team" ON public.team_join_requests
  USING (public.is_director() OR public.is_team_lead(team_id));

ALTER POLICY "Team leads and directors can update requests" ON public.team_join_requests
  USING (public.is_director() OR public.is_team_lead(team_id));


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. is_assigned_to_category(): include 'hod'
--
-- is_director() accepts ('director','hod','super_admin'); this one accepted only
-- ('director','super_admin'). So an HoD passed every generic director gate but
-- could not insert a post_approvals row — contradicting the codebase's stated
-- rule that hod and director have identical website power.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_assigned_to_category(cat character varying)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.director_categories dc
    JOIN public.members m ON m.member_id = dc.member_id
    WHERE m.auth_uid = auth.uid()
      AND m.role IN ('director', 'hod', 'super_admin')
      AND m.status = 'active'
      AND (dc.category = cat OR m.role = 'super_admin')
  );
$fn$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. approve_post_category: drop the BROKEN overload
--
-- Two overloads existed with different return types:
--   (uuid, varchar) -> json   — the real implementation (post_categories +
--                               post_approvals, checks is_assigned_to_category)
--   (uuid, text)    -> jsonb  — BROKEN: references `posts.pending_categories`,
--                               a column that DOES NOT EXIST, so it raises
--                               'column "pending_categories" does not exist'
--                               at runtime.
--
-- PostgREST resolves by argument type, and the client sends a JS string — which
-- is very likely why post_approvals has 0 rows despite the feature being wired
-- end to end. Dropping the broken one also removes the resolution ambiguity.
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.approve_post_category(uuid, text);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. create_notification: fix the lead check, and stop the like-flood
--
-- (a) The 'lead' branch matched `members.uuid = auth.uid()`. members.uuid is NOT
--     auth.users.id — the correct column is auth_uid. As written the branch could
--     never grant, so team leads could not send post_approved/team_invite/
--     team_join_accepted. (Same uuid confusion exists in the dormant arcade
--     policies.)
-- (b) No dedup: unliking does not retract a notification, so unlike/relike
--     floods the author. Live evidence: 8 'like' notifications against 4 rows in
--     `likes`. Social notifications are now suppressed when an identical
--     (member, type, link) arrived within the last 24h.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_notification(
  p_member_id integer,
  p_type      text,
  p_title     text,
  p_subtitle  text DEFAULT NULL::text,
  p_full_note text DEFAULT NULL::text,
  p_link      text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
begin
  if auth.uid() is null then
    raise exception 'must be authenticated to create a notification';
  end if;

  if p_type = 'system' and not (public.is_director() or public.is_super_admin()) then
    raise exception 'not authorized to create a % notification', p_type;
  end if;

  -- Authority types stay leader-only so a member cannot plant a fake
  -- "your post was approved" alert. NOTE: matches on auth_uid (was: uuid).
  if p_type in ('post_approved','post_rejected','team_invite','team_join_accepted')
     and not (
       public.is_director()
       or public.is_super_admin()
       or exists (
         select 1 from public.members
         where auth_uid = auth.uid()
           and role::text = 'lead'
           and status::text = 'active'
       )
     ) then
    raise exception 'not authorized to create a % notification', p_type;
  end if;

  if p_link is not null and (p_link not like '/%' or p_link like '//%') then
    raise exception 'notification link must be an app-internal path';
  end if;

  -- Flood guard for repeatable social actions (like/unlike/relike, re-follow).
  -- Authority + system types are never suppressed: they carry real decisions.
  if p_type in ('like','follow','tag') and exists (
    select 1 from public.notifications n
    where n.member_id = p_member_id
      and n.type = p_type
      and coalesce(n.link, '') = coalesce(p_link, '')
      and n.created_at > now() - interval '24 hours'
  ) then
    return;
  end if;

  insert into public.notifications (member_id, type, title, subtitle, full_note, link)
  values (p_member_id, p_type, p_title, p_subtitle, p_full_note, p_link);
end;
$fn$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. welfare_projects: un-publishing retracts the mirrored post
--
-- mirror_welfare_project_to_post() only fires on draft -> live. Flipping
-- is_draft back to TRUE removed the project from /projects (RLS hides drafts)
-- but left its mirrored post PUBLISHED and its /post/:uuid permalink live — so a
-- super admin who un-published reasonably believed it was gone, and it was not.
-- Measured 2026-08-10: 0 projects currently in this state, so this is a latent
-- bug being closed before it fires.
--
-- Soft-deletes the post (deleted_at) rather than hard-deleting: post_feed_view
-- already filters deleted_at IS NULL, and re-publishing clears it again.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.retract_welfare_project_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
begin
  -- live -> draft: pull the mirrored post out of the feed
  if OLD.is_draft IS NOT TRUE AND NEW.is_draft IS TRUE AND NEW.linked_post_id IS NOT NULL then
    update public.posts
       set deleted_at = now(),
           updated_at = now()
     where uuid = NEW.linked_post_id
       and deleted_at is null;

  -- draft -> live again: restore the post we previously retracted
  elsif OLD.is_draft IS TRUE AND NEW.is_draft IS NOT TRUE AND NEW.linked_post_id IS NOT NULL then
    update public.posts
       set deleted_at = null,
           updated_at = now()
     where uuid = NEW.linked_post_id
       and deleted_at is not null;
  end if;

  return NEW;
end;
$fn$;

DROP TRIGGER IF EXISTS welfare_project_retract_mirror ON public.welfare_projects;
CREATE TRIGGER welfare_project_retract_mirror
  AFTER UPDATE OF is_draft ON public.welfare_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.retract_welfare_project_post();


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. posts: an author may revise a REJECTED post
--
-- WAS: USING (author_id = me AND status = 'pending_review')
-- With no WITH CHECK, Postgres uses USING for both, so a rejected post became
-- uneditable AND unresubmittable — the rejection_note explained what to fix on a
-- row the author was forbidden to touch. Their only option was delete-and-retype,
-- losing every image, document, tag and stat block.
--
-- external_achievements already solved exactly this (owner edit resets to
-- pending via trigger); this ports that pattern. Widening to 'rejected' cannot
-- let an author self-publish: the USING expression is also the check, so
-- status='published' is still rejected for a non-director.
--
-- Measured 2026-08-10: 0 posts are currently rejected, so this carries no
-- migration risk today.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER POLICY "Authors can update pending posts" ON public.posts
  USING (
    author_id = public.get_current_member_id()
    AND status::text IN ('pending_review', 'rejected')
  );

CREATE OR REPLACE FUNCTION public.requeue_post_on_author_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
begin
  -- Only the AUTHOR's own substantive revision re-queues. A director's edit of a
  -- rejected post keeps their decision intact.
  if NEW.author_id = public.get_current_member_id()
     AND NOT public.is_director()
     AND OLD.status::text = 'rejected'
     AND (
       OLD.body      IS DISTINCT FROM NEW.body
       OR OLD.category  IS DISTINCT FROM NEW.category
       OR OLD.link_url  IS DISTINCT FROM NEW.link_url
       OR OLD.stats     IS DISTINCT FROM NEW.stats
     )
  then
    NEW.status         := 'pending_review';
    NEW.rejection_note := NULL;
    NEW.reviewed_by    := NULL;
    NEW.reviewed_at    := NULL;
  end if;
  return NEW;
end;
$fn$;

DROP TRIGGER IF EXISTS trg_requeue_post_on_author_revision ON public.posts;
CREATE TRIGGER trg_requeue_post_on_author_revision
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.requeue_post_on_author_revision();


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. legacy_volunteer_applications: close the retired form's write endpoint
--
-- The form is retired and no code in frontend/src references this table, but its
-- anon INSERT policy (WITH CHECK true) is still open — an unauthenticated write
-- endpoint with no captcha or rate limit, on a table nobody reads.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon insert" ON public.legacy_volunteer_applications;


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Storage buckets: size caps + MIME allow-lists
--
-- The four content buckets were public with NO size cap and NO MIME allow-list:
-- any authenticated user could upload a 200MB file, or an .svg (script-capable,
-- served from a public URL), or an .html. The Paradox photobooth buckets are
-- already configured correctly — this brings the rest in line with them.
--
-- image/svg+xml is DELIBERATELY EXCLUDED from the image buckets.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE storage.buckets
   SET file_size_limit = 10485760,  -- 10 MB
       allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/avif','image/gif']
 WHERE id IN ('post-images', 'project-images');

UPDATE storage.buckets
   SET file_size_limit = 2097152,   -- 2 MB — avatars render at 40–96px
       allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/avif']
 WHERE id = 'avatars';

UPDATE storage.buckets
   SET file_size_limit = 15728640,  -- 15 MB (unchanged)
       allowed_mime_types = ARRAY[
         'application/pdf',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'application/vnd.ms-powerpoint'
       ]
 WHERE id = 'post-documents';


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Document the two load-bearing view gates
--
-- member_directory_view and pending_member_approvals are security_invoker=false,
-- so they run with the OWNER's privileges and RLS on members does NOT apply to
-- them. They are safe ONLY because the director check is baked into their own
-- WHERE clause. Remove that predicate in a refactor and both become
-- unauthenticated dumps of every member's email, phone, join_reason and bio,
-- with no policy anywhere to catch it.
-- ─────────────────────────────────────────────────────────────────────────────
COMMENT ON VIEW public.member_directory_view IS
  'security_invoker=false: runs as OWNER, so members RLS does NOT apply. The "WHERE is_director() OR is_super_admin()" in this view body is the ONLY access control. Never remove it. Also the sanctioned path for leaders to read members.email (the column grant is revoked).';

COMMENT ON VIEW public.pending_member_approvals IS
  'security_invoker=false: runs as OWNER, so members RLS does NOT apply. The "AND (is_director() OR is_super_admin())" in this view body is the ONLY access control — and this view exposes phone + join_reason. Never remove it.';


-- ============================================================================
-- VERIFICATION — run after applying. Every line should report OK.
-- ============================================================================
-- Expect: applicant_id = get_current_member_id()
--   select with_check from pg_policies
--    where tablename='job_applications' and policyname='job_applications_auth_insert';
--
-- Expect: exactly ONE approve_post_category
--   select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--    where n.nspname='public' and p.proname='approve_post_category';
--
-- Expect: 'hod' present
--   select prosrc like '%hod%' from pg_proc where proname='is_assigned_to_category';
--
-- Expect: 6 policies referencing is_team_lead
--   select count(*) from pg_policies
--    where schemaname='public' and (qual like '%is_team_lead%' or with_check like '%is_team_lead%');
--
-- Expect: all four buckets have a limit + mime list
--   select id, file_size_limit, allowed_mime_types from storage.buckets
--    where id in ('post-images','avatars','project-images','post-documents');
--
-- Expect: no rows (retired anon write endpoint closed)
--   select policyname from pg_policies
--    where tablename='legacy_volunteer_applications' and cmd='INSERT';
-- ============================================================================
