-- ============================================================================
-- Disco Diwali: the date of birth becomes a free-text NOTE
--
-- Owner, 2026-10-25: "it is like a note so keep it to that", "it will be a random text DoB". The desk no longer reads, validates or
-- formats it; whatever the person at the door types is stored and shown back as typed ("14 May 2008", "class 8", "ask mum", "~2012").
--
-- Why a migration: the column was `date` with CHECK (dob > 1900-01-01 and dob <= current_date), so it could only ever hold a real
-- calendar date. A note needs `text`.
--
-- WHAT IT DOES
--   1. drops the date range CHECK (disco_diwali_registrations_dob_check), the only object that depended on the column
--      (verified live 2026-10-25: no index, view, policy or function reads dob; the one trigger does not touch it);
--   2. changes the type to text, converting the 5 real dates already entered to "DD/MM/YYYY" so nothing is lost;
--   3. adds a plain length CHECK (1 to 80 characters when present) so a paste of a whole document cannot land in the column.
-- The desk trims the text and stores NULL for an empty box, so an empty string never reaches the database.
--
-- STATUS: APPLIED 2026-10-25 to the community project (hzowuwffjqtgszecngpe) as `disco_diwali_dob_free_text`.
-- Verify again (a .sql file in this repo is not evidence it ran):
--   select data_type from information_schema.columns
--    where table_schema='public' and table_name='disco_diwali_registrations' and column_name='dob';   -- expect text
--
-- ROLLBACK (only while every value is still a DD/MM/YYYY date; free text will not convert back):
--   alter table public.disco_diwali_registrations drop constraint disco_diwali_registrations_dob_note_len;
--   alter table public.disco_diwali_registrations alter column dob type date using to_date(dob, 'DD/MM/YYYY');
--   alter table public.disco_diwali_registrations add constraint disco_diwali_registrations_dob_check
--     check (dob is null or (dob > date '1900-01-01' and dob <= current_date));
--
-- Personal data, and some guests are minors: unchanged by this file. Only leaders can read the column (existing RLS), and the
-- table-level privileges are untouched (no `grant` here).
-- ============================================================================

alter table public.disco_diwali_registrations
  drop constraint if exists disco_diwali_registrations_dob_check;

alter table public.disco_diwali_registrations
  alter column dob type text using to_char(dob, 'DD/MM/YYYY');

alter table public.disco_diwali_registrations
  add constraint disco_diwali_registrations_dob_note_len
  check (dob is null or char_length(dob) between 1 and 80);

comment on column public.disco_diwali_registrations.dob is
  'Free-text note, usually a date of birth as typed at the door. Not parsed or validated. Personal data; some guests are minors.';
