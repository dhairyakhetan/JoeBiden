/**
 * The poster's artwork.
 *
 * Not `StadiumScene`. That one is composed for a wide banner, roughly 60% sky
 * with the pitch along the bottom, so in a portrait crop its subject lands at
 * 68-84% of the height, exactly where the scrim goes opaque. The card read as
 * a large orange gradient.
 *
 * Two rules this composition follows, both learned by looking at it:
 *
 * 1. **The subject lives in the top 45%.** Below that the scrim takes over, so
 *    anything down there is being drawn to be hidden.
 * 2. **The figure is drawn in MASS, not line.** A thin stroked figure fading
 *    into the gradient loses its legs and reads as a lollipop. Heavy round
 *    strokes give it a silhouette that survives being half-swallowed, which is
 *    how a poster is supposed to treat a figure meeting its own shadow.
 *
 * It is also the PHOTO SLOT. When a real frame exists, this whole element is
 * swapped for a picture with object-fit cover, and nothing else has to change.
 *
 * aria-hidden, because it carries no information the page does not already
 * state in words: the name, the dates and the sports are all in the markup.
 *
 * ── Two compositions, because one cannot survive both boxes ────────────────
 *
 * `.tt-poster` is 4/5 on a phone, 16/10 from 760px and 16/9 from 1100px. This
 * artwork was drawn once, portrait, and `slice` was left to deal with the
 * rest, which it does by cropping the CENTRE. At 1280px the poster measures
 * 1084x610, the portrait art scales to 1084x1355 to cover it, and 55% of its
 * height is thrown away: everything above y=139 and below y=364 of 500. What
 * survived on a desktop was a headless torso, no sun at all, and a stretch of
 * empty sky: the hero of the site, reading as a rendering fault.
 *
 * `xMidYMin` does not save it. At 16/9 the scrim leaves only the top 44% of
 * the card showing, which is the top 77 viewBox pixels: sky, and the crown of
 * the sun.
 *
 * So there are two. Same palette, same figure, same rules; one composed for a
 * tall box and one for a wide one, swapped on the same 760px line the poster
 * changes shape on. The landscape viewBox is 1280x720 rather than 800x450 so
 * that both render at about the same scale (0.85 wide, 0.84 tall) and one set
 * of stroke weights reads with the same heft in both.
 */
function Portrait({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 500"
      preserveAspectRatio="xMidYMid slice"
      width="100%"
      height="100%"
      className={className}
      aria-hidden="true"
    >
      <rect width="400" height="500" fill="var(--tomato, #FF4D2E)" />

      {/* Sun, high right, clear of everything */}
      <circle cx="322" cy="84" r="54" fill="var(--lemon, #FFC700)" stroke="#0A0A0A" strokeWidth="3.5" />
      <path d="M296 40a54 54 0 0 1 0 88" fill="none" stroke="#0A0A0A" strokeWidth="2.6" />

      {/* Ground. The horizon peaks around 37% so a real band of green shows
          BEFORE the scrim turns solid at 47%. At half height it was drawn
          entirely inside the part of the card that is painted over, and the
          poster lost a whole colour for nothing. */}
      <path d="M-50 500a250 310 0 0 1 500 0Z" fill="var(--welfare, #1B8A5A)" stroke="#0A0A0A" strokeWidth="3.5" />

      {/* The bat, behind the arms so the hands sit on top of the handle */}
      <g strokeLinecap="round">
        <path d="M112 212 76 300" stroke="#0A0A0A" strokeWidth="26" />
        <path d="M112 212 76 300" stroke="var(--bg, #F4EFE0)" strokeWidth="18" />
        <path d="M118 196 108 220" stroke="#0A0A0A" strokeWidth="9" />
      </g>

      {/* The batter, in mass. Round caps and heavy strokes, so the silhouette
          still reads where the scrim swallows the lower half. */}
      <g stroke="#0A0A0A" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="19">
        <path d="M152 156v84" />
        <path d="M152 240l-30 62" />
        <path d="M152 240l30 58" />
        <path d="M152 186l-38 24" />
        <path d="M152 196l-30 18" />
      </g>
      <circle cx="152" cy="126" r="27" fill="#0A0A0A" />
      {/* Helmet grille, the one warm note on the figure */}
      <path d="M130 132h20" stroke="var(--lemon, #FFC700)" strokeWidth="5" strokeLinecap="round" />

      {/* Ball, mid-flight */}
      <circle cx="300" cy="196" r="16" fill="var(--bg, #F4EFE0)" stroke="#0A0A0A" strokeWidth="3.5" />
      <path d="M289 185a16 16 0 0 1 0 22" fill="none" stroke="#0A0A0A" strokeWidth="2.4" />
    </svg>
  )
}

function Landscape({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1280 720"
      preserveAspectRatio="xMidYMid slice"
      width="100%"
      height="100%"
      className={className}
      aria-hidden="true"
    >
      <rect width="1280" height="720" fill="var(--tomato, #FF4D2E)" />

      {/* Sun, high right and well clear of the wordmark under it */}
      <circle cx="1060" cy="130" r="54" fill="var(--lemon, #FFC700)" stroke="#0A0A0A" strokeWidth="3.5" />
      <path d="M1034 76a54 54 0 0 1 0 108" fill="none" stroke="#0A0A0A" strokeWidth="2.6" />

      {/* Ground. rx is half the chord, so the arc rises by exactly ry and the
          horizon peaks at 720-390 = 330, above the 397 where the scrim turns
          solid, which is the whole point: a real band of green has to show
          BEFORE the ink starts, or the poster loses a colour for nothing. */}
      <path d="M-100 720a740 390 0 0 1 1480 0Z" fill="var(--welfare, #1B8A5A)" stroke="#0A0A0A" strokeWidth="3.5" />

      {/* Bat, behind the arms so the hands sit on top of the handle */}
      <g strokeLinecap="round">
        <path d="M290 296 254 384" stroke="#0A0A0A" strokeWidth="26" />
        <path d="M290 296 254 384" stroke="var(--bg, #F4EFE0)" strokeWidth="18" />
        <path d="M296 280 286 304" stroke="#0A0A0A" strokeWidth="9" />
      </g>

      {/* The batter, in mass, same rule as the portrait cut. */}
      <g stroke="#0A0A0A" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="19">
        <path d="M330 240v84" />
        <path d="M330 324l-30 62" />
        <path d="M330 324l30 58" />
        <path d="M330 270l-38 24" />
        <path d="M330 280l-30 18" />
      </g>
      <circle cx="330" cy="210" r="27" fill="#0A0A0A" />
      <path d="M308 216h20" stroke="var(--lemon, #FFC700)" strokeWidth="5" strokeLinecap="round" />

      {/* Ball, mid-flight, on the open side of the frame */}
      <circle cx="864" cy="250" r="16" fill="var(--bg, #F4EFE0)" stroke="#0A0A0A" strokeWidth="3.5" />
      <path d="M853 239a16 16 0 0 1 0 22" fill="none" stroke="#0A0A0A" strokeWidth="2.4" />
    </svg>
  )
}

export function PosterArt({ className }: { className?: string }) {
  // Both are rendered and one is hidden in CSS, rather than switching on a JS
  // media query. A `matchMedia` here would paint the wrong composition for the
  // first frame after hydration, on the one element that must be right
  // immediately. See the note on .tt-poster in Home.tsx.
  return (
    <>
      <Portrait className={`${className ?? ''} tt-poster__art--tall`.trim()} />
      <Landscape className={`${className ?? ''} tt-poster__art--wide`.trim()} />
    </>
  )
}
