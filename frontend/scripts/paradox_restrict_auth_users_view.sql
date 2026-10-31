-- ──────────────────────────────────────────────────────────────────────────
-- Paradox: restrict paradox_auth_users_view to authenticated callers only
-- ──────────────────────────────────────────────────────────────────────────
-- Run this once on the Paradox Supabase project (drvucogrjphctwfealxd)
-- via the SQL editor.
--
-- Why:
-- The view (id, email, last_sign_in_at, created_at) is consumed by the
-- admin Accounts tab to list user records. Supabase flags it as
-- "UNRESTRICTED" — meaning the publishable anon key can query it. That
-- exposes every authenticated user's email + sign-in timestamps to anyone
-- who knows the project URL + anon key. Not a leak of password hashes,
-- but enough to enumerate admin emails for targeted phishing.
--
-- Fix: revoke SELECT from `anon` so the view is only readable by signed-
-- in callers (i.e. anyone logged into Paradox auth). The admin still
-- gates further by checking `paradox_admin_permissions.is_active` for
-- the actual /paradox/admin tabs — this is defense in depth.
--
-- Belt-and-braces: flip the view to `security_invoker` so it honours
-- whatever RLS exists on the underlying auth.users (Postgres ≥ 15 only).
-- ──────────────────────────────────────────────────────────────────────────

-- 1. Lock down the role grants
REVOKE ALL ON public.paradox_auth_users_view FROM anon;
REVOKE ALL ON public.paradox_auth_users_view FROM public;
GRANT  SELECT ON public.paradox_auth_users_view TO authenticated;

-- 2. Re-declare as security_invoker (Postgres 15+). Wrapped in DO so the
-- script doesn't fail on older PG versions — Supabase is on 15+ but the
-- guard keeps the migration safe in dev mirrors.
DO $$
BEGIN
  EXECUTE 'ALTER VIEW public.paradox_auth_users_view SET (security_invoker = true)';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'security_invoker not supported on this Postgres — view-level role grants alone enforce the restriction';
END $$;

-- 3. Verify the new grants — should show only `authenticated` with SELECT
SELECT grantee, privilege_type
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = 'paradox_auth_users_view'
  ORDER BY grantee;
