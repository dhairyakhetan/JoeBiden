-- ============================================================================
-- NOTE 2026-10-25: `dob` is no longer a date. It is a free-text note (see disco_diwali_dob_free_text_2026_10_25.sql, applied live), so the
-- `dob date check (...)` below is a NO-OP on the live database (the column already exists) and must not be re-introduced.
-- AquaTerra.live guest area: sessions, login throttling, song requests
--
-- NOT YET APPLIED, and the edge function that uses it (supabase/functions/live-guest) is NOT deployed.
-- Paste into the SQL editor of the COMMUNITY Supabase project, then deploy the function. Verify after:
--   select tablename, rowsecurity from pg_tables where tablename like 'live_guest%' or tablename = 'live_login_attempts';
--   select column_name from information_schema.columns where table_name='disco_diwali_registrations' and column_name='dob';
--
-- THE RULE THIS FOLLOWS: the guest list never reaches the browser. disco_diwali_registrations stays closed to anon and to
-- ordinary signed-in accounts. The function runs with the service role, checks a booking ID PLUS the phone number the ticket was
-- booked with, and returns only the guest's own name, status and song list. Every table below has RLS on and NO policy for anon
-- or authenticated, which means only the service role (the function) can touch them. Leaders read the songs through the
-- policies at the bottom, because moderation is a leader job.
-- ============================================================================

-- an optional date of birth, entered by the guest on first login or by an admin (it only feeds the sun sign)
alter table public.disco_diwali_registrations
  add column if not exists dob date
  check (dob is null or (dob > date '1900-01-01' and dob <= current_date));

comment on column public.disco_diwali_registrations.dob is 'Optional. Used only for the sun sign on the guest card. Personal data, and some guests are minors.';

-- one row per login. Only the SHA-256 of the token is stored, so a database read cannot be replayed as a session.
create table if not exists public.live_guest_sessions (
  token_hash  text        primary key,
  reg_id      uuid        not null references public.disco_diwali_registrations(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '12 hours'
);
create index if not exists idx_live_guest_sessions_reg on public.live_guest_sessions (reg_id);

-- failed logins, counted per hashed IP and per booking ID: 5 in 10 minutes means a cooldown
create table if not exists public.live_login_attempts (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  ip_hash     text        not null,
  dd_id       text,
  ok          boolean     not null default false
);
create index if not exists idx_live_login_attempts_ip on public.live_login_attempts (ip_hash, at desc);
create index if not exists idx_live_login_attempts_id on public.live_login_attempts (dd_id, at desc);

-- song requests: 2 per guest, edits close 9 Nov 6 pm IST (enforced in the function), a leader approves
create table if not exists public.live_guest_songs (
  id          uuid        primary key default gen_random_uuid(),
  reg_id      uuid        not null references public.disco_diwali_registrations(id) on delete cascade,
  title       text        not null check (length(btrim(title)) between 2 and 80),
  status      text        not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at  timestamptz not null default now()
);
create index if not exists idx_live_guest_songs_reg on public.live_guest_songs (reg_id);
create index if not exists idx_live_guest_songs_status on public.live_guest_songs (status, created_at);

-- words the function refuses outright (the profanity pass that runs BEFORE a leader ever sees a request). Leaders maintain it.
create table if not exists public.live_blocked_words (
  word text primary key check (word = lower(btrim(word)) and length(word) between 2 and 40)
);

alter table public.live_guest_sessions enable row level security;
alter table public.live_login_attempts enable row level security;
alter table public.live_guest_songs   enable row level security;
alter table public.live_blocked_words enable row level security;

revoke all on public.live_guest_sessions, public.live_login_attempts, public.live_guest_songs, public.live_blocked_words from anon, authenticated, public;

-- leaders moderate songs and maintain the blocked list; nobody else reads or writes anything here
grant select, update (status) on public.live_guest_songs to authenticated;
grant select, insert, delete on public.live_blocked_words to authenticated;

create policy live_guest_songs_read on public.live_guest_songs
  for select to authenticated using (public.is_director() or public.is_super_admin());
create policy live_guest_songs_moderate on public.live_guest_songs
  for update to authenticated
  using (public.is_director() or public.is_super_admin()) with check (public.is_director() or public.is_super_admin());
create policy live_blocked_words_all on public.live_blocked_words
  for all to authenticated
  using (public.is_director() or public.is_super_admin()) with check (public.is_director() or public.is_super_admin());

-- housekeeping: expired sessions and old attempts are worthless; run this nightly or by hand
create or replace function public.live_guest_sweep() returns void language sql security definer set search_path = public as $$
  delete from public.live_guest_sessions where expires_at < now();
  delete from public.live_login_attempts where at < now() - interval '2 days';
$$;
revoke all on function public.live_guest_sweep() from public, anon, authenticated;
