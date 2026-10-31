import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

/**
 * A number that rolls up from its previous value instead of snapping -
 * for like counts ticking up on like/unlike, and (per the motion plan) stat
 * counters that count up once when they scroll into view. Plain <span>,
 * no layout impact; falls back to an instant snap under reduced-motion.
 */
export function CountUp({ value, durationMs = 420, className, style }: {
  value: number
  durationMs?: number
  className?: string
  style?: React.CSSProperties
}) {
  const reduced = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const rafRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (reduced) { setDisplay(value); fromRef.current = value; return }
    const from = fromRef.current
    // `from === value` used to bail out entirely, which is wrong whenever a
    // previous run was interrupted: `fromRef` only advanced on COMPLETION, so
    // an interrupted run left it holding the old START value. Like-then-unlike
    // does exactly that - the second change targets the number the first run
    // started from, this guard fired, and the counter stayed frozen one off
    // the real value until something else re-rendered it. Setting the display
    // is the correct no-animation answer, not returning.
    if (from === value) { setDisplay(value); return }
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      const next = Math.round(from + (value - from) * eased)
      setDisplay(next)
      // Track the ANIMATED value, not just the destination, so an interrupted
      // run leaves the ref agreeing with what is actually on screen.
      fromRef.current = next
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else fromRef.current = value
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [value, durationMs, reduced])

  return <span className={className} style={{ fontVariantNumeric: 'tabular-nums', ...style }}>{display.toLocaleString()}</span>
}

export default CountUp
