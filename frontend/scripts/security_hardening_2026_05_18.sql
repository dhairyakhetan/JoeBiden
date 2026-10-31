-- ──────────────────────────────────────────────────────────────────────────
-- Security hardening — applied to community project on 2026-05-18
-- ──────────────────────────────────────────────────────────────────────────
-- Source-of-truth copy of the 4 migrations applied via Supabase MCP after
-- the exhaustive Supabase audit on 2026-05-18. Each migration was applied
-- in its own apply_migration call (so the migrations table shows them
-- separately); they're combined here for git auditability.
--
-- What this fixes — from `get_advisors type=security`:
--   ERROR-level: 3 SECURITY DEFINER views
--   WARN-level:  8 anon-callable SECURITY DEFINER RPCs
--                9 functions with mutable search_path
--                2 public buckets with broad SELECT listing policy
-- ──────────────────────────────────────────────────────────────────────────


-- ═══ 1. Lock down SECURITY DEFINER RPCs ═══════════════════════════════════
-- Before: 7 SECURITY DEFINER functions exposed via /rest/v1/rpc/* to anon.
-- After:  only the roles that actually need each function retain EXECUTE.

REVOKE EXECUTE ON FUNCTION public.handle_new_user()                                 FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()                                 FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_post_category(uuid, varchar)              FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_post_category(uuid, text)                 FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_current_member_id()                           FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_assigned_to_category(varchar)                  FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_director()                                     FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_super_admin()                                  FROM anon, PUBLIC;

-- ─── CORRECTION (applied later on 2026-05-18) ─────────────────────
-- The four REVOKEs above broke the home page feed for logged-out
-- visitors with "permission denied for function get_current_member_id".
-- These functions are called by RLS policies on anon-readable tables
-- (posts, members, etc.) to decorate the predicate — even when the
-- caller is anon, the policy needs to call them to evaluate whether
-- to return a row. They're SECURITY DEFINER and return safe values
-- when auth.uid() IS NULL (NULL / false), so exposing EXECUTE to
-- anon doesn't leak member data.
-- Linter lint "anon_security_definer_function_executable" will
-- reappear on these — accepted, see commentary in
-- restore_anon_execute_on_rls_helpers migration.

GRANT EXECUTE ON FUNCTION public.get_current_member_id()                            TO anon;
GRANT EXECUTE ON FUNCTION public.is_assigned_to_category(varchar)                   TO anon;
GRANT EXECUTE ON FUNCTION public.is_director()                                      TO anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin()                                   TO anon;


-- ═══ 2. Flip 3 SECURITY DEFINER views to SECURITY INVOKER ═════════════════
-- Before: views ran with owner's RLS, bypassing the caller's policies.
-- After:  views enforce the caller's RLS as expected.

ALTER VIEW public.pending_post_reviews       SET (security_invoker = true);
ALTER VIEW public.pending_member_approvals   SET (security_invoker = true);
ALTER VIEW public.post_feed_view             SET (security_invoker = true);


-- ═══ 3. Tighten storage SELECT policies on public buckets ═════════════════
-- Before: "Public can view *" granted broad SELECT enabling `.list()`.
-- After:  SELECT scoped to owners (+ directors for post-images). Direct
--         URL reads via /storage/v1/object/public/* still work because
--         the bucket itself is public — no policy lookup happens there.

DROP POLICY IF EXISTS "Public can view avatars"      ON storage.objects;
DROP POLICY IF EXISTS "Public can view post images"  ON storage.objects;

CREATE POLICY "Owners can read own avatar"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars' AND auth.uid() = owner);

CREATE POLICY "Owners and directors can read post images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-images' AND (auth.uid() = owner OR public.is_director()));


-- ═══ 4. Pin search_path on 9 SECURITY DEFINER functions ═══════════════════
-- Before: callers could shadow pg_catalog functions via search_path tricks.
-- After:  each function locks search_path to public, pg_temp.

ALTER FUNCTION public.set_teams_updated_at()                       SET search_path = public, pg_temp;
ALTER FUNCTION public.set_job_openings_updated_at()                SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at_column()                   SET search_path = public, pg_temp;
ALTER FUNCTION public.get_current_member_id()                      SET search_path = public, pg_temp;
ALTER FUNCTION public.is_assigned_to_category(varchar)             SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user()                            SET search_path = public, pg_temp;
ALTER FUNCTION public.is_director()                                SET search_path = public, pg_temp;
ALTER FUNCTION public.is_super_admin()                             SET search_path = public, pg_temp;
ALTER FUNCTION public.approve_post_category(uuid, varchar)         SET search_path = public, pg_temp;
ALTER FUNCTION public.approve_post_category(uuid, text)            SET search_path = public, pg_temp;


-- ═══ MANUAL TODO ═════════════════════════════════════════════════════════
-- Not fixable via SQL — must be toggled in the Supabase dashboard:
--
--   Auth → Policies → "Leaked password protection"  →  enable
--   (HaveIBeenPwned-backed compromised-password rejection)
