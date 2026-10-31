# Greeting section — reference DNA (owner-supplied, 2026-09-07)

Owner sent a mobile-app reference as "inspiration for greetings section".
This governs the VISUAL treatment of the ink greeting block that hosts the
adaptive grid (`lib/gridRecipes.ts` + `components/AdaptiveGrid.tsx`).

## DNA to take (structure, not pixels)

1. **The greeting names the person and states a FACT, in oversized mixed-weight
   type.** Reference: "Hello 👋 Taylor! your overall score exceeds the average."
   and "You have 5 tasks for today". The sentence *is* the headline — it is not
   a greeting followed by a separate stat. Weight alternates mid-sentence
   (regular for connective words, bold for the payload).
2. **Inline chips inside the sentence** — a small round avatar or glyph sitting
   between words, on the text baseline. This is the strongest single device in
   the reference.
3. **One big number carries the section.** The reference's yellow card is 94%
   at display scale against small mono labels.
4. **A small date chip** ("12 Wed") as a quiet anchor, mono, top-left.
5. **Stacked cards with DIFFERENT fills** — one saturated hue card among
   otherwise neutral ones.
6. **A tag row** of low-weight mono hashtags under the statement.

## What NOT to take
- The pastel-lavender ground, the phone-frame mockup, the emoji (😇, 🏆).
  DESIGN.md forbids emoji-as-icons and there is already an open finding about
  eight emoji leaking onto `/links`.
- The rounded-square iOS card language — AQ's spine is 999/32/22/14.

## Where it must NOT conflict
Section 34's four non-negotiables still bind and OVERRIDE this reference
wherever they disagree:
  1. the grid lives INSIDE the ink greeting block, never its own section
  2. row unit is 72px, FIXED — do not re-derive it
  3. tiles are rgba(244,239,224,.07) on ink, EXACTLY ONE solid hue tile per
     recipe — the wash is what makes the hue tile read as the answer
  4. icons only on tiles spanning two or more rows
Plus: every recipe ends with the full-width map tile, and a figure the host
cannot resolve renders as a dashed live marker, NEVER a zero (a zero is a claim).

Point 5 of the DNA ("one saturated card among neutrals") is the same idea as
non-negotiable 3 — they agree. Point 1 (the sentence IS the headline) is the
real change to make, and it is compatible with all four.

---

# Footer — owner's amplification note (2026-09-07, AFTER the first build)

Owner's words, on seeing the first footer pass:
> "footer can be more colorful and lively and the font can be better and can be
> visually properly sexy"

This is a SECOND pass over the footer that the first agent built. It is a
turn-up-the-volume brief, not a rebuild — the structure the owner already
approved stands (hi bubbles → bento of links → AQ-is manifesto + CTA → dark
closing bar).

## What to push
1. **Colour.** The first pass will likely have been conservative on ink ground.
   AQ has EIGHT distinct department hues (`lib/departments.ts`) sitting unused
   in this surface. The bento is the natural home for them — tiles can carry
   real hue, not just a wash. §14 does not forbid colour; it forbids hard offset
   shadows, dashed borders and outlines on images.
2. **Type.** "the font can be better" — the footer currently leans mono/small.
   The house display face is Eina 800 for lowercase; Instrument Serif italic is
   the accent device (one italic serif word in `var(--welfare)`), and
   NeutralFace is uppercase-only (it has NO lowercase glyphs — never give it
   `text-transform: lowercase`). DESIGN.md §0.1 also sanctions **Caveat** as a
   fifth face everywhere EXCEPT `director/*`. The manifesto section is the
   single best place in the product for oversized display type.
3. **Liveliness.** §14.0 explicitly says the footer is "the only place in the
   redesign where ambitious motion is free" — below the fold on every route,
   lazy chunk, no critical-path cost. Spend it.

## What still binds — do not trade these away for volume
- Radius spine 999/32/22/14 only.
- Text on a saturated fill is FULL-OPACITY INK, always. More colour means more
  text-on-fill pairs, which is exactly where this project has broken contrast
  five separate times. Measure every new pair.
- Paper-on-ink alphas floor at 0.55.
- ONE IntersectionObserver, ONE rAF loop, NO framer-motion import (44.4KB gz;
  the audit's goal is getting it OUT of the modulepreload list).
- Exactly ONE `<video>` element (the stitched hi-reel; 8 bubbles = 8 masked
  windows onto one decoder).
- Footer CSS stays in the lazy chunk, out of critical `index-*.css`.
- Hit targets >= 44x44. Every existing link destination and legal string survives.
