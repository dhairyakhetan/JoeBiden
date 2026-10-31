-- ============================================================================
-- STATUS: APPLIED 2026-07-24 via Supabase MCP (project hzowuwffjqtgszecngpe).
-- Migration name: submission_director_update_policies_2026_07
--
-- WHY: contact_submissions and collaboration_submissions each had only two RLS
-- policies — *_public_insert (INSERT, anon) and *_director_select (SELECT,
-- is_director()). There was NO UPDATE policy, and RLS is default-deny, so the
-- HoD "Form responses" tab's status workflow (New/Contacted/Closed dropdown +
-- bulk actions) matched ZERO rows: PostgREST returned 200 with an empty set and
-- no error, the component optimistically showed toast.success('Status updated.')
-- and cached it, while the DB was unchanged — reverting on the next load.
--
-- FIX: add the missing director UPDATE policies mirroring the existing SELECT
-- ones. A defensive frontend guard (FormResponses.tsx now uses .select('id')
-- and treats a 0-row result as failure) was added in the same change so any
-- future silently-denied write surfaces an error toast instead of false success.
-- ============================================================================

drop policy if exists contact_submissions_director_update on public.contact_submissions;
create policy contact_submissions_director_update on public.contact_submissions
  for update to public using (public.is_director()) with check (public.is_director());

drop policy if exists collaboration_submissions_director_update on public.collaboration_submissions;
create policy collaboration_submissions_director_update on public.collaboration_submissions
  for update to public using (public.is_director()) with check (public.is_director());
