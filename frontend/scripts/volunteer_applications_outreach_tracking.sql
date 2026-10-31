-- ──────────────────────────────────────────────────────────────────────────
-- Volunteer applications — HoD outreach tracking columns
--
-- Run in the COMMUNITY Supabase project (hzowuwffjqtgszecngpe), NOT paradox.
-- Already applied in prod via the Supabase migration
-- `volunteer_applications_add_texted_added_tracking`; this file is the
-- reproducible record. Idempotent (IF NOT EXISTS) → safe to re-run.
--
-- Adds, for the director/HoD volunteer-applications dashboard:
--   texted     → has someone reached out to this applicant?
--   texted_by  → free-text name of who texted them
--   added      → confirmed added (to the group/team)?
--
-- No new RLS needed: the existing `directors_can_update_review_status` UPDATE
-- policy is row-level, so it already authorises these columns for
-- director / hod / super_admin members.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.volunteer_applications
  ADD COLUMN IF NOT EXISTS texted     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS texted_by  text,
  ADD COLUMN IF NOT EXISTS added      boolean NOT NULL DEFAULT false;

-- Refresh PostgREST's schema cache so the new columns are immediately visible
-- to the client (this table has historically had the cache drop new columns).
NOTIFY pgrst, 'reload schema';

-- Verify
SELECT column_name, data_type, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'volunteer_applications'
   AND column_name IN ('texted', 'texted_by', 'added')
 ORDER BY column_name;
