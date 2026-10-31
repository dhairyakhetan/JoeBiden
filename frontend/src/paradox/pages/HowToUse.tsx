// @ts-nocheck
import { motion } from 'framer-motion'
import { fadeUp, stagger, SPRING, MotionLink } from '../lib/motion'

// ──────────────────────────────────────────────────────────────────────────
// Paradox 2026 · /paradox/how — onboarding in 5 steps
// ──────────────────────────────────────────────────────────────────────────
// Intentionally NOT wired into NAV, footer, sitemap, or meta config. The
// route is reachable only by direct URL (or by people you share the link
// with). Use this when a friend / squad-mate asks "wait, how does this
// whole paradox thing actually work" and you want to point them at one
// crisp page instead of explaining it from scratch every time.
//
// Visual language is borrowed from /paradox/schedule: cream bg, ink
// borders, 3px ink box-shadow on cards, c1/c2/c3 accent rotation, big
// Boldonse display headline. Mobile-first vertical stack; on lg+ the
// step cards form a 2-column grid (3 + 2) so the page doesn't feel
// long-scroll on desktop.
// ──────────────────────────────────────────────────────────────────────────

type Step = {
  n: string
  title: string
  body: string
  cue?: string  // optional small mono "pro tip" line under body
  accent: string
  accentBg: string
}

const STEPS: Step[] = [
  {
    n: '01',
    title: 'pick your poison',
    body: 'Browse the full lineup at /paradox/events. Sports, business, creative, cultural — 13 events across 6 days. Each card shows team size + the day it runs. Save the ones that catch your eye.',
    cue: 'no caps shown — register for whatever you want',
    accent: 'var(--c1)',
    accentBg: 'rgba(255,67,56,0.16)',
  },
  {
    n: '02',
    title: 'form your squad',
    body: 'Solo events (FIFA, dance, photography) you run alone. Duo events (IPL auction, shark tank) need one partner. Team events (cricket, MUN, prodigy) take 4–8 people. Pick teammates you trust to actually show up.',
    cue: 'duos: bring the partner\'s WhatsApp number to register',
    accent: 'var(--c2)',
    accentBg: 'rgba(255,210,63,0.22)',
  },
  {
    n: '03',
    title: 'fill the form',
    body: 'Head to /paradox/register, pick your event, drop your name + school + class + WhatsApp number. Two minutes, no payment yet, no email gymnastics. You\'ll get a reg ID + ticket immediately.',
    cue: 'make sure the number is active on whatsapp — POC texts here',
    accent: 'var(--c3)',
    accentBg: 'rgba(183,156,237,0.22)',
  },
  {
    n: '04',
    title: 'wait for the POC',
    body: 'Within 24 hours, your event POC will text you on WhatsApp with payment details and what to bring. Pay there. Once we mark you paid, your ticket goes from "unpaid" to "ready" on /paradox/ticket/<your-token>.',
    cue: 'no UPI on the public site — payment is WA-only',
    accent: 'var(--c1)',
    accentBg: 'rgba(255,67,56,0.16)',
  },
  {
    n: '05',
    title: 'show up & play',
    body: 'Arrive 30 minutes early at the venue (check /paradox/schedule for times + addresses). Bring your ticket on your phone — venue staff scans it. Win, lose, vibe with the crowd. Stick around for the after-party on the 6th.',
    cue: 'after-party is a separate ticket — phase pricing applies',
    accent: 'var(--c2)',
    accentBg: 'rgba(255,210,63,0.22)',
  },
]

function StepCard({ step, index }: { step: Step; index: number }) {
  // Slight rotation per step so the row of cards reads like a scattered
  // stack instead of a clinical CMS grid. Even-index lean left, odd lean
  // right, magnitude ~0.4deg — visible only on lg+ screens via the
  // ec-rotate-card class trick (rotation collapses to 0 on mobile to
  // preserve readable card edges on small viewports).
  const rotateDeg = (index % 2 === 0 ? -1 : 1) * 0.4

  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -3, boxShadow: '5px 5px 0 var(--ink)' }}
      transition={SPRING}
      className="rounded-2xl border-[1.5px] border-ink p-5 sm:p-6 step-card"
      style={{
        background: 'var(--bg)',
        boxShadow: '3px 3px 0 var(--ink)',
        transitionProperty: 'transform, box-shadow',
        ['--step-rotate' as string]: `${rotateDeg}deg`,
        position: 'relative',
        zIndex: 1,
      }}
    >
      <div className="flex items-baseline gap-4 mb-3">
        {/* Big step number badge */}
        <div
          className="font-display tabular-nums leading-none rounded-xl px-3 py-2 border-[1.5px] border-ink shrink-0"
          style={{
            fontSize: 'clamp(22px, 3.2vw, 32px)',
            background: step.accentBg,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          {step.n}
        </div>
        {/* Step title */}
        <h2
          className="font-display leading-none"
          style={{
            fontSize: 'clamp(20px, 3vw, 30px)',
            letterSpacing: '-0.01em',
            color: step.accent,
            textWrap: 'balance',
          }}
        >
          {step.title}
        </h2>
      </div>

      <p
        className="font-body"
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          color: 'var(--ink)',
          textWrap: 'pretty' as const,
          marginBottom: step.cue ? 10 : 0,
        }}
      >
        {step.body}
      </p>

      {step.cue && (
        <div
          className="font-mono uppercase tracking-[0.08em] flex items-center gap-1.5 pt-2 mt-1 border-t border-ink/10"
          style={{ fontSize: 10, color: step.accent, fontWeight: 600 }}
        >
          <span aria-hidden>★</span>
          {step.cue}
        </div>
      )}
    </motion.div>
  )
}

export function HowToUsePage() {
  return (
    <div
      className="min-h-[100dvh]"
      style={{ background: 'var(--bg)', color: 'var(--ink)', position: 'relative', zIndex: 1 }}
    >
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING}
        className="px-4 sm:px-8 pt-5 pb-4 border-b-[1.5px] border-ink"
        style={{ position: 'relative', zIndex: 1 }}
      >
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ...SPRING, delay: 0.06 }}
          className="kicker"
        >
          paradox 2026 · how it works
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.12 }}
          className="font-display text-ink mt-2"
          style={{
            fontSize: 'clamp(34px, 6.6vw, 76px)',
            letterSpacing: '-0.02em',
            lineHeight: 0.95,
            textWrap: 'balance',
          }}
        >
          five steps. <span style={{ color: 'var(--c1)' }}>that's it.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.18 }}
          className="font-body mt-3"
          style={{ fontSize: 15, color: 'var(--ink)', maxWidth: 580, textWrap: 'pretty' as const }}
        >
          The whole flow from "I want to play" to "I just won my event" — in
          under five minutes of reading. Hand this link to anyone who's
          confused about how paradox actually works.
        </motion.p>
      </motion.div>

      {/* ── Step grid ─────────────────────────────────────────────────────── */}
      <motion.div
        variants={stagger(0.08)}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 lg:p-6"
        style={{ position: 'relative', zIndex: 1 }}
      >
        {STEPS.map((s, i) => (
          <StepCard key={s.n} step={s} index={i} />
        ))}
      </motion.div>

      {/* ── Footer CTA ───────────────────────────────────────────────────── */}
      <motion.section
        variants={stagger(0.06)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
        className="border-t-[1.5px] border-ink px-4 sm:px-8 py-8 sm:py-12"
        style={{ background: 'var(--ink)', color: 'var(--bg)' }}
      >
        <div className="max-w-[1280px] mx-auto">
          <motion.div
            variants={fadeUp}
            className="font-mono text-[11px] tracking-[0.14em] uppercase opacity-65"
          >
            [ ready to step 01 ]
          </motion.div>
          <motion.h2
            variants={fadeUp}
            className="font-display mt-2"
            style={{
              fontSize: 'clamp(28px, 5vw, 52px)',
              letterSpacing: '-0.02em',
              textWrap: 'balance',
              color: 'var(--c2)',
              lineHeight: 0.95,
            }}
          >
            pick your poison.
          </motion.h2>
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-2 mt-5">
            <MotionLink
              to="/paradox/events"
              whileTap={{ scale: 0.96 }}
              whileHover={{ y: -2, transition: SPRING }}
              transition={SPRING}
              className="rounded-full border-[1.5px] px-5 py-3 min-h-[48px] font-body font-semibold inline-flex items-center justify-center gap-2 w-full sm:w-auto"
              style={{
                background: 'var(--c2)',
                color: 'var(--ink)',
                borderColor: 'var(--c2)',
                boxShadow: '4px 4px 0 var(--c1)',
              }}
            >
              Browse events →
            </MotionLink>
            <MotionLink
              to="/paradox/schedule"
              whileTap={{ scale: 0.96 }}
              whileHover={{ y: -2, transition: SPRING }}
              transition={SPRING}
              className="rounded-full border-[1.5px] px-5 py-3 min-h-[48px] font-body font-semibold inline-flex items-center justify-center w-full sm:w-auto"
              style={{
                background: 'transparent',
                color: 'var(--bg)',
                borderColor: 'var(--bg)',
              }}
            >
              See the schedule
            </MotionLink>
            <MotionLink
              to="/paradox/register"
              whileTap={{ scale: 0.96 }}
              whileHover={{ y: -2, transition: SPRING }}
              transition={SPRING}
              className="rounded-full border-[1.5px] px-5 py-3 min-h-[48px] font-body font-semibold inline-flex items-center justify-center w-full sm:w-auto"
              style={{
                background: 'var(--c1)',
                color: 'var(--bg)',
                borderColor: 'var(--c1)',
              }}
            >
              Register →
            </MotionLink>
          </motion.div>
        </div>
      </motion.section>

      {/* Card rotation only on lg+ — keeps mobile readable */}
      <style>{`
        @media (min-width: 1024px) {
          .step-card { transform: rotate(var(--step-rotate, 0deg)); }
        }
      `}</style>
    </div>
  )
}
