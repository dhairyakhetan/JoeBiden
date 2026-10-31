-- ═══════════════════════════════════════════════════════════════════════════
--  CLOSEOUT 2026-09-19
--
--  Two decisions from DECISIONS_2026_09_18.md, in one file:
--
--    §1  Roster    revoke members.class_grade from `anon`
--    §2  Deletion  make the privacy policy's deletion promise true, by
--                  anonymising soft-deleted members after a grace period
--
--  STATUS: NOT YET APPLIED.
--
--  Read §2's DESIGN NOTE before running it. The purge does NOT delete rows and
--  it cannot, for reasons measured against the live schema and written down
--  there. It also does not reach auth.users; see §2.4, which is a real gap and
--  needs one deliberate follow-up step per person.
--
--  Every section is idempotent and re-runnable. Each ends with its own
--  verification query, and §2 ships a DRY RUN you should look at first.
--
--  Verified against the live database 2026-09-19 before writing:
--    · members has 40 columns; anon reads 10, authenticated reads 32
--    · relacl is {anon=dDxtm/postgres, authenticated=dDxtm/postgres}, so NO
--      table-level SELECT for either, so privileges really are column-by-column
--    · pg_cron 1.6.4 is installed, with 2 jobs already scheduled
--    · exactly 1 member currently has status='deleted', 0 of them older than
--      30 days, so §2 purges NOTHING on the day you run it. It only arms.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- §1  Stop serving class_grade to signed-out visitors
--
-- WHY THIS IS SAFE NOW, AND WAS NOT BEFORE.
-- /classes used to pull up to 3,000 members' class_grade to the browser and
-- tally it client-side, so revoking would have broken a public page outright.
-- It no longer does: it calls class_cohort_counts(), a SECURITY DEFINER
-- function returning (cohort text, member_count bigint): aggregates only,
-- never an identifying row. Confirmed live: prosecdef = true, anon may EXECUTE.
--
-- Two front-end changes ship WITH this migration and are required by it:
--   · MembersPage selected class_grade and never rendered it. Removed.
--   · profileService.getPublicProfile names class_grade only when there is a
--     session. This matters more than it looks: PostgREST rejects the WHOLE
--     query when the caller cannot read one named column, so leaving it in
--     unconditionally would 403 the entire public profile rather than blanking
--     one field. The same call backs /profile/:uuid (signed in, renders the
--     class line) and /member/:uuid (public, never did).
--
-- Everything else naming class_grade is authed-only (/search is behind
-- ProtectedRoute) or dead (feedService.getLikers and
-- schoolService.getMembersBySchool have no callers).
--
-- A COLUMN-level revoke, deliberately. `revoke select on public.members` with
-- no column list is a RESET: Postgres drops the matching column privileges
-- along with the table one, which is exactly how signed-in reads broke on
-- 2026-09-18. Naming the column touches only that column.
-- ───────────────────────────────────────────────────────────────────────────

revoke select (class_grade) on public.members from anon;

-- Verify. Expect anon_readable = 9, authenticated_readable = 32, total = 40,
-- and anon_has_class_grade = false. COUNT, not a spot check: confirming
-- class_grade became unreadable proves the revoke ran, but only the count
-- shows it did not do more than intended.
select
  count(*) filter (where has_column_privilege('anon','public.members',column_name,'SELECT'))          as anon_readable,
  count(*) filter (where has_column_privilege('authenticated','public.members',column_name,'SELECT')) as authenticated_readable,
  count(*)                                                                                            as total_columns,
  has_column_privilege('anon','public.members','class_grade','SELECT')                                as anon_has_class_grade,
  has_column_privilege('anon','public.members','bio','SELECT')                                        as anon_has_bio
from information_schema.columns
where table_schema='public' and table_name='members';
-- anon_has_bio must stay TRUE. bio is written to be read, is profanity-filtered
-- on save, carries no contact detail, and /member/:uuid both displays it and
-- builds its meta description from it. Keeping it was a deliberate decision.


-- ───────────────────────────────────────────────────────────────────────────
-- §2  Deletion that is actually deletion
--
-- DESIGN NOTE: WHY THIS ANONYMISES INSTEAD OF DELETING THE ROW.
--
-- The obvious implementation is `delete from members where …`. Measured against
-- the live schema, that is wrong twice over:
--
--   1. IT WOULD FAIL. Ten foreign keys reference members with ON DELETE
--      NO ACTION, including community_audit_logs.member_id, members.approved_by
--      and posts.reviewed_by. Any one of them raises a FK violation and the
--      delete aborts.
--
--   2. IF IT SUCCEEDED IT WOULD DESTROY THE ORG'S RECORD. Twenty-nine FKs
--      cascade, including posts.author_id and comments.author_id. Deleting one
--      member would silently erase every post they wrote, every comment,
--      their certificates, their yearbook entry and their drive attendance,
--      work the organisation needs and that belongs to more people than them.
--
-- So the personal data goes and the row stays. That is what a deletion promise
-- actually requires when personal data is interleaved with records that are not
-- personal: erase what identifies the person, keep what does not.
--
-- The row is left as a tombstone: same member_id and uuid (so nothing dangles),
-- name 'Deleted member', and every identifying column cleared.
-- ───────────────────────────────────────────────────────────────────────────

-- §2.1  The grace period, in one place so it is not scattered through the file.
--       30 days: long enough to undo an accidental or malicious removal, short
--       enough to be a real promise. restore_member() works throughout it and
--       stops working after, which is the point.
create or replace function public.member_purge_grace_period()
returns interval language sql immutable as $$ select interval '30 days' $$;

comment on function public.member_purge_grace_period is
  'Grace period between soft_delete_member() and anonymise_deleted_members() '
  'irreversibly clearing the personal data. Change here, not at call sites.';


-- §2.2  DRY RUN. Look at this BEFORE scheduling anything, and after any change
--       to the grace period. It names no personal data - only how many rows
--       are eligible and how old they are.
create or replace view public.members_pending_purge as
select m.member_id,
       m.deleted_at,
       age(now(), m.deleted_at)                                as deleted_for,
       (m.deleted_at < now() - public.member_purge_grace_period()) as eligible_now
  from public.members m
 where m.status = 'deleted'
   and m.deleted_at is not null;

-- This view reads a director-only concern and is SECURITY INVOKER by default,
-- so RLS on members still applies to whoever selects from it. Do not flip it.
alter view public.members_pending_purge set (security_invoker = true);

revoke all on public.members_pending_purge from anon, authenticated;

comment on view public.members_pending_purge is
  'Dry run for anonymise_deleted_members(). Counts and ages only, no PII.';


-- §2.3  The purge itself.
create or replace function public.anonymise_deleted_members()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_count integer;
begin
  with purged as (
    update public.members m set
      -- NOT NULL columns take a tombstone rather than a null.
      email        = 'deleted-' || m.member_id || '@deleted.invalid',
      full_name    = 'Deleted member',
      -- Everything below identifies a person, and goes.
      auth_uid                  = null,
      google_id                 = null,
      avatar_url                = null,
      class_grade               = null,
      phone                     = null,
      guardian_phone            = null,
      join_reason               = null,
      rejection_note            = null,
      bio                       = null,
      school_id                 = null,
      instagram                 = null,
      linkedin                  = null,
      birthday                  = null,
      break_reason              = null,
      last_login                = null,
      last_birthday_notice_year = null,
      contacted_at              = null,
      referred_by               = null,
      updated_at                = now()
    where m.status = 'deleted'
      and m.deleted_at is not null
      and m.deleted_at < now() - public.member_purge_grace_period()
      -- Idempotence: a row already anonymised must not be rewritten daily,
      -- or updated_at churns forever and the audit log fills with no-ops.
      and m.email not like 'deleted-%@deleted.invalid'
    returning m.member_id
  )
  select count(*) into v_count from purged;

  -- Log the fact, never the people. member_id is deliberately null: there is
  -- no actor, this runs on a timer.
  if v_count > 0 then
    insert into public.community_audit_logs (member_id, action, entity_type, entity_id)
    values (null, 'members_anonymised', 'member', v_count);
  end if;

  return v_count;
end;
$function$;

comment on function public.anonymise_deleted_members is
  'Irreversibly clears personal data from members soft-deleted longer ago than '
  'member_purge_grace_period(). Does NOT delete rows - see the DESIGN NOTE in '
  'scripts/CLOSEOUT_2026_09_19.sql. Returns how many rows it changed.';

-- Nobody calls this from the browser. It runs on a timer, as postgres.
revoke all on function public.anonymise_deleted_members() from anon, authenticated;


-- §2.4  GAP, STATED RATHER THAN HIDDEN: auth.users
--
-- This function anonymises public.members. It does NOT touch auth.users, which
-- holds the same person's email and their Google identity. After the grace
-- period the member row says 'Deleted member' while the auth row still names
-- them, so the promise is only half kept by this file alone.
--
-- It is left out on purpose rather than bolted on: deleting an auth user needs
-- the service_role key or the dashboard, it is genuinely irreversible, and
-- doing it from a cron job would mean granting a timer the power to delete
-- accounts. Better as a deliberate act.
--
-- Run this to see who is due (no PII in the output, ids only), then delete
-- each via Dashboard → Authentication → Users, or auth.admin.deleteUser():
--
--   select member_id, deleted_at from public.members_pending_purge
--    where eligible_now;
--
-- Do it BEFORE the cron run clears auth_uid, or the link is gone and you will
-- have to match by email in the auth table instead.


-- §2.5  Schedule it. 04:23 daily - off the hour, and clear of the existing
--       purge-old-wall-notes at 03:17 so two purges never overlap.
--       pg_cron 1.6.4 is already installed; unschedule first so re-running
--       this file does not stack duplicate jobs.
select cron.unschedule('anonymise-deleted-members')
 where exists (select 1 from cron.job where jobname = 'anonymise-deleted-members');

select cron.schedule(
  'anonymise-deleted-members',
  '23 4 * * *',
  $cron$ select public.anonymise_deleted_members(); $cron$
);


-- §2.6  Verify.
-- Expect: the job listed, and 1 pending row that is NOT eligible yet
-- (measured 2026-09-19: one member is soft-deleted, none older than 30 days).
select jobname, schedule, active from cron.job where jobname = 'anonymise-deleted-members';

select count(*)                                as pending_rows,
       count(*) filter (where eligible_now)    as eligible_today
  from public.members_pending_purge;

-- To check the function without waiting for the timer, run it directly. It is
-- safe: with 0 eligible rows it changes nothing and returns 0.
-- select public.anonymise_deleted_members();
