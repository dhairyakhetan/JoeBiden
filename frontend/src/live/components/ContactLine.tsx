import { ASK } from '../config'
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

/** The WhatsApp link that starts a ticket request. */
export function ticketHref(): string | null {
  if (!ASK.phone) return null
  const msg = 'Hi, I would like a ticket for Disco Diwali on 10 November.'
  return `https://wa.me/${waNumber(ASK.phone)}?text=${encodeURIComponent(msg)}`
}
