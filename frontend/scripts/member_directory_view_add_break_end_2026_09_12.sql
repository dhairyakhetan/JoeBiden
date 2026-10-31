-- APPLIED LIVE 2026-09-12 via Supabase MCP (migration name: member_directory_view_add_break_end)
--
-- Bug fix, found by code review: MemberDirectory.tsx's "On a break" filter
-- pill reads `member.breakEnd` (directorService.ts maps it from
-- `m.break_end`), but `member_directory_view` - the view
-- directorService.getMemberDirectory() actually queries - never exposed a
-- break_end column at all. The base `members.break_end` column already has
-- the right authenticated grants (checked live via
-- information_schema.column_privileges), it just wasn't in this view's
-- explicit column list, so `breakEnd` was always `undefined` and the
-- filter always rendered "no one is on a break" even when several members
-- genuinely were.
--
-- Only `break_end` is added - that's the one column isCurrentlyOnBreak()
-- (services/breakService.ts) actually reads; break_start/break_reason
-- aren't shown anywhere in this desk's UI.
--
-- Verified live via:
--   select pg_get_viewdef('public.member_directory_view', true);
create or replace view public.member_directory_view as
 SELECT m.member_id,
    m.uuid,
    m.email,
    m.full_name,
    m.avatar_url,
    m.class_grade,
        CASE
            WHEN is_super_admin() THEN m.phone
            ELSE NULL::character varying
        END::character varying(20) AS phone,
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
        END AS role_rank,
    m.break_end
   FROM members m
     LEFT JOIN schools s ON s.school_id = m.school_id
  WHERE is_director() OR is_super_admin();
