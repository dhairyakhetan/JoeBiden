/** Small helpers every mini game shares. Personal bests live in THIS browser only (localStorage): nothing is sent anywhere,
 *  and nobody is ranked against anyone (docs/plans/delight-pass.md). */
const KEY = (slug: string) => `aq_game_best_${slug}`

export function readBest(slug: string): number | null {
  try {
    const v = window.localStorage.getItem(KEY(slug))
    const n = v == null ? NaN : Number(v)
    return Number.isFinite(n) ? n : null
  } catch { return null }
}

export function writeBest(slug: string, value: number): void {
  try { window.localStorage.setItem(KEY(slug), String(value)) } catch { /* private window: the game still plays */ }
}

/** Pure: is `next` a new best? `higherIsBetter` is true for scores, false for times. */
export function isNewBest(prev: number | null, next: number, higherIsBetter: boolean): boolean {
  if (!Number.isFinite(next)) return false
  if (prev == null) return true
  return higherIsBetter ? next > prev : next < prev
}
