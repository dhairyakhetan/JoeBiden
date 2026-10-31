# Plan: teams as the categories (bug reports 5ce843ba and 2b96628f)

Status: IN PROGRESS. Written 2026-10-09 by the nightly routine; updated the same day after the owner's
answers. Reports: 5ce843ba (the HR director's request with the team tree, 2026-10-08) and 2b96628f
(the owner's earlier request, "replace categories with teams").

## Decisions recorded (owner, 2026-10-09)

- Replace the five categories with teams (2026-10-07).
- Marketing is a real parent department above Social Media and Digital Magazine.
- Her tree wins over the sub-teams already on the site. Old sub-teams are HIDDEN (`is_active = false`),
  never deleted, so it is reversible.
- Caveat found while applying it: Welfare's sub-teams hold 63 member assignments and Social Media's
  Instagram holds 22, so hiding those would orphan real assignments. Answers: Welfare gets her two missing
  sub-teams beside the existing six (nobody moves); Instagram is renamed Reels Team (members stay).
- Account Manager, Internal HR, Welfare Coordinator and the Ventures "Head of" lines are roles, not teams.

## Done

- Slice 1a (data only, live 2026-10-09, `frontend/scripts/team_tree_subteams_2026_10_09.sql`): her
  sub-teams added for Events, ShikshAQ, Digital Magazine, AQ.Ventures and Social Media (Design Team); the old
  Events and ShikshAQ sub-teams, which had no members, are hidden. Then Welfare gets Campaigns and Backend
  and Curriculum beside the existing six, and Social Media's Instagram is renamed Reels Team.

- Slice 1b (live 2026-10-09, `frontend/scripts/teams_parent_marketing_2026_10_09.sql`): nullable
  `teams.parent_team_id`, a Marketing team (id 18, category content), Social Media and Digital Magazine linked
  under it. The About chart draws children under their parent (Marketing shows the sum of their members) and
  the team page shows "part of" and "teams inside". Additive; undo is in the file.

- Marketing sub-departments (live 2026-10-12, `frontend/scripts/marketing_subdepartments_2026_10_12.sql`, report
  30f662a0): Account Managers, Welfare Coordinators and Team Operations added under Marketing, empty. Assumed:
  sub-departments inside Marketing, not top-level teams; nobody assigned. Hide them with `is_active = false` to undo.

- Social Media under Marketing (live 2026-10-12, report 07b32d75, `frontend/scripts/social_media_under_marketing_2026_10_12.sql`):
  `/teams` lists top-level departments only (a Marketing card counts the people in the departments inside it);
  Marketing's page lists Social Media and Digital Magazine with its own sub-departments, and the About chart nests
  Social Media's Reels, Design and LinkedIn teams under it. LinkedIn renamed LinkedIn Team. Assumed: Digital Magazine
  is treated the same way; Social Media stays a team row, nested, not converted; Blogs left in place (1 assignment).

- Slice 2 (live 2026-10-13, `frontend/scripts/director_scopes_2026_10_13.sql`): additive `director_scopes (member_id, team_id)`
  with RLS (super admin and HR write; a leader reads only their own rows; anon nothing). The Categories desk now lists teams
  beside the five categories: assign and remove per HoD, a teams overview for super admin and HR. Nothing reads the new table
  for moderation yet; that is slice 3. Assumed: a leader reading only their own rows (as the plan said) means the overview is
  hidden for plain HoDs, because it would show "No HoDs" for teams that do have one.

- Slice 3 (2026-10-13, code only, no schema change): a director's post queue is the posts in their categories OR the pending
  posts tagged (`post_teams`) to a team in their `director_scopes`; a leader with neither stays unscoped. One shared builder
  (`lib/postScope.ts`, tested) is used by the queue, the desk badge and the leader tile. Assumed: a scope on a parent
  department (Marketing) also covers the teams inside it (one level), because the people who moderate a department
  moderate what its teams post. Display scoping only, like the category filter it extends; the posts RLS is unchanged.

- Owner answers 2026-10-17 on the leaders' About-page request (report 4df9cc61) and the director teams list (73bebe7e):
  Collabs Team is hidden (`frontend/scripts/hide_collabs_team_2026_10_17.sql`, `is_active = false`, nothing deleted,
  reverses the 9 and 13 Oct "stays"); AQ.Ventures stays; all eight Welfare sub-teams stay; Account Managers, Welfare
  Coordinators and Internal HR stay roles, not sub-departments; the `aq_accounts` schema is intended. The director Teams
  desk now lists teams as the same tree as the About page (`lib/teamOrder.ts`).

- Slice 4, additive (live 2026-10-18, `frontend/scripts/director_scopes_backfill_2026_10_18.sql`, owner: "do it all on
  your own"): 54 `director_scopes` rows backfilled from the 24 category assignments, so every leader keeps the
  same reach. The queue, the desk badge, the home tile, the Hiring count and the desk labels now read team scopes
  only (a leader's queue also shows pending posts nobody tagged, so none is invisible), and the Categories desk
  assigns teams only. `director_categories` stays in the database, unread; removing it is a human step the tool
  holds and nothing needs it. The five categories remain as post and team labels.

## Decided since

- 2026-10-24 (owner, on reopened report 3a70c769): the separate Blogs sub-department under Marketing (sub_team 37,
  no members) is hidden as well (`is_active = false`), so Blogs no longer shows on the Marketing page either. Data only,
  see `frontend/scripts/marketing_blogs_hide_2026_10_24.sql`.

- 2026-10-19 (approved bug reports 02f6f40e and 3a70c769, reporter a super_admin): this replaces two parts of the
  2026-10-13 answer below. Account Managers, Welfare Coordinators and Team Operations are shown again as Marketing
  sub-departments (`is_active = true`), and Blogs is hidden from Social Media (`is_active = false`; Social Media is
  Reels, Design and LinkedIn). Data only, see `frontend/scripts/marketing_subdepartments_restore_2026_10_19.sql`.

- 2026-10-13 (owner): Digital Magazine stays nested under Marketing with Social Media; Blogs stays under Social Media;
  Account Managers, Welfare Coordinators and Team Operations are roles, so the three sub-departments added on
  2026-10-12 are hidden (`is_active = false`, nothing deleted); the About hero shows people to everyone; Welfare's
  six old sub-teams are left as they are; slices 2 and 3 are approved (a new table for who may moderate which team,
  then the moderation queue reading it).

- Collabs Team stays as it is (owner, 2026-10-09).
- Member of the Month graphic: the routine proposes one design as a PR for review (owner, 2026-10-09).

## Still open

- Merging the six old Welfare sub-teams into hers later (nobody moves until the owner says).
- Slice 4 below (retire the five categories), which is not approved and needs the exact checked SQL sent to the owner.

## 1. What was asked

Every member should sit in their own team, and the team tree the HR director supplied should be what a
director or HoD is assigned to, instead of the five fixed categories (events, welfare, content,
operations, labs). She attached the AQ family tree and said to ignore the member list and use the team
names only. The owner's earlier answer (2026-10-07) was to replace the categories with teams.

## 2. Current state (read from the live database and code, 2026-10-09)

- `director_categories (member_id, category)` holds the assignments. `category` is locked by the check
  `director_categories_category_check` to the five values above, and `(member_id, category)` is unique.
  Assigned today: content 8, operations 6, events 4, labs 3, welfare 3.
- A post's category is one of the same five. A director with categories sees only posts in them in the
  moderation queue: this is a query filter in `services/directorService.ts` (around lines 309 to 337) and
  `components/AdaptiveGrid.tsx`; the posts RLS has no category clause (see `OBSERVATIONS.md`).
- `approve_post_category` exists in the database and in `directorService.approvePostCategory` but nothing
  calls it.
- Teams and sub-teams (`teams`, `sub_teams`) are real tables used by team pages, roster, open roles,
  post tags (`post_teams`), Member of the Month and the About hierarchy chart. There is no parent link
  between teams.
- Live teams: Events Team, Welfare Team, Social Media, Collabs Team, Crftd, AQ.Ventures, ShikshAQ, Human
  Resources, Digital Magazine. Each carries a `category` that maps it to one of the five.

## 3. Her tree against the live data (names only)

| Her tree | Live data | Gap |
| --- | --- | --- |
| Marketing (a parent) with Social Media, Digital Magazine, Account Manager, Internal HR, Welfare Coordinator | no Marketing team; Social Media and Digital Magazine are top level; the other three do not exist as teams | a new parent level, and three items that may be roles instead of teams |
| Social Media: Design Team, Reels Team, LinkedIn | sub-teams Blogs, Instagram, LinkedIn | two differ |
| Digital Magazine: Tech Team, Design Team, Blogs | no sub-teams | all three new |
| Events: Experiences, Operations, Stalls and Sponsorships, Marketing | sub-teams Decor, Sponsorships, Production, DJ & Music, Event Marketing, Sports, Outreach & Management | different set |
| Welfare: Teaching Internship, Campaigns, Backend and Curriculum | Backend & Records, Dog Feeding, Other Campaigns, Rotaract Curriculum, Teaching Internship, Workshops | partly overlapping |
| Human Resources | Human Resources | matches |
| Ventures: Head of client marketing, Head of projects, Socials, Creatives | AQ.Ventures, no sub-teams | all new; two read like roles |
| ShikshAQ: Paper Verification, Tutor Onboarding, Revision Games, Frontend Development, Research and Agentic Dev | ShikshAQ with sub-teams Teacher Outreach, Social Media, Help Desk, Website | different set |
| CRFTD | Crftd | matches |
| (not in her tree) | Collabs Team | keep or retire? |

## 4. Design (additive, nothing dropped)

1. **Hierarchy, additive.** Add a nullable `teams.parent_team_id`. Existing teams keep working with no
   parent. Marketing becomes a team with Social Media and Digital Magazine pointed at it. The About chart
   and team pages read the parent when present.
2. **Scopes, additive.** Add `director_scopes (member_id, team_id)` beside `director_categories`, with RLS
   so only a super admin or HR writes it and a leader reads their own. The old table and its check stay
   untouched, so no destructive step is needed (policy 8.9).
3. **Categories desk.** Show teams as assignable scopes in the existing Categories desk, written to
   `director_scopes`. Keep the five categories visible until slice 4.
4. **Moderation.** A director's queue becomes posts in their categories OR posts tagged (`post_teams`) with a
   team in their scopes. A director with neither keeps today's behaviour.
5. **Retire the five categories** only after a release in which every assignment has a team equivalent and
   the queue no longer reads `director_categories`. That removal is a constraint and data change.

## 5. Slices and who must act

| Slice | What | Needs |
| --- | --- | --- |
| 1 | `parent_team_id`, new Marketing team, parent links, the sub-teams the owner confirms | the answers in section 6; additive, the routine can ship it |
| 2 | `director_scopes` table, RLS, Categories desk shows teams | additive, but it is a new write path for who may moderate (policy 8.5 item 3): owner approval first |
| 3 | moderation queue reads scopes | changes who sees which posts (8.5 item 3): owner approval first |
| 4 | retire the five categories, backfill `director_scopes` from them | destructive (constraint and data): the exact checked SQL goes to the owner |

## 6. Questions that unblock slice 1 (each answerable in one line)

1. Is Marketing a real parent department above Social Media and Digital Magazine, or only a grouping in
   the family tree?
2. Should her sub-team lists replace the existing ones (for example Events and ShikshAQ), or be added
   next to them? Replacing changes public pages and existing post tags.
3. Are Account Manager, Internal HR, Welfare Coordinator and the two Ventures "Head of" lines teams, or
   roles inside a team?
4. Is Collabs Team staying? It is not in the tree.

Recorded decisions so far: replace the categories with teams (owner, 2026-10-07).
