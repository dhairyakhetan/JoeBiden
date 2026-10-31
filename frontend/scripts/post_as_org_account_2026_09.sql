-- Lets a super_admin (or hr, per lib/roles.ts's ADMIN_ROLES / isSuperAdmin())
-- publish a feed post AS the canonical AquaTerra org account
-- (members.email = 'official@ngoaquaterra.com', member_id 1143 live) instead
-- of under their own identity.
--
-- Why an RPC instead of a client-side INSERT with a different author_id:
-- posts' own "Active members can insert posts" INSERT policy is
--   WITH CHECK (author_id = get_current_member_id() AND ...active member...)
-- -- i.e. you can only ever author-INSERT as YOURSELF. Unlike posts'
-- UPDATE/DELETE policies, there is no director/super-admin escape hatch on
-- INSERT. Worse, post_images and post_documents' own INSERT policies are
-- even stricter than post_tags/post_categories: both require
-- `posts.author_id = get_current_member_id()` with NO is_director()
-- fallback at all (post_tags/post_categories at least have `OR
-- is_director()` - see the AQ ECOSYSTEM "Known Gaps and Debt" C9 note on
-- these two lacking that fallback). So a super_admin posting with
-- author_id set to the org account's id would fail RLS on posts,
-- post_images AND post_documents, every time - a plain client-side
-- "post as org" toggle cannot work without either broadly loosening those
-- policies (letting ANY director forge authorship, not just this one
-- narrow "post as the org account" case) or a purpose-built RPC. This
-- takes the RPC path, matching existing precedent in this codebase:
-- mirror_welfare_project_to_post() already inserts author_id =
-- official@ngoaquaterra.com's member_id from inside a SECURITY DEFINER
-- function for exactly this reason (see
-- mirror_welfare_project_to_post_security_definer_2026_08.sql).
--
-- The org member_id is resolved SERVER-SIDE inside this function via the
-- same hardcoded email lookup the mirror triggers already use - the client
-- NEVER supplies an author_id, so there is no way to make this RPC write
-- any author other than that one fixed org account. Authorization is
-- `is_super_admin()` (super_admin or hr) - anyone else calling this RPC
-- gets a raised exception, not a silently-ignored no-op. This is the real
-- security boundary; the UI-level `isSuperAdmin()` check in
-- CreatePostModal.tsx / feedService.ts is defense-in-depth only, matching
-- this codebase's "RLS/RPC is the real boundary, not client code" model.
--
-- Mirrors feedService.createPost()'s own insert shape (posts, then
-- post_images / post_documents / post_tags / post_categories) so the
-- resulting row is indistinguishable from a normal post other than its
-- author. Status/scheduling validation is intentionally minimal (just the
-- CHECK-constraint-matching allow-list) - the real leader/schedule/
-- moderation logic already lives in feedService.createPost() and is
-- computed before this RPC is ever called; this function trusts its caller
-- for that part exactly as much as the ordinary INSERT path already does.

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

  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'only a super admin can post as the AquaTerra org account';
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
