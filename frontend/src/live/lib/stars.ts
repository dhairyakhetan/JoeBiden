/** A small seeded generator, so the sky is the same on every visit and in every test. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * One `box-shadow` value that paints `count` stars from a single 1px element. Offsets are in vw and vh, so the layer
 * fills the viewport at any size without a canvas, an image or a resize listener.
 */
export function starShadows(count: number, seed: number, color: string): string {
  const rand = mulberry32(seed)
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const x = (rand() * 100).toFixed(2)
    const y = (rand() * 100).toFixed(2)
    out.push(`${x}vw ${y}vh ${color}`)
  }
  return out.join(', ')
}
