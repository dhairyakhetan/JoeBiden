-- =============================================================================
-- welfare_projects.team_id                                         2026-09-07
-- STATUS: APPLIED 2026-09-07 via Supabase MCP (migration
--         `welfare_projects_add_team_id_2026_09_07`).
--
--   VERIFICATION (run live immediately after apply):
--     col_exists            1
--     nullable              YES
--     total_rows            558
--     non_null_team_id      0      <- intentionally unbackfilled, see below
--     fk                    1      (welfare_projects_team_id_fkey)
--     fk_on_delete          n      (pg_constraint.confdeltype 'n' = SET NULL)
--     idx                   1      (welfare_projects_team_id_idx)
--     grants                anon:REFERENCES, anon:SELECT,
--                           authenticated:INSERT, authenticated:REFERENCES,
--                           authenticated:SELECT, authenticated:UPDATE
--
--   The grants line is the one that was explicitly re-checked against
--   information_schema.column_privileges rather than assumed: `authenticated`
--   really does hold INSERT + UPDATE + SELECT on team_id, so the app can write
--   it. RLS still gates those writes to is_director() OR is_super_admin().
-- =============================================================================
--
-- WHAT
--   Add a NULLABLE team_id to public.welfare_projects, FK -> teams(team_id),
--   ON DELETE SET NULL, with a partial index. Purely additive: no existing
--   column or row is modified, and the column ships NULL on all 558 rows.
--
-- WHY
--   All 558 welfare_projects rows are category='welfare', so under the current
--   schema no team except Welfare can have any work attached to it. There is no
--   team_id column at all, so the teams page cannot build a per-team drive list
--   or a real photo strip -- it has nothing to join on. This column is the join
--   key those surfaces need.
--
-- WHY IT IS NOT BACKFILLED
--   Deliberately left NULL on every row. `category` is 'welfare' on all 558, so
--   it carries no signal to map from. drive_lead_member_id -- the one field that
--   could have implied an owning team via that member's roster -- is NULL on all
--   558 rows as well. Inferring 558 attributions from a location string or a
--   title would be inventing history, and a wrong team on a past drive is worse
--   than an absent one because it silently misattributes other people's work.
--
--   A DEFENSIBLE BACKFILL WOULD NEED one of:
--     (a) a human pass over the 558 rows (they are the org's whole public
--         drive archive, so this is a real but bounded HR/HoD task); or
--     (b) drive_lead_member_id populated first, plus rosters that actually
--         exist -- today team_members holds 95 rows for 1317 active members,
--         so even a lead-based inference would resolve for almost nobody; or
--         (see the roster diagnosis: member_teams is empty, member_preauth's 85
--         rows share zero emails with members, and members has no team column)
--     (c) linked_post_id chased through to a post whose author's team is known.
--   Until one of those exists, NULL is the honest value.
--
-- GRANTS -- THE POINT TO NOT GET WRONG
--   public.welfare_projects, unlike public.members, DOES carry table-level
--   privileges (verified live): `authenticated` holds table-level
--   SELECT/INSERT/UPDATE/DELETE and `anon` holds table-level SELECT, so a newly
--   added column inherits them automatically. Explicit column grants are still
--   issued below to match the shape of the existing per-column grants on
--   category / drive_lead_member_id / attendance_completed_at, and because
--   relying on inheritance silently is exactly how a column ships unwritable.
--   (public.members is the opposite case: it has NO table-level
--   SELECT/INSERT/UPDATE, so a column added THERE starts at zero privileges.)
--
-- RLS
--   No new policy needed and none is added. welfare_projects' policy set is
--   row-scoped, not column-scoped, and already covers this column:
--     SELECT  "public read welfare_projects"        (is_draft IS NOT TRUE) OR is_director() OR is_super_admin()
--     INSERT  welfare_projects_director_insert      WITH CHECK (is_director() OR is_super_admin())
--     UPDATE  welfare_projects_director_update      USING/CHECK (is_director() OR is_super_admin())
--     DELETE  welfare_projects_director_delete      USING (is_director() OR is_super_admin())
--   So team_id is readable wherever the row is readable and writable only by a
--   director/super_admin, which is the intended authority for this field.
--   NOTE: frontend/scripts/welfare_projects_allow_admin_write_2026_07.sql is
--   OBSOLETE and is NOT current RLS truth; the four policies above were read
--   from pg_policies live on 2026-09-07.
-- =============================================================================

alter table public.welfare_projects
  add column if not exists team_id integer;

alter table public.welfare_projects
  drop constraint if exists welfare_projects_team_id_fkey;

alter table public.welfare_projects
  add constraint welfare_projects_team_id_fkey
  foreign key (team_id) references public.teams(team_id) on delete set null;

-- partial: the column is NULL on all 558 rows today, so indexing only the
-- non-null tail keeps it tiny while still serving the per-team drive lookup.
create index if not exists welfare_projects_team_id_idx
  on public.welfare_projects (team_id) where team_id is not null;

comment on column public.welfare_projects.team_id is
  'Owning team. Nullable and NULL on all pre-2026-09-07 rows by design: no '
  'defensible signal existed to backfill 558 historical drives (category is '
  '''welfare'' on every row and drive_lead_member_id is NULL on every row). '
  'Populate going forward at drive creation; backfill history only by human pass.';

grant select (team_id) on public.welfare_projects to anon, authenticated;
grant insert (team_id), update (team_id) on public.welfare_projects to authenticated;
