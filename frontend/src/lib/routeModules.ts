/**
 * The public-facing route surface's lazy-chunk loaders, and the prefetcher
 * that warms them.
 * ────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 *
 * This is the same fix director/deskModules.ts already shipped for the HoD
 * desk's 18 tabs, applied to the public marketing/content routes instead.
 * Every public page is its own `lazy()` chunk (App.tsx) - correct for initial
 * bundle size, since a first-time visitor shouldn't download every page to
 * render one - but it meant the chunk request only STARTED on click, so every
 * nav-link click paid a full network round-trip before the route could even
 * begin rendering. That reads as sluggish page-switching.
 *
 * The fix is not to stop splitting - it's to start the fetch earlier. The
 * same loader function is used for BOTH `React.lazy()` (in App.tsx / the
 * few places a route's component is lazily created elsewhere, e.g.
 * auth/HomeRoute.tsx for HomePage) and the prefetcher (wired into AQNav's
 * and AQFooter's link hover/focus handlers). Because the ES module registry
 * caches by resolved module, a hover-prefetch and the subsequent `lazy()`
 * mount resolve to the SAME promise - a prefetched route mounts with no
 * network wait at all, and a non-prefetched one behaves exactly as before.
 *
 * SCOPE - this file moves JAVASCRIPT only. It does not prefetch, cache or
 * retain any route's DATA. Every page still runs its own fresh query on
 * mount.
 *
 * WHAT'S DELIBERATELY NOT HERE - /director/* (already solved by
 * deskModules.ts's own prefetcher), /paradox/* (its own ~200KB sub-app,
 * explicitly not something to warm speculatively), /demo/* (the guided-demo
 * sandbox - out of scope), and every auth-gated dashboard route
 * (/notifications, /saved, /my-posts, /profile, /settings, /search, /calendar,
 * /yearbook, /invite, /choose-team). Downloading a lazy chunk leaks no
 * privilege signal by itself (the JS is a public static asset either way),
 * but there is no benefit to warming a route most visitors will never reach
 * without signing in first, so this map only covers the public
 * marketing/content surface that AQNav and AQFooter actually link to.
 *
 * Route components with a required URL param (TeamDetailPage, BlogPostPage,
 * OpeningDetailPage, PublicProjectDetailPage, PostPage, PublicProfilePage)
 * aren't here either - nothing in AQNav/AQFooter links to a fixed instance of
 * any of them, so there's no static `href` a hover handler could key off.
 *
 * ADDING A ROUTE stays simple: an entry in `ROUTE_LOADERS`, and (if it should
 * resolve from an `href`/`to` string in a nav link) an entry in
 * `PATH_TO_ROUTE_KEY`. Both are used from App.tsx's own `lazy()` calls where
 * the route lives directly there, so a typo becomes a `tsc -b` error rather
 * than a silently un-prefetched link.
 */
import type { ComponentType } from 'react'

/** What `React.lazy()` accepts, and what a dynamic `import()` of a page gives. */
type RouteLoader = () => Promise<{ default: ComponentType<any> }>

export type RouteKey =
  | 'home' | 'projects' | 'teams' | 'members' | 'blog' | 'opportunities'
  | 'about' | 'faq' | 'contact' | 'support' | 'collaborations' | 'crftd'
  | 'volunteer' | 'equityPolicy' | 'links' | 'schools' | 'classes'
  | 'directory' | 'terranotes' | 'login' | 'join' | 'brand' | 'privacyPolicy' | 'accounts'

/**
 * RouteKey -> the module that renders it. The specifiers must stay STRING
 * LITERALS - Rollup can only cut a chunk for an `import()` it can read
 * statically, and a computed specifier would silently collapse these into one
 * bundle, the exact thing the per-route split exists to prevent.
 */
export const ROUTE_LOADERS: Record<RouteKey, RouteLoader> = {
  home:           () => import('../public/HomePage'),
  projects:       () => import('../public/PublicProjectsPage'),
  teams:          () => import('../teams/TeamsPage'),
  members:        () => import('../public/MembersPage'),
  blog:           () => import('../public/BlogListPage'),
  opportunities:  () => import('../public/OpportunitiesPage'),
  about:          () => import('../public/AboutPage'),
  faq:            () => import('../public/FAQPage'),
  contact:        () => import('../public/ContactPage'),
  support:        () => import('../public/SupportPage'),
  collaborations: () => import('../public/CollaborationsPage'),
  crftd:          () => import('../public/RootsPage'),
  volunteer:      () => import('../public/VolunteerHandbookPage'),
  equityPolicy:   () => import('../public/EquityPolicyPage'),
  links:          () => import('../public/QuickLinksPage'),
  schools:        () => import('../public/SchoolsPage'),
  classes:        () => import('../public/ClassesPage'),
  directory:      () => import('../public/DirectoryPage'),
  terranotes:     () => import('../terranotes/TerraNotesRoot.jsx'),
  login:          () => import('../auth/LoginPage'),
  join:           () => import('../public/JoinPromoPage'),
  brand:          () => import('../public/BrandPage'),
  privacyPolicy:  () => import('../public/PrivacyPolicyPage'),
  accounts:       () => import('../public/AccountsPage'),
}

/**
 * Routes whose fetch has already been kicked off this page-load. The module
 * registry would dedupe a repeat call anyway; this just avoids re-entering
 * the loader on every mousemove over a nav item.
 *
 * A FAILED load is removed again, so a prefetch that lost the network doesn't
 * poison the real click - `lazy()` will simply request it for real.
 */
const started = new Set<RouteKey>()

/**
 * Warm one route's chunk. Safe to call as often as you like, from a hover, a
 * focus, or an idle callback. Never throws and never blocks: a prefetch is a
 * hint, and a failed hint must be indistinguishable from never having tried.
 */
export function prefetchRoute(key: RouteKey): void {
  if (started.has(key)) return
  const load = ROUTE_LOADERS[key]
  if (!load) return
  started.add(key)
  try {
    load().catch(() => { started.delete(key) })
  } catch {
    started.delete(key)
  }
}

/** True once `prefetchRoute` has been called for `key` and hasn't failed. */
export function isRoutePrefetched(key: RouteKey): boolean {
  return started.has(key)
}

/**
 * Warm several routes once the browser is genuinely idle.
 *
 * `requestIdleCallback` is unimplemented in Safari (all versions as of this
 * writing), so it falls back to a `setTimeout` - deliberately a long-ish one,
 * because the point is to spend bandwidth the user isn't using, not to race
 * a page's own first data fetch.
 *
 * Returns a cancel function; callers should call it on unmount so a fast
 * navigation away doesn't leave a queued download of a route nobody is going
 * to open.
 */
export function prefetchRoutesWhenIdle(keys: RouteKey[], delayMs = 1200): () => void {
  if (keys.length === 0) return () => {}
  const run = () => { for (const k of keys) prefetchRoute(k) }

  const ric = (globalThis as any).requestIdleCallback as
    | ((cb: () => void, opts?: { timeout: number }) => number)
    | undefined

  if (typeof ric === 'function') {
    const id = ric(run, { timeout: 4000 })
    const cancel = (globalThis as any).cancelIdleCallback as ((id: number) => void) | undefined
    return () => { if (typeof cancel === 'function') cancel(id) }
  }

  const t = setTimeout(run, delayMs)
  return () => clearTimeout(t)
}

/**
 * `href`/`to` string (as used throughout AQNav/AQFooter's link arrays) -> the
 * RouteKey that path mounts. Only exact matches for a route with no required
 * param are listed - see the file header for why the param routes aren't
 * here. Unknown paths (external URLs, `/director`, auth-gated dashboard
 * routes, anything not in `ROUTE_LOADERS`) return null and prefetch nothing -
 * a link out of this map must never be guessed at.
 */
const PATH_TO_ROUTE_KEY: Record<string, RouteKey> = {
  '': 'home',
  'projects': 'projects',
  'teams': 'teams',
  'members': 'members',
  'blog': 'blog',
  'opportunities': 'opportunities',
  'about': 'about',
  'faq': 'faq',
  'contact': 'contact',
  'support': 'support',
  'collaborations': 'collaborations',
  'crftd': 'crftd',
  'volunteer': 'volunteer',
  'equity-policy': 'equityPolicy',
  'links': 'links',
  'schools': 'schools',
  'classes': 'classes',
  'directory': 'directory',
  'labs': 'terranotes',
  'terranotes': 'terranotes',
  'login': 'login',
  'join': 'join',
  'brand': 'brand',
  'privacy-policy': 'privacyPolicy',
  'accounts': 'accounts',
}

/** `href` -> RouteKey, or null if `href` isn't a static public content route. */
export function routeKeyForPath(pathname: string): RouteKey | null {
  // Strip a leading slash and any query/hash, then trailing slashes, so
  // '/', '/projects', '/projects/', '/faq#top' etc. all resolve.
  const rest = pathname
    .split(/[?#]/)[0]
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
  return PATH_TO_ROUTE_KEY[rest] ?? null
}

/** `prefetchRoute`, addressed by an `href`/`to` string. No-op for anything not in the map. */
export function prefetchRouteByPath(pathname: string): void {
  const key = routeKeyForPath(pathname)
  if (key) prefetchRoute(key)
}
