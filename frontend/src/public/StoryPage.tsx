import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMeta } from '../hooks/useMeta'
import { useJsonLd } from '../hooks/useJsonLd'
import Img from '../components/Img'
import { CountOnView, PhotoMosaic, TiltLink, useInView, type Photo } from '../components/impact/fx'
import defsJson from '../lib/topics/topicDefs.json'
import { fillTokens, splitLinks, TOPIC_BY_SLUG, topicPath } from '../lib/topics/topicKit'
import { buildStoryJsonLd, type StoryCopy, type StoryFacts } from '../lib/topics/storyKit'
import './PillarPage.css'
import './TopicPage.css'
import './ExplorePage.css'
import './StoryPage.css'

/**
 * A photo story: /impact/stories/<slug>. One drive series told year by year through its own drive photos.
 * Words: lib/topics/copy/stories/<slug>.json. Photos, captions and counts: lib/topics/facts/stories/<slug>.json
 * (compute-topic-facts.mjs, every build). Each pair is its own small chunk.
 */
const COPY = import.meta.glob<StoryCopy>('../lib/topics/copy/stories/*.json', { import: 'default' })
const FACTS = import.meta.glob<StoryFacts>('../lib/topics/facts/stories/*.json', { import: 'default' })
const STORIES = (defsJson as { stories: { slug: string; topic: string; label: string }[] }).stories

function Rich({ text }: { text: string }) {
  return <>{splitLinks(text).map((p, i) => (p.href ? <Link key={i} to={p.href} className="tp-inline">{p.text}</Link> : <span key={i}>{p.text}</span>))}</>
}

function Chapter({ year, heading, text, photos, count }: { year: number; heading: string; text: string; photos: Photo[]; count: number }) {
  const [ref, seen] = useInView<HTMLElement>()
  return (
    <section ref={ref} id={`y${year}`} className={`st-chapter${seen ? ' is-in' : ''}`} aria-labelledby={`st-h-${year}`}>
      <div className="st-year" aria-hidden>{year}</div>
      <div className="st-chapter-body">
        <p className="mono xs upper st-kicker">{year} · {count} {count === 1 ? 'drive' : 'drives'}</p>
        <h2 id={`st-h-${year}`} className="h-display st-h2">{heading}</h2>
        <p className="pl-p st-text"><Rich text={text} /></p>
        <PhotoMosaic photos={photos} label={`photos from ${year}`} initial={6} />
      </div>
    </section>
  )
}

interface StoryCard { slug: string; label: string; topic: string; count: number; firstYear: number | null; lastYear: number | null; img?: string; alt?: string }

/** /impact/stories: every photo story as a big cover card. Covers and counts from facts/stories/_index.json. */
function StoriesIndex() {
  const [cards, setCards] = useState<StoryCard[] | null>(null)
  useEffect(() => { import('../lib/topics/facts/stories/_index.json').then(m => setCards((m.default as unknown) as StoryCard[])).catch(() => setCards([])) }, [])
  useMeta({
    title: 'Photo Stories: AquaTerra Drives in Pictures, Kolkata · AquaTerra',
    description: 'every AquaTerra drive series told in its own photos, year by year: feeding stray dogs, summer sharbat, plantations, clothes and book drives, sessions with kids and more.',
    path: '/impact/stories',
  })
  useJsonLd('stories-index', cards ? {
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'AquaTerra photo stories', url: 'https://www.ngoaquaterra.com/impact/stories',
    mainEntity: { '@type': 'ItemList', itemListElement: cards.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.label, url: `https://www.ngoaquaterra.com/impact/stories/${c.slug}` })) },
  } : null)
  return (
    <div className="route-enter pl-page">
      <section className="pl-hero"><div className="container">
        <nav className="tp-crumb mono xs upper" aria-label="breadcrumb"><Link to="/impact">how we give back</Link> <span aria-hidden>/</span> <Link to="/impact/explore">explore</Link></nav>
        <h1 className="giant pl-h1">our drives, <span className="underline-doodle pl-accent tp-accent">in pictures</span>.</h1>
        <p className="pl-lede">every drive series we run, told year by year through the photos our members took on the day. tap a story, then tap any photo to see it big and read that drive.</p>
      </div></section>
      <div className="container pl-body">
        {!cards ? <div className="ex-loading" role="status" aria-label="Loading stories" /> : (
          <ul className="st-grid">
            {cards.map(c => (
              <li key={c.slug}>
                <TiltLink to={`/impact/stories/${c.slug}`} className="st-card">
                  {c.img && <Img src={c.img} alt={c.alt || c.label} ctx="card" />}
                  <span className="st-card-scrim" aria-hidden />
                  <span className="st-card-t">{c.label}</span>
                  <span className="st-card-m">{c.count} drives{c.firstYear ? ` · ${c.firstYear === c.lastYear ? c.firstYear : `${c.firstYear} to ${c.lastYear}`}` : ''}</span>
                </TiltLink>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default function StoryPage() {
  const { '*': splat = '' } = useParams()
  const slug = splat.replace(/^stories\/?/, '').replace(/\/+$/, '')
  if (!slug) return <StoriesIndex />
  return <OneStory slug={slug} />
}

function OneStory({ slug }: { slug: string }) {
  const def = STORIES.find(s => s.slug === slug)
  const [data, setData] = useState<{ slug: string; copy: StoryCopy; facts: StoryFacts } | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let live = true
    const c = COPY[`../lib/topics/copy/stories/${slug}.json`]
    const f = FACTS[`../lib/topics/facts/stories/${slug}.json`]
    if (!def || !c || !f) { setMissing(true); return }
    setMissing(false)
    Promise.all([c(), f()]).then(([copy, facts]) => { if (live) setData({ slug, copy, facts }) }).catch(() => { if (live) setMissing(true) })
    return () => { live = false }
  }, [slug, def])

  const ready = data && data.slug === slug ? data : null
  const t = (s: string) => (ready ? fillTokens(s, ready.facts) : '')
  const title = ready ? t(ready.copy.title) : def ? `${def.label} · AquaTerra` : 'Not found · AquaTerra'
  const description = ready ? t(ready.copy.description) : ''
  useMeta({ title, description: description || undefined, path: `/impact/stories/${slug}`, noIndex: missing, image: ready?.facts.chapters.flatMap(c => c.photos).at(-1)?.img })
  const ld = def && ready ? buildStoryJsonLd(def, ready.copy, ready.facts, title, description) : []
  useJsonLd(`story-${slug}-page`, ld[0])
  useJsonLd(`story-${slug}-faq`, ld[1])
  useJsonLd(`story-${slug}-crumb`, ld[2])

  if (missing) {
    return (
      <div className="route-enter container pl-body" style={{ paddingTop: 64 }}>
        <h1 className="h-display pl-h2">that story is not here.</h1>
        <Link to="/impact/stories" className="btn btn-primary">all photo stories →</Link>
      </div>
    )
  }
  if (!def || !ready) return <div className="route-enter container" style={{ minHeight: '70vh' }} role="status" aria-label="Loading" />

  const { copy, facts } = ready
  const allPhotos = facts.chapters.flatMap(c => c.photos)
  const cover = allPhotos.at(-1)
  const topic = TOPIC_BY_SLUG[def.topic]
  const others = STORIES.filter(s => s.slug !== slug)

  return (
    <div className="route-enter pl-page st-page">
      <section className="st-hero">
        {cover && <Img src={cover.img} alt={cover.alt || cover.title} ctx="cover" eager className="st-hero-img" />}
        <div className="st-hero-scrim" aria-hidden />
        <div className="container st-hero-in">
          <nav className="tp-crumb mono xs upper st-crumb" aria-label="breadcrumb">
            <Link to="/impact">how we give back</Link> <span aria-hidden>/</span> <Link to="/impact/stories">photo stories</Link>
          </nav>
          <h1 className="giant st-h1">{t(copy.h1Lead)} <span className="pl-accent">{t(copy.h1Accent)}</span>.</h1>
          <p className="st-lede"><Rich text={t(copy.lede)} /></p>
          <nav className="st-years" aria-label="jump to a year">
            {facts.chapters.map(c => <a key={c.year} href={`#y${c.year}`}>{c.year}</a>)}
          </nav>
        </div>
      </section>

      <div className="container pl-body">
        <div className="pl-stats tp-stats">
          <div className="card pl-stat"><div className="h-display pl-stat-n"><CountOnView value={facts.count} /></div><div className="pl-stat-l">drives</div></div>
          <div className="card pl-stat"><div className="h-display pl-stat-n"><CountOnView value={facts.volunteers} /></div><div className="pl-stat-l">volunteer turnouts</div></div>
          <div className="card pl-stat"><div className="h-display pl-stat-n">{t('{years}')}</div><div className="pl-stat-l">years</div></div>
          <div className="card pl-stat"><div className="h-display pl-stat-n"><CountOnView value={allPhotos.length} /></div><div className="pl-stat-l">photos in this story</div></div>
        </div>

        <div className="st-chapters">
          {facts.chapters.map(c => {
            const ch = copy.chapters[String(c.year)]
            if (!ch) return null
            return <Chapter key={c.year} year={c.year} count={c.count} heading={t(ch.heading)} text={t(ch.text)} photos={c.photos} />
          })}
        </div>

        <section className="card st-closing">
          <p className="pl-p st-closing-p"><Rich text={t(copy.closing)} /></p>
          <div className="pl-links">
            {topic && <Link to={topicPath(topic.slug)} className="btn btn-sm">{topic.label} →</Link>}
            <Link to="/join" className="btn btn-sm btn-primary">join the next one →</Link>
          </div>
        </section>

        <section className="pl-faq" aria-labelledby="st-faq-h">
          <h2 id="st-faq-h" className="h-display pl-h2">questions, answered</h2>
          <div className="pl-faq-list">
            {copy.faqs.map(f => (
              <div key={f.q} className="card pl-faq-item"><h3 className="pl-faq-q">{t(f.q)}</h3><p className="pl-p"><Rich text={t(f.a)} /></p></div>
            ))}
          </div>
        </section>

        <section aria-labelledby="st-more-h">
          <h2 id="st-more-h" className="h-display pl-h2">more photo stories</h2>
          <div className="st-more">
            {others.map(o => <TiltLink key={o.slug} to={`/impact/stories/${o.slug}`} className="card st-more-card"><span>{o.label}</span><span aria-hidden>→</span></TiltLink>)}
          </div>
        </section>
      </div>
    </div>
  )
}
