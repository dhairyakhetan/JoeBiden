-- ──────────────────────────────────────────────────────────────────────────
-- Paradox: add `called_by` column to paradox_registrations
-- ──────────────────────────────────────────────────────────────────────────
-- Run once on the Paradox Supabase project (drvucogrjphctwfealxd) via
-- the SQL editor.
--
-- Mirrors the existing `wa_texted_by` column: a free-text attribution
-- string where NULL = not done, any string = done by that named admin.
-- Drives a new "Called" checkbox + note input on each registration row
-- in /paradox/admin → Registrations so admins can record who phone-called
-- this registrant for payment follow-up.
--
-- Semantics (same single-column-dual-duty pattern as wa_texted_by):
--   called_by IS NULL    → not yet called (checkbox unchecked)
--   called_by = '<name>' → called by <name>  (checkbox checked)
--
-- One column does double duty — truthiness drives the badge and the
-- value records attribution. No separate boolean needed.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.paradox_registrations
  ADD COLUMN IF NOT EXISTS called_by TEXT;

COMMENT ON COLUMN public.paradox_registrations.called_by IS
  'Name of the admin who phone-called the registrant. NULL = not yet called. Drives the "Called" checkbox in /paradox/admin → Registrations.';

-- Verify
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'paradox_registrations'
    AND column_name = 'called_by';
