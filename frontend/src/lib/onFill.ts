/* ─────────────────────────────────────────────────────────────────────────
   The on-fill contrast branch — redesign section 29, rule 5a.

   ONE source for the question "what colour does label-sized text take when it
   sits on this fill". Section 29 states the rule and then states why it needs
   a home:

     Ink on `#C4185C` is 3.42:1 at ANY size; paper on it is 5.03:1 and white is
     5.78:1. Every other palette hue clears 4.5:1 with ink at 9px (sky 7.81,
     tomato 5.99, teal 5.18, grape 4.55, welfare 4.55, lemon well clear). So
     the rule for any coloured bar or band component is: display type takes
     ink; sub-24px text takes paper when the hue is pink, ink otherwise. Put
     that branch in the component. This was reintroduced four separate times in
     one session by patching instances instead.

   Before this file the branch was correct in four separate components
   (`public/LabsPage.tsx`, `public/AboutPage.css`, `feed/PostPage.css`,
   `public/JoinPromoPage.tsx`) and hand-derived in each of them, which is the
   drift that let it come back four times. It is now DERIVED, not typed: the
   answer is computed from the measured contrast of the fill, so a fifth
   surface cannot get it wrong and a hue whose hex changes re-answers itself.

   TWO COLOURS, ONE NAME, AND ONLY ONE OF THEM IS THE PROBLEM. `--pink` is
   `#FF4D8C` and measures 6.31:1 with ink — it PASSES at any size. `--pink-ink`
   is `#C4185C` and measures 3.42:1 — that is the branch. Four source comments
   in this tree had pinned the failure on the wrong one of the two.

   The CSS side of the same answer is the `--on-<fill>` token block in
   `styles/tokens.css`. `onFill.test.ts` asserts the two agree, so they cannot
   drift apart.

   Pure, no DOM, no React.
   ───────────────────────────────────────────────────────────────────────── */

import { INK_HEX, PAPER_HEX, contrastRatio } from './stickerShapes'

/** Every palette token that is used as a FILL with text sitting on it. */
export type FillToken =
  | 'welfare'
  | 'events'
  | 'sky'
  | 'labs'
  | 'lemon'
  | 'ops'
  | 'teal'
  | 'content'
  | 'grape'
  | 'tomato'
  | 'pink'
  | 'pink-ink'
  | 'rust'
  | 'ink'
  | 'ink-2'

/** The same values as `styles/tokens.css`, as hexes, for contrast maths only.
    Nothing here adds a colour: every entry is a token that already exists. */
export const FILL_HEX: Record<FillToken, string> = {
  welfare: '#1B8A5A',
  events: '#3DA9FC',
  sky: '#3DA9FC',
  labs: '#FFC700',
  lemon: '#FFC700',
  ops: '#12909C',
  teal: '#12909C',
  content: '#7E5BFF',
  grape: '#7E5BFF',
  tomato: '#FF4D2E',
  pink: '#FF4D8C',
  'pink-ink': '#C4185C',
  rust: '#C4231A',
  ink: '#0A0A0A',
  'ink-2': '#2A2A28',
}

/**
 * The branch, computed. Ink sits on a fill unless ink fails the 4.5:1 floor and
 * paper does better — which is exactly the `#C4185C` / `#C4231A` case.
 *
 * This answers for LABEL-SIZED text (under 24px, so 4.5:1 applies). Display
 * type at 24px and above only needs 3:1 and stays ink on every palette hue;
 * that is rule 5, and it is a different question from this one.
 */
export function onFillHex(fill: FillToken): string {
  const bg = FILL_HEX[fill]
  const ink = contrastRatio(INK_HEX, bg)
  if (ink >= 4.5) return INK_HEX
  const paper = contrastRatio(PAPER_HEX, bg)
  return paper > ink ? PAPER_HEX : INK_HEX
}

/** The same answer as a CSS custom-property reference, for a `style` prop. */
export function onFill(fill: FillToken): string {
  return onFillHex(fill) === PAPER_HEX ? 'var(--paper)' : 'var(--ink)'
}

/** `var(--welfare)` → `welfare`. Returns null for anything not a palette fill. */
export function fillTokenFromVar(cssVar: string): FillToken | null {
  const m = /^var\(--([a-z0-9-]+)\)$/i.exec(cssVar.trim())
  if (!m) return null
  const name = m[1] as FillToken
  return name in FILL_HEX ? name : null
}

/**
 * The answer for a `var(--x)` fill string, which is how department and venture
 * hues travel through the app (`lib/departments.ts` stores literal token
 * references, never a category lookup). An unknown fill falls back to ink,
 * matching the palette's majority case.
 */
export function onFillVar(cssVar: string): string {
  const token = fillTokenFromVar(cssVar)
  return token ? onFill(token) : 'var(--ink)'
}
