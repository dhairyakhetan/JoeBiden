import Img from './Img'
import './AQNav.css'
import '../styles/routes/nav-mobile.css'
import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { acquireScrollLock } from '../lib/scrollLock'
import { hasLeaderAccess } from '../lib/roles'
import { GAMES } from '../games/games'
import { notificationService } from '../services/notificationService'
import { supabaseCommunity } from '../lib/supabaseCommunity'
// LAZY (audit 2026-09-17, efficiency P2). AQNav is eager on every public route
// via PublicLayout, and ConfettiBurst is the only thing in that whole graph that
// touches framer-motion - so this one static import was keeping the 127KB
// vendor-motion chunk modulepreloaded sitewide. The burst fires only after a
// deliberate celebratory tap, which is exactly when a small chunk fetch is fine.
const ConfettiBurst = lazy(() => import('./ConfettiBurst'))
import { hashColor } from '../lib/uiHelpers'
import { ORG_FACTS, displayCount } from '../lib/orgFacts'
import { prefetchRouteByPath } from '../lib/routeModules'
import useDialog from '../hooks/useDialog'
// Redesign section 01 step 14. The menu trigger is three dots, not a hamburger:
// v6Shared exports no hamburger glyph, and github.md records a Bars3 icon
// slipping back in once already. AQ Chrome Poster draws a hand-rolled 3-line
// hamburger, but the constraint manifest outranks the canvas on icon choice.
import { EllipsisHorizontalIcon, XMarkIcon } from '@heroicons/react/24/outline'
// Section 09's mascot cast (18-mascots-and-motion.md completed the rename to
// components/Mascot.tsx once the legacy parked companion was retired).
import { Mascot } from './Mascot'

// SVG Icons matching the prototype
const SearchSVG = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)
const BellSVG = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/>
  </svg>
)
const SparklesSVG = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0l1.5 6.5L20 8l-6.5 1.5L12 16l-1.5-6.5L4 8l6.5-1.5z"/>
    <path d="M19 14l.7 3 3 .7-3 .7L19 22l-.7-3-3-.7 3-.7z"/>
  </svg>
)
const WaveSVG = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M2 12c2 0 2-3 5-3s3 3 5 3 3-3 5-3 3 3 5 3"/>
    <path d="M2 17c2 0 2-3 5-3s3 3 5 3 3-3 5-3 3 3 5 3"/>
  </svg>
)
const BoltSVG = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
)
const FlagSVG = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
    <line x1="4" y1="22" x2="4" y2="15"/>
  </svg>
)
const PenSVG = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M12 19l7-7 3 3-7 7H12v-3z"/>
    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
  </svg>
)
const BookSVG = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M4 4.5A2.5 2.5 0 016.5 2H20v17H6.5A2.5 2.5 0 004 21.5z"/>
    <path d="M4 21.5A2.5 2.5 0 016.5 19H20v3H6.5A2.5 2.5 0 014 21.5z"/>
  </svg>
)
const GlobeSVG = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15 15 0 010 20 15 15 0 010-20z"/>
  </svg>
)

/**
 * The viewport width at which the nav flips to its mobile form. Must stay in
 * step with `@media (max-width: 760px)` in styles/v6.css, which switches the
 * bar layout, the .aq-menu-btn / .aq-hamburger-btn pair and the dock together.
 */
const NAV_MOBILE_MAX = 760
const LABS_HREF = '/terranotes/articles/labs'

interface AQNavProps {
  onCompose?: () => void
  onAchievement?: () => void
}

export default function AQNav(_props: AQNavProps) {
  const navigate = useNavigate()
  const location = useLocation()
  // Easter egg: 5 logo clicks within 2s pops a confetti burst from the
  // logo. Doesn't change the logo's actual job (still navigates home on
  // every click) - purely an extra on top.
  const logoClickRef = useRef<{ count: number; last: number }>({ count: 0, last: 0 })
  const [confettiAt, setConfettiAt] = useState<{ x: number; y: number } | null>(null)
  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const now = Date.now()
    const c = logoClickRef.current
    c.count = now - c.last < 2000 ? c.count + 1 : 1
    c.last = now
    if (c.count >= 5) {
      c.count = 0
      const rect = e.currentTarget.getBoundingClientRect()
      setConfettiAt({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    }
    // (the Link itself navigates home; this only counts the clicks)
  }
  const { member, isAuthenticated, logout } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showMega, setShowMega] = useState(false)
  // Both overlays declare `aria-modal="true"`, which tells assistive tech the
  // rest of the page is inert. The shared hook is what makes that claim true:
  // Escape, a Tab trap, focus into the panel on open and back to the trigger on
  // close, plus the body scroll-lock. The `<html>` half of the scroll-lock is
  // still done by hand below - the hook doesn't do it, and it's the one that
  // actually stops the page moving behind a fixed overlay.
  const megaRef = useDialog(showMega, () => setShowMega(false))
  const drawerRef = useDialog(showMobileMenu, () => setShowMobileMenu(false))
  // Compact "explore" dropdown - the quick sub-menu that opens before the
  // full-screen menu (mega on desktop, drawer on mobile), per the handoff.
  const [showDrop, setShowDrop] = useState(false)
  // Keep the dropdown mounted through its exit animation (mirrors
  // components/Confirm.tsx's shown/closing pattern): `shownDrop` lags
  // `showDrop` on close by the aqDropOut duration instead of the
  // conditional render below removing it from the DOM instantly.
  const [shownDrop, setShownDrop] = useState(false)
  const [dropClosing, setDropClosing] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  const path = location.pathname

  // Chameleon nav pill - recolors to match a full-bleed hero currently
  // sitting under it (About/Collaborations' ink hero, Crftd's grape hero),
  // instead of always showing the flat white pill over a dark/colored
  // backdrop. This is NOT a revival of the old segmented glass-bar spec
  // AQNav.css's mismatch note records as retired 2026-09-06 - that spec was
  // six backdrop-filter blur layers on the most-rendered surface in the app,
  // dropped for a real, measured performance cost. This is a solid
  // background-color swap with no blur, driven by one lightweight
  // IntersectionObserver watching only the handful of `[data-nav-tint]`
  // hero sections that opt in - on the ~90% of pages with no such hero it
  // costs nothing (the querySelectorAll comes back empty and no observer is
  // created at all).
  const [navTint, setNavTint] = useState<string | null>(null)
  useEffect(() => {
    const tinted = Array.from(document.querySelectorAll<HTMLElement>('[data-nav-tint]'))
    if (tinted.length === 0) { setNavTint(null); return }
    const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 70
    const intersecting = new Set<HTMLElement>()
    // Classic "trigger line" rootMargin: shrinks the viewport root to a 1px
    // slit exactly at the nav's bottom edge, so an element only counts as
    // intersecting while it is the thing actually sitting behind the nav.
    const io = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement
          if (entry.isIntersecting) intersecting.add(el)
          else intersecting.delete(el)
        }
        // DOM order == page order; a page can stack several tinted sections
        // back to back (About's ink hero -> welfare marquee -> ink
        // "positions" section), but they never overlap, so at most one is
        // ever intersecting at once - the first is the right one.
        const active = tinted.find(el => intersecting.has(el))
        setNavTint(active?.dataset.navTint || null)
      },
      { rootMargin: `-${navH}px 0px -${Math.max(window.innerHeight - navH - 1, 0)}px 0px`, threshold: 0 }
    )
    tinted.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [path])
  // Only ink/grape are dark enough to need light text + the white logo
  // variant - welfare is mid-tone and reads fine with the page's default ink
  // (see AQNav.css's note by the [data-tint="welfare"] rule).
  const navTintIsDark = navTint === 'ink' || navTint === 'grape'

  // Bell badge - unread notification count.
  //
  // Fetches the real count on every route, including /notifications - that
  // page no longer auto-marks-everything-read on a timer (it's an explicit
  // "mark all read" button now), so there's no "still stale for 1.5s" window
  // to special-case around any more. The realtime subscription below picks
  // up the button's write live.
  //
  // Uses the lightweight head-count query (getUnreadCount - a single
  // `count: exact, head: true` request) instead of list({limit:1}) which
  // fired two round-trips and pulled a full row needlessly.
  useEffect(() => {
    if (!isAuthenticated) { setUnreadCount(0); return }
    let cancelled = false
    notificationService.getUnreadCount()
      .then(n => { if (!cancelled) setUnreadCount(n) })
      .catch(() => { /* keep the previous count on transient failures */ })
    return () => { cancelled = true }
  }, [isAuthenticated, path])

  // Realtime bell - refetch the unread count when this member's notifications
  // change on ANY device (e.g. marked read elsewhere, or the explicit "mark
  // all read" button on /notifications itself), so the badge doesn't sit
  // stale until the next navigation.
  useEffect(() => {
    const memberId = member?.member_id
    if (!isAuthenticated || !memberId) return
    const channel = supabaseCommunity
      .channel(`notif-count-${memberId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `member_id=eq.${memberId}` },
        () => {
          notificationService.getUnreadCount().then(setUnreadCount).catch(() => {})
        },
      )
      .subscribe()
    return () => { supabaseCommunity.removeChannel(channel) }
  }, [isAuthenticated, member?.member_id])

  // A returning visitor's intent at the nav is "sign back in," not "apply" -
  // "Apply →" reads as a fresh-application prompt and creates a moment of
  // doubt ("do I have to re-apply?") for exactly the audience that should
  // have the most frictionless path back in. Read the flag BEFORE the effect
  // below overwrites it, so this render still knows whether this browser has
  // been here before; the effect then marks it seen for next time. Both
  // labels still route to the same /login, which already handles both cases.
  const [isReturningVisitor] = useState(() => {
    try { return typeof window !== 'undefined' && localStorage.getItem('aq_visited') === '1' } catch { return false }
  })
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('aq_visited', '1')
  }, [])

  const isDirector = hasLeaderAccess(member?.role)
  const hodVisited = typeof window !== 'undefined' && !!localStorage.getItem('aq_hod_visited')
  const showHodPulse = isDirector && !hodVisited && !path.startsWith('/director')

  // Primary nav pill - matched 1:1 to the Playground target: lowercase
  // home / projects / teams, plus (owner, 2026-09-28) terra notes: the monthly
  // digital magazine at /terranotes. That fourth tab is the one deliberate
  // widening of this list; nothing else joins it. Blog + About intentionally dropped from the
  // top bar (they stay reachable via the mega menu, the mobile sheet, the
  // footer, and the home left-rail quick links) so the bar reads as the target.
  // `accent` is a per-pill icon-color modifier (AQNav.css) so home/projects/
  // teams read as distinct at a glance instead of flat monochrome - icon
  // color only, no per-pill background fill, so the minimal chrome is
  // unchanged and the shared active/hover states below still apply on top.
  const navLinks = [
    { href: '/', label: 'home', icon: <WaveSVG />, accent: 'aq-nav-link-home' },
    { href: '/projects', label: 'projects', icon: <BoltSVG />, accent: 'aq-nav-link-projects' },
    { href: '/teams', label: 'teams', icon: <FlagSVG />, accent: 'aq-nav-link-teams' },
    { href: '/terranotes', label: 'terra notes', icon: <BookSVG />, accent: 'aq-nav-link-terranotes' },
  ]

  // Mobile hamburger sheet - secondary/discovery pages (primary nav is in the
  // bottom bar). This is mobile's ONLY path to these pages - unlike desktop,
  // which also has the mega menu - so it needs to carry the full reachable
  // set the mega menu does, not a shorter hand-picked subset (a prior
  // version omitted Members/Crftd/Handbook/FAQ/Support/Schools/Classes/Quick
  // Links entirely, leaving them unreachable on mobile outside the footer).
  const mobileSheetLinks = [
    { href: '/projects',        label: 'Projects',       icon: <BoltSVG /> },
    { href: '/teams',           label: 'Teams',          icon: <FlagSVG /> },
    { href: '/members',         label: 'Members',        icon: <GlobeSVG /> },
    { href: '/blog',            label: 'Blog',           icon: <PenSVG /> },
    { href: '/terranotes',      label: 'Terra Notes',    icon: <BookSVG /> },
    { href: '/games',           label: 'Mini games',     icon: <SparklesSVG /> },
    { href: '/opportunities',   label: 'Openings',       icon: <SparklesSVG /> },
    { href: '/crftd',           label: 'Crftd',          icon: <BoltSVG /> },
    { href: '/volunteer',       label: 'Handbook',       icon: <PenSVG /> },
    { href: '/collaborations',  label: 'Collaborations', icon: <WaveSVG /> },
    { href: '/schools',         label: 'Schools',        icon: <GlobeSVG /> },
    { href: '/classes',         label: 'Classes',        icon: <GlobeSVG /> },
    { href: '/about',           label: 'About',          icon: <GlobeSVG /> },
    { href: '/faq',             label: 'FAQ',            icon: <GlobeSVG /> },
    { href: '/support',         label: 'Support',        icon: <WaveSVG /> },
    { href: '/contact',         label: 'Contact',        icon: <GlobeSVG /> },
    { href: '/links',           label: 'Quick Links',    icon: <SparklesSVG /> },
    { href: '/accounts',        label: 'Open Books',     icon: <GlobeSVG /> },
    { href: '/equity-policy',   label: 'Equity Policy',  icon: <GlobeSVG /> },
  ]

  const isActive = (href: string) => {
    if (href === '/') return path === '/' || path === '/feed'
    return path.startsWith(href)
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close every overlay on navigation. Adjusted during render (same
  // prevBase/prevPathname technique as components/Img.tsx and
  // terrathon/components/Nav.tsx) instead of an effect, so a route change
  // closes these in the same render rather than a tick later.
  const [prevPath, setPrevPath] = useState(path)
  if (path !== prevPath) {
    setPrevPath(path)
    setShowMobileMenu(false)
    setShowMega(false)
    setShowDrop(false)
  }

  // "/" jumps to search (previously: focused the now-removed inline desktop
  // search field - step 15 collapsed that field to an icon-only button at
  // every width, matching mobile's .aq-search-btn, so there's no field left
  // to focus). The binding itself is kept, just retargeted to match the
  // button's own behavior. Ignored while the caret is already in a field or
  // a contenteditable, otherwise typing a slash into a post body would hijack
  // navigation. Also ignored when a modifier is held, so "/" as part of a
  // browser shortcut still reaches the browser.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      e.preventDefault()
      navigate('/search')
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [navigate])

  // Esc closes the explore dropdown.
  useEffect(() => {
    if (!showDrop) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setShowDrop(false)
      // Focus was inside the dropdown (or on its trigger); without this it drops to <body>.
      const trigger = document.querySelector<HTMLElement>('.aq-menu-btn, .aq-hamburger-btn')
      const visible = trigger && trigger.offsetParent !== null ? trigger : document.querySelector<HTMLElement>('.aq-hamburger-btn')
      ;(visible ?? trigger)?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showDrop])

  // Drive `shownDrop`/`dropClosing` off `showDrop` so the dropdown plays its
  // aqDropOut exit animation before unmounting, instead of vanishing
  // instantly. 160ms matches .aq-drop's aqDropIn/aqDropOut duration.
  useEffect(() => {
    if (showDrop) { setShownDrop(true); setDropClosing(false) }
    else if (shownDrop) {
      setDropClosing(true)
      const t = setTimeout(() => { setShownDrop(false); setDropClosing(false) }, 160)
      return () => clearTimeout(t)
    }
  }, [showDrop]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mega menu: lock scroll while open + close on Escape. Locking only
  // `body.style.overflow` doesn't actually stop the page from scrolling -
  // `<html>` is the real scrolling box in most browsers when it has no
  // overflow of its own, so the background page kept scrolling behind this
  // fixed full-screen overlay. Lock both.
  // The body half of the lock and the Escape key now come from `useDialog`
  // above - keeping a second body lock here would fight the hook's
  // save/restore pair and leave `body.overflow: hidden` after close.
  useEffect(() => {
    if (!showMega && !showMobileMenu) return
    // The shared lock covers BOTH html and body, which is why this no longer
    // needs its own half and can no longer disagree with useDialog's.
    return acquireScrollLock()
  }, [showMega, showMobileMenu])

  // Dynamic theme-color - merges browser chrome with current page background
  useEffect(() => {
    const meta = document.getElementById('aq-theme-color') as HTMLMetaElement | null
    if (!meta) return
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#F4EFE0'
    meta.content = bg
  }, [path])

  // Shake animation on disabled button clicks
  useEffect(() => {
    function handleDisabledClick(e: MouseEvent) {
      const btn = (e.target as HTMLElement).closest('button:disabled, button[aria-disabled="true"]') as HTMLElement | null
      if (!btn) return
      btn.classList.remove('btn-shake')
      void btn.offsetWidth // force reflow to restart animation
      btn.classList.add('btn-shake')
      btn.addEventListener('animationend', () => btn.classList.remove('btn-shake'), { once: true })
    }
    document.addEventListener('click', handleDisabledClick, true)
    return () => document.removeEventListener('click', handleDisabledClick, true)
  }, [])

  const initials = member?.full_name
    ? member.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U'
  const avatarColor = hashColor(member?.full_name || member?.email || 'U')
  const avatarUrl = (member as any)?.avatar_url

  return (
    <>
      {/* Global keyframes for HoD pulse dot */}
      {/* Skip to main content - keyboard/screen reader users */}
      <a href="#main-content" className="skip-to-main">Skip to main content</a>
      <nav className="aq-nav" role="navigation" aria-label="Primary" data-tint={navTint || undefined}>
        <div className="aq-nav-inner">
          {/* LEFT - logo. (A third hamburger trigger used to live here,
              wired to the same setShowDrop state as the desktop MENU button
              and the mobile hamburger - but v6.css permanently hides it
              (`.aq-hamburger-left-btn { display: none !important }`), so it
              never rendered. Removed rather than left as dead, confusing
              code sitting next to two real triggers wired to the same
              state.) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link to="/" className="aq-logo" onClick={handleLogoClick} aria-label="AquaTerra home" title="AquaTerra home">
              {/* `eager` is mandatory here, not an optimisation: this mark sits above
                  the fold on every route, and while it was lazy the button had no
                  intrinsic width (`.aq-logo-img` is height-driven with `width:auto`),
                  so the whole "go home" control rendered 2px wide until the image
                  decoded. width/height carry the mark's real ratio so the box is
                  reserved before the bytes land.
                  FIX (00.4/02.4, UX-GAPS bug #7): was /logo.png, a 1332x225
                  horizontal wordmark, inside this height-driven auto-width box -
                  it rendered ~5px tall. public/stamp-ink.png is the square
                  (256x256) mark built for exactly this slot.
                  Swaps to stamp-light when the pill itself tints dark
                  (navTint above) - stamp-ink on an ink/grape pill would be
                  near-invisible, the same problem the old mismatch note here
                  used to warn about for the (then-hypothetical) dark bar.

                  It USED to swap to stamp-white, and that is the bug reported
                  on /collaborations: stamp-white.png is not a reversed mark,
                  it is a flat silhouette - measured 2026-09-21, 197,691 opaque
                  pixels of a single white and no second colour. So the dark
                  branch was already firing correctly and still drew a
                  featureless white disc. stamp-light.png is stamp-ink
                  composited onto a cream (--paper) plate cut to the mark's OWN
                  alpha, so the silhouette is pixel-identical to the blob it
                  replaces while the artwork inside comes back. The plate
                  measures 17.2:1 against the ink pill.

                  `mix-blend-mode: multiply` below is tuned to erase
                  stamp-ink's white canvas - it can only DARKEN, so on a dark
                  pill it would erase this variant outright. `aq-logo-img--
                  white` turns blending off, and is what keeps that from
                  happening; the class name is historical. */}
              <Img
                src={navTintIsDark ? '/stamp-light-96.png' : '/stamp-ink-96.png'}
                alt="AquaTerra"
                className={'aq-logo-img no-outline' + (navTintIsDark ? ' aq-logo-img--white' : '')}
                eager
                width={256}
                height={256}
              />
            </Link>
            {confettiAt && <Suspense fallback={null}><ConfettiBurst x={confettiAt.x} y={confettiAt.y} onDone={() => setConfettiAt(null)} /></Suspense>}
          </div>

          {/* CENTER - floating pill */}
          <div className="aq-nav-pill">
            {navLinks.map(l => (
              <Link
                key={l.href}
                to={l.href}
                className={'aq-nav-link ' + l.accent + (isActive(l.href) ? ' active' : '')}
                aria-current={isActive(l.href) ? 'page' : undefined}
                onMouseEnter={() => prefetchRouteByPath(l.href)}
                onFocus={() => prefetchRouteByPath(l.href)}
                data-nav
              >
                <span className="aq-nav-link-icon">{l.icon}</span>
                <span className="aq-nav-link-label">{l.label}</span>
              </Link>
            ))}
            {isAuthenticated && isDirector && (
              <Link
                to="/director"
                className={'aq-nav-link aq-nav-link-director' + (path.startsWith('/director') ? ' active' : '')}
                aria-current={path.startsWith('/director') ? 'page' : undefined}
                onClick={() => localStorage.setItem('aq_hod_visited', '1')}
                data-nav
                style={{ position: 'relative' }}
              >
                <span className="aq-nav-link-icon" style={{ position: 'relative' }}>
                  <SparklesSVG />
                  {showHodPulse && (
                    <span style={{
                      position: 'absolute',
                      top: -3,
                      right: -3,
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: 'var(--pink)',
                      animation: 'hodPulse 1.4s ease-in-out infinite',
                      display: 'block',
                    }} />
                  )}
                </span>
                {/* No permanent "NEW" chip here any more - it never cleared,
                    unlike the pulse dot above (which does, via aq_hod_visited),
                    and a badge that's always new stops meaning anything -
                    including for the pulse dot two pixels away that actually
                    is time-limited. */}
                <span className="aq-nav-link-label">HoD Desk</span>
              </Link>
            )}
          </div>

          {/* RIGHT - actions */}
          <div className="aq-nav-actions">
            {/* Section 01 step 15, revised. Was ONE control in two forms: a
                44px icon button at <=1024, a 230px bordered field at >=1025.
                Now icon-only at every width - the field read as stretched-out
                chrome next to the rest of the bar's compact controls, and
                collapsing it to match the mobile pattern (this button) is the
                simpler fix over an animated expand-on-focus field, so that's
                what shipped. Still the same /search route either way; the "/"
                shortcut above now triggers this same navigation instead of
                focusing a field that no longer exists. */}
            <button
              className={'aq-nav-icon-btn aq-search-btn' + (path === '/search' ? ' active' : '')}
              onClick={() => navigate('/search')}
              title="Search"
              aria-label="Search"
            >
              <SearchSVG />
            </button>

            {isAuthenticated ? (
              <>
                {/* Notifications bell - the create/compose, saved-bookmark, and
                    HoD-sparkle shortcuts were removed from the desktop bar per
                    request; HoD + saved remain reachable via the avatar menu and
                    the mega menu. */}
                <button
                  className={'aq-nav-icon-btn aq-nav-icon-bell' + (path === '/notifications' ? ' active' : '')}
                  onClick={() => navigate('/notifications')}
                  title={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
                  aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
                >
                  <BellSVG />
                  {unreadCount > 0 && (
                    <span
                      className="aq-bell-dot"
                      aria-hidden
                      style={{
                        width: unreadCount > 9 ? 18 : 14, height: 14, borderRadius: 7,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--display)', fontSize: 9, fontWeight: 700,
                        color: '#0A0A0A', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                <div ref={menuRef} className="aq-avatar-wrapper" style={{ position: 'relative' }}>
                  <button
                    className="aq-avatar-btn"
                    onClick={() => setShowUserMenu(v => !v)}
                    title="Your profile"
                    aria-label="Your profile"
                    aria-expanded={showUserMenu}
                    aria-haspopup="menu"
                  >
                    <div className="avatar avatar-sm" style={{ background: avatarColor, overflow: 'hidden' }}>
                      {avatarUrl
                        ? <Img ctx="avatar" src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                        : initials}
                    </div>
                  </button>
                  {showUserMenu && (
                    <div className="menu" role="menu" style={{ right: 0, top: 44, minWidth: 160 }}>
                      <button
                        type="button"
                        role="menuitem"
                        className="menu-item"
                        onClick={() => { setShowUserMenu(false); navigate('/profile/me') }}
                      >
                        Profile
                      </button>
                      {/* /my-posts was previously unreachable from anywhere in
                          the UI: not in this menu, not in the bottom tab bar,
                          not in the mega menu, not on the profile page. Its
                          only entry point was a button inside CreatePostModal's
                          success state, which dismisses itself after 800ms. It
                          is the only surface that shows a post's moderation
                          status and the HoD's rejection note, so a member whose
                          post was sent back had no way to reach the reason. */}
                      <button
                        type="button"
                        role="menuitem"
                        className="menu-item"
                        onClick={() => { setShowUserMenu(false); navigate('/my-posts') }}
                      >
                        My posts
                      </button>
                      {/* /saved had the same problem /my-posts did: every feed
                          card ships a bookmark button and the route exists, but
                          nothing in the app linked to it, so a member could save
                          posts and never read them back. This is its entry
                          point. */}
                      <button
                        type="button"
                        role="menuitem"
                        className="menu-item"
                        onClick={() => { setShowUserMenu(false); navigate('/saved') }}
                      >
                        Saved posts
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="menu-item"
                        onClick={() => { setShowUserMenu(false); navigate('/settings') }}
                      >
                        Settings
                      </button>
                      {/* Bug reports: a member-facing surface, so it lives with the
                          member's own things rather than behind the HoD desk. */}
                      <button
                        type="button"
                        role="menuitem"
                        className="menu-item"
                        onClick={() => { setShowUserMenu(false); navigate('/bugs') }}
                      >
                        Bugs & requests
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="menu-item"
                        onClick={() => { setShowUserMenu(false); navigate('/tasks') }}
                      >
                        Tasks
                      </button>
                      {/* /calendar had no link anywhere in the app (found by the product-guide checker, 2026-11-01). */}
                      <button
                        type="button"
                        role="menuitem"
                        className="menu-item"
                        onClick={() => { setShowUserMenu(false); navigate('/calendar') }}
                      >
                        Calendar
                      </button>
                      {isDirector && (
                        <button
                          type="button"
                          role="menuitem"
                          className="menu-item"
                          onClick={() => { setShowUserMenu(false); navigate('/notifications') }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                        >
                          <BellSVG /> Alerts
                        </button>
                      )}
                      <div style={{ borderTop: '1px solid var(--line)', margin: '4px 0' }} />
                      <button
                        type="button"
                        role="menuitem"
                        className="menu-item danger"
                        onClick={async () => { setShowUserMenu(false); await logout(); navigate('/') }}
                      >
                        Log out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <button className="btn btn-sm btn-primary" onClick={() => navigate('/login')} data-mascot-target="join">
                  {isReturningVisitor ? 'Log in →' : 'Apply →'}
                </button>
              </>
            )}

            {/* MENU - desktop-only trigger for the full-screen mega menu
                (hidden ≤767px, where the bottom tab bar + hamburger sheet
                carry navigation). */}
            <button
              className="aq-menu-btn"
              onClick={() => setShowDrop(v => !v)}
              aria-label={showDrop ? 'Close menu' : 'Open menu'}
              aria-expanded={showDrop}
              aria-haspopup="menu"
            >
              <EllipsisHorizontalIcon width={18} height={18} strokeWidth={2.5} aria-hidden="true" />
              menu
            </button>

            {/* Mobile hamburger - hidden desktop, shown mobile via CSS.
                Uses the same `aq-icon-swap` cross-fade pattern as the
                left-side hamburger so the two are visually identical. */}
            <button
              id="aq-hamburger"
              className="aq-nav-icon-btn aq-hamburger-btn"
              onClick={() => setShowDrop(v => !v)}
              aria-label={showDrop ? 'Close menu' : 'Open menu'}
              aria-expanded={showDrop}
              aria-haspopup="menu"
            >
              {/* Both frames are heroicons now (section 01 step 14 + the icon
                  ground rule). The cross-fade swap is unchanged. */}
              <span className="aq-icon-swap" aria-hidden>
                <EllipsisHorizontalIcon
                  className={`aq-icon-swap-frame ${showDrop ? 'is-hidden' : 'is-visible'}`}
                  width={18} height={18} strokeWidth={2.5}
                />
                <XMarkIcon
                  className={`aq-icon-swap-frame ${showDrop ? 'is-visible' : 'is-hidden'}`}
                  width={18} height={18} strokeWidth={2.5}
                />
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* ── Compact "explore" dropdown - the quick sub-menu shown before the
          full-screen menu (both desktop + mobile), per the handoff. ── */}
      {shownDrop && (() => {
        const dropLinks: [string, string][] = [
          ['home', '/'], ['projects', '/projects'], ['teams', '/teams'], ['terra notes', '/terranotes'],
          ['blog', '/blog'], ['members', '/members'], ['openings', '/opportunities'], ['about', '/about'],
        ]
        // 760, not 768. The CSS switches the whole nav at max-width:760 (the
        // .aq-menu-btn / .aq-hamburger-btn pair, the bar layout, the dock), so
        // a 768 threshold here left a 7px band, 761 to 767, where the DESKTOP
        // MENU pill was on screen but opened the MOBILE drawer. Read the
        // breakpoint from one place so the two cannot drift again.
        const openFull = () => {
          setShowDrop(false)
          if (typeof window !== 'undefined' && window.innerWidth <= NAV_MOBILE_MAX) setShowMobileMenu(true)
          else setShowMega(true)
        }
        return (
          <>
            <div className="aq-drop-scrim" onClick={() => setShowDrop(false)} aria-hidden />
            <div className={'aq-drop' + (dropClosing ? ' aq-drop-closing' : '')} role="menu" aria-label="Explore">
              <div className="aq-drop-lbl">explore</div>
              <div className="aq-drop-grid">
                {dropLinks.map(([label, href]) => (
                  <Link
                    key={href}
                    to={href}
                    role="menuitem"
                    className={'aq-drop-link' + (isActive(href) ? ' on' : '')}
                    aria-current={isActive(href) ? 'page' : undefined}
                    onClick={() => setShowDrop(false)}
                    // This dropdown renders on mobile too (see the comment
                    // above dropLinks) - onTouchStart added alongside hover/
                    // focus so a real tap gets the same head start.
                    onTouchStart={() => prefetchRouteByPath(href)}
                    onMouseEnter={() => prefetchRouteByPath(href)}
                    onFocus={() => prefetchRouteByPath(href)}
                  >
                    <span>{label}</span>
                    <span className="aq-drop-ar" aria-hidden>{isActive(href) ? '●' : '→'}</span>
                  </Link>
                ))}
              </div>
              {isAuthenticated && (
                <Link to="/tasks" role="menuitem" className={'aq-drop-link' + (isActive('/tasks') ? ' on' : '')} aria-current={isActive('/tasks') ? 'page' : undefined} onClick={() => setShowDrop(false)}>
                  <span>tasks</span><span className="aq-drop-ar" aria-hidden>{isActive('/tasks') ? '●' : '→'}</span>
                </Link>
              )}
              {isAuthenticated && isDirector && (
                <Link to="/director" role="menuitem" className="aq-drop-link aq-drop-hod" onClick={() => setShowDrop(false)}>
                  <span>hod desk</span><span className="aq-drop-ar" aria-hidden>→</span>
                </Link>
              )}
              {/* Section 33. Below 768px the mega menu never renders, so the
                  dropdown has to carry Labs itself. NOT added to `dropLinks`:
                  that list is seven links by design, and Labs there would be
                  one more identical arrow row. An ink block instead, following
                  the .aq-drop-hod pattern directly above. */}
              <Link
                to="/terranotes/articles/labs"
                role="menuitem"
                className="aq-drop-link aq-drop-labs"
                onClick={() => setShowDrop(false)}
                onTouchStart={() => prefetchRouteByPath('/terranotes')}
                onMouseEnter={() => prefetchRouteByPath('/terranotes')}
                onFocus={() => prefetchRouteByPath('/terranotes')}
              >
                <span>aq labs ’26</span>
                <span className="aq-drop-ar" aria-hidden>→</span>
              </Link>
              {/* AquaTerra Live (/live) in the half menu: same ink block as Labs above, so no new CSS. */}
              <Link
                to="/live"
                role="menuitem"
                className="aq-drop-link aq-drop-labs"
                onClick={() => setShowDrop(false)}
                onTouchStart={() => prefetchRouteByPath('/live')}
                onMouseEnter={() => prefetchRouteByPath('/live')}
                onFocus={() => prefetchRouteByPath('/live')}
              >
                <span>aquaterra live</span>
                <span className="aq-drop-ar" aria-hidden>→</span>
              </Link>
              <button role="menuitem" className="aq-drop-full" onClick={openFull}>
                full menu <span aria-hidden>⤢</span>
              </button>
              {!isAuthenticated && (
                <button className="btn btn-primary aq-drop-cta" onClick={() => { navigate('/login'); setShowDrop(false) }}>
                  {isReturningVisitor ? 'log in →' : 'join the work →'}
                </button>
              )}
            </div>
          </>
        )
      })()}

      {/* ── Full-screen MEGA MENU (desktop) ── */}
      {showMega && (() => {
        const go = (href: string) => {
          setShowMega(false)
          if (/^https?:\/\//.test(href)) { window.open(href, '_blank', 'noopener,noreferrer'); return }
          navigate(href)
        }
        const explore: [string, string, string][] = [
          ['01', 'Home', '/'], ['02', 'Projects', '/projects'], ['03', 'Teams', '/teams'],
          ['04', 'Blog', '/blog'], ['05', 'Members', '/members'], ['06', 'About', '/about'],
          ['TN', 'Terra Notes', '/terranotes'], ['LV', 'Live - Events and more', '/live'],
        ]
        const exploreHc = ['var(--pink)', 'var(--lemon)', 'var(--sky)', 'var(--grape)', 'var(--tomato)', 'var(--welfare)', 'var(--lemon)', 'var(--tomato)']
        const involved: [string, string, string, string][] = [
          (isAuthenticated
            ? ['07', 'My Profile', '/profile/me', 'var(--pink)'] as [string, string, string, string]
            : ['07', 'Apply', '/login', 'var(--pink)'] as [string, string, string, string]),
          ['08', 'Openings', '/opportunities', 'var(--lemon)'],
          ['09', 'Brand book', '/brand', 'var(--pink)'], ['10', 'Crftd', '/crftd', 'var(--grape)'],
          ['11', 'ShikshAQ', 'https://shikshaq.in', 'var(--sky)'], ['12', 'Collab', '/collaborations', 'var(--welfare)'],
          // Section 33: AQ Labs lands in the get-involved column, NOT in
          // navLinks. That is a recorded user decision: navLinks is three items
          // by design, and a top-level slot would weight a seven-project cohort
          // like the feed, when four of the seven point at sites AQ does not
          // control. --grape rather than the guide's --lemon, so it does not
          // read as a run with Handbook directly under it.
          ['13', 'AQ Labs', '/terranotes/articles/labs', 'var(--grape)'],
          ['14', 'Handbook', '/volunteer', 'var(--lemon)'],
          ['15', 'Equity policy', '/equity-policy', 'var(--sky)'],
          ...(isAuthenticated && isDirector ? [['16', 'HOD Desk', '/director', 'var(--tomato)'] as [string, string, string, string]] : []),
          ...(isAuthenticated ? [[isDirector ? '17' : '16', 'Bugs & requests', '/bugs', 'var(--lemon)'] as [string, string, string, string]] : []),
          ...(isAuthenticated ? [[isDirector ? '18' : '17', 'Tasks', '/tasks', 'var(--sky)'] as [string, string, string, string]] : []),
        ]
        return (
          <div ref={megaRef} tabIndex={-1} style={{ outline: 'none' }} className="aq-mega" role="dialog" aria-modal="true" aria-label="Site menu">
            <div className="aq-mega-scroll">
              <div className="aq-mega-top">
                <button className="aq-mega-logo" onClick={() => go('/')} aria-label="AquaTerra home">
                  {/* FIX (00.4/02.4, UX-GAPS bug #7): same 5px-tall wordmark-in-a-
                      square-slot bug as the top nav logo. `.aq-mega-logo` is a
                      light (rgba(255,255,255,.94)) capsule, so stamp-ink, not
                      stamp-white. */}
                  <Img src="/stamp-ink-96.png" alt="AquaTerra" className="no-outline" />
                </button>
                <button className="aq-mega-x" onClick={() => setShowMega(false)}>
                  close <span aria-hidden style={{ fontSize: 15 }}>✕</span>
                </button>
              </div>

              <div className="aq-mega-grid">
                <div className="aq-mega-cols">
                  <div>
                    <div className="aq-mega-lbl">explore</div>
                    {explore.map(([num, label, href], i) => (
                      <a key={href} className={'aq-mega-link' + (isActive(href) ? ' is-active' : '')}
                        aria-current={isActive(href) ? 'page' : undefined}
                        onClick={() => go(href)}
                        onMouseEnter={() => prefetchRouteByPath(href)}
                        onFocus={() => prefetchRouteByPath(href)}
                        style={{ ['--hc' as any]: exploreHc[i] }}>
                        <span className="num">{num}</span>{label}<span className="ar">→</span>
                      </a>
                    ))}
                  </div>
                  {/* Section 01 step 17. These nine were a second column of
                      44px display links, which gave a brand book and a handbook
                      the same weight as Home. They are now an outlined pill
                      cluster under the primary five, so the explore column
                      reads as the primary set.
                      EVERY ROUTE IS KEPT: 07 Apply-or-My-Profile, 08 Openings,
                      09 Brand book, 10 Crftd, 11 ShikshAQ, 12 Collab,
                      13 AQ Labs, 14 Handbook, 15 Equity policy, 16 HOD Desk.
                      Labs is the one addition, by the decision above; none
                      none removed. The numbers survive as the pill's index so
                      the ordering documented in github.md still reads. */}
                  <div>
                    <div className="aq-mega-lbl" style={{ background: 'var(--lemon)' }}>get involved</div>
                    <div className="aq-mega-pills">
                      {involved.map(([num, label, href, hc]) => (
                        <a key={href} className={'aq-mega-pill' + (isActive(href) ? ' is-active' : '')}
                          aria-current={isActive(href) ? 'page' : undefined}
                          onClick={() => go(href)}
                          onMouseEnter={() => prefetchRouteByPath(href)}
                          onFocus={() => prefetchRouteByPath(href)}
                          style={{ ['--hc' as any]: hc }}>
                          <span className="num">{num}</span>{label}
                        </a>
                      ))}
                    </div>
                    {/* Mini games: the hub link is always there; each registered game (games/games.ts) adds a pill. */}
                    <div className="aq-mega-lbl" style={{ background: 'var(--sky)', marginTop: 20 }}>mini games</div>
                    <div className="aq-mega-pills">
                      <a className={'aq-mega-pill' + (path === '/games' ? ' is-active' : '')}
                        aria-current={path === '/games' ? 'page' : undefined}
                        href="/games" onClick={e => { e.preventDefault(); go('/games') }}
                        onMouseEnter={() => prefetchRouteByPath('/games')} onFocus={() => prefetchRouteByPath('/games')}
                        style={{ ['--hc' as any]: 'var(--sky)' }}>
                        <span className="num">▶</span>{GAMES.length ? 'All games' : 'Mini games'}
                      </a>
                      {GAMES.map(g => (
                        <a key={g.slug} className={'aq-mega-pill' + (path === `/games/${g.slug}` ? ' is-active' : '')}
                          aria-current={path === `/games/${g.slug}` ? 'page' : undefined}
                          href={`/games/${g.slug}`} onClick={e => { e.preventDefault(); go(`/games/${g.slug}`) }}
                          style={{ ['--hc' as any]: g.hue }}>
                          <span className="num">▶</span>{g.title}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="aq-mega-side">
                  <div className="aq-mega-socs">
                    <a className="aq-mega-soc" href="https://instagram.com/ngo.aquaterra" target="_blank" rel="noopener noreferrer"><b>@ngo.aquaterra</b><span>instagram</span></a>
                  </div>
                  <div className="aq-mega-socs">
                    <a className="aq-mega-soc" href="/faq" onClick={e => { e.preventDefault(); go('/faq') }} onMouseEnter={() => prefetchRouteByPath('/faq')} onFocus={() => prefetchRouteByPath('/faq')}><b>FAQ</b><span>questions</span></a>
                    <a className="aq-mega-soc" href="/support" onClick={e => { e.preventDefault(); go('/support') }} onMouseEnter={() => prefetchRouteByPath('/support')} onFocus={() => prefetchRouteByPath('/support')}><b>Support</b><span>help centre</span></a>
                    <a className="aq-mega-soc" href="/accounts" onClick={e => { e.preventDefault(); go('/accounts') }} onMouseEnter={() => prefetchRouteByPath('/accounts')} onFocus={() => prefetchRouteByPath('/accounts')}><b>Open Books</b><span>every rupee</span></a>
                    <a className="aq-mega-soc" href="/links" onClick={e => { e.preventDefault(); go('/links') }} onMouseEnter={() => prefetchRouteByPath('/links')} onFocus={() => prefetchRouteByPath('/links')}><b>All links</b><span>sitemap</span></a>
                  </div>
                </div>
              </div>

              {/* Section 01 step 18: the join CTA, full-width and pinned at
                  the bottom of the menu. It previously sat in the right-hand
                  side column above the socials. It is MOVED, not duplicated:
                  two join CTAs on one overlay would compete.
                  The step's mascot sits beside it, now that section 09 exists.
                  It is placed on the lemon CTA band rather than the ink panel,
                  so it is never hue-on-hue. */}
              {isAuthenticated ? (
                <div className="aq-mega-cta aq-mega-cta-wide">
                  <Mascot character="ilish" pose="peek" peekFrom="right" size={64} />
                  <span className="sticker sticker--diecut" style={{ background: '#0A0A0A', color: 'var(--welfare)', ['--sticker-ground' as string]: 'var(--lemon)' }}>★ welcome back</span>
                  <h3>{member?.full_name?.split(' ')[0] || 'you'}'s feed.</h3>
                  <p>Catch up on what the community posted while you were away.</p>
                  <button className="btn" onClick={() => go('/')} style={{ background: '#0A0A0A', color: 'var(--welfare)', borderColor: '#000' }}>
                    go to the feed →
                  </button>
                </div>
              ) : (
                <div className="aq-mega-cta aq-mega-cta-wide">
                  <Mascot character="ilish" pose="peek" peekFrom="right" size={64} />
                  <span className="sticker sticker--diecut" style={{ background: '#0A0A0A', color: 'var(--welfare)', ['--sticker-ground' as string]: 'var(--lemon)' }}>★ 2 min to apply</span>
                  <h3>join the chaos.</h3>
                  <p>{displayCount(ORG_FACTS.membersTotal)} students. real welfare work. free forever.</p>
                  <button className="btn" onClick={() => go('/login')} style={{ background: '#0A0A0A', color: 'var(--welfare)', borderColor: '#000' }}>
                    start application →
                  </button>
                </div>
              )}

              <div className="aq-mega-foot">
                <span>© 2026 AquaTerra · kolkata · since 2021</span>
                <span>DARPAN: AAFTT2300ME20251</span>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Mobile menu - full-screen sheet. Grouped into rounded cards (the same language as the explore
          dropdown that opens it) instead of one 22-row wall, and it carries every destination the
          dropdown and the desktop mega menu do, Labs and Live included. */}
      {showMobileMenu && (() => {
        type Row = { href: string; label: string; pulse?: boolean; ink?: boolean; onGo?: () => void }
        const closeMenu = () => setShowMobileMenu(false)
        const here = (href: string) => (href === '/terranotes' ? path.startsWith('/terranotes') && !path.startsWith(LABS_HREF) : isActive(href))
        const groups: { title: string; wide?: boolean; rows: Row[] }[] = []
        if (isAuthenticated) {
          const you: Row[] = [
            { href: '/my-posts', label: 'My posts' },
            { href: '/tasks', label: 'Tasks' },
            { href: '/bugs', label: 'Bugs & requests' },
            { href: '/calendar', label: 'Calendar' },
            { href: '/invite', label: 'Invite a friend' },
            { href: '/yearbook', label: 'Yearbook' },
          ]
          if (isDirector) you.unshift({ href: '/director', label: 'HoD desk', pulse: showHodPulse, onGo: () => localStorage.setItem('aq_hod_visited', '1') })
          groups.push({ title: 'you', rows: you })
        }
        const sheet = (hrefs: string[]) => hrefs.map(h => mobileSheetLinks.find(l => l.href === h)!).map(l => ({ href: l.href, label: l.label }))
        groups.push({ title: 'explore', rows: [...sheet(['/projects', '/teams', '/members', '/blog', '/terranotes', '/games', '/opportunities']), { href: '/live', label: 'AquaTerra Live', ink: true }, { href: LABS_HREF, label: 'AQ Labs ’26', ink: true }] })
        groups.push({ title: 'about aquaterra', rows: sheet(['/about', '/volunteer', '/crftd', '/collaborations', '/schools', '/classes', '/faq', '/support', '/contact']) })
        groups.push({ title: 'open books', rows: sheet(['/links', '/accounts', '/equity-policy']) })
        return (
          <div ref={drawerRef} tabIndex={-1} style={{ outline: 'none' }} className="aq-drawer" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="aq-draw-hd">
              <Link to="/" onClick={closeMenu} aria-label="AquaTerra home" className="aq-draw-logo">
                <Img src="/stamp-ink-96.png" alt="AquaTerra" className="no-outline" style={{ height: 30, objectFit: 'contain' }} />
              </Link>
              <button onClick={closeMenu} className="aq-draw-x" aria-label="Close menu" title="Close menu">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="aq-draw-body">
              {groups.map(g => (
                <section key={g.title} className="aq-draw-group" aria-label={g.title}>
                  <h2 className="aq-draw-lbl">{g.title}</h2>
                  <div className="aq-draw-grid">
                    {g.rows.map(r => {
                      const on = here(r.href)
                      return (
                        <Link
                          key={r.href}
                          to={r.href}
                          className={'aq-draw-link' + (on ? ' on' : '') + (r.pulse !== undefined ? ' aq-draw-hod' : '') + (r.ink ? ' aq-draw-ink' : '') + (!r.label.includes(' ') && r.label.length > 10 ? ' aq-draw-wide' : '')}
                          aria-current={on ? 'page' : undefined}
                          onClick={() => { r.onGo?.(); closeMenu() }}
                          // This sheet only opens on a touch viewport: onTouchStart fires on finger-down, ahead of the tap's click.
                          onTouchStart={() => prefetchRouteByPath(r.href)}
                          onMouseEnter={() => prefetchRouteByPath(r.href)}
                          onFocus={() => prefetchRouteByPath(r.href)}
                        >
                          <span className="aq-draw-name">
                            {r.label}
                            {r.pulse && <span className="aq-draw-pulse" aria-hidden />}
                          </span>
                          <span className="aq-draw-arrow" aria-hidden>{on ? '●' : '→'}</span>
                        </Link>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>

            <div className="aq-draw-foot">
              {isAuthenticated ? (
                <Link to="/notifications" className="btn btn-primary aq-draw-cta" onClick={closeMenu}><BellSVG /> notifications</Link>
              ) : (
                <Link to="/login" className="btn btn-primary aq-draw-cta" onClick={closeMenu}>{isReturningVisitor ? 'log in →' : 'join the work →'}</Link>
              )}
            </div>
          </div>
        )
      })()}
    </>
  )
}
