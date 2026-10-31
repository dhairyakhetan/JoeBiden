// @ts-nocheck
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import type { Variants } from 'framer-motion'

/** Properly typed motion-Link — avoids Framer Motion 12 element-inference nesting <a> in <a> */
export const MotionLink = motion.create(Link)

/*
 * Framer Motion springs default `bounce` to 0.25 (visibly bouncy). The
 * interface-skill guidance says interactive UI motion should use `bounce: 0`
 * so springs feel responsive without overshoot. Apply once here and every
 * Paradox page using these variants picks it up.
 */
const SPRING_BASE = { type: 'spring', stiffness: 300, damping: 28, bounce: 0 } as const
const SPRING_SOFT_BASE = { type: 'spring', stiffness: 200, damping: 30, bounce: 0 } as const

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: SPRING_BASE },
}

export const stagger = (delay = 0.07): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: delay } },
})

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: SPRING_SOFT_BASE },
}

export const slideLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0, transition: SPRING_BASE },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  show: { opacity: 1, scale: 1, transition: { ...SPRING_BASE, stiffness: 280, damping: 24 } },
}

export const SPRING = SPRING_BASE
export const SPRING_SOFT = { type: 'spring', stiffness: 180, damping: 22, bounce: 0 } as const
