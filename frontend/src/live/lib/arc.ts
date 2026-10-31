/**
 * The pose of one card in the photo arc, as a function of its signed distance from the centre in card units (fractional while the
 * arc drifts). Pure so the geometry can be pinned by tests: the claims that matter are that the centre card is edge-on, the
 * edges face the viewer, the left and right halves mirror each other, and nothing ever overlaps in the wrong order.
 */
export interface ArcPose {
  /** px, before the responsive unit is applied */
  x: number
  /** a small lift so the outer cards sit slightly lower, as if on a shelf curving toward the viewer */
  y: number
  z: number
  /** degrees about the vertical axis */
  rot: number
  scale: number
  /** stacking: outer cards in front */
  order: number
}

export const EDGE_ON = 86

export function arcPose(offset: number): ArcPose {
  const a = Math.abs(offset)
  // 0 counts as the right-hand side, so the centre card is edge-on too. +86 and -86 are mirror images of the same sliver.
  const s = offset < 0 ? -1 : 1
  return {
    x: s * (a * 34 + a * a * 4.4),
    y: a * a * 1.1,
    z: a * 26,
    rot: s * Math.max(0, EDGE_ON - a * 12.5),
    scale: 0.8 + Math.min(a, 6) * 0.07,
    order: Math.round(a * 10),
  }
}
