-- Post team tagging: one post can tag several teams.
-- Sheet row (HR tab): 'Add a "tag team(s)" option to the post format so one post can tag
-- multiple teams. Make tagged posts appear automatically on the relevant team page. Go back
-- through existing posts and tag them with the right teams.'
--
-- WHY A NEW TABLE: posts.team_id is a single nullable column (3 of 610 posts use it), and
-- post_tags is for tagged MEMBERS. A post-to-teams many-to-many is the honest shape.
-- posts.team_id stays as the post's primary team; a trigger mirrors it into post_teams so the
-- team page only has to read one place.
--
-- APPLIED LIVE 2026-10-03 (additive only: a new table, a new trigger, no change to existing
-- tables' data or policies). Part 1 is the schema; part 2 is the backfill, which records WHY
-- each tag exists in `source` so it can be audited or undone:
--   delete from public.post_teams where source like 'backfill%';

-- ── Part 1: schema ──────────────────────────────────────────────────────────
create table if not exists public.post_teams (
  post_id    integer     not null references public.posts(post_id) on delete cascade,
  team_id    integer     not null references public.teams(team_id) on delete cascade,
  source     text        not null default 'author'
             check (source in ('author', 'primary', 'backfill_primary', 'backfill_mom', 'backfill_category')),
  created_at timestamptz not null default now(),
  primary key (post_id, team_id)
);
create index if not exists post_teams_team_id_idx on public.post_teams (team_id, post_id desc);

alter table public.post_teams enable row level security;

-- Default privileges hand every table to anon/authenticated (RLS is the only guard), so
-- narrow them to what this table needs.
revoke all on public.post_teams from anon, authenticated;
grant select on public.post_teams to anon, authenticated;
grant insert, delete on public.post_teams to authenticated;

-- Readable exactly where the post is readable (RLS on posts applies inside the subquery).
drop policy if exists post_teams_select on public.post_teams;
create policy post_teams_select on public.post_teams for select
  using (exists (select 1 from public.posts p where p.post_id = post_teams.post_id));

-- Only the post's author or a director may add or remove a tag, and a client can only
-- write source = 'author' (the other sources are for the trigger and the backfill).
drop policy if exists post_teams_insert on public.post_teams;
create policy post_teams_insert on public.post_teams for insert to authenticated
  with check (
    source = 'author'
    and exists (
      select 1 from public.posts p
      where p.post_id = post_teams.post_id
        and (p.author_id = public.get_current_member_id() or public.is_director())
    )
  );

drop policy if exists post_teams_delete on public.post_teams;
create policy post_teams_delete on public.post_teams for delete to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.post_id = post_teams.post_id
        and (p.author_id = public.get_current_member_id() or public.is_director())
    )
  );

-- Keep posts.team_id (the primary team) mirrored into post_teams.
create or replace function public.sync_post_primary_team()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.team_id is not null then
    insert into public.post_teams (post_id, team_id, source)
    values (new.post_id, new.team_id, 'primary')
    on conflict (post_id, team_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists posts_sync_primary_team on public.posts;
create trigger posts_sync_primary_team
  after insert or update of team_id on public.posts
  for each row execute function public.sync_post_primary_team();

-- ── Part 2: backfill of existing posts ──────────────────────────────────────
-- Conservative: only signals that are specific. Not guessed: 'content' (3 teams) and
-- 'operations' (3 teams) posts without a named team stay untagged for a human to tag.

-- a) a post that already names a primary team
insert into public.post_teams (post_id, team_id, source)
select post_id, team_id, 'backfill_primary' from public.posts where team_id is not null
on conflict (post_id, team_id) do nothing;

-- b) Member of the Month announcements name their team: "<Team>'s member of the month"
insert into public.post_teams (post_id, team_id, source)
select p.post_id, t.team_id, 'backfill_mom'
from public.teams t
join public.posts p
  on (coalesce(p.title, '') || ' ' || coalesce(p.body, ''))
     ~* ('\m' || regexp_replace(t.name, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || '[’'']s member of the month')
where t.is_active and p.deleted_at is null
on conflict (post_id, team_id) do nothing;

-- c) categories that belong to exactly one team: welfare -> Welfare Team, events -> Events
--    Team, labs -> ShikshAQ. (Looked up by name, never hard-coded ids.)
insert into public.post_teams (post_id, team_id, source)
select p.post_id, t.team_id, 'backfill_category'
from public.posts p
join public.teams t on t.is_active and (
     (p.category = 'welfare' and t.name = 'Welfare Team')
  or (p.category = 'events'  and t.name = 'Events Team')
  or (p.category = 'labs'    and t.name = 'ShikshAQ'))
where p.deleted_at is null
on conflict (post_id, team_id) do nothing;
