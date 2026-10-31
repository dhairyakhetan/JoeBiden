-- ═══════════════════════════════════════════════════════════════════════
-- Achievements were switched to auto-approve-on-submit
-- (REDESIGN_FEATURE_REQUESTS.md item 2, 2026-09-04): achievementService.ts's
-- create() explicitly sets status:'approved' at the app layer, and the review
-- desk (AchievementReviews.tsx) that used to promote pending->approved was
-- deleted entirely (no route, no tab, no service function left).
--
-- Found during a re-verification pass: this column's own DEFAULT was never
-- updated to match and still said 'pending'. Purely latent today (checked
-- live first: all 3 existing rows are 'approved', zero stuck pending rows)
-- but a real gap - any future insert path that forgets to pass status
-- explicitly (a bug, a direct PostgREST call, a new feature added later)
-- would silently create a permanently-stuck row with no UI left anywhere to
-- un-stick it, since the review desk is gone.
--
-- STATUS: APPLIED 2026-09-05 to hzowuwffjqtgszecngpe, verified by requery:
--   column_default = 'approved'::text
-- ═══════════════════════════════════════════════════════════════════════

alter table public.external_achievements alter column status set default 'approved';
