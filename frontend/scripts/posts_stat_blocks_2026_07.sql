-- ──────────────────────────────────────────────────────────────────────────
-- posts.stats — up to 2 highlighted stat blocks per post (feed card + full
-- page), e.g. { value: "150", label: "volunteers" }.
--
-- Generalizes the "colored stat rail" that already exists on the welfare
-- project detail page (PublicProjectDetailPage.tsx — volunteers count +
-- key_statistic) to any post, not just welfare_projects rows. Stored as a
-- small jsonb array (max 2 elements, enforced client-side in
-- CreatePostModal.tsx) rather than 4 separate columns since it's genuinely
-- optional/sparse data — most posts will have zero stats.
--
-- Same append-only constraint as posts_featured_flag_2026_07.sql applies:
-- CREATE OR REPLACE VIEW can only ADD trailing columns to post_feed_view,
-- never reorder/rename existing ones, so `p.stats` goes at the very end
-- again, after `p.featured` (the column posts_featured_flag_2026_07.sql
-- already appended and this project's live view now has).
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS stats jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE VIEW public.post_feed_view AS
 SELECT p.post_id, p.uuid, p.category, p.body, p.link_url, p.link_title, p.link_image,
    p.status, p.created_at, p.updated_at, p.pinned, p.pinned_title, p.author_id,
    m.uuid AS author_uuid, m.full_name AS author_name, m.avatar_url AS author_avatar, m.role AS author_role,
    t.uuid AS team_uuid, t.name AS team_name,
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
    p.featured,
    p.stats
   FROM posts p
     JOIN members m ON p.author_id = m.member_id
     LEFT JOIN teams t ON p.team_id = t.team_id
     LEFT JOIN welfare_projects wp ON wp.linked_post_id = p.uuid
     LEFT JOIN blogs b ON b.linked_post_id = p.uuid
     LEFT JOIN job_openings jo ON jo.linked_post_id = p.uuid
  WHERE p.deleted_at IS NULL
    AND (jo.opening_id IS NULL OR jo.status = 'open');
