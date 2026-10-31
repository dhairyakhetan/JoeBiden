import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { EVENT, CONTACTS } from '../config'
import { prettyPhone, waNumber } from '../lib/format'
import { WhatsAppMark, InstagramMark, PhoneMark, MailMark } from '../components/BrandMarks'
import { TerraThonFaq } from '../components/Faq'
import { StarStickers } from '../components/StarStickers'
import { fadeInUp } from '../../lib/motion'

/**
 * "Ask a human", built off the approved Contact board.
 *
 * The board draws three route cards (WhatsApp / email / the org), with
 * WhatsApp as the one primary green card and the rest resting on the orchid
 * outline. Real data only gives two named, reachable people (see
 * `CONTACTS` in config.ts), so each becomes its own WhatsApp-first card
 * rather than inventing a single "the desk" number nobody actually answers.
 * A quiet "Call" link sits under the WhatsApp button for the same contact,
 * since a phone call is still the fastest path for someone who cannot use
 * WhatsApp. Email and the AquaTerra org link follow as the two resting cards,
 * matching the board's orchid-outline treatment.
 */
export function TerraThonContact() {
  const reachable = CONTACTS.filter((c) => c.phone)
  const [copied, setCopied] = useState(false)
  const reduce = useReducedMotion()

  // A mailto is the right default and a dead end on its own: on a shared school
  // desktop with no mail client configured, tapping it opens nothing and the
  // address cannot be selected cleanly out of a link. Offer both.
  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(EVENT.email)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // Blocked in some in-app browsers. The address is on screen and the
      // mailto still works, so this is a degraded path, not a failure.
    }
  }

  return (
    <div className="tt-wrap tt-page">
      {/* See Rules.tsx: the relative wrapper is what the absolutely positioned
          stickers anchor to. */}
      <div style={{ position: 'relative', isolation: 'isolate' }}>
        <StarStickers />
        <span className="tt-kick">TerraThon 2026</span>
        <h1 className="tt-h1-poster" style={{ marginTop: 10 }}>Ask a human</h1>
        <p style={{ margin: '18px 0 0', maxWidth: 640, fontSize: 'var(--tt-fs-lead)', lineHeight: 1.6, color: 'var(--tt-muted)' }}>
          We are students running this between classes, so give us a day. Everything below goes
          to a person, not an inbox nobody opens.
        </p>
      </div>

      {/* Route cards. `auto-fill`, not `auto-fit`: auto-fit collapses empty
          tracks to zero and stretches a lone card across the whole page. */}
      <div
        style={{
          display: 'grid', gap: 14,
          /* 320, not 260. A contact card carries a name and a full phone
             number on one line, which measures about 309px; a 260 track gave
             it 256 and clipped. */
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
          marginTop: 'var(--tt-block)',
        }}
      >
        {reachable.map((c, i) => (
          <motion.div
            key={c.name}
            className="tt-card"
            initial={reduce ? false : fadeInUp.hidden}
            whileInView={fadeInUp.visible}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.28, ease: [0.2, 0, 0, 1], delay: reduce ? 0 : i * 0.06 }}
            style={{
              display: 'flex', flexDirection: 'column', gap: 10,
              borderColor: i === 0 ? 'var(--tt-go)' : undefined,
              background: i === 0 ? 'rgba(36, 203, 126, 0.10)' : undefined,
            }}
          >
            <span
              className="tt-kicker"
              style={{ color: i === 0 ? 'var(--tt-go-ink)' : 'var(--tt-ink-3)' }}
            >
              {i === 0 ? 'Fastest' : 'Also reachable'}
            </span>
            <div className="tt-poster-line" style={{ fontSize: 22 }}>{c.name}</div>
            <div className="tt-num" style={{ fontSize: 18, color: 'var(--tt-go)' }}>
              +91 {prettyPhone(c.phone as string)}
            </div>
            <p style={{ margin: 0, fontSize: 'var(--tt-fs-body)', lineHeight: 1.55, color: 'var(--tt-muted)' }}>
              Format, fees, eligibility, roster changes: anything on the day.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <a
                className="tt-btn"
                style={{ flex: 1, minHeight: 44 }}
                href={`https://wa.me/${waNumber(c.phone as string)}?text=${encodeURIComponent('Hi, a question about TerraThon 2026: ')}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                <WhatsAppMark />
                WhatsApp
              </a>
              <a
                className="tt-btn tt-btn--quiet"
                style={{ flex: 1, minHeight: 44 }}
                href={`tel:+91${(c.phone as string).replace(/\D/g, '').slice(-10)}`}
              >
                <PhoneMark />
                Call
              </a>
            </div>
          </motion.div>
        ))}

        <motion.div
          className="tt-card"
          initial={reduce ? false : fadeInUp.hidden}
          whileInView={fadeInUp.visible}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.28, ease: [0.2, 0, 0, 1], delay: reduce ? 0 : reachable.length * 0.06 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          <span className="tt-kicker" style={{ color: 'var(--tt-ink-3)' }}>For anything longer</span>
          <div className="tt-poster-line" style={{ fontSize: 22 }}>Email us</div>
          <div style={{ fontSize: 'var(--tt-fs-body)', color: 'var(--tt-go)', wordBreak: 'break-all' }}>{EVENT.email}</div>
          <p style={{ margin: 0, fontSize: 'var(--tt-fs-body)', lineHeight: 1.55, color: 'var(--tt-muted)' }}>
            Sponsorship, press, or anything with an attachment.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <a
              className="tt-btn tt-btn--quiet"
              style={{ flex: 1, minHeight: 44 }}
              href={`mailto:${EVENT.email}`}
            >
              <MailMark />
              Email
            </a>
            <button
              type="button"
              onClick={copyEmail}
              className="tt-btn tt-btn--quiet"
              style={{ flex: 1, minHeight: 44 }}
            >
              {copied ? 'Copied' : 'Copy address'}
            </button>
          </div>
        </motion.div>

        <motion.div
          className="tt-card"
          initial={reduce ? false : fadeInUp.hidden}
          whileInView={fadeInUp.visible}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.28, ease: [0.2, 0, 0, 1], delay: reduce ? 0 : (reachable.length + 1) * 0.06 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          <span className="tt-kicker" style={{ color: 'var(--tt-ink-3)' }}>The organisation</span>
          <div className="tt-poster-line" style={{ fontSize: 22 }}>AquaTerra</div>
          <a href={EVENT.mainSite} className="tt-hit" style={{ alignSelf: 'flex-start', fontSize: 'var(--tt-fs-body)', color: 'var(--tt-go)' }}>ngoaquaterra.com</a>
          <p style={{ margin: 0, fontSize: 'var(--tt-fs-body)', lineHeight: 1.55, color: 'var(--tt-muted)' }}>
            Who we are, and where the money from this weekend goes.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <a
              className="tt-btn tt-btn--quiet"
              style={{ flex: '1 1 auto', minHeight: 44 }}
              href={EVENT.instagram}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="AquaTerra on Instagram, @aquaterra.live"
            >
              <InstagramMark />
              @aquaterra.live
            </a>
            <a
              className="tt-btn tt-btn--quiet"
              style={{ flex: '1 1 auto', minHeight: 44 }}
              href={EVENT.instagramNgo}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="AquaTerra NGO on Instagram, @ngo.aquaterra"
            >
              <InstagramMark />
              @ngo.aquaterra
            </a>
          </div>
        </motion.div>
      </div>

      <p style={{ marginTop: 'var(--tt-block)', fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-muted)' }}>
        Team AquaTerra is a registered NGO, 12A and 80G certified.
      </p>

      {/* FAQ, "before you ask" split: a short green poster heading on the
          left and the accordion on the right, per the board. Stacks under
          860px, where a fixed sidebar column would otherwise crush the
          questions into a narrow strip. Scoped here because it is a one-off
          layout for this page, not a new shared primitive. */}
      <section className="tt-contact-faq" style={{ marginTop: 'var(--tt-section)' }}>
        <div className="tt-contact-faq__head">
          <h2 className="tt-h2-poster" style={{ color: 'var(--tt-go)' }}>Before<br />you ask</h2>
          <p style={{ margin: '14px 0 0', fontSize: 'var(--tt-fs-body)', lineHeight: 1.6, color: 'var(--tt-muted)' }}>
            The questions we get every single day.
          </p>
        </div>
        <div className="tt-contact-faq__body">
          <TerraThonFaq />
        </div>
      </section>

      {/* The closing plate. Copy stays deliberately date-free: sport close
          times live in the database, not this file, and this page has no
          fetch of its own to source them from. Inventing a date here would be
          exactly the kind of literal CLAUDE.md warns against going stale. */}
      <div
        className="tt-plate"
        style={{
          display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
          marginTop: 'var(--tt-section)', marginBottom: 'var(--tt-block)',
        }}
      >
        <div style={{ flex: '1 1 260px' }}>
          <div className="tt-poster-line" style={{ fontSize: 20 }}>Registration is still open</div>
          <p style={{ margin: '8px 0 0', fontSize: 'var(--tt-fs-body)' }}>
            Each sport closes once it is full or its own deadline passes.{' '}
            <Link to={EVENT.base} style={{ color: 'inherit', textDecoration: 'underline' }}>
              Check a sport's page
            </Link>{' '}
            for its exact date.
          </p>
        </div>
        <Link to={`${EVENT.base}/register`} className="tt-btn" style={{ flexShrink: 0, minHeight: 52 }}>
          Register Now
        </Link>
      </div>

      <style>{`
        .tt-contact-faq { display: grid; gap: 32px; grid-template-columns: minmax(min(100%, 220px), 300px) 1fr; }
        .tt-contact-faq__head { min-width: 0; }
        @media (max-width: 860px) {
          .tt-contact-faq { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  )
}
