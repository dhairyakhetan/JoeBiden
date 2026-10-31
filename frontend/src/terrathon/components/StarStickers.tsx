/**
 * The poster's blue star stickers, as one definition.
 *
 * WHY THIS EXISTS
 *
 * The stars were inline in Home.tsx and nowhere else, so the campaign's most
 * recognisable piece of punctuation appeared on the landing page and vanished
 * on the seven pages behind it. Measured 2026-09-21: /terrathon carried two
 * stars, /terrathon/schedule, /rules, /contact and the sport pages carried
 * none. Same brand, one page wearing it.
 *
 * PLACEMENT IS LOAD-BEARING, NOT DECORATIVE TASTE
 *
 * Every TerraThon page stacks its type LEFT against the gutter, so the left
 * column is always occupied and the right column is always free. Home learned
 * this the hard way twice, and both scars are recorded in its own comments: a
 * star at 4%/4% printed through the middle of "TEAM AQUATERRA PRESENTS", and
 * one at 46%/14% landed on the countdown's last digit. So every position here
 * is right-of-centre and above the fold line of the content that follows.
 *
 * They are `aria-hidden` with `pointer-events: none` and `z-index: 0`, so they
 * can never be read out, never take a tap meant for a control, and never sit
 * above the text they frame.
 *
 * `/terrathon/star.webp` is a plain public/ file, like the sport stickers and
 * the photographs. It never enters the JS graph, so adding it to seven more
 * pages costs the bundle nothing (lib/photos.ts records the same reasoning).
 * It is also already fetched for the home page, so on any journey that starts
 * at /terrathon it is a cache hit.
 */

/** One sticker. `right` only: see the placement note above. */
interface Star {
  top: string
  right: string
  size: number
  rotate: number
}

/**
 * `hero` is Home's own pair, kept identical so extracting this changed no
 * pixel there. `page` is the quieter pair for an inner page header, which has
 * a kicker and one line of title rather than a full lockup to frame.
 */
const SETS: Record<'hero' | 'page', Star[]> = {
  hero: [
    { top: '5%', right: '5%', size: 54, rotate: -12 },
    { top: '26%', right: '17%', size: 30, rotate: 16 },
  ],
  /**
   * Both of these sit in the KICKER BAND, the strip holding "TerraThon 2026",
   * and neither reaches the title below it. That is not a stylistic
   * preference, it is the only band that is reliably free.
   *
   * On a phone the lead paragraph runs the full column width, so unlike the
   * desktop hero there is no empty right-hand gutter to scatter into. The
   * first version of this put the second star at `top: 52px, right: 15%` and
   * it printed straight through the first line of Rules' lead paragraph at
   * 375px: star spanned y 145-173, the glyph run sat at y 169. Measured with
   * Range.getClientRects(), because the heading's own bounding box is
   * full-width and reports a false overlap either way.
   *
   * The kicker is short and fixed ("TerraThon 2026" ends around x=185 at
   * 375px), so everything right of about x=250 in that band is empty at every
   * width the section supports.
   */
  page: [
    { top: '-8px', right: '3%', size: 44, rotate: -14 },
    { top: '14px', right: '24%', size: 20, rotate: 18 },
  ],
}

export interface StarStickersProps {
  /** Which set to paint. Defaults to the inner-page pair. */
  variant?: 'hero' | 'page'
}

/**
 * Absolutely positioned, so the PARENT must be `position: relative` or these
 * will hang off the nearest positioned ancestor and land somewhere arbitrary.
 * Every call site here sets it explicitly rather than relying on inheritance.
 */
export function StarStickers({ variant = 'page' }: StarStickersProps) {
  return (
    <>
      {SETS[variant].map((s, i) => (
        <img
          key={i}
          src="/terrathon/star.webp"
          alt=""
          aria-hidden="true"
          width={s.size}
          height={s.size}
          style={{
            position: 'absolute',
            top: s.top,
            right: s.right,
            width: s.size,
            height: s.size,
            transform: `rotate(${s.rotate}deg)`,
            pointerEvents: 'none',
            /* -1, not 0. A positioned element at z-index 0 paints ABOVE
               in-flow text, so at 320px the stars sat ON the titles: measured
               clashes against "Ask a human" and "The weekend" with
               Range.getClientRects(). Home only escaped that because its hero
               content carries an explicit z-index: 1 layer.
               At -1 they paint above the anchor's own background and below all
               of its text, at every width and every title length, which is
               also what the poster does: its stars sit behind the lockup.
               This REQUIRES `isolation: isolate` on the anchor, or -1 escapes
               the local stacking context and disappears behind the page. Every
               call site sets it. */
            zIndex: -1,
          }}
        />
      ))}
    </>
  )
}

export default StarStickers
