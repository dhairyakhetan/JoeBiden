-- ──────────────────────────────────────────────────────────────────────────
-- Paradox: add `wa_texted_by` column to paradox_registrations
-- ──────────────────────────────────────────────────────────────────────────
-- Run once on the Paradox Supabase project (drvucogrjphctwfealxd) via
-- the SQL editor.
--
-- Adds a free-text column that records who from the admin team texted
-- this registrant on WhatsApp with payment details.
--
-- Semantics:
--   wa_texted_by IS NULL    → not yet texted (checkbox unchecked)
--   wa_texted_by = '<name>' → texted by <name> (checkbox checked)
--
-- One column does double duty: the truthiness drives the "texted" badge
-- and the value records attribution. No separate boolean needed.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.paradox_registrations
  ADD COLUMN IF NOT EXISTS wa_texted_by TEXT;

COMMENT ON COLUMN public.paradox_registrations.wa_texted_by IS
  'Name of the admin who texted the registrant on WhatsApp with payment details. NULL = not yet texted. Drives the "Texted on WA" checkbox in /paradox/admin → Registrations.';

-- Verify
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'paradox_registrations'
    AND column_name = 'wa_texted_by';
