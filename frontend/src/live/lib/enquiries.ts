import { supabaseCommunity } from '../../lib/supabaseCommunity'
import { normalisePhone } from '../../terrathon/lib/format'

export const TOPICS = [
  { value: 'tickets', label: 'Tickets' },
  { value: 'sponsor', label: 'Sponsoring a night' },
  { value: 'stall', label: 'Running a stall' },
  { value: 'performer', label: 'Performing' },
  { value: 'press', label: 'Press' },
  { value: 'photo', label: 'A photo of me' },
  { value: 'other', label: 'Something else' },
] as const

export type Topic = (typeof TOPICS)[number]['value']

export interface EnquiryInput { name: string; contact: string; topic: string; message: string; website?: string }
export interface Enquiry { name: string; contact: string; topic: Topic; message: string }
export type EnquiryErrors = Partial<Record<'name' | 'contact' | 'topic' | 'message', string>>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Checks what a visitor typed and returns either the cleaned enquiry or one plain message per field. A phone number is stored in
 * its +91 form so the team can tap it; an email is lowercased. `website` is a honeypot: a human never sees it, so a filled one is
 * a bot and is reported as `spam` for the caller to swallow quietly (a bot should not learn the field exists).
 */
export function validateEnquiry(i: EnquiryInput): { ok: true; value: Enquiry } | { ok: false; spam?: true; errors: EnquiryErrors } {
  if ((i.website ?? '').trim()) return { ok: false, spam: true, errors: {} }
  const errors: EnquiryErrors = {}
  const name = i.name.trim().replace(/\s+/g, ' ')
  const message = i.message.trim()
  const raw = i.contact.trim()
  if (name.length < 1) errors.name = 'Tell us your name.'
  else if (name.length > 80) errors.name = 'Keep your name under 80 characters.'
  let contact = ''
  if (EMAIL.test(raw)) contact = raw.toLowerCase()
  else {
    const p = normalisePhone(raw)
    if (p) contact = p
    else errors.contact = 'Give us a mobile number or an email we can reply to.'
  }
  if (!TOPICS.some(t => t.value === i.topic)) errors.topic = 'Pick what this is about.'
  if (message.length < 10) errors.message = 'Say a little more, at least a sentence.'
  else if (message.length > 1000) errors.message = 'Keep it under 1000 characters.'
  if (Object.keys(errors).length) return { ok: false, errors }
  return { ok: true, value: { name, contact, topic: i.topic as Topic, message } }
}

/** Saves an enquiry for the team's inbox. Throws on error; the form owns the feedback. Table: scripts/live_enquiries_2026_10_24.sql. */
export async function submitEnquiry(e: Enquiry): Promise<void> {
  const { error } = await (supabaseCommunity as any).from('live_enquiries').insert(e)
  if (error) throw error
}

export interface EnquiryRow extends Enquiry { id: string; created_at: string; handled: boolean }

export async function listEnquiries(): Promise<EnquiryRow[]> {
  const { data, error } = await (supabaseCommunity as any).from('live_enquiries').select('*').order('created_at', { ascending: false }).limit(300)
  if (error) throw error
  return (data ?? []) as EnquiryRow[]
}

export async function setEnquiryHandled(id: string, handled: boolean): Promise<void> {
  const { data, error } = await (supabaseCommunity as any).from('live_enquiries').update({ handled }).eq('id', id).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error('The database did not accept that. Your account may not have permission.')
}
