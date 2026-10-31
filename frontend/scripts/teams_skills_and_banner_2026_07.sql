-- ============================================================================
-- STATUS: APPLIED 2026-07-25 via Supabase MCP (project hzowuwffjqtgszecngpe).
-- Migration name: teams_skills_and_banner_2026_07
--
-- WHY: team rows shipped with one-line stub descriptions and nothing that said
-- what a member actually LEARNS on a team — the single most useful thing a
-- prospective joiner wants to know. Two new content fields:
--   skills     text[]  ordered list of concrete skills built on this team
--   banner_url text    wide hero image for the team page (public/ path or
--                      Supabase storage URL)
--
-- Both are additive with safe defaults, so every other team keeps working with
-- an empty skills list and no banner until its lead supplies content.
--
-- Rendered by: teams/TeamDetailPage.tsx ("what you'll build here" chip row +
-- banner card) and mirrored in lib/departments.ts for the public pages.
-- Job openings created from a team post now inherit the team's skills
-- (feed/CreatePostModal.tsx previously always sent `skills: []`).
--
-- NOTE: the AQ.Ventures banner expects the file at frontend/public/
-- team-ventures-banner.jpg. If that asset is missing the banner card simply
-- doesn't render usefully — set banner_url to NULL to hide it entirely.
-- ============================================================================

alter table public.teams add column if not exists skills text[] not null default '{}';
alter table public.teams add column if not exists banner_url text;

-- ── AQ.Ventures: real description + skills (supplied by the team lead) ───────
update public.teams
   set description = 'Aquaterra Ventures exists to help student entrepreneurs turn great ideas into visible brands. We know that when you''re building a business as a student, marketing is often the first thing to fall by the wayside — not because it doesn''t matter, but because time, budget, and experience are all in short supply. That''s where we come in.

For the first three months, we provide full marketing support completely free: strategy, content, branding, and promotion, tailored to your business. Our goal is simple — give student founders the momentum they need to grow, without the financial pressure holding them back.',
       skills = array[
         'Client communication',
         'Brand strategy',
         'Content creation',
         'Project management',
         'Real-world marketing execution'
       ],
       banner_url = '/team-ventures-banner.jpg'
 where name = 'AQ.Ventures';
