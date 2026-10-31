-- Tightens the `project-images` bucket write policies added in
-- project_images_bucket_2026_08.sql. That migration used anon-permissive
-- write policies because the CMS client (`lib/supabase.ts`) was historically
-- documented as never authenticating. That documentation was stale: as of the
-- 2026-07 consolidation, `supabase` is `export const supabase = supabaseCommunity
-- as any` -- a real authenticated client. Director uploads through
-- ProjectManagerShared.tsx carry the director's own session, so anon write
-- access is broader than necessary.
--
-- Run this AFTER confirming (in the live dashboard or via a test upload from
-- a logged-in director account) that uploads still work with is_director()/
-- is_super_admin() gating -- do not apply blind. If `is_director()` /
-- `is_super_admin()` helper functions don't exist under those exact names in
-- the live DB, check welfare_projects' own UPDATE/DELETE policies for the
-- actual function names before running this.

DROP POLICY IF EXISTS "Anon write project-images" ON storage.objects;
DROP POLICY IF EXISTS "Anon update project-images" ON storage.objects;
DROP POLICY IF EXISTS "Anon delete project-images" ON storage.objects;

CREATE POLICY "Director write project-images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'project-images' AND (is_director() OR is_super_admin()));

CREATE POLICY "Director update project-images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'project-images' AND (is_director() OR is_super_admin()));

CREATE POLICY "Director delete project-images"
ON storage.objects FOR DELETE
USING (bucket_id = 'project-images' AND (is_director() OR is_super_admin()));

-- Public read policy from the original migration is unaffected and stays as-is.
