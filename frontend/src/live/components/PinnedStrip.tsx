import { BOOK_LABEL, NEXT_EVENT } from '../config'
import { Countdown } from './Countdown'
import { ticketHref } from './ContactLine'

/** The slim strip that pins under the nav once the hero has scrolled away. */
export function PinnedStrip({ show }: { show: boolean }) {
  const cta = ticketHref()
  if (!show) return null
  return (
    <div className="lv-pinned" role="region" aria-label="Upcoming event">
      <span className="lv-pinned-name">{NEXT_EVENT.name} · {NEXT_EVENT.dateLabel}</span>
      <Countdown date={NEXT_EVENT.date} compact />
      {cta && <a className="lv-btn lv-btn-red lv-btn-sm" href={cta} target="_blank" rel="noopener noreferrer">{BOOK_LABEL}</a>}
    </div>
  )
}
