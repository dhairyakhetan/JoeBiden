-- ──────────────────────────────────────────────────────────────────────────
-- Paradox OS · Phase 2 schema — Event Workspace + Control Room foundation.
--
-- Run in the PARADOX Supabase project SQL editor (NOT community). Idempotent:
-- CREATE ... IF NOT EXISTS + DROP POLICY IF EXISTS, safe to re-run.
--
-- Collapses the per-event workbook tabs (OVERVIEW / EVENT FLOW / REQUIREMENTS)
-- into one source of truth per event. RLS mirrors the existing paradox pattern
-- (authenticated = admin → full CRUD; see paradox_fix_afterparty_rls.sql).
-- ──────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;

-- 1. Per-event workspace: canonical Overview config + readiness + lifecycle.
create table if not exists public.paradox_event_workspaces (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.paradox_events(id) on delete cascade,
  status          text not null default 'draft'
                    check (status in ('draft','greenlit','live','done','cancelled')),
  -- OVERVIEW config (days, venue, booking_duration, match_duration, format,
  -- entry_fee, team_size, age_limit, cap, breakeven, prize_split). jsonb so it
  -- evolves without a migration; the public EventDetail + all logic read it.
  config          jsonb not null default '{}'::jsonb,
  head_confirmed  boolean not null default false,
  rules_final     boolean not null default false,
  fixtures_final  boolean not null default false,
  judges_confirmed boolean not null default false,
  greenlit_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (event_id)
);

-- 2. Runbook templates — the reusable EVENT FLOW SOP skeleton.
create table if not exists public.paradox_runbook_templates (
  id            uuid primary key default gen_random_uuid(),
  applies_to    text not null default 'all',  -- 'all' | event category/slug
  phase         text not null check (phase in ('reg','logistics','on_day','post')),
  task          text not null,
  owner_role    text,                          -- head | coordinator | volunteer | core
  due_offset    text,                          -- T-7d | T-1d | T-0 | on_spot | post
  auto_condition text,                         -- breakeven_reached | fixtures_published | ...
  is_gate       boolean not null default false,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

-- 3. Per-event runbook steps (instances). One owner, one due, one status.
create table if not exists public.paradox_runbook_steps (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.paradox_events(id) on delete cascade,
  phase         text not null check (phase in ('reg','logistics','on_day','post')),
  task          text not null,
  owner         text,
  owner_role    text,
  due_offset    text,
  due_at        timestamptz,                   -- resolved absolute due (event date − offset)
  status        text not null default 'todo'
                  check (status in ('todo','in_progress','blocked','done')),
  auto_condition text,                         -- closes itself when this data condition is true
  is_gate       boolean not null default false,
  depends_on    uuid references public.paradox_runbook_steps(id) on delete set null,
  completed_at  timestamptz,
  completed_by  text,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 4. Per-event requirements (logistics checklist; REQUIREMENTS worksheet).
create table if not exists public.paradox_requirements (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.paradox_events(id) on delete cascade,
  category      text,
  item          text not null,
  qty           text,
  source        text,                          -- print_internal | buy | borrow | vendor
  owner         text,
  due_at        timestamptz,
  arranged      boolean not null default false,
  arranged_by   text,
  arranged_at   timestamptz,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

-- 5. Event heads — accountable lead(s) per event.
create table if not exists public.paradox_event_heads (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.paradox_events(id) on delete cascade,
  name        text not null,
  contact     text,
  role        text default 'head',
  confirmed   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Indexes for the Control Room cross-event roll-ups.
create index if not exists idx_pox_runbook_steps_event on public.paradox_runbook_steps(event_id);
create index if not exists idx_pox_requirements_event  on public.paradox_requirements(event_id);
create index if not exists idx_pox_event_heads_event   on public.paradox_event_heads(event_id);

-- Shared updated_at touch trigger.
create or replace function public.paradox_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_pox_ws_touch on public.paradox_event_workspaces;
create trigger trg_pox_ws_touch before update on public.paradox_event_workspaces
  for each row execute function public.paradox_touch_updated_at();

drop trigger if exists trg_pox_step_touch on public.paradox_runbook_steps;
create trigger trg_pox_step_touch before update on public.paradox_runbook_steps
  for each row execute function public.paradox_touch_updated_at();

-- RLS — authenticated (admin) full CRUD on all five tables.
do $$
declare t text;
begin
  foreach t in array array[
    'paradox_event_workspaces','paradox_runbook_templates','paradox_runbook_steps',
    'paradox_requirements','paradox_event_heads'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "os admins all" on public.%I', t);
    execute format('create policy "os admins all" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Verify
select table_name from information_schema.tables
 where table_schema='public' and table_name like 'paradox_%'
   and table_name in ('paradox_event_workspaces','paradox_runbook_templates',
       'paradox_runbook_steps','paradox_requirements','paradox_event_heads')
 order by table_name;
