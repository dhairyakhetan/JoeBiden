-- ─────────────────────────────────────────────────────────────────────────────
-- Supabase advisor sweep, round 2 - 2026-09-12
--
-- STATUS: the one migration below IS APPLIED (verified live, see the check at
-- the bottom). Everything else in this file is a NO-OP record of advisor
-- warnings that were investigated and found to be correct by design, so that
-- the next person reading `get_advisors` output does not re-investigate them.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── APPLIED: the org-posting RPC leaves the anon grant ───────────────────────
--
-- `create_post_as_org` is SECURITY DEFINER and inserts a post authored by the
-- org account (official@ngoaquaterra.com). It was executable by `anon`.
--
-- This was NOT a hole: the function's own first two statements are
--   IF auth.uid() IS NULL THEN RAISE EXCEPTION 'must be authenticated ...'
--   IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'only a super admin ...'
-- so an unauthenticated caller was already refused. But a function whose first
-- line is "must be authenticated" has no business being reachable from an
-- unauthenticated REST call, and moving the refusal to the API boundary means
-- a future edit to the body cannot quietly open it.

revoke execute on function public.create_post_as_org(
  text, text, text, text, text, jsonb, text, timestamptz, text[], jsonb, integer[]
) from anon, public;

-- Verified live afterwards by calling it with `set_config('role','anon',true)`:
--   anon blocked: permission denied for function create_post_as_org


-- ── NOT A DEFECT: three SECURITY DEFINER views (advisor level ERROR) ─────────
--
--   public.member_directory_view
--   public.pending_member_approvals
--   public.rejected_member_approvals
--
-- The advisor flags these because they run with the view owner's permissions
-- rather than the caller's. That is the POINT of them here, and it is what
-- makes the `members` PII lockdown workable: `authenticated` deliberately has
-- NO column grant on members.email / members.phone / members.auth_uid, so a
-- director could not read the directory through the table at all. The views
-- are the sanctioned hole, and each carries its own role gate in the WHERE:
--
--   member_directory_view      ... WHERE is_director() OR is_super_admin()
--   pending_member_approvals   ... AND (is_director() OR is_super_admin())
--   rejected_member_approvals  ... AND (is_director() OR is_super_admin())
--
-- Switching them to security_invoker would not tighten anything - it would
-- simply break the desk, because the caller lacks the column grants.
--
-- VERIFIED LIVE 2026-09-12, by ROW COUNT rather than by "did it throw" (RLS and
-- a gated view both FILTER silently; checking only for an exception reports a
-- denial as a success):
--
--   role=authenticated, jwt.sub = an active role='member' account
--     member_directory_view      rows = 0
--     pending_member_approvals   rows = 0
--     rejected_member_approvals  rows = 0
--   role=authenticated, jwt.sub = a director account
--     member_directory_view      rows = 1380
--
-- No change applied. Do not "fix" these.


-- ── NOT A DEFECT: SECURITY DEFINER functions callable by authenticated ───────
--
-- 27 of them. The bulk are the RLS predicates themselves - is_director(),
-- is_super_admin(), is_team_lead(), is_assigned_to_category(),
-- is_member_of_department(), role_can(), current_member_id(),
-- get_current_member_id(), get_own_member(), mom_*(). They MUST be SECURITY
-- DEFINER to be usable inside a policy, and calling one over REST tells the
-- caller only something they already know ("am I a director"). Revoking
-- EXECUTE would break every policy that calls them.
--
-- The two that return real PII were read line by line:
--
--   get_aq_contacts(p_search, p_limit, p_offset)
--     first statement:  if not (is_director() or is_super_admin())
--                         then raise exception ... errcode 42501
--     and it writes a community_audit_logs row naming the caller and the
--     search term before returning anything. Correct.
--
--   get_team_member_contacts(p_member_ids, p_team_id)
--     scoped to one team; the contact-reveal audit trail
--     (contact_access_log) is written on the app side of this path.
--
-- No change applied.


-- ── NOT APPLICABLE: "Leaked Password Protection Disabled" ────────────────────
--
-- This project has no password auth. There is no `auth.signUp` call anywhere in
-- the codebase; a first-time Google sign-in IS the signup (AuthContext ->
-- ensure_member()). HaveIBeenPwned checking has nothing to check. Left off.
-- It is a dashboard toggle in any case, not something a migration can set.
