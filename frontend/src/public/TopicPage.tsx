import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMeta } from '../hooks/useMeta'
import { useJsonLd } from '../hooks/useJsonLd'
import {
  TOPIC_BY_SLUG, TOPIC_GROUPS, TOPICS, TOPIC_INDEX, topicPath, isWholeOrgTopic, fillTokens, splitLinks,
  buildTopicJsonLd, type TopicCopy, type TopicFacts,
} from '../lib/topics/topicKit'
import { CountOnView, GrowBar, PhotoMosaic, TiltLink, type Photo } from '../components/impact/fx'
import storyDefs from '../lib/topics/topicDefs.json'
import './PillarPage.css'
import './TopicPage.css'

/**
 * One page of the impact library: /impact/<slug>. Words from lib/topics/copy/<slug>.json, numbers and the drive
 * list from lib/topics/facts/<slug>.json (regenerated every build). Each pair is its own small chunk, so a visit
 * downloads one topic, not forty-four. scripts/prerender-meta.mjs writes the same content into the served HTML.
 */
const COPY = import.meta.glob<TopicCopy>('../lib/topics/copy/*.json', { import: 'default' })
const FACTS = import.meta.glob<TopicFacts>('../lib/topics/facts/*.json', { import: 'default' })

const GROUP_FILL: Record<string, string> = {
  series: 'var(--welfare)', workshops: 'var(--pink)', places: 'var(--sky)', years: 'var(--lemon)', guides: 'var(--teal)',
}

function Rich({ text }: { text: string }) {
  return (
    <>
      {splitLinks(text).map((p, i) => (p.href ? <Link key={i} to={p.href} className="tp-inline">{p.text}</Link> : <span key={i}>{p.text}</span>))}
    </>
  )
}

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : '')

export default function TopicPage() {
  const { '*': splat = '' } = useParams()
  const slug = splat.replace(/\/+$/, '')
  const def = TOPIC_BY_SLUG[slug]
  const [data, setData] = useState<{ slug: string; copy: TopicCopy; facts: TopicFacts } | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let live = true
    const c = COPY[`../lib/topics/copy/${slug}.json`]
    const f = FACTS[`../lib/topics/facts/${slug}.json`]
    if (!def || !c || !f) { setMissing(true); return }
    setMissing(false)
    Promise.all([c(), f()]).then(([copy, facts]) => { if (live) setData({ slug, copy, facts }) }).catch(() => { if (live) setMissing(true) })
    return () => { live = false }
  }, [slug, def])

  const ready = data && data.slug === slug ? data : null
  const facts = ready?.facts
  const copy = ready?.copy
  const t = (s: string) => (facts ? fillTokens(s, facts) : '')
  const title = copy ? t(copy.title) : def ? `${def.label} · AquaTerra` : 'Not found · AquaTerra'
  const description = copy ? t(copy.description) : ''

  useMeta({ title, description: description || undefined, path: topicPath(slug), noIndex: missing })
  const ld = def && copy && facts ? buildTopicJsonLd(def, copy, facts, title, description) : []
  useJsonLd(`topic-${slug}-page`, ld[0])
  useJsonLd(`topic-${slug}-faq`, ld[1])
  useJsonLd(`topic-${slug}-crumb`, ld[2])

  if (missing) {
    return (
      <div className="route-enter container pl-body" style={{ paddingTop: 64 }}>
        <h1 className="h-display pl-h2">that page is not in the library.</h1>
        <p className="pl-p">it may have moved. everything we have written about our work is listed on the hub.</p>
        <Link to="/impact#library" className="btn btn-primary">browse the library →</Link>
      </div>
    )
  }
  if (!def || !copy || !facts) {
    return <div className="route-enter container" style={{ minHeight: '70vh' }} role="status" aria-label="Loading" />
  }

  const whole = isWholeOrgTopic(def)
  const photos: Photo[] = facts.drives.filter(d => d.img).slice(0, whole ? 18 : 60).map(d => ({ slug: d.slug, title: d.title, img: d.img!, alt: d.alt, date: d.date, place: d.place }))
  const story = (storyDefs as { stories?: { slug: string; topic: string }[] }).stories?.find(st => st.topic === def.slug)
  const drives = whole ? facts.drives.slice(0, 12) : facts.drives
  const years = Object.entries(facts.byYear).sort(([a], [b]) => Number(a) - Number(b))
  const maxYear = Math.max(1, ...years.map(([, v]) => v))
  const group = TOPIC_GROUPS.find(g => g.id === def.group)
  const fill = GROUP_FILL[def.group] || 'var(--welfare)'
  const siblings = TOPICS.filter(x => x.group === def.group && x.slug !== def.slug && !def.related.includes(x.slug))

  return (
    <div className="route-enter pl-page">
      <section className="pl-hero">
        <div className="container">
          <nav className="tp-crumb mono xs upper" aria-label="breadcrumb">
            <Link to="/impact">how we give back</Link> <span aria-hidden>/</span> <Link to="/impact#library">{group?.name || 'library'}</Link>
          </nav>
          <h1 className="giant pl-h1 tp-h1">
            {t(copy.h1Lead)}{' '}
            <span className="underline-doodle pl-accent tp-accent">{t(copy.h1Accent)}</span>.
          </h1>
          <p className="pl-lede"><Rich text={t(copy.lede)} /></p>
        </div>
      </section>

      <div className="container pl-body">
        {facts.count > 0 && <div className="pl-stats tp-stats">
          <div className="card pl-stat"><div className="h-display pl-stat-n"><CountOnView value={facts.count} /></div><div className="pl-stat-l">{whole ? 'drives written up in total' : 'drives written up'}</div></div>
          <div className="card pl-stat"><div className="h-display pl-stat-n"><CountOnView value={facts.volunteers} /></div><div className="pl-stat-l">volunteer turnouts</div></div>
          <div className="card pl-stat"><div className="h-display pl-stat-n">{t('{years}')}</div><div className="pl-stat-l">years active</div></div>
          <div className="card pl-stat"><div className="h-display pl-stat-n"><CountOnView value={facts.placesCount} /></div><div className="pl-stat-l">places</div></div>
        </div>}

        {photos.length > 0 && (
          <div className="tp-photos">
            <div className="tp-photos-h">
              <h2 className="h-display pl-h2">{whole ? 'from recent drives' : 'from the drives'}</h2>
              {story && <Link to={`/impact/stories/${story.slug}`} className="btn btn-sm tp-story-btn">see it as a photo story →</Link>}
            </div>
            <PhotoMosaic photos={photos} label={`photos from ${def.label}`} />
          </div>
        )}

        <div className="pl-sections">
          {copy.sections.map((s, i) => (
            <section key={s.id} id={s.id} className="card pl-section" aria-labelledby={`${s.id}-h`}>
              <span className="pl-kicker mono xs upper" style={{ background: fill }}>{String(i + 1).padStart(2, '0')}</span>
              <h2 id={`${s.id}-h`} className="h-display pl-h2">{t(s.heading)}</h2>
              {s.body.map((p, j) => <p key={j} className="pl-p"><Rich text={t(p)} /></p>)}
            </section>
          ))}
        </div>

        {copy.learnings && copy.learnings.length > 0 && (
          <section className="card tp-learn" aria-labelledby="tp-learn-h">
            <h2 id="tp-learn-h" className="h-display pl-h2">what we have learned</h2>
            <ul className="pl-points">{copy.learnings.map(l => <li key={l}><Rich text={t(l)} /></li>)}</ul>
          </section>
        )}

        {facts.posts && facts.posts.length > 0 && (
          <section className="card tp-drives" aria-labelledby="tp-posts-h">
            <h2 id="tp-posts-h" className="h-display pl-h2">the pieces</h2>
            <p className="pl-p">written by AquaTerra members for Groundwork Diaries, our blog. each opens in full.</p>
            <ul className="tp-post-list">
              {facts.posts.map(p => (
                <li key={p.slug}>
                  <Link to={`/blog/${p.slug}`} className="tp-post">
                    <span className="tp-drive-t">{p.title}</span>
                    {p.excerpt && <span className="tp-post-x">{p.excerpt}{p.excerpt.length >= 200 ? '…' : ''}</span>}
                    {p.date && <span className="tp-drive-m">{fmtDate(p.date)}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {facts.count > 0 && <div className="tp-two">
          {years.length > 1 && (
            <section className="card tp-years" aria-labelledby="tp-years-h">
              <h2 id="tp-years-h" className="mono xs upper muted tp-small-h">drives by year</h2>
              <ul className="tp-bars">
                {years.map(([y, v]) => (
                  <li key={y}>
                    <span className="tp-bar-y">{y}</span>
                    <GrowBar pct={(v / maxYear) * 100} fill={fill} />
                    <span className="tp-bar-n">{v}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {facts.topPlaces.length > 0 && (
            <section className="card tp-places" aria-labelledby="tp-places-h">
              <h2 id="tp-places-h" className="mono xs upper muted tp-small-h">where they happened</h2>
              <ul className="tp-place-list">
                {facts.topPlaces.map(p => <li key={p.name}><span>{p.name}</span><span className="tp-bar-n">{p.count}</span></li>)}
              </ul>
            </section>
          )}
        </div>}

        {facts.count > 0 && <section className="card tp-drives" aria-labelledby="tp-drives-h">
          <h2 id="tp-drives-h" className="h-display pl-h2">{whole ? 'the latest drives' : 'every drive in this series'}</h2>
          <p className="pl-p">each one has its own write-up, with photos, by the students who ran it.</p>
          <ul className="tp-drive-list">
            {drives.map(d => (
              <li key={d.slug}>
                <Link to={`/projects/${d.slug}`} className="tp-drive">
                  <span className="tp-drive-t">{d.title}</span>
                  <span className="tp-drive-m">{[fmtDate(d.date), d.place].filter(Boolean).join(' · ')}</span>
                </Link>
              </li>
            ))}
          </ul>
          {(whole || facts.count > drives.length) && <Link to="/projects" className="btn btn-sm">all {facts.count.toLocaleString('en-IN')} drives →</Link>}
        </section>}

        <section className="pl-faq" aria-labelledby="tp-faq-h">
          <h2 id="tp-faq-h" className="h-display pl-h2">questions, answered</h2>
          <div className="pl-faq-list">
            {copy.faqs.map(f => (
              <div key={f.q} className="card pl-faq-item">
                <h3 className="pl-faq-q">{t(f.q)}</h3>
                <p className="pl-p"><Rich text={t(f.a)} /></p>
              </div>
            ))}
          </div>
        </section>

        <section className="tp-related" aria-labelledby="tp-rel-h">
          <h2 id="tp-rel-h" className="h-display pl-h2">keep reading</h2>
          <div className="tp-rel-grid">
            {def.related.map(r => TOPIC_BY_SLUG[r]).filter(Boolean).map(r => (
              <TiltLink key={r.slug} to={topicPath(r.slug)} className="card tp-rel">
                <span className="tp-rel-g mono xs upper" style={{ background: GROUP_FILL[r.group] }}>{TOPIC_GROUPS.find(g => g.id === r.group)?.name}</span>
                <span className="tp-rel-t">{r.label}</span>
                {TOPIC_INDEX[r.slug] && <span className="tp-rel-n">{TOPIC_INDEX[r.slug].count.toLocaleString('en-IN')} drives</span>}
              </TiltLink>
            ))}
          </div>
        </section>

        <section className="card pl-more" aria-labelledby="tp-more-h">
          <h2 id="tp-more-h" className="mono xs upper muted pl-more-h">more in {group?.name.toLowerCase() || 'the library'}</h2>
          <div className="pl-more-grid">
            {siblings.map(s => <Link key={s.slug} to={topicPath(s.slug)} className="pl-more-a"><span>{s.label}</span></Link>)}
            <Link to="/impact#library" className="pl-more-a"><span>the whole library</span></Link>
            <Link to="/shikshaq" className="pl-more-a"><span>ShikshAQ</span></Link>
            <Link to="/ai" className="pl-more-a"><span>AI at AquaTerra</span></Link>
          </div>
          <Link to="/join" className="btn btn-primary pl-join">join the work →</Link>
        </section>
      </div>
    </div>
  )
}
