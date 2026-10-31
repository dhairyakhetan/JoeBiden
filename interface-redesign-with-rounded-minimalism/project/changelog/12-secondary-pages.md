# 12 · Secondary pages

**Thirteen surfaces**, all inheriting the system. **No design-doc turn for these** — the language
is settled and each is a short section. **Read `00`, `02`, `11` and `13` first.**

## Global invariants

1–9 as in `changelog/README.md`. **No copy changes on any page in this file** — `09-about.md` is
the only file with that exemption.

## The blanket transform — apply to all thirteen before reading further

1. **Card shells:** `var(--card)`, `var(--hair-2)`, `var(--r-outer)` (32), `var(--pad-card)` (10),
   `var(--lift-1)`. **Delete every 2px/3px ink border and every `Npx Npx 0` offset** (`00.6`).
2. **Inner blocks** 22, **thumbnails** 14. Only 999 / 32 / 22 / 14 exist.
3. **Buttons, inputs, chips, pills** → `00`.
4. **All eight states** → `11`.
5. **No accent hue as text on cream or white.** Use its `*-ink` partner.
6. **Ink text on every accent fill** (`13.5`).
7. **Delete `img { outline }`** (`00.15`), `.torn-divider`, `.adm-tape` (`17.4`).
8. **Every page gets the `02` chrome and the `14` footer.**
9. **44px targets; 16px inputs.**
10. **Zero horizontal overflow at 375px and 360px.**

---

## 12.1 · `/blog` — `BlogListPage.tsx`

- **KEEP** the six tag chips (`sundarbans`, `winterdrive`, `paradox`, `roots`, `labs`,
  `fieldnotes`) and the serif-italic `drives` in the lede. **Restyle the chips as stamped stickers**
  (`13`).
- **The list is the `10.2` masonry**, reduced to two tile kinds: photo and text-only.
- **KEEP** the `role="alert"` on the error card; **restyle to `11.4`**.
- **C06 long read is reachable from `blogs`** (`15.15`) — a blog card may use it.

## 12.2 · `/blog/:slug` — `BlogPostPage.tsx`

- **Editorial measure:** `max-width: 68ch`, body `400 17px/1.72 var(--eina)`, `text-wrap: pretty`.
- **KEEP** `.pp-author-school` rendering `author_instagram` — **note the class name says school and
  the data is Instagram.** Do not "fix" the data to match the name.
- **KEEP** the `canMakeGraphic` / `hasLeaderAccess` poster gate. **`SOCIAL-ENGINE.md` proposes
  opening it up; that is a product decision, not this file's.**
- **KEEP** the drives bridge block at the end.
- **Share:** the OG problem in `SOCIAL-ENGINE.md` applies here most — a blog post is the most
  shareable thing the org makes and a shared link renders as a bare URL.

## 12.3 · `/labs` — `LabsPage.tsx`

**The most copy-sensitive page in the product after `/equity`.** Its header comment is explicit:

- **Every description is the team's own submission. Do not edit, tighten or fix.**
- **Team names are content, not metadata** — `Execution Pending` and `404-Idea Not Found` are
  real names. **Do not sentence-case, do not correct.**
- **The em dash in QUIRK's submission is the team's own.** Keep it.
- **Process photos were submitted as Google Drive URLs and cannot render.** **KEEP the sentence
  that says so.** Do not substitute stock imagery.
- **No Supabase table** — the seven projects are a hard-coded array. Do not "wire it up".
- **SET** each project as a white card with a quote line in serif italic and the body beneath;
  status + team in a mono line.

## 12.4 · `/classes` — `ClassesPage.tsx`

- Cohorts grouped client-side from `class_grade`. **KEEP the grouping**; `class_grade` is free text
  and the trim/normalise logic exists for a reason.
- **SET** cohort tiles as hue discs (`08`'s pattern) with the count on an overlapping pill.
- **KEEP** the lede.
- **C20 needs a `classes` table and does not have one** (`15.15`) — unrelated to this page, which
  groups members rather than reading classes.

## 12.5 · `/directory` — `DirectoryPage.tsx`

The "way in" hub. **Its comments carry two real constraints:**

- **`CAT_COLORS` has five keys and there are eight teams.** The comment says *"five keys cannot
  serve eight teams"* — **so a team's colour comes from the palette by index, never from
  `CAT_COLORS`.** `JoinPromoPage` repeats this. **Do not reintroduce the mapping.**
- **The openings tile shows roles only, because "a recruitment door that reads 0 is worse than no
  door".** **KEEP that behaviour** — it is `15.0`'s rule-4 thinking applied to a nav tile.
- **SET** the six destination tiles as the `10.2` mixed-shape grid.
- **KEEP** every `note` string — they are the page's whole value.

## 12.6 · `/join` — `JoinPromoPage.tsx`

- **KEEP the hours wording exactly:** *"Hours are logged by whoever runs the drive, so they are
  attendance, not an…"* — this is the honesty that `04.1` and `15.0` both protect.
- **KEEP** *"Every drive you turn up to is logged against your name, and you can ask for a…"*
- **KEEP** the three-businesses paragraph and `role="progressbar"` where it is genuinely a
  proportion. **Not on `10.4`'s segmented bar**, which is a count.
- **This page and `09` must not contradict each other.** Both make the self-funded argument;
  `09` position 04 is the canonical wording.

## 12.7 · `/brand` — `BrandPage.tsx`

The type specimen. **It documents the design system, so it must be updated last** — after every
other file lands, or it documents a system that no longer exists.

- **KEEP** all four `TypeSpec` rows (Display / Serif / Body / Mono) and their samples.
- **ADD a fifth section: the sticker system** (`13`). The specimen page is exactly where the eight
  silhouettes, three sizes and two keyline modes belong.
- **ADD the concentric radius scale and the paper-on-ink ladder** as specimen blocks. A design
  system page that omits its own two spine rules is incomplete.
- **KEEP** `.bp-spec-role` and the poster templates.
- **The palette section must show the `*-ink` partners** and label which pairs fail — that is the
  rule people get wrong most.

## 12.8 · `/equity` — `EquityPolicyPage.tsx`

**DO NOT TOUCH A SINGLE WORD.** Its header comment: *"reproduced verbatim from the HR team's source
document… if it changes, the HR team changes the document and this page follows it exactly."*

- **Restyle the container only.** `var(--card)`, 32, hairline. Body at `400 16px/1.7`,
  `max-width: 68ch`.
- **KEEP `HR_TEAM`** and its `[name, phone]` pairs, and `For questions or concerns, please contact
  the HR Team`.
- **Do not restructure the headings, do not add a table of contents, do not reword `.ep-p`.**
- **This is the one page where a design improvement is a compliance risk.**

## 12.9 · `/calendar`, `/drives`, `/yearbook`

**Not read in detail.** For each: apply the blanket transform, apply `11`'s states, and
**report what you find** — particularly:
- **`/drives`** overlaps `10.4` (drive detail) and the desk's drives desk. **Confirm which owns
  the list.**
- **`/yearbook`** has an admin counterpart (`20.14`). **Confirm the public page reads what the
  desk publishes.**
- **`/calendar`** — does it read real drive rows? `01` and `06.4` both record that **the app
  fetches no drive rows**. If true, this page has nothing to show and that is a data problem, not
  a design one.

## 12.10 · `/profile/edit` — `EditProfilePage.tsx`

- **The field-level validation from `11.10` is the whole job here.** `UX-GAPS.md` item 22 and
  `04`'s unresolved 9 both flag it.
- **SET** fields in `var(--r-inner)` cream wells with mono uppercase labels, per `07`'s
  underline-only treatment.
- **ADD the unsaved-changes guard** (`11.9` state 10).
- **The wall off-switch also lives here** (`16.2`), as well as on the wall's empty state.

## 12.11 · Password reset / magic link

**Not in the route list I read, and it may not exist.** If it does not, **that is a gap worth
raising** — a product with email login and no reset path locks people out permanently.

If it exists: `07`'s auth shell, and **all four states** — requested, sent, expired link, success.
**The "sent" state must not confirm whether the address exists** (account enumeration).

## 12.12 · `/404`

- `11.6`'s generic case, with **bhoot** (`18.0`).
- **A real `<h1>`**, a sentence, and one link home. **Not a search box** — someone who mistyped a
  URL does not want to search.

## Verification

Run `11`'s checklist plus:
1. **`/equity` diffs to zero text changes.**
2. **`/labs` diffs to zero text changes**, including team names and the em dash.
3. **`CAT_COLORS` is not used for team colour** anywhere in `/directory` or `/join`.
4. **`/brand` documents the sticker system, the radius scale and the contrast ladder.**
5. The hours wording on `/join` is byte-identical.
6. No page contains a blocked stat (`09.0`).

## Unresolved

1. **Does a password reset flow exist?**
2. **Who owns the drives list** — `/drives`, `10.4`, or the desk?
3. **Does `/calendar` have data?** If the app fetches no drive rows, it cannot.
4. **`/yearbook`** — public reads admin's output?
5. **`author_instagram` in `.pp-author-school`** — leave the mismatch, or rename the class?
