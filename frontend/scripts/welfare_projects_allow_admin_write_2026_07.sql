-- ──────────────────────────────────────────────────────────────────────────
-- Welfare projects — allow admin writes
-- SUPERSEDED: welfare_projects now lives in the community Supabase project
-- (hzowuwffjqtgszecngpe), migrated from the old standalone CMS project
-- (nurtpdbqfizmqtztmiwk). The UPDATE/DELETE policies below were carried over
-- during that migration, so this script no longer needs to be run — kept
-- here for historical context only.
--
-- Why this is needed: frontend/src/director/ProjectManager.tsx (the HoD
-- Desk's project editor) writes through frontend/src/lib/supabase.ts, a
-- client that never signs in — it always calls the REST API as the public
-- anon key, with no Supabase Auth session at all. That's fine for the public
-- reads this table already serves, but it means UPDATE/DELETE on this table
-- had no RLS policy actually permitting them: the edit/delete/publish-toggle
-- buttons silently matched zero rows and did nothing, while the old client
-- code showed a fake "Project updated" success toast regardless of project
-- age (a recent fix now surfaces this as a real error instead of hiding it,
-- which is how this gap became visible in the first place).
--
-- Tradeoff, spelled out: because this legacy client has no real login, the
-- only way to let the admin UI's writes through is to open write access at
-- the DB level to anyone holding the public anon key — the "only directors
-- can reach this page" gate is enforced by the app's routing/role check, not
-- by the database. This mirrors the trust model already used for
-- `job_openings` elsewhere in this app (see job_openings_migration.sql).
-- INSERT already works today (new projects save fine) — this only adds the
-- UPDATE/DELETE policies that were missing.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.welfare_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "welfare_projects_admin_update" ON public.welfare_projects;
CREATE POLICY "welfare_projects_admin_update" ON public.welfare_projects
  FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "welfare_projects_admin_delete" ON public.welfare_projects;
CREATE POLICY "welfare_projects_admin_delete" ON public.welfare_projects
  FOR DELETE USING (true);
