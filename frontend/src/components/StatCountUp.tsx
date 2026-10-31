import { useRef } from 'react'
import { useInView, useReducedMotion } from 'framer-motion'
import { CountUp } from './CountUp'

/**
 * A stat number that counts up from 0 once it scrolls into view, then holds
 * - for landing-page/brand stat blocks. Parses a value like "4,000+" or
 * "523" into a number to animate plus a suffix to re-append (comma
 * formatting is handled by CountUp itself). Decoupled from any page's own
 * scroll-reveal system (doesn't require one) - just needs to sit in the
 * DOM; `once: true` means it never re-triggers on repeat scroll-past.
 */
export function StatCountUp({ value, className, style }: { value: string; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-10%' })
  const reduced = useReducedMotion()
  const match = value.match(/^([\d,]+)(.*)$/)
  if (!match) return <span ref={ref} className={className} style={style}>{value}</span>
  const num = parseInt(match[1].replace(/,/g, ''), 10)
  const suffix = match[2]
  return (
    <span ref={ref} className={className} style={style}>
      <CountUp value={inView || reduced ? num : 0} durationMs={900} />
      {suffix}
    </span>
  )
}

export default StatCountUp
