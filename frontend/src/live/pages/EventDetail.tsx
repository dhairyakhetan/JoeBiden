import { Link, useParams } from 'react-router-dom'
import { useMeta } from '../../hooks/useMeta'
import { BOOK_LABEL, LIVE } from '../config'
import { findEvent } from '../data/content'
import { useLiveContent } from '../lib/useContent'
import { Photo } from '../components/Photo'
import { photo as photoById } from '../data/photos'
import { Kicker } from '../components/Headline'
import { ContactLine, ticketHref } from '../components/ContactLine'
import { LiveNotFound } from './NotFound'

/** One night. Every optional block (highlights, photos, sponsors, stalls, performers) is hidden when it has nothing true to say. */
export function LiveEventDetail() {
  const { slug } = useParams()
  const { events, ready } = useLiveContent()
  const ev = findEvent(events, slug)
  useMeta(ev
    ? { title: `${ev.name}${ev.edition ? `, ${ev.edition}` : ''} | AquaTerra.live`, description: ev.blurb, path: `${LIVE.base}/events/${ev.slug}` }
    : { title: 'Not found | AquaTerra.live', description: 'That night is not on AquaTerra.live.', path: LIVE.base, noIndex: true })
  // a night an admin just added is not in the typed fallback, so wait for the fetch instead of flashing "not found"
  if (!ev && !ready) return <main id="lv-main" className="lv-main lv-page"><div className="lv-fallback" role="status" aria-label="Loading"><span className="lv-spinner" aria-hidden /></div></main>
  if (!ev) return <LiveNotFound />
  const cta = ev.status === 'upcoming' ? ticketHref() : null
  const lists: [string, string[] | undefined][] = [['Sponsors', ev.sponsors], ['Stalls', ev.stalls], ['Performers', ev.performers]]
  return (
    <main id="lv-main" className="lv-main">
      <section className="lv-hero-grad lv-event-hero">
        <p className="lv-kicker dd-kick"><Link to={`${LIVE.base}/events`}>The nights</Link> / {ev.dateLabel}</p>
        <span className={'lv-sticker ' + (ev.status === 'upcoming' ? 'is-red' : 'is-past')}>{ev.status === 'upcoming' ? 'Upcoming' : 'Past'}</span>
        <h1 className="lv-display lv-event-h">{ev.name}</h1>
        {ev.edition && <p className="dd-sub">{ev.edition}</p>}
        <p className="dd-hero-lede">{ev.blurb}</p>
        <ul className="lv-facts">
          <li><b>When</b> {ev.dateLabel}{ev.time ? `, ${ev.time}` : ''}</li>
          {ev.venue && <li><b>Where</b> {ev.venue}, Kolkata</li>}
        </ul>
        <div className="lv-actions dd-hero-actions">
          {ev.href && (ev.href.startsWith('/live')
            ? <Link className="lv-btn lv-btn-gold lv-btn-lg" to={ev.href}>{ev.status === 'upcoming' ? 'See the night' : 'Read the story'}</Link>
            : <Link className="lv-btn lv-btn-gold lv-btn-lg" to={ev.href}>Go to the {ev.name} site</Link>)}
          {cta && <a className="lv-btn lv-btn-ink lv-btn-lg" href={cta} target="_blank" rel="noopener noreferrer">{BOOK_LABEL}</a>}
        </div>
      </section>

      {ev.highlights && ev.highlights.length > 0 && (
        <section className="lv-section lv-reveal-static" aria-label="Highlights">
          <Kicker>Good to know</Kicker>
          <ul className="lv-bullets">{ev.highlights.map(h => <li key={h}>{h}</li>)}</ul>
        </section>
      )}

      {ev.photos && ev.photos.length > 0 && (
        <section className="lv-section" aria-label="Photos">
          <Kicker>From the night</Kicker>
          <ul className="lv-gallery lv-gallery-flat">
            {ev.photos.map(id => <li key={id}><Photo id={id} size="m" alt={photoById(id).alt} /></li>)}
          </ul>
          <p className="lv-fine">More in <Link className="lv-link" to={`${LIVE.base}/vault`}>the Vault</Link>.</p>
        </section>
      )}

      {lists.map(([label, items]) => items && items.length > 0 && (
        <section key={label} className="lv-section" aria-label={label}>
          <Kicker>{label}</Kicker>
          <ul className="lv-bullets">{items.map(x => <li key={x}>{x}</li>)}</ul>
        </section>
      ))}

      <section className="lv-section">
        <ContactLine message={`Hi, I have a question about ${ev.name}.`} />
      </section>
    </main>
  )
}
