-- ============================================================================
-- STATUS: APPLIED 2026-07-24 via Supabase MCP (project hzowuwffjqtgszecngpe).
-- Migration name: welfare_projects_hide_drafts_from_public_2026_07
--
-- WHY: the welfare_projects SELECT policy "public read welfare_projects" was
-- USING(true) for the public role, so an anonymous REST call could fetch
-- unpublished DRAFT projects (is_draft = true) directly —
--   GET /rest/v1/welfare_projects?is_draft=eq.true
-- exposing embargoed collaborators, google_drive_link and imagery — even though
-- every public/team/search read filters .eq('is_draft', false) client-side
-- (proving drafts are meant to be private). Unlike posts (whose SELECT policy
-- gates status='published'), welfare_projects had no server-side gate.
--
-- FIX: gate drafts server-side. Public/anon see only non-drafts; directors and
-- super-admins (authenticated is_director()/is_super_admin()) still see all,
-- so the HoD desk's draft editing is unaffected.
--
-- Verified post-apply: total 552 rows (11 drafts, 541 published, 0 null) →
-- `set local role anon; select count(*)` returns 541 (drafts hidden).
--
-- NOTE: supersedes the USING(true) intent described in
-- welfare_projects_allow_admin_write_2026_07.sql. The "anon-only CMS client"
-- model in CLAUDE.md is stale — lib/supabase.ts is now an authenticated alias
-- of supabaseCommunity, so is_director() resolves for director sessions.
-- ============================================================================

drop policy if exists "public read welfare_projects" on public.welfare_projects;
create policy "public read welfare_projects" on public.welfare_projects
  for select to public
  using (is_draft is not true or public.is_director() or public.is_super_admin());
