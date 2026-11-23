import { Link } from 'react-router-dom'
import { LIVE } from '../config'
import { ANNOUNCE_HANDLE, ANNOUNCE_HREF, pastLines } from '../lib/eventPhase'

/**
 * What stands where the countdown and the ticket buttons stood once a night is over: a thank-you in the past tense, the way into
 * the Vault and the list of nights, and where the next one is announced. Existing classes only; no motion of its own.
 * `actions={false}` keeps just the words, for a spot that already has its own buttons.
 */
export function PastNight({ name, dateLabel, actions = true }: { name: string; dateLabel: string; actions?: boolean }) {
  const { said } = pastLines({ name, dateLabel })
  return (
    <>
      <p className="dd-hero-lede">{said}</p>
      {actions && (
        <div className="lv-actions dd-hero-actions">
          <Link className="lv-btn lv-btn-gold lv-btn-lg" to={`${LIVE.base}/vault`}>Open the Vault</Link>
          <Link className="lv-btn lv-btn-line lv-btn-lg" to={`${LIVE.base}/events`}>All the nights</Link>
        </div>
      )}
      <p className="lv-ask">
        <span>The next night will be announced on Instagram.</span>
        <a className="lv-link" href={ANNOUNCE_HREF} target="_blank" rel="noopener noreferrer">{ANNOUNCE_HANDLE}</a>
      </p>
    </>
  )
}
