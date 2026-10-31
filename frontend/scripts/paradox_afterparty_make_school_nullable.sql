-- ──────────────────────────────────────────────────────────────────────────
-- Belt-and-braces: ensure `school` is nullable on
-- paradox_afterparty_registrations.
-- ──────────────────────────────────────────────────────────────────────────
-- The original migration declared `school TEXT` (no NOT NULL), so this
-- is usually a no-op. Included here in case an earlier draft of the
-- migration was applied somewhere and the column drifted to NOT NULL.
--
-- Idempotent: DROP NOT NULL is a no-op if the column is already nullable.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.paradox_afterparty_registrations
  ALTER COLUMN school DROP NOT NULL;

-- Verify — should show is_nullable = 'YES'
SELECT column_name, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'paradox_afterparty_registrations'
   AND column_name = 'school';
