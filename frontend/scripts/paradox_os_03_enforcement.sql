-- ──────────────────────────────────────────────────────────────────────────
-- Paradox OS · Phase 3 — Enforcement & Automation engine.
--
-- The thing the spreadsheets could never do: the system advances tasks on its
-- own, chases + escalates overdue owners, and hard-gates the dangerous steps.
-- Run in the PARADOX SQL editor AFTER paradox_os_01_schema.sql. Idempotent.
--
-- Scheduler: Supabase pg_cron runs paradox_os_tick() every 15 min (enable the
-- pg_cron extension in Dashboard → Database → Extensions if the CREATE
-- EXTENSION line errors). Everything is also callable on demand from the
-- Control Room "run now" button via the paradox_os_tick RPC.
-- ──────────────────────────────────────────────────────────────────────────

-- Observability: every automated action is logged here (idempotent, deduped).
create table if not exists public.paradox_automation_log (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid references public.paradox_events(id) on delete cascade,
  kind        text not null,           -- auto_progress | chase | escalate | greenlight | gate_block
  subject_id  uuid,                    -- the step/registration/etc. acted on
  detail      text,
  level       int not null default 0,  -- escalation level (0 owner, 1 head, 2 core)
  created_at  timestamptz not null default now()
);
create index if not exists idx_pox_autolog_event on public.paradox_automation_log(event_id, created_at desc);

-- Escalation bookkeeping on steps.
alter table public.paradox_runbook_steps
  add column if not exists escalation_level int not null default 0,
  add column if not exists last_nudged_at  timestamptz;

-- ── 0. Tolerant date parser ─────────────────────────────────────────────────
-- paradox_events.date is FREE TEXT (e.g. "1st June 2026"), not a timestamp.
-- This returns a timestamptz when the text is parseable (ISO, or "1st June
-- 2026" style with ordinal stripped) and NULL otherwise — so unparseable dates
-- just leave the step's due_at empty instead of crashing the whole tick.
create or replace function public.paradox_os_try_ts(p text)
returns timestamptz language plpgsql immutable as $$
declare cleaned text;
begin
  begin return p::timestamptz; exception when others then end;
  cleaned := btrim(regexp_replace(coalesce(p,''), '(\d+)(st|nd|rd|th)', '\1', 'gi'));
  if cleaned = '' then return null; end if;
  begin return to_timestamp(cleaned, 'DD Month YYYY'); exception when others then end;
  begin return to_timestamp(cleaned, 'Month DD YYYY'); exception when others then end;
  return null;
end $$;

-- ── 1. Resolve absolute due dates from the event date + due_offset ──────────
create or replace function public.paradox_os_resolve_due_dates()
returns void language plpgsql security definer set search_path = public as $$
begin
  update paradox_runbook_steps s
     set due_at = case s.due_offset
        when 'T-14d' then (base.d - interval '14 days')
        when 'T-10d' then (base.d - interval '10 days')
        when 'T-7d'  then (base.d - interval '7 days')
        when 'T-3d'  then (base.d - interval '3 days')
        when 'T-2d'  then (base.d - interval '2 days')
        when 'T-1d'  then (base.d - interval '1 day')
        when 'T-0'   then base.d
        when 'post'  then (base.d + interval '2 days')
        else s.due_at end
    from paradox_events e
    cross join lateral (select public.paradox_os_try_ts(e.date) as d) base
   where e.id = s.event_id
     and base.d is not null
     and s.due_offset is not null
     and s.due_at is null;  -- only fill unresolved; re-runnable, never thrashes
end $$;

-- ── 2. Auto-progress: close steps whose data condition is met ───────────────
-- Steps that move themselves so a 16-year-old never ticks them manually.
create or replace function public.paradox_os_auto_progress()
returns int language plpgsql security definer set search_path = public as $$
declare n int := 0;
begin
  -- breakeven_reached → paid count >= config.breakeven
  with hit as (
    select s.id, s.event_id
      from paradox_runbook_steps s
      join paradox_event_workspaces w on w.event_id = s.event_id
     where s.status <> 'done' and s.auto_condition = 'breakeven_reached'
       and (w.config->>'breakeven') ~ '^[0-9]+$'
       and (select count(*) from paradox_registrations r where r.event_id = s.event_id and r.paid)
           >= (w.config->>'breakeven')::int
  ), upd as (
    update paradox_runbook_steps s set status='done', completed_at=now(), completed_by='system'
      from hit where s.id = hit.id returning s.id, s.event_id
  )
  insert into paradox_automation_log(event_id, kind, subject_id, detail)
    select event_id, 'auto_progress', id, 'breakeven reached → step auto-completed' from upd;
  get diagnostics n = row_count;

  -- greenlit → workspace status greenlit/live
  with hit as (
    select s.id, s.event_id from paradox_runbook_steps s
      join paradox_event_workspaces w on w.event_id = s.event_id
     where s.status <> 'done' and s.auto_condition = 'greenlit'
       and w.status in ('greenlit','live')
  ), upd as (
    update paradox_runbook_steps s set status='done', completed_at=now(), completed_by='system'
      from hit where s.id = hit.id returning s.id, s.event_id
  )
  insert into paradox_automation_log(event_id, kind, subject_id, detail)
    select event_id, 'auto_progress', id, 'event greenlit → step auto-completed' from upd;

  -- fixtures_published → workspace.fixtures_final
  with hit as (
    select s.id, s.event_id from paradox_runbook_steps s
      join paradox_event_workspaces w on w.event_id = s.event_id
     where s.status <> 'done' and s.auto_condition = 'fixtures_published' and w.fixtures_final
  ), upd as (
    update paradox_runbook_steps s set status='done', completed_at=now(), completed_by='system'
      from hit where s.id = hit.id returning s.id, s.event_id
  )
  insert into paradox_automation_log(event_id, kind, subject_id, detail)
    select event_id, 'auto_progress', id, 'fixtures published → step auto-completed' from upd;

  -- results_entered → any score row exists for the event
  with hit as (
    select s.id, s.event_id from paradox_runbook_steps s
     where s.status <> 'done' and s.auto_condition = 'results_entered'
       and exists (select 1 from paradox_scores sc where sc.event_id = s.event_id)
  ), upd as (
    update paradox_runbook_steps s set status='done', completed_at=now(), completed_by='system'
      from hit where s.id = hit.id returning s.id, s.event_id
  )
  insert into paradox_automation_log(event_id, kind, subject_id, detail)
    select event_id, 'auto_progress', id, 'results entered → step auto-completed' from upd;

  -- results_published → a published winner exists for the event
  with hit as (
    select s.id, s.event_id from paradox_runbook_steps s
     where s.status <> 'done' and s.auto_condition = 'results_published'
       and exists (select 1 from paradox_winners wn where wn.event_id = s.event_id and wn.published)
  ), upd as (
    update paradox_runbook_steps s set status='done', completed_at=now(), completed_by='system'
      from hit where s.id = hit.id returning s.id, s.event_id
  )
  insert into paradox_automation_log(event_id, kind, subject_id, detail)
    select event_id, 'auto_progress', id, 'winners published → step auto-completed' from upd;

  return n;
end $$;

-- ── 3. Chase + escalate overdue steps ───────────────────────────────────────
-- Replaces the one human who manually chased the whole team. Escalation ladder:
-- L0 owner (overdue), L1 head (overdue >24h), L2 core (overdue >72h). Re-nudges
-- at most once / 12h so it never spams. The actual message is rendered by the
-- Comms engine (Phase 7); here we compute + record who needs chasing.
create or replace function public.paradox_os_chase()
returns int language plpgsql security definer set search_path = public as $$
declare n int := 0;
begin
  with due as (
    select s.id, s.event_id,
           case when s.due_at < now() - interval '72 hours' then 2
                when s.due_at < now() - interval '24 hours' then 1
                else 0 end as lvl
      from paradox_runbook_steps s
     where s.status not in ('done')
       and s.due_at is not null and s.due_at < now()
       and (s.last_nudged_at is null or s.last_nudged_at < now() - interval '12 hours')
  ), upd as (
    update paradox_runbook_steps s
       set last_nudged_at = now(), escalation_level = greatest(s.escalation_level, due.lvl)
      from due where s.id = due.id returning s.id, s.event_id, due.lvl
  )
  insert into paradox_automation_log(event_id, kind, subject_id, level, detail)
    select event_id, case when lvl=0 then 'chase' else 'escalate' end, id, lvl,
           case lvl when 0 then 'overdue → nudge owner' when 1 then 'overdue 24h → escalate to head'
                    else 'overdue 72h → escalate to core' end
      from upd;
  get diagnostics n = row_count;
  return n;
end $$;

-- ── 4. One tick = resolve + auto-progress + chase (the scheduled heartbeat) ──
create or replace function public.paradox_os_tick()
returns text language plpgsql security definer set search_path = public as $$
declare progressed int; chased int;
begin
  perform public.paradox_os_resolve_due_dates();
  progressed := public.paradox_os_auto_progress();
  chased := public.paradox_os_chase();
  return format('tick ok · auto-progressed %s · chased %s', progressed, chased);
end $$;
grant execute on function public.paradox_os_tick() to authenticated;

-- ── 5. Greenlight gate (hard gate: registrations open only once greenlit) ───
-- A director commits the event to run. Logged + audited. Registrations check
-- workspace.status (wired on the public Register page in Phase 4).
create or replace function public.paradox_os_greenlight(p_event uuid)
returns text language plpgsql security definer set search_path = public as $$
declare cur text;
begin
  select status into cur from paradox_event_workspaces where event_id = p_event;
  if cur is null then raise exception 'No workspace for event %', p_event; end if;
  if cur in ('greenlit','live') then return 'already '||cur; end if;
  update paradox_event_workspaces
     set status='greenlit', greenlit_at=now()
   where event_id = p_event;
  insert into paradox_automation_log(event_id, kind, detail) values (p_event,'greenlight','event greenlit — registrations may open');
  return 'greenlit';
end $$;
grant execute on function public.paradox_os_greenlight(uuid) to authenticated;

-- ── 6. RLS for the log; schedule the tick ───────────────────────────────────
alter table public.paradox_automation_log enable row level security;
drop policy if exists "os admins read log" on public.paradox_automation_log;
create policy "os admins read log" on public.paradox_automation_log for select to authenticated using (true);
drop policy if exists "os admins write log" on public.paradox_automation_log;
create policy "os admins write log" on public.paradox_automation_log for insert to authenticated with check (true);

-- pg_cron heartbeat (every 15 min). If pg_cron isn't enabled this block errors
-- harmlessly — enable it in the Dashboard then re-run just this block.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('paradox-os-tick') where exists (select 1 from cron.job where jobname='paradox-os-tick');
    perform cron.schedule('paradox-os-tick', '*/15 * * * *', $cron$ select public.paradox_os_tick(); $cron$);
  end if;
end $$;

-- Verify
select public.paradox_os_tick();
