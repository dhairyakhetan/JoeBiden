import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { fadeInUp } from '../../lib/motion'
import type { PublicEvent, SportSlug } from '../lib/types'
import { EVENT, SPORT_COPY } from '../config'
import { rupees, dayRange, squadLabel } from '../lib/format'

/**
 * One sport, as a listing card, poster style.
 *
 *   ┌──────────────────────────────┐
 *   │  Filling fast (sticker, top-right corner)
 *   │                               │
 *   │        [torn-paper sticker]   │  large, centred on the dark ground
 *   │                               │
 *   │           CRICKET             │  Bungee display name
 *   │   Sat, 3 Oct + Sun, 4 Oct · 7+1 │  green meta line
 *   │  ┌────────────┐ ┌────────────┐│
 *   │  │ Entry  ₹2,400│ │ Prize  ₹9,000││  two blocks side by side
 *   │  └────────────┘ └────────────┘│
 *   │  ┌──────────────────────────┐ │
 *   │  │      ENTER CRICKET       │ │  full-width action button
 *   │  └──────────────────────────┘ │
 *   └──────────────────────────────┘
 *
 * The illustrated tile / StadiumScene pair that used to sit here is gone.
 * The campaign ships torn-paper sticker art per sport (`/terrathon/*.webp`),
 * so the card's job is just to frame it.
 */

const STICKER: Record<SportSlug, string> = {
  cricket: '/terrathon/cricket.webp',
  pickleball: '/terrathon/paddle.webp',
  fifa: '/terrathon/controller.webp',
}

export function SportCard({ event, index = 0 }: { event: PublicEvent; index?: number }) {
  const reduce = useReducedMotion()
  const solo = event.team_size_max === 1

  const squad = squadLabel(event)

  const meta: Array<[string, string]> = [
    ['Entry', `${rupees(event.fee_inr)} ${solo ? '/ player' : '/ team'}`],
    ['Prize pool', rupees(event.prize_pool_inr)],
  ]

  return (
    <motion.article
      className="tt-card tt-sportcard"
      // `animate`, NOT `whileInView`. Below 860px these cards live in a
      // horizontal scroll rail, and the third one starts outside the viewport.
      // With whileInView it never became visible: swiping to FIFA showed a
      // blank card. Verified, not guessed: an IntersectionObserver reported
      // the card at ratio 1.0, fully on screen, while framer-motion still held
      // it at opacity 0, because its own observer does not re-fire for an
      // element brought in by container scroll rather than page scroll.
      // Never gate whether content is visible at all on a scroll observer.
      initial={reduce ? false : fadeInUp.hidden}
      animate={fadeInUp.visible}
      transition={{ duration: 0.28, ease: [0.2, 0, 0, 1], delay: reduce ? 0 : index * 0.06 }}
      style={{
        position: 'relative',
        padding: '18px 16px 16px',
        display: 'flex', flexDirection: 'column', gap: 12,
        minWidth: 0,
        overflow: 'visible',
      }}
    >
      {/* Status, rotated over the top-right corner. */}
      <div style={{ position: 'absolute', top: -11, right: 10, zIndex: 2 }}>
        {!event.accepting
          ? <span className="tt-sticker" style={{ background: '#0A0A0A', color: 'var(--tt-ink, #F2EFE3)' }}>Closed</span>
          : event.filling_fast
            ? <span className="tt-sticker tt-sticker--hot">Filling fast</span>
            : <span className="tt-sticker tt-sticker--go">Open</span>}
      </div>

      {/* The sticker, large and centred on the card's dark ground. Decorative
          next to the sport name below it, so alt="" rather than a repeat of
          the name. width/height are set so the card does not shift while the
          image loads; the aspect ratio is real (every sticker is a 1:1 webp),
          the on-screen size is controlled by CSS. */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--tt-paper-2, #0E1019)',
          borderRadius: 'var(--tt-r-in)',
          padding: '18px 12px',
        }}
      >
        <img
          src={STICKER[event.slug]}
          alt=""
          width={800}
          height={800}
          loading="lazy"
          decoding="async"
          style={{ width: '62%', maxWidth: 220, height: 'auto', display: 'block' }}
        />
      </div>

      {/* Sport name, Bungee, and the green meta line under it. */}
      <div style={{ textAlign: 'center' }}>
        <h3
          style={{
            margin: 0,
            fontFamily: 'var(--tt-poster)',
            textTransform: 'uppercase',
            fontSize: 'clamp(22px, 5vw, 30px)',
            lineHeight: 1.05,
            color: 'var(--tt-ink, #F2EFE3)',
          }}
        >
          {event.display_name}
        </h3>
        <p
          className="tt-code"
          style={{
            margin: '6px 0 0',
            fontSize: 'var(--tt-fs-meta)',
            color: 'var(--tt-go, #24CB7E)',
          }}
        >
          {dayRange(event.day_first, event.day_last)} · {squad} · {SPORT_COPY[event.slug].subtitle}
        </p>
      </div>

      {/* Entry fee and prize pool, two small blocks side by side. */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {meta.map(([k, v]) => (
          <div
            key={k}
            style={{
              border: '1px solid var(--tt-line, rgba(221,108,238,0.55))',
              borderRadius: 'var(--tt-r-in)',
              padding: '8px 10px',
              display: 'flex', flexDirection: 'column', gap: 2,
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--tt-display)', fontWeight: 700, fontSize: 'var(--tt-fs-meta)',
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'var(--tt-ink-3, rgba(242,239,227,0.68))',
              }}
            >
              {k}
            </span>
            {/* Wraps rather than truncating. An ellipsis here hid the end of the
                fee, which at 320px turned "Rs 2,400 / team" into "Rs 2,40..."
                and cut the one number on the card that decides whether someone
                enters. A second line costs less than a hidden price. */}
            <span className="tt-code" style={{ fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-ink, #F2EFE3)', overflowWrap: 'anywhere' }}>
              {v}
            </span>
          </div>
        ))}
      </div>

      {/* Full-width action. DETAILS still exists as the quiet route to the
          sport's own page; the ask is the pill underneath it. */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Link
          to={`${EVENT.base}/${event.slug}`}
          className="tt-hit"
          style={{
            alignSelf: 'center',
            fontFamily: 'var(--tt-display)', fontWeight: 700, fontSize: 'var(--tt-fs-meta)',
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'var(--tt-ink-3, rgba(242,239,227,0.68))', textDecoration: 'none',
          }}
        >
          Details
        </Link>
        {event.accepting ? (
          <Link
            to={`${EVENT.base}/register/${event.slug}`}
            className="tt-btn"
            style={{ width: '100%', minHeight: 46 }}
          >
            Enter {event.display_name}
          </Link>
        ) : (
          <button type="button" className="tt-btn" disabled style={{ width: '100%', minHeight: 46 }}>
            Closed
          </button>
        )}
      </div>
    </motion.article>
  )
}
