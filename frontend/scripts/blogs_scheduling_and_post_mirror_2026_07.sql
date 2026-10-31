-- Blogs: real scheduling + a feed post that actually carries the write-up.
--
-- STATUS: ALREADY APPLIED to the live database (2026-07-28) via the Supabase
-- connector, together with blogs_content_load_2026_07.sql. Kept here as the
-- record of what changed. Do not re-run blind.
--
-- ── Why ───────────────────────────────────────────────────────────────────
-- A spreadsheet of 35 student blog posts was loaded. 9 of them matched posts
-- that were already live but whose `body` column was NULL — i.e. every blog on
-- the site rendered with a title, a cover and no article text. The other 24 are
-- a backlog scheduled from Aug–Oct 2026 and have no cover art yet.
--
-- Loading those 24 exposed two pre-existing bugs:
--
--   1. "public read blogs" was USING (true). There was no way to stage a post —
--      the instant a row existed it was live on /blog, in search and in the
--      sitemap. The 24 future-dated rows would all have published immediately.
--
--   2. mirror_blog_to_post() set the mirrored feed post's body to
--      COALESCE(NEW.headliner,'') — the TITLE only — and hardcoded
--      status='published'. So feed posts were bare headlines, and a blog that
--      is not yet public still got a live post in everyone's feed.
--
-- ── What this does ────────────────────────────────────────────────────────
--   * SELECT on blogs is gated on published_date <= now(). NULL date = not
--     public, so a row that forgets the field fails closed.
--   * blog_post_writeup() builds the feed text: headline + a 600-char excerpt
--     trimmed at a word boundary + byline. It unwraps the .docx hard-wrapping
--     (~95 cols) into flowing prose while keeping paragraph breaks.
--   * The mirror only auto-publishes when the blog is genuinely ready: live
--     date AND a cover image. Everything else lands in the HoD review queue as
--     'pending_review' — which is where the 24 cover-less drafts now sit, so a
--     director adds the artwork and approves.
-- ──────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "public read blogs" ON public.blogs;

CREATE POLICY "public read published blogs" ON public.blogs
  FOR SELECT
  USING (published_date IS NOT NULL AND published_date <= now());


CREATE OR REPLACE FUNCTION public.blog_post_writeup(
  headliner text, body text, written_by text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO ''
AS $function$
DECLARE
  sentinel constant text := chr(1);
  clean text;
  excerpt text;
  out_text text;
BEGIN
  out_text := COALESCE(NULLIF(trim(headliner), ''), 'Untitled');

  clean := replace(COALESCE(body, ''), E'\r\n', E'\n');
  -- Park real paragraph breaks behind a control char that cannot occur in
  -- prose, unwrap the remaining hard line breaks, then restore them.
  clean := regexp_replace(clean, E'\n[ \t]*\n[ \t\n]*', sentinel, 'g');
  clean := regexp_replace(clean, E'\n', ' ', 'g');
  clean := regexp_replace(clean, ' {2,}', ' ', 'g');
  clean := replace(clean, sentinel, E'\n\n');
  clean := trim(clean);

  IF clean <> '' THEN
    IF length(clean) > 600 THEN
      excerpt := regexp_replace(left(clean, 600), '\s+\S*$', '') || E'…';
    ELSE
      excerpt := clean;
    END IF;
    out_text := out_text || E'\n\n' || excerpt;
  END IF;

  IF NULLIF(trim(COALESCE(written_by, '')), '') IS NOT NULL THEN
    out_text := out_text || E'\n\n— ' || trim(written_by);
  END IF;

  RETURN out_text;
END;
$function$;


CREATE OR REPLACE FUNCTION public.mirror_blog_to_post()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  aq_member_id integer;
  new_post_uuid uuid;
  writeup text;
  post_status text;
BEGIN
  IF NEW.linked_post_id IS NULL THEN
    SELECT member_id INTO aq_member_id
      FROM public.members WHERE email = 'official@ngoaquaterra.com';

    writeup := public.blog_post_writeup(NEW.headliner, NEW.body, NEW.written_by);

    -- Both conditions matter: a live blog with no cover renders as an empty
    -- grey card in the feed, so the image is part of the readiness gate.
    IF NEW.published_date IS NOT NULL
       AND NEW.published_date <= now()
       AND NEW.featured_image IS NOT NULL
    THEN
      post_status := 'published';
    ELSE
      post_status := 'pending_review';
    END IF;

    INSERT INTO public.posts (author_id, category, body, status)
    VALUES (aq_member_id, NEW.category, writeup, post_status)
    RETURNING uuid INTO new_post_uuid;

    NEW.linked_post_id := new_post_uuid;
  END IF;
  RETURN NEW;
END;
$function$;


-- One-time backfill of the posts that were mirrored under the old trigger and
-- therefore hold only a title. Guarded on b.body IS NOT NULL so the four blogs
-- that still have no article text are left alone rather than blanked.
UPDATE posts p
   SET body = public.blog_post_writeup(b.headliner, b.body, b.written_by),
       status = CASE
         WHEN b.published_date IS NOT NULL
          AND b.published_date <= now()
          AND b.featured_image IS NOT NULL THEN 'published'
         ELSE 'pending_review'
       END
  FROM blogs b
 WHERE b.linked_post_id = p.uuid
   AND b.body IS NOT NULL;
