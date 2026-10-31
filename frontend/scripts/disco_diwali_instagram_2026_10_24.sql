-- ============================================================================
-- NOTE 2026-10-25: `dob` is no longer a date. It is a free-text note (see disco_diwali_dob_free_text_2026_10_25.sql, applied live), so the
-- `dob date check (...)` below is a NO-OP on the live database (the column already exists) and must not be re-introduced.
-- Disco Diwali: an Instagram handle, a Close Friends tick and a date of birth on every ticket
--
-- APPLIED 2026-10-24 to the community project (hzowuwffjqtgszecngpe) as migration
-- `disco_diwali_instagram_close_friends_dob`. Verified live: the 115 existing tickets took the default (ig_close_friend = false),
-- the CHECKs refuse a bad handle and a future date of birth, and no existing row was changed.
-- To verify again (a .sql file in this repo is not evidence it ran):
--   select column_name from information_schema.columns
--    where table_name = 'disco_diwali_registrations' and column_name = 'instagram';
--
-- The desk also works without it (an empty field never sends its column), which is why the app could ship before this ran.
--
-- Stored lowercase, no @, as the app normalises it (letters, digits, dots,
-- underscores, 1 to 30, no leading, trailing or doubled dot). The CHECK repeats
-- that so a hand-edit in the table editor cannot store a link or a space.
-- Existing RLS (director or super admin only) already covers the new column;
-- the table has no column-level grants to widen.
-- ============================================================================

alter table public.disco_diwali_registrations
  add column if not exists instagram text
  check (instagram is null or instagram ~ '^(?!\.)(?!.*\.\.)(?!.*\.$)[a-z0-9._]{1,30}$');

comment on column public.disco_diwali_registrations.instagram is
  'Participant Instagram handle, lowercase, no @. Optional.';

create index if not exists idx_disco_diwali_instagram
  on public.disco_diwali_registrations (instagram) where instagram is not null;

-- Close Friends is a to-do the desk works down: has a handle, not yet added. Default false, never null.
alter table public.disco_diwali_registrations
  add column if not exists ig_close_friend boolean not null default false;

comment on column public.disco_diwali_registrations.ig_close_friend is
  'True once an admin has added this participant to the Instagram Close Friends list.';

create index if not exists idx_disco_diwali_cf_todo
  on public.disco_diwali_registrations (created_at desc) where instagram is not null and ig_close_friend = false;

-- Date of birth. The guest area migration (live_guest_2026_10_24.sql) adds the same column with the same check, so running both
-- in either order is safe. Personal data, and some guests are minors: only leaders can read it (existing RLS), and it is shown to
-- the guest themselves only through the live-guest function.
alter table public.disco_diwali_registrations
  add column if not exists dob date
  check (dob is null or (dob > date '1900-01-01' and dob <= current_date));

comment on column public.disco_diwali_registrations.dob is 'Optional date of birth. Personal data; some guests are minors.';
