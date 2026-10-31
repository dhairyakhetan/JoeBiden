/**
 * The HoD desk's lazy-chunk loaders, and the prefetcher that warms them.
 * ────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 *
 * Every desk is its own route with its own `lazy()` chunk (CLAUDE.md, "Lazy
 * loaded director tabs") - deliberately, so opening the desk doesn't download
 * all eighteen tabs. That split is worth keeping; what it cost was that the
 * chunk request only STARTED on click, so every tab switch began with a
 * network round-trip the user had already paid attention for.
 *
 * The fix is not to stop splitting - it's to start the fetch earlier. The same
 * loader function is used for BOTH `React.lazy()` (in App.tsx) and the
 * prefetcher (in DirectorDashboard's nav), which matters: the ES module
 * registry caches by specifier, so a hover-prefetch and the subsequent
 * `lazy()` mount resolve to the SAME promise. A prefetched desk mounts with no
 * network wait at all; a non-prefetched one behaves exactly as before. There
 * is no separate cache to invalidate and no way for the two to disagree.
 *
 * SCOPE - this file moves JAVASCRIPT only. It does not prefetch, cache or
 * retain any desk's DATA. Every desk still runs its own fresh query on mount,
 * so a director never sees a stale moderation queue.
 *
 * ACCESS - prefetching is not authorization. `DESK_LOADERS` is keyed by
 * `NavKey` and downloading a chunk grants nothing: the route still renders
 * behind `deskAccess.ts`'s privilege gate (`ProtectedRoute requireSuperAdmin`
 * for `privilege: 'super'`). Callers here nonetheless only ever prefetch desks
 * that already passed `isDeskVisible()` for the current viewer, so a plain
 * HoD's browser doesn't even fetch the bytes of a super-only desk.
 *
 * ADDING A DESK stays a three-line job, same as before: a `DESKS` entry in
 * deskAccess.ts, a loader here, and a `DESK_ELEMENTS` entry in App.tsx. All
 * three are total `Record<NavKey, …>`s, so missing any one is a `tsc -b`
 * error rather than a silently dead tab.
 */
import type { ComponentType } from 'react'
import { DESKS } from './deskAccess'
import type { NavKey } from './deskAccess'

/** What `React.lazy()` accepts, and what a dynamic `import()` of a desk gives. */
type DeskLoader = () => Promise<{ default: ComponentType<any> }>

/**
 * NavKey -> the module that renders it. The specifiers must stay STRING
 * LITERALS: Rollup can only cut a chunk for an `import()` it can read
 * statically, and a computed specifier would silently collapse the whole desk
 * into one bundle - the exact thing the per-tab split exists to prevent.
 */
export const DESK_LOADERS: Record<NavKey, DeskLoader> = {
  approvals:      () => import('./AccountApprovals'),
  posts:          () => import('./PostModeration'),
  blogs:          () => import('./BlogDrafts'),
  members:        () => import('./MemberDirectory'),
  member_of_month:() => import('./MemberOfMonth'),
  teams:          () => import('./TeamManagement'),
  categories:     () => import('./CategoryManagement'),
  hiring:         () => import('./HiringResponses'),
  enquiries:      () => import('./FormResponses'),
  certificates:   () => import('./CertificateRequests'),
  yearbook:       () => import('./YearbookManagement'),
  content:        () => import('./ContentManager'),
  projects:       () => import('./ProjectManager'),
  hods:           () => import('./DirectorManagement'),
  volunteer_apps: () => import('./VolunteerApplications'),
  roles:          () => import('../roles/RolesPage'),
  activity_log:   () => import('./ActivityLog'),
}

/**
 * Desks whose fetch has already been kicked off this page-load. The module
 * registry would dedupe a repeat call anyway; this just avoids re-entering the
 * loader on every mousemove over a nav item.
 *
 * A FAILED load is removed again, so a prefetch that lost the network doesn't
 * poison the real click - `lazy()` will simply request it for real.
 */
const started = new Set<NavKey>()

/**
 * Warm one desk's chunk. Safe to call as often as you like, from a hover, a
 * focus, or an idle callback. Never throws and never blocks: a prefetch is a
 * hint, and a failed hint must be indistinguishable from never having tried.
 */
export function prefetchDesk(key: NavKey): void {
  if (started.has(key)) return
  const load = DESK_LOADERS[key]
  if (!load) return
  started.add(key)
  try {
    load().catch(() => { started.delete(key) })
  } catch {
    started.delete(key)
  }
}

/** True once `prefetchDesk` has been called for `key` and hasn't failed. */
export function isDeskPrefetched(key: NavKey): boolean {
  return started.has(key)
}

/**
 * Warm several desks once the browser is genuinely idle.
 *
 * `requestIdleCallback` is unimplemented in Safari (all versions as of this
 * writing), so it falls back to a `setTimeout` - deliberately a long-ish one,
 * because the point is to spend bandwidth the user isn't using, not to race
 * the desk's own first data fetch.
 *
 * Returns a cancel function; callers should call it on unmount so a fast
 * navigation away doesn't leave a queued download of a desk nobody is going
 * to open.
 */
export function prefetchDesksWhenIdle(keys: NavKey[], delayMs = 1200): () => void {
  if (keys.length === 0) return () => {}
  const run = () => { for (const k of keys) prefetchDesk(k) }

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
 * `/director/post-queue` -> the NavKey that route mounts, for the desk links
 * that only carry a `to` string (DirectorLanding's triage tiles and jigsaw
 * blocks build theirs from paths, not keys). Unknown paths return null and
 * prefetch nothing - a link out of the desk must never be guessed at.
 */
export function deskKeyForPath(pathname: string): NavKey | null {
  const rest = pathname.replace(/^\/director\/?/, '').replace(/\/+$/, '')
  if (!rest) return null
  const desk = DESKS.find(d => rest === d.path || rest.startsWith(d.path + '/'))
  return desk ? desk.key : null
}

/** `prefetchDesk`, addressed by route path. No-op for non-desk paths. */
export function prefetchDeskByPath(pathname: string): void {
  const key = deskKeyForPath(pathname)
  if (key) prefetchDesk(key)
}
