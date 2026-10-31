# Mobile Visual Audit — Public Website (2026-07-23)

**Agent D of 4 (read-only).** Viewport: 375×812 rendered as **375×720** (the Browser pane
collapsed to an unreadable thumbnail at 812px height, so all screenshots were taken at 720px;
overflow was additionally re-measured at the **360px** small-Android floor). The `src/` tree
was in flux during the audit (Agents A/B/C editing live, Vite HMR); pages were reloaded and
re-checked before anything was reported.

**Method.** Per route: `document.documentElement.scrollWidth − clientWidth` for overflow;
DOM sweep for the widest element exceeding the viewport (ignoring elements inside horizontal
scrollers); `naturalWidth===0` for broken images; a WCAG-2.x contrast pass that composites
each text node's foreground alpha over its resolved (multi-layer) background; touch-target and
font-size sweeps; `read_console_messages{onlyErrors:true}` per route. Screenshots corroborated
the above-the-fold render. Distinctions between **measured fact** and **visual judgement** are
called out inline.

**Coverage.** All 22 target routes were measured (overflow/contrast/tap/img/console). ~12 got
useful screenshots; below-the-fold visuals relied on JS measurement because the Browser pane did
not reliably re-render scrolled content at this viewport (see Caveats). No route rendered broken.

---

## Executive summary — worst 5 by user impact

1. **`/classes` hero word "class of" is near-invisible.** Yellow display text
   `rgb(255,199,0)` at **52px** on the cream page background `rgb(244,239,224)` →
   **contrast 1.36:1** (large text needs 3:1). Screenshot confirms the middle word of the
   "THE *class of* AQ." headline reads as a faint smudge. **High** — it's a hero headline.
2. **`/links` department stat labels unreadable.** `.ql-dept-stat` renders 10px text in the raw
   department accent over a cream card: yellow "★ Live as of 2026" → **1.25:1**, blue
   "★ 300+ attendees at Paradox 3.0" → **2.03:1**, teal → 3.06:1. Cause: `QuickLinksPage.css:31`
   sets `color: var(--dc)` with no contrast floor. **High**.
3. **Site-wide Paradox banner fails AA on every public page.** `.px-banner__sticker` and
   `.px-banner__cta` ("See Highlights →") use `rgb(251,245,230)` on red `rgb(255,67,56)` →
   **3.16:1** (small text needs 4.5:1). Appears in the global footer band on all 22 routes.
   **Medium** (low per-page severity × total reach).
4. **Muted subtitles on dark heroes drop below AA.** `/about`: "since june 2021 · kolkata"
   `rgb(96,96,96)` on `rgb(10,10,10)` → **3.15:1**; "scroll to explore" → **2.61:1**.
   `/login`: "1,200+ members. 6 departments…" → **3.08:1**. **Medium**.
5. **Overlays clip / cover content.** (a) Contact form card: the green ★ sticker sits on top of
   the final letter of the "a note to aquaterra" card heading (screenshot-confirmed collision).
   (b) The dismissible `.aq-contact-nudge` bubble (fixed, z-60, bottom-right, ~60×48) overlaps
   card body text on the right edge on `/teams/:uuid`, `/about`, `/projects`. **Medium/Low** —
   both are cosmetic and the nudge is dismissible.

**Good news, measured:** **zero horizontal overflow** on every route at both 375px and 360px;
**zero broken images** (`naturalWidth===0`) anywhere; **zero console errors** on any route;
missing `<img>` width/height attributes do **not** cause layout shift because covers sit in
fixed-height / `aspect-ratio:4/3` containers with `object-fit:cover` (space is reserved).

---

## Per-route findings

Overflow is 0px on **every** route below (measured at 375 and re-confirmed at 360) unless stated.

### `/` (home feed)
No overflow. 10 images, none broken. Recurring low-contrast: bottom-tab active label
`rgb(27,138,90)` on white at **9px** → 4.32:1 (just under AA + very small); `.rail-cat-tile-badge`
count pill was `color:inherit` on a dark tile (see `home.css:201`, `rgba(0,0,0,.25)` bg). The
first-run **WelcomeOverlay** (`.aqwel-root`, fixed inset:0 z-1000) is full-screen-appropriate,
padded, and dismissible via backdrop click **and** the × — but the × is **32×32px** (under the
44px target; `WelcomeOverlay.css:29`). Overlay correctly blocks page scroll while open and honors
`prefers-reduced-motion`. Many post-action buttons (like/comment/share/save) are 40×40 / 38px —
under 44px (systemic, see table).

### `/projects` (The Directory)
No overflow. 27 images, none broken, all in sized containers. Featured "drives" card renders a
white title over a busy painting cover — legible in the screenshot thanks to bottom darkening,
but **judgement: text-over-busy-image risk** if a lighter cover is ever featured (no measured
failure). Contact-nudge bubble overlaps the "WELFARE PROJECTS" team tile at the bottom fold.

### `/projects/513` (real detail, clicked through)
No overflow. Clean hero, 6 images all loaded. "Related projects" cards use white titles over
covers (detector flags 1.15:1 vs. the cream base it can't see through — treat as image-dependent,
not a confirmed failure).

### `/blog`
No overflow. 14 images, none broken. No defects beyond the global banner/tab-label contrast.

### `/blog/blog-13` ("Dynamics", clicked through)
No overflow. Cover title/byline are white over the cover image; screenshot shows the image is
dark red with adequate scrim, so the 1.15:1 detector figures are **false positives** — reads fine.

### `/teams`
No overflow. Brand-blue doodle heading "department" `rgb(61,169,252)` on cream → **2.21:1** at 42px
(fails even the 3:1 large-text bar — brand-stylized, judgement call). `.team-card-cat` pills put
ink on category colors → welfare **3.48:1**, operations **3.91:1** (small text). `.team-card-badge`
"★ 1 strong" is **9.5px**.

### `/teams/a1b2c3d4-…0001` (Events team, clicked through)
No overflow. Tab strip (About / Members (1) / Openings / Pending Posts) fits without clipping.
"Events" heading blue-on-white → 2.54:1; "← TEAMS" dark-blue-on-blue → 4.03:1 (both brand accents).
Contact-nudge bubble overlaps the "what we do" card body on the right.

### `/opportunities`
No overflow. One open role (test data "xcv xv"). Clean.

### `/opportunities/f5fd03e9-…` (opening detail, clicked through)
No overflow. Clean; content pill "content" purple-on-white ~4.35:1.

### `/members`
No overflow. 1 non-avatar image. `role-member` badge at 10px. Clean otherwise. (Live Supabase
data — member grid populated.)

### `/about`
No overflow. **Dark-hero muted text below AA** (see summary #4). Pink display accents
"years" (36px) → 2.51:1 and "11 June 2021" (24px) → 2.73:1 on cream. `sr-only` "clipped" hit is
intentional screen-reader text, **not** a defect. Contact-nudge overlaps the hero stat block.

### `/contact`
No overflow. **Green ★ sticker overlaps the final letter of the "a note to aquaterra" card
heading** (summary #5a, screenshot-confirmed). Form fields render fine. No submit was attempted.

### `/faq`
No overflow. No defects beyond global banner/tab-label.

### `/support`
No overflow. Clean. (Donation note copy present; no data-empty state.)

### `/collaborations`
No overflow. 13 partner-logo images, none broken. "all projects →" green link 3.78:1 (small).

### `/volunteer` (handbook)
No overflow. Tomato stickers "official handbook" white-on-`rgb(255,77,46)` → **3.31:1** (15.5px).

### `/links` (Quick Links)
No overflow. **Worst contrast on the site** — see summary #2 (`QuickLinksPage.css:31`). "LinkedIn ↗"
press link blue-on-white → 2.54:1. Multiple 10px stat labels confirmed visible (`display:inline`,
non-zero box), so these are real on-screen failures, not hidden elements.

### `/classes`
No overflow. **Hero word "class of" yellow-on-cream 1.36:1** — see summary #1, screenshot-confirmed.

### `/roots`
No overflow. Green mono label "why ROOTS exists" 3.48:1; serif on grape 3.74:1 (borderline).

### `/login`
No overflow. "Continue with Google" button + email/password toggle render correctly. Muted
subtitle 3.08:1 (summary #4) — but sits on a green hero gradient, so slightly better in practice
than the flat-black figure suggests.

### `/schools`
No overflow. Clean.

### 404 (`/no-such-page-xyz`)
Observed on the shared tab (another agent had navigated there): renders the branded not-found
state ("★ page not found" tomato sticker, "lost", projects chip). No overflow. Sticker
white-on-tomato 3.31:1. Functions correctly.

---

## Prioritized table

| Route | Defect | Evidence | Severity | Likely cause (read-only) |
|---|---|---|---|---|
| `/classes` | Hero word "class of" barely legible | Yellow `#FFC700` 52px on cream, **1.36:1**; screenshot | High | `.underline-doodle` accent color vs cream bg |
| `/links` | Dept stat labels unreadable | 10px `var(--dc)` on cream: yellow **1.25:1**, blue **2.03:1**, teal 3.06:1 | High | `public/QuickLinksPage.css:31` `color:var(--dc)`, no contrast floor |
| all 22 routes | Paradox banner text fails AA | white-ish on red `#FF4338`, sticker+CTA **3.16:1** | Med | `.px-banner__sticker` / `.px-banner__cta` |
| `/about`, `/login` | Muted subtitle on dark hero < AA | `/about` 3.15:1 & 2.61:1; `/login` 3.08:1 | Med | `.mono.xs.muted` / hero `<p>` gray on near-black |
| `/contact` | ★ sticker overlaps card heading | screenshot: sticker covers last letter of "a note to aquaterra" | Med | absolutely-positioned sticker on form-card header |
| `/teams/:uuid`, `/about`, `/projects` | Floating contact-nudge covers card text | `.aq-contact-nudge` fixed z-60 ~60×48 overlaps right edge of card body | Med/Low | `.aq-contact-nudge` (dismissible, so recoverable) |
| site-wide nav | Bottom-tab active label tiny + sub-AA | green on white **9px**, 4.32:1 | Low | `.aq-tab-label.active` |
| site-wide | Touch targets < 44px | Apply btn 38px; footer links 33px tall; post like/comment/share/save 40×40; Welcome × 32px | Med | neubrutalist small-button sizing; `WelcomeOverlay.css:29` for × |
| `/teams`, `/teams/:uuid` | Brand-blue display accents low contrast | "department" 2.21:1 (42px), "Events" 2.54:1 | Low | `#3DA9FC` accent on light (brand choice) |
| `/teams` | Category pills borderline | ink on welfare 3.48:1 / ops 3.91:1 (10px) | Low | `.team-card-cat` ink-on-accent |
| all | `<img>` lack width/height attrs | but covers use `aspect-ratio:4/3` / fixed-height parents + `object-fit:cover` | Low (no CLS) | acceptable — space is reserved |

---

## Caveats / confidence

- **Screenshots vs. measurement.** The Browser pane rendered only the top fold and would not
  reliably repaint after `computer scroll` at this viewport (and collapsed entirely at 812px
  height). Above-the-fold defects are screenshot-confirmed; below-the-fold defects (the `/links`
  stats, `/about` mid-hero) are backed by JS geometry/contrast measurement plus element-visibility
  checks (non-zero box, `display:inline`, not `visibility:hidden`), not a pixel screenshot.
- **Contrast over images.** The detector composites over CSS backgrounds only; it cannot see
  raster covers. White-title-over-cover flags (1.1–1.15:1 on `/projects/*`, `/blog/*`) are
  therefore **image-dependent** and were spot-checked visually where possible — the two covers I
  screenshotted (Dynamics, Art & Craft) read fine. They are flagged as *risk*, not confirmed fail.
- **Tree in flux.** Other agents edited `src/` live; each route was reloaded before reporting.
  No transient breakage survived a reload.
- **Empty states.** Dev data is live Supabase; `/members`, `/teams`, `/opportunities`,
  `/collaborations` were populated, so no empty section was miscounted as a bug.
