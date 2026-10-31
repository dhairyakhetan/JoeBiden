import { ASK } from '../config'
import { waNumber } from '../../terrathon/lib/format'

/** A WhatsApp link to the one person who answers everything, with the message already typed. Null when no number is set. */
export function whatsappHref(message: string): string | null {
  if (!ASK.phone) return null
  return `https://wa.me/${waNumber(ASK.phone)}?text=${encodeURIComponent(message)}`
}

/** The route for asking for one photo to be taken down. Photos are described by id, never by who is in them. */
export function takedownHref(photoId: string): string | null {
  return whatsappHref(`Hi, I would like photo "${photoId}" on AquaTerra.live (the Vault) to be taken down.`)
}
