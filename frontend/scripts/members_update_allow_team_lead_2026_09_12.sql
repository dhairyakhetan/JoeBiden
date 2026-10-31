-- APPLIED LIVE 2026-09-12 via Supabase MCP (migration name: members_update_allow_team_lead)
--
-- Follow-up to team_scoped_hod_powers_2026_09_12.sql, applied minutes later
-- in the same session after realising the fix above was incomplete: the
-- BEFORE UPDATE trigger (members_guard_privileged_cols) now authorizes a
-- team lead to change their own team member's status, but the OUTER RLS
-- policy on `members` still ran first and rejected the UPDATE before the
-- trigger ever fired - `members_update` only allowed `is_director() OR
-- auth_uid = auth.uid()`, with no team-lead clause at all.
--
-- Verified live afterwards via:
--   select policyname, cmd, qual from pg_policies where tablename='members' and cmd='UPDATE';
drop policy if exists members_update on public.members;
create policy members_update on public.members
for update
using (
  is_director()
  or (auth_uid = auth.uid())
  or is_team_lead_of_member(member_id)
)
with check (
  is_director()
  or (auth_uid = auth.uid())
  or is_team_lead_of_member(member_id)
);
