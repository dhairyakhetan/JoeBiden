-- ──────────────────────────────────────────────────────────────────────────
-- post_feed_view — stop showing closed/paused/deleted job openings as posts
--
-- Root cause: mirror_job_opening_to_post() (backend/migrations/014_post_
-- primitive_mirroring.sql) INSERTs a mirrored `posts` row the first time an
-- opening transitions to 'open', but nothing ever runs when the opening
-- later closes — the mirrored post stays `status = 'published'` in the
-- `posts` table forever, so a closed role keeps appearing in the feed
-- indefinitely.
--
-- Fix, at the view (not the base table): post_feed_view already LEFT JOINs
-- job_openings as `jo` for source_type/source_slug/source_title (see
-- frontend/scripts/post_feed_view_source_enrichment_2026_07.sql) — this adds
-- one WHERE condition so any post whose source IS a job_opening only shows
-- while that opening is still actually `open`. Posts with no job_opening
-- source (jo.opening_id IS NULL — the overwhelming majority: welfare
-- projects, blogs, plain feed posts) are untouched.
--
-- This is a straight CREATE OR REPLACE VIEW of the same enrichment view —
-- copy the full SELECT here (not just the WHERE) since Postgres views can't
-- be ALTERed incrementally. Re-run post_feed_view_source_enrichment_2026_07.sql
-- first if this project's view predates that migration.
--
-- CORRECTED 2026-07-23: first version of this script errored with
-- "42P16: cannot drop columns from view" — posts_featured_flag_2026_07.sql
-- had already appended a trailing `p.featured` column to this view (its own
-- comments document that CREATE OR REPLACE VIEW in Postgres can only append
-- columns, never drop/reorder them), and this script's SELECT list didn't
-- include it. Added `p.featured` back as the last column to match what's
-- actually live.
-- ──────────────────────────────────────────────────────────────────────────

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
  WHERE p.deleted_at IS NULL
    AND (jo.opening_id IS NULL OR jo.status = 'open');
