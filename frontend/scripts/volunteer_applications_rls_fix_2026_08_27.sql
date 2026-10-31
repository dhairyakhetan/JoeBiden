-- Fixes a live bug found while auditing HoD desk Supabase wiring: the two
-- director-facing RLS policies on volunteer_applications
-- ("directors_can_view", "directors_can_update_review_status") were never
-- migrated to is_director() when members_pii_lockdown_stage2_revoke.sql
-- (2026-07-31) revoked `authenticated`'s SELECT on members.auth_uid.
--
-- Both policies did a raw, non-SECURITY-DEFINER subquery:
--   EXISTS (SELECT 1 FROM members WHERE members.auth_uid = auth.uid() ...)
-- Unlike is_director() (SECURITY DEFINER, runs as the function owner), this
-- subquery is evaluated under the querying role's own privileges - so it
-- hits the same revoked auth_uid grant every other caller does. Confirmed
-- live via SET ROLE authenticated + a real director's JWT claims:
--   ERROR: 42501: permission denied for table members
-- This means director/directors_can_view/VolunteerApplications.tsx (the
-- "Vol. Applications" super-admin desk) has been unusable for any director
-- since 2026-07-31 - it just never got exercised in a way that surfaced in
-- the last 24h of logs.
--
-- Fix: swap the raw subquery for is_director(), matching every other
-- director-gated policy in the schema. Semantics are equivalent except
-- is_director() also requires status = 'active', which is consistent with
-- how every other desk already gates - a suspended director should not
-- retain access here either.
-- ✅ APPLIED live 2026-08-27 (via Supabase MCP).

alter policy "directors_can_view" on public.volunteer_applications
  using (is_director());

alter policy "directors_can_update_review_status" on public.volunteer_applications
  using (is_director())
  with check (is_director());
