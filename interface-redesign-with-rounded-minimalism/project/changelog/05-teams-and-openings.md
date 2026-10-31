# 05 · Teams, team detail, and openings

**Files touched:** `frontend/src/public/TeamsPage.tsx`, `TeamDetailPage.tsx`,
`OpportunitiesPage.tsx`, `ApplyPage.tsx` (or wherever the application form lives), their CSS,
and `frontend/src/lib/departments.ts` (or wherever `DEPARTMENTS` is declared).
**Design source:** `AquaTerra Feed.dc.html` — `16a` (teams desktop), `16b` (teams phone),
`16c` (the fanned openings).
**Prerequisites:** `00`, `13` (stickers), `14` (footer). **Read `docs/BRAND_VOICE.md` §3 for the
department list and §1.2 before writing any string.**

## Global invariants

1–9 as in `changelog/README.md`. **Plus the overlap rule** (README): nothing absolutely positioned
may enter the box of a heading, name or figure. **This file is where that rule is easiest to
break**, because the headline has UI objects inside it.

## 05.0 · The hue rule — read this first

`DirectoryPage.tsx:41` and `JoinPromoPage.tsx:104` both carry the same comment:
**"five category keys cannot serve eight teams"**, and `JoinPromoPage` adds that a department's
colour comes from a **fixed per-department palette, never from `CAT_COLORS`**.

**So: a department's hue is a property of the department, not of its category.** Two teams can
share a category and must still have different hues.

| department | kind | hue |
|---|---|---|
| Welfare | volunteer team | `--welfare` #1B8A5A |
| Events | volunteer team | `--sky` #3DA9FC |
| Social Media | volunteer team | `--pink` #FF4D8C |
| Collabs | volunteer team | `--tomato` #FF4D2E |
| Human Resources | volunteer team | `--grape` #7E5BFF |
| ROOTS | **student business** | `--ink` #0A0A0A |
| ShikshAQ | **student business** | `--lemon` #FFC700 |
| AQ.Ventures | **student business** | teal #12909C |

- **Read the real `DEPARTMENTS` array and use its `color` values.** The table above is my mapping
  from the eight names in `BRAND_VOICE.md` §3; **if the array disagrees, the array wins.**
- **Eight departments. Do not invent a ninth** (§3).
- **ROOTS takes ink deliberately** — it is the business that funds the drives, and ink makes it the
  one card that reads differently in the grid.
- **Ink text on every hue** (`DESIGN.md` §2). Paper text only on the ink card.

### The distinction that matters more than the hues

**Five are volunteer teams; three are student businesses.** Joining ROOTS is not the same act as
joining Welfare, and the current page treats all eight identically. **Label the kind on every
card** — `volunteer team` / `student business` in mono uppercase. This is a real product
distinction, not decoration.

## 05.1 · The teams headline — UI objects set into the word gaps

**Design:** `16a`. This is the reference's whole idea and it has exactly one correct
implementation.

```html
<h1 class="h-display">
  pick a
  <span class="tm-lockup tm-lockup--discs">…three discs…</span>
  lane,
  <span class="tm-lockup tm-lockup--wire">…svg connector…</span>
  <br>then
  <span class="tm-lockup tm-lockup--toggle">…toggle + ON…</span>
  <em>turn up.</em>
</h1>
```

```css
.tm-lockup { display: inline-flex; align-items: center; }
.tm-lockup--discs  { vertical-align: -14px; margin: 0 6px; }
.tm-lockup--wire   { vertical-align: -9px;  margin: 0 8px 0 4px; }
.tm-lockup--toggle { vertical-align: -12px; margin: 0 8px; }
```

- **`display: inline-flex` inside the `<h1>`, in the text flow.** They **push the words apart**;
  they never sit on top of them. **This is the overlap rule satisfied by construction** — there is
  no z-index anywhere in this component, and there must not be.
- **`vertical-align` is tuned per object**, because a 52px disc row and a 16px wire do not sit on
  the same optical baseline. **Do not use a single shared value.**
- **The discs** are 52px circles with `box-shadow: 0 0 0 4px var(--bg)` and `-16px` overlap, so the
  ring reads as a die-cut keyline against the cream page (`13`).
- **The wire** is a 34×16 SVG: one dashed `rgba(10,10,10,.28)` path with a 2.5px ink dot at each
  end. **Inline SVG, not a border-top trick** — a border cannot carry the dot terminals.
- **The toggle** is a real-looking switch inside an ink pill: a 46×26 welfare track with a 20px ink
  knob pushed right by `margin-left: auto`, plus a mono `ON`.
  **It is decorative and must be inert:** `aria-hidden="true"` on all three lockups, and
  **no `role="switch"`, no `tabindex`, no click handler.** A screen reader must hear
  `pick a lane, then turn up.` and nothing else.
- **The whole `<h1>` needs `text-wrap: balance`** and must survive 360px — at which point the
  objects scale down (`16b`: discs 30px, toggle 32×18) but **stay inline**. They do not become a
  separate row.
- **`font-size` is fluid:** `clamp(42px, 6.4vw, 76px)`.

**If any of this feels fragile, the fallback is to drop an object — not to position it absolutely.**
Three objects on desktop, two on phone, is already the design.

## 05.2 · The team grid

- **SET** a 4-up grid on desktop (`repeat(4, 1fr)`, `gap: 12px`), **2-up on phone** with a
  `Show 4 more` pill after the first four.
- **SET** each card: white shell 32/10, an inner hue block at radius 22 with `min-height: 96px`
  holding the kind label and the department name at `900 22px var(--display)` uppercase, then a
  cream-free body area with one description line and the openings count.
- **The openings count is a link, and its colour is the department's `*-ink` partner** —
  `--welfare-ink` #146F47, `--sky-ink` #0B6BB8, `--tomato-ink` #C6300F, `--lemon-ink` #7E6000.
  **Never the hue itself as text on white** (`DESIGN.md` §2).
- **When a team has no openings, say `nothing open` in `var(--ink-3)`** — not "0 roles". A zero is
  a claim about a number; "nothing open" is a state.
- **KEEP the existing `/teams?category=` links** if the grid currently routes that way, and
  **KEEP `DirectoryPage`'s note that three teams share labs and two share operations** — the
  category is still the routing key even though the hue is not.
- **The whole card is one `<a>`.** Do not nest a second link inside it.

## 05.3 · Team detail

**No design turn — build it from the grid card's language.** `TeamDetailPage.tsx` is 1300+ lines
and the performance audit flags an **N+1 at `TeamDetailPage:1307`**.

- **Header:** the department's hue as a full-bleed block at radius 32 carrying the name at display
  scale, the kind label, and the member count.
- **Then three sections**, in this order, because this is the belonging problem you flagged:
  1. **its drives** — C09/C11 cards from `15`, filtered to this team
  2. **its members** — the directory card from `08`, name/school/role only
  3. **its posts** — the feed cards from `15`
- **Fix the N+1 at line 1307** as part of this pass: batch it the way `useFeedCardBatch` does.
  **This is a performance fix, not a style change, and it is in scope** because the audit names it.
- **Empty states per section**, each with an action: no drives → link to `/drives`; no members →
  link to the openings; no posts → the composer if you are a member.

## 05.4 · Openings — the fanned hand

**Design:** `16c`. **This is the one place in the product where cards deliberately overlap**, so
the rule needs stating precisely.

```css
.op-fan { display: flex; justify-content: center; align-items: flex-start; }
.op-card {
  width: 212px; flex: none;
  border-radius: var(--r-outer); padding: var(--pad-card);
  transform-origin: bottom center;
  box-shadow: 0 8px 24px -12px rgba(10,10,10,0.3);
  transition: transform 180ms ease, box-shadow 180ms ease;
}
.op-card + .op-card { margin-left: -26px; }
.op-card:nth-child(1) { transform: rotate(-7deg); }
.op-card:nth-child(2) { transform: rotate(-3deg); }
.op-card:nth-child(3) { transform: rotate(1deg);  z-index: 2; }
.op-card:nth-child(4) { transform: rotate(5deg);  }
.op-card:nth-child(5) { transform: rotate(9deg);  }
.op-card:hover, .op-card:focus-within {
  transform: rotate(0deg) translateY(-10px); z-index: 3;
  box-shadow: 0 16px 40px -14px rgba(10,10,10,0.42);
}
```

- **`transform-origin: bottom center` is what makes it a held hand** rather than a pinwheel.
  Rotating about the centre makes the tops splay and the bottoms cross; rotating about the bottom
  edge fans the tops while the bases stay near each other.
- **The overlap may only ever cover a neighbour's TEXTURE PANEL.** Every card's title and count sit
  in the **lower band**, which the −26px margin never reaches. **Verify this by measuring, not by
  looking** — the fan reads fine in a screenshot while eating a title.
- **`:focus-within` mirrors `:hover`** so keyboard users get the same straighten-and-lift.
- **The middle card gets `z-index: 2`** so the fan reads as centred rather than left-stacked.
- **Exactly five cards in the fan.** Six at 212px minus overlap exceeds the frame, and the reference
  is a hand of five. The rest live behind `All nine openings →`.
- **The texture panel** is `repeating-linear-gradient(45deg, rgba(10,10,10,.11) 0 1px, transparent
  1px 7px)` over `rgba(10,10,10,.05)` — **the ink card inverts both to paper alphas.**
- **The title is Instrument Serif at `400 21px`, roman not italic.** This is the second place the
  serif carries more than a word (the first is About's quote band), and it is why the section title
  above is also serif — they are one voice.

### Phone: no fan

**Below 760px the fan becomes a vertical stack** of the same cards at radius 32, **no rotation, no
negative margins, no hover.** Touch has no hover, so a fan that depends on straighten-on-hover to
be readable cannot ship on a phone. **This is not a degradation — it is the correct design for the
input.**

## 05.5 · The section header

- **SET** a 44px `rgba(10,10,10,.28)` hairline rule, centred, then the title in **Instrument Serif
  `400 40px`** with one italic coloured phrase, then the lede in Eina.
- **The count in the title must be real.** `Nine roles are open right now.` is only legal if nine
  is the live count. **Bind it, or write `Roles are open right now.`**
- **KEEP whatever the live opportunities page says about the cohort and the closing date.** The
  mock's `Applications for the winter cohort close on Sunday.` is approved copy, but a **date must
  come from data**, never a hard-coded weekday.

## 05.6 · Apply flow

**No design turn.** Build the form from `00.10`'s field styles and `CollaborationsPage`'s
validation pattern — **it is the one form in the product that already does field-level errors
properly** (`role="alert"`, `aria-invalid`, per-field messages). **Copy that pattern; do not
invent a second one.**

States needed, all twelve from `README` §3B. In particular:
- **`This role is no longer accepting applications.`** — the string already exists (`01`). Keep it.
- **Already applied** — show the application's status, do not offer the form again.
- **Not signed in** — the openings are public; the form is not. Say so before the form, not after.

## States

- **Teams loading:** eight skeleton cards at the real geometry (hue block + two text lines).
  **Not four** — `06.7` records that a count-changing skeleton "read as the page jumping".
- **Teams empty:** cannot happen (departments are static content). **If `DEPARTMENTS` is fetched
  and returns empty, that is an error state, not an empty state.**
- **Openings empty:** **KEEP `no openings right now`** (`01`). Replace the fan with a single
  full-width cream well — **not five empty cards.**
- **Openings error:** `EmptyState` + retry.
- **Reduced motion:** the fan's rotations **stay** (composition, per `13`); the hover
  straighten-and-lift **is removed**, and `:focus-within` instead applies only the `z-index`.

## Verification

1. **The three headline lockups are `inline-flex` in the text flow, `position: static`, and
   `aria-hidden`.** No z-index anywhere in the headline.
2. A screen reader reads exactly `pick a lane, then turn up.`
3. **No fan card's title or count is intersected by a sibling** — measure the rects.
4. Eight departments, each labelled volunteer team or student business.
5. Every openings count uses an `*-ink` colour, never a raw hue, on white.
6. `nothing open` where a count would be zero.
7. Ink text on all seven hue cards; paper only on the ROOTS ink card.
8. Below 760px: no fan, no rotation, no negative margins.
9. The N+1 at `TeamDetailPage:1307` is batched.
10. Radii only 999 / 32 / 22 / 14. Zero horizontal overflow at 375px and 360px.

## A note on strings in this file

**Approved (bulk, 2026-09-05):** `★ eight departments · all student-run` · `pick a lane, then turn
up.` · `Five volunteer teams and three student businesses. Nobody interviews you for the first
one — you just come to a drive.` · `See what's open →` · `volunteer team` · `student business` ·
every department description line · `3 roles open →` · `nothing open` · `Show 4 more` ·
`Nine roles are open right now.` · `Applications for the winter cohort close on Sunday. One form,
five minutes, and we usually reply within a week.` · `All nine openings →` · all five role titles ·
`4 applied · closes sun`.

**Read from source, keep byte-identical:** `no openings right now`, `view all openings →`,
`This role is no longer accepting applications.`, `Join the work →`, every `DEPARTMENTS` name and
`stat` string.

**`Nobody interviews you for the first one` is a claim about process, not a slogan.**
**Confirm it is true** before shipping — if the first team does require an application, the line
is wrong and §1.2's honesty rule applies.

## Unresolved after this file

1. **Where is `DEPARTMENTS` declared, and does it carry `kind`** (volunteer team vs student
   business)? If not, that is a one-field addition — **but it is a data change, so it needs your
   sign-off.**
2. **Do my eight hue assignments match the real `color` values?** The array wins; I need to see it.
3. **Is `Nobody interviews you for the first one` accurate?**
4. **Is the openings count per team available on the teams page**, or would showing it cost a
   query per card? If the latter, **batch it or drop it** — do not add eight queries.
5. **Does `AQ.Ventures` have a public page**, or is it a placeholder? Its description is the one I
   am least confident about.
6. **`TeamDetailPage` is 1300+ lines.** Does it need splitting as part of this, or is the restyle
   in place acceptable?
7. **Paradox** — it is an Events product with its own sub-app (`src/paradox/**`, untouchable).
   Does the Events team card link to it, and if so does that leave the redesigned surface?
