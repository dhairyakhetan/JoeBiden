-- ──────────────────────────────────────────────────────────────────────────
-- Security hardening — 2026-07  SECTION B
--
-- IMPORTANT: this app spans TWO separate Supabase databases. Run each block in
-- the RIGHT one — they do not share functions (is_director() exists only in the
-- community DB), which is why a single script errored with
-- "function public.is_director() does not exist".
--
--   • COMMUNITY DB  — project ref `hzowuwffjqtgszecngpe`  (VITE_SUPABASE_URL)
--       members, notifications, is_director(), auth. → H3, M4 below.
--   • CMS DB        — project ref `nurtpdbqfizmqtztmiwk` (VITE_CMS_SUPABASE_URL)
--       welfare_projects, blogs. NO auth, NO is_director(). → see the note; the
--       welfare_projects/blogs findings CANNOT be RLS-fixed here (explained).
-- ──────────────────────────────────────────────────────────────────────────


-- ════════════════════════════════════════════════════════════════════════
-- RUN IN THE COMMUNITY DB  (hzowuwffjqtgszecngpe)
-- ════════════════════════════════════════════════════════════════════════

-- ── PART 1 (already applied) — the create_notification RPC. Left here for the
--    record. If you only ran `create function` and not the grants, run these:
revoke all on function public.create_notification(integer,text,text,text,text,text) from public;
grant execute on function public.create_notification(integer,text,text,text,text,text) to authenticated;

-- ── PART 2 — run AFTER the frontend deploy is verified (project editor saves,
--    notifications still fire). Both are plain REVOKEs; no is_director() needed.

-- H3 — members: stop anon email/phone harvest. Frontend prerequisite DONE
-- (getPublicProfile now selects non-PII columns; every other email/phone read
-- is authenticated-only).
revoke select (email, phone) on public.members from anon;

-- M4 — notifications: close the direct-insert forgery path. Frontend prerequisite
-- DONE (notificationService.create now calls the create_notification RPC, which
-- becomes the only write path after this revoke).
revoke insert on public.notifications from anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- CMS DB  (nurtpdbqfizmqtztmiwk) — welfare_projects & blogs
-- ════════════════════════════════════════════════════════════════════════
--
-- ⚠️ These findings (H4 anon UPDATE/DELETE of welfare_projects; anon INSERT of
--    blogs) CANNOT be fixed with RLS in this database, and there is intentionally
--    no SQL to run here.
--
-- Why: the app reaches this DB only through `lib/supabase.ts`, a client that
-- NEVER signs in — every request is the public anon key with no auth session.
-- This DB has no members table, no auth.uid(), and no is_director(). So RLS has
-- nothing to gate on: it literally cannot tell a legitimate director write from
-- an attacker write — both arrive as anon. `USING (true)` is not a mistake here,
-- it is the only value that lets the admin UI write at all.
--
-- The ONLY real fix is CONSOLIDATION: move welfare_projects + blogs (READS *and*
-- WRITES) onto the community DB via the authenticated `supabaseCommunity` client,
-- then gate the write policies on is_director() there (community already holds a
-- copy of these tables). That touches ~8 read call-sites plus the writers, needs
-- the community-DB copy confirmed as the authoritative/current data, and is a
-- standalone task — NOT a drop-in migration. (An earlier attempt to route only
-- the *writes* to community while reads stayed on the CMS DB was reverted because
-- it split reads and writes across two databases and broke the project editor.)
--
-- Until consolidation: the exposure stands. Interim risk-reduction options are a
-- product/ops decision (e.g. prioritize the consolidation, or restrict the CMS
-- project's anon key), not something RLS can close from here.
