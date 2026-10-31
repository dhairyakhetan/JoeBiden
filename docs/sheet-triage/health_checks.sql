-- Nightly health checks. READ ONLY. Run each numbered query as its own
-- execute_sql call (a multi-statement call returns only the last result set).
-- Project: hzowuwffjqtgszecngpe. Baselines recorded 2026-10-05.

-- H1. members column privileges. Baseline 31 readable / 9 closed.
-- Closed set: auth_uid, deleted_at, deleted_by, email, google_id, guardian_phone,
-- instagram, last_birthday_notice_year, phone. `instagram` was readable per
-- HOTFIX_members_select_grants_2026_09_18.sql; it is closed now and no app query
-- reads it from members (the desk reads member_directory_view). CLAUDE.md still
-- says 32/8. Any change from 31/9, or a different closed set, is an alert.
select count(*) filter (where has_column_privilege('authenticated','public.members',column_name,'SELECT')) as readable,
       count(*) filter (where not has_column_privilege('authenticated','public.members',column_name,'SELECT')) as closed,
       string_agg(column_name, ',' order by column_name) filter (where not has_column_privilege('authenticated','public.members',column_name,'SELECT')) as closed_cols
  from information_schema.columns where table_schema='public' and table_name='members';

-- H2. members table-level grant: authenticated and anon must have NO leading r.
select relacl::text from pg_class where oid='public.members'::regclass;

-- H3. client errors in the last 24h by type. Baseline 2026-10-05: render 14,
-- supabase_error 5, unhandled_rejection 2. Alert on a new type or a total over 50.
-- (No state is kept between nights, so the thresholds are absolute.)
-- Stale-chunk loads (a browser holding an old page asks for a hashed file a deploy replaced) are
-- not counted: they rise after every deploy, and lazyWithRetry.ts already recovers from them.
select error_type, count(*) from public.client_error_logs
 where created_at > now() - interval '24 hours'
   and message not like 'Failed to fetch dynamically imported module%'
 group by 1 order by 2 desc;

-- H4. Member of the Month invariants: old rule gone, new unique index present.
select (select count(*) from pg_constraint where conrelid='public.member_of_the_month'::regclass and conname='member_of_the_month_period_team_key') as old_rule_should_be_0,
       (select count(*) from pg_indexes where tablename='member_of_the_month' and indexname='member_of_the_month_period_team_member_key') as new_index_should_be_1;

-- H5. post_teams sanity: no orphan rows (both should be 0).
select (select count(*) from public.post_teams pt where not exists (select 1 from public.posts p where p.post_id=pt.post_id)) as orphan_posts,
       (select count(*) from public.post_teams pt where not exists (select 1 from public.teams t where t.team_id=pt.team_id)) as orphan_teams;

-- H6. The feed view must serve only published posts (should be 0; 587 rows served, all published, 2026-10-05).
select count(*) from public.post_feed_view where status is distinct from 'published';

-- H7. Bug reports table: the guarantees the trust rule depends on. Baseline 2026-10-05.
-- Expect: rls true, true | triggers 3 | anon cannot read or write | authenticated cannot update or
-- delete a whole row (column grants only) | bucket is private.
select (select relrowsecurity from pg_class where oid='public.bug_reports'::regclass) as reports_rls,
       (select relrowsecurity from pg_class where oid='public.bug_report_events'::regclass) as events_rls,
       (select count(*) from pg_trigger where tgrelid='public.bug_reports'::regclass and not tgisinternal) as triggers_expect_3,
       has_table_privilege('anon','public.bug_reports','select') or has_table_privilege('anon','public.bug_reports','insert') as anon_access_expect_false,
       has_table_privilege('authenticated','public.bug_reports','delete') or has_table_privilege('authenticated','public.bug_reports','update') as auth_table_write_expect_false,
       (select public from storage.buckets where id='bug-screenshots') as bucket_public_expect_false;

-- H8. Nothing approved without an approver, and nothing stuck. Both should be 0.
-- A report approved with no approved_by means the trigger was bypassed. A report taken up for more
-- than 48 hours with nothing recorded is a routine run that died mid-way: alert, then read it.
select (select count(*) from public.bug_reports where approved_for_fix and approved_by is null) as approved_without_approver,
       (select count(*) from public.bug_reports
         where taken_up and not solved and declined_reason is null and needs_info_note is null
           and not closed_no_change
           and taken_up_at < now() - interval '48 hours') as stuck_over_48h;
-- (closed_no_change is a finished state: the audit found nothing to change, so it is never "stuck". Fixed 2026-10-22.)

-- H9. The backlog bookkeeping (scripts/bug_tracker_v2_2026_10_22.sql). All three should be 0.
--   no_secret      reports with no private read token (the bug-shot function cannot serve their screenshots)
--   vote_drift     reports whose me_too_count differs from the number of vote rows
--   lane_drift     solved or closed reports not in the done lane, plus open reports sitting in done
select (select count(*) from public.bug_reports b where not exists (select 1 from public.bug_report_secrets s where s.bug_id = b.id)) as no_secret,
       (select count(*) from public.bug_reports b
         where b.me_too_count <> (select count(*) from public.bug_report_votes v where v.bug_id = b.id)) as vote_drift,
       (select count(*) from public.bug_reports
         where ((solved or closed_no_change) and lane <> 'done') or (not solved and not closed_no_change and lane = 'done')) as lane_drift;

-- H10. The daily run log. Replace <run id> with this run's id (the row opened in step 1 of section 0.5).
-- The current run's own row must be excluded: it is always the newest and unfinished, so a query that counts it
-- can never see a missed night. Alert when earlier_runs > 0 and previous_started is more than 36 hours before now
-- (a night was missed), or when unfinished_runs > 0 (an earlier run died). earlier_runs = 0 is the very first run: not an alert.
select (select max(started_at) from public.routine_runs where id <> '<run id>') as previous_started,
       (select count(*) from public.routine_runs where id <> '<run id>' and finished_at is null and started_at < now() - interval '3 hours') as unfinished_runs,
       (select count(*) from public.routine_runs where id <> '<run id>') as earlier_runs;

-- H11. The screenshot read tokens. bug_report_secrets holds the private token that lets anyone fetch a screenshot, so it
-- is the most sensitive table in the tracker. Expect true, false, false: RLS on, and neither anon nor authenticated can
-- read it or write it (column grants included). Baseline 2026-10-22.
select (select relrowsecurity from pg_class where oid='public.bug_report_secrets'::regclass) as secrets_rls_expect_true,
       has_any_column_privilege('anon','public.bug_report_secrets','select') or has_any_column_privilege('authenticated','public.bug_report_secrets','select') as client_read_expect_false,
       has_any_column_privilege('anon','public.bug_report_secrets','insert') or has_any_column_privilege('authenticated','public.bug_report_secrets','insert')
         or has_any_column_privilege('anon','public.bug_report_secrets','update') or has_any_column_privilege('authenticated','public.bug_report_secrets','update') as client_write_expect_false;

-- H12. Hiring visibility (report 875f0da1, 2026-10-30). An open opening with no team is invisible to the leaders who are
-- notified about its applications (the desk and the read rule on job_applications both go by team_id). The guard
-- trigger job_opening_a_require_team should make this impossible, so any non-zero means it was dropped or bypassed.
-- Expect 0 and 0 and true.
select (select count(*) from public.job_openings where status = 'open' and team_id is null) as open_without_team,
       (select count(*) from public.job_applications ja join public.job_openings jo on jo.id = ja.opening_id
         where jo.status = 'open' and jo.team_id is null) as applications_hidden,
       exists (select 1 from pg_trigger where tgrelid = 'public.job_openings'::regclass and tgname = 'job_opening_a_require_team' and not tgisinternal) as guard_expect_true;
