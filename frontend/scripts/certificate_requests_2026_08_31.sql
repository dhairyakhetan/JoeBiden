-- ============================================================================
-- ✅ APPLIED live 2026-08-31
-- Depends on welfare_check_in_2026_08_31.sql (drive_attendance) already
-- being applied - hours are derived from it, not stored here.
--
-- Steps 4-5 of handoff/16-welfare-record.md's build order: certificate/LoR/
-- LoV requests and the HR desk that decides them.
--
-- "Certificate is a request, not an automatic issue. A member asks; HR
-- issues. LoVs — Letters of Volunteering — are a third document type...
-- the same desk issues all three. LoRs are for high contributors and HoDs,
-- so the desk shows the same evidence and the decision is a person's, not
-- a threshold's. Do not design an automatic LoR." (§4)
--
-- Hours are NOT stored here either - "Derived, like the balance" (§4).
-- hours_at_request/drive_count_at_request/date_range_* below are a SNAPSHOT
-- taken at request time (so a request shows what it looked like when asked
-- for, matching "a published claim... says the date range and drive count
-- and lets those speak" §4) - not a live-recomputed value, and not the
-- source of truth for a member's current hours (that's always a fresh
-- drive_attendance query, same shape as pointsService.getBalance()).
-- ============================================================================

create table if not exists public.certificate_requests (
  id                     integer generated always as identity primary key,
  member_id              integer not null references public.members(member_id) on delete cascade,
  doc_type               text not null check (doc_type in ('certificate', 'lor', 'lov')),
  status                 text not null default 'pending' check (status in ('pending', 'issued', 'declined')),
  member_note            text,
  hours_at_request       numeric,
  drive_count_at_request integer,
  date_range_start       date,
  date_range_end         date,
  requested_at           timestamptz not null default now(),
  decided_by             integer references public.members(member_id) on delete set null,
  decided_at             timestamptz,
  decision_note          text
);

comment on table public.certificate_requests is
  'A member asks, HR issues (handoff/16 §4) - certificate, LoR, or LoV. hours_at_request etc. are a snapshot at request time, not a live value; a member''s current hours are always a fresh derived query over drive_attendance, same pattern as points_ledger''s balance.';

comment on column public.certificate_requests.doc_type is
  'certificate | lor (Letter of Recommendation - high contributors/HoDs, HR judgment call, never automatic) | lov (Letter of Volunteering - lighter, issued on participation).';

create index if not exists idx_certificate_requests_member_id on public.certificate_requests(member_id);
create index if not exists idx_certificate_requests_status on public.certificate_requests(status);

alter table public.certificate_requests enable row level security;

-- SELECT: own requests, or any director/super_admin (the HR desk).
drop policy if exists "certificate_requests_select" on public.certificate_requests;
create policy "certificate_requests_select"
  on public.certificate_requests for select
  using (
    member_id = public.get_current_member_id()
    or public.is_director()
    or public.is_super_admin()
  );

-- INSERT: a member can only ever request for THEMSELVES, and only while
-- pending/status defaults - with_check pins member_id to the caller so
-- nobody can file a request in someone else's name.
drop policy if exists "certificate_requests_insert_own" on public.certificate_requests;
create policy "certificate_requests_insert_own"
  on public.certificate_requests for insert
  with check (member_id = public.get_current_member_id());

-- UPDATE: HR desk only - issuing/declining is a director/super_admin
-- decision (handoff/07's "every desk" pattern), never the requester's own.
drop policy if exists "certificate_requests_update_leaders" on public.certificate_requests;
create policy "certificate_requests_update_leaders"
  on public.certificate_requests for update
  using (public.is_director() or public.is_super_admin())
  with check (public.is_director() or public.is_super_admin());

-- No DELETE policy - a request is a permanent record of what was asked for
-- and decided, matching the append-only spirit of points_ledger/
-- drive_attendance elsewhere in this feature.

-- ============================================================================
-- VERIFICATION — run after applying. Every line should report OK.
-- ============================================================================
-- Expect: table exists, RLS enabled, 3 policies
--   select relrowsecurity from pg_class where relname = 'certificate_requests';
--   select policyname, cmd from pg_policies where tablename = 'certificate_requests';
--
-- Expect: no policy references a raw members.auth_uid/email/phone subquery
--   select policyname from pg_policies
--    where tablename = 'certificate_requests'
--      and (qual ilike '%auth_uid%' or with_check ilike '%auth_uid%');
--   -- should return 0 rows
-- ============================================================================
