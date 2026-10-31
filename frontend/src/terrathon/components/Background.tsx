/**
 * The ambient layer: two static paper textures, fixed behind everything.
 *
 * Deliberately quiet. The dark build had a drifting silhouette field, which
 * made sense on a floodlit-pitch ground and makes none on cream: on paper it
 * reads as smudges, and the page's energy now comes from the ink slabs, the
 * sticker badges and the type, which is where it belongs.
 *
 * Neither layer animates. A moving texture on a cream ground is noise, and it
 * costs real battery on the mid-range Android this audience mostly arrives on.
 */
export function Background() {
  return (
    <div className="tt-bg" aria-hidden="true">
      <div className="tt-bg__stripes" />
      <div className="tt-bg__grain" />
    </div>
  )
}
