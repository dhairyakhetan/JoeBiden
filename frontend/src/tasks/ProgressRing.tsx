import { useEffect, useState } from 'react'
import { ringFraction } from './taskModel'

/**
 * How much of my own list is finished, as a ring that fills when it appears and again whenever a task is ticked.
 * The numbers are the plain count (3/5); the ring is the glance. No score, no comparison with anyone.
 */
export default function ProgressRing({ done, total, size = 64 }: { done: number; total: number; size?: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  const target = ringFraction(done, total)
  // Mount at empty, then fill: the first paint would otherwise show the finished ring with nothing to watch.
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(target))
    return () => cancelAnimationFrame(id)
  }, [target])

  return (
    <div className={'tk-ring' + (target >= 1 ? ' is-full' : '')} style={{ width: size, height: size }} role="img" aria-label={`${done} of ${total} of your tasks finished`}>
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
        <circle className="tk-ring-track" cx="32" cy="32" r={r} fill="none" strokeWidth="7" />
        <circle
          className="tk-ring-fg" cx="32" cy="32" r={r} fill="none" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - shown)} transform="rotate(-90 32 32)"
        />
      </svg>
      <span className="tk-ring-n">{done}<i>/{total}</i></span>
    </div>
  )
}
