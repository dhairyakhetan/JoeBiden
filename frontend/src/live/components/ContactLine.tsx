import { ASK, NEXT_EVENT } from '../config'
import { eventPhase } from '../lib/eventPhase'
import { waNumber } from '../../terrathon/lib/format'

/**
 * "Questions? Message us on WhatsApp." The number is NOT printed here: a student's mobile in body copy on every page invites spam
 * and puts one person on the line for the whole crowd. The Contact page is the one place that shows it. The link still works.
 */
export function ContactLine({ message }: { message?: string }) {
  if (!ASK.phone) return null
  const text = message ? `?text=${encodeURIComponent(message)}` : ''
  return (
    <p className="lv-ask">
      <span>Questions?</span>
      <a className="lv-link" href={`https://wa.me/${waNumber(ASK.phone)}${text}`} target="_blank" rel="noopener noreferrer">Message us on WhatsApp</a>
    </p>
  )
}

/** The message the ticket chat opens with, built from the config so a new night needs no edit here. */
export const ticketMessage = (): string => `Hi, I would like a ticket for ${NEXT_EVENT.name} on ${NEXT_EVENT.dateLabel.replace(/\s\d{4}$/, '')}.`

/** The WhatsApp link that starts a ticket request. Null once the night is over: nobody is offered a ticket for a past date. */
export function ticketHref(now: Date = new Date()): string | null {
  if (!ASK.phone) return null
  if (eventPhase(NEXT_EVENT.date, now) === 'past') return null
  return `https://wa.me/${waNumber(ASK.phone)}?text=${encodeURIComponent(ticketMessage())}`
}
