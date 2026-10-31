# 20 · Admin desks

**Fifteen desks** `06` and `17` do not individually cover, **plus one new one**.
**Prerequisites:** `00`, `06` (the table primitive), `11` (states), `17` (nav + jigsaw).
**No design-doc turn** — every desk inherits `06.5`, so each is a short section.

## Global invariants

1–9. **No route changes, no copy changes, no Supabase changes.**

## 20.0 · Everything inherits, nothing is bespoke

**Every desk in this file is `06.5`'s table primitive with a different column set.** If you find
yourself writing a new table, stop — the primitive was built so fifteen desks could share it.

**From `06`, unchanged and non-negotiable:**
- `AdminRow` owns its **own busy state**, so one action cannot disable sibling rows.
- `DataToolbar`'s **`actionsInline`** prop exists to stop a sort control being pinned 330px from
  the results it controls (`MemberDirectory`).
- **`overscroll-behavior-x: contain`** on every horizontal filter scroller — prevents a swipe-back
  that loses in-progress state.
- **Below 760px every table becomes a card list.** No exceptions.
- **`AdminErrorState` with `onRetry`** from `adminKit`. Never a second error component.
- **Bulk selection bar** per `06.6.2`; **sticky on phone** per `17`/`14b`.
- **Undo for reversible verdicts, `Confirm.tsx` for irreversible** (`11.12`).
- **Scoped counts.** A category-scoped HoD sees scoped numbers everywhere (`06.4.1`).

**And the four bug fixes from `06.0` apply across every desk in this file:** `--rust` →
`var(--danger)`, `--r-card` → `var(--r-outer)`, `--font-hand` removed, and the four hand-added
hexes (`#c0341f`, `#0b7d57`, `#8a6d00`, `#1769a8`) replaced with their existing `*-ink` tokens.

---

## 20.1 · Post moderation

- Columns: post preview · author · category · age · verdict.
- **Category-scoped.** `06.4.1` records that without scoping a scoped HoD sees a global badge and
  a smaller list.
- **Approve / reject inline**, undo toast, no dialog.
- **A rejection needs a reason**, and the reason must reach the author — `UX-GAPS.md` item 18 is
  the product's clearest failure: a member posts, it enters the queue, and they see nothing.
- **`15.0`'s rule 2 applies to the preview**: show what the post actually has. No placeholder image.

## 20.2 · Removed wall notes — **NEW**

From your round-three decision (`16`, unresolved 2 resolved).

- **A child of post moderation in the `the queue` group** (`17.1`) — **not a sixth group.** The
  five-glyph rail cap holds.
- Columns: note body · author · recipient · **removed by** · removed at · days remaining.
- **`deleted_by` is the whole signal:** an **author** deleting their own note is a change of mind;
  a **recipient** deleting one is a report. **Sort recipient-removals first.**
- **Read-only.** A HoD reviews; they do not restore. Restoring a note the recipient removed would
  overrule them on their own profile.
- **No notification to the author** that their note was removed or reviewed.
- **30-day window**, then it is gone. Show the countdown.

## 20.3 · Member directory (admin)

- **KEEP `actionsInline`** (20.0). This is the desk it was built for.
- Columns: member · school · role · joined · status.
- Role changes are **irreversible-ish** → `Confirm.tsx`, naming the old and new role.
- **`superOnly` filters what is visible.** Mirror, never widen.

## 20.4 · Certificates

- **`isSuperAdmin`, not `hasLeaderAccess`.** `06` records these mirror RLS, not preference.
- Columns: member · document type · note · requested · status.
- **The three document types are three different requests** (`04.5`): `a certificate`,
  `a letter of recommendation`, `a letter of volunteering`. **Do not collapse them.**
- **KEEP `STATUS_LABEL`'s `issued ✓`** including the tick — it is part of the string.
- Issuing is irreversible → confirm.

## 20.5 · Drives + attendance

**The honesty problem lives here.** `HomePage.tsx`: `drive_attendance` holds **zero rows** before
2026-08-31; digital check-in went live then and everything prior was on paper.

- **The desk must distinguish "real attendance" from "still on paper".** `06` records this as the
  desk's own framing. **Never show a paper-era drive as having zero attendees** — it has unknown
  attendees.
- Columns: drive · date · lead · signed up · checked in · status.
- **`checked in` renders the dashed live marker for paper-era drives**, never `0`.
- **This is the source of the hours figure** (`04.1`), so its integrity is load-bearing.

## 20.6 · Enquiries

- Columns: from · organisation · type · received · status.
- **`STATUS_TONE` has no "in progress"** (`UX-GAPS.md` item 21), so **two HoDs can both start
  replying.** **ADD it** — pending / **in progress** / resolved / declined, with the claimer's name.
- **`COLLAB_TYPES`** from `CollaborationsPage` drives the type filter. Import, do not retype.

## 20.7 · Applications

- Columns: applicant · role · school · applied · status.
- **`VolunteerApplications` is three files and 71KB.** **Read it before restyling** — it may have
  internal navigation that needs a tier (`17` unresolved 6).
- Rejection needs a reason that reaches the applicant.

## 20.8 · Member of the Month

- **The picked member currently goes nowhere public.** `SOCIAL-ENGINE.md`: surface it in the right
  rail and on the profile. **The data is already written — this is free.**
- **`formatPeriod`** exists in `HomePage`; reuse it.

## 20.9 · Notice board editor

- **DELETE `rgba(0,229,160,…)`** — a hand-added colour outside the palette (`06.0`).
- **KEEP** `nothing pinned yet - click edit to add posts.`
- **Three-pin cap** (`15.3`). Enforce in the editor, not just the renderer.
- **KEEP the modal's `aria-modal`, `role="dialog"` and focus trap.**

## 20.10 · Roles & permissions

- **`superOnly`.** The most dangerous desk in the product.
- **Every change is irreversible-ish → `Confirm.tsx` naming the consequence.**
- **Never let a super admin remove their own super-admin role** without an explicit second
  confirmation. Locking yourself out of the roles desk is unrecoverable from the UI.

## 20.11 · Teams admin

- Columns: team · category · lead · members · openings.
- **Team colour by palette index, never `CAT_COLORS`** (`12.5`) — five keys, eight teams.

## 20.12 · Blog admin

- Draft / published toggle, and a **preview that renders `12.2`'s real layout.** A preview that
  differs from the live page is worse than none (`03.2.6`'s Preview rule).

## 20.13 · Content / WhatsApp scripts

- **`WhatsAppTemplates` renders as a section inside a parent desk, not standalone** (`17`
  unresolved 5). **Determine the parent before placing it in the nav.**
- **§7 risk:** WhatsApp scripts are internal ops material (`09.2`). **This desk must never leak to
  a public route.** Confirm its guard.

## 20.14 · Yearbook admin

- Publishes what `/yearbook` reads (`12.9`). **Confirm the pairing.**

## 20.15 · Collaborations admin

- Pairs with `20.6`. **Confirm whether they are one desk or two** — `CollaborationsPage` is one
  public form, and two desks reading one table is a duplication.

## 20.16 · Equity / HR

- **Reads the same source document as `/equity`** (`12.8`), which is verbatim and untouchable.
- **If this desk edits that text, it is the one place a copy change is legitimate** — and it is the
  HR team's change, not a designer's.

## 20.17 · Hours ledger

- **DELETE `--font-hand` from `.ledger-empty-note`** — undefined, so it falls through to the
  device's cursive and introduces a fifth typeface (`06.0`).
- **Tabular-nums on every figure.** This is a ledger.
- **Feeds `04.1`'s hours and `20.4`'s certificates.** Its integrity is the basis of both.

## 20.18 · ProjectManager

- **Five files, 98KB** — the largest thing in the desk. **Read it before restyling** and report
  whether it is one destination or needs internal navigation (`17` unresolved 6).

## Verification

`06`'s checklist plus:
1. **One table primitive.** Grep for a second table implementation.
2. Every desk becomes cards below 760px.
3. Scoped counts verified with a welfare-only HoD.
4. **Zero `--rust`, zero `--font-hand`, zero `--r-card`, zero hand-added hexes, zero
   `rgba(0,229,160)`** across `director/`.
5. Irreversible actions confirm; reversible ones undo.
6. `superOnly` / `isSuperAdmin` / `hasLeaderAccess` gates match the existing guards exactly.
7. No zero substituted for an unavailable figure — especially `20.5`.
8. A super admin cannot remove their own role in one step.

## Unresolved

1. **`ProjectManager` (98KB) and `VolunteerApplications` (71KB)** — one destination each, or
   internal tiers?
2. **`WhatsAppTemplates`' parent desk.**
3. **`20.6` vs `20.15`** — one desk or two?
4. **`20.13`'s guard** — confirm internal ops material cannot reach a public route.
5. **Does a bulk-approve service call exist**, or is it a loop? (`17` unresolved 4.) A loop of nine
   writes with no transaction has a partial-failure UX that needs designing.
6. **Rejection reasons** — is there a field to store one, and a path to the author?
