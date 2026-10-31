import { useEffect, useLayoutEffect } from 'react'
import { sized } from '../lib/imageUrl'
import { ORG_FACTS, displayCount } from '../lib/orgFacts'

/**
 * The one canonical production origin. Every deployment surface (apex
 * ngoaquaterra.com, the vercelaq.vercel.app preview domain, http variants)
 * must canonicalize to THIS host, or search engines see the same content on
 * several URLs and split ranking signal. robots.txt + sitemap.xml + the static
 * index.html canonical all already use www.ngoaquaterra.com - match them here.
 */
export const CANONICAL_ORIGIN = 'https://www.ngoaquaterra.com'

export const SITE_NAME = 'AquaTerra'

/**
 * Site-level social-card fallback. og-meadow.jpg is the real 1200x630 brand
 * card index.html already uses for the homepage card, so using it here keeps the
 * runtime fallback consistent with the served HTML. (Previously this pointed at
 * the 17KB square /logo.png, which crawlers crop or reject under
 * twitter:card=summary_large_image, and which disagreed with index.html.)
 */
export const DEFAULT_OG_IMAGE = `${CANONICAL_ORIGIN}/og-meadow.jpg`
export const DEFAULT_OG_IMAGE_ALT = 'AquaTerra - student-led NGO, Kolkata'
export const DEFAULT_DESCRIPTION =
  `AquaTerra: a student-led community and NGO in Kolkata where ${displayCount(ORG_FACTS.membersTotal)} teenagers run real welfare, climate and education projects.`

interface UseMetaProps {
  /** Page title. Falls back to the site name when empty (never emit ''). */
  title: string
  /** ~150-160 chars, human-written, describing THIS page. */
  description?: string
  /** Record image (any host). Auto-absolutized + run through `sized()`. */
  image?: string
  /** Alt text for the social card image. */
  imageAlt?: string
  /** Full URL or path. Normalized to the canonical origin + pathname. */
  url?: string
  /**
   * The route's static path, e.g. from metaConfig.ts's `path` field. Used as
   * the canonical fallback when `url` isn't given - EXCEPT when it still
   * carries a `:param` template (metaConfig.ts's `projectDetail`, `blogPost`,
   * `publicProfile`, `post`, `teamDetail` and the two paradox entries all
   * have one), since a literal `/blog/:slug` is not a real URL. The two
   * confirmed call sites for a templated entry (BlogPostPage,
   * PublicProjectDetailPage) already build a fresh object rather than
   * spreading the template, so they were never at risk - this guard exists
   * for any call site that spreads one directly, now or later.
   */
  path?: string
  type?: 'website' | 'article' | 'profile'
  author?: string
  publishDate?: string
  modifiedDate?: string
  /** Unlisted/utility routes that must never be indexed (/brand, 404). */
  noIndex?: boolean
}

// useLayoutEffect on the client, useEffect on server (avoids SSR warning)
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

/**
 * Every meta tag this hook is allowed to create OR delete, as
 * [key, isProperty] pairs. Anything listed here that is NOT in a given page's
 * desired set gets REMOVED on that render.
 *
 * This is the fix for the classic SPA meta-leak: the previous implementation
 * only ever wrote tags behind `if (image)` / `if (type === 'article')` guards,
 * so a blog post's og:image, article:author and article:published_time stayed
 * in <head> after navigating to /contact - every subsequent share preview
 * carried the wrong article's cover art and byline until a hard reload.
 */
const MANAGED: Array<[string, boolean]> = [
  ['description', false],
  ['robots', false],
  ['author', false],
  ['twitter:card', false],
  ['twitter:title', false],
  ['twitter:description', false],
  ['twitter:image', false],
  ['twitter:image:alt', false],
  ['og:type', true],
  ['og:title', true],
  ['og:description', true],
  ['og:url', true],
  ['og:site_name', true],
  ['og:locale', true],
  ['og:image', true],
  ['og:image:alt', true],
  // These four describe the image itself, so they must be removed whenever the
  // page uses a record image whose dimensions we cannot know. secure_url was
  // missing from this list until 2026-09-17 and therefore survived from
  // index.html, advertising the default image alongside a different og:image.
  ['og:image:secure_url', true],
  ['og:image:width', true],
  ['og:image:height', true],
  ['og:image:type', true],
  ['article:author', true],
  ['article:published_time', true],
  ['article:modified_time', true],
  ['profile:username', true],
]

const selectorFor = (key: string, isProperty: boolean) =>
  isProperty ? `meta[property="${key}"]` : `meta[name="${key}"]`

const writeMeta = (key: string, content: string, isProperty: boolean) => {
  const selector = selectorFor(key, isProperty)
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(isProperty ? 'property' : 'name', key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

/**
 * Build a clean canonical URL: force the production origin, keep only the
 * pathname (drop query strings + hash - ?ref=, ?category=, #comments etc. are
 * the same indexable page), and strip a trailing slash except on root.
 */
export const toCanonical = (raw?: string): string => {
  let pathname = '/'
  try {
    pathname = raw ? new URL(raw, CANONICAL_ORIGIN).pathname
                   : (typeof window !== 'undefined' ? window.location.pathname : '/')
  } catch { /* keep root */ }
  if (pathname.length > 1) pathname = pathname.replace(/\/+$/, '')
  return CANONICAL_ORIGIN + pathname
}

/**
 * Absolute, right-sized social image.
 *
 * - Relative paths (`/logo.png`) are resolved against the canonical origin -
 *   og:image MUST be absolute or crawlers drop the card entirely.
 * - Remote covers go through `sized(url, 'cover')` so a 3.3 MB Framer original
 *   isn't what WhatsApp/Slack fetch for a link preview (see lib/imageUrl.ts).
 * - Anything unparseable falls back to the site default rather than emitting a
 *   broken og:image.
 */
const toSocialImage = (raw?: string): string => {
  const src = (raw || '').trim()
  // A leftover template placeholder ("{postImage}") is not an image.
  if (!src || src.startsWith('{')) return DEFAULT_OG_IMAGE
  if (src.startsWith('data:') || src.startsWith('blob:')) return DEFAULT_OG_IMAGE
  try {
    return new URL(sized(src, 'cover'), CANONICAL_ORIGIN).href
  } catch {
    return DEFAULT_OG_IMAGE
  }
}

/**
 * One call per page sets the complete, valid metadata set: <title>,
 * meta[name=description], link[rel=canonical], the og:* block and the
 * twitter:* card - with site-level fallbacks, so a page that passes only a
 * title still emits a coherent share card instead of a half-populated one.
 *
 * Uses useLayoutEffect for document.title so it updates synchronously before
 * paint, preventing the "flash of stale title" during SPA route changes.
 */
export const useMeta = ({
  title,
  description,
  image = '',
  imageAlt,
  url,
  path,
  type = 'website',
  author,
  publishDate,
  modifiedDate,
  noIndex = false,
}: UseMetaProps) => {
  // Never let an un-substituted template ("{userName} | …") reach the tab or a
  // crawler while a record is still loading - fall back to the site name.
  const safeTitle = title && !title.includes('{') ? title : SITE_NAME
  const safeDescription =
    description && !description.includes('{') ? description : DEFAULT_DESCRIPTION

  // Set title synchronously BEFORE paint to prevent flicker on route change
  useIsomorphicLayoutEffect(() => {
    if (typeof document !== 'undefined') document.title = safeTitle
  }, [safeTitle])

  // Other meta tags can update after paint (crawlers read the final DOM)
  useEffect(() => {
    if (typeof document === 'undefined') return

    // Clean, host-normalized canonical - used for BOTH <link canonical> and
    // og:url so crawlers never see the raw href (query/hash/preview-host).
    // `path` (metaConfig.ts's own field) is the explicit fallback ahead of
    // `window.location.pathname` - see the prop's own doc comment for why a
    // still-templated path ("/blog/:slug") is excluded rather than used.
    const fallbackPath = path && !path.includes(':') ? path : undefined
    const canonicalUrl = toCanonical(url || fallbackPath)
    const ogImage = toSocialImage(image)
    const usingDefaultImage = ogImage === DEFAULT_OG_IMAGE

    const desired = new Map<string, string>()
    const set = (key: string, value: string | undefined | null) => {
      if (value) desired.set(key, value)
    }

    set('description', safeDescription)
    if (noIndex) set('robots', 'noindex, follow')

    set('og:type', type)
    set('og:title', safeTitle)
    set('og:description', safeDescription)
    set('og:url', canonicalUrl)
    set('og:site_name', SITE_NAME)
    set('og:locale', 'en_IN')
    set('og:image', ogImage)
    set('og:image:alt', imageAlt || (usingDefaultImage ? DEFAULT_OG_IMAGE_ALT : safeTitle))

    // og:image:width/height/type and og:image:secure_url describe THE IMAGE, so
    // they are only true while the image is the default one we ship and can
    // measure (public/og-meadow.jpg, verified 1200x630 JPEG). A record image
    // from Supabase or Framer has dimensions we do not know at render time.
    //
    // Before 2026-09-17 (audit, SEO P3) the width/height/type trio sat in
    // MANAGED but was never `set`, so useMeta DELETED index.html's correct
    // static values on first render and never replaced them: every page lost
    // the dimensions, including the ones still using the default image.
    // Meanwhile og:image:secure_url was not managed at all, so it kept pointing
    // at og-meadow.jpg on a page whose og:image had been swapped to a record
    // image - a card advertising two different images.
    //
    // Now: assert all four when the default image is in use, and let MANAGED
    // remove all four when it is not. Wrong dimensions make a crawler reject
    // the card; absent dimensions only make it fetch the image to find out.
    if (usingDefaultImage) {
      set('og:image:secure_url', ogImage)
      set('og:image:type', 'image/jpeg')
      set('og:image:width', '1200')
      set('og:image:height', '630')
    }

    // An og:image is always present now, so the large card is always correct.
    set('twitter:card', 'summary_large_image')
    set('twitter:title', safeTitle)
    set('twitter:description', safeDescription)
    set('twitter:image', ogImage)
    set('twitter:image:alt', imageAlt || (usingDefaultImage ? DEFAULT_OG_IMAGE_ALT : safeTitle))

    // Article byline/dates - only on article pages, and only when real. Listed
    // in MANAGED so they are actively deleted when the next route isn't one.
    if (type === 'article') {
      set('author', author)
      set('article:author', author)
      set('article:published_time', publishDate)
      set('article:modified_time', modifiedDate)
    }

    for (const [key, isProperty] of MANAGED) {
      const value = desired.get(key)
      if (value) writeMeta(key, value, isProperty)
      else document.head.querySelector(selectorFor(key, isProperty))?.remove()
    }

    // Canonical URL - clean, host-normalized (never the raw href)
    let canonical = document.head.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', canonicalUrl)
  }, [safeTitle, safeDescription, image, imageAlt, url, path, type, author, publishDate, modifiedDate, noIndex])
}

export default useMeta
