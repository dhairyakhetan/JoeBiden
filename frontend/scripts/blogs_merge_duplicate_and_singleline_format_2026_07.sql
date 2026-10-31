-- APPLIED LIVE 2026-07-29. Follow-up to blogs_autoformat_bodies_2026_07.sql
-- after auditing all 36 blogs.
--
-- (1) MERGE A DUPLICATED ESSAY
-- "Before you Judge Read This" (id 10, live since Dec 2025, slug blog-9) had a
-- NULL body and was showing the "hasn't made it to the blog yet" Instagram
-- fallback. "The Half We Don't See" (loaded from the sheet) is the SAME essay
-- by the same writer under a newer title — it opens "What if the next time we
-- rushed to judge, we stopped and considered the full story?".
-- Sheet entries belong on the existing row when they match, so the body goes to
-- the LIVE row (its URL, Instagram link and history survive) and the duplicate
-- is deleted rather than publishing one piece at two URLs.
-- The duplicate's mirrored post must be deleted explicitly: blogs.linked_post_id
-- is ON DELETE SET NULL, so dropping the blog alone strands a pending_review
-- post pointing nowhere.
BEGIN;
UPDATE blogs SET body            = (select body            from blogs where slug = 'the-half-we-dont-see'),
                 minutes_of_read = (select minutes_of_read from blogs where slug = 'the-half-we-dont-see')
 WHERE slug = 'blog-9';

DELETE FROM posts WHERE uuid = (select linked_post_id from blogs where slug = 'the-half-we-dont-see');
DELETE FROM blogs WHERE slug = 'the-half-we-dont-see';
COMMIT;

-- (2) SINGLE-LINE BODIES
-- format_blog_body() bailed at `n_lines < 2`, so a body arriving as ONE
-- unbroken line was returned untouched. "It's Just a Joke" is 1,710 chars with
-- zero newlines and rendered as one dense block. For that shape the only
-- structural signal is the sentence boundary: group sentences into ~400-char
-- paragraphs, break only AFTER terminal punctuation, and fold a short trailing
-- run back into the previous paragraph instead of leaving an orphan.
-- Still whitespace-only — a space between sentences becomes a paragraph break.
--
-- The full function body lives in blogs_autoformat_bodies_2026_07.sql; this
-- file records the added branch. Re-apply that file (it is CREATE OR REPLACE)
-- to get the current version.
--
-- GATE — must return 0 before applying the UPDATE:
--   select count(*) from blogs where body is not null
--     and regexp_replace(body,'\s','','g')
--      <> regexp_replace(public.format_blog_body(body),'\s','','g');
-- Verified 2026-07-29: 33/33 identical, 0 changed.

UPDATE blogs SET body = public.format_blog_body(body) WHERE body IS NOT NULL;

UPDATE posts p SET body = public.blog_post_writeup(b.headliner, b.body, b.written_by)
  FROM blogs b WHERE b.linked_post_id = p.uuid AND b.body IS NOT NULL;

-- Post-state: 36 blogs, 0 walls of text, 0 missing feed posts, 0 missing read
-- times, 13 live / 23 scheduled. Remaining gaps are CONTENT, not code:
--   * 3 blogs still have no body (Welcome to Blogs!, Pebbles and Peaks,
--     Art of empathy) — never present in the spreadsheet.
--   * 23 blogs have no cover image, which is why their posts sit in the HoD
--     review queue rather than auto-publishing.
