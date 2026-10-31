import { Link } from 'react-router-dom'
import { LIVE } from '../config'
import type { LiveEvent } from '../data/content'

/** One night in the list: when, the name in blackletter, a line about it, and whether it is next or done. */
export function EventRow({ ev }: { ev: LiveEvent }) {
  return (
    <li>
      <Link className="lv-event-row" to={`${LIVE.base}/events/${ev.slug}`}>
        <span className="when">{ev.dateLabel}</span>
        <span>
          <h3>{ev.name}{ev.edition ? <> <em>{ev.edition.replace(/^The /, '')}</em></> : null}</h3>
          <p className="blurb">{ev.blurb}</p>
        </span>
        <span className={'lv-sticker ' + (ev.status === 'upcoming' ? 'is-red' : 'is-past')}>{ev.status === 'upcoming' ? 'Upcoming' : 'Past'}</span>
      </Link>
    </li>
  )
}
