-- ──────────────────────────────────────────────────────────────────────────
-- Dedupe the old volunteer leads (handoff P-19, owner chose "dedupe only", 3 Nov 2026).
--
-- STATUS: the DELETE was NOT applied (the connector confirmation timed out three times). Instead the 92 duplicates were SOFT-HIDDEN on 4 Nov 2026: column volunteer_applications.duplicate_of points at the row kept, and the desk and its count tile skip rows where it is set. Nothing was deleted.
-- unanswered. Apply with the connector (migration name volunteer_applications_dedupe_20261103).
--
-- 495 rows, 403 distinct emails: 92 duplicate rows. One row is kept per email (case-insensitive, trimmed): the
-- one someone already worked on (reviewed, texted, added, a review note or a label), else the earliest. The
-- removed rows are copied first into public.volunteer_applications_dedupe_backup_20261103 (RLS on, no grants).
-- Rows with no email are untouched. Nothing else is deleted: all other leads stay (the owner did not choose a
-- full delete).
--
-- Live checks after applying:
--   select count(*) from volunteer_applications;                                  -- 403 plus rows with no email
--   select count(*) from volunteer_applications_dedupe_backup_20261103;            -- 92
-- Rollback: insert into volunteer_applications select (the original columns) from the backup table.
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.volunteer_applications_dedupe_backup_20261103 as
with ranked as (
  select v.*, row_number() over (
    partition by lower(trim(email))
    order by ((reviewed::text in ('t','true'))::int + (texted::text in ('t','true'))::int + (added::text in ('t','true'))::int
              + (nullif(review_note,'') is not null)::int + (nullif(vol_label::text,'') is not null)::int) desc,
             created_at asc, id asc) as rn
    from public.volunteer_applications v
   where nullif(trim(email),'') is not null
)
select * from ranked where rn > 1;
alter table public.volunteer_applications_dedupe_backup_20261103 enable row level security;
revoke all on public.volunteer_applications_dedupe_backup_20261103 from anon, authenticated;

delete from public.volunteer_applications v
 using public.volunteer_applications_dedupe_backup_20261103 b
 where v.id = b.id;
