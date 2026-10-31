import { useEffect } from 'react'
import { CANONICAL_ORIGIN, SITE_NAME, DEFAULT_OG_IMAGE } from './useMeta'

const ORIGIN = CANONICAL_ORIGIN

/**
 * Injects one or more JSON-LD structured-data blocks into <head> for the
 * current route, and removes them on unmount / when the data changes. Each
 * managed <script> is tagged with data-jsonld-id so we only ever touch the
 * ones this hook created - never the static Organization/WebSite/Dataset
 * blocks hard-coded in index.html.
 *
 * A THIRD kind of JSON-LD also lives in <head> on any prerendered route:
 * scripts/prerender-meta.mjs bakes a real BreadcrumbList (and BlogPosting/
 * Article on a blog/project page) into the static HTML as
 * `<script data-prerender="...">`, for a crawler that never runs this
 * bundle. Those are removed once, in main.tsx, right before React mounts -
 * NOT here, and NOT by attribute-matching against data-jsonld-id, because the
 * two systems use unrelated id namespaces (this hook's `id` is a caller-
 * chosen label like 'accounts-breadcrumb'; prerender-meta.mjs's is always
 * literally "breadcrumb" or "ld-N"). See main.tsx's own comment for why a
 * hydrated session used to carry duplicate structured data before that line
 * existed - found and fixed 2026-09-24.
 *
 * Pass `null`/`undefined` entries (e.g. while data is still loading) and they
 * are skipped - nothing is written until real data arrives.
 *
 * The effect keys off the SERIALIZED payload, not the object identity. Callers
 * almost always build the object inline, which produces a fresh reference on
 * every render; keying on identity made this hook rip the <script> out of
 * <head> and re-append it on each render (and forced callers to hoist their
 * payloads to module scope to avoid it - see the note in FAQPage). Serializing
 * once here means an unchanged payload is a genuine no-op.
 */
export function useJsonLd(id: string, data: object | null | undefined) {
  const json = data ? JSON.stringify(data) : ''
  useEffect(() => {
    if (!json || typeof document === 'undefined') return
    const selector = `script[data-jsonld-id="${id}"]`
    let el = document.head.querySelector(selector) as HTMLScriptElement | null
    if (!el) {
      el = document.createElement('script')
      el.type = 'application/ld+json'
      el.setAttribute('data-jsonld-id', id)
      document.head.appendChild(el)
    }
    el.textContent = json
    return () => {
      document.head.querySelector(selector)?.remove()
    }
  }, [id, json])
}

export default useJsonLd

/** The publisher node reused by every Article/BlogPosting/JobPosting block. */
export const PUBLISHER_LD = {
  '@type': 'Organization',
  name: 'NGO AquaTerra',
  url: ORIGIN,
  logo: { '@type': 'ImageObject', url: DEFAULT_OG_IMAGE },
} as const

/** Absolute URL for a site-relative path. */
export const abs = (path: string) => `${ORIGIN}${path}`

/** BreadcrumbList builder - pass ordered [name, path] pairs (path relative). */
export function breadcrumbLd(items: Array<[string, string]>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item: `${ORIGIN}${path}`,
    })),
  }
}

/**
 * ItemList builder for listing routes (blog index, project directory, member
 * directory). Only pass entries that are actually rendered on the page - the
 * list must mirror visible content or it's a structured-data mismatch.
 * Returns null for an empty list so nothing is emitted while data loads.
 */
export function itemListLd(
  name: string,
  items: Array<{ name: string; path: string }>,
) {
  if (!items.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      url: `${ORIGIN}${it.path}`,
    })),
  }
}

/**
 * Person node for a public member profile. PUBLIC FIELDS ONLY - name, role,
 * bio, avatar. Never email, phone, school or anything else behind auth.
 * Returns null without a real name so we never emit an anonymous Person.
 */
export function personLd(p: {
  name?: string | null
  path: string
  jobTitle?: string | null
  bio?: string | null
  image?: string | null
}) {
  if (!p.name) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: p.name,
    url: `${ORIGIN}${p.path}`,
    ...(p.jobTitle ? { jobTitle: p.jobTitle } : {}),
    ...(p.bio ? { description: p.bio } : {}),
    ...(p.image ? { image: p.image } : {}),
    memberOf: { '@type': 'Organization', name: SITE_NAME, url: ORIGIN },
  }
}
