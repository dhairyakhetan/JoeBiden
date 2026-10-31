import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import type { PublicEvent, SportSlug } from '../lib/types'
import { EVENT } from '../config'
import { rupees, dayRange} from '../lib/format'
import { fireConfetti } from '../lib/confetti'
import { playSuccess, stopSound } from '../lib/sound'
import { downloadIcs } from '../lib/ics'

/**
 * The signature moment of the site. PRD 6.5.
 *
 * Plays once per successful submission, caps at 3.2 seconds, and skips on tap
 * or Escape. Under reduced motion the choreography is skipped entirely, the
 * confetti degrades to a single static burst, and the card renders immediately.
 *
 * The stamp word per sport is the whole joke: SIX for cricket, DINK for
 * pickleball, GOAL for FIFA.
 */
const STAMP: Record<SportSlug, string> = { cricket: 'SIX!', pickleball: 'DINK!', fifa: 'GOAL!' }

function Choreography({ sport, onDone }: { sport: SportSlug; onDone: () => void }) {
  const reduce = useReducedMotion()

  useEffect(() => {
    if (reduce) { onDone(); return }
    const t = window.setTimeout(onDone, 2400)
    const skip = () => { window.clearTimeout(t); onDone() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') skip() }
    window.addEventListener('pointerdown', skip)
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', onKey)
    }
  }, [reduce, onDone])

  if (reduce) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 55, display: 'grid', placeItems: 'center',
        background: 'rgba(10,10,10,0.42)', pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      {/* Lights flash at 1100ms, all three sports */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 0.5, 0] }}
        transition={{ duration: 1.5, times: [0, 0.72, 0.8, 1] }}
        style={{ position: 'absolute', inset: 0, background: 'var(--lemon, #FFC700)' }}
      />

      {/* The travelling object: bat-and-ball, paddle-drop, or a rolling ball */}
      {sport === 'cricket' && (
        <>
          <motion.div
            initial={{ x: -260, y: 60, rotate: -70, opacity: 0 }}
            animate={{ x: -40, y: 20, rotate: 20, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.25, ease: 'easeOut' }}
            style={{ position: 'absolute', fontSize: 64 }}
          >
            <svg width="86" height="86" viewBox="0 0 24 24" fill="none" stroke="var(--bg, #F4EFE0)" strokeWidth="1.5" strokeLinecap="round">
              <path d="M17.2 1.8a2.4 2.4 0 0 1 3.4 0l1.6 1.6a2.4 2.4 0 0 1 0 3.4l-1.4 1.4-5-5Z" />
              <path d="M16.6 7.4 6.2 17.8a3 3 0 0 0-.8 1.5L4.5 23l3.7-.9a3 3 0 0 0 1.5-.8L20.1 10.9Z" />
            </svg>
          </motion.div>
          <motion.div
            initial={{ x: -20, y: 40, opacity: 0, scale: 0.7 }}
            animate={{ x: 220, y: -180, opacity: [0, 1, 1, 0], scale: 1 }}
            transition={{ delay: 0.45, duration: 0.85, ease: 'easeOut' }}
            style={{ position: 'absolute' }}
          >
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#A32B1C', boxShadow: '-30px 26px 0 -9px rgba(163,43,28,0.35), -60px 52px 0 -13px rgba(163,43,28,0.18)' }} />
          </motion.div>
        </>
      )}

      {sport === 'pickleball' && (
        <>
          <motion.div
            initial={{ y: -240, rotate: -20, opacity: 0 }}
            animate={{ y: 40, rotate: 8, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.45, type: 'spring', stiffness: 160, damping: 12 }}
            style={{ position: 'absolute', marginLeft: -90 }}
          >
            <svg width="78" height="78" viewBox="0 0 24 24" fill="none" stroke="var(--bg, #F4EFE0)" strokeWidth="1.5" strokeLinecap="round">
              <ellipse cx="11" cy="9.5" rx="7" ry="8" />
              <path d="M11 17.5v2.3a2.2 2.2 0 0 0 2.2 2.2h1.4" />
            </svg>
          </motion.div>
          <motion.div
            initial={{ y: -220, x: 60, opacity: 0 }}
            animate={{ y: [-220, 40, -60, 40, -20, 44], opacity: 1 }}
            transition={{ delay: 0.2, duration: 1.1, times: [0, 0.34, 0.54, 0.74, 0.88, 1], ease: 'easeOut' }}
            style={{ position: 'absolute' }}
          >
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--lemon, #FFC700)' }} />
          </motion.div>
        </>
      )}

      {sport === 'fifa' && (
        <motion.div
          initial={{ x: -280, y: 80, rotate: 0, opacity: 0 }}
          animate={{ x: 0, y: -30, rotate: 720, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.75, ease: 'easeOut' }}
          style={{ position: 'absolute' }}
        >
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--bg, #F4EFE0)" strokeWidth="1.5">
            <circle cx="12" cy="12" r="8.5" fill="var(--bg, #F4EFE0)" fillOpacity="0.95" />
            <path d="M12 7.2 15.4 9.7 14.1 13.8H9.9L8.6 9.7Z" fill="#0A0A0A" stroke="none" />
          </svg>
        </motion.div>
      )}

      {/* The stamp lands at 900ms */}
      <motion.div
        initial={{ scale: 1.4, opacity: 0, rotate: -7 }}
        animate={{ scale: 1, opacity: 1, rotate: -4 }}
        transition={{ delay: 0.9, duration: 0.22, ease: 'backOut' }}
        style={{
          position: 'relative',
          fontFamily: 'var(--tt-display)', fontSize: 'clamp(64px, 18vw, 150px)',
          color: 'var(--lemon, #FFC700)', lineHeight: 1, letterSpacing: '0.02em',
          textShadow: '6px 6px 0 #0A0A0A',
        }}
      >
        {STAMP[sport]}
      </motion.div>
    </motion.div>
  )
}

/**
 * A self-drawing checkmark in a green disc, the poster's confirmation glyph.
 * The stroke draws once the card is up; under reduced motion it renders
 * solid immediately rather than animating.
 */
function CheckDisc({ reduce }: { reduce: boolean }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 72, height: 72, borderRadius: '50%', background: 'var(--tt-go)',
        display: 'grid', placeItems: 'center', flex: '0 0 auto',
        boxShadow: '0 0 0 3px var(--tt-line)',
      }}
    >
      <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
        <motion.path
          d="M4 12.5 9.5 18 20 6.5"
          stroke="#062B18"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={reduce ? { duration: 0 } : { delay: 0.15, duration: 0.5, ease: 'easeOut' }}
        />
      </svg>
    </div>
  )
}

interface Props {
  sport: SportSlug
  event: PublicEvent
  refCode: string
  waitlisted: boolean
  firstName: string
}

export function SuccessMoment({ sport, event, refCode, waitlisted, firstName }: Props) {
  const reduce = useReducedMotion()
  const [showCard, setShowCard] = useState(false)
  const fired = useRef(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Confetti and sound fire once, on mount, for every successful registration,
  // waitlist included. Being 25th in the queue is still a person who just
  // committed to turning up.
  useEffect(() => {
    if (fired.current) return
    fired.current = true
    const stop = fireConfetti(sport, !!reduce)
    playSuccess(sport)
    // The cheer runs four seconds. If they navigate away inside that window it
    // must not keep playing over whatever they opened next.
    return () => { stop(); stopSound() }
  }, [sport, reduce])

  // Hand focus to the heading once the card is actually up, so the screen
  // announces itself. Waiting for showCard rather than doing this on mount is
  // deliberate: the choreography runs first and the card is pointerEvents:none
  // until it finishes, so focusing earlier would put focus on something the
  // page does not yet consider live.
  useEffect(() => {
    if (showCard) headingRef.current?.focus()
  }, [showCard])
  // refCode is not shown anywhere on this screen any more (it is a back-office lookup value,
  // not something a participant needs to hold onto). It still flows through to downloadIcs()
  // below, which is the one remaining place it leaves this component.
  const shareText = `I just registered for TerraThon ${event.display_name} with Team AquaTerra\n${EVENT.tagline}\nRegister: ${window.location.origin}${EVENT.base}/register/${sport}`

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ text: shareText })
      else window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener')
    } catch {
      // A cancelled share sheet rejects. Not an error worth surfacing.
    }
  }

  return (
    <>
      {!showCard && <Choreography sport={sport} onDone={() => setShowCard(true)} />}

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 28 }}
        animate={showCard ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
        transition={{ duration: reduce ? 0 : 0.45, ease: [0.2, 0.8, 0.2, 1] }}
        style={{ display: 'grid', gap: 18, pointerEvents: showCard ? 'auto' : 'none' }}
      >
        <div className="tt-card" style={{ display: 'grid', gap: 14, textAlign: 'center', justifyItems: 'center' }}>
          <CheckDisc reduce={!!reduce} />
          <span className="tt-kick">{waitlisted ? 'Waitlisted' : "Done · nothing left to do"}</span>
          {/* tabIndex -1 plus the focus in the effect above is what makes this
              screen exist for a screen reader at all.
              Register.tsx swaps the whole <form> out for this component on
              success, so the submit button that had focus is removed from the
              DOM and the browser drops focus to <body>. Scrolling to the top,
              which is all that used to happen, moves nothing a screen reader
              tracks, so the most important moment on the public site was
              completely silent: no confirmation, no heading, nothing without
              re-exploring the page by hand.
              outline: none is deliberate here and is not the same mistake as
              stripping it from an input. Nobody tabbed to this heading; focus
              was moved programmatically to make it speak, so a visible ring
              would only be confusing. */}
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="tt-h1-poster"
            style={{ textTransform: 'uppercase', outline: 'none' }}
          >
            {waitlisted ? 'Slots are full.' : "You're in"}
          </h1>
          <p style={{ margin: 0, maxWidth: 520, fontSize: 'var(--tt-fs-lead)', lineHeight: 1.6, color: 'var(--tt-muted)' }}>
            {waitlisted
              ? "Don't pay yet. We'll WhatsApp you the moment a slot opens."
              : firstName
                ? `You're on the list, ${firstName}. Thank you for filling in your details.`
                : "You're on the list. Thank you for filling in your details."}
          </p>
        </div>

        {/* No pay card, no UPI ID, no QR, no "send the screenshot".
            ──────────────────────────────────────────────────────────────────
            All of that used to live here and it has gone on the event
            director's instruction: nobody pays on this screen any more. The
            team reaches out with the QR code, so the only thing this page owes
            someone is the knowledge that a message is coming. Everything else
            was a set of instructions for a payment that has not been asked
            for yet.

            This panel goes on the poster's cream surface (rather than the
            standard dark card) so it reads as the one thing on the screen
            that actually matters: something is coming, and here is what it
            is. The colour flip is local to this component, scoped in the
            <style> block below, the same override pattern terrathon.css
            already uses for .tt-listing .tt-card. */}
        {!waitlisted && (
          <section className="tt-plate" style={{ display: 'grid', gap: 10 }}>
            <h2 className="tt-poster-line" style={{ fontSize: 24 }}>What happens next</h2>
            <p style={{ margin: 0, fontSize: 'var(--tt-fs-lead)', lineHeight: 1.6 }}>
              Our team will reach out to you shortly with the payment QR code so you can process
              your registration.
            </p>
          </section>
        )}

        <section className="tt-card" style={{ display: 'grid', gap: 12 }}>
          {waitlisted && (
            <>
              <h2 className="tt-poster-line" style={{ fontSize: 24 }}>What happens next</h2>
              <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 10 }}>
                {[
                  'Sit tight. You are in the queue in the order you registered.',
                  'If a slot frees up, we WhatsApp you.',
                  'Nothing to pay unless and until you hear from us.',
                ].map((step, i) => (
                  <li key={i} style={{ fontSize: 'var(--tt-fs-body)', lineHeight: 1.6, color: 'var(--tt-muted)' }}>{step}</li>
                ))}
              </ol>
            </>
          )}
          <div style={{ fontFamily: 'var(--tt-code)', fontSize: 'var(--tt-fs-body)', color: 'var(--tt-muted)' }}>
            {event.display_name} &middot; {dayRange(event.day_first, event.day_last)}
            {event.venue ? ` · ${event.venue}` : ''}
            {!waitlisted && ` · ${rupees(event.fee_inr)}`}
          </div>
        </section>

        {/* "While you wait", mirroring the board's three-card row. Each links
            to a route that genuinely exists on the site; nothing invented. */}
        <section aria-label="While you wait" style={{ display: 'grid', gap: 10 }}>
          <span className="tt-kick">While you wait</span>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <Link to={`${EVENT.base}/rules`} className="tt-card" style={{ display: 'grid', gap: 6 }}>
              <span className="tt-poster-line" style={{ fontSize: 17 }}>Read the rules</span>
              <span style={{ fontSize: 'var(--tt-fs-body)', lineHeight: 1.5, color: 'var(--tt-muted)' }}>Especially the age one.</span>
            </Link>
            <Link to={`${EVENT.base}/schedule`} className="tt-card" style={{ display: 'grid', gap: 6 }}>
              <span className="tt-poster-line" style={{ fontSize: 17 }}>Check the times</span>
              <span style={{ fontSize: 'var(--tt-fs-body)', lineHeight: 1.5, color: 'var(--tt-muted)' }}>Report time is not kick-off.</span>
            </Link>
            <Link to={`${EVENT.base}/contact`} className="tt-card" style={{ display: 'grid', gap: 6, borderColor: 'var(--tt-go)' }}>
              <span className="tt-poster-line" style={{ fontSize: 17 }}>Heard nothing?</span>
              <span style={{ fontSize: 'var(--tt-fs-body)', lineHeight: 1.5, color: 'var(--tt-muted)' }}>Chase us, don't assume.</span>
            </Link>
          </div>
        </section>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {event.day_first && (
            <button type="button" className="tt-btn tt-btn--quiet" onClick={() => downloadIcs(event, refCode)}>
              Add to calendar
            </button>
          )}
          <button type="button" className="tt-btn tt-btn--quiet" onClick={share}>Share</button>
          <Link to={EVENT.base} className="tt-btn tt-btn--quiet">Register for another sport</Link>
        </div>
      </motion.div>
    </>
  )
}
