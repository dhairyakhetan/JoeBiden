-- ═══════════════════════════════════════════════════════════════════════
-- FR10 — "certiicate only for HR" (user, 2026-09-05)
--
-- STATUS: **APPLIED 2026-09-05** to hzowuwffjqtgszecngpe, as migration
-- `certificate_requests_update_hr_only`, and verified by re-querying
-- pg_policies afterwards. Pre-state confirmed first:
--   certificate_requests_update_leaders | UPDATE
--     | (is_director() OR is_super_admin()) | (is_director() OR is_super_admin())
-- Post-state now reads:
--   certificate_requests_update_hr | UPDATE | is_super_admin() | is_super_admin()
--
-- EFFECT ON LIVE USERS: hod and director accounts have LOST the ability to
-- issue or decline a certificate, both in the desk and through PostgREST.
-- hr and super_admin keep it. That is the requested behaviour, but it is a
-- capability removed from real people mid-operation — if certificates were
-- being fulfilled by HoDs day to day, that workflow stops now.
--
-- TO REVERSE: drop certificate_requests_update_hr and recreate
-- certificate_requests_update_leaders with (is_director() OR is_super_admin())
-- on both USING and WITH CHECK.
--
-- A .sql file in this repo is still not evidence it ran — this status line is
-- only trustworthy because the verify query below was actually executed.
--
-- WHY
-- ───
-- Verified live 2026-09-05:
--
--   certificate_requests_update_leaders  UPDATE
--     USING       (is_director() OR is_super_admin())
--     WITH CHECK  (is_director() OR is_super_admin())
--
-- `is_director()` is true for hod / director / hr / super_admin, so after the
-- UI change a plain HoD can no longer SEE the certificates desk but can still
-- issue or decline a certificate by calling PostgREST directly. The UI gate is
-- the product decision; this is the enforcement.
--
-- `is_super_admin()` already returns true for BOTH 'hr' and 'super_admin'
-- (that is the whole point of the hr role — see lib/roles.ts), so restricting
-- the policy to is_super_admin() is exactly "HR and super admins only" and
-- needs no new function and no new role check.
--
-- SELECT is deliberately left alone. A director/HoD reading the queue is not
-- issuing anything, several desks surface request counts, and narrowing a read
-- policy is the kind of change that breaks a screen nobody thought to test.
-- If the user wants the queue itself hidden at the API level too, that is a
-- second, separate decision.
-- ═══════════════════════════════════════════════════════════════════════

begin;

drop policy if exists certificate_requests_update_leaders on public.certificate_requests;

create policy certificate_requests_update_hr
  on public.certificate_requests
  for update
  using       (is_super_admin())
  with check  (is_super_admin());

commit;

-- ── Verify (run this AFTER, and paste the result into this file's status
--    line above if you change it) ────────────────────────────────────────
-- select policyname, cmd, qual, with_check
--   from pg_policies
--  where tablename = 'certificate_requests';
--
-- Expect exactly three policies, and the UPDATE one to read
--   certificate_requests_update_hr | UPDATE | is_super_admin() | is_super_admin()
