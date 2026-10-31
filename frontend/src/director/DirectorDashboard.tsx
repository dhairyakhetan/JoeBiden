import './DirectorDashboard.css'
import '../styles/routes/director.css'
import { useEffect, useMemo, useRef, useState, Suspense } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useCapabilities } from '../auth/CapabilityContext'
import { isSuperAdmin as checkSuperAdmin, hasLeaderAccess, getRoleLabel } from '../lib/roles'
import { GROUP_HUES, visibleDeskGroups } from './deskAccess'
import type { NavKey } from './deskAccess'
import { getInitials } from '../lib/uiHelpers'
import directorService, { DashboardStats } from '../services/directorService'
import teamService from '../services/teamService'
import { notificationService } from '../services/notificationService'
import Sheet from '../components/Sheet'
import { prefetchDesk, prefetchDesksWhenIdle } from './deskModules'
import { AdminLayout, AdminSkeleton } from './adminKit'
import { useMeta } from '../hooks/useMeta'

// Nav grouping, GROUP_HUES and every desk's required privilege now live in
// `deskAccess.ts` - the SINGLE SOURCE OF TRUTH that App.tsx's <Route> guards
// read from too, so the rail and the route can no longer disagree (CLAUDE.md,
// "Role model"). Re-exported here because DirectorLanding and others already
// import them from this module.
//
// `path` is relative to `/director`. NAV_GROUPS is purely a DATA SOURCE for
// rendering nav - routing itself lives in App.tsx, which owns the real
// <Route> tree and per-route guards.
export type { NavKey } from './deskAccess'
export { NAV_GROUPS, GROUP_HUES } from './deskAccess'

/** Shape handed down to every desk route via <Outlet context={...}/>. */
export type DirectorContext = {
  stats: DashboardStats | null
  /**
   * The stats load FAILED. Distinct from `stats: null` meaning "not yet".
   *
   * Without it every consumer reads `stats?.x || 0` and a failed load is
   * indistinguishable from a genuinely empty desk - the landing rendered
   * "nothing waiting in your desk - nice work" and "accounts, posts, enquiries
   * and applications: all at zero" over a queue that might hold twelve pending
   * sign-ups. An HoD has no way to tell, and nothing on screen hints at it.
   */
  statsError: boolean
  canApproveMembers: boolean
  isSuperAdmin: boolean
  /** Categories this director is scoped to moderate (empty for super admins - they see everything). */
  myCategories: string[]
  /**
   * Team ids this director is scoped to, for desks whose unit is a TEAM rather
   * than a post category - item 6.1 (Hiring). Empty means unscoped, exactly as
   * `myCategories` empty does; see teamService.getMyDeskTeamIds for why that
   * fail-open direction is deliberate. Always empty for super admins and HR,
   * who keep the whole-org view by the user's explicit instruction.
   */
  myTeamIds: number[]
  /**
   * Team ids (director_scopes, expanded to the teams inside each) whose tagged posts also belong to
   * this director's post queue. Empty means no team scope. Empty for super admins and HR.
   */
  myScopeTeamIds: number[]
  /** Pending-post count scoped to `myCategories` (null when unscoped/super admin - fall back to stats.pendingPostReviews). */
  scopedPendingPosts: number | null
}

/** localStorage key the rail owns for "last opened". Never read or write any other key. */
const LAST_SEEN_KEY = 'aq_desk_last_seen_v1'

/** "today · 6:12pm" / "yesterday · 6:12pm" / "3 Sep · 6:12pm" - real Date math,
 *  not the mock's literal invented string. Never "just now": a `null` input
 *  (nothing stored yet) renders nothing at the call site instead. */
function formatLastOpened(ms: number): string {
  const d = new Date(ms)
  const now = new Date()
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(/\s/g, '')
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dayDiff = Math.round((startOf(now) - startOf(d)) / 86400000)
  if (dayDiff === 0) return `today · ${time}`
  if (dayDiff === 1) return `yesterday · ${time}`
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · ${time}`
}

/**
 * DirectorDashboard is the desk's SHELL: redesign 17.1 supersedes 06.3's
 * single ink rail with THREE tiers on desktop (a 68px glyph rail, a 230px
 * label column, the content) and collapses both nav tiers into one sheet
 * below 1024px. `06`'s single-rail markup is gone; see the git history on
 * this file for it.
 *
 * MISMATCH, reported not silently reconciled (see the build report): 17.1
 * groups ~20 desks into FIVE named groups ("the queue"/"people"/"the
 * work"/"publishing"/"org setup"). The live `NAV_GROUPS` below - which this
 * file is explicitly told to keep "completely untouched" - has exactly
 * SEVENTEEN desks in FOUR groups (queue/people/intake/admin), confirmed
 * against both this array and the live `<Route>` list in App.tsx. Renaming
 * or regrouping NAV_GROUPS to match the mock's IA would be exactly the kind
 * of "security change wearing a design change's clothes" invariant 2 (and
 * GROUP_HUES, kept untouched alongside it) exists to prevent, since the
 * grouping mirrors nothing else - but "keep it untouched" was still the
 * explicit instruction, so the choice was to build 17.1's THREE-TIER
 * STRUCTURE generically over the four real groups rather than invent a
 * fifth that does not exist.
 */
const DirectorDashboard = () => {
  const { member } = useAuth()
  const { can } = useCapabilities()
  const location = useLocation()
  const isSuperAdmin = checkSuperAdmin(member?.role)

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [statsError, setStatsError] = useState(false)
  const [scopedPendingPosts, setScopedPendingPosts] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  // Account approval isn't category-scoped moderation (unlike posts) - any
  // HoD/Director/super admin can approve members, must mirror
  // AccountApprovals' own access gate.
  const canApproveMembers = hasLeaderAccess(member?.role)
  const [myCategories, setMyCategories] = useState<string[]>([])
  const [myTeamIds, setMyTeamIds] = useState<number[]>([])
  const [myScopeTeamIds, setMyScopeTeamIds] = useState<number[]>([])

  // ── Notifications unread count - notificationService.getUnreadCount()
  // already exists and is already called this same way (a fire-and-forget,
  // non-blocking effect with a silent .catch) by AQNav.tsx and
  // MobileMenuBar.tsx, so wiring it into the rail needed no new query. ──
  const [unreadCount, setUnreadCount] = useState(0)
  useEffect(() => {
    let cancelled = false
    notificationService.getUnreadCount()
      .then(n => { if (!cancelled) setUnreadCount(n) })
      .catch(() => { /* keep 0 on transient failures, same as AQNav */ })
    return () => { cancelled = true }
  }, [])

  // ── "last opened" (06.3.3, unchanged by 17.1) - the PREVIOUS value must be
  // read before this visit's timestamp overwrites it, and a ref guards the
  // read-then-write against React StrictMode's double-invoked dev effect.
  // Wrapped in try/catch: a private-mode browser can throw on localStorage
  // access, and first-visit (or unavailable storage) renders nothing rather
  // than a fabricated "just now". ──
  const lastSeenInit = useRef(false)
  const [lastOpenedAt, setLastOpenedAt] = useState<number | null>(null)
  useEffect(() => {
    if (lastSeenInit.current) return
    lastSeenInit.current = true
    try {
      const prev = localStorage.getItem(LAST_SEEN_KEY)
      setLastOpenedAt(prev ? Number(prev) || null : null)
      localStorage.setItem(LAST_SEEN_KEY, String(Date.now()))
    } catch { /* storage unavailable - render nothing */ }
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const statsResult = await directorService.getDashboardStats()
        if (statsResult.success) setStats(statsResult.data)
        // Teams-as-categories slice 4: a leader's scope is their TEAMS (director_scopes, plus the
        // teams inside each). The five categories are no longer read. `myCategories` keeps its
        // name because many desks print it as the "acting as" label; it now holds the names of the
        // teams actually assigned. A failed read leaves the desk UNSCOPED (never scoped to nothing).
        let scopeTeams: { teamId: number; name: string; direct: boolean }[] = []
        if (!isSuperAdmin) {
          try { scopeTeams = await directorService.getMyScopeTeams() }
          catch (e) { console.error('desk scope (teams) failed, staying unscoped:', e) }
        }
        const scopeIds = scopeTeams.map(t => t.teamId)
        setMyCategories(scopeTeams.filter(t => t.direct).map(t => t.name))
        setMyScopeTeamIds(scopeIds)
        // The Post Queue badge should match what tapping the tab actually shows.
        if (!isSuperAdmin && scopeIds.length > 0) {
          const scoped = await directorService.getScopedPendingPostsCount(scopeIds)
          if (scoped.success) setScopedPendingPosts(scoped.data)
        }
        // Item 6.1. Only for non-super leaders: "super_admin and HR keep the
        // unscoped view" was explicit, so the call is not even made for them
        // and `myTeamIds` stays empty, which reads as unscoped anyway. Teams they lead plus
        // their scope.
        if (!isSuperAdmin) {
          // Non-fatal: a failure here must leave the desk UNSCOPED (the
          // pre-6.1 behaviour), never accidentally scoped to nothing.
          try { setMyTeamIds(Array.from(new Set([...(await teamService.getMyDeskTeamIds()), ...scopeIds]))) }
          catch (e) { console.error('desk team scope failed, staying unscoped:', e) }
        }
      } catch (error) {
        // Was console.error only. A desk that cannot count its own queues must
        // say so rather than render them as clear.
        setStatsError(true)
        console.error('Failed to fetch stats:', error)
      }
      finally { setIsLoading(false) }
    }
    fetchData()
  }, [isSuperAdmin])

  const counts: Partial<Record<NavKey, number>> = {
    approvals: stats?.pendingMemberApprovals || undefined,
    posts: (scopedPendingPosts ?? stats?.pendingPostReviews) || undefined,
  }

  // The one filter, shared with DirectorLanding and asserted against the route
  // guard in deskAccess.test.ts. Never re-derive this expression locally.
  const visibleGroups = visibleDeskGroups({ role: member?.role, canApproveMembers, can })

  const deskCount = visibleGroups.reduce((n, g) => n + g.items.length, 0)

  // ── 17.1 tier 2: "only one group is expanded at a time... derived, not
  // stored". Route-derived by default; clicking a DIFFERENT group's header
  // (or its tier-1 glyph) opens it as a temporary override, which resets the
  // moment the route actually changes (i.e. once a link inside it is
  // followed), so the rail always settles back onto wherever you are. ──
  const routeGroupLabel = useMemo(() => {
    const found = visibleGroups.find(g => g.items.some(item => {
      const base = `/director/${item.path}`
      return location.pathname === base || location.pathname.startsWith(base + '/')
    }))
    return found?.label
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, isLoading])

  // Document title: the SAME pathname-matching resolution as routeGroupLabel
  // just above, kept at the ITEM level instead of its group, so the browser
  // tab names the actual desk. Without this the 18 desks + the landing page
  // all share whatever generic title the last-visited public route left
  // behind, and switching desks never touches document.title.
  const activeDeskLabel = useMemo(() => {
    for (const g of visibleGroups) {
      const item = g.items.find(item => {
        const base = `/director/${item.path}`
        return location.pathname === base || location.pathname.startsWith(base + '/')
      })
      if (item) return item.label
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, isLoading])

  useMeta({
    title: activeDeskLabel ? `${activeDeskLabel} | AquaTerra Command Desk` : 'Command Desk | AquaTerra',
    noIndex: true,
  })

  const [manualGroup, setManualGroup] = useState<string | null>(null)
  useEffect(() => { setManualGroup(null) }, [location.pathname])
  const activeGroupLabel = manualGroup ?? routeGroupLabel ?? visibleGroups[0]?.label

  // ── Below 1024px, tiers 1+2 collapse into one sheet (17.1). ──
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const mobileNavTriggerRef = useRef<HTMLButtonElement>(null)

  // ══ Chunk prefetching (see director/deskModules.ts) ══════════════════════
  //
  // Each desk is its own lazy chunk, so before this the JS request only began
  // on click. Two hints start it earlier:
  //
  //  1. `onDeskHint` - pointer-enter / focus on any desk link. On a mouse this
  //     buys the ~100-300ms between "starts moving toward the item" and
  //     "clicks"; on keyboard, focus does the same on the way through the rail.
  //  2. The idle pass below - once the browser has nothing else to do, warm
  //     the desks in the group the rail is CURRENTLY SHOWING, which are
  //     precisely the ones one click away. Never all eighteen: the per-tab
  //     split exists so a director doesn't download desks they won't open
  //     (CLAUDE.md), and prefetching the lot would throw that away.
  //
  // `visibleGroups` is already role-filtered, so a plain HoD never fetches a
  // super-only desk's bytes. This is a bandwidth nicety, not a security
  // boundary - the route guard in App.tsx is still the only thing that
  // decides what may RENDER.
  const onDeskHint = (key: NavKey) => () => prefetchDesk(key)

  const idleGroupKeys = useMemo(
    () => (visibleGroups.find(g => g.label === activeGroupLabel)?.items ?? []).map(i => i.key),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeGroupLabel, deskCount],
  )
  useEffect(() => prefetchDesksWhenIdle(idleGroupKeys), [idleGroupKeys])

  if (isLoading) {
    return (
      <div className="route-enter admin ops-shell">
        <div className="ops-rail1" aria-hidden>
          <div className="v6-skeleton" style={{ width: 40, height: 40, borderRadius: 999 }} />
        </div>
        <div className="ops-rail2" aria-hidden />
        <div className="ops-main">
          <div className="v6-skeleton sk-group" style={{ height: 132, borderRadius: 32, marginBottom: 14 }} />
          {/* Same grid, same fractions, same radii as the real jigsaw (17's
              own States section: a skeleton that reflows once data resolves
              "reads as the page jumping" - the 06.7 finding this line
              extends to the jigsaw). */}
          <div className="ops-jigsaw sk-group" style={{ marginBottom: 14 }}>
            <div className="ops-jigsaw-row" style={{ gridTemplateColumns: '1.35fr 1fr 1fr' }}>
              <div className="v6-skeleton" style={{ minHeight: 132, borderRadius: '22px 6px 6px 22px' }} />
              <div className="v6-skeleton" style={{ minHeight: 132, borderRadius: 6 }} />
              <div className="v6-skeleton" style={{ minHeight: 132, borderRadius: '6px 22px 22px 6px' }} />
            </div>
            <div className="ops-jigsaw-row">
              <div className="v6-skeleton" style={{ minHeight: 132, borderRadius: 22 }} />
            </div>
          </div>
          <div className="card" style={{ padding: 20 }}>
            <div className="sk-group">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="v6-skeleton" style={{ height: 13, width: `${70 + i * 5}%`, marginBottom: 10 }} />)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // getRoleLabel, not a literal, so the 'hr' role reads as "hr" here instead of
  // inheriting super_admin's wording. For super_admin the string is unchanged.
  const scopeLabel = isSuperAdmin
    ? `acting as · ${getRoleLabel(member?.role).toLowerCase()} · all categories`
    : myCategories.length > 0
      ? `acting as · ${getRoleLabel(member?.role)} · ${myCategories.join(', ')}`
      : `acting as · ${getRoleLabel(member?.role)}`

  const ctx: DirectorContext = { stats, statsError, canApproveMembers, isSuperAdmin, myCategories, myTeamIds, myScopeTeamIds, scopedPendingPosts }

  const groupCount = (g: { items: { key: NavKey }[] }) => g.items.reduce((n, item) => n + (counts[item.key] || 0), 0)

  const utilityIcons = (onNavigate?: () => void) => (
    <div className="ops-rail-utility">
      <Link to="/" className="ops-rail-util" aria-label="Home" title="Home" onClick={onNavigate}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 11l9-8 9 8" /><path d="M5 10v10h5v-6h4v6h5V10" />
        </svg>
      </Link>
      <Link to="/search" className="ops-rail-util" aria-label="Search" title="Search" onClick={onNavigate}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
      </Link>
      <Link to="/notifications" className="ops-rail-util ops-rail-util-notif" aria-label="Notifications" title="Notifications" onClick={onNavigate}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {/* Only when there are unread notifications - never a bare dot for zero. */}
        {unreadCount > 0 && <span className="ops-rail-unreaddot" aria-hidden />}
      </Link>
      <Link to="/profile/me" className="ops-rail-util ops-rail-avatar" aria-label="Your profile" title="Your profile" onClick={onNavigate}>
        {getInitials(member?.full_name || 'operator')}
      </Link>
    </div>
  )

  const childBadge = (key: NavKey) => {
    const c = counts[key]
    if (c != null && c > 0) return <span className="ops-rail2-child-count">{c}</span>
    return <span className="ops-rail2-child-dot" aria-hidden />
  }

  return (
    <div className="route-enter admin ops-shell">
      {/* ═══ Desktop (>=1024px): tier 1 (glyph rail) + tier 2 (label column) ═══ */}
      <nav className="ops-rail1" aria-label="Director sections">
        <Link to="/" className="ops-rail1-brand" aria-label="Back to AquaTerra">
          <img src="/stamp-white.png" alt="" width={22} height={22} />
        </Link>
        {visibleGroups.map(g => {
          const n = groupCount(g)
          const isActive = activeGroupLabel === g.label
          return (
            <button
              key={g.label}
              type="button"
              className="ops-glyph"
              aria-current={isActive ? 'page' : undefined}
              aria-label={g.label}
              title={g.label}
              onClick={() => setManualGroup(g.label)}
            >
              <span aria-hidden>{g.icon}</span>
              {/* 17.1 Tier 1's four badge states. `tomato` (overdue) is not
                  reachable - no created-at is available here (06, unresolved
                  1) - so this ships three: lemon count when something is
                  waiting, a 9px welfare dot when the group merely has
                  content, and nothing when it is empty. Never a `0`. */}
              {n > 0
                ? <span className="ops-glyph-badge mono">{n}</span>
                : g.items.length > 0 && <span className="ops-glyph-dot" aria-hidden />}
            </button>
          )
        })}
        <Link to="/profile/me" className="ops-glyph ops-rail1-avatar" aria-label="Your profile" title="Your profile">
          {getInitials(member?.full_name || 'operator')}
        </Link>
      </nav>

      <aside className="ops-rail2" aria-label="Desk sections">
        <div className="ops-rail2-head">
          <div className="ops-rail2-desk">command <span className="ops-brand-accent">desk</span></div>
          <div className="ops-rail2-scope mono">{scopeLabel}</div>
        </div>

        <div className="ops-rail2-nav">
          {visibleGroups.map((g, i) => {
            const isOpen = g.label === activeGroupLabel
            const n = groupCount(g)
            const isLast = i === visibleGroups.length - 1
            return (
              <div key={g.label}>
                {/* A hairline separates the last group from the rest - the
                    `admin` group here is the desk's "configuration is a
                    different kind of thing" set (every item is superOnly). */}
                {isLast && visibleGroups.length > 1 && <div className="ops-rail2-sep" aria-hidden />}
                {isOpen ? (
                  <div className="ops-rail2-well">
                    <button type="button" className="ops-rail2-parent" aria-expanded="true">
                      <span>{g.label}</span>
                      <span className="ops-rail2-collapse" aria-hidden>−</span>
                    </button>
                    <div className="ops-rail2-children">
                      <span className="ops-rail2-connector" aria-hidden />
                      {g.items.map(item => (
                        <NavLink
                          key={item.key}
                          to={`/director/${item.path}`}
                          // Item 4.3. `title`, not aria-label: the link's
                          // accessible name still comes from its own text
                          // (content outranks title in the accname algorithm),
                          // so this reads as a DESCRIPTION rather than
                          // replacing "Approvals" with a sentence.
                          title={item.blurb}
                          className={({ isActive: active }) => 'ops-rail2-child' + (active ? ' is-active' : '')}
                          onClick={() => setMobileNavOpen(false)}
                          onPointerEnter={onDeskHint(item.key)}
                          onFocus={onDeskHint(item.key)}
                        >
                          <span className="ops-rail2-stub" aria-hidden />
                          <span className="ops-rail2-child-label">{item.label}</span>
                          {childBadge(item.key)}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                ) : (
                  <button type="button" className="ops-rail2-collapsed" onClick={() => setManualGroup(g.label)}>
                    <span className="ops-rail2-collapsed-label">{g.label}</span>
                    <span className="ops-rail2-collapsed-count mono">{n > 0 ? `${n} new` : String(g.items.length).padStart(2, '0')}</span>
                    <span className="ops-rail2-chevron" aria-hidden>⌄</span>
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div className="ops-rail-foot">
          {lastOpenedAt != null && (
            <div className="ops-rail-lastopened">
              <span className="ops-rail-lastopened-label">last opened</span>
              <span className="ops-rail-lastopened-value mono">{formatLastOpened(lastOpenedAt)}</span>
            </div>
          )}
          {utilityIcons()}
        </div>
      </aside>

      {/* ═══ Below 1024px: a single ink header + the shared two-detent sheet ═══ */}
      <header className="ops-phonebar">
        <Link to="/" className="ops-phonebar-logo" aria-label="Back to AquaTerra">
          <img src="/stamp-white.png" alt="" width={20} height={20} />
        </Link>
        <span className="ops-phonebar-title"><span>command <em>desk</em></span></span>
        <button
          ref={mobileNavTriggerRef}
          type="button"
          className="ops-phonebar-count"
          onClick={() => setMobileNavOpen(true)}
          aria-haspopup="dialog"
        >
          <span className="mono">{deskCount}</span> desks
        </button>
      </header>

      {mobileNavOpen && (
        <Sheet
          detent="full"
          onDetentChange={() => setMobileNavOpen(false)}
          ariaLabel="Director sections"
          returnFocusRef={mobileNavTriggerRef}
          peek={
            <div className="ops-navsheet-peek">
              <span>desks</span>
              <span className="mono">{deskCount}</span>
            </div>
          }
        >
          <div className="ops-navsheet-body">
            {visibleGroups.map(g => (
              <div key={g.label} className="ops-navsheet-group">
                <div className="ops-navsheet-grouplabel mono">{g.label}</div>
                {g.items.map(item => {
                  const c = counts[item.key]
                  return (
                    <NavLink
                      key={item.key}
                      to={`/director/${item.path}`}
                      title={item.blurb}
                      className={({ isActive: active }) => 'ops-navsheet-item' + (active ? ' is-active' : '')}
                      style={{ ['--cc' as any]: GROUP_HUES[g.label] }}
                      onClick={() => setMobileNavOpen(false)}
                      onPointerEnter={onDeskHint(item.key)}
                      onFocus={onDeskHint(item.key)}
                    >
                      <span aria-hidden>{item.icon}</span>
                      <span className="ops-navsheet-item-label">{item.label}</span>
                      {c != null && c > 0 && <span className="ops-navsheet-item-count mono">{c}</span>}
                    </NavLink>
                  )
                })}
              </div>
            ))}
            {lastOpenedAt != null && (
              <div className="ops-rail-lastopened">
                <span className="ops-rail-lastopened-label">last opened</span>
                <span className="ops-rail-lastopened-value mono">{formatLastOpened(lastOpenedAt)}</span>
              </div>
            )}
            {utilityIcons(() => setMobileNavOpen(false))}
          </div>
        </Sheet>
      )}

      {/* ── Main column — a <div>, not a <main>: DashboardLayout already
          renders the desk's single <main id="main-content"> around this. ── */}
      <div className="ops-main">
        <div className="director-tab-panel">
          {/* The chunk-load fallback renders the SAME AdminLayout +
              AdminSkeleton every desk shows while its own query is in flight
              (PostModeration, MemberDirectory, … all do `if (isLoading)
              return <AdminLayout><AdminSkeleton/></AdminLayout>`). So a tab
              switch now reads as ONE continuous skeleton that resolves into
              rows, instead of the old blank "loading…" line being swapped for
              a skeleton and then for content - three layouts where there
              should be one. Geometry, radii and shimmer are adminKit's, so it
              matches the panel it stands in for by construction rather than
              by a copy that can drift. */}
          <Suspense fallback={<AdminLayout><AdminSkeleton rows={5} /></AdminLayout>}>
            <Outlet context={ctx} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

export default DirectorDashboard
