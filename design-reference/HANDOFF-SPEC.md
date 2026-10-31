# Handoff: AquaTerra Platform — Playground Design System

## Overview
AquaTerra is a youth volunteer-community platform (Kolkata-based NGO). This handoff covers the **canonical "Playground" visual direction** — a warm-paper, ink-outlined, Y2K-scrapbook aesthetic that feels youthful and energetic — across the full product: public marketing site, a member community app (social feed), a recruitment/onboarding flow, and an HOD (admin) desk.

The target codebase is **`kaxx4/AQWEB`** (React + Vite + Supabase). This package tells a developer how to build every screen against that stack.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, **not production code to copy directly**. They run on a bespoke template runtime (`support.js` + `{{ }}` template holes + a `Component` logic class). **Do not port that runtime.** Your job is to **recreate these designs in the AQWEB React/Vite environment** using its existing patterns (function components, React Router, Supabase client, whatever styling approach the repo already uses — CSS modules / plain CSS variables recommended, see Design Tokens).

Where AQWEB already implements a page (About, Blog, Contact, Projects, Support, Apply, Handbook, 404, Nav, Footer), the task is a **restyle to these tokens/components — not a rebuild**. The remaining screens are new builds.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, radii, shadows, and interactions are all specified below and in the two reference docs. Recreate pixel-faithfully using AQWEB's libraries. Exact hex values and the type scale are authoritative.

## Design Tokens

### Color (ship as CSS custom properties on `:root`)
```css
:root{
  /* substrate & ink */
  --bg:#F4EFE0; --bg-2:#EDE6D0; --bg-3:#E2D9BD; --card:#FFFFFF;
  --ink:#0A0A0A; --ink-2:#2A2A28; --ink-3:#5A5A55;
  /* category hues — ONE per vertical, never reuse a hue for anything else */
  --welfare:#1B8A5A; --accent:#1B8A5A;   /* welfare == primary accent */
  --events:#3DA9FC;  --sky:#3DA9FC;
  --labs:#FFC700;    --lemon:#FFC700;
  --ops:#12909C;     --teal:#12909C;      /* darkened from #0E7C86 for AA */
  --content:#7E5BFF; --grape:#7E5BFF;
  /* signals */
  --tomato:#FF4D2E; --pink:#FF4D8C;
  --line:rgba(0,0,0,.18); --line-2:rgba(0,0,0,.32);
}
```
**Delete the legacy aliases `--mint` and `--accent2`** — they are duplicates of `--welfare`/`--events` and caused category-colour collapse. Bind each vertical to its own token.

### Contrast rule (WCAG 2.1 AA — enforce)
- **Ink text** on green / sky / lemon / tomato / teal — all pass AA.
- **White text** only on `--grape`, and only at large sizes (≥19px bold / ≥24px).
- Never put white body text on welfare-green (fails, 4.35). Stickers on tomato/green use **ink**, not white.

### Typography
| Role | Font | Size | Weight | Tracking |
|---|---|---|---|---|
| Display XL | NeutralFace | clamp(44–86px) | 900 | −0.045em |
| Page / feed title | NeutralFace | clamp(40–78px) | 800–900 | −0.04em |
| Section head | NeutralFace | clamp(24–34px) | 800 | −0.03em |
| Card title | Eina01 | 17.5px | 800 | 0 |
| Body | Eina01 | 14px (min 13) | 400 | 0, line-height 1.6 |
| Meta / labels | JetBrains Mono | 10–11px | 700 | .05em, UPPERCASE |
| Flourish word | Instrument Serif *italic* | contextual | 400 | — |

Font families: `--display:'NeutralFace'`, `--eina:'Eina01'`, `--mono:'JetBrains Mono'`, `--serif:'Instrument Serif'`. Web-load Caveat/Instrument Serif/JetBrains Mono from Google Fonts; NeutralFace + Eina01 are self-hosted (see Assets).

### Spacing — 8-step scale (4px base)
`4 · 8 · 12 · 15 · 18 · 22 · 32 · 52`. Snap all padding/gaps to these. Container padding = 16 (rails) or 18–22 (heroes); grid gaps = 14–18.

### Radius
`8` inputs · `14` tiles/notices · `20` cards/rails · `999` pills/buttons.

### Border weight (two-tier rule)
`2px` = secondary/inline (rails, chips, notices, inputs). `3px` = primary/structural (feed cards, team cards, panels, heroes). No 1px/1.5px structural borders.

### Elevation (hard offset shadows — the signature motif)
`rest-sm 2px 2px 0 var(--ink)` · `rest-lg 4px 4px 0` · `hover/lift 6px 6px 0 + translate(-3px,-3px)` · `active 1px 1px 0`. **No blurred shadows** except the glass top-nav (`.nav-in`: blur + soft).

### Motion
Durations: micro/press 120–140ms · hover/lift 160–180ms · page-in 380ms · card stagger 60ms. Easings: enter `cubic-bezier(.2,0,0,1)`; springy chips/tiles/avatars `cubic-bezier(.34,1.56,.64,1)`; linear only for marquee & star spin. **Wrap all infinite/decorative motion in `@media (prefers-reduced-motion: reduce)` and disable it.**

## Screens / Views
38 screens across five clusters. Full per-screen purpose/layout/fix notes live in **`AquaTerra - Design Audit.html` §13 (page-by-page)**. Summary:

- **Public & marketing (indexable):** Home/Feed, About, Blog, Blog post, Teams, Team detail, Members, Public profile, Projects, Project detail, Openings, What we do, Collaborations, Schools, Classes/ShikshAQ, ROOTS shop, FAQ, Support, Contact, Quick links, Design language.
- **Community app (authed, noindex):** Profile, Settings, Notifications, Saved, My posts, Post detail, Search, HOD Desk (12 tabs).
- **Recruitment & onboarding:** Apply (quiz→form→thank-you), Login, Register, Onboarding, Handbook, Pending, Rejected, Thank you.
- **System & utility:** 404, Overlays (popup menu, mega menu, toast, island TOC, cart bar), Global chrome (glass nav, marquee, bottom nav).

## Components (build a shared library first)
Buttons (default/primary/category/small + hover/active/focus/disabled/loading), Chips, Stickers & badges, Avatars (single/stack), Toggle (`role=switch`), Tabs, Form fields (rest/focus/error/disabled), Cards (feed `.fcard` 3px, rail 2px, event row, notice), and three **systemic states** shipped as shared components: **Empty · Loading (skeleton) · Error (dashed tomato banner + retry)**. Exact specs + live states in **§08** of the audit doc.

## Interactions & Behavior
- **Focus:** add global `:focus-visible { outline:3px solid var(--grape); outline-offset:2px }` (offset −2 inside nav/bottom-nav). Missing everywhere in the original.
- **Hit targets:** all interactive targets ≥44×44 (nav icons, icon buttons, act buttons, bottom-nav, close ×).
- **Modals (9 types):** shared primitive with focus-trap, Esc-to-close, return-focus, `aria-modal`. (Esc-close is already prototyped.)
- **Toast:** single host with `role=status` live region; queue rapid messages (current model drops them).
- **Optimistic UI:** like/bookmark update immediately + toast; keep.
- **Notice carousel:** 3.2s interval, pause when tab hidden + under reduced-motion.
- **Nav:** mega-menu (desktop) + popup quick-menu (mobile) share one link source. Add skip-to-content link + `nav` landmark + current-page aria.

## State Management & Routing
- **Real router required.** The prototype uses a single `state.page` string with no URLs — replace with React Router: one route per screen, deep-linkable, browser back/forward working.
- **Parameterised details:** `/post/:id`, `/project/:id`, `/team/:slug`, `/blog/:slug`, `/u/:handle`. Detail views render from the entity, not hardcoded copy. (Post detail is already param-driven in the prototype via `openPost(id)` — mirror that pattern for the rest.)
- **Auth/role guards:** Profile, Settings, Saved, HOD Desk require session; HOD is role-gated. Redirect to login with return-to. The HOD role-switcher is a good permission-preview UX — keep it, driven by real session role.
- **Do NOT port demo shortcuts:** fake login (any credentials pass), artificial 1.6s `setTimeout` load screen, `Date.now()` ids, `volStatus` keyed by email. Gate on real Supabase data.

## Data Model (map to Supabase tables)
Entities to formalise: **Post** (id, author, category, sticker, link, image+alt, like/comment counts, title?, body), Comment, Member, Team, Project, Opening, Application, Enquiry, Achievement, Product. **Fix the category slug drift** — `ops` vs `operations` both exist; pick ONE slug. Image `alt` must be a required authoring field.

## SEO provisions
Per-route `<title>` + meta description (needs SSR or prerender for marketing routes; authed app can be `noindex`), one `<h1>` per page, Open Graph + Twitter card, semantic landmarks (`header/nav/main/footer`), `sitemap.xml` + `robots.txt`, JSON-LD (Organization, Event, JobPosting, Article, Product, FAQPage), canonical URLs, descriptive `alt` on all imagery.

## Responsive breakpoints
`>1080` full 3-col shell (230/1fr/264) · `≤1080` right rail hides, 2-col · `≤760` single col, top nav→bottom nav, chips become horizontal scroller · `≤420` stat rows 4→2, clamps step down · `≤340` everything stacks.

## Assets
- **Fonts (self-host):** `assets/fonts/` — NeutralFace (Regular/Bold woff2), Eina01 (Regular/SemiBold/Bold ttf). Bundled in this handoff.
- **Logo:** `assets/logo.png`.
- **Photography:** `assets/img/` — food-distribution, education-sundarban, christmas-khidirpur, fundraising-diwali (jpeg). These are content placeholders; swap for real CMS/Supabase-hosted media.
- **Decorative noise/grain:** inline SVG data-URIs in CSS (`.noise::before`, `.nodemap`, footer, mega) — reproduce as-is or as a small tiled asset.

## Files
- `AquaTerra - Playground.html` — the full interactive prototype (all 38 screens). Primary visual + behavior reference.
- `AquaTerra - Design Audit.html` — the living style guide: tokens, component gallery with live states, consistency-drift register, accessibility matrix (measured contrast), responsive specs, motion specs, flow audit, code-level findings, pending-vs-live gap analysis, and a P0/P1/P2 dev checklist. **Read this first.**
- `assets/` — fonts, logo, imagery.

## Suggested build order
1. Token file + shared component library (buttons, cards, chips, modal, toast, empty/loading/error).
2. Restyle the ~14 pages already live in AQWEB to these tokens.
3. Marketing gap pages (Teams, Members, Openings, FAQ, ROOTS, What we do, Schools).
4. Community app behind auth (feed, profile, settings, notifications, search, post detail).
5. HOD desk.

> Note: `AQWEB/Clone.tsx` is a ~98KB single-file page — split it before applying the new system. Confirm whether HOD desk already lives in `community-platform-aq` before duplicating.
