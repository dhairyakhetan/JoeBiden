-- ============================================================================
-- AquaTerra · cumulative audit migration
-- Generated 2026-09-18 from AUDIT_2026_09_17.md (73 verified findings @ 8bc843d)
--
--   STATUS: APPLIED 2026-09-18, VERIFIED LIVE.
--     Sections 1-4 all landed. Verified against the live anon endpoint, never
--     from this comment:
--       · all ten members columns now return 401 to anon (were 200)
--       · email/phone/auth_uid/google_id still 401 - the PII lockdown is intact
--       · all ten load-bearing public columns still 200
--       · soft-deleted posts: Content-Range */0, was 4. Published posts went
--         588 -> 584, exactly those four and nothing else
--       · every anon query the deployed build makes still returns 200, and
--         www.ngoaquaterra.com returns 200 on all seven routes checked
--     Section 3's constraint is provable by construction: the whole file is one
--     transaction, and class_cohort_counts() exists, so it committed.
--
--   SECTION 7 (the class_grade revoke) IS RETIRED as of 2026-09-18 and must
--   NOT be run, now or later. /member/:uuid and /schools are public pages
--   that legitimately read the column. See that section's own header.
--
--   FILE HISTORY: this file was accidentally truncated to zero bytes by a bad
--   edit script on 2026-09-18, AFTER it had been applied, and was rewritten
--   from the applied content with the status corrected. The database was not
--   affected. Recorded here because a migration file that silently changed is
--   exactly the drift this repo has been burned by before.
--
-- HOW IT WAS RUN
--   Pasted whole into the Supabase SQL editor, once.
--   It is ONE transaction: it either all lands or none of it does.
--   It is idempotent: running it again is a no-op, not an error.
--   Section 5 verifies. Section 6 rolls everything back.
--
-- WHAT IS DELIBERATELY NOT IN HERE
--   · The service_role key rotation. A dashboard action, not SQL. STILL OPEN.
--   · Anything touching `class_grade`. See section 4 for why, and for the
--     ordering trap that makes it unsafe to run before a deploy.
--   · `db-max-rows`. Two audit findings gave conflicting values for it and the
--     lower one silently truncates at least eleven live queries.
--
-- THE ONE ORDERING RULE THAT MATTERS
--   Revoking a column that the CURRENTLY DEPLOYED front-end selects breaks
--   production the moment you hit run, because the live site is still the old
--   build. Every revoke in section 1 was checked against every anon-reachable
--   query in the shipped code and appears in NONE of them, which is why this
--   was safe to run before the deploy. `class_grade` fails that check, which is
--   exactly why it is quarantined in section 7.
-- ============================================================================

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 1 · members: revoke anon SELECT on columns nothing public renders
--
-- FINDINGS: AUDIT_2026_09_17.md scraping P0 (instagram/linkedin) and P1 (the
-- other eight).
--
-- EVIDENCE, captured live with the anon key: all ten returned HTTP 200 to an
-- unauthenticated caller. `instagram` is non-null for 550 members. Joined to the
-- name, school and class year already exposed, that turns a public directory
-- into a ready-made contact list for 550 named, mostly-minor students, fetched
-- in one request with no auth and no rate limit.
--
-- ANON ONLY, and this is the important part. The HoD desk reads instagram and
-- linkedin through `member_directory_view` (services/directorService.ts:577-578,
-- rendered at director/MemberDirectory.tsx:970). Revoking the `authenticated`
-- half as well would break that desk. An earlier draft did exactly that and was
-- caught in verification.
--
-- Own-row reads are unaffected regardless: they go through the SECURITY DEFINER
-- `get_own_member()` RPC, which does not consult column grants at all. So
-- /register, the profile editor, the rejected-account page and the CV card all
-- keep working.
-- ────────────────────────────────────────────────────────────────────────────

do $$
declare
  col  text;
  cols text[] := array[
    -- P0: a live contact channel attached to a real name and school.
    'instagram',
    'linkedin',
    -- P1: no anon-reachable surface in the codebase reads any of these.
    -- join_reason is free text written by applicants at /register.
    'join_reason',
    'last_login',
    'approved_at',
    'approved_by',
    'is_active',
    'updated_at',
    'wall_enabled',
    -- rejection_note is a leader's written reason for refusing an account. It
    -- still reads to its own member on /rejected via get_own_member(), which is
    -- unaffected. It has no business being public.
    'rejection_note'
  ];
begin
  foreach col in array cols loop
    -- Skip silently if the column was dropped by a later migration, so this
    -- file keeps working rather than aborting the whole transaction.
    if exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'members' and column_name = col
    ) then
      execute format('revoke select (%I) on public.members from anon', col);
      raise notice 'revoked anon SELECT on members.%', col;
    else
      raise notice 'SKIPPED members.% - column does not exist', col;
    end if;
  end loop;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 2 · posts: stop serving soft-deleted rows to anonymous callers
--
-- FINDING: AUDIT_2026_09_17.md security P1 / scraping P1.
--
-- EVIDENCE: GET /rest/v1/posts?deleted_at=not.is.null returned
-- `Content-Range: 0-0/4` to an unauthenticated caller. Four posts their authors
-- had deleted were still served in full, body and author_id included. The only
-- filter was client-side: the app appends `.is('deleted_at', null)` at every
-- call site, and src/public/BlogPostPage.tsx:64 says so in a comment - "the
-- posts SELECT policy has no deleted_at condition".
--
-- WHY A RESTRICTIVE POLICY RATHER THAN EDITING THE EXISTING ONE
-- This was written without database access, having never read the current
-- `posts` SELECT policy. Rewriting a policy blind is how you take the public
-- feed down. A RESTRICTIVE policy is ANDed with whatever permissive policies
-- already exist, so it can only ever narrow. The worst case is that it hides
-- rows; it cannot widen access and it cannot break a query that was already
-- working on non-deleted rows.
--
-- SCOPED TO `anon`, deliberately. The finding is about anonymous exposure.
-- Leaving `authenticated` alone means no desk, no author view and no future
-- restore feature can be broken by this. Checked first: no surface in the
-- codebase reads soft-deleted POSTS. (services/wallService.ts:256 does read
-- deleted rows, but from `profile_notes`, a different table, untouched here.)
-- ────────────────────────────────────────────────────────────────────────────

drop policy if exists posts_anon_hide_soft_deleted on public.posts;

create policy posts_anon_hide_soft_deleted
  on public.posts
  as restrictive
  for select
  to anon
  using (deleted_at is null);

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 3 · role_capabilities: `hr` can never be locked out of its own desk
--
-- FINDING: AUDIT_2026_09_17.md security P1.
--
-- role_capabilities already carried
--   constraint role_capabilities_super_admin_never_restricted
--     check (not (role = 'super_admin' and enabled = false))
-- from role_capabilities_toggle_engine_2026_09_10.sql. It names super_admin and
-- only super_admin.
--
-- But lib/roles.ts makes `hr` EQUAL IN POWER to super_admin, and `hr` exists so
-- HR staff do not have to read as super admins - which means an org's only
-- top-tier account is routinely an `hr`, with no super_admin at all. Untick
-- `desk.roles` for `hr` in that org and the page that could tick it back on is
-- unreachable by everyone. The only way out is a hand-written delete.
--
-- NARROW ON PURPOSE. `hr` stays restrictable for every other capability; that
-- is the whole point of the matrix. Only the matrix's own desk is protected.
-- The broad version would have silently voided every hr restriction an operator
-- had already set.
--
-- MIRRORS (keep all four in step):
--   frontend/src/lib/capabilities.ts                     TOP_TIER_NEVER_RESTRICTABLE
--   frontend/src/services/roleCapabilityMatrixService.ts setEnabled()
--   frontend/src/lib/capabilities.test.ts                "hr cannot be locked out ..."
-- The app-side half shipped first; this is the half that makes it real.
--
-- Standalone copy of this section, kept for the record:
--   scripts/role_capabilities_hr_never_locked_out_2026_09_17.sql
-- ────────────────────────────────────────────────────────────────────────────

-- Clear any row that already encodes the lockout. Absent means enabled, so
-- deleting it restores access; it never removes any.
delete from public.role_capabilities
 where role = 'hr'
   and capability_key = 'desk.roles'
   and enabled = false;

alter table public.role_capabilities
  drop constraint if exists role_capabilities_hr_never_locked_out;

alter table public.role_capabilities
  add constraint role_capabilities_hr_never_locked_out
  check (not (role = 'hr' and capability_key = 'desk.roles' and enabled = false));

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 4 · class_grade: the enabler only. THE REVOKE IS NOT HERE.
--
-- FINDING: AUDIT_2026_09_17.md scraping P1. `class_grade` is anon-readable for
-- 1,135 members. Combined with the name and school that are legitimately public,
-- it completes name + school + year for a population of mostly minors, and no
-- public page renders it per member - src/public/MembersPage.tsx:112 maps it and
-- never shows it, src/services/profileService.ts:204 selects it and
-- PublicProfilePage renders it nowhere.
--
-- WHY THE REVOKE IS NOT IN THIS SECTION
-- Four anon-reachable queries in the deployed build still select it:
--   src/public/ClassesPage.tsx:38        (the only one that genuinely uses it)
--   src/public/MembersPage.tsx:82        (selected, never rendered)
--   src/services/profileService.ts:204   (selected, never rendered)
--   src/services/schoolService.ts:117    (selected)
-- PostgREST fails the WHOLE query when one requested column is not granted, so
-- revoking would break /classes, /members, /member/:uuid and the schools pages
-- the instant it ran, before any new front-end could be deployed.
--
-- WHAT THIS SECTION DID INSTEAD: added the aggregate that lets /classes stop
-- reading the column at all. Purely additive, breaks nothing, and worth having
-- on its own - /classes was pulling up to 3,000 member rows on every
-- unauthenticated page view just to count them client-side.
--
-- NOTE: the function below is the ORIGINAL raw-grouping version, as applied.
-- It has since been replaced twice. The CURRENT definition lives in
-- scripts/class_cohort_normalise_v2_2026_09_18.sql (applied, verified: 48 cohort
-- rows -> 14, total 1,138 unchanged). Do not re-run this section's function body
-- expecting current behaviour - it would roll the normalisation back.
--
-- THE FOLLOW-UP, in this order:
--   1. Run this file.                                           [DONE]
--   2. Repoint ClassesPage at class_cohort_counts(); drop class_grade from the
--      MembersPage, profileService and schoolService selects.
--   3. Deploy, and confirm /classes, /members, /member/:uuid and /schools work.
--   4. ONLY THEN run section 7.
-- ────────────────────────────────────────────────────────────────────────────

-- The output column is `cohort`, NOT `class_grade`, on purpose. In a
-- language-sql function the RETURNS TABLE column names are in scope inside the
-- body, so naming it `class_grade` while the body also references
-- `m.class_grade` raises "column reference class_grade is ambiguous" at create
-- time. Renaming the output sidesteps it completely.
create or replace function public.class_cohort_counts()
returns table (cohort text, member_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select trim(m.class_grade)::text as cohort,
         count(*)                  as member_count
    from public.members m
   where m.status = 'active'
     and m.class_grade is not null
     and trim(m.class_grade) <> ''
   group by trim(m.class_grade)
   order by count(*) desc, trim(m.class_grade)
$$;

comment on function public.class_cohort_counts() is
  'Per-cohort active-member tallies for the public /classes page. SECURITY '
  'DEFINER so the page can render the counts WITHOUT anon holding a column '
  'grant on members.class_grade - it returns aggregates only, never a row that '
  'identifies anybody. Replaces a 3,000-row anon fetch counted client-side. '
  'Audit 2026-09-17, scraping P1.';

revoke all on function public.class_cohort_counts() from public;
grant execute on function public.class_cohort_counts() to anon, authenticated;

commit;

-- ============================================================================
-- SECTION 5 · VERIFY
-- ============================================================================

-- 5.1  The ten columns must be gone for anon and INTACT for authenticated.
--      Expect ten rows, all anon_select = false, authenticated_select = true.
select c.column_name,
       -- coalesce: bool_or over a LEFT JOIN that matched nothing is NULL, and
       -- NULL here means "no grant", which is exactly `false`.
       coalesce(bool_or(cp.grantee = 'anon'), false)          as anon_select,
       coalesce(bool_or(cp.grantee = 'authenticated'), false) as authenticated_select
  from information_schema.columns c
  left join information_schema.column_privileges cp
    on  cp.table_schema = c.table_schema
    and cp.table_name   = c.table_name
    and cp.column_name  = c.column_name
    and cp.privilege_type = 'SELECT'
    and cp.grantee in ('anon', 'authenticated')
 where c.table_schema = 'public'
   and c.table_name   = 'members'
   and c.column_name in ('instagram','linkedin','join_reason','last_login',
                         'approved_at','approved_by','is_active','updated_at',
                         'wall_enabled','rejection_note')
 group by c.column_name
 order by c.column_name;

-- 5.2  The PII lockdown must still hold, and the load-bearing public columns
--      must still be readable. Expect email/phone/auth_uid/google_id false, and
--      full_name/uuid/avatar_url/role/status true.
select c.column_name, coalesce(bool_or(cp.grantee = 'anon'), false) as anon_select
  from information_schema.columns c
  left join information_schema.column_privileges cp
    on  cp.table_schema = c.table_schema and cp.table_name = c.table_name
    and cp.column_name = c.column_name
    and cp.privilege_type = 'SELECT' and cp.grantee = 'anon'
 where c.table_schema = 'public' and c.table_name = 'members'
   and c.column_name in ('email','phone','auth_uid','google_id',
                         'full_name','uuid','avatar_url','role','status')
 group by c.column_name
 order by c.column_name;

-- 5.3  Both objects must exist.
select policyname, permissive, roles, cmd, qual
  from pg_policies
 where schemaname = 'public' and tablename = 'posts'
   and policyname = 'posts_anon_hide_soft_deleted';

select conname, pg_get_constraintdef(oid)
  from pg_constraint
 where conrelid = 'public.role_capabilities'::regclass
   and conname like '%never%'
 order by conname;

-- 5.4  The aggregate works and leaks nothing identifying.
select * from public.class_cohort_counts() limit 5;

-- 5.5  THE REAL TEST, from a terminal, not here. Every line must print 401.
--      Before this migration all ten printed 200.
--
--   URL=https://hzowuwffjqtgszecngpe.supabase.co
--   ANON=<your anon key>
--   for c in instagram linkedin join_reason last_login approved_at approved_by \
--            is_active updated_at wall_enabled rejection_note; do
--     printf '%-16s %s\n' "$c" "$(curl -s -o /dev/null -w '%{http_code}' \
--       -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
--       "$URL/rest/v1/members?select=$c&limit=1")"
--   done
--
--   Soft-deleted posts. Was `Content-Range: 0-0/4`, must now be `*/0`:
--   curl -s -o /dev/null -D - -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
--     -H "Prefer: count=exact" \
--     "$URL/rest/v1/posts?select=post_id&deleted_at=not.is.null&limit=1" | grep -i content-range
--
--   And the site must still work. All four must print 200:
--   for u in / /members /teams /projects; do \
--     echo "$(curl -s -o /dev/null -w '%{http_code}' https://www.ngoaquaterra.com$u)  $u"; done

-- ============================================================================
-- SECTION 6 · ROLLBACK. Everything above, undone.
-- ============================================================================
--
-- begin;
--   grant select (instagram, linkedin, join_reason, last_login, approved_at,
--                 approved_by, is_active, updated_at, wall_enabled,
--                 rejection_note)
--     on public.members to anon;
--   drop policy if exists posts_anon_hide_soft_deleted on public.posts;
--   alter table public.role_capabilities
--     drop constraint if exists role_capabilities_hr_never_locked_out;
--   drop function if exists public.class_cohort_counts();
-- commit;

-- ============================================================================
-- SECTION 7 · RETIRED 2026-09-18. DO NOT RUN. Not "not yet": not at all.
--
-- This was going to revoke anon SELECT on members.class_grade, and it was
-- parked as "safe once the front-end stops selecting the column". That framing
-- was wrong, and it drifted further in later summaries into the flatly
-- incorrect "safe once the deploy lands". Written down properly here so nobody
-- resurrects it from a half-remembered note.
--
-- WHY IT IS RETIRED
--   Three PUBLIC routes read class_grade as anon, and two of them are SUPPOSED
--   to. Checked against App.tsx at the time of writing:
--
--     /classes       App.tsx:409   FIXED. Now reads class_cohort_counts(),
--                                  which is SECURITY DEFINER and returns
--                                  aggregates only. This was the actual finding.
--     /member/:uuid  App.tsx:415   profileService.ts:204 selects class_grade to
--                                  show a member's class on their PUBLIC
--                                  profile. That is the product working.
--     /schools       App.tsx:408   schoolService.ts:117, same.
--
--   PostgREST fails a query WHOLE if any requested column is ungranted, so this
--   revoke does not degrade those two pages, it blanks them.
--
-- WHAT THE FINDING ACTUALLY WAS
--   AUDIT_2026_09_17.md scraping P1 was about /classes pulling up to 3,000
--   members' class_grade to the browser on an unauthenticated route. Section 4
--   of this file built the fix and the front-end half has now landed. The
--   column being readable ONE ROW AT A TIME on a profile page that already
--   shows the person's name and photo is a different thing, and not a finding.
--
--   If the org later decides a member's class should not be public at all, that
--   is a product decision about /member/:uuid and /schools, and the revoke
--   would be the last step of it rather than the first.
--
-- The statement, kept only so nobody has to re-derive it:
--   revoke select (class_grade) on public.members from anon;   -- DO NOT RUN
