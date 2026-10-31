import { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { fadeInUp, staggerContainer } from '../lib/motion'

/**
 * Scroll-reveal wrapper - one line to make a section/card fade+slide in as
 * it enters the viewport, instead of rendering fully-formed and static. Uses
 * framer-motion's `whileInView` (fires once via `viewport={{ once: true }}`,
 * so re-scrolling past it doesn't replay) and automatically no-ops under
 * `prefers-reduced-motion` via `useReducedMotion`.
 *
 * Front-end only - see lib/motion.ts's file-level note. The HoD desk stays
 * static on purpose.
 */
export function Reveal({ children, delay = 0, className, style }: {
  children: ReactNode
  delay?: number
  className?: string
  style?: React.CSSProperties
}) {
  const reduced = useReducedMotion()
  if (reduced) {
    return (
      <motion.div
        className={className}
        style={style}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.28 }}
      >
        {children}
      </motion.div>
    )
  }
  return (
    <motion.div
      className={className}
      style={style}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      variants={fadeInUp}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  )
}

/** Wraps a grid/list so its children (each a plain element, no variants needed
 * on them individually) reveal one after another. Give each direct child
 * `variants={fadeInUp}` - RevealGroup only supplies the stagger timing. */
export function RevealGroup({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  const reduced = useReducedMotion()
  if (reduced) {
    return (
      <motion.div
        className={className}
        style={style}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.28 }}
      >
        {children}
      </motion.div>
    )
  }
  return (
    <motion.div
      className={className}
      style={style}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      variants={staggerContainer}
    >
      {children}
    </motion.div>
  )
}

export default Reveal
