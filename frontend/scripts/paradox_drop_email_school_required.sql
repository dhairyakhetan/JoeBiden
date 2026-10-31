-- ──────────────────────────────────────────────────────────────────────────
-- Paradox: drop NOT NULL on paradox_registrations.email + .school
-- ──────────────────────────────────────────────────────────────────────────
-- Run this once against the Paradox Supabase project
-- (drvucogrjphctwfealxd) via the SQL editor.
--
-- Why:
-- The registration form no longer asks for email or school — those
-- columns existed only as bookkeeping for admins and were creating
-- friction at the point of conversion. The columns stay (so historical
-- data and the admin CSV/search keep working) but they now accept NULL.
--
-- Frontend ships null for both fields on every new insert
-- (see src/paradox/pages/Register.tsx). Admin search + CSV export are
-- null-safe so existing rows with values still render correctly.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.paradox_registrations
  ALTER COLUMN email DROP NOT NULL;

-- school may already be nullable on some installs — IF NOT NULL guard
-- keeps this script idempotent.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'paradox_registrations'
      AND column_name = 'school'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.paradox_registrations
      ALTER COLUMN school DROP NOT NULL;
  END IF;
END $$;

-- Verify
SELECT column_name, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'paradox_registrations'
    AND column_name IN ('email', 'school');
