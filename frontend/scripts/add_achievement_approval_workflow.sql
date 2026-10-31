-- ──────────────────────────────────────────────────────────────────────────
-- AquaTerra community: add director-approval workflow to external_achievements
-- ──────────────────────────────────────────────────────────────────────────
-- Applied to the main AquaTerra Supabase project (hzowuwffjqtgszecngpe)
-- on 2026-05-18 via the supabase MCP. Source-of-truth git copy.
--
-- Goal: members submit achievements to their profile, but they only show
-- publicly after a director approves. Owner sees own at any status with
-- a status badge.
--
-- Status state machine:
--   pending     (default on insert)
--   pending →   approved        (director clicks Approve)
--   pending →   rejected        (director clicks Reject, optional note)
--   approved →  pending  (auto, owner edits an approved row)
--   rejected →  pending  (auto, owner edits a rejected row → re-submit)
--
-- The auto-flip is enforced by trg_reset_achievement_status_on_owner_edit
-- so the application code can't accidentally leave stale-approval state
-- on edited content.
-- ──────────────────────────────────────────────────────────────────────────

-- ═══ 1. Add columns ═══════════════════════════════════════════════════════
ALTER TABLE public.external_achievements
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS reviewed_by integer
    REFERENCES public.members(member_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamp without time zone,
  ADD COLUMN IF NOT EXISTS review_note text;

-- Grandfather existing rows (they predate the workflow) so they stay
-- visible on profiles after this migration.
UPDATE public.external_achievements
   SET status = 'approved'
 WHERE status = 'pending';

COMMENT ON COLUMN public.external_achievements.status IS
  'Approval state: pending (default on insert), approved (director OK), rejected (director declined). Drives public visibility.';

-- ═══ 2. RLS — status-aware replacements ══════════════════════════════════
DROP POLICY IF EXISTS "Anyone can view achievements"            ON public.external_achievements;
DROP POLICY IF EXISTS "Public can view achievements"            ON public.external_achievements;
DROP POLICY IF EXISTS "Members can manage own achievements"     ON public.external_achievements;
DROP POLICY IF EXISTS "Members can insert their own achievements" ON public.external_achievements;
DROP POLICY IF EXISTS "Members can update their own achievements" ON public.external_achievements;
DROP POLICY IF EXISTS "Members can delete their own achievements" ON public.external_achievements;

CREATE POLICY "Public can view approved achievements"
  ON public.external_achievements FOR SELECT
  USING (
    status = 'approved'
    OR member_id = public.get_current_member_id()
    OR public.is_director()
  );

CREATE POLICY "Members can submit own achievements"
  ON public.external_achievements FOR INSERT
  WITH CHECK (
    member_id = public.get_current_member_id()
    AND (public.is_director() OR status = 'pending')
  );

CREATE POLICY "Owners and directors can update achievements"
  ON public.external_achievements FOR UPDATE
  USING (member_id = public.get_current_member_id() OR public.is_director())
  WITH CHECK (member_id = public.get_current_member_id() OR public.is_director());

CREATE POLICY "Owners and directors can delete achievements"
  ON public.external_achievements FOR DELETE
  USING (member_id = public.get_current_member_id() OR public.is_director());

-- ═══ 3. Trigger: auto-flip status on owner content edits ═════════════════
CREATE OR REPLACE FUNCTION public.reset_achievement_status_on_owner_edit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.member_id = public.get_current_member_id()
     AND NOT public.is_director()
     AND OLD.status IN ('approved','rejected')
     AND (
       OLD.title IS DISTINCT FROM NEW.title
       OR OLD.description IS DISTINCT FROM NEW.description
       OR OLD.achievement_type IS DISTINCT FROM NEW.achievement_type
       OR OLD.achievement_date IS DISTINCT FROM NEW.achievement_date
       OR OLD.achievement_end_date IS DISTINCT FROM NEW.achievement_end_date
       OR OLD.proof_url IS DISTINCT FROM NEW.proof_url
     )
  THEN
    NEW.status := 'pending';
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.review_note := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_achievement_status_on_owner_edit
  ON public.external_achievements;

CREATE TRIGGER trg_reset_achievement_status_on_owner_edit
  BEFORE UPDATE ON public.external_achievements
  FOR EACH ROW EXECUTE FUNCTION public.reset_achievement_status_on_owner_edit();
