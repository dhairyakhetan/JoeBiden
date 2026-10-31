-- ──────────────────────────────────────────────────────────────────────────
-- job_applications — add a phone number column
-- APPLIED 2026-07-13 via Supabase MCP against community-platform-aq
-- (hzowuwffjqtgszecngpe). Kept here as the checked-in record.
--
-- A phone number is now required on every job application (not just email),
-- so directors reviewing applicants have a fast way to reach out beyond
-- email. Nullable at the DB level — the requirement is enforced in the
-- Apply form itself (same pattern as every other "required" field in this
-- app, which trusts the client and only guards destructive/security-
-- sensitive paths at the DB level).
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS applicant_phone TEXT;
