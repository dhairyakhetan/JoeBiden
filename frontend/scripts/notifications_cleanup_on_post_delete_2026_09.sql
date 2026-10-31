-- Deletes any notifications pointing at a post once that post is
-- (soft-)deleted, so a "so-and-so liked/commented/tagged you" entry never
-- survives as a dead link. feedService.deletePost() (frontend/src/services/
-- feedService.ts) does not hard-DELETE a posts row - migration 012 added
-- posts.deleted_at and the app soft-deletes via
-- `UPDATE posts SET deleted_at = now() WHERE uuid = ...` (post_feed_view,
-- the read path for the feed/search/content-manager, already filters
-- deleted_at IS NULL). This trigger fires on exactly that transition.
--
-- Why a trigger, not a client-side DELETE added to feedService.deletePost():
-- `notifications` currently has NO delete policy at all - not for the
-- notification's own recipient, not for a director, nobody:
--   notifications_service_insert  (INSERT, service_role only)
--   notifications_own_read        (SELECT, member_id = get_current_member_id())
--   notifications_own_update      (UPDATE, member_id = get_current_member_id())
-- (verified live via pg_policies, 2026-09-08). A client-side
-- `.from('notifications').delete()...` from feedService.deletePost() would
-- silently no-op under RLS regardless of who calls it - exactly the kind of
-- "looks done, isn't" bug this codebase has hit before. A SECURITY DEFINER
-- trigger (same trusted-system pattern as create_notification() and
-- mirror_welfare_project_to_post(), see
-- mirror_welfare_project_to_post_security_definer_2026_08.sql) fires
-- automatically on the real soft-delete UPDATE regardless of which code
-- path performs it - no feedService.ts change needed, and no new
-- "delete my notifications" client surface to separately secure/RLS-gate.
--
-- Matches on notifications.link = '/post/' || the deleted post's uuid,
-- exactly how every notification-creating call site writes it (see
-- feedService.ts's like/comment/tag notification calls, all
-- `link: /post/${post.uuid}`).

CREATE OR REPLACE FUNCTION public.cleanup_notifications_for_deleted_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    DELETE FROM public.notifications
    WHERE link = '/post/' || OLD.uuid::text;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cleanup_notifications_for_deleted_post ON public.posts;

CREATE TRIGGER trg_cleanup_notifications_for_deleted_post
AFTER UPDATE OF deleted_at ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_notifications_for_deleted_post();

-- After running: soft-delete a post that has a live notification pointing at
-- it (`select * from notifications where link = '/post/' || '<uuid>'`
-- before and after calling feedService.deletePost() / the equivalent
-- UPDATE), and confirm the matching notification row(s) are gone.
