# 09 · About — the manifesto

**Files touched:** `frontend/src/public/AboutPage.tsx`, its CSS, `frontend/src/lib/metaConfig.ts`,
`frontend/src/lib/orgFacts.ts`, `frontend/index.html` (JSON-LD).
**Design source:** `AquaTerra Feed.dc.html` — `15a`.
**Prerequisites:** `00`, `13` (stickers), `14` (footer).
**MANDATORY READING BEFORE YOU TOUCH A WORD:** `docs/BRAND_VOICE.md` (29KB). It is the org's
voice bible and it governs every string on this page.

## Global invariants

1–9 as in `changelog/README.md`. **Exception, and it is the only one in the whole changelog:**
**this file DOES change copy.** The user asked for the About content refreshed entirely, as a
manifesto. Every other file's invariant 3 still stands.

## 09.0 · THE ACCURACY RULE — read this before the design

`BRAND_VOICE.md` §3 opens with: *"This is a real, registered NGO. **Never invent, round up, or
'improve' a number.**"* and it flags conflicts as **NEEDS HUMAN CONFIRMATION**, stating the flag
is **blocking for that specific stat**.

**Six stats are blocked and MUST NOT appear on this page until a human confirms them:**

| stat | the conflict |
|---|---|
| **drives / projects completed** | `450+` (index.html JSON-LD, stale) vs `512+` (two strategy docs, metaConfig, AboutPage body) vs `534+` (AboutPage hero + marquee) |
| **stray dogs fed** | `1,500+` (strategy doc) vs `1,200+` (JSON-LD) |
| **clothes distributed** | `2,500+ kg` vs `950+ kg` — the bible calls this a "large discrepancy" |
| **Paradox 3.0's year** | `Jun 2025` (strategy doc) vs `Jun 2024` (AboutPage card). Attendee count (300) agrees |
| **LinkedIn slug** | `aquaterrango` (code, internally consistent) vs `ngo-aquaterra` (in circulation) |
| **"500+ campaigns"** | probably double-counts the projects figure; do not publish as a separate stat |

**The drives count is the painful one** — a proof-first page wants it, and it is currently
**shipping three different numbers on one site**. The design renders it as a **visible
confirm-me slot**, not a guess. **When confirmed: put the number in `lib/orgFacts.ts` and import
it everywhere, then delete the other two.** Do not hard-code it in this component.

### Stats that ARE cleared (§3, ✅ verdicts) — use exactly these

- Founded **11 June 2021** · **16 students** · **Kolkata, West Bengal**
- **DARPAN-registered**, Reg. No. **AAFTT2300ME20251** (NITI Aayog, Govt. of India)
- **1,200+ members**, always paired with **ages 14–19**
- **3,500+ children** reached in educational workshops
- **4,000+ saplings** planted
- **1,600+ medical checkups** (Sundarbans)
- **15,000+ bananas distributed** — **bananas, NOT "meals."** The bible flags "meals" as an error
  to correct on sight, and notes the brand jokes "not a typo"
- **8 Sundarbans relief trips**, most recent **December 2025**
- **8 departments**, enumerated as: Events, Welfare, Social Media, Collabs, ROOTS, AQ.Ventures,
  ShikshAQ, Human Resources. **Do not invent a ninth**
- **Self-funded; zero donations; zero external funding; zero fees**
- Founders **Krish Goenka** (Founder) and **Kanishk Agarwal** (Co-founder) are public via JSON-LD.
  **Do not invent bios beyond it.** The current AboutPage keeps them anonymous, which is also fine

**Prefer "DARPAN-registered" over "DARPAN certified"** — §3 says registered is technically accurate
and safer for press and parents.

## 09.1 · Voice — the four registers, mapped

`BRAND_VOICE.md` §1.3 maps each typographic register to a voice job. **The design follows it
exactly, and this is why the page sounds like the org rather than like a redesign:**

| register | type | job on this page |
|---|---|---|
| **UPPERCASE display** | `--display` 900, uppercase, tight tracking | the shout: `STARTED IN KOLKATA.`, `SEVEN POSITIONS.`, `COME BUILD WITH US.` |
| **lowercase italic serif** | `--serif` italic, coloured | **one or two words only** — `got out of hand.`, `summarised.`, and the quote band |
| **sentence-case body** | `--eina` | where facts live. Short sentences |
| **mono kicker** | `--mono` uppercase, tracked, with ★ | the margin notes: `★ EST. JUNE 2021 · KOLKATA`, `★ THE STORY` |

**The serif carries a whole sentence in exactly one place on this page** — the quote band. That is
deliberate and it is the page's emotional centre. Everywhere else it is one or two words.

### The five personality traits, and how each shows up

1. **Self-aware & chaotic-good** — `started in kolkata. got out of hand.` (already the live OG
   title), and `five years, badly summarised.`
2. **Proof-first** — **this is the structural decision of the whole page.** §1.2's "Real Person
   Test" says *"if a line has no name, number, place, or date, it isn't ready."* A manifesto
   normally fails that test. So **every numbered position is paired with a receipt**: the position
   is the claim, the fact underneath is the proof. Position 03 is nothing *but* proof.
3. **Warm, never preachy** — no line asks the reader to feel anything. `come build with us.` is
   the ceiling, and it is one of §6's four approved CTAs.
4. **Confidently understated** — `Bananas, not meals. It isn't a typo.` and
   `That's the whole business model.`
5. **Kolkata-rooted & youthful** — the city is in the first line and the reg number is in the last
   position.

### Kill on sight (§1.2's hard don'ts)

**`empower` · `noble mission` · `underserved` · `make a difference` · `synergy` · `holistic` ·
emoji spam · exclamation stacking · guilt or pity framing of beneficiaries · any sentence that
would fit any NGO on earth.**

**None of these appears in the design. If you find yourself adding one, you have left the voice.**

## 09.2 · §7 — what must NEVER reach this page

`BRAND_VOICE.md` §7 lists internal material that would be self-sabotage to publish. **The About
page is the single most likely place for it to leak, because it is the page that explains the org.**

**Do not publish, in any form:**
1. **Revenue mechanics** — the ~90% events / ~10% ROOTS split, ticket/sponsorship breakdown,
   fundraiser P&L. **Public message is the outcome only:** "self-funded, zero donations."
   Position 04 says exactly that much and no more.
2. **The org chart** — Exec Board ⊂ Core ⊂ Team AQ ⊂ Community, approval flows, the WhatsApp
   infrastructure, welfare-points redemption, certificate issuance mechanics.
3. **Strategic candour** — "unfair advantage", the FOMO/herd-effect engineering, "socially
   acceptable justification", and **especially the self-identified weaknesses** (member
   inactivity, thin leadership depth, capital constraints, founder dependency).
4. **The cynical customer framing** — that CV-building is the "primary driver", that participation
   is "resume-driven", that **"impact is a byproduct"**. §2.4 gives the public framing rule:
   **"we say impact + community + real ownership."** Position 05 says the social point *without*
   saying impact is a byproduct — **that line is walking a real line, so do not rewrite it.**
5. **Instagram content-ops** — follower counts, the algorithm playbook, the "bury the NGO label"
   funnel strategy.

**And one framing trap specific to this page:** §0 warns there are **two voices**. The Instagram
brief bans describing the org at all; the web voice must state plainly that AquaTerra is a
student-led NGO in Kolkata. **This page uses the WEB voice.** Keep the attitude, drop the
concealment.

## 09.3 · Structure

Nine sections, in this order. **Sections alternate cream → ink → hue → cream** so no two
consecutive bands share a ground.

1. **Hero** (cream) — mono kicker, display headline with the serif close, one body paragraph,
   three die-cut stickers.
2. **Torn seam** into ink.
3. **The manifesto** (ink) — seven numbered positions.
4. **Torn seam** out of ink.
5. **Quote band** (welfare) — the one full serif sentence.
6. **The story** (cream) — three accordion rows with a vertical spine label.
7. **CTA band** (lemon) — headline, one paragraph, two actions.
8. **The footer** (`14`).

### 09.3.1 · The torn seam

```html
<svg width="100%" height="15" viewBox="0 0 390 15" preserveAspectRatio="none" aria-hidden="true">
  <path d="M0 15V6l14 3 13-5 …" fill="var(--ink)"/>
</svg>
```
- **One path, two uses.** The closing seam is the same SVG with `transform: scaleY(-1)`.
- `preserveAspectRatio="none"` so it stretches to any width. `aria-hidden` — it is decoration.
- **`fill` must be the colour of the section it is tearing INTO**, not out of.
- **Do not use an image.** The audit's whole thrust is payload; an SVG path is ~300 bytes.

### 09.3.2 · The manifesto rows

- **SET** each row: `background: var(--nav-well)` (`rgba(244,239,224,.07)`), radius 22,
  `padding: 18px 16px`, `display: flex; gap: 12px; align-items: flex-start`.
- **SET** the number: `900 26px var(--display)`, `line-height: .9`, `tabular-nums`, **one palette
  hue per position** cycling welfare → lemon → sky → tomato → pink → grape → teal.
  **These are numbers on an ink ground, not text on a hue** — so the hue is the text colour here,
  and every one of the seven clears 4.5:1 on ink (welfare 5.4:1, lemon 12.1:1, sky 7.8:1,
  tomato 5.6:1, pink 6.9:1, grape 4.6:1, teal 4.7:1). **Verify grape and teal specifically.**
- **SET** the position: `900 19px/1.14 var(--display)`, sentence case (not uppercase — these are
  sentences), `letter-spacing: -.025em`, `var(--nav-fg)`, `text-wrap: pretty`.
- **SET** the proof: `400 14px/1.6 var(--eina)` in `var(--nav-fg-strong)` (0.82, 10.1:1).
- **Position 03 carries a 2×2 stat grid** at radius 14 inside the radius-22 row — **22 − 8 = 14**,
  the concentric rule holding three levels deep.
- **Position 03 also carries the confirm-me slot** for the drives figure: a lemon-tinted
  radius-14 well with an alert glyph naming the three conflicting values.
  **This ships as-is until the number is confirmed. It is not a placeholder to delete —
  it is the accuracy rule made visible.**

### 09.3.3 · The vertical spine label

```css
.about-spine {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  white-space: nowrap;
  font-family: var(--mono); font-size: 9px; font-weight: 800;
  letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-3);
}
```
**`writing-mode` + `rotate(180deg)` is the only way to get a bottom-up label that still selects
and still reads to a screen reader.** A `rotate(-90deg)` on a normal block breaks both.

### 09.3.4 · The accordion

- Rows are `var(--card)` at radius 22 with `var(--hair-2)`.
- **The chevron is a plus/minus, not an arrow** — plus when closed, minus when open, matching the
  reference. `aria-expanded` on the trigger, `aria-controls` pointing at the panel.
- **The open row is the 2023 one.** The dip-and-rebuild is the most interesting thing on the page
  and the bible's "self-aware" trait says to lead with it rather than hide it.
- **KEEP the existing `ab-` class names** where they already do the job; this is a restyle of a
  real component, not a new one.

## 09.4 · What to delete from the current page

- **DELETE the `450+` figure from `frontend/index.html`'s JSON-LD `Dataset`.** §3 calls it stale
  and says to retire it "regardless" of how the 512/534 conflict resolves. **This is the one
  blocked-stat action you can take without waiting for confirmation.**
- **DELETE the "534+" from the hero and marquee OR the "512+" from the body — but the site must
  not ship both.** §3: *"Do NOT ship three different numbers across the site."* Until confirmed,
  **show neither**; the confirm-me slot stands in.
- **DELETE any instance of "15,000+ meals"** and correct to bananas (§3 instructs this explicitly).
- **DELETE "500+ campaigns"** wherever it sits beside the projects figure — §3 says it reads as
  inflation.
- **DELETE `.torn-divider` and `.adm-tape`** if this page uses them; `17.4` retires both.
- **DELETE the hard ink borders and offset shadows** from every card on this page (`00.6`).
- **DELETE `Marquee`'s duplicated stats** if any of them are blocked figures. The live marquee
  carries `550+ DRIVES` — **that is a fourth value for the same stat.** Flag it; it may be the
  真 count, which would make the conflict four-way.

## 09.5 · Meta and structured data

- **UPDATE `lib/metaConfig.ts`** for `/about` per §5's row: audience is students + parents + press,
  keyword theme "youth leadership / student-run NGO story Kolkata", emotional note "pride without
  preaching, legitimacy for parents."
- **Title behaves like a display head** — front-load the keyword and geo. **Description behaves
  like body** — one real detail plus the facts, ~150–160 chars, sentence case.
- **Live pattern:** `"[What it is] | [angle] · AquaTerra"`.
- **Do not put a blocked stat in a meta description.**

## States

- **No loading state needed** — the page is static content. **If any section fetches (the
  departments list may), it gets the `00.16` skeleton at the real geometry.**
- **The accordion's closed state is the default for two of three rows** — not a loading state.
- **Reduced motion:** the accordion still animates height (that is an interaction, not ambient),
  but **the sticker rotations stay** — they are composition, not motion (`13`).

## Verification

1. **No blocked stat appears anywhere on the page or in its meta.** Grep for `512`, `534`,
   `450`, `550`, `1,500`, `1,200+ dogs`, `2,500`, `950`, `Jun 2024`, `Jun 2025`.
2. `15,000` is always followed by **bananas**, never meals.
3. `1,200+` is always paired with **ages 14–19**.
4. The reg number reads **AAFTT2300ME20251** exactly.
5. Eight departments, enumerated, no ninth.
6. **No §7 material anywhere** — no revenue split, no org chart, no weaknesses, no
   "impact is a byproduct".
7. **No §1.2 banned word** — grep `empower`, `noble`, `underserved`, `make a difference`,
   `synergy`, `holistic`.
8. Ink text on every hue band; the seven position numbers all clear 4.5:1 on ink.
9. Radii only 999 / 32 / 22 / 14.
10. Zero horizontal overflow at 375px and 360px.
11. `aria-expanded` + `aria-controls` on every accordion trigger; seams `aria-hidden`.

## Copy — the full page, approved 2026-09-05

All strings below are new and **cleared to ship** under the bulk approval, **except any containing
a blocked stat — of which there are none.**

**Hero:** `★ est. june 2021 · kolkata` · `started in kolkata. got out of hand.` ·
`16 students, no budget, no experience, and a WhatsApp group. Five years later there are 1,200+ of
us across eight departments, still student-run, still Kolkata.` ·
stickers `ages 14–19` / `zero fees` / `darpan registered`

**Manifesto:** `★ what we hold` · `seven positions.` then the seven, verbatim from `15a`.

**Quote band:** `Students learn best when they're trusted with real work.` ·
`★ the whole argument, in one line`
*(the first is a paraphrase of the live site's `students learn best when trusted with real work` —
if that exact string exists, **use the live one**.)*

**Story:** `★ the story` · `five years, badly summarised.` · `2021 · 16 students and a WhatsApp
group` · `2023 · Dipped. Recovered.` + `The original team stepped back in and rebuilt it. Worth
saying out loud, because most student orgs that dip just stop.` · `2026 · 1,200+ members, eight
departments, three businesses`

**CTA:** `come build with us.` · `Free, always. Pick a team, apply in two minutes. We usually reply
within a week.` · `See open roles` · `Say hi`

**`come build with us.` and `Say hi` are both from §6's approved CTA ceiling.** Do not escalate
either — `JOIN NOW` and `Donate today` are explicitly banned, and the org takes no donations.

## Unresolved after this file

1. **The six blocked stats.** Confirm and they go in. The drives count is the one the page most
   wants.
2. **`550+ DRIVES` in the live `Marquee`** — is this a fourth value for the projects stat? If so
   the conflict is four-way, not three-way.
3. **Does `lib/orgFacts.ts` already hold any of these numbers?** If yes, that is where the
   confirmed value goes and every surface imports it. If no, **create it** — one number, one home.
4. **`CERTIFICATE_WAIT_TIME` lives in `orgFacts`** (used by `04.5`), so the file exists.
   **Read it and see which facts are already centralised** before hard-coding anything.
5. **Do the founders stay anonymous?** They are public in JSON-LD but anonymous on the current
   page. §3 says either is fine. **The manifesto does not name them** — position 01 is about
   students in general, which is stronger. Confirm that is what you want.
6. **The quote band's sentence** — is `students learn best when trusted with real work` a live
   string? If so, use it byte-identical rather than my paraphrase.
