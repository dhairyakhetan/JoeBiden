-- ──────────────────────────────────────────────────────────────────────────
-- RESTORE RECIPE — projects / project_members / post_projects
-- ──────────────────────────────────────────────────────────────────────────
-- These 3 tables were dropped on 2026-05-18 as part of the post-audit
-- orphan-cleanup pass (commit f04b456 → ?). They were scaffolded but
-- never shipped: 0 rows, 0 client-code references.
--
-- If a real "Projects" feature gets built later and these schemas turn
-- out to be the right shape, this file recreates them as they were.
-- Otherwise design a fresh schema — this is just the audit-trail copy
-- of what existed.
--
-- Columns are reproduced from the pg_attribute snapshot taken during
-- the audit. RLS policy bodies were NOT captured (they're easier to
-- redesign than to reverse-engineer), so this recipe enables RLS with
-- no policies — a fresh feature spec should add explicit ones.
-- ──────────────────────────────────────────────────────────────────────────

-- ═══ projects ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.projects (
  project_id      integer       PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  uuid            uuid          NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  title           varchar(255)  NOT NULL,
  description     text,
  category        varchar(50)   NOT NULL,
  team_id         integer       REFERENCES public.teams(team_id) ON DELETE SET NULL,
  status          varchar(50),
  start_date      date,
  end_date        date,
  cover_image_url text,
  created_by      integer       NOT NULL REFERENCES public.members(member_id),
  created_at      timestamp     DEFAULT now(),
  updated_at      timestamp     DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
-- TODO: redesign RLS policies per the actual feature spec.

-- ═══ project_members ═════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.project_members (
  project_member_id integer      PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  project_id        integer      NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  member_id         integer      NOT NULL REFERENCES public.members(member_id) ON DELETE CASCADE,
  role              varchar(100),
  joined_at         timestamp    DEFAULT now()
);
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- ═══ post_projects ════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.post_projects (
  post_project_id integer  PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  post_id         integer  NOT NULL REFERENCES public.posts(post_id) ON DELETE CASCADE,
  project_id      integer  NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE
);
ALTER TABLE public.post_projects ENABLE ROW LEVEL SECURITY;
