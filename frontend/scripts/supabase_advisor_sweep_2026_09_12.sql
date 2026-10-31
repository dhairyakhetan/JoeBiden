-- ═══════════════════════════════════════════════════════════════════════════
-- Supabase advisor sweep, and what was and was NOT acted on.  2026-09-12
--
-- STATUS: the one migration below is APPLIED LIVE
-- (`trigger_functions_leave_the_rest_api`). Everything else in this file is a
-- decision record, so the same findings are not re-investigated from scratch
-- next time someone runs the linter.
--
-- ── ACTED ON: trigger functions were callable over REST (lint 0028/0029) ────
-- Every SECURITY DEFINER function `anon` or `authenticated` can reach shows up
-- at /rest/v1/rpc/<name>. Most of the 30 flagged are SUPPOSED to be callable -
-- `role_can`, `get_own_member`, `is_director`, `ensure_member` and friends are
-- the app's actual API, and their bodies ARE the authorisation check.
--
-- TRIGGER functions are not. They take no arguments, return `trigger`, and only
-- ever mean anything when fired by a trigger. Exposing them is surface with no
-- use. Two of them (`fill_article_excerpt`, `stamp_post_source_kind`) were added
-- during item 4.2 earlier the same night and inherited the default grant, so
-- this is partly cleaning up after those migrations.
--
-- Revoking does NOT break the triggers: Postgres checks EXECUTE on a trigger
-- function when the trigger is CREATED, not each time it fires. Verified after
-- applying, as the real hod in a rolled-back transaction: 0 trigger functions
-- reachable, a long-form INSERT still succeeded, and the excerpt trigger still
-- derived `posts.body` from `article_body`.
--
-- ── NOT ACTED ON (1): three SECURITY DEFINER views, reported as ERROR ───────
-- `member_directory_view`, `pending_member_approvals`, `rejected_member_approvals`.
--
-- These are correct as they stand. Each carries its own guard IN THE VIEW BODY:
--   member_directory_view      WHERE (is_director() OR is_super_admin())
--   pending_member_approvals   WHERE status='pending_approval' AND is_active AND (is_director() OR is_super_admin())
--   rejected_member_approvals  WHERE status='rejected' AND (is_director() OR is_super_admin())
--
-- and SECURITY DEFINER is precisely HOW they can read `email` and `phone`,
-- which `authenticated` has no column grant for (CLAUDE.md's PII lockdown).
-- Rewriting them as security_invoker would break the desk and gain nothing.
--
-- Verified live as a plain active `member`, not assumed:
--   member_directory_view      0 rows
--   pending_member_approvals   0 rows
--   rejected_member_approvals  0 rows
--
-- The linter cannot see a guard inside a view body, so this is a false
-- positive. Written down so the next person does not re-open it.
--
-- ── NOT ACTED ON (2): leaked-password protection disabled (WARN) ────────────
-- Moot on this project. All 110 auth users are Google OAuth and
-- `auth.users.encrypted_password` is NULL for every one of them - there is no
-- password for HaveIBeenPwned to check. It is also an Auth dashboard toggle,
-- not something a migration can set. Worth enabling only if email/password
-- sign-in is ever turned on, and at that point it is required, not optional.
--
-- ── NOT ACTED ON (3): 36 unused indexes (INFO) ─────────────────────────────
-- "Unused" here means "never scanned since the last stats reset", which on
-- these tables mostly means "this feature has little or no data yet"
-- (yearbook_entries, sops, member_breaks, certificate_requests and
-- drive_attendance are all empty). Most are foreign-key indexes, which earn
-- their keep on DELETE and on the cascade path rather than on SELECT.
-- Dropping them would trade a measurable risk for no measured gain. Revisit
-- when those tables actually carry rows.
--
-- ── NOT ACTED ON (4): Auth connection strategy is absolute, not percentage ──
-- A dashboard setting, not a migration, and it only matters when the instance
-- is resized. Noted for whoever does that.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn.sig);
  end loop;
end $$;
