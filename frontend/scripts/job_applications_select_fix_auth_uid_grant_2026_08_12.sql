-- ============================================================================
-- AquaTerra — fix job_applications RLS policies broken by the members PII
-- lockdown, 2026-08-12
--
-- ✅ APPLIED live (confirmed 2026-08-29 via Supabase MCP: pg_policies shows
--    both policies already carry the fixed is_director()/is_super_admin()/
--    get_current_member_id() qual). This file was drafted on an orphan
--    session branch and never merged to main, so the migration ran live
--    weeks before its own paper trail caught up.
--
-- Symptom: HoD desk → Hiring → Opening Responses shows
--   "Could not load hiring responses - permission denied for table members"
--   for every director/super_admin.
--
-- Root cause: "job_applications_select" and "job_applications_update_status"
-- (created in job_openings_custom_application_form_2026_07.sql) each inline a
-- raw `EXISTS (SELECT 1 FROM public.members WHERE members.auth_uid = auth.uid()
-- ...)` check, evaluated with the CALLER's own privileges (plain RLS policies
-- are not SECURITY DEFINER). members_pii_lockdown_stage2_revoke.sql later
-- revoked SELECT on members.auth_uid (and email/phone/google_id) from
-- `authenticated` — so these two policies can no longer read the very column
-- their own WHERE clause depends on, and Postgres reports "permission denied
-- for table members" instead of silently returning zero rows.
--
-- Every other policy in the codebase that needs a role/identity check on
-- members goes through a SECURITY DEFINER helper (is_director(),
-- is_super_admin(), get_current_member_id()) precisely so callers never need
-- a direct grant on members' locked-down columns. These two policies were
-- written before that convention was applied uniformly. Fix: route them
-- through the same helpers.
-- ============================================================================

DROP POLICY IF EXISTS "job_applications_select" ON public.job_applications;
CREATE POLICY "job_applications_select" ON public.job_applications
  FOR SELECT
  USING (
    applicant_id = public.get_current_member_id()
    OR public.is_director()
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "job_applications_update_status" ON public.job_applications;
CREATE POLICY "job_applications_update_status" ON public.job_applications
  FOR UPDATE
  USING (
    public.is_director()
    OR public.is_super_admin()
  );

-- ============================================================================
-- VERIFICATION — run after applying. Both should report the new definitions.
--   select policyname, qual from pg_policies
--    where tablename='job_applications' and policyname in
--      ('job_applications_select','job_applications_update_status');
--
-- Then confirm from the app: HoD desk → Hiring → Opening Responses loads
-- without the "permission denied for table members" error.
-- ============================================================================
