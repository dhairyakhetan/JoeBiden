-- =============================================================================
-- AquaTerra Teams Seed Script
-- Run this in Supabase Studio → SQL Editor
-- https://supabase.com/dashboard/project/hzowuwffjqtgszecngpe/sql
--
-- What this does:
--   1. Deletes all existing teams (and cascades to team_members, team_join_requests)
--   2. Inserts the 8 real AQ teams from the organisation manifesto
--
-- ⚠️  This WILL delete all existing team data including memberships.
--     Run only when you want a clean slate.
-- =============================================================================

BEGIN;

-- ── Step 1: Remove all existing teams ───────────────────────────────────────
-- (team_members and team_join_requests should cascade via FK; adjust if not)
DELETE FROM team_join_requests WHERE team_id IN (SELECT team_id FROM teams);
DELETE FROM team_members WHERE team_id IN (SELECT team_id FROM teams);
DELETE FROM teams;

-- ── Step 2: Reset the team_id sequence so IDs start from 1 ─────────────────
-- Only needed if team_id is a serial/bigserial (skip if using UUID primary key)
-- ALTER SEQUENCE teams_team_id_seq RESTART WITH 1;

-- ── Step 3: Insert the 8 real AQ teams ──────────────────────────────────────
-- created_by is set to the first super_admin found in members table.
-- If no admin exists yet, set to NULL (allow null on the column).

DO $$
DECLARE
  v_admin_id INT;
BEGIN
  -- Find the first super_admin or director to use as team creator
  SELECT member_id INTO v_admin_id
  FROM members
  WHERE role IN ('super_admin', 'director')
    AND status = 'active'
  ORDER BY member_id
  LIMIT 1;

  -- Fall back to member_id = 1 if no admin found yet
  IF v_admin_id IS NULL THEN
    SELECT member_id INTO v_admin_id FROM members ORDER BY member_id LIMIT 1;
  END IF;

  INSERT INTO teams (name, category, description, is_active, created_by) VALUES

  -- 1. Events Team
  (
    'Events Team',
    'events',
    'Paradox. Disco Diwali. Starry Nights. Every fundraiser AQ has ever run. Paradox 3.0 had 300 attendees and crossed 6-digit revenue in a single night. This team conceptualises, funds, manages logistics for every AQ event from a 20-person meetup to a 300-person concert. If something happened and people showed up, Events ran it.',
    true,
    v_admin_id
  ),

  -- 2. Welfare Team
  (
    'Welfare Team',
    'welfare',
    '3,500+ kids reached in structured teaching workshops since 2021. 8 Sundarbans relief trips with food, medicine, and clothing. Dog feeding drives across Ballygunge, Tiljala, and Park Circus every month. 4,000+ saplings planted. 15,000+ bananas distributed. This is the impact core of AQ. Every welfare drive, distribution run, and medical camp started here.',
    true,
    v_admin_id
  ),

  -- 3. Social Media and Content
  (
    'Social Media',
    'content',
    'Instagram, LinkedIn, and the website. 3,200+ followers on @ngo.aquaterra. Reels, carousels, long-form copy, strategy, and design. This is not a school club''s social media. It''s a real brand account built by students who understand audience, tone, and distribution. The team handles AQ''s entire digital identity.',
    true,
    v_admin_id
  ),

  -- 4. Collabs and Outreach
  (
    'Collabs Team',
    'operations',
    'School collaborations, college tie-ups, NGO partnerships, inter-city outreach. AQ grows through peer networks and institutional relationships. This team builds those partnerships from scratch. They write the decks, send the emails, run the calls, and convert interest into actual on-ground collaboration.',
    true,
    v_admin_id
  ),

  -- 5. ROOTS — AQ''s streetwear brand
  (
    'ROOTS',
    'content',
    'Student-run streetwear brand under AQ. Design, production, sales. Profits fund AQ welfare projects and events. The brand is real, the product is real, and the revenue is real. ROOTS drops limited collections, handles its own supply chain, and operates as a student-run business inside AQ.',
    true,
    v_admin_id
  ),

  -- 6. AQ.Ventures — Free marketing agency
  (
    'AQ.Ventures',
    'operations',
    'A free marketing agency for student-run businesses. Real clients, real briefs, real deliverables. Members get marketing experience before college by working on actual campaigns for student entrepreneurs in Kolkata. Strategy, design, social, and content — all built by the team.',
    true,
    v_admin_id
  ),

  -- 7. ShikshAQ — Tuition discovery platform
  (
    'ShikshAQ',
    'labs',
    'A tuition discovery platform built by AQ members for Kolkata students looking for quality tutors. Launched in 2026. Product, design, content, and growth managed entirely by the team. Still early. The product is live. The team is small, the scope is large.',
    true,
    v_admin_id
  ),

  -- 8. Human Resources
  (
    'Human Resources',
    'operations',
    'Recruitment, onboarding, certificates, and Letters of Recommendation. HR runs the intake pipeline for 850+ active members. They''re the first people new joiners meet when they apply. They manage applications, schedule interviews, write certs, and keep the org''s membership data clean.',
    true,
    v_admin_id
  );

  RAISE NOTICE 'Inserted 8 teams with creator member_id = %', v_admin_id;
END $$;

-- ── Step 4: Verify ───────────────────────────────────────────────────────────
SELECT team_id, uuid, name, category, is_active, created_at
FROM teams
ORDER BY team_id;

COMMIT;
