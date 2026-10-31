# 03 · Post detail and composer

**Files touched:** `frontend/src/feed/PostPage.tsx` + its CSS, `frontend/src/feed/post/*`, `frontend/src/feed/CreatePostModal.tsx`, `frontend/src/components/PostFocusModal.tsx`
**Prerequisite:** `00-global-tokens-and-primitives.md` landed and verified. `01-home-feed.md`
should also be landed — this file assumes the feed card's new order and the `.feed-*` classes it
introduces.

## Global invariants (restated — do not skip)

1. **No new colours.** Every hex below already exists in `src/styles/tokens.css`.
2. **No new fonts, no new weights.** NeutralFace · Eina01 · JetBrains Mono · Instrument Serif.
3. **No copy changes.** Every user-facing string stays byte-identical, lowercase and trailing periods included.
4. **No route changes.**
5. **No Supabase changes.** No query, `select()` list, filter, RLS policy, service signature or return shape.
6. **No new dependencies.**
7. **Hit targets >= 44x44.** Text contrast >= 4.5:1, or >= 3:1 for type >= 24px. `:focus-visible` stays `3px solid var(--grape)` at `outline-offset: 2px`.
8. **`prefers-reduced-motion` coverage must not regress.**
9. **Do not touch `src/paradox/**`.**

## The concentric rule (restated — this is the spine of the whole redesign)

    outer radius  32px   with 10px padding  ->  inner radius  22px    (32 - 10)
    inner radius  22px   with  8px padding  ->  tight radius  14px    (22 -  8)

Tokens: `--r-outer: 32px` · `--r-inner: 22px` (= `--r-photo`) · `--r-tight: 14px` ·
`--pad-card: 10px` · `--pad-inner: 8px` · `--r-pill: 999px`.

In this file it must hold at: composer sheet 32 -> field well 22 -> attachment thumbnail 14 ·
dock 999 -> dock button 999 · media pane 32 -> photo 22 -> filmstrip thumb 14 · content card 32 ->
stat well 22 · comments card 32 -> bubble 999 -> mention mark 6.

**A radius that is not 999, 32, 22, 14 or the two documented 6px exceptions is a bug.**


**Design source:** `AquaTerra Feed.dc.html` — `5a` (composer, collapsed + expanded), `5b` (detail,
desktop two-pane), `5c` (detail, phone).

**Decisions this file implements**, from the brief:
- Composer opens **minimal** — photo, body, category — with one `more` disclosure for the rest.
- Detail is **two-pane on desktop**: media left and sticky, content + comments scroll right.
- Comments are **inline on the detail page**, and stay a **sheet on the feed**.

---

## 03.1 · The ink dock — one new primitive, used twice

The composer's tools all live on a single ink capsule pinned to the bottom of the sheet. It is the
only place in the product where a row of controls sits on ink rather than on paper, and it exists
so the sheet above it can be a blank page.

```css
.aq-dock {
  display: flex; align-items: center; gap: 4px;
  background: var(--ink);
  border-radius: var(--r-pill);
  padding: var(--pad-inner);
}
.aq-dock-btn {
  width: 42px; height: 42px; flex: none;
  border: none; background: transparent;
  border-radius: var(--r-pill);
  display: grid; place-items: center; cursor: pointer;
  color: rgba(244,239,224,0.72);          /* 7.9:1 on ink — passes AA for a glyph */
}
.aq-dock-btn:hover  { background: rgba(244,239,224,0.07); color: var(--paper); }
.aq-dock-btn:active { transform: scale(0.94); }
.aq-dock-btn.is-primary { background: rgba(244,239,224,0.10); color: var(--paper); }
.aq-dock-text {
  min-height: 42px; padding: 0 13px; flex: none;
  border: none; background: transparent; cursor: pointer;
  border-radius: var(--r-pill);
  font-family: var(--eina); font-weight: 700; font-size: 11.5px;
  color: rgba(244,239,224,0.72);
  display: inline-flex; align-items: center; gap: 6px;
}
.aq-dock-meta {
  flex: 1; text-align: center;
  font-family: var(--mono); font-size: 10px;
  color: rgba(244,239,224,0.50);
  font-variant-numeric: tabular-nums;
}
/* The send button is the one hard-offset object on the dock. */
.aq-dock-send {
  width: 46px; height: 46px; flex: none; box-sizing: border-box;
  border-radius: var(--r-pill);
  background: var(--welfare); color: var(--ink);
  border: var(--bd-ink);                  /* 2px solid ink */
  box-shadow: var(--sh);                  /* 2px 2px 0 ink */
  display: grid; place-items: center; cursor: pointer;
}
.aq-dock-send:hover  { transform: translate(-1px,-1px); box-shadow: var(--sh-lg); }
.aq-dock-send:active { transform: scale(0.96); box-shadow: var(--sh-pressed); }
.aq-dock-send:disabled { opacity: 0.45; transform: none; box-shadow: var(--sh); cursor: default; }
.aq-dock-send--wide { width: auto; min-height: 46px; padding: 0 20px; font-family: var(--eina); font-weight: 800; font-size: 13.5px; }
```

**42px, not 44, for dock buttons.** They sit inside a 58px capsule with 8px of padding, and the row
carries four glyphs plus a text button plus the send button on a 390pt screen. 42px clears WCAG
2.5.8 AA (24px) comfortably. **This is the same considered trade the feed footer and the desk's
40px floor already document — do not "fix" it to 44 without removing a tool.**

## 03.2 · Composer — structural split

**File:** `frontend/src/feed/CreatePostModal.tsx` (34KB+ per the file listing; the brief called it
74KB — either way it is the largest single component in the product)

**Do not rewrite this file in one pass.** Split it first, then restyle. In this order:

1. **Extract, without changing behaviour**, into `feed/composer/`:
   - `ComposerSheet.tsx` — the shell, the open/close, the backdrop, the keyboard handling
   - `ComposerBody.tsx` — attachments row + body textarea + category chips (the always-visible part)
   - `ComposerDetails.tsx` — title, tagged members, sticker, team, link (the `more` part)
   - `ComposerDock.tsx` — the ink dock
   - `useComposerDraft.ts` — the localStorage draft hook
   **Every handler, every validation, every service call moves verbatim.** Commit this step on its
   own and verify a post still writes correctly before touching a single style.
2. **Then** apply the styles below.

**If the extraction is not acceptable, apply the styles in place and skip step 1.** The visual
result is identical; the maintenance cost is not.

### 03.2.1 · Sheet shell

- **SET** the sheet container: `border-radius: 32px 32px 0 0` (it is bottom-anchored on phone),
  `background: var(--card)`, `padding: var(--pad-card) var(--pad-card) 0`,
  `box-shadow: 0 -8px 32px -12px rgba(10,10,10,0.16)`, `border: none`.
- **DELETE** any `border: 2px solid var(--ink)` or `3px solid var(--ink)` on it, and any
  `box-shadow: Npx Npx 0 var(--ink)`.
- **On desktop**, the sheet becomes a centred card: `border-radius: var(--r-outer)` on all four
  corners, `max-width: 560px`, `box-shadow: var(--lift-4)`, backdrop `rgba(10,10,10,0.45)`.
- **KEEP** the scrim's click-to-dismiss **and KEEP whatever unsaved-changes guard exists.** If there
  is none, **that is a gap, not something to add here** — log it. Losing a half-written post to a
  stray backdrop tap is the worst failure this surface has.
- **SET** the header row: a 38px close button on `var(--bg)` at `var(--r-pill)`, then a flexible
  spacer, then the draft-state readout.
- **KEEP** the modal's existing `aria-modal`, `role="dialog"` and focus trap. **If any are missing,
  add them** — a full-screen sheet with no focus trap is a real accessibility failure.

### 03.2.2 · Draft autosave

- **ADD** `useComposerDraft`: debounce 800ms, write to `localStorage` under
  **`aq_composer_draft_v1`** and nothing else. Store body, title, category, link, sticker, tagged
  ids and team id. **Never store image blobs** — store nothing for attachments and re-prompt.
- **On mount**, if a draft exists, restore it and show the readout as `draft restored`.
  **On successful post, clear the key.** On dismiss, keep it.
- **SET** the readout to a **state span, not a button**:
  ```css
  .composer-draftstate {
    display: inline-flex; align-items: center; gap: 7px;
    min-height: 38px; padding: 0 14px;
    border-radius: var(--r-pill); background: var(--bg);
    font-family: var(--mono); font-size: 9.5px; font-weight: 800;
    text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-3);
  }
  ```
  with a 6px `var(--welfare)` dot. **It renders only when a draft actually exists in storage.**
  A "draft saved" label on an empty composer is a lie.
- **Strings this adds:** `draft saved` and `draft restored`. Both are new copy — **flag them for
  approval** rather than shipping them silently.

### 03.2.3 · Attachments

- **SET** the thumbnail row: `display: flex; gap: var(--pad-inner);` with each item
  `74x74`, `border-radius: var(--r-tight)` (14), `overflow: hidden`.
  The trailing add button is the same box on `var(--bg)` with a plus glyph.
- **ADD** a per-thumbnail state badge, 19px, top-right, `box-shadow: 0 0 0 2px var(--card)`:
  - uploading -> white circle with a dashed ring in `--ink-3`
  - done -> `var(--welfare)` circle with an ink tick
  - failed -> `var(--danger)` circle with a paper `!`, and the thumbnail at `opacity: 0.5`
  **A failed upload must be retryable by tapping the badge.** If the existing upload path has no
  retry, log it — do not ship a dead badge.
- **ADD** drag-to-reorder. **Use a pointer-events implementation, not a library** (invariant 6).
  On touch, long-press then drag. **If that is more than you want to build, ship a simpler
  affordance: a small `⇄` on each thumbnail that swaps it with the previous one.** Reordering
  matters because image 1 is the card's hero and the feed's LCP element.
- **KEEP** the existing upload service call, the file-size and type validation, and every error
  string it produces.

### 03.2.4 · Body field

- **SET** the textarea to look like nothing at all: `border: none; background: transparent;
  padding: 0; font: 400 19px/1.45 var(--eina); color: var(--ink); resize: none;`
  **ADD** `text-wrap: pretty` and an auto-grow (`rows` grows with content, no inner scrollbar
  until it exceeds the sheet).
- **19px is deliberate.** It is larger than the 16px iOS floor, so no zoom, and it is the largest
  text on the sheet — the thing you are writing should be the thing you can read.
- **KEEP** the placeholder string exactly as it is today.
- **KEEP** the profanity `checkText` gate and `BLOCK_MESSAGE` verbatim. **It is doing real work in
  a product used by minors.** It must fire on submit, not on keystroke.

### 03.2.5 · Category, with suggestion

- **SET** the chip row: a mono uppercase `suggested` label, then the suggested category as a
  **pre-selected** chip (full `var(--cc)` fill, ink text, tick glyph), then one or two alternates as
  hairline chips with a `.chip-dot`, then a `more` chip opening the full six.
- **The suggestion must be derived from text the user already typed, client-side, with a keyword
  map — no model call, no network request, no new dependency.** Keep the map in
  `feed/composer/suggestCategory.ts`, seeded from the existing `lib/categories.ts` labels.
- **The suggestion is never applied silently.** It is pre-selected and visibly overridable. If no
  keyword matches, render the six chips unsuggested with none selected and **require a choice** —
  which is the behaviour today.
- **String this adds:** `suggested`. Flag it.
- **KEEP** all six category labels and slugs from `lib/categories.ts`.

### 03.2.6 · The `more` panel

Five wells, each `background: var(--bg); border-radius: var(--r-inner); padding: 12px 14px;` with a
mono uppercase label:

1. **title** — `font: 700 17px/1.3 var(--eina); letter-spacing: -0.02em`, plus a length bar.
   The bar is a 4px `var(--r-pill)` track at 10% ink with a `var(--welfare)` fill, and a mono
   `{n}/100` readout. **The limit must match whatever the column actually allows** — read it, do not
   assume 100. **SET the bar to `var(--danger)` past the limit and disable send.**
   The label suffix renders in `var(--ink-3)` (#5A5A55, 4.6:1 on cream) — **not an alpha of ink.**
   `rgba(10,10,10,0.35)` measures 2.30:1 and fails invariant 7.
   **KEEP the label suffix `· optional`** if the field is optional today; if it is required, say so
   instead. Do not change which fields are required.
2. **tag members** — chips with a 24px avatar inside the left end, a name, and a remove ×. The
   trailing control is a pill reading `@` + `search`.
   **Reuse the member search the app already has** (`search/SearchPage.tsx` or the notice-board
   modal's member search — grep for both and use one). **Do not add a second search implementation.**
   **Writes to `post_tags`, which `ARCHITECTURE.md` documents. If the composer does not already
   write tags, this needs sign-off** — it is a new write.
3. **sticker** — a small set of preset stickers rendered exactly as `.sticker` (lemon, ink border,
   `2px 2px 0` offset, `rotate(-2.5deg)`), one selected.
   **Blocked on whether `Post` carries a `sticker` field** — unresolved item 1 in `01`. If it does
   not, **this well does not ship.**
4. **post to** — the team selector, a pill with a hue dot and the team name.
   **Only render it when the member actually belongs to a team**, and default to no team.
5. **link** — when a URL is present, a preview well: 52px `var(--r-tight)` thumb in `var(--tomato)`,
   title, mono host, remove ×.
   **Link preview fetch:** if there is no existing metadata endpoint, **do not add one.** Render the
   host and the user-typed title only, and log it. A client-side fetch of an arbitrary URL will be
   blocked by CORS in most cases anyway.

- **SET** the expanded dock: a `less` text button on the left, a mono summary in the middle
  (`{n} photos · {n} tagged`), and a wide `Post` button on the right. **KEEP the string `Post`.**
- **ADD** a `Preview` button in the expanded header that renders the post **as the feed card would
  render it**, reusing `FeedPostCard` in a read-only mode. **If `FeedPostCard` cannot render from
  unsaved local state without a service call, skip Preview** — a preview that differs from the real
  card is worse than none.

## 03.3 · Post detail — desktop two-pane

**Design:** `5b`. **Files:** `feed/PostPage.tsx`, `feed/post/*`

```css
.post-shell {
  display: grid;
  grid-template-columns: minmax(0, 1.06fr) minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  max-width: var(--frame-max);
  margin: 0 auto;
  padding: 14px var(--page-px) 64px;
}
.post-media-pane {
  background: var(--card); border: var(--hair-2); border-radius: var(--r-outer);
  padding: var(--pad-card); box-shadow: var(--lift-1);
  position: sticky; top: calc(var(--nav-h) + 14px);
}
```

- **The sticky media pane is the point of this layout.** A long thread scrolls past a photo that
  stays put. **Verify it does not exceed the viewport** — if the pane is taller than
  `100dvh - nav`, sticky positioning silently stops working. Cap the photo's
  `max-height: calc(100dvh - var(--nav-h) - 140px)` and let `object-fit: contain` handle the rest.
- **SET** the photo: `border-radius: var(--r-inner)` (22), `aspect-ratio: 4/3`, `overflow: hidden`,
  no border, no outline (`00.15`).
- **ADD** the filmstrip when there are 2+ images: 76x60 thumbs at `var(--r-tight)` (14), the active
  one marked with `box-shadow: 0 0 0 2px var(--ink)`, and a mono `{i} of {n}` pill on the right.
  **KEEP the existing lightbox** — clicking the main photo still opens `ImageLightbox`.
- **SET** the sticker overlay identically to the feed card (`01.15.3`): lemon, ink border,
  `2px 2px 0`, `rotate(-2.5deg)`, `top: 12px; left: 12px`. Slightly larger here: `11px` text,
  `7px 13px` padding.

### 03.3.1 · Content pane

- **SET** the title: `font: 700 30px/1.18 var(--eina); letter-spacing: -0.028em; text-wrap: pretty`.
  **`<h1>`, not `<h2>`** — on a detail page the post title is the page's heading.
  **Check what it is today and fix it if it is an h2.** The feed's `<h1 class="sr-only">` pattern is
  for the feed, not here.
- **SET** the author row: 38px avatar, name at `700 14px`, `VerifiedTick` for official accounts,
  mono meta line. **KEEP the existing meta construction and the `isOfficialAccount` branch.**
- **ADD** a `Follow` button, `min-height: 40px`, `var(--bg)` pill, `800 12px`.
  **Only if a follow relationship exists in the schema.** `ARCHITECTURE.md` does not obviously
  show one. **If there is no follow table, do not ship this button.** Log it.
- **SET** the body: `font: 400 16px/1.68 var(--eina); color: var(--ink-2); text-wrap: pretty`.
  **Unclamped** — this is the page where the whole post is readable. **DELETE any
  `-webkit-line-clamp` on the detail body.**
- **SET** the stat wells: a 3-up grid of `var(--r-inner)` cream wells, number at
  `900 26px var(--display)` with `tabular-nums`, mono uppercase label at `9px/800` in `--ink-3`.
- **SET** the tagged-members row: a `var(--r-inner)` cream well with `.avatar-stacked` circles
  (2px `var(--bg)` ring here, not `var(--card)`, because the well is cream) and a mono name list.
  **Same data blocker as `01.15.6`.**
- **SET** the action row: `border-top: var(--hair)`, 44px bare-glyph buttons, and a mono
  timestamp on the right. **KEEP** the like/save/share handlers and their optimistic patterns.

### 03.3.2 · Page header row

- **SET** a back link, a category pill, a share button and a bookmark button as one row of white
  `var(--r-pill)` capsules above the grid, all `min-height: 44px`.
- **KEEP** the back destination logic. If it currently hard-codes `/`, **KEEP that** — a router-history
  back that leaves the app is worse. **KEEP the string on the link.**

## 03.4 · Post detail — phone

**Design:** `5c`

- Single column, `var(--page-px)` gutter, three stacked cards: media+content (one card),
  comments (one card), and a **sticky reply bar** pinned to the bottom.
- **SET** the top bar to the segmented ink chrome from `02.5`: a 52px back capsule, a masked joint,
  and a title capsule carrying the category plus share and bookmark. **Reuse the joint mechanic
  from `02.3` verbatim.**
- **SET** the media block: photo at 22, a 4px progress track of `flex: 1` segments under it (ink for
  the current image, 15% ink for the rest), and a mono `{i} of {n}` pill bottom-right on the photo.
- **SET** the title to `700 25px/1.2`, the body to `400 16px/1.68`, the stat wells to a 3-up flex row.
- **SET** the sticky reply bar: frosted white capsule, 38px avatar, placeholder text, 42px ink send
  button. `bottom: max(16px, env(safe-area-inset-bottom))`.
  **It replaces the bottom nav on this route** — do not render both. **Confirm that is acceptable**;
  the alternative is a taller stack and a covered last comment.
- **SET** the page's bottom padding to clear the bar: `calc(58px + 32px + env(safe-area-inset-bottom))`.

## 03.5 · Comments

### 03.5.1 · The bubble

```css
.aq-comment {
  display: inline-flex; align-items: center; gap: 10px;
  max-width: 100%;
  background: var(--bg);
  border-radius: var(--r-pill);
  padding: 6px 16px 6px 6px;        /* avatar sits INSIDE the pill's left end */
}
.aq-comment-avatar { width: 32px; height: 32px; border-radius: var(--r-pill); flex: none; }
.aq-comment-text { min-width: 0; }
.aq-comment-author { font-family: var(--eina); font-weight: 700; font-size: 12px; }
.aq-comment-body  { font-family: var(--eina); font-weight: 400; font-size: 13.5px; color: var(--ink-2); }
.aq-comment-foot { display: flex; align-items: center; gap: 3px; padding: 3px 0 0 44px; }
.aq-comment-reply {
  min-height: 32px; padding: 0 9px; border: none; background: transparent; cursor: pointer;
  border-radius: var(--r-pill);
  font-family: var(--eina); font-weight: 700; font-size: 10.5px; color: var(--welfare-ink);
}
.aq-comment--reply { padding-left: 34px; }   /* == avatar width, so text aligns with the parent's */
.aq-comment-mention {
  font-weight: 800; background: rgba(10,10,10,0.07);
  border-radius: 6px; padding: 1px 5px;
}
```

**The 34px reply indent is not arbitrary** — it equals the avatar width plus the pill's left
padding, so a reply's text starts exactly where its parent's text starts.

**The 6px mention radius is the second documented exception to the radius scale**, alongside the
desk's 18px checkbox. A 14px radius on a 20px-tall inline mark makes it a lozenge that fights the
bubble it sits in. Note it in a comment.

**Known limitation:** a pill wraps badly past roughly three lines, because a 999px radius on a tall
box reads as a stadium rather than a bubble. **Cap the bubble at 4 lines with a `show more`
in-place expander, and when expanded switch the element to `border-radius: var(--r-inner)`.**
Long comments become cards; short ones stay bubbles. **If that switch looks bad in practice, tell
me and I will design a single treatment instead.**

- **The `.aq-comment-foot` buttons are 32px tall**, below the 44px floor. They are secondary
  actions on a dense thread, sitting in a 44px-tall row overall, and they clear WCAG 2.5.8 AA.
  **Give the row `min-height: 44px` so the target area is compliant even though the visible button
  is 32px.**

### 03.5.2 · Inline on detail, sheet on feed

- **The detail page renders comments inline** in a `var(--r-outer)` card: a header with
  `{n} comments` and a sort control, a compose row, the bubbles, and a
  `{n} more comments` button.
- **The feed card keeps the bottom sheet.** `01.15.9` already specs its restyle. **Both must render
  the same `.aq-comment` bubble** — one component, two containers. **Do not fork the comment
  renderer.**
- **SET** the inline compose row: cream `var(--r-pill)` capsule, 34px avatar, a transparent input,
  and a 38px ink send button. **KEEP `font-size: 16px` on the input** (iOS zoom).
- **KEEP every comment string:** `comments`, `no comments yet.`,
  `be the first to say something.`, `say something...`, `view full post →`, `Log in`,
  `to leave a comment.`
  **Note:** the placeholder is `say something...` with three periods in the source. The mock shows
  an ellipsis character. **KEEP the three periods** — byte-identical wins.
- **KEEP** the optimistic `tempComment` insert, the `isTemp` 0.55 opacity, the rollback on failure
  and the profanity gate.
- **ADD** the sort control (`newest` / `oldest`). **Client-side sort of the already-fetched array
  — no query change.**
- **ADD** a per-comment like. **Needs a table. Do not build it without sign-off** — and if it does
  not ship, remove the heart from the bubble foot rather than showing a dead control.
- **ADD** one level of replies via `parent_id`. **Needs a column. Do not build it without
  sign-off.** Until then, `reply` prefills the composer with `@name` and posts flat — which is
  useful on its own and costs nothing.

### 03.5.3 · Consolidate the duplicated helpers

`01.15.9` already flags this; restating because this file touches the same code.

- The comment sheet hand-rolls an avatar-hue hash **twice, in two places, with two different
  implementations**, while `lib/uiHelpers.hashColor` exists and is used by the card head.
  **DELETE both local versions and call `hashColor`.**
- Same for the two local `.split(' ').map(n => n[0])` initial chains — **use `getInitials`** — and
  the local `timeAgoLocal` — **use `timeAgo`**.

## 03.6 · PostFocusModal

- **KEEP** `components/PostFocusModal.tsx` mounted always with `isOpen` driving `AnimatePresence`.
  **Do not conditionally mount it** — the exit animation needs it mounted.
- **SET** its panel to `var(--r-outer)`, `border: none`, `box-shadow: var(--lift-4)`.
- **Question worth asking:** with a real two-pane detail page, does the focus modal still earn its
  place? It is a third way to read a post (card -> modal -> page). **I would remove it and route
  straight to the detail page**, but that is a UX call, not a style one. **Log it; do not act.**

## 03.7 · States

- **Empty comments:** **KEEP** `no comments yet.` + `be the first to say something.` **SET** them
  into a `var(--r-inner)` cream well inside the comments card, centred, mono sub-line.
  **DELETE any dashed border** (`00.12`).
- **Loading comments:** three bubble-shaped skeletons — a 32px circle plus a `var(--r-pill)` bar at
  varying widths, on `var(--bg-2)` (`00.16`). **The shape must match a bubble**, not a row.
- **Post not found:** **KEEP** whatever `PostPage` renders today and its string. **SET** its
  container to `var(--r-outer)` on `var(--card)`.
- **Post pending moderation, viewed by its author:** **there is no state for this today** and it is
  the biggest gap on this surface. A member who posts and then opens their own post sees it as
  normal, with no indication it is invisible to everyone else.
  **Proposal:** a lemon-tinted `var(--r-inner)` well at the top of the content pane reading that
  the post is awaiting review. **This is new copy and needs a real field to read** — flag it, and
  see `UX-GAPS.md` item 18.
- **Failed comment post:** **KEEP** the existing rollback. **ADD** a retry affordance on the failed
  bubble rather than only a toast — the toast is gone in three seconds and the comment text is lost.

## A note on strings in this file

Two forms of string instruction appear here, and the difference matters:

- **A quoted string** was read verbatim out of the source file named in that section. Type it exactly.
- **"KEEP whatever string ships today"** means it was **not** read. Open the file, use what is
  there, leave it byte-identical, and **do not retype it from this document.**

**Copy in the design mocks is illustrative unless a section quotes it.** The mocks needed plausible
sentences to lay out. Strings this file's mocks invented, which must **not** be built:

`draft saved` · `draft restored` · `suggested` · `Details` · `Preview` · `less` · `more` ·
`title` · `· optional` · `tag members` · `sticker` · `post to` · `search` · `2 photos · 2 tagged` ·
`say a bit more…` · `Follow` · `the feed` (back link) · `share` · `newest` · `14 comments` ·
`11 more comments` · `reply` · `1 of 3` · `Welfare Projects` · every sentence of the sample post
and every comment body.

**Four of those are called out in the sections themselves as new copy needing approval:**
`draft saved`, `draft restored`, `suggested`, and the pending-moderation notice in 03.7.
The strings this file quotes and which you can trust are the comment-surface ones in 03.5.2 —
`comments`, `no comments yet.`, `be the first to say something.`, `say something...` (three
periods, not an ellipsis), `view full post →`, `Log in`, `to leave a comment.` — plus `Post`.

**If an instruction quotes a string and the file disagrees, the file wins.** Report the mismatch;
do not reconcile it by editing either one. No section of this file authorises a copy change.

## Unresolved after this file

1. **`sticker` on `Post`** — does the field exist? Blocks 03.2.6 well 3 and the overlays.
2. **`post_tags` writes** — does the composer already write tags, or is that new?
3. **Link metadata endpoint** — exists, or render host-only?
4. **Follow relationship** — is there one? Blocks the Follow button.
5. **Comment likes / `parent_id`** — both need schema. Sign-off needed.
6. **Title length limit** — read the real column limit; do not assume 100.
7. **Unsaved-changes guard on the composer backdrop** — exists?
8. **Upload retry** — does the upload path support retrying one failed file?
9. **`FeedPostCard` read-only mode** — can it render from unsaved local state for Preview?
10. **PostFocusModal** — keep three ways to read a post, or route to the page?
11. **Pending-moderation state** — is there a field on the post that says so, readable by its author?
12. **Bottom nav vs sticky reply bar on the phone detail route** — confirm the reply bar wins.
