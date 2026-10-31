-- ============================================================================
-- ✅ APPLIED live 2026-08-30 (via Supabase MCP). Verified: birthday_public
-- defaults false for every existing row, as designed.
--
-- Birthdays.
-- Per the Aug 2026 redesign handoff, member surfaces spec.
--
-- WHY: the feed is meant to be able to post/notice a member's birthday.
-- "Wishes" reuse the existing comments table against a birthday-notice posts
-- row (already-existing product convention — a post with comments) — no new
-- table for that half of the feature, per the handoff spec.
--
-- DESIGN CHOICE — birthday as a plain `date`, year-unknown left to app logic:
-- Some members may not want to (or may not have, e.g. older bulk-imported
-- rows) a known birth YEAR, only a day/month worth celebrating. Postgres
-- `date` has no "partial date" type, and modeling year-optionality with a
-- sentinel year (the classic 0004/leap-year trick, or 1900) is exactly the
-- kind of DB-level cleverness that silently breaks the next person who
-- queries this column expecting a real date (age math, "upcoming birthdays"
-- sorts that don't special-case the sentinel, etc.) — this schema has been
-- burned by hidden conventions like that before. The simplest HONEST option:
-- `birthday date null`, full stop. If a member's year is genuinely unknown,
-- the app is expected to store its best-known/placeholder year and simply
-- never render it (show "Aug 29" instead of "Aug 29, 2008") — that's a
-- display-layer decision, not a schema one, and it's free to change without
-- a migration.
--
-- DESIGN CHOICE — birthday_public defaults to FALSE, not TRUE:
-- The product's stated behavior is "opt-out" (birthdays are public by
-- default, a member can hide theirs). That is a PRODUCT default, applied at
-- signup/onboarding time for NEW members going forward. It is NOT safe as
-- the DATABASE default for this migration, because this column is being
-- added retroactively to ~1,200+ existing member rows that never saw any
-- opt-out UI and never consented to their birthday being shown to anyone.
-- Defaulting the column to TRUE here would make all of their birthdays
-- public the instant this migration runs, with zero consent. DEFAULT FALSE
-- is the deliberately conservative schema default: every existing member
-- starts hidden, and the app/product can run a one-time opt-out campaign (or
-- a director-approved bulk flip per whatever policy the org lands on) to
-- move consenting members to true — a decision made in the open, not as a
-- side effect of a column migration.
--
-- RLS: no new policy needed for the same reason as members_social_links_
-- 2026_08_29.sql — birthday/birthday_public are ordinary profile columns,
-- not in the email/phone PII-lockdown category, and ride the existing
-- members SELECT/UPDATE policies. birthday_public is a DISPLAY gate the app
-- is expected to honor when deciding whose birthday to show/notify on (e.g.
-- "today's birthdays" query filters `where birthday_public = true`) — it is
-- not (and does not need to be) a DB-level column revoke, since a birth date
-- alone, without knowing which member it belongs to being force-hidden, is
-- materially less sensitive than an email/phone that enables direct contact.
-- If the org later decides raw birthday should be hidden at the DB level too
-- for members with birthday_public = false, that's a follow-up in the same
-- shape as the members_pii_lockdown_2026_07_29.sql two-stage approach — not
-- bundled into this additive migration.
-- ============================================================================

alter table public.members
  add column if not exists birthday date,
  add column if not exists birthday_public boolean not null default false;

comment on column public.members.birthday is
  'Nullable date. Year may be a placeholder if the member''s real birth year is unknown — the app decides whether to render the year, this column just stores day/month/(best-known)year.';

comment on column public.members.birthday_public is
  'Deliberately defaults to FALSE even though the product''s stated behavior is opt-OUT (public by default) — see migration header. Do not flip this default to TRUE without an explicit consent decision for the existing member base.';

-- ============================================================================
-- VERIFICATION — run after applying. Every line should report OK.
-- ============================================================================
-- Expect: birthday nullable date, birthday_public boolean not null default false
--   select column_name, data_type, is_nullable, column_default
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'members'
--      and column_name in ('birthday', 'birthday_public');
--
-- Expect: 0 — no existing member should be public until an explicit decision
--   select count(*) from public.members where birthday_public = true;
