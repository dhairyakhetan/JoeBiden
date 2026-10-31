-- ──────────────────────────────────────────────────────────────────────────
-- Allow custom phase keys on paradox_afterparty_registrations.
--
-- The original migration locked `phase` to a hardcoded set:
--   CHECK (phase IN ('early_bird','phase_1','phase_2','phase_3'))
--
-- Once the admin UI started letting directors add new phases (phase_4,
-- phase_5, special_promo, etc.) any insert with a fresh key would fail
-- the check. Drop the CHECK in favour of a soft format constraint —
-- still prevents trash like empty strings or whitespace-only values,
-- but accepts any reasonable phase key.
--
-- Idempotent: DROP CONSTRAINT IF EXISTS is safe to re-run.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.paradox_afterparty_registrations
  DROP CONSTRAINT IF EXISTS paradox_afterparty_registrations_phase_check;

ALTER TABLE public.paradox_afterparty_registrations
  ADD CONSTRAINT paradox_afterparty_registrations_phase_format
  CHECK (phase ~ '^[a-z0-9_]+$' AND char_length(phase) BETWEEN 1 AND 64);

-- Verify — should list one row with both columns present
SELECT conname, pg_get_constraintdef(oid) AS def
  FROM pg_constraint
 WHERE conrelid = 'public.paradox_afterparty_registrations'::regclass
   AND conname LIKE '%phase%';
