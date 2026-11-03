import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import { Star, Burst, Marquee } from '../components/v6Shared'
import { useMeta } from '../hooks/useMeta'
import { useJsonLd, breadcrumbLd } from '../hooks/useJsonLd'
import { pageMetadata } from '../lib/metaConfig'
import { faqFor } from '../lib/faqData'
import { ORG_FACTS, displayCount } from '../lib/orgFacts'
import { setAuthIntent } from '../lib/authIntent'

const DRIVES = displayCount(ORG_FACTS.drivesWrittenUp)

// ── Data ──────────────────────────────────────────────────────────
// audit-ok: the Pop sticker palette (mint/pink/lemon/orange/sky/grape),
// documented on /brand as `STICKERS` in public/BrandPage.tsx. It is a
// decorative FILL palette for stickers, posters and confetti, deliberately
// outside tokens.css - it is not a UI colour and never sets text on cream.
const ACCENTS = ['#00E5A0', 'var(--lemon)', '#FF6BD6', 'var(--sky)', 'var(--grape)', '#FF7A1A', 'var(--pink)']

// RESTORED 2026-09-06, both now sourced rather than retyped.
//
// These two tiles were pulled earlier the same day because ORG_FACTS had both
// as `null` and §21.3 is absolute: a claim with no system of record "either
// becomes a constant a named human owns, OR IT STOPS BEING PUBLISHED. There is
// no third option that is honest." Both now have a source, so both are back:
//
//  - dog meals: DERIVED. welfare_projects.key_statistic does record a figure
//    per feeding drive ("45 Dogs fed"), for all 58 of them, every one parsing
//    cleanly - the earlier "no table backs this" note was simply wrong.
//    It is labelled MEALS, not dogs: 58 drives around Kolkata feed overlapping
//    street populations, so the sum counts feedings, and "3,200+ dogs fed"
//    would assert a distinct-animal count the records cannot support.
//    (BRAND_VOICE.md §3: "never invent, round up, or improve a number.")
//  - clothes: a CONSTANT the project owner set - two tonnes. Note it is LOWER
//    than the 2,500kg this page used to print, which is the right direction.
//    Not derivable: the "kg" rows mix books, clothes, ranges and a child count.
//
// Every value below comes from ORG_FACTS rather than a literal (§21.0).
const STATS = [
  { value: displayCount(ORG_FACTS.childrenReached), label: 'kids in workshops' },
  { value: displayCount(ORG_FACTS.saplingsPlanted), label: 'saplings planted' },
  { value: displayCount(ORG_FACTS.medicalCheckups), label: 'medical checkups' },
  { value: displayCount(ORG_FACTS.bananasDistributed), label: 'bananas distributed' },
  { value: displayCount(ORG_FACTS.dogMealsServed), label: 'dog meals served' },
  // An exact weight, not an approximate "+" figure, so it does NOT go through
  // displayCount() - flooring 2,000 to "2,000+" would imply a lower bound on a
  // number the owner gave as exact.
  { value: `${ORG_FACTS.clothesDistributedKg!.toLocaleString()} kg`, label: 'clothes distributed' },
  { value: DRIVES, label: 'projects & drives' },
]

const DRIVE_STEPS = [
  { title: 'Community poll', body: 'Volunteering opportunities are shared as polls in the Community WhatsApp group.' },
  { title: 'Drive details', body: 'Each poll lists the date, time, location, and nature of the drive.' },
  { title: 'Vote to join', body: 'Voting “Yes” adds you to a drive-specific WhatsApp group.' },
  { title: 'Get briefed', body: 'All instructions, content, and guidelines are shared in that group.' },
]

const COMMUNITIES = [
  { name: 'Community AquaTerra', tag: 'all volunteers', desc: 'The default group for every registered volunteer. Drive polls, announcements, and general opportunities land here.', color: '#00E5A0' },
  { name: 'Team AQ', tag: 'department members', desc: 'For volunteers actively working within departments. Team updates and coordination happen here.', color: 'var(--sky)' },
  { name: 'Core AQ', tag: 'heads of departments', desc: 'A leadership group of selected Heads of Departments (HoDs) only.', color: 'var(--lemon)' },
]

const STARTUPS = [
  // audit-ok: Pop Orange, the sticker palette (see /brand).
  { name: 'Crftd', color: '#FF7A1A', desc: 'Student-designed merch. Every purchase funds our welfare work.' },
  { name: 'ShikshAQ', color: 'var(--grape)', desc: 'A student-built EdTech platform making quality education accessible.' },
]

// Sourced from lib/faqData.ts, shared with /faq, so the two pages can't
// independently drift on the questions they both answer (previously two
// separately-worded arrays here and on FAQPage).
const FAQS = faqFor('handbook')

const spring = { type: 'spring', duration: 0.3, bounce: 0 } as const

// ── Small reusable bits ───────────────────────────────────────────
function SectionLabel({ children }: { children: string }) {
  return (
    <div className="mono xs upper" style={{ fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink-3)', marginBottom: 14 }}>
      [ {children} ]
    </div>
  )
}

export default function VolunteerHandbookPage() {
  useMeta(pageMetadata.volunteer)
  useJsonLd('volunteer-breadcrumb', breadcrumbLd([['Home', '/'], ['Volunteer', '/volunteer']]))
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  return (
    <MotionConfig reducedMotion="user">
    <div className="route-enter">

      {/* ── HERO ── */}
      <section style={{ position: 'relative', overflow: 'hidden', padding: 'clamp(44px,8vw,96px) var(--page-px,24px) clamp(32px,5vw,56px)' }}>
        <Star size={130} color="var(--lemon)" className="spin-slow" style={{ position: 'absolute', top: 36, right: '7%', opacity: 0.7 }} />
        <Burst size={92} color="var(--pink)" style={{ position: 'absolute', bottom: 8, left: '5%', opacity: 0.5 }} />
        <div className="container" style={{ position: 'relative' }}>
          <div className="row gap-2" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
            <span className="sticker sticker-mint sticker-float sticker--diecut" style={{ ['--sticker-ground' as string]: 'var(--bg)' }}>★ Registered charitable trust</span>
            <span className="sticker sticker-lemon wobble sticker--diecut" style={{ ['--sticker-ground' as string]: 'var(--bg)' }}>est 2021</span>
            <span className="sticker sticker--diecut" style={{ ['--sticker-ground' as string]: 'var(--bg)' }}>free · no experience needed</span>
            {/* Rubber-stamp-style accent - reuses the shared .sticker component,
                just rotated harder than the default -3deg to read as a stamp.
                Die-cut per 13.1 (not tappable), same as its siblings above -
                the rotation is what reads as a stamp, not the border. */}
            <span className="sticker sticker-tomato sticker--diecut" style={{ transform: 'rotate(-11deg)', ['--sticker-ground' as string]: 'var(--bg)' }}>official handbook</span>
          </div>
          <h1 className="giant" style={{ margin: 0, lineHeight: 0.86 }}>
            volunteer<br />
            <span className="underline-doodle" style={{ fontStyle: 'italic', fontFamily: 'var(--serif)', fontWeight: 400, color: 'var(--welfare-ink)' }}>handbook</span>.
          </h1>
          <p style={{ fontSize: 20, lineHeight: 1.5, marginTop: 24, maxWidth: 560, color: 'var(--ink-2)' }}>
            How drives work, how we're structured, and how to grow with us. Everything
            a new volunteer needs - student-run, Kolkata-born, zero fees.
          </p>
          <div className="row gap-2" style={{ marginTop: 30, flexWrap: 'wrap' }}>
            <Link to="/login" className="btn btn-primary btn-lg" onClick={() => setAuthIntent({ kind: 'apply' })}>show up for one drive →</Link>
            <a href="#faqs" className="btn btn-lg">read the faqs</a>
          </div>
        </div>
      </section>

      {/* ── MARQUEE ── */}
      <section style={{ padding: '18px 0', background: 'var(--ink)', color: 'var(--bg)', overflow: 'hidden' }}>
        {/* `★ 1,500+ DOGS FED` and `2,500 KG CLOTHES` removed 2026-09-06 for
            the reason given at the STATS array above (§21.3: an unsourced
            claim stops being published). The ★ alternation is preserved by
            moving the star onto BANANAS, which now leads the second pair.
            Every surviving figure derives from ORG_FACTS; `15,000 BANANAS`
            keeps its exact wording — no "+", and never "meals". */}
        <Marquee items={[`★ ${displayCount(ORG_FACTS.childrenReached)} KIDS REACHED`, `${displayCount(ORG_FACTS.saplingsPlanted)} SAPLINGS`, '★ 15,000 BANANAS', `${DRIVES} PROJECTS`, `★ ${displayCount(ORG_FACTS.medicalCheckups)} CHECKUPS`, `${displayCount(ORG_FACTS.dogMealsServed)} DOG MEALS`, '★ ZERO FEES EVER']} color="mint" />
      </section>

      {/* ── IMPACT STATS ── */}
      <section className="container" style={{ padding: 'clamp(44px,6vw,80px) var(--page-px,24px)' }}>
        <SectionLabel>the impact, by numbers</SectionLabel>
        <h2 className="h-display" style={{ fontSize: 'clamp(31px,5.4vw,50px)', margin: '0 0 28px', lineHeight: 0.92 }}>
          what volunteers have <span style={{ color: 'var(--welfare-ink)' }}>built</span>.
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 16 }}>
          {STATS.map((s, i) => {
            const c = ACCENTS[i % ACCENTS.length]
            return (
              <div key={i} className="card" style={{ padding: '22px 20px', transform: `rotate(${i % 2 ? 0.5 : -0.5}deg)` }}>
                <div style={{ height: 8, width: 44, borderRadius: 3, background: c, marginBottom: 14 }} />
                <div className="h-display" style={{ fontSize: 'clamp(34px,4.8vw,46px)', lineHeight: 0.95, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>
                  {s.value}
                </div>
                <div style={{ fontFamily: 'var(--eina)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, marginTop: 8 }}>
                  {s.label}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ background: 'var(--bg-2)', borderTop: 'var(--hair-2)', borderBottom: 'var(--hair-2)', padding: 'clamp(44px,6vw,80px) 0' }}>
        <div className="container">
          <SectionLabel>how volunteering works</SectionLabel>
          <h2 className="h-display" style={{ fontSize: 'clamp(31px,5.4vw,50px)', margin: '0 0 10px', lineHeight: 0.92 }}>
            drive-based & <span style={{ fontStyle: 'italic', fontFamily: 'var(--serif)', fontWeight: 400, color: 'var(--welfare-ink)' }}>optional</span>.
          </h2>
          <p style={{ fontFamily: 'var(--eina)', fontSize: 16, lineHeight: 1.6, color: 'var(--ink-2)', maxWidth: 540, margin: '0 0 34px' }}>
            Show up for what fits your schedule. Every drive is shared, voted on, and briefed
            through WhatsApp - no pressure, no minimum streak.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {DRIVE_STEPS.map((step, i) => (
              <div key={i} className="card card-hover" style={{ padding: '22px 20px' }}>
                <div className="h-display" style={{ fontSize: 40, lineHeight: 1, color: 'var(--welfare-ink)', letterSpacing: '-0.04em', marginBottom: 12 }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 17, color: 'var(--ink)', marginBottom: 8 }}>
                  {step.title}
                </div>
                <p style={{ fontFamily: 'var(--eina)', fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-2)', margin: 0 }}>
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMMUNITY STRUCTURE ── */}
      <section className="container" style={{ padding: 'clamp(44px,6vw,80px) var(--page-px,24px)' }}>
        <SectionLabel>how we're organised</SectionLabel>
        <h2 className="h-display" style={{ fontSize: 'clamp(31px,5.4vw,50px)', margin: '0 0 10px', lineHeight: 0.92 }}>
          three <span style={{ color: 'var(--welfare-ink)' }}>communities</span>.
        </h2>
        <p style={{ fontFamily: 'var(--eina)', fontSize: 16, lineHeight: 1.6, color: 'var(--ink-2)', maxWidth: 520, margin: '0 0 34px' }}>
          To keep communication clear, AquaTerra runs on three WhatsApp communities.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {COMMUNITIES.map(c => (
            <div key={c.name} className="card card-hover" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ height: 8, background: c.color, borderBottom: 'var(--hair)' }} />
              <div style={{ padding: '20px 22px 22px' }}>
                <span className="sticker sticker--diecut" style={{ fontSize: 10, background: c.color, color: 'var(--ink)', marginBottom: 14, display: 'inline-flex', ['--sticker-ground' as string]: 'var(--card)' }}>
                  {c.tag}
                </span>
                {/* Was an <h2>, a sibling-level claim against the section
                    heading that contains it. */}
                <h3 className="h-display" style={{ fontSize: 22, lineHeight: 1, marginBottom: 10 }}>
                  <Link to="/everything-we-do" style={{ color: 'var(--ink)', textDecoration: 'none', borderBottom: '1px dashed var(--line-2)' }}>
                    {c.name}
                  </Link>
                </h3>
                <p style={{ fontFamily: 'var(--eina)', fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)', margin: 0 }}>
                  {c.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── GROW WITH US ── */}
      <section style={{ background: 'var(--bg-2)', borderTop: 'var(--hair-2)', padding: 'clamp(44px,6vw,80px) 0' }}>
        <div className="container">
          <SectionLabel>grow with us</SectionLabel>
          <h2 className="h-display" style={{ fontSize: 'clamp(31px,5.4vw,50px)', margin: '0 0 28px', lineHeight: 0.92 }}>
            go beyond <span style={{ fontStyle: 'italic', fontFamily: 'var(--serif)', fontWeight: 400, color: 'var(--welfare-ink)' }}>showing up</span>.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, alignItems: 'start' }}>
            {/* Team inductions */}
            <div className="card" style={{ padding: 'clamp(24px,3vw,32px)' }}>
              <span className="sticker sticker-sky sticker--diecut" style={{ fontSize: 10, marginBottom: 16, display: 'inline-flex', ['--sticker-ground' as string]: 'var(--card)' }}>★ join a team</span>
              <h3 className="h-display" style={{ fontSize: 26, lineHeight: 1, margin: '0 0 12px' }}>Team inductions</h3>
              <p style={{ fontFamily: 'var(--eina)', fontSize: 15, lineHeight: 1.7, color: 'var(--ink-2)', margin: 0 }}>
                Want ongoing roles and real responsibility? Join the work. We read every application.
                Recruitment for select teams stays open 24/7, so you can grow into a closer,
                more involved part of everything we do.
              </p>
              {/* Names an intent ("which teams are open") the page next door
                  already answers with real, current listings - closing the
                  loop here instead of leaving the reader to find it on their
                  own. */}
              <Link to="/opportunities" className="mono xs link-cta" style={{ marginTop: 12, display: 'inline-flex', color: 'var(--welfare-ink)' }}>see open roles →</Link>
            </div>
            {/* Startups */}
            <div className="card" style={{ padding: 'clamp(24px,3vw,32px)' }}>
              <span className="sticker sticker-grape sticker--diecut" style={{ fontSize: 10, marginBottom: 16, display: 'inline-flex', ['--sticker-ground' as string]: 'var(--card)' }}>★ student-led startups</span>
              <h3 className="h-display" style={{ fontSize: 26, lineHeight: 1, margin: '0 0 16px' }}>Beyond welfare</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {STARTUPS.map(s => (
                  <div key={s.name} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '14px 16px', borderRadius: 'var(--r-tight)', border: 'var(--hair-2)', background: s.color + '14' }}>
                    <span className="sticker sticker--diecut" style={{ fontSize: 10, background: s.color, color: 'var(--ink)', flexShrink: 0, whiteSpace: 'nowrap', ['--sticker-ground' as string]: 'var(--card)' }}>{s.name}</span>
                    <span style={{ fontFamily: 'var(--eina)', fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink-2)' }}>{s.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQs ── */}
      <section id="faqs" style={{ padding: 'clamp(44px,6vw,80px) 0' }}>
        <div className="container" style={{ maxWidth: 760 }}>
          <SectionLabel>questions, answered</SectionLabel>
          <h2 className="giant" style={{ fontSize: 'clamp(34px,6vw,68px)', margin: '0 0 32px', lineHeight: 0.9 }}>
            got <span style={{ color: 'var(--welfare-ink)' }}>questions?</span>
          </h2>
          <div style={{ border: 'var(--hair-2)', borderRadius: 'var(--r-outer)', overflow: 'hidden', background: 'var(--card)' }}>
            {FAQS.map((f, i) => {
              const isOpen = openIdx === i
              return (
                <div key={i} style={{ borderBottom: i < FAQS.length - 1 ? 'var(--hair)' : 'none' }}>
                  <button
                    onClick={() => setOpenIdx(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${i}`}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                      padding: 'clamp(16px,2.4vw,22px) clamp(16px,2.4vw,24px)', background: isOpen ? 'var(--bg-2)' : 'transparent',
                      border: 'none', cursor: 'pointer', textAlign: 'left', gap: 18, minHeight: 44,
                      transition: 'background 0.15s',
                    }}>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flex: 1 }}>
                      <span className="mono" style={{ fontSize: 11, fontWeight: 700, flexShrink: 0, paddingTop: 4, fontVariantNumeric: 'tabular-nums', color: isOpen ? 'var(--welfare-ink)' : 'var(--ink-3)' }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 'clamp(15px,1.7vw,18px)', letterSpacing: '-0.01em', color: 'var(--ink)', textWrap: 'balance' }}>
                        {f.q}
                      </span>
                    </div>
                    <motion.svg
                      width="20" height="20" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      animate={{ rotate: isOpen ? 45 : 0 }} transition={spring}
                      style={{ flexShrink: 0, marginTop: 2, color: isOpen ? 'var(--welfare-ink)' : 'var(--ink-3)' }}>
                      <path d="M12 5v14M5 12h14" />
                    </motion.svg>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={`faq-panel-${i}`}
                        role="region"
                        aria-label={f.q}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } }}
                        transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
                        style={{ overflow: 'hidden' }}>
                        <p style={{ padding: '0 clamp(16px,2.4vw,24px) clamp(18px,2.4vw,24px) 44px', fontFamily: 'var(--eina)', fontSize: 15, lineHeight: 1.7, color: 'var(--ink-2)', margin: 0, textWrap: 'pretty' }}>
                          {f.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ background: 'var(--lemon)', borderTop: 'var(--hair-2)', padding: 'clamp(48px,8vw,96px) var(--page-px,24px)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <Burst size={110} color="var(--ink)" style={{ position: 'absolute', top: -20, left: '8%', opacity: 0.08 }} />
        <Star size={90} color="var(--ink)" className="spin-slow" style={{ position: 'absolute', bottom: -10, right: '8%', opacity: 0.08 }} />
        <div className="container" style={{ position: 'relative' }}>
          <span className="sticker sticker-mint sticker--diecut" style={{ marginBottom: 18, display: 'inline-flex', ['--sticker-ground' as string]: 'var(--lemon)' }}>★ applications open</span>
          <h2 className="h-display" style={{ fontSize: 'clamp(34px,6vw,68px)', margin: '0 0 12px', lineHeight: 0.92, color: 'var(--ink)' }}>
            ready to show up?
          </h2>
          <p style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--ink)', opacity: 0.72, fontSize: 18, margin: '0 auto 28px', maxWidth: 440 }}>
            Takes 5 minutes. No fees, no experience needed - we read every application.
          </p>
          <Link to="/login" className="btn btn-lg" style={{ background: 'var(--ink)', color: 'var(--lemon)' }} onClick={() => setAuthIntent({ kind: 'apply' })}>
            join aquaterra →
          </Link>
        </div>
      </section>

      {/* Quiet aside for the curious-but-not-ready: see who's already here. */}
      <div style={{ textAlign: 'center', padding: 'clamp(22px,4vw,32px) var(--page-px,24px)' }}>
        <Link to="/members" className="aq-thread-link">{displayCount(ORG_FACTS.membersTotal)} members already here →</Link>
      </div>

    </div>
    </MotionConfig>
  )
}
