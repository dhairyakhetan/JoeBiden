import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { springPop } from '../lib/motion'
import { celebrate, type Celebration } from '../lib/delight'

/**
 * A checkmark that draws itself inside a spring-popped circle - the
 * "success state morphs in" moment for submit flows (apply for a role,
 * post an opening, etc.) instead of a static ✓ glyph. Front-end only.
 * Falls back to an instant render under prefers-reduced-motion.
 */
export function SuccessCheck({ size = 56, color = 'var(--welfare)', fx }: { size?: number; color?: string; fx?: Celebration }) {
  const reduced = useReducedMotion()
  const ref = useRef<SVGSVGElement>(null)
  // `fx` adds a celebration once the check has drawn itself. The submit has already succeeded by the time this renders.
  useEffect(() => {
    if (!fx) return
    const t = setTimeout(() => celebrate(fx, ref.current), 450)
    return () => clearTimeout(t)
  }, [fx])
  return (
    <motion.svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 52 52"
      initial={reduced ? undefined : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={springPop}
    >
      <motion.circle
        cx="26" cy="26" r="24"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        initial={reduced ? undefined : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
      />
      <motion.path
        d="M15 27l7 7 15-15"
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduced ? undefined : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, delay: 0.3, ease: [0.2, 0, 0, 1] }}
      />
    </motion.svg>
  )
}

export default SuccessCheck
