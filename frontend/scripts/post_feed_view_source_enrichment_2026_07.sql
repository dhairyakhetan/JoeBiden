-- ============================================================================
-- post_feed_view_source_enrichment_2026_07.sql
-- (applied live 2026-07-18 as migration 019_post_feed_view_source_enrichment)
--
-- STATUS: ALREADY APPLIED to the community project (hzowuwffjqtgszecngpe) via
-- the Supabase MCP connector. Checked in here for the repo's manual-migration
-- record. Safe to re-run (CREATE OR REPLACE + CREATE INDEX IF NOT EXISTS).
--
-- WHY
-- The Phase-4 mirror triggers (014_post_primitive_mirroring.sql) copy only
-- body + category from welfare_projects / blogs / job_openings into `posts`.
-- Result: every mirrored feed card rendered as bare text — no cover image, and
-- no way to reach the source detail page. (Audited live: 555 posts, 0 with any
-- post_images row, while 484 projects have main_image and all 13 blogs have
-- featured_image.)
--
-- WHAT (read-path only — no trigger changes, no posts-schema change, no data
-- migration, no writes to the 555 posts):
--   • `images` now falls back to the source cover (welfare_projects.main_image /
--     blogs.featured_image|cover) when a post has no post_images of its own.
--   • adds source_type + source_slug so a mirrored card deep-links to
--     /projects/:slug or /blog/:slug (job openings -> /opportunities) instead
--     of the generic in-feed post modal.
--   • adds source_title (project header / blog headliner / job title) and
--     source_author (blogs.written_by) for a real byline on mirrored cards.
--
-- Frontend consumers updated in lockstep: services/api.ts (Post type),
-- services/feedService.ts (mapPostFromDB + the two explicit select lists),
-- public/HomePage.tsx (FeedPostCard source-aware rendering + deep-link).
--
-- ROLLBACK — the exact pre-019 definition (restore verbatim to revert):
--   CREATE OR REPLACE VIEW public.post_feed_view AS
--    SELECT p.post_id, p.uuid, p.category, p.body, p.link_url, p.link_title,
--      p.link_image, p.status, p.created_at, p.updated_at, p.pinned,
--      p.pinned_title, p.author_id, m.uuid AS author_uuid,
--      m.full_name AS author_name, m.avatar_url AS author_avatar,
--      m.role AS author_role, t.uuid AS team_uuid, t.name AS team_name,
--      (SELECT count(*) FROM likes l WHERE l.post_id = p.post_id) AS like_count,
--      (SELECT count(*) FROM comments c WHERE c.post_id = p.post_id) AS comment_count,
--      (SELECT json_agg(json_build_object('url', pi.blob_url, 'order', pi.display_order) ORDER BY pi.display_order)
--         FROM post_images pi WHERE pi.post_id = p.post_id) AS images,
--      (SELECT json_agg(json_build_object('id', tm.member_id, 'uuid', tm.uuid, 'name', tm.full_name, 'avatar', tm.avatar_url))
--         FROM post_tags pt JOIN members tm ON pt.tagged_member_id = tm.member_id WHERE pt.post_id = p.post_id) AS tagged_members
--     FROM posts p
--       JOIN members m ON p.author_id = m.member_id
--       LEFT JOIN teams t ON p.team_id = t.team_id
--     WHERE p.deleted_at IS NULL;
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_welfare_projects_linked_post_id ON public.welfare_projects (linked_post_id);
CREATE INDEX IF NOT EXISTS idx_blogs_linked_post_id ON public.blogs (linked_post_id);
CREATE INDEX IF NOT EXISTS idx_job_openings_linked_post_id ON public.job_openings (linked_post_id);

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
    wp.location AS source_location
   FROM posts p
     JOIN members m ON p.author_id = m.member_id
     LEFT JOIN teams t ON p.team_id = t.team_id
     LEFT JOIN welfare_projects wp ON wp.linked_post_id = p.uuid
     LEFT JOIN blogs b ON b.linked_post_id = p.uuid
     LEFT JOIN job_openings jo ON jo.linked_post_id = p.uuid
  WHERE p.deleted_at IS NULL;
