-- ═══════════════════════════════════════════════════════════════════════════
-- A team lead could see the Add Opening button and not use it.  2026-09-12
--
-- STATUS: APPLIED LIVE this date, via the Supabase MCP connector, as migration
-- `team_leads_can_manage_their_own_teams_openings`. Verify against
-- `pg_policy` before trusting that sentence.
--
-- ── WHAT WAS WRONG ─────────────────────────────────────────────────────────
-- `teams/TeamDetailPage.tsx` computes
--     canManageMembers  = ... || isTeamLead
--     canManageOpenings = canManageMembers || hasLeaderAccess(role)
-- where `isTeamLead` is the TEAM-SCOPED `team_members.role = 'lead'`, not a
-- global role. So a plain `member` who leads a team is shown Add / Edit /
-- Remove Opening.
--
-- Every write policy on `job_openings` was `is_director() OR is_super_admin()`
-- - the four global roles (director, hod, super_admin, hr) and nothing else.
--
-- Not hypothetical. Measured live before the change: 11 active `lead` rows,
-- whose members' roles are hod, hr, super_admin AND member. The student leads
-- see the controls, and every one of them fails.
--
-- ── WHICH DIRECTION TO FIX IT ──────────────────────────────────────────────
-- Two options, and they are not equivalent: hide the buttons, or let the policy
-- match what the product already says.
--
-- The product is explicit that a lead runs their team. A lead can already add
-- and remove that team's MEMBERS (`team_members` has its own `is_team_lead`
-- branch) and read its applications. Openings were the one part of running a
-- team they were shown and denied - which reads as the desk being broken, not
-- as a deliberate limit. So the POLICY was brought in line with the product
-- rather than the product cut back to the policy.
--
-- Scoped to the lead's own team. A lead gains nothing anywhere else.
--
-- `is_team_lead(team_id)` already existed, is STABLE SECURITY DEFINER, and
-- already requires `is_active IS TRUE AND left_at IS NULL` - so a removed lead
-- loses this with no extra condition here.
--
-- UPDATE carries the check in BOTH `using` and `with check` deliberately.
-- `using` alone would let a lead EDIT an opening they own and set its `team_id`
-- to another team - moving a row out of their scope is precisely the
-- escalation this must not open.
--
-- ── VERIFIED, as a real plain-`member` team lead, rolled back ──────────────
--   insert into own team          1 row
--   insert into another team      blocked
--   update someone else's opening 0 rows   (RLS filters; it does not raise)
--
-- Row counts, not exceptions: a denied UPDATE/DELETE touches zero rows
-- silently, so exception-only checking reports a denial as a success.
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists job_openings_director_insert on public.job_openings;
create policy job_openings_director_insert
  on public.job_openings for insert to public
  with check (
    is_director() or is_super_admin()
    or (team_id is not null and is_team_lead(team_id))
  );

drop policy if exists job_openings_director_update on public.job_openings;
create policy job_openings_director_update
  on public.job_openings for update to public
  using (
    is_director() or is_super_admin()
    or (team_id is not null and is_team_lead(team_id))
  )
  with check (
    is_director() or is_super_admin()
    or (team_id is not null and is_team_lead(team_id))
  );

drop policy if exists job_openings_director_delete on public.job_openings;
create policy job_openings_director_delete
  on public.job_openings for delete to public
  using (
    is_director() or is_super_admin()
    or (team_id is not null and is_team_lead(team_id))
  );
