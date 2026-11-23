// @ts-nocheck
import { useMeta } from '../../hooks/useMeta'
import { pageMetadata } from '../../lib/metaConfig'
import { motion } from 'framer-motion'
import { fadeUp, stagger, SPRING } from '../lib/motion'

export function TeamPage() {
  useMeta(pageMetadata.paradoxTeam)
  return (
    <div className="min-h-[100dvh] bg-bg" style={{ position: 'relative', zIndex: 1 }}>

      {/* ── Header ── */}
      <motion.header
        variants={stagger(0.07)}
        initial="hidden"
        animate="show"
        className="bg-bg px-4 sm:px-8 py-6 sm:py-14 border-b-[1.5px] border-ink"
      >
        <motion.div variants={fadeUp} className="font-mono text-[11px] tracking-[0.18em] uppercase opacity-65">
          /team
        </motion.div>
        <motion.h1
          variants={fadeUp}
          className="font-display text-ink mt-2 leading-[0.92]"
          style={{
            fontSize: 'clamp(34px, 6.6vw, 76px)',
            letterSpacing: '-0.025em',
            textWrap: 'balance',
          }}
        >
          our team.
        </motion.h1>
        <motion.p
          variants={fadeUp}
          className="font-body text-[15px] opacity-65 mt-2"
          style={{ textWrap: 'pretty' }}
        >
          the people behind paradox 2026.
        </motion.p>
      </motion.header>

      {/* ── Team Contact Grid ── */}
      <section className="bg-ink text-bg px-4 sm:px-8 lg:px-12 pt-6 pb-7 sm:pt-14 sm:pb-16">
        <div className="max-w-[1280px] mx-auto">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            className="font-mono text-[11px] tracking-[0.18em] uppercase opacity-65 mb-2"
          >
            team contact
          </motion.div>
          <motion.p
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            className="font-body text-[14px] opacity-60 mb-6"
            style={{ textWrap: 'pretty' }}
          >
            paradox is run by student volunteers. to reach the organisers, message us on instagram and we will reply there.
          </motion.p>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
          >
            <a
              href="https://instagram.com/ngo.aquaterra"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border-[1.5px] border-bg px-5 font-body font-semibold bg-bg text-ink inline-flex items-center gap-2"
              style={{ minHeight: '48px' }}
            >
              message @ngo.aquaterra →
            </a>
          </motion.div>
        </div>
      </section>

      {/* ── Join CTA ── */}
      <motion.section
        variants={stagger(0.07)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
        className="bg-c1 text-bg px-4 sm:px-8 py-6 sm:py-14 border-t-[1.5px] border-ink"
      >
        <motion.div variants={fadeUp} className="font-mono text-[11px] tracking-[0.18em] uppercase opacity-75 mb-2">
          [ volunteer ]
        </motion.div>
        <motion.h2
          variants={fadeUp}
          className="font-display text-bg leading-[0.92]"
          style={{
            fontSize: 'clamp(34px, 6.6vw, 76px)',
            letterSpacing: '-0.025em',
            textWrap: 'balance',
          }}
        >
          want in?
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="font-body text-[15px] opacity-80 mt-3 max-w-sm"
          style={{ textWrap: 'pretty' }}
        >
          Volunteer at Paradox 2026 — reach us on Instagram.
        </motion.p>
        <motion.div variants={fadeUp} className="mt-6">
          <motion.a
            href="https://instagram.com/ngo.aquaterra"
            target="_blank"
            rel="noreferrer"
            whileTap={{ scale: 0.96 }}
            whileHover={{ y: -2, transition: SPRING }}
            transition={SPRING}
            className="rounded-full border-[1.5px] border-bg px-5 font-body font-semibold bg-bg text-ink inline-flex items-center gap-2"
            style={{
              minHeight: '48px',
              boxShadow: '4px 4px 0 var(--ink)',
              transitionProperty: 'transform, box-shadow',
            }}
          >
            @ngo.aquaterra →
          </motion.a>
        </motion.div>
      </motion.section>
    </div>
  )
}
