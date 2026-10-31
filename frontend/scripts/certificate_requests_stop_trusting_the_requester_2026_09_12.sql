-- ─────────────────────────────────────────────────────────────────────────────
-- A member could write their own volunteer hours, and mark the request issued.
-- 2026-09-12.  STATUS: APPLIED (migration
-- `certificate_requests_stop_trusting_the_requester`), verified live below.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- THE HOLE
--
-- `certificate_requests_insert_own` had WITH CHECK `member_id =
-- get_current_member_id()` and nothing more, while `hours_at_request`,
-- `drive_count_at_request`, `date_range_start/end` and `status` all came
-- straight from the browser (services/certificateService.ts requestDocument).
-- This app has no API server: that payload IS the member's own code.
--
-- Verified live as an ordinary active member, inside a rolled-back DO block,
-- checking GET DIAGNOSTICS ROW_COUNT rather than "did it throw" (RLS filters
-- silently, so exception-only checking reports a denial as a success):
--
--   insert into certificate_requests
--     (member_id, doc_type, hours_at_request, drive_count_at_request, status)
--   values (<self>, 'lov', 500, 60, 'issued');
--   -> ROW_COUNT = 1
--
-- The HR desk reads exactly those columns to decide, so its queue would have
-- shown that member as "500h · 60 drives", already issued, and HR would have
-- signed a Letter of Volunteering for hours nobody worked. The member's real
-- drive_attendance rows were never consulted at decision time.
--
--
-- THE FIX, in two halves
--
-- 1. The policy refuses anything but a 'pending' insert, and refuses a request
--    that arrives pre-decided.
-- 2. A BEFORE INSERT trigger RECOMPUTES the four snapshot columns from
--    drive_attendance and throws the client's values away.
--
-- The trigger is the half that matters. The policy alone would still let a
-- member claim 500 hours, just politely, as "pending".

drop policy if exists certificate_requests_insert_own on public.certificate_requests;
create policy certificate_requests_insert_own
  on public.certificate_requests
  for insert
  with check (
    member_id = public.get_current_member_id()
    and status = 'pending'
    and decided_by is null
    and decided_at is null
    and decision_note is null
  );

-- Mirrors certificateService.getHoursSummary exactly: sum checkout-checkin
-- across 'here'/'left' rows, fall back to the drive's own scheduled duration
-- when a personal checkout is missing, count DISTINCT drives, take the range
-- from the drives' workshop_date.
create or replace function public.certificate_request_derive_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hours   numeric;
  v_drives  integer;
  v_first   date;
  v_last    date;
begin
  select
    round(coalesce(sum(
      case
        when a.checked_in_at is not null
         and a.checked_out_at is not null
         and a.checked_out_at > a.checked_in_at
          then extract(epoch from (a.checked_out_at - a.checked_in_at))
        when wp.workshop_date is not null
         and wp.scheduled_end is not null
         and wp.scheduled_end > wp.workshop_date
          then extract(epoch from (wp.scheduled_end - wp.workshop_date))
        else 0
      end
    ), 0) / 3600.0, 1),
    count(distinct wp.id),
    min(wp.workshop_date)::date,
    max(wp.workshop_date)::date
  into v_hours, v_drives, v_first, v_last
  from public.drive_attendance a
  join public.welfare_projects wp on wp.id = a.welfare_project_id
  where a.member_id = new.member_id
    and a.status in ('here', 'left');

  new.hours_at_request       := v_hours;
  new.drive_count_at_request := v_drives;
  new.date_range_start       := v_first;
  new.date_range_end         := v_last;
  return new;
end;
$$;

revoke all on function public.certificate_request_derive_snapshot() from anon, authenticated, public;

drop trigger if exists certificate_requests_derive_snapshot on public.certificate_requests;
create trigger certificate_requests_derive_snapshot
  before insert on public.certificate_requests
  for each row
  execute function public.certificate_request_derive_snapshot();


-- ── VERIFICATION (all rolled back) ───────────────────────────────────────────
--
-- As an ordinary active member:
--   A) insert with status='issued'            -> blocked by the policy
--   B) insert 'pending' claiming 500h/60      -> accepted, STORED as 0.0 / 0
--
-- Derivation correctness, with synthetic attendance on three drives:
--   drive A: checked in 09:00, out 11:30      -> 2.5h
--   drive B: checked in 09:00, out 10:15      -> 1.25h
--   drive C: status 'no_show'                 -> must not count
--   client claimed hours=999, drives=99
--   -> stored hours=3.8, drives=2. Correct on all three counts.
--
--
-- ── A LIVE-DATA NOTE, NOT A CODE PROBLEM ─────────────────────────────────────
--
-- Checked while writing this: `drive_attendance` has ZERO rows, and of 558
-- welfare_projects, 558 have a workshop_date and 0 have a scheduled_end. So
-- (a) nobody has any recorded volunteer hours at all right now, and (b) the
-- scheduled-duration fallback above can never fire with current data - the
-- only hours anyone can earn are explicit check-in/check-out pairs.
--
-- Any Letter of Volunteering issued today would therefore truthfully read
-- "0 hours, 0 drives". That was equally true before this migration; the client
-- computed the same 0. What changed is that a member can no longer replace it
-- with a number they typed. Someone has to start recording attendance before
-- the LoV pipeline means anything.
