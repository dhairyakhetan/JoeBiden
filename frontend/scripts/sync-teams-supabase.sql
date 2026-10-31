-- sync-teams-supabase.sql
-- Run against the community Supabase project (hzowuwffjqtgszecngpe)
-- Creates the teams table, RLS policies, and member_count auto-update trigger.

-- ── 1. Create teams table ────────────────────────────────────────────────────
create table if not exists public.teams (
  uuid         text        primary key,
  name         text        not null,
  category     text        not null default 'welfare',
  bio          text,
  color        text,
  member_count integer     not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Keep updated_at fresh on every row update
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_teams_updated_at on public.teams;
create trigger trg_teams_updated_at
  before update on public.teams
  for each row execute procedure public.set_updated_at();

-- ── 2. Enable RLS ─────────────────────────────────────────────────────────────
alter table public.teams enable row level security;

-- Allow anyone to read teams
drop policy if exists "teams_select_public" on public.teams;
create policy "teams_select_public"
  on public.teams for select
  using (true);

-- Allow super_admin, director, hod to insert/update via the anon key
-- (Frontend passes the anon key; the role check is done against the members table)
-- We use a helper function so we can reuse the logic.
create or replace function public.current_member_role()
returns text language sql security definer as $$
  select role
  from public.members
  where auth_uid = auth.uid()
  limit 1;
$$;

drop policy if exists "teams_insert_leaders" on public.teams;
create policy "teams_insert_leaders"
  on public.teams for insert
  with check (
    public.current_member_role() in ('super_admin', 'director', 'hod')
  );

drop policy if exists "teams_update_leaders" on public.teams;
create policy "teams_update_leaders"
  on public.teams for update
  using (
    public.current_member_role() in ('super_admin', 'director', 'hod')
  );

-- ── 3. Auto-update member_count from team_members ────────────────────────────
-- NOTE: team_members lives in the COMMUNITY Supabase project, not here.
-- If you ever mirror team_members here, drop in this trigger:
--
-- create or replace function public.refresh_team_member_count()
-- returns trigger language plpgsql as $$
-- declare
--   v_team_uuid text;
-- begin
--   -- Determine the affected team uuid
--   if TG_OP = 'DELETE' then
--     select uuid into v_team_uuid from public.teams where uuid = OLD.team_uuid;
--   else
--     select uuid into v_team_uuid from public.teams where uuid = NEW.team_uuid;
--   end if;
--
--   update public.teams
--   set member_count = (
--     select count(*) from public.team_members
--     where team_uuid = v_team_uuid and is_active = true
--   )
--   where uuid = v_team_uuid;
--
--   return null;
-- end;
-- $$;
--
-- drop trigger if exists trg_team_member_count on public.team_members;
-- create trigger trg_team_member_count
--   after insert or update or delete on public.team_members
--   for each row execute procedure public.refresh_team_member_count();
--
-- Until team_members is mirrored here, member_count is updated by the frontend
-- on each TeamManagement save (upsert sets member_count: 0 on create;
-- subsequent member additions should call:
--   supabase.from('teams').update({ member_count: newCount }).eq('uuid', teamUuid)
-- from the membership management flow).
