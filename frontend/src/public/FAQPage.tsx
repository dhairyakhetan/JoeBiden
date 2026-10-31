import './FAQPage.css'
import { Link } from 'react-router-dom'
import { useMeta } from '../hooks/useMeta'
import { pageMetadata } from '../lib/metaConfig'
import { useJsonLd, breadcrumbLd } from '../hooks/useJsonLd'
import { CONTACT_REPLY_TIME } from '../lib/orgFacts'
import { faqFor } from '../lib/faqData'
import { Reveal, RevealGroup } from '../components/Reveal'

// Sourced from lib/faqData.ts, shared with /volunteer's own FAQ section, so
// the two pages can't independently drift on the questions they both answer
// (is there a fee, how long does approval take) the way founding-year and
// approval-time copy already once did before being centralized.
const QS = faqFor('faq')
// Split by intent: a first-time visitor deciding whether to join shouldn't
// have to read past HoD-structure and Crftd questions meant for
// someone already inside to find "is this free."
const JOINING = QS.filter(it => it.cluster === 'joining')
const INSIDE = QS.filter(it => it.cluster !== 'joining')

const FAQ_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: QS.map(it => ({
    '@type': 'Question',
    name: it.q,
    acceptedAnswer: { '@type': 'Answer', text: it.a },
  })),
}

export default function FAQPage() {
  useMeta(pageMetadata.faq)
  useJsonLd('faq-crumb-breadcrumb', breadcrumbLd([['Home', '/'], ['FAQ', '/faq']]))
  useJsonLd('faq', FAQ_LD)

  return (
    // Uses the standard .container frame (no inline maxWidth) so the page's
    // content edge — and therefore every card here — lines up with the nav,
    // the footer and every other page. It used to be a centred 820px column,
    // which put its cards 227px inside the footer's edge at 1280px wide and
    // read as a disjoint floating block. Long-form text is capped per-block
    // below instead, so lines stay readable without narrowing the whole page.
    <div className="route-enter container" style={{ padding: 'clamp(28px, 5vw, 48px) var(--page-px,24px) clamp(40px, 6vw, 64px)' }}>
      <h1 className="h-display" style={{ fontSize: 'clamp(60px, 9vw, 80px)', margin: 0, lineHeight: 0.9, position: 'relative', display: 'inline-block' }}>
        <span className="deco star" aria-hidden style={{ top: -14, right: -30, width: 22, height: 22 }} />
        <span className="deco ring" aria-hidden style={{ bottom: 4, right: -54, width: 16, height: 16, borderWidth: 4, opacity: 0.55 }} />
        {/* --pink as text on cream is 2.73:1 - it misses even the 3:1
            large-text bar at this 60px size, and is one of the five defects
            DESIGN.md §2 names by ratio. --pink-ink is the same hue darkened
            until it passes: 4.97:1 on --bg. */}
        FAQ<span style={{ color: 'var(--pink-ink)' }}>.</span>
      </h1>
      <p style={{ fontSize: 18, marginTop: 12, color: 'var(--ink-2)', maxWidth: '60ch' }}>real questions. actual answers. no corporate vagueness.</p>

      {/* Two labeled clusters instead of one flat question list, so a
          first-time visitor scanning for "is this legit / is this free"
          doesn't have to read past HoD-structure and Crftd
          questions meant for someone already inside. */}
      <div className="mono xs upper muted" style={{ fontWeight: 700, marginTop: 32, marginBottom: 12 }}>thinking about joining</div>
      <RevealGroup style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {JOINING.map((it, i) => (
          <Reveal key={it.id} delay={Math.min(i * 0.03, 0.4)}>
            <details className="card card-hover" style={{ padding: '16px 18px', cursor: 'pointer' }} open={i === 0}>
              <summary style={{ fontFamily: 'var(--display)', fontSize: 16, fontWeight: 800, listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {it.q}
                <span className="accq" style={{ color: 'var(--welfare-ink)', flexShrink: 0, marginLeft: 12, display: 'inline-block', transition: 'transform 0.16s var(--ease-out)' }}>+</span>
              </summary>
              {/* Capped measure: the card is full-width now, but a 1,200px line of
                  body copy is unreadable — hold the answer to a normal column. */}
              <p style={{ marginTop: 12, color: 'var(--ink-2)', fontSize: 16, lineHeight: 1.65, maxWidth: '78ch' }}>{it.a}</p>
            </details>
          </Reveal>
        ))}
      </RevealGroup>

      <div className="mono xs upper muted" style={{ fontWeight: 700, marginTop: 32, marginBottom: 12 }}>once you're in</div>
      <RevealGroup style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {INSIDE.map((it, i) => (
          <Reveal key={it.id} delay={Math.min(i * 0.03, 0.4)}>
            <details className="card card-hover" style={{ padding: '16px 18px', cursor: 'pointer' }}>
              <summary style={{ fontFamily: 'var(--display)', fontSize: 16, fontWeight: 800, listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {it.q}
                <span className="accq" style={{ color: 'var(--welfare-ink)', flexShrink: 0, marginLeft: 12, display: 'inline-block', transition: 'transform 0.16s var(--ease-out)' }}>+</span>
              </summary>
              <p style={{ marginTop: 12, color: 'var(--ink-2)', fontSize: 16, lineHeight: 1.65, maxWidth: '78ch' }}>{it.a}</p>
            </details>
          </Reveal>
        ))}
      </RevealGroup>

      <div className="card" style={{ marginTop: 40, padding: 28, textAlign: 'center', background: 'var(--bg-2)' }}>
        <div className="h-display" style={{ fontSize: 26, margin: 0 }}>still have questions?</div>
        <p style={{ color: 'var(--ink-2)', marginTop: 8 }}>we read everything and usually reply {CONTACT_REPLY_TIME}.</p>
        <Link to="/contact" className="btn btn-primary" style={{ marginTop: 16, display: 'inline-flex' }}>
          get in touch →
        </Link>
      </div>

    </div>
  )
}
