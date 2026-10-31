-- Sub-departments as first-class entities within a team (department), for
-- the "About AquaTerra" org-chart / department hierarchy feature.
--
-- APPLIED LIVE 2026-09-17 via the Supabase MCP connector against
-- hzowuwffjqtgszecngpe (community-platform-aq). This file is the checked-in
-- record of that migration, not something still waiting to be run.
--
-- Why a new table instead of reusing team_members.sub_team (free text):
-- that column was populated by the 2026-09-10 Cross Departmental sheet
-- backfill and has no uuid/description/lead of its own, so a sub-department
-- could never be linked to, described, or have posts tagged against it
-- specifically. Some of its values are comma-separated multi-tags (e.g.
-- "Other Campaigns, Workshops"), i.e. one member in more than one
-- sub-team — hence a many-to-many join table rather than a single FK
-- column on team_members.
--
-- Live backfill result: Social Media -> Blogs/Instagram/LinkedIn (3),
-- Welfare Team -> Backend & Records/Dog Feeding/Other Campaigns/Rotaract
-- Curriculum/Teaching Internship/Workshops (6). The other 6 teams
-- (Events, Collabs, Crftd, AQ.Ventures, ShikshAQ, Human Resources) have no
-- sub_team data today and so get zero sub_teams rows — they remain leaf
-- departments in the org chart until someone adds real sub-department rows
-- for them (director-only INSERT via RLS below, no admin UI shipped yet).

create table if not exists sub_teams (
  sub_team_id serial primary key,
  uuid uuid not null default uuid_generate_v4() unique,
  team_id integer not null references teams(team_id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (team_id, slug)
);

create table if not exists team_member_sub_teams (
  id serial primary key,
  team_member_id integer not null references team_members(team_member_id) on delete cascade,
  sub_team_id integer not null references sub_teams(sub_team_id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (team_member_id, sub_team_id)
);

-- Lets a post be tagged to a specific sub-team, not just its parent team.
alter table posts add column if not exists sub_team_id integer references sub_teams(sub_team_id);

create index if not exists idx_sub_teams_team_id on sub_teams(team_id);
create index if not exists idx_team_member_sub_teams_member on team_member_sub_teams(team_member_id);
create index if not exists idx_team_member_sub_teams_sub_team on team_member_sub_teams(sub_team_id);
create index if not exists idx_posts_sub_team_id on posts(sub_team_id) where sub_team_id is not null;

-- Backfill sub_teams from distinct trimmed, comma-split values of team_members.sub_team
insert into sub_teams (team_id, name, slug, display_order)
select team_id, name, slug, row_number() over (partition by team_id order by name) as display_order
from (
  select distinct tm.team_id, trim(x.val) as name,
    lower(regexp_replace(regexp_replace(trim(x.val), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')) as slug
  from team_members tm, unnest(string_to_array(tm.sub_team, ',')) as x(val)
  where tm.sub_team is not null and trim(x.val) <> ''
) s
on conflict (team_id, slug) do nothing;

-- Backfill the join table from the same source
insert into team_member_sub_teams (team_member_id, sub_team_id)
select distinct tm.team_member_id, st.sub_team_id
from team_members tm
join lateral unnest(string_to_array(tm.sub_team, ',')) as x(val) on true
join sub_teams st on st.team_id = tm.team_id and st.name = trim(x.val)
where tm.sub_team is not null and trim(x.val) <> ''
on conflict do nothing;

-- Expose sub-team on the shared post feed view. New columns are appended at
-- the very end (sub_team_uuid, sub_team_name) — CREATE OR REPLACE VIEW
-- cannot reorder or rename existing view columns, only add new ones at the
-- tail, so every existing column/join/filter here is identical to the prior
-- live view definition.
create or replace view post_feed_view as
 SELECT p.post_id,
    p.uuid,
    p.category,
    p.body,
    p.link_url,
    p.link_title,
    p.link_image,
    p.status,
    p.created_at,
    p.updated_at,
    p.pinned,
    p.pinned_title,
    p.author_id,
    m.uuid AS author_uuid,
    m.full_name AS author_name,
    m.avatar_url AS author_avatar,
    m.role AS author_role,
    t.uuid AS team_uuid,
    t.name AS team_name,
    ( SELECT count(*) AS count
           FROM likes l
          WHERE l.post_id = p.post_id) AS like_count,
    ( SELECT count(*) AS count
           FROM comments c
          WHERE c.post_id = p.post_id) AS comment_count,
    COALESCE(( SELECT json_agg(json_build_object('url', pi.blob_url, 'order', pi.display_order) ORDER BY pi.display_order) AS json_agg
           FROM post_images pi
          WHERE pi.post_id = p.post_id),
        CASE
            WHEN wp.id IS NOT NULL AND COALESCE(wp.main_image, ''::text) <> ''::text THEN ( SELECT json_agg(json_build_object('url', t_1.u, 'order', t_1.o - 1) ORDER BY t_1.o) AS json_agg
               FROM unnest(ARRAY[wp.main_image, wp.image_1, wp.image_2, wp.image_3, wp.image_4]) WITH ORDINALITY t_1(u, o)
              WHERE COALESCE(t_1.u, ''::text) <> ''::text)
            ELSE NULL::json
        END) AS images,
    ( SELECT json_agg(json_build_object('id', tm.member_id, 'uuid', tm.uuid, 'name', tm.full_name, 'avatar', tm.avatar_url)) AS json_agg
           FROM post_tags pt
             JOIN members tm ON pt.tagged_member_id = tm.member_id
          WHERE pt.post_id = p.post_id) AS tagged_members,
    p.source_kind AS source_type,
    COALESCE(wp.slug, p.slug) AS source_slug,
    COALESCE(wp.header, p.title, jo.title::text) AS source_title,
    p.article ->> 'byline'::text AS source_author,
    wp.location AS source_location,
    p.featured,
    COALESCE(NULLIF(p.stats, '[]'::jsonb),
        CASE
            WHEN wp.id IS NOT NULL THEN ( SELECT COALESCE(jsonb_agg(s.obj), '[]'::jsonb) AS "coalesce"
               FROM ( SELECT jsonb_build_object('value', wp.volunteers::text, 'label',
                            CASE
                                WHEN wp.volunteers = 1 THEN 'volunteer'::text
                                ELSE 'volunteers'::text
                            END) AS obj
                      WHERE wp.volunteers IS NOT NULL AND wp.volunteers > 0
                    UNION ALL
                     SELECT jsonb_build_object('value', (regexp_match(wp.key_statistic, '^\s*(\d[\d,]*\+?)'::text))[1], 'label', btrim(regexp_replace(regexp_replace(wp.key_statistic, '^\s*\d[\d,]*\+?\s*'::text, ''::text), '[.!]+\s*$'::text, ''::text))) AS jsonb_build_object
                      WHERE wp.key_statistic ~ '^\s*\d'::text AND length(btrim(wp.key_statistic)) <= 40) s)
            ELSE NULL::jsonb
        END) AS stats,
    p.scheduled_for,
    NULLIF(btrim(COALESCE(wp.short_summary, ''::text)), ''::text) AS source_summary,
    NULLIF(btrim(COALESCE(wp.key_statistic, ''::text)), ''::text) AS source_stat,
    wp.workshop_date AS source_date,
    p.source_kind,
    NULLIF(p.article ->> 'read_minutes'::text, ''::text)::integer AS source_read_minutes,
    p.article_body,
    st.uuid AS sub_team_uuid,
    st.name AS sub_team_name
   FROM posts p
     JOIN members m ON p.author_id = m.member_id
     LEFT JOIN teams t ON p.team_id = t.team_id
     LEFT JOIN sub_teams st ON p.sub_team_id = st.sub_team_id
     LEFT JOIN welfare_projects wp ON wp.linked_post_id = p.uuid
     LEFT JOIN job_openings jo ON jo.linked_post_id = p.uuid
  WHERE p.deleted_at IS NULL AND (jo.opening_id IS NULL OR jo.status::text = 'open'::text);

-- Grants: mirror teams/team_members (table-level GRANT ALL; RLS below does
-- the real gating — see CLAUDE.md's note that a new table/column starts
-- with zero effective access without both pieces).
grant all on sub_teams to anon, authenticated;
grant all on team_member_sub_teams to anon, authenticated;

alter table sub_teams enable row level security;
alter table team_member_sub_teams enable row level security;

create policy "Public can view sub_teams" on sub_teams for select using (true);
create policy "Directors can insert sub_teams" on sub_teams for insert with check (is_director());
create policy "Directors can update sub_teams" on sub_teams for update using (is_director());
create policy "Directors can delete sub_teams" on sub_teams for delete using (is_director());

create policy "Public can view team_member_sub_teams" on team_member_sub_teams for select using (true);
create policy "Directors can insert team_member_sub_teams" on team_member_sub_teams for insert with check (is_director());
create policy "Directors can update team_member_sub_teams" on team_member_sub_teams for update using (is_director());
create policy "Directors can delete team_member_sub_teams" on team_member_sub_teams for delete using (is_director());

-- ---------------------------------------------------------------------------
-- Follow-up, same day: descriptions + sub-department structure for teams
-- that had none. Also applied live via the Supabase MCP connector.
--
-- Descriptions for the sub-teams already backfilled from real roster data
-- (Welfare Team, Social Media) — short, factual, no invented statistics.
update sub_teams set description = 'Documentation, records and reporting for the welfare team''s ongoing projects.' where team_id = 8 and slug = 'backend-records';
update sub_teams set description = 'Weekly street dog feeding drives across Kolkata.' where team_id = 8 and slug = 'dog-feeding';
update sub_teams set description = 'Plantation drives, old-age-home visits, clothes distribution and other on-ground welfare campaigns.' where team_id = 8 and slug = 'other-campaigns';
update sub_teams set description = 'Builds and delivers educational curriculum in partnership with Rotaract.' where team_id = 8 and slug = 'rotaract-curriculum';
update sub_teams set description = 'Structured teaching internship placing volunteers in classrooms for ongoing lessons.' where team_id = 8 and slug = 'teaching-internship';
update sub_teams set description = 'Awareness and educational workshops delivered in communities.' where team_id = 8 and slug = 'workshops';
update sub_teams set description = 'Content, reels and captions for @ngo.aquaterra on Instagram.' where team_id = 9 and slug = 'instagram';
update sub_teams set description = 'Long-form written content and articles for the AQ site.' where team_id = 9 and slug = 'blogs';
update sub_teams set description = 'Professional-network presence and outreach posts on LinkedIn.' where team_id = 9 and slug = 'linkedin';

-- New sub-department structure for teams that currently have none, sourced
-- from an earlier internal org-structure reference (predates the Crftd
-- rename — its "roots" node maps to today's Crftd team). No member data
-- exists for these yet (unlike Welfare/Social Media, which came from a
-- real roster backfill), so they start with 0 members and get real
-- rosters assigned over time via team_member_sub_teams. team_id 7 =
-- Events, 13 = ShikshAQ, 11 = Crftd.
insert into sub_teams (team_id, name, slug, description, display_order) values
  (7, 'Decor', 'decor', 'Event aesthetics, venue setups, visual experiences.', 1),
  (7, 'Sponsorships', 'sponsorships', 'Securing brand partnerships and funding for events.', 2),
  (7, 'Production', 'production', 'Sound, lighting, stage management, technical production.', 3),
  (7, 'DJ & Music', 'dj-music', 'Music curation, DJ sets, sound direction.', 4),
  (7, 'Event Marketing', 'event-marketing', 'Promoting events, building hype, RSVP campaigns.', 5),
  (7, 'Sports', 'sports', 'Tournaments, inter-school competitions, activity events.', 6),
  (7, 'Outreach & Management', 'outreach-management', 'End-to-end event coordination and vendor management.', 7),
  (13, 'Teacher Outreach', 'teacher-outreach', 'Onboarding and verifying tutors on the platform.', 1),
  (13, 'Social Media', 'social-media', 'Marketing ShikshAQ to students and parents.', 2),
  (13, 'Help Desk', 'help-desk', 'Queries, parent coordination and tutor support.', 3),
  (13, 'Website', 'website', 'Maintains the ShikshAQ web platform.', 4),
  (11, 'Logistics', 'logistics', 'Inventory, orders, packaging and fulfillment.', 1),
  (11, 'Partnerships', 'partnerships', 'Collaborating with schools and retail partners.', 2),
  (11, 'Fashion Design', 'fashion-design', 'Clothing collections, seasonal drops, brand aesthetics.', 3),
  (11, 'Manufacturing', 'manufacturing', 'Production coordination, sourcing and quality control.', 4),
  (11, 'Social Media', 'social-media', 'Building hype, running drops, brand marketing for Crftd.', 5)
on conflict (team_id, slug) do nothing;
