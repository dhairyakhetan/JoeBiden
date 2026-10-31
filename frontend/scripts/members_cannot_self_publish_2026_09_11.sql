-- ═══════════════════════════════════════════════════════════════════════════
-- Any member could publish straight past the moderation queue.  2026-09-11
--
-- STATUS: APPLIED LIVE this date, via the Supabase MCP connector, as migration
-- `members_cannot_self_publish_past_moderation`. Verify against live policy
-- before trusting that sentence - a checked-in .sql whose status comment has
-- drifted has burned this repo twice (CLAUDE.md).
--
-- ── WHAT WAS WRONG ─────────────────────────────────────────────────────────
-- The INSERT policy on `posts` was:
--
--   WITH CHECK (author_id = get_current_member_id()
--               AND EXISTS (select 1 from members
--                            where member_id = posts.author_id
--                              and status = 'active'))
--
-- It constrained WHO the author is. It said nothing whatsoever about `status`.
--
-- The rule that a member's post needs review existed only in the browser:
--
--   teamService.ts  status: data.forceReview ? 'pending_review'
--                             : (hasLeaderAccess(member.role) ? 'published' : 'pending_review')
--   feedService.ts  const status = data.forceReview ? 'pending_review'
--                     : (scheduledFor ? 'scheduled' : (isLeader ? 'published' : 'pending_review'))
--
-- This application has NO SERVER IN THE REQUEST PATH. `frontend/` talks to
-- PostgREST directly with the anon key (CLAUDE.md, first architecture note).
-- The client is the attacker's own code. So any active member could open the
-- console and send `status: 'published'` themselves, and the post went live
-- immediately - past the queue, past category scoping, past every moderator,
-- with no record that it had skipped anything.
--
-- Measured against the live database BEFORE the fix, as a real active `member`,
-- inside a transaction that was rolled back:
--
--   insert into posts (author_id, category, body, status)
--   values (<that member>, 'content', '...', 'published');
--   -> rows = 1, stored status = published
--
-- Found while auditing the write path for item 4.2, not while looking for it.
--
-- ── THE FIX ────────────────────────────────────────────────────────────────
-- Move the rule the client was already applying into the only place that can
-- enforce it. This is not a new product rule and it does not change what any
-- legitimate path does:
--
--   is_director()             = role in ('director','hod','super_admin','hr')
--   lib/roles.LEADER_ROLES    = ['director','hod','hr','super_admin']
--
-- The same four roles, so every existing call site keeps working exactly as it
-- did. Only the path that was never supposed to work stops working.
--
-- The non-leader branch is an ALLOWLIST (`status = 'pending_review'`) rather
-- than a denylist (`status <> 'published'`) on purpose: `posts_status_check`
-- currently permits 'pending_review' | 'published' | 'rejected' | 'scheduled',
-- and a fifth value added later must not become self-servable by default.
--
-- ── WHAT WAS ALREADY SAFE, AND IS LEFT ALONE ───────────────────────────────
-- UPDATE. Its WITH CHECK already pins a non-director to
-- ('pending_review','rejected'), so an author cannot edit their way to
-- published after the fact. Verified, not assumed.
--
-- SECURITY DEFINER writers bypass RLS by design and are unaffected:
-- `create_post_as_org` (the org account's separate write path),
-- `mirror_blog_to_post`, and `publish_due_scheduled_posts` (the pg_cron job
-- that promotes scheduled posts). If this policy had been written to catch
-- them, scheduling and org posting would both have broken.
--
-- ── VERIFICATION, after ────────────────────────────────────────────────────
-- Same rolled-back-transaction method, as a real `member` and as the real `hod`:
--
--   member -> published       BLOCKED
--   member -> scheduled       BLOCKED
--   member -> pending_review  1 row   (still works - the normal path)
--   leader -> published       1 row   (still works)
--   leader -> scheduled       1 row   (still works)
--
-- Row counts, not exceptions: RLS FILTERS rather than raising on UPDATE/DELETE,
-- so exception-only checking reports a silent denial as a success. (It does
-- raise on INSERT, but the habit is what matters - checking ROW_COUNT is the
-- only method that is correct for all three.)
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists "Active members can insert posts" on public.posts;

create policy "Active members can insert posts"
  on public.posts
  for insert
  to public
  with check (
    author_id = get_current_member_id()
    and exists (
      select 1 from public.members m
       where m.member_id = posts.author_id
         and m.status = 'active'
    )
    and (
      is_director()
      or status = 'pending_review'
    )
  );
