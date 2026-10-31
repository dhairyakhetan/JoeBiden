# ACCEPTANCE — the per-file checklist

The audit script catches what a machine can see. **These are the four risks it cannot catch**, and
they are the ones that killed your previous handoffs.

**How to use it:** copy the relevant block into the PR description and tick every line. **An
unticked line is a blocker, not a note.** "N/A" requires a reason.

---

## A · Every file, without exception

- [ ] **I read `START-HERE.md` and `changelog/README.md` before writing code.**
- [ ] **I read the "things that are right and must not be cleaned up" section of `UX-GAPS.md`.**
- [ ] `scripts/audit-design.sh` **passes**.
- [ ] I did **not** change a route.
- [ ] I did **not** change a Supabase query, `select()` list, filter, RLS policy, service
      signature or return shape. *(Exception: `16`, which adds `profile_notes`.)*
- [ ] I did **not** add a dependency.
- [ ] I did **not** rewrite a string that already shipped. Where a section quoted a string, I typed
      it exactly; where it said "KEEP whatever ships today", **I opened the file and left it alone.**
- [ ] Every radius in my diff is `999 / 32 / 22 / 14`, or a documented exception with a comment.
- [ ] **Zero horizontal overflow at 375px AND 360px.** I checked both.
- [ ] `prefers-reduced-motion` coverage did not regress.
- [ ] **I listed the file's "Unresolved" items in my PR and answered them by reporting, not by
      guessing.** *(If I guessed at a data question, I have said so explicitly.)*

---

## B · States — the risk that "pretty pages get built and states get skipped"

**For every surface I touched, per `11-system-states.md`:**

- [ ] **Loading** — and the skeleton's geometry matches what actually arrives. I loaded it on a
      throttled connection and **nothing reflowed** when data landed.
- [ ] **Empty** — and it has an **action**, not just a sad line.
- [ ] **Error** — and it has a **retry**, not just a message.
- [ ] **Offline** — or I have stated why this surface cannot be reached offline.
- [ ] **Not found** — specific to this resource, not a generic page.
- [ ] **Permission denied** — mirrors the route guard exactly. **I did not widen access.**

**For every form I touched:**

- [ ] **Field-level errors render.** `aria-invalid`, `aria-describedby`, a visible message under
      the field, in `var(--danger-ink)`.
- [ ] **The submit button shows a busy state** and the form locks.
- [ ] **A network failure preserves what the user typed.**
- [ ] **Focus moves to the first invalid field** on a failed submit.
- [ ] I used `CollaborationsPage.tsx`'s pattern rather than inventing one.

**For every action I touched:**

- [ ] Optimistic where reversible, with **undo**; confirmed where irreversible.
- [ ] The toast fires **after** the write resolves, not before.
- [ ] `aria-live` announces the change.
- [ ] Per-row busy state — **one action does not disable its siblings.**

---

## C · The "do not clean this up" list

**Tick each one you did not break. If your diff touches any of these files, this section is
mandatory:**

- [ ] `FeedPostCard`'s `headline`/`rest` **word-boundary split** is intact (`LIMIT = 120`, the
      sentence-boundary search, the `> 40` guards). **I did not replace it with `line-clamp`.**
- [ ] `DirectorDashboard`'s **category-scoped pending count** is intact.
- [ ] `overscroll-behavior-x: contain` on the desk's filter scroller is intact.
- [ ] `DataToolbar`'s `actionsInline` prop is intact.
- [ ] `eager` on the **first** feed card's image is intact; the rest are `lazy`.
- [ ] The **toast-after-write** ordering on bookmark is intact.
- [ ] `AdminRow`'s **per-row busy state** is intact.
- [ ] `hasLeaderAccess` vs `isSuperAdmin` gates are unchanged — **these mirror RLS, not taste.**
- [ ] `isRealPostBody()` still filters junk rows.
- [ ] `splitPostBody()` is still what produces titles. **No character slicing.**
- [ ] `useFeedCardBatch` still supplies saved-state and openings. **No card self-fetches.**
- [ ] The profanity gate (`checkText` / `BLOCK_MESSAGE`) fires **on submit**, unchanged.
- [ ] `PostFocusModal` is still **always mounted** with `isOpen` driving `AnimatePresence`.

---

## D · Supabase — the risk that "wiring breaks somewhere"

- [ ] I ran every flow this surface participates in, **signed in as a real role**, and the data
      that came back is identical to before my change.
- [ ] **I tested as a scoped HoD**, not only as a super admin. Counts and lists are still scoped.
- [ ] No query gained or lost a column.
- [ ] No `.eq()`, `.in()`, `.order()` or `.range()` changed.
- [ ] **I did not add a query to make a design work.** Where a figure was unavailable I rendered the
      documented fallback (a live marker, or the element omitted) — **never a zero.**

---

## E · `15-post-cards.md` only

- [ ] `lib/feedShape.ts` is **byte-identical** — EXCEPT for comments and the
      `data:` / `dataNote:` fields of `SHAPE_CATALOGUE`, which are documentation
      of what the live table can populate, not behaviour. The chooser logic is
      still frozen: no rule, threshold, family order or return shape changes.
- [ ] `feedShape.test.ts` **passes unmodified** — with ONE recorded exception,
      authorised by the owner on 2026-09-07: the `records the shapes the real
      table cannot populate` assertion no longer lists `C03`.

      Why the exception was necessary rather than convenient: C03 is the single
      most reachable content shape (504 of 585 rows carry exactly one image; it
      measured 36 of 51 cards on the real feed), and its `data` field claimed
      `none`. The freeze meant a correct fix to the catalogue had to be
      reverted to keep a test passing that asserted something false — the
      freeze was protecting the error. Fixing the value required unpinning the
      list, so both were corrected together.

      This is not a licence to edit the test when it is inconvenient. Anything
      beyond this one id needs its own owner decision, recorded the same way.

- [ ] **SECOND owner decision, 2026-09-11.** The owner authorised two changes
      that §E had frozen. Recorded here in the same form, and for the same
      reason as 2026-09-07: in each case the freeze was protecting an error.

      **(a) Rule 3's body band moved from 240-600 to 120-600** — a THRESHOLD
      change, which the bullet above explicitly forbids without a decision.
      Measured across all 586 live feed rows: 6 bodies under 60, 225 at 60-119,
      311 at 120-179, 10 at 180-239, **0 at 240-600**, 34 over 600. The floor
      did not make the colour block rare, it made it impossible, and the
      catalogue then recorded C02 as unpopulatable *because of the threshold we
      had chosen*. Rule 3 keeps both caps (ten-row gap, different hue), so
      eligibility went 0 -> 321 rows while how many actually render is still
      capped.

      **(b) C06 and family 03's record cards now render `extras` and a
      `MetaRow`.** This is a CARD change rather than a chooser change, but it
      reverses a documented design note ("no meta row here, deliberately") so
      it is recorded too. Those cards hid their engagement row, which is
      precisely why they sat outside `SHAPED_SHAPES`: routing a real post
      through one would have silently dropped like, bookmark, comment and
      share. With the row present, 36 blog rows can use C06, and welfare drives
      that carry figures but no photo can use C11 instead of losing their
      figures to a text card.

      Consequent test edits, both in the same spirit as the 2026-09-07 one:
      the `records the shapes the real table cannot populate` list loses C02,
      C04 and C06, and `says why C06 long read has no data` becomes `...is now
      reachable`. **C01 stays in that list** — it needs an image aspect ratio
      and nothing stores width or height, so it is the one content shape still
      blocked by data rather than by a threshold or a card.

      No rule was added or removed, no family reordered, no return shape
      changed. The other 30 assertions in feedShape.test.ts pass unmodified,
      which is what shows the retune changed reach and not behaviour.
- [ ] I did not add, remove or reorder a shape or a family.
- [ ] **Rule 2:** no card borrows an image from another row, a category default or a placeholder.
- [ ] **Rule 4:** no card renders a `0` where the figure was `null`.
- [ ] C15 renders **no age**. C16 renders **no action and no `break_reason`**. C14 renders **no like**.
- [ ] Every C25 row has an `href` and a ≥44px hit area.

---

## F · Copy — the risk that "strings get rewritten"

- [ ] **No banned word** (`empower`, `noble mission`, `underserved`, `make a difference`,
      `synergy`, `holistic`). The audit checks this; I checked it too.
- [ ] **No hard-coded public statistic.** Every number comes from `ORG_FACTS` (`21`).
- [ ] **No disputed drives figure** (450/512/534/550) anywhere.
- [ ] `15,000` is always followed by **bananas**, never "meals".
- [ ] `1,200+` is always paired with **ages 14–19**.
- [ ] Emoji: **none in AquaTerra-authored copy.** The birthday 🎂 (from a DB template) is the only
      exception. User-typed emoji in user content is fine.
- [ ] **`/equity` text is untouched.** `/labs` descriptions are untouched, including
      `404-Idea Not Found`.

---

## G · Before you open the PR

- [ ] I opened **`AquaTerra Feed.dc.html`** at the turn this file names and compared side by side.
- [ ] I took a screenshot at **375px and at 1180px** and attached both.
- [ ] I stated **what should have changed** and **what should not have** — and my diff matches.
- [ ] **If an instruction contradicted the code, I reported it. I did not reconcile it silently.**
