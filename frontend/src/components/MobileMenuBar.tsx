import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { hasLeaderAccess } from '../lib/roles'
import { notificationService } from '../services/notificationService'
import {
  HomeIcon as Home,
  BellIcon as Bell,
  UserIcon as User,
  MapIcon as Compass,
  BookOpenIcon as BookOpen,
  NewspaperIcon as Newspaper,
  GlobeAltIcon as Globe,
  SparklesIcon as Sparkles,
  ShareIcon as Network,
} from '@heroicons/react/24/outline'
import CreateLauncher from './CreateLauncher'
import { prefetchRouteByPath } from '../lib/routeModules'

// ── The one definition of "no bottom dock on this route" ────────────────
// 02.6: the bar returned `null` on these paths while `PublicLayout` rendered
// `.aq-bottom-bar-spacer` unconditionally, so /login, /register, /pending,
// /rejected and /volunteer each carried 84px of dead space below the footer
// on a phone with no bar over it (measured at 360x780). Exported so the bar
// and its reserve read the same predicate and can never diverge again.
const BOTTOM_NAV_HIDDEN_PATHS = ['/login', '/register', '/pending', '/rejected', '/volunteer']
export function isBottomNavHidden(pathname: string): boolean {
  return BOTTOM_NAV_HIDDEN_PATHS.some(p => pathname.startsWith(p))
}

type NavItem = {
  href: string
  label: string
  Icon: React.ElementType<{ width?: number; height?: number; strokeWidth?: number }>
  exact?: boolean
}

// ── Items for authenticated members ─────────────────────────────
// "Explore" (→ /everything-we-do) replaces the old hidden arcade tab.
const AUTH_ITEMS: NavItem[] = [
  // Home (/) IS the members' feed (HomePage). The old standalone /feed page is
  // retired and redirects here, so this tab points straight at home.
  { href: '/',              label: 'feed',     Icon: Home,     exact: true },
  { href: '/everything-we-do', label: 'explore', Icon: Network },
  { href: '/notifications', label: 'alerts',   Icon: Bell },
  { href: '/teams',         label: 'teams',    Icon: User },
]

// ── Items for public visitors ────────────────────────────────────
const PUBLIC_ITEMS: NavItem[] = [
  { href: '/',         label: 'home',     Icon: Home,     exact: true },
  { href: '/projects', label: 'projects', Icon: Compass },
  { href: '/teams',    label: 'teams',    Icon: User },
  { href: '/blog',     label: 'blog',     Icon: BookOpen },
  { href: '/terranotes', label: 'notes',  Icon: Newspaper },
  { href: '/about',    label: 'about',    Icon: Globe },
]

// ── Single tab item ──────────────────────────────────────────────
function TabItem({
  item, isActive, onClick, showPulse, unreadCount,
}: {
  item: NavItem; isActive: boolean; index?: number; onClick: () => void; showPulse?: boolean; unreadCount?: number
}) {
  return (
    <button
      className={'aq-tab-item' + (isActive ? ' active' : '')}
      onClick={onClick}
      // This bar is the ONE always-visible nav surface on a phone, and a
      // phone has no hover - lib/routeModules.ts's hover-prefetch (AQNav's
      // desktop pills, the hamburger drawer) never fires here. `touchstart`
      // fires on finger-DOWN, a real ~100-300ms before the tap's `click`/
      // navigation resolves, which is exactly the head start hover gives a
      // mouse. `onMouseEnter`/`onFocus` kept too, for a trackpad/keyboard
      // user on a narrow viewport. prefetchRouteByPath no-ops safely for a
      // param/unmapped href (e.g. '/notifications', '/director').
      onTouchStart={() => prefetchRouteByPath(item.href)}
      onMouseEnter={() => prefetchRouteByPath(item.href)}
      onFocus={() => prefetchRouteByPath(item.href)}
      aria-current={isActive ? 'page' : undefined}
      /* Inactive tabs are icon-only (the label is display:none), so the
         accessible name has to come from here or they announce as "button". */
      aria-label={unreadCount ? `${item.label}, ${unreadCount} unread` : item.label}
    >
      <span className={'aq-tab-icon' + (isActive ? ' active' : '')} style={{ position: 'relative' }}>
        <item.Icon width={20} height={20} strokeWidth={isActive ? 2.5 : 1.8} />
        {showPulse && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            width: 7, height: 7, borderRadius: '50%',
            background: 'var(--pink)',
            animation: 'hodPulse 1.4s ease-in-out infinite',
            display: 'block',
          }} />
        )}
        {/* ADD (02.6): the unread dot, only rendered when there is something
           unread - services/notificationService.ts already exposes the
           count (AQNav's top bell uses the same call). AQNav's own bell is
           `display: none` below 760px, so this tab is the ONLY unread
           signal a phone user has at all. */}
        {!showPulse && !!unreadCount && (
          <span aria-hidden style={{
            position: 'absolute', top: -2, left: '50%', transform: 'translateX(6px)',
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--tomato)',
            boxShadow: '0 0 0 2px var(--ink-2)',
            display: 'block',
          }} />
        )}
      </span>
      <span className={'aq-tab-label' + (isActive ? ' active' : '')}>
        {item.label}
      </span>
    </button>
  )
}

// ── Main component ───────────────────────────────────────────────
export default function MobileMenuBar({ onCompose, onAchievement }: { onCompose?: () => void; onAchievement?: () => void }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { isAuthenticated, member } = useAuth()

  const isDirector = hasLeaderAccess(member?.role)
  const hodVisited = typeof window !== 'undefined' && !!localStorage.getItem('aq_hod_visited')
  const showHodPulse = isDirector && !hodVisited && !location.pathname.startsWith('/director')

  // Unread-notification dot (02.6). Not a realtime subscription like AQNav's
  // bell - AQNav (mounted alongside this bar) already holds one of those,
  // and this bar is on-screen throughout normal navigation, so a fetch on
  // mount/auth-change/route-change stays close enough without a second
  // duplicate channel to the same table.
  const [unreadCount, setUnreadCount] = useState(0)
  useEffect(() => {
    if (!isAuthenticated) { setUnreadCount(0); return }
    let cancelled = false
    notificationService.getUnreadCount()
      .then(n => { if (!cancelled) setUnreadCount(n) })
      .catch(() => { /* keep the previous count on transient failures */ })
    return () => { cancelled = true }
  }, [isAuthenticated, location.pathname])

  const items = isAuthenticated
    ? isDirector
      ? AUTH_ITEMS.map(item =>
          item.href === '/notifications'
            ? ({ href: '/director', label: 'desk', Icon: Sparkles } as NavItem)
            : item
        )
      : AUTH_ITEMS
    : PUBLIC_ITEMS

  const activeIndex = useMemo(() => {
    const path = location.pathname
    // Audit pass, 2026-09-06: was `idx === -1 ? 0 : idx`, which silently lit
    // up "home" (index 0) for every route that isn't one of the four/five
    // tabs here - and most of the site isn't: /labs, /contact, /join,
    // /equity-policy, /brand, /classes, /directory, /opportunities,
    // /calendar, /yearbook and more all have no matching item, so the bar
    // was actively lying about where you are instead of just having nothing
    // to highlight. No match now means no active tab, matching what
    // `TabItem` already does with a plain `i === activeIndex` check (no `i`
    // is ever -1, so every tab correctly renders inactive).
    return items.findIndex(item =>
      item.exact ? path === item.href : path.startsWith(item.href)
    )
  }, [location.pathname, items])

  const handleClick = (href: string) => {
    if (href === '/director') localStorage.setItem('aq_hod_visited', '1')
    navigate(href)
  }

  // Don't show on auth/registration flows (shared predicate, see top of file)
  if (isBottomNavHidden(location.pathname)) return null

  return (
    <nav className="aq-bottom-bar" role="navigation" aria-label="Mobile navigation">
      {/* All tabs share one floating pill - the active one becomes a white
          icon+label segment, inactive ones stay icon-only. */}
      <div className="aq-bottom-bar-pill">
        {items.map((item, i) => (
          <TabItem
            key={item.href}
            item={item}
            isActive={i === activeIndex}
            onClick={() => handleClick(item.href)}
            showPulse={item.href === '/director' && showHodPulse}
            unreadCount={item.href === '/notifications' ? unreadCount : undefined}
          />
        ))}
      </div>

      {/* Compose FAB floats separately beside the pill, authenticated only. */}
      {isAuthenticated && (
        <CreateLauncher
          variant="fab"
          onPost={() => onCompose?.()}
          onAchievement={() => onAchievement?.()}
        />
      )}
    </nav>
  )
}
