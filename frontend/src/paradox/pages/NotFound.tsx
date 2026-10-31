// @ts-nocheck
import { motion } from 'framer-motion'
import { stagger, fadeUp, scaleIn, SPRING, MotionLink } from '../lib/motion'
import { EVENT_IS_OVER } from '../lib/eventFacts'

export function NotFoundPage() {
  return (
    <div
      className="min-h-[100dvh] bg-bg text-ink flex flex-col items-center justify-center px-5 py-16 overflow-hidden"
      style={{ position: 'relative', zIndex: 1 }}
    >

      {/* ── Main content ── */}
      <motion.div
        variants={stagger(0.08)}
        initial="hidden"
        animate="show"
        className="flex flex-col items-center text-center max-w-lg relative z-10"
      >
        {/* Giant 404 */}
        <motion.div
          variants={scaleIn}
          className="font-display text-c1 leading-[0.95] tabular-nums"
          style={{ fontSize: 'clamp(80px, 20vw, 180px)', letterSpacing: '-0.025em' }}
        >
          404
        </motion.div>

        {/* Sub-heading */}
        <motion.h1
          variants={fadeUp}
          className="font-display text-ink mt-2 leading-[0.95]"
          style={{ fontSize: 'clamp(24px, 5vw, 48px)', letterSpacing: '-0.025em' }}
        >
          oops. wrong turn.
        </motion.h1>

        {/* Handwriting note */}
        <motion.p
          variants={fadeUp}
          className="font-hand text-ink/60 mt-3 text-[clamp(18px,3.5vw,26px)] -rotate-1"
        >
          this page went missing
        </motion.p>

        {/* Kicker */}
        <motion.div
          variants={fadeUp}
          className="font-mono text-[11px] tracking-[0.18em] uppercase opacity-65 mt-4 sm:mt-6 mb-5 sm:mb-8"
        >
          it's not you, it's us (probably).
        </motion.div>

        {/* Back home pill button */}
        <motion.div variants={fadeUp}>
          <MotionLink
            to="/paradox"
            whileTap={{ scale: 0.96 }}
            whileHover={{ y: -3, transition: SPRING }}
            transition={SPRING}
            className="rounded-full border-[1.5px] border-ink px-5 py-3 font-body font-semibold bg-ink text-bg inline-flex items-center gap-2"
            style={{ boxShadow: '4px 4px 0 var(--c1)' }}
          >
            ← back to home
          </MotionLink>
        </motion.div>

        {/* Handwriting nudge below CTA */}
        <motion.div variants={fadeUp}>
          <p className="font-hand text-[18px] opacity-60 mt-2 -rotate-1">maybe try the menu?</p>
        </motion.div>

        {/* Quick nav pills */}
        <motion.div
          variants={stagger(0.06)}
          className="flex flex-wrap justify-center gap-2 mt-5"
        >
          {[
            // Paradox is namespaced under /paradox/* — bare `/events` etc. land
            // back on this 404 page. Always include the prefix here.
            { label: 'Events', to: '/paradox/events' },
            // Registration closes with the event, and /paradox/register then
            // redirects to /paradox — so offering "Register" as a recovery
            // route sent someone who was already lost somewhere else again.
            EVENT_IS_OVER
              ? { label: 'Scores', to: '/paradox/scores' }
              : { label: 'Register', to: '/paradox/register' },
            { label: 'Updates', to: '/paradox/updates' },
            { label: 'Contact', to: '/paradox/contact' },
          ].map((l) => (
            <motion.div key={l.to} variants={fadeUp}>
              <MotionLink
                to={l.to}
                whileHover={{ y: -2, transition: SPRING }}
                whileTap={{ scale: 0.96 }}
                transition={SPRING}
                className="rounded-full border-[1.5px] border-ink px-5 py-3 font-body font-semibold bg-transparent text-ink hover:bg-ink hover:text-bg transition-colors text-[14px]"
              >
                {l.label}
              </MotionLink>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  )
}
