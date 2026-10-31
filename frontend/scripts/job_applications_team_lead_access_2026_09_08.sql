-- ─────────────────────────────────────────────────────────────────────────
-- job_applications: widen RLS to match TeamDetailPage.tsx's existing UI grant
-- (2026-09-08)
-- ─────────────────────────────────────────────────────────────────────────
-- Found while stress-testing this week's reject-with-reason feature against
-- live schema: TeamDetailPage.tsx's `canManageOpenings` already lets a
-- team-scoped `lead` (team_members.role='lead', not necessarily a global
-- director/hod/super_admin/hr) open the Responses/Openings tabs and call
-- jobOpenings.updateApplicationStatus() - including the new reject-with-
-- reason modal. But job_applications' RLS never granted that role anything:
-- SELECT and the status-UPDATE policy both checked only
-- `applicant_id = get_current_member_id() OR is_director() OR is_super_admin()`.
-- A team lead who wasn't also a global director saw the tab silently render
-- "no responses" (RLS returned zero rows, no error) and any write attempt
-- was blocked - the feature was dark for the exact role the UI promises it
-- to.
--
-- Fix: OR in `is_team_lead(jo.team_id)` - an existing, already correctly
-- is_active/left_at-scoped function (public.is_team_lead(p_team_id)) - via
-- the opening a given application belongs to.
--
-- NOT covered by this migration, and deliberately left as a separate,
-- smaller residual gap: jobOpenings.ts's post-update notification call
-- (`notificationService.create({..., type: 'system', ...})`) still checks
-- `is_director() OR is_super_admin()` inside create_notification() - a team
-- lead's accept/reject will now succeed, but the applicant-facing
-- notification will still silently fail (console.warn only, fire-and-forget
-- by the existing non-throwing contract - the primary action is unaffected).
-- Widening that is a separate decision: create_notification()'s 'system'
-- branch is generic and used by many callers beyond job applications, so
-- OR-ing in "any team lead" there is a broader grant than this specific fix
-- calls for. Flagged, not applied here.
-- ─────────────────────────────────────────────────────────────────────────

drop policy if exists "job_applications_select" on public.job_applications;
create policy "job_applications_select"
  on public.job_applications for select
  to public
  using (
    applicant_id = get_current_member_id()
    or is_director()
    or is_super_admin()
    or exists (
      select 1 from public.job_openings jo
      where jo.id = job_applications.opening_id
        and is_team_lead(jo.team_id)
    )
  );

drop policy if exists "job_applications_update_status" on public.job_applications;
create policy "job_applications_update_status"
  on public.job_applications for update
  to public
  using (
    is_director()
    or is_super_admin()
    or exists (
      select 1 from public.job_openings jo
      where jo.id = job_applications.opening_id
        and is_team_lead(jo.team_id)
    )
  );
