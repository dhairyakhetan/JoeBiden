/**
 * Scheme allow-list for any href built from user- or CMS-supplied data.
 *
 * React does NOT sanitize `javascript:` hrefs — it renders them and only
 * dev-warns. Post link_url, external-achievement proof_url, job-application
 * answers and blog author_url are all stored raw (an <input type="url"> accepts
 * `javascript:...` per spec, and the anon key bypasses the input entirely), then
 * rendered into <a href>. If a moderator opens such a link from the review desk,
 * `javascript:` runs in their authenticated (director/super_admin) session — a
 * stored, privilege-escalating XSS. Route every such href through this helper.
 *
 * Returns the URL only when its protocol is in the allow-list, else undefined
 * (so the caller can omit href / disable the link).
 */
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

export function safeExternalHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  const trimmed = String(url).trim()
  if (!trimmed) return undefined
  // Relative/same-origin paths are always safe (no scheme to abuse).
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed
  try {
    const parsed = new URL(trimmed)
    return SAFE_PROTOCOLS.has(parsed.protocol) ? trimmed : undefined
  } catch {
    // Not an absolute URL and not a rooted path — treat as unsafe rather than
    // guessing (a bare "javascript:alert(1)" throws here on some engines but
    // parses on others, so the allow-list above is the real gate).
    return undefined
  }
}

/** True when a link is a safe same-origin relative path (for client-side nav). */
export function isInternalPath(url: string | null | undefined): boolean {
  return !!url && url.startsWith('/') && !url.startsWith('//')
}
