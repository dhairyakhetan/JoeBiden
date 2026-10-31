// @ts-nocheck
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { fadeUp, stagger, SPRING, MotionLink } from '../lib/motion'
import { useWhatsAppGroup } from '../lib/useWhatsAppGroup'
import { supabase } from '../lib/supabase'

type TicketTier = {
  label: string
  price: string
  bg: string
  color: string
  wide?: boolean
  // opensAt: ISO date when this phase starts. Used to compute live
  // status against today's date so the page self-updates as dates
  // pass without redeploys.
  opensAt: string | null
  // closedManually: Early bird is sold out before its natural
  // expiry; flag it explicitly so we don't have to encode a "soldOutAt".
  closedManually?: boolean
}

type ComputedStatus = 'closed' | 'live' | 'upcoming'

// Pricing ladder for Paradox 2026 After Party. Source-of-truth dates +
// prices per the May 2026 pricing brief:
//
//   Early bird  ₹450  CLOSED (sold out)
//   Phase 1     ₹550  opens May 24
//   Phase 2     ₹600  opens May 26
//   Phase 3     ₹650  opens May 27
//
// Status is computed at render time from `opensAt` + today's date, so
// "live" auto-advances from Phase 1 → Phase 2 → Phase 3 without code
// changes. Early bird is `closedManually` because it ended on sell-out,
// not by date.
//
// Phase 3 keeps `wide: true` so on sm+ it spans the full bottom row,
// closing a clean 2×2 grid.
const TICKET_TIERS: TicketTier[] = [
  {
    label: 'Early bird',
    price: '₹450',
    bg: 'var(--c1)',
    color: 'var(--bg)',
    opensAt: null,
    closedManually: true,
  },
  {
    label: 'Phase 1',
    price: '₹550',
    bg: 'var(--c2)',
    color: 'var(--ink)',
    opensAt: '2026-05-24',
  },
  {
    label: 'Phase 2',
    price: '₹600',
    bg: 'var(--c3)',
    color: 'var(--ink)',
    opensAt: '2026-05-26',
  },
  {
    label: 'Phase 3',
    price: '₹650',
    bg: 'var(--ink)',
    color: 'var(--bg)',
    opensAt: '2026-05-27',
    wide: true,
  },
]

// Resolve each tier's live status from the current date. The "live" tier
// is the latest tier whose opensAt has passed AND that isn't manually
// closed. Earlier opened tiers become 'closed' (past, sold out into the
// next phase). Future tiers stay 'upcoming'.
function computeTierStatuses(tiers: TicketTier[]): ComputedStatus[] {
  // Paradox 2026's after-party has concluded — pin every tier to 'closed'.
  // The date-based logic this replaces marked the latest already-opened tier
  // 'live', and once every `opensAt` was in the past that stayed true forever —
  // which is the "spot entry shows open" bug. A concluded event has no live or
  // upcoming tiers, so the honest status is simply closed across the board.
  return tiers.map(() => 'closed')
}

// Pretty format for the open-date pill — "May 24" not "2026-05-24"
function formatOpenDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

const WHAT_TO_EXPECT = [
  '★ The Showstopper · 5–6 PM (talent showcase)',
  'DJ set + live performances',
  'photo booth & memories',
  'award ceremony for event winners',
  'networking with 200+ participants',
]

// On-the-night schedule — a small two-row strip that goes above the
// What-to-expect grid so attendees know the Showstopper happens early
// (5–6 PM) and the rest of the after-party flows from 6 PM onwards.
const NIGHT_OF_SCHEDULE: { time: string; what: string; accent: string }[] = [
  { time: '5 – 6 PM',  what: 'The Showstopper · talent showcase', accent: 'var(--c1)' },
  { time: '6 PM →',    what: 'DJ + dancefloor + award ceremony',   accent: 'var(--c2)' },
]

function Ticket({ tier, status }: { tier: TicketTier; status: ComputedStatus }) {
  const isInkBg = tier.bg === 'var(--ink)'
  const punchBg = isInkBg ? 'var(--bg)' : 'var(--ink)'
  const punchBorder = isInkBg ? 'var(--bg)' : 'var(--ink)'

  // Note + status badge text. Closed tiers get a strikethrough price +
  // dimmed card; live ones get a "LIVE NOW" pulse badge; upcoming ones
  // show their opens-at date.
  const noteText =
    status === 'closed' ? (tier.closedManually ? 'sold out' : 'closed — next phase live')
    : status === 'live' ? 'live now · grab a ticket'
    : tier.opensAt ? `opens ${formatOpenDate(tier.opensAt)}`
    : 'tba'

  const showLiveBadge = status === 'live'
  const isClosed = status === 'closed'

  return (
    <div style={{ position: 'relative', opacity: isClosed ? 0.5 : 1, transition: 'opacity 200ms var(--ease-out)' }}>
      {/* Ticket body */}
      <div
        style={{
          padding: '16px',
          borderRadius: '16px',
          border: `1.5px solid ${isInkBg ? 'var(--bg)' : 'var(--ink)'}`,
          position: 'relative',
          overflow: 'hidden',
          background: tier.bg,
          color: tier.color,
          boxShadow: isInkBg ? '3px 3px 0 var(--bg)' : '3px 3px 0 var(--ink)',
        }}
      >
        {/* Top punch hole */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '-10px',
            width: '20px',
            height: '20px',
            background: punchBg,
            borderRadius: '50%',
            border: `1.5px solid ${punchBorder}`,
            transform: 'translateX(-50%)',
            zIndex: 2,
          }}
        />
        {/* Bottom punch hole */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: '-10px',
            width: '20px',
            height: '20px',
            background: punchBg,
            borderRadius: '50%',
            border: `1.5px solid ${punchBorder}`,
            transform: 'translateX(-50%)',
            zIndex: 2,
          }}
        />

        {/* Live-now badge — only on the active tier. Pulses subtly to draw
            the eye to the open phase without yelling. */}
        {showLiveBadge && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={SPRING}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'var(--bg)',
              color: 'var(--ink)',
              fontFamily: 'var(--mono, ui-monospace)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              border: '1.5px solid var(--ink)',
              zIndex: 3,
              boxShadow: '2px 2px 0 var(--ink)',
            }}
          >
            ● Live
          </motion.div>
        )}

        <div
          className="font-mono tracking-[0.14em] uppercase"
          style={{ fontSize: '11px', opacity: 0.65 }}
        >
          {tier.label}
        </div>
        {/* Price in Boldonse — smaller clamp. Strikethrough when closed. */}
        <div
          className="font-display leading-[0.95] mt-2 tabular-nums"
          style={{
            fontSize: 'clamp(24px, 3.5vw, 34px)',
            textDecoration: isClosed ? 'line-through' : 'none',
            textDecorationThickness: '2px',
          }}
        >
          {tier.price}
        </div>
        <div
          className="font-mono tracking-[0.12em] uppercase mt-2"
          style={{ fontSize: '10px', opacity: 0.65 }}
        >
          {noteText}
        </div>
      </div>
    </div>
  )
}

// Site-setting key — must match the constant in Admin.tsx so the editor
// there and this consumer here read/write the same row.
const AFTERPARTY_PHASES_KEY = 'afterparty_phases'

// Visual style cycle for ticket cards. Admins can't edit colours from
// the admin tab — styling is derived by position so the card grid keeps
// its colour story no matter how many phases exist. Cycles
// red → yellow → purple → ink, repeating for 5+ phases.
const TIER_VISUALS: Array<{ bg: string; color: string }> = [
  { bg: 'var(--c1)', color: 'var(--bg)' },
  { bg: 'var(--c2)', color: 'var(--ink)' },
  { bg: 'var(--c3)', color: 'var(--ink)' },
  { bg: 'var(--ink)', color: 'var(--bg)' },
]

// Build the visual TICKET_TIERS shape from the admin-edited phase config.
//
// Iterates the DB array ITSELF (not a fixed 4-slot base) so that phases
// ADDED in the admin tab render publicly, phases REMOVED disappear, and
// custom keys (vip, late_release, …) all flow through. The earlier
// version mapped over a hardcoded 4-element base and matched by a fixed
// keyOrder — which silently dropped 5th+ phases and resurrected removed
// middle phases with stale hardcoded prices.
//
// Visual fields (bg/color/wide) are derived by index. The last tier gets
// `wide` so it spans the full bottom row and closes the grid.
function mergeAdminPhases(
  override: Array<{ key: string; label?: string; amount?: number; opensAt?: string | null; closedManually?: boolean }>,
): TicketTier[] {
  const rows = override.filter((o) => o && typeof o.key === 'string')
  if (rows.length === 0) return TICKET_TIERS
  return rows.map((ov, i) => {
    const visual = TIER_VISUALS[i % TIER_VISUALS.length]
    return {
      label: typeof ov.label === 'string' && ov.label.trim() ? ov.label : ov.key,
      price: Number.isFinite(ov.amount as number) ? `₹${ov.amount}` : '₹—',
      bg: visual.bg,
      color: visual.color,
      wide: i === rows.length - 1,
      opensAt: typeof ov.opensAt === 'string' ? ov.opensAt : null,
      closedManually: typeof ov.closedManually === 'boolean' ? ov.closedManually : false,
    }
  })
}

export function AfterPartyPage() {
  // Pull the WhatsApp invite from the admin-editable site setting so
  // every "Join WA" CTA on the page (hero, footer, sticky bar) points
  // at the same URL and updates the moment an admin rotates the
  // invite link in /paradox/admin → Settings.
  const waUrl = useWhatsAppGroup()

  // Live phase config from paradox_site_settings.afterparty_phases.
  // Falls back to the hardcoded TICKET_TIERS until the fetch lands —
  // so first paint never shows "tba" or wrong prices. Once the admin
  // override hits, prices/dates/closed-flag update without a deploy.
  const [tiers, setTiers] = useState<TicketTier[]>(TICKET_TIERS)
  useEffect(() => {
    let cancelled = false
    supabase
      .from('paradox_site_settings')
      .select('value')
      .eq('key', AFTERPARTY_PHASES_KEY)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data || !Array.isArray(data.value)) return
        setTiers(mergeAdminPhases(data.value as any[]))
      })
    return () => { cancelled = true }
  }, [])
  return (
    <div
      className="min-h-[100dvh]"
      style={{
        background: 'var(--bg)',
        position: 'relative',
        zIndex: 1,
        // Reserve room under the sticky "Join WhatsApp Group" CTA so it
        // doesn't obscure the bottom of the page when you scroll to the
        // end. Matches the EventDetail pattern (96px button + the
        // iPhone gesture-bar safe-area inset).
        paddingBottom: 'calc(96px + env(safe-area-inset-bottom))',
      }}
    >
      {/* ── Hero (ink bg) ── */}
      <motion.header
        variants={stagger(0.07)}
        initial="hidden"
        animate="show"
        className="border-b-[1.5px] border-ink pt-7 pb-6 sm:py-14 px-4 sm:px-8 lg:px-12"
        style={{ background: 'var(--ink)' }}
      >
        <div className="max-w-[1280px] mx-auto">
          <motion.div
            variants={fadeUp}
            className="font-mono text-[11px] tracking-[0.14em] uppercase opacity-70"
            style={{ color: 'var(--bg)' }}
          >
            /afterparty
          </motion.div>
          {/* "after party." in Boldonse c1 — clamped so it never overflows on mobile */}
          <motion.h1
            variants={fadeUp}
            className="font-display mt-2 leading-[0.92]"
            style={{
              fontSize: 'clamp(34px, 6vw, 66px)',
              letterSpacing: '-0.02em',
              textWrap: 'balance',
              color: 'var(--c1)',
            }}
          >
            after party.
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="font-body mt-3 text-[15px]"
            style={{ opacity: 0.7, color: 'var(--bg)', textWrap: 'pretty' } as React.CSSProperties}
          >
            celebrating 5 years of aquaterra.
          </motion.p>

          {/* Detail pills: gap-2 flex-wrap. Tight stagger so 4 pills don't
              drip in over half a second on slow mobile. */}
          <motion.div
            variants={stagger(0.05)}
            className="flex flex-wrap gap-2 mt-6"
          >
            {(() => {
              // Build the ticket pill dynamically from the current live phase
              // so the hero never goes stale as phases roll over. Uses the
              // live `tiers` state (admin-edited values) not the hardcoded
              // base, so price + date edits flow through to the hero too.
              const statuses = computeTierStatuses(tiers)
              const liveIdx = statuses.indexOf('live')
              const upcomingIdx = statuses.indexOf('upcoming')
              let ticketPill: string
              if (liveIdx >= 0) {
                const t = tiers[liveIdx]
                ticketPill = `${t.label} live · ${t.price}`
              } else if (upcomingIdx >= 0) {
                const t = tiers[upcomingIdx]
                ticketPill = t.opensAt
                  ? `${t.label} opens ${formatOpenDate(t.opensAt)}`
                  : `${t.label} opens soon`
              } else {
                ticketPill = 'tickets sold out'
              }
              return [
                { icon: '📅', text: 'June 6, 2026' },
                { icon: '🕐', text: '5:00 PM onwards' },
                { icon: '📍', text: '60, Chowringhee Banquets' },
                { icon: '🎟️', text: ticketPill },
              ]
            })().map((item) => (
              <motion.span
                key={item.text}
                variants={fadeUp}
                className="rounded-full border-[1.5px] border-ink px-4 py-2 font-mono tracking-[0.1em] uppercase flex items-center gap-2"
                style={{
                  fontSize: '11px',
                  background: 'var(--c2)',
                  color: 'var(--ink)',
                  boxShadow: '2px 2px 0 rgba(251,245,230,0.25)',
                }}
              >
                <span>{item.icon}</span>
                <span>{item.text}</span>
              </motion.span>
            ))}
          </motion.div>
        </div>
      </motion.header>

      {/* ── Run-of-show on the night ── */}
      <motion.section
        variants={stagger(0.07)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
        className="border-b-[1.5px] border-ink py-6 sm:py-12 px-4 sm:px-8 lg:px-12"
        style={{ background: 'var(--bg)', color: 'var(--ink)' }}
      >
        <div className="max-w-[1280px] mx-auto">
          <motion.div
            variants={fadeUp}
            className="font-mono text-[11px] tracking-[0.14em] uppercase opacity-55"
          >
            [ run of show · june 6 ]
          </motion.div>
          <motion.h2
            variants={fadeUp}
            className="font-display mt-2 mb-4 sm:mb-6"
            style={{
              fontSize: 'clamp(26px, 4.5vw, 44px)',
              letterSpacing: '-0.02em',
              textWrap: 'balance',
              lineHeight: 0.95,
            }}
          >
            the showstopper, then the dancefloor.
          </motion.h2>
          <motion.div variants={stagger(0.08)} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {NIGHT_OF_SCHEDULE.map((slot) => (
              <motion.div
                key={slot.time}
                variants={fadeUp}
                className="rounded-2xl border-[1.5px] border-ink p-4 sm:p-5"
                style={{
                  background: 'var(--bg)',
                  boxShadow: '3px 3px 0 var(--ink)',
                }}
              >
                <div
                  className="font-mono tabular-nums"
                  style={{
                    fontSize: 'clamp(15px, 2vw, 17px)',
                    fontWeight: 700,
                    color: slot.accent,
                    letterSpacing: '0.04em',
                  }}
                >
                  {slot.time}
                </div>
                <div
                  className="font-display mt-1"
                  style={{
                    fontSize: 'clamp(17px, 2.4vw, 22px)',
                    letterSpacing: '-0.01em',
                    lineHeight: 1.2,
                  }}
                >
                  {slot.what}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* ── What to expect ── */}
      <motion.section
        variants={stagger(0.07)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
        className="border-b-[1.5px] border-ink py-6 sm:py-14 px-4 sm:px-8 lg:px-12"
        style={{ background: 'var(--c2)', color: 'var(--ink)' }}
      >
        <div className="max-w-[1280px] mx-auto">
          <motion.div
            variants={fadeUp}
            className="font-mono text-[11px] tracking-[0.14em] uppercase opacity-70"
          >
            [ what to expect ]
          </motion.div>
          <motion.h2
            variants={fadeUp}
            className="font-display mt-2"
            style={{
              fontSize: 'clamp(28px, 5vw, 52px)',
              letterSpacing: '-0.02em',
              textWrap: 'balance',
            }}
          >
            a night to remember.
          </motion.h2>
          {/* Clean bullet-free list with dash prefix */}
          <motion.ul variants={stagger(0.07)} className="mt-4 sm:mt-6 space-y-2 sm:space-y-3 max-w-md">
            {WHAT_TO_EXPECT.map((item) => (
              <motion.li
                key={item}
                variants={fadeUp}
                className="font-body flex items-start gap-3"
                style={{ fontSize: '15px', lineHeight: 1.6, textWrap: 'pretty' } as React.CSSProperties}
              >
                <span
                  className="font-mono text-[13px] mt-0.5 shrink-0"
                  style={{ opacity: 0.5 }}
                >
                  —
                </span>
                <span>{item}</span>
              </motion.li>
            ))}
          </motion.ul>
        </div>
      </motion.section>

      {/* ── Ticket stack ── */}
      <motion.section
        variants={stagger(0.08)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
        className="border-b-[1.5px] border-ink py-6 sm:py-14 px-4 sm:px-8 lg:px-12"
        style={{ background: 'var(--ink)' }}
      >
        <div className="max-w-[1280px] mx-auto">
          <motion.div
            variants={fadeUp}
            className="font-mono text-[11px] tracking-[0.14em] uppercase opacity-70 mb-6"
            style={{ color: 'var(--bg)' }}
          >
            [ tickets ]
          </motion.div>

          {/* Full-width on mobile — 2-col on sm+ with "at the door" spanning full.
              Status is computed once for the whole list so all tiers share
              one Date() snapshot (no drift between cards). */}
          {(() => {
            const statuses = computeTierStatuses(tiers)
            return (
              <motion.div
                variants={stagger(0.07)}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                {tiers.map((tier, i) => (
                  <motion.div
                    key={tier.label}
                    variants={fadeUp}
                    whileHover={{ y: -4, transition: SPRING }}
                    className={tier.wide ? 'col-span-1 sm:col-span-2' : ''}
                  >
                    <Ticket tier={tier} status={statuses[i]} />
                  </motion.div>
                ))}
              </motion.div>
            )
          })()}

          <p className="font-hand text-[20px] text-center mt-4 opacity-75" style={{ transform: 'rotate(-1deg)' }}>see you there 🪩</p>
        </div>
      </motion.section>

      {/* ── CTA ── */}
      <motion.section
        variants={stagger(0.07)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
        className="py-6 sm:py-14 px-4 sm:px-8 lg:px-12"
        style={{ background: 'var(--bg)' }}
      >
        <div className="max-w-[1280px] mx-auto">
          <motion.div
            variants={fadeUp}
            className="font-mono text-[11px] tracking-[0.14em] uppercase opacity-70 mb-4"
          >
            [ get your spot ]
          </motion.div>

          {/* CTA stack — three buttons, full-width on mobile, row on sm+.
              Primary: Join WhatsApp Group (no ticket-purchase flow yet,
              so the WA group IS the funnel — buyers join and get
              payment details + venue updates there). Secondary:
              Register interest via contact form. Tertiary: plain email.
              The WA button uses the same #25D366 green established
              across Paradox (admin "Text on WA", contact page CTA,
              footer ticket modal). */}
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-2 mt-4">
            <motion.a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              whileTap={{ scale: 0.96 }}
              whileHover={{ y: -2, transition: SPRING }}
              transition={SPRING}
              className="rounded-full border-[1.5px] border-ink px-5 py-3 min-h-[48px] font-body font-semibold inline-flex items-center justify-center gap-2 w-full sm:w-auto"
              style={{
                background: '#25D366',
                color: '#0A0A0A',
                boxShadow: '4px 4px 0 var(--ink)',
              }}
            >
              <span aria-hidden>★</span>
              <span>Join WhatsApp Group →</span>
            </motion.a>
            <MotionLink
              to="/paradox/contact"
              whileTap={{ scale: 0.96 }}
              whileHover={{ y: -2, transition: SPRING }}
              transition={SPRING}
              className="rounded-full border-[1.5px] border-ink px-5 py-3 min-h-[48px] font-body font-semibold inline-flex items-center justify-center gap-2 w-full sm:w-auto"
              style={{
                background: 'var(--ink)',
                color: 'var(--bg)',
                boxShadow: '4px 4px 0 var(--c1)',
              }}
            >
              Register interest →
            </MotionLink>
            <motion.a
              href="mailto:ngo.aquaterra@gmail.com"
              whileTap={{ scale: 0.96 }}
              whileHover={{ y: -2, transition: SPRING }}
              transition={SPRING}
              className="rounded-full border-[1.5px] border-ink px-5 py-3 min-h-[48px] font-body font-semibold inline-flex items-center justify-center w-full sm:w-auto transition-[background-color,color]"
              style={{ background: 'transparent', color: 'var(--ink)' }}
            >
              email us instead
            </motion.a>
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="font-mono text-[11px] tracking-[0.14em] uppercase mt-4"
            style={{ opacity: 0.45 }}
          >
            join the group for payment details + venue updates
          </motion.div>
        </div>
      </motion.section>

      {/* ── Sticky "Join WhatsApp Group" CTA — always-visible primary
          action while you scroll. Same pattern as the EventDetail
          register button: pointer-events: none on the wrapper so only
          the pill itself catches clicks, leaving the rest of the
          viewport scrollable. Safe-area aware for the iPhone gesture
          bar. Outer page reserves padding above for it (see the root
          div's paddingBottom). */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 26, delay: 0.3 }}
        className="fixed left-0 right-0 z-40 px-4 sm:px-6 pointer-events-none"
        style={{ bottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        <motion.a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          whileTap={{ scale: 0.96 }}
          whileHover={{ y: -2 }}
          transition={SPRING}
          className="pointer-events-auto mx-auto rounded-full border-[1.5px] border-ink font-body font-semibold flex items-center justify-center gap-2 px-5 py-3.5"
          style={{
            background: '#25D366',
            color: '#0A0A0A',
            minHeight: '56px',
            maxWidth: 'min(420px, calc(100vw - 32px))',
            boxShadow: '4px 4px 0 var(--ink), 0 8px 28px rgba(0,0,0,0.18)',
            transitionProperty: 'transform, box-shadow',
            fontSize: 'clamp(14px, 3vw, 16px)',
          }}
          aria-label="Join the After Party WhatsApp Group for tickets + updates"
        >
          {/* WhatsApp glyph — matches the icon used on the Paradox Nav's
              "Join WhatsApp Group" pill so the two surfaces feel like
              the same button. */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ flexShrink: 0 }}>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          <span>Join WhatsApp Group</span>
          <span aria-hidden style={{ opacity: 0.65, fontSize: '0.85em' }}>→</span>
        </motion.a>
      </motion.div>
    </div>
  )
}
