# Visual review — redesign sections 01, 02, A1 + the accessibility batch

Done in the integrated browser against the local vite dev server, at **390×844
(mobile, touch emulation, DPR 2)** and **1280×860 (desktop)**. Every value below
was read from the live DOM with `getComputedStyle`, not from source.

Date: 2026-09-04.

---

## What was checked

| Surface | 390 | 1280 | Result |
|---|---|---|---|
| `/` home feed | ✅ | — | pass |
| `/login` signed out | ✅ | ✅ | pass, 1 defect found and fixed |
| `/login?utm_source=linkedin` | ✅ | — | pass, engine verified |
| `/about` | — | ✅ | pass |
| mega menu (opened) | — | ✅ | pass |
| footer | — | ✅ | pass, 1 defect found and fixed |
| `/teams` | ✅ | — | pass |
| `/projects` directory | ✅ | — | pass, 1 false alarm cleared |
| 404 | ✅ | — | pass |
| `/director` desk | ✅ | — | pass (unchanged, desks land last) |
| shared `Modal` | ✅ | — | **major repair confirmed** |
| `Confirm` dialog | ✅ | ✅ | pass, both shapes correct |

---

## Confirmed working, with measured values

### Global chrome

| Thing | Measured |
|---|---|
| Top nav pill | `54px` · `999px` · `#FFFFFF` · `backdrop-filter: none` · `box-shadow: none` |
| Dock pill | `60px` · `999px` · `#FFFFFF` · detached at `left/right: 12px` |
| Active dock tab | `rgb(10,10,10)` ink pill, label visible, inactive tabs icon-only |
| Compose FAB | `60×60` · `rgb(27,138,90)` · `rgba(10,10,10,.5) 1.5px 1.5px 0 0` |
| Feed card | `border-radius: 26px` |
| Feed photo | `margin: 8px` · `border-radius: 18px` — **the concentric rule is now true on the page, not just in prose** |
| Menu trigger | `menu` in Eina01, `44px`, `white-space: nowrap`, ellipsis glyph |
| Nav search | icon `display: none` at 1280; field `flex` at `230px` with the `/` hint |
| Footer heads | `rgb(61,169,252)` at `9px`, no background, no rotation |
| Footer links | Eina01 at `--paper` 62% |
| Footer headline | NeutralFace `38px` · `line-height .92` · `letter-spacing -1.71px` |
| Bottom rule | `2px solid rgba(244,239,224,.16)` |

Mega menu at 1280: six explore rows with hairline rules and `--sky` mono
indices, eight secondary destinations as outlined pills (the ninth is
director-only and this session is not a director), the join CTA full-width and
pinned at the bottom, unrotated.

### Auth funnel

`/login` renders the ink page, the radius-40 card, the sky strip for a returning
visitor, the welfare eyebrow with `var(--shadow-cta)`, the Instrument Serif
italic on the last word, and the three step cards with welfare / sky / lemon
numbered discs.

**The adaptive headline engine was verified live, twice, with different facts:**

- `?utm_source=linkedin` → `source.linkedin` → "the work behind the *posts.*" /
  "550+ projects delivered. Volunteer hours count toward your certificate."
- third visit in the same browser → `visits.third_plus` → "STILL *deciding?*" /
  "Browse open roles first if you would rather look before you leap."

Both used a **canonical** figure, not the banned placeholders. First-match
ordering, memoisation and the canonical-figure substitution are all confirmed
end to end.

### The shared modal — the biggest single repair

Before, `components/Modal.tsx` was styled entirely with Tailwind classes the app
no longer loads. It had **no fixed positioning, no scrim, no centring, no width
cap, no radius and no 44px close target.** Two live member-facing modals use it.

Measured after the rewrite:

```
.aqm-back    position: fixed        z-index: 210
.aqm-scrim   rgba(0,0,0,.55)        backdrop-filter: blur(4px)
.aqm-panel   358px wide   radius 28px   border 2.4px rgb(10,10,10)
             box-shadow rgba(10,10,10,.5) 1.5px 1.5px 0 0   max-height 717px
.aqm-close   44×44
focus        inside the panel on open  ✅
```

### The confirm dialog, both shapes

| | 390 | 1280 |
|---|---|---|
| radius | `32px 32px 0 0` | `28px` |
| width | full bleed | `480px`, `max-width: 480px` |
| overlay align | `flex-end` | `center`, `padding: 20px` |
| grab handle | visible, 44×5 | `display: none` |
| actions | stacked, destructive first | `row-reverse` |

---

## Defects found by looking, that source review had missed

### 1. The Google button clipped its own label — FIXED

At 390px the frozen label "Sign up / sign in with Google" did not fit on one
line at 15px inside a `999px` pill with `height: 54px`. **It clipped straight
through the rounded ends.** This is exactly the failure the fixed-height-pill
rule describes, and it was invisible in source: the CSS was correct per the
step.

The copy is frozen and may not be shortened, so the component gives instead:
`height: 54px` → `min-height: 54px` plus `padding: 12px 18px` and
`line-height: 1.25`. Now measures 65px on two lines, no overflow, copy intact.

### 2. The footer column heads have never been JetBrains Mono — FIXED

`.aq-footcol-h` has declared `font-family: var(--mono)` since it was written.
Computed style says **NeutralFace**. A global
`h1, h2, h3, h4, h5, h6, … { font-family: var(--display) !important }` in
`v6.css` beats it, and the head is an `<h2>`.

Fixed narrowly with a matching `!important`. **The underlying rule is a systemic
problem** — it silently overrides every component that wants mono or Eina for a
heading, and it is why `text-transform: lowercase` on a heading renders as caps.
Blast radius is every heading in the app; logged for the typography pass, not
unpicked here.

### 3. The `.lg-back` link was invisible on the new ink page — FIXED

"← back to site" sits **outside** the white card. Step 1 turns the page ink; the
link was still `var(--ink-3)`. Now `--paper` at 70%. The step list does not
mention it because it only names elements it changes.

---

## One false alarm, cleared

The `/projects` directory appeared to clip the "Welfare Projects" department
pill at the right edge. It does not: `.dir-team-chips` is
`overflow-x: auto` with `scrollWidth 1553` against `clientWidth 358`, an
intentional horizontal scroll row, and `document.scrollWidth === clientWidth`
so the page itself never scrolls sideways. Recorded so the next pass does not
"fix" a working scroller.

---

## Not verified, and why

- **`/register`, `/pending`, `/rejected`** were restyled but not seen rendering.
  All three are status-gated and the dev preview does not create a Supabase
  session, so they redirect. They typecheck and build; they need a real account
  in each state to review. **This is the largest gap in this review.**
- **`teams/CreateTeamPostModal` and `teams/JoinRequestModal`**, the two real
  consumers of the rewritten `Modal`, were not opened — the teams list needs a
  live session to load. The shared `Modal`, `Input`, `TextArea` and `Alert` were
  verified through the dev ComponentGallery instead, which imports all four.
- **The keyboard walk.** The accessibility batch was verified by `tsc` and build
  only. Tab-into-a-feed-card and the yearbook picker trap still need a real
  keyboard pass.
- **Dark mode.** Not checked at all.
- **The HoD desk** renders unchanged, which is correct: desks take only the
  radius pair and the sticker keyline, and they land last.

---

## Measurement caveat

The integrated browser reports border widths at **0.8×** — a 2px border computes
as `1.6px`, a 3px as `2.4px`. The ratio is preserved and rendering is correct;
this is a viewer scaling artifact. **Do not "fix" border widths from those
numbers.**


---

# Addendum — second pass, after the parallel batch

Sections 03, 05/05b, 06 and the two feature changes landed after the review
above. Re-checked at 390x844.

## Verified

| Surface | Result |
|---|---|
| `/about` | Ink hero renders. **Both stat cards and the zero-donations band now appear on phone** - they were desktop-only, so a phone user was never shown two of the canonical public figures |
| `/projects` | Impact stats as a 2x2 phone grid; team chips are 44px pills with a 9px hue dot from `dept.color`; the marker legend prints under the row; `.dir-team-chips` still scrolls |
| Composer (FAB) | Bottom sheet measured: `.cp-grab` handle, `.cp-head` fixed, `.cp-body` `overflow-y: auto`, `.cp-bar` pinned. Sheet is 776px of an 844px viewport (92dvh). Category is a scrollable radiogroup with heroicon glyphs |
| `/post/:uuid` | `.pp-article` `rgb(10,10,10)` reading surface into `.pp-paper` `rgb(244,239,224)` for comments and rails. 42px back pill, outlined category badge, **one** outlined stat block (correctly not padded to three), full-bleed cover, 44px comment composer with a 44px circular send |
| Feed cards | **22 real `a[href^="/post/"]` links present** - confirming the accessibility fix: a keyboard user can now reach a post, which was impossible before |

## One near-miss worth recording

The composer's POST button *looked* clipped at the bottom of the screenshot.
Measured, it is not: the button's bottom edge is at 832px in an 844px viewport,
12px clear. What overlaps it is the **`DEV PREVIEW` banner**, which is
hard-gated to `import.meta.env.DEV` in `lib/devPreview.ts` and ships as dead
code. Recorded because the screenshot alone would have produced a false bug
report, and the fix would have been to move a correct layout.

## Still not verified

Unchanged from the main review: `/register`, `/pending` and `/rejected` need a
real account in each state; `ProfilePage` and `PublicProfilePage` need an
authenticated session (the dev preview creates no Supabase session, so
RLS-backed data does not load); dark mode has not been checked anywhere; and
the accessibility batch still needs a real keyboard walk rather than a
link-presence check.
