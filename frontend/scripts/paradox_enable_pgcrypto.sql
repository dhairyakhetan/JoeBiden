-- ──────────────────────────────────────────────────────────────────────────
-- Paradox: enable pgcrypto so `create_auth_user` (and any other RPC that
-- hashes passwords) can call `gen_salt('bf')`.
-- ──────────────────────────────────────────────────────────────────────────
-- Symptom this fixes:
--   "function gen_salt(unknown) does not exist" when clicking
--   "Create admin account" on /paradox/admin → Accounts tab.
--
-- Cause:
--   The `create_auth_user` RPC was authored to call `gen_salt('bf')` for
--   bcrypt password hashing, but `pgcrypto` (which provides gen_salt) was
--   never enabled on this Paradox Supabase project. The function compiles
--   fine but fails at call time with the unknown-function error.
--
-- Idempotent: IF NOT EXISTS guard means running this twice is a no-op.
-- Installs into the `public` schema so unqualified `gen_salt(...)` calls
-- inside SECURITY DEFINER functions resolve without needing to tweak
-- search_path.
-- ──────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Verify
SELECT
  extname AS extension,
  extversion AS version,
  nspname AS schema
FROM pg_extension
JOIN pg_namespace ON pg_namespace.oid = pg_extension.extnamespace
WHERE extname = 'pgcrypto';

-- Smoke-test gen_salt is callable
SELECT gen_salt('bf') IS NOT NULL AS gen_salt_works;
