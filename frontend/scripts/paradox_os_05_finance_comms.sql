-- ──────────────────────────────────────────────────────────────────────────
-- Paradox OS · Phases 6-7 — Finance ledger + refund queue, and the Comms engine.
--
-- Run in the PARADOX SQL editor AFTER paradox_os_03_enforcement.sql. Idempotent.
-- Fixes: money on personal accounts + nothing reconciled (single ledger +
-- personal-account flag + refund queue), and missed/duplicate/off-brand
-- confirmations (logged, brand-checked message templates).
-- ──────────────────────────────────────────────────────────────────────────

-- ── Finance (Phase 6) ───────────────────────────────────────────────────────
create table if not exists public.paradox_ledger (
  id            uuid primary key default gen_random_uuid(),
  entry_date    date not null default current_date,
  description   text not null,
  sub_ledger    text,                       -- event / afterparty / sponsorship / stalls / ops
  method        text,                       -- upi / cash / bank / personal
  expenditure   numeric not null default 0,
  income        numeric not null default 0,
  event_id      uuid references public.paradox_events(id) on delete set null,
  bill          boolean not null default false,
  voucher       boolean not null default false,
  reconciled    boolean not null default false,
  personal_account boolean not null default false,  -- flag money that ran through a personal acct
  created_by    text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_pox_ledger_date on public.paradox_ledger(entry_date desc);

create table if not exists public.paradox_refunds (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid references public.paradox_registrations(id) on delete set null,
  event_id        uuid references public.paradox_events(id) on delete set null,
  amount          numeric not null,
  reason          text not null,            -- gate: a refund cannot be issued without a logged reason
  status          text not null default 'queued' check (status in ('queued','paid','rejected')),
  issued_by       text,
  issued_at       timestamptz,
  created_at      timestamptz not null default now()
);

-- Refund gate RPC — requires a reason; mirrors the refund into the ledger so
-- P&L stays single-source. (App-level `issue_refund` permission gates the UI.)
create or replace function public.paradox_os_issue_refund(p_reg uuid, p_amount numeric, p_reason text, p_actor text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_event uuid; v_id uuid;
begin
  if p_reason is null or btrim(p_reason) = '' then raise exception 'refund requires a reason'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'refund amount must be > 0'; end if;
  select event_id into v_event from paradox_registrations where id = p_reg;
  insert into paradox_refunds(registration_id, event_id, amount, reason, status, issued_by, issued_at)
    values (p_reg, v_event, p_amount, p_reason, 'paid', p_actor, now()) returning id into v_id;
  insert into paradox_ledger(description, sub_ledger, method, expenditure, event_id, created_by)
    values ('Refund — '||coalesce(p_reason,''), 'refund', 'upi', p_amount, v_event, p_actor);
  insert into paradox_automation_log(event_id, kind, subject_id, detail)
    values (v_event,'gate_block',p_reg,'refund issued ₹'||p_amount||' — '||p_reason);
  return v_id;
end $$;
grant execute on function public.paradox_os_issue_refund(uuid,numeric,text,text) to authenticated;

-- Live P&L view (after-party is the revenue hub).
create or replace view public.paradox_pnl as
  select coalesce(sub_ledger,'unsorted') as sub_ledger,
         sum(income) as income, sum(expenditure) as expenditure,
         sum(income) - sum(expenditure) as net,
         count(*) filter (where personal_account) as personal_rows,
         count(*) filter (where not reconciled) as unreconciled_rows
    from paradox_ledger group by coalesce(sub_ledger,'unsorted');

-- ── Comms engine (Phase 7) ──────────────────────────────────────────────────
create table if not exists public.paradox_message_templates (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  name        text not null,
  when_to_send text,
  audience    text default 'participant',   -- participant | group
  mode        text not null default 'manual' check (mode in ('auto','manual')),
  body        text not null,                -- tokens: {name} {event} {amount} {reference} {fixture} {venue} {booking}
  created_at  timestamptz not null default now()
);

create table if not exists public.paradox_message_log (
  id            uuid primary key default gen_random_uuid(),
  template_key  text,
  registration_id uuid,
  event_id      uuid,
  rendered_body text,
  sent_by       text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_pox_msglog_reg on public.paradox_message_log(registration_id);

-- Seed brand-checked templates (Paradox 4.0 / #Paradox2026 / correct sign-offs,
-- no AI tone). Re-runnable: on conflict do nothing.
insert into public.paradox_message_templates (key, name, when_to_send, audience, mode, body) values
  ('payment_request','Payment request','after sign-up, slot on hold','participant','manual',
   E'Hi {name}, your spot for {event} at Paradox 4.0 is held. Send ₹{amount} to confirm — UPI ref {reference}. Holds for 24h, then it opens up.\n-Team AQ #Paradox2026'),
  ('registration_confirmation','Registration confirmed','on payment verified','participant','auto',
   E'You''re in, {name}. {event} at Paradox 4.0 is confirmed. Your ticket: {booking}. We''ll send fixtures + venue closer to the day.\n-Team AQ #Paradox2026'),
  ('over_cap','Waitlisted (over cap)','when cap is hit','participant','auto',
   E'Hi {name}, {event} is full so you''re on the waitlist for Paradox 4.0. If a spot frees up we''ll message you first.\n-Team AQ #Paradox2026'),
  ('refund_confirmation','Refund confirmed','on refund issued','participant','auto',
   E'Hi {name}, your ₹{amount} for {event} has been refunded. Sorry it didn''t work out — hope to see you at Paradox 4.0 elsewhere.\n-Team AQ #Paradox2026'),
  ('fixtures','Fixtures released','when fixtures publish','group','manual',
   E'{event} fixtures are out. Your first one: {fixture} at {venue}. Reach 15 min early. Full schedule on the site.\n-Team Paradox 2026 #Paradox2026'),
  ('winner','Winner announcement','after results publish','group','manual',
   E'Results are in for {event} at Paradox 4.0. Congratulations to the winners — certificates are on the way. Thank you for playing.\n-Team Paradox 2026 #Paradox2026')
on conflict (key) do nothing;

-- RLS
do $$
declare t text;
begin
  foreach t in array array['paradox_ledger','paradox_refunds','paradox_message_templates','paradox_message_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "os admins all" on public.%I', t);
    execute format('create policy "os admins all" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

select 'phases 6-7 ok' as status;
