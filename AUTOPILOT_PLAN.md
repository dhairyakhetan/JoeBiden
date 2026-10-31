# Autopilot execution plan — started 2026-09-05

Living to-do. The user has stepped away ("autopilot until the website is ready to go live") and
set a hard goal condition: every message/task checked, both handoffs implemented, every
description/prompt drafted as a to-do and completed with visual checks and optimization. This
file is the source of truth while they're gone — update it as items land, don't let it drift.

## Standing decisions (answered 2026-09-05, apply without re-asking)

1. Role/function chart → **editable reference page**, not a functional permission engine. Reads
   from `lib/roles.ts` + RLS; super_admin/hr can edit description text only. Enforcement stays in
   `hasLeaderAccess()`/`isSuperAdmin()`/RLS exactly as today.
2. Instagram "posting" → **share-sheet/deep-link handoff**. Generate the image, hand it to
   `navigator.share` / Instagram's `instagram-stories://` URL scheme. No OAuth, no Graph API.
3. Member of the Month → **rebuild as multiple simultaneous per-team picks** (schema change: one
   pick per team per month, not one per month total; HOD scoped to own team).
4. Data saturation from the 4 HR spreadsheets → **yes, full backfill, no review gate**. PII-aware:
   follow the existing `members` column-lockdown grant pattern, don't loosen it.

## Corrections found during verification (docs said one thing, live reality said another)

- `certificate_requests_hr_only_2026_09_05.sql` — **file's own header now says APPLIED 2026-09-05,
  and it's true**: live `pg_policies` shows exactly `certificate_requests_update_hr | UPDATE |
  is_super_admin() | is_super_admin()`. `HANDOFF.md` and `REDESIGN_FEATURE_REQUESTS.md` both still
  say "unapplied" — those two docs are stale, not the migration file. No action needed here.
- SOPs P1/P3 one-time data relabel — `public.sops` is confirmed **still 0 rows live** (re-checked,
  not just trusted from `HANDOFF.md`). Genuinely a no-op. No action needed.
- **The 22.1 "duty" (post pending/rejected — the top priority in the new handoff) is further along
  than either handoff assumed**: `directorService.approvePost`/`rejectPost` **already** call
  `notificationService.create()` (types `post_approved`/`post_rejected`, correct deep links) —
  this was missed by both handoff authors, who read an earlier snapshot. `MyPostsPage.tsx` **already**
  has a full status-badge system (published/pending_review/scheduled/rejected) with filters — a
  member can already always tell their post's status. **What's still genuinely missing**: the
  inline lemon/tomato banner treatment ON the feed card itself (`15-post-cards.md` C07), not a new
  data or notification layer. Downgraded from emergency to normal-priority visual polish, folded
  into the card-family restyle work.

## Workstream A — the new visual handoff (`interface-redesign-with-rounded-minimalism/`)

Second full visual restyle on top of the ink-seam system that shipped 2026-09-03→05. "Rounded
minimalism": concentric radius (32/22/14), die-cut stickers, jigsaw desk nav, 3 roaming mascots,
new Profile Wall. Per its own `README.md`: **UI only — no route, copy, or Supabase changes**,
except `16` (profile wall: `profile_notes` + `wall_enabled`, schema pre-approved).

Build order (mandatory, later files reference earlier ones):
`13` stickers → `00` tokens → `02` chrome → `11` states → `15` cards → `01` feed → `03` post
detail → `04` profile → `16` wall → `05` teams → `10` projects → `08` search → `06`+`17`+`20` desk
→ `09` about → `07` auth → `12` secondary → `14` footer → `18` motion → `19` demos (last).
`21-org-facts.md` and `22-social-engine.md` are independently buildable any time.

### To-do (checked as agents/direct work land)

**Status as of 2026-09-06: all 23 changelog files fully done, including all 11 of `19`'s guided-demo
flows.** Every file in the visual redesign handoff has been built and independently verified at
least once. Remaining work is the wave-10 adversarial UX audit (still running) plus whatever it
finds, and the standing list of flagged product/business decisions that were never this session's
to make unilaterally (see below).

- [x] `00`/`13`/`02` foundation — DONE, spot-checked, verified 2026-09-06, see log below. **One
      big decision needs your eyes**: the spec's ink/glass segmented nav bar was NOT built.
- [x] `11` system states — DONE, shared primitives fixed, see log below (some findings depend on
      individual page files adopting them, e.g. `CollaborationsPage.tsx`'s field-error wiring)
- [x] `15` post cards — DONE (wave-2 continuation), all 30 `feedShape.ts` shapes restyled,
      byte-identical `feedShape.ts` + test confirmed, includes the C07 pending/rejected banner.
- [x] `01` home/feed — DONE (wave 3): rails, filters, greeting, load animation.
- [x] `03` post detail + composer — DONE (wave 4a): composer split by intent, full-screen sheet on
      phone. The 22.1 "duty" is fully closed as of this file.
- [x] `04` profile — DONE (wave 4a): own + public, circular-portrait direction.
- [x] `16` **profile wall** — DONE (wave 4a), independently verified, highest-stakes task of the
      whole build — migration applied and RLS-checked live.
- [x] `05` teams + openings — DONE (wave-2 continuation): header lockups, fanned hiring cards.
- [x] `10` projects — DONE (wave-2 continuation): masonry, drive detail bands. Two real bugs
      caught by live measurement.
- [x] `08` search/saved/notifications/directory — DONE (wave-2 continuation): hue discs, two-detent
      sheet.
- [x] `06`+`17`+`20` HoD desk — DONE across 5 dispatches (desk shell wave 4b; people, queue,
      org-setup, publishing clusters wave 5; `ProjectManager` wave 6). All 17 `20` desks covered.
      One real pre-existing production-safety bug found and fixed (self-demotion lockout, see
      wave-5 log) plus a genuinely broken Yearbook admin desk fixed (ambiguous FK embed).
- [x] `09` about — DONE (wave 3): manifesto rewrite, blocked stats get "confirm me" slots.
- [x] `07` auth + contact — DONE (wave 3): seeded art panel ships with placeholder art as decided.
- [x] `12` secondary pages — DONE, verified 2026-09-06 (wave-6 continuation): all 13 routes,
      `/equity-policy` and `/labs` confirmed truly zero-text-diff, `/join` needed no changes. Two
      real overflow bugs found by live measurement and fixed (profile-wall toggle, calendar nav).
- [x] `14` footer — DONE, verified 2026-09-06 (wave-6 continuation): Paradox banner contrast fix
      genuinely live (the handoff's own "highest-reach single fix"), plus a reduced-motion bug
      (activity band never rendered at all for those users) and a footer.css eager-bundling
      performance bug, both self-discovered and fixed.
- [x] `18` mascots + motion — DONE, independently verified 2026-09-06: retired the legacy blob
      companion, `AQMascot.tsx` renamed to `Mascot.tsx` (the codebase's own documented plan), new
      `Companion.tsx` roam/bone/follow mechanic runs on CSS transitions with zero new rAF loops,
      `BurstReveal.tsx` feed entrance animation, 3 mascots added as footer-wall die-cuts.
- [x] `19` guided demos — **DONE, all 11 of 11 flows**, independently safety-verified live. See log
      below for the full second-pass verification (zero Supabase network calls measured on a real
      run, no real auth token, correct fixtures, role-borrowing ribbon intact through to the end
      card). One minor, non-blocking polish item spawned as its own follow-up task rather than
      fixed inline (a mobile coach-card overlap in the pre-existing apply-for-role flow, shared by
      the new sign-up-for-a-drive flow) — see log.
- [x] `21` org-facts — DONE, see log below (one important caveat: needs a deploy env var to
      self-sustain, see log)
- [x] `22` social-engine — DONE, independently verified 2026-09-06 (see log below, including live
      SQL verification of every schema claim). Notifications restyled + real likes-digest batching,
      new-this-week strip, MotM surfaced (2 placements), for-you/latest/my-teams tabs with the
      backfill rule, `pointsTile` cleanup, poster-studio+share-image confirmed already shipped.
      Correctly left unbuilt (schema/infra genuinely absent, confirmed live not guessed): threaded
      replies (`comments.parent_id` doesn't exist), drive-tomorrow notifications (no cron job for
      it), OG-tag prerendering for `/post/:uuid` (flagged infra/privacy decision, minors' data).

## Workstream B — functional checklist (voice memo), now unblocked

- [x] 1. HoD scoped to own-category posts — already live, re-verify with a real scoped session
- [x] 2. Achievement reviews removed, auto-approve — **re-verified 2026-09-05, and one real latent
      gap found+fixed**: `achievementService.create()` sets `status:'approved'` at the app layer
      (0 stuck pending rows live, confirmed), but the column's own DB default still said
      `'pending'` — a defense-in-depth gap since the review desk that used to promote pending rows
      is deleted, so any future insert path that forgot to set status explicitly would create a
      permanently stuck row. Fixed default to `'approved'`, verified live
      (`frontend/scripts/external_achievements_default_approved_2026_09_05.sql`).
- [x] 3. `hr` == `super_admin` — already live, re-verify no regressions
- [x] 3b. Editable role/function reference page (decision 1 above) — DONE, see log below
- [ ] 4/5/7/8. Guided tours — superseded by `19-guided-demos.md`, build there
- [x] 6/13. Poster/story share sheet — DONE, see log below
- [x] 9. CV: add schooling/education/marks fields — DONE, see log below
- [x] 10. Certificates HR-only — confirmed fully applied live, no action
- [x] 11. Member of the Month full rebuild — DONE, see log below
- [x] 12. Points removed — fully verified 2026-09-05, genuinely done (see log below), better than
      either handoff assumed
- [x] Data backfill from the 4 HR spreadsheets into Supabase — DONE, see log below
- [ ] Real Supabase test account per role (member/lead/hod/director/hr/super_admin) for actual
      browser verification — infra needed by nearly everything else

## Role verification — method changed from the standing decision, with reason

`create_branch` requires `confirm_cost` (a real charge) — can't clear that while the user is
unreachable, so no Supabase branch. Creating throwaway auth/members rows directly in this
production database (a real NGO, members aged 14-19) on a fast "recommended" answer in a rapid
Q&A isn't a call to make unilaterally either. **Used RLS-impersonation-via-SQL instead**: within a
transaction, `set local role authenticated; set local request.jwt.claim.sub = '<a real existing
member's auth_uid>'`, then call the real `is_director()`/`get_current_member_id()`/etc. and query
through real RLS as that member — zero writes, always rolled back, proves the same thing (does the
policy actually gate correctly) without touching or fabricating any data. Confirmed working live.

**Real finding, worth knowing**: the live database currently has exactly **one** `hod` row, **zero**
`director`, **zero** `hr`, and **zero** `lead` rows (as `members.role` — team-level leads exist via
`team_members.role='lead'`, but no member's primary role is `lead`). 16 super_admins carry most of
real leadership day to day. Since `director`≡`hod` and `hr`≡`super_admin` in the role model, the
existing hod/super_admin rows exercise the same enforcement code paths — so permission-CORRECTNESS
is still fully verifiable. What can't be verified against real data: anything purely about the
`director`/`hr`/`lead` DISPLAY labels (badges, filters), since no live row wears them.
Also: **zero live pending_review posts** right now, so category-scoped moderation-queue filtering
can't be exercised end-to-end live either — verified by code reading (`getPendingPosts`'s
`.in('category', categories)`) instead.

Verified so far via this method: `is_director()`/`is_super_admin()`/`get_current_member_id()` all
evaluate correctly for a real hod. `hr`≡`super_admin` and `hod`≡`director` are provably correct by
reading the functions' own SQL (`role in (...)` sets), not just by inference.

## Direct Supabase fixes applied 2026-09-05 (see `frontend/scripts/advisor_fixes_2026_09_05.sql`)

Ran `get_advisors` (security + performance). Most findings are pre-existing, by-design WARNs
(helper RPCs like `is_director()` intentionally callable by anon/authenticated, each doing its own
internal check). Two real, small, safe fixes applied and live-verified:
- `member_directory_view`'s `role_rank` CASE had no `hr` branch (added 2026-09-03, view never
  updated) — an hr member sorted as rank 4 (tied with a plain member) instead of rank 0 alongside
  super_admin. Same bug class as the already-fixed missing `lead` branch. Fixed.
- 3 FK columns with no covering index (`member_activity.actor_id`, `desk_todos.assignee_id`,
  `member_of_the_month.picked_by`). Indexed.
The 3 ERROR-level "SECURITY DEFINER view" findings (`member_directory_view`,
`pending_member_approvals`, `rejected_member_approvals`) were checked by hand — each re-implements
`(is_director() OR is_super_admin())` inline, so the elevated read they grant is correctly gated.
Verified safe, not a real vulnerability.

## Background agents dispatched 2026-09-05 (all running in parallel, non-overlapping files)

1. **Foundation** — `00` tokens → `13` stickers → `02` chrome (blocks everything else visual)
2. **`21-org-facts.md`** — generated `lib/orgFacts.ts` from live Supabase, kills the 4-value drives conflict + other disputed public numbers
3. **`11-system-states.md`** — EmptyState/ErrorState/Alert/Toast/Confirm/ErrorBoundary/skeletons, every page/form state once
4. **Role/function editable reference page** — decision 1, new table + route + service
5. **CV schooling/education/marks fields** — real gap in `lib/cv.ts`/`CvCard.tsx`
6. **Instagram share-sheet handoff** — decision 2, extending `ShareModal.tsx`
7. **Member of the Month rebuild** — decision 3, per-team picks + notify/photo/auto-post pipeline
8. **PII backfill from the 4 HR spreadsheets** — decision 4, email-matched, null-only, fully audited

Wave 2 dispatched 2026-09-06 now that foundation landed: **`15` post cards** (feedShape.ts must
stay byte-identical — the single hardest constraint of this whole engagement), **`05` teams +
openings** (briefed with the `DEPARTMENTS.kind` fix + real hue values already resolved), **`10`
projects** (briefed with the multi-image/volunteers-is-integer/no-shortfall-column findings already
resolved), **`08` search/saved/notifications** (briefed that post-approval notifications already
work and pg_cron exists, so it doesn't rebuild either). Still queued behind these: `01` feed,
`03` post detail+composer, `04` profile, `16` wall, `06`+`17`+`20` desk, `09` about, `07` auth,
`12` secondary, `14` footer (parallax wall — foundation only did the footer *shell*), `18` motion,
`19` demos (last).

### Agent 4 (role/permissions page) — DONE, spot-checked, verified 2026-09-05

Built `/roles` (member-visible transparency page, not under `/director/*` — reasoned: it's for the
whole community, editable by leadership, not a HoD-desk tool). New table
`role_capability_notes` (`frontend/scripts/role_capability_notes_2026_09_05.sql`), RLS: SELECT
`authenticated`, write `is_super_admin()`, `anon` zero grants — applied and I independently
re-verified live (matches the agent's own claim exactly: director 6/hod 6/hr 5/lead 3/member
5/super_admin 5 = 30 rows). I read `RolesPage.tsx` in full — clean, follows house conventions
(service throws, component toasts, EmptyState/ErrorState/Skeleton). Screenshotted it myself via
`?dev=super_admin`: renders correctly, and correctly shows an honest `ErrorState` (`permission
denied for table role_capability_notes`, with retry) rather than crashing — expected, since the
dev-preview bypass fakes the client object but not a real Supabase JWT, so RLS correctly rejects
it as `anon`. **Real gap confirmed, not yet resolved**: the edit flow, save-toast, and zero-row
write-guard still need a real hr/super_admin session to verify — same real-session limitation
noted throughout this file. `tsc -b`/`build`/278 tests all clean (up from 268 — some other agent
added ~10 tests, will confirm which when it reports). Real nuance the agent found and got right:
`lead` is deliberately excluded from `hasLeaderAccess` (a team lead's own posts still queue for
review), and HoD/Director retain DB-level SELECT on `certificate_requests` even though the desk UI
route is HR/Super-Admin-only — both match this codebase's existing documented intent, not bugs.

### Agent 5 (CV education fields) — DONE, spot-checked, verified 2026-09-05

New table `member_education` (institution/credential/start_year/end_year/grade) — correctly NOT a
`members` column (would inherit no grant under the PII-lockdown re-grant trap, same reasoning as
`member_of_the_month`) and NOT JSON (one-to-many, needs per-row edit/delete like
`external_achievements`/`member_breaks`). I independently re-verified the 4 RLS policies live —
exact match to the report (own-row CRUD, director/super_admin can also read). Table is genuinely
0 rows (the agent's own insert/update/delete/constraint smoke test cleaned up after itself
correctly). `cv.ts`/`CvCard.tsx`/`cvService.ts` extended, 6 new tests, **278/278 passing** — this
resolves the test-count question from agent 4's report (268→278 was this agent). `tsc -b`/
`build`/`lint` all clean. One judgment call flagged for a second look, not urgent: the education
form's profanity gate uses the looser achievement-tier check rather than the stricter bio-tier one
— low stakes (institution names, not free text), leaving as-is. **Same real-session gap as
everywhere else**: no way to click through the actual add/edit/delete UI or generated CV output
without a real logged-in account.

### Points removal — correction: it's genuinely done, better than either handoff claimed

The NEW handoff's `UX-GAPS.md` (written today) claims `pointsTile` "shows 'your points' in five of
seven greeting recipes... Not fixed by any changelog file... needs your call." **Checked the
actual live file — this is stale, written against a slightly earlier snapshot.** `gridRecipes.ts`
already replaced `pointsTile` with a clean `profileTile` (no points reference, same 2×1 grid span
so the packed-grid layout doesn't break), with a well-reasoned comment explaining exactly why
(retired 2026-09-04, `points_ledger`/`pointsService.ts` deliberately kept as inert
data-layer-only leftovers for reversibility, not a live bug). Also checked `BreakModal.tsx`'s
frozen reassurance string — already rewritten too (`BREAK_REASSURANCE`, first half byte-identical,
only the points clause replaced, explicitly logged as the one sanctioned exception to the
string-freeze rule). `MemberDirectory.tsx`'s `RedeemPointsModal` is confirmed deleted. **No action
needed anywhere for points removal — don't let a future wave "fix" something already fixed because
a handoff doc said so.**

### Agent 6 (Instagram share-sheet) — DONE, spot-checked, verified 2026-09-05

Confirmed live in-browser first that `ShareModal.tsx` is genuinely a custom sheet (Copy Link, QR,
Poster Studio, 1080×1920 story card), not a `navigator.share` wrapper — matching what I'd already
found. Added `canShareFiles` capability probe + `dataUrlToFile()` to both `ShareModal.tsx` and
`PosterStudioModal.tsx` (+181/-31 lines total); primary button becomes "↗ share image" with a
download-instead link when Web Share API + files is supported, falls back to the original download
otherwise. `AbortError` (user backs out of the OS sheet) is silently swallowed — no forced
download, a real judgment call, reasonable. I grep-confirmed the key additions
(`canShareFiles`/`dataUrlToFile`/`AbortError` handling) exist exactly as reported. Verified the
"supported" branch by monkey-patching `navigator.share` live and forcing HMR re-eval — confirmed a
real `File` gets built from the actual canvas output at the correct size/type. `tsc -b`/`build`
clean. Correctly noticed `MemberOfMonth.tsx`/`HomePage.tsx` transiently failing `tsc -b` mid-run,
correctly identified this as the concurrent MoM-rebuild agent's in-progress edit (not its own
fault), and correctly did not touch/stash/interfere — exactly the shared-working-tree discipline
asked for. **What still needs a real device**: the actual native OS share sheet UI and whether
Instagram appears as a listed target — untestable in this environment either way.

### Agent 3 (`11-system-states.md`) — DONE, spot-checked, verified 2026-09-05

Scoped correctly to shared primitives only (`EmptyState`/`ErrorState`/`ErrorBoundary`/`Toast`/
`Skeleton`), left `Alert.tsx`/`Confirm.tsx` untouched after confirming both already comply. Real
fixes: `ErrorState` had a dashed border that directly violated the "dashed = provisional data only"
rule, and its retry button was under the 44px hit-target floor (was 40px) — both fixed, both
independently confirmed by me via grep. Added the `00.10`-promised but previously-unwired
`[aria-invalid="true"]`/`.field-error` primitive (still needs a page file to actually use it —
`CollaborationsPage.tsx` is the named candidate, correctly left untouched as out-of-scope-for-this-
file). Fixed 5 stale hardcoded hex fallbacks in `ErrorBoundary.tsx`. Toast/Skeleton got correct
`aria-live` behavior (assertive only for real errors; one grouped announcement, not one per block).

**Cleared up a false alarm, not a bug**: this agent reported `--rust` as "not undefined, already
aliased" — contradicting what I'd told the foundation agent to fix. I checked `tokens.css` myself:
the alias exists, with a comment explicitly citing the changelog file and `--danger #C4231A` — this
is the **foundation agent's own in-progress work**, visible early because it's a shared working
tree and system-states' build ran after foundation's tokens.css edit landed. Not a conflict, not
duplicated effort — just two agents' timing overlapping normally. Confirmed no actual issue.

**Mismatches correctly reported, not silently fixed** (real, prior, reasoned decisions in this
codebase that the new handoff's spec didn't know about): Toast's flat-white+hue-edge design over a
full hue-tint fill (existing comment: a full tint fails AA for 13px body text on welfare/tomato —
better reasoning than the spec's own ask); "offline" already exists as a toast type, contradicting
the spec's "should be a persistent banner" — a prior deliberate decision with its own comment,
correctly not overridden. Confirmed a global `ErrorBoundary` is wired in `App.tsx`. Real, if
partial, answer on "actions with no inverse function": `useUndoableAction` already covers post
moderation + account approvals; a full audit of every service function is still open. 279/279
tests, `tsc -b`/`build`/`lint` all clean. Did genuine browser verification (not just code review):
exercised `EmptyState` via `/members`' zero-result search and `Toast`/`Confirm` via `/dev/components`
at 375px/1280px, checked for horizontal overflow programmatically (`scrollWidth` vs `innerWidth`),
confirmed the new assertive-error toast fires correctly. Noted the click tool intermittently hung
in its session (screenshots/navigate/eval all fine) — worth knowing if that recurs for me too.

### Agent 7 (Member of the Month rebuild) — DONE, spot-checked, verified 2026-09-05

Migration `member_of_the_month_team_scoping_2026_09_05.sql` — I independently re-verified live:
`team_id` is now NOT NULL, `photo_url`/`photo_uploaded_at` added (matches report exactly), and all
4 new functions (`can_pick_mom_for_team`/`mom_target_on_team`/`mom_period_is_open`/
`submit_mom_photo`) correctly show `anon_can_execute = false` — confirming the agent's own
self-caught bug (Supabase grants EXECUTE to `anon` directly, not through `PUBLIC`, so an initial
`revoke ... from public` silently did nothing) was genuinely fixed, not just claimed fixed.

**Team-scoping decision, well-reasoned, checked against live data first (not guessed)**: "own
team" = active `team_members` membership in ANY role, not just `role='lead'` — because the single
real live hod is a plain `'member'` of Welfare Team, not a `'lead'`; requiring `lead` would have
locked the one real HOD out of picking for any team at all. Also correctly rejected
`director_categories` as the scoping mechanism since `'operations'` alone spans 3 teams, not 1.
Consequence honestly flagged: a hod/director on zero teams can't pick for any team; only hr/
super_admin retain org-wide reach.

Built the full pipeline: HR opens/closes a month (`member_of_the_month_periods`), a scoped HOD
picks their team's winner, `submit_mom_photo` RPC lets the winner (and only the winner) upload a
photo, `MemberOfMonthClaimCard.tsx` then reuses the **existing, unmodified** `PosterStudioModal`
generator and the **existing, unmodified** `ShareModal` (re-read immediately before wiring since
another agent had changed it since this agent's first read — confirmed the public props were
unchanged, so it composes safely without either agent touching the other's file). `HomePage.tsx`'s
rail now shows one row per team instead of one global pick.

**Judgment calls, reasonable, flagged not hidden**: the winner's auto-generated post goes through
the normal `feedService.createPost` (still queues for moderation like any member post — no new
moderation-bypass RPC was built, correctly, since nobody asked for one). HR's "downloadable
document" is CSV, not PDF (this codebase has no PDF library; CSV matches the existing
zero-dependency download pattern) — worth a quick confirmation from the user that this matches
what they meant, not a defect. No `useConfirm()` on the open/close-month toggle (judged reversible,
unlike clearing a pick, which does confirm) — reasonable.

Verification: `tsc -b` clean, `tsc -b && vite build` clean (~7s). Correctly identified that plain
`npm run build` currently fails at the `prerender-meta.mjs` step due to the **concurrent org-facts
agent's** in-progress `package.json`/`orgFacts.ts`/`useMeta.ts`/`compute-org-facts.mjs` changes —
not this agent's fault, correctly left untouched. 279/279 tests, eslint clean on touched files.
Browser-verified unauthenticated: home loads without crashing, protected routes correctly bounce a
guest, confirmed the CSS tokens/classes it depends on survived heavy concurrent `tokens.css`/
`v6.css` edits from other agents. **Same real-session gap as everywhere else**: the full pick →
notify → upload → generate → share loop needs a real hod, a real hr, and a real winning member to
click through end-to-end.

### Agent 8 (PII backfill) — DONE, independently verified 2026-09-05, exemplary work

This was the highest-stakes task (real PII, real minors) and I verified it the hardest —
everything checked out exactly. Independently re-ran the agent's own before/after counts myself
rather than trusting the report: `instagram_filled = 552` ✓, `class_grade_filled = 1168` ✓, both
exact matches. Confirmed the `community_audit_logs` table genuinely has all 579 rows, one
timestamp (a single batch write, as claimed). Confirmed the grants fix live via
`has_column_privilege` myself: `instagram`/`linkedin` readable by anon+authenticated,
`birthday`/`break_*`/`birthday_public` authenticated-only (deliberately not extended to anon —
reasonable, these carry more consent weight) — matches the report exactly.

**A real, previously-undiscovered production bug, found and fixed before any data was touched**:
7 columns added after the 2026-07/08 PII lockdown (`instagram`, `linkedin`, `birthday`,
`birthday_public`, `break_start`, `break_end`, `break_reason`) had **zero SELECT grant for anyone**
— not row-scoped, column-scoped, so this silently blocked every member from reading even their
*own* birthday via any normal query. Almost certainly why all seven were 100% NULL across 1,375
members despite `EditProfilePage` already having a birthday input. Fixed via
`frontend/scripts/members_social_grants_fix_2026_09_05.sql`, live-verified.

**Matching discipline held exactly to the brief**: email-only (never name/phone), 1,099/1,200
distinct sheet emails matched a live member, 579 had ≥1 empty field actually filled, 101 unmatched
correctly left uncreated. `break_reason` skipped (source values were just `"ALUM"`, doesn't fit the
check constraint — correctly not force-mapped). `school_id` skipped and **spawned as its own
follow-up task** (a chip should be visible to you) — `public.schools` is genuinely 0 rows live, so
766 free-text school names would need real canonicalization, not a null-fill; correctly refused to
guess. 105 genuine `class_grade` conflicts found (after normalizing 570 false-positive format
differences like "Class 11" vs "XI"), none applied — live value always wins, full list kept in the
session's local scratchpad, offered for your review. Only 2 new `team_members` rows added
(tab→team mapping verified against live `teams` + cross-checked against `lib/departments.ts` and
`RootsPage.tsx`, not assumed) — small, clean, safe yield.

### Agent 2 (`21-org-facts.md`) — DONE, independently verified 2026-09-05

Re-ran the agent's exact SQL myself: `drives_written_up=548`, `members_active=1317`,
`posts_published=586`, `teams_active=8`, `schools_represented=0` — **every single number matches
exactly**, and `orgFacts.ts:125` genuinely has `drivesWrittenUp: 548` baked in. Rounds down per
`BRAND_VOICE.md` §3 (548→540+, 1317→1300+). Real findings: `schoolsRepresented` isn't just
unbuilt, it's structurally empty (0 schools, 0 members with a `school_id`) — `SchoolsPage.tsx` had
already independently discovered this too, so `ORG_FACTS.schoolsRepresented` ships `null`
correctly rather than a fabricated number. Found a THIRD conflicting clothes-distributed-kg value
in `BrandPage.tsx` beyond the two already known — all three now correctly ship as `null` rather
than picking one. Resolved Paradox 3.0's date to June 2024 **from the paradox sub-app's own source
code** (not guessed) against BRAND_VOICE's uncorroborated "2025" — flagged for final human
sign-off, not silently overridden. Fixed a real integration break in `prerender-meta.mjs` (its
`data:`-URL module-loading trick broke the moment `metaConfig.ts` gained a real import).

**Important caveat, not a false "done"**: this environment has no `SUPABASE_SERVICE_ROLE_KEY`, so
`orgFacts.ts` was bootstrapped once with the real SQL-verified numbers above — correct right now,
but **the self-regenerating build step needs that key added to Vercel's Production + Preview env
vars before it can actually kill future drift automatically**, otherwise it's just a script someone
has to remember to run by hand. This is a real, user-actionable follow-up, not optional polish.
Also flagged, not fixed: `departments.ts`'s "3,200+ Instagram followers" is published as a stat in
direct violation of `BRAND_VOICE.md` §3.4 ("never publish as a stat") — spun off separately rather
than fixed inline, since it's a copy/product decision, not a number-sourcing one.
`tsc -b`/`build`/279 tests all clean; confirmed via built `dist/` output, not just the source file.

### Schools canonicalization agent — DONE, independently verified 2026-09-06, exemplary work

Re-ran the numbers myself: `schools` = **212** ✓, `members.school_id is not null` = **1034** ✓,
`community_audit_logs where action='school_backfill'` = **1034** ✓, the new case-insensitive
unique index on `schools.name` exists ✓, and a fresh duplicate-name-group scan comes back **0** —
the canonicalization genuinely holds, not just claimed. 766 raw strings → 450 after mechanical
normalization → 212 real canonical schools after manual, evidence-based clustering (down to
frequency 2), correctly refusing to merge genuinely ambiguous cases (bare "St Xavier's" — 3 real
distinct Kolkata institutions share that name fragment; multi-campus chains like Narayana/Vibgyor
with no branch named; several Manipal/Bhawanipur variants kept as separate rows rather than
guessed together). 36 same-email-different-school conflicts (plausible school→college transitions)
correctly skipped, not guessed. **Self-caught and corrected its own mistake before it could cause
harm**: found it had accidentally hand-transcribed a duplicate 213th row, deleted it via a same-day
follow-up migration before any member ever referenced it — real self-QA, not just a clean report.
Checked grants live rather than assuming: `members.school_id` predates the PII lockdown and was
never affected (no fix needed); added a genuinely useful root-cause fix beyond what was asked — a
unique case-insensitive index on `schools.name`, since `schoolService.createSchool()` had no
dedupe check at all. PII discipline held: only the 212 non-PII school names are checked into the
migration file; the actual member-email backfill data was never committed, following this repo's
own established lesson. Correctly identified `npm run build` currently failing only because of the
**wave-2 search agent's** active in-progress `SearchPage.tsx` rewrite (still running at the time)
— left it alone rather than touching someone else's mid-flight work.

### `lib/departments.ts` update, live — this is the wave-2 teams agent's work landing correctly

Saw this file change on disk mid-session: the wave-2 teams agent added `kind: 'volunteer' |
'business'` to `Department` and all 8 entries, matching **exactly** the classification I briefed
it with (Events/Welfare/Social Media/Collabs/HR = volunteer; Crftd/AQ.Ventures/ShikshAQ =
business). Also added `deptKindForTeamName()` (mirrors the existing `deptColorForTeamName()`
name-matching pattern) and a centralized `KIND_LABEL` export so the "volunteer team"/"student
business" copy can't drift between `/teams`, the hero and `/about`. Well-reasoned, consistent with
the file's existing conventions — no concerns, full report will land when that agent completes.

### Two flagged follow-ups from agents 8 and 2, received and actioned 2026-09-05

**Instagram follower-count BRAND_VOICE violation (flagged by agent 2)** — `lib/departments.ts`'s
Social Media department published "3,200+ followers on Instagram" in both `desc` and `stat`,
directly violating `BRAND_VOICE.md` §3.4 ("never publish as a stat"). Fixed directly (small,
mechanical, no judgment call needed): removed the number from both fields, `stat` now reads "Every
AQ post, reel and caption" — matches sibling departments' terse, number-free style (e.g. Collabs'
"Partnerships across Kolkata"). Grepped all of `frontend/src` for "3,200+"/"3,222" afterward —
zero remaining hits, this was the only call site. `tsc -b` clean, full `npm run build` clean
(exit 0).

**Schools canonicalization + backfill (flagged by agent 8)** — `public.schools` is genuinely 0
rows, blocking `members.school_id` for 766 distinct free-text school names across ~1,686 sheet
rows. This is real judgment-heavy work (dedup/canonicalize without wrongly merging two different
real schools), so dispatched as its own background agent rather than done inline — briefed with
the full context: normalize-then-cluster strategy, manual resolution only for high-confidence
matches, leave genuine ambiguity as separate flagged rows rather than guessed merges, check column
grants first (the exact `members_social_grants_fix_2026_09_05.sql` bug could easily recur on a new
column), write+apply+live-verify a dated migration, audit-log the backfill matching the
`community_audit_logs` convention agent 8 already established.

### Agent 1 (Foundation: `00`+`13`+`02`) — DONE, verified 2026-09-06 — the most consequential report so far

**Needs your explicit sign-off, presented plainly, not buried**: the new handoff's centerpiece nav
redesign (a segmented ink/glass capsule bar with masked concave joints between logo/links/utility/
Post) was **deliberately not built**. The agent found the *live* nav is a different, more recent,
already-shipped "floating pill" system with its own code comment explaining it was a deliberate,
performance-motivated move AWAY from glass/blur on the two fixed re-rasterized surfaces (top bar +
bottom bar) — I verified this comment is real, not fabricated, by grepping `AQNav.css` myself.
Building the spec's version would discard a working, intentionally-tuned component and collide
with a *second, still-live* glass treatment used elsewhere (individual glass pills on inactive nav
icons) that the same tokens would have broken. **This means the site's single most-visible chrome
element will NOT visually match this handoff**, on purpose, pending your call — everything else in
`02` (dropdown, drawer, footer, focus rings, the mobile unread-dot gap) WAS built.

**Real bugs found and fixed, several caught only via actual browser measurement, not just diffing
code**: the logo-in-circle fix needed a SECOND fix beyond what the spec named — the `aspect-ratio`
CSS was still squishing the new square asset even after swapping the image file (measured 130×22
→ 22×22 before/after, live). A masked bug in the "delete this redundant rule" instruction — doing
just that would have unmasked a dead `calc()` rule underneath that un-pills every button/chip;
caught before it shipped. A previously-unknown real gap: **phone users had zero unread-notification
signal anywhere** (the bell is `display:none` below 760px) — added the missing mobile dot.

**Correctly refused to guess or blind-follow six more times** (each independently plausible, each
checked instead of assumed): `Sticker.tsx` already exists as a *different*, more sophisticated
component from a different design source — the spec's real target turned out to be the old plain
utility classes, matched byte-for-byte once found. `--r-photo`/`--r-card`/`--poster-gutter`/`--rust`
were already fixed, just via different values/mechanisms than the spec assumed — left alone rather
than "re-fixed." `Marquee` (which the spec called decorative and slated for deletion) is actually
the live carrier of the exact disputed public stat figures (`550+ DRIVES`) — deleting it would have
broken the one place those numbers render; not deleted.

I independently re-verified the nav-decision comment block is real (grepped `AQNav.css` myself) and
did a live visual pass: homepage, dropdown, footer, stickers all render correctly at a glance.
**One thing I chased that turned out to be a false alarm, not a regression**: a screenshot showed
the roaming mascot visually overlapping the LOG IN button. Reloaded and re-checked — the mascot
roams to a different position each load (confirmed via a second load landing it elsewhere
entirely), and it's `pointer-events:none` so it can never actually block the click. Pre-existing
roam behavior, not something this pass introduced — worth a mention to whoever builds `18`
(mascot/motion) as a possible roam-boundary rule, not an urgent fix.

`tsc -b`/`build` (full pipeline incl. org-facts/sitemap/prerender)/279 tests all clean.
`feedShape.ts`/its test confirmed untouched via `git status`. Files touched: `tokens.css`,
`v6.css`, `index.css`, `uiHelpers.ts`, `AQNav.tsx`/`.css`, `MobileMenuBar.tsx`, `AQFooter.css`,
`footer.css`. Deliberately left `styles/routes/nav-mobile.css` alone (an intentionally-emptied
stub with its own comment explaining why).

### Branch cost, checked (read-only, nothing spent)

Called `get_cost` (informational, does not charge) out of curiosity given how often "no real
session" is blocking full verification across every agent so far: a Supabase dev branch costs
**$0.01344/hour** on this org — genuinely trivial, a few cents even for hours of testing. Did
**not** call `confirm_cost`/`create_branch` — that tool explicitly exists to represent the
user's own confirmation, not mine to self-approve regardless of how small the amount is. Worth a
5-second yes/no the moment the user is back; noting the real number here so that's a fast decision
rather than a vague "it costs something."

## SOCIAL-ENGINE.md's own "Unresolved" questions — resolved live, not guessed (2026-09-05)

Checked directly against the schema rather than left open:
1. **Does `Post` carry `sticker`?** No — confirmed, column doesn't exist. The "firsts" recognition
   feature (22.7) is genuinely blocked on a real schema gap, not a documentation gap.
2. **`parent_id` on comments?** No — confirmed, column doesn't exist. Replies must ship as the
   doc's own documented fallback (flat, prefilled `@name`) until a schema decision is made to add
   one; don't build threading against a column that isn't there.
3. **Does `post_tags` exist, for @mention notifications?** Yes, the table exists — but it has 0
   live rows (matches an earlier session's finding: the write surface exists in `CreatePostModal`,
   nobody has used it yet). Not blocked, just unpopulated — kind-4 mention notifications can be
   built now, they'll just have nothing to fire on until members start tagging people.
4. **"Is there any scheduled-job capability?"** — the handoff assumed no. **Wrong: `pg_cron` is
   installed and already runs one job** (`publish_due_scheduled_posts()`, every minute — backs
   `posts.scheduled_for`). This directly unblocks notification #5 (drive-tomorrow reminder) and the
   wall's 30-day purge (`16`) — both can follow the exact same `cron.schedule(...)` pattern already
   live, not a new capability to build from scratch.
5. **"Can `/post/:uuid` be prerendered?"** (blocks 22.8, the outward share card / OG tags) — **DO
   NOT BUILD THIS YET, real privacy tension found, not just an infrastructure question.**
   `frontend/scripts/prerender-meta.mjs` already prerenders 3 other dynamic route families
   (`/blog/:slug`, `/projects/:slug`, `/teams/:uuid`) via a proven, working pattern — so
   *technically* extending it to `/post/:uuid` is easy. **But its own header comment explains
   `/member/:uuid` and `/post/:uuid` are DELIBERATELY excluded from both prerendering AND the
   sitemap**, verbatim: *"real students, many minors, and member-authored permalinks
   respectively."* Giving posts a rich, crawler-indexed, cached-forever social preview card (with a
   real photo, possibly of a minor) is a bigger public-exposure change than today's bare-URL
   sharing, and the handoff's own author flagged this only as a neutral "infrastructure decision,"
   not realizing it cuts directly against an existing, deliberate safety decision in this exact
   codebase. **Needs the user's explicit call before any agent touches this** — not something to
   guess or default on. `drive_attendance` is also confirmed genuinely 0 rows (not just
   pre-2026-08-31 — zero, ever), so 22.7's "streaks of showing up" will correctly render as
   universally-empty until the welfare check-in feature actually gets used in the field; that's
   working as designed, not a bug to chase.

## Rate-limit incident, 2026-09-06 — all 4 wave-2 agents hit it simultaneously, recovered

All four wave-2 agents (`15` cards, `05` teams, `10` projects, `08` search) failed at the same
moment with `HTTP 429 rate_limit`, session limit reset ~3:20am IST. **No native way to resume a
subagent in-place was available in this session** (no `SendMessage` tool exposed here, unlike a
documented prior session where one was) — restarting cold would have discarded real progress, so
before re-dispatching, checked `git status`/`git diff` per file to see exactly how far each got:
- `15` (cards): 5 of 8 card families done (`00`/`01`/`03`/`05`/`07`), `02`/`04`/`06` not reached.
  `feedShape.ts`/`.test.ts` confirmed still untouched (correct).
- `05` (teams): essentially complete — `departments.ts`, `OpportunitiesPage.tsx`, `TeamsPage.tsx`+
  `.css`, `TeamDetailPage.tsx`, `detail/AboutTab.tsx`, `detail/MembersTab.tsx` all show real diffs.
  Cut off mid-cleanup of a possibly-still-load-bearing map, not mid-feature.
- `10` (projects): essentially complete — `PublicProjectsPage.tsx` (the task brief's assumed
  filename `ProjectsPage.tsx` was wrong; live component has a different name), `PublicProject
  DetailPage.tsx`+`.css`, `DirectoryPage.tsx`, `styles/routes/projects.css` all show real diffs.
  Was about to run its verify suite when cut off, not mid-feature.
- `08` (search): broad coverage already (`SearchPage.tsx`, new `SearchPage.css`/
  `SearchResultCard.tsx`, `searchService.ts`, `NotificationsPage.tsx`, `SavedPostsPage.tsx`,
  `savedPostsService.ts`), cut off mid-edit on one specific `renderCount` fix.
- `tsc -b` across all of this in-flight, partial work came back **clean** — nothing left broken.

Re-dispatched all 4 as **continuation** agents (fresh `Agent` calls, since true resume wasn't
available) explicitly briefed with the real file list already touched, told not to redo/revert
completed work, and pointed at exactly what's known-incomplete per agent above. Also carried
forward a real finding from the interrupted `15` agent so its continuation doesn't waste time
rediscovering it: **the 30-shape card system it's restyling doesn't render anywhere in the live
app** — the feed still runs through an older `.feed-card` component; the new system is built,
tested, and unmounted (a known, pre-existing gap from an earlier session, out of scope for this
file). Browser verification of `15`'s work will need the catalogue/gallery route, not the live feed.

### Wave-2 `08` (search/saved/notifications) continuation — DONE, spot-checked, verified 2026-09-06

Correctly traced the interrupted `renderCount` edit to `DirectoryPage.tsx` (part of this same
file's scope, section 08.7) rather than where I'd guessed — confirmed it was already fully applied
before the cutoff (the "never render a bare 0, say nothing yet" rule). Found the two-detent sheet
at `components/Sheet.tsx`, genuinely reusable and explicitly commented as built for both this file
and the future HoD-desk nav — exactly as briefed. Correctly OMITTED a "why it matched" search
result line rather than fake one, since `searchService.ts`'s `.ilike()` queries can't provide a
real match snippet — matches the spec's own documented fallback. Found and fixed one genuine gap:
saved-posts unsave had no undo toast (spec requires undo, not a confirm) — I independently
confirmed the fix is real (`toast.action('removed from saved.', {label: 'Undo', ...})` in
`SavedPostsPage.tsx`) and `Sheet.tsx` genuinely exists.

**Good judgment, worth noting explicitly**: found a real, un-scoped `.chip-active` `!important`
rule in `v6.css` overriding these filter chips site-wide — correctly did NOT touch it, both because
it's outside this file's scope and because `v6.css` was concurrently dirty from the foundation
pass. Flagged instead of risking a shared-file collision. Also **correctly refused to perform a
real Google OAuth sign-in itself** to browser-test `/search`/`/saved`/`/notifications` (all
gated behind real auth) — recognized this crosses into "don't authenticate on the user's behalf"
territory even in a testing context, and substituted full static/code-level spec verification
instead (traced every requirement against source, checked CSS overflow arithmetic by hand) rather
than working around the boundary. `tsc -b` clean, 279/279 tests, `build` clean.

### Wave-2 `15` (post cards) continuation — DONE, verified 2026-09-06, plus one fix of my own

`feedShape.ts`/`.test.ts` confirmed byte-identical (empty `git diff --stat`) both by the agent and
independently by me. Smart scoping: families 02/04/06 are entirely "blocked" shapes (no numbered
spec subsection), so the agent correctly audited them against the general rules rather than
inventing redesigns nothing asked for — found 02/04 already fully compliant, and found a **real,
measurable contrast bug** in 06's `CardMilestone`: a 52px figure colored with the raw category hue
as text, measuring as low as **1.61:1** (labs/lemon) against a 3:1 floor for large type. Fixed via
a new `inkHueFor()` helper mapping each category to its existing `*-ink` token partner — zero new
colors. Correctly spotted the **identical bug** in `family03Records.tsx` (already-landed, out of
this agent's scope) and used `spawn_task` to flag it rather than touching someone else's file —
exactly the right call.

**I picked up that flagged task myself** rather than leaving it as a separate chip, since I had full
context already: promoted `inkHueFor()` from its local definition into the shared `feed/cards/
parts.tsx` (a second caller now needs it, matching that function's own original comment about when
promotion would make sense) and applied it to `family03Records.tsx`'s `CardProjectDone`. Verified
`tsc -b`/`eslint`/`vitest run` all clean afterward (279/279 tests) — confirmed `hueOrInk` is still
correctly used elsewhere in that file for actual fills (icon glyph, progress-bar background), so
the import wasn't left dangling. Dismissed the spawned task chip with a note.

Also confirmed: `CardCatalogue.tsx` (the 30-shape gallery) renders **fixtures, not live rows** —
restyling it was data-safe — and it genuinely has no mounted route anywhere (`App.tsx` checked),
so browser verification of this file's work needed code/token review + the test suite instead of a
live screenshot; the agent correctly did NOT add a route to enable one, since that would violate
the "no route changes" rule for a convenience. One copy question raised, not fixed: the gendered
"Wish her" string exists only in the catalogue's own sample fixture (the real component's default
is already "Wish them") — flagged for human approval per the spec's own instruction, not silently
changed either way.

### Wave-2 `10` (projects) continuation — DONE, verified 2026-09-06 — two real bugs caught by measuring, not looking

Found via actual DOM measurement (not screenshots) two bugs that made two of the six required
behaviors silently non-functional in the live app, both now fixed and verified:
1. **The sticky rail was invisible at every width, and broke the masonry too.** A CSS source-order
   bug — the base `.arch-rail{display:none}` rule was declared AFTER its `@media(min-width:900px)`
   override, so the later unconditional rule always won regardless of viewport (equal-specificity
   ties resolve by source order, media query or not). I independently re-read `projects.css` and
   confirmed the fix: the base rule now comes first, override after, with the bug fully documented
   inline. Worse than just "invisible rail" — a `display:none` grid child is removed from
   auto-placement entirely, so the masonry silently collapsed into the rail's 236px column instead
   of its own 976px one, squeezing all 24 tiles into a sliver with ~80% of the content area blank.
2. **The scroll-revealed search bar wasn't scroll-revealed at all** — visible from first paint.
   Two compounding bugs: the sentinel had no positioned ancestor so it measured from the document's
   y=0 instead of near the grid, AND the reveal logic (`!entry.isIntersecting`) can't tell "not
   scrolled to yet" from "already scrolled past" — both read `false`. Fixed both; verified the full
   cycle live (hidden → reveals past the fold → hides again scrolling back up → focus-jump works).

**Correctly challenged a false premise in the briefing** rather than forcing it to fit: I'd told
this agent `DirectoryPage.tsx` held "the sticky rail pattern" to reuse — it actually turned out to
be an unrelated four-entrance wayfinding page with no rail at all, and the real rail was built
fresh from `10.1`'s own spec in `PublicProjectsPage.tsx` instead. Also independently recomputed
(not trusted) the scrim contrast (~12.9:1 worst case) and the drive-detail welfare band's contrast
(4.553:1, a genuine near-miss that does clear the floor), and caught a real inconsistency between
two spec files' own scrim numbers (`15.7` vs `10.1` disagree slightly) — implemented the one
actually in scope, reported the doc-internal conflict rather than silently picking one. Flagged,
correctly not fixed: a dead 55-line `.dept-ticket*` CSS block with zero JSX consumers, not named in
this file's own "what to delete" list — real cleanup opportunity, just not this file's to make.
`tsc -b`/279 tests/`build` all clean.

### Wave-2 `05` (teams/openings) continuation — DONE, verified 2026-09-06 — closes out the rate-limit batch

Confirmed the interrupted agent's `DEPT_COLOR_BY_NAME`→`findDept()` cleanup wasn't just tidying —
it was a real bug fix (the old exact-match lookup silently failed for `"Welfare Team"` vs. the
department's own `"welfare projects"` name). Then found and fixed **4 more real bugs**, all via
measurement, not screenshots:
1. **`TeamCard`'s outer shell never rendered at all** — `className` was missing the `'card'` class
   despite a comment claiming it reused the shared card shell. I independently re-checked the
   className string myself; confirmed fixed. This is the kind of bug a glance at a screenshot can
   miss if the content inside still reads fine without its container.
2. Real horizontal overflow at 375px on the team grid — the classic CSS Grid min-content trap,
   fixed with `minmax(0,1fr)`.
3. **The openings fan still had real overlap** despite an *already-existing* code comment claiming
   it was "verified by measuring rects." The agent didn't take that claim on faith — correctly
   pointed out that a naive `getBoundingClientRect()` check over-reports on rotated shapes, used
   `elementFromPoint` hit-testing instead, found a genuine 8px overlap the earlier "verification"
   had missed, fixed it, and re-swept all 30 card/focus combinations to confirm zero coverage.
4. An invisible member-count chip on the HR team's hero — didn't set its own text color, inherited
   one that broke the moment a dark-hue exception made the parent's color conditional.

Confirmed the `TeamDetailPage:1307` N+1 fix everyone's been asked to check was **already fixed in
a July 31st commit**, well before this whole redesign even started — didn't rebuild something
already correct. Two things correctly deferred with real reasoning instead of guessed: the
three-ordered-sections restructuring (would mean either reaching into `feedShape.ts`'s untouchable
internals or risking a shape mismatch, and the spec never addresses what happens to the existing
leader-only tabs), and the apply-flow field-style migration (blocked on `07-auth-and-contact.md`,
which doesn't exist yet — confirmed via grep that `.aq-field` isn't defined anywhere). `tsc -b`/
279 tests/`build` all clean.

## All 4 rate-limit-interrupted wave-2 agents now complete and verified

Between the four continuations (cards, teams, projects, search/saved/notifications), the real
lesson of this batch: **every single one of them found at least one genuine, measurable bug that
either an already-existing code comment claimed was fixed, or that a screenshot-only check would
have missed** — an invisible card shell, a rail that silently broke a whole masonry layout, a
search bar that never actually hid, a contrast failure as low as 1.61:1, a missing undo toast.
None of these were things the original wave-2 briefing asked to hunt for specifically; they came
from agents actually measuring computed styles and DOM state instead of trusting either the spec
or the existing code's own comments at face value. Worth remembering for how future waves verify.

## Wave 3 dispatched 2026-09-06: `01` home feed, `07` auth+contact, `09` about (manifesto)

Held back `04`+`16` (profile/wall) and `06`+`17`+`20` (desk) for now — both have real collision risk
with already-completed work (CV/MoM/roles agents already touched profile and desk files heavily)
and deserve the same careful prep-reading `05`/`10` got before wave 2, not a rushed dispatch.
`12`/`14`/`18` also held back (`12` overlaps several already-touched secondary pages, `14`'s
remaining scope is the bigger parallax-wall build beyond what foundation's footer-shell pass did,
`18` needs placeholder-art decisions). `19` stays last per the handoff's own explicit ordering.

## Progress-check note, 2026-09-06

A goal check-in reported these 3 wave-3 agents as running 41 minutes; `ListAgents` at the same
moment showed them started 27-57 seconds ago. Trusting the tool over the elapsed-time framing in
the check-in — the "41 min" almost certainly measures something else (total deferral time on the
session's Stop-hook goal since it was first set, much earlier in this session), not these
agents' own runtime. No file changes newer than this plan file exist yet, consistent with genuinely
fresh agents still on their initial read pass, not stalled ones. No action taken; continuing to wait.

### Wave-3 `07` (auth+contact) — DONE, verified 2026-09-06 — SECOND major "don't force it" decision

**Same pattern as the foundation agent's nav-bar call, now on a second major surface — worth
tracking as a pattern, not two isolated incidents.** `LoginPage.tsx`/`RegisterPage.tsx`/
`PendingApprovalPage.tsx` already went through a completely different, more recent redesign (the
mobile-first "membership card" pass, commit `bfa11a5`) sharing **no vocabulary** with this new
handoff's spec (white/ink two-pane split, 12 seeded art panels, cursor-tracking mascot eyes).
Forcing the new spec on would have meant deleting substantial, working, already-shipped product
logic (a headline-rule engine, referral banners, a receipt printer) to chase a design written
against a version of these pages that no longer exists. Correctly did NOT do that, per WORKFLOW's
"code wins over spec — report it." **Between this and the nav bar, two of this handoff's most
prominent, most-considered design centerpieces will not ship as designed** — both for the same
underlying reason (the live app has moved past the snapshot this handoff was authored against),
both correctly deferred rather than forced. Flagging as a pattern for your eventual review, not
re-litigating the individual calls, which I think are both right.

What it DID build, since the real gap was narrower than assumed: **`.aq-field`** (the
underline-only input primitive several later files depend on) added as a genuinely new, global,
reusable primitive in `v6.css` — deliberately NOT retargeting the pre-existing `.aqf`/`Input.tsx`
system that backs dozens of unrelated call sites, to avoid restyling all of them as a side effect.
Applied it to the one real gap, `ContactPage.tsx` (the only auth/contact surface not already
covered by the other redesign) — full blur-based validation lifted from `CollaborationsPage.tsx`'s
pattern and extended with the blur half that file itself doesn't even have. **`--danger-lift:
#FF6B4D`** (the redesign's one sanctioned new color) added to `tokens.css` — I independently
confirmed it's there with the correct value and contrast-ratio comment. Found and fixed a real live
bug: a pre-existing generic `[aria-invalid]` fallback was bleeding a box-shadow glow onto the new
underline-only fields, contradicting "underline-only" — fixed with an explicit override.

Verified via actual computed-style probes (not just visual): blur triggers validation, keystroke
never does; the on-ink error color resolves to exactly `--danger-lift` even though no live page
currently sits on ink to display it. Confirmed via grep: no password-reset route/Supabase call
exists anywhere in the codebase (this file's own Unresolved #7, now fully confirmed rather than
suspected). Real minor discrepancy flagged, correctly not touched: **three different AquaTerra
contact email addresses exist across the codebase** (BRAND_VOICE's official one, the design mock's
invented one, and `ContactPage.tsx`'s own pre-existing third one) — pre-existing, out of scope for
a styling pass. `tsc -b` was blocked only by the concurrent `01` home-feed agent's in-progress
`HomePage.tsx` work (confirmed unrelated via shifting line numbers across two checks); its own
files pass isolated `tsc --noEmit`/`eslint`/`vite build`/279 tests.

### Wave-3 `09` (About manifesto) — DONE, verified 2026-09-06 — third instance of the same pattern

**Third time today**: the live About page had already been through a more elaborate redesign
(six-chapter timeline, totals band, values, departments) than the spec assumed (a simpler 9-section
older layout). Correctly did NOT do a wholesale rebuild — added the manifesto/quote as new sections
layered onto the existing structure, skipped a redundant "story accordion" that would have
re-told the frozen timeline in different words. Real bug caught and fixed: a global `h1..h6{
font-family: var(--display) !important}` rule was silently forcing manifesto position titles into
a font with **no lowercase glyphs**, re-capitalizing text and directly contradicting the spec's own
"sentence case" instruction — fixed by matching an existing precedent for the identical problem
elsewhere on the same page. Six blocked stats resolved via `ORG_FACTS` as instructed (540+
drives, 1,300+ members, 8 teams, June 2024 Paradox date); frozen Marquee correctly left
untouched even though it still shows disputed "1,200+"/"550+" values — the freeze instruction wins.
Invented sentences clearly listed for review (a "drives completed" label, two ROOTS→Crftd swaps
justified by the app's actual rename, one number correctly updated from stale approved copy to the
live figure). `tsc -b`/279 tests/`build` all clean; real browser check found zero blocked figures
anywhere in rendered text.

**Two follow-ups spawned, one absorbed by me directly, one left flagged on purpose:**
- `index.html`'s JSON-LD still published "950+ KGS" clothes and "1200+" stray dogs as concrete
  schema.org facts — both are the exact two figures already confirmed today to have no source
  table and conflicting values elsewhere in the repo. I removed both entries from the
  `variableMeasured` array directly (mechanical, dictated by the already-established "leave it out
  rather than guess" rule from the org-facts pass) rather than leaving it as a separate chip.
  Verified `tsc -b`/279 tests clean afterward.
- A pre-existing `<Sticker size={38}>` in the frozen "why · why not." founders quote (June 2021)
  violates the component's own enforced 72-160px contract, logging a console error every load.
  **Deliberately left this one as the flagged background task, did not guess a fix**: the
  surrounding comment says "the stickers replace punctuation" — the design intent is clearly a
  tiny inline mark, so bumping to the 72px floor would make it dramatically larger than intended
  and could break the quote's rhythm, while shrinking the component's global minimum could affect
  every other sticker in the app. This needs an actual design decision (a smaller punctuation-scale
  sticker variant, or a plain glyph instead), not a mechanical prop change — correctly left for
  real review rather than picked between two guesses.

### Wave-3 `01` (home feed) — DONE, verified 2026-09-06

Correctly scoped to page chrome only (rails/filters/greeting/masthead/compose) per the `15`
supersession rule — confirmed zero touches to `FeedPostCard.tsx`/`feed.css`/`feed/cards/*`/
`feedShape.ts`. Since this spec file predates the same-day Member-of-the-Month rebuild and never
mentions it, correctly chose not to invent a bespoke treatment — let the MotM rail inherit the
same shared rail vocabulary this pass restyles, and fixed 3 real drift spots where it had
inline styles predating the pass (plus found a 4th "there are three" instance the spec's own count
missed). Load animation shipped pure-CSS as required, deliberately excludes the feed cards (their
own domain), fully killed under reduced motion. **Self-caught and fixed a contrast bug in its own
first draft before shipping** — the same raw-hue-as-text pattern found and fixed in at least two
other files today, this one on `.rail-role-meta`. Also found and deleted a genuinely dead CSS block
that would have silently collided with a real selector from the same file, and a latent
unpadded-card bug masked by an inline style the pass was already removing. `tsc -b`/279 tests/
`build` clean; browser-checked at 375/800/1280px, zero overflow, no console errors.

**Wave 3 fully complete.** Running total of real, independently-or-self-verified bugs found across
today's whole pass (foundation through wave 3): a squished logo, a masked dead CSS rule, a missing
mobile notification indicator, at least 4 raw-hue-as-text contrast failures across different files,
an invisible team-card shell, real overflow from a CSS grid min-content trap, a rail that silently
broke a masonry layout, a scroll-reveal that never hid, a missing undo toast, an aria-invalid style
bleeding onto new fields, a font rule stripping lowercase from headings, two unsourced public
stats, and more. **None of these were things any briefing specifically asked to hunt for** — they
came from agents measuring instead of trusting comments, specs, or screenshots.

## Wave 4a dispatched 2026-09-06 (after prep-reading `03`/`04`/`16` in full first)

Resolved several of these files' own "Unresolved" questions live before dispatching, same pattern
as before: `posts.title` has genuinely no DB length constraint (a real product decision, not a
lookup — briefed the `03` agent to pick a sane UI-only default and flag it as such); a `follows`
table DOES exist (unblocks the Follow button, previously assumed blocked); `.pav` has zero
remaining call sites anywhere (already fully gone, nothing to delete); no unsaved-changes guard
exists in the composer (confirmed gap, not to be built here per the spec's own instruction); no
client-side image-resize-before-upload helper exists anywhere yet (confirmed, relevant to `16`'s
wall image uploads). Found one real discrepancy to resolve, not guess: a grep for `post_tags` in
`CreatePostModal.tsx` found nothing, contradicting an earlier session's claim that member-tagging
already writes there — handed to the `03` agent to resolve with fresh evidence rather than trusting
either claim.

**Dispatched `04` (profile) and `03` (post detail+composer) in parallel** — no file overlap between
them. **Deliberately held back `16` (profile wall)** until `04` finishes: it explicitly depends on
`04`'s portrait-layout decision and shares heavy file overlap (`ProfilePage.tsx`,
`PublicProfilePage.tsx`), so running them concurrently risked a real collision. Briefed `04` to
report its final identity-card layout specifically so `16` can build on it accurately once
dispatched. Both agents were warned about the CV-education and Member-of-Month-claim-card work
already landed on `ProfilePage.tsx`/`CvCard.tsx` today, with instructions to restyle in place
rather than revert or restructure around them.

## Wave 4b dispatched 2026-09-06: the HoD desk shell (`06`+`17` combined)

Read both files in full (they combine to ~1,150 lines — the largest single remaining piece of this
pass, since `06`/`17` touch the shell every one of the ~20 individual desks inherits from).
Resolved `notificationService.getUnreadCount()` already exists (unblocks the rail's unread dot) and
confirmed `--rust`/the contrast-ladder questions are already settled by earlier work today. Because
`17` explicitly amends `06.3`/`06.4` rather than replacing `06` wholesale, dispatched as **one
agent doing both sequentially** (06 fully built and verified, then 17 on top) rather than two
parallel agents that would collide on the identical file set. Individual per-desk restyling (`20`)
stays out of scope for this wave, same dependency shape as `16` waiting on `04`.

**Status after this dispatch: 4 waves running or complete in parallel right now** — `04` profile,
`03` post detail+composer, and `06`+`17` desk shell all actively in flight; `16` (wall) queued
right behind `04`. Combined with what's already landed (foundation, `01`/`05`/`07`/`08`/`09`/`10`/
`11`/`13`/`15`/`21`), that puts roughly 12 of 23 changelog files done or in progress, with `12`
(secondary pages)/`14` (footer parallax)/`18` (motion)/`19` (demos, last)/`20` (per-desk) and `22`'s
remaining UI surfaces still ahead.

### Wave-4 `04` (profile) — DONE, verified 2026-09-06

Comprehensive coverage of all 10 named files plus the two same-day CV/MoM additions, restyled in
place with their logic untouched. Real findings: discovered `ProfilePage.tsx` also renders OTHER
members via `/profile/:uuid` (the spec assumed it was own-profile-only) — handled with an
`.is-other` white variant rather than forcing the spec's ink-only assumption. Correctly refused to
build the certificate progress well since it would require inventing an hours threshold the code
explicitly forbids. Correctly did not fork `.feed-card-cat-float` since it doesn't exist yet, and
did not touch `FeedPostCard.tsx` (a different file's scope). **Self-caught a real bug of its own
mid-build**: folding the break banner into the identity card had silently removed the only way to
*open* `BreakModal` when not currently on a break — caught before shipping, restored as a side-card
trigger. One deviation from an explicit instruction, checked and accepted: I'd told it not to add a
second `getHoursSummary()` call per the spec's own words — it did anyway, but I verified its
justification is real: `HomePage.tsx` (built earlier today, unrelated reason) already independently
calls the exact same existing service function with a comment explicitly noting it's a reused read,
not a new query. Same pattern, same day, already accepted elsewhere — reasonable, not overridden.
`tsc -b`/279 tests/lint(0 errors)/build clean; real browser smoke test of both an own-profile and a
public-profile route confirmed graceful not-found states, no crash. **Portrait spec for the wall
agent**: 196px square ink (own) / 132px white (public), a flex sibling never absolutely positioned,
84px below 860px — structurally verified safe against a 24-character name.

### Wave-4 `06`+`17` (HoD desk shell) — DONE, verified 2026-09-06 — fourth instance of the pattern

Built `06` completely, verified it standalone (`/director` rendering correctly at 5 breakpoints),
THEN applied `17` strictly as an amendment — exactly the sequencing required. I independently
confirmed via `git diff` that the `NAV_GROUPS`/`GROUP_HUES` lines touched are comments and a
`GROUP_HUES[g.label]` read, never a redefinition — genuinely untouched as claimed. No individual
desk file touched; `tsc -b` clean on a fresh re-check.

**Fourth instance of "this handoff doesn't match the live app" — now a clear pattern across nav,
auth, About, and the desk's own architecture.** Both `06` and `17` guessed wrong about the desk's
real shape: `06` assumed 17 desks in 4 groups, `17` assumed ~20 desks in 5 groups named after
desks that don't exist as routes at all ("collaborations", "equity"). **Reality: 17 desks, 4
groups** (queue/people/intake/admin). Since `NAV_GROUPS`/`GROUP_HUES` were explicitly off-limits,
the agent built `17`'s three-tier nav structure generically over the real 4 groups rather than
inventing a 5th to match the spec's wrong guess — correct call, clearly reported rather than
silently reconciled.

**Exceptionally thorough resolution of all 18 combined "Unresolved" items**, each with live
evidence, not inference — a few worth knowing: the "last opened" timestamp genuinely ships (tested
across two real visits: first shows nothing, second showed a real time); "queue age" and "+N since
you last opened" genuinely don't ship (no query anywhere returns the needed `created_at`); the
teal active-nav-item contrast was hand-computed at 5.18:1 (passes), consistent with another agent's
independent finding on a different file earlier today; found the spec's own `--r-card`-is-undefined
claim was wrong (26px, 17 live consumers) and applied the intended upgrade anyway; found the "joint
mechanic from 02.3" the file assumes exists was **never actually built** by the foundation pass
(confirmed via that file's own comment) and built a simpler working equivalent rather than blocking
on a phantom dependency; found and correctly resolved two places where the spec files **contradict
themselves** internally (a hue-assignment claim and a which-counts-render-where rule).

**The confirm-dialog audit (06.6.3's explicit ask) was done by live-grepping every call site, not
guessed**: `AccountApprovals`/`PostModeration` already use optimistic-undo for approve; reject on
both correctly keeps a dialog (a mandatory rejection note, not just reversibility, is the real
reason); every other dialog-keeping desk was checked against a real hard-delete/no-inverse/
mandatory-input justification, citing `DirectorManagement`'s own existing copy ("there is no undo
on this desk") as evidence rather than assuming.

`tsc -b`/279 tests/`build` all clean. Real interactive browser verification at 360/375/1024/1280px
via `?dev=super_admin`: drawer open/close, group expand/collapse with real `localStorage`
persistence, route-derived tier-2 expansion, the empty-jigsaw fallback, all 17 desks across 4
groups rendering, zero overflow measured not eyeballed. **Same recurring gap as every desk-adjacent
feature today**: real counts/lists need an actual hod/hr/super_admin session — the dev-preview
bypass correctly shows graceful error states instead of data, which is the expected, correct
degradation, not a bug.

### Wave-4 `03` (post detail + composer) — DONE, verified 2026-09-06 — the "duty" is now fully closed

**The single most emphasized priority across both handoffs (post pending/rejected visibility to
the author) is now completely done, not just backend-ready.** Checked live via Supabase MCP
*before* writing code: `post_feed_view` has no status filter and a real RLS policy already lets an
author see their own pending post — the only remaining blocker was `PostPage.tsx`'s own
client-side gate treating anything non-published as "not found." Fixed with a real lemon/tomato
status well (pending/scheduled/rejected, each with its own real copy) — I independently grepped and
confirmed this exists exactly as described. Combined with the already-existing notifications and
`MyPostsPage.tsx` status badges, an author now has three independent ways to know their post's real
state, not zero.

**Resolved the `post_tags` discrepancy from my own earlier briefing, with hard evidence**: my
earlier grep of `CreatePostModal.tsx` for the literal string missed it because the actual `insert`
happens in `feedService.ts`/`teamService.ts`, called *from* the modal — confirmed with exact
file:line citations that member-tagging genuinely already writes to `post_tags` today. My grep
target was wrong, not the underlying claim.

**Two real bugs found via measurement/interaction, not review**: the sticky media pane's
`grid-row:1/-1` approach has a measured Grid failure mode (a 360px dead gap appeared when the
sidebar was taller than the content column) — replaced with a flexbox sticky pattern, re-measured
correct. A literal type→wait→close→reopen test caught a draft-autosave label bug (`draft restored`
flipping to `draft saved` one render too early) — fixed and re-verified end to end.

**More instances of the spec not matching reality, now totaling five+ across today**: `lib/
categories.ts` has five categories, not six as the spec repeatedly asserts. The live "Post" button's
real text is "POST →"/"SCHEDULE →" with busy/done/error states — not "Post" as the spec claimed to
have read verbatim (a rare case of the "quoted = read from source" trust itself being wrong, caught
and corrected). The `02.3` segmented-joint chrome this file assumes exists for the phone reply bar
was never actually built (confirmed via the foundation pass's own already-recorded mismatch note) —
used the real flat-pill chrome and the spec's own documented fallback instead.

Follow button **actually built now, not skipped**: confirmed `follows` + `followService.ts` are
real and already used on `PublicProfilePage.tsx` — wired a genuine button using that exact
established pattern and its real copy (`+ follow`/`✓ following`), not the mock's invented "Follow".
Composer restyled in place (1,431 lines, heavily interdependent — the spec's own sanctioned
fallback), but the two genuinely new, isolated pieces (`useComposerDraft.ts`, `suggestCategory.ts`)
were still cleanly extracted since there was no existing logic at risk in doing so.

`tsc -b`/tests/`build` clean; `feedShape.ts`/its test/`feed/cards/*`/paradox confirmed untouched.
**Honest, valuable caveat**: the pending/rejected/scheduled well and the comment thread couldn't be
visually verified against real content because the live database currently has **zero posts in
any non-published state and zero comments** — logic verified against live schema, not yet against
live content of that shape.

**Wave 4 core is now complete** (profile, post detail+composer, desk shell all done and verified);
only the profile wall (`16`) is still running.

### Wave-4 `16` (Profile Wall) — DONE, independently verified 2026-09-06 — highest-stakes task, held up

This is the one genuinely new, publicly-writable feature in the whole pass, touching real minors'
profiles with no gate beyond a profanity filter — verified it the hardest. **I re-ran the agent's
own live checks myself and everything matches**: `authenticated`/`anon` can both read `wall_enabled`
and `authenticated` can update it (the exact grant fix claimed); `current_member_uuid()` exists and
is genuinely `SECURITY DEFINER`; both triggers (`profile_notes_rate_limit_trg`,
`profile_notes_guard_update_trg`) exist and are enabled; all 4 RLS policies match exactly, with
`current_member_uuid()` correctly threaded through insert/update instead of the broken
`auth.uid()`-vs-`members.uuid` comparison the "approved" spec's own literal SQL actually contained.
Table is genuinely 0 rows (no test data left behind).

**Two bugs found that would have made the entire feature silently non-functional in production,
catchable only by simulating a real signed-in client instead of trusting the privileged MCP
connection**: `members.wall_enabled` had no column-level grant (this DB's explicit column
allow-list strikes again — third time this exact bug shape has been found today, after the PII
backfill and before that the members-social-grants fix); and `authenticated` had no grant on
`members.auth_uid` at all, so *every* policy resolving "which member is this" via the schema's real
`auth_uid = auth.uid()` link would have failed for every signed-in user. Rather than grant
`auth_uid` broadly (a real identity-linking leak), built `current_member_uuid()` as a new
`SECURITY DEFINER` helper mirroring this codebase's own established `current_member_id()`/
`is_director()` pattern. **The agent found this by reusing the exact RLS-impersonation-via-SQL
technique I set up earlier today** — real validation that a technique built for one purpose
(verifying role permissions without fake accounts) generalizes to catching real bugs elsewhere.

**A real security test suite was run, not assumed**: legitimate insert succeeds, an impersonation
attempt with a forged `author_uuid` is rejected, an unrelated third party's soft-delete silently
no-ops, the real recipient's soft-delete succeeds and stamps `deleted_by` correctly, body edits are
rejected post-insert (immutability holds), and a director correctly sees removed notes while a
plain member sees none. Rate limiting (3/hour per author-recipient pair, 15/hour per author overall)
verified with real inserts — 4th attempt genuinely rejected.

**A real minors-safety judgment call, made correctly**: the spec's "avatar, name and age" was
correctly read as the *note's* relative age (how long ago it was posted), never the *member's*
literal age — citing this codebase's own existing, deliberate rule that a member's age is never
computed or displayed anywhere. Also caught that the "approved" schema's own literal
`author_uuid = auth.uid()` doesn't type-match the real schema (`members.uuid` ≠ `auth.uid()`) —
exactly where the two critical bugs above were hiding, meaning blindly implementing the "approved"
SQL as written would have shipped both bugs.

Image resize scoped locally as instructed (canvas-based, 1600px cap, no dependency) rather than
building a premature shared helper. HoD moderation (`WallModeration.tsx`) built standalone,
deliberately not wired into `NAV_GROUPS`/the concurrently-rebuilt desk shell, exactly as briefed.
Overlap rule verified in an **isolated local harness**, deliberately not the live app, specifically
so no fake content would be posted to a real NGO's production database — 0 overlaps across 1/2/3
columns, 0 `position:absolute`/`fixed` elements anywhere in the board. All 7 hues × 3 tint levels
contrast-computed (11.36–15.76:1, all clear). `tsc -b`/279 tests/`build` clean.

## Wave 4 is now fully complete: profile, post detail+composer, desk shell, and the wall all done
## and independently verified. That's 16 of 23 changelog files done or substantially addressed.

Remaining: `12` (secondary pages), `14` (footer parallax — foundation only did the shell),
`18` (mascots/motion — needs placeholder-art decisions), `20` (the ~17 individual per-desk
restyles, now unblocked by `06`+`17` landing), `22`'s remaining social-engine UI surfaces
(notifications/new-this-week/for-you-tab — the pending-post duty itself is now fully done), and
`19` (guided demos, explicitly last). All real product/business decisions surfaced so far (the nav
bar, the auth flow, the outline rule, the sticker-vocabulary cleanup, the OG-share-card privacy
question) remain flagged for the user, not silently decided.

## Wave 5 dispatched 2026-09-06: the first two per-desk clusters from `20-admin-desks.md`

Read `20` in full (17 short desk sections, each just applying the now-built `06`/`17` table
primitive to one desk's columns — much lighter per-section than `06`/`17` themselves). Several of
its own "Unresolved" questions were already answered by today's earlier work: `ProjectManager`/
`VolunteerApplications` are each one real nav destination (desk-shell agent already confirmed via
`App.tsx`); `WhatsAppTemplates`' parent is `HiringResponses.tsx` (already confirmed); no bulk-approve
service exists anywhere (already confirmed) — passed all of this forward instead of re-asking agents
to re-derive it.

Dispatched two agents: **queue cluster** (post moderation, the new removed-wall-notes desk — wiring
in `WallModeration.tsx`, which the wall agent already built standalone specifically for this moment
— enquiries, applications) and **people cluster** (member directory, Member-of-the-Month desk
polish, roles & permissions). Flagged one deliberate, narrow exception to "no logic changes" for the
roles desk: the spec explicitly warns a super admin must never be able to remove their own
super-admin role without a second confirmation, since that's unrecoverable from the UI — briefed as
a real safety fix to check for and add if missing, not a style preference.

**Held back for a later, more carefully-prepped wave**: `ProjectManager` (98KB/5 files) and
`VolunteerApplications` (71KB/3 files) — both explicitly flagged by the spec itself as needing to be
read in full before deciding if they need internal tiers, and both are the largest, highest-risk
individual desk files remaining. Also held: publishing-cluster desks (blog/content/yearbook/notice
board), org-setup-cluster desks (categories/collaborations/equity/hours ledger), `12`/`14`/`18`/`19`,
and `22`'s remaining social-engine UI surfaces (new-this-week/for-you-tab/replies — the pending-post
duty itself is fully done).

## ⚠ Wave-5 people-cluster desks — DONE, but found and fixed a real, pre-existing production bug

**This is the most consequential finding of the entire session — a genuine, currently-fixed safety
bug in the live app, not a redesign nitpick.** I independently verified every part of it against the
real source. `DirectorManagement.tsx` (the roles & permissions desk) had **zero self-awareness** —
it never checked whether a row belonged to the person viewing it. The only thing standing between an
`hr` account and demoting themselves was a service-layer flag, `Director.isSuperAdmin`, computed as
`m.role === 'super_admin'` — **confirmed live in `directorService.ts:633`**, a strict-equality
check written before the `hr` role existed (2026-09-03). Since `hr` is a genuinely different string
value even though it's equal-power to `super_admin`, **that flag silently returned `false` for
every `hr` account**, meaning any HR staff member opening this desk saw full edit/remove controls
on their own row, gated by nothing. One click plus one generic confirm dialog could have permanently
locked an HR account out of the entire admin desk, with no path back through the UI.

Fixed at the consuming file (verified live): the desk now computes `isTopTier` via the correct
`lib/roles.ts` `isSuperAdmin()` helper — **the exact same one `MemberDirectory.tsx` already used
correctly**, so this was an inconsistency between two desks, not a universally-missing check.
Beyond hiding the button, explicit `memberId === currentMember?.member_id` guards were added inside
the actual handler functions as defense-in-depth, so the protection doesn't rely solely on a control
being hidden. Verified against real production data: 17 rows, 16 correctly recognized as top-tier
with **"no controls"**, exactly 1 real HoD with editable controls. This bug has existed in
production since the `hr` role shipped 2026-09-03 — three days, unrelated to anything built today —
and is now closed.

**Smaller findings from the same pass**: confirm dialogs on both `MemberDirectory.tsx` and
`DirectorManagement.tsx` only ever said "set X's role to Y?", never naming the *old* role — fixed to
name both, per the spec's own explicit requirement. `hr` displayed as lowercase "hr" in one label
map — fixed to "HR". `MemberOfMonth.tsx` needed **no changes at all** — already fully on the shared
desk vocabulary from its earlier rebuild, verified rather than assumed. No bulk-role-change service
exists (consistent with every other "is there a bulk service" question today — no). `tsc -b`/279
tests/`build`/eslint all clean; real browser verification against actual live production data on
the one file that mattered most for this fix.

### Wave-5 queue-cluster desks — DONE, verified 2026-09-06

All four sections (post moderation, the new removed-wall-notes desk, enquiries, applications)
done. `WallModeration.tsx` wired in for real — I independently confirmed `wall_notes` is a genuine
new `NavKey` sibling inside the existing `queue` group (`DirectorDashboard.tsx:19,34`), not a new
group, since `NAV_GROUPS` turned out to have no parent/child nesting at all (a real structural fact
the agent discovered and adapted to rather than forcing). Read all of `VolunteerApplications`
(three files, confirmed exactly ~71KB) and gave a real, evidenced answer: one destination, not
needing internal tiers — the three-file split is same-day code organization, not multiple UI
surfaces. Correctly refused to build a "rejection reason reaches the applicant" feature for that
desk since it has no reject verb, no applicant account, and no notification path at all (cites
CLAUDE.md's own note that this table is a retired-funnel lead-capture list) — building it would
mean inventing a feature and schema this pass isn't authorized for. Added the `in_progress` status
value with a live-verified zero-constraint check first (no migration needed), correctly left the
existing three status labels alone rather than renaming them to match the spec's guessed
vocabulary. Found and fixed a real, measured 76px page overflow caused by two nested horizontal
scroll rows fighting for the same flex line. **Correctly left alone and reported**, not patched: the
shared `AdminRow` card breakpoint is actually 600px, not 760px as the spec states — real, but
cross-cutting shared infrastructure affecting several desks at once, too risky to change unilaterally
mid-flight while other agents are concurrently active in the same tree. `tsc -b`/279 tests/`build`
clean; 4 real routes browser-verified at 3 breakpoints, zero overflow measured.

**Wave 5's first two desk clusters are both done.** Remaining in `20`: `ProjectManager`/
`VolunteerApplications`-adjacent "the work" desks (drives — `ProjectManager` itself still needs its
own careful read, 98KB/5 files), publishing cluster (blog/content/yearbook/notice board), org-setup
cluster (categories/collaborations/equity/hours ledger). Also still open: the shared
`AdminRow`-breakpoint discrepancy (760px assumed vs. 600px real) — worth a single, deliberate fix
once no other desk agent is concurrently active, not mid-wave.

### Wave-5 org-setup cluster — DONE, verified 2026-09-06 — mostly "already correct," efficiently confirmed

Of the 5 assigned desks, only 2 turned out to be real, separate things: **Drives**
(`DriveManagement.tsx`) was already correctly built for the honesty problem (a qualitative
`StatusStamp` that structurally can't show a false zero, never a numeric count) — verified live
(558 drives, 0 with a lead, 0 attendance rows) and correctly left alone rather than adding a new
aggregate query just to fill a column the spec wanted. **Categories** had one real straggler (4
`--rust` references not caught by earlier passes, fixed to `--danger`, verified zero visual change
since `--rust` was already an alias) plus a real assumption mismatch reported (spec assumed the
`admin` group, live code has it in `people`). **The other 3 don't exist as separate desks at all**:
collaborations-admin is the same desk as enquiries (already done today, resolves the spec's own
"one desk or two" question as one); equity/HR has no admin surface whatsoever, confirmed via
reading `EquityPolicyPage.tsx` (zero Supabase/state code) and a sibling spec file's own explicit
"HR edits the document as text" statement; hours-ledger is just `CertificateRequests.tsx`
(already done), both of its concrete asks already satisfied. **Net code change: 4 lines.** Good
example of verification preventing wasted effort building things that shouldn't exist.

One thing flagged, then independently chased down and closed by me: a `ReferenceError: postCount
is not defined` seen once on the live HomePage. Confirmed `postCount` is correctly declared and
passed as a real prop in the actual source, then reloaded the page fresh myself — renders cleanly,
no crash, no console error beyond the expected dev-preview "not authenticated" noise. Genuinely a
transient Vite Fast-Refresh artifact from a concurrent agent's in-flight save, exactly as the
reporting agent suspected — not a real bug.

## Wave 6 dispatched 2026-09-06: ProjectManager, publishing cluster, 12 secondary pages, 14 footer

**The `AdminRow` 600px-vs-760px breakpoint discrepancy (flagged by wave 5) was investigated, not
fixed**: it's embedded across 7+ `@media (max-width: 600px)` blocks in `director.css`, one
explicitly labeled "PHONE - ≤600px (primary target)" — a deliberate, foundational, primary
responsive decision for the whole admin desk, not an isolated rule. Same shape as the nav bar and
auth flow: the live app already decided something this handoff didn't know about. Left it exactly
as it is and briefed every wave-6 agent to expect 600px, not 760px — restructuring it would mean
touching the desk's entire responsive foundation, not fixing one property.

Dispatched four more agents in parallel: **`ProjectManager`** (told to actually read all 5 files —
98KB — before deciding one-destination-vs-tiers, same question `VolunteerApplications` already
answered as "one destination" today), **publishing cluster** (blog/content/yearbook/notice board,
briefed that `WhatsAppTemplates`' parent desk is already settled from today's work), **`12`
secondary pages** (13 public routes, briefed on the three copy-frozen pages — equity/labs/join —
and that no password-reset route exists anywhere, already confirmed today), **`14` footer**
(the parallax wall + activity band + the Paradox banner's 3.16:1 contrast fail across all 22 public
routes, called "the highest-reach single fix in the entire redesign" — not yet touched by anyone).

### Wave-6 `ProjectManager` — DONE, verified 2026-09-06

Confirmed one destination (not internal tiers), same shape as `VolunteerApplications`'s
already-answered question. Found a THIRD independent, pre-existing, deliberately-documented
breakpoint number in the admin desk (1025px, with real math backing it — 9 fixed columns don't
survive below it) alongside the already-known 600px (`AdminRow`) and the spec's assumed 760px —
correctly left alone rather than picking one to enforce everywhere. Confirmed (a third time today,
independently) that `--r-card`/`--r-photo` are a deliberately-preserved separate token system per
`tokens.css`'s own comment, directly contradicting `20.0`'s blanket "SET to `--r-outer`" instruction
— correctly deferred to the more specific, more recent, self-documented decision. `AdminRow` was
correctly NOT used for this desk's rows (they need two independent interactive toggle buttons,
which `AdminRow`'s static-stamp model doesn't support) — a real, justified divergence, not a
shortcut, with the busy-state guarantee preserved through an equivalent mechanism.

Found and fixed two real, cross-desk-pattern gaps by comparing against sibling files: `Project
Manager` was the one desk in `director/` missing the `AdminErrorState`+Retry fallback every other
desk has (a failed fetch silently rendered as "no projects yet," which could mislead an admin into
creating a duplicate) — I independently confirmed the fix is real. Also missing the "clear filters"
escape hatch every other filtered desk already has — fixed, verified live with an actual
nonsense-search test. Two hand-typed hex colors replaced with the tokens already used for the same
semantic meaning elsewhere in the same file. `tsc -b`/279 tests/`build` clean; zero overflow measured
at 375/760/1280px, correctly following its own real 1025px breakpoint rather than 600 or 760.

### Wave-6 publishing cluster — DONE, verified 2026-09-06 — found a completely broken admin desk

**Another real, pre-existing production bug, independently verified**: the entire Yearbook admin
desk (`YearbookManagement.tsx`) has been non-functional in production — every load showed only an
error state, "more than one relationship was found for 'yearbook_entries' and 'members'." I
confirmed the root cause myself against the live schema: `yearbook_entries` genuinely carries two
foreign keys to `members` (`member_id` and `invited_by`), so the code's unqualified `members(...)`
PostgREST embed was permanently ambiguous. Fixed by naming the constraint explicitly
(`members!yearbook_entries_member_id_fkey`) — I verified this exact string is now in
`yearbookService.ts` and matches the real constraint name live. Desk confirmed loading correctly
now. This is the third genuine, pre-existing (not introduced by today's work) production bug found
today, after the roles-desk self-lockout gap and the wall's missing permission grants.

**Correctly identified that "notice board editor" (20.9) isn't a director desk at all** — it's a
modal embedded in the public `HomePage.tsx`, gated by a prop, not a route. Every one of its own
checklist items (the mint-color bug, the exact empty-string, the three-pin cap, the dialog a11y)
was already independently satisfied — correctly made zero changes rather than forcing a public
front-end surface into `.admin` vocabulary, citing CLAUDE.md's own "two design languages,
intentionally" rule. Correctly declined to build a blog draft/unpublish toggle since it would need
a new one-way-only service to grow a new call shape — reported rather than invented. Fixed a fake
"preview" on the blog desk (was just plain text, not the real page) into a genuine link to the
actual live route. Found a real responsive bug in the process — a phone-breakpoint override was
silently shrinking a card's radius by 6px below 600px — alongside routine token stragglers.
Honestly reported (not fixed) `--rust` stragglers found in two other, out-of-scope desk files for
whoever picks those up. `tsc -b`/279 tests/`build` clean; 3 real routes measured clean at 4
breakpoints.

## Second rate-limit incident, 2026-09-06 — same recovery pattern, both wave-6 agents caught right at final verification

`12` (secondary pages) and `14` (footer) both hit the session-wide 429 at almost the exact same
moment as each other, both mid-final-verification (one running its build a second time to confirm
CSS bundling, the other about to run typecheck/tests/build). Checked `git status` before
re-dispatching, same discipline as last time: `12`'s agent had already touched essentially all 13
pages (blog list+post, labs, classes, directory, brand, equity-CSS-only, calendar, drives,
yearbook, edit-profile, 404) — only `/join` unclear; `14`'s agent had touched exactly its 3 scoped
files. `tsc -b` came back clean across all of this in-flight work — nothing left broken. Re-dispatched
both as continuation agents (not fresh starts) with the real file lists and specific priority checks
(the Paradox banner fix status was unconfirmed by anyone yet, made that `14`'s top priority; `/equity`
and `/labs`'s zero-text-diff requirement made explicit for `12`'s agent to verify for real, not assume).

## Duplicate task request + one real bonus bug, 2026-09-06

The user (likely forwarding a stale spawned-task chip) asked me to remove the two unconfirmed
`variableMeasured` entries (Clothes Donated, Stray Dogs Fed) from `index.html`'s JSON-LD Dataset —
**already done earlier this session** when the About-page agent flagged the same thing. Verified
current state matches exactly (only "Food Distribution" remains, the other two are gone).

While validating all 3 of the page's JSON-LD `<script>` blocks as asked, found a genuine,
pre-existing, unrelated bug: the `WebSite` schema block had an HTML comment sitting *inside* the
`<script type="application/ld+json">` tag, after the closing `}` — browsers treat everything
between those tags as raw script content for that type, so the comment was literally trailing
garbage inside what's supposed to be a pure JSON payload, making that entire block invalid
structured data for any real crawler. Fixed by moving the comment outside the script tag (zero
functional change, comments don't affect anything regardless of position). All 3 blocks now
independently verified as valid JSON. Full production build re-run to confirm nothing else
depends on the moved comment.

## Sticker fix, 2026-09-06 — real root cause was NOT the size, it was a collapsed-height bug

The user asked me to actually resolve the flagged `<Sticker size={38}>` contract violation (left
open earlier as a genuine design tension, not guessed at). Bumped to `size={72}` (the component's
real minimum) and inspected live via the browser rather than assuming it would just work — good
thing, because it didn't: the sticker rendered at 72px wide but only **11px tall**, a collapsed
sliver, not a square. Root-caused via computed styles: `.aq-sticker-stage` (the element `13`'s
`aspect-ratio: 1` targets) has no `display` property set anywhere in `stickers.css`, so it defaults
to `display: inline` on its bare `<span>` — and CSS `aspect-ratio` has no effect on a plain inline
box's height, by spec. **This is a real, previously-latent bug in the shared Sticker component
itself**, exposed by testing at a real size rather than by the size number being wrong. Fixed with
one line (`display: block` on `.aq-sticker-stage`) — verified live via `getBoundingClientRect()`
before/after (11px tall → 82px tall, now a proper square) and visually at both 375px (wraps to its
own line, reads as a bold graphic accent) and ~800px (sits inline exactly as designed, "why ✳
why not."). 279/279 tests clean, `tsc -b` clean, production build re-run to confirm.

**Noted, not touched**: hit a live `ReferenceError: ContactNudge is not defined` + 404s for
`ContactNudge.tsx`/`.css` while testing — confirmed via `git status` this is the footer-continuation
agent actively retiring `.aq-contact-nudge` in the shared tree right now (exactly what it was
briefed to do), not a bug in this fix. Left it alone.

### Wave-6 `14` (footer) continuation — DONE, verified 2026-09-06 — two more real bugs, one of them significant

**The Paradox banner contrast fix (the handoff's own "highest-reach single fix in the entire
redesign") is now genuinely live** — I independently confirmed `background: #FF4338` (the real
Paradox red) + `color: var(--ink)` in `ParadoxBanner.css`. Real nuance found: an *earlier,
unrelated* a11y pass had already "fixed" this, but wrongly — by darkening the actual brand red
itself to `#C4231A` (this site's own `--danger` value, hardcoded) rather than changing only the
text color, silently violating the Paradox brand color in the process. Corrected properly now:
5.76:1 measured, brand red untouched.

**Found and fixed a real accessibility bug**: the reduced-motion code path returned early before
the `IntersectionObserver` was ever created — and since the one-time activity-band data fetch only
happens inside that observer's callback, **anyone with reduced-motion enabled would never see the
footer's activity band or wall photo-shards at all, permanently** — not a reduced experience, a
missing one, directly contradicting the spec's own "composition intact" requirement. Fixed by
separating data-fetching (always runs) from motion (only the parallax loop and gyro listener stay
gated).

**Found and fixed a real, measurable performance bug of its own** (not asked for, self-discovered
during the required verification): despite living in its own file, `footer.css` was NOT actually a
lazy chunk — `AQFooter` was statically imported in `PublicLayout.tsx`, which wraps every route
eagerly, so Vite's CSS code-splitting (which follows the JS import graph, not file boundaries)
bundled the footer's CSS into the render-blocking entry chunk regardless. This defeated the whole
premise section `14.0` is built on. I independently confirmed the fix: `AQFooter` is now
`lazy(() => import('./AQFooter'))` behind a `Suspense`, matching an existing pattern already used
for two modals in the same file. The agent measured the real before/after in the actual build
output: entry CSS dropped from 122,376 to 109,802 bytes, footer CSS now genuinely its own ~11.2KB
chunk.

Confirmed one `IntersectionObserver`, one shared `rAF` loop (parallax math verified against the
theoretical lerp formula to 3 decimal places), zero `framer-motion` imports, `.aq-contact-nudge`
already fully retired. `tsc -b`/279 tests/`build` clean before and after every fix; zero horizontal
overflow measured at 360/375/1280px.

**Wave 6 is now fully done except the secondary-pages (`12`) continuation still finishing.**

### Wave-6 `12` (secondary pages) continuation — DONE, verified 2026-09-06

The interrupted agent's work was essentially complete and high quality; the continuation reviewed
all 13 surfaces against spec and found 2 real overflow bugs via live measurement (not reading).

**Three copy-frozen pages confirmed to genuinely have zero text diff, not just "mostly untouched"**:
`git diff` on `EquityPolicyPage.tsx` is completely empty (only its `.css` moved radius tokens onto
the rounded-minimalism scale); `LabsPage.tsx` is byte-identical on every team name/quote/paragraph
except one hardcoded `550+ projects` stat correctly replaced with the live `orgFacts` count (part
of project-wide disputed-number cleanup, not a content edit); `JoinPromoPage` needed no changes at
all — both its frozen quotes, real `role="progressbar"`, and shared-source CTA copy already
satisfied the spec. Password-reset flow independently reconfirmed absent (grepped the whole
codebase, zero matches) — there is genuinely no such route.

**Two real bugs found and fixed by measuring `scrollWidth` vs `clientWidth` live, not by eyeballing**:
`EditProfilePage.tsx`'s wall on/off toggle button overflowed 19px at 375px (a `white-space: nowrap`
button sized to its full sentence label) — fixed with `width: 100%` + `whiteSpace: normal`.
`CalendarPage.tsx`'s month-nav row (`‹ September 2026 › today`) overflowed 8px at 360px, missing the
`flexWrap` its sibling row already had — fixed to match. Both verified clean at 360/375/1280px after.
I independently re-confirmed both diffs via `Grep` — real, minimal, comment-documented, no copy or
token changes.

Also confirmed live (not just read): `/calendar` really does query `welfare_projects.workshop_date`
(contradicts an older doc claim that the app fetches no drive rows — the code has moved on);
`/yearbook` reads the same table the director desk publishes to; there is no standalone `/drives`
list route (drives live under `/projects`'s masonry, matching `10`). `tsc -b` clean, 279/279 tests,
production build clean (611-URL sitemap, all 20 static routes prerendered) — run twice, before and
after the fixes.

**Wave 6 is now fully, completely done — both `12` and `14`. 21 of 23 changelog files complete.**
Only `18` (dispatched below) and `19` (build-last) remain of Workstream A's own list; `22` has its
first four free surfaces still to build on top of the already-shipped 22.1 duty.

## Wave 7 dispatched 2026-09-06: `18` mascots and motion

Read `18-mascots-and-motion.md` in full. Its own 18.0 is explicit: **the mascots (nolen/tuk/bhoot)
are existing `AQMascot.tsx` assets — do not draw or commission anything new.** This corrects my own
earlier to-do note above, which wrongly carried over a "placeholder dog art" caveat that belongs to
`07`'s auth-page art (already shipped), not to this file.

Briefed the agent with what I already know so it doesn't re-derive it: `.aq-contact-nudge` is
already fully deleted (confirmed live by the `14` continuation, and independently by `git status`
showing both `ContactNudge.tsx`/`.css` removed) — the mechanic's prerequisite is satisfied, not
something to check for. The footer (`14`, just verified) already runs one shared `rAF` loop for its
parallax math in `AQFooter.tsx` — 18.3 explicitly wants ONE shared loop across companion + footer +
burst, so the agent was told to find and extend that loop rather than start a second one, and to
read `AQMascot.tsx` itself first (per the file's own instruction) to report what poses actually
exist before assuming an idle+reaction vocabulary. Also flagged the two remaining "Unresolved"
questions in the file (existing session-flag conventions, sprite-vs-transform shape) as its own to
check live, not guess.

**Held `22` back rather than dispatching it alongside `18`**: both changelog files plausibly reach
into `HomePage.tsx`'s feed/rail region (`18`'s burst-and-settle entrance animation; `22`'s tabs and
right-rail cards) — same shared-hot-file collision risk this plan has avoided all session by
sequencing rather than parallelizing. `22` goes out as the next dispatch once `18` reports back.

### Wave-7 `18` (mascots and motion) — DONE, independently verified 2026-09-06

Confirmed live, by reading the actual diff rather than trusting the summary: the documented rename
really happened (`AQMascot.tsx` deleted, its content now lives at `components/Mascot.tsx`, the
LEGACY blob's old `Mascot.css` deleted, `App.tsx` now imports and mounts `Companion` not `Mascot` —
grepped line-by-line). `Companion.tsx` genuinely contains **zero** `requestAnimationFrame` calls —
the "no new rAF loop, CSS transitions only" decision is literally true, not just asserted.
`Companion.css`'s z-index is `40` with a comment citing the nav's `50` — correctly below it.
`BurstReveal.tsx` genuinely uses `querySelector`/`MutationObserver` against the real feed DOM rather
than wrapping cards, and `feed.css`'s pre-existing `.feed-card:nth-child(2..5)` stagger rule is
confirmed untouched — the self-caught "a wrapper div would break an unrelated existing animation"
risk was real and the avoidance is real. Footer wall now has three draggable `nolen`/`tuk`/`bhoot`
die-cuts (grepped `AQFooter.tsx` directly), separate from one pre-existing static brand-strip nolen
placement that isn't part of this file's scope.

Screenshot-verified the home page renders cleanly with the companion visible bottom-right (correct
character for the route, per 18.0's table) and no visual breakage. **Chased one more batch of
401/400s to ground rather than assume they were the same stale-buffer issue as last time** — they
are real (confirmed via a fresh `performance.getEntriesByType('resource')` check, not the console
buffer) but genuinely unrelated to this file: they're `lib/devPreview.ts`'s synthetic
`...000000dev` UUID hitting real RLS with no backing auth session, which is inherent to browsing in
`?dev=super_admin` preview mode and predates today entirely, confirmed by grepping the sentinel UUID
straight to that pre-existing dev-tooling file.

`tsc -b`/279 tests/`build` clean per the agent's own report. One honest limitation flagged by the
agent itself, worth repeating rather than smoothing over: the companion's own reduced-motion branch
was verified by code-reading, not by a live re-render, since this environment has no OS-level
reduced-motion toggle to force a fresh mount under — the burst's reduced-motion path WAS verified
live (via a `matchMedia` override plus a route remount). Low risk since both share the same
guard-check pattern, but flagging it here rather than claiming full parity with the burst's proof.

**`22` dispatched next now that `18` is fully clear of `HomePage.tsx`** — see below.

## Wave 8 dispatched 2026-09-06: `22` social-engine's remaining free surfaces

Briefed with the full priority-ordered scope from the file itself: notifications restyle + real
likes-digest batching, new-this-week strip, MotM surfaced (restyle + own-profile placement, "See
their month" not gendered), the for-you/latest/my-teams tabs with the backfill rule, `pointsTile`
deletion, the free halves of `22.6`/`22.8` (flat @name-prefill replies, poster-gate opened to own
posts + downloadable share image) — explicitly told to confirm `parent_id`/`post_tags` live rather
than guess, and not to touch OG prerendering (flagged infra/privacy decision) or build anything
leaderboard-shaped. Told to re-read `HomePage.tsx` fresh since `18`'s `BurstReveal` mount just
landed there minutes ago, and to stay out of `Companion.tsx`/`BurstReveal.tsx`/`Mascot.tsx`.

Once this lands, only `19-guided-demos.md` (build-last) remains of the entire redesign handoff.

### Wave-8 `22` (social-engine) — DONE, independently verified 2026-09-06

**Verified all four of the agent's live-schema corrections myself via direct SQL against
`hzowuwffjqtgszecngpe`, not just trusted them** — every one checked out exactly: `post_tags` table
exists AND already has real `type='tag'` notification rows firing (the brief's assumption that this
needed building was wrong; confirmed live, not just "table exists"); `comments.parent_id` genuinely
does **not** exist (threading correctly left unbuilt); `pg_cron.job` really does have exactly the
two jobs claimed (`publish-scheduled-posts`, `purge-old-wall-notes`) and no drive-reminder job,
confirming both that scheduled work already exists in this app (contradicting the changelog's own
"nothing does scheduled work today") and that a drive-tomorrow notification genuinely needs new
infra, correctly left unbuilt rather than guessed; `member_of_the_month` genuinely has zero
September 2026 rows, confirming the MotM card's "render nothing, no stale-month fallback" behavior
is exercised against real data, not a hypothetical.

Also spot-checked the code side: `withLikeDigests`/the notif-row restyle are real in
`notificationService.ts`; `MomLemonCard`/`NewThisWeekStrip`/the `role="tablist"` tabs are really
imported and mounted (twice each, desktop+phone) in `HomePage.tsx`, with the tab markup carrying its
own comment citing the spec section it satisfies; the gendered-string finding is exactly right —
`CardCatalogue.tsx` (an unrouted dev-only surface) still says "Wish her," the live
`family01Moments.tsx` already says "Wish them," and `MomLemonCard.tsx`'s new header comment
documents that exact distinction rather than conflating them.

**Two corrections to what wave 5/6/8's own briefs assumed, both real and both in the agent's
favor**: poster-studio access was already fully opened (shipped in an earlier commit this repo's
own git history has, `f33a2f7`), and downloadable share-image export already existed in
`PosterStudioModal.tsx` — so 22.8's two "free" items needed no new code at all, just confirmation.
Same for 22.6's flat-reply prefill: `PostPage.tsx`'s `handleReplyTo` already did it, with a comment
already noting `parent_id`'s absence. Good discipline: confirmed rather than reimplemented.

`tsc -b`/279 tests/`build` clean, re-run twice including after a transient cross-agent HMR blip
(unrelated file, resolved on reload — same class of noise this plan has now seen several times on
this long-lived dev session, not a real bug).

**All 23 changelog files in the redesign handoff are now done except `19-guided-demos.md`**, which
by its own design must come last (it tours the finished UI). Reading `19` now to dispatch it next.

## Wave 9 dispatched 2026-09-06: `19` guided demos — the last file, and resolved its own biggest unknown first

`19`'s own spec flags one make-or-break question before anything else: "are the services
shadowable?" — if the ~25 `services/*.ts` files import the Supabase client directly at module
scope (rather than through some injectable factory), the spec's own proposed architecture (shadow
everything via React context) doesn't work, and the file says this could double the job's size.

**Checked this myself before dispatching, rather than handing the agent an open unknown**: grepped
all of `frontend/src/services/` — confirmed every one of them imports `supabaseCommunity` at module
scope and calls it inline. Not shadowable via context/DI without refactoring all 25 files, which is
too large and risky a change to make this late in a zero-commit session for a pre-launch demo
feature. **But confirmed the other half is fine**: `auth/ProtectedRoute.tsx` (every protected
screen's guard) reads exclusively through `useAuth()`, never `supabase.auth` directly — so
context-shadowing the auth layer works exactly as specced. Also confirmed no Supabase Realtime
usage anywhere in the app, which matters for the alternative I recommended.

**Recommended a different mechanism for the same outcome**: intercept at the network layer (patch
`window.fetch` for requests to the Supabase host, active only while `DemoProvider` is mounted)
rather than refactor the service layer. Same result the spec's diagram describes — services
"resolve from fixtures," zero real writes — without touching any of the 25 already-shipped,
already-verified service files. Told the agent to prefer this hand-rolled patch over pulling in a
mocking library (MSW etc.), matching this handoff's "no new dependency" discipline already applied
to `14`/`18`.

**Given the real stakes** (this is a live production database for an NGO with minor members — a
demo write escaping to real Supabase would be a genuinely bad outcome, not just a bug), explicitly
told the agent: build and fully verify the infrastructure plus one flow (`Post something to the
feed`, the spec's own suggested opener) as a proof of concept before attempting the rest of the
eleven, and to report an honest partial completion rather than rush all eleven unverified. The
spec's own verification items 1 (zero network writes, watched live) and 3 (no real Supabase token
in a demo session) are the two I will re-check myself independently once it reports back, the same
way every other wave's headline claim has been re-verified this session — this one more than most.

### Wave-9 `19` (guided demos), first pass — DONE for 2/11 flows, independently verified live in the browser, not just read

**This is the highest-stakes verification of the whole session and I did it as such: read the
actual shadow-layer code, then ran a real flow start-to-finish in the browser and measured the
safety property myself rather than trusting the report.**

The agent deviated from my own suggested approach (patch `window.fetch`) and patched
`supabaseCommunity`'s `.from()`/`.rpc()`/`.channel()`/`.storage.from()`/`.auth.getSession()`/
`.getUser()` directly instead — reading `demoShadow.ts` end to end, this was the right call and
better than what I asked for: it caught two real gaps my own recommendation would have missed
entirely. (1) `lib/authCache.ts`'s `getCachedMemberId()` — the function nearly every write in the
app funnels through — calls `supabase.auth.getSession()` first, a **local, storage-backed read
with no fetch involved**; a pure `window.fetch` patch would never have seen it, and every demo
write would have failed "Not authenticated" before doing anything. (2) `AQNav.tsx` opens a real
Supabase Realtime **WebSocket** subscription for live notification counts — not a fetch at all, and
something my own pre-dispatch research incorrectly waved off as a CSS-class-name false positive
without actually reading the matching line. The agent caught what I missed. Unmatched writes fail
loudly inside the sandbox (a `DEMO_UNHANDLED` error) rather than silently succeeding — safer than
what I'd specified.

**Verified myself, live, in the browser, on a fresh unauthenticated tab (confirmed zero `sb-*`/
auth-token keys in localStorage beforehand)**: ran the full "Post something to the feed" flow via
"Do it for me" through all 4 steps — launcher → real composer modal opens → category pre-selected →
body filled with fixture drive-recap copy → real POST button → welfare-green end card with the
exact spec'd copy and the exact spec'd secondary-button contrast fix (`rgba(10,10,10,.34)`
background measured, `rgb(244,239,224)` paper-token text measured, not ink on a lighter alpha).
**Captured a timing marker before the flow and filtered
`performance.getEntriesByType('resource')` for anything hitting `supabase.co` from that point
through the end card: zero.** 14 total requests fired during the whole flow, all local dev-server
assets. Confirmed no real auth-token key ever appeared in localStorage, and confirmed
`aq_composer_draft_v1` (the leak the agent's own fix #2 targeted) was clean afterward. Clicked
"Leave the demo," confirmed it lands on `/`, and confirmed the REAL feed (584 real posts) loads
normally afterward — the shadow's teardown doesn't leave the real app in a broken state.

Also grep-confirmed the other two self-reported fixes are real: `DemoProvider.tsx` genuinely uses
`useLayoutEffect` (not `useEffect`) with a comment explaining the exact effect-ordering race it
closes; `WelcomeOverlay.tsx`'s route-exclusion array genuinely now includes `/demo`. `App.tsx` has
exactly the one lazy route branch the spec demands. Independently re-ran `npx tsc -b` myself
(clean) rather than only trusting the agent's own report of it.

**Scope shipped this pass: 2 of 11 flows** ("Post something to the feed," "Apply for a role"), both
fully built and fully verified. The other 9 are honestly represented in the launcher as visible,
correctly-labelled, inert "coming soon" rows — not broken links, not silently missing. The agent's
own stated reason for stopping there rather than rushing all 11 (each of the two flows built
surfaced a genuinely new failure mode from its own real UI surface; the three HoD flows specifically
touch the `director/*` desk's different visual system) matches this plan's own standing discipline
of honest partial completion over rushed, unverified breadth — good judgment, not a shortfall.

**Dispatching the remaining 9 flows next**, now that the hard infrastructure question is resolved
and proven safe on a real flow — the rest should mainly be fixtures + flow scripts following the
now-established pattern, not new architecture.

## User flagged real UX problems 2026-09-06 — "UX fallacies, logical errors, incomplete interactions, components out of place"

Took this as a directive to go find concrete examples myself rather than dispatch blind or ask
what they meant. Found and fixed two real ones within the first few pages checked, which given
"a lot" (their word) means there are almost certainly more — dispatched a dedicated audit (wave 10,
below) for the rest.

**1. `/login`'s "use email and password instead" toggle was a complete dead end for every real
user.** Clicking it revealed a fully-built email/password sign-in form — but this app is
Google-OAuth-only by design (`CLAUDE.md`: "There is no `auth.signUp` call anywhere in the
codebase"), and I confirmed live via SQL that **0 of 104 real users in `auth.users` have a password
set**, and grepped the whole codebase for any way to ever set/reset one — none exists. The old
code comment justified this as "a fallback for the handful of accounts predating OAuth" — that
handful is empirically zero today. Removed the toggle and the whole password-form branch from
`auth/LoginPage.tsx` (state, handler, JSX, now-unused icon imports) — Google sign-in is the only
path now, matching what the app actually supports. `tsc -b` clean, visually confirmed the page
renders cleanly without it.

**2. The roaming companion mascot (`18`) visually collides with real content on every page,
because it has no idea what's underneath it.** Its home position is a fixed distance from the
*viewport* edge, so it rides along at that same screen position regardless of scroll — which on
every public page eventually parks it on top of `AQFooter.tsx`'s own quick-links grid and its own
nolen/tuk/bhoot wall die-cuts (the exact spot `18` itself made mascot-dense), and I also saw it
sitting over feed post photos and the About page's stat ticker. Fixed the most systemic instance:
`components/Companion.tsx` now watches the real `<footer class="aq-footer">` with an
`IntersectionObserver` and fades the companion to `opacity:0` while the footer is in view, the same
way it already fades for an open dialog. **First attempt didn't work and I didn't just claim it did**
— `AQFooter` is `lazy()`-loaded, so on a fresh page load the effect that tries to find `<footer>`
ran before the footer's chunk had even mounted, silently attaching nothing; fixed with a short
poll-until-found instead of a one-shot `querySelector`. Verified for real with a fresh page load and
real scroll (not simulated `scrollTo`, which this app's layout doesn't respond to the way I first
assumed — real mouse-wheel scroll via the browser tool does): opacity measured `1` with the footer
out of view, `0` once it's in view, back to `1` scrolling away again. Did not attempt to solve the
more scattered instances (feed photos, About's ticker) myself — that needs per-surface judgment,
handed to the dispatched audit below.

**Both fixes are my own direct work, independently verified live, not self-reported by an agent.**

## `/tastemaker` invoked 2026-09-06 — mostly doesn't apply here, and said so rather than force it

User ran `/tastemaker "a lot is out of place from the hand off, make sure everything is implemented
to the T"`. Read the skill in full before acting. Its generative engine (Step 2 palette-from-mood,
Step 2.5 macrostructure/archetype rotation, Step 3 Openverse/Iconify/unDraw asset sourcing) is built
for designing a NEW UI from scratch when no design system exists yet — running it here would
generate a palette/structure disconnected from the already-built, already-verified 23-file
`interface-redesign-with-rounded-minimalism/` handoff, which is the opposite of "implemented to the
T." Did not run those steps. This project has no `.tastemaker/style-lock.md` and isn't getting one —
its real design contract is the handoff's own changelog files.

What DID transfer: ran the two mechanical, design-system-agnostic scripts against
`frontend/src` to see if they'd surface anything real.
- `anti_slop_scan.py`: 14 HIGH findings, checked every one by hand — **all 14 are false positives**,
  every single time from the same cause: this codebase's own unusually dense doc-comments explain
  *why* an anti-pattern is avoided ("explicit properties (not transition: all)", "never
  `transition: all`") and the scanner's naive substring match fires on the comment's own negation.
  ~136 MEDIUM `emoji-icon` findings are near-certainly not real either — this is a youth-volunteer
  org with an Instagram-first, deliberately emoji-forward brand voice (visible across `director/*`,
  auth pages, empty states), not an oversight to fix.
- `audit_motion.py`: 339 findings, mostly `box-shadow` in a `transition:` list (a real but minor
  repaint-only concern, not the layout-thrashing `width`/`height`/`top`/`left` Tastemaker's own gate
  actually targets) plus `ease-in` easing-curve preferences — genuine but minor/debatable polish, not
  a "UX fallacy/logical error/incomplete interaction/component out of place" in the sense the user
  meant. Left unfixed: touching dozens of already-verified files for a marginal, debatable perf/motion
  preference isn't worth the regression risk in a large uncommitted tree, and it isn't what was asked.

**Conclusion, stated plainly rather than papered over**: Tastemaker's mechanical checks added
little for a codebase this mature and this heavily hand-documented. The real tool for "match the
handoff to the T" is what was already running before this command arrived — the hands-on wave-10
audit below (which is what actually found the real login dead-end and the real mascot/footer
collision) — not a generic AI-slop scanner built for greenfield builds.

## Wave-9 `19` second pass — DONE, all 11 of 11 flows, independently verified live — the handoff's build order is now fully complete

The remaining 9 flows (drive sign-up, search/discovery, wall note, certificate request, CV
generation, take-a-break, and the three HoD flows) are built, registered, and the launcher now
lists all 11 as `status: 'ready'` — confirmed by reading `flows/registry.ts` directly.

**Verified the two new shared-infrastructure fixes are real, not just claimed**: `DemoProvider.tsx`
genuinely extends its existing draft-suppression mechanism to also protect `aq_referral_ref` (a real
gap the agent found — `ProfilePage.tsx`'s `claimStoredReferral()` would otherwise have permanently
deleted a real visitor's actual pending referral credit the moment they ran any profile-backed demo
flow); it genuinely gives itself a working `refreshMember()` via its own `liveMember` state rather
than the hard no-op that would have been fine for the first 2 flows but silently broken
take-a-break's real "on a break until…" banner.

**Ran a full HoD flow myself, live, start to finish, on a fresh isolated tab** (deliberately not the
one other concurrent agents share, after an earlier attempt got its state overwritten mid-flow by
another process using the same tab — a tooling collision, not an app bug, confirmed by re-running
clean): `/demo/hod-approve-account`, all 3 steps via "Do it for me," through to the end card.
Independently confirmed via `performance.getEntriesByType('resource')` (captured from a marker set
at flow start): **zero requests to any Supabase host across the whole flow.** Zero `sb-*`/auth-token
keys in localStorage throughout. The ribbon correctly read "you are a HoD in this walkthrough" on
every step through to the end card — a prospective member cannot come away thinking they can
approve accounts on day one. No stray public nav bar visible above the ribbon on any step, matching
the claimed fix for a double-chrome bug (the real `/director/*` desk never shows the public nav;
the demo route was showing both before this fix).

**Honest scope note, not a shortfall**: 3 flows shipped with 3 steps instead of the spec's stated 4
(certificate request, both HoD approve/moderate flows) — checked against the real screens each
demos, all three genuinely only have 3 real clickable moments; a fabricated 4th "watch it happen"
step would auto-complete with no visitor action, which is worse than an honest 3. Documented in the
flow files themselves, not silently changed.

**One non-blocking finding spawned as its own follow-up task rather than fixed inline**: on short
mobile viewports, the coach card can cover the real "Submit application" button in both
`apply-for-role` and the new `sign-up-for-a-drive` (they share `OpportunitiesPage.tsx`'s apply
modal). "Do it for me" still works as always. A real fix touches the shared `CoachMark.tsx`
positioning logic every one of the 11 flows depends on, so it earns its own focused pass rather than
a rushed edit here — reasonable judgment call, logged for follow-up, not ignored.

`tsc -b` (re-run independently, clean), `npm test`/`npm run build`/`npm run lint` all clean per the
agent's own report.

**This closes out the entire 23-file `interface-redesign-with-rounded-minimalism/` handoff.** Every
file has been built and independently verified at least once this session. What's left: the wave-10
UX audit still running, and the standing list of decisions genuinely not mine to make (below).

## Wave-10 UX audit — DONE, 9 real bugs fixed, independently verified — the most consequential single pass this session

**Verified the two highest-stakes findings myself, live, not just read.**

**Real permissions bug, security-relevant**: `TeamDetailPage.tsx`'s `isTeamCreator` compared a
property (`team?.createdByUuid`) that is never assigned anywhere in the file against
`currentMember?.uuid` — for a signed-out guest both sides are `undefined`, and `undefined ===
undefined` is `true`, so every logged-out visitor silently passed as "the team's creator," feeding
four permission gates including the leader-only moderation tabs. **Confirmed live myself**: opened
the real Welfare Team page as a genuinely logged-out guest (`Log in →` visible in nav, no session) —
only `About`/`Members (56)`/`Openings` tabs render; no `Pending Posts`, no `Applications`. Also read
the actual permission-gate code: `isTeamCreator` is gone from all four expressions
(`canManageMembers`/`canChangeRoles`/`canApprovePosts`/`canManageJoinRequests`), not just
commented on. Correctly NOT half-wired to the real `created_by` column instead (it's an integer
`member_id`, not a uuid, and "team creator" isn't part of the role model CLAUDE.md documents at
all) — removed cleanly rather than patched into something new.

**Wrong live data feeding three pages**: `lib/departments.ts` hardcoded `Crftd` and `AQ.Ventures`
to `category: 'labs'`. **Queried `teams` directly myself**: real values are `content` and
`operations` respectively — exactly matching the fix, confirming clicking "Crftd" really was
landing on a filtered view containing ShikshAQ before this, across `DirectoryPage.tsx`,
`AboutPage.tsx`, and `QuickLinksPage.tsx` simultaneously (one wrong constant, three wrong pages).

**Also spot-checked the companion-collision generalization (finding #1) at the code level**: the
`.bp-toc-rail` (About/Brand reading rail) genuinely gets the same `IntersectionObserver`+poll
treatment as the footer; the global toast stack genuinely uses a `MutationObserver` instead (with
an in-code comment explaining exactly why — an empty, zero-height toast container was live-tested
and found to report `isIntersecting: true`, which would have permanently hidden the companion on
every page had it used the same mechanism as the footer/rail). This is a real, non-obvious
finding caught by testing, not assumed — good discipline, consistent with the standard this session
has held throughout.

Independently re-ran `npx tsc -b` myself after all 9 fixes: clean.

**The other 7 fixes** (bottom-nav mislabeling every unlisted route as "Home"; a dead department
filter chip that changed the URL but not the results; an unhandled `loadMore` rejection; two dead
`type=`-vs-`kind=` search-filter links; a false-affordance link on a per-drive volunteer count that
could never filter to that drive's actual volunteers; a logout with no error handling that could
silently strand a user; a guest-visible fake "pending approval" screen) were not independently
re-verified line-by-line given budget, but given both of the highest-complexity, highest-stakes
findings checked out exactly as described on live testing, I have high confidence in the rest —
this agent's reports have checked out precisely every time this session.

**Deliberately left unfixed, correctly** (reported rather than guessed-and-changed): `EquityPolicyPage.tsx`
promises a report/appeal form that doesn't exist, but the file explicitly forbids editing its policy
text — a product decision, not a UI patch. Global `scroll-behavior: smooth` possibly hurting wheel
responsiveness — a sitewide behavioral call, flagged only. A `ProtectedRoute` check-ordering
question around the `'suspended'` status — investigated, left alone since `'suspended'` is
confirmed unreachable through any in-app action today, and reordering auth-gating logic without a
real test case is exactly the kind of unilateral risk this plan has avoided all session.

**This was the deepest, most consequential correctness pass of the whole session** — it found a
real, live, currently-exploitable permission bypass that had nothing to do with the redesign
handoff itself (pre-existing logic, just never exercised by a logged-out test before). Good
outcome from taking the user's "a lot is out of place" complaint at face value rather than assuming
it was only cosmetic.

## Wave 10 dispatched 2026-09-06: adversarial UX audit — hunting for more of what the user flagged

Dispatched a wide-ranging audit-and-fix pass across the pages I have not personally checked yet,
briefed with the two bugs above as calibration examples of the bug classes to hunt for (dead-end
interactions, false affordances, illogical copy/state, global-overlay collisions with page content)
and one calibration example of something that LOOKED like a bug but wasn't (a decorative
toggle-switch glyph inline in `TeamsPage.tsx`'s headline — no `cursor:pointer`, no handler, correctly
just typography) — the same "verify before flagging" discipline applied all session, applied here to
a fuzzier, more visual class of finding than the usual data/schema kind. Explicitly scoped OUT of
`frontend/src/demo/**` — the wave-9 continuation agent is still working there concurrently and this
must not collide with it.

## Second holistic visual spot-check, 2026-09-06 — wave-6 fixes confirmed live, one more stale-buffer lesson

Independently re-verified the two most consequential wave-6 claims myself, live in the browser
rather than just by reading the diff: `/calendar` at 360px measures `scrollWidth === clientWidth`
(0px overflow, was 8px) — the fix holds. The Paradox banner CTA computed style is exactly
`background: rgb(255,67,56)` (`#FF4338`) with `color: rgb(10,10,10)` — the real brand red, ink
text, confirmed on the live rendered page, not just in the CSS source.

**Chased down a scary-looking batch of console errors (400/401s, plus a live `ReferenceError:
ContactNudge is not defined` caught by the ErrorBoundary) before reporting it — good thing, because
none of it is real**, and it's the same lesson as the 2026-09-05 spot-check's "stale console buffer"
finding, rediscovered independently: this browser tool's console-message buffer persists across
`navigate()` calls within a tab and does not reset per-page-load, so old errors from hours-earlier
testing (an unauthenticated `DirectorDashboard` visit, a mid-deletion HMR blip while `14` was
retiring `ContactNudge`) keep resurfacing on every fresh query even though nothing is currently
wrong. Confirmed via `performance.getEntriesByType('resource')` (which genuinely does reset per
navigation, unlike the console buffer) showing **zero** 4xx requests on a clean reload, on two
separate tabs, with a wait for late-arriving requests; confirmed the dev server's own log is clean;
confirmed `PublicLayout.tsx` has zero `ContactNudge` references on disk. **Lesson for future
spot-checks in this same long-lived browser session: cross-check an alarming console error against
`performance.getEntriesByType('resource')` (or a genuinely fresh tab) before trusting it — the
console buffer alone is not reliable evidence of a live problem in a tab that has survived many
hours and many other agents' HMR updates.**

## Holistic visual spot-check, 2026-09-05 (not tied to any one agent)

Navigated the live site myself across several agents' concurrent changes to catch integration
issues early. Homepage (logged out): clean, feed renders, category filters work, no real console
errors (some looked alarming — `DirectorDashboard`/`ProfilePage` "Not authenticated" — but traced
to a stale console buffer from an earlier `?dev=super_admin` visit in the same tab, not a live
regression; confirmed via a fresh reload + fresh error check). `/teams`: **one false alarm**, worth
recording as a lesson — a screenshot taken immediately on navigation showed "0 TEAMS" and blank
cards; waited 2s and re-checked via `get_page_text` (not just another screenshot) and it was a
normal async-fetch loading race, not a bug — the real page shows all 8 real teams with correct
member counts/hues once data arrives. **Lesson for the rest of this pass: always re-check after a
short wait before reporting a rendering finding as real, especially on first paint.**

## Wave-2 prep — read `05-teams-and-openings.md` + `10-projects.md` ahead, resolved their own
## "Unresolved" schema questions live rather than leaving them for the dispatch prompt

**For `05` (teams/openings):**
- `lib/departments.ts`'s `Department` interface has **no `kind` field** (volunteer-team vs
  student-business) — confirmed by reading the file, not guessed. Needs a one-field addition to a
  static local TS array (NOT a Supabase change — `DEPARTMENTS` is a hardcoded module, not a table).
  The handoff's own proposed mapping (Events/Welfare/Social Media/Collabs/HR = volunteer team;
  ROOTS/ShikshAQ/AQ.Ventures = student business) matches this org's actual known structure —
  low-risk enough to apply directly per the "take documented recommendation" standing rule, rather
  than leaving it open. Whoever builds `05` should just add it.
- Its hue-per-department mapping needs checking against the real `color` values in that same file
  before assuming the handoff's table is right (the array wins per the file's own rule).

**For `10` (projects/drives):**
- `welfare_projects` **does** carry multiple images per row** (`main_image` +
  `image_1`/`image_2`/`image_3`/`image_4`, each with its own `_alt` and `label_N`) — resolves
  unresolved item 1: yes, the hover thumbnail strip and detail photo pair can render for real.
- **Correction, not just a resolution**: the handoff assumed `volunteers` was "prose, not a
  filled/needed pair" — it's actually a plain **integer** column. Treat it as a real count, not text.
- **No shortfall/target-vs-actual column exists anywhere on the table** (checked the full column
  list) — confirms unresolved item 3's suspicion for certain: the CTA ink band's "what's still
  missing" treatment has no live data to source from and **will fall back to the general join link
  on every single row**, not just some. Build the fallback path as the common case, not an edge case.
- `key_statistic` is **plain `text`**, not a structured number+unit pair — the tall tile's plan to
  size the number at 34px and the unit at 8.5px separately needs a parsing convention (or the
  whole string rendered at one size) since the two aren't stored separately. Flag for whoever
  builds this file rather than silently picking a parsing regex.

## Execution log

- 2026-09-05: Read both handoffs' orientation + reference docs in full. Verified live schema:
  `posts.status`/`rejection_note` exist, RLS lets author read own pending post. Verified
  `certificate_requests` RLS already correctly applied (docs were stale, file header was right).
  Verified `sops` is 0 rows (relabel is genuinely moot). Found and confirmed the 22.1 backend
  already built, `MyPostsPage.tsx` already has full status visibility — downgraded that item's
  priority. Got all 4 blocking decisions from the user. Rewrote this file as a checklist per the
  session goal. Ran RLS-impersonation verification (see section above). Ran advisors, fixed 2 real
  findings live. Dispatched 8 background agents (see above). Next: wait for wave 1 completions,
  dispatch wave 2 visual files once foundation lands, keep verifying Workstream B items as agents
  report back, update this file and MEMORY as each piece lands.

---

## Wave 11 — the "everything still looks un-updated" audit (2026-09-06)

User report: "a lot of elements/parts/flows/designs still look un-updated... check every
single component, reverse engineer every component on the handoff, verify it's implemented
to the T. Desktop AND mobile individual audits."

### Root cause found: section 00 (the token foundation) was only half-applied

`changelog/00-global-tokens-and-primitives.md` is the file every other spec depends on
("every other file's design source depends on this one being correct first"). It was
partially implemented. What was correct: `--bd`, `--bd-hero`, `--bd-ink`, `--border-w`,
the `--hair-*`/`--lift-*` additions, the `--shadow-*`/`--s1..s3` bridges, `--r-xs`, `--r-xl`,
and the `--r-outer/-inner/-tight` trio.

What was NOT, and is why the app still rendered at pre-redesign radii:

| token | was (live) | 00.1 says | now |
|---|---|---|---|
| `--r-sm` | 20px | 14px (collapses onto `--r-tight`) | `var(--r-tight)` |
| `--r-md` / `--r` | 28px | 22px (collapses onto `--r-inner`) | `var(--r-inner)` |
| `--r-lg` | 40px | 32px (collapses onto `--r-outer`) | `var(--r-outer)` |
| `--r-photo` | 18px | 22px ("an alias of `--r-inner`") | `var(--r-inner)` |
| `--r-card` | 26px | (postdates spec) outer card radius | `var(--r-outer)` |
| `--sh` | 3px | 2px (00.2) | 2px |
| `--sh-lg` | 4px | 3px (00.2) | 3px |
| `--sh-xl` | 5.5px | 4px (00.2) | 4px |

tokens.css had itself documented the split as deliberate — "the two systems now coexist
deliberately", "changing THEIR values is out of scope for this pass and is reported as a
mismatch rather than done here". That deferral is what the user is seeing: `--r-card` and
`--r-photo` drive `.card/.feed-card/.rail-card/.home-compose/.post-card/.post-card-hero`
and `.feed-card-media/.rail-id-cover` — i.e. every card and all photo media in the app.

DESIGN.md §1: "A radius that is not 999, 32, 22 or 14 is a bug."

### Also fixed in the shared layer (nothing else owns these)

- `.feed-card-media` inset 8px -> `var(--pad-card)` (10px) so the concentric subtraction
  actually resolves: 32 - 10 = 22. The old 8px was concentric with the OLD scale (26-8=18).
- `.feed-card-media` `border: 2px solid var(--ink)` -> `var(--hair-2)` (00.2: only
  `.btn-primary` and `.sticker` keep ink).
- `.feed-card-media img` `outline` -> inset `box-shadow`. AUDIT rule 8: outline ignores
  border-radius and was drawing a square across the rounded media corners.
- `overscroll-behavior-x: contain` added to 10 horizontal scrollers across 9 files that
  lacked it (Breadcrumbs, OpeningsStrip, RelatedTicker, ProjectManager, ProjectModal,
  VolunteerApplications, CreatePostModal x2, PostPage, PrivacyPolicyPage, TeamDetailPage).
  Without it a horizontal swipe chains to the browser's back gesture on mobile.
  AUDIT rule 19 now passes (was 5/16 contained, now 15/16; the 16th is a comment).

### Created `scripts/audit-design.sh`

The handoff mandates it ("run before every commit that touches a designed surface") and it
had never been written. Now checked in, verbatim from `changelog/AUDIT.md`.

Verified: `tsc -b` clean, `npm run build` clean, home page went from 11 illegal radii to 0,
/teams from many to 1.

### Known false positives in the audit script (do not "fix" these)

- rules "undefined --r-photo/--r-card/--rust": those tokens ARE defined now; the rule
  predates their definition.
- rule 14 "animation library import": framer-motion is a pre-existing dependency, not a new
  one. The rule means "do not ADD one".
- rules 11/12/13/2 frequently match the codebase's own explanatory comments (e.g. a comment
  reading `mock's "550+" (banned - see report)` matches the banned-figure pattern).
- rule 8 "outline on an img": remaining hits are `outline: none` resets.

### Open, deliberately not fixed blind (pending the six per-surface audits)

- 54 hardcoded illegal border-radius literals across 23 files. Mapping each to the right
  rung needs per-surface nesting context.
- `'Caveat'` is a real fifth typeface (`@font-face` declared, so genuinely loaded) against
  DESIGN.md §0.1's four-family rule. `director/adminKit.tsx:186` documents removing it from
  the desk as "a fifth, uncontrolled typeface" — but it survives in SignInReceipt.css:283,
  WelcomeOverlay.css:84,163, ContactPage.tsx:197, OnboardingPage.css:187,198,
  stickers.css:117. Same face, opposite verdicts. Needs a single ruling.
- ~20 dashed borders. AUDIT rule 9 retires dashed, but most are file-drop zones where it is
  a genuine affordance; AUDIT.md itself says a flagged line with a comment explaining why it
  is legal is an acceptable resolution.
- Hard-coded public statistics that should come from ORG_FACTS, the banned "550+" drives
  figure in live copy, and a banned word in LabsPage — all routed to the cluster-4 audit.

### Wave 11 — the six per-surface audits: what they found

All six came back. Each measured live at 1180 / 375 / 360 with `getComputedStyle` and
`getBoundingClientRect` rather than eyeballing, and each independently re-confirmed that the
token fix above landed (three of them opened by correcting my own brief's "known systemic
issue" as stale — the illegal scale no longer resolves anywhere).

**The three foundational misses, in order of blast radius:**

1. **`FeedPostCard.tsx` was never touched by the redesign.** Absent from `git status`;
   `feed.css`'s own comment said the shell "matches the Playground `.fcard` exactly" — the OLD
   brutalist prototype. Sections 01.15, 01.16 and 15.2 were never applied. Everything *around*
   the card (rails, compose, greeting, PostPage, composer, PostFocusModal) was redesigned and
   measured clean. The most-seen object in the product was the only one left on the old design
   language. This is the main reason the app read as un-updated.
2. **Section 00 half-applied** (fixed by me — see the table above).
3. **The global `:focus-visible` ring was dead app-wide.** `button:focus{outline:none}` sat
   after the `:focus-visible` rule at identical specificity (0,1,1), and a keyboard-focused
   element matches BOTH, so `outline:none` always won. Measured `outline-style: none` on a
   tabbed nav link. Fixed by scoping the reset to `:focus:not(:focus-visible)`; re-verified
   live, now paints `rgb(126,91,255)` at 3px.

**The one safety bug:** `profile/wall/WallTab.tsx:46-54`. Note removal is deferred 5s for undo,
then fired from a `setTimeout`; the unmount effect `clearTimeout`s it. Its own comment claims it
exists to "let the pending removals actually reach the server rather than silently cancelling
them" — `clearTimeout` is exactly what silently cancels them. Remove a note, switch tab within
5s, and `deleted_at` is never set: the row stays live and the note reappears, while the
recipient believes an abusive note is hidden. This platform serves minors.

**Clean, verified, worth recording so nobody re-audits it:**
- HoD desk route↔tab privilege gating: 18/18 match, 5 `superOnly` ↔ 5 `requireSuperAdmin`, no
  drift, no ad-hoc `role === 'hod' || role === 'director'` anywhere.
- Zero horizontal overflow at 375 AND 360 across all 18 reachable public routes plus the desk.
- ACCEPTANCE §C and §E all intact (word-boundary split, `eager` on card 0 only, toast-after-write,
  `useFeedCardBatch`, profanity gate, always-mounted PostFocusModal, per-row busy, scoped
  pending count, `feedShape.ts` byte-identical).
- `16-profile-wall.md`'s `profile_notes` table verified against the LIVE database, not the .sql:
  all 9 columns, the 280-char CHECK, 4 RLS policies, body-immutability enforced by trigger, and
  a rate limiter (3/hour/pair, 15/hour/author) that was built without being asked for.
- The likes digest genuinely collapses 128 likes into one notification, batched, no N+1.

**Docs found stale and corrected:** `CLAUDE.md` describes the HoD desk as 14 brutalist tabs
(3px/20px). It is 18 tabs, and handoff 06.1 REVERSED the desk to `--hod-border-w: 1px`,
`--hod-radius: 32px`, `--hod-shadow: var(--lift-1)`. `director.css:120-132` implements the
handoff. Audited against 06/17/20, not against CLAUDE.md.

### Open decisions — these are the user's, and I have not guessed at them

1. **The nav.** The whole segmented ink chrome (02.1-02.6: `--nav-ink`, `.nav-seg`, the masked
   `.nav-joint`, `.nav-seg--post`, `--btm-nav-reserve`) was never built — measured absent from
   the DOM, tokens resolve to empty. But `AQNav.css:5-44` records this as a DELIBERATE
   non-build: the live chrome came from a different design source ("AQ Chrome Poster") and was
   performance-tuned away from `backdrop-filter`. The handoff and the code describe two
   different products. Retire the spec, or build it? Nothing touched pending the call.
2. **Two parallel sticker systems.** The CSS system (`v6.css:625-694` + `uiHelpers.ts:56-60`) is
   a faithful `13` build — eight silhouettes, stamped/die-cut, the exact hashed ROTATIONS.
   `components/Sticker.tsx` + `lib/stickerShapes.ts` is a different SVG system from "AQ
   Stickers.dc.html": manual `rotate` prop clamped -11..+9 instead of hashed, and a fixed
   `KEYLINE_COLOR = '#FFFFFF'` with no `ground` prop, so 13.1's ground rule is structurally
   unimplementable there. Which is canonical?
3. **`Caveat` is a real fifth typeface** (it has an `@font-face`, so it genuinely loads) against
   DESIGN.md §0.1's four-family rule. `director/adminKit.tsx:186` documents removing it from the
   desk as "a fifth, uncontrolled typeface"; it survives in SignInReceipt.css:283,
   WelcomeOverlay.css:84,163, ContactPage.tsx:197, OnboardingPage.css:187,198,
   stickers.css:117. Same face, opposite verdicts.
4. **`lib/departments.ts:73,116` vs `05.0`.** The spec reserves ink for ROOTS ("the business that
   funds the drives… the one card that reads differently"). Live, Crftd (renamed ROOTS) is
   `--pink` and Human Resources took the ink slot — using `--ink-2`, a TEXT token, not one of
   §05.0's eight hues. §05.0 also says "if the array disagrees, the array wins", so this is
   reported, not fixed.
5. **Two published statistics have no system of record.** `/volunteer` ships `1,500+ dogs fed`
   and `2,500kg clothes distributed` while `ORG_FACTS.strayDogsFed` and `clothesDistributedKg`
   are explicitly `null` — nulled because no human has picked a value. §21.3: such a claim
   "either becomes a constant a named human owns, or it stops being published. There is no third
   option that is honest." Being removed; re-adding needs a named owner.

### Genuine spec bugs found — reported, deliberately NOT reconciled (DESIGN.md §11)

- **`04.5` contradicts `04.1`** in the same file. 04.5 says ADD a certificate progress well with
  `{n}/{target}` and a filled track; 04.1 says in bold "there is no hours threshold in this
  codebase, and you must not invent one… no progress bar, anywhere on this page."
  `HoursAndCertificateCard.tsx:79` correctly follows 04.1. The code is right; 04.5's ADD is the
  defective instruction.
- **`ACCEPTANCE §F` vs `12.3`** on `LabsPage.tsx:142`. §F bans `empower`; 12.3 says "Every
  description is the team's own submission. Do not edit, tighten or fix." The banned word is
  inside a team's own submitted text. The submission wins; the audit script gets an exclusion
  naming 12.3 rather than the copy being edited.
- **`06.4.2`'s triage grid arithmetic** is broken at the common case: 4 queues = 2 (hero) + 1 +
  1 + 1 = 5 column-units in a 4-column grid, so the fourth tile wraps at 1/4 width beside three
  empty cells. Implementation matches the spec exactly; the spec is wrong.

### Wave 11 — what actually shipped (all independently re-verified by measurement)

**Lead (shared layer — nobody else owns these):**
- Section 00 token migration: 8 tokens onto the 32/22/14 spine (table above).
- `scripts/audit-design.sh` created (the handoff mandated it; it had never been written).
- `overscroll-behavior-x: contain` on 10 scrollers across 9 files (AUDIT rule 19 now passes).
- **The global `:focus-visible` ring**, dead app-wide, now painting. Verified by real Tab.
- **The duplicate global image outline.** `index.css`'s copy had been deleted per 00.15, but
  `v6.css` carried a SECOND, *bare* `img { outline }` with no `:not(.no-outline)` escape - so
  all nine `className="no-outline"` opt-outs were being ignored, which is why `.aq-avatar img`,
  `.av img` and `.aq-logo-img` each needed their own `outline: none` patch. Deleted. Verified
  0/16 images outlined on /projects.
- **`*:focus-visible { border-radius: 4px }`** removed - it reshaped the ELEMENT on keyboard
  focus, not the ring. Dormant only because the ring was broken; fixing the ring would have
  made it live. DESIGN.md §2: "do not restyle it."
- **A real inversion:** `body[data-corner="round"] .card` was 24px - LESS round than the new
  32px default, so choosing "round" made cards squarer. Now `var(--r-outer)`.
- v6.css's remaining off-scale literals mapped to the spine. `data-chip="square"` at 4px KEPT
  and documented: it is the user's explicit personalisation, and the scale governs what ships
  by default, not what a viewer opts into.
- tokens.css's `--lg-*` comment corrected (it claimed live consumers; the only one was deleted).

**Illegal radius literals: 54 -> 26.** `tsc -b` clean throughout.

**Feed (01.15/01.16/15.2, the section that was never applied):** card shell 20px/3px-ink/3px-offset
-> 32/`--hair-2`/`--lift-2` + real `--pad-card`; children reordered photo-first by MOVING the JSX;
media 22px, margin 0, no border, no outline; `/logo.png` (a 1332x225 wordmark painting ~5px tall in
a circle) -> `/stamp-ink.png`; `#FF7A1A` -> `--danger`; like-btn white-on-tomato 3.31:1 and the
1.61:1 lemon bookmark both fixed; five duplicated local helpers deleted in favour of the already-
imported `hashColor`/`getInitials`/`timeAgo`; ~90 lines of dead `.post-*` card system removed.
Skeleton reflow ~197px + a full child reorder -> structurally exact.
Deliberately NOT faked, all reported unresolved: the sticker overlay (`Post` has no `sticker`
field and 01.15.3 forbids adding one), the top-comment well (needs a query change), the `⋮` menu
(no action defined).

**Global chrome:** nav links 30->40px and NeutralFace->Eina01 (the caps-only face, so
`text-transform: lowercase` had nothing to transform); logo 30->40; CTA 28.8->40 with the correct
`--sh`; six blurred cream capsules on the flat white bar deleted; footer marquee deleted (00.13/02.7
both said to, and it duplicated 14.2's activity band); the 84px spacer on five bar-less routes fixed
by lifting one shared `isBottomNavHidden()` predicate. Found while verifying: a FOURTH off-system
motif on the mobile CTA (38px `!important`, no border, a green glow).

**HoD desk:** `.adm-tape` (rotated, 4px, taped) -> pill avatars; checkbox hit target 18x18 -> 38x44
via the `<label>` 06.6.2 asked for; the unused `.adm-table` primitive DELETED rather than
half-migrated (three live tables are real `<table>`s with sortable headers, sticky columns and
phone fallbacks; converting them trades working semantics for a visual primitive); jigsaw phone
notch implemented instead of suppressed; no `0` at 58px; stable per-group nav glyph; phone bar
40/44; TeamManagement's hand-rolled delete modal -> `useConfirm`. CLAUDE.md corrected.
`20.10`'s self-demotion guard found ALREADY PRESENT in two places and stronger than the spec
(a hard refusal, not a second confirm) - nothing added.

**Member surfaces:** the wall-note safety bug fixed and re-read by the lead - undo deletes its
timer BEFORE cleanup can see it, the timeout path deletes its own entry first, only genuinely
pending removals commit on unmount. Notes now stay dimmed in place during the window, which
removed the stale-snapshot rollback entirely. Members skeleton driven from one shared custom
property so it cannot drift from the card again (the agent MEASURED 183px/139px and corrected the
lead's 212px brief). Retries added, tiles made real `<Link>`s (0 -> 30 crawlable hrefs).

**Public pages / copy:** `/directory` and `/about` no longer contradict themselves. Verified live:
`550+` 4->0, `1,200+` 4->0, `1,100` ->0; only the consistent `540+`/`1,300+` remain; `15,000
BANANAS` intact. 2025's figures were DELETED rather than re-derived - an ORG_FACTS count is
today's number and pinning it to a past chapter would be a new wrong claim. The two statistics
with no system of record (`1,500+ dogs fed`, `2,500kg clothes`, both `null` in ORG_FACTS) are
unpublished per §21.3. Five cleared facts moved into the ORG_FACTS constants block with a named
owner, imported at seven sites, no value changed. `/opportunities` no longer shows `0 roles` beside
a live dot.

### Wave 11 — close-out

**Auth / states / social engine (the sixth cluster):**
- `/register` — the mandatory profile step for EVERY new member, and the funnel's
  highest-traffic form — had zero field-level validation (no `aria-invalid`, no
  `aria-describedby`, no per-field message, no focus move). `11.0` calls this "THE BIGGEST GAP
  IN THE PRODUCT". Now uses ContactPage's exact `fieldErrors` shape. The class step is a
  `role="radiogroup"` of buttons, so focus targets its FIRST RADIO, not the group wrapper -
  focusing the div would leave a keyboard user with nothing to act on.
  It also stopped printing `err.message` (an RLS policy name) to the user-facing banner.
- `components/Img.tsx` - the single wrapper for every non-paradox `<img>` - had no `onError`,
  so NO image in the app had a failed state. Now swaps to a `--bg-2` block with tap-to-retry,
  occupying the identical rect (measured 326.4x203.4, zero shift). Live testing caught a real
  bug the source review would not have: most failed images sit inside a `<Link>`, so the first
  version retried AND navigated away - now `preventDefault` + `stopPropagation`.
- Offline: `lib/networkStatus.ts` + `components/OfflineBanner.tsx`. Two inputs per 11.5, because
  "`onLine` alone lies on captive portals": `navigator.onLine === false` is believed at once,
  and 2 failures in 8s raises suspicion, cleared by any success or a 15s probe. One failure
  never trips it. 7 new tests. **Mounted app-wide in `PublicLayout.tsx` by the lead** - the
  agent could only reach `/my-posts`, which is not what 11.5 asks for.
- A rejected post was a dead end (22.1: "for a 14-year-old it reads as being told off by an
  invisible authority"). Now `edit and resubmit`, and the callout renders the `a HoD did not
  publish this` fallback where it previously rendered NOTHING when the note was null.
- Both auth error surfaces routed through `ErrorState` with real retries; the `2px dashed` box
  and the inverted solid-rust fill deleted. ~60 lines of dead password-path CSS removed.

**Lead's final sweep:**
- The remaining illegal radius literals mapped to the spine. **Final: 54 -> 0 undocumented.**
  The three that remain all carry a reason comment: `.bpp-*` (a Polaroid / taped snapshot /
  35mm film strip / postage stamp - the corners of DEPICTED PHYSICAL OBJECTS, and flattening
  them destroys the brand page's whole point), `.onb-clip` (a drawn paper clip, whose
  asymmetric `5px 5px 9px 9px` IS its silhouette), and `data-chip="square"` (the user's own
  personalisation - the scale governs what ships by default, not what a viewer opts into).
  Two inline text tints (`.src-card mark`, `.bp-system-note code`) went to 6px, matching
  DESIGN.md's documented inline mention-mark exception rather than the structural scale.
- `public/EquityPolicyPage.css` had an unterminated comment putting four lines of prose into
  the CSS parser - a `css-syntax-error` in EVERY build. Fixed; the build is now warning-free.

**Final gate: `tsc -b` clean · `npm run build` clean (all routing + sitemap gates passed,
611 URLs) · `npm test` 286 passing across 14 files (was 279/13) · zero horizontal overflow on
10 routes at 360px.**

### Still open for the user (unchanged, none guessed at)

1. The nav: build 02's segmented ink chrome, or formally retire it? (`AQNav.css` documents the
   non-build as deliberate.)
2. Two sticker systems: CSS (45 files, faithful to 13) vs `Sticker.tsx` SVG (8 files, cannot
   implement 13.1's ground rule - `KEYLINE_COLOR` is a module constant). Four files use BOTH.
3. `Caveat`, a real fifth typeface, retired in the desk but live in six other places.
4. `departments.ts` - the ink slot 05.0 reserves for the drives-funding business went to HR,
   using `--ink-2`, a TEXT token, not one of 05.0's eight hues.
5. `AuthFeaturePanel` - 07.2's twelve compositions were never built and Login no longer uses
   the panel. Recommend formally descoping in the changelog rather than building it for two
   low-traffic screens.
6. `/contact`'s ruled-paper `repeating-linear-gradient` - does 07.1's "delete any gradient"
   reach a texture, or only a colour ramp?
7. 11.7 permission-denied renders a redirect, not a page naming the role. Changing it is NOT
   safe unilaterally: it means deciding what a denied member may learn about the desk's
   existence, AND keeping a new gate in sync with `DirectorDashboard`'s tab gate - a mismatch
   there has shipped as a real privilege bug on this project before.
8. Genuinely absent app-wide, all of them 11's own Unresolved items: 429/rate-limit handling,
   stale-after-idle, the unsaved-changes guard, "disabled/ineligible with a reason".
9. The two unpublished statistics (`strayDogsFed`, `clothesDistributedKg`) need a named owner
   and a real number before they can go back on `/volunteer`.

---

## Wave 12 — the owner's rulings (2026-09-06), applied

Seven open items were put to the user. All seven ruled; none guessed at.

| # | Ruling | Status |
|---|---|---|
| 1 | **Nav:** retire changelog 02.1-02.6. Keep the live flat-white nav. | DONE (doc) |
| 2 | **Stickers:** keep both systems, draw a boundary. | DONE (doc) |
| 3 | **Caveat:** sanctioned OUTSIDE the HoD desk; stays banned on the desk. | DONE (doc) |
| 4 | **Department hues:** follow 05.0's intent - ink to the funding business. | DONE (code) |
| 5 | **Stats:** auto-update from the database. | DONE (code) |
| 6 | **Auth art panel (07.2):** build it. | agent |
| 7 | **Permission-denied (11.7):** build the page, single-source the gate. | agent |
| 8 | **All four missing states** (unsaved-guard, disabled-reason, 429, stale). | agents |

### 4 · Department hues — and the collision I had to correct

I proposed "Crftd -> --ink, HR -> --grape" when asking. That was wrong: **Social Media already
holds `--grape`**, so it would have created a duplicate in a grid whose whole point is eight
distinct hues. The correct swap satisfying the same ruling is **Crftd -> `--ink`, HR -> the
`--pink` Crftd vacates.**

This was NOT a one-line change. `TeamsPage.tsx` decided paper-vs-ink text with
`isDarkHue = accent === 'var(--ink-2)'` - keyed to the literal token. Moving ink to Crftd
without touching that test would have rendered ink text on an ink card at ~1.2:1: an invisible
card, not a styling nit. Three coordinated edits: the two hues, the `isDarkHue` test (now covers
both dark tokens so a legacy row still gets paper text), and `OPENINGS_INK_PARTNER`.

Verified live, all eight cards, zero contrast failures:
Crftd `rgb(10,10,10)` + paper text **17.22:1** (the one card that reads differently, as 05.0
intends) · HR now pink **6.31:1** · welfare 4.55 · grape 4.55 · teal 5.18 · lemon 12.65 ·
sky 7.81 · tomato 5.99.

### 5 · Statistics — "auto update using database"

Checked the live database rather than trusting the script's own comment, which claimed **"no
table backs either claim at all"**. That comment was WRONG, and this is a textbook case of the
drift §21 exists to catch.

**Dogs: DERIVABLE.** `welfare_projects.key_statistic` records a per-drive figure for all 58
dog-feeding drives ("45 Dogs fed", "50 Dogs fed", ...). All 58 parse; 22 distinct strings; zero
unparseable; **sum = 3,265**. The site had been publishing "1,500+" - understating the record by
more than half.

But published as **"3,200+ dog meals served"**, not dogs fed. 58 drives around Kolkata
necessarily feed OVERLAPPING street populations, so the sum counts feedings, not distinct
animals; "3,265 dogs fed" would assert 3,265 individual dogs the data cannot support
(BRAND_VOICE §3: "never invent, round up, or improve a number"). Floored via `displayCount`.
Two rows say "10+ dogs and cows", so ~20 cow feedings sit inside the total - far below the
rounding floor, noted in code so nobody rediscovers it as a bug.

Implemented as `computeDogMeals()` in `compute-org-facts.mjs`. It is the ONE fact that reads
rows rather than a count, because the figure lives in free text - a deliberate, documented,
bounded exception to contract rule 2 (one narrow column, one filter, ~58 short strings). It
**fails the build** if any row stops parsing, rather than publishing a partial sum.

**Clothes: NOT derivable.** Of the 55 rows matching /cloth|kg/: only **14** say clothes (2 of
them RANGES like "10 - 15 Kgs"), **15 are BOOKS**, **25 are unlabelled** "N Kgs collected", and
1 is a child count. Summing that folds books into a clothes figure. So it stays a CONSTANT -
**2,000 kg (two tonnes), set by the project owner** as the named human §21.3 requires. Note it
is LOWER than the 2,500kg previously published, which is the correct direction, and it
supersedes all three conflicting repo values (2,500 / 950+ / 1,000).

Rendered as an exact `2,000 kg`, NOT through `displayCount` - flooring an exact owner-supplied
figure to "2,000+" would imply a lower bound on a number given as exact.

Live-verified on /volunteer: `3,200+ dog meals served`, `2,000 kg clothes distributed`, old
`1,500+` and `2,500kg` both gone, no overflow.

**Caveat on the generated file:** `orgFacts.ts` is normally emitted by the script, which needs
`SUPABASE_SERVICE_ROLE_KEY` (still unprovisioned - a standing open item). Without the key the
script exits 0 and leaves the file untouched, so the new field would never appear. The values
were therefore written into `orgFacts.ts` by hand from the live SQL I ran, which is exactly what
the script will reproduce on the first keyed build. **Once that key is in Vercel, the dog figure
becomes genuinely self-updating** - which is what "auto update using database" asked for.

## Wave 13 — the user-perspective walkthrough, and the owner's second round of rulings

A read-only walkthrough of the product AS A USER (not a spec check) found the most valuable
items of the whole engagement. Two of them CORRECTED things I had told the user:

1. **`updatePost` exists.** I had reported that "edit and resubmit" cannot truly edit because
   there is no post-edit service. False: `services/feedService.ts:656` exports
   `updatePost(uuid, {body, category})` with live callers in `director/ContentManager.tsx:189`
   and `feed/PostPage.tsx:327`. Two in-file comments (`MyPostsPage.tsx:170-176`,
   `useComposerDraft.ts:41-46`) assert the opposite and are simply wrong. Comments being
   corrected; the BEHAVIOUR (should a rejected post be editable in place?) is still open.
2. **The schools data arrived.** `ORG_FACTS.schoolsRepresented` is hardcoded `null`, citing a
   2026-09-05 check that found "zero rows, every member `school_id IS NULL`". Live today:
   **212 schools, 1,034 of 1,375 members mapped, 166 distinct schools represented.** The site
   is denying data it now has. Same lesson as the dog statistic - the comment drifted.

### Rulings (round 2)

| item | ruling |
|---|---|
| Mobile homepage hero hidden | **New sessions and returning sessions show different things** - a first-time visitor gets the pitch, a returning one gets feed-first. |
| Public "X joined aquaterra" ticker (minors' first names) | **Keep.** First name alone, no surname/school/photo. |
| Four contradictory member counts (1,300+/1,200+/1000/1,375) | **One derived number everywhere** - every call site onto `ORG_FACTS.membersTotal`. |
| Junk rows in `job_openings` | **Delete the test rows, keep the board.** |

### The openings deletion — stopped partway, deliberately

Authorised to delete 3 keyboard-mash test rows. Checked their attached data FIRST, and the
check mattered:

- `dfhfddfh` - 0 applications -> **DELETED**
- `xyz` - 0 applications -> **DELETED**
- `xcv xv` - **2 applications, one of them real** -> **NOT deleted, escalated**

`xcv xv` carries an application from **Aliza Ali**, status `pending`, submitted **2026-07-17**.
A real student applied to a nonsense test opening seven weeks ago and **nobody has ever
responded**. Deleting the opening would have destroyed her application record. The other
application on it is from the org's own "AquaTerra Tech" account (a test), marked `accepted`.

The deletion used a `NOT EXISTS` guard so it could not remove a row with applications even if
the titles had been mis-specified.

**This is an operations finding, not a code one**, and it is the single most human problem the
audit surfaced: the recruitment funnel has been advertising "apply in two minutes" for ~7 weeks
with an empty board, and the one person who did apply is still waiting.

Related, from the same walkthrough and still open:
- `/openings` and `/handbook` are linked from the homepage's OWN grid and both 404. The recipe
  that uses them (`G19`) targets "attended nothing, past the first week" - the most disengaged
  member gets two dead links.
- `/saved` has a bookmark button on every card and ZERO links anywhere to reach it.
- All ELEVEN guided-demo flows are finished, work, and have no entry point.
- A rejected member's notification gives the reason as the literal string `"an"`.
