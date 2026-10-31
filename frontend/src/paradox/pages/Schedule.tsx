// @ts-nocheck
import { motion } from 'framer-motion'
import { fadeUp, stagger, SPRING, MotionLink } from '../lib/motion'

// ──────────────────────────────────────────────────────────────────────────
// Paradox 2026 · /paradox/schedule
// ──────────────────────────────────────────────────────────────────────────
// Static, single-source-of-truth schedule for the event week.
// Tabular layout matching the printed week-glance reference: one row
// per event slot, date cell merged via rowSpan across each day's slots,
// alternating day-background tints for visual grouping, full-strength
// ink borders for high contrast.
//
// Mobile strategy: table is wrapped in horizontal-scroll with a 720px
// min-width so columns never crush. A scroll-hint shows on phones
// before the user nudges sideways. We *intentionally* kept the table
// format on mobile (vs collapsing to cards) because the user asked
// for tabular contrast and the row-by-row scan is what makes the
// schedule readable at a glance.
//
// Why not DB-driven? See the comment block on the previous revision:
// schedule has Day-1/Day-2 splits and recurring IPL auctions that
// don't map 1:1 to paradox_events rows, and editing the schedule is
// once-a-cycle activity.
// ──────────────────────────────────────────────────────────────────────────

type Slot = {
  name: string
  tag?: string
  time: string
  venue: string
  /**
   * Event slug for the Register page query param. The Register form
   * silently ignores unknown slugs (line 252 of Register.tsx) so an
   * incorrect guess just means no preselection — never a hard failure.
   * Leave `undefined` for slots that have no separate ticketed event
   * (e.g. multi-day finals roll up under the same slug).
   */
  slug?: string
  /**
   * Override destination for slots that don't go through the main
   * /paradox/register form. After-party + the in-party showstopper
   * both funnel through the WhatsApp-group ticket flow at
   * /paradox/afterparty, not the per-event register form.
   */
  href?: string
}
type Day = { date: string; weekday: string; weekdayShort: string; accent: string; slots: Slot[] }

// Accent rotation per day. Used for the date-column tint and the
// weekday label colour. Cycles c1 → c2 → c3 → c1 …
const SCHEDULE: Day[] = [
  {
    date: '1', weekday: 'Monday', weekdayShort: 'Mon', accent: 'var(--c1)',
    slots: [
      { name: 'Soccer Storm',     tag: 'FIFA',         time: '11:00 AM', venue: 'Battlegrounds Gaming, Bhowanipore',          slug: 'soccer-storm' },
      { name: 'The Dream Deck',   tag: 'IPL Auction',  time: '11:30 AM', venue: 'Desi Lane, Metro Cinema Building, Esplanade', slug: 'the-dream-deck' },
    ],
  },
  {
    date: '2', weekday: 'Tuesday', weekdayShort: 'Tue', accent: 'var(--c2)',
    slots: [
      { name: 'Wicket Wars · Day 1', tag: 'Cricket',    time: '10:00 AM', venue: 'VS Sports Arena, Bhowanipore',                slug: 'wicket-wars' },
      { name: 'Startup Standoff',     tag: 'Shark Tank', time: '11:30 AM', venue: 'Desi Lane, Metro Cinema Building, Esplanade', slug: 'startup-standoff' },
    ],
  },
  {
    date: '3', weekday: 'Wednesday', weekdayShort: 'Wed', accent: 'var(--c3)',
    slots: [
      { name: 'Wicket Wars · Day 2', tag: 'Cricket',     time: '10:00 AM', venue: 'VS Sports Arena, Bhowanipore',                slug: 'wicket-wars' },
      { name: 'The Dream Deck',       tag: 'IPL Auction', time: '11:30 AM', venue: 'Desi Lane, Metro Cinema Building, Esplanade', slug: 'the-dream-deck' },
      { name: 'The Prodigy · Day 1',  tag: 'BM + HRPR',   time: '6:00 PM',  venue: 'Desi Lane, Metro Cinema Building, Esplanade', slug: 'the-prodigy' },
    ],
  },
  {
    date: '4', weekday: 'Thursday', weekdayShort: 'Thu', accent: 'var(--c1)',
    slots: [
      { name: 'Picklejam',            tag: 'Pickleball', time: '12:00 PM', venue: '11:11 Pickleball Court, Behala',              slug: 'picklejam' },
      { name: 'The Prodigy · Day 2',  tag: 'BM + HRPR',  time: '6:00 PM',  venue: 'Desi Lane, Metro Cinema Building, Esplanade', slug: 'the-prodigy' },
    ],
  },
  {
    date: '5', weekday: 'Friday', weekdayShort: 'Fri', accent: 'var(--c2)',
    slots: [
      { name: 'The Dream Deck', tag: 'IPL Auction', time: '11:30 AM →', venue: 'Desi Lane, Metro Cinema Building, Esplanade', slug: 'the-dream-deck' },
    ],
  },
  {
    date: '6', weekday: 'Saturday', weekdayShort: 'Sat', accent: 'var(--c3)',
    slots: [
      { name: 'Ankle Breaker',   tag: 'Basketball',       time: '9:00 AM',      venue: 'Chetla Park Athletic Club', slug: 'ankle-breaker' },
      // Showstopper + Summer Sunset both run inside the after-party night —
      // tickets flow through the dedicated WA group at /paradox/afterparty,
      // not the per-event register form.
      { name: 'The Showstopper', tag: 'Talent Showcase',  time: '5:00–6:00 PM', venue: '60, Chowringhee Banquets',  href: '/paradox/afterparty' },
      { name: 'Summer Sunset',   tag: 'Afterparty',       time: '6:00 PM →',    venue: '60, Chowringhee Banquets',  href: '/paradox/afterparty' },
    ],
  },
]

// Alternating row-group background. Even-index days use solid bg,
// odd-index get a faintly-tinted band so the eye can group them
// without strong colour fills (which would fight the date-column tint).
const BAND_BG = ['var(--bg)', 'rgba(24,24,24,0.04)']

// Hero kicker / heading
function Header({ totalEvents }: { totalEvents: number }) {
  return (
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
        paradox 2026 · schedule
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
        the full <span style={{ color: 'var(--c1)' }}>week.</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING, delay: 0.18 }}
        className="font-body mt-3"
        style={{ fontSize: 15, color: 'var(--ink)', maxWidth: 540, textWrap: 'pretty' as const }}
      >
        June 1–6, 2026. {totalEvents} events across {SCHEDULE.length} days.
        All times IST.
      </motion.p>

      {/* Quick day-jump pills — horizontal scroll on mobile.
          Each anchors to #day-N which sits on the date cell. */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING, delay: 0.24 }}
        className="flex flex-nowrap overflow-x-auto gap-1.5 mt-5 pb-1 -mb-1"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        {SCHEDULE.map((d) => (
          <a
            key={d.date}
            href={`#day-${d.date}`}
            className="shrink-0 rounded-full border-[1.5px] border-ink px-3.5 font-mono text-[11px] tracking-[0.1em] uppercase flex items-center"
            style={{
              minHeight: '40px',
              background: 'transparent',
              color: 'var(--ink)',
              textDecoration: 'none',
              transitionProperty: 'background-color, color',
              transitionDuration: '150ms',
              fontWeight: 600,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = d.accent
              ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--bg)'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--ink)'
            }}
          >
            {d.weekdayShort} · {d.date}
          </a>
        ))}
      </motion.div>
    </motion.div>
  )
}

export function SchedulePage() {
  const totalEvents = SCHEDULE.reduce((n, d) => n + d.slots.length, 0)

  return (
    <div
      className="min-h-[100dvh]"
      style={{ background: 'var(--bg)', color: 'var(--ink)', position: 'relative', zIndex: 1 }}
    >
      <Header totalEvents={totalEvents} />

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <motion.div
        variants={stagger(0.04)}
        initial="hidden"
        animate="show"
        className="p-3 sm:p-4 lg:p-6"
      >
        <motion.div variants={fadeUp}>
          {/* Scroll hint visible only at narrow widths */}
          <div
            className="font-mono uppercase tracking-[0.12em] mb-2 sm:hidden"
            style={{ fontSize: 10, opacity: 0.55 }}
          >
            ↔ scroll the table sideways
          </div>

          <div
            className="overflow-x-auto rounded-2xl border-[1.5px] border-ink"
            style={{
              boxShadow: '4px 4px 0 var(--ink)',
              background: 'var(--bg)',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <table
              className="w-full"
              style={{
                // Bumped from 720 → 860 to fit the new Register column
                // without crushing the venue cell. Horizontal scroll on
                // narrow viewports still handles overflow gracefully.
                minWidth: 860,
                borderCollapse: 'separate',
                borderSpacing: 0,
                fontFamily: 'var(--font-body)',
                color: 'var(--ink)',
              }}
            >
              <thead>
                <tr style={{ background: 'var(--ink)', color: 'var(--bg)' }}>
                  <th style={thStyle}>
                    Date<br />
                    <span style={{ fontWeight: 400, opacity: 0.7, fontSize: 10 }}>June 2026</span>
                  </th>
                  <th style={thStyle}>Name of Event</th>
                  <th style={thStyle}>Time</th>
                  <th style={thStyle}>Venue</th>
                  <th style={{ ...thStyle, borderRight: 'none' }}>Register</th>
                </tr>
              </thead>

              <tbody>
                {SCHEDULE.map((day, dayIndex) => {
                  const bandBg = BAND_BG[dayIndex % BAND_BG.length]
                  return day.slots.map((slot, slotIndex) => {
                    const isFirstOfDay = slotIndex === 0
                    const isLastOfDay = slotIndex === day.slots.length - 1
                    return (
                      <tr
                        key={`${day.date}-${slotIndex}`}
                        id={isFirstOfDay ? `day-${day.date}` : undefined}
                        style={{
                          background: bandBg,
                          // Bottom border between days (not between slots within a day)
                          borderBottom: isLastOfDay ? '1.5px solid var(--ink)' : 'none',
                          scrollMarginTop: 96,
                        }}
                      >
                        {/* Date cell — only rendered on the first slot of each day,
                            spans the rest of the day's rows via rowSpan. */}
                        {isFirstOfDay && (
                          <td
                            rowSpan={day.slots.length}
                            style={{
                              ...tdStyle,
                              borderRight: '1.5px solid var(--ink)',
                              borderBottom: '1.5px solid var(--ink)',
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              minWidth: 110,
                              background: day.accent,
                              color: day.accent === 'var(--c1)' ? 'var(--bg)' : 'var(--ink)',
                            }}
                          >
                            <div
                              className="font-display tabular-nums leading-none"
                              style={{
                                fontSize: 'clamp(28px, 4vw, 40px)',
                                letterSpacing: '-0.02em',
                                fontWeight: 700,
                              }}
                            >
                              {day.date}
                            </div>
                            <div
                              className="font-mono uppercase mt-1"
                              style={{
                                fontSize: 11,
                                letterSpacing: '0.1em',
                                fontWeight: 600,
                                opacity: 0.85,
                              }}
                            >
                              {day.weekdayShort}
                            </div>
                          </td>
                        )}

                        {/* Event name + tag */}
                        <td
                          style={{
                            ...tdStyle,
                            borderRight: '1.5px solid rgba(24,24,24,0.18)',
                            borderBottom: isLastOfDay ? 'none' : '1px solid rgba(24,24,24,0.12)',
                            minWidth: 220,
                          }}
                        >
                          <div
                            className="font-display"
                            style={{
                              fontSize: 'clamp(15px, 1.9vw, 18px)',
                              fontWeight: 600,
                              letterSpacing: '-0.005em',
                              lineHeight: 1.25,
                            }}
                          >
                            {slot.name}
                          </div>
                          {slot.tag && (
                            <div
                              className="font-mono uppercase tracking-[0.1em] mt-1"
                              style={{ fontSize: 10, fontWeight: 600, color: day.accent }}
                            >
                              {slot.tag}
                            </div>
                          )}
                        </td>

                        {/* Time */}
                        <td
                          style={{
                            ...tdStyle,
                            borderRight: '1.5px solid rgba(24,24,24,0.18)',
                            borderBottom: isLastOfDay ? 'none' : '1px solid rgba(24,24,24,0.12)',
                            whiteSpace: 'nowrap',
                            textAlign: 'center',
                            minWidth: 120,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          <span
                            className="font-mono uppercase tracking-[0.05em]"
                            style={{ fontSize: 13, fontWeight: 700 }}
                          >
                            {slot.time}
                          </span>
                        </td>

                        {/* Venue */}
                        <td
                          style={{
                            ...tdStyle,
                            borderRight: '1.5px solid rgba(24,24,24,0.18)',
                            borderBottom: isLastOfDay ? 'none' : '1px solid rgba(24,24,24,0.12)',
                            minWidth: 240,
                          }}
                        >
                          <span style={{ fontSize: 13, lineHeight: 1.4 }}>{slot.venue}</span>
                        </td>

                        {/* Register — per-slot button. Routes to the
                            per-event register form (preselects via
                            ?event=slug) or to the dedicated after-party
                            flow when the slot is part of that night. */}
                        <td
                          style={{
                            ...tdStyle,
                            padding: '10px 14px',
                            borderBottom: isLastOfDay ? 'none' : '1px solid rgba(24,24,24,0.12)',
                            textAlign: 'center',
                            minWidth: 132,
                          }}
                        >
                          <MotionLink
                            to={slot.href ?? (slot.slug ? `/paradox/register?event=${slot.slug}` : '/paradox/register')}
                            whileTap={{ scale: 0.96 }}
                            whileHover={{ y: -2, transition: SPRING }}
                            transition={SPRING}
                            aria-label={`Register for ${slot.name}`}
                            className="rounded-full border-[1.5px] border-ink font-mono uppercase tracking-[0.06em] inline-flex items-center justify-center gap-1.5"
                            style={{
                              background: day.accent,
                              color: day.accent === 'var(--c1)' ? 'var(--bg)' : 'var(--ink)',
                              boxShadow: '2px 2px 0 var(--ink)',
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '0 14px',
                              minHeight: 40,
                              whiteSpace: 'nowrap',
                              transitionProperty: 'transform, box-shadow',
                              transitionDuration: '150ms',
                            }}
                          >
                            Register <span aria-hidden>→</span>
                          </MotionLink>
                        </td>
                      </tr>
                    )
                  })
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
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
            [ ready to play ]
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
            pick your event.
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
              to="/paradox/register"
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
              Register
            </MotionLink>
          </motion.div>
        </div>
      </motion.section>
    </div>
  )
}

// ── Shared cell styles ─────────────────────────────────────────────────────
const thStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '14px 16px',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  borderRight: '1.5px solid rgba(251,245,230,0.25)',
  borderBottom: '1.5px solid var(--ink)',
}

const tdStyle: React.CSSProperties = {
  padding: '14px 18px',
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  color: 'var(--ink)',
  lineHeight: 1.35,
  verticalAlign: 'middle',
}
