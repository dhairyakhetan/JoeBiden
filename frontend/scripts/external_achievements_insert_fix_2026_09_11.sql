-- ============================================================================
-- external_achievements: members could not add one AT ALL — 2026-09-11
-- STATUS: **APPLIED** to the community project (hzowuwffjqtgszecngpe) via the
--         Supabase MCP connector as migration
--         `external_achievements_insert_matches_shipped_behaviour`.
--         Verify live before trusting this header; paper trails in this repo
--         have drifted before.
-- ============================================================================
--
-- FOUND BY: walkthrough item 8.1, "likes, profiles, profile pictures, my
-- posts, achievements - all wired, all verified". Verifying it meant actually
-- performing each action as a real member session rather than reading the
-- service code. Five of the six passed. Achievements did not.
--
-- THE BUG
--
-- A plain member could not insert an achievement. Not "it looked wrong" - the
-- database refused it with 42501 every single time.
--
-- On 2026-09-03 the owner decided achievements go live on submit. The
-- director-side review desk was deleted, the `status` column default moved to
-- 'approved', and achievementService.create() was changed to send
-- `status: 'approved'` explicitly - its comment in the file still describes
-- exactly that change. The RLS INSERT policy was not changed with them:
--
--     with check (
--       member_id = get_current_member_id()
--       and (is_director() or status = 'pending')
--     )
--
-- So the only status a non-director was permitted to write was the one no
-- code path writes any more, and the desk that would have moved a row off
-- 'pending' no longer exists. The feature was dead for every ordinary member
-- from that day. `external_achievements` holds 3 rows live, which is entirely
-- consistent with that.
--
-- MEASURED BEFORE, as a real member session, in a rolled-back transaction:
--     insert ... status='approved'  (what the app sends)   BLOCKED 42501
--     insert ... (column default, also 'approved')         BLOCKED 42501
--     insert ... status='pending'   (nothing writes this)  ALLOWED
--
-- THE FIX
--
-- The policy now says what the product does. `member_id =
-- get_current_member_id()` is untouched - that is the clause that actually
-- matters, and it is what stops somebody writing an achievement onto another
-- member's profile. The status clause narrows to the two values the schema
-- uses rather than being dropped, so an invented status is still refused.
--
-- Deliberately NOT changed: the column default, the service, or the
-- 2026-09-03 decision. The application's behaviour was correct; the policy
-- had drifted away from it.

drop policy if exists "Members can submit own achievements" on public.external_achievements;
create policy "Members can submit own achievements" on public.external_achievements
  for insert
  with check (
    member_id = get_current_member_id()
    and (is_director() or status in ('approved', 'pending'))
  );

-- ── VERIFIED AFTER, same method, all four in one rolled-back transaction ────
--   own row + status='approved'  (what the app sends)   ALLOWED
--   own row + column default                            ALLOWED
--   ANOTHER member's row                                blocked 42501  ← control
--   own row + an invented status                        blocked 42501  ← control
--
-- The two controls matter as much as the two passes: widening an INSERT policy
-- is exactly where a fix turns into a hole, and neither did.
--
-- ── THE REST OF ITEM 8.1, verified the same way and needing no change ───────
-- As a real, plain-member session against live data:
--   like a post                    ok
--   comment on a post              ok
--   save a post                    ok
--   follow another member          ok
--   set own avatar (profile pic)   ok
--   read the feed                  586 rows
--
-- ── TO REVERT ───────────────────────────────────────────────────────────────
--   ... and (is_director() or status = 'pending')
-- Do not: that is the state in which the feature does not work.
-- ============================================================================
