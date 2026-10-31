-- ──────────────────────────────────────────────────────────────────────────
-- Paradox OS · Phases 8-12 — remaining module data model.
-- fixtures · judging · certificates · schools · sponsors · stalls · venues ·
-- logistics · marketing · content. Run in the PARADOX SQL editor. Idempotent.
-- RLS = authenticated full CRUD (existing pattern).
-- ──────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

-- Phase 8 — Fixtures (constraint-enforced generator output; publish-locked).
create table if not exists public.paradox_fixtures (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.paradox_events(id) on delete cascade,
  round        text,
  slot_no      int,
  court        text,
  team_a       text,
  team_b       text,
  scheduled_at timestamptz,
  status       text not null default 'scheduled' check (status in ('scheduled','live','done','bye')),
  version      int not null default 1,
  published    boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists idx_pox_fixtures_event on public.paradox_fixtures(event_id, slot_no);

-- Phase 9 — Judging rubric + scores + certificates.
create table if not exists public.paradox_judging_rubrics (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.paradox_events(id) on delete cascade,
  criterion   text not null,
  weight      numeric not null default 1,
  max_score   numeric not null default 10,
  blind       boolean not null default false,   -- photography = anonymised
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create table if not exists public.paradox_judging_scores (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.paradox_events(id) on delete cascade,
  rubric_id   uuid references public.paradox_judging_rubrics(id) on delete cascade,
  judge       text,
  team_name   text,
  round       text,
  score       numeric,
  created_at  timestamptz not null default now()
);
create index if not exists idx_pox_jscores_event on public.paradox_judging_scores(event_id);
create table if not exists public.paradox_certificates (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid references public.paradox_events(id) on delete cascade,
  recipient     text not null,
  kind          text not null default 'participation'
                  check (kind in ('winner','runner_up','special','participation')),
  rank          int,
  url           text,
  issued        boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Phase 11 — Schools CRM + Sponsorship CRM + Marketing team.
create table if not exists public.paradox_schools (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  category      text,
  contact_name  text,
  contact_phone text,
  contact_email text,
  owner         text,
  status        text default 'prospect',  -- prospect | contacted | committed | declined
  texted        boolean not null default false,
  called        boolean not null default false,
  remarks       text,
  created_at    timestamptz not null default now()
);
create table if not exists public.paradox_sponsors (
  id            uuid primary key default gen_random_uuid(),
  company       text not null,
  contact_name  text,
  email         text,
  phone         text,
  tier          text,
  status        text default 'prospect',  -- prospect | mailed | replied | followup | closed | dead
  owner         text,
  known_bad     boolean not null default false,  -- placeholder/bounced email flag
  deliverables  text,
  remarks       text,
  last_contact  date,
  created_at    timestamptz not null default now()
);
create table if not exists public.paradox_marketing_team (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  role          text,
  contact       text,
  capture_venue text,                      -- protected capture owner per venue
  created_at    timestamptz not null default now()
);
create table if not exists public.paradox_content_items (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid references public.paradox_events(id) on delete set null,
  day           text,
  shot_list     text,
  owner         text,
  asset_url     text,
  status        text default 'todo',       -- todo | captured | edited | posted
  posted        boolean not null default false,
  posting_date  date,
  created_at    timestamptz not null default now()
);

-- Phase 10 — Stalls/Vendors + Venues + Logistics roll-up.
create table if not exists public.paradox_stalls (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  vendor_contact text,
  advance       numeric default 0,
  total         numeric default 0,
  power_needs   text,
  location_pin  text,
  timings       text,
  layout_slot   text,
  confirmed     boolean not null default false,
  created_at    timestamptz not null default now()
);
create table if not exists public.paradox_venues (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  capacity      int,
  est_cost      numeric,
  power_load    text,
  has_lift      boolean,
  has_sound     boolean,
  availability  text,
  license_status text,
  status        text default 'prospect',
  created_at    timestamptz not null default now()
);
create table if not exists public.paradox_logistics_items (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid references public.paradox_events(id) on delete set null,
  category      text,
  item          text not null,
  qty           text,
  source        text,
  owner         text,
  due_at        timestamptz,
  status        text not null default 'todo' check (status in ('todo','blocked','done')),
  created_at    timestamptz not null default now()
);

-- RLS — authenticated full CRUD on every new table.
do $$
declare t text;
begin
  foreach t in array array[
    'paradox_fixtures','paradox_judging_rubrics','paradox_judging_scores','paradox_certificates',
    'paradox_schools','paradox_sponsors','paradox_marketing_team','paradox_content_items',
    'paradox_stalls','paradox_venues','paradox_logistics_items'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "os admins all" on public.%I', t);
    execute format('create policy "os admins all" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

select count(*) as new_module_tables from information_schema.tables
 where table_schema='public' and table_name in (
   'paradox_fixtures','paradox_judging_rubrics','paradox_judging_scores','paradox_certificates',
   'paradox_schools','paradox_sponsors','paradox_marketing_team','paradox_content_items',
   'paradox_stalls','paradox_venues','paradox_logistics_items');
