// @ts-nocheck
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { supabase } from '../lib/supabase'
import type { Event } from '../lib/types'
import { timeUntil, pad, PARADOX_TARGET, formatSlug } from '../lib/utils'
import { stagger, fadeUp, SPRING, MotionLink } from '../lib/motion'
import { Typewriter } from '../components/ui/Typewriter'
import { useWhatsAppGroup } from '../lib/useWhatsAppGroup'

// ─── Animation variants ────────────────────────────────────────────────────
const revealUp = {
  hidden: { opacity: 0, y: 48, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 220, damping: 24 } }
}
const revealLeft = {
  hidden: { opacity: 0, x: -40 },
  show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 220, damping: 24 } }
}
const revealRight = {
  hidden: { opacity: 0, x: 40 },
  show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 220, damping: 24 } }
}
const popIn = {
  hidden: { opacity: 0, scale: 0.85, y: 20 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 22 } }
}

// ─── Hero char arrays ──────────────────────────────────────────────────────
const HERO_CHARS_1 = [...'paradox']
const HERO_CHARS_2 = [...'2026']

// ─── Count-up ──────────────────────────────────────────────────────────────
function CountUp({ target }: { target: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const [display, setDisplay] = useState('0')
  useEffect(() => {
    if (!inView) return
    const num = parseInt(target.replace(/[^0-9]/g, ''))
    const prefix = target.match(/^[^0-9]*/)?.[0] ?? ''
    const postfix = target.match(/[^0-9]*$/)?.[0] ?? ''
    if (isNaN(num)) { setDisplay(target); return }
    let start = 0
    const step = Math.ceil(num / 32)
    const timer = setInterval(() => {
      start = Math.min(start + step, num)
      setDisplay(`${prefix}${start.toLocaleString()}${postfix}`)
      if (start >= num) clearInterval(timer)
    }, 36)
    return () => clearInterval(timer)
  }, [inView, target])
  return (
    <span ref={ref} className="tabular-nums" style={{ fontVariantNumeric: 'tabular-nums' }}>
      {inView ? display : '0'}
    </span>
  )
}



// ─── HOME ──────────────────────────────────────────────────────────────────
export function HomePage() {
  return (
    <div className="bg-bg text-ink" style={{ position: 'relative', zIndex: 2 }}>
      <Hero />
      <MarqueeStrip />
      <EventsTeaser />
      <AboutSection />
      <CauseSection />
      <SponsorsSection />
      <TicketsSection />
<GallerySection />
      <FAQSection />
      <ContactSection />
    </div>
  )
}

// ─── HERO ──────────────────────────────────────────────────────────────────
function Hero() {

  return (
    <section className="relative overflow-hidden border-b-[1.5px] border-ink" style={{ minHeight: 'calc(100dvh - 72px)', borderTop: '4px solid var(--c1)' }}>

      {/* ── Background: subtle grid texture ─────────────────────────── */}
      <div aria-hidden className="absolute inset-0 pointer-events-none select-none" style={{
        backgroundImage: 'repeating-linear-gradient(90deg,rgba(24,24,24,0.045) 0 1px,transparent 1px 44px),repeating-linear-gradient(0deg,rgba(24,24,24,0.045) 0 1px,transparent 1px 44px)',
        zIndex: 0,
      }} />

      {/* ── Background: large "4.0" watermark ───────────────────────── */}
      <div aria-hidden className="absolute bottom-0 right-0 pointer-events-none select-none font-display"
        style={{
          fontSize: 'clamp(160px, 38vw, 360px)',
          lineHeight: 1,
          letterSpacing: '-0.025em',
          color: 'var(--ink)',
          opacity: 0.045,
          transform: 'translateX(6%) translateY(6%)',
          zIndex: 0,
        }}>4.0</div>

      {/* Main grid */}
      <div className="flex flex-col gap-4 px-4 sm:px-8 lg:px-12 pt-8 pb-7 sm:pt-14 max-w-[1280px] mx-auto relative" style={{ zIndex: 2 }}>
        {/* Kicker */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.1 }}
          className="flex items-center gap-2"
        >
          <span className="relative rounded-full h-2 w-2 shrink-0" style={{ background: 'var(--c1)' }}/>
          <span className="font-mono text-[11px] tracking-[0.16em] uppercase opacity-65">
            kolkata · jun 1–6, 2026 · thank you.
          </span>
        </motion.div>

        {/* Giant title — per-character stagger animation */}
        <h1
          className="font-display text-ink m-0"
          style={{
            fontSize: 'clamp(48px, 13vw, 155px)',
            lineHeight: 0.9,
            letterSpacing: '-0.02em',
            textTransform: 'lowercase',
            textWrap: 'balance',
            perspective: '600px',
          }}
        >
          {/* "paradox" chars: paddingBottom prevents descender overlap with "2026" */}
          <span style={{ display: 'block', paddingBottom: '0.06em' }}>
            {HERO_CHARS_1.map((char, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 40, rotateX: -60 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.05 + i * 0.04 }}
                style={{ display: 'inline-block' }}
              >
                {char}
              </motion.span>
            ))}
          </span>
          {/* "2026" chars: delay 0.38 + i*0.05, red color */}
          <span style={{ display: 'block', color: 'var(--c1)' }}>
            {HERO_CHARS_2.map((char, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 40, rotateX: -60 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.38 + i * 0.05 }}
                style={{ display: 'inline-block' }}
              >
                {char}
              </motion.span>
            ))}
          </span>
        </h1>

        {/* Sub + countdown row */}
        <div className="flex flex-col lg:flex-row lg:items-end gap-6 lg:gap-14 mt-2">
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.28 }}
            className="max-w-full sm:max-w-[340px]"
          >
            {/* Static first line */}
            <p className="font-body text-[17px] sm:text-[19px] leading-[1.4] opacity-85 m-0">
              kolkata's biggest student-led competitive fest.
            </p>
            {/* Typewriter cycling line — c1 (red) so it sits as the active
                accent under the static intro line. */}
            <p className="font-mono text-[13px] sm:text-[14px] leading-[1.6] mt-2 m-0"
              style={{ color: 'var(--c1)', minHeight: '1.6em' }}>
              <Typewriter
                text={[
                  '800+ students competed.',
                  '₹51,000 in prizes.',
                  'all proceeds to charity.',
                  '10+ events, 6 days.',
                  "aquaterra's 4th edition.",
                  '100% profits to welfare.',
                ]}
                speed={55}
                deleteSpeed={25}
                waitTime={1800}
                initialDelay={800}
                cursorChar="_"
                cursorClassName="ml-0.5 opacity-80"
              />
            </p>
            <div className="flex gap-3 mt-5 flex-wrap">
              <MotionLink to="/paradox/scores"
                whileHover={{ x: -1, y: -1 }} whileTap={{ scale: 0.96 }} transition={SPRING}
                className="btn-pill btn-pill-primary text-[15px]"
                style={{ minHeight: 44 }}>
                see the scores →
              </MotionLink>
              <MotionLink to="/paradox/events"
                whileHover={{ background: 'var(--ink)', color: 'var(--bg)' }} whileTap={{ scale: 0.96 }} transition={SPRING}
                className="btn-pill btn-pill-ghost text-[15px]"
                style={{ minHeight: 44 }}>
                the events
              </MotionLink>
            </div>
          </motion.div>

          {/* Post-event wrap card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.38 }}
            className="lg:ml-auto"
          >
            <div className="rounded-2xl border-[1.5px] border-ink p-6 sm:p-8 flex flex-col gap-2"
              style={{ background: 'var(--c1)', color: 'var(--bg)', boxShadow: '4px 4px 0 var(--ink)' }}>
              <p className="font-mono text-[10px] tracking-[0.14em] uppercase m-0" style={{ opacity: 0.7 }}>jun 1–6 · kolkata</p>
              <div className="font-display leading-[0.88]"
                style={{ fontSize: 'clamp(36px, 7vw, 72px)', letterSpacing: '-0.02em' }}>
                it happened.
              </div>
              <p className="font-mono text-[11px] m-0" style={{ opacity: 0.7 }}>paradox 2026 · wrapped.</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// ─── MARQUEE ───────────────────────────────────────────────────────────────
const MARQUEE_ITEMS = [
  'PARADOX 2026', '★', 'JUN 1–6', '★', 'KOLKATA', '★', '5 YEARS OF AQ', '★',
  '10+ EVENTS', '★', '100% TO CHARITY', '★', 'THANK YOU KOLKATA', '★',
]
function MarqueeStrip() {
  const [paused, setPaused] = useState(false)
  const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS]
  return (
    <div
      className="overflow-hidden select-none border-y-[1.5px] border-ink py-2.5 cursor-default"
      style={{ background: 'var(--c2)', color: 'var(--ink)' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* CSS marquee — pauses on hover, never stalls on re-render */}
      <div
        className="flex gap-8 whitespace-nowrap w-max"
        style={{ animation: 'marquee 28s linear infinite', animationPlayState: paused ? 'paused' : 'running' }}
      >
        {items.map((item, i) => (
          <span key={i} className="font-mono text-[11px] tracking-[0.12em] uppercase">
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── ABOUT ─────────────────────────────────────────────────────────────────
function AboutSection() {
  return (
    <section className="border-b-[1.5px] border-ink relative overflow-hidden pt-6 pb-7 sm:pt-14 sm:pb-16" style={{ position: 'relative', zIndex: 1 }}>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-12 relative" style={{ zIndex: 2 }}>
        {/* Fix 14: kicker wrapped in motion.p */}
        <motion.p className="kicker"
          initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}>
          [ what is paradox? ]
        </motion.p>
        {/* Fix 15: h2 wrapped in motion.h2 */}
        <motion.h2 className="font-display leading-[0.9] text-balance mb-3 sm:mb-6 mt-1.5"
          style={{ fontSize: 'clamp(34px, 6.6vw, 76px)', letterSpacing: '-0.02em' }}
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 220, damping: 24, delay: 0.08 }}>
          a fest, a fundraiser,{' '}
          <span style={{
            color: 'var(--c1)',
            textDecorationLine: 'underline',
            textDecorationStyle: 'wavy',
            textDecorationColor: 'var(--c2)',
          }}>a friend group</span>{' '}
          you didn't know you needed.
        </motion.h2>

        {/* Two column: lede + stats */}
        <div className="grid gap-8 lg:gap-14 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          {/* Fix 4: lede paragraph uses revealLeft */}
          <motion.p className="font-body leading-relaxed opacity-90 m-0"
            style={{ fontSize: 'clamp(18px, 2.4vw, 22px)', maxWidth: '36ch', textWrap: 'pretty' }}
            variants={revealLeft} initial="hidden" whileInView="show"
            viewport={{ once: true, margin: '-40px' }}>
            paradox is aquaterra's flagship student-led competitive week — sport, business, creative, cultural events stitched together by one big after-party. every rupee funds welfare projects. you show up, you compete, kids on the other side of the city eat &amp; learn.
          </motion.p>

          {/* Fix 4: stat cards use popIn with stagger */}
          <motion.div
            variants={stagger(0.07)} initial="hidden" whileInView="show"
            viewport={{ once: true, margin: '-40px' }}
            className="grid grid-cols-2 gap-2"
          >
            {[
              { n: '1000+', l: 'teams of students',     bg: 'var(--c1)', color: 'var(--bg)' },
              { n: '9',    l: 'events',               bg: 'var(--c2)', color: 'var(--ink)' },
              { n: '₹51k', l: 'total prize money',    bg: 'var(--c3)', color: 'var(--ink)' },
              { n: '100%', l: 'profits to welfare',   bg: 'var(--ink)', color: 'var(--bg)' },
            ].map((s) => (
              <motion.div key={s.l} variants={popIn}
                whileHover={{ y: -3 }} transition={SPRING}
                className="rounded-2xl border-[1.5px] border-ink p-4 sm:p-5 flex flex-col justify-between min-h-[80px] sm:min-h-[100px]"
                style={{ background: s.bg, color: s.color, boxShadow: '3px 3px 0 var(--ink)', transitionProperty: 'transform, box-shadow' }}
              >
                <span className="font-mono text-[9px] sm:text-[10px] tracking-[0.12em] uppercase opacity-75 leading-tight">{s.l}</span>
                <span className="font-display leading-[0.95] mt-1" style={{ fontSize: 'clamp(28px, 5.5vw, 50px)' }}>
                  <CountUp target={s.n} />
                </span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// ─── EVENTS TEASER ─────────────────────────────────────────────────────────
// ec-0=c1/bg, ec-1=c2/ink, ec-2=c3/ink, ec-3=bg/ink
const EC_STYLES = [
  { bg: 'var(--c1)', color: 'var(--bg)' },
  { bg: 'var(--c2)', color: 'var(--ink)' },
  { bg: 'var(--c3)', color: 'var(--ink)' },
  { bg: 'var(--bg)', color: 'var(--ink)' },
]
const EC_ROTS = ['-0.8deg', '0.6deg', '-0.5deg', '1deg', '-0.7deg', '0.5deg', '-0.9deg', '0.7deg']

function EventsTeaser() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const cats = ['all', 'sports', 'business', 'creative', 'cultural']

  useEffect(() => {
    supabase.from('paradox_events').select('*').eq('active', true).order('sort_order').limit(12)
      .then(({ data }) => { setEvents(data ?? []); setLoading(false) })
  }, [])

  const filtered = filter === 'all' ? events : events.filter(e => (e.category ?? '').toLowerCase() === filter)

  return (
    <section className="border-b-[1.5px] border-ink relative overflow-hidden pt-6 pb-7 sm:pt-14 sm:pb-16" style={{ position: 'relative', zIndex: 1 }}>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-12 relative" style={{ zIndex: 2 }}>
        <div className="flex items-end justify-between mb-2">
          <div>
            {/* Fix 14 */}
            <motion.p className="kicker"
              initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}>
              [ the lineup ]
            </motion.p>
            {/* Fix 15 */}
            <motion.h2 className="font-display leading-[0.9] text-balance mt-1.5 mb-0"
              style={{ fontSize: 'clamp(34px, 6.6vw, 76px)', letterSpacing: '-0.02em' }}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 220, damping: 24, delay: 0.08 }}>
              pick your{' '}
              <span className="relative inline-block">
                <span className="relative z-10" style={{
                  textDecorationLine: 'underline',
                  textDecorationStyle: 'wavy',
                  textDecorationColor: 'var(--c1)',
                }}>poison.</span>
                <motion.span initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }}
                  transition={{ ...SPRING, delay: 0.4 }}
                  className="absolute bottom-1 left-0 right-0 h-[6px] -z-[1]"
                  style={{ background: 'var(--c2)', transformOrigin: 'left' }}/>
              </span>
            </motion.h2>
          </div>
          <MotionLink to="/paradox/events" whileTap={{ scale: 0.96 }} transition={SPRING}
            className="hidden sm:flex items-center gap-1.5 btn-pill btn-pill-ghost text-[12px] py-2 px-4">
            {loading ? 'all events' : `all ${events.length}`} →
          </MotionLink>
        </div>

        {/* Category filter pills — horizontal scroll on mobile */}
        <div className="flex flex-nowrap overflow-x-auto gap-2 my-6 pb-1" style={{ scrollbarWidth: 'none' }}>
          {cats.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              className="shrink-0 px-3.5 rounded-full border-[1.5px] border-ink font-mono text-[11px] tracking-[0.1em] uppercase"
              style={{
                minHeight: '40px',
                background: filter === c ? 'var(--ink)' : 'transparent',
                color: filter === c ? 'var(--bg)' : 'var(--ink)',
                transitionProperty: 'background-color, color',
                transitionDuration: '150ms',
              }}>
              {c}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl border-[1.5px] border-ink/20 min-h-[120px] sm:min-h-[150px]"
                style={{ background: 'color-mix(in oklch, var(--ink) 8%, transparent)' }}/>
            ))}
          </div>
        ) : (
          <motion.div variants={stagger(0.06)} initial="hidden" whileInView="show"
            viewport={{ once: true, margin: '-40px' }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {filtered.map((e, i) => {
              const style = EC_STYLES[i % 4]
              return (
                <MotionLink key={e.id} to={`/paradox/events/${e.slug}`}
                  variants={popIn}
                  whileHover={{ rotate: '0deg', y: -5, boxShadow: '6px 6px 0 var(--ink)' }}
                  whileTap={{ scale: 0.96 }}
                  transition={SPRING}
                  className="rounded-2xl border-[1.5px] border-ink p-4 flex flex-col gap-2 min-h-[130px] sm:min-h-[150px]"
                  style={{
                    background: style.bg, color: style.color,
                    transform: `rotate(${EC_ROTS[i % 8]})`,
                    boxShadow: '3px 3px 0 var(--ink)',
                    transitionProperty: 'transform, box-shadow',
                  }}>
                  <div className="flex justify-between font-mono text-[9px] uppercase tracking-[0.1em] opacity-80">
                    <span>{formatSlug(e.slug)}</span>
                    <span className="hidden sm:inline">{e.date ? e.date.replace(', 2026', '') : 'tba'}</span>
                  </div>
                  <div className="font-display leading-[0.92] mt-auto text-balance"
                    style={{ fontSize: 'clamp(19px, 2.4vw, 25px)', letterSpacing: '-0.01em' }}>
                    {e.name}
                  </div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    {e.prize && (
                      <span className="font-mono text-[9px] uppercase tracking-[0.1em] opacity-80" style={{ fontVariantNumeric: 'tabular-nums' }}>prize {e.prize}</span>
                    )}
                    {e.limited_spots && (
                      /* "limited spots" badge — no number, just urgency cue.
                         Tinted with c1 (red) so it stands out against the
                         playful card backgrounds without disclosing capacity. */
                      <span
                        className="font-mono text-[9px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded"
                        style={{
                          background: 'rgba(255,67,56,0.18)',
                          color: 'var(--c1)',
                          border: '1px solid rgba(255,67,56,0.35)',
                        }}
                      >
                        ★ limited spots
                      </span>
                    )}
                  </div>
                </MotionLink>
              )
            })}
          </motion.div>
        )}

        <MotionLink to="/paradox/events" whileTap={{ scale: 0.96 }} transition={SPRING}
          className="sm:hidden mt-4 w-full flex justify-between items-center btn-pill btn-pill-ghost rounded-xl"
          style={{ minHeight: 44 }}>
          <span>See all events</span><span>→</span>
        </MotionLink>
      </div>
    </section>
  )
}

// ─── CAUSE ─────────────────────────────────────────────────────────────────
function CauseSection() {
  return (
    <section className="border-b-[1.5px] border-ink relative overflow-hidden pt-6 pb-7 sm:pt-14 sm:pb-16" id="cause"
      style={{ background: 'var(--c2)', color: 'var(--ink)', position: 'relative', zIndex: 1 }}>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-12 grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-center relative" style={{ zIndex: 2 }}>
        {/* Fix 6: left column — stagger revealLeft items */}
        <motion.div variants={stagger(0.07)} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-50px' }}>
          {/* Fix 14 */}
          <motion.p variants={revealLeft} className="kicker">[ where it goes ]</motion.p>
          {/* Fix 15 */}
          <motion.h2 variants={revealLeft}
            className="font-display leading-[0.9] text-balance mt-1.5 mb-3"
            style={{ fontSize: 'clamp(34px, 6.5vw, 72px)', letterSpacing: '-0.02em' }}>
            every rupee becomes{' '}
            <span className="inline-block rounded-md px-2" style={{ background: 'var(--ink)', color: 'var(--c2)' }}>someone's</span>
            {' '}summer.
          </motion.h2>
          <motion.p variants={revealLeft} className="font-body leading-relaxed opacity-80 m-0"
            style={{ fontSize: 'clamp(16px, 2vw, 19px)', maxWidth: 'none', textWrap: 'pretty' }}>
            AquaTerra is a student-led NGO run by 1,200+ Kolkata kids. Five years in, we've raised ₹10L+ across 550+ welfare projects — teaching workshops, worksheets, food, plantation, animal welfare. paradox is our biggest single-week fundraiser.
          </motion.p>
          <style>{`@media (min-width: 640px) { .cause-body { max-width: 52ch; } }`}</style>
          <motion.div variants={revealLeft} className="flex flex-wrap gap-2 mt-5">
            {[
              { l: '★ 80G certified', bg: 'var(--ink)', color: 'var(--bg)' },
              { l: '★ 100% out',      bg: 'var(--bg)',  color: 'var(--ink)' },
              { l: '★ 550+ projects', bg: 'var(--c1)',  color: 'var(--bg)' },
              { l: '★ 1,200+ volunteers', bg: 'var(--bg)', color: 'var(--ink)' },
            ].map(tag => (
              <span key={tag.l} className="font-mono text-[11px] tracking-[0.06em] px-3 py-1.5 rounded-full border-[1.5px] border-ink"
                style={{ background: tag.bg, color: tag.color }}>
                {tag.l}
              </span>
            ))}
          </motion.div>
          <motion.div variants={revealLeft}>
            <MotionLink to="/paradox/sponsor"
              whileHover={{ x: -1, y: -1 }} whileTap={{ scale: 0.96 }} transition={SPRING}
              className="mt-6 inline-flex btn-pill btn-pill-primary"
              style={{ minHeight: 44 }}>
              become a sponsor →
            </MotionLink>
          </motion.div>
        </motion.div>

        {/* Fix 6: right column — revealRight with delay 0.2 */}
        <motion.div
          variants={revealRight}
          initial="hidden" whileInView="show"
          viewport={{ once: true, margin: '-50px' }}
          transition={{ type: 'spring', stiffness: 220, damping: 24, delay: 0.2 }}
          className="grid grid-cols-2 gap-2.5"
        >
          {[
            { n: '550+', l: 'welfare projects' },
            { n: '₹10L+', l: 'raised lifetime' },
            { n: '1200+', l: 'volunteers' },
            { n: '0%', l: 'overhead' },
          ].map((item) => (
            <div key={item.l}
              className="rounded-2xl border-[1.5px] border-ink p-4 sm:p-5 flex flex-col justify-between min-h-[110px]"
              style={{ background: 'var(--ink)', color: 'var(--bg)', boxShadow: '3px 3px 0 rgba(0,0,0,0.2)' }}>
              <span className="font-mono text-[9px] tracking-[0.12em] uppercase opacity-50">{item.l}</span>
              <span className="font-display leading-[0.95]"
                style={{ fontSize: 'clamp(26px, 5vw, 40px)', color: 'var(--c2)', fontVariantNumeric: 'tabular-nums' }}>
                <CountUp target={item.n} />
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// ─── PAST EDITIONS TIMELINE ────────────────────────────────────────────────
const PAST = [
  { tag: 'P1.0', year: '2022', stat: 'first edition', body: 'a few schools, one venue, a promise.', bg: 'var(--bg)', color: 'var(--ink)' },
  { tag: 'P2.0', year: '2023', stat: '15 schools',    body: 'sports landed. business events found their feet.', bg: 'var(--c3)', color: 'var(--bg)' },
  { tag: 'P3.0', year: '2024', stat: '750+ kids',     body: '12 events. ₹8.9L raised. word got out.', bg: 'var(--c3)', color: 'var(--ink)' },
  { tag: 'P4.0', year: '2025', stat: '750+ kids',     body: 'biggest yet. lessons learned. plans rewritten.', bg: 'var(--c2)', color: 'var(--ink)' },
  { tag: 'P2026', year: '2026', stat: 'now',          body: 'leaner, louder, distributed across the city.', bg: 'var(--c1)', color: 'var(--bg)', scale: 1.02 },
]

// ─── SPONSORS ──────────────────────────────────────────────────────────────
function SponsorsSection() {
  return (
    <section className="border-b-[1.5px] border-ink relative overflow-hidden py-5 sm:py-7"
      style={{ position: 'relative', zIndex: 1, background: 'var(--c1)' }}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={SPRING}
        className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6 relative"
        style={{ zIndex: 2 }}>
        <div className="flex-1">
          <p className="font-body text-[15px] sm:text-[17px] leading-[1.5] color-inherit" style={{ color: 'var(--bg)', textWrap: 'pretty' }}>
            interested in sponsoring paradox? {' '}
            <span className="font-bold">reach out.</span>
          </p>
        </div>
        <MotionLink to="/paradox/contact"
          whileHover={{ x: -1 }} whileTap={{ scale: 0.96 }} transition={SPRING}
          className="shrink-0 inline-flex items-center gap-2 font-body font-semibold text-[14px] sm:text-[15px] tracking-[0.02em]"
          style={{ color: 'var(--bg)', textDecoration: 'none', transition: 'gap 0.2s' }}>
          get in touch <span style={{ fontSize: '1.2em', opacity: 0.8 }}>→</span>
        </MotionLink>
      </motion.div>
    </section>
  )
}

// ─── TICKETS ───────────────────────────────────────────────────────────────
const TICKETS_DATA = [
  { phase: 'phase 1 · early', price: '—', note1: 'sold out', note2: 'gone', bg: 'var(--c2)', color: 'var(--ink)' },
  { phase: 'phase 2 · regular', price: '—', note1: 'sold out', note2: 'closed', bg: 'var(--c3)', color: 'var(--ink)' },
  { phase: 'spot · door', price: '—', note1: 'closed', note2: 'sold out', bg: 'var(--ink)', color: 'var(--bg)' },
]

function TicketsSection() {
  return (
    <section className="border-b-[1.5px] border-ink relative overflow-hidden pt-6 pb-7 sm:pt-14 sm:pb-16" id="tickets"
      style={{ position: 'relative', zIndex: 1 }}>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-12 grid gap-10 lg:grid-cols-2 lg:items-start relative" style={{ zIndex: 2 }}>
        <div>
          {/* Fix 14 */}
          <motion.p className="kicker"
            initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}>
            [ the after-party ]
          </motion.p>
          {/* Fix 15 */}
          <motion.h2 className="font-display leading-[0.9] text-balance mt-1.5 mb-3"
            style={{ fontSize: 'clamp(34px, 6.5vw, 72px)', letterSpacing: '-0.02em' }}
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 220, damping: 24, delay: 0.08 }}>
            the after-party. it went{' '}
            <span style={{ color: 'var(--c1)' }}>till 10pm.</span>
          </motion.h2>
          <p className="font-body leading-relaxed opacity-80 text-pretty" style={{ fontSize: 17, maxWidth: '42ch' }}>
            Friday, June 6 · 5pm onwards. Dance showcase, DJ, stalls, photo wall. One of those nights.
          </p>
        </div>

        {/* Fix 9: ticket cards slide in from right with revealRight + stagger(0.07) */}
        <motion.div variants={stagger(0.07)} initial="hidden" whileInView="show"
          viewport={{ once: true, margin: '-40px' }}
          className="flex flex-col gap-3">
          {TICKETS_DATA.map((tk) => (
            <motion.div key={tk.phase}
              variants={revealRight}
              whileHover={{ x: -2, boxShadow: '5px 5px 0 var(--ink)' }}
              transition={SPRING}
              className="relative rounded-2xl border-[1.5px] border-ink p-5 flex flex-col gap-1.5 overflow-visible"
              style={{ background: tk.bg, color: tk.color, boxShadow: '3px 3px 0 var(--ink)' }}>
              {/* Punch holes */}
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-[1.5px] border-ink"
                style={{ background: 'var(--bg)' }}/>
              <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-[1.5px] border-ink"
                style={{ background: 'var(--bg)' }}/>
              <div className="flex justify-between items-baseline gap-3">
                <span className="font-mono text-[11px] tracking-[0.1em] uppercase">{tk.phase}</span>
                <span className="font-display leading-[0.95]" style={{ fontSize: 'clamp(26px, 4vw, 36px)', fontVariantNumeric: 'tabular-nums' }}>{tk.price}</span>
              </div>
              <div className="flex justify-between font-mono text-[11px] opacity-70">
                <span>{tk.note1}</span><span>{tk.note2}</span>
              </div>
            </motion.div>
          ))}
          <MotionLink to="/paradox/scores"
            whileHover={{ x: -1, y: -1 }} whileTap={{ scale: 0.96 }} transition={SPRING}
            className="mt-1 btn-pill btn-pill-primary"
            style={{ minHeight: 44 }}>
            see the scores →
          </MotionLink>
        </motion.div>
      </div>
    </section>
  )
}

// ─── DONATE ────────────────────────────────────────────────────────────────
const DONATE_CHIPS = [
  { amt: '₹500',   imp: "a kid's meals for a week",     bg: 'var(--c1)', color: 'var(--bg)' },
  { amt: '₹1,000', imp: 'workshop materials, one batch', bg: 'var(--c2)', color: 'var(--ink)' },
  { amt: '₹2,500', imp: 'a full teaching weekend',       bg: 'var(--c3)', color: 'var(--ink)' },
  { amt: '₹5,000', imp: 'a month of welfare ops',        bg: 'var(--ink)', color: 'var(--bg)' },
  { amt: '₹10,000', imp: 'sponsor a whole drive',        bg: 'var(--c1)', color: 'var(--bg)' },
  { amt: 'other ↗', imp: 'whatever feels right',         bg: 'var(--bg)', color: 'var(--ink)', dashed: true },
]

function DonateSection() {
  return (
    <section className="border-b-[1.5px] border-ink relative overflow-hidden pt-6 pb-7 sm:pt-14 sm:pb-16"
      style={{ position: 'relative', zIndex: 1 }}>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-12 grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-start relative" style={{ zIndex: 2 }}>
        <div>
          {/* Fix 14 */}
          <motion.p className="kicker"
            initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}>
            [ skip the events, send the money ]
          </motion.p>
          {/* Fix 15 */}
          <motion.h2 className="font-display leading-[0.9] text-balance mt-1.5 mb-3"
            style={{ fontSize: 'clamp(34px, 6.5vw, 72px)', letterSpacing: '-0.02em' }}
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 220, damping: 24, delay: 0.08 }}>
            a clean, boring{' '}
            <span style={{ color: 'var(--c1)' }}>donation</span> also works.
          </motion.h2>
          <p className="font-body leading-relaxed opacity-80 text-pretty" style={{ fontSize: 16 }}>
            Skip the brackets. Send the money. We'll send a receipt and an 80G certificate by email.
          </p>
        </div>

        {/* Fix 10: popIn with stagger(0.07), wiggle whileHover */}
        <motion.div variants={stagger(0.07)} initial="hidden" whileInView="show"
          viewport={{ once: true, margin: '-40px' }}
          className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {DONATE_CHIPS.map((chip) => (
            <motion.a key={chip.amt}
              href={`mailto:ngo.aquaterra@gmail.com?subject=Donation ${chip.amt}`}
              variants={popIn}
              whileHover={{ rotate: [-1, 1, -1, 0], y: -4 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl border-[1.5px] border-ink p-4 flex flex-col gap-2 min-h-[110px]"
              style={{
                background: chip.bg, color: chip.color,
                borderStyle: chip.dashed ? 'dashed' : 'solid',
                boxShadow: '3px 3px 0 var(--ink)',
                transitionProperty: 'transform, box-shadow',
              }}>
              <span className="font-display leading-[0.95]" style={{ fontSize: 'clamp(22px, 3.5vw, 28px)', fontVariantNumeric: 'tabular-nums' }}>{chip.amt}</span>
              <span className="font-body text-[12.5px] leading-[1.4] opacity-85">{chip.imp}</span>
            </motion.a>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// ─── GALLERY ───────────────────────────────────────────────────────────────
// Real photographs from past AquaTerra events, served straight off
// `frontend/public/paradox-2026/` using the exact filenames below. (An older
// comment here pointed at `public/paradox/evidence/`; that folder stopped being
// read when the gallery moved to the 2026 set and is now dead weight.)
//
// Mixed extensions are deliberate. Each source was re-encoded and the smaller
// of WebP / mozjpeg kept per image — WebP won on 11 of 15 (up to 81% smaller),
// but on event-02, -03, -10 and -11 it was no better than the original JPEG, so
// those keep .jpg rather than churn the file for nothing. Whole set: 2.3MB -> 1.3MB.
//
// If an image is missing, the polaroid still lays out correctly; the broken
// `<img>` will show alt text. Captions stay in the existing handwritten
// lowercase voice ("P4.0 · finals", "volunteers, 5am") and rotation values
// keep the scrappy "shoebox of photos" feel.
const GALLERY_ITEMS = [
  { rot: -3, src: '/paradox-2026/event-01.webp', label: 'paradox 2026',       alt: 'Paradox 2026 event' },
  { rot: 4,  src: '/paradox-2026/event-02.jpg',  label: 'the crowd',          alt: 'Paradox 2026 event' },
  { rot: -2, src: '/paradox-2026/event-03.jpg',  label: 'on stage',           alt: 'Paradox 2026 event' },
  { rot: 5,  src: '/paradox-2026/event-04.webp', label: 'winners',            alt: 'Paradox 2026 event' },
  { rot: -4, src: '/paradox-2026/event-05.webp', label: 'the energy',         alt: 'Paradox 2026 event' },
  { rot: 3,  src: '/paradox-2026/event-06.webp', label: 'collab',             alt: 'Paradox 2026 event' },
  { rot: -3, src: '/paradox-2026/event-07.webp', label: 'night one',          alt: 'Paradox 2026 event' },
  { rot: 4,  src: '/paradox-2026/event-08.webp', label: 'finals',             alt: 'Paradox 2026 event' },
  { rot: -2, src: '/paradox-2026/event-09.webp', label: 'after-party 2026',   alt: 'Paradox 2026 event' },
  { rot: 3,  src: '/paradox-2026/event-10.jpg',  label: 'kolkata showed up',  alt: 'Paradox 2026 event' },
  { rot: -5, src: '/paradox-2026/event-11.jpg',  label: 'the team',           alt: 'Paradox 2026 event' },
  { rot: 2,  src: '/paradox-2026/event-12.webp', label: 'day five',           alt: 'Paradox 2026 event' },
  { rot: -3, src: '/paradox-2026/event-13.webp', label: 'cheque day',         alt: 'Paradox 2026 event' },
  { rot: 5,  src: '/paradox-2026/event-14.webp', label: 'squad',              alt: 'Paradox 2026 event' },
  { rot: -2, src: '/paradox-2026/event-15.webp', label: 'till next year',     alt: 'Paradox 2026 event' },
]

function GallerySection() {
  return (
    <section className="border-b-[1.5px] border-ink relative overflow-hidden pt-6 pb-7 sm:pt-14 sm:pb-16"
      style={{ position: 'relative', zIndex: 1 }}>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-12 relative" style={{ zIndex: 2 }}>
        {/* Fix 14 */}
        <motion.p className="kicker"
          initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}>
          [ paradox 2026 ]
        </motion.p>
        {/* Fix 15 */}
        <motion.h2 className="font-display leading-[0.9] text-balance mt-1.5 mb-4 sm:mb-8"
          style={{ fontSize: 'clamp(34px, 6.6vw, 76px)', letterSpacing: '-0.02em' }}
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 220, damping: 24, delay: 0.08 }}>
          it happened.{' '}
          <span style={{ color: 'var(--c1)' }}>and it was everything.</span>
        </motion.h2>

        {/* Fix 11: polaroids "fall" into natural rotation from rot+15 */}
        <motion.div variants={stagger(0.08)} initial="hidden" whileInView="show"
          viewport={{ once: true, margin: '-40px' }}
          className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-7">
          {GALLERY_ITEMS.map((item, i) => (
            <motion.figure key={i}
              initial={{ opacity: 0, scale: 0.8, rotate: item.rot + 15 }}
              whileInView={{ opacity: 1, scale: 1, rotate: item.rot }}
              viewport={{ once: true, margin: '-40px' }}
              whileHover={{ scale: 1.05, rotate: 0, zIndex: 10, boxShadow: '7px 7px 0 var(--ink)' }}
              transition={SPRING}
              className="m-0 border-[1.5px] border-ink -mx-1"
              style={{
                background: 'var(--bg)', padding: '10px 10px 36px',
                boxShadow: '4px 4px 0 var(--ink)',
                transitionProperty: 'transform, box-shadow',
              }}>
              {/* Polaroid photo area — real evidence shot.
                  `loading="lazy"` keeps the home-page LCP clean; the gallery
                  sits below the fold. 1px inset outline matches the design
                  system's image-outline rule so the photo doesn't bleed
                  into the cream polaroid card. */}
              <div className="aspect-square overflow-hidden relative"
                style={{ background: 'var(--ink)' }}>
                <img
                  src={item.src}
                  alt={item.alt}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ outline: '1px solid rgba(0,0,0,0.1)', outlineOffset: '-1px' }}
                />
              </div>
              {/* Caveat handwriting caption */}
              <figcaption className="font-hand text-center mt-3 leading-none"
                style={{ fontSize: 19, color: 'var(--ink)' }}>
                {item.label}
              </figcaption>
            </motion.figure>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// ─── FAQ ───────────────────────────────────────────────────────────────────
const FAQS = [
  { q: 'who competed?', a: 'students aged 21 or younger (born on or after 1st January 2005), grades 6–12 and college, across Kolkata. some events had age splits.' },
  { q: 'how many events were there?', a: '10+ events across 6 days — sport, business, creative, cultural. solo events and team events of 2–8.' },
  { q: 'where did the money go?', a: '100% of net proceeds funded AquaTerra welfare drives — teaching workshops, worksheets for underprivileged kids, food drives, plantation. 80G certificates available on request.' },
  { q: 'can my school sponsor future editions?', a: 'yes. ping us — we have title, co-sponsor, associate and partner tiers. education partners get webinar slots too.' },
  { q: 'will paradox happen again?', a: "yes. paradox is an annual event. aquaterra's 5th edition is in the works — follow us on IG for the first announcement." },
  { q: 'can i volunteer next year?', a: 'absolutely. team aquaterra applications open on our IG every year. volunteers get certificates + welfare points.' },
]

function FAQSection() {
  const [open, setOpen] = useState(-1)
  return (
    <section className="border-b-[1.5px] border-ink relative overflow-hidden pt-6 pb-7 sm:pt-14 sm:pb-16"
      style={{ background: 'var(--bg)', position: 'relative', zIndex: 1 }}>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-12 relative" style={{ zIndex: 2 }}>
        {/* Fix 12: section heading uses revealLeft; kicker + h2 */}
        <motion.p className="kicker"
          initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}>
          [ the small print ]
        </motion.p>
        <motion.h2 className="font-display leading-[0.9] text-balance mt-1.5 mb-4 sm:mb-7"
          style={{ fontSize: 'clamp(34px, 6.6vw, 76px)', letterSpacing: '-0.02em' }}
          variants={revealLeft} initial="hidden" whileInView="show" viewport={{ once: true }}>
          stuff you'll ask anyway.
        </motion.h2>

        {/* Fix 12: FAQ items reveal with revealUp + stagger(0.05) */}
        <motion.div variants={stagger(0.05)} initial="hidden" whileInView="show"
          viewport={{ once: true, margin: '-40px' }}
          className="border-t-[1.5px] border-ink">
          {FAQS.map((f, i) => (
            <motion.div key={i} variants={revealUp} className="border-b-[1.5px] border-ink">
              <button
                onClick={() => setOpen(open === i ? -1 : i)}
                className="w-full min-h-[52px] flex justify-between items-center gap-4 py-3.5 px-1 text-left"
                style={{ background: 'transparent', border: 0 }}>
                {/* Fix 12: question text whileHover x:4 + color c1 */}
                <motion.span className="font-body font-semibold leading-snug text-balance"
                  style={{ fontSize: 'clamp(16px, 2vw, 19px)', color: open === i ? 'var(--c1)' : 'var(--ink)' }}
                  whileHover={{ x: 4, color: 'var(--c1)' }}
                  transition={{ type: 'spring', stiffness: 300, damping: 28 }}>
                  {f.q}
                </motion.span>
                <motion.span
                  animate={{ rotate: open === i ? 90 : 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                  className="font-mono text-[22px] font-bold shrink-0 opacity-60"
                  style={{ color: open === i ? 'var(--c1)' : 'var(--ink)' }}>
                  +
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className="overflow-hidden">
                    <p className="font-body text-[15px] leading-[1.6] opacity-85 pb-5 px-1 m-0" style={{ maxWidth: '70ch', textWrap: 'pretty' }}>
                      {f.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// ─── CONTACT ───────────────────────────────────────────────────────────────
const CONTACT_CARDS = [
  { lbl: 'email', val: 'ngo.aquaterra@gmail.com', href: 'mailto:ngo.aquaterra@gmail.com', hoverBg: 'var(--c1)', hoverColor: 'var(--bg)' },
  { lbl: 'kanishk', val: '+91 90734 55396', href: 'tel:+919073455396', hoverBg: 'var(--c2)', hoverColor: 'var(--ink)' },
  { lbl: 'instagram', val: '@ngo.aquaterra', href: 'https://instagram.com/ngo.aquaterra', hoverBg: 'var(--c3)', hoverColor: 'var(--ink)' },
  { lbl: 'site', val: 'ngoaquaterra.com', href: 'https://ngoaquaterra.com', hoverBg: 'var(--ink)', hoverColor: 'var(--bg)' },
]

function ContactSection() {
  const [hovered, setHovered] = useState<number | null>(null)
  const waUrl = useWhatsAppGroup()
  return (
    <section className="relative overflow-hidden pt-6 pb-7 sm:pt-14 sm:pb-16" id="contact"
      style={{ position: 'relative', zIndex: 1 }}>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-12 relative" style={{ zIndex: 2 }}>
        {/* Fix 14 */}
        <motion.p className="kicker"
          initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}>
          [ shout at us ]
        </motion.p>
        {/* Fix 15 */}
        <motion.h2 className="font-display leading-[0.9] text-balance mt-1.5 mb-4 sm:mb-8"
          style={{ fontSize: 'clamp(34px, 6.6vw, 76px)', letterSpacing: '-0.02em' }}
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 220, damping: 24, delay: 0.08 }}>
          questions? sponsorship?{' '}
          <span style={{ color: 'var(--c1)' }}>bring it.</span>
        </motion.h2>

        {/* Fix 13: popIn with stagger(0.07), whileHover y-5 + boxShadow */}
        <motion.div variants={stagger(0.07)} initial="hidden" whileInView="show"
          viewport={{ once: true, margin: '-40px' }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {CONTACT_CARDS.map((card, i) => (
            <motion.a key={card.lbl} href={card.href}
              target={card.href.startsWith('http') ? '_blank' : undefined}
              rel={card.href.startsWith('http') ? 'noopener noreferrer' : undefined}
              variants={popIn}
              whileHover={{ y: -5, boxShadow: '5px 5px 0 var(--ink)' }} whileTap={{ scale: 0.96 }} transition={SPRING}
              onHoverStart={() => setHovered(i)}
              onHoverEnd={() => setHovered(null)}
              className="rounded-2xl border-[1.5px] border-ink p-5 flex flex-col gap-1.5 min-h-[110px]"
              style={{
                background: hovered === i ? card.hoverBg : 'var(--bg)',
                color: hovered === i ? card.hoverColor : 'var(--ink)',
                boxShadow: '3px 3px 0 var(--ink)',
                transitionProperty: 'background-color, color, transform',
                transitionDuration: '0.2s',
              }}>
              <span className="font-mono text-[11px] tracking-[0.12em] uppercase opacity-70">{card.lbl}</span>
              <span className="font-display leading-[1.1]"
                style={{ fontSize: 'clamp(17px, 2.2vw, 21px)', wordBreak: 'break-word' }}>
                {card.val}
              </span>
            </motion.a>
          ))}
        </motion.div>

        {/* ── WhatsApp group CTA ── */}
        <motion.a
          href={waUrl} target="_blank" rel="noopener noreferrer"
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 220, damping: 24, delay: 0.1 }}
          whileHover={{ y: -3, boxShadow: '6px 6px 0 var(--ink)' }}
          whileTap={{ scale: 0.96 }}
          className="mt-4 rounded-2xl border-[1.5px] border-ink p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          style={{ background: '#25D366', color: '#0A0A0A', boxShadow: '3px 3px 0 var(--ink)', textDecoration: 'none', transitionProperty: 'transform, box-shadow' }}
        >
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] tracking-[0.16em] uppercase" style={{ opacity: 0.65 }}>★ paradox 2026 · official group</span>
            <span className="font-display leading-[0.95]" style={{ fontSize: 'clamp(20px, 3vw, 28px)', letterSpacing: '-0.02em' }}>
              join the whatsapp group.
            </span>
            <span className="font-body text-[13px]" style={{ opacity: 0.75, marginTop: 2 }}>
              updates, payment confirmation &amp; event-day logistics — all here.
            </span>
          </div>
          <span className="font-display shrink-0" style={{ fontSize: 20, letterSpacing: '-0.01em' }}>Join →</span>
        </motion.a>

        {/* Footer line */}
        <div className="flex justify-between flex-wrap gap-3 mt-14 pt-6 border-t-[1.5px] border-ink font-mono text-[11px] tracking-[0.06em] opacity-60">
          <span>© 2026 AquaTerra · 80G certified · all proceeds → welfare</span>
          <span>paradox 2026 · kolkata</span>
        </div>
      </div>
    </section>
  )
}
