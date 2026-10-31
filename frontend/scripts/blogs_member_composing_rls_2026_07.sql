-- APPLIED LIVE 2026-07-29. Makes composing a blog from inside the app possible.
--
-- BEFORE: blogs had NO author_id (only free-text `written_by`), its INSERT
-- policy required is_director(), and there was NO UPDATE policy at all — so no
-- member could create a blog and *nobody*, not even a director, could edit one
-- afterwards. That is why the nine body backfills had to be run server-side.
-- "Edit your own blog" was not even expressible: nothing linked a blog to an
-- account.
--
-- MODEL: any ACTIVE member may compose a blog. It is a DRAFT until a leader
-- publishes it — mirroring how normal posts already work (member posts land in
-- pending_review, leaders publish directly) rather than inventing a second
-- moderation model.
--
-- "Draft" needs no new column. The SELECT policy gates on published_date, so a
-- NULL date is invisible to the public by construction, and members may only
-- write rows whose published_date IS NULL. Setting the date is a leader action,
-- which is what makes self-publishing impossible.

CREATE OR REPLACE FUNCTION public.current_member_id()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT member_id FROM public.members
   WHERE auth_uid = auth.uid() AND status = 'active'
   LIMIT 1;
$function$;

ALTER TABLE public.blogs
  ADD COLUMN IF NOT EXISTS author_id integer
  REFERENCES public.members(member_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS blogs_author_id_idx ON public.blogs(author_id);

-- Only Hiya Khara resolves unambiguously. Every other blog author's apparent
-- match is a DIFFERENT person (Akshara Ruia not Vedika; Vaibhav Dujari not
-- Mrinalika; Aayush/Soumya Tripathi not Ashwika; five Sarkars, no Ahel).
UPDATE public.blogs SET author_id = 477
 WHERE written_by = 'Hiya Khara' AND author_id IS NULL;

-- ── Read: three audiences, one policy ────────────────────────────────────
-- Without the author/leader arms, a member would create a draft and instantly
-- lose sight of it, and the review queue would be invisible to the leaders
-- meant to action it.
DROP POLICY IF EXISTS "public read published blogs" ON public.blogs;
DROP POLICY IF EXISTS "public read blogs" ON public.blogs;

CREATE POLICY "read blogs" ON public.blogs
  FOR SELECT
  USING (
    (published_date IS NOT NULL AND published_date <= now())
    OR public.is_director()
    OR (author_id IS NOT NULL AND author_id = public.current_member_id())
  );

-- ── Write ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS blogs_director_insert ON public.blogs;

CREATE POLICY blogs_insert ON public.blogs
  FOR INSERT
  WITH CHECK (
    public.is_director()
    OR (author_id = public.current_member_id()
        AND author_id IS NOT NULL
        AND published_date IS NULL)
  );

-- USING picks which rows you may target; WITH CHECK constrains what they may
-- BECOME. Both are required — without WITH CHECK an author could edit their own
-- draft and set published_date in the same statement, publishing themselves.
CREATE POLICY blogs_update ON public.blogs
  FOR UPDATE
  USING (
    public.is_director()
    OR (author_id = public.current_member_id() AND published_date IS NULL)
  )
  WITH CHECK (
    public.is_director()
    OR (author_id = public.current_member_id() AND published_date IS NULL)
  );

CREATE POLICY blogs_delete ON public.blogs
  FOR DELETE
  USING (
    public.is_director()
    OR (author_id = public.current_member_id() AND published_date IS NULL)
  );

-- mirror_blog_to_post() also updated (see the migration of the same date) to
-- post as the blog's own author when author_id is set, instead of always
-- attributing to official@ngoaquaterra.com.
--
-- ── VERIFIED 2026-07-29, non-vacuously (a real draft + 23 real scheduled rows
--    existed during the test) ──
--   anon:      sees 13 live blogs, 0 drafts, 0 scheduled
--   member:    create own draft            ALLOWED
--              edit own draft              ALLOWED
--              self-publish own draft      BLOCKED (WITH CHECK)
--              insert an already-live blog BLOCKED
--              edit another's published    BLOCKED (0 rows)

-- ── FOLLOW-UP (same day): author_id defaults from the session ─────────────
-- The frontend's Member type exposes `uuid` only and never learns the numeric
-- member_id, so the composer cannot send author_id. Defaulting it fills the
-- value server-side from the verified JWT — which is also the safer shape,
-- since a client cannot then post a blog under someone else's account. The RLS
-- WITH CHECK (author_id = current_member_id()) still holds; it is satisfied by
-- the default rather than by a value the client had to get right. Directors
-- inserting on someone's behalf can still pass author_id explicitly.
ALTER TABLE public.blogs
  ALTER COLUMN author_id SET DEFAULT public.current_member_id();

-- VERIFIED end-to-end as a signed-in non-leader member, inserting exactly what
-- blogService.create() sends (no author_id, no published_date):
--   author_id auto-filled from session   YES
--   mirrored post status                 pending_review
--   author sees own draft                1
--   anon sees the draft                  0
--   anon total blogs visible             13
-- NOTE when testing this by hand: clear request.jwt.claims before switching to
-- the anon role. Leaving a member's claim set makes current_member_id() resolve
-- under anon too, and the author arm of the read policy then matches — which
-- looks exactly like a leak but is an artifact of the test.
