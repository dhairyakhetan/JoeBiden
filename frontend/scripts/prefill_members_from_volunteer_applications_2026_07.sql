-- ============================================================================
-- prefill_members_from_volunteer_applications_2026_07.sql
--
-- Bulk version of prefill_active_members_2026_07.sql — pre-creates a
-- members row (status='active', auth_uid=NULL) for everyone in the old
-- recruitment form's volunteer_applications table, so their first Google
-- sign-in claims the row and skips pending_approval, same mechanism as the
-- two one-off emails done earlier.
--
-- Run in the COMMUNITY project's SQL editor (hzowuwffjqtgszecngpe) — that is
-- where BOTH volunteer_applications and members actually live (confirmed via
-- VolunteerApplications.tsx importing `supabaseCommunity`). A same-named
-- volunteer_applications table also exists in the separate CMS project but
-- is NOT what the app reads — do not run this against that one.
--
-- SCOPE: every row, no vol_label filtering — only duplicates are ignored:
--   - an applicant who submitted the form more than once (dedupes by email,
--     keeping their most recent submission's name)
--   - anyone whose email already has a members row (existing members, or
--     already handled by the earlier two-email script)
--
-- Safe to re-run: ON CONFLICT (email) DO NOTHING.
-- ============================================================================

WITH latest_per_email AS (
  SELECT DISTINCT ON (lower(email))
    lower(trim(email)) AS email,
    full_name
  FROM public.volunteer_applications
  WHERE email IS NOT NULL AND trim(email) <> ''
  ORDER BY lower(email), created_at DESC
)
INSERT INTO public.members (email, full_name, status, role, created_at)
SELECT
  v.email,
  COALESCE(NULLIF(trim(v.full_name), ''), split_part(v.email, '@', 1)),
  'active',
  'member',
  now()
FROM latest_per_email v
WHERE NOT EXISTS (
  SELECT 1 FROM public.members m WHERE lower(m.email) = v.email
)
ON CONFLICT (email) DO NOTHING;

-- Sanity check after running — should show 0 once applied:
-- SELECT count(*) FROM public.volunteer_applications va
-- WHERE NOT EXISTS (SELECT 1 FROM public.members m WHERE lower(m.email) = lower(va.email));
