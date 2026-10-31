-- ============================================================================
-- sops: the assignee could not see the task assigned to them — 2026-09-11
-- STATUS: **APPLIED** to the community project (hzowuwffjqtgszecngpe) via the
--         Supabase MCP connector as migration `sops_assignee_can_see_own_task`.
--         Verify live before trusting this header; paper trails in this repo
--         have drifted before.
-- ============================================================================
--
-- FOUND BY: walkthrough item 7.4, "SOPs/Goals hydrated across people -
-- assigning a task shows up for the assignee".
--
-- THE BUG
--
-- It could not show up, and no amount of UI would have fixed it. The two
-- policies disagreed about whether an assignee is a legitimate party to their
-- own task:
--
--   sops_update_owner_or_leaders
--     USING (led_by_member_id = get_current_member_id()
--            OR is_director() OR is_super_admin())
--
--   sops_select_department_or_leaders
--     USING (is_director() OR is_super_admin()
--            OR is_member_of_department(department_slug))
--
-- So an assignee outside the task's own department could UPDATE a row they
-- were not permitted to READ. Verified live, in a rolled-back transaction: a
-- welfare goal assigned to a member who is on no welfare team returned
--
--     assignee SELECT own task:  NO (BLOCKED)
--     "my tasks" query returns:  0
--     assignee UPDATE:           YES
--
-- A member could tick a task done without ever being able to see it, and
-- there was consequently no "my tasks" query anywhere in the codebase - it
-- would have returned nothing for exactly the people it was for.
--
-- THE FIX
--
-- Make SELECT agree with UPDATE. The clause added is the SAME expression the
-- UPDATE policy has always carried, so this is not a widening in any new
-- direction: department members and leaders see exactly what they saw before,
-- and an assignee now sees their own row and nothing else.

drop policy if exists sops_select_department_or_leaders on public.sops;
create policy sops_select_department_or_leaders on public.sops
  for select
  using (
    is_director()
    or is_super_admin()
    or is_member_of_department(department_slug)
    or led_by_member_id = get_current_member_id()
  );

-- ── VERIFIED AFTER, in a rolled-back transaction, WITH A CONTROL ────────────
--   ASSIGNEE sees own task:           YES
--   "my tasks" returns:               1
--   CONTROL, an unrelated member:     NO (correct)
--
-- The control is the half that matters: widening a SELECT policy is exactly
-- where a fix turns into a leak, and a second member outside the department
-- still sees nothing.
--
-- ── WHAT THE APP DOES WITH IT ──────────────────────────────────────────────
--   · sopService.getMine()      open tasks assigned to the signed-in member
--   · profile/MyTasksCard.tsx   renders them, and renders NOTHING when there
--                               are none (live today `sops` holds 0 rows)
--   · sopService.notifyAssignee fires a `system` notification when a task
--                               CHANGES HANDS - not on every save, and never
--                               when a leader assigns to themselves
-- Notification delivery verified live as the recipient: 0 -> 1. (Counting it
-- as the SENDER shows 0 -> 0, because notifications are private to their
-- recipient - a blind count, not a failure.)
--
-- ── TO REVERT ───────────────────────────────────────────────────────────────
-- Drop the `or led_by_member_id = get_current_member_id()` clause. The card
-- and the service then return nothing for out-of-department assignees, which
-- is the state this fixed.
-- ============================================================================
