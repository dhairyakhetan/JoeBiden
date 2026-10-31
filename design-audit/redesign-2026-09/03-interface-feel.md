# 03 — Interface feel

Audit date 2026-09-03. Scope `frontend/src/**` excluding `frontend/src/paradox/**`.
Binding context: `REDESIGN_GUARDRAILS.md` (UX/copy/fonts/colours frozen, UI changes,
"dated to alive", consolidate, never touch Supabase wiring).

Audit only. No files were edited.

---

## Standing state (so the findings read in proportion)

This codebase is **not** starting from zero on feel. Verified present and correct:

- `-webkit-font-smoothing: antialiased` + `-moz-osx-font-smoothing: grayscale` on `html` (`index.css`).
- `text-wrap: balance` on `h1..h6`, `pretty` on `p, li, blockquote, figcaption` (`index.css`, `styles/v6.css`).
- `font-variant-numeric: tabular-nums` on `.mono`, `.like-count`, `.stat-num`, `[data-tabular]`, `time`, and ~70 inline sites.
- Zero occurrences of `transition: all` in shipping CSS or TSX (only three comments referencing the rule).
- `@media (hover: none)` sticky-hover neutralisation with `:active` press replacements — a genuinely good block in `styles/v6.css`.
- Feedback triad coverage on the HoD desk is strong: per-row `busy` sets, `useConfirm()` before destructive writes, `toast.error` on every catch in `DirectorManagement`, `MemberDirectory`, `HiringResponses`, `SopManagement`, `ProjectManager`, `CategoryManagement`, `FormResponses`, `WhatsAppTemplates`, `AchievementReviews`, `CertificateRequests`, `DriveManagement`, `TeamManagement`, `VolunteerApplications`.
- `TeamDetailPage.tsx` wires toast + confirm on all six mutations.

The findings below are therefore about **consistency and the last mile**, plus one
genuinely broken surface.

---

# P0

## P0-1 · `components/Modal.tsx` is styled with Tailwind utilities that are no longer loaded

**Files:** `components/Modal.tsx`, `components/Input.tsx`, `components/TextArea.tsx`,
`components/Alert.tsx`, `components/Button.tsx`
**Live consumers:** `teams/CreateTeamPostModal.tsx`, `teams/JoinRequestModal.tsx`
(both reachable from `/teams/:uuid`), plus `dev/ComponentGallery.tsx`.

Tailwind was moved out of `index.css` into `paradox/tailwind.css`, which is imported
only by the lazy `ParadoxRoot`. `main.tsx` imports `styles/tokens.css`,
`styles/v6.css`, `index.css` — no Tailwind. Grepping for `.fixed`, `.inset-0`,
`.max-w-md` in non-paradox CSS returns nothing.

`Modal.tsx` still relies on those utilities for its entire geometry:

- `className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden"` — the outer shell
- `className="fixed inset-0 bg-black/50 transition-opacity"` — the scrim
- `className={"flex min-h-full items-center justify-center " + (fullScreenMobile ? 'sm:p-4 p-0' : 'p-4')}` — the centring
- `className={sizes[size]}` → `max-w-md` etc. — the width cap
- `mobileClasses` → `rounded-2xl max-h-[85vh] sm:max-h-[90vh]`
- header `className="flex items-center justify-end px-5 py-4 flex-shrink-0"`
- close button `className="-mr-2.5 inline-flex h-11 w-11 items-center justify-center rounded-full [transition:background-color_120ms,color_120ms,transform_120ms] active:scale-[0.96]"`
- body `className="px-5 py-4 overflow-y-auto flex-1"`
- `Modal.Footer` `className="flex items-center justify-end space-x-3 pt-4 mt-4"`

Only `animate-slide-up` resolves (defined in `index.css`). Everything else is dead.
Result: no fixed positioning, no scrim colour, no centring, no width cap, no scroll
containment, no padding, no 44×44 close target, no press scale. The two team modals
render as an unpositioned block with a 3px ink border and `6px 6px 0 0 var(--ink)`
inline shadow, and the "backdrop" div is a zero-height transparent element.

`Input.tsx` / `TextArea.tsx` (`className="w-full"`, `"block text-sm font-medium … mb-1.5"`,
`"mt-1.5 text-sm …"`) and `Alert.tsx` (`"w-5 h-5 mr-3 flex-shrink-0 mt-0.5"`,
`"flex-1 text-sm"`, `"-my-2 -mr-2 ml-2 … h-10 w-10 … active:scale-[0.96]"`) are dead
in the same way, and both are inside those two modals.

**Fix.** Rewrite `Modal.tsx` against the app's own `.modal-back` / `.modal` /
`.modal-head` / `.modal-body` layer in `styles/v6.css` (already used by
`AccountApprovals`, `AchievementReviews`, `MemberDirectory`, `PostModeration`,
`YearbookManagement`, `AddAchievementModal`, `EditAchievementModal`). Concretely:

- outer portal div → `className="modal-back"` (it already carries `position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(6px); z-index: 150; display: grid; place-items: center; padding: 20px`), drop the separate backdrop div and put `onClick` on it with an `e.target === e.currentTarget` guard.
- panel → `className="modal"` plus an inline `maxWidth` from a size map: `sm 400`, `md 520`, `lg 680`, `xl 840` (px).
- header → `className="modal-head"`; body → `className="modal-body"`.
- close button → `className="btn btn-icon btn-sm"` with inline `minWidth: 44, minHeight: 44`.
- `Modal.Footer` → `<div className="row gap-3" style={{ justifyContent: 'flex-end', paddingTop: 16, marginTop: 16, borderTop: '2px solid var(--line)' }}>`.
- `Input.tsx` / `TextArea.tsx` → the existing `.input` / `.textarea` classes plus `components/Field.tsx` for the label, which is what every other form in the app already uses.
- `Alert.tsx` → replace with the `useToast()` primitive at the call site in `JoinRequestModal`, or restyle inline against `var(--tomato)` / `var(--welfare)` / `var(--sky)`.

**Guardrail check:** this is pure UI; no `.from()`, column or RLS change. The two
modals' submit flows, success states and error states must survive verbatim
(`JoinRequestModal` passes `title=''` after submit — the close control must still
render, which the current component handles deliberately; keep that).

---

## P0-2 · The shared motion toolkit is built and then almost entirely unused

**Files:** `lib/motion.ts`, `components/Reveal.tsx`, `components/CountUp.tsx`,
`components/StatCountUp.tsx`, `components/SuccessCheck.tsx` — against 15 files that
re-derive their own config.

Measured usage outside the toolkit's own files:

| Export | Consumers |
| --- | --- |
| `tapScale` | 2 — `profile/BreakModal.tsx`, `public/OnboardingPage.tsx` |
| `fadeInUp` | 0 (only inside `Reveal.tsx`) |
| `staggerContainer` | 0 (only inside `Reveal.tsx`) |
| `popIn` | 0 |
| `springSoft` | 0 |
| `springPop` | 1 — `components/v6Shared.tsx` |
| `likeBurst` | 1 — `components/v6Shared.tsx` |
| `Reveal` | 2 — `public/PublicProjectsPage.tsx`, `teams/TeamsPage.tsx` |
| `RevealGroup` | 0 |
| `CountUp` | 1 — `components/v6Shared.tsx` |
| `StatCountUp` | 1 — `public/BrandPage.tsx` |
| `SuccessCheck` | 4 — `ApprovedWelcomeModal`, `OpportunitiesPage`, `ThankYouPage`, `ApplyForOpeningModal` |

Meanwhile the same motion is re-typed per file, in three incompatible dialects:

**(a) Raw `stiffness`/`damping`, which `lib/motion.ts`'s own header says was
deliberately abandoned** ("two coupled physics constants are hard to reason about and
easy to get wrong"):

- `feed/CreatePostModal.tsx` — `transition={{ type: 'spring', stiffness: 400, damping: 30 }}`
- `profile/BreakModal.tsx` — `transition={{ type: 'spring', stiffness: 400, damping: 30 }}`
- `components/DynamicIslandTOC.tsx` — `transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 25 }}`
- `components/SuccessCheck.tsx` — `transition={{ type: 'spring', stiffness: 300, damping: 18 }}` (the toolkit component itself)
- `public/OnboardingPage.tsx` — `const SOFT_SPRING = { type: 'spring', stiffness: 280, damping: 28, bounce: 0 }` and `const SNAPPY = { type: 'spring', stiffness: 380, damping: 26, bounce: 0 }`, then `transition={{ ...SOFT_SPRING, stiffness: 360, damping: 22 }}` — a fourth spring derived inline from the first.

**(b) The literal easing array `[0.2, 0, 0, 1]` retyped 14 times** in
`ApprovedWelcomeModal`, `ConfettiBurst`, `ImageLightbox` (×3), `PostFocusModal` (×2),
`PublicLayout`, `SuccessCheck` (×2), `FeedPostCard`, `PostComments`,
`AddAchievementModal` (×2), `EditAchievementModal` (×2), `AddMemberModal` (×2),
`VolunteerHandbookPage`. It is already a token — `--ease-out: cubic-bezier(0.2, 0, 0, 1)`
in `styles/tokens.css` — with no TS counterpart.

**(c) Modal enter durations that all mean "modal enter" and none of which agree:**
`0.16s` (`CreatePostModal`, `BreakModal` scrim), `0.18s` (`ImageLightbox`,
`PostFocusModal`, `AddAchievementModal`, `EditAchievementModal`, `AddMemberModal`),
`0.2s` (`BirthdayPopup`), `0.22s` (panel layer of the same four modals), `0.25s`
(`ApprovedWelcomeModal`), `0.32s` (its panel).

**Fix.** Extend `lib/motion.ts` and make it mandatory. Add, using the toolkit's own
duration+bounce form:

```ts
export const EASE_OUT = [0.2, 0, 0, 1] as const   // mirrors --ease-out
export const EASE     = [0.16, 1, 0.3, 1] as const // mirrors --ease
export const springSnap = { type: 'spring' as const, duration: 0.3, bounce: 0 }
export const scrimFade  = { duration: 0.18, ease: EASE_OUT }
export const panelIn = {
  hidden:  { opacity: 0, transform: 'translateY(12px) scale(0.985)' },
  visible: { opacity: 1, transform: 'translateY(0px) scale(1)', transition: { duration: 0.22, ease: EASE_OUT } },
  exit:    { opacity: 0, transform: 'translateY(8px) scale(0.99)', transition: { duration: 0.15, ease: EASE_OUT } },
}
export const sheetIn = {  // phone bottom-sheet variant
  hidden:  { transform: 'translateY(100%)' },
  visible: { transform: 'translateY(0%)', transition: springSnap },
  exit:    { transform: 'translateY(100%)', transition: { duration: 0.18, ease: EASE_OUT } },
}
```

Then replace, file by file: every `stiffness`/`damping` literal with `springSnap` or
`springPop`; every `[0.2, 0, 0, 1]` with `EASE_OUT`; every modal scrim with
`scrimFade` and every modal panel with `panelIn` / `sheetIn`. Replace
`SuccessCheck.tsx`'s own `stiffness: 300, damping: 18` with `springPop`.
Delete `SOFT_SPRING` / `SNAPPY` from `OnboardingPage.tsx` in favour of
`springSoft` / `springSnap`.

Note the exit half is currently missing everywhere (see P0-4) — `panelIn.exit` is
what fixes it, and per the skill's principle 6 the exit is deliberately shorter
(0.15s vs 0.22s) and travels less (8px vs 12px).

---

## P0-3 · Two competing global `img` outline rules; the dark-mode variant and the opt-out are both dead

**Files:** `index.css`, `styles/v6.css`

`styles/v6.css` (block headed `K1 - Subtle image outlines for visual depth (light/dark)`):

```css
img { outline: 1px solid rgba(0, 0, 0, 0.1); outline-offset: 0px; }
@media (prefers-color-scheme: dark) { img { outline-color: rgba(255, 255, 255, 0.1); } }
```

`index.css`, imported **last** by `main.tsx`:

```css
img:not(.no-outline) { outline: 1px solid rgba(0, 0, 0, 0.1); outline-offset: -1px; }
```

Both selectors have specificity (0,0,1) — `:not()` contributes nothing of its own —
so the later sheet wins. Three consequences:

1. The `prefers-color-scheme: dark` white outline never applies. On a dark-OS device the media query still fires (it is independent of the `data-theme="light"` pin in `index.html`), but `index.css`'s `outline` **shorthand** resets `outline-color` afterwards. Every image gets a black rim on a dark ground, which reads as a smudge — the exact failure the skill's principle 11 names.
2. `.no-outline` is a no-op. An `<img class="no-outline">` escapes the `index.css` rule and lands straight back on the `v6.css` `img` rule. There is currently no way to opt an image out except `outline: none !important` at the call site (which is what `styles/v6.css` does four times: `.aq-logo-img`, `.aq-avatar img`, `.av img`, line-253 nav logo).
3. `outline-offset` is `0px` in one and `-1px` in the other — the intent (inset, so the bounding box does not grow) only survives by cascade accident.

**Fix.** Delete the `img { … }` + `@media (prefers-color-scheme: dark)` pair from
`styles/v6.css` entirely (keep its `.avatar img, .aq-nav img, [class*="icon"] img,
.sticker img, .emoji-img, img[width="16"]…` exclusion list). In `index.css`, make the
single surviving rule:

```css
img:not(.no-outline) {
  outline: 1px solid rgba(0, 0, 0, 0.1);
  outline-offset: -1px;
}
@media (prefers-color-scheme: dark) {
  img:not(.no-outline) { outline-color: rgba(255, 255, 255, 0.1); }
}
```

Matching selector on both, `outline-color` alone in the dark block so the shorthand
cannot clobber it. `styles/routes/feed.css`'s `.feed-card-media img` pair (white in
dark, `[data-theme="light"]` override to black) then becomes redundant and should be
deleted — it is the same rule stated a third time.

---

## P0-4 · Modals: four scrim implementations, no exit animation anywhere, three with no enter animation

Five parallel modal treatments, all reachable in one session:

| Treatment | Files |
| --- | --- |
| `.modal-back` / `.modal` CSS classes (fade 0.2s + `modal-in 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)`) | `director/AccountApprovals.tsx`, `director/AchievementReviews.tsx`, `director/MemberDirectory.tsx`, `director/PostModeration.tsx`, `director/YearbookManagement.tsx`, `profile/AddAchievementModal.tsx`, `profile/EditAchievementModal.tsx` |
| framer-motion, per-file config | `feed/CreatePostModal.tsx`, `components/PostFocusModal.tsx`, `components/ImageLightbox.tsx`, `profile/BreakModal.tsx`, `profile/AddAchievementModal.tsx`, `profile/EditAchievementModal.tsx`, `teams/AddMemberModal.tsx`, `components/ApprovedWelcomeModal.tsx`, `components/BirthdayPopup.tsx` |
| Hand-rolled inline scrim, **no animation at all** | `director/SopManagement.tsx` (`position: fixed, inset: 0, zIndex: 200, background: rgba(0,0,0,0.6), backdropFilter: blur(4px)`), `director/TeamManagement.tsx` (twice — `zIndex: 200` and `zIndex: 210`, `rgba(0,0,0,0.7)`, `blur(6px)`), `public/HomePage.tsx` (notice-board editor), `public/OpportunitiesPage.tsx` (opening editor) |
| `.pm-overlay` (own CSS file) | `director/ProjectModal.tsx` |
| `.adm-sheet-back` (own CSS file) | `director/adminKit.tsx` |
| Dead Tailwind (P0-1) | `components/Modal.tsx` → `teams/CreateTeamPostModal.tsx`, `teams/JoinRequestModal.tsx` |

Three separate problems:

1. **No exit animation exists anywhere.** `.modal`/`.modal-back` are CSS keyframe enters; on close the component unmounts and the modal vanishes on a single frame. The framer-motion set has `AnimatePresence` but most panels declare only `initial`/`animate`, no `exit` for the panel (`ImageLightbox` and `PostFocusModal` are the exceptions). Skill principle 6: exits should exist and be softer than enters.
2. **Four modals have no enter animation at all** — `SopManagement`, both `TeamManagement` dialogs, `HomePage`'s notice-board editor, `OpportunitiesPage`'s opening editor. They pop.
3. **Scrim values disagree**: `rgba(0,0,0,0.5)` + `blur(6px)` (`.modal-back`), `rgba(0,0,0,0.6)` + `blur(4px)` (`SopManagement`, `HomePage`, `OpportunitiesPage`), `rgba(0,0,0,0.7)` + `blur(6px)` (`TeamManagement` delete). `z-index` disagrees too: `150`, `200`, `210`, `500`.

**Fix.** One `components/Dialog.tsx` built on `AnimatePresence` + the P0-2 variants,
replacing all five treatments:

```tsx
// scrim
<motion.div className="modal-back"
  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
  transition={scrimFade} />
// panel
<motion.div className="modal" variants={isPhone ? sheetIn : panelIn}
  initial="hidden" animate="visible" exit="exit" />
```

Token the scrim once in `styles/tokens.css`:

```
--scrim: rgba(10, 10, 10, 0.55);
--scrim-blur: 6px;
--z-modal: 200;
--z-lightbox: 500;
```

and point `.modal-back`, `.pm-overlay`, `.adm-sheet-back` and the four inline scrims at
them. Keep `useDialog` (escape / focus trap / scroll lock) as the single behaviour hook —
it already exists and `Modal.tsx` already consumes it.

**Guardrail check:** every one of these dialogs owns a mutation. The submit handler,
its `disabled` in-flight state, its toast and its confirm must be carried over
untouched; only the container changes.

---

## P0-5 · Hit areas below 40×40 on the app's three most-used controls

**Files:** `styles/v6.css` (`.chip`, `.btn-sm`, `.btn-icon`), `components/Toast.tsx`

- `.chip { padding: 5px 12px; font-size: 12px; border: 1.5px solid }` → **~27px tall.** This is the category filter on the feed, the status filter on `MyPostsPage`, the tag row on every post card, the `STATUS_FILTERS` row — the single most-tapped control in the member app.
- `.btn-sm { padding: 6px 12px; font-size: 12px }` → **~30px tall.** Used on every director row, every team tab, `PendingPostsTab`'s approve/reject pair, `AchievementsList`, `BlogPostPage`'s share.
- `.btn-icon { padding: 8px; aspect-ratio: 1 }` at the default 14px font → **~34px.**
- `Toast.tsx` dismiss button: `padding: 2, fontSize: 14, background: none` → **~18×18px**, and it sits immediately beside the toast's own `onClick={close}` surface, so the two hit areas overlap (the skill explicitly forbids that).

`styles/routes/feed.css` already patches one instance (`.feed-card-foot .btn { min-width: 44px; min-height: 44px; padding: 10px }`) — proof the problem was seen once and fixed locally instead of at the source. Guardrails §2 sets the floor at 44×44 on phone with exactly two documented exceptions, both in `director.css`; neither covers `.chip` or `.btn-sm`.

**Fix.** At the source in `styles/v6.css`, growing the hit area without changing the
visual size (the pills must not get chunkier — that would break the frozen layout):

```css
.chip { position: relative; }
.chip::after {
  content: ""; position: absolute; left: 0; right: 0;
  top: 50%; transform: translateY(-50%);
  height: 44px; min-width: 44px;
}
.btn-sm { position: relative; }
.btn-sm::after { content: ""; position: absolute; inset: -7px -0px; }
.btn-icon { min-width: 40px; min-height: 40px; }
```

For `.chip` in a horizontally-scrolling row, the pseudo-element must not overlap its
neighbour — with the existing `gap: 8px` on `.home-mobile-cats` a 44px band on a 27px
pill overhangs 8.5px above and below only (vertical), so horizontal overlap does not
occur; do **not** add horizontal inset.

Delete the now-redundant `.feed-card-foot .btn` override in `styles/routes/feed.css`.

For `Toast.tsx`: give the dismiss button `minWidth: 40, minHeight: 40, display: 'inline-flex',
alignItems: 'center', justifyContent: 'center', margin: -6` and **remove the
`onClick={close}` from the toast container** — a 340px click-anywhere-to-dismiss
surface overlapping a dedicated close button and an action button is three
overlapping hit areas. Keep `cursor: default` on the container.

---

# P1

## P1-1 · `.chip` has no press state on pointer devices, and an untokenised transition

`styles/v6.css`:

```css
.chip { … transition: transform 0.15s; }
.chip:hover { transform: translateY(-1px) rotate(-1deg); }
```

`.chip:active { transform: scale(0.96) }` exists **only inside `@media (hover: none)`**.
On a desktop/trackpad the app's most-clicked control gives no press feedback at all.
`transition: transform 0.15s` also omits the timing function, so it falls back to the
CSS default `ease` while 74 other declarations in the same file use `var(--ease-out)`.

**Fix:** move `.chip:active { transform: scale(0.96); }` out of the `hover: none` block
to the base layer (immediately after `.chip:hover`), and change the transition to
`transition: transform 0.15s var(--ease-out), background 0.15s var(--ease-out), box-shadow 0.15s var(--ease-out);`.

## P1-2 · Easing and duration drift — 11 raw curves against a 3-curve token contract

`styles/tokens.css` states "Three curves, and only three": `--ease`
`cubic-bezier(0.16, 1, 0.3, 1)`, `--ease-out` `cubic-bezier(0.2, 0, 0, 1)`, `--ease-pop`
`cubic-bezier(0.34, 1.56, 0.64, 1)`. Live counts outside `tokens.css`:

| Raw literal | Count | Files |
| --- | --- | --- |
| `cubic-bezier(.2,.7,.2,1)` | 15 | `public/BrandPage.css` (12), `public/QuickLinksPage.css` (2), `components/AuthShell.css` |
| `cubic-bezier(0.18, 0.89, 0.32, 1.28)` | 3 | `styles/v6.css` (`modal-in`) |
| `cubic-bezier(.4,0,1,1)` | 3 | `components/WelcomeOverlay.css` |
| `cubic-bezier(.2,.9,.24,1.02)` | 3 | `components/WelcomeOverlay.css` |
| `cubic-bezier(0.36,0.07,0.19,0.97)` | 3 | `auth/RegisterPage.css`, `components/AuthShell.css`, `styles/v6.css` |
| `cubic-bezier(.34,1.7,.5,1)` / `cubic-bezier(.34, 1.4, .5, 1)` | 2 | `components/HomeIntro.css`, `components/Mascot.css` |
| `cubic-bezier(0.3, 1.5, 0.5, 1)`, `cubic-bezier(.55,.06,.28,1)`, `cubic-bezier(.5,0,.2,1)` | 3 | `styles/v6.css`, `components/AQFooter.css` |

Durations are worse: 15 distinct values across the CSS layer (`0.1s`, `.12s`, `0.12s`,
`.14s`, `0.14s`, `.15s`, `0.15s`, `.16s`, `0.16s`, `.18s`, `0.18s`, `.2s`, `0.2s`,
`0.22s`, `220ms`, `0.25s`, `0.3s`, `150ms`) with no `--dur-*` token at all.

**Fix.** Add to `styles/tokens.css` beside the three curves:

```
--dur-fast:  120ms;   /* press, hover, colour */
--dur-base:  180ms;   /* icon swap, chip, card lift */
--dur-slow:  280ms;   /* route enter, modal panel, toast */
--ease-shake: cubic-bezier(0.36, 0.07, 0.19, 0.97);  /* the error shake, used 3× */
```

Then: replace all 15 `cubic-bezier(.2,.7,.2,1)` with `var(--ease)` (they are visually
near-identical — `.2,.7,.2,1` vs `.16,1,.3,1` — and BrandPage/QuickLinks are the two
files still carrying a private curve); replace the three `0.36,0.07,0.19,0.97` with
`var(--ease-shake)`; replace `modal-in`'s `0.18, 0.89, 0.32, 1.28` with `var(--ease-pop)`;
keep `WelcomeOverlay`'s four (it is a one-shot seal-break sequence with a deliberate
custom feel — document the exception in the file header rather than tokenising it).
Snap every duration to the three `--dur-*` values.

## P1-3 · `Toast.tsx` ignores `prefers-reduced-motion` and double-announces

`components/Toast.tsx` is the only motion-bearing shared primitive with **no**
`useReducedMotion` and no `@media (prefers-reduced-motion)` guard. It always animates
`transform: translateX(110%) → translateX(0)` over `EXIT_MS` (280ms).

The global catch-all in `styles/v6.css` (`*, *::before, *::after { transition-duration:
0.01ms !important }`) does neutralise it by accident, but the toast is an inline `style`
transition on a portal element and the JS timers (`setTimeout(close, EXIT_MS)`) still
hold the mounted-but-invisible slot for 280ms — the exact drift the file's own comment
says was fixed.

Separately: `role="status"` is on **both** the container div (with `aria-live="polite"
aria-atomic="true"`) and each `ToastItem`. Nested live regions announce twice on
NVDA/VoiceOver.

**Fix:** import `useReducedMotion` from `framer-motion` in `ToastItem`; when reduced,
set `transform: 'none'` and drive only `opacity`, and set a local `const EXIT = reduced ? 0 : EXIT_MS`
used by both the CSS transition and the two `setTimeout`s. Remove `role="status"` from
`ToastItem` (keep `tabIndex={0}` and the Escape handler); the container's live region
is the correct single announcement point.

## P1-4 · Bare `'…'` in-flight labels collapse the button and shift the row

Buttons that swap their whole label for a single ellipsis while a mutation is in flight —
the button loses ~60px of width mid-press and the row reflows under the user's finger:

- `director/AccountApprovals.tsx` — `{isRejecting ? '...' : …}`
- `director/AchievementReviews.tsx` — `{isRejecting ? '…' : …}`
- `director/PostModeration.tsx` — `{isAsking ? '...' : …}` and `{isRejecting ? '...' : …}`
- `director/VolunteerApplicationsParts.tsx` — `{marking ? '…' : …}` (×2)
- `teams/detail/PendingPostsTab.tsx` — `{approvingPost === post.postId ? '…' : '✓ approve'}` and `{approvingPost === post.postId ? '…' : 'confirm reject'}`

The rest of the app already does this correctly (`'saving…'`, `'exporting…'`,
`'inviting…'`, `'syncing…'`, `'completing…'`, `'redeeming…'`).

**Fix:** replace each with verb + ellipsis matching the resting label
(`'rejecting…'`, `'asking…'`, `'marking…'`, `'approving…'`) **and** add
`aria-busy={inFlight}` plus a width floor so even the verb swap cannot shift the row:
put `min-width: 11ch` on the affected `.btn-sm`. Also mix `'...'` → `'…'` consistently
(three ASCII triples remain: `AccountApprovals`, `PostModeration` ×2,
`WhatsAppTemplates`, `RegisterPage`).

## P1-5 · Clipboard actions that lie, and one that says nothing at all

- **`public/BlogPostPage.tsx`**, the `↗ share` button: `if (typeof navigator.share === 'function') navigator.share({…}).catch(() => {}) else navigator.clipboard.writeText(url).catch(() => {})`. On desktop the URL is copied and **nothing visible happens** — no toast, no "copied" state, no label change. On failure, also nothing. The file imports no toast at all. This is the clearest "missing micro-interaction where the user expects feedback" on the public site.
- **`director/YearbookManagement.tsx`** `copyHrPrompt`: `try { await navigator.clipboard.writeText(text) } catch {}` then an **unconditional** `toast.success('copied - paste it wherever.')`. It reports success after a failure.
- **`public/BrandPage.tsx`** `copy()`: `try { navigator.clipboard?.writeText(text) } catch { /* no-op */ }` then `setCopied(key)` regardless — same lie, and the un-awaited promise means a rejection is unhandled rather than caught.

**Fix.** `BlogPostPage`: import `useToast`, and on the clipboard branch
`await navigator.clipboard.writeText(url); toast.success('link copied')` inside a
try/catch whose catch fires `toast.error('couldn’t copy that.', 'your browser blocked
clipboard access.')`. `YearbookManagement` and `BrandPage`: move the success call
**inside** the `try`, after the `await`, and give the `catch` the same error toast
`WhatsAppTemplates.tsx` already uses (it is the one file that gets this right —
copy its exact wording so the copy stays frozen).

## P1-6 · Four routes render with no enter transition

`.route-enter` (`routeIn 0.22s var(--ease-out)`, `opacity 0 → 1`, `translateY(8px) → 0`)
is on 47 components. Missing from four real routes:

- `auth/LoginPage.tsx`
- `auth/RegisterPage.tsx`
- `drives/DriveCheckIn.tsx`
- `drives/DriveWrap.tsx`

`LoginPage` and `RegisterPage` are the first screen a new volunteer sees, and both
already sit inside `AuthShell`. **Fix:** add `route-enter` to `AuthShell`'s outermost
wrapper (covers both auth pages in one change, and `PendingApprovalPage` /
`AuthCallbackPage` for free) and to the top-level `<div>` of `DriveCheckIn` and
`DriveWrap`. The `@media (prefers-reduced-motion) { .route-enter { animation: none !important; opacity: 1 !important } }`
rule in `styles/v6.css` already covers them.

## P1-7 · Press scale below the 0.95 floor in three places

The skill's rule, restated in `lib/motion.ts`: always `0.96`, never below `0.95`.

| File | Selector | Current | Fix |
| --- | --- | --- | --- |
| `director/ProjectManager.css` | `.pm-star-btn:active` | `scale(0.88)` | `scale(0.96)` |
| `styles/routes/director-people.css` | `.admin .mdir-copybtn:active` | `scale(0.9)` | `scale(0.96)` |
| `components/WelcomeOverlay.css` | `.aqwel-x:active` | `scale(.94)` | `scale(0.96)` |

Also worth normalising for consistency (currently a spread of 0.97 / 0.98 / 0.985 / 0.99
chosen per file): `components/WelcomeOverlay.css` `.aqwel-btn-primary:active scale(.97)`,
`director/ProjectModal.css` `.pm-adv-toggle:active scale(0.98)` and
`.pm-tab/.pm-mtab/.pm-ghost-btn:active scale(0.97)`, `teams/TeamsPage.css`
`.team-card:active scale(0.97)`, `styles/routes/home.css` `.launchtile:active scale(0.97)`.
The intentional exceptions are the large card surfaces where 0.96 over a 400px card is
too much travel — `0.985` on `.post-card`, `.feed-card`, `.card-hover` is correct and
should stay. Rule to state in `v6.css`: **controls 0.96, cards 0.985, nothing else.**

## P1-8 · Entrance stagger exists in two forms and covers eight surfaces out of ~30

Two mechanisms: `.stag` (CSS, `nth-child` delays 0.02s → 0.50s, capped at child 9) and
`Reveal`/`RevealGroup` (framer-motion, `whileInView`). Live coverage:

- `.stag` — `public/MembersPage.tsx` (×3), `public/OpportunitiesPage.tsx`, `public/PublicProjectsPage.tsx`, `public/BlogListPage.tsx`, `profile/PublicProfilePage.tsx`, `teams/detail/OpeningsTab.tsx`
- `Reveal` — `public/PublicProjectsPage.tsx`, `teams/TeamsPage.tsx`
- Bespoke — `styles/routes/feed.css` `.home-feed-list .feed-card` (`feedCardIn 0.28s`, staggered to child 5 only)

No stagger, and these are all first-paint lists: `search/SearchPage.tsx` results,
`feed/NotificationsPage.tsx`, `feed/SavedPostsPage.tsx`, `calendar/CalendarPage.tsx`,
`profile/AchievementsList.tsx`, `teams/detail/MembersTab.tsx`,
`teams/detail/PendingPostsTab.tsx`, `public/PublicProjectDetailPage.tsx` gallery,
`public/CollaborationsPage.tsx`, `public/ClassesPage.tsx`.

**Fix.** Pick `.stag` as the one mechanism for lists rendered at mount (no
framer-motion cost, already reduced-motion guarded at `styles/v6.css` line ~1477) and
reserve `Reveal` strictly for below-the-fold scroll reveals. Add `className="stag"` to
the direct parent of each list above, and make `.stag > *` inherit `routeIn` rather than
requiring the child to declare its own animation — currently `.stag` only sets
`animation-delay`, so a child with no `animation` gets nothing. Add:

```css
.stag > * { animation: routeIn 0.28s var(--ease-out) both; }
```

immediately before the existing `.stag > *:nth-child(n)` delay block. Verify
`public/MembersPage.tsx` and `teams/detail/OpeningsTab.tsx` still look right — they may
already be relying on a child-level animation.

Also raise `.home-feed-list`'s stagger cap from 5 to 8 children to match `.stag`, or
fold it into `.stag` outright.

## P1-9 · `.btn`, the most-used class in the app, transitions on the bare CSS `ease`

`styles/v6.css`:

```css
.btn { transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease, color 0.12s ease, border-color 0.12s ease; }
```

Explicit properties (good) but `ease` (`cubic-bezier(0.25, 0.1, 0.25, 1)`) instead of
`var(--ease-out)`, which the surrounding 74 declarations use. The hover lift
(`translate(-2px,-2px)`) reads slightly soggier than every neighbouring control.

**Fix:** `transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);`

---

# P2

## P2-1 · `LikeButton`'s `prevLiked` ref never advances after a like

`components/v6Shared.tsx`:

```tsx
useEffect(() => {
  if (liked && !prevLiked.current && !reduced) {
    setJustLiked(true)
    const t = setTimeout(() => setJustLiked(false), 500)
    return () => clearTimeout(t)          // ← returns before the assignment
  }
  prevLiked.current = liked
}, [liked, reduced])
```

The early `return` skips `prevLiked.current = liked`, so the ref stays `false` for the
whole time the post is liked. It happens to work (the next run is the unlike, which
sets it to `false` again), but any added dependency, StrictMode double-invoke, or a
`liked` value arriving from a server refetch will fire the burst a second time on an
already-liked post.

**Fix:** assign before the branch — `const wasLiked = prevLiked.current; prevLiked.current = liked;`
then `if (liked && !wasLiked && !reduced) { … }`.

Also: the burst's own timer is `500ms` while `likeBurst`'s transition is `0.28s`. Set
the timeout to `300` so `justLiked` clears just after the animation instead of holding
the particle layer mounted for 220ms of nothing.

## P2-2 · `will-change` applied at `:hover` is a no-op

`styles/routes/projects.css`:

```css
@media (hover: hover) { .pcard:hover .pcard-img-el { transform: scale(1.05); will-change: transform; } }
```

`will-change` promotes on the frame it is *applied*, which here is the same frame the
transform starts — so it buys nothing and costs a layer for the whole hover. The skill's
rule is "only add when you notice first-frame stutter", and never on the same rule as
the change.

**Fix:** drop `will-change` from this rule. `transform` on an `<img>` inside an
`overflow: hidden` parent already composites. If stutter is measured, move
`will-change: transform` onto `.pcard-img-el` unconditionally *and* cap it —
but measure first.

Same review needed for `public/OnboardingPage.css` (three `will-change` declarations,
one of which is `will-change: transform, opacity`) and `director/DirectorDashboard.css`.
`components/HiStrip.css`, `components/Mascot.css` and `components/ParadoxBanner.css` are
on infinite marquee/float animations and are legitimate.

## P2-3 · Three duplicated `prefers-reduced-motion` catch-alls in one stylesheet

`styles/v6.css` declares the `*, *::before, *::after { animation-duration: 0.01ms !important; … }`
block **twice** (once around the "PRODUCTION POLISH" section, once under
`C1 - Global prefers-reduced-motion catch-all`), plus a third narrower block
(`.deco`, `.stag > *`) and a fourth (`.aq-mega`). Guardrails §0 says consolidate.

**Fix:** keep exactly one catch-all (the `C1` one, it is the better-documented), fold
`.marquee-track`, `.wobble`, `.spin-slow`, `.sticker-float`, `.route-enter`, `.deco`,
`.stag > *`, `.aq-mega`, `.aq-mega-cta`, `.aq-tab-fab-ring` into it as named
`animation: none !important` overrides, and delete the other three blocks.

## P2-4 · `.avatar:hover` is a 10% scale plus a 4° rotation

`styles/v6.css`: `.avatar:hover { transform: scale(1.1) rotate(-4deg); }` with
`transition: transform 0.2s var(--ease-pop)`. On a 36px avatar in a dense list
(`MembersTab`, `PendingPostsTab`, `PostComments`, `MemberDirectory`) a 10% scale with an
overshoot curve reads as a jolt, and the rotation makes the circle's ink border visibly
wobble against the row's dashed divider.

Against the "fresher, cleaner, modern without reading as AI slop" brief this is the
kind of motion that dates a UI. **Fix:** `transform: scale(1.04)` with
`var(--ease-out)`, drop the rotation. Keep the rotation only on the standalone
profile-header avatar if the brand wants it there.

## P2-5 · `ShareModal.handleCopy` falls back to `document.execCommand` and reports success either way

`components/ShareModal.tsx`: on a clipboard rejection it builds an offscreen `<input>`
and calls `document.execCommand('copy')` — deprecated, silently returns `false` in
several browsers — then sets `copied` unconditionally. Same class of lie as P1-5, one
tier down because the fallback usually works.

**Fix:** capture `const ok = document.execCommand('copy')`, and only
`setCopied(true)` when the primary write resolved or `ok === true`; otherwise
`toast.error('couldn’t copy that.', 'select the link and copy it manually.')`.

## P2-6 · `MembersTab`'s member-options button has no hover treatment

`teams/detail/MembersTab.tsx` — the `<I.more />` trigger is `className="btn btn-icon btn-sm"`,
so it inherits `.btn:hover { transform: translate(-2px,-2px); box-shadow: var(--sh) }`.
On a 34px circular icon button inside a 52px row, a 2px diagonal lift plus a hard offset
shadow reads as the button falling out of the row. Every comparable trigger in the HoD
desk uses `.iconbtn` instead, which lifts 1px and swaps `border-color`.

**Fix:** add a shared `.btn-icon:hover { transform: translate(-1px,-1px); box-shadow: 2px 2px 0 0 var(--ink); }`
override in `styles/v6.css` right after `.btn-icon`, so every circular icon button in
the app gets the lighter treatment without touching `.btn`.

## P2-7 · `styles/v6.css` line ~253 kills the global image outline with `!important` and a stale comment

`outline: none !important; /* override global img outline from aq-design-system */` —
`aq-design-system.css` was deleted (see `main.tsx`'s header comment). The rule still
does something (it beats both P0-3 rules), but its stated reason no longer exists.
Re-derive whether the nav logo actually needs it once P0-3 lands, and either delete it
or replace the comment with the real reason (`.no-outline` should be the mechanism).

---

## Not findings — recorded so the next pass does not re-litigate them

- **The HoD desk is motion-light on purpose.** `director/*` has `iconbtn`/`adm-pill`/`adm-row` press states, a ledger-row stagger and a stamp keyframe, and nothing else. Per `adminKit.tsx` and guardrails §5 ("chrome is brutalist, data is legible") that is correct. Do not add `Reveal`, `CountUp` or panel springs to the desk.
- **Hard offset shadows instead of layered soft shadows.** The skill's principle 3 ("shadows over borders", layered transparency) is deliberately *not* the house style: guardrails §3 pins `--shadow-cta: 1.5px 1.5px 0 0 rgba(10,10,10,.5)` on primary CTAs, stickers and one hero card per screen, with everything else flat behind a 2px ink border. Do not convert these to layered shadows.
- **Concentric radius is already tokenised.** `--r-card: 26px` / `--r-photo: 18px` with a documented 8px inset. Spot-checks on `.post-card`, `.pcard`, `.team-card` and the `.modal` header all hold. No violations found.
- **`transition: all` is genuinely absent.** Three grep hits, all comments.
- **`.stag` and the feed-card stagger are reduced-motion guarded.** So are `Reveal`, `CountUp`, `StatCountUp`, `SuccessCheck`, `ImageLightbox`, `ApprovedWelcomeModal`, `BirthdayPopup`, `ConfettiBurst`, `DynamicIslandTOC`, `ProgressiveFluxLoader`, `HiStrip`, `Mascot`, `SparklesText`, `WelcomeOverlay`, `PublicLayout`, `HomeIntro`. `Toast.tsx` is the sole exception (P1-3).
- **The feedback triad is met almost everywhere.** The gaps are P1-4 (label collapse), P1-5 (clipboard), and load-time-only silent catches in `teams/TeamDetailPage.tsx` (`fetchTeamPosts`, `fetchTeamProjects`, `fetchTeam`, and three `.catch(() => {})` on suggestion/join-request fetches). Those are reads, not mutations, and each has a visible empty state, so they sit below P2.

---

## Suggested order

1. P0-1 (broken surface — do first, it is the only thing currently rendering wrong).
2. P0-2 + P0-4 together (the variants land, then the modals consume them).
3. P0-3, P0-5, P1-1, P1-7, P1-9 (single-file CSS edits at the token/base layer — one commit).
4. P1-2 (token sweep) — after 3, so the new `--dur-*` values are only written once.
5. P1-3 → P1-8, then P2.

Gate per guardrails §6: `cd frontend && npx tsc -b && npm run build` clean,
`npm test` if `lib/roles.ts` / `lib/imageUrl.ts` / `lib/profanityFilter.ts` is touched
(none of the above touch them), and each changed screen opened in the integrated
browser against the local vite dev server.
