-- APPLIED LIVE 2026-09-12 via Supabase MCP (migration name: posts_update_team_lead_scope_to_queue)
--
-- Bug fix, found by code review of the same day's team_scoped_hod_powers
-- migration: the team-lead clause added to `posts_update`
-- (`team_id is not null and is_team_lead(team_id)`) had NO status
-- restriction, unlike the author's own self-edit clause right next to it
-- (`status in ('pending_review','rejected')`). That let a team lead
-- silently edit or take down an ALREADY-PUBLISHED post on their team via a
-- direct `.update()` call, not just moderate the pending queue - well
-- beyond "post moderation (approve/reject)", the scope actually asked for.
--
-- Fix: add the same `status in ('pending_review','rejected')` restriction
-- to the team-lead clause's USING (which row-selection old-row check), so a
-- team lead can only reach a post that is still awaiting a decision.
-- WITH CHECK is left alone - the whole point of moderating is that the NEW
-- status becomes something else (published/rejected).
--
-- Verified live via:
--   select policyname, cmd, qual, with_check from pg_policies
--    where tablename='posts' and cmd='UPDATE';
drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts
for update
using (
  (author_id = get_current_member_id() and status in ('pending_review','rejected'))
  or is_director_for_category(category)
  or (team_id is not null and is_team_lead(team_id) and status in ('pending_review','rejected'))
)
with check (
  (author_id = get_current_member_id() and status in ('pending_review','rejected'))
  or is_director_for_category(category)
  or (team_id is not null and is_team_lead(team_id))
);
