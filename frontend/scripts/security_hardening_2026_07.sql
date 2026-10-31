-- ──────────────────────────────────────────────────────────────────────────
-- Community DB security hardening — 2026-07  (project hzowuwffjqtgszecngpe)
--
-- ✅ PARTIALLY LIVE — live verification on 2026-07-31 found that equivalents of
--     Section A, H4, M1 and M2 ARE already applied to the running database:
--     welfare_projects / job_openings / submission-table writes are
--     director-gated, and post_feed_view is security_invoker. Cross-check the
--     live schema before re-running any individual statement here.
--     Originally authored from a live-verified security audit (findings
--     cross-checked against the running database, not just the checked-in SQL).
--     This file is split into:
--       SECTION A — safe to apply standalone (no frontend change needed).
--       SECTION B — BLOCKED on a coordinated frontend change; do NOT apply the
--                   Section B SQL until its prerequisite ships, or you will
--                   break a working desk flow.
--
--     Still OUTSTANDING / UNCONFIRMED as of 2026-07-31: rotation of the leaked
--     service_role key (committed in git history at migrate.js / commit f44bd57
--     — it bypasses all RLS and does not expire until ~2036). SQL cannot fix
--     that; it is a Supabase Dashboard action + git-history purge.
-- ──────────────────────────────────────────────────────────────────────────


-- ════════════════════════════════════════════════════════════════════════
-- SECTION A — safe to apply standalone
-- ════════════════════════════════════════════════════════════════════════

-- ── H2 (HIGH) — Director/HoD can self-promote to super_admin ───────────────
-- The current members_guard_privileged_cols trigger (community_security_
-- hardening_2026_06.sql:20-40) returns NEW unchanged for ANY caller where
-- is_director() OR is_super_admin() is true. is_director() is true for
-- role IN ('director','hod','super_admin'), so a hod/director — whom the app
-- blocks from the role-management desk (requireSuperAdmin) — passes the trigger
-- and can PATCH their own row's role to 'super_admin' via a direct PostgREST
-- call. Fix: gate the `role` column on is_super_admin() specifically, while
-- leaving the status/approval columns under is_director() (the AccountApprovals
-- flow, which is legitimately requireDirector). Safe: role changes only ever
-- happen via DirectorManagement (requireSuperAdmin), so super_admins keep the
-- ability and directors lose one they should never have had.
create or replace function public.members_guard_privileged_cols()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then return new; end if;          -- service role / direct SQL
  -- `role` is a super-admin-only column — even directors/HoDs may not change it.
  if not is_super_admin() then
    new.role := old.role;
  end if;
  -- status / approval columns: directors may change them (the approvals flow).
  if not (is_director() or is_super_admin()) then
    new.status      := old.status;
    new.is_active   := old.is_active;
    new.approved_by := old.approved_by;
    new.approved_at := old.approved_at;
  end if;
  return new;
end;
$$;
-- (trigger itself is unchanged; the function body is what we replaced.)


-- ── H5 / M3 (HIGH) — post_feed_view reverted to SECURITY DEFINER ───────────
-- Migration 020 set security_invoker=on; three later CREATE OR REPLACE VIEW
-- migrations rebuilt the view without re-specifying it (Postgres does not carry
-- the option across a replace), so it is live as a DEFINER view owned by
-- `postgres`. anon can then GET /rest/v1/post_feed_view?status=eq.pending_review
-- (or =eq.rejected) and read un-moderated post bodies, bypassing posts RLS.
-- Idempotent, isolated, safe.
alter view public.post_feed_view set (security_invoker = on);
-- Going forward: append this SET to the tail of EVERY `create or replace view
-- public.post_feed_view` migration — the option does not survive a replace.


-- ── M1 (MEDIUM) — job_openings blanket "authenticated" write policies ──────
-- Permissive policies OR together, so blanket auth.role()='authenticated'
-- INSERT/UPDATE/DELETE policies subsume the intended is_director() gate — any
-- signed-in member can edit/delete any opening via PostgREST.
-- IMPORTANT ORDER: add a director INSERT policy BEFORE dropping the blanket
-- INSERT, or legitimate opening creation breaks (only director UPDATE/DELETE
-- policies exist today — see job_openings_allow_director_delete_2026_07.sql —
-- there is no director INSERT policy yet).
drop policy if exists "job_openings_director_insert" on public.job_openings;
create policy "job_openings_director_insert" on public.job_openings
  for insert
  with check (public.is_director() or public.is_super_admin());

drop policy if exists "job_openings_auth_insert" on public.job_openings;
drop policy if exists "job_openings_auth_update" on public.job_openings;
drop policy if exists "job_openings_auth_delete" on public.job_openings;


-- ── M2 (MEDIUM) — contact / collaboration / legacy-volunteer submissions ───
-- Third-party PII (names/emails/phones/messages from the public) is SELECTable
-- by ANY authenticated member via `USING (true)`. The sibling submission tables
-- (volunteer_applications, job_applications) correctly restrict SELECT to
-- directors; these three were missed. Public INSERT is intended and untouched;
-- only the read side is tightened. Only consumer is FormResponses (requireDirector).
drop policy if exists "allow_auth_select" on public.contact_submissions;
create policy "contact_submissions_director_select" on public.contact_submissions
  for select using (public.is_director());

drop policy if exists "auth select" on public.collaboration_submissions;
create policy "collaboration_submissions_director_select" on public.collaboration_submissions
  for select using (public.is_director());

drop policy if exists "auth select" on public.legacy_volunteer_applications;
create policy "legacy_volunteer_applications_director_select" on public.legacy_volunteer_applications
  for select using (public.is_director());


-- ════════════════════════════════════════════════════════════════════════
-- SECTION B — BLOCKED on a coordinated frontend change. Do NOT apply the SQL
--             below until the named prerequisite ships, or a working flow breaks.
-- ════════════════════════════════════════════════════════════════════════

-- ── H4 (HIGH) — welfare_projects is anon-writable / anon-deletable ─────────
-- Live policies welfare_projects_admin_update/_delete are USING (true) and anon
-- holds the table grants, so any unauthenticated person with the public anon key
-- can PATCH or DELETE every project row (verified: ~552 rows destroyable via one
-- REST call). The "only directors reach the page" note is app-routing only and
-- does nothing for a direct PostgREST call.
--
-- WHY THIS IS BLOCKED: the reason the policy is USING(true) is that ProjectManager
-- writes through frontend/src/lib/supabase.ts — the CMS client that NEVER signs
-- in (persistSession:false, always the anon key, no auth session). If you apply
-- the is_director() policies below WITHOUT first moving those writes onto the
-- authenticated supabaseCommunity client, the project editor's save/delete/
-- publish buttons will match zero rows and silently fail.
--
-- PREREQUISITE (frontend, ship first): route ProjectManager.tsx /
-- ProjectManagerShared.tsx / ProjectModal.tsx welfare_projects writes through
-- `supabaseCommunity` (authenticated) instead of `supabase` (CMS anon client),
-- mirroring how job_openings already works. THEN apply:
--
--   drop policy if exists "welfare_projects_admin_update" on public.welfare_projects;
--   create policy "welfare_projects_director_update" on public.welfare_projects
--     for update using (public.is_director() or public.is_super_admin())
--                 with check (public.is_director() or public.is_super_admin());
--
--   drop policy if exists "welfare_projects_admin_delete" on public.welfare_projects;
--   create policy "welfare_projects_director_delete" on public.welfare_projects
--     for delete using (public.is_director() or public.is_super_admin());
--
--   -- also revoke the now-unneeded anon write grants:
--   revoke insert, update, delete on public.welfare_projects from anon;
--
-- (Same class, same table family: `blogs` has an INSERT policy WITH CHECK(true)
--  reachable by anon — Finding M3/blogs. Gate blog authoring on is_director()
--  and revoke anon INSERT once blog writes also run through supabaseCommunity.)


-- ── H3 (HIGH) — anon can bulk-read all members' email + phone ──────────────
-- "Anyone can view active members" USING (status='active') + anon column SELECT
-- on members.* exposes email (1,294 rows) and phone (17) to a single
-- unauthenticated request. Flagged unfixed as H2 in the 2026-06 hardening notes.
--
-- WHY THIS IS BLOCKED: a blunt REVOKE breaks any anon select('*') on members
-- (e.g. PublicProfilePage, MembersPage, member_directory_view, searchService).
--
-- PREREQUISITE (frontend, ship first): switch every public-facing member read to
-- an explicit non-PII column list (full_name, uuid, role, avatar_url, bio, …) or
-- a public-safe view. THEN apply:
--
--   revoke select (email, phone) on public.members from anon;


-- ── M4 (MEDIUM) — notification forgery ────────────────────────────────────
-- notifications INSERT WITH CHECK only requires auth.role() IN
-- ('service_role','authenticated') and never constrains member_id to the caller,
-- so any authenticated user can push notifications to any/all members. (The
-- notifications_link_internal_only CHECK blocks external phishing URLs, so this
-- is in-app spam / social-engineering, not an open redirect.)
--
-- WHY THIS IS BLOCKED: notificationService.create() currently INSERTs directly.
--
-- PREREQUISITE (frontend, ship first): move creation behind a SECURITY DEFINER
-- RPC that validates (actor, recipient, type) and have notificationService.create
-- call it. THEN `revoke insert on public.notifications from anon, authenticated;`
-- Sketch of the RPC (adjust columns to the real schema before use):
--
--   create or replace function public.create_notification(
--     p_member_id bigint, p_type text, p_title text, p_subtitle text, p_link text)
--   returns void language plpgsql security definer set search_path = public, pg_temp as $$
--   begin
--     -- authz: only leaders may notify arbitrary members; adjust to taste.
--     if not (is_director() or is_super_admin()) then
--       raise exception 'not authorized to create notifications';
--     end if;
--     if p_link is not null and p_link not like '/%' then
--       raise exception 'notification link must be app-internal';
--     end if;
--     insert into public.notifications (member_id, type, title, subtitle, link)
--     values (p_member_id, p_type, p_title, p_subtitle, p_link);
--   end; $$;
