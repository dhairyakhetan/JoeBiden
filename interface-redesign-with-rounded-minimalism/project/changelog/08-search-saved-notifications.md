# 08 · Search, saved, notifications, directory

**Files touched:** `frontend/src/search/SearchPage.tsx` (+ its CSS), `frontend/src/public/SavedPage.tsx`,
`frontend/src/public/NotificationsPage.tsx`, `frontend/src/public/MembersPage.tsx` + `.css`,
`frontend/src/public/DirectoryPage.tsx`, `frontend/src/services/notificationService.ts` (read only).
**Design source:** `AquaTerra Feed.dc.html` — `17a` (search desktop), `17b` (the sheet, two detents),
`8a`/`8b` (members directory, already designed).
**Prerequisites:** `00`, `13` (stickers), `15` (cards).

## Global invariants

1–9 as in `changelog/README.md`, plus the **overlap rule**.

## 08.0 · Fix the N+1 first

The performance audit names **`SearchPage:259`** as an N+1 — the same class of bug the feed
already solved with `useFeedCardBatch`. **Fix it before restyling**, in its own commit.

- **One batched query per result page.** No per-row fetch for saved-state, author, team or match
  context.
- **The result card's "matched in" line needs a match field from the query.** If the search
  backend cannot return one, **omit the line entirely** — do not synthesise it client-side by
  re-scanning the body, and do not guess which field matched.
- **KEEP** whatever debounce exists on the input. If there is none, **add 250ms** — it is a
  performance fix, not a feature.

## 08.1 · Search — the empty state IS the design

**Design:** `17a`. The current page is a field and a blank area. The redesign gives search
something to be before you type.

- **SET** the page ground to `var(--ink)` with a **dotted grid**:
  `background-image: radial-gradient(rgba(244,239,224,.09) 1px, transparent 1px)`,
  `background-size: 22px 22px`. **22px matches `--r-inner`** so the grid is on the system's scale.
- **SET** the headline `900 clamp(34px, 5.2vw, 62px) var(--display)`, uppercase, with **one
  Instrument Serif italic word in `var(--welfare)`** (`drive,`) — the register map from `09.1`.
- **SET** the field: a full `var(--paper)` pill, `padding: 8px 8px 8px 22px`, 17px input,
  and a **50px circular ink submit** with an arrow. `box-shadow: 0 8px 28px -12px rgba(0,0,0,.5)`.
  **KEEP `font-size: 16px` minimum on the input** (iOS zoom) — 17px satisfies it.
- **The five hue discs are the browse surface.** 150px circles in the five category hues, each with
  its label on a pill that **overlaps the disc's lower edge by 16px** (`margin-bottom: -16px` on the
  disc, `position: relative` on the pill).
  - **The selected disc carries a starburst count sticker** (`13`) at its top-left, rotated −10°,
    with `box-shadow: 0 0 0 3px var(--ink)` as its die-cut keyline against the page.
  - **Only the selected disc gets a number.** A count per category means a query per category —
    **do not add five queries to decorate five circles.** Unselected labels sit on
    `var(--nav-hit)`; the selected label sits on full `var(--paper)`.
- **The discs must be real `<a>`/`<button>` elements** with `min-height: 44px` on the label pill.
  A 150px circle is a big target but the label is the affordance.

## 08.2 · Result cards

**One card, five kinds.** `drive` · `post` · `member` · `team` · `opening`.

```
[ 96×72 media/avatar/glyph, r22 ]  [ kind → context · title · why it matched ]  [ action pill ]
```

- **SET** the card to a **full saturated hue at radius 32** with `padding: var(--pad-card)`,
  **ink text throughout** (`DESIGN.md` §2). The hue comes from the result's category, or from its
  kind when it has no category.
- **The lockup line is `kind → context`** with a small arrow glyph between: `drive → welfare`,
  `member → la martiniere`, `post → aquaterra · 3h`. **Mono uppercase 8.5px at
  `rgba(10,10,10,.7)`** (5.9:1 on welfare, passes).
- **SET** the title `900 20px var(--display)` uppercase, `text-wrap: balance`.
- **SET the "why it matched" line** at `400 13px var(--eina)` in `rgba(10,10,10,.78)`, with the
  **matched term wrapped in `<mark>`** styled as
  `background: rgba(10,10,10,.14); border-radius: 5px; padding: 1px 4px; font-weight: 700`.
  **Use `<mark>`, not a `<b>`** — it is semantically a search hit and screen readers announce it.
  **Never highlight by regex on the rendered HTML** — highlight the field the query says matched.
- **SET the action pill** to `var(--ink)` with paper text, `min-height: 44px`, and **a verb that
  matches the kind**: `Open` (drive) · `Read` (post) · `Profile` (member) · `View` (team) ·
  `Apply` (opening).
- **The whole card is one `<a>`.** The pill is a visual affordance inside it, **not a nested link.**
- **The media slot has three variants:** a photo at radius 22 · an avatar disc on a
  `rgba(10,10,10,.14)` ground · a glyph on the same ground. **Never an empty box.**

## 08.3 · The filter sheet (phone)

**Design:** `17b`. **This is the component `17.1` also uses for the desk's collapsed nav — build
it once.**

```css
.aq-sheet {
  position: fixed; left: 0; right: 0; bottom: 0;
  background: var(--ink);
  border-radius: var(--r-outer) var(--r-outer) 0 0;
  padding: var(--pad-card) var(--page-px) 18px;
  box-shadow: 0 -12px 40px -8px rgba(0,0,0,0.7), 0 -1px 0 rgba(244,239,224,0.14);
  touch-action: none;                       /* the drag is ours */
}
.aq-sheet-grabber {
  width: 44px; height: 5px; border-radius: var(--r-pill);
  background: rgba(244,239,224,0.28);       /* non-text, so the low alpha is legal */
  margin: 0 auto 14px;
}
```

### Two detents, and the page behind them

| detent | sheet | page behind |
|---|---|---|
| **peek** | `height: 108px` | `transform: scale(.93) translateY(-14px)`, `border-radius: 32px`, opacity 1 |
| **full** | `top: 96px` | `transform: scale(.86) translateY(-26px)`, `border-radius: 32px`, opacity **.5** |

- **The page's scale is the whole point of the mechanic.** It tells you the page is still there and
  you are on top of it — without it the sheet reads as a navigation away. `transform-origin: top
  center` on the page wrapper.
- **No third detent.** Two states, one gesture.
- **The peek bar carries the active filter summary** — `3 results` plus a mono line naming the
  active filters (`welfare · drives · this year`). **So you never open the sheet just to remember
  what you filtered by.** That is the reason peek exists rather than a plain button.
- **The submit says how many results you will get**, computed live as filters change:
  `Show 3 results`. **If the count cannot be computed without a round-trip, say `Show results`** —
  a number that lags is worse than no number.
- **The drag:** pointer events, `touch-action: none` on the sheet, velocity-based snap to the
  nearer detent. **No library** (invariant 6).
- **A backdrop tap at full → peek**, not closed. **Peek is the resting state**; the sheet is never
  fully dismissed, because the summary is useful.
- **Accessibility, and this is not optional:**
  - the sheet is `role="dialog"` `aria-modal="true"` **only at full**, not at peek (at peek it is
    part of the page)
  - **focus moves into the sheet on open and returns to the trigger on collapse**
  - **Escape → peek**
  - the grabber is a real `<button>` with `aria-expanded` and an `aria-label`, so the sheet is
    operable **without a drag at all**
- **`prefers-reduced-motion`:** the detent change is instant, the page does not scale, and the
  opacity change is dropped. **The mechanic still works — it just does not animate.**

### Desktop

**No sheet.** Filters sit in a right rail or a popover from the `3 filters` pill. `17a` shows the
pill; the popover is the same chip groups in a `var(--card)` panel at radius 32.

## 08.4 · Saved

**No design turn.** `/saved` is the feed's card set filtered to bookmarks.

- **Reuse the cards from `15` unchanged.** A saved post is a post.
- **ADD a kind filter** (`posts` / `drives` / `openings`) as the hairline chip row from `01`.
- **Empty state:** `00.12` well + an action linking to the feed. **KEEP whatever string ships.**
- **Unsaving from this page removes the row** — with an **undo toast**, not a confirm (`06.6.3`).
  Removing something from a list of things you chose to keep needs an inverse.

## 08.5 · Notifications

**No design turn.** Depends on `SOCIAL-ENGINE.md`, which lists what earns a notification.

- **SET** rows as `var(--r-inner)` cream wells inside a white card, `min-height: 56px`,
  `display: flex; gap: 11px`: a **32px avatar or kind glyph**, the sentence, a mono age.
- **Unread rows get a 7px `var(--welfare)` dot** and `background: var(--card)` with a
  `var(--hair)`; read rows sit on `var(--bg)` with no dot. **Not opacity** — a read notification is
  not disabled.
- **Group by day** with a mono uppercase `today` / `yesterday` / date header.
- **ADD `Mark all read`** in the header. **Optimistic, with rollback.**
- **HARD RULE from `SOCIAL-ENGINE.md`: no notification without a destination.** Every row deep-links
  to the thing. A row that cannot be opened must not be generated.
- **`aria-live="polite"`** on the unread count.
- **The most important row type is `your post was approved / rejected`** — `UX-GAPS.md` item 18
  calls a member whose post sits in a queue with no signal "the clearest failure in the product".
  **If that notification does not exist yet, this file is where it gets designed but
  `notificationService` is where it gets created — and that is a service change needing sign-off.**

## 08.6 · Members directory

**Already designed:** `8a` / `8b`. Unchanged, and its constraints stand:
**name, school and role only** (`MembersPage.css` says so verbatim), **role is the filter axis**,
and **no drive count** because `drive_attendance` is empty before 2026-08-31.

## 08.7 · Directory hub

**No design turn.** `/directory` is the "pick a way in" page.

- **SET** it as a grid of the same result-card geometry from `08.2`, one per destination
  (projects · teams · members · open roles · blog · about), each in its own hue with its
  `note` string as the body. **KEEP every `note` string** — they are good copy.
- **KEEP** `DirectoryPage`'s comment that five category keys cannot serve eight teams, and its
  `/teams?category=` links.
- **The live counts on this page are the risk.** It already renders per-table counts; **keep them
  batched** and **never render a `0`** — say `nothing yet`.

## States

- **Search, no query:** the disc browse surface. **This is the default state, not an empty state.**
- **Search, no results:** replace the result list with a cream-on-ink well: the query echoed, one
  sentence, and **two escape hatches** — clear the filters (if any are active) and browse the discs.
  **KEEP whatever string ships; `01`'s `nothing here yet.` is the pattern.**
- **Search, error:** the same well with a retry.
- **Search, loading:** **three result-card skeletons at the real geometry** — 96×72 block, two text
  lines, a pill. **Not a spinner.**
- **Filters active but zero results:** the peek bar must still show the filter summary, so the user
  can see *why* there are none. **This is the case the summary earns its place in.**
- **Notifications empty:** a well with the sentence and no action — there is nothing to do.
- **Saved empty:** a well **with** an action.

## Verification

1. **`SearchPage:259` is batched.** One query per page of results.
2. No "matched in" line without a match field from the query.
3. `<mark>` for highlights, never `<b>`, and never regex over rendered HTML.
4. Ink text on every hue result card; the `rgba(10,10,10,.7)` lockup line passes 4.5:1 on all five.
5. One `<a>` per result card, no nested links.
6. The sheet: `role="dialog"` + `aria-modal` **only at full**; focus trapped and returned; Escape →
   peek; grabber is a button with `aria-expanded`.
7. The sheet works with **no drag at all** (button-only operation).
8. `prefers-reduced-motion`: no page scale, no opacity change, instant detents, mechanic intact.
9. Every notification row has a destination.
10. No `0` anywhere — `nothing yet` instead.
11. Radii only 999 / 32 / 22 / 14. Zero horizontal overflow at 375px and 360px.

## A note on strings

**Approved (bulk):** `find a drive, a person, a post.` · `sundarbans, riya, benches…` ·
`★ or browse by category` · `★ 3 results for “sundarbans”` · `3 filters` · `Filters` · `Reset` ·
`kind` / `category` / `when` / `sort` · `drives` `posts` `members` `teams` `openings` ·
`anytime` `this year` `this month` · `best match` `newest` · `Show 3 results` · `3 results` ·
`welfare · drives · this year` · `matched in the write-up` / `matched in the body` ·
`Open` `Read` `Profile` `View` `Apply` · `Mark all read` · `today` `yesterday` · `nothing yet`.

**Read from source, keep byte-identical:** every `DirectoryPage` `note` string, `MembersPage`'s
role labels, `SavedPage`'s empty string, and every existing notification sentence.

## Unresolved after this file

1. **What does the search backend actually search?** Postgres full-text, `ilike`, or client-side?
   It decides whether "why it matched" and `best match` sort are possible at all.
2. **Can the query return a match field** (which column matched, and a snippet)? Without it the
   result card loses its most useful line.
3. **Is `best match` a real sort**, or is everything date-ordered? **Do not offer a sort that does
   nothing** — `01.11` already turned a one-option sort into tabs for exactly this reason.
4. **Can the result count be computed before applying filters** (for `Show N results`)?
5. **Does `notificationService` already emit a post-approved / post-rejected notification?**
   This is the highest-value gap in the product (`UX-GAPS.md` 18).
6. **Are openings and teams searchable**, or only posts, drives and members? The chip row must
   only offer kinds that are really searchable.
7. **`/directory` vs `/search` overlap** — with a browse surface on search, does the directory hub
   still earn its own route? **A product question, not a design one.** Logging it, not acting.
