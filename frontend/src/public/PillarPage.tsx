import { Suspense, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { lazyWithRetry as lazy } from '../lib/lazyWithRetry'
import { Star } from '../components/v6Shared'
import { useMeta } from '../hooks/useMeta'
import { pageMetadata } from '../lib/metaConfig'
import { useJsonLd, breadcrumbLd } from '../hooks/useJsonLd'
import { Reveal, RevealGroup } from '../components/Reveal'
import { PILLARS, PILLAR_ORDER, buildPillarJsonLd, type PillarKey, type PillarLink } from '../lib/pillarContent'
import { LibraryDirectory } from '../components/ImpactLibraryLazy'
import { PhotoDrift, TiltLink, type Photo } from '../components/impact/fx'
import './PillarPage.css'

/**
 * One renderer for the four "giving back" pages: /impact, /shikshaq, /sports
 * and /ai. Every word comes from lib/pillarContent.ts, which the prerender
 * script also reads, so what a crawler is served is exactly what this shows.
 */

/** Accent fill → its text-safe ink partner (DESIGN.md §2: a hue is a fill, never text on cream). */
const INK: Record<string, string> = {
  'var(--welfare)': 'var(--welfare-ink)',
  'var(--sky)': 'var(--sky-ink)',
  'var(--tomato)': 'var(--tomato-ink)',
  'var(--labs)': 'var(--labs-ink)',
  'var(--lemon)': 'var(--lemon-ink)',
  'var(--pink)': 'var(--pink-ink)',
  'var(--teal)': 'var(--teal-ink)',
}

function PillarAnchor({ link, className }: { link: PillarLink; className: string }) {
  if (link.external) {
    return <a href={link.href} className={className} target="_blank" rel="noopener noreferrer">{link.label} ↗</a>
  }
  return <Link to={link.href} className={className}>{link.label} →</Link>
}

// /impact/:slug arrives here (App.tsx routes it through this chunk so the eager entry carries one loader, not two).
const TopicPage = lazy(() => import('./TopicPage'))
const StoryPage = lazy(() => import('./StoryPage'))
const ExplorePage = lazy(() => import('./ExplorePage'))

/**
 * App.tsx routes all of /impact/* here (one route keeps the eager entry small). The first path segment picks the page:
 * stories/... photo stories, explore/... the explorers, anything else a library topic, nothing the hub.
 */
export default function PillarPage({ pillarKey }: { pillarKey: PillarKey }) {
  const { '*': splat = '' } = useParams()
  const first = splat.split('/')[0]
  const fallback = <div className="route-enter container" style={{ minHeight: '70vh' }} role="status" aria-label="Loading" />
  if (first === 'stories') return <Suspense fallback={fallback}><StoryPage /></Suspense>
  if (first === 'explore') return <Suspense fallback={fallback}><ExplorePage /></Suspense>
  if (first) return <Suspense fallback={fallback}><TopicPage /></Suspense>
  return <PillarBody pillarKey={pillarKey} />
}

/** Which library page's drive photos each pillar shows (ShikshAQ has no drives of its own, so none). */
const PHOTO_SOURCE: Partial<Record<PillarKey, string>> = { impact: 'where-we-work', sports: 'sport-and-play', ai: 'ai-and-digital-skills' }
const FACTS = import.meta.glob<{ drives: { slug: string; title: string; img?: string; alt?: string; date: string | null; place: string | null }[] }>('../lib/topics/facts/*.json', { import: 'default' })

function usePillarPhotos(key: PillarKey): Photo[] {
  const [photos, setPhotos] = useState<Photo[]>([])
  useEffect(() => {
    const src = PHOTO_SOURCE[key]
    const load = src ? FACTS[`../lib/topics/facts/${src}.json`] : undefined
    if (!load) { setPhotos([]); return }
    let live = true
    load().then(f => { if (live) setPhotos(f.drives.filter(d => d.img).slice(0, 14).map(d => ({ slug: d.slug, title: d.title, img: d.img!, alt: d.alt, date: d.date, place: d.place }))) }).catch(() => {})
    return () => { live = false }
  }, [key])
  return photos
}

function PillarBody({ pillarKey }: { pillarKey: PillarKey }) {
  const photos = usePillarPhotos(pillarKey)
  const p = PILLARS[pillarKey]
  const meta = pageMetadata[pillarKey]
  useMeta(meta)
  useJsonLd(`${p.key}-breadcrumb`, breadcrumbLd(
    p.key === 'impact'
      ? [['Home', '/'], [p.label, p.path]]
      : [['Home', '/'], [PILLARS.impact.label, PILLARS.impact.path], [p.label, p.path]],
  ))
  const [pageLd, faqLd, extraLd] = buildPillarJsonLd(p, meta.title, meta.description)
  useJsonLd(`${p.key}-webpage`, pageLd)
  useJsonLd(`${p.key}-faq`, faqLd)
  useJsonLd(`${p.key}-extra`, extraLd)

  const others = PILLAR_ORDER.filter(k => k !== p.key).map(k => PILLARS[k])

  return (
    <div className="route-enter pl-page">
      <section className="pl-hero">
        <Star size={96} color={p.heroFill} style={{ position: 'absolute', top: 36, right: 72, opacity: 0.6 }} className="spin-slow" />
        <div className="container" style={{ position: 'relative' }}>
          <span
            className="sticker sticker-mint wobble sticker--diecut"
            style={{ marginBottom: 16, display: 'inline-flex', ['--sticker-ground' as string]: 'var(--bg)' }}
          >
            {p.sticker}
          </span>
          <h1 className="giant pl-h1">
            {p.h1Lead}{' '}
            <span className="underline-doodle pl-accent" style={{ color: INK[p.heroFill] || 'var(--ink)' }}>{p.h1Accent}</span>.
          </h1>
          <p className="pl-lede">{p.lede}</p>
        </div>
      </section>

      <div className="container pl-body">
        {p.stats && p.stats.length > 0 && (
          <RevealGroup className="pl-stats">
            {p.stats.map((s, i) => (
              <Reveal key={s.label} delay={Math.min(i * 0.04, 0.3)}>
                <div className="card pl-stat">
                  <div className="h-display pl-stat-n">{s.value}</div>
                  <div className="pl-stat-l">{s.label}</div>
                </div>
              </Reveal>
            ))}
          </RevealGroup>
        )}

        <PhotoDrift photos={photos} />

        {p.key === 'impact' && (
          <div className="pl-doors">
            <TiltLink to="/impact/explore/timeline" className="card pl-door"><span className="pl-door-e" aria-hidden>🕰️</span><span className="pl-door-t">scrub through every month since 2021</span></TiltLink>
            <TiltLink to="/impact/stories" className="card pl-door"><span className="pl-door-e" aria-hidden>📸</span><span className="pl-door-t">see each drive series in pictures</span></TiltLink>
            <TiltLink to="/impact/explore/quiz" className="card pl-door"><span className="pl-door-e" aria-hidden>🧭</span><span className="pl-door-t">find the drive that suits you</span></TiltLink>
            <TiltLink to="/impact/explore/calculator" className="card pl-door"><span className="pl-door-e" aria-hidden>🧮</span><span className="pl-door-t">add up any series yourself</span></TiltLink>
          </div>
        )}

        {p.key === 'impact' && (
          <nav className="pl-toc" aria-label="on this page">
            {p.sections.map(s => (
              <a key={s.id} href={`#${s.id}`} className="pl-toc-a">{s.heading}</a>
            ))}
          </nav>
        )}

        <div className="pl-sections">
          {p.sections.map(s => (
            <div key={s.id}>
              <section id={s.id} className="card pl-section" aria-labelledby={`${s.id}-h`}>
                <span className="pl-kicker mono xs upper" style={{ background: s.fill }}>{s.kicker}</span>
                <h2 id={`${s.id}-h`} className="h-display pl-h2">{s.heading}</h2>
                {s.body.map((para, i) => <p key={i} className="pl-p">{para}</p>)}
                {s.points && s.points.length > 0 && (
                  <ul className="pl-points">{s.points.map(pt => <li key={pt}>{pt}</li>)}</ul>
                )}
                {s.links && s.links.length > 0 && (
                  <div className="pl-links">
                    {s.links.map(l => <PillarAnchor key={l.href} link={l} className="btn btn-sm" />)}
                  </div>
                )}
              </section>
            </div>
          ))}
        </div>

        <section className="pl-faq" aria-labelledby="pl-faq-h">
          <h2 id="pl-faq-h" className="h-display pl-h2">questions, answered</h2>
          <div className="pl-faq-list">
            {p.faqs.map(f => (
              <div key={f.q} className="card pl-faq-item">
                <h3 className="pl-faq-q">{f.q}</h3>
                <p className="pl-p">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="card pl-more" aria-labelledby="pl-more-h">
          <h2 id="pl-more-h" className="mono xs upper muted pl-more-h">more of what we do</h2>
          <div className="pl-more-grid">
            {others.map(o => (
              <Link key={o.key} to={o.path} className="pl-more-a">
                <span className="pl-more-dot" style={{ background: o.heroFill }} aria-hidden />
                <span>{o.label}</span>
              </Link>
            ))}
            {p.related.filter(l => !PILLAR_ORDER.some(k => PILLARS[k].path === l.href)).map(l => (
              l.external
                ? <a key={l.href} href={l.href} className="pl-more-a" target="_blank" rel="noopener noreferrer"><span>{l.label} ↗</span></a>
                : <Link key={l.href} to={l.href} className="pl-more-a"><span>{l.label}</span></Link>
            ))}
          </div>
          <Link to="/join" className="btn btn-primary pl-join">join the work →</Link>
        </section>

        {p.key === 'impact'
          ? <LibraryDirectory id="library" />
          : <LibraryDirectory heading="the impact library" />}
      </div>
    </div>
  )
}
