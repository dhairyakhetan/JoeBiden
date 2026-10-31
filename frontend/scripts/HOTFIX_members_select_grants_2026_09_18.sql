-- ============================================================================
-- HOTFIX. Run this now.
--
--   STATUS: APPLIED 2026-09-18, VERIFIED LIVE.
--     members has 40 columns. authenticated can now SELECT 32 and is closed on
--     8: auth_uid, deleted_at, deleted_by, email, google_id, guardian_phone,
--     last_birthday_notice_year, phone. Exactly the intended list.
--     Table ACL confirmed still {..., authenticated=dDxtm/postgres, ...} with no
--     leading `r`, so the P0 stays closed. UPDATE untouched at 28 columns.
--     anon unchanged at 10 readable columns.
--
-- WHAT WENT WRONG
--   Section 1 of AUDIT_ROUND2_2026_09_18.sql ran
--     revoke select on public.members from authenticated;
--   intending to remove only the TABLE-level grant and leave the 31 per-column
--   SELECT grants beneath it intact.
--
--   That is not what Postgres does. `REVOKE SELECT ON <table> FROM <role>`
--   removes the table-level privilege AND every column-level SELECT privilege
--   that role holds on that table. Documented behaviour, and the reason the
--   migration was wrong. Verified live after the run: `authenticated` now has
--   SELECT on exactly one column, `previously_removed`, the one that was
--   explicitly re-granted afterwards.
--
-- IMPACT RIGHT NOW
--   Every direct read of public.members by a signed-in member fails. UPDATE is
--   unaffected (all 28 column-level `w` grants survived, because REVOKE SELECT
--   does not touch UPDATE), and `anon` is completely unaffected (nothing was
--   revoked from anon), so the public site is fine. The damage is scoped to
--   logged-in reads.
--
--   Unaffected, because they do not rely on these grants:
--     - own-row reads, which go through the get_own_member() SECURITY DEFINER RPC
--     - the feed, which reads post_feed_view (SECURITY DEFINER)
--     - the HoD desks, which read member_directory_view /
--       pending_member_approvals / rejected_member_approvals (all SECURITY
--       DEFINER after section 2 of the same migration)
--
-- WHAT THIS FILE DOES
--   Restores SELECT on exactly the 31 columns that held `authenticated=r`
--   before the migration ran, and no others. The list is not reconstructed from
--   guesswork: it was captured from pg_attribute.attacl during the audit, BEFORE
--   the revoke, and is reproduced verbatim below.
--
--   The five PII columns stay revoked, which was the entire point of the
--   original change and is still achieved:
--     email, phone, guardian_phone, auth_uid, google_id
--   Also staying revoked, because nothing reads them from the client:
--     deleted_at, deleted_by, last_birthday_notice_year
--
-- NET RESULT AFTER THIS FILE
--   Exactly the state the audit intended: the table-level grant gone, the
--   column-level grants back, the PII columns closed to `authenticated` for the
--   first time since 2026-09-14.
--
-- SAFETY
--   Additive only. Grants SELECT on 31 non-PII columns. Revokes nothing.
--   Idempotent: re-granting an existing privilege is a no-op.
-- ============================================================================

begin;

grant select (
  approved_at,
  approved_by,
  avatar_url,
  bio,
  birthday,
  birthday_public,
  break_end,
  break_reason,
  break_start,
  class_grade,
  contacted_at,
  created_at,
  full_name,
  instagram,
  is_active,
  join_reason,
  last_login,
  linkedin,
  member_id,
  member_no,
  profile_nudge_dismiss_count,
  profile_nudge_snoozed_until,
  referred_by,
  rejection_note,
  role,
  school_id,
  status,
  team_nudge_seen_at,
  updated_at,
  uuid,
  wall_enabled
) on public.members to authenticated;

commit;

-- ============================================================================
-- VERIFY
-- ============================================================================
-- 1. The five PII columns must still be CLOSED to authenticated (all false),
--    and the everyday columns must be OPEN again (all true).
--
-- select column_name,
--        has_column_privilege('authenticated','public.members',column_name,'SELECT') as auth_sel
--   from information_schema.columns
--  where table_schema='public' and table_name='members'
--    and column_name in ('email','phone','guardian_phone','auth_uid','google_id',
--                        'full_name','class_grade','avatar_url','role','uuid','status')
--  order by auth_sel, column_name;
--
--   Expect false for: auth_uid, email, google_id, guardian_phone, phone
--   Expect true  for: avatar_url, class_grade, full_name, role, status, uuid

-- 2. Exactly 32 columns readable by authenticated (the 31 above plus
--    previously_removed), out of 40. Expect 32 and 8.
--
-- select count(*) filter (where has_column_privilege('authenticated','public.members',column_name,'SELECT')) as readable,
--        count(*) filter (where not has_column_privilege('authenticated','public.members',column_name,'SELECT')) as closed
--   from information_schema.columns
--  where table_schema='public' and table_name='members';

-- 3. The table-level grant must still be gone. Expect authenticated=dDxtm,
--    with NO leading `r`.
--
-- select relacl::text from pg_class where oid='public.members'::regclass;

-- 4. UPDATE must be untouched. Expect 28 true.
--
-- select count(*) filter (where has_column_privilege('authenticated','public.members',column_name,'UPDATE'))
--   from information_schema.columns
--  where table_schema='public' and table_name='members';

-- ============================================================================
-- THE LESSON, for whoever writes the next members migration
-- ============================================================================
--   On a table whose privileges are column-by-column, NEVER issue a bare
--   `revoke <priv> on <table>`. It is not a narrowing operation, it is a reset:
--   it takes the column grants with it.
--
--   The safe shape is revoke-then-regrant in ONE transaction, so the table is
--   never left in the stripped state:
--
--     begin;
--       revoke select on public.members from authenticated;
--       grant select (col, col, ...) on public.members to authenticated;
--     commit;
--
--   And the verification that would have caught this is a COUNT, not a spot
--   check. Checking that `email` became unreadable proved the change worked;
--   only counting how many columns stayed readable would have shown it had
--   worked far too well.
-- ============================================================================
