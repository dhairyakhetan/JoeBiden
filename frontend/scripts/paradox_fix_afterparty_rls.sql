-- ──────────────────────────────────────────────────────────────────────────
-- HOTFIX — run this if you're seeing
--   "new row violates row-level security policy for table
--    paradox_afterparty_registrations"
--
-- The first migration created the table but Supabase enabled RLS by
-- default with no policies, so every INSERT bounced. This file is
-- the targeted policy-only fix — paste the whole thing into the
-- Paradox project's SQL editor and run it.
--
-- Idempotent: DROP POLICY IF EXISTS pairs with CREATE POLICY, so
-- running it twice converges to the same state.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.paradox_afterparty_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read afterparty"   ON public.paradox_afterparty_registrations;
DROP POLICY IF EXISTS "Admins write afterparty"  ON public.paradox_afterparty_registrations;
DROP POLICY IF EXISTS "Admins update afterparty" ON public.paradox_afterparty_registrations;
DROP POLICY IF EXISTS "Admins delete afterparty" ON public.paradox_afterparty_registrations;

CREATE POLICY "Admins read afterparty"
  ON public.paradox_afterparty_registrations FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins write afterparty"
  ON public.paradox_afterparty_registrations FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Admins update afterparty"
  ON public.paradox_afterparty_registrations FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins delete afterparty"
  ON public.paradox_afterparty_registrations FOR DELETE
  TO authenticated USING (true);

-- Verify — should return 4 rows: read/write/update/delete, all on
-- the `authenticated` role.
SELECT
  polname AS policy,
  CASE polcmd
    WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END AS cmd,
  polroles::regrole[]::text[] AS roles
FROM pg_policy
WHERE polrelid = 'public.paradox_afterparty_registrations'::regclass
ORDER BY cmd;
