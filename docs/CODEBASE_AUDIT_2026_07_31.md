# AquaTerra Codebase Audit — 2026-07-31

Three-perspective audit (frontend, backend/data/security, functional flows), cross-checked
against the **live** Supabase project (`community-platform-aq`) and Vercel deployment state
via connectors. Findings verified against the live database are marked **[LIVE-VERIFIED]**.

## Health snapshot

- Build: `tsc -b && vite build` clean. Lint: 0 errors / 52 warnings (all `react-hooks/*`).
- Tests: 27/27 vitest pass (imageUrl, roles, profanityFilter).
- Vercel: latest production deploy READY on `main`; `vercel.json` SPA rewrite is the correct
  `{ "source": "/(.*)", "destination": "/" }` form. One open bot PR (PostHog instrumentation).
- Supabase: RLS enabled on all 29 public tables; `job_applications` exists live.
- Live DB is **tighter than the repo's SQL suggests** [LIVE-VERIFIED]: `welfare_projects`,
  `job_openings`, `contact_submissions`, `collaboration_submissions`,
  `legacy_volunteer_applications` writes/reads are director-gated live, and `post_feed_view`
  is `security_invoker=on`. Much of `security_hardening_2026_07.sql` Section A/H4/M1/M2 was
  applied out-of-band — the repo files still say "NOT YET APPLIED", which is now misleading.

## High severity

### Security / data
1. **[LIVE-VERIFIED] Members PII readable by any logged-in member.** `authenticated` still
   holds column SELECT on `members.email/phone/auth_uid/google_id`; combined with the
   "Anyone can view active members" RLS policy, any member can bulk-harvest ~1,300 members'
   contact PII. Stage-2 revoke (`frontend/scripts/members_pii_lockdown_stage2_revoke.sql`)
   was never applied even though its frontend prerequisite (`get_own_member()` RPC, 3 call
   sites) has shipped. **Action: run the stage-2 revoke.** (`anon` is already revoked.)
2. **service_role key rotation unconfirmed.** `security_hardening_2026_07.sql:12-15` and
   `docs/archive/AQ_BUILD_PROGRESS.md:716` record a service_role key leaked via a since-
   rewritten commit; no record anywhere confirms rotation. **Action: rotate/confirm in the
   Supabase dashboard.**
3. **Paradox `create_auth_user` / `delete_auth_user` SECURITY DEFINER RPCs undefined in
   repo** (`paradox/pages/Admin.tsx:6353,6377`) — they mint/delete auth users with a
   client-supplied password; authorization appears to be UI-only. Commit the definitions and
   verify they check the caller's admin permission server-side. (Separate Paradox project —
   not covered by the live check above.)

### Functional
4. **Suspended members are stuck on an infinite spinner.** `ProtectedRoute.tsx:45-47` sends
   `suspended` → `/rejected`; `RejectedPage.tsx:10-17` only renders for `rejected` and
   bounces to `/login` → `/auth/callback`, whose effect (`AuthCallbackPage.tsx:22-25`) has
   no `suspended` branch. Fix: handle `suspended` in AuthCallbackPage + RejectedPage (and
   `RegisterPage.tsx:39-49`).
5. **Paradox display fonts blocked by production CSP.** `paradox/ParadoxRoot.tsx:150-157`
   loads fonts.googleapis.com, but `vercel.json` CSP allows neither googleapis nor gstatic —
   Paradox silently falls back to system fonts in production. Fix: self-host or extend
   `style-src`/`font-src`.
6. **Approvals tab gating mismatch (inverse of the CLAUDE.md rule).**
   `DirectorDashboard.tsx:96-100` shows the Approvals tab (+ badge) to every leader, but
   `AccountApprovals.tsx:60-65` restricts the desk to super_admin / operations HoDs — other
   HoDs get a dead-end "access restricted". Align the dashboard check to
   `isSuperAdmin || cats.includes('operations')`.

### Frontend
7. **`CreatePostModal.tsx:141,399,456`** — three hand-rolled role comparisons instead of
   `hasLeaderAccess()` (explicit CLAUDE.md violation; drift risk).
8. **`PublicProjectsPage.tsx:344`** — synchronous setState inside the search/fetch effect
   causes cascading renders per keystroke; move resets into the async callback/reducer.

## Medium severity

- **Notifications forgery [LIVE-VERIFIED]:** live `notifications` INSERT policy allows any
  `authenticated` user, so a member can forge notifications to anyone. Restrict INSERT to
  the `create_notification` RPC path (revoke direct table insert).
- **Missing notification loops:** team join-request lifecycle sends zero notifications
  (`teamService.ts:741/838/876/411`) despite dedicated types existing; team-desk post
  approve/reject (`teamService.ts:603/625`) doesn't notify authors while the director desk
  does; job applications notify nobody in either direction (`lib/jobOpenings.ts:288/347`);
  member approval/rejection sends no notification or email even though the UI copy promises
  both (`RegisterPage.tsx:179`, `AccountApprovals.tsx:290`).
- **OAuth deep-link return lost:** `location.state.from` doesn't survive the full-page
  OAuth redirect (`LoginPage.tsx:67`); stash it in sessionStorage.
- **PostgREST `.or()` filter injection:** raw user input interpolated into `.or()` filter
  strings (`searchService.ts:152,284`, `directorService.ts:346,593`,
  `VolunteerApplications.tsx:73,231`). Bounded by RLS, but sanitize `,()` or split into
  separate `.ilike()` queries.
- **`lib/jobOpenings.ts:110-127`:** unbounded `select('*')` plus a status-flipping UPDATE
  fired as a side effect of public reads (silently no-ops for non-leaders under RLS, so
  expired openings linger `open`); move auto-pause server-side.
- **Silent fetch failures** in `AccountApprovals.tsx:79` and `PostModeration.tsx:79`
  (console-only; violates the feedback convention); Axios-shaped error read that's always
  undefined in `CreateTeamPostModal.tsx:90-92`.
- **Type erosion:** 447 `any` casts outside paradox — hotspots `HomePage.tsx` (44),
  `feedService.ts` (33), `teamService.ts` (22); `(supabaseCommunity as any).from('job_openings')`
  mutations in `TeamDetailPage.tsx:155,176`. Regenerate `database.types.ts` and cast once at
  the boundary.
- **Reduced-motion gaps:** 9 files use framer-motion directly without `lib/motion.ts`
  variants or `useReducedMotion()` (PostFocusModal, HomeIntro, DashboardLayout, Confirm,
  HomePage, VolunteerHandbookPage, FeedPostCard, PostPage, CreatePostModal).
- **Monoliths:** `TeamDetailPage.tsx` (1,960 lines, 7 hook-lint warnings) and
  `HomePage.tsx` (1,604 lines) should be split.

## Low / hygiene

- Inline `role === 'super_admin'` checks in ~6 files instead of `isSuperAdmin()`.
- ~32 clickable `<div>`/`<span>` without keyboard semantics (known residual from the
  2026-07-23 audit; was 34).
- Unbounded `select('*')` in `searchService.ts:224`, `schoolService.ts:61`,
  `achievementService.ts:270`, `teamService.ts:815`.
- `/pending` has no auth guard (confusing but harmless dead end for logged-out visitors).
- `.env.example` drift: documents unused `VITE_CMS_SUPABASE_*`; omits the Paradox pair.
- CLAUDE.md staleness: `backend/` no longer exists; `lib/supabase.ts` is now just an alias
  of `supabaseCommunity` (the "CMS client never authenticates" description is outdated —
  which also removes the original justification narrative around welfare_projects RLS,
  already tightened live).
- Anon key hardcoded in `generate-sitemap.mjs:66` / `prerender-meta.mjs:83` (public by
  design; 3-place rotation edit).
- Paradox `pages/Register.tsx` is unrouted dead code.

## Supabase advisor summary (live)

- Security: 2 ERROR-level `security_definer_view` lints (`pending_member_approvals`,
  `member_directory_view`) — **intentional** (director-gate baked into the views per the
  2026-07-29 PII lockdown), safe to acknowledge; WARN items for anon-executable SECURITY
  DEFINER helper RPCs (`is_director()`, `get_team_member_contacts()`, etc. — consider
  revoking anon EXECUTE where not needed), always-true INSERT policies on the public
  submission/lead-capture tables (intentional), public bucket listing on
  `photobooth-assets`, and leaked-password protection disabled in Auth.
- Performance: no ERRORs. 13 table/action pairs with multiple permissive RLS policies
  (each policy evaluated per row — consolidate with OR), 21 never-used indexes (candidates
  to drop), 2 policies re-evaluating `auth.*()` per row (`arcade_*` — wrap in
  `(select auth.*())`).

## Verified clean

Supabase client routing (community/CMS/paradox) correct everywhere; no toasts in services;
no `@ts-ignore`; image `sized()` discipline enforced via `components/Img.tsx`; super-admin
route/tab parity holds for all 4 `superOnly` tabs; all director tabs lazy-loaded; destructive
actions confirm-gated; every internal link/route in `App.tsx` resolves; legacy redirects land;
Paradox sub-app fully isolated (own auth/toast/client); feed pagination, profanity
force-review, and notification self-skip logic all sound.

## Top actions, in order

1. Apply `members_pii_lockdown_stage2_revoke.sql` (live gap, one statement).
2. Rotate/confirm the service_role key.
3. Fix the suspended-member auth loop.
4. Align the Approvals tab gate; fix the Paradox CSP font block.
5. Restrict direct `notifications` INSERT; wire the missing notification loops.
6. Update the stale "NOT YET APPLIED" headers in `frontend/scripts/*.sql` and CLAUDE.md to
   match live reality, so the next audit doesn't re-derive all of this.
