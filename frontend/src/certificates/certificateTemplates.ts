/**
 * Which real template (the Canva designs HR used by hand until 20 Nov 2026) a document type is drawn on.
 *
 * Pure data and one pure function, no canvas, so it can be tested under vitest's node environment. The artwork itself is in
 * `public/certificates/`; `components/certificateGenerator.ts` draws on it. A type with no entry here has no template, and the
 * renderer refuses it rather than drawing the wrong title.
 */

export type TemplateId =
  | 'cert_recognition' | 'cert_internship' | 'cert_internship_ventures'
  | 'letter_recommendation' | 'letter_recognition' | 'letter_internship' | 'letter_acceptance' | 'letter_offer'

/** certificate_types.key to the template it uses. */
const BASE: Record<string, TemplateId> = {
  cert_recognition: 'cert_recognition',
  cert_internship: 'cert_internship',
  lor: 'letter_recommendation',
  letter_recognition: 'letter_recognition',
  letter_internship: 'letter_internship',
  letter_acceptance: 'letter_acceptance',
  letter_offer: 'letter_offer',
}

const normTeam = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

/**
 * The internship certificate has an AQ.Ventures edition (different header, logo and sentence). It is chosen by the teams the
 * member tagged, never by a field they could get wrong: any tagged team called AQ.Ventures selects it.
 */
export function templateFor(typeKey: string, teamNames: readonly string[]): TemplateId | null {
  const base = BASE[typeKey]
  if (!base) return null
  if (base === 'cert_internship' && teamNames.some(n => normTeam(n) === 'aqventures')) return 'cert_internship_ventures'
  return base
}

export const isCertificateTemplate = (t: TemplateId) => t.startsWith('cert_')

/** Files under public/certificates. The acceptance letter shares the offer letter's artwork (its title is redrawn). */
export const BACKDROP: Record<TemplateId, string> = {
  cert_recognition: '/certificates/bg-cert-recognition.webp',
  cert_internship: '/certificates/bg-cert-internship.webp',
  cert_internship_ventures: '/certificates/bg-cert-internship-ventures.webp',
  letter_recommendation: '/certificates/bg-letter-recommendation.webp',
  letter_recognition: '/certificates/bg-letter-recognition.webp',
  letter_internship: '/certificates/bg-letter-internship.webp',
  letter_acceptance: '/certificates/bg-letter-offer.webp',
  letter_offer: '/certificates/bg-letter-offer.webp',
}

export const SIGNATURES_IMAGE = '/certificates/signatures.png'

/** Letters that close with "Sincerely, Krish Goenka, Founder, AquaTerra" (read off the real letters). */
export const LETTER_HAS_CLOSING: Partial<Record<TemplateId, boolean>> = {
  letter_recommendation: true, letter_recognition: true, letter_offer: true,
  letter_internship: false, letter_acceptance: false,
}

/** The acceptance letter is signed by one trustee; every other document by both founders. */
export const SINGLE_SIGNATORY: Partial<Record<TemplateId, boolean>> = { letter_acceptance: true }
