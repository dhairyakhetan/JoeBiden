# Style lock — TerraThon 2026 (`frontend/src/terrathon/`)

> ## SUPERSEDED IN PART, 2026-09-21. READ THIS BEFORE THE REST.
>
> This file was locked 2026-09-19 against the CREAM direction. The section was
> then rebuilt against the campaign poster (`605faa6 "Rebuild the TerraThon
> section as the campaign poster"`), and several statements below are now
> FALSE. An agent obeying them literally would revert that rebuild.
>
> What actually ships today, verified in the browser on 2026-09-21:
>
> | The file says | The truth |
> |---|---|
> | Ground is cream `#F4EFE0` | Ground is night `#05060A`; tokens flip inside `.tt-root` |
> | Ink is `#0A0A0A` | Ink is cream `#F2EFE3`; the roles swapped, the names did not |
> | "no font request of its own" / "six font files" | `TerraThonRoot.tsx` requests Archivo Black + Bungee from Google Fonts |
> | "No photography" | Nine real AquaTerra photographs ship in `public/terrathon/photos/` |
> | Dark mode: none | The section IS the dark mode |
>
> **The poster is the source of truth for colour.** Measured off the supplied
> artwork on 2026-09-21: ground `#000000`, sticker green `#2BD382`, star blue
> `#1486D9`, outline orchid `#DE68F0`, torn-paper cream `#F6F0E0`. The live
> `--tt-*` night tokens already match these to within a point or two, so the
> night flip was poster-derived; only this document was never updated.
>
> Contrast on the night ground (all text-safe): text 18.23, green 10.74,
> orchid 7.45. **But `--tt-card #0B0E16` on the ground is 1.09, decorative.**
> A dark card on a dark ground is invisible, which is why every large surface
> carries a 3px orchid border. Separate surfaces by BORDER here, never by fill.
>
> Everything below about SHAPE, SCALE, SPACING, SUBTRACTION and MOTION is still
> in force and was re-verified on 2026-09-21. Those sections are the reason the
> section holds together; only the colour, type and asset claims went stale.
>
> Two open decisions nobody has taken: the file still mandates hard offset
> shadows `Npx Npx 0 0 var(--ink)`, but a black offset on a black ground is
> invisible and the section now renders essentially none. And `--tt-hot` is
> doing the separating work that shadow used to do.

Locked 2026-09-19. Reuse these exact tokens for every new TerraThon surface.
Do not re-derive a palette or type pairing for this section.

## Direction contract

- **Thesis:** a real sports-event brand, on AquaTerra's own paper-and-ink system.
  Editorial and high-contrast, not a dark SaaS dashboard.
- **Surface type:** marketing narrative (public) + transactional form (register)
  + app shell (the desk).
- **Visual lane:** event-ticketing editorial. Big uppercase display type, cream
  ground, hard black rules, one hot accent for the ask, sticker badges for
  status.
- **Risk dial:** high on the hero and the sport cards, low on the form and the
  desk. The money path is never the place to be clever.

## Palette — BRAND-MANDATED, not generated

The user mandated AquaTerra's palette. `generate_palette.py` was therefore not
run: the token layer in `frontend/src/styles/tokens.css` is the source of truth
and this section restates the subset TerraThon uses.

| Role | Token | Hex |
|---|---|---|
| Ground | `--bg` | `#F4EFE0` paper |
| Ground 2 | `--bg-2` | `#EDE6D0` |
| Ground 3 | `--bg-3` | `#E2D9BD` |
| Card | `--card` | `#FFFFFF` |
| Ink | `--ink` | `#0A0A0A` |
| Ink 2 | `--ink-2` | `#2A2A28` |
| Ink 3 | `--ink-3` | `#5A5A55` |
| Primary ask | `--tomato` | `#FF4D2E` |
| Highlight | `--lemon` | `#FFC700` |
| Info | `--sky` | `#3DA9FC` |
| Accent | `--pink` | `#FF4D8C` |
| Secondary | `--grape` | `#7E5BFF` |
| Confirmed | `--welfare` | `#1B8A5A` |

### Color contract (which pairings are legal)

The display hues above are **fills with `--ink` on top**. Several fail as text
on a light ground. Text-safe partners already exist in the token layer and are
the only legal way to put these hues on glyphs:

- Text-safe on `--card` and `--bg`: `--ink` (19.6:1), `--ink-2`, `--ink-3`
  (6.3:1), `--tomato-ink` `#C6300F` (5.45 / 4.74), `--sky-ink` `#0B6BB8`
  (5.52 / 4.80), `--welfare-ink` `#146F47` (6.18 / 5.38), `--grape-ink`
  `#6B44E8` (5.81 / 5.05), `--pink-ink` `#C4185C` (5.71 / 4.97), `--lemon-ink`
  `#7E6000` (5.92 / 5.15).
- Text-safe on ink `#0A0A0A`: `--bg` paper, `--card` white, `--lemon` (15.1:1),
  `--welfare` (4.55:1, large text only).
- **Fill + ink-on-top (always legal):** tomato, lemon, sky, pink, grape,
  welfare, each with `--ink` glyphs.
- **Illegal:** any display hue as small text on paper or white. Use its
  `*-ink` partner. Never `--lemon` as text on anything light.

## Type — BRAND-MANDATED

Already declared globally in `frontend/src/styles/v6.css`, so TerraThon adds
**no font request of its own**.

| Role | Family | Note |
|---|---|---|
| Display | NeutralFace Bold | **CAPS-ONLY.** Lowercase renders as capitals. Every use is `text-transform: uppercase`. |
| Body | Eina01 | The only real lowercase reading face. All prose. |
| Meta / labels | JetBrains Mono | Dates, prices, ref codes, digit columns. Genuinely tabular; NeutralFace is not. |
| Counterpoint | Instrument Serif italic | One word at a time, never a sentence. |

**No handwriting face.** Caveat sat in this table for exactly one margin note
and cost 49.7KB: the single heaviest asset on /terrathon and a quarter of all
font weight. Dropped 2026-09-19. The note is Eina01 now and reads as an
annotation through rotation and tomato ink, not through a novelty face.
TerraThon downloads six font files, every one of them already on the main site.

## Shape

- Border: `2px solid var(--ink)` on cards, `3px` on the primary CTA.
- Shadow: hard offset only, `Npx Npx 0 0 var(--ink)`. No blur, ever.
- Radius: 999 / 32 / 22 / 14 (the AQ scale). Chips are 999, cards 22, inner 14.
- Sticker badges: pill, 2px ink border, 3px hard shadow, rotated 1.5-3deg.

## Scale — points at the global token layer, invents nothing

Added 2026-09-19 after the section was called out as feeling disjoint from the
rest of the site. It was: the main pages run 44px pills with 12px/20px padding,
radii of 22/14/999 and body type around 15-17px. TerraThon ran 31px chips,
NINE radii and ELEVEN text sizes between 9.2px and 15.5px. Same brand, two
scales — that is what "inconsistent spacing" looks like in a diff.

`terrathon.css` now declares a scale block reading `styles/tokens.css`:

| token | value | use |
|---|---|---|
| `--tt-sp-1..8` | --sp-1 .. --sp-10 | every padding and gap |
| `--tt-section` | --sp-section | between page sections (class `.tt-sec`) |
| `--tt-block` | --sp-block | between blocks inside one |
| `--tt-fs-meta` | 12.5px | mono facts, dates, prices, hints, labels |
| `--tt-fs-body` | 15.5px | prose |
| `--tt-fs-lead` | 17px | the one paragraph under a page title |
| `--tt-fs-btn` | 15px | every button label, primary and quiet alike |
| `--tt-ctl` / `--tt-ctl-lg` | 44 / 52px | every control height |
| `--tt-r` / `-in` / `-out` / `-pill` | 22 / 14 / 32 / 999 | four radii, no others |

`--tt-fs-btn` was added 2026-09-21. `.tt-btn` and `.tt-btn--quiet` had drifted
to 15px and 13.5px, so the hero's "Grab a slot" and the "See the sports" pill
beside it set their labels at two different sizes on the same row. One token is
one answer; both variants read it now.

**Two text sizes, not eleven.** Anything at or under 13px was meta; 13.5 to
15.5 was prose. Headings keep their own clamp scale. A rendered page now
reports three radii (14/22/999) and nothing under the 12px floor except the
nav's tracked "26" superscript.

**At most two ink sections per screen** (house rule 3, tokens.css). Home had
five — poster, countdown strip, listing, close, footer — which made it strobe
dark and light on scroll. The clock moved inside the poster's own slab, the
listing went back to paper, the closing band is paper with a tomato button.
Poster and footer are the two.

**Motion comes from `lib/motion.ts`, never per-file constants.** The old code
used framer's `y` shorthand, which runs through requestAnimationFrame on the
MAIN thread — and these fire on route entry, exactly when the browser is
parsing a freshly code-split chunk, so they stuttered. `fadeInUp` uses the full
transform string, which composites off-thread, at 280ms on one curve.

**House rule 8 applies here too:** copy is never trimmed to fit. An earlier
pass shrank a sport-page fact value to 15.5px so a long date would squeeze into
half a screen. Long values take a full-width cell now, at one type size.

## Spacing — two tokens, and nothing hand-picked

Added 2026-09-19. Before this the section ran SIXTEEN hand-picked vertical
values and not one was on the scale: page tops of 0, 20, 26, 48, 56, 64, 70 and
80; page bottoms of 10, 60, 80, 90, 96 and 100; a rhythm between sections of 22
on contact, 32 on home and 36 on the sport pages. Every page was internally
tidy and no two agreed, which is what "inconsistent spacing" looks like once
you measure it instead of squinting.

| token | job |
|---|---|
| `--tt-section` | the vertical frame of a page, and the gap between major sections |
| `--tt-block` | the gap between blocks inside one section |
| `.tt-page` | `padding-block: var(--tt-section)` — every page stands in this |
| `--tt-sp-5` (20px) | the side gutter, on every page including the register sheet |

The register form had its own 24px gutter, which stepped it 4px in from the ink
bar it hangs off. It is 20 now, like everything else.

**Never hand-roll a reserve for the sticky CTA.** `terrathon.css` reserves the
bar's real height on `.tt-content` via `:has(.tt-sticky)`. The sport page also
carried a 96px pad from before that rule existed, and the two stacked to about
184px of dead space under every sport page.

## Subtraction — what was taken out, and why

Added 2026-09-19 after an anti-slop pass and a formal audit. Every one of these
was removed rather than restyled, and nothing replaced them.

**The marquee.** A 26s infinite loop of "Cricket · Pickleball · FIFA · 2 to 4
Oct", two tracks of six repeats, sitting between the chip rail (which lists all
three sports and the dates) and the listing (which shows all three as cards).
Each sport name appeared 15 times on the home page; 12 came from that band. It
is 3 now.

**Three tracked eyebrows.** "From tap to court" over "How it works", "Three
days" over "The weekend", "Why we play" over "It's a tournament and a
fundraiser" — each restating its own heading one size smaller. Kickers went 6 to
3. The survivors have jobs: the countdown's label and the footer's two column
heads. The four "TerraThon 2026" page eyebrows also stay; they name the parent
event for someone arriving straight on a sport page from a link.

**The bunting's blink.** Eleven pennants cycling 0.55 to 1.0 opacity on a
staggered 3.2s loop. Looked at rather than reasoned about: a lemon pennant at
0.55 on a lemon sky disappears, so it read as flags that had failed to load.
The section now reports zero infinite animations anywhere.

**Two of the six sport-page facts.** "Entry fee" and "Date" were on the screen
three times and twice over respectively: the ink hero carries a fee pill with
its unit and a date pill, and the sticky CTA repeats the fee again. Six equal
cards also made "Entry fee ₹2,400" and "Report by TBC" read as equally
important, in a stack 788px tall on a 375px phone. Four cards: 515px, and the
desktop grid now fills a row of four exactly instead of ending 4 + 2.

**The nav's hot CTA.** At 1280 the home page carried five tomato primaries; the
three page-level ones shared a label and a treatment, so two identically
weighted "Sign up" buttons were always in view. The nav's is the quiet variant
now — it is the persistent fallback, not the ask. The poster and the closing
band keep the tomato.

**Monospace on prose.** The poster meta set all four lines in JetBrains. Only
the price and the date range are data; "Team AquaTerra" and "Friday to Sunday"
are prose, and they are on the body face now.

**What survived the same test, and why:** the "Open / Filling fast / Closed"
sticker is three-state and data-driven; the mowing stripes are a pitch, not
texture for its own sake; the numbered How-it-works panels carry a real
sequence; the proof figures are checkable facts, not invented metrics.

## Motion — nothing above the fold, nothing that loops

Added 2026-09-19 after a visual pass found the hero animating itself into
existence. Two rules, both learned by looking:

**The hero never animates in.** The poster was a `motion.div` running
`fadeInUp` on mount. Caught mid-transition it is tomato at partial alpha over
its own ink slab, which resolves to a dark maroon smudge with grey type and a
grey-bordered CTA — the whole picture arrives looking broken and then corrects
itself. On a phone that transition starts when the lazy chunk lands, not when
the page does. Reveal-on-scroll is for things BELOW the fold; the step cards
and listing still use it.

**Illustrations hold still.** `StadiumScene` ran a 6s ball arc and a 7s roll,
both infinite. The arc crossed the middle of the sun disc at full opacity every
six seconds, and both ended their travel outside a `slice`-cropped viewBox, so
each loop finished with a ball sliced in half against the frame edge. What is
left moving is in-place and small — a 2px sway, an opacity blink — neither of
which can leave the frame. This matches what the section already decided for
its own background texture.

## Art — one composition per box shape

`.tt-poster` is 4/5 on a phone, 16/10 from 760px, 16/9 from 1100px, and
`PosterArt` was drawn once, portrait, with `slice` left to cover the rest. At
1280px that threw away 55% of the artwork's height from the CENTRE: a headless
torso, no sun, and a stretch of empty sky, on the most important screen of the
site. `xMidYMin` does not rescue it — at 16/9 the scrim leaves only the top 77
viewBox pixels showing.

So there are two cuts, swapped on the same 760px line the poster changes shape
on. The landscape viewBox is 1280x720 rather than 800x450 so both render at
about the same scale (0.85 vs 0.84) and one set of stroke weights reads with
the same heft in both.

**The scrim is drawn by the type block, not as a share of the card** — see
the note in terrathon.css. Sizing it as a percentage is what put the wordmark's
caps across the horizon at 768px.

## Density & spacing

8px base. Section padding is weighted by role, not uniform: hero and the
primary proof get 96-128px, connective sections 56-72px. Card internal padding
20-24px, never more than the gap between cards.

## Structure (Step 2.5)

- **Macrostructure:** Editorial Index. A black hero slab, then a cream index of
  cards, then the schedule as a ticket stack, then proof, then close.
  Chosen over Feature Stack because the product IS a listing of three things.
- **Archetypes:** nav = sticky rail with pill chips; hero = full-bleed ink slab
  with oversized wordmark; feature = **event-listing card** (see below); proof =
  credibility band; close = ink CTA band.

### Page rhythm, set 2026-09-19

The page used to run black hero → cream → cream → cream → cream, which is what
made it read as boring even though every individual section was fine. Ground
alternates now, and two of the three changes were the whole fix:

1. **The sports listing sits on an ink slab** (`.tt-listing`), cream cards on
   black. The reference's punchiest screen is exactly this, and a cream card on
   a cream page has nothing to push against. Biggest single improvement made.
2. **A three-panel artwork strip closes the hero** (`.tt-striprow`). The hero
   was six text blocks on flat black; this is the picture it was missing, it is
   full-bleed with no card around it, and it doubles as the fastest route into
   a sport page. The countdown card lost its sport list in the same move, since
   carrying the three sports twice in one viewport was the redundancy that made
   the hero read as a list.
3. **Card artwork is the sport's own scene**, not a flat swatch with an outline
   icon. `StadiumScene` already centre-crops, so it fills a square.

Order of grounds now: ink hero → artwork strip → lemon marquee → ink listing →
paper steps → paper schedule → paper proof → ink close → ink footer.

### The sport card, rebuilt 2026-09-19

Rebuilt against the event-ticketing reference this direction is named after,
because the first version had drifted into a generic feature card: colour band,
left-aligned title, a prose paragraph. The reference's anatomy is:

    sticker, rotated, over the top-right corner, OUTSIDE the border
    +---------------------------------+
    |             CRICKET             |  centred display title
    | ------------------------------- |
    | Sat, 3 Oct + Sun, 4 Oct     7+1 |  date left, squad right, one mono rule
    | [tile]  Entry     Rs 2,400 [tile]|
    |         Prize pot Rs 9,000      |  two identical tiles flank the meta
    |         Format    Knockout      |
    | ------------------------------- |
    | DETAILS               SIGN UP   |
    +---------------------------------+

Load-bearing rules, not taste:

- **No prose on the card.** The reference carries zero sentences here and it is
  right: someone comparing three sports is comparing numbers. The vibe line and
  the trivia moved to the sport's own page, which is where DETAILS goes.
- **The section head above it carries no kicker**, unlike every other head on
  the page. The reference runs a plain uppercase head over a listing.
- **The two tiles are identical.** That is how the reference frames artwork, and
  it reads as framing rather than content. Both are aria-hidden; the title
  already names the sport.
- **The card must never take `overflow: hidden`.** The sticker hangs outside
  the border on purpose, and the scroll rail's own top padding (17px) is what
  stops it being sliced in half. Both were real bugs, found by looking.
- **The second tile hides on a CONTAINER query at 300px, not a media query.**
  Card width does not track viewport width here: ~288px in the phone rail but
  only ~267px in the 3-up grid at 880px, so a media query is wrong in both
  directions. And `container-type: inline-size` measures the CONTENT box, so a
  351px card is 315px to the query.
- **Card tiles carry the scene, and the scene's loops are killed there.**
  Six tiles render on the home page; the ball-arc and roll animations are
  invisible detail at 72px and would put six infinite animations on the most
  important screen of the site for nothing. `.tt-tileart` stops them. The
  full-size scene on each sport page still animates.
- **Card reveal uses `animate`, never `whileInView`.** Below 860px the cards
  sit in a horizontal scroll rail and the third starts off-screen. With
  whileInView it never became visible: swiping to FIFA showed a blank card, and
  an IntersectionObserver confirmed the card at ratio 1.0 while framer-motion
  still held it at opacity 0. Framer's observer does not re-fire for an element
  brought in by container scroll. Never gate whether content is visible at all
  on a scroll observer.
- **Narrative beats:** hook (the wordmark and the date) → problem (slots close,
  a countdown) → solution (three sports, priced) → how it works (four steps,
  visual) → proof (registered NGO, track record) → close (sign up).

## Assets

- No photography: this event has not happened yet, so stock photos of other
  people's cricket matches would be a lie. Everything is custom flat-vector SVG
  drawn in-repo (`components/SportIcons.tsx`, `components/StadiumScene.tsx`).
  Re-tested 2026-09-19 when the reference's photo-led hero was being matched:
  `fetch_photos.py` returned a wide HDR shot of a Test match in Cape Town.
  Wrong scale, wrong place, and it would imply this student fundraiser is
  something it is not. The reference's photo slots take AQ's own graphic marks
  instead. Do not re-litigate this with stock imagery.
- No sponsor logos until real ones exist (`config.ts` `PARTNERS` is empty and
  the band renders nothing rather than showing placeholders).

## Layout traps found by looking, 2026-09-19

Three defects that every static check passed and only a screenshot caught:

- **`.tt-linklist` needs `align-content: start`.** Two of these sit side by
  side in a flex row, so both get stretched to the taller one's height, and a
  grid's default `align-content: normal` then stretches its ROWS to fill. The
  footer's 3-link column inflated its rows to 56px while the 4-link column
  stayed at 44px, and the two lists visibly failed to line up.
- **`text-wrap: balance` cannot fix a headline whose longest word already
  fills the column.** "It's a tournament and a fundraiser" at 30px broke as
  IT'S A / TOURNAMENT / AND / A FUNDRAISER. Lowering the clamp floor to 25px is
  what actually fixed it. NeutralFace caps are wider than they look; measure.
- **The status sticker hangs outside the card**, so the card must never take
  `overflow: hidden` and the scroll rail needs 17px of top padding. A scroll
  container clips its cross axis, which sliced the sticker in half.

## Dark mode

None. The section is paper-ground only, matching the AQ public site.

## Motion

CSS transforms and framer-motion. Everything behind `useReducedMotion()` or the
`prefers-reduced-motion` query. No GSAP: the repo does not ship it and the
bundle budget (200 KB per lazy chunk) does not have room for it.

## Motion findings knowingly accepted

`scripts/audit_motion.py` reports five HIGH findings on this section. All five
were checked by hand and are false positives of a substring match:

- `ease-in-ui` x3 (StadiumScene 165/167, Register 505) — the source says
  `ease-in-out`, not `ease-in`, and all three are infinite ambient loops
  (bunting twinkle, net sway, submit-button bounce). A symmetric loop wants a
  symmetric curve; `ease-out` would make each cycle land wrong.
- `layout-transition` x2 (terrathon.css 197, Dashboard 401) — the property is
  `box-shadow`, which is paint, not layout. It is also the entire neubrutalist
  press: the hard offset shadow collapses as the button moves into the page.
  Replacing it with transform/opacity would delete the interaction.

Genuinely fixed from that audit: hover transforms are now gated behind
`@media (hover: hover) and (pointer: fine)`, because on a touch screen the
hover state latches after a tap and leaves the button visibly displaced.

The per-file `missing-reduced-motion` findings are covered by the single
`prefers-reduced-motion: reduce` block in `terrathon.css`, which neuters every
animation and transition under `.tt-root`. The scanner reads one file at a time
and cannot see it.


## Star stickers — one definition, 2026-09-21

`components/StarStickers.tsx`. The poster's blue star was inline in `Home.tsx`
and nowhere else, so the campaign's most recognisable punctuation appeared on
the landing page and vanished on the seven pages behind it. It is now a shared
component with two sets: `hero` (Home's original pair, values unchanged, so
extracting it moved no pixel) and `page` (the inner-page header pair).

Two rules, both learned by measuring rather than looking:

**Inner-page stars live in the KICKER BAND only.** On a phone the lead
paragraph runs the full column width, so unlike the desktop hero there is no
free right-hand gutter. A first attempt at `top: 52px, right: 15%` printed
through the first line of Rules' lead paragraph at 375px (star y 145-173, glyph
run y 169). The kicker is short and fixed, so the right of that band is the one
reliably empty strip at every width.

**The stars sit at `z-index: -1` under `isolation: isolate`, not `z-index: 0`.**
A positioned element at 0 paints ABOVE in-flow text: at 320px the stars landed
on "Ask a human" and "The weekend". Home only escaped that because its hero
content carries an explicit `z-index: 1` layer. At -1 inside an isolated
stacking context they paint above the anchor's background and below all of its
text, at every width and every title length. It is also what the poster does:
its stars sit behind the lockup, not on it.

Measure a star clash with `Range.getClientRects()` on the text nodes, never
with the element's bounding box. A heading is a full-width block, so its box
reports a false overlap whatever the stars do.
