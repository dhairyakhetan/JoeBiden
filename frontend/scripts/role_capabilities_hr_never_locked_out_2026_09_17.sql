-- ============================================================================
-- role_capabilities: hr can never be locked out of the Roles & Permissions desk
--
-- STATUS: APPLIED 2026-09-18, but NOT by running this file.
--   Its contents were folded verbatim into section 3 of
--   AUDIT_CUMULATIVE_2026_09_18.sql, which was applied and committed.
--   This file is kept as a standalone reference. Re-running it would be a
--   harmless no-op (it is idempotent), but the cumulative file is what landed.
--   Do not mark this applied from the file. Verify against pg_constraint:
--     select conname, pg_get_constraintdef(oid)
--       from pg_constraint
--      where conrelid = 'public.role_capabilities'::regclass;
--   This repo has twice shipped code against a migration whose status comment
--   said APPLIED when it was not, so the comment is not evidence.
--
-- WHY
--   Audit 2026-09-17 (AUDIT_2026_09_17.md, security P1).
--
--   role_capabilities already carries
--     constraint role_capabilities_super_admin_never_restricted
--       check (not (role = 'super_admin' and enabled = false))
--   from role_capabilities_toggle_engine_2026_09_10.sql. It names super_admin
--   and only super_admin.
--
--   But lib/roles.ts makes `hr` EQUAL IN POWER to super_admin, and `hr` exists
--   precisely so HR staff do not have to read as super admins - which means an
--   org's only top-tier account is routinely an `hr`, with no super_admin at
--   all. Untick `desk.roles` for `hr` in that org and the page that could tick
--   it back on is unreachable by everyone. The only way out is a hand-written
--   delete against this table.
--
--   NARROW ON PURPOSE. `hr` stays restrictable for every other capability. That
--   is the whole point of the matrix, and the broad fix (treat hr as
--   unrestrictable everywhere) would silently void every hr restriction an
--   operator had already set. Only the matrix's own desk is protected.
--
-- MIRRORS
--   frontend/src/lib/capabilities.ts  TOP_TIER_NEVER_RESTRICTABLE
--   frontend/src/services/roleCapabilityMatrixService.ts  setEnabled()
--   frontend/src/lib/capabilities.test.ts  "hr cannot be locked out ..."
--   Keep all four in step. If TOP_TIER_NEVER_RESTRICTABLE ever gains a second
--   key, this constraint has to gain it too or the app and the database will
--   disagree about what is togglable.
--
-- SAFETY
--   Additive. Adds one CHECK constraint and deletes any row that already
--   violates it. The delete restores access; it never removes any.
-- ============================================================================

begin;

-- 1. Clear any existing restriction that the new constraint would reject.
--    An `hr` row disabling desk.roles is exactly the lockout state, so removing
--    it is the repair, not data loss. Absent means enabled (see capabilities.ts).
delete from public.role_capabilities
 where role = 'hr'
   and capability_key = 'desk.roles'
   and enabled = false;

-- 2. Refuse it from here on.
alter table public.role_capabilities
  drop constraint if exists role_capabilities_hr_never_locked_out;

alter table public.role_capabilities
  add constraint role_capabilities_hr_never_locked_out
  check (not (role = 'hr' and capability_key = 'desk.roles' and enabled = false));

commit;

-- ── VERIFY (run after, paste the output into the status block above) ────────
-- select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--  where conrelid = 'public.role_capabilities'::regclass
--    and conname like '%never%';
--
-- Expect two rows: role_capabilities_super_admin_never_restricted
--              and role_capabilities_hr_never_locked_out
--
-- Then prove it refuses the bad write:
-- insert into public.role_capabilities (capability_key, role, enabled)
-- values ('desk.roles', 'hr', false);
-- -- expected: new row violates check constraint
--   "role_capabilities_hr_never_locked_out"
