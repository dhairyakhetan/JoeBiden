import { useEffect, useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { CelebrationDetail } from '../lib/delight'
import { makeParticles, burstLifetimeMs, PALETTE } from '../lib/particles'
import './CelebrationLayer.css'

type Burst = CelebrationDetail & { id: number }

const HEART = 'M12 21s-7-4.4-9.4-8.6A5.4 5.4 0 0 1 12 6.4a5.4 5.4 0 0 1 9.4 6C19 16.6 12 21 12 21z'
const SPARK = 'M12 2c.7 5.2 3 7.5 10 10-7 2.5-9.3 4.8-10 10-.7-5.2-3-7.5-10-10 7-2.5 9.3-4.8 10-10z'

function One({ burst, onDone }: { burst: Burst; onDone: (id: number) => void }) {
  // Seeded from the burst id so a re-render never reshuffles particles mid-flight.
  const parts = useMemo(() => makeParticles(burst.kind, burst.id * 9973 + Math.floor(burst.x + burst.y)), [burst])
  useEffect(() => {
    const t = setTimeout(() => onDone(burst.id), burstLifetimeMs(burst.kind))
    return () => clearTimeout(t)
  }, [burst, onDone])

  return (
    <div className="fx-origin" style={{ left: burst.x, top: burst.y }} aria-hidden="true">
      {parts.map(p => {
        const style = {
          '--dx': `${p.dx}px`, '--up': `${p.up}px`, '--fall': `${p.fall}px`, '--rot': `${p.rot}deg`,
          '--size': `${p.size}px`, '--tone': PALETTE[p.tone], animationDelay: `${p.delay}s`,
        } as CSSProperties
        if (burst.kind === 'hearts') {
          return <svg key={p.id} className="fx-piece fx-heart" viewBox="0 0 24 24" style={style}><path d={HEART} /></svg>
        }
        if (burst.kind === 'stars') {
          return <svg key={p.id} className="fx-piece fx-star" viewBox="0 0 24 24" style={style}><path d={SPARK} /></svg>
        }
        return <span key={p.id} className={'fx-piece fx-confetti' + (p.id % 3 === 0 ? ' is-round' : '')} style={style} />
      })}
    </div>
  )
}

/** The particles. Lazy: components/CelebrationHost loads this on the first `celebrate()`. */
export default function CelebrationLayer({ bursts, onDone }: { bursts: Burst[]; onDone: (id: number) => void }) {
  return <>{bursts.map(b => <One key={b.id} burst={b} onDone={onDone} />)}</>
}
