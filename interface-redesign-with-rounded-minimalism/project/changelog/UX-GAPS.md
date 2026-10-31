# UX gaps — affordances, success and error states

**Status:** an open list, added to as I read each surface. Not build instructions. Items marked
**bug** ship broken today; items marked **gap** are missing rather than wrong.

Each numbered per-page changelog file also carries its own "Unresolved" section for
questions specific to that file. This document is for gaps that cross files or that are about
**flow** rather than **style**.

---

## Broken today

1. **bug · the feed error banner has no red.** `HomePage.tsx` references `var(--rust)` for the
   error state's background, border and text. **`--rust` is defined nowhere in `tokens.css`.**
   Fixed in `00.4` -> `var(--danger)`.
2. **bug · rejected status stamps are invisible in the HoD desk.** Same undefined `--rust`, used as
   `background` with `color: var(--paper)` — so paper text on a near-white card. Fixed in `06.0`.
3. **bug · the mobile feed has no gap between cards.** `home.css` uses `var(--poster-gutter)` in
   three places and the token is undefined. Fixed in `00.18`.
4. **bug · feed photos have no corner radius.** `feed.css` uses `var(--r-photo)`, undefined.
   Fixed in `00.1`.
5. **bug · every photo in the product has a square 1px outline drawn across its rounded corners.**
   `index.css` sets `img:not(.no-outline) { outline: 1px solid … }` and `outline` does not follow
   `border-radius`. Fixed in `00.15`.
6. **bug · stickers render flat.** `v6.css` line ~1601 sets
   `.sticker { box-shadow: none !important; border: none !important; }`, cancelling the sticker's own
   motif. Fixed in `00.8`.
7. **bug · the brand mark renders ~5px tall in every circular slot.** `public/logo.png` is
   1332x225, a horizontal wordmark, used with `object-fit: contain` in square capsules. The square
   marks `stamp-white.png` / `stamp-ink.png` already exist. Fixed in `02.4`.
8. **bug · three hand-added colours outside the palette.** `#FF7A1A` (feed's closed-opening
   notice), `rgba(0,229,160,…)` (notice-board modal and the desk's search focus ring),
   `#c0341f`/`#0b7d57`/`#8a6d00`/`#1769a8` (desk badges, duplicating existing `*-ink` tokens).
   Fixed in `01.15.5`, `01.7` and `06.0`.
9. **bug · a fifth typeface.** `.ledger-empty-note` uses `--font-hand, 'Caveat', cursive`;
   `--font-hand` is undefined, so it falls through to the device's cursive. Fixed in `06.0`.
10. **bug · `--r-card` is undefined** and three desk rules fall back to a `26px` literal that is on
    no scale. Fixed in `06.0`.
11. **bug · a retired metric is still displayed.** `lib/gridRecipes.pointsTile` renders "your
    points" in five of seven greeting recipes; the points system was retired 2026-09-04.
    **Not fixed by any changelog file** — it is a product deletion, not a style change. Needs your call.
12. **bug · contradictory feed footer rules.** `feed.css` has a 640px block setting
    `flex-wrap: wrap` and a 760px block setting `nowrap`; 640 wins on source order, so the action
    row wraps on some phone widths and not others. Fixed in `01.15.8`.
13. **bug · four separate `@media (max-width: 600px)` blocks in `home.css`** fighting each other
    with `!important`. Merged in `01.18`.

---

## Missing affordances

14. **gap · no mobile route to notices, open roles or quick links.** Below 600px both home rails
    hide and nothing replaces them. Three whole content areas are desktop-only. Raised in `01.18`;
    the bottom nav (`02.6`) is where they would live, and it has four slots already spoken for.
    **Needs a decision.**
15. **gap · no skip-to-content link.** `PublicLayout` renders `#main-content` but nothing targets
    it. Added in `02.4`.
16. **gap · no `aria-current="page"` on nav.** Added in `02.4` and `02.6`.
17. **gap · a dead `⋮` control on the feed card.** The source comment says "removed - no action
    defined yet". `01.15.4` declines to add it back until there is an action. **What should it do?**
18. **gap · no visible signal that a post is awaiting moderation.** A member posts, the post enters
    the queue, and the member sees nothing. This is the most consequential gap in the product — see
    the social engine plan, notifications item 3.
19. **gap · no comment moderation path from the feed.** Posts have a moderation queue; comments have
    a profanity gate at write time and nothing after. A comment that clears the filter but is still
    abusive has no reporting route.
20. **gap · no empty-state action on most empty states.** `EmptyState` takes `icon`/`title`/`hint`.
    The feed's empty state says "try another filter - or post the first one" but offers neither
    control. `11-system-states.md` should give it an action slot.
21. **gap · the desk's status vocabulary has no "in progress".** `STATUS_TONE` covers pending /
    approved / rejected / queued / custom. An enquiry someone has started replying to has no state,
    so two HoDs can both start on it.

---

## Success and error states

22. **gap · no error state on any form field.** `00.10` ships an `[aria-invalid="true"]` style but
    deliberately wires it to nothing, because per-form validation is per-page work. **Every form in
    the product currently reports errors as a toast or not at all.** Needs a pass of its own.
23. **gap · destructive actions have no undo, only confirms.** `06.6.3` proposes optimistic write +
    undo toast for reversible verdicts and keeps `Confirm.tsx` for the rest.
    **I need the list of actions with no inverse service function.**
24. **good · the bookmark toast fires after the write, not before.** `FeedPostCard`'s comment
    documents this as a deliberate fix. `01.15.8` preserves it. Worth copying to every other
    optimistic action.
25. **good · per-row busy state in the desk.** `AdminRow` owns its own loading so one action cannot
    disable sibling rows. `06.6.3` preserves it explicitly.
26. **gap · skeletons that do not match what loads.** The feed's skeleton puts the avatar first;
    after `01.15.2` the photo is first. The desk's landing skeleton renders a 4-up grid that
    reflows to 2-up when data arrives — its own comment admits this "read as the page jumping".
    Both fixed in `01.17` and `06.7`.
27. **gap · no offline or failed-image state.** The feed leans on photography and a cheap Android on
    a bad connection gets a blank 4/3 box. No placeholder, no retry.
28. **gap · `aria-live` used on the load-more announcement and the desk's triage total, nowhere
    else.** Optimistic like/save/bookmark changes are silent to a screen reader.

---

## Things that are right and must not be "cleaned up"

Listed because a redesign pass is exactly when they get deleted by accident.

- The `headline` / `rest` word-boundary split in `FeedPostCard` (`LIMIT = 120`, sentence-boundary
  search, `> 40` guards). Fixes mid-word cuts across two type styles.
- The category-scoped pending-post count in `DirectorDashboard`. Without it a scoped HoD sees a
  global badge and a smaller list.
- `overscroll-behavior-x: contain` on the desk's filter-pill scroller. Prevents a swipe-back that
  loses in-progress state.
- The `actionsInline` prop on `DataToolbar`. Prevents MemberDirectory's sort control being pinned
  330px from the results it controls.
- `eager` on the first feed card's image. The feed has no hero, so card 0's photo is the LCP element.
- The `member?.uuid === post.authorUuid` self-vs-public profile branch on the card head.
- `superOnly` / `canApproveMembers` filters mirroring the route guards in both the rail and the
  landing.
- `hasLeaderAccess` for approvals vs `isSuperAdmin` for certificates — these mirror RLS policies,
  not UI preference.
