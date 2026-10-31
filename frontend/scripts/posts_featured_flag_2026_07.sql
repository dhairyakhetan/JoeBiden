-- ============================================================================
-- posts_featured_flag_2026_07.sql
--
-- STATUS: NOT YET APPLIED. Run this in the Supabase SQL editor of the
-- COMMUNITY project (hzowuwffjqtgszecngpe — the one VITE_SUPABASE_URL points
-- at, where `posts` / `post_feed_view` live). It could not be applied via the
-- MCP connector this session because that connector only exposes the CMS
-- project, not the community project. Safe to re-run (idempotent).
--
-- WHY
-- "Pinned" was overloaded: one flag drove BOTH the home-page notice ticker AND
-- the Projects/Directory "featured drives" band. This splits them so a leader
-- can feature a drive on the Projects page independently of pinning it to the
-- notice board. New `posts.featured` column; `post_feed_view` exposes it; the
-- Projects featured band now reads `featured = true` instead of `pinned = true`.
--
-- WHAT
--   1. adds `posts.featured boolean not null default false`
--   2. a partial index for the "featured, newest first" read the band does
--   3. CREATE OR REPLACE post_feed_view to surface p.featured (this is the
--      019 definition verbatim + the single new `p.featured` column — adding a
--      column to `posts` does NOT auto-appear in the view, the view must be
--      recreated).
--
-- Until this runs, PublicProjectsPage's featured-band query errors softly and
-- the band falls back to the 3 latest drives (labelled "★ latest") — no crash.
--
-- NOTE: `p.featured` is appended as the LAST select column, not inserted next
-- to `pinned`/`pinned_title` where it reads more naturally. Postgres's
-- CREATE OR REPLACE VIEW only allows appending columns — every existing
-- output column must keep its original name AND POSITION, or it errors
-- (42P16: "cannot change name of view column ... to ..."). Inserting it
-- mid-list shifts every column after it by one position, which Postgres
-- reads as renaming each of them. First attempt at this migration hit
-- exactly that; fixed by moving p.featured to the end.
-- ============================================================================

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;

-- The band selects published, non-job-opening, featured posts, newest first.
CREATE INDEX IF NOT EXISTS idx_posts_featured
  ON public.posts (created_at DESC)
  WHERE featured = true AND deleted_at IS NULL;

CREATE OR REPLACE VIEW public.post_feed_view AS
 SELECT p.post_id,
    p.uuid,
    p.category,
    p.body,
    p.link_url,
    p.link_title,
    p.link_image,
    p.status,
    p.created_at,
    p.updated_at,
    p.pinned,
    p.pinned_title,
    p.author_id,
    m.uuid AS author_uuid,
    m.full_name AS author_name,
    m.avatar_url AS author_avatar,
    m.role AS author_role,
    t.uuid AS team_uuid,
    t.name AS team_name,
    ( SELECT count(*) AS count FROM likes l WHERE l.post_id = p.post_id) AS like_count,
    ( SELECT count(*) AS count FROM comments c WHERE c.post_id = p.post_id) AS comment_count,
    COALESCE(
      ( SELECT json_agg(json_build_object('url', pi.blob_url, 'order', pi.display_order) ORDER BY pi.display_order)
           FROM post_images pi WHERE pi.post_id = p.post_id),
      CASE
        WHEN wp.id IS NOT NULL AND COALESCE(wp.main_image, '') <> '' THEN json_build_array(json_build_object('url', wp.main_image, 'order', 0))
        WHEN b.id IS NOT NULL AND COALESCE(b.featured_image, b.cover, '') <> '' THEN json_build_array(json_build_object('url', COALESCE(b.featured_image, b.cover), 'order', 0))
        ELSE NULL
      END
    ) AS images,
    ( SELECT json_agg(json_build_object('id', tm.member_id, 'uuid', tm.uuid, 'name', tm.full_name, 'avatar', tm.avatar_url))
         FROM post_tags pt JOIN members tm ON pt.tagged_member_id = tm.member_id WHERE pt.post_id = p.post_id) AS tagged_members,
    CASE
      WHEN wp.id IS NOT NULL THEN 'welfare_project'
      WHEN b.id IS NOT NULL THEN 'blog'
      WHEN jo.opening_id IS NOT NULL THEN 'job_opening'
      ELSE NULL
    END AS source_type,
    COALESCE(wp.slug, b.slug) AS source_slug,
    COALESCE(wp.header, b.headliner, jo.title) AS source_title,
    b.written_by AS source_author,
    wp.location AS source_location,
    p.featured
   FROM posts p
     JOIN members m ON p.author_id = m.member_id
     LEFT JOIN teams t ON p.team_id = t.team_id
     LEFT JOIN welfare_projects wp ON wp.linked_post_id = p.uuid
     LEFT JOIN blogs b ON b.linked_post_id = p.uuid
     LEFT JOIN job_openings jo ON jo.linked_post_id = p.uuid
  WHERE p.deleted_at IS NULL;
