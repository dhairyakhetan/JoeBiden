-- ============================================================================
-- post_feed_view: stop collapsing a welfare drive to one photo — 2026-09-11
-- STATUS: **APPLIED** to the community project (hzowuwffjqtgszecngpe) via the
--         Supabase MCP connector as migration
--         `post_feed_view_expose_all_welfare_images`. Verify live before
--         trusting this header; paper trails in this repo have drifted before.
-- ============================================================================
--
-- WHAT WAS WRONG
--
-- `welfare_projects` carries five image columns — main_image, image_1, image_2,
-- image_3, image_4 — and the feed view emitted only the first:
--
--     WHEN wp.id IS NOT NULL AND COALESCE(wp.main_image,'') <> ''
--       THEN json_build_array(json_build_object('url', wp.main_image, 'order', 0))
--
-- Counted live before the change:
--     image_1  110 rows      three or more photos   100 rows
--     image_2   98 rows      exactly two photos      10 rows
--     image_3   84 rows
--     image_4   73 rows
--
-- Every one of those arrived in the app as a single image, so `imageCount` was
-- 1 for every welfare row and **0 of 586 feed rows had two or more images**.
--
-- WHY IT MATTERED BEYOND THE MISSING PHOTOS
--
-- `lib/feedShape.ts` rule 05.2 is "three or more images is a shoot, and a shoot
-- reads as a stack" and selects C04 (CardCollection). The rule was right and
-- the card was built; the data reaching it had been flattened, so the shape was
-- listed in `feedItemFromPost.ts` as "unreachable anyway — 0 rows with 2+
-- images". That was true of what reached the app and false of the database.
--
-- This is NOT inventing an input to force a shape — the thing that file's
-- header rightly forbids. A human uploaded those photos to that drive and the
-- view was discarding four fifths of them.
--
-- HOW
--
-- A string replace on the live definition rather than a retyped view. The view
-- has 34 columns; re-emitting it by hand to change one expression is how a
-- column quietly changes type. The DO block raises if the expression it expects
-- is absent, so a future change to the view fails loudly instead of being
-- silently skipped.
--
-- `security_invoker = on` is restated explicitly: CREATE OR REPLACE VIEW does
-- not carry reloptions over, and losing it would switch the view to running
-- with its owner's rights — a privilege escalation out of a change about
-- photographs. Verified after applying: reloptions is still
-- {security_invoker=on}, and grants (anon/authenticated SELECT only) survived.

do $$
declare
  def    text;
  newdef text;
  old_expr constant text :=
    $x$json_build_array(json_build_object('url', wp.main_image, 'order', 0))$x$;
  new_expr constant text :=
    $x$( SELECT json_agg(json_build_object('url', t.u, 'order', t.o - 1) ORDER BY t.o)
           FROM unnest(ARRAY[wp.main_image, wp.image_1, wp.image_2, wp.image_3, wp.image_4])
             WITH ORDINALITY t(u, o)
          WHERE COALESCE(t.u, ''::text) <> ''::text)$x$;
begin
  def := pg_get_viewdef('public.post_feed_view'::regclass, true);
  if position(old_expr in def) = 0 then
    raise exception
      'post_feed_view images expression not found - the view changed, refusing to guess';
  end if;
  newdef := replace(def, old_expr, new_expr);
  execute 'create or replace view public.post_feed_view with (security_invoker = on) as ' || newdef;
end $$;

-- ── AFTER, counted live ─────────────────────────────────────────────────────
--   three or more images   100 rows   (was 0)
--   exactly two              8 rows   (was 0)
--   exactly one            396 rows
--   none                    82 rows
--   reloptions             {security_invoker=on}   preserved
--
-- Rendered feed, measured in the browser over the first 15 cards:
--   before   C03 x7, C07 x5, C25 x3            3 shapes
--   after    C03 x2, C04 x5, C07 x5, C25 x3    4 shapes, 5 photo stacks
--
-- ── TO REVERT ───────────────────────────────────────────────────────────────
-- Run the same DO block with old_expr and new_expr swapped. The app degrades
-- cleanly on its own: with one image per row, rule 05.2 stops firing and those
-- rows fall back to C03, exactly as before.
-- ============================================================================
