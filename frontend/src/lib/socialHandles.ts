/**
 * Normalising what someone types into the LinkedIn and Instagram fields on Edit Profile.
 *
 * People paste all sorts: a full URL, "linkedin.com/in/name", "in/name", "@name", just "name". Each normaliser returns
 *   { value }  the canonical form to store (LinkedIn: https URL; Instagram: bare handle, no "@")
 *   { empty }  the box was blank (clears the field)
 *   { error }  a sentence for the field
 * and never accepts anything that is not a LinkedIn profile URL or a plausible handle, so nothing arbitrary is stored and
 * later rendered as a link.
 */
export type HandleResult = { value: string } | { empty: true } | { error: string }

const LI_SLUG = /^[A-Za-z0-9À-ɏ%._-]{3,100}$/

export function normalizeLinkedIn(input: string | null | undefined): HandleResult {
  const raw = (input ?? '').trim()
  if (!raw) return { empty: true }
  let rest = raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
  if (/^[a-z]{2}\.linkedin\.com\//i.test(rest)) rest = rest.replace(/^[a-z]{2}\./i, '') // country subdomains
  if (/^linkedin\.com\//i.test(rest)) rest = rest.replace(/^linkedin\.com\//i, '')
  else if (/\./.test(rest.split('/')[0] ?? '') && !/^in\//i.test(rest)) return { error: 'that does not look like a LinkedIn profile link.' }
  rest = rest.replace(/[?#].*$/, '').replace(/\/+$/, '')
  rest = rest.replace(/^in\//i, '')
  if (rest.includes('/')) return { error: 'use your profile link, like linkedin.com/in/your-name.' }
  if (!LI_SLUG.test(rest)) return { error: 'that does not look like a LinkedIn profile name.' }
  return { value: `https://www.linkedin.com/in/${rest}` }
}

export function normalizeInstagram(input: string | null | undefined): HandleResult {
  let raw = (input ?? '').trim()
  if (!raw) return { empty: true }
  raw = raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/^instagram\.com\//i, '').replace(/[?#].*$/, '').replace(/\/+$/, '').replace(/^@/, '')
  if (raw.includes('/')) return { error: 'use just your handle, like @your.name.' }
  if (!/^[A-Za-z0-9._]{1,30}$/.test(raw) || /^\.|\.$|\.\./.test(raw)) return { error: 'an Instagram handle is letters, numbers, dots and underscores, up to 30.' }
  return { value: raw }
}
