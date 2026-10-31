-- ──────────────────────────────────────────────────────────────────────────
-- Community DB performance pass (hzowuwffjqtgszecngpe) — 2026-06.
-- APPLIED LIVE via Supabase migrations (add_missing_fk_indexes_perf +
-- rls_initplan_wrap_auth_calls_perf). This file is the versioned record.
--
-- Driven by the Supabase performance advisor. Two safe, semantics-preserving
-- fixes: (1) index every foreign key that lacked a covering index, (2) wrap
-- auth.uid()/auth.role() in a scalar subselect in every RLS policy so the
-- planner evaluates them ONCE (initPlan) instead of once per row.
--
-- NOTE: profiling showed the DB itself is NOT the bottleneck — the homepage
-- feed view executes in ~4ms. The dominant latency is the network round-trip
-- to the project's region (ap-northeast-1 / Tokyo) from India-based users
-- (~150ms RTT). The highest-impact change for "crispy" data is a region move
-- to ap-south-1 (Mumbai), which is a planned project migration, not a toggle.
-- ──────────────────────────────────────────────────────────────────────────

-- 1) Cover unindexed foreign keys (faster joins/filters).
create index if not exists idx_director_categories_assigned_by on public.director_categories (assigned_by);
create index if not exists idx_external_achievements_member_id  on public.external_achievements (member_id);
create index if not exists idx_external_achievements_reviewed_by on public.external_achievements (reviewed_by);
create index if not exists idx_job_openings_linked_post_id       on public.job_openings (linked_post_id);
create index if not exists idx_members_approved_by               on public.members (approved_by);
create index if not exists idx_post_approvals_approved_by        on public.post_approvals (approved_by);
create index if not exists idx_posts_reviewed_by                 on public.posts (reviewed_by);
create index if not exists idx_team_join_requests_reviewed_by    on public.team_join_requests (reviewed_by);
create index if not exists idx_teams_created_by                  on public.teams (created_by);

-- 2) RLS initPlan: wrap auth.* calls in (select …) so they evaluate once.
--    (See the applied migration rls_initplan_wrap_auth_calls_perf for the full
--    drop/create of all 14 policies on members, job_openings, notifications,
--    team_join_requests, team_members, teams, volunteer_applications —
--    each rewritten e.g. `auth_uid = (select auth.uid())`,
--    `(select auth.role()) = 'authenticated'`. Semantics identical.)

-- Remaining advisor item (not applied here — bigger, riskier, low real-world
-- payoff on a small DB): 95 "multiple permissive policies" — consolidating the
-- duplicate permissive policies per table/action into one OR'd policy. Worth
-- doing for hygiene; verify access semantics carefully per table first.
