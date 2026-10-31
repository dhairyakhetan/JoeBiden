# Tastemaker implementation to-do — worked sequentially, nothing skipped

From the two `/tastemaker` studies of 2026-09-05: the About page (Sand Studio +
Radical Futures collage references) and the auth page (`rooms` inline-token
reference). Worked top to bottom. **Every item is either DONE, IN PROGRESS,
BLOCKED (with the blocker named), or DEFERRED (with the reason).**

## Decisions I took, because the answers were needed to proceed

I asked seven questions and was told to implement. Rather than stall, I took the
**safe default I had already recommended** for each. Every one is reversible and
flagged here, so overruling any of them is a small change, not a rebuild.

| # | Question | Default taken | Why this way |
|---|---|---|---|
| 1 | Auth: member initials disc as an inline token? | **CUT.** Two token kinds, not three | "Never name a member who has not opted into being named", and there is no opt-in-to-be-named column. Initials still identify a person on a **signed-out public page**. This was my stated instinct |
| 2 | A6 replaces the hero, or is a variant? | **Variant.** A6 fires for high-confidence intent rules only; today's layout stays as the cold opener | Reversible, and it keeps the eyebrow's welcome/welcome-back state working for the majority case |
| 3 | Photo tokens | **Deferred, count pills only** | All 26 Labs photos are Google Drive form URLs, and the four drive photos are not in `frontend/public/`. There is no hostable photo to point at |
| 4 | Grey/ink emphasis rhythm | **Marked in the rule table** | The alternative (grey everything but the last clause) is a guess applied to 20+ engine-generated strings. Marking it per rule is more work and far more controllable |
| 5 | About: is new copy allowed? | **NO new claims.** The manifesto reassembles frozen strings only | Section 26's rule is "every claim keeps its exact wording and survives, but gets ONE home." Inventing a sentence on the org's most-read page is the one thing not to guess |
| 6 | About: which chapter owns each drive photo? | **Not placed** | "A photo belongs to the row it sits in" has been broken three times on this project. Sundarban *suggests* 2021 and Diwali *suggests* 2024, but suggesting is not knowing |
| 7 | Torn-paper section dividers | **BUILD** | Costs nothing in palette, adds a real device the system lacks, and fits the scrapbook language |

---

## The list

### Group 1 — new files, no collision with the running poster agent

- [x] **1.1** `lib/authTokens.ts` — the A6 inline-token engine. Two kinds only
      (mono count pill, drive photo), count pills restricted to canonical
      figures, photo kind defined but unpopulated per decision 3.
- [x] **1.2** `lib/authTokens.test.ts` — regression guards: no third token kind,
      no non-canonical figure, no member name or initials can reach a token.
- [x] **1.3** Extend `lib/authCopy.ts`'s rule table with an optional
      `emphasis` + `tokens` field (decision 4). Additive only; every existing
      rule and all 15 existing tests keep passing untouched.

### Group 2 — auth page ✅ DONE, browser-verified at 390 and 1280

- [x] **2.1** `.lg-token` CSS: 40px, `vertical-align: middle`, circular, ink
      keyline. Count pill in mono.
- [x] **2.2** A6 layout in `LoginPage.tsx`, behind the variant flag from
      decision 2. Drops the eyebrow and demotes the three-step `ol` to one
      fine-print line **only when A6 fires**.
- [x] **2.3** Grey/ink emphasis rendering from the rule table.
- [x] **2.4** Desktop: two-pane at >=1025 (headline left, 420px card right),
      not a stretched phone.
- [x] **2.5** Bottom-weighted stack on phone (thumb zone).

### Group 3 — About page (unblocked, poster agent finished)

- [x] **3.1** Manifesto block between chapter 2021 and 2022, assembled from
      frozen claims only, with inline stickers replacing punctuation. Uses the
      87-piece pack that About currently does not touch at all.
- [x] **3.2** Departments as eight full-width hue rows, from
      `lib/departments.ts`'s literal tokens. Replaces the card grid.
- [x] **3.3** Torn-paper dividers — **ONE seam shipped, not three.** The seam is
      a mask on the boundary between two full-bleed grounds. Seam 1
      (`.ab-chapters-wrap`, paper → ink) is that. Seams 2 and 3 are not:
      `.ab-totals` and `.ab-cta` are ink *cards sitting on paper*, with page
      padding either side, so a torn edge there would have had nothing to tear
      against and would have rendered as a stray graphic. Building all three as
      specified would have shipped two invisible dividers.

### Group 4 — verification

- [x] **4.1** `npx tsc -b`, `npm test`, `npm run build` after every group.
- [x] **4.2** Browser check at 390 and 1280 for every changed surface.
- [x] **4.3** Append to `REDESIGN_CHANGELOG.md` with exact before to after.

---

### Group 5 — feed cards, from the 2026-09-05 property-app reference — NOT STARTED

**Blocked on the same thing section 10 is blocked on: the 30-shape catalogue in
`feed/cards/` is built and tested but still unmounted.** 5.1's attribute cluster
is a shared device in `feed/cards/parts.tsx`, so building it before the
catalogue mounts would add a device to a component tree nothing renders yet.
Mount first, then this group is small.

Added after the third `/tastemaker` study. The DNA that transfers:

- [ ] **5.1** **Attribute chip cluster on a feed card.** The reference's
      `1,200 sq ft · 3 Beds · 2 Washroom` metadata row maps onto real
      `welfare_projects` columns AQ already fetches: `location`,
      `key_statistic`, `volunteers`, `workshop_date`, `objective`. This is the
      strongest idea in the reference and it is all real data, no invention.
- [ ] **5.2** **Floating CTA pill on the card photo**, bottom-right. The photo
      is already concentric-inset (8px, radius 18) so there is a margin to sit
      it in.
- [ ] **5.3** **Two-cluster filter row** — category chips left, sort cluster
      right, matching the reference's `Rent/Buy/Sell` + `Apartment/filter`
      split. The feed already has both controls; they are not grouped.

**Where this lands:** the 30-shape catalogue in `feed/cards/` (section 10),
which is built and tested but **still unmounted**. The attribute cluster is a
shared device in `feed/cards/parts.tsx`, not a new shape.

**Does NOT transfer:** the periwinkle ground (palette is locked), the greeting
headline (already built as section 14's hi block), and the bottom dock (AQ's is
already identical to the reference by coincidence of both being correct).

## Carried forward, still genuinely open (not part of this list)

These need the user, not more implementation:

- ~~The four drive photos need a chapter mapping.~~ RESOLVED: they are stock
  placeholders per `design-reference/HANDOFF-SPEC.md:108` and do not exist in
  the repo. The chapter slots are unambiguous (2021's string names Sundarbans,
  2024's names Diwali); what is missing is real photography, not a decision.
- Feature requests 6, 9, 10, 11, 13 (poster/story share sheet, CV + certificate
  generation, member of the month, sharing own stories) still need specs.
- `paradox/pages/Home.tsx` still says "volunteers get certificates + welfare
  points"; Paradox is out of scope by the guardrails.
