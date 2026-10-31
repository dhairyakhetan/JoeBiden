import GlyphIcon, { type GlyphName } from '../components/GlyphIcon'
import { Link } from 'react-router-dom'
import { useMeta } from '../hooks/useMeta'
import { useJsonLd, breadcrumbLd } from '../hooks/useJsonLd'
import { pageMetadata } from '../lib/metaConfig'
import { Reveal, RevealGroup } from '../components/Reveal'

// Crftd is AQ's student-run streetwear label. There is no in-app commerce
// backend, so - matching the design handoff's Crftd screen - drops link out to
// a collab CTA (the Instagram shop link is parked until the renamed account exists),
// rather than a fake in-app cart/checkout.

interface Drop {
  id: string
  name: string
  tagline: string
  price: number
  status: 'sold-out' | 'in-stock'
  icon: GlyphName
}

const DROPS: Drop[] = [
  { id: 'groundwork', name: 'Drop 01 · "Groundwork" Tee', tagline: 'The one that started it all.', price: 799, status: 'sold-out', icon: 'tee' },
  { id: 'kolkata', name: 'Drop 02 · "Kolkata" Hoodie', tagline: 'Heavyweight, screen-printed by students.', price: 1299, status: 'in-stock', icon: 'hoodie' },
  { id: 'totecaps', name: 'Drop 03 · Tote & Caps', tagline: 'Small batch. Big pockets.', price: 549, status: 'in-stock', icon: 'cap-hat' },
]

const CALENDAR: { drop: string; status: 'shipped' | 'live' | 'next'; note: string }[] = [
  { drop: 'Drop 01 · Groundwork', status: 'shipped', note: 'sold out - thank you' },
  { drop: 'Drop 02 · Kolkata', status: 'live', note: 'shipping now' },
  { drop: 'Drop 03 · Tote & Caps', status: 'live', note: 'shipping now' },
]

// These per-line rupee amounts don't correspond to any real drop's price (the
// three actual drops are ₹799 / ₹1,299 / ₹549 - none of them match what these
// three lines sum to). The org hasn't published a real per-drop cost
// breakdown, so this is kept as an illustrative SPLIT (shown as a percentage
// of the whole below) rather than asserted as a real product's price. Do not
// re-introduce an absolute-rupee total here without the org's actual numbers.
const COST_BREAKDOWN = [
  { label: 'fabric & printing', amount: 520, color: 'var(--sky)' },
  { label: 'makers', amount: 300, color: 'var(--lemon)' },
  { label: '→ welfare & events', amount: 479, color: 'var(--welfare)' },
]
const TOTAL_PRICE = COST_BREAKDOWN.reduce((s, c) => s + c.amount, 0)

const LOOKBOOK_TILES: ({ icon: GlyphName; color: string } | { text: string })[] = [
  { icon: 'camera', color: 'var(--grape)' },
  { icon: 'sparkle', color: 'var(--lemon)' },
  { text: 'MADE BY STUDENTS.' },
  { icon: 'thread', color: 'var(--sky)' },
  { icon: 'shoe', color: 'var(--pink)' },
]

export default function RootsPage() {
  useMeta(pageMetadata.crftd)
  useJsonLd('crftd-breadcrumb', breadcrumbLd([['Home', '/'], ['Crftd', '/crftd']]))

  return (
    <div className="route-enter">
      {/* ── Hero - bleed-under-nav: full-bleed colored first section, same
           nav-clearance-shows-through-as-cream-strip fix as the dark heroes
           elsewhere (this one just happens to be grape, not black). ── */}
      <div className="bleed-under-nav" data-nav-tint="grape" style={{ background: 'var(--grape)', padding: 'calc(var(--nav-h, 70px) + clamp(28px, 5vw, 48px)) 0 clamp(40px, 6vw, 64px)', borderBottom: 'var(--hair-2)' }}>
        <div className="container">
          <span className="sticker sticker-lemon wobble sticker--diecut" style={{ ['--sticker-ground' as string]: 'var(--grape)' }}>👕 STUDENT-RUN STREETWEAR</span>
          <h1 className="h-display" style={{ fontSize: 'clamp(64px, 11vw, 128px)', margin: '14px 0 8px', lineHeight: 0.9, color: 'var(--card)', position: 'relative', display: 'block', width: 'fit-content' }}>
            <span className="deco star" aria-hidden style={{ top: -16, right: -34, width: 26, height: 26 }} />
            Crftd.
          </h1>
          <p className="serif" style={{ fontStyle: 'italic', fontSize: 'clamp(24px, 2.4vw, 26px)', color: 'var(--card)', margin: '0 0 28px', maxWidth: 520 }}>
            profits fund the welfare drives. that's the whole business model.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, maxWidth: 640 }}>
            {[
              ['₹4L+', 'raised for AQ'],
              ['3', 'drops shipped'],
              ['100%', 'profit → mission'],
            ].map(([n, l]) => (
              <div key={l} style={{ background: 'var(--card)', border: 'var(--hair-2)', borderRadius: 'var(--r-outer)', padding: '14px 16px', boxShadow: 'var(--lift-1)' }}>
                <div className="h-display" style={{ fontSize: 28 }}>{n}</div>
                <div className="mono xs upper muted">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container" style={{ padding: 'clamp(28px, 5vw, 48px) var(--page-px,24px) clamp(40px, 6vw, 64px)', display: 'flex', flexDirection: 'column', gap: 48 }}>

        {/* ── Why Crftd exists ── */}
        <div style={{ border: 'var(--hair-2)', borderLeft: '6px solid var(--welfare)', borderRadius: 'var(--r-tight)', padding: '18px 22px', background: 'var(--bg-2)' }}>
          <div className="mono xs upper" style={{ fontWeight: 700, color: 'var(--welfare-ink)', marginBottom: 6 }}>why Crftd exists</div>
          <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--ink-2)' }}>
            Real streetwear, designed and shipped by students - not a concept, not a fundraiser gimmick. Every rupee of profit funds welfare projects and events. No middlemen, no markup games.
          </p>
        </div>

        {/* ── The drops ── */}
        <div>
          <h2 className="h-display" style={{ fontSize: 'clamp(28px, 4vw, 36px)', margin: '0 0 18px' }}>the drops.</h2>
          <RevealGroup style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 18 }}>
            {DROPS.map((d, i) => (
              <Reveal key={d.id} delay={i * 0.05}>
                <div className="card card-hover" style={{ padding: 22, height: '100%', opacity: d.status === 'sold-out' ? 0.75 : 1 }}>
                  <div style={{ marginBottom: 12 }}><GlyphIcon name={d.icon} size={56} /></div>
                  <h3 className="h-display" style={{ fontSize: 19, margin: '0 0 4px' }}>{d.name}</h3>
                  <p className="muted" style={{ fontSize: 13.5, margin: '0 0 14px', lineHeight: 1.5 }}>{d.tagline}</p>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="mono" style={{ fontWeight: 700, fontSize: 18 }}>₹{d.price}</span>
                    {d.status === 'sold-out' ? (
                      <button className="btn btn-sm" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>sold out</button>
                    ) : (
                      /* No in-app checkout exists - a disabled "shop soon" primary
                         button read as a live, buyable product with the one click
                         that matters switched off. This is a real path (DM on the
                         account that actually ships drops) instead of a dead end. */
                      <a
                        href="https://instagram.com/ngo.aquaterra"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-primary"
                      >
                        notify me ↗
                      </a>
                    )}
                  </div>
                </div>
              </Reveal>
            ))}
          </RevealGroup>
        </div>

        {/* ── How it works ── */}
        <div>
          <h2 className="h-display" style={{ fontSize: 'clamp(28px, 4vw, 36px)', margin: '0 0 18px' }}>how it works.</h2>
          <RevealGroup style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            {[
              ['01', 'design', 'Student designers pitch and vote on every drop.'],
              ['02', 'produce locally', 'Small local print shops and makers, paid fairly.'],
              ['03', 'profit → welfare', 'Every rupee left over funds drives and events.'],
            ].map(([n, t, d], i) => (
              <Reveal key={n} delay={i * 0.05}>
                <div style={{ border: 'var(--hair-2)', borderRadius: 'var(--r-tight)', padding: 18, background: 'var(--card)' }}>
                  <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--grape-ink)' }}>{n}</div>
                  <div className="h-display" style={{ fontSize: 17, margin: '8px 0 4px' }}>{t}</div>
                  <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>{d}</div>
                </div>
              </Reveal>
            ))}
          </RevealGroup>
        </div>

        {/* ── Lookbook ── */}
        <div>
          <h2 className="h-display" style={{ fontSize: 'clamp(28px, 4vw, 36px)', margin: '0 0 18px' }}>lookbook.</h2>
          <RevealGroup style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            {LOOKBOOK_TILES.map((t, i) => (
              <Reveal key={i} delay={Math.min(i * 0.04, 0.4)}>
                <div
                  style={{
                    aspectRatio: '3/4', border: 'text' in t ? 'none' : 'var(--hair-2)', borderRadius: 'var(--r-tight)',
                    display: 'grid', placeItems: 'center', overflow: 'hidden',
                    background: 'text' in t ? 'var(--ink)' : t.color,
                  }}
                >
                  {'text' in t ? (
                    <span className="h-display" style={{ color: 'var(--bg)', fontSize: 15, textAlign: 'center', padding: 10 }}>{t.text}</span>
                  ) : (
                    <GlyphIcon name={t.icon} size={64} />
                  )}
                </div>
              </Reveal>
            ))}
          </RevealGroup>
        </div>

        {/* ── Cost breakdown + size guide ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 24 }}>
          <div>
            <h2 className="h-display" style={{ fontSize: 22, margin: '0 0 14px' }}>a representative cost breakdown.</h2>
            <RevealGroup style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {COST_BREAKDOWN.map((c, i) => (
                <Reveal key={c.label} delay={i * 0.05}>
                  <div>
                    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                      <span className="mono xs upper">{c.label}</span>
                      <span className="mono xs" style={{ fontWeight: 700 }}>{Math.round((c.amount / TOTAL_PRICE) * 100)}%</span>
                    </div>
                    <div style={{ height: 10, background: 'var(--bg-3)', border: 'var(--hair-2)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(c.amount / TOTAL_PRICE) * 100}%`, background: c.color }} />
                    </div>
                  </div>
                </Reveal>
              ))}
            </RevealGroup>
          </div>
          <div>
            <h2 className="h-display" style={{ fontSize: 22, margin: '0 0 14px' }}>size guide.</h2>
            <div style={{ border: 'var(--hair-2)', borderRadius: 'var(--r-tight)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-2)' }}>
                    {['size', 'chest (in)', 'length (in)'].map(h => (
                      <th key={h} className="mono xs upper" style={{ textAlign: 'left', padding: '8px 12px', borderBottom: 'var(--hair)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[['S', '38', '26'], ['M', '40', '27'], ['L', '42', '28'], ['XL', '44', '29']].map(row => (
                    <tr key={row[0]}>
                      {row.map((cell, ci) => (
                        <td key={ci} className={ci === 0 ? 'mono' : ''} style={{ padding: '8px 12px', borderBottom: '1px dashed var(--line)', fontWeight: ci === 0 ? 700 : 400 }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Drop calendar ── */}
        <div>
          <h2 className="h-display" style={{ fontSize: 'clamp(28px, 4vw, 36px)', margin: '0 0 18px' }}>drop calendar.</h2>
          <RevealGroup style={{ border: 'var(--hair-2)', borderRadius: 'var(--r-outer)', overflow: 'hidden' }}>
            {CALENDAR.map((row, i) => (
              <Reveal key={row.drop} delay={i * 0.05}>
                <div
                  className="row"
                  style={{
                    justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px',
                    borderBottom: i < CALENDAR.length - 1 ? '1px dashed var(--line)' : 'none',
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{row.drop}</span>
                  <span
                    className="mono xs upper"
                    style={{
                      padding: '4px 10px', borderRadius: 999, border: 'var(--hair-2)', fontWeight: 700,
                      background: row.status === 'shipped' ? 'var(--bg-3)' : row.status === 'live' ? 'var(--welfare)' : 'var(--lemon)',
                      color: 'var(--ink)',
                    }}
                  >
                    {row.note}
                  </span>
                </div>
              </Reveal>
            ))}
          </RevealGroup>
        </div>

        {/* ── CTA - every fit funds a drive ── */}
        <div style={{ background: 'var(--ink)', color: 'var(--bg)', borderRadius: 'var(--r-outer)', padding: 'clamp(28px,5vw,44px)', textAlign: 'center' }}>
          <span className="sticker sticker-lemon sticker--diecut" style={{ marginBottom: 14, ['--sticker-ground' as string]: 'var(--ink)' }}>★ wear the work</span>
          <h2 className="h-display" style={{ fontSize: 'clamp(26px, 4vw, 40px)', margin: '14px 0 10px' }}>every fit funds a drive.</h2>
          <p style={{ opacity: 0.75, margin: '0 0 22px' }}>the next drop lands soon. collab with us in the meantime.</p>
          <div className="row gap-2" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/collaborations" className="btn" style={{ background: 'transparent', color: 'var(--bg)', borderColor: 'var(--bg)' }}>collab with Crftd</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
