-- Same bug as mirror_welfare_project_to_post_security_definer_2026_08.sql,
-- found by auditing every trigger in the DB for the same shape (INSERT into
-- another table as a fixed "system" author, without SECURITY DEFINER).
-- mirror_blog_to_post and mirror_job_opening_to_post both had it:
--
-- mirror_blog_to_post: inserts the mirrored post as NEW.author_id if set,
-- else falls back to official@ngoaquaterra.com. Without SECURITY DEFINER
-- this still breaks any time the account clicking "publish" (a director)
-- isn't the same member as the blog's own author -- i.e. the normal case,
-- since blog approval/publish is director-gated. posts' INSERT policy
-- requires author_id = get_current_member_id(), which is the director's own
-- id, not the blog author's.
--
-- mirror_job_opening_to_post: always inserts as official@ngoaquaterra.com,
-- byte-for-byte the same failure mode as the original welfare_projects bug
-- -- would reject on every single job opening ever set to 'open'.
--
-- Fix: SECURITY DEFINER on both, same pattern as the welfare_projects fix
-- and ensure_member(). search_path stays locked to '' (already set).
-- Bodies otherwise unchanged from pg_get_functiondef, confirmed live
-- 2026-08-06.

CREATE OR REPLACE FUNCTION public.mirror_blog_to_post()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  aq_member_id integer;
  new_post_uuid uuid;
  writeup text;
  post_status text;
BEGIN
  IF NEW.linked_post_id IS NULL THEN
    aq_member_id := NEW.author_id;

    IF aq_member_id IS NULL THEN
      SELECT member_id INTO aq_member_id
        FROM public.members WHERE email = 'official@ngoaquaterra.com';
    END IF;

    writeup := public.blog_post_writeup(NEW.headliner, NEW.body, NEW.written_by);

    -- Ready = genuinely live AND has a cover. A live blog with no cover renders
    -- as an empty grey card in the feed, so the image is part of the gate.
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

CREATE OR REPLACE FUNCTION public.mirror_job_opening_to_post()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  aq_member_id integer;
  new_post_uuid uuid;
BEGIN
  IF NEW.status = 'open' AND NEW.linked_post_id IS NULL THEN
    SELECT member_id INTO aq_member_id FROM public.members WHERE email = 'official@ngoaquaterra.com';
    INSERT INTO public.posts (author_id, category, body, status)
    VALUES (aq_member_id, NEW.category, NEW.title || E'\n\n' || NEW.description, 'published')
    RETURNING uuid INTO new_post_uuid;
    NEW.linked_post_id := new_post_uuid;
  END IF;
  RETURN NEW;
END;
$function$;
