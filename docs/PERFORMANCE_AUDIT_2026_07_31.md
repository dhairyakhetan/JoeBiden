# AquaTerra Performance Audit — 2026-07-31

Exhaustive, measurement-based performance audit. Constraint honored throughout: **no
recommendation changes design or functionality** — everything here is load-order,
chunk-graph, query-shape, caching, or asset-encoding work. Two tracks: frontend
(bundle/CSS/render/assets) and data layer (Supabase query patterns). Numbers are from a
fresh production build and the live database this session.

DB-side items already **applied live** today (see `frontend/scripts/*_2026_07_31.sql`):
RLS initplan wraps on the two arcade policies; 21 never-used indexes dropped.

---

## P0 — biggest user-facing wins

### P0-1. Entry JS regressed ~5×: HomePage is eagerly imported on every route
`auth/HomeRoute.tsx:5` statically imports the 1,604-line `HomePage` (plus `HomeIntro`,
`HiStrip`), dragging the entire feed surface — `FeedPostCard` (40 KB), feed/profile/saved
services, `jobOpenings`, 14.6 KB of `samplePosts` demo data — into the critical path of
**every** route including `/login`, `/director/*`, `/paradox`.

- Measured: entry `index-*.js` = **297 KB raw / 80.8 KB gz**; `index.html` also
  modulepreloads `vendor-react` (73.5 gz), `vendor-supabase` (52.8 gz), `vendor-motion`
  (44.4 gz) ⇒ ~251 KB gz eager JS. The prior audit's 39 KB entry (`AUDIT_FINDINGS.md`,
  `JS_ENTRY 39219`) still exists but is now a *secondary* chunk.
- Fix: `const HomePage = lazy(() => import('../public/HomePage'))` in HomeRoute (Suspense
  fallback already exists); same for HiStrip/HomeIntro. Expected: entry → ~15 KB gz, and
  `vendor-motion` likely leaves the preload list (verify no eager component imports
  framer-motion afterward). ~65 KB gz JS + ~5 KB gz CSS off every route. Risk: low —
  one-frame fallback on home only; verify no FOUC as home.css/feed.css move into the lazy
  chunk.

### P0-2. Critical CSS: 191.9 KB raw / 36 KB gz — concrete, FOUC-safe v6.css split plan
The Phase C audit stalled here ("splitting blind risks FOUC"). The safe mechanism already
exists in-repo: move each block into a stylesheet imported by the **only** component that
renders those classes (proven by `routes/projects.css` / `routes/director.css`, which Vite
already emits as lazy CSS). Sectioning of `v6.css` (3,433 lines, 146 KB) by line range:

| Lines | Content | Bytes | Action |
|---|---|---|---|
| 1–172 | @font-face + token bridges | 6.4 KB | keep critical |
| 173–529 | fixed nav / filter bar / pills | 13.8 KB | keep (shell) |
| 530–766 | footer + marquee + apply sticker | 9.8 KB | → `footer.css` imported by AQFooter (below-fold; no FOUC risk) |
| 767–1224 | gutters + mobile bottom nav | 16.9 KB | keep (shell) |
| 1225–1656 | toasts/modals/lightbox/upload/settings/deco | 21.2 KB | toasts/confirm stay (~1.5 KB); lightbox/upload/settings/deco → their components |
| 1657–2107 | a11y/polish + skeletons + home-shell | 18.2 KB | polish stays; home-shell + feed-mobile (1884–1938) → `routes/home.css` |
| 2108–2307 | feed-card mobile, FAB, comment sheet | 6.8 KB | → `routes/feed.css` |
| 2308–2483 | mobile glass nav | 5.4 KB | keep (shell) |
| 2484–3050 | junk drawer (type rhythm, blog lead card 2806–2824, Confirm, HoD pulse) | 30.7 KB | mostly keep; blog card → BlogListPage css; audit line-by-line |
| 3051–3145 | Playground tokens | 4.7 KB | keep |
| 3146–3433 | feed rows/cards (.fcard, like button) | 12.5 KB | → `routes/feed.css` |

Moves total ≈ −45 KB source; P0-1 removes home/feed/nav-mobile route CSS from entry for
another ≈ −22 KB ⇒ entry CSS ≈ 125 KB raw / ~24 KB gz. Per-move verification: (1) grep
proves all class consumers import the target sheet; (2) build and confirm bytes moved to
the lazy chunk; (3) browser-check the route for one-frame FOUC; (4) confirm the class
isn't used by nav/footer/layouts (shell stays critical).

### P0-3. User-uploaded images ship at original size — `sized()` only rewrites Framer URLs
`lib/imageUrl.ts:38` returns Supabase-storage URLs untouched, and
`feedService.uploadImages` (:710) uploads the raw `File` (no byte cap — CreatePostModal
caps count at 4, not size). A feed page with 20 image posts can ship 50–100 MB to paint
~500 px cards — the same bug class fixed for Framer images, still open for own storage.
Fix: (a) browser-side downscale/re-encode before upload (~1600 px WebP/JPEG q80) —
free, permanent, also cuts upload time; and/or (b) if the plan includes Supabase Image
Transformations, extend `sized()` to rewrite `/storage/v1/object/public/` →
`/storage/v1/render/image/public/...?width=N`. Visually identical at rendered sizes.

---

## P1 — high impact

- **Per-keystroke searches, no debounce.** `PublicProjectsPage.tsx:342-368` runs a 60-row
  `ilike` scan of `post_feed_view` per keystroke (with a late-response overwrite race);
  reuse the existing `useDebounce` (MembersPage uses 250 ms). Worse:
  `HomePage.tsx:890-905` notice-board edit modal calls the full `feedService.getFeed`
  pipeline (count-exact + likes + documents, 3 round-trips) per keystroke and the server
  query **doesn't even depend on the input** — fetch once on modal open, filter locally.
- **PostPage related-rails N+1.** `PostPage.tsx:938,948` renders up to 8 `FeedPostCard`s
  without `savedInitial`/`linkedOpening`, so each card self-fetches saved-state and
  opening (≈16 extra queries per post view; ~25–30 requests total per view). Fix: wrap
  rails in the existing `useFeedCardBatch` hook, as HomePage/SearchPage already do. Same
  pattern at `TeamDetailPage.tsx:1307` (20 self-fetches) and `SearchPage.tsx:259` (8).
- **TeamDetailPage "did I apply" over-fetch.** `TeamDetailPage.tsx:781-793` pulls
  `select('*')` of **all applications of all openings** (incl. custom_answers JSON) to
  compute a boolean set; one `select('opening_id').eq('applicant_id', me).in(...)` is ~1%
  of the payload.
- **Font preload.** The above-the-fold woff2 faces (NeutralFace Regular/Bold, Eina01
  Regular; ~67 KB) are discovered only after the 36 KB gz CSS parses → late swap/reflow.
  Add 3 `<link rel="preload" as="font">` tags. Don't preload Caveat/JetBrains.
- **Oversized static assets.** `public/icon-512.png` is **464 KB** (should be <30 KB —
  recompress); `public/hero-meadow.jpg` (200 KB) appears unreferenced — confirm and
  delete; paradox evidence JPEGs (3.5 MB + 2.5 MB, route-scoped) would halve at q80;
  check `HiStrip` video `preload` attribute.

## P2 — medium

- **`toggleLike` pre-count round-trip.** `feedService.ts:343-346` issues an exact count
  query before every like just to compute ±1 the caller already knows — pass the current
  count in; saves 1 RTT + a scan per like.
- **`count:'exact'` where unused:** `notificationService.list()` (:70) requests a count it
  never returns then fires a second head-count (drop the first); PostPage rails and
  PendingApprovalPage don't need counts (`PublicProjectsPage`'s `count: page===0` pattern
  is the one to copy).
- **`select('*')` on `post_feed_view`** (`feedService.getPost`, `savedPostsService:143`,
  `teamService:518`, `directorService:179`) — the view inlines body/images/subquery
  counts; `profileService.POST_FEED_COLS` exists for exactly this, reuse it. Same for
  `job_openings` list rails (`lib/jobOpenings.ts` — description + custom_questions JSON
  fetched for strips that render title/status; `TeamDetailPage.fetchOpenings` shows the
  right column list). `VolunteerApplications.tsx:224` has no limit — add one.
- **Auto-pause UPDATE on the read critical path.** `jobOpenings.fetchOpenFresh` runs its
  expiry UPDATE serially before the SELECT (~150 ms on homepage cold load). Partially
  fixed today (leader-only gating + client-side expiry filter applied); the remaining
  step is moving expiry to pg_cron like scheduled posts.
- **`getLifetimeLikes`** (`profileService.ts:188`) sums `like_count` over all of a
  member's posts client-side — a one-line `sum` RPC replaces N view rows.
- **AuthContext re-render blast radius.** Every `onAuthStateChange` (incl. hourly
  `TOKEN_REFRESHED`) re-fetches and produces a new `member` object → whole-tree
  re-render. Bail out on deep-equal rows and memoize the provider value
  (`AuthContext.tsx:209-229`).
- **Logged-in LCP waterfall.** `getSession → fetchMember (→ ensure_member → refetch)`
  gates first render behind 2–3 serial round-trips; hydrate `member` optimistically from
  sessionStorage with revalidation (the SWR pattern already used for the feed). Medium
  care needed (auth correctness), design-neutral.
- **Director landing:** 5 parallel head counts are fine; the scoped-pending count is a
  serial third wave — fold into one `get_dashboard_stats()` RPC when convenient.
- **vendor-zxing (111.9 KB gz)** is referenced by `ParadoxRoot` as well as paradox
  `Admin` — verify it's a dynamic edge, not a static leak to every /paradox visitor.

## Verified healthy (no action)

Route-level code splitting everywhere except HomeRoute; `FeedPostCard` memoized; feed
fetch runs in 2 parallel waves (near-optimal without an RPC); MembersPage debounced +
IntersectionObserver-paginated; one realtime channel app-wide (notif badge, filtered,
cleaned up); `getCachedMemberId`/`jobOpenings.getOpen()` 30 s cache/`swrCache`
sessionStorage SWR all in place; Toast context memoized; prerendered routes don't
double-fetch content; analytics scripts all async.

## Priority order

1. Lazy HomePage in HomeRoute (one-line class of change, −65 KB gz on every route).
2. v6.css split per the table (unblocks the stalled Phase C gate, −~12 KB gz critical).
3. Upload-side image downscale + `sized()` for Supabase storage (dwarfs everything in bytes).
4. Debounce /projects search; fix the notice-modal per-keystroke feed fetch.
5. `useFeedCardBatch` on PostPage/TeamDetail/Search rails; slim the "did I apply" query.
6. Preload 3 fonts; recompress icon-512.png.
7. toggleLike/count/select('*') query-shape cleanups; AuthContext memo + optimistic
   member hydration.
