import { Link } from 'react-router-dom'
import { BOOK_LABEL, LIVE, NEXT_EVENT } from '../config'
import { useEventPhase } from '../lib/hooks'
import { Countdown } from './Countdown'
import { ticketHref } from './ContactLine'

/** The slim strip that pins under the nav once the hero has scrolled away. Once the night is over it points at the Vault instead. */
export function PinnedStrip({ show }: { show: boolean }) {
  const phase = useEventPhase(NEXT_EVENT.date)
  const cta = ticketHref()
  if (!show) return null
  if (phase === 'past') {
    return (
      <div className="lv-pinned" role="region" aria-label="Last event">
        <span className="lv-pinned-name">{NEXT_EVENT.name} · {NEXT_EVENT.dateLabel} · Thank you</span>
        <Link className="lv-btn lv-btn-red lv-btn-sm" to={`${LIVE.base}/vault`}>Open the Vault</Link>
      </div>
    )
  }
  return (
    <div className="lv-pinned" role="region" aria-label="Upcoming event">
      <span className="lv-pinned-name">{NEXT_EVENT.name} · {NEXT_EVENT.dateLabel}</span>
      <Countdown date={NEXT_EVENT.date} compact />
      {cta && <a className="lv-btn lv-btn-red lv-btn-sm" href={cta} target="_blank" rel="noopener noreferrer">{BOOK_LABEL}</a>}
    </div>
  )
}
