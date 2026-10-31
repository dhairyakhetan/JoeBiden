# Terra Notes (`src/terranotes/`): guide for Claude

AquaTerra's monthly digital magazine (and, inside it, the AQ Labs gallery), drawn inside AQ's website at
`/terranotes`. JavaScript, not TypeScript; styled almost entirely inline; no backend.

## This folder is generated: don't edit it here

`src/terranotes/`, `scripts/terranotes/` and the files in `public/terranotes/` come from the **TerraNotes repo**
(`dhairyakhetan/TerraNotes`), written by its `tools/export-aq.mjs`.
The next export **replaces `src/terranotes/` and `scripts/terranotes/` whole**, so a change made here is lost.

- **Change the magazine** (articles, a new edition, a fix, a restyle) in the TerraNotes repo, following its
  `CLAUDE.md`. Then export into this repo and commit:
  `node tools/export-aq.mjs <path to this repo>/frontend --dry`, then `--verify` (run it from the TerraNotes repo; the
  top of that file has the options). Then `npm run dev` here (`/terranotes`, an article, `/terranotes/articles/labs`,
  1440px and 390px), `npm run build`, and commit only the three folders.
- **Change how AQ hosts it** (the shadow root, AQ's nav around it, the prerender) in the TerraNotes repo too. Those
  parts live there as `src/TerraNotesRoot.jsx`, `src/styles/document.css` and `embed/aq/` (this README, `prerender.mjs`,
  the fonts). What AQ's own code has to keep doing for it is at the top of `shared/AqNavSlot.jsx`.
- `public/terranotes/` is only added to by an export, never cleared; the export lists files there it doesn't know.
- **Packages it needs in `frontend/package.json`:** `react` / `react-dom` 19, `react-router-dom` 7.18+, `@vercel/analytics`
  and `matter-js` (^0.20, loaded only when Buddy's Fling game opens; without it `vite build` can't resolve the import).
  The card covers (`cover-card.webp`) and link previews come from the TerraNotes repo now.

## How it sits inside AQ

The same code runs as the magazine's own site and here; `src/terranotes/host.js` is what tells them apart
(`base: '/terranotes', embedded: true`).

1. **It draws inside a shadow root.** `TerraNotesRoot.jsx` (lazy-loaded by AQ's `lib/routeModules.ts` for
   `/terranotes/*`) mounts everything into `attachShadow()` and renders the app into it with `createPortal`. AQ's
   `styles/v6.css` is global and forceful, and this design relies on browser defaults plus inline styles; in the shadow
   root nothing of AQ's CSS reaches in and nothing of this CSS leaks out. The host is `all: initial`.
   - The stylesheets in `styles/` are imported with `?inline` and injected into the shadow root; AQ Labs injects its own
     (`articles/labs/labs.css`). Rules that start with `:host` apply only here.
   - What a shadow root can't hold (`@font-face`, rules for `<html>`, the `::view-transition-*` tree) is in
     `styles/document.css`, keyed on `html.tn-on`. The Google fonts are self-hosted: `public/terranotes/fonts/g-*.woff2` (from this repo's `public/fonts/`, which the own site uses too).
   - The magazine finds what it drew with `lib/dom.js` (`byId`, `$`), never `document.getElementById/querySelector`;
     pop-ups portal into `portalRoot()`; outside-click checks use `e.composedPath()`.
   - Each edition's look (its colours and fonts as CSS variables: `--ink`, `--card`, `--font-head`…) goes on the shadow
     host, never on `<html>`: AQ's own CSS has variables of the same names, which its nav and footer use.
2. **Paths are relative to `/terranotes`.** `router.jsx` stands between the code and React Router: `Link`, `Navigate`
   and `navigate()` add the prefix, `useLocation()` strips it, so the code keeps writing `/articles/exam-stress`. File
   URLs go through `withBase()` (`lib/base.js`): the data says `/editions/sep26/…`, the page loads
   `/terranotes/editions/sep26/…`.
3. **What AQ's code uses from here** (keep these working when changing the TerraNotes repo):
   `TerraNotesRoot.jsx` (default export), `lib/base.js` `isTnPath` (`App.tsx`, `PublicLayout.tsx`),
   `lib/animatedHistory.js` `createAnimatedHistory()` with `onShown()` (`App.tsx` `AppRouter`), and
   `scripts/terranotes/prerender.mjs` `terraNotesPages()`, `terraNotesLlms()`, `terraNotesSitemapPaths()`
   (`prerender-meta.mjs`, `generate-sitemap.mjs`). The `.d.ts` stubs beside them are what `tsc` sees.
4. **Page-change animation** (card flights, crossfades) goes through `lib/animatedHistory.js`, which is AQ's router history
   (kept small: AQ loads it with its first page; the animating itself, `lib/pageSwap.js`, loads with the magazine)
   (`App.tsx` `AppRouter`). It only animates changes that stay inside `/terranotes`; everything else passes through.
   Its `useTransitions={false}` toggle in `AppRouter` is needed for the flights: don't remove it.
5. **AQ's nav, dock and footer wrap it (the magazine has no footer); the magazine's own header is hidden** (`:host header.site-header{visibility:hidden}`
   in `styles/base.css`), its box kept as the spacer under AQ's fixed nav. So, here only: no skip link,
   a visible "call Buddy" button on phones (`shared/buddy/Buddy.jsx`), cards load `cover-card.webp`, AQ Labs runs
   full width with its chapter pill under AQ's nav, and what the hidden header gave is drawn in the page
   (`shared/InsideAQ.jsx`): a card with the other editions at the end of the home pages (once there is more than one)
   and a "← Back to home" pill under AQ's nav (it reads AQ's `--nav-h`). The viewport tag is pinned to `width=390` on phones only while the magazine shows.
6. **Editions.** Every month is its own folder, `editions/<id>/` (look, articles, photo wall, words, team), kept for
   good: the latest edition is `/terranotes`, an older one `/terranotes/sep26`, a draft (`draft: true` in
   `data/editions.js`) only at its own address with a "Draft" tape, and nowhere in the prerender or sitemap.
7. **`/labs` and `/labs/<slug>` redirect** to `/terranotes/articles/labs[/<chapter>]` (`App.tsx` `LabsRedirect`, and
   permanent redirects in `vercel.json`). The Wisdom Woods demo is shown in a same-origin iframe, so `vercel.json`
   gives that folder `X-Frame-Options: SAMEORIGIN`; the export adds the `<base>` tag its `index.html` needs here.
8. **Not linted or type-checked by AQ's tooling**, and no unit tests: the TerraNotes repo checks it (`npm run build`
   there runs its guard, `tools/check-embed.mjs`, which catches the shadow-root mistakes above).

## Checking a change

In a real browser at both layouts: 390px wide (phone, emulate touch) and 1440px (web), plus ~1024px and 320px. Also
reduced motion, `?lite` and `?intro`. From `frontend/`: `npm run dev`, then `/terranotes`; then `npm run build` (the
whole chain, including the prerender).
