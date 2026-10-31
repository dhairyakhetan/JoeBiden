-- APPLIED LIVE 2026-09-14 via Supabase MCP (migration name: team_follows_table)
--
-- Social-system IA audit, per owner request. Finding: you could follow a
-- PERSON (public.follows) but not a TEAM, even though teams are the org's
-- real organizing unit (8 departments, category-scoped moderation,
-- team-scoped posting). A prospective volunteer or a member curious about
-- another department had no lightweight way to subscribe to its posts short
-- of actually joining it via team_members.
--
-- Mirrors public.follows' own shape and RLS exactly: anyone signed in can
-- read (follower counts, "you follow this team"), insert/delete restricted
-- to the current member's own row.

create table public.team_follows (
  follow_id bigint generated always as identity primary key,
  follower_id integer not null references public.members(member_id) on delete cascade,
  team_id integer not null references public.teams(team_id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, team_id)
);

alter table public.team_follows enable row level security;

create policy team_follows_select on public.team_follows
  for select using (true);

create policy team_follows_insert on public.team_follows
  for insert with check (follower_id = (select get_current_member_id()));

create policy team_follows_delete on public.team_follows
  for delete using (follower_id = (select get_current_member_id()));

grant select, insert, delete on public.team_follows to authenticated;
grant usage on sequence team_follows_follow_id_seq to authenticated;

-- Verified live: policies read back exactly as above (both auth.uid()-style
-- checks wrapped through get_current_member_id(), matching the auth_rls_
-- initplan-safe pattern used elsewhere in this project).
