import GlyphIcon, { type GlyphName } from '../components/GlyphIcon'
import { Link } from 'react-router-dom'
import { useMeta } from '../hooks/useMeta'
import { useJsonLd, breadcrumbLd } from '../hooks/useJsonLd'
import { pageMetadata } from '../lib/metaConfig'
import { Reveal, RevealGroup } from '../components/Reveal'

// AquaTerra's school network is built campus-by-campus in Kolkata. There is no
// public directory of schools yet (the `schools` table is empty), so this page
// tells the real story of the program and points prospective campuses at the
// collaboration flow - rather than shipping placeholder/fabricated school data.

const PILLARS: { icon: GlyphName; title: string; body: string }[] = [
  { icon: 'cap', title: 'campus chapters', body: 'A student lead runs AquaTerra on their own campus - drives, workshops and events, backed by the wider community.' },
  { icon: 'collab', title: 'inter-school collabs', body: 'Schools partner on joint welfare drives and events. Bigger reach, shared logistics, one network.' },
  { icon: 'certificate', title: 'certificates & LORs', body: 'Every member earns verifiable certificates and Letters of Recommendation for the real work they do.' },
]

export default function SchoolsPage() {
  useMeta(pageMetadata.schools)
  useJsonLd('schools-breadcrumb', breadcrumbLd([['Home', '/'], ['Schools', '/schools']]))

  return (
    <div className="route-enter container" style={{ padding: 'clamp(28px, 5vw, 48px) var(--page-px,24px) clamp(40px, 6vw, 64px)' }}>
      <span className="sticker sticker-mint wobble sticker--diecut" style={{ ['--sticker-ground' as string]: 'var(--bg)', maxWidth: '100%', whiteSpace: 'normal', marginBottom: 6 }}>★ campus network · kolkata</span>
      <h1 className="h-display" style={{ fontSize: 'clamp(60px, 9vw, 96px)', margin: '12px 0 14px', lineHeight: 0.9 }}>
        the <span className="underline-doodle" style={{ fontStyle: 'italic', fontFamily: 'var(--serif)', fontWeight: 400, color: 'var(--welfare-ink)' }}>map</span>.
      </h1>
      <p style={{ fontSize: 18, color: 'var(--ink-2)', maxWidth: 560, margin: '0 0 40px', lineHeight: 1.6 }}>
        AquaTerra grows one campus at a time. Students run chapters at their own schools across Kolkata - real drives,
        real events, real leadership. Want AquaTerra at your school?
      </p>

      {/* The three pillar cards were h3s appearing before any h2, so the
          outline read h1 -> h3 -> h2. This names the section they belong to. */}
      <h2 className="sr-only">How the campus network works</h2>
      <RevealGroup style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 16, marginBottom: 40 }}>
        {PILLARS.map((p, i) => (
          <Reveal key={p.title} delay={i * 0.05}>
            <div className="card" style={{ padding: 24, height: '100%' }}>
              <div style={{ marginBottom: 14 }}><GlyphIcon name={p.icon} size={52} /></div>
              <h3 className="h-display" style={{ fontSize: 22, margin: '0 0 6px' }}>{p.title}</h3>
              <p className="muted" style={{ fontSize: 14, lineHeight: 1.55, margin: 0 }}>{p.body}</p>
            </div>
          </Reveal>
        ))}
      </RevealGroup>

      <div className="card" style={{ padding: 'clamp(28px, 5vw, 44px)', background: 'var(--ink)', color: 'var(--bg)', textAlign: 'center' }}>
        <h2 className="h-display" style={{ fontSize: 'clamp(28px, 4vw, 40px)', marginBottom: 10 }}>bring AQ to your campus.</h2>
        <p style={{ opacity: 0.75, margin: '0 auto 24px', maxWidth: 460 }}>
          Tell us about your school. We’ll help you start a chapter - no cost, ever.
        </p>
        <div className="row gap-2" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/collaborations" className="btn btn-primary">start a chapter →</Link>
          <Link to="/contact" className="btn">talk to us</Link>
        </div>
      </div>
    </div>
  )
}
