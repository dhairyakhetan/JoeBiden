-- =====================================================================
-- TerraThon 2026: the complete backend, transcribed from the live database.
--
-- STATUS: ALREADY APPLIED. Every object below exists in the live project
-- (ref hzowuwffjqtgszecngpe) as of 2026-09-21, including the TOO_YOUNG guard
-- in terrathon_register, which was applied as its own migration on that date
-- (terrathon_register_reject_too_young_instead_of_crashing). This file does
-- NOT introduce a change. Do not "run the pending migration"; there isn't one.
--
-- WHY THIS FILE EXISTS
--
-- It did not, until now. The TerraThon feature shipped 5 tables, 1 view, 7
-- functions, 2 triggers, 15 indexes and 5 RLS policies straight into the live
-- database with no checked-in SQL anywhere in the repo. The repo holds 155
-- .sql files and not one of them mentioned TerraThon.
--
-- That was a problem in three directions:
--
--   1. Nobody could rebuild it. Restore an older snapshot, spin up a branch
--      database, or move projects, and the entire backend for this feature is
--      gone with no way to recreate it. The frontend would build and deploy
--      perfectly and every page would fail at runtime.
--
--   2. Nobody could review it. The only things standing between a stranger
--      and several hundred students' names and phone numbers are the RLS
--      policies and the SECURITY DEFINER function at the bottom of this file.
--      None of it was visible in the branch, so a code review of this feature
--      could only ever cover the half that does not enforce anything.
--
--   3. Nobody could tell intent from accident. `hold_hours` sitting NULL on
--      every event, which quietly disables the whole unpaid-hold expiry
--      mechanism (see the note under the seed section), is indistinguishable
--      from a deliberate choice when there is no file to read.
--
-- This file is therefore documentation first and a rebuild script second. It
-- is written to be re-runnable: `if not exists` on every create, `or replace`
-- on every function, `drop ... if exists` before each policy. Running it
-- against the live database should be a no-op.
--
-- SHAPE OF THE THING
--
-- A student registers from the public site with no account at all. anon cannot
-- touch any terrathon_* table directly; it gets exactly two doors:
--
--   * terrathon_public_events, a SECURITY DEFINER view exposing only the
--     columns a poster needs, plus two computed flags. No PII passes through
--     it. The Supabase linter flags it as security_definer_view; that is
--     correct and deliberate. Do not "fix" it to security_invoker, which would
--     blank the public site for every signed-out visitor.
--
--   * terrathon_register(payload jsonb), a SECURITY DEFINER function that
--     validates everything itself and writes the row. Also linter-flagged as
--     anon-executable, also deliberate: it IS the public signup path.
--
-- Everything else (reading registrations, marking payment, checking people in
-- at the gate) requires a signed-in session carrying a leader role, and is
-- gated by RLS on is_director() or is_super_admin(). There is no API server in
-- this product, so the policies below are not a second line of defence. They
-- are the only line.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------

create table if not exists public.terrathon_events (
  id uuid default gen_random_uuid() not null,
  slug text not null,
  display_name text not null,
  paradox_name text,
  status text default 'open'::text not null,
  fee_inr numeric not null,
  team_size_min integer default 1 not null,
  team_size_max integer default 1 not null,
  roster_min_at_signup integer default 0 not null,
  cap integer not null,
  breakeven integer not null,
  next_seq integer default 0 not null,
  prize_pool_inr numeric,
  prize_split jsonb,
  venue text,
  venue_map_url text,
  day_first date,
  day_last date,
  report_time text,
  match_window text,
  rules_md text,
  closes_at timestamp with time zone,
  hold_hours integer,
  go_nogo_at timestamp with time zone,
  sort_order integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  ref_prefix text,
  constraint terrathon_events_pkey primary key (id),
  constraint terrathon_events_slug_key unique (slug),
  constraint terrathon_events_display_name_key unique (display_name),
  constraint terrathon_events_status_check
    check (status = any (array['open'::text, 'closed'::text, 'cancelled'::text]))
);

create table if not exists public.terrathon_registrations (
  id uuid default gen_random_uuid() not null,
  ref_code text not null,
  event_id uuid not null,
  client_request_id uuid not null,
  captain_name text not null,
  class_label text,
  school text,
  phone text not null,
  email text,
  team_name text,
  guardian_consent boolean default false not null,
  rules_consent boolean default false not null,
  updates_opt_in boolean default false not null,
  status text default 'pending_payment'::text not null,
  wa_texted_by integer,
  wa_texted_at timestamp with time zone,
  paid boolean default false not null,
  paid_at timestamp with time zone,
  paid_by integer,
  amount_paid_inr numeric,
  utr text,
  utr_submitted_at timestamp with time zone,
  hold_expires_at timestamp with time zone,
  ticket_token uuid,
  ticket_sent_at timestamp with time zone,
  notes text,
  source text default 'web'::text not null,
  cap_override boolean default false not null,
  utm jsonb,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  age integer,
  dob date,
  constraint terrathon_registrations_pkey primary key (id),
  constraint terrathon_registrations_ref_code_key unique (ref_code),
  constraint terrathon_registrations_event_id_fkey
    foreign key (event_id) references public.terrathon_events(id),
  constraint terrathon_registrations_paid_by_fkey
    foreign key (paid_by) references public.members(member_id),
  constraint terrathon_registrations_wa_texted_by_fkey
    foreign key (wa_texted_by) references public.members(member_id),
  constraint terrathon_registrations_status_check
    check (status = any (array['pending_payment'::text, 'payment_claimed'::text,
                               'confirmed'::text, 'waitlist'::text,
                               'hold_expired'::text, 'cancelled'::text])),
  constraint terrathon_registrations_source_check
    check (source = any (array['web'::text, 'on_spot'::text, 'admin'::text])),
  -- Note the shape of this one: age is NULLABLE and only range-checked when
  -- present. The current build sends dob and lets the function derive age; the
  -- constraint has to stay permissive for the rows the legacy age-only path
  -- wrote. See the TOO_OLD / legacy note in terrathon_register below.
  constraint terrathon_reg_age_sane
    check ((age is null) or ((age >= 5) and (age <= 99)))
);

create table if not exists public.terrathon_roster (
  id uuid default gen_random_uuid() not null,
  registration_id uuid not null,
  full_name text not null,
  is_substitute boolean default false not null,
  added_at timestamp with time zone default now() not null,
  constraint terrathon_roster_pkey primary key (id),
  -- ON DELETE CASCADE here and nowhere else: a roster line has no meaning
  -- without its registration, whereas a check-in or an audit row is evidence
  -- and must survive.
  constraint terrathon_roster_registration_id_fkey
    foreign key (registration_id) references public.terrathon_registrations(id) on delete cascade
);

create table if not exists public.terrathon_checkins (
  id uuid default gen_random_uuid() not null,
  registration_id uuid not null,
  event_day date not null,
  scanned_at timestamp with time zone default now() not null,
  scanned_by integer,
  method text default 'qr'::text not null,
  headcount integer,
  constraint terrathon_checkins_pkey primary key (id),
  constraint terrathon_checkins_registration_id_fkey
    foreign key (registration_id) references public.terrathon_registrations(id),
  constraint terrathon_checkins_scanned_by_fkey
    foreign key (scanned_by) references public.members(member_id),
  constraint terrathon_checkins_method_check
    check (method = any (array['qr'::text, 'manual_code'::text]))
);

create table if not exists public.terrathon_audit_log (
  id uuid default gen_random_uuid() not null,
  registration_id uuid,
  actor integer,
  action text not null,
  before jsonb,
  after jsonb,
  created_at timestamp with time zone default now() not null,
  constraint terrathon_audit_log_pkey primary key (id),
  constraint terrathon_audit_log_registration_id_fkey
    foreign key (registration_id) references public.terrathon_registrations(id),
  constraint terrathon_audit_log_actor_fkey
    foreign key (actor) references public.members(member_id)
);


-- ---------------------------------------------------------------------
-- 2. INDEXES
--
-- The three partial unique indexes are the ones that matter. terrathon_register
-- checks for a duplicate phone and a taken team name in application code
-- first, for a friendly error code; these indexes are what actually holds when
-- two people submit at the same instant and both application checks pass.
-- Each excludes cancelled and hold_expired rows, so a cancelled entry frees
-- its phone number and its team name for re-use.
-- ---------------------------------------------------------------------

create index if not exists terrathon_reg_event_created
  on public.terrathon_registrations using btree (event_id, created_at desc);

create unique index if not exists terrathon_reg_idempotency
  on public.terrathon_registrations using btree (client_request_id);

create unique index if not exists terrathon_reg_one_per_phone
  on public.terrathon_registrations using btree (event_id, phone)
  where (status <> all (array['cancelled'::text, 'hold_expired'::text]));

create unique index if not exists terrathon_reg_team_name
  on public.terrathon_registrations using btree (event_id, lower(team_name))
  where ((team_name is not null)
     and (status <> all (array['cancelled'::text, 'hold_expired'::text])));

create unique index if not exists terrathon_reg_ticket_token
  on public.terrathon_registrations using btree (ticket_token)
  where (ticket_token is not null);

create unique index if not exists terrathon_checkin_one_per_day
  on public.terrathon_checkins using btree (registration_id, event_day);

create index if not exists terrathon_roster_reg
  on public.terrathon_roster using btree (registration_id);


-- ---------------------------------------------------------------------
-- 3. HELPER FUNCTIONS
-- ---------------------------------------------------------------------

-- Which member row is behind the current session. Mirrors current_member_id()
-- but is kept separate so the TerraThon surface never depends on a change made
-- for the HoD desk.
create or replace function public.terrathon_current_member_id()
returns integer
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select m.member_id from public.members m where m.auth_uid = auth.uid() limit 1;
$function$;

-- How many slots an event has actually spoken for.
--
-- Read the last clause carefully. A row counts if it is paid, OR has a UTR, OR
-- has no expiry at all, OR has an expiry still in the future. That third arm,
-- `hold_expires_at is null`, means an unexpiring hold counts forever. Since
-- terrathon_register only sets hold_expires_at when the event's hold_hours is
-- non-null, leaving hold_hours NULL makes every unpaid registration a
-- permanent claim on a slot. See the seed section.
create or replace function public.terrathon_held_slots(p_event_id uuid)
returns integer
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select count(*)::int
    from public.terrathon_registrations r
   where r.event_id = p_event_id
     and r.status not in ('cancelled','waitlist','hold_expired')
     and ( r.paid
        or r.utr is not null
        or r.hold_expires_at is null
        or r.hold_expires_at > now() );
$function$;

-- The countdown's source of truth. A device with a wrong clock would otherwise
-- show a wrong countdown, and on the morning of an event that is the
-- difference between arriving and not. SECURITY INVOKER on purpose: it reads
-- nothing.
create or replace function public.terrathon_server_now()
returns timestamp with time zone
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$ select now(); $function$;

create or replace function public.terrathon_touch_updated_at()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin new.updated_at := now(); return new; end;
$function$;


-- ---------------------------------------------------------------------
-- 4. THE REGISTRATION WRITE TRIGGER
--
-- This is where a ticket is born. Nothing else in the system mints a
-- ticket_token. The desk flips paid to true, and this trigger stamps paid_at,
-- records who did it, generates the token the QR encodes, and moves the row to
-- confirmed. Un-flipping paid reverses all of it and sends the row back to
-- payment_claimed or pending_payment depending on whether a UTR was given.
--
-- Consequence worth stating out loud: a registration cannot be checked in
-- until someone marks it paid, because terrathon_check_in looks the row up BY
-- ticket_token and there is no token before payment.
-- ---------------------------------------------------------------------

create or replace function public.terrathon_on_registration_write()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if tg_op = 'UPDATE' then
    if new.paid = true and old.paid = false then
      new.paid_at := now();
      new.paid_by := coalesce(new.paid_by, public.terrathon_current_member_id());
      if new.ticket_token is null then
        new.ticket_token := gen_random_uuid();
      end if;
      new.status := 'confirmed';
    elsif new.paid = false and old.paid = true then
      new.paid_at := null;
      new.paid_by := null;
      new.status  := case when new.utr is not null then 'payment_claimed'
                          else 'pending_payment' end;
    end if;

    if new.wa_texted_by is not null and old.wa_texted_by is null then
      new.wa_texted_at := now();
    elsif new.wa_texted_by is null then
      new.wa_texted_at := null;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists trg_terrathon_events_touch on public.terrathon_events;
create trigger trg_terrathon_events_touch
  before update on public.terrathon_events
  for each row execute function public.terrathon_touch_updated_at();

drop trigger if exists trg_terrathon_registration_write on public.terrathon_registrations;
create trigger trg_terrathon_registration_write
  before update on public.terrathon_registrations
  for each row execute function public.terrathon_on_registration_write();


-- ---------------------------------------------------------------------
-- 5. THE PUBLIC VIEW
--
-- The only thing a signed-out visitor may read. Note what is NOT here: no
-- captain_name, no phone, no email, no cap, no next_seq, no breakeven. The two
-- computed columns exist so the browser never has to be trusted with the
-- arithmetic: `accepting` is what the register form gates on, and it is
-- recomputed server-side on every read.
--
-- SECURITY DEFINER (the default for a view) is load-bearing here. It is what
-- lets anon read event data through this view while RLS keeps anon out of
-- terrathon_events itself.
-- ---------------------------------------------------------------------

create or replace view public.terrathon_public_events as
  select e.slug,
         e.display_name,
         e.status,
         e.fee_inr,
         e.team_size_min,
         e.team_size_max,
         e.roster_min_at_signup,
         e.prize_pool_inr,
         e.prize_split,
         e.venue,
         e.venue_map_url,
         e.day_first,
         e.day_last,
         e.report_time,
         e.match_window,
         e.rules_md,
         e.closes_at,
         e.sort_order,
         held.n >= greatest(1, e.cap * 7 / 10) as filling_fast,
         e.status = 'open'::text
           and (e.closes_at is null or e.closes_at > now())
           and held.n < e.cap                 as accepting
    from public.terrathon_events e
    cross join lateral ( select count(*)::integer as n
                           from public.terrathon_registrations r
                          where r.event_id = e.id
                            and (r.status <> all (array['cancelled'::text, 'waitlist'::text, 'hold_expired'::text]))
                            and (r.paid or r.utr is not null
                                 or r.hold_expires_at is null
                                 or r.hold_expires_at > now()) ) held;


-- ---------------------------------------------------------------------
-- 6. THE PUBLIC REGISTRATION FUNCTION
--
-- Callable by anon. Everything it trusts, it re-derives. Every error is a
-- stable code string, never a raw Postgres message, so the browser can say
-- something a 15-year-old understands without leaking schema detail.
--
-- Codes it can return: BAD_REQUEST, NO_SUCH_EVENT, EVENT_CLOSED, INVALID_NAME,
-- INVALID_DOB, TOO_OLD (carries min_dob), TOO_YOUNG (carries min_age),
-- INVALID_PHONE, CONSENT_REQUIRED, DUPLICATE, TEAM_NAME_TAKEN. On success: ok,
-- ref_code, status, fee_inr, display_name, plus `replayed: true` when
-- idempotency caught a resubmission.
--
-- TOO_YOUNG was added on 2026-09-21 and is the only change this file has made
-- to live behaviour. Before it, the dob branch checked a ceiling and no floor,
-- while the table carries CHECK (age between 5 and 99). A date of birth inside
-- the last five years passed every check the function made, reached the INSERT
-- and raised an uncaught 23514. Measured, in a rolled-back transaction:
--   dob 2023-06-01 -> ERROR 23514 ... violates "terrathon_reg_age_sane"
-- The browser cannot tell that from the network dying, so the form said
-- "Couldn't reach the server", and retrying resubmitted the same date forever,
-- on a date the form had already painted green. The floor is 5 to match the
-- constraint exactly, so no registration that used to succeed now fails.
--
-- Two behaviours to know before changing anything here:
--
--   * The cut-off is `v_dob < c_min_dob`, strictly less than. 2005-01-01
--     itself is ELIGIBLE. The register form's green/red verdict must agree on
--     that exact boundary or a student born on New Year's Day 2005 sees green
--     and is then refused by the server.
--
--   * The legacy `age` branch is reachable only when dob is absent or
--     unparseable, and it is NOT gated on the cut-off: it accepts 5 to 99.
--     The live site always sends a dob, so no visitor can reach it, but the
--     function is anon-callable over REST and a hand-made payload can. It is
--     kept because rows written by the earlier age-only build still exist.
--     Anyone tightening eligibility must close this branch too.
--
--   * `select ... for update` on the event row serialises concurrent signups
--     per event, which is what makes the cap and next_seq arithmetic safe.
-- ---------------------------------------------------------------------

create or replace function public.terrathon_register(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_event    public.terrathon_events%rowtype;
  v_existing public.terrathon_registrations%rowtype;
  v_phone    text;
  v_status   text;
  v_seq      int;
  v_ref      text;
  v_id       uuid;
  v_member   text;
  v_held     int;
  v_age      int;
  v_dob      date;
  v_name     text;
  c_min_dob  constant date := date '2005-01-01';
  c_min_age  constant int  := 5;
begin
  if coalesce(payload->>'website','') <> '' then
    return jsonb_build_object('ok', true, 'ref_code', 'TT26-XXX-000', 'status', 'pending_payment');
  end if;

  if (payload->>'client_request_id') is null then
    return jsonb_build_object('ok', false, 'code', 'BAD_REQUEST');
  end if;

  select * into v_existing from public.terrathon_registrations
   where client_request_id = (payload->>'client_request_id')::uuid;
  if found then
    select * into v_event from public.terrathon_events where id = v_existing.event_id;
    return jsonb_build_object('ok', true, 'ref_code', v_existing.ref_code,
                              'status', v_existing.status, 'replayed', true,
                              'fee_inr', v_event.fee_inr,
                              'display_name', v_event.display_name);
  end if;

  select * into v_event from public.terrathon_events
   where slug = payload->>'sport' for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NO_SUCH_EVENT');
  end if;

  if v_event.status <> 'open'
     or (v_event.closes_at is not null and v_event.closes_at <= now()) then
    return jsonb_build_object('ok', false, 'code', 'EVENT_CLOSED');
  end if;

  v_name := btrim(coalesce(payload->>'captain_name',''));
  if length(v_name) < 2 or length(v_name) > 80 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_NAME');
  end if;

  -- Current build: a date, gated on the cut-off.
  begin
    v_dob := nullif(payload->>'dob','')::date;
  exception when others then
    v_dob := null;
  end;

  if v_dob is not null then
    if v_dob > current_date then
      return jsonb_build_object('ok', false, 'code', 'INVALID_DOB');
    end if;
    if v_dob < c_min_dob then
      return jsonb_build_object('ok', false, 'code', 'TOO_OLD',
                                'min_dob', to_char(c_min_dob, 'YYYY-MM-DD'));
    end if;
    v_age := extract(year from age(current_date, v_dob))::int;

    -- The guard this function was missing until 2026-09-21. Without it the
    -- INSERT below trips terrathon_reg_age_sane and raises an uncaught 23514
    -- out of a SECURITY DEFINER function, which the browser can only report as
    -- a failed request. See the note in the header.
    if v_age < c_min_age then
      return jsonb_build_object('ok', false, 'code', 'TOO_YOUNG',
                                'min_age', c_min_age);
    end if;
  else
    -- Legacy build: an age and no date. Accepted, not gated; see the header.
    v_age := nullif(payload->>'age','')::int;
    if v_age is null or v_age < 5 or v_age > 99 then
      return jsonb_build_object('ok', false, 'code', 'INVALID_DOB');
    end if;
  end if;

  v_phone := regexp_replace(coalesce(payload->>'phone',''), '[^0-9]', '', 'g');
  if length(v_phone) = 12 and left(v_phone,2) = '91' then
    v_phone := right(v_phone, 10);
  end if;
  if length(v_phone) = 11 and left(v_phone,1) = '0' then
    v_phone := right(v_phone, 10);
  end if;
  if v_phone !~ '^[6-9][0-9]{9}$' then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PHONE');
  end if;
  v_phone := '+91' || v_phone;

  if coalesce(payload->>'rules_consent','false') <> 'true' then
    return jsonb_build_object('ok', false, 'code', 'CONSENT_REQUIRED');
  end if;

  if exists (select 1 from public.terrathon_registrations
              where event_id = v_event.id and phone = v_phone
                and status not in ('cancelled','hold_expired')) then
    return jsonb_build_object('ok', false, 'code', 'DUPLICATE');
  end if;

  if nullif(btrim(coalesce(payload->>'team_name','')),'') is not null
     and exists (select 1 from public.terrathon_registrations
                  where event_id = v_event.id
                    and lower(team_name) = lower(btrim(payload->>'team_name'))
                    and status not in ('cancelled','hold_expired')) then
    return jsonb_build_object('ok', false, 'code', 'TEAM_NAME_TAKEN');
  end if;

  v_held := public.terrathon_held_slots(v_event.id);
  v_status := case when v_held >= v_event.cap then 'waitlist' else 'pending_payment' end;

  v_seq := v_event.next_seq + 1;
  update public.terrathon_events set next_seq = v_seq where id = v_event.id;
  v_ref := 'TT26-' || coalesce(v_event.ref_prefix, upper(left(v_event.slug,3)))
           || '-' || lpad(v_seq::text, 3, '0');

  insert into public.terrathon_registrations (
    ref_code, event_id, client_request_id, captain_name, age, dob, class_label, school,
    phone, email, team_name, guardian_consent, rules_consent, updates_opt_in,
    status, source, utm, hold_expires_at
  ) values (
    v_ref, v_event.id, (payload->>'client_request_id')::uuid,
    v_name, v_age, v_dob,
    nullif(btrim(coalesce(payload->>'class_label','')),''),
    nullif(btrim(coalesce(payload->>'school','')),''),
    v_phone, nullif(btrim(coalesce(payload->>'email','')),''),
    nullif(btrim(coalesce(payload->>'team_name','')),''),
    coalesce(payload->>'guardian_consent','false') = 'true',
    true, coalesce(payload->>'updates_opt_in','false') = 'true',
    v_status,
    coalesce(nullif(payload->>'source',''), 'web'),
    payload->'utm',
    case when v_event.hold_hours is null or v_status = 'waitlist' then null
         else now() + make_interval(hours => v_event.hold_hours) end
  ) returning id into v_id;

  -- A roster line outside 2..80 characters is SKIPPED, not rejected. The
  -- captain gets a success screen and a team one player short, and finds out
  -- at the gate. If that is ever unacceptable, this loop is where to raise.
  for v_member in select jsonb_array_elements_text(coalesce(payload->'roster','[]'::jsonb))
  loop
    if length(btrim(v_member)) between 2 and 80 then
      insert into public.terrathon_roster (registration_id, full_name)
      values (v_id, btrim(v_member));
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'ref_code', v_ref, 'status', v_status,
                            'fee_inr', v_event.fee_inr,
                            'display_name', v_event.display_name);
end;
$function$;


-- ---------------------------------------------------------------------
-- 7. THE GATE
--
-- Leader-only, and it says so itself rather than relying on the caller. p_day
-- comes from the scanning device so a volunteer can correct a wrong clock from
-- the desk UI; the WRONG_DAY branch is what stops a Saturday ticket being used
-- on Sunday. The unique index on (registration_id, event_day) is what stops
-- the same team walking in twice on one day when two volunteers scan at once.
--
-- Results: FORBIDDEN, INVALID, NOT_CONFIRMED, WRONG_DAY, ALREADY_IN, OK.
-- ---------------------------------------------------------------------

create or replace function public.terrathon_check_in(p_token uuid, p_day date)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  r public.terrathon_registrations%rowtype;
  e public.terrathon_events%rowtype;
  prior public.terrathon_checkins%rowtype;
  who text;
begin
  if not (is_director() or is_super_admin()) then
    return jsonb_build_object('result','FORBIDDEN');
  end if;

  select * into r from public.terrathon_registrations where ticket_token = p_token;
  if not found then
    return jsonb_build_object('result','INVALID');
  end if;

  select * into e from public.terrathon_events where id = r.event_id;

  if r.status = 'cancelled' then
    return jsonb_build_object('result','INVALID', 'ref_code', r.ref_code);
  end if;

  if not r.paid then
    return jsonb_build_object('result','NOT_CONFIRMED', 'ref_code', r.ref_code,
                              'display_name', e.display_name);
  end if;

  if p_day < e.day_first or p_day > coalesce(e.day_last, e.day_first) then
    return jsonb_build_object('result','WRONG_DAY', 'ref_code', r.ref_code,
                              'display_name', e.display_name,
                              'day_first', e.day_first, 'day_last', e.day_last);
  end if;

  select * into prior from public.terrathon_checkins
   where registration_id = r.id and event_day = p_day;
  if found then
    select m.full_name into who from public.members m where m.member_id = prior.scanned_by;
    return jsonb_build_object('result','ALREADY_IN', 'ref_code', r.ref_code,
                              'scanned_at', prior.scanned_at, 'scanned_by', who);
  end if;

  insert into public.terrathon_checkins (registration_id, event_day, scanned_by, method)
  values (r.id, p_day, public.terrathon_current_member_id(), 'qr');

  return jsonb_build_object('result','OK', 'ref_code', r.ref_code,
                            'display_name', e.display_name,
                            'team_name', r.team_name,
                            'captain_name', r.captain_name,
                            'players', 1 + (select count(*) from public.terrathon_roster
                                             where registration_id = r.id));
end;
$function$;


-- ---------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY
--
-- Read the note in CLAUDE.md about this project's default ACL: a new table
-- here inherits table-level grants for `authenticated`, so the GRANT statements
-- are not the gate and never were. RLS is. Every policy below is scoped to the
-- `authenticated` role and to leaders only; `anon` appears in none of them and
-- therefore cannot read or write any of these tables by any path except the
-- view and the function above.
--
-- terrathon_audit_log is deliberately SELECT-only even for a leader. Evidence
-- that the desk itself can rewrite is not evidence.
-- ---------------------------------------------------------------------

alter table public.terrathon_events        enable row level security;
alter table public.terrathon_registrations enable row level security;
alter table public.terrathon_roster        enable row level security;
alter table public.terrathon_checkins      enable row level security;
alter table public.terrathon_audit_log     enable row level security;

drop policy if exists tt_events_leader_all on public.terrathon_events;
create policy tt_events_leader_all on public.terrathon_events
  for all to authenticated
  using (is_director() or is_super_admin())
  with check (is_director() or is_super_admin());

drop policy if exists tt_reg_leader_all on public.terrathon_registrations;
create policy tt_reg_leader_all on public.terrathon_registrations
  for all to authenticated
  using (is_director() or is_super_admin())
  with check (is_director() or is_super_admin());

drop policy if exists tt_roster_leader_all on public.terrathon_roster;
create policy tt_roster_leader_all on public.terrathon_roster
  for all to authenticated
  using (is_director() or is_super_admin())
  with check (is_director() or is_super_admin());

drop policy if exists tt_checkin_leader_all on public.terrathon_checkins;
create policy tt_checkin_leader_all on public.terrathon_checkins
  for all to authenticated
  using (is_director() or is_super_admin())
  with check (is_director() or is_super_admin());

drop policy if exists tt_audit_leader_read on public.terrathon_audit_log;
create policy tt_audit_leader_read on public.terrathon_audit_log
  for select to authenticated
  using (is_director() or is_super_admin());


-- ---------------------------------------------------------------------
-- 9. GRANTS
--
-- REVOKE FROM PUBLIC FIRST. This is the part that is easy to get wrong and
-- impossible to notice.
--
-- Postgres grants EXECUTE on a new function to PUBLIC by default, and `anon`
-- inherits it. So `revoke execute ... from anon` does NOTHING while the PUBLIC
-- grant stands. The function stays callable by a signed-out stranger over
-- /rest/v1/rpc/, and every check you write afterwards passes, because you are
-- asking about `anon` and the privilege is arriving from somewhere else.
--
-- The live database has PUBLIC revoked on six of these seven (verified against
-- pg_proc.proacl on 2026-09-21: only terrathon_server_now still carries the
-- bare `=X/postgres` entry that means PUBLIC). Reproducing that state requires
-- the revoke-then-grant pairing below, in that order.
--
-- terrathon_server_now is left open deliberately. It returns now() and reads
-- nothing, and the countdown needs it before anyone signs in.
--
-- The end state anon should have: the view, terrathon_register, and
-- terrathon_server_now. Nothing else.
-- ---------------------------------------------------------------------

revoke execute on function public.terrathon_register(jsonb)             from public;
revoke execute on function public.terrathon_check_in(uuid, date)        from public;
revoke execute on function public.terrathon_held_slots(uuid)            from public;
revoke execute on function public.terrathon_current_member_id()         from public;
revoke execute on function public.terrathon_on_registration_write()     from public;
revoke execute on function public.terrathon_touch_updated_at()          from public;

grant select on public.terrathon_public_events to anon, authenticated;

grant execute on function public.terrathon_register(jsonb)      to anon, authenticated;
grant execute on function public.terrathon_server_now()         to anon, authenticated;
grant execute on function public.terrathon_check_in(uuid, date) to authenticated;
grant execute on function public.terrathon_held_slots(uuid)     to authenticated;
grant execute on function public.terrathon_current_member_id()  to authenticated;

-- The two trigger functions get no grant at all. Nothing calls them directly;
-- they run as part of the trigger, which runs as the table owner.


-- ---------------------------------------------------------------------
-- 10. SEED: the three events, as configured live on 2026-09-21
--
-- Guarded by `where not exists`, so re-running this file NEVER overwrites a
-- value someone has since tuned from the desk. To rebuild from scratch, run it
-- against an empty table. To copy a change made here onto a live row, write
-- the UPDATE by hand and say so in a new dated file.
--
-- READ THIS BEFORE THE EVENT: hold_hours is NULL on all three rows.
--
-- terrathon_register only sets hold_expires_at when hold_hours is non-null,
-- and terrathon_held_slots counts any row whose hold_expires_at is null as a
-- live claim. With hold_hours NULL, the entire unpaid-hold expiry mechanism is
-- inert: somebody who fills the form and never pays holds one of the 24
-- pickleball / 16 cricket / 32 FIFA slots permanently, and only a leader
-- cancelling the row frees it.
--
-- That may well be intentional for a small event where the desk chases
-- everybody by WhatsApp anyway. It is written down here so it is a decision
-- rather than an accident. Turning it on needs no code, just data:
--
--   update public.terrathon_events set hold_hours = 24 where slug in (...);
--
-- The expiry is computed at read time, so nothing needs to run on a schedule.
-- ---------------------------------------------------------------------

insert into public.terrathon_events
  (slug, display_name, status, fee_inr, cap, breakeven, next_seq, ref_prefix,
   team_size_min, team_size_max, roster_min_at_signup,
   day_first, day_last, report_time, match_window, venue,
   closes_at, hold_hours, sort_order, prize_pool_inr, prize_split)
select 'pickleball', 'Pickleball', 'open', 750, 24, 12, 0, 'PKL',
       2, 2, 1,
       date '2026-10-02', date '2026-10-02', '11:45 am', '12pm to 7pm', '11:11',
       timestamptz '2026-10-01 18:29:00+00', null, 1, 5000,
       '{"winner":3000,"runner_up":2000}'::jsonb
 where not exists (select 1 from public.terrathon_events where slug = 'pickleball');

insert into public.terrathon_events
  (slug, display_name, status, fee_inr, cap, breakeven, next_seq, ref_prefix,
   team_size_min, team_size_max, roster_min_at_signup,
   day_first, day_last, report_time, match_window, venue,
   closes_at, hold_hours, sort_order, prize_pool_inr, prize_split)
select 'cricket', 'Cricket', 'open', 2400, 16, 8, 0, 'CRK',
       7, 8, 0,
       date '2026-10-03', date '2026-10-04', '9:45 am',
       'Sat 10am to 4pm, Sun 10am to 2pm', 'Turf XL',
       timestamptz '2026-10-02 18:29:00+00', null, 2, 7500,
       '{"winner":4500,"runner_up":3000}'::jsonb
 where not exists (select 1 from public.terrathon_events where slug = 'cricket');

-- Note the cut-off on this one. Pickleball and Cricket close at 23:59 IST the
-- night before. FIFA closes at 09:30 IST on the morning of the event itself,
-- 1h45m before its 11:15 report time. Deliberate or not, it is different from
-- the other two and worth a second look before signups open.
insert into public.terrathon_events
  (slug, display_name, status, fee_inr, cap, breakeven, next_seq, ref_prefix,
   team_size_min, team_size_max, roster_min_at_signup,
   day_first, day_last, report_time, match_window, venue,
   closes_at, hold_hours, sort_order, prize_pool_inr, prize_split)
select 'fifa', 'FIFA', 'open', 350, 32, 16, 0, 'FIF',
       1, 1, 0,
       date '2026-10-03', date '2026-10-03', '11:15 am', '11.30am to 1.30pm',
       'Battlegrounds, Bhowanipore',
       timestamptz '2026-10-03 04:00:00+00', null, 3, 2500,
       '{"winner":1500,"runner_up":1000}'::jsonb
 where not exists (select 1 from public.terrathon_events where slug = 'fifa');

-- rules_md is deliberately not seeded. It is long-form Markdown edited from
-- the desk, it is the one field most likely to have been revised since this
-- file was written, and a stale copy of the rules is worse than none.


-- ---------------------------------------------------------------------
-- 11. VERIFY
--
-- Run these after applying to a fresh database. Per CLAUDE.md, verify with a
-- count, not a spot check.
-- ---------------------------------------------------------------------

-- Five tables, RLS on, anon locked out of every one of them.
--   select c.relname, c.relrowsecurity,
--          has_table_privilege('anon', c.oid, 'SELECT') as anon_select
--     from pg_class c join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'terrathon%';
--   -- expect 5 rows, relrowsecurity true, anon_select false on all 5.
--
-- Five policies, all leader-gated, none mentioning anon.
--   select tablename, policyname, cmd, roles::text, qual
--     from pg_policies where tablename like 'terrathon%';
--   -- expect 5 rows, roles {authenticated}, qual (is_director() OR is_super_admin()).
--
-- The two public doors, and only those two.
--   select p.proname, p.prosecdef,
--          has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname like 'terrathon%';
--   -- expect anon_exec true ONLY for terrathon_register and terrathon_server_now.
--
-- The public view leaks no PII.
--   select string_agg(a.attname, ', ' order by a.attnum)
--     from pg_attribute a
--    where a.attrelid = 'public.terrathon_public_events'::regclass
--      and a.attnum > 0 and not a.attisdropped;
--   -- expect NO captain_name, phone, email, cap, next_seq or breakeven.
