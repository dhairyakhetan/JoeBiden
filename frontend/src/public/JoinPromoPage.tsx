// ──────────────────────────────────────────────────────────────────────────
// AquaTerra · /join - the PRE-APPLICATION promo (redesign section 27)
// Design reference: AQ Join Promo.dc.html, cards J1 to J5.
// ──────────────────────────────────────────────────────────────────────────
// THIS IS NOT ONBOARDING. It sells to a visitor who has NEVER applied and
// ends in START YOUR APPLICATION. The post-approval /welcome tour (section 28,
// `public/OnboardingPage.tsx`) was removed 2026-09-08 - do not reintroduce a
// second post-approval greeting screen that reuses this page's copy.
//
// Honesty is the hard constraint on this screen. A promo aimed at someone who
// has never applied is the easiest place in the product to overpromise, so
// every mechanic below is stated the way the code implements it:
//
//   • Every figure comes from `lib/orgFacts.ts`, `lib/departments.ts` or the
//     About page. Nothing on this screen is typed by hand.
//   • The CTA block (sticker, heading, sub-line, button label) is byte-for-byte
//     the About CTA, so a visitor arriving from either route reads the same
//     words and the two screens cannot drift.
//   • The three venture descriptions are byte-for-byte the "what AquaTerra
//     actually is" card on About, for the same reason.
//   • The certificate block states there is NO hour threshold, because there
//     is none in source. An earlier pass on this project invented a 50-hour
//     one, and this is the screen where that invention would do the most damage.
//
// Welfare points are NOT mentioned. The points system was retired from the
// product (decision 12, REDESIGN_FEATURE_REQUESTS.md) and `orgFacts` no longer
// exports POINTS_PER_ACTIVITY. The design canvas's points tile and its
// "one point per activity" mechanic line are deliberately absent; do not
// restore them from the canvas.
//
// Mounting: see `shouldAutoShowJoinPromo` at the bottom of this file. The page
// auto-shows to a first-time GUEST once, behind its own localStorage key, in
// the same pattern as HiStrip's `aq_hi_strip_v1`. It is never auto-shown to a
// signed-in member, a pending applicant or a rejected applicant, and it is NOT
// an interstitial in front of /login: someone who tapped a sign-in button has
// already decided.
// ──────────────────────────────────────────────────────────────────────────

import './JoinPromoPage.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useMeta } from '../hooks/useMeta'
import { I } from '../components/v6Shared'
import { Sticker } from '../components/Sticker'
import { Mascot } from '../components/Mascot'
import { onFillVar } from '../lib/onFill'
import { PUBLIC_DEPARTMENTS as DEPARTMENTS } from '../lib/departments'
import { APPROVAL_TIME, CERTIFICATE_WAIT_TIME } from '../lib/orgFacts'
import { capitalise, departmentsPhrase } from '../lib/orgFigures'
import { setAuthIntent } from '../lib/authIntent'
import { pageMetadata } from '../lib/metaConfig'

/**
 * The auto-show gate, same shape as HiStrip's `aq_hi_strip_v1`.
 * Versioned so a future re-launch of the promo can re-arm it deliberately.
 */
export const JOIN_PROMO_KEY = 'aq_join_promo_v1'

/** Has this browser already been shown (or already opened) the promo? */
export function joinPromoSeen(): boolean {
  try { return localStorage.getItem(JOIN_PROMO_KEY) === '1' } catch { return true }
}

/** Mark it seen. Safe in private mode: a failed write just means it may show again. */
export function markJoinPromoSeen(): void {
  try { localStorage.setItem(JOIN_PROMO_KEY, '1') } catch { /* private mode */ }
}

/**
 * The ONE place the "never auto-show to a member, a pending applicant or a
 * rejected applicant" rule is decided. Any surface that wants to auto-show the
 * promo calls this and nothing else, so the rule cannot be half-implemented in
 * one caller and forgotten in another.
 *
 * `member` is `useAuth().member`. Anyone with a members row - active, pending,
 * rejected or suspended - is excluded, and so is anyone with a live session
 * whose row has not resolved yet, because "we don't know who this is" must
 * never resolve to "sell them the thing they may already have applied for".
 * A pending applicant being sold what they are already waiting on is the worst
 * version of this screen.
 *
 * Reaching /join by link is ALWAYS allowed, for everyone. This gate only
 * decides the automatic, unrequested showing.
 */
export function shouldAutoShowJoinPromo(args: {
  isAuthenticated: boolean
  member: unknown | null
  isLoading?: boolean
}): boolean {
  if (args.isLoading) return false
  if (args.isAuthenticated) return false
  if (args.member) return false
  return !joinPromoSeen()
}

// ═══════════════════════════════════════════════════════════════════════════
// FROZEN COPY
// Every string below is quoted from another file in this repo. If one of them
// changes there, change it here in the same commit, or the two screens drift -
// which is the exact failure this section exists to prevent.
// ═══════════════════════════════════════════════════════════════════════════

/** The three ventures, VERBATIM from AboutPage's "what AquaTerra actually is"
 *  card. Only the labels are used to look the hue up; the copy is not touched.
 *  Hues come from `departments.ts` (Crftd pink, AQ.Ventures tomato, ShikshAQ
 *  lemon), never from CAT_COLORS: five category keys cannot serve eight teams. */
const VENTURES: { label: string; detail: string }[] = [
  { label: 'Crftd', detail: 'a student-run streetwear brand. profits fund NGO activities. members design, produce, and sell.' },
  { label: 'AQ.Ventures', detail: 'a free marketing agency built by AQ members, for student businesses. real clients, real work.' },
  { label: 'ShikshAQ', detail: 'a tuition discovery platform built by students, for students across Kolkata.' },
]

const deptHue = (name: string): string =>
  DEPARTMENTS.find(d => d.name === name)?.color ?? 'var(--ink-2)'

/** The label colour for a department hue, section 29 rule 5a. Human Resources
 *  sits on `--ink-2`, so its label takes paper; every other department hue
 *  takes solid ink. Never an alpha of ink: rgba(10,10,10,.6) on welfare green
 *  measures 2.79:1.
 *
 *  REDESIGN 2026-09: was a hand-written `=== 'var(--ink-2)'` test, which is
 *  correct today only because no department is currently painted `--pink-ink`
 *  or `--rust`. `onFillVar` measures instead of listing, so adding a ninth
 *  department on a dark hue cannot silently ship 3.42:1 text. */
const deptLabelColor = (color: string): string => onFillVar(color)

// ═══════════════════════════════════════════════════════════════════════════
// CARDS
// ═══════════════════════════════════════════════════════════════════════════

/** J1 - what you walk away with, on paper. */
function CardPaper() {
  return (
    <>
      <header className="jp-head">
        <span className="jp-count">01 / 03</span>
        <h2 className="jp-h2">IT COUNTS<br />ON PAPER.</h2>
        <p className="jp-lede">
          Every drive you turn up to is logged against your name, and you can ask for a
          certificate that says so.
        </p>
      </header>

      <div className="jp-blocks">
        <section className="jp-block">
          <h3 className="jp-block-h">the hours</h3>
          <p className="jp-block-body">
            Hours are logged by whoever runs the drive, so they are attendance, not an
            estimate. You do not fill them in yourself.
          </p>
        </section>

        <section className="jp-block jp-block-seal">
          {/* The one sticker on this screen. Rationed device, decoration only. */}
          <Sticker
            shape="rosette12"
            hue="lemon"
            rotate={-7}
            size={88}
            mark="ring"
            pin="tr"
            className="jp-seal"
          />
          <h3 className="jp-block-h">the certificate</h3>
          <p className="jp-block-body">
            You request it, a director issues it, and that takes {CERTIFICATE_WAIT_TIME}.
            There is no hour threshold to unlock, and nobody is going to chase you for one.
          </p>
        </section>
      </div>
    </>
  )
}

/** J2 - the eight departments, straight out of `lib/departments.ts`. */
function CardDepartments() {
  return (
    <>
      <header className="jp-head">
        <span className="jp-count">02 / 03</span>
        <h2 className="jp-h2">PICK YOUR<br />PEOPLE.</h2>
        <p className="jp-lede">
          {capitalise(departmentsPhrase(DEPARTMENTS.length))}. You join one, you can work with any of them, and you are not
          stuck with the first choice you make.
        </p>
      </header>

      <ul className="jp-depts">
        {DEPARTMENTS.map(d => (
          <li
            key={d.name}
            className="jp-dept"
            style={{ background: d.color, color: deptLabelColor(d.color) }}
          >
            <span className="jp-dept-name">{d.name}</span>
          </li>
        ))}
      </ul>

      <p className="jp-note">
        this is not a form. nothing on this screen is a choice you are making yet.
      </p>
    </>
  )
}

/** J3 - the three ventures. Hue is the TITLE BAND only; the description sits on
 *  white. On About this copy renders as --ink-2 on a light surface, and moving
 *  inherited body copy onto a saturated fill would make it less legible than
 *  the page it was lifted from. Applied to all three, so the family matches.
 *
 *  [FIX] This comment used to say "solid ink at 12.5px on Crftd pink measures
 *  3.42:1". It does not. Crftd's department colour is `--pink` #FF4D8C, which
 *  measures 6.31:1 with ink. 3.42:1 belongs to `--pink-ink` #C4185C, a
 *  different token that no department carries. The band's own colour has
 *  always been correct; only the reason written beside it was wrong. */
function CardVentures() {
  return (
    <>
      <header className="jp-head">
        <span className="jp-count">03 / 03</span>
        <h2 className="jp-h2">A BRAND.<br />AN AGENCY.<br />A PLATFORM.</h2>
        <p className="jp-lede">
          Three real businesses run by students. If drives are not your thing, this is the
          other half of the ecosystem.
        </p>
      </header>

      <div className="jp-ventures">
        {VENTURES.map(v => (
          <article key={v.label} className="jp-venture">
            <div
              className="jp-venture-band"
              style={{ background: deptHue(v.label), color: deptLabelColor(deptHue(v.label)) }}
            >
              <h3 className="jp-venture-name">{v.label}</h3>
            </div>
            <p className="jp-venture-detail">{v.detail}</p>
          </article>
        ))}
      </div>
    </>
  )
}

/**
 * J4 - the ask. The sticker line, the heading, the sub-line and the button
 * label are the existing About CTA, verbatim. APPROVAL_TIME is interpolated
 * twice on this card and imported both times.
 */
function CardAsk({ onApply, onBrowse }: { onApply: () => void; onBrowse: () => void }) {
  return (
    <div className="jp-ask">
      <div className="jp-ask-inner">
        {/* Eina 800, not NeutralFace: the frozen string is lowercase and
            NeutralFace has no lowercase glyphs. */}
        <span className="jp-ask-pill">★ free. always.</span>
        <h2 className="jp-ask-h">
          come <em>build</em><br />with us.
        </h2>
        <p className="jp-ask-sub">
          Two minutes to apply. We usually reply {APPROVAL_TIME}. No fees, ever.
        </p>

        <section className="jp-steps" aria-labelledby="jp-steps-h">
          <h3 className="jp-steps-h" id="jp-steps-h">what happens next</h3>
          <ol className="jp-steps-list">
            <li className="jp-step">
              <span className="jp-step-n" aria-hidden>1</span>
              <span>Sign in with Google. That <b>is</b> the sign-up, there is no separate form.</span>
            </li>
            <li className="jp-step">
              <span className="jp-step-n" aria-hidden>2</span>
              <span>A director reads it. Usually <b>{APPROVAL_TIME}</b>.</span>
            </li>
            <li className="jp-step">
              <span className="jp-step-n" aria-hidden>3</span>
              <span>You are in, and you pick a department then.</span>
            </li>
          </ol>
        </section>

        <div className="jp-ask-actions">
          <button type="button" className="btn btn-lg btn-primary jp-cta" onClick={onApply}>
            <I.rocket /> START YOUR APPLICATION
          </button>
          {/* The funnel already lets a guest read the feed. Pretending otherwise
              would be the one dishonest thing on this screen. */}
          <button type="button" className="btn jp-cta-2" onClick={onBrowse}>
            look around first
          </button>
        </div>

        <Mascot character="nolen" pose="cheer" size={64} className="jp-ask-mascot" />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════

const PROMO_CARDS = [CardPaper, CardDepartments, CardVentures]
/** Three promo cards, so three segments. NEVER a fake fourth for the CTA. */
const SEGMENTS = PROMO_CARDS.length
const ASK_INDEX = SEGMENTS // index 3 is the CTA card, which has no segment

const slide = {
  enter: (dir: number) => ({ transform: `translateX(${dir > 0 ? 40 : -40}px)`, opacity: 0 }),
  center: { transform: 'translateX(0px)', opacity: 1 },
  exit: (dir: number) => ({ transform: `translateX(${dir > 0 ? -40 : 40}px)`, opacity: 0 }),
}

export default function JoinPromoPage() {
  useMeta(pageMetadata.join)

  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState(1)

  // Opening the promo counts as having seen it, however you got here. A visitor
  // who followed the link should not then be auto-shown it on their next visit.
  useEffect(() => { markJoinPromoSeen() }, [])

  const go = useCallback((next: number) => {
    setDir(next > index ? 1 : -1)
    setIndex(Math.max(0, Math.min(ASK_INDEX, next)))
  }, [index])

  const onApply = useCallback(() => { setAuthIntent({ kind: 'apply' }); navigate('/login') }, [navigate])
  const onBrowse = useCallback(() => navigate('/'), [navigate])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, index])

  // Swipe. Horizontal only, 48px threshold, and it bails the moment the gesture
  // looks vertical so it never fights the page scroll.
  const touch = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0]
    touch.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current
    touch.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return
    go(dx < 0 ? index + 1 : index - 1)
  }

  const onAsk = index === ASK_INDEX
  const Card = onAsk ? null : PROMO_CARDS[index]
  // Skip is spent, not gone, on the last promo card: the affordance stays in
  // place and greys, rather than moving the row's contents under the thumb.
  const skipSpent = index === SEGMENTS - 1

  return (
    <div className="jp-root route-enter">
      <div className="container jp-shell">
        <header className="jp-page-head">
          <span className="jp-eyebrow">★ never applied? start here</span>
          <h1 className="jp-h1">why join AquaTerra.</h1>
        </header>

        {/* Progress + skip. Hidden on the ask, which is not a promo card. */}
        {!onAsk && (
          <div className="jp-bar">
            <div
              className="jp-segs"
              role="progressbar"
              aria-label="Promo progress"
              aria-valuemin={1}
              aria-valuemax={SEGMENTS}
              aria-valuenow={index + 1}
              aria-valuetext={`Card ${index + 1} of ${SEGMENTS}`}
            >
              {Array.from({ length: SEGMENTS }).map((_, i) => (
                <span key={i} className="jp-seg" data-on={i <= index || undefined} />
              ))}
            </div>
            <button
              type="button"
              className="jp-skip"
              onClick={() => go(ASK_INDEX)}
              disabled={skipSpent}
              aria-label="Skip to the application"
            >
              skip
            </button>
          </div>
        )}

        <div className="jp-stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={index}
              className="jp-card"
              custom={dir}
              variants={reduceMotion ? undefined : slide}
              initial={reduceMotion ? false : 'enter'}
              animate={reduceMotion ? { opacity: 1 } : 'center'}
              exit={reduceMotion ? { opacity: 0 } : 'exit'}
              transition={{ type: 'spring', stiffness: 300, damping: 30, bounce: 0, opacity: { duration: 0.18 } }}
            >
              {Card ? <Card /> : <CardAsk onApply={onApply} onBrowse={onBrowse} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {!onAsk && (
          <div className="jp-foot">
            <button
              type="button"
              className="btn jp-back"
              onClick={() => go(index - 1)}
              disabled={index === 0}
            >
              back
            </button>
            <button
              type="button"
              className="btn btn-primary jp-next"
              onClick={() => go(index + 1)}
            >
              {skipSpent ? 'how do I join?' : 'next'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
