-- 2026-11-13: an applicant with no phone number can no longer reach, or be passed
-- through, the HoD approvals desk.
--
-- Why: the sign-up funnel is Google-OAuth-only. ensure_member() inserts a
-- pending_approval row the moment someone signs in, BEFORE /register has asked for
-- their phone. A person who closes the tab at that point sat in the approvals queue
-- as an "application" with no phone and no class (seen 12 Nov 2026, member 1621).
-- The app bounces them back to /register on their next visit, but the queue showed
-- them in the meantime and approveMember() would have let HR activate them.
--
-- 1. pending_member_approvals only lists applicants who finished registration
--    (a 10+ digit phone via members_phone_key()). Same columns, same security model
--    (SECURITY DEFINER view gated inline by is_director() OR is_super_admin()).
--    CREATE OR REPLACE keeps the view's owner and options.
-- 2. A trigger refuses pending_approval -> active when there is no usable phone,
--    so no desk, script or SQL-editor update can approve a phoneless applicant.
--    It fires only on that one transition: the 1,229 legacy active members without
--    a phone are untouched, and rejected -> active is not affected.
-- APPLIED LIVE (confirmed 2026-11-15): trigger present, queue view filtered, and a rolled-back test update of a phoneless pending applicant raised phone_required.

CREATE OR REPLACE VIEW public.pending_member_approvals AS
 SELECT member_id, uuid, email, full_name, avatar_url, class_grade, phone,
        join_reason, bio, created_at, contacted_at, previously_removed
   FROM members
  WHERE status::text = 'pending_approval'
    AND is_active = true
    AND public.members_phone_key(phone) IS NOT NULL
    AND (is_director() OR is_super_admin());

CREATE OR REPLACE FUNCTION public.members_require_phone_to_activate()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF OLD.status::text = 'pending_approval' AND NEW.status::text = 'active'
     AND public.members_phone_key(NEW.phone) IS NULL THEN
    RAISE EXCEPTION 'phone_required' USING ERRCODE = '23514',
      HINT = 'The applicant has not added a phone number yet.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS members_require_phone_to_activate ON public.members;
CREATE TRIGGER members_require_phone_to_activate
  BEFORE UPDATE OF status ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.members_require_phone_to_activate();
