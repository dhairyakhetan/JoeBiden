-- ============================================================================
-- Add 'hod' as a valid member role in the community Supabase
-- Run in: https://supabase.com/dashboard/project/hzowuwffjqtgszecngpe/sql/new
-- ============================================================================

BEGIN;

-- 1. Drop the existing role constraint (if any)
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_role_check;

-- 2. Re-add with 'hod' included
ALTER TABLE members
  ADD CONSTRAINT members_role_check
  CHECK (role IN ('member', 'lead', 'director', 'hod', 'super_admin'));

-- 3. Verify existing data is still valid
SELECT DISTINCT role, COUNT(*) as count
FROM members
GROUP BY role
ORDER BY count DESC;

COMMIT;

-- ============================================================================
-- To PROMOTE an existing director to HoD (or vice versa):
--   UPDATE members SET role = 'hod' WHERE email = 'example@email.com';
--
-- To PROMOTE a member to HoD:
--   UPDATE members SET role = 'hod' WHERE email = 'example@email.com';
-- ============================================================================
