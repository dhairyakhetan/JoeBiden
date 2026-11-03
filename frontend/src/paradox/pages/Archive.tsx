// @ts-nocheck
import { motion } from 'framer-motion'
import { stagger, fadeUp, MotionLink } from '../lib/motion'
import { useMeta } from '../../hooks/useMeta'

/**
 * Paradox 2026 is over (1 to 6 June 2026). Its tickets, scores and registrations lived in a separate database
 * that no longer exists, so every page that read from it showed errors (handoff C-03, 3 Nov 2026). Those pages
 * now land here: one honest archive page, no network calls, and the static pages that still work (story, team,
 * blog) one tap away.
 */
export function ArchivePage() {
  useMeta({
    title: 'Paradox 2026: that’s a wrap | AquaTerra',
    description: 'Paradox 2026 ran from 1 to 6 June 2026 and has ended. Read the story, meet the team and see the blog.',
    image: '',
    path: '/paradox',
  })
  return (
    <div
      className="min-h-[100dvh] bg-bg text-ink flex flex-col items-center justify-center px-5 py-16"
      style={{ position: 'relative', zIndex: 1 }}
    >
      <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="flex flex-col items-center text-center max-w-xl">
        <motion.h1 variants={fadeUp} className="font-display text-c1 leading-[0.95]" style={{ fontSize: 'clamp(40px, 9vw, 88px)', letterSpacing: '-0.025em' }}>
          that’s a wrap.
        </motion.h1>
        <motion.p variants={fadeUp} className="mt-4 text-ink" style={{ fontSize: 18, lineHeight: 1.6 }}>
          Paradox 2026 ran from 1 to 6 June 2026. Tickets, scores and registrations are closed. Thank you to everyone who played, volunteered and cheered.
        </motion.p>
        <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3 justify-center">
          <MotionLink to="/paradox/story" className="rounded-full border-[1.5px] border-ink px-6 py-3 min-h-[48px] font-body font-semibold inline-flex items-center">read the story</MotionLink>
          <MotionLink to="/paradox/team" className="rounded-full border-[1.5px] border-ink px-6 py-3 min-h-[48px] font-body font-semibold inline-flex items-center">meet the team</MotionLink>
          <MotionLink to="/paradox/blog" className="rounded-full border-[1.5px] border-ink px-6 py-3 min-h-[48px] font-body font-semibold inline-flex items-center">blog</MotionLink>
        </motion.div>
        <motion.p variants={fadeUp} className="mt-8 text-ink-2" style={{ fontSize: 14 }}>
          Questions? Write to <a href="mailto:ngo.aquaterra@gmail.com" className="underline">ngo.aquaterra@gmail.com</a>.
        </motion.p>
      </motion.div>
    </div>
  )
}
