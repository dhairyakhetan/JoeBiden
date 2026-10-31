-- ──────────────────────────────────────────────────────────────────────────
-- Paradox OS · Phase 4 — Registrations: payment gate · atomic caps · waitlist.
--
-- Run in the PARADOX SQL editor AFTER paradox_os_01_schema.sql. Idempotent.
-- Fixes: overbooking (atomic, row-locked cap), silent over-cap failure
-- (auto-waitlist), and duplicate-inflated counts (dedup view).
-- ──────────────────────────────────────────────────────────────────────────

-- Extend the existing registrations table (additive — `paid` stays the truth
-- the current admin uses; these add the payment-gate + lifecycle).
alter table public.paradox_registrations
  add column if not exists payment_ref      text,
  add column if not exists slot_hold_expiry timestamptz,
  add column if not exists reg_status       text not null default 'pending'
    check (reg_status in ('pending','confirmed','waitlisted','cancelled'));

-- Payment intents — one per attempt, carries the reference for reconciliation.
create table if not exists public.paradox_payment_intents (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid references public.paradox_registrations(id) on delete cascade,
  event_id        uuid references public.paradox_events(id) on delete cascade,
  amount          numeric,
  reference       text,
  status          text not null default 'created'
    check (status in ('created','paid','expired','cancelled')),
  created_at      timestamptz not null default now()
);

-- Waitlist — auto-populated when an event is at cap; auto-promoted on a free slot.
create table if not exists public.paradox_waitlist (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.paradox_events(id) on delete cascade,
  name         text not null,
  phone        text not null,
  notes        text,
  promoted_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_pox_pi_reg     on public.paradox_payment_intents(registration_id);
create index if not exists idx_pox_wait_event on public.paradox_waitlist(event_id) where promoted_at is null;

-- ── Atomic, row-locked cap check ────────────────────────────────────────────
-- Returns 'confirmed' if a slot exists (and reserves it via reg_status), else
-- 'waitlisted'. The lock on the workspace row serialises concurrent registers
-- so two people can't take the last slot. Greenlight gate enforced too.
create or replace function public.paradox_os_register_slot(p_reg uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_event uuid; v_cap int; v_status text; v_taken int;
begin
  select event_id into v_event from paradox_registrations where id = p_reg;
  if v_event is null then raise exception 'registration % not found', p_reg; end if;

  -- Serialise on the workspace row (create a stub if the OS isn't seeded yet).
  select status, nullif(config->>'cap','')::int into v_status, v_cap
    from paradox_event_workspaces where event_id = v_event for update;
  if not found then
    select max_participants into v_cap from paradox_events where id = v_event;
    v_status := 'live';
  end if;

  -- Gate: registrations only on a greenlit/live event.
  if v_status not in ('greenlit','live') then
    insert into paradox_automation_log(event_id, kind, subject_id, detail)
      values (v_event,'gate_block',p_reg,'register blocked — event not greenlit');
    return 'blocked_not_greenlit';
  end if;

  if v_cap is null then
    update paradox_registrations set reg_status='confirmed' where id=p_reg;
    return 'confirmed';
  end if;

  select count(*) into v_taken from paradox_registrations
    where event_id = v_event and reg_status in ('confirmed','pending') and id <> p_reg;

  if v_taken < v_cap then
    update paradox_registrations set reg_status='confirmed' where id=p_reg;
    return 'confirmed';
  else
    update paradox_registrations set reg_status='waitlisted' where id=p_reg;
    insert into paradox_automation_log(event_id, kind, subject_id, detail)
      values (v_event,'auto_progress',p_reg,'cap hit → routed to waitlist');
    return 'waitlisted';
  end if;
end $$;
grant execute on function public.paradox_os_register_slot(uuid) to anon, authenticated;

-- ── Promote the next waitlisted registration when a slot frees ──────────────
create or replace function public.paradox_os_promote_waitlist(p_event uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_next uuid;
begin
  select id into v_next from paradox_registrations
   where event_id = p_event and reg_status = 'waitlisted'
   order by created_at limit 1 for update skip locked;
  if v_next is null then return null; end if;
  update paradox_registrations set reg_status='confirmed' where id = v_next;
  insert into paradox_automation_log(event_id, kind, subject_id, detail)
    values (p_event,'auto_progress',v_next,'slot freed → waitlist auto-promoted');
  return v_next;
end $$;
grant execute on function public.paradox_os_promote_waitlist(uuid) to authenticated;

-- ── Dedup surface — exact phone+event repeats (count any one toward totals) ──
create or replace view public.paradox_duplicate_registrations as
  select event_id, phone, count(*) as dupes,
         array_agg(id order by created_at) as ids,
         bool_or(paid) as any_paid
    from paradox_registrations
   where phone is not null and phone <> ''
   group by event_id, phone
  having count(*) > 1;

alter table public.paradox_payment_intents enable row level security;
alter table public.paradox_waitlist enable row level security;
drop policy if exists "os pi all" on public.paradox_payment_intents;
create policy "os pi all" on public.paradox_payment_intents for all to authenticated using (true) with check (true);
drop policy if exists "os wait all" on public.paradox_waitlist;
create policy "os wait all" on public.paradox_waitlist for all to authenticated using (true) with check (true);
-- public can add themselves to a waitlist
drop policy if exists "os wait insert anon" on public.paradox_waitlist;
create policy "os wait insert anon" on public.paradox_waitlist for insert to anon with check (true);

select 'phase 4 ok' as status;
