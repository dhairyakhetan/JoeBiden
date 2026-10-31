-- members: guardian contact number + "complete your profile" nudge state
-- 2026-09-07
--
-- STATUS: **NOT YET APPLIED.** There is no migration runner in this repo.
-- Paste this whole file into the Supabase SQL editor (project
-- community-platform-aq, ref hzowuwffjqtgszecngpe) and run it. The frontend
-- feature-detects every column added here and degrades safely without it, so
-- shipping the UI before running this is safe — the guardian option simply
-- reports that it is not switched on yet, and the snooze falls back to
-- per-device localStorage instead of following the member across devices.
--
-- ── WHY ─────────────────────────────────────────────────────────────────
--
-- 1. GUARDIAN PHONE.
--    AquaTerra runs its day-to-day coordination on WhatsApp, so a reachable
--    number is a real operational need — 1,283 of 1,317 active members have
--    none (measured 2026-09-07). But the membership is 14–19 years old, many
--    of them minors, and asking a 15-year-old for their personal mobile with
--    no alternative is not an acceptable ask. The in-feed profile nudge
--    therefore offers "my number" and "a guardian's" as two equally-weighted
--    options, either of which satisfies the checklist.
--
--    That requires somewhere to put a guardian's number, and there was
--    nowhere: `members` has `phone` and nothing else. Storing a guardian's
--    number in `members.phone` was never an option — every consumer of that
--    column (director desks, HR exports, the certificate flow) reads it as
--    "this member's own number", so mixing the two would be a data-integrity
--    bug and a safeguarding one at the same time. Hence a separate column
--    with its own name.
--
-- 2. NUDGE STATE.
--    The owner's dismissal rule is: snooze about two weeks, come back once,
--    and after a second dismissal never again — stored per member so it
--    survives a device change. Two additive scalar columns carry that; the
--    state machine itself lives in `src/lib/profileNudge.ts` and is unit
--    tested. These two are ordinary preference data, not PII, and are
--    granted normally.
--
-- ── SECURITY POSTURE (verified against the LIVE database, 2026-09-07) ────
--
-- `members` has NO table-level SELECT/INSERT/UPDATE grant for `anon` or
-- `authenticated` — the PII lockdown (members_pii_lockdown_2026_07_29.sql +
-- ..._stage2_revoke.sql) really has been applied, and privileges are held
-- column by column:
--
--   authenticated SELECT : every column EXCEPT email, phone, auth_uid, google_id
--   authenticated UPDATE : every column EXCEPT email          (phone IS granted)
--   anon                 : neither
--
-- Two consequences this file depends on:
--
--   a) A NEWLY ADDED COLUMN INHERITS NOTHING. With no table-level grant to
--      inherit from, `guardian_phone` starts life with zero privileges for
--      `authenticated` — closed by default. The grants below are therefore
--      the whole of its access surface, and they mirror `phone` EXACTLY:
--      UPDATE yes, SELECT no. Nothing here widens access to `phone`, or to
--      anything else. If you are reviewing this file, that is the line to
--      check: there is no `grant select (guardian_phone)` anywhere in it,
--      and there must never be one.
--
--   b) A MEMBER CAN STILL READ THEIR OWN. `get_own_member()` is
--      SECURITY DEFINER and is literally `select * from public.members where
--      auth_uid = auth.uid()`, so it returns every column of the caller's own
--      row — including columns added after it was written. No change to that
--      function is needed, and none is made here. Directors read member PII
--      through the already-gated `member_directory_view`; adding
--      `guardian_phone` to that view is a SEPARATE decision for whoever owns
--      the HoD desk and is deliberately NOT done here.
--
-- Row-level security is unchanged. Writes are already scoped by the existing
-- policy `Users can update own member row`
--   USING/WITH CHECK (auth_uid = (select auth.uid()))
-- so a member can write only their own guardian number, and no new policy is
-- required. No policy is created, altered or dropped by this file.

begin;

-- ── 1. The guardian number ──────────────────────────────────────────────
alter table public.members
  add column if not exists guardian_phone varchar(32);

comment on column public.members.guardian_phone is
  'A parent/guardian WhatsApp number, supplied by the member as an '
  'alternative to their own. PII: same column-level lockdown as members.phone '
  '- authenticated may UPDATE but NOT SELECT it; own-row reads go through '
  'get_own_member(). NEVER interchangeable with members.phone: that column '
  'means "this member''s own number" to every consumer, and a guardian''s '
  'number stored there would be a safeguarding and data-integrity problem. '
  'Added 2026-09-07 for the in-feed profile nudge.';

-- Mirror members.phone exactly. Explicit REVOKE first so the end state is
-- the same whether or not something granted on it in between.
revoke all (guardian_phone) on public.members from anon;
revoke all (guardian_phone) on public.members from authenticated;

-- UPDATE only, and only for signed-in members (still row-scoped by the
-- existing own-row RLS policy). NO SELECT grant — intentionally. This is the
-- exact privilege set members.phone holds today.
grant update (guardian_phone) on public.members to authenticated;

-- ── 2. Nudge dismissal state ────────────────────────────────────────────
-- Not PII. Ordinary read/write preference data for one's own row.
alter table public.members
  add column if not exists profile_nudge_dismiss_count smallint not null default 0;

alter table public.members
  add column if not exists profile_nudge_snoozed_until timestamptz;

comment on column public.members.profile_nudge_dismiss_count is
  'How many times the member has dismissed the in-feed "complete your '
  'profile" card. 0 = showing, 1 = snoozed then returns once, 2 = retired '
  'permanently. See src/lib/profileNudge.ts (nudgeVisibility/dismissNudge).';

comment on column public.members.profile_nudge_snoozed_until is
  'When the once-only return of the profile nudge is due. Null when not '
  'snoozed or already retired. ~14 days after the first dismissal.';

grant select (profile_nudge_dismiss_count, profile_nudge_snoozed_until)
  on public.members to authenticated;
grant update (profile_nudge_dismiss_count, profile_nudge_snoozed_until)
  on public.members to authenticated;

commit;

-- ── VERIFY AFTER RUNNING ────────────────────────────────────────────────
-- Expected: guardian_phone shows UPDATE and NOT SELECT for authenticated,
-- exactly matching phone. If SELECT appears for guardian_phone, something
-- granted it and the lockdown is broken — revoke it.
--
--   select grantee, column_name, privilege_type
--     from information_schema.column_privileges
--    where table_name = 'members'
--      and column_name in ('phone','guardian_phone')
--      and grantee in ('anon','authenticated')
--    order by column_name, grantee, privilege_type;
--
-- And that RLS is untouched (six policies, unchanged from before this file):
--
--   select policyname, cmd, qual, with_check
--     from pg_policies where tablename = 'members';
