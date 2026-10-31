# AquaTerra — Technical SEO Audit (2026-07)

**Scope:** `frontend/` (the live product). Lab / static-analysis only.
**Method:** production build (`npx vite build`) + source inspection. Every finding
cites a real `file:line`.

> **Field-metric disclaimer.** This audit is 100% static/lab analysis. I **cannot**
> measure real Core Web Vitals field data, search rankings, impressions, crawl
> stats, domain authority, backlinks, or traffic from this environment. Anything
> resembling those numbers below is a byte/size measurement from the build output
> or a structural inference, and is labelled as such. No live-search or
> analytics numbers are invented.

> **Concurrency caveat — READ THIS FIRST.** This report was produced while two
> other agents (A and B) were actively editing `frontend/**`, `vercel.json`,
> `index.html`, and `frontend/scripts/**`. The working tree already shows ~25
> modified files and a new untracked `frontend/public/og-image.png`. Several
> baselines in this report **are already stale**:
> - `src/hooks/useMeta.ts` was a 125-line hook when I first read it; by the time
>   I re-read it, Agent B had already rewritten it to 229 lines with `noIndex`,
>   managed-tag cleanup, `og-image` fallbacks and `toSocialImage()` (current
>   state captured in §4).
> - `frontend/public/og-image.png` **now exists** (untracked), so the long-standing
>   "og:image 404s, points at logo.png" bug in `index.html:159-168` is likely
>   being fixed in the same pass — verify against HEAD before actioning.
> - Structured-data / per-route meta findings (§4) are the area most likely to
>   have moved. Treat §4 as "baseline before B's commit," not current truth.
>
> The one dominant finding (§1, client-side rendering) is architectural and is
> **not** something A or B are changing in this pass.

---

## 1. Crawlability & Indexation — the dominant issue

### 1.1 The app ships an empty HTML shell (critical)

AquaTerra is a pure client-rendered Vite SPA. `vercel.json:9` rewrites
**every** path to `/index.html`:

```
"rewrites": [ { "source": "/(.*)", "destination": "/index.html" } ]
```

and there is no prerender/SSG/SSR step in `frontend/vite.config.ts` or the build
scripts. I ran the real build and inspected the emitted HTML.

**Evidence — the built `dist/index.html` `<body>` is literally:**

```html
<body class="noise">
  <div id="root"></div>
  <script type="module" crossorigin src="/assets/index-BZicTbsd.js"></script>
  ...
</body>
```

There is **zero rendered page content** before JS executes. The `<head>` is
well-populated (see below), but the document body carries no headings, no copy,
no links — nothing until the ~57 KB-gzip entry chunk plus `vendor-react`
(73.5 KB gzip) download, parse, and hydrate.

**What each class of crawler actually gets on a deep route** (e.g.
`/blog/some-post`, `/projects/some-slug`, `/teams/:uuid`):

| Consumer | JS? | What it sees on a deep route |
|---|---|---|
| Googlebot | Yes (2-pass, deferred render queue) | Empty body first pass; correct content only after the render queue processes it (delayed, budget-dependent). Per-route `<title>`/meta/JSON-LD are injected **client-side** by `useMeta`/`useJsonLd`, so they exist only in the rendered DOM, not the initial HTML. |
| GPTBot / OAI-SearchBot / ClaudeBot / PerplexityBot | **No JS** | Empty `<div id="root">` + the **homepage** `<head>` (see 1.2). They get nothing route-specific. `robots.txt:46-63` explicitly *invites* these bots, but they receive no crawlable body content. |
| Facebook / Twitter / LinkedIn / WhatsApp unfurlers | **No JS** | Only the static `index.html` `<head>` — i.e. **every** shared URL unfurls with the homepage OG card, never the article/project's own title+image (until/unless prerendering or edge meta is added). |

This is the single highest-impact SEO issue in the repo and it is structural,
not a tag-level fix.

### 1.2 The static `<head>` is homepage-only

`frontend/index.html:14-122` hard-codes three good JSON-LD blocks
(`Organization`+NGO, `WebSite`+SearchAction, `Dataset`) and `index.html:154-177`
hard-codes homepage `<title>`, description, canonical, OG and Twitter tags. That
is genuinely good for `/` — a non-JS crawler hitting the root gets a rich,
valid head.

But because of §1.1, **every other URL serves this same homepage head verbatim**
in the pre-JS document. `/blog/x` and `/projects/y` all report
`<title>AquaTerra | Student-Led Community & NGO in Kolkata</title>` and
`<link rel="canonical" href="https://www.ngoaquaterra.com">` (the root canonical)
to any non-rendering client. The per-route corrections live entirely in
`useMeta` (`src/hooks/useMeta.ts`) which runs only after hydration.

### 1.3 Soft-404s

The catch-all rewrite means unknown URLs return **HTTP 200** with the shell, then
render `NotFoundPage` client-side. `src/pages/NotFoundPage.tsx:5-7` correctly sets
a client-side `robots: noindex` via `useMeta`, but a non-rendering crawler never
sees it and a rendering crawler sees a 200 soft-404. There is no way to emit a
real 404 status from a static SPA on Vercel without edge/prerender logic.

### 1.4 Remediation options (honest trade-offs for Vercel + Vite + React-Router + client Supabase)

| Option | Effort | Risk | Fixes | Doesn't fix |
|---|---|---|---|---|
| **A. Post-build prerender of public routes** (`vite-plugin-prerender` / `react-snap` / a Puppeteer crawl of the route list in `scripts/generate-sitemap.mjs`) | **M** | Low–Med | Non-JS crawlers + social unfurls + LLM bots get real static HTML per route; per-route title/meta/JSON-LD baked in. Keeps the whole client app as-is. | Content that depends on runtime auth (member feed) — but those are `noindex` anyway. Prerendered snapshots are point-in-time; needs a rebuild to refresh blog/project content (acceptable — sitemap is already build-time). |
| **B. Vercel edge middleware that serves prerendered/meta-injected HTML to bots** | **M–L** | Med | Social + LLM unfurls; can inject correct per-route OG/title. | Doing it *only* for bots risks cloaking-adjacent behavior; doing it for everyone ≈ option A/C anyway. More moving parts than A. |
| **C. Migrate to an SSR/SSG framework (Next/Remix/TanStack Start)** | **L** | High | Everything, permanently, including fresh content. | Huge rewrite; the app talks to Supabase directly from the browser (per `CLAUDE.md`) and has 3 Supabase clients, a Paradox sub-app, 14 lazy director tabs — a framework migration is a multi-week project with real regression risk. |
| **D. Do nothing / rely on Googlebot rendering** | S | — | — | Leaves LLM crawlers (explicitly invited in `robots.txt`) and social unfurls broken, and keeps Google on slow 2-pass rendering. |

**Recommendation: Option A — build-time prerendering of the public, indexable
route set.** Reasoning: it is the lowest-risk change that fixes the actual
problem for *all three* non-rendering consumers (LLM bots, social scrapers,
first-pass Googlebot) without touching the runtime architecture the codebase is
deliberately built around. The public route list is already enumerated for the
sitemap (`scripts/generate-sitemap.mjs:31-57` static + DB-fetched project/blog
slugs), so the crawl target list already exists and can be reused. Auth/member
routes are already `Disallow`-ed (`public/robots.txt`) so they're out of scope
for prerendering. Pair it with a `og-image.png` (already appearing in the tree)
and per-route meta baked into each snapshot. Option C is the "correct" long-term
answer but is not justified by effort/risk right now.

---

## 2. Site Architecture & Internal Linking

### 2.1 Route inventory (from `src/App.tsx`)

**Public + indexable** (in `PublicLayout`, allowed by robots, in sitemap):
`/` (`App.tsx:207`), `/projects` (209), `/projects/:slug` (210),
`/blog` (211), `/blog/:slug` (212), `/support` (213), `/volunteer` (214),
`/links` (217), `/collaborations` (226), `/contact` (227), `/faq` (228),
`/about` (229), `/opportunities` (230), `/opportunities/:id` (231),
`/schools` (232), `/classes` (233), `/roots` (234), `/members` (235),
`/member/:uuid` (236), `/post/:uuid` (237), `/teams` (238), `/teams/:uuid` (239).

**Public but should NOT be indexed** (unlisted; robots-Disallowed; `noindex` set
client-side only): `/welcome` (`App.tsx:256`, Disallowed + noindex via B's hook),
`/brand` (258, `BrandPage.tsx` sets noindex), `/pending` (261), `/rejected` (262).

**Auth-flow:** `/login` (246), `/auth/callback` (247), `/register` (248, gated by
`RegisterGate`).

**Authenticated (member/dashboard):** `/notifications`, `/saved`, `/my-posts`,
`/profile/*`, `/search`, `/settings` (`App.tsx:270-295`) — all robots-Disallowed.

**Director (role-gated):** `/director/*` (`App.tsx:303-323`) — robots-Disallowed.

**Dev-only:** `/dev/components` (`App.tsx:260`, `import.meta.env.DEV` guarded,
tree-shaken from prod).

**Redirects:** `/everything-we-do` → `/projects` (+hash preserved,
`App.tsx:126-129,208`); `/volunteer-handbook` & `/volunteer-handbook/edit` →
`/volunteer` (215-216); `/volunteer/apply` → `/login` (225); `/feed` → `/` (267);
`/arcade/*` → `/` (298).

**Paradox sub-app:** `/paradox/*` (`App.tsx:326`) — own visual system; partially
Disallowed (`/paradox/register|admin|scores|updates|winners`).

### 2.2 `noindex` reachability (ties to §1)

Every "should be noindex" public route (`/welcome`, `/brand`, `/pending`,
`/rejected`, 404) sets `robots noindex` **only client-side** via `useMeta`
(`useMeta.ts:184`) or a manual injector (`ComponentGallery.tsx:40`). A
non-rendering crawler never sees the `noindex`. In practice they're also
`Disallow`-ed in `public/robots.txt`, which is the load-bearing protection —
good. But note: `Disallow` prevents crawling, not necessarily indexing of a
URL that's linked externally; the belt-and-suspenders `noindex` is invisible to
non-JS bots. Prerendering (§1.4) would bake the `noindex` into the static HTML.

### 2.3 Duplicate-content / URL-variant risks

- **Query-param variants are handled correctly.** `useMeta.toCanonical()`
  (`useMeta.ts:104-112`) strips query + hash and forces the canonical origin, so
  `/?category=welfare` (`HomePage.tsx:1262`), `/members?q=&role=`
  (`MembersPage.tsx:47-48`), `/projects?q=` (`PublicProjectsPage.tsx:228`),
  `/opportunities?opening=<id>` (`OpportunitiesPage.tsx:643`), and
  `/teams/:uuid?opening=<id>` (`TeamDetailPage.tsx:743`) all emit the same clean
  canonical. **Caveat:** this canonical is client-injected (§1.2), so it only
  protects against duplicate indexing for rendering crawlers.
- **Trailing slash:** `toCanonical` strips trailing slashes except root
  (`useMeta.ts:110`) — consistent.
- **`?opening=<id>` deep links** (`OpportunitiesPage.tsx:643`,
  `TeamDetailPage.tsx:743`) are UI-highlight params, not distinct content — the
  canonical-stripping above correctly collapses them.
- Redirects in §2.1 are all `<Navigate replace>` (client-side 200 + history
  replace, not HTTP 301). For a SPA that's expected, but external link-equity
  passes only if a rendering crawler follows the client redirect. Prerendering
  or a Vercel `redirects` block (currently only `rewrites` exist in
  `vercel.json`) would make these real 301s.

### 2.4 Internal linking

Global nav (`components/AQNav.tsx:161-173`) links `/`, `/projects`, `/teams`,
`/blog`, `/opportunities`, `/contact`, `/collaborations`, `/about`. Footer
(`components/AQFooter.tsx:64-67`) is a strong hub: `/projects`, `/teams`,
`/members`, `/blog`, `/links`, `/contact`, `/about`, `/faq`, `/collaborations`,
`/brand`, `/paradox`, `/opportunities`, `/volunteer`, `/support`.

**Internal-link counts (source occurrences, excluding `App.tsx` and `paradox/`):**
`/opportunities` 29, `/projects` 20, `/teams` 19, `/blog` 14, `/members` 10,
`/about` 10, `/collaborations` 10, `/volunteer` 7, `/roots` 4, `/support` 4,
`/faq` 4, `/links` 4, **`/schools` 3, `/classes` 2**.

**Thin internal linking / near-orphan routes:**
- `/classes` (`App.tsx:233`) — reachable only from `QuickLinksPage.tsx:71`; no
  nav/footer link. In sitemap but essentially orphaned in-app.
- `/schools` (`App.tsx:232`) — reachable from `QuickLinksPage.tsx:70` and
  `PublicProfilePage.tsx:360`; also thin.
- Both are in the sitemap and `llms.txt` mentions the org but not these pages.
  Consider footer or About links to consolidate crawl paths.
- **Internal-linking gaps between related content:** there is no systematic
  cross-linking between a blog post and the project/team it describes, or from a
  team page to that team's openings, beyond the `?opening=` deep-link. The
  richest opportunity is blog ↔ projects ↔ teams ↔ openings interlinking, which
  currently mostly flows through global nav/footer rather than contextual links.

---

## 3. Core Web Vitals (static / bundle analysis)

Sizes below are from the real production build (`vite build`), raw and gzip.
**Field CWV (LCP/CLS/INP as experienced by users) cannot be measured here** —
these are bundle-weight and structural risk indicators only.

### 3.1 Bundle picture

| Chunk | raw | gzip | Loaded on |
|---|---|---|---|
| `vendor-react` (+ react-router) | 230.2 KB | 73.5 KB | every page (modulepreload in `index.html`) |
| `vendor-supabase` | 203.2 KB | 52.8 KB | every page (modulepreload) |
| `index` (app entry) | 202.6 KB | 56.9 KB | every page |
| `index` CSS (critical) | 191.6 KB | **35.2 KB** | every page (single `<link>`) |
| `vendor-motion` (framer-motion) | 134.8 KB | 44.4 KB | modulepreload on every page |
| `Admin` (director desk) | 186.4 KB | 39.6 KB | `/director/*` only |
| `vendor-paradox-heavy` | 525.4 KB | 136.2 KB | **see 3.2 — NOT paradox-only** |

Initial critical path for `/` ≈ vendor-react + vendor-supabase + vendor-motion +
index JS + index CSS ≈ **~263 KB gzip** before route content. `vendor-motion` is
`modulepreload`-ed on every page (`index.html` head) even though framer-motion is
front-end-only and the home hero could defer it — worth checking if the preload
is warranted on non-animated first paint.

### 3.2 `vendor-paradox-heavy` isolation is PARTIALLY BROKEN (high-value finding)

`vite.config.ts:64-71` buckets `@zxing`, `jsbarcode`, `matter-js`, `poly-decomp`,
`qrcode`, `svg-path-commander` into one `vendor-paradox-heavy` chunk, with the
comment *"Only the lazy ParadoxRoot imports these, so this chunk is only fetched
on /paradox."* **That claim is false for `qrcode`.**

- `components/ShareModal.tsx:3` statically `import QRCode from 'qrcode'`.
- `feed/FeedPostCard.tsx:13` statically imports `ShareModal`.
- Confirmed in the build: `FeedPostCard-*.js` contains
  `import{Q as Pt}from"./vendor-paradox-heavy-*.js"`.
- `FeedPostCard` is statically pulled by these **public, indexable** routes:
  `PostPage` (`/post/:uuid`), `PublicProfilePage` (`/member/:uuid`),
  `TeamDetailPage` (`/teams/:uuid`), plus `ProfilePage`, `SearchPage`,
  `SavedPostsPage`.

Because Rollup emits one chunk, importing the single `qrcode` symbol forces the
**entire 525 KB / 136 KB-gzip** chunk (which also contains matter-js physics,
the zxing barcode reader, svg-path-commander — none used outside Paradox) onto
those community pages. `qrcode` itself is small (~216 KB on disk pre-tree-shake,
gzips to a fraction of the 136 KB); the other libs are the bulk (matter-js ~1 MB,
@zxing ~23 MB on disk). The home route `/` is **spared** (it uses an inline
`FeedPostCard` defined in `HomePage.tsx:145`, not `feed/FeedPostCard.tsx`) — but
three public deep-link routes are not.

**Fix (S):** pull `qrcode` out of the paradox bucket in `vite.config.ts` into its
own chunk (e.g. `vendor-share`), or lazy-`import()` `qrcode` inside
`ShareModal`/`StoryGenerator` so it only loads when the share sheet opens. Either
removes ~120 KB gzip of unrelated libs from `/post`, `/member`, `/teams/:uuid`.

### 3.3 Critical CSS bundle — honest state (prior <90 KB attempt NOT completed)

The critical CSS is **191,554 bytes raw / 35,172 bytes gzip** (single
`index-*.css`, `<link>`-ed for every route). The prior goal of getting it under
90 KB raw was **not** achieved. Byte attribution of the built file (media-queries
flattened, attributed back to source):

| Source | bytes | % of critical CSS |
|---|---|---|
| `src/styles/v6.css` | 54,675 | 28.5% |
| **Tailwind escaped utilities** (`.md\:flex`, `.p-\[3px\]`, …) | 35,194 | 18.4% |
| `src/styles/routes/home.css` | 16,051 | 8.4% |
| **Tailwind `@layer theme/base/properties` + `@property`** | 11,636 | 6.1% |
| Element / `:root` / attr selectors (reset, tokens, media wrappers) | 8,966 | 4.7% |
| `@keyframes` | 5,528 | 2.9% |
| Tailwind plain utilities / unmatched | ~21,299 | 11.1% |
| `styles/routes/director.css`, `components/*.css`, etc. | remainder | — |

**Two concrete, largest opportunities:**

1. **Tailwind is ~33% (~63 KB raw) of the critical CSS and is overwhelmingly
   needed only by `/paradox`.** `src/index.css:11-13` imports Tailwind's
   utilities *unlayered* and `@source "./paradox/**/*"` — Tailwind exists in this
   project essentially to serve the Paradox sub-app (`CLAUDE.md` confirms
   `/paradox` is a separate Tailwind-using system). Yet all Tailwind utilities
   land in the single global critical CSS that every AquaTerra page loads. If the
   Tailwind layer can be scoped/emitted into a paradox-only stylesheet (loaded by
   `ParadoxRoot`), that's the biggest single win toward <90 KB and it's mostly a
   build-config change, not a hand-edit of `v6.css`. **(Requires care — some
   non-paradox components (`Modal.tsx`, `AQNav.tsx`, `AQFooter.tsx`, several
   `director/*`) do use Tailwind classes, so a naive removal breaks them; verify
   usage first.)**

2. **`src/styles/v6.css` is 3,631 lines / 156 KB source and is loaded whole on
   every route.** Largest shell-vs-route-scopable blocks by byte size
   (line ranges in source `v6.css`):
   - `L2938-3085` "PORTED FROM aq-design-system.css" (~9.7 KB) — audit whether
     all 23 ported tail classes are still used.
   - `L2860-2937` MEGA MENU desktop overlay (~5.7 KB) — **shell-critical** (nav).
   - `L3474-3632` Project Card `.pcard` (~5.7 KB) — **route-scopable** to
     projects/feed (a `styles/routes/projects.css` already exists and is
     imported by `PostStreamCard`/`PublicProjectsPage`; some `.pcard` rules could
     migrate there).
   - `L2343-2518` MOBILE BOTTOM TAB BAR (~5.6 KB) — shell-critical (mobile nav).
   - `L295-445` NAV individual floating pills (~5.5 KB) — shell-critical.
   - `L3181-3436` FEED CARDS (~11 KB, feed/PostFocusModal) — **route-scopable**
     to feed (`styles/routes/feed.css` exists but is nearly empty — 599 B).
   - `L1436-1500` `[REMOVED] GLOBAL BORDER REDUCTION` (~3.2 KB) — the comment
     says "This block used to strip…"; verify it's dead and can be deleted.

   **Shell-critical (must stay global):** nav pills/mega-menu/mobile-tab-bar
   (`L138-491`, `L2343-2518`, `L2758-3180`), tokens, buttons, typography helpers,
   footer. **Route-scopable (candidates to move out of critical):** feed-card
   block (`L3181-3436`), project-card `.pcard` (`L3474-3632`), stat block
   (`L912-996`) — these render only on feed/projects and there are already
   route-CSS files to receive them (`styles/routes/feed.css`,
   `styles/routes/projects.css`, both currently under-filled).

   Net: v6.css minifies to ~89.5 KB with comments stripped (comments alone are
   ~49 KB of the 156 KB source), so **the raw source is comment-heavy but the
   *built* contribution is 54.7 KB** — the real lever is (1) Tailwind scoping and
   (2) moving feed/project blocks to their route files, not deleting comments.
   **I did not edit any CSS** (read-only mandate). This is precise enough to act
   on directly.

### 3.4 Fonts — verified good

Self-hosted, zero Google Fonts requests on the AquaTerra side. `public/fonts/`
holds all faces (Instrument Serif, JetBrains Mono, Caveat, NeutralFace, Eina01).
Every `@font-face` in `v6.css:9-95` sets `font-display: swap`. The only Google
Fonts request in the codebase is `paradox/ParadoxRoot.tsx:152` (Boldonse /
Bricolage / Caveat), which is loaded on-demand inside the Paradox sub-app only —
consistent with `index.html:4-10`'s claim. **Confirmed still true.**
Minor: `.woff2` faces list `.otf`/`.ttf` fallbacks in `src` (`v6.css:55-95`),
which is fine (woff2 wins); no preload hint exists for the primary UI face
(NeutralFace) — a `<link rel=preload>` for it could shave first-paint text swap.

### 3.5 LCP risk

`components/Img.tsx` defaults every image to `loading="lazy"` / `decoding="async"`
and exposes an `eager` prop *specifically for the one LCP image per route* (see
its own doc comment, `Img.tsx:5-13`). **No public page uses `eager` on its
above-the-fold hero.** The only `eager` usage in the entire app is
`PostFocusModal.tsx:288` (a lightbox, not an LCP element).

- `/projects`: the featured lead cover — the largest above-the-fold element —
  is `PublicProjectsPage.tsx:123` `<Img ctx="cover" … loading="lazy">`. Lazy LCP.
- `/blog`: the first post cover `BlogListPage.tsx:24`/`:76` is `loading="lazy"`.
- `/`: hero is text (`HomePage.tsx:1416` `<h1 class="home-feed-title">`), so LCP
  is likely text — lower risk — but avatars/covers below are all lazy (fine).

**Fix (S):** pass `eager` to the single hero/cover `<Img>` on `/projects` and
`/blog` (and any project/blog detail hero). The mechanism already exists; it's
just unused.

### 3.6 CLS risk

- The `Img` wrapper does not set intrinsic `width`/`height` attributes (only 1 of
  90 `<Img>` usages passes `width=`). CLS is instead controlled via CSS
  `aspect-ratio` on the *containers* (`v6.css:3303` `.feed-card-media` 16/10,
  `:3500` `.pcard` img 4/3, `BlogPostPage.css:39`, `BrandPage.css:129`, etc.).
  Where a container has a fixed `aspect-ratio`, CLS is contained; any image slot
  **without** one relies on lazy images popping in. Worth a pass to confirm every
  cover/thumb slot has an `aspect-ratio` box.
- `font-display: swap` (§3.4) trades FOIT for a possible FOUT reflow — acceptable,
  standard, but a NeutralFace preload would reduce it.
- **Hide-on-scroll nav** exists only on the **director desk**
  (`DirectorDashboard.tsx:279` `ops-navstrip.is-hidden`), which is `noindex`/
  Disallowed — so it's not an SEO-CWV concern (bots don't crawl `/director`).

---

## 4. Structured Data & Metadata (baseline — Agent B is actively changing this)

> Snapshot risk is highest in this section. `useMeta.ts` and `useJsonLd.ts` were
> already rewritten by Agent B during this audit. Values below are the current
> file state as of capture; re-verify against HEAD.

### 4.1 What the hooks do today

- **`src/hooks/useMeta.ts`** (current, 229 lines, B-modified): one call per page
  sets `<title>` (synchronously via `useLayoutEffect`, `:164`), description,
  `link[rel=canonical]` (host-normalized, query/hash-stripped, `:104-112`), the
  full `og:*` block and `twitter:summary_large_image` card, with site-level
  fallbacks (`DEFAULT_OG_IMAGE = /logo.png`, `:21`). Notable improvements already
  landed: a `MANAGED` tag list (`:59-83`) that **removes** stale tags on route
  change (fixes the classic SPA meta-leak where a blog's `og:image`/`article:*`
  persisted onto `/contact`); `noIndex` support (`:184`); `toSocialImage()`
  (`:124-134`) runs remote covers through `sized(url,'cover')` so unfurlers don't
  fetch multi-MB originals; template-placeholder guards (`:127`, `:159`).
- **`src/hooks/useJsonLd.ts`**: injects/removes `data-jsonld-id`-tagged
  `<script type=application/ld+json>` per route, plus a `breadcrumbLd()` builder
  (`:36-47`). Cleans up on unmount.

### 4.2 Who calls them today (baseline)

`useMeta` is called by **31** route components (every public page + auth/member
pages) — full list verified: `HomePage`, `AboutPage`, `BlogListPage`,
`BlogPostPage`, `PublicProjectsPage`, `PublicProjectDetailPage`,
`OpportunitiesPage`, `OpeningDetailPage`, `TeamsPage`, `TeamDetailPage`,
`MembersPage`, `PublicProfilePage`, `PostPage`, `FAQPage`, `ContactPage`,
`CollaborationsPage`, `RootsPage`, `SchoolsPage`, `ClassesPage`, `SupportPage`,
`VolunteerHandbookPage`, `QuickLinksPage`, plus auth/member pages. **Coverage is
effectively complete** — every route sets its own meta.

`useJsonLd` is called by 4 pages: `BlogPostPage.tsx:67,83` (BlogPosting +
BreadcrumbList), `FAQPage.tsx:64` (FAQPage), `OpportunitiesPage.tsx:692`
(JobPosting list), `PublicProjectDetailPage.tsx:190,206` (Article + Breadcrumb).
Static site-level JSON-LD (Organization/WebSite/Dataset) is in `index.html:14-122`.
**Gap (pre-B):** `SchoolsPage`/`ClassesPage` build a `breadcrumbLd` but no
page-type entity; `AboutPage`, `TeamsPage`, `TeamDetailPage`, `MembersPage`,
`PublicProfilePage` emit no JSON-LD. (Agent B may be closing these.)

### 4.3 The structural risk that dominates §4

**All of the above is client-injected.** Per §1.1–1.2, none of the per-route
`useMeta`/`useJsonLd` output exists in the HTML a non-rendering crawler or social
scraper receives — they see only the static homepage head from `index.html`. So
however good the per-route meta and JSON-LD become under Agent B, their SEO value
for LLM bots and social unfurls is **gated on §1's prerendering decision**. The
metadata work and the rendering work are complementary, not alternatives: fixing
meta without prerendering fixes it only for rendering crawlers (Googlebot 2nd
pass); prerendering is what makes the good meta visible to everyone else.

---

## 5. Mobile

- **Viewport:** `index.html:140`
  `<meta name=viewport content="width=device-width, initial-scale=1.0, viewport-fit=cover">` — correct, notch-aware.
- **Responsive CSS is extensive:** `v6.css` carries dedicated mobile passes
  (`L997-1160` responsive, `L1903-2142` mobile audit, `L2143-2342` mobile polish,
  `L2343-2518` bottom tab bar, `L3086-3180` mobile nav) plus many
  `@media(max-width:…)` blocks — the built critical CSS has ~30 distinct
  breakpoints. Mobile layout is a first-class concern here.
- **Tap targets / theme:** `theme-color` set (`index.html:148-149`), PWA manifest
  present (`site.webmanifest`), apple-touch-icon set.
- **No separate mobile URL / dynamic serving** — single responsive codebase, which
  is the recommended configuration. No m-dot duplicate-content risk.
- Mobile CWV caveat: the §3.1 initial JS payload (~263 KB gzip before content)
  is heavier on mobile CPU/network; §3.2 (paradox-heavy leak) and §3.3 (Tailwind
  in critical CSS) disproportionately hurt mobile. Same fixes apply.

---

## 6. Prioritized action table (sorted by impact-per-effort)

| # | Issue | Evidence (file:line) | Impact | Effort | Recommendation |
|---|---|---|---|---|---|
| 1 | Pure CSR: empty `<body>` served to all non-JS crawlers/social/LLM bots on every route | `vercel.json:9`; built `dist/index.html` body = `<div id="root">`; `vite.config.ts` (no prerender) | **High** | **M** | Build-time prerender the public route set (Option A, §1.4). Reuse the route list from `scripts/generate-sitemap.mjs`. Single highest-leverage fix. |
| 2 | `qrcode` drags the entire 525 KB/136 KB-gz `vendor-paradox-heavy` chunk onto 3 public routes (`/post`, `/member`, `/teams/:uuid`) | `ShareModal.tsx:3` → `FeedPostCard.tsx:13`; built `FeedPostCard-*.js` imports `vendor-paradox-heavy`; `vite.config.ts:64-71` | **High** | **S** | Move `qrcode` out of the paradox bucket into its own chunk, or lazy-`import()` it inside ShareModal. Removes ~120 KB gz of unused libs from those pages. |
| 3 | Per-route title/meta/canonical/JSON-LD invisible to non-rendering crawlers & social unfurls | `useMeta.ts` (client `useEffect`); `index.html:154-177` homepage-only static head | **High** | M | Same fix as #1 (prerender bakes the meta in). Independent of Agent B's meta quality work. |
| 4 | Critical CSS 191.6 KB raw / 35.2 KB gz; ~33% is Tailwind that mostly only `/paradox` needs | built `index-*.css` (measured); `index.css:11-13` `@source "./paradox/**"` | Med | M | Scope Tailwind utilities to a paradox-only stylesheet loaded by `ParadoxRoot`; verify the handful of non-paradox Tailwind users first (`Modal.tsx`, `AQNav.tsx`, director/*). Biggest lever toward <90 KB. |
| 5 | LCP hero/cover images lazy-loaded on `/projects` & `/blog`; `eager` prop exists but unused | `PublicProjectsPage.tsx:123`; `BlogListPage.tsx:24,76`; `Img.tsx:5-13` (eager) | Med | S | Pass `eager` to the single above-fold hero `<Img>` per route. Mechanism already built. |
| 6 | Soft-404s: unknown URLs return HTTP 200 shell; `noindex` only client-side | `vercel.json:9`; `NotFoundPage.tsx:5-7` | Med | M | Resolved by prerender (#1) baking `noindex` + real 404 handling; otherwise unfixable in static SPA. |
| 7 | Feed-card & project-card CSS blocks shipped in global critical CSS but render only on feed/projects | `v6.css:3181-3436` (feed), `:3474-3632` (`.pcard`); route files `styles/routes/feed.css` (599 B), `projects.css` under-filled | Med | M | Migrate route-only blocks from `v6.css` into the existing route CSS files. |
| 8 | Redirects are client-side `<Navigate>`, not HTTP 301 | `App.tsx:126-129,208,215-216,225,267,298` | Low–Med | S | Add a `redirects` block to `vercel.json` for the stable ones (`/everything-we-do`, `/volunteer-handbook`, `/feed`) so link equity passes as real 301s. |
| 9 | `/classes` (near-orphan) & `/schools` (thin) have almost no internal links | linked only from `QuickLinksPage.tsx:70-71` (+`PublicProfilePage.tsx:360` for schools); in sitemap | Low | S | Add footer/About contextual links; or drop from sitemap if intentionally low-priority. |
| 10 | `vendor-motion` (44 KB gz) `modulepreload`-ed on every page incl. text-LCP home | `index.html` head modulepreload; `vite.config.ts:56-61` | Low | S | Confirm framer-motion is needed at first paint on `/`; if not, drop the preload so it loads on interaction. |
| 11 | `og:image` points at `/logo.png`, not a 1200×630 card (LIKELY ALREADY BEING FIXED) | `index.html:159-168`; **`public/og-image.png` now exists untracked** | Low | S | Verify Agent B/A repoint `og:image`/`twitter:image` to the new `og-image.png` with width/height. |

---

### Verification notes
- Build ran clean: `vite build` exit 0, output inspected in a scratchpad dir
  (not committed) so as not to touch `frontend/dist`.
- No source files were edited by this audit — read-only except this report.
- Findings #1–#3 are architectural and not part of Agents A/B's current pass;
  #4, #7, #9, #10 are static-analysis leads; #5, #8, #11 are small mechanical
  fixes; §4 metadata baseline may already be superseded by Agent B.
