import { starShadows } from '../lib/stars'

/** Computed once at module load: three depths of stars, the same sky on every visit. */
const SKY = {
  far: starShadows(120, 11, 'rgba(244,240,232,0.75)'),
  mid: starShadows(38, 23, 'rgba(255,255,255,0.95)'),
  gold: starShadows(12, 37, 'rgba(232,195,106,0.95)'),
}

/**
 * A night sky behind a `.lv-tone-night` band: nebula washes, three star depths and drifting gold dust. With `lights`, the real
 * string lights from the Disco Diwali posters sag across the top and sway. Decorative.
 */
export function StarField({ lights = false }: { lights?: boolean }) {
  return (
    <div className="lv-sky" aria-hidden>
      <div className="lv-nebula" />
      <div className="lv-stars lv-stars-far" style={{ boxShadow: SKY.far }} />
      <div className="lv-stars lv-stars-mid" style={{ boxShadow: SKY.mid }} />
      <div className="lv-stars lv-stars-gold" style={{ boxShadow: SKY.gold }} />
      <img className="lv-dust" src="/live/fx/sparkles.webp" alt="" width={900} height={970} loading="lazy" decoding="async" />
      {lights && <img className="lv-lights" src="/live/fx/lights.webp" alt="" width={1400} height={463} loading="lazy" decoding="async" />}
    </div>
  )
}
