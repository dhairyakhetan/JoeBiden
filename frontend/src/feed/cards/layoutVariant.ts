/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Deterministic layout variants within a single card shape.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   THE PROBLEM, MEASURED

   Across all 584 published posts, counted against the live table rather than
   sampled:

     C02  photo + colour block   214   37%
     C03  standard photo post    186   32%
     C04  stacked collection     100   17%
     C05  pull quote              66   11%
     C07  text post, medium       12    2%
     C01  full-bleed hero          5    1%

   So 69% of the feed is two shapes, and both of them are "a photo with words
   under it". Worse, C02 carries two caps (a ten-row gap and a different hue
   from the last block), so most of its 214 get demoted to C03 at render time.
   C03 is, in practice, the feed.

   `varyRuns` in feedCompose.ts already exists to break up repeats, and it
   cannot help here. Its ring for C03 is ['C02', 'C01', 'C04'], and for a
   typical row every one of those fails `canRender`: C04 needs three images,
   C01 needs the one-per-session hero budget, C02 needs a mapped hue AND a body
   in a narrow band. The rotation falls through and re-emits C03. The variation
   machinery is sound; it simply has nothing to rotate TO.

   WHY A VARIANT RATHER THAN NEW SHAPE IDS

   The obvious fix is new shapes, C31 and C32, in the rotation rings. That
   means editing `CardShape` in lib/feedShape.ts, and ACCEPTANCE §E requires
   that file to be byte-identical: "no rule, threshold, family order or return
   shape changes". Its own history shows the cost of going around that - two
   separate owner decisions had to be written down when the freeze turned out
   to be protecting an error.

   This is not one of those cases. The freeze is protecting nothing here,
   because the chooser does not need to change at all: WHICH shape a post gets
   is already right, and what is missing is variety WITHIN the shape. So the
   variant is derived inside the card from the item it was already handed. No
   chooser rule moves, no id joins the union, no registry gains an entry, and
   `feedShape.test.ts` keeps passing unmodified.

   THE ONE PROPERTY THAT MATTERS

   Everybody sees the same layout for the same post. The variant is a pure
   function of `item.id`, which is the post's uuid - not of the scroll
   position, the session, the viewer, or the time. Two people looking at the
   same post on two phones see the same card, and it stays the same card
   tomorrow. That was the explicit requirement, and it is the reason this is a
   hash rather than a counter or a shuffle.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/**
 * FNV-1a, 32-bit. Chosen for being tiny, dependency-free and well distributed
 * over short ASCII strings, which is exactly what a uuid is. The exact
 * algorithm does not matter; being STABLE does, so do not swap it casually -
 * every post's layout would change the day you did.
 */
function hash32(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    // h *= 16777619, kept in 32-bit range without overflowing to a double.
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return h >>> 0
}

/**
 * Pick one of `count` layout variants for a card, stably.
 *
 * @param seed  The post's own id. Anything stable and unique per post works;
 *              anything per-session or per-viewer defeats the whole point.
 * @param count How many variants the card implements. Must be >= 1.
 * @param salt  Distinguishes two independent variant choices on the same post,
 *              so a card that varies both its layout and, say, its rule colour
 *              does not tie them together and halve the combinations.
 */
export function layoutVariant(seed: string | null | undefined, count: number, salt = ''): number {
  if (!seed || count <= 1) return 0
  return hash32(salt ? `${salt}:${seed}` : seed) % count
}
