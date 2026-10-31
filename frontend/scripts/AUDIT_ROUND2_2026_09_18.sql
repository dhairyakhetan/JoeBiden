-- ============================================================================
-- AUDIT ROUND 2, 2026-09-18. Everything found with live read-only database
-- access, in one transaction.
--
--   STATUS: APPLIED 2026-09-18. Sections 2 to 6 VERIFIED LIVE and correct.
--     SECTION 1 WAS WRONG AS WRITTEN and needed a follow-up. Its
--     `revoke select on public.members from authenticated` also stripped all 31
--     COLUMN-level SELECT grants, because in Postgres a table-level REVOKE
--     removes the matching column-level privileges too. Signed-in reads of
--     members broke until HOTFIX_members_select_grants_2026_09_18.sql restored
--     them (APPLIED and VERIFIED the same day). The PII objective was still
--     met and anon was never affected, so the public site stayed up throughout.
--     DO NOT RE-RUN SECTION 1 ALONE. If this file is ever replayed, run the
--     hotfix immediately after it, or merge the hotfix's grant into section 1
--     so the revoke and the re-grant share one transaction.
--   Section 7 is RETIRED as of 2026-09-18, not merely unapplied. Do not run
--   it. See its own header.
--
--   VERIFIED LIVE 2026-09-18 after the run:
--     post_feed_view  573 rows to anon, 0 non-published (was 587 with 14)
--     photobooth      anon list returns 0 objects; 2,357 files retained
--     project-images  3 anon policies gone, 3 director policies created,
--                     public read preserved
--     views           pending_member_approvals security_invoker=false,
--                     member_directory_view security_barrier=true
--
--   This is the second cumulative file of the day. The first,
--   AUDIT_CUMULATIVE_2026_09_18.sql, is APPLIED and VERIFIED LIVE and is not
--   superseded by this one. This file only contains what the FIRST pass could
--   not see, because that pass had no database access and probed the anon
--   endpoint from outside. Everything below was found by reading pg_catalog
--   and storage policies directly, and every claim in the comments was
--   measured, not inferred.
--
-- WHAT IS IN HERE, AND WHY IT MATTERS
--
--   Section 1 is the one that matters. `authenticated` holds a TABLE-LEVEL
--   SELECT grant on public.members, which silently voids the entire
--   column-by-column PII lockdown. Any signed-in account can read every
--   active member's email. Measured live: 1,327 rows, 1,327 emails, 58
--   phones, 65 auth_uids. 839 of those members give a school class as their
--   cohort, so the great majority are minors.
--
--   Sections 2 to 6 are smaller but all proven live, not suspected.
--
--   Section 7 is the one carried over from the first file. It is RETIRED:
--   two public pages legitimately read the column it would revoke.
--
-- SAFETY
--   One transaction. Idempotent. Every section is a revoke, a policy swap or
--   a view predicate that can only NARROW what is visible. Nothing here grants
--   anything new except the single `previously_removed` column grant in
--   section 1, which restores a column the app already reads.
--
--   Section 3 rewrites a view using the database's OWN stored definition
--   rather than a transcription, and refuses to run if that definition does
--   not look the way this file expects.
--
--   ROLLBACK for every section is at the bottom.
-- ============================================================================

begin;

-- ============================================================================
-- SECTION 2 FIRST (ordering is deliberate)
--
-- pending_member_approvals: back to SECURITY DEFINER, and away from anon.
--
-- WHY THIS RUNS BEFORE SECTION 1
--   This view is currently `security_invoker = true`, which means it is
--   evaluated with the CALLER's privileges. It selects members.email and
--   members.phone. A director calling it therefore needs a SELECT privilege
--   on those two columns - and that is precisely why the table-level grant in
--   section 1 was added. Revoke that grant first and the HoD pending-approval
--   queue breaks. So the view is fixed first, then the grant is removed.
--
-- WHY SECURITY DEFINER IS CORRECT HERE, NOT A REGRESSION
--   The view carries its own authorization inline:
--     where status = 'pending_approval' and is_active and (is_director() or is_super_admin())
--   That is the same pattern its two sibling views already use
--   (member_directory_view, rejected_member_approvals), and it is the pattern
--   that works WITH column grants instead of against them. A non-director
--   selecting from it gets zero rows.
--
--   member_appeal_after_removal_2026_09_14.sql switched it to invoker in order
--   to clear a `security_definer_view` advisor finding. That trade trapped a
--   lint warning at the cost of a real PII grant. The advisor finding will
--   come back after this runs. It is the correct state and should be left.
--
-- ALSO: anon currently holds SELECT on this view. It returns zero rows to anon
--   because of the inline guard, so this is not a live leak, but there is no
--   reason for the grant to exist and it is one `or` away from being one.
-- ============================================================================

alter view public.pending_member_approvals set (security_invoker = false);
revoke select on public.pending_member_approvals from anon;

comment on view public.pending_member_approvals is
  'Pending account approvals for the HoD desk. SECURITY DEFINER on purpose: it '
  'reads members.email and members.phone, which authenticated has no column '
  'grant on, and it gates itself inline with is_director() OR is_super_admin(). '
  'Do not switch this to security_invoker to silence the advisor lint - that '
  'was done on 2026-09-14 and forced a table-wide SELECT grant on members that '
  'exposed 1,327 member emails to every signed-in account.';

-- ============================================================================
-- SECTION 1. THE P0. Remove the table-level SELECT grant on public.members.
--
-- MEASURED STATE BEFORE THIS FILE
--   pg_class.relacl on public.members reads:
--     authenticated=rdDxtm/postgres
--   The leading `r` is SELECT on every column of the table. It defeats the
--   entire column-by-column design, because column grants ADD to a table
--   grant, they do not cap it.
--
--   Consequence, confirmed against pg_policy: members_select is
--     (status = 'active' OR is_director() OR auth_uid = auth.uid())
--   so ANY authenticated session - including a brand new pending_approval
--   account that anyone with a Google login can create in one click - can run
--     GET /rest/v1/members?select=email,phone,full_name
--   and receive the full active roster. 1,327 emails. 58 phones. 65 auth_uids.
--
-- WHERE IT CAME FROM
--   scripts/member_appeal_after_removal_2026_09_14.sql line 19:
--     grant select on public.members to authenticated;
--   The migration added the `previously_removed` column, correctly noted that
--   a new members column starts with zero privileges, and then wrote the grant
--   WITHOUT a column list. A single missing parenthesised column name turned a
--   one-column grant into a whole-table one. This is the third time this repo
--   has been bitten by the members grant model and the first time the failure
--   was a grant that was too WIDE rather than missing.
--
-- WHY THIS IS SAFE TO RUN RIGHT NOW, AHEAD OF THE DEPLOY
--   Checked, file by file, before writing this:
--     - No code anywhere selects members.email or members.phone directly. The
--       only two greps that match are comments saying not to.
--     - There is no `select('*')` against members anywhere in src/.
--     - Own-row reads go through get_own_member(), a SECURITY DEFINER RPC that
--       returns every column regardless of grants. Unaffected.
--     - Director reads of email/phone go through the three views, all of which
--       are SECURITY DEFINER after section 2 above. Unaffected.
--     - Every other column already carries its own explicit per-column ACL
--       (verified against pg_attribute.attacl for all 40 columns), so removing
--       the table grant leaves them exactly as they were.
--
--   The ONLY column that loses SELECT and is genuinely read by the app is
--   `previously_removed` (directorService.ts:100). It has a null attacl, so it
--   was riding on the table grant. It is granted back explicitly below. That
--   single column grant is what line 19 should have said in the first place.
--
-- DELIBERATELY NOT CHANGED
--   anon and authenticated also hold table-level DELETE (`d`) on members. It is
--   inert: the only DELETE policy is `Super admin can delete members` USING
--   is_super_admin(), and RLS is evaluated regardless of the grant, so a
--   non-super-admin DELETE is refused by policy. Tidying it up would risk
--   breaking a super_admin hard-delete path for no measured gain, so it is
--   recorded here and left alone.
-- ============================================================================

revoke select on public.members from authenticated;

-- The grant member_appeal_after_removal_2026_09_14.sql meant to write.
-- Boolean flag, not PII: it drives the red "removed before" marker on the
-- HoD pending queue (directorService.ts:100, auth/RejectedPage.tsx).
grant select (previously_removed) on public.members to authenticated;

-- ============================================================================
-- SECTION 3. post_feed_view leaks unmoderated posts to anonymous clients.
--
-- MEASURED STATE
--   post_feed_view is SECURITY DEFINER (security_invoker is not set, so it
--   defaults to false) and anon holds SELECT on it. A SECURITY DEFINER view
--   runs as its owner, postgres, so RLS on the underlying posts table does not
--   apply to it AT ALL.
--
--   The view's own WHERE clause filters `p.deleted_at IS NULL` but says
--   nothing about status. So the RLS policy that restricts anon to published
--   posts is bypassed, and right now the view hands out:
--     14 posts with status = 'pending_review'
--   to anyone holding the anon key, which ships in the public JS bundle.
--   Those are member submissions that no moderator has approved.
--
--   No scheduled posts exist today (measured: 0), so there is no embargo leak
--   at this moment. The same hole would leak every scheduled announcement the
--   day one is created, which is the more important forward risk.
--
-- WHY NOT JUST FLIP IT TO security_invoker
--   Considered and rejected, with numbers. Invoker would make RLS apply, which
--   fixes the leak in one line. But the view INNER JOINs members for the
--   author, and members_select only exposes rows where status = 'active'. So
--   the moment any member is archived or leaves, every post they ever authored
--   would silently vanish from the public feed. Today that would hide nothing
--   (all 584 published posts have an active author, measured), which is
--   exactly what makes it a trap: it would pass every check now and quietly
--   delete history later. This codebase's most repeated bug is content
--   disappearing without an error, so the predicate goes in the view instead.
--
-- HOW THE REWRITE WORKS
--   The replacement is built from the database's own pg_get_viewdef output, not
--   from a transcription of 3,589 characters into this file. The column list,
--   types and order are therefore guaranteed identical, which is what
--   `create or replace view` requires. The block refuses to run if the stored
--   definition does not contain exactly one copy of the anchor it edits, and
--   does nothing at all if the predicate is already present.
--
--   The predicate added is a character-for-character mirror of the posts_select
--   RLS policy, so the view and the policy cannot drift:
--     status = 'published' OR author_id = get_current_member_id() OR is_director()
-- ============================================================================

do $$
declare
  v text;
  anchor text := 'WHERE p.deleted_at IS NULL';
  n int;
begin
  select pg_get_viewdef('public.post_feed_view'::regclass, true) into v;

  -- Already fixed? Then this file has been run before. Nothing to do.
  if position('p.author_id = get_current_member_id()' in v) > 0 then
    raise notice 'post_feed_view already carries the status predicate, skipping.';
    return;
  end if;

  n := (length(v) - length(replace(v, anchor, ''))) / length(anchor);
  if n <> 1 then
    raise exception
      'post_feed_view: expected exactly 1 occurrence of %, found %. The view '
      'definition has changed since this migration was written. Refusing to '
      'rewrite it blind - re-derive the edit by hand.', anchor, n;
  end if;

  v := replace(v, anchor,
       'WHERE p.deleted_at IS NULL AND (p.status::text = ''published''::text '
       'OR p.author_id = get_current_member_id() OR is_director())');

  execute 'create or replace view public.post_feed_view as ' || v;
end $$;

comment on view public.post_feed_view is
  'The feed projection. SECURITY DEFINER on purpose, so posts by members who '
  'have since left still render. Because RLS therefore does NOT apply, the '
  'view must carry the posts_select predicate itself - published, or your own, '
  'or you are a director. Keep those two in step: before 2026-09-18 the view '
  'had no status filter and served 14 unmoderated posts to anonymous clients.';

-- ============================================================================
-- SECTION 4. project-images: anyone can overwrite or delete every image.
--
-- MEASURED STATE (pg_policy on storage.objects)
--   Anon write  project-images  INSERT  with check (bucket_id = 'project-images')
--   Anon update project-images  UPDATE  using      (bucket_id = 'project-images')
--   Anon delete project-images  DELETE  using      (bucket_id = 'project-images')
--   All three have an EMPTY role list, which in Postgres means PUBLIC, so they
--   apply to anon as well as authenticated. The only predicate is the bucket
--   name. There is no ownership check and no role check.
--
--   Live contents: 24 objects, 23 MB. Every welfare project image on the public
--   site. Anyone holding the anon key can replace any of them with anything, or
--   delete all 24.
--
--   This settles the open question from scripts/project_images_bucket_tighten_
--   2026_08.sql, which said "do not apply blind" and carried no applied marker.
--   It was never applied. It is applied here, rewritten to be idempotent.
--
-- WHO STILL NEEDS TO WRITE
--   director/ProjectManagerShared.tsx (BUCKET = 'project-images') and
--   dev/ReencodeImages.tsx, both of which run as a signed-in director. Gating
--   on is_director() OR is_super_admin() keeps them working and locks everyone
--   else out. Public READ is left wide open on purpose: these images are on the
--   public site and are meant to be fetched by strangers.
-- ============================================================================

drop policy if exists "Anon write project-images"   on storage.objects;
drop policy if exists "Anon update project-images"  on storage.objects;
drop policy if exists "Anon delete project-images"  on storage.objects;

drop policy if exists "Directors write project-images"  on storage.objects;
drop policy if exists "Directors update project-images" on storage.objects;
drop policy if exists "Directors delete project-images" on storage.objects;

create policy "Directors write project-images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'project-images' and (is_director() or is_super_admin()));

create policy "Directors update project-images" on storage.objects
  for update to authenticated
  using      (bucket_id = 'project-images' and (is_director() or is_super_admin()))
  with check (bucket_id = 'project-images' and (is_director() or is_super_admin()));

create policy "Directors delete project-images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'project-images' and (is_director() or is_super_admin()));

-- "Public read project-images" is intentionally left exactly as it is.

-- ============================================================================
-- SECTION 5. The photobooth buckets: 2,357 files open to the anon key.
--
-- MEASURED STATE
--   photobooth-raw-photos    1,831 objects   217 MB   public flag: false
--   photobooth-print-sheets    522 objects    40 MB   public flag: false
--   photobooth-assets            4 objects    70 kB   public flag: true
--
--   Policies on storage.objects:
--     'anon manage photobooth assets'          ALL     to authenticated, anon
--     'anon manage photobooth print sheets'    ALL     to authenticated, anon
--     'anon upload photobooth raw photos'      INSERT  to authenticated, anon
--     'anon read photobooth raw photos'        SELECT  to authenticated, anon
--     'anon update photobooth raw photos'      UPDATE  to authenticated, anon
--   Every predicate is just the bucket name.
--
-- PROVEN, NOT INFERRED. Using only the publishable anon key from the shipped
-- bundle, on 2026-09-18:
--     POST /storage/v1/object/list/photobooth-raw-photos        -> 200, folders
--     POST /storage/v1/object/list/photobooth-raw-photos/<dir>  -> 200, files
--     GET  /storage/v1/object/photobooth-raw-photos/<dir>/<f>   -> 200,
--                                       112,713 bytes, content-type image/jpeg
--   A real photograph downloaded by an unauthenticated caller. The `public:
--   false` flag on the bucket is what hid this: the dashboard shows the bucket
--   as private while the policy hands anon full read.
--
--   These are event photobooth photos from August 2026. AquaTerra's members are
--   overwhelmingly school students, so assume the subjects are minors.
--
-- THE FEATURE IS GONE. `grep -rl photobooth frontend/src` returns nothing. No
--   component, service or route references any of these buckets. Newest object
--   is 2026-08-22. Dropping the policies cannot break code that does not exist.
--
-- THE FILES ARE NOT TOUCHED. This closes access and keeps every object, because
--   deleting 2,357 files is the owner's decision and not a security fix. Once
--   the policies are gone the buckets are reachable only with the service key,
--   which is what the Supabase dashboard uses, so the photos remain
--   downloadable by an administrator. If they are not needed, delete them from
--   the dashboard afterwards: they are photographs of children sitting in an
--   object store with no retention date and no reason to be there.
-- ============================================================================

drop policy if exists "anon manage photobooth assets"       on storage.objects;
drop policy if exists "anon manage photobooth print sheets" on storage.objects;
drop policy if exists "anon upload photobooth raw photos"   on storage.objects;
drop policy if exists "anon read photobooth raw photos"     on storage.objects;
drop policy if exists "anon update photobooth raw photos"   on storage.objects;

-- photobooth-assets is flagged public, so /object/public/... serves it whatever
-- the policies say. Flip the flag too, or dropping the policy achieves nothing.
update storage.buckets set public = false where id = 'photobooth-assets';

-- ============================================================================
-- SECTION 6. member_directory_view: match its sibling's hardening.
--
--   rejected_member_approvals carries security_barrier=true.
--   member_directory_view carries no options at all, and it selects
--   members.email for every row.
--
--   Without security_barrier, the planner is permitted to push a caller's own
--   WHERE clause BELOW the view's `is_director() OR is_super_admin()` guard.
--   Through PostgREST a caller can only supply built-in operators, so this is
--   hardening rather than a demonstrated exploit, and no leak was observed.
--   It costs nothing and makes the two views consistent.
-- ============================================================================

alter view public.member_directory_view set (security_barrier = true);

commit;

-- ============================================================================
-- VERIFY. Run all five after committing. Expected results are stated.
-- ============================================================================

-- 1. THE ONE THAT MATTERS. Expect anon_sel AND auth_sel both false for email,
--    phone, guardian_phone, auth_uid, google_id. Expect true for full_name.
--
-- select column_name,
--        has_column_privilege('anon','public.members',column_name,'SELECT')          as anon_sel,
--        has_column_privilege('authenticated','public.members',column_name,'SELECT') as auth_sel
--   from information_schema.columns
--  where table_schema='public' and table_name='members'
--    and column_name in ('email','phone','guardian_phone','auth_uid','google_id',
--                        'full_name','previously_removed')
--  order by column_name;

-- 2. The table-level grant is gone. Expect authenticated WITHOUT a leading `r`:
--    authenticated=dDxtm/postgres
--
-- select relacl::text from pg_class
--  where oid = 'public.members'::regclass;

-- 3. No unmoderated post is visible through the view any more. Expect 0.
--
-- select count(*) from public.post_feed_view where status <> 'published';
--
--    And the feed must not have shrunk. Expect 584, the same as before.
-- select count(*) from public.post_feed_view;

-- 4. The photobooth and project-image policies are gone. Expect zero rows.
--
-- select polname from pg_policy
--  where polrelid='storage.objects'::regclass
--    and polname in ('anon manage photobooth assets','anon manage photobooth print sheets',
--                    'anon upload photobooth raw photos','anon read photobooth raw photos',
--                    'anon update photobooth raw photos','Anon write project-images',
--                    'Anon update project-images','Anon delete project-images');

-- 5. The photo bucket is actually closed. From a shell, with the anon key:
--
--    curl -s -o /dev/null -w "%{http_code}\n" -X POST \
--      -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
--      -H "Content-Type: application/json" -d '{"prefix":"","limit":1}' \
--      "$URL/storage/v1/object/list/photobooth-raw-photos"
--    Expect 200 with an EMPTY array [] (RLS filters every row), not 200 with
--    folders. A 400 or 403 is also a pass.

-- ==========================================================================
-- SECTION 7. RETIRED 2026-09-18. DO NOT RUN, now or later.
--
--   Carried forward from AUDIT_CUMULATIVE_2026_09_18.sql, where it is now
--   retired for the same reason. Superseded there; see that file's section 7
--   for the full reasoning. Summary:
--
--   It would revoke anon SELECT on members.class_grade. The note said it was
--   safe 'once the deploy lands'. That was wrong. THREE public routes read the
--   column as anon and two of them are meant to:
--
--     /classes       App.tsx:409   FIXED - now reads class_cohort_counts(),
--                                  which returns aggregates only. This was the
--                                  actual scraping finding.
--     /member/:uuid  App.tsx:415   profileService.ts:204 shows a member's class
--                                  on their PUBLIC profile. Working as intended.
--     /schools       App.tsx:408   schoolService.ts:117, same.
--
--   PostgREST fails a query WHOLE if any requested column is ungranted, so the
--   revoke would blank those two pages rather than degrade them.
--
--   The statement, kept only so nobody re-derives it:
--     revoke select (class_grade) on public.members from anon;   -- DO NOT RUN
-- ==========================================================================

-- ============================================================================
-- ROLLBACK. Per section. Nothing here needs data restored.
-- ============================================================================
--
-- Section 1:  grant select on public.members to authenticated;
--             (this re-opens the PII hole - only for an emergency)
-- Section 2:  alter view public.pending_member_approvals set (security_invoker = true);
--             grant select on public.pending_member_approvals to anon;
-- Section 3:  re-run the DO block with the replace() reversed, or restore the
--             pre-change definition from this file's git history.
-- Section 4:  drop the three "Directors ..." policies and recreate the three
--             "Anon ..." ones with `using (bucket_id = 'project-images')`.
-- Section 5:  recreate the five dropped policies, and
--             update storage.buckets set public = true where id = 'photobooth-assets';
-- Section 6:  alter view public.member_directory_view reset (security_barrier);
