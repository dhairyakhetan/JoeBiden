-- ─────────────────────────────────────────────────────────────────────────
-- Weekly self-healing review — manual fallback report (2026-09-28)
-- ─────────────────────────────────────────────────────────────────────────
-- Paste this whole file into the Supabase SQL editor and run it whenever the
-- automated routine (docs/SELF_HEALING_ROUTINE.md) reports it has no way to
-- reach Supabase live data — no mcp__Supabase__* tools available AND the
-- routine's sandbox also has no network route to the project's REST host
-- (both happened at once on 2026-09-28: no MCP tools, and direct fetches
-- to hzowuwffjqtgszecngpe.supabase.co failed with "host not in allowlist").
-- Paste the output back into the next chat with the routine so it can
-- analyze it without needing live access itself.
--
-- READ-ONLY. Every statement below is a SELECT — nothing here writes,
-- grants, or alters anything. It is not a migration; it doesn't belong in
-- an "apply this once" sense like the other files in this folder — re-run
-- it in full every time this fallback is needed.
--
-- Column/table names below were pulled from the live-generated
-- frontend/src/lib/database.types.ts on 2026-09-28, not guessed — but
-- CLAUDE.md's rule still applies: a checked-in file describing the schema
-- is not proof the schema hasn't moved since. If a query below errors on a
-- missing column, that's itself a finding (the type file is stale) — report
-- it, don't just delete the line.
--
-- Section numbers match docs/SELF_HEALING_ROUTINE.md's own checklist.
-- ─────────────────────────────────────────────────────────────────────────


-- ── 0. Confirm this is actually AquaTerra's project, not a misconfigured
--       connector (this has happened before — see the routine doc's
--       "verify the Supabase connection" guardrail) ────────────────────────
select table_name
  from information_schema.tables
 where table_schema = 'public'
   and table_name in ('members', 'posts', 'teams', 'welfare_projects');
-- Expect all 4 rows back. If empty or partial: STOP. Wrong project — don't
-- run anything below against it, and flag the connector/credentials instead.


-- ── 1. members PII column-privilege lockdown (CLAUDE.md "Verify the live
--       schema" section) — confirm the lockdown is still intact, not
--       widened back open and not over-narrowed ───────────────────────────
select
  count(*) filter (where has_column_privilege('authenticated', 'public.members', column_name, 'SELECT')) as readable,
  count(*) filter (where not has_column_privilege('authenticated', 'public.members', column_name, 'SELECT')) as closed
  from information_schema.columns
 where table_schema = 'public' and table_name = 'members';
-- Expect 32 readable / 8 closed as of 2026-09-18. A different split is a
-- real finding — CLAUDE.md documents both a too-narrow and a too-wide
-- failure mode that have each happened for real on this exact table.

select relacl::text from pg_class where oid = 'public.members'::regclass;
-- `authenticated` must show only column-level grants here, never a bare
-- table-level `r` (SELECT) — that would mean the whole table is readable.


-- ── 2. Silent Supabase failures — client_error_logs, error_type =
--       'supabase_error' (the routine's single most direct signal) ────────
select
  extra ->> 'operation' as operation,
  extra ->> 'code'      as pg_code,
  count(*)              as n,
  min(created_at)       as first_seen,
  max(created_at)       as last_seen
  from public.client_error_logs
 where error_type = 'supabase_error'
   and created_at > now() - interval '7 days'
 group by operation, pg_code
 order by n desc
 limit 50;

-- Crashes that reached `window` without a service throwing first
select error_type, message, pathname, count(*) as n, max(created_at) as last_seen
  from public.client_error_logs
 where error_type in ('unhandled_error', 'unhandled_rejection')
   and created_at > now() - interval '7 days'
 group by error_type, message, pathname
 order by n desc
 limit 30;

-- Same "repeated navigate/replaceState in a tight loop" shape documented as
-- this routine's worked example — surfaces as a 'render' error message
-- naming history.replaceState's own throttle
select pathname, count(*) as n, max(created_at) as last_seen
  from public.client_error_logs
 where error_type = 'render'
   and message ilike '%replaceState%'
   and created_at > now() - interval '14 days'
 group by pathname
 order by n desc;


-- ── 2b. Function-call telemetry — client_function_logs ─────────────────────
-- Slowest / least-reliable functions, last 7 days
select
  service, function,
  count(*)                                                              as calls,
  round(avg(duration_ms))                                               as avg_ms,
  max(duration_ms)                                                      as max_ms,
  round(100.0 * count(*) filter (where not success) / count(*), 1)      as fail_pct
  from public.client_function_logs
 where created_at > now() - interval '7 days'
 group by service, function
having count(*) filter (where not success) > 0 or avg(duration_ms) > 800
 order by fail_pct desc, avg_ms desc
 limit 40;

-- Functions with zero calls in 30 days — flag as possibly dead, don't delete
select service, function, max(created_at) as last_called
  from public.client_function_logs
 group by service, function
having max(created_at) < now() - interval '30 days'
 order by last_called asc;


-- ── 3. PRD data-layer discrepancies ─────────────────────────────────────

-- 3a. A MEMBER's post (not a leader's) visible as published without ever
--     going through moderation — PRD §2 "must hold", the single most
--     important row-level check this routine does
select p.uuid, p.post_id, p.category, p.created_at, m.role as author_role
  from public.posts p
  join public.members m on m.member_id = p.author_id
 where p.status = 'published'
   and p.reviewed_at is null
   and p.reviewed_by is null
   and p.deleted_at is null
   and m.role not in ('hod', 'director', 'super_admin')
 order by p.created_at desc;
-- ANY row here is a real PRD violation, not a judgment call.

-- 3b. Moderation queue backlog — posts stuck pending_review
select uuid, post_id, category, team_id, created_at, now() - created_at as age
  from public.posts
 where status = 'pending_review' and deleted_at is null
 order by created_at asc
 limit 30;

-- 3c. Job openings stuck 'open' long past their own deadline (PRD §9:
--     lifecycle is open → paused → closed → deleted, never silently stale)
select id, opening_id, title, team_name, status, deadline, created_at
  from public.job_openings
 where status = 'open'
   and deadline is not null
   and deadline < now() - interval '14 days'
   and deleted_at is null
 order by deadline asc;

-- 3d. pending_approval accounts sitting untouched — onboarding funnel §1
select member_id, uuid, full_name,
       class_grade is not null as has_class,
       phone is not null       as has_phone,
       created_at, now() - created_at as age
  from public.members
 where status = 'pending_approval'
 order by created_at asc
 limit 30;
-- Flag anything older than ~1 week — PRD frames this as "a human stays in
-- the loop on every new account," which implies the loop shouldn't stall.


-- ── 4. Outreach hygiene — stale enquiries/applications ──────────────────

-- 4a. Job applications sitting unreviewed
select ja.id, ja.opening_id, jo.title, ja.status, ja.created_at,
       now() - ja.created_at as age
  from public.job_applications ja
  left join public.job_openings jo on jo.id = ja.opening_id
 where ja.status = 'pending'
 order by ja.created_at asc
 limit 30;

-- 4b. Team join requests sitting unreviewed — PRD §4 "must hold: joining
--     never adds to the roster by itself, always waits on approval," which
--     only works if approval actually happens in a reasonable window
select tjr.request_id, tjr.uuid, t.name as team_name, tjr.status,
       tjr.created_at, now() - tjr.created_at as age
  from public.team_join_requests tjr
  join public.teams t on t.team_id = tjr.team_id
 where tjr.status = 'pending'
 order by tjr.created_at asc
 limit 30;

-- 4c. Contact/collaboration enquiries with no status movement
select id, name, role, status, created_at, now() - created_at as age
  from public.contact_submissions
 where status in ('new', 'pending')
 order by created_at asc
 limit 30;


-- ── 5. Org/HR data completeness — docs/SELF_HEALING_ROUTINE.md §7 ───────
-- (verbatim from that doc; re-run every week and diff against the prior
-- run's numbers in the report, since there's no history table for this)

-- active members with no team at all
select count(*) from public.members m
 where m.status = 'active'
   and not exists (select 1 from public.team_members tm where tm.member_id = m.member_id);

-- profile completeness, org-wide
select count(*) filter (where avatar_url is null)      as missing_avatar,
       count(*) filter (where bio is null or bio = '') as missing_bio,
       count(*)                                        as total_active
  from public.members where status = 'active';

-- team cover images and descriptions
select name,
       banner_url is null                       as no_cover,
       description is null or description = ''  as no_description
  from public.teams order by name;

-- teams with zero currently-open hiring pipelines
select t.name, count(jo.id) filter (where jo.status = 'open') as open_openings
  from public.teams t
  left join public.job_openings jo on jo.team_id = t.team_id
 group by t.name order by t.name;


-- ── 6. What this script CANNOT check (needs MCP or dashboard access) ────
-- - mcp__Supabase__get_advisors (security/perf lint — ~60 known SECURITY
--   DEFINER findings are normal per the routine's baseline) has no plain-SQL
--   equivalent. Check Database → Advisors in the Supabase Studio dashboard,
--   or run it via the MCP connector when available.
-- - "Leaked password protection is disabled" (Auth → Policies toggle) is a
--   dashboard-only setting, not visible or fixable via SQL at all.
