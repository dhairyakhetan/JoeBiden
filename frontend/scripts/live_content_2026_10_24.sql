-- ============================================================================
-- AquaTerra.live editable content: the nights and the programmes
--
-- APPLIED 2026-10-24 to the community project (hzowuwffjqtgszecngpe) as `live_content_events_programmes`, seeded with the 5 nights and
-- 4 programmes from data/content.ts, and verified by role (anon reads published only and cannot write; a leader can add and hide; a
-- non-leader changes 0 rows; month 13 and a javascript: link are refused). Test rows were rolled back.
--
-- Moves what used to be a typed file (src/live/data/content.ts) into two tables that a leader edits at /live/admin/content. The
-- site reads these and falls back to the typed file if the tables are empty or unreachable, so a database hiccup never blanks a page.
--
-- No row is ever removed from the app: a leader unticks `published` and the night or programme disappears from the public site but
-- stays here. That keeps history and keeps this migration free of anything destructive.
--
-- WHO CAN DO WHAT
--   read    anyone reads PUBLISHED rows; leaders (is_director or is_super_admin) read everything
--   write   leaders only (insert, update). The CHECKs below repeat the app's own rules so a hand-edit in the table editor cannot
--           store a javascript: link or a 10 MB blurb.
-- NOTE: the live database was created with a looser when_key check (digits only) and then given the strict one as a second constraint
-- (`live_events_when_key_valid`, migration live_events_when_key_strict), so a fresh install from this file is equivalent.
-- Photos are NOT here: a photo is a file that ships with a deploy, so only its id is stored, and the app ignores an id it does not know.
-- ============================================================================

create table if not exists public.live_events (
  slug         text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 60),
  name         text not null check (length(btrim(name)) between 1 and 80),
  edition      text check (edition is null or length(btrim(edition)) between 1 and 80),
  status       text not null check (status in ('upcoming', 'past')),
  when_key     text not null check (when_key ~ '^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$'),
  date_label   text not null check (length(btrim(date_label)) between 1 and 60),
  blurb        text not null check (length(btrim(blurb)) between 1 and 400),
  venue        text check (venue is null or length(btrim(venue)) between 1 and 80),
  time_label   text check (time_label is null or length(btrim(time_label)) between 1 and 40),
  href         text check (href is null or href ~ '^(/[A-Za-z0-9/_-]*|https://[^[:space:]]+)$'),
  photo_ids    text[] not null default '{}' check (cardinality(photo_ids) <= 24),
  highlights   text[] not null default '{}' check (cardinality(highlights) <= 8),
  sort         integer not null default 0,
  published    boolean not null default true,
  updated_at   timestamptz not null default now(),
  updated_by   text
);

create table if not exists public.live_programmes (
  name         text primary key check (length(btrim(name)) between 1 and 60),
  line         text not null check (length(btrim(line)) between 1 and 200),
  photo        text check (photo is null or photo ~ '^[a-z0-9-]{1,40}$'),
  photo_alt    text check (photo_alt is null or length(btrim(photo_alt)) between 1 and 200),
  sort         integer not null default 0,
  published    boolean not null default true,
  updated_at   timestamptz not null default now(),
  updated_by   text
);

comment on table public.live_events is 'The nights shown on AquaTerra.live. Edited at /live/admin/content; unpublish instead of removing.';
comment on table public.live_programmes is 'What the nights pay for, shown on AquaTerra.live. Programme names only, never rupee figures.';

create or replace function public.live_touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace trigger live_events_touch before update on public.live_events for each row execute function public.live_touch_updated_at();
create or replace trigger live_programmes_touch before update on public.live_programmes for each row execute function public.live_touch_updated_at();

alter table public.live_events enable row level security;
alter table public.live_programmes enable row level security;

revoke all on public.live_events, public.live_programmes from anon, authenticated, public;
grant select on public.live_events, public.live_programmes to anon, authenticated;
grant insert, update on public.live_events, public.live_programmes to authenticated;

create policy live_events_public_read on public.live_events
  for select to anon, authenticated using (published);
create policy live_events_leader_read on public.live_events
  for select to authenticated using (public.is_director() or public.is_super_admin());
create policy live_events_leader_insert on public.live_events
  for insert to authenticated with check (public.is_director() or public.is_super_admin());
create policy live_events_leader_update on public.live_events
  for update to authenticated
  using (public.is_director() or public.is_super_admin()) with check (public.is_director() or public.is_super_admin());

create policy live_programmes_public_read on public.live_programmes
  for select to anon, authenticated using (published);
create policy live_programmes_leader_read on public.live_programmes
  for select to authenticated using (public.is_director() or public.is_super_admin());
create policy live_programmes_leader_insert on public.live_programmes
  for insert to authenticated with check (public.is_director() or public.is_super_admin());
create policy live_programmes_leader_update on public.live_programmes
  for update to authenticated
  using (public.is_director() or public.is_super_admin()) with check (public.is_director() or public.is_super_admin());
