import { Link } from 'react-router-dom'
import { TOPICS, TOPIC_GROUPS, TOPIC_INDEX, topicPath, topicsForDrive } from '../lib/topics/topicKit'
import '../public/TopicPage.css'

/**
 * The impact library's directory, grouped, with each page's live drive count. Shown in full at the end of /impact
 * (id="library") and of /about. Kept at the END of any page it is added to, never in the middle of one.
 */
export function LibraryDirectory({ heading = 'the impact library', intro, id }: { heading?: string; intro?: string; id?: string }) {
  return (
    <section id={id} className="card tp-lib" style={{ padding: 'clamp(20px, 3vw, 28px)' }} aria-labelledby={`${id || 'lib'}-h`}>
      <div>
        <h2 id={`${id || 'lib'}-h`} className="h-display" style={{ fontSize: 'clamp(24px, 3vw, 32px)', margin: '0 0 8px' }}>{heading}</h2>
        <p style={{ fontFamily: 'var(--eina)', fontSize: 16, lineHeight: 1.6, color: 'var(--ink-2)', margin: 0, maxWidth: '68ch' }}>
          {intro || `everything we have learned from ${(TOPIC_INDEX._all?.count ?? 0).toLocaleString('en-IN')} drives written up since 2021, one page per series, workshop, place, year and question. the numbers update themselves.`}
        </p>
      </div>
      <div className="tp-lib-group">
        <h3>Explore</h3>
        <div className="tp-lib-grid">
          <Link to="/impact/stories" className="tp-lib-a"><span>📸 photo stories</span></Link>
          <Link to="/impact/explore/timeline" className="tp-lib-a"><span>🕰️ the timeline</span></Link>
          <Link to="/impact/explore/calculator" className="tp-lib-a"><span>🧮 the impact calculator</span></Link>
          <Link to="/impact/explore/quiz" className="tp-lib-a"><span>🧭 find your drive</span></Link>
          <Link to="/impact/explore/places" className="tp-lib-a"><span>📍 the places</span></Link>
          <Link to="/impact/explore/map" className="tp-lib-a"><span>🗺️ the Kolkata map</span></Link>
          <Link to="/impact/explore/compare" className="tp-lib-a"><span>⚖️ compare two years</span></Link>
          <Link to="/impact/explore/surprise" className="tp-lib-a"><span>🎲 surprise me</span></Link>
          <Link to="/impact/explore/memory" className="tp-lib-a"><span>🃏 photo memory game</span></Link>
        </div>
      </div>
      {TOPIC_GROUPS.map(g => (
        <div key={g.id} className="tp-lib-group">
          <h3>{g.name}</h3>
          <div className="tp-lib-grid">
            {TOPICS.filter(t => t.group === g.id).map(t => (
              <Link key={t.slug} to={topicPath(t.slug)} className="tp-lib-a">
                <span>{t.label}</span>
                {g.id !== 'guides' && TOPIC_INDEX[t.slug] && <span className="tp-lib-n">{TOPIC_INDEX[t.slug].count}</span>}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

/** End-of-page card on a drive's write-up: the library pages this drive belongs to. Renders nothing if none match. */
export function DriveTopicsCard({ drive }: { drive: { header?: string | null; location?: string | null; short_summary?: string | null; objective?: string | null; workshop_date?: string | null } }) {
  const hits = topicsForDrive(drive).slice(0, 6)
  if (!hits.length) return null
  return (
    <section className="card tp-lib" style={{ padding: 'clamp(18px, 3vw, 24px)', marginTop: 32 }} aria-labelledby="drive-topics-h">
      <h2 id="drive-topics-h" className="mono xs upper muted" style={{ fontWeight: 700, fontSize: 12, margin: 0 }}>this drive is part of</h2>
      <div className="tp-lib-grid">
        {hits.map(t => (
          <Link key={t.slug} to={topicPath(t.slug)} className="tp-lib-a">
            <span>{t.label}</span>
            {TOPIC_INDEX[t.slug] && <span className="tp-lib-n">{TOPIC_INDEX[t.slug].count} drives</span>}
          </Link>
        ))}
        <Link to="/impact#library" className="tp-lib-a"><span>the whole library →</span></Link>
      </div>
    </section>
  )
}
