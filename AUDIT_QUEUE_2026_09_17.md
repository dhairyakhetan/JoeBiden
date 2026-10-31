# Audit remediation queue

Source: `AUDIT_2026_09_17.md` (73 verified findings at `8bc843d`).
Started 2026-09-17. Ordering follows section 6, so no fix breaks a later one.

**Deferred by the user, do not touch:** `service_role` rotation, all `revoke`/`grant`
statements, every migration, the `members_public` view, Supabase CDN image transforms,
`db-max-rows`. 26 findings are blocked on these.

Legend: `[ ]` todo `[x]` done `[~]` done with a deviation `[-]` dropped, reason given

---

## Batch 1: build scripts and the prerender shell

Must land before anything touching query limits or the prerenderer.

- [x] B1 `generate-sitemap.mjs` shrink guard re-stamps the `Generated` comment on a file it
      refused to write, so `verify-sitemap.mjs` freshness gate passes on stale output
- [x] B2 `/directory` dropped from the sitemap: `'/directory'.startsWith('/director')`.
      Fix the matcher on segment boundaries, not by special-casing the one path
- [x] B3 `generate-sitemap.mjs:416` emergency fallback bypasses both the shrink guard and the
      exclusion filter, and re-emits the very `/directory` URL `verify-sitemap` hard-fails on
- [x] B4 Remove the two hardcoded legacy anon JWTs (`generate-sitemap.mjs:66`,
      `prerender-meta.mjs:110`). Clears the way for the key rotation the user will do later
- [x] B5 SEO P1: unprerendered routes serve the homepage canonical and no robots tag.
      **Take option (b) only.** Do NOT drop the canonical from `index.html`:
      `prerender-meta.mjs:355` replaces that exact tag and `replaceOnce` throws if absent,
      which hard-fails the deploy build. Add a shell robots meta AND a `replaceOnce` to strip
      it per prerendered route in the same change
- [x] B6 AQ Labs project list is hardcoded in three places across two scripts  *(deferred to the end: P3 refactor, no user-visible effect)*

### Batch 1 outcome

Also added `scripts/loadEnv.mjs`. Removing the checked-in key exposed that the build's
Node scripts never read `.env` at all - the hardcoded credential had been masking it, so
local builds silently fetched nothing. Native `process.loadEnvFile`, no new dependency,
service-role key stripped on load. Side effect: the Paradox env vars now reach the
generator too, so 4 real `/paradox/events/*` URLs joined the sitemap (they were 0 before).

B5 took three attempts and I caused two defects fixing it, both caught before shipping:
1. `injectHead` used `replace('</head>')`, which matched the head-closing tag written in
   PROSE inside my own new comment, so the canonical landed inside a comment and was inert.
   Now uses `lastIndexOf`, and the comment no longer writes that tag literally.
2. I first injected a homepage canonical into `dist/index.html`. That file is the SPA
   fallback for every unmatched route, so it reproduced the exact P1 being fixed. Removed:
   the fallback now carries NO canonical, so unprerendered routes self-canonicalise.
Verified: 605/605 prerendered files carry exactly one self-referencing canonical, the SPA
fallback carries none, `/equity-policy` keeps `noindex, follow`, and in the browser
`/post/abc` gets `https://www.ngoaquaterra.com/post/abc` from useMeta after hydration.
A shell-level `noindex` default was considered and REJECTED: nothing clears it on
`/paradox/*`, which sets no per-page metadata, so it would have deindexed 15 live URLs.

Sitemap 619 -> 624 URLs. `/directory` present, zero private paths, gate passes, 693 tests green.

## Batch 2: security, code-only

- [x] S1 P1 `hr` lockout: `capabilities.ts:207`, `:219`, `roleCapabilityMatrixService.ts:103`.
      **Narrow fix only.** The drafted fix voids every existing `hr` restriction on
      leader-tier desks, not just the lockout. TypeScript-only, names no RLS policy
- [x] S2 P2 hardcoded test-account email permanently disables account revocation, ships to prod
- [x] S3 P3 vestigial `role === 'super_admin'` in `directorService.getAllDirectors:738`
- [x] S4 P3 `SingleTabGate` blanks the app on an unauthenticated BroadcastChannel message
- [x] S5 P3 `npm start` (`server.cjs`) strips every security header except COOP

### Batch 2 outcome

S1 fixed NARROWLY, as section 6 demanded: only `desk.roles` becomes unrestrictable for the
top tier (`TOP_TIER_NEVER_RESTRICTABLE` in capabilities.ts). Every other `hr` restriction
still works. 4 new tests pin both halves, including "leaves every OTHER capability
restrictable for hr". The matching DB constraint is written but NOT applied:
`scripts/role_capabilities_hr_never_locked_out_2026_09_17.sql`.

S3 went further than the finding asked: the `Director.isSuperAdmin` field had no readers and
existed only to be avoided (a previous fix worked around it rather than removing it), so the
field is gone rather than corrected.

S5 kept `express` a runtime dependency on purpose. Section 6 flagged that moving it to
devDependencies while keeping `npm start` makes a production install crash.

697 tests pass, tsc clean, lint clean.

## Batch 3: efficiency

- [x] E1 P2 `stamp-ink.png` is a 184,572-byte 512x512 PNG rendered at 22 to 34px, on every page
- [x] E2 P2 framer-motion modulepreloaded on every route via six eager importers
- [x] E3 P2 `Companion` polls `elementFromPoint` every 500ms, forcing sync layout twice a tick
- [x] E4 P2 `getFeed` serialises the pinned-block query ahead of the main page query
- [x] E5 P3 five dev-only surfaces compiled into the production build
- [x] E6 P3 `feedService.getCategoryCounts` fetches 5,000 rows, zero callers
- [x] E7 P3 six unreferenced files, one carrying a live `setInterval`
- [x] E8 P3 `express` and `@types/qrcode` in runtime dependencies
- [x] E9 P3 `profileService.getMemberPosts` two serial round trips, full row for one field
- [x] E10 P3 `BirthdayPopup` subscribes to every `posts` INSERT for every session
- [x] E11 P3 four hand-duplicated helpers, one of which pulls framer-motion in eagerly
- [x] E12 P3 no bundle budget, no analyzer, no assertion about what ends up preloaded

### Batch 3 progress

E2 was the big one and took six edges, not the four the audit listed. The eager graph
had to be traced properly (a script walking STATIC imports from main.tsx) because
guessing missed two: `FirstRunController -> ApprovedWelcomeModal` and `AQNav -> ConfettiBurst`.
Cut in order: Toast's `useReducedMotion` -> new shared hook; ConfettiBurst + BirthdayPopup
lazy in App; the `APPROVED_WELCOME_FLAG_KEY` constant extracted to `lib/firstRunFlags.ts`
so FirstRunController can read the flag without importing the modal; both first-run modals
lazy; ConfettiBurst lazy in AQNav; PublicLayout's exit-only page transition removed.
Then BirthdayPopup gated behind `isAuthenticated` so its chunk does not load for guests.

RESULT: `vendor-motion` is no longer modulepreloaded and no longer a static import of the
entry chunk. Eager critical path 800,590 -> 658,448 bytes, **142KB off every page load**.
Verified in the browser: on a logged-out /about, neither popup chunk is fetched.

ONE USER-VISIBLE TRADE, flagged for review: pages no longer fade OUT on navigation
(PublicLayout's 150ms `exit` animation). The CSS `.route-enter` fade IN is untouched.
That single import was the last thing pinning 127KB to every route.

E1: `stamp-ink.png` 184,572 -> 35,485 bytes (81%) at the SAME 512x512, so nothing renders
worse anywhere. It was simply badly encoded: `stamp-white.png` is the same dimensions at
31KB.

E11 partially: the three duplicated `usePrefersReducedMotion` copies are now one shared
hook. The other duplicated helpers (fmtDate x6, timeAgo x4, dataUrlToFile x3) are still open.

### Batch 3 complete (11 of 12; E11 partial)

E3 `Companion`: the 500ms poll is now event-driven (scroll + resize + visibilitychange,
coalesced through rAF) with a 2s safety net for content that appears without scroll, and it
skips entirely while the tab is hidden. Was 2 forced reflows/second forever; now 0 while idle.

E4 `getFeed`: the pinned-block query is started but not awaited, so it overlaps the team
lookups and the main page query instead of sitting in front of them.

E9 `getMemberPosts`: two serial round trips -> one. `post_feed_view` already carries
`author_uuid`, so the uuid->member_id resolve against `members` was unnecessary. Verified
live that both filters return the identical count (567).

E10 `BirthdayPopup`: subscription filtered server-side to `category=eq.content`, which is
what `create_birthday_notice()` always inserts. Every post sitewide used to reach every
signed-in session. Combined with the auth gate from E2, guests now receive nothing.

E12: new `scripts/check-bundle-budget.mjs`, wired into the build. Asserts the eager path
stays under 700KB AND that no denylisted chunk (vendor-motion, vendor-zxing, vendor-barcode)
is eager. **Both failure branches were tested by deliberately breaking them**, because a
gate nobody has seen fail is not a gate. Currently 643.5KB / 683.6KB.

## Batch 4: SEO content and docs

- [x] G1 P2 `/directory`, `/labs`, `/join` each ship two different titles depending on JS
- [x] G2 P2 sub-team pages: no metaConfig entry, no prerender, no sitemap, no crawlable inbound
- [x] G3 P2 zero of 570 prerendered content pages carry Article/BlogPosting/FAQPage/ItemList
- [x] G4 P3 `og:image:width/height/type` listed MANAGED but never set, so useMeta deletes them
- [x] G5 P3 `site.webmanifest` theme_color contradicts `index.html`
- [x] G6 P3 `README_SEO.md` documents a deleted Express backend, links six missing files
- [x] G7 P3 `llms.txt` names the retired ROOTS brand twice, omits six public routes
- [-] G8 P3 BreadcrumbList on 25 routes, visible breadcrumbs on 2

### Batch 4 progress

G1 root cause was not what the finding said. `/directory`, `/labs` and `/join` passed
`useMeta` an INLINE object while `prerender-meta.mjs` reads `metaConfig`, so the two drifted.
Fixed by moving the better copy into `metaConfig` and having all three read it, making one
source of truth rather than patching the strings to match.

G2 PARTIAL. The real gap was worse than "no sitemap entry": the only inbound link to all 25
sub-team pages was a `<button onClick={navigate(...)}>` in the About org chart, so nothing
crawlable pointed at any of them and there was no middle-click or open-in-new-tab either.
Now an `<a href>`, and 25 URLs are in the sitemap (624 -> 649). Still NOT prerendered, so a
non-JS crawler gets the SPA shell. Left open.

G4 was two bugs, not one. `og:image:width/height/type` were MANAGED but never set, so useMeta
DELETED index.html's correct values on every page. And `og:image:secure_url` was not managed
at all, so it survived pointing at the default image on pages whose `og:image` had been
swapped. Now all four are asserted when the default image is in use and removed when it is
not. Verified live on both paths.

G5: the manifest's `#0F6CDA` appeared nowhere else in the entire codebase. Now `#F4EFE0`,
matching `index.html` and `tokens.css --bg`.

G6: `README_SEO.md` linked six files that do not exist and referenced the deleted Express
backend eight times, across 349 lines. Replaced with an accurate map of where SEO actually
lives; every path in the new file was verified to exist.

R6 done early, because the org-chart work surfaced it: the sub-team toggle measured 100x22
live and was the only way to reach those 25 pages. Now 100x44, verified at 390px.

## Batch 5: responsiveness, CSS last and measured

Each of the two high-reach changes goes behind a before-and-after `design-probe` run at 390
and 1280.

- [x] R1 P2 long email truncates with no `title` in the member directory
- [x] R2 P2 role `<select>` is 10px, so iOS Safari zooms the whole desk on tap
- [x] R3 P2 projects archive search field is a 24px hit target on a phone
- [x] R4 P2 reduced-motion catch-all omits `!important` on `transition-duration`
- [x] R5 P2 two modals use `.modal` without the `.modal-head`/`.modal-body` contract
- [x] R6 P2 About page org chart sub-team toggle is a ~21px tap target and the only way to expand
- [x] R7 P3 loading skeleton clips where the row it stands in for scrolls
- [x] R8 P1 **high reach** `.iconbtn`/`.panel-h` are `.admin`-scoped but four non-admin surfaces
      use them. Risk: importing Sept-2026 desk chrome onto neubrutalist member-facing surfaces
- [~] R9 P2 **high reach** the 44px tap floor is a nine-class whitelist, not an element rule

### Batch 5 outcome

R8 (P1) was worse than the finding said and is the "lazy CSS chunk" trap from memory:
`.panel-h`/`.iconbtn` are defined ONLY as `.admin .panel-h` in `styles/routes/director.css`,
which is imported by `director/adminKit.tsx` alone - so on a public route the stylesheet is
not even loaded. Verified live on /opportunities: no rule matching `.admin .iconbtn` exists in
any loaded sheet, and that page's modal close button was a bare browser `<button>`.
Fixed with a NEUTRAL global base in v6.css carrying layout plus the 44px floor in the public
design language. `.admin .iconbtn` is (0,2,0) against the base's (0,1,0), so the desk still
wins and nothing there moves. **Before/after design-probe at 390 and 1280 on /opportunities:
findings byte-identical, no regression introduced.**

R5 turned out to be seven files, not two, and the defect was scrolling rather than padding:
`.admin .modal` becomes a 100dvh flex sheet on phones whose scrolling lives in `.modal-body`,
which none of the seven have - so a tall dialog was cut off with its buttons unreachable.
Fixed in CSS with `:not(:has(> .modal-body))` rather than editing seven components' markup.

R9 PARTIAL, and deliberately so. The audit said the 44px floor is a nine-class whitelist. The
real defect was narrower and specific: `.aq-nav-actions .btn-primary` is (0,2,0) and beat the
whitelist inside its own media query. But on tracing it, a later block sets
`min-height: 40px !important` with the comment "40px, not 38: matches the desktop CTA and the
nav links, and DESIGN.md §2's floor". That is a documented design decision that clears WCAG
2.5.8 AA. **I added an override, then reverted it**: silently contradicting DESIGN.md to
satisfy a generic rule is the exact failure the regression pass warned about. The reason is
recorded in v6.css where the next reader will find it. Raising it to 44px is a design call
for the owner, not an audit fix.
`.aqwc-btn-ghost` WAS fixed: 40px -> 44px, matching its own sibling `.aqwc-btn`.

### Batch 4 complete, G8 declined

G3: `renderRoute` gained an `opts.jsonLd` array. Blog pages now carry BlogPosting (real
author from the byline, real datePublished, no invented dateModified) and project pages carry
Article. **22/22 and 548/548 verified in the built output**, every block valid JSON, exactly
one BreadcrumbList per file. `dist/index.html` correctly has none: it is the homepage, not a
trail. While doing this I found the breadcrumb injector had the SAME first-`</head>` bug I hit
earlier, and routed it through `injectHead` (which uses `lastIndexOf`).

B6: the seven AQ Labs projects were written out by hand in three places. The two build scripts
now share `scripts/labsCohort.mjs`; the page keeps its richer array because body copy, hues and
photo counts are of no use to a build script. `src/public/LabsPage.test.ts` is the join between
them, with 4 tests, and **I proved it fires by deliberately drifting a field**. Added
`labsCohort.d.mts` so `tsc -b` can typecheck the .mjs import.

G8 DECLINED, not done. The finding is that BreadcrumbList schema is emitted on 25 routes while
visible breadcrumbs exist on 2. Resolving it means either adding breadcrumb UI to ~16 pages or
removing schema that is currently correct. Google treats a visible trail as a recommendation,
not a requirement, and the schema accurately describes each page's position either way, so
there is no crawler-facing defect to fix. Adding chrome to 16 pages is a design decision about
what those pages look like, which is the owner's call and not an audit fix. Same reasoning as
the nav CTA under R9.

## Close-out pass, 2026-09-18

The two remaining partials were closed, plus one new finding the simulation surfaced.

**G2 now complete.** Sub-team pages are prerendered: 25 files under `dist/teams/<uuid>/sub/`,
each with its own title, self-referencing canonical, h1, crawlable body and BreadcrumbList.
Doing it exposed that the page's runtime title used an em dash while nothing else on the site
does, so `SubTeamDetailPage.tsx` and `prerender-meta.mjs` were changed together to a middot.
Verified byte-identical: prerendered and runtime both read
`Dog Feeding · Welfare Team | AquaTerra`.

**E11 now complete, and the audit's framing was mostly wrong.** Of the 15 supposedly
"hand-duplicated" helpers, only TWO were byte-identical. Deduping the rest would have changed
visible output:
- `timeAgo` x3: `PostFocusModal` returns "5m" with no "ago"; `NotificationsPage` has a weeks
  tier the others lack. Three different formats sharing a name. Left alone, documented.
- `fmtDate` x4: long vs short month, with vs without a time component, and two different
  error fallbacks. Four different formats. Left alone, documented.
- `dataUrlToFile` x3: TWO are byte-identical (PosterStudioModal, ShareModal) and are now one
  shared helper. The third is a genuinely different sync/atob implementation, left alone.
- `readMinutes` x2: consolidated onto the null-safe version, which also removed a latent
  crash - the feed's copy omitted the `|| ''` guard and only the call site's own guard was
  stopping it.

**NEW, found by the simulation, not by the audit:** the three masthead social pills on /links
(WhatsApp, Instagram, LinkedIn) measured 104x35 at 390px. Standalone external links, so WCAG
2.5.8's inline exemption does not cover them. Now 44px. /links went from 6 sub-44px controls
to 3, and all 3 remaining are correctly exempt (the documented 40px nav CTA and two inline
text links).

### Simulation results

- **Static sweep, all 631 prerendered files, 12 checks**: ALL CLEAN. No missing or
  placeholder title/description, no missing/duplicate/wrong-origin/non-self canonical, exactly
  one h1 each, all JSON-LD parses, no empty root div, no unexpected noindex.
- **20 public routes at 390px**: 1 h1 each, correct canonical, NO horizontal scroll anywhere,
  ZERO console errors.
- **12 public routes at 1280px**: ZERO non-tap-target findings. No overflow, contrast,
  content-fill, variety or heading-order issues. ZERO console errors.
- **8 dynamic/edge routes** (project, blog, team, sub-team, labs, missing post, missing member,
  unknown path): all correct. `/member/:uuid` and the 404 page both carry `noindex, follow`.
- **Structured data**: 22/22 blog carry BlogPosting, 548/548 projects carry Article,
  8/8 teams + 25/25 sub-teams + 7/7 labs carry BreadcrumbList.
- **Exposure**: no query in the diff widened. The only two added column lists are build-time
  reads of `sub_teams`, already fully anon-readable.
- **Gates**: tsc 0 errors, eslint 0 errors and 0 new warnings, 701 tests, build clean,
  bundle budget 644.4KB / 683.6KB, sitemap gate passed on 649 URLs, zero private paths.

## 2026-09-18 · org structure + the cumulative SQL

**Cumulative migration written**: `frontend/scripts/AUDIT_CUMULATIVE_2026_09_18.sql`.
One transaction, idempotent, with verification and rollback sections. Covers the three DB
findings that are safe to apply without a code deploy first, plus one additive enabler.
NOT YET APPLIED.

Deliberately excluded and documented in the file: the service_role rotation (a dashboard
action), `db-max-rows` (two findings gave conflicting values), and the `class_grade` revoke.
That last one matters: four anon-reachable queries in the CURRENTLY DEPLOYED build still
select `class_grade`, and PostgREST fails the whole query when one requested column is not
granted, so revoking today would break /classes, /members, /member/:uuid and /schools the
instant it ran. The file ships the aggregate RPC that lets /classes stop reading the column,
and puts the revoke in a clearly-marked do-not-run-yet section with the ordering spelled out.

Every revoke that IS in the file was checked against every anon-reachable query in the
shipped code and appears in none of them, so it is safe to run before or after any deploy.

**Org structure (user request, same day).** Most of it already existed: the About page org
chart (departments + expandable sub-departments, all clickable), `/teams/:uuid` with
description, members-with-roles and tagged posts, and `/teams/:uuid/sub/:slug` with
description, roster and posts tagged to that sub-team specifically.

ONE REAL GAP, now closed: the department page listed none of its own sub-departments, so
having followed the org chart into a department you could not see or reach the sub-teams
underneath it without going back to /about. Added an "inside this department" card to the
About tab, fed by embedding `sub_teams` in the EXISTING `getTeam()` query rather than adding
a round trip. Real `<Link>`s, public neubrutalist styling (not desk chrome), 44px floor.
Verified: Welfare Team shows 6 sub-departments, clicking one lands on
`/teams/.../sub/backend-records` with its own "members" and "posts tagged ..." sections.
No horizontal scroll at 390px, zero probe findings.

## 2026-09-18 · SQL applied, and the wider guardrails sweep

**AUDIT_CUMULATIVE_2026_09_18.sql APPLIED AND VERIFIED LIVE.** All ten members columns now
return 401 to anon (were 200). PII lockdown still holds. All ten load-bearing public columns
still 200. Soft-deleted posts: `Content-Range */0`, was 4 - and published posts went 588 ->
584, exactly those four, nothing else touched. Every anon query the CURRENTLY DEPLOYED build
makes still returns 200, and the live site returns 200 on all seven routes checked. The `hr`
constraint is provable by construction: one transaction, and the function exists.

**NEW, found while verifying (not in the audit): class_grade is a data-quality mess.**
63 distinct values for nine real cohorts. `/register` writes from a fixed 9-option picker but
`/profile/edit` was a free-text `<input>`, and most of the roster arrived via the HR import as
bare numbers. The public /classes page showed Class 11 as FIVE separate cohorts ('11' 278,
'Class 11' 12, 'class 11' 2, 'Grade 11' 1, 'grade eleven' 1).
Fixed display-side in `scripts/class_cohort_normalise_2026_09_18.sql` (NOT YET APPLIED, no
member row rewritten), and the drift closed by giving both surfaces one shared
`lib/classOptions.ts`. `/profile/edit` is now a picker that prepends the member's existing
value when it is not canonical, so nobody is forced to change a correct answer.
OWNER RULING recorded in the SQL: bare 1/2/3 mean College years, not Class 1/2/3.

**react-router 7.13.1 -> 7.18.4.** 12 high advisories cleared. Most were SSR/RSC-only and did
not apply to a static SPA, but two did: open redirect via backslash in `<Link>`/`useNavigate`
(>=6.0.0 <7.18.0) and DoS via inefficient route matching. Verified: tsc clean, 701 tests,
build clean, and 17 routes plus browser-back re-tested in the browser with zero console errors.
The 8 remaining prod-tree advisories are build tooling (vite, postcss, esbuild, nanoid,
picomatch, ws) or express (server.cjs, not on the Vercel path). None reach the browser.

### Guardrails the five-dimension audit never looked at

| Area | State |
|---|---|
| CI | `.github/workflows/smoke.yml` exists but runs only AFTER deploy and notifies nobody. No pre-merge gate: tsc/tests/budget run locally or in the Vercel build. |
| Dependencies | Was 12 high in the prod tree. Now 8, none reaching the browser. Nothing watches this. |
| Observability | `lib/errorTracking.ts` writes to `client_error_logs`. Errors are RECORDED but nothing alerts, so nobody is told. |
| Test coverage | 28 test files against 353 source files (~8%), all pure-function libs. No component or integration tests. |
| Accessibility | Never audited. Basics are present (418 aria-labels, 275 roles, 94 focus-visible rules, a skip link) but zero `prefers-contrast`/`forced-colors`, and no a11y check in the pipeline. |
| Data governance | Privacy policy page exists. No backup, retention or erasure policy anywhere in the repo, for an org holding data on ~1,324 mostly-minor students. |

### class_cohort_normalise v2 — APPLIED AND VERIFIED LIVE 2026-09-18

48 rows -> **14**. Total **1,138**, identical to `count(*)` on the table, so no member was
dropped or double-counted by the regrouping. Zero junk rows: the emoji, the timestamp and the
bare years are now inside `Other`.

    Class 11 337 · Class 12 190 · College 1st Year 159 · Class 10 137 · Class 9 129
    College 2nd Year 59 · College 3rd Year 37 · Class 8 34 · Other 23 · Alumni 16
    Class 7 14 · Class 5 1 · Class 6 1 · College 4th Year 1

Matches the pre-run simulation against real data (14 rows predicted on a 995-row sample).
v1 is marked SUPERSEDED in its own header and kept as the rollback target.

The root cause is closed too: `/profile/edit` was the free-text field feeding the mess and is
now a picker sharing `lib/classOptions.ts` with `/register`, so new bad values cannot be
written. Existing non-canonical values are preserved in the dropdown so no member is forced
to change a correct answer.

### Still outstanding, all requiring the owner

1. **Deploy the code** (65 files). Until then the live site runs the old build.
2. **Rotate the `service_role` key.** Dashboard action. Still the only P0 open.
3. **After the deploy lands**, run section 7 of `AUDIT_CUMULATIVE_2026_09_18.sql` — the
   `class_grade` revoke. Not before: four anon queries in the CURRENT build still select it.

## Dropped, with reasons

- [-] charset/viewport at byte 7199: the audit itself concluded it does not matter, because
      Vercel sends charset in `Content-Type`
- [-] Breakpoint fragmentation (P3, L): ~30 CSS breakpoints and six JS thresholds. Real, but a
      single-source-of-truth refactor is its own project, not an audit follow-up
- [-] React-Compiler eslint backlog (P3, L): 44 warnings, needs per-site judgement
- [-] `calendarService`/`searchService` aggregate RPCs: needs a migration, user deferred
- [-] `swrCache` wider adoption (P3): a judgement call about which surfaces should go stale
