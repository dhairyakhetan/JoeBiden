import { Link } from 'react-router-dom'
import { Star } from '../components/v6Shared'
import { useMeta } from '../hooks/useMeta'
import { pageMetadata } from '../lib/metaConfig'
import { useJsonLd, breadcrumbLd } from '../hooks/useJsonLd'
import { Reveal, RevealGroup } from '../components/Reveal'
import './SupportPage.css'

const WAYS = [
  {
    num: '01',
    color: 'var(--welfare)',
    title: 'Join as a volunteer',
    body: 'show up, do the work, become part of the community. no experience needed. just willingness to contribute.',
    cta: 'Join the work',
    href: '/login',
  },
  {
    num: '02',
    color: 'var(--lemon)',
    title: 'Buy from Crftd',
    body: 'every Crftd purchase funds welfare drives, event production, and community programs. you get merch, we get resources.',
    cta: 'see Crftd',
    href: '/crftd',
  },
  {
    num: '03',
    color: 'var(--pink)',
    title: 'Collaborate with us',
    body: 'school, college, NGO, or brand. we are open to joint welfare drives, event co-hosting, content partnerships, and resource sharing.',
    cta: 'start a collab',
    href: '/collaborations',
  },
  {
    num: '04',
    color: 'var(--sky)',
    title: 'Spread the word',
    body: 'follow @ngo.aquaterra on Instagram. share our posts. tell students who might want to join. peer-to-peer is how AQ grows.',
    cta: 'follow on instagram',
    href: 'https://instagram.com/ngo.aquaterra',
    external: true,
  },
]

export default function SupportPage() {
  useMeta(pageMetadata.support)
  useJsonLd('support-breadcrumb', breadcrumbLd([['Home', '/'], ['Support', '/support']]))
  return (
    <div className="route-enter">
      <section style={{ padding: 'clamp(44px, 8vw, 80px) 0 clamp(32px, 5vw, 56px)', position: 'relative', overflow: 'hidden' }}>
        <Star size={100} color="var(--lemon)" style={{ position: 'absolute', top: 40, right: 80, opacity: 0.6 }} className="spin-slow" />
        <div className="container" style={{ position: 'relative' }}>
          <span className="sticker sticker-mint wobble sticker--diecut" style={{ marginBottom: 16, display: 'inline-flex', ['--sticker-ground' as string]: 'var(--bg)' }}>★ DARPAN certified NGO</span>
          <h1 className="giant" style={{ margin: 0, lineHeight: 0.88 }}>
            support<br />
            <span className="underline-doodle" style={{ fontStyle: 'italic', fontFamily: 'var(--serif)', fontWeight: 400, color: 'var(--welfare-ink)' }}>the work</span>.
          </h1>
          <p style={{ fontSize: 19, marginTop: 22, maxWidth: 520, color: 'var(--ink-2)', lineHeight: 1.5 }}>
            AquaTerra runs on student time and self-generated revenue. no external donations. but there are ways to help.
          </p>
        </div>
      </section>

      <div className="container" style={{ padding: 'clamp(28px, 5vw, 48px) var(--page-px,24px) clamp(40px, 6vw, 64px)' }}>
        <RevealGroup className="sp-ways">
          {WAYS.map((w, i) => (
            <Reveal key={w.num} delay={Math.min(i * 0.05, 0.4)}>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ background: w.color, color: 'var(--ink)', padding: '22px 24px 18px', borderBottom: 'var(--hair-2)' }}>
                  <div className="mono xs upper" style={{ fontWeight: 800, color: 'rgba(10,10,10,0.85)', marginBottom: 8 }}>{w.num} / 04</div>
                  <h2 className="h-display" style={{ fontSize: 28, lineHeight: 1 }}>{w.title}</h2>
                </div>
                <div style={{ padding: '18px 24px 22px' }}>
                  <p style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 0 16px' }}>{w.body}</p>
                  {w.external
                    ? <a href={w.href} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary">{w.cta} ↗</a>
                    : <Link to={w.href} className="btn btn-sm btn-primary">{w.cta} →</Link>}
                </div>
              </div>
            </Reveal>
          ))}
        </RevealGroup>

        {/* Not-for-donations note */}
        <Reveal>
          <div className="card" style={{ padding: 28, marginTop: 32, background: 'var(--bg-2)' }}>
            <div className="mono xs upper muted" style={{ fontWeight: 700, marginBottom: 10 }}>★ NOTE ON DONATIONS</div>
            <p style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.65, margin: 0 }}>
              AquaTerra does not accept monetary donations. we are intentionally self-funded through student-run events and Crftd. this keeps us independent and student-accountable. if you want to support us financially, buy from Crftd or attend Paradox.
            </p>
          </div>
        </Reveal>
      </div>
    </div>
  )
}
