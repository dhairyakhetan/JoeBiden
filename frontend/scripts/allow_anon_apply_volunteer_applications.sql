-- ──────────────────────────────────────────────────────────────────────────
-- AquaTerra community: allow public inserts into volunteer_applications
-- ──────────────────────────────────────────────────────────────────────────
-- Applied to the main AquaTerra Supabase project (hzowuwffjqtgszecngpe)
-- on 2026-05-19 via the supabase MCP. This file is the source-of-truth
-- copy committed to git.
--
-- Symptom this fixes:
--   The public /recruitment "Join AquaTerra" form was silently failing
--   every submission. The table had RLS enabled but only
--   `directors_can_view` (SELECT) and `directors_can_update_review_status`
--   (UPDATE) policies — no INSERT policy at all, so anonymous submissions
--   from the form were being rejected with "new row violates row-level
--   security policy". Users testing the form thought the phone-number
--   field was triggering a uniqueness error and kept retrying with
--   different numbers.
--
-- After this migration:
--   - anon + authenticated roles can INSERT new applications
--   - SELECT + UPDATE remain restricted to director / hod / super_admin
--   - WITH CHECK (true) is intentional — we want every attempted
--     submission to land in the table so the admin queue can triage /
--     spam-filter. If we later want light hardening (rate-limits,
--     honeypot field), it goes in this WITH CHECK clause.
-- ──────────────────────────────────────────────────────────────────────────

CREATE POLICY "anyone_can_apply"
  ON public.volunteer_applications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Verify
SELECT polname,
       CASE polcmd
         WHEN 'r' THEN 'SELECT'
         WHEN 'a' THEN 'INSERT'
         WHEN 'w' THEN 'UPDATE'
         WHEN 'd' THEN 'DELETE'
         WHEN '*' THEN 'ALL'
       END AS cmd,
       polroles::regrole[]::text AS roles
FROM pg_policy
WHERE polrelid = 'public.volunteer_applications'::regclass
ORDER BY cmd;
