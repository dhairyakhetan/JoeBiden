# 11 · System states

**Files touched:** `frontend/src/components/EmptyState.tsx`, `ErrorBoundary`, `Confirm.tsx`,
`Toast`, `director/adminKit.tsx` (`AdminErrorState`), every form component, `styles/v6.css`.
**Prerequisites:** `00`.
**This file exists so the other 18 stop repeating themselves.** Where a page file says "the empty
state", it means the component specced here.

## Global invariants

1–9 as in `changelog/README.md`.

## 11.0 · THE BIGGEST GAP IN THE PRODUCT

`UX-GAPS.md` item 22, restated because it is the reason this file exists:

**`00.10` ships an `[aria-invalid="true"]` style and deliberately wires it to nothing.** So today
**every form in the product reports errors as a toast, or not at all.** A toast is gone in three
seconds, does not say *which* field, and is invisible to someone who has scrolled.

**`CollaborationsPage.tsx` is the exception and therefore the model.** It already has
`fieldErrors`, `aria-invalid={!!fieldErrors.orgName}` and `<span role="alert">` per field.
**Copy that pattern; do not invent a second one.** Read it first.

## 11.1 · Page-level states — nine, for every route

Every route needs all nine considered. Most need six.

| # | state | treatment |
|---|---|---|
| 1 | **loading** | skeleton at the **real geometry** (11.2) |
| 2 | **empty** | `EmptyState` **with an action** (11.3) |
| 3 | **fetch failed** | error card **with retry** (11.4) |
| 4 | **offline** | banner + cached content if any (11.5) |
| 5 | **not found** | per resource type, never one generic page (11.6) |
| 6 | **permission denied** | mirrors the route guard, names the role needed (11.7) |
| 7 | **rate limited** | plain sentence + when to retry |
| 8 | **stale** | a refresh affordance after long idle |
| 9 | **partial failure** | render what loaded, name what did not (11.8) |

## 11.2 · Skeletons — the rule that is currently broken twice

**A skeleton must match the geometry of the thing that will replace it.**

Two live violations, both already recorded:
- **The feed's skeleton puts the avatar first**; after `15.10` the category rule and title come
  first (`01.17`).
- **The desk's landing skeleton renders a 4-up grid that reflows to 2-up** when data arrives — its
  own source comment admits this "read as the page jumping" (`06.7`).

```css
.sk        { background: var(--bg-2); border-radius: var(--r-inner); }
.sk--pill  { border-radius: var(--r-pill); }
.sk--tight { border-radius: var(--r-tight); }
@media (prefers-reduced-motion: no-preference) {
  .sk { animation: sk-pulse 1.4s ease-in-out infinite; }
}
@keyframes sk-pulse { 0%,100% { opacity: 1 } 50% { opacity: .55 } }
```

- **`prefers-reduced-motion`: the pulse stops, the blocks stay.** A static grey block is still a
  loading signal.
- **No shimmer gradient.** A sweeping highlight is a second animation and a paint cost on a cheap
  Android, and it reads as more "loading" than a pulse, not less.
- **Never a spinner where a skeleton fits.** A spinner says "wait"; a skeleton says "here is what
  is coming".
- **`aria-busy="true"`** on the container, and **one `role="status"` announcement**, not one per
  block.
- **Match the count too.** Three skeleton cards resolving into ten items is its own jump. Use the
  page size.

## 11.3 · Empty states — every one gets an action

**`EmptyState` takes `icon`/`title`/`hint` and has no action slot. Add one.** Today the feed's
empty state says `try another filter - or post the first one.` and **offers neither control**
(`UX-GAPS.md` item 20).

```jsx
<EmptyState
  icon={<Glyph/>}
  title="nothing here yet."
  hint="try another filter - or post the first one."
  action={{ label: 'Post something', onClick }}
  secondary={{ label: 'Clear filters', onClick }}
/>
```

- **SET** the container: a `var(--r-inner)` **cream well inside a white card**, centred,
  `max-width: 250px` on the text.
- **DELETE every dashed border** (`00.12`). A dashed box says "drop something here".
- **A 52px hue disc with a geometric glyph** (`13.7`), not an illustration.
- **The action is a real button.** If the hint names an action, the action must exist as a control.
- **Empty ≠ zero.** `15.12`'s `C29` is the model: *"an empty feed is an answer, not a failure."*
  A caught-up state is a success; write it as one.
- **One mascot may appear on an empty state** (`18.0`), never two.

## 11.4 · Errors — retry, and never a raw message

- **SET** the card: `var(--r-inner)` well tinted `rgba(255,77,46,.16)`, a `var(--danger)` alert
  glyph, a `700 15px` line, one sentence, and a **`Try again`** button.
- **Ink text on the tint** — `--danger` as *text* on cream fails; as a **tint ground with ink text**
  it passes.
- **`role="alert"`.**
- **Never render a raw error, a stack, or a Postgres message.** Log it; show a sentence.
- **The retry must actually re-run the fetch**, not reload the page.
- **`adminKit`'s `AdminErrorState` already does this for the desk. Reuse it — do not write a
  second.** `17` says the same.
- **`--rust` is undefined and used in five places.** `00.4`, `06.0` and `04.0` fix them.
  **Grep `--rust` and confirm zero remain** as part of this file.

## 11.5 · Offline — currently nothing, anywhere

`UX-GAPS.md` item 27. The feed leans on photography and a cheap Android on a bad connection gets
a blank 4/3 box.

- **ADD a failed-image state**: the `var(--bg-2)` block stays, with a small mono `couldn't load`
  and a retry on tap. **`onError` on the `img`.** Do not leave a broken-image glyph.
- **ADD an offline banner** at the top of the content column (not a toast — a toast expires and
  the condition does not): lemon tint, ink text, one sentence.
- **Composer and every form: preserve input.** `16.3` and `03.2.2` both specify this. **Losing a
  half-written post to a dropped connection is the worst failure in the product.**
- **`navigator.onLine` plus a failed-request signal.** `onLine` alone lies on captive portals.
- **Do not build an offline queue.** `15.14` restyles `C23` without wiring it; a real queue is a
  service change.

## 11.6 · Not found — per resource, never generic

A generic 404 for a deleted post is a dead end. Each says what was missing and offers the
containing surface:

| route | line | action |
|---|---|---|
| `/post/:uuid` | that post is gone | back to the feed |
| `/member/:uuid` | no member here | the directory |
| `/teams/:slug` | no such team | all teams |
| `/projects/:id` | write-up not found | the archive |
| unknown route | genuine 404 | home, and **bhoot** (`18.0`) |

- **A deleted-vs-never-existed distinction is not worth building.** One line covers both.
- **`404` gets the mascot; resource-not-found pages do not** — a missing post is mildly annoying,
  not an occasion.

## 11.7 · Permission denied

- **Mirror the route guard. Never widen it.** `06` records that `hasLeaderAccess` vs
  `isSuperAdmin` **mirror RLS policies, not UI preference.**
- **Name the role needed** — "this desk is for HoDs" — so a member knows whether to ask.
- **Never a login wall for an already-logged-in member.** That is the confusing failure.
- **The nav renders only permitted destinations** (`17.1`), so this page is for direct URLs.

## 11.8 · Partial failure

- **Render what loaded.** `17`: if three of six desk counts resolve, **render three blocks**, not
  six with markers.
- **Name what did not**, once, quietly. Not six error cards.
- **Never substitute a zero for a failed figure** — `15.0`'s rule 4. A zero is a claim.

## 11.9 · Form states — twelve, for every form

Forms: `ApplyPage`, `CollaborationsPage`, `ContactPage`, `EditProfilePage`, `BreakModal`, the
composer, the wall composer, the notice-board editor, every desk editor.

| # | state | treatment |
|---|---|---|
| 1 | pristine | `00.10` |
| 2 | focused | `3px solid var(--grape)`, `outline-offset: 2px` |
| 3 | filled | no special treatment |
| 4 | **field invalid** | **11.10 — the gap** |
| 5 | form error summary | one `role="alert"` above the actions, linking to fields |
| 6 | submitting | button busy, form `aria-busy`, inputs not disabled |
| 7 | success | 11.11 |
| 8 | server rejection | field errors if mappable, else the summary |
| 9 | network failure | **input preserved**, retry offered |
| 10 | unsaved-changes guard | 11.12 |
| 11 | disabled / ineligible | `var(--bg)` ground, `var(--ink-3)` text, **and a reason** |
| 12 | read-only | no field chrome at all — render as text |

**Inputs stay enabled while submitting.** Disabling them drops focus and loses the caret; a
disabled *button* plus `aria-busy` is enough.

## 11.10 · Field-level validation — the fix

```css
[aria-invalid="true"] {
  border-color: var(--danger);
  box-shadow: 0 0 0 3px rgba(255,77,46,.14);
}
.field-error {
  display: block; margin-top: 6px;
  font-family: var(--mono); font-size: 10px; font-weight: 700;
  color: var(--danger-ink);         /* #C6300F, 6.7:1 on cream */
  text-transform: none;
}
```

- **`aria-invalid` on the input, `role="alert"` on the message**, message id in
  `aria-describedby`.
- **`--danger-ink` for the text, never `--danger`.** `--danger` is a fill.
- **Validate on blur and on submit. Never on keystroke** — telling someone their email is invalid
  while they type the third character is hostile.
- **On submit, focus the first invalid field.** Do not just show messages.
- **Never colour alone.** Every error has text.
- **Copy the `fieldErrors` shape from `CollaborationsPage.tsx`.** It is the only correct
  implementation in the codebase.

## 11.11 · Success — and the ordering rule

**`FeedPostCard`'s bookmark toast fires *after* the write, not before, and its comment documents
this as a deliberate fix.** `01.15.8` preserves it.

**Make it the rule everywhere: no success message before the write resolves.** An optimistic UI
change is fine; an optimistic *confirmation* is a lie.

- **In-place success** for something that stays on screen — the control changes state.
- **A toast** for something that leaves — a submitted form, a sent request.
- **A page** for the end of a flow — an application, an onboarding.
- **Toast: welfare tint, ink text, 4s, dismissible, `role="status"`.** Never for an error that
  needs action.

## 11.12 · Destructive actions — undo over confirm

`06.6.3`'s rule, generalised:

- **Reversible → optimistic write + an undo toast.** No dialog.
- **Irreversible → `Confirm.tsx`**, naming the thing and the consequence.
- **A confirm on a reversible action is friction without safety.** A confirm on an irreversible one
  is the only protection there is.
- **`16`'s wall removal is the model**: it happens, and `Undo` sits in a tomato-tinted banner
  saying `hidden from your wall · kept for 30 days`.
- **I need the list of actions with no inverse service function** (`UX-GAPS.md` item 23) to
  finish this classification.

## 11.13 · Announcements

**`aria-live` is currently used on the feed's load-more and the desk's triage total, and nowhere
else** (`UX-GAPS.md` item 28). Optimistic like, save and bookmark changes are silent.

- **`aria-live="polite"`** on every optimistic count change, every filter result count, every
  step advance.
- **One live region per surface**, not one per control.
- **Never `assertive`** except for a genuine error.

## Verification

1. **Zero `--rust` references remain** anywhere in `src/`.
2. Every form has field-level errors with `aria-invalid` + `role="alert"` + `aria-describedby`.
3. Submit focuses the first invalid field.
4. No error is colour-only.
5. Every skeleton matches its replacement's geometry **and count**; reduced motion leaves static
   blocks.
6. Every empty state has an action, and no dashed borders exist.
7. Every error has a working retry that re-fetches rather than reloading.
8. Every image has an `onError` state.
9. No success message precedes its write.
10. Reversible destructive actions have undo, not confirm.
11. Inputs stay enabled during submit.
12. Zero horizontal overflow at 375px and 360px in every state.

## Unresolved

1. **The list of actions with no inverse service function** — blocks 11.12's classification.
2. **Is there a global `ErrorBoundary`?** If not, an uncaught render error shows a white page.
3. **Rate limiting** — does Supabase surface a 429 the UI can read?
4. **Stale data** — is there any long-lived surface where this matters, or is it theoretical?
