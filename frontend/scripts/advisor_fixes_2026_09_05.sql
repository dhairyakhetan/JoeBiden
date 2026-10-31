-- ═══════════════════════════════════════════════════════════════════════
-- Two small fixes found via get_advisors (security + performance) during
-- the autopilot redesign-completion pass, applied directly since both are
-- additive/low-risk and match patterns this repo has already fixed once.
--
-- STATUS: APPLIED 2026-09-05 to hzowuwffjqtgszecngpe, verified by requery
-- (view definition re-read; pg_indexes re-checked for all 3 index names).
-- ═══════════════════════════════════════════════════════════════════════

-- 1. member_directory_view's role_rank CASE never got an 'hr' branch when the
-- hr role was added 2026-09-03 — same class of bug as the missing 'lead'
-- branch fixed 2026-08-30 (member_directory_view_lead_rank_2026_08_30.sql).
-- hr is equal power to super_admin per lib/roles.ts and must rank alongside
-- it (0), not fall into the ELSE 4 bucket with plain members.
create or replace view public.member_directory_view as
 SELECT m.member_id,
    m.uuid,
    m.email,
    m.full_name,
    m.avatar_url,
    m.class_grade,
    m.phone,
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
   FROM (members m
     LEFT JOIN schools s ON ((s.school_id = m.school_id)))
  WHERE (is_director() OR is_super_admin());

-- 2. Three FK columns with no covering index (get_advisors performance scan).
-- Same pattern already fixed once: welfare_check_in_missing_fk_indexes_2026_08_31.
create index if not exists idx_member_activity_actor_id on public.member_activity(actor_id);
create index if not exists idx_desk_todos_assignee_id on public.desk_todos(assignee_id);
create index if not exists idx_member_of_the_month_picked_by on public.member_of_the_month(picked_by);

-- Note on the rest of the security advisor scan: ~20 WARN-level
-- "SECURITY DEFINER function executable by anon/authenticated" findings are
-- all pre-existing, intentional helper RPCs (is_director, get_current_member_id,
-- etc.) that do their own internal role checks — this is the established,
-- by-design pattern in this schema (see prior sessions' notes on the same
-- WARN class). The 3 ERROR-level "SECURITY DEFINER view" findings
-- (member_directory_view, pending_member_approvals, rejected_member_approvals)
-- were checked by hand: each view's WHERE clause re-implements the same
-- (is_director() OR is_super_admin()) check inline, so the elevated read
-- access the view needs (director-only visibility into applicant email/phone,
-- which normal column grants don't allow) is correctly gated. Verified safe,
-- not fixed further.
