import type { SportSlug } from '../lib/types'

/**
 * Flat-vector poster scenes, one per sport.
 *
 * Redrawn for the paper-and-ink system: these used to be dusk-lit gradient
 * stadiums, which only worked against a charcoal page. Here they are colour
 * blocks with hard ink linework, the same language as the cards and stickers.
 *
 * Custom SVG rather than photography on purpose. TerraThon 2026 has not
 * happened, so a stock photo of someone else's cricket match would be dressing
 * the page with a scene that is not this event.
 *
 * Motion is CSS keyframes inside a `no-preference` block, which is the safe
 * direction for that gate: a browser that does not understand the query gets
 * the still poster rather than unstoppable movement.
 */

function Cricket() {
  return (
    <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" aria-hidden="true">
      <rect width="400" height="260" fill="var(--tomato, #FF4D2E)" />

      {/* Sun disc */}
      <circle cx="318" cy="62" r="42" fill="var(--lemon, #FFC700)" stroke="#0A0A0A" strokeWidth="3" />

      {/* Outfield */}
      <ellipse cx="200" cy="268" rx="248" ry="116" fill="var(--welfare, #1B8A5A)" stroke="#0A0A0A" strokeWidth="3" />
      <ellipse cx="200" cy="272" rx="152" ry="70" fill="none" stroke="#0A0A0A" strokeWidth="2" strokeOpacity="0.45" />

      {/* Pitch strip */}
      <path d="M178 258 L222 258 L234 168 L166 168 Z" fill="var(--bg-3, #E2D9BD)" stroke="#0A0A0A" strokeWidth="2.5" />
      <g stroke="#0A0A0A" strokeWidth="2" strokeOpacity="0.55">
        <path d="M172 228 H228" />
        <path d="M169 202 H231" />
      </g>

      {/* Stumps */}
      <g stroke="#0A0A0A" strokeWidth="3" strokeLinecap="round">
        <path d="M192 170 v-16M200 170 v-16M208 170 v-16" />
        <path d="M189 154 h22" />
      </g>

      {/* Ball arcing out, on a 6s loop */}
      <g className="tt-arc">
        <circle cx="0" cy="0" r="11" fill="var(--bg, #F4EFE0)" stroke="#0A0A0A" strokeWidth="3" />
        <path d="M-6 -6 A 9 9 0 0 1 -6 6" fill="none" stroke="#0A0A0A" strokeWidth="2" />
      </g>
    </svg>
  )
}

function Pickleball() {
  return (
    <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" aria-hidden="true">
      <rect width="400" height="260" fill="var(--lemon, #FFC700)" />

      {/* Bunting */}
      <path d="M-10 34 Q200 76 410 34" fill="none" stroke="#0A0A0A" strokeWidth="2.5" />
      {Array.from({ length: 11 }, (_, i) => {
        const t = i / 10
        const x = -10 + t * 420
        const y = 34 + Math.sin(Math.PI * t) * 40
        const hue = ['var(--pink, #FF4D8C)', 'var(--sky, #3DA9FC)', 'var(--bg, #F4EFE0)'][i % 3]
        return (
          <g key={i}>
            <path d={`M${x - 9} ${y} L${x + 9} ${y} L${x} ${y + 17} Z`} fill={hue} stroke="#0A0A0A" strokeWidth="2.5" />
          </g>
        )
      })}

      {/* Court in perspective */}
      <path d="M44 260 L118 138 L282 138 L356 260 Z" fill="var(--sky, #3DA9FC)" stroke="#0A0A0A" strokeWidth="3" />
      <g stroke="#0A0A0A" strokeWidth="2.5" fill="none">
        <path d="M84 194 H316" />
        <path d="M106 160 H294" />
        <path d="M200 138 V160" />
        <path d="M200 194 V260" />
      </g>

      {/* Net */}
      <g>
        <path d="M70 222 H330" stroke="#0A0A0A" strokeWidth="4" strokeLinecap="round" />
        <path d="M70 222 V200 M330 222 V200" stroke="#0A0A0A" strokeWidth="4" strokeLinecap="round" />
        <path d="M70 202 H330" stroke="#0A0A0A" strokeWidth="2.5" />
        <g stroke="#0A0A0A" strokeWidth="1.4" strokeOpacity="0.55">
          {Array.from({ length: 20 }, (_, i) => <path key={i} d={`M${76 + i * 13} 202 V222`} />)}
        </g>
      </g>

      {/* Paddle + ball */}
      <g transform="translate(300 96) rotate(18)">
        <ellipse cx="0" cy="0" rx="26" ry="31" fill="var(--bg, #F4EFE0)" stroke="#0A0A0A" strokeWidth="3" />
        <path d="M0 31 v20" stroke="#0A0A0A" strokeWidth="7" strokeLinecap="round" />
      </g>
      <circle cx="248" cy="82" r="11" fill="var(--bg, #F4EFE0)" stroke="#0A0A0A" strokeWidth="3" />
      <g fill="#0A0A0A">
        <circle cx="244" cy="78" r="1.9" /><circle cx="252" cy="80" r="1.9" /><circle cx="247" cy="86" r="1.9" />
      </g>
    </svg>
  )
}

function Fifa() {
  return (
    <svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" aria-hidden="true">
      <rect width="400" height="260" fill="var(--sky, #3DA9FC)" />

      {/* Pitch */}
      <path d="M-20 260 L66 118 L334 118 L420 260 Z" fill="var(--welfare, #1B8A5A)" stroke="#0A0A0A" strokeWidth="3" />
      <g stroke="#0A0A0A" strokeWidth="2.5" fill="none">
        <path d="M6 190 H394" />
        <ellipse cx="200" cy="190" rx="58" ry="23" />
        <path d="M146 118 H254 L266 146 H134 Z" />
      </g>

      {/* Goal */}
      <g stroke="#0A0A0A" strokeWidth="3" fill="var(--bg, #F4EFE0)" fillOpacity="0.25">
        <path d="M164 118 V92 H236 V118 Z" />
      </g>
      <g stroke="#0A0A0A" strokeWidth="1.4" strokeOpacity="0.5">
        {Array.from({ length: 8 }, (_, i) => <path key={`v${i}`} d={`M${168 + i * 9} 92 V118`} />)}
        {Array.from({ length: 3 }, (_, i) => <path key={`h${i}`} d={`M164 ${98 + i * 7} H236`} />)}
      </g>

      {/* Scoreboard, framed like a handheld screen */}
      <g>
        <rect x="112" y="18" width="176" height="52" rx="14" fill="#0A0A0A" />
        <rect x="118" y="24" width="164" height="40" rx="10" fill="var(--bg, #F4EFE0)" />
        <text x="140" y="51" fill="#0A0A0A" fontSize="19" fontFamily="var(--tt-display)" fontWeight="700">TT</text>
        <text x="200" y="51" fill="var(--tomato, #FF4D2E)" fontSize="21" fontFamily="var(--tt-code)" textAnchor="middle">0:0</text>
        <text x="262" y="51" fill="#0A0A0A" fontSize="19" fontFamily="var(--tt-display)" fontWeight="700" textAnchor="end">YOU</text>
      </g>

      {/* Ball rolling across */}
      <g className="tt-roll">
        <circle cx="0" cy="0" r="15" fill="var(--bg, #F4EFE0)" stroke="#0A0A0A" strokeWidth="3" />
        <path d="M0 -8 L7 -2 L4.5 6 H-4.5 L-7 -2 Z" fill="#0A0A0A" />
      </g>
    </svg>
  )
}

export function StadiumScene({ sport, className, style }: {
  sport: SportSlug
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div className={className} style={{ position: 'relative', overflow: 'hidden', ...style }}>
      {sport === 'cricket' && <Cricket />}
      {sport === 'pickleball' && <Pickleball />}
      {sport === 'fifa' && <Fifa />}
      <style>{`
        /* The ball rests. It used to fly.
           ────────────────────────────────────────────────────────────────
           .tt-arc ran a 6s infinite loop from the stumps to (384, 16), and
           .tt-roll ran a 7s one from x=-30 to x=430 across a 400-wide
           viewBox. Both were wrong in the same two ways, and both were
           visible rather than theoretical:

           1. The arc's 52% keyframe is (330, 44). The sun is a disc at
              (318, 62) with r=42, so the ball crossed straight over the
              middle of it at full opacity, every six seconds, forever.
           2. Both end their travel outside the viewBox, and the scenes are
              'slice'-cropped, so each loop finished with a ball sliced in
              half against the frame edge. On a sport page's hero that is the
              first thing on the screen, and it reads as a rendering fault
              rather than as motion.

           A perpetual loop in a hero also contradicts what this section
           already decided for its own background ("Two layers only, both
           static. A moving texture ... is noise and costs battery on the
           low-end Android most of this audience arrives on") and what
           .tt-tileart already did to these same two animations inside the
           sport cards. The scenes are illustrations; they hold still now.

           What is left moving is in-place and small: a 2px sway and an
           opacity blink, neither of which can leave the frame. */
        .tt-arc  { transform: translate(258px, 122px); }
        .tt-roll { transform: translate(60px, 224px); }
        /* The last two loops, and they go for the same reason as the arc.
           .tt-blink ran the bunting between 0.55 and 1 opacity on a 3.2s
           stagger, eleven pennants at a time. Looked at rather than reasoned
           about: for most of each cycle a pennant sits at 0.55, and a lemon
           pennant at 0.55 on a lemon sky all but disappears. It did not read as
           twinkling, it read as a row of flags where some had failed to load.
           .tt-sway moved one group 2px on a 5s loop, which is below the
           threshold of being noticed at all and still costs a compositor pass
           forever on the phones this audience actually uses.

           Neither explained state, causality or hierarchy. The bunting is
           still bunting, at full strength, and the section now has no
           perpetual animation left anywhere in it. */
      `}</style>
    </div>
  )
}
