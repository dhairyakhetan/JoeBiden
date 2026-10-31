-- Creates the `project-images` storage bucket used by ProjectManagerShared.tsx
-- (director/ProjectManagerShared.tsx BUCKET constant) for welfare project hero
-- images. Uploads were failing with "Bucket not found" because this bucket had
-- never been created in the live Supabase project.
--
-- Policies allow anon read/write (not just authenticated) because the CMS
-- client (lib/supabase.ts) is configured with persistSession: false and never
-- logs in -- every write goes out as the anon key. This mirrors the
-- documented, intentional trade-off already in place for welfare_projects
-- (see welfare_projects_allow_admin_write_2026_07.sql): the "only directors
-- can reach this" guarantee is enforced by app routing (ProtectedRoute /
-- hasLeaderAccess), not by the database, for this bucket.
--
-- Applied live 2026-08-06.

INSERT INTO storage.buckets (id, name, public)
VALUES ('project-images', 'project-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read project-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-images');

CREATE POLICY "Anon write project-images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'project-images');

CREATE POLICY "Anon update project-images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'project-images');

CREATE POLICY "Anon delete project-images"
ON storage.objects FOR DELETE
USING (bucket_id = 'project-images');
