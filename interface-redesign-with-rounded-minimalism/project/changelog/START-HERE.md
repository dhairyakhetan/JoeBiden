# START HERE — AquaTerra redesign handoff

**What this is:** a complete visual redesign of AquaTerra, specified as blind, page-wise
instructions. **23 build files, 9 reference documents, 23 design turns.** **Same colours, same fonts, same UX, same Supabase wiring.** The UI changes; the
product does not.

**Who this is for:** an implementer working from instructions, not taste. Nothing here asks you to
make a design judgement. Where a judgement was needed, it has been made and written down.

**Design source:** `AquaTerra Feed.dc.html` — 22 turns of designs. Every changelog section names
the turn and option id (e.g. `13a`) it came from. **Open it alongside the file you are building.**

---

## The five documents that are not build instructions

| file | what it is |
|---|---|
| **`WORKFLOW.md`** | **how to build this without breaking it** — the per-file loop, the nine rules, the boundaries, definition of done |
| **`TESTS.md`** | **what to run and what each test proves** — five layers, every probe written out |
| `AUDIT.md` | the runnable grep script, 20 rules |
| `ACCEPTANCE.md` | the per-PR checklist for what greps cannot see |
| `MASTER-PLAN.md` | every surface, state, component, flow — and all decisions taken |

## Read these three first, in this order

1. **`changelog/README.md`** — the nine invariants, the concentric radius rule, the contrast
   ladder, the string-discipline rule, and the cross-file coordination points.
2. **`changelog/00-global-tokens-and-primitives.md`** — every token and primitive. Nothing else
   works until this lands.
3. **`changelog/13-sticker-system.md`** — nine surfaces depend on it.

**Then read the file for the surface you are building.** Each is self-contained and repeats the
shared rules on purpose.

---

## Build order

**This order is not a preference. Later files reference earlier ones by section number.**

| # | phase | files |
|---|---|---|
| 1 | **foundation** | `00` tokens → `13` stickers → `02` chrome |
| 2 | **cross-cutting** | `11` system states — every later file says "per `11`" |
| 3 | **the feed** | `15` post cards → `01` home/feed → `03` detail + composer |
| 4 | **identity** | `04` profile → `16` profile wall |
| 5 | **the org** | `05` teams + openings → `10` projects → `08` search |
| 6 | **the desk** | `06` primitive → `17` nav + jigsaw → `20` the 20 desks |
| 7 | **marketing** | `09` about → `07` auth + contact → `12` secondary pages |
| 8 | **motion** | `14` footer → `18` mascots + load animation |
| 9 | **last** | `19` guided demos |

**`12.7` (`/brand`) is genuinely last** — it documents the design system, so building it early
documents a system that no longer exists.

---

## The full document set

### Build instructions — 23 files

| file | surface |
|---|---|
| `00-global-tokens-and-primitives.md` | tokens, primitives, the 18 global bug fixes |
| `01-home-feed.md` | home + feed (superseded by `15` on card shape) |
| `02-global-chrome.md` | nav, bottom nav, drawer, footer shell |
| `03-post-detail-and-compose.md` | post detail, the composer, comments |
| `04-profile.md` | own + public profile, CV, certificates, break |
| `05-teams-and-openings.md` | teams list, team detail, the openings hand |
| `06-hod-desk.md` | the desk's table primitive + triage landing |
| `07-auth-and-contact.md` | login, signup, onboarding, contact |
| `08-search-saved-notifications.md` | search IA, the sheet, saved, notifications |
| `09-about.md` | About as a manifesto — **the only file that changes copy** |
| `10-projects.md` | the archive, the masonry, drive detail |
| `11-system-states.md` | **all states, once.** Read before any page file |
| `12-secondary-pages.md` | blog, labs, classes, directory, join, brand, equity, +7 |
| `13-sticker-system.md` | **build first.** 8 silhouettes × 7 hues × 3 sizes |
| `14-footer.md` | the parallax wall + activity band |
| `15-post-cards.md` | all 30 card shapes **inside `feedShape.ts`** |
| `16-profile-wall.md` | **the one new feature.** Schema, RLS, soft delete |
| `17-desk-nav-and-stats.md` | three-tier nav + the jigsaw blocks |
| `18-mascots-and-motion.md` | the three mascots, the bone, the load burst |
| `19-guided-demos.md` | **build last.** 11 sandboxed walkthroughs |
| `20-admin-desks.md` | the 20 desks `06`/`17` do not individually cover |
| `21-org-facts.md` | **every public number, computed from the database.** Buildable first, independently |
| `22-social-engine.md` | the eight social surfaces. **§22.1 is a duty — see below** |

### Reference — 4 documents

| file | what it is |
|---|---|
| `MASTER-PLAN.md` | every surface, state, component and flow; **all decisions taken** |
| `UX-GAPS.md` | 28 items: 13 shipped bugs, missing affordances, and **things that are already right and must not be "cleaned up"** |
| `SOCIAL-ENGINE.md` | feed ranking, composer, comments, recognition, notifications, sharing — a plan, not instructions |
| `WORKFLOW.md` | the build process, the nine rules, the boundaries, definition of done |
| `TESTS.md` | five test layers, every DOM probe written out |
| `AUDIT.md` | a runnable grep script — 20 mechanical rules |
| `ACCEPTANCE.md` | the per-PR checklist for what greps cannot see |
| turn `22a` in the design doc | wireframe quick-reference for all 20 desks, mobile + desktop |

---

## The four rules that govern everything

**1. The concentric radius rule.**

    outer 32 + 10px padding → inner 22 + 8px padding → tight 14

Only `999 / 32 / 22 / 14` exist, plus three documented exceptions: **6px** on a jigsaw-notched
edge (`17.2`), **6px** on an inline mention mark (`03.5.1`), **18px** on a desk checkbox.
**Any other radius is a bug.**

**2. Contrast.** Text on a saturated accent fill is **always ink** — grape and teal both fail with
paper. Paper-on-ink uses a six-rung ladder (1.00 / 0.82 / 0.78 / 0.72 / 0.60 / **0.55 floor**).
On cream the muted floor is `--ink-3`, never a raw alpha of ink. Full tables in `README.md`
invariant 7.

**3. Strings.** A **quoted** string was read from the source file named in that section — type it
exactly. **"KEEP whatever ships today"** means it was *not* read: open the file and leave it
byte-identical. Copy in the mocks is illustrative unless a section quotes it. All strings I
invented are **approved**; changing a string that already ships is still forbidden.

**4. Overlap.** Never absolutely position decoration over auto-height content. This class of defect
occurred **four times** during the design and every instance is now a reserved-space layout
instead. `README.md` has the pattern and why raising `z-index` cannot fix it.

---

## What must not change

- **No new colours.** Every hex is already in `tokens.css`.
- **No new fonts or weights.** NeutralFace · Eina01 · JetBrains Mono · Instrument Serif.
- **No route changes.**
- **No Supabase changes** — except `16` (`profile_notes` + `wall_enabled`), which is the one new
  feature and carries its own schema and policies.
- **No new dependencies.** `14` and `18` explicitly forbid an animation library: it would re-pin
  the 44.4 KB the performance audit is trying to unpin.
- **`src/paradox/**` is untouched.**
- **`lib/feedShape.ts` is the authority on which card renders.** `15` changes how cards look,
  never which one appears. Its test file must pass unmodified.
- **`/equity`'s text is verbatim from an HR document** (`12.8`). Restyle the container only.
- **`/labs` descriptions are the teams' own words** (`12.3`), including a team called
  `404-Idea Not Found`. Do not correct anything.

---

## One thing in here is a duty, not a design

**`22-social-engine.md` §22.1.** A member posts, the post enters the moderation queue, and **the
member is told nothing.** Their post is invisible to everyone with no way to know it. They conclude
the app ate it, or that nobody cared. A rejected post disappears silently, with no path forward.

**`UX-GAPS.md` item 18 records this as the clearest failure in the product.** Everything else in
this handoff is a redesign. **That one is a fix, and it should ship before any of it.**

It is blocked on one question: **does `posts` expose a readable moderation status to its author?**
If not, that single column is the highest-value schema change in this document.

## Verification — use these, they exist for the failures you predicted

| artefact | catches |
|---|---|
| **`AUDIT.md`** — a runnable grep script, 20 rules | radii, hexes, alphas, accent-as-text, typefaces, the retired motif, banned copy, new dependencies, **fixed widths without `box-sizing`**, **clipping flex rows**, and a **git-level check that `feedShape.ts` is unmodified** |
| **`TESTS.md`** — five layers of DOM probes | clipping, text-over-decoration, computed contrast, radii, hit targets, CLS, reduced motion, hard-coded statistics, plus 15 flow tests and 7 data tests |
| **`ACCEPTANCE.md`** — a per-PR checklist | the **four risks a grep cannot see**: missing states, broken Supabase wiring, the "do not clean this up" list, and stalling instead of reporting |
| **`21-org-facts.md`** | every public statistic, **computed from the database** rather than written by hand |
| the design doc, per turn | before/after comparison — every section names its turn and option id |

**`AUDIT.md` catches 5 of the 9 failure modes mechanically. `ACCEPTANCE.md` exists for the other
4**, because a page with no error state greps identically to one that has it.

**`TESTS.md` layer 3 exists because a screenshot proves nothing.** Clipping, contrast and overlap
were all measured defects in this project that looked completely fine in review — four rounds went
on absolutely-positioned decoration over auto-height content, and one on a card that occupied
116px while declaring 96px. **Measure, do not look.**

## Six numbers that block copy

`docs/BRAND_VOICE.md` §3 flags these **NEEDS HUMAN CONFIRMATION**, and the flag is blocking.
**None may ship until a human confirms them:**

1. **drives / projects completed** — `450+` (JSON-LD, stale) vs `512+` (metaConfig, About body) vs
   `534+` (About hero) vs **`550+` (the live Marquee)**. **Four values for one stat.**
2. stray dogs fed — 1,500+ vs 1,200+
3. clothes distributed — 2,500+ kg vs 950+ kg
4. Paradox 3.0's year — Jun 2024 vs Jun 2025
5. the LinkedIn slug — `aquaterrango` vs `ngo-aquaterra`
6. whether "500+ campaigns" is distinct from the projects count

**Resolution: compute them, do not confirm them.** `21-org-facts.md` specifies a build-time script
that derives every public statistic from Supabase into a generated `lib/orgFacts.ts`. **Confirming
a number by hand fixes it once and it drifts again.**

**Three of the six are not derivable** — stray dogs, clothes kg, and Paradox 3.0's date have no
table behind them. That is the useful finding: **a claim with no system of record either becomes a
constant a named human owns, or it stops being published.** `09` ships a visible confirm-me slot
until then.

**Rounding rule: always DOWN.** 2,031 → `2,000+`. Rounding up is the exact behaviour
`BRAND_VOICE.md` §3 forbids; rounding down means the real figure always exceeds the claim.

---

## Two unknowns that could change the size of the job

1. **Can `services/` be shadowed?** `19.1` — if they import the Supabase client at module scope,
   the demo system needs a service-injection refactor first. **Check this before estimating `19`.**
2. **What poses do `nolen`, `tuk` and `bhoot` actually have?** `18.0` — if each has only an idle,
   the roam becomes a translate and the reactions become scale and rotate. Fine, but different.

---

## Thirteen bugs that ship today

From `UX-GAPS.md`. **Each is fixed by a named section, and several are one-line changes with
product-wide reach:**

- **`--rust` is undefined and used in five places** — the feed's error banner has no red, the
  desk's rejected stamp is paper-on-white, and `BreakModal`'s required-field asterisk and
  validation line are **invisible**. → `00.4`, `06.0`, `04.0`
- **Every photo has a square outline drawn across its rounded corners** —
  `img:not(.no-outline) { outline }`, and `outline` ignores `border-radius`. → `00.15`
- **The brand mark renders ~5px tall in every circular slot** — `logo.png` is a 1332×225 wordmark
  in a square capsule. The square marks already exist. → `02.4`
- **Stickers render flat** — a `!important` rule cancels their own border and shadow. → `13.0`
- **A retired metric is still displayed** — `pointsTile` shows points in five of seven greeting
  recipes; the system was retired 2026-09-04. → a product deletion, needs your call
- **The Paradox banner's CTA is 3.16:1 on all 22 public routes** — one property fixes it. → `14.8`
- plus four undefined tokens, a fifth typeface, contradictory feed footer rules, and four
  `!important`-fighting media blocks.

---

## Things that are right and must not be "cleaned up"

`UX-GAPS.md`'s last section. **A redesign pass is exactly when these get deleted by accident:**

- the `headline`/`rest` word-boundary split in `FeedPostCard` — stops mid-word cuts across two
  type styles, and a `line-clamp` cannot replace it
- the category-scoped pending count in `DirectorDashboard` — without it a scoped HoD sees a global
  badge and a smaller list
- `overscroll-behavior-x: contain` on the desk's filter scroller — prevents a swipe-back that
  loses in-progress state
- `DataToolbar`'s `actionsInline` — stops a sort control being pinned 330px from its results
- `eager` on the first feed card's image — the feed has no hero, so card 0 is the LCP element
- the toast-after-write ordering on bookmark — a comment documents it as a deliberate fix
- per-row busy state in `AdminRow` — one action must not disable sibling rows
- `hasLeaderAccess` vs `isSuperAdmin` — these mirror RLS policies, not UI preference

---

## How to report back

Each file ends with **"Unresolved after this file"**. Those are real questions, not hedging.
**Answer them by reporting, not by guessing** — several are data questions where a guess would put
a false claim on a public page about a real registered NGO whose members are 14 to 19 years old.

**If an instruction contradicts the code, the code wins. Report the mismatch.**
