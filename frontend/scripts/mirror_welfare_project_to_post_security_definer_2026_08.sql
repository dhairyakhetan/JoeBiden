-- Fixes "new row violates row-level security policy for table posts" when
-- publishing a welfare project (draft -> live) from the director desk.
--
-- Root cause: mirror_welfare_project_to_post() (originally created in
-- migration 014, not checked into this repo) inserts the mirrored posts row
-- with author_id set to the official@ngoaquaterra.com system account, but the
-- function was NOT security definer -- so the INSERT ran under the
-- publishing director's own session. posts' INSERT policy ("Active members
-- can insert posts") requires author_id = get_current_member_id(), which
-- resolves to the director's own id, not the system account's. Mismatch,
-- every time, regardless of who publishes.
--
-- Fix: mark the function SECURITY DEFINER (same trusted-system-trigger
-- pattern already used by ensure_member(), see
-- community_auth_member_bootstrap_2026_06.sql) so the INSERT runs as the
-- function owner and bypasses RLS, instead of trying to satisfy the
-- human-authorship check for what is intentionally a system-authored mirror
-- row. search_path stays locked to '' (already set) to avoid the classic
-- SECURITY DEFINER search-path hijack.
--
-- Body is unchanged from the live function (confirmed via pg_get_functiondef
-- 2026-08-06) other than adding SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.mirror_welfare_project_to_post()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  aq_member_id integer;
  new_post_uuid uuid;
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.is_draft = true AND NEW.is_draft = false)
     OR (TG_OP = 'INSERT' AND NEW.is_draft = false) THEN
    IF NEW.linked_post_id IS NULL THEN
      SELECT member_id INTO aq_member_id FROM public.members WHERE email = 'official@ngoaquaterra.com';
      INSERT INTO public.posts (author_id, category, body, status)
      VALUES (aq_member_id, NEW.category,
              COALESCE(NEW.header, '') || E'\n\n' || COALESCE(NEW.short_summary, ''),
              'published')
      RETURNING uuid INTO new_post_uuid;
      NEW.linked_post_id := new_post_uuid;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- After running: test by publishing a draft project from /director/projects.
-- If it still fails, the function owner itself may lack INSERT on posts /
-- SELECT on members (unlikely for a standard migration role, but check
-- `SELECT proowner::regrole FROM pg_proc WHERE proname =
-- 'mirror_welfare_project_to_post'` if so), or `posts` may have
-- FORCE ROW LEVEL SECURITY set (`SELECT relforcerowsecurity FROM pg_class
-- WHERE relname = 'posts'`), which would make even the owner subject to RLS.
