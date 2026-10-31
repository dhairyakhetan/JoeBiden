-- ─────────────────────────────────────────────────────────────────────────────
-- Round-4 audit: the three database changes. 2026-09-12.
-- STATUS: ALL THREE APPLIED, each verified live (evidence inline).
--
-- The fourth DB change from this round lives in its own file:
--   certificate_requests_stop_trusting_the_requester_2026_09_12.sql
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. post_feed_view carries the real read time ─────────────────────────────
--
-- Every blog card in the feed said "1 min read", including for a 7,961-char
-- essay. The pill was derived in the adapter from `posts.body`, which after the
-- 4.2 fold is the ~630-character excerpt the posts_fill_article_excerpt trigger
-- writes - 100 to 125 words on ALL 36 rows, so round(words/200) was 1 every
-- time. The true figure was already stored in article->>'read_minutes' (2-7).
--
-- C06 is the "this is a long read" card. Its one distinguishing signal was
-- wrong on 100% of live rows.
--
--   ... NULLIF(p.article ->> 'read_minutes', '')::integer AS source_read_minutes
--
-- Exposed as a scalar, NOT by shipping the `article` jsonb to a list query,
-- which would carry the article text with it.
--
-- Verified: post 762 "Letter to My City" reads 7, not 1. Browser-checked on
-- the live feed - the cards now read 1, 2 and 3 min rather than all 1.


-- ── 2. post_feed_view exposes article_body FOR FILTERING ─────────────────────
--
-- Search matched a blog on `body` - again, the 630-char excerpt - so a phrase
-- 3,000 characters into an essay was unfindable even though the essay is a row
-- in the same table. 33 essays, averaging 2,969 characters of article_body, of
-- which only the first ~630 were reachable.
--
--   ... p.article_body
--
-- IMPORTANT: this column is deliberately NOT in POST_FEED_COLS or any other
-- select list. PostgREST lets a FILTER reference a column the query does not
-- select, so searchService can `.or(article_body.ilike.%q%)` while the feed
-- keeps shipping only the short excerpt. Do not add it to a projection.
--
-- Verified live, taking a phrase 2,400 chars into one essay:
--   found via body          = 0
--   found via article_body  = 1
-- and in the browser: /search?q=<that phrase> went from 0 results to 1.
--
-- Both of the above were applied with CREATE OR REPLACE VIEW, appending each
-- new column LAST - that statement cannot insert a column in the middle, and
-- it silently resets reloptions, so `with (security_invoker = on)` is restated
-- deliberately. The view reads `members`; losing invoker semantics would be a
-- real privilege change.


-- ── 3. a director can still see a deleted opening ────────────────────────────
--
-- `job_openings_public_read` was `status <> 'deleted'` for EVERYONE.
-- lib/jobOpenings.getAllIncludeDeleted() exists precisely so the Hiring desk
-- can reach a soft-deleted opening's applicants, and it could not: RLS filtered
-- the opening out, the desk never queried its job_applications rows, and those
-- applicants vanished from the desk with no "archived" state and no error while
-- their rows sat in the table. The function was an identical query wearing a
-- name that promised otherwise.

drop policy if exists job_openings_public_read on public.job_openings;
create policy job_openings_public_read
  on public.job_openings
  for select
  using (
    status::text <> 'deleted'
    or public.is_director()
    or public.is_super_admin()
  );

-- Verified live (rolled back), by ROW COUNT rather than by "did it throw":
--   marked one opening deleted, then
--     member   sees it: 0 rows
--     DIRECTOR sees it: 1 row
--
-- Not yet triggered in production: there are currently 0 deleted openings
-- (2 closed, 3 applications between them). This closes it before the first
-- delete, rather than after someone loses sight of real applicants.
