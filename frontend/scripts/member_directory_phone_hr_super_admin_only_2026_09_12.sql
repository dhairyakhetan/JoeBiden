-- APPLIED LIVE 2026-09-12 via Supabase MCP apply_migration
-- (migration name: member_directory_view_phone_hr_super_admin_only)
--
-- Owner request: "all hods should not have access to phone numbers... only
-- HR and superadmins" - HR and super_admin are meant to be identical in
-- power (name difference only, per lib/roles.ts's ADMIN_ROLES).
--
-- Before this, member_directory_view's row filter was `is_director() OR
-- is_super_admin()` with no per-column restriction, so it returned the raw
-- phone column to every director/hod. MemberDirectory.tsx's "reveal
-- contact" capability only controlled whether the value was RENDERED -
-- exactly the same client-side-only gate flagged for email in the earlier
-- HoD-desk audit. Fixed for real here: phone is NULL in the view's output
-- unless the caller is hr or super_admin (is_super_admin()), so a plain
-- director/hod never receives the value at all, regardless of the
-- capability matrix. lib/capabilities.ts's action.reveal_contact ceiling
-- was lowered from LEADER_CEILING to SUPER_CEILING to match.
--
-- NOT touched: email. This view still returns raw email to every
-- director/hod (matching the app's existing, apparently-intentional
-- behavior - email renders unconditionally in MemberDirectory.tsx, no
-- reveal step). Flagged for the owner's awareness, not fixed, since it
-- wasn't part of this request and email-visible-to-all-leaders may be
-- deliberate.
create or replace view public.member_directory_view
with (security_invoker = false) as
SELECT m.member_id,
    m.uuid,
    m.email,
    m.full_name,
    m.avatar_url,
    m.class_grade,
    CASE WHEN is_super_admin() THEN m.phone ELSE NULL END::character varying(20) AS phone,
    m.instagram,
    m.linkedin,
    s.name AS school_name,
    m.role,
    m.status,
    m.is_active,
    m.created_at,
    CASE m.role
        WHEN 'super_admin'::text THEN 0
        WHEN 'hr'::text THEN 0
        WHEN 'director'::text THEN 1
        WHEN 'hod'::text THEN 2
        WHEN 'lead'::text THEN 3
        ELSE 4
    END AS role_rank
   FROM members m
     LEFT JOIN schools s ON s.school_id = m.school_id
  WHERE is_director() OR is_super_admin();

-- Verify:
-- select column_name from information_schema.columns where table_name='member_directory_view';
