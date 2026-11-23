-- 2026-11-13: widen create_post_as_org() from is_super_admin() to is_director()
-- (director, hod, super_admin, hr). Owner decision: any leader may publish as the
-- official AquaTerra channel. Function body otherwise identical to
-- post_as_org_account_2026_09.sql. APPLIED LIVE 2026-11-13.
CREATE OR REPLACE FUNCTION public.create_post_as_org(
  p_category text,
  p_body text,
  p_link_url text DEFAULT NULL,
  p_link_title text DEFAULT NULL,
  p_link_image text DEFAULT NULL,
  p_stats jsonb DEFAULT '[]'::jsonb,
  p_status text DEFAULT 'published',
  p_scheduled_for timestamptz DEFAULT NULL,
  p_image_urls text[] DEFAULT NULL,
  p_document_urls jsonb DEFAULT NULL,
  p_tagged_member_ids integer[] DEFAULT NULL
)
RETURNS TABLE(post_id integer, uuid uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  org_member_id integer;
  new_post_id integer;
  new_post_uuid uuid;
  doc jsonb;
  i integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'must be authenticated to post as the org account';
  END IF;

  IF NOT public.is_director() THEN
    RAISE EXCEPTION 'only a HoD, director or super admin can post as the AquaTerra org account';
  END IF;

  IF p_status NOT IN ('pending_review', 'published', 'scheduled') THEN
    RAISE EXCEPTION 'invalid post status %', p_status;
  END IF;

  IF p_category NOT IN ('events', 'welfare', 'content', 'operations', 'labs') THEN
    RAISE EXCEPTION 'invalid post category %', p_category;
  END IF;

  SELECT member_id INTO org_member_id
  FROM public.members
  WHERE email = 'official@ngoaquaterra.com';

  IF org_member_id IS NULL THEN
    RAISE EXCEPTION 'AquaTerra org account not found (official@ngoaquaterra.com) - cannot post as org';
  END IF;

  INSERT INTO public.posts (
    author_id, category, body, link_url, link_title, link_image, status, scheduled_for, stats
  ) VALUES (
    org_member_id, p_category, p_body, p_link_url, p_link_title, p_link_image,
    p_status, p_scheduled_for, COALESCE(p_stats, '[]'::jsonb)
  )
  RETURNING posts.post_id, posts.uuid INTO new_post_id, new_post_uuid;

  IF p_image_urls IS NOT NULL AND array_length(p_image_urls, 1) > 0 THEN
    FOR i IN 1 .. array_length(p_image_urls, 1) LOOP
      INSERT INTO public.post_images (post_id, blob_url, blob_name, display_order)
      VALUES (new_post_id, p_image_urls[i], regexp_replace(p_image_urls[i], '^.*/', ''), i - 1);
    END LOOP;
  END IF;

  IF p_document_urls IS NOT NULL AND jsonb_array_length(p_document_urls) > 0 THEN
    FOR i IN 0 .. jsonb_array_length(p_document_urls) - 1 LOOP
      doc := p_document_urls -> i;
      INSERT INTO public.post_documents (
        post_id, blob_url, blob_name, file_name, file_size, mime_type, display_order
      ) VALUES (
        new_post_id,
        doc->>'url',
        regexp_replace(doc->>'url', '^.*/', ''),
        doc->>'fileName',
        COALESCE((doc->>'size')::integer, 0),
        doc->>'mimeType',
        i
      );
    END LOOP;
  END IF;

  IF p_tagged_member_ids IS NOT NULL AND array_length(p_tagged_member_ids, 1) > 0 THEN
    INSERT INTO public.post_tags (post_id, tagged_member_id)
    SELECT new_post_id, unnest(p_tagged_member_ids);
  END IF;

  INSERT INTO public.post_categories (post_id, category)
  VALUES (new_post_id, p_category)
  ON CONFLICT DO NOTHING;

  RETURN QUERY SELECT new_post_id, new_post_uuid;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_post_as_org(
  text, text, text, text, text, jsonb, text, timestamptz, text[], jsonb, integer[]
) TO authenticated;

-- After running: verify with
--   select proname, prosecdef, pg_get_userbyid(proowner) from pg_proc where proname = 'create_post_as_org';
-- (prosecdef should be true, owner should be postgres/the migration role -
-- NOT authenticated). Test end-to-end from the app: sign in as a
-- super_admin, use CreatePostModal's "post as AquaTerra" toggle, and confirm
-- the new post's author is the AquaTerra org account, not the signed-in
-- super_admin.
