// @ts-nocheck
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { SPRING, MotionLink } from '../lib/motion'
import { useWhatsAppGroup } from '../lib/useWhatsAppGroup'

type Phase = 'pre_event' | 'live' | 'post_event'

const NAV = [
  { href: '/paradox',           label: 'Home',        n: '01', phases: ['pre_event', 'live', 'post_event'] },
  { href: '/paradox/events',     label: 'Events',      n: '02', phases: ['pre_event', 'live', 'post_event'] },
  { href: '/paradox/schedule',   label: 'Schedule',    n: '03', phases: ['pre_event', 'live'] },
  { href: '/paradox/updates',    label: 'Updates',     n: '04', phases: ['live'] },
  { href: '/paradox/scores',     label: 'Scores',      n: '05', phases: ['live', 'post_event'] },
  { href: '/paradox/sponsor',    label: 'Sponsor',     n: '06', phases: ['pre_event'] },
  { href: '/paradox/afterparty', label: 'After Party', n: '07', phases: ['pre_event', 'live'] },
  { href: '/paradox/team',       label: 'Team',        n: '08', phases: ['pre_event'] },
  { href: '/paradox/blog',       label: 'Blog',        n: '09', phases: ['pre_event', 'live', 'post_event'] },
  { href: '/paradox/contact',    label: 'Contact',     n: '11', phases: ['pre_event', 'live', 'post_event'] },
]

// Desktop pill — links per side of the logo. Paths must match the
// hrefs declared in NAV above (which are /paradox/* prefixed).
// Schedule sits next to Events on the left because the two are
// the most-trafficked pre-event surfaces and people often want to
// glance at "when is X" without opening the events list.
const LEFT_LINKS  = ['/paradox/events', '/paradox/schedule', '/paradox/contact']
const RIGHT_LINKS = ['/paradox/afterparty']

// Overlay menu hover colors
const HOVER_BG    = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c1)']
const HOVER_COLOR = ['var(--bg)', 'var(--ink)', 'var(--ink)', 'var(--bg)']

// ─── Cursor position state ─────────────────────────────────────────────────
type CursorPos = { left: number; width: number; opacity: number }

// Spring config — snappy, not bouncy
// Spring tuned for short distances. bounce: 0 keeps it snappy without
// overshoot. stiffness reduced from 600 → 380 — same perceived speed at
// nav-link distances, lower CPU during long route-change transitions.
const CURSOR_SPRING = { type: 'spring', stiffness: 380, damping: 32, bounce: 0 } as const

// ─── Single tab item inside the pill ──────────────────────────────────────
function NavTab({
  href, label, isActive, setPosition,
}: {
  href: string
  label: string
  isActive: boolean
  setPosition: React.Dispatch<React.SetStateAction<CursorPos>>
}) {
  const ref = useRef<HTMLAnchorElement>(null)

  return (
    <Link
      ref={ref}
      to={href}
      onMouseEnter={() => {
        if (!ref.current) return
        const { width } = ref.current.getBoundingClientRect()
        setPosition({ width, opacity: 1, left: ref.current.offsetLeft })
      }}
      className="relative z-10 block px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] select-none whitespace-nowrap"
      style={{
        // white + mix-blend-difference:
        //   over ink cursor  → 255-18  = 237 ≈ cream (readable ✓)
        //   over cream bg    → 255-251 = 4   ≈ near-black (readable ✓)
        color: 'white',
        mixBlendMode: 'difference' as const,
        fontWeight: isActive ? 700 : 400,
        letterSpacing: isActive ? '0.12em' : '0.1em',
      }}
    >
      {label}
    </Link>
  )
}

// ─── NavTab with optional activeRef forwarding ────────────────────────────
function NavTabWithRef({
  href, label, isActive, setPosition, activeRef,
}: {
  href: string
  label: string
  isActive: boolean
  setPosition: React.Dispatch<React.SetStateAction<CursorPos>>
  activeRef?: React.MutableRefObject<HTMLAnchorElement | null>
}) {
  const ref = useRef<HTMLAnchorElement>(null)

  // sync ref to parent activeRef when this is the active tab
  useEffect(() => {
    if (isActive && activeRef) activeRef.current = ref.current
  })

  return (
    <Link
      ref={ref}
      to={href}
      onMouseEnter={() => {
        if (!ref.current) return
        const { width } = ref.current.getBoundingClientRect()
        setPosition({ width, opacity: 1, left: ref.current.offsetLeft })
      }}
      className="relative z-10 block px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] select-none whitespace-nowrap"
      style={{
        color: 'white',
        mixBlendMode: 'difference' as const,
        fontWeight: isActive ? 700 : 400,
        letterSpacing: isActive ? '0.12em' : '0.1em',
      }}
    >
      {label}
    </Link>
  )
}

// ─── Active pill — always visible, c1 red, slides on route change ──────────
function ActiveCursor({ left, width }: { left: number; width: number }) {
  if (width === 0) return null
  return (
    <motion.div
      layoutId="nav-active-pill"
      animate={{ left, width, opacity: 1 }}
      transition={CURSOR_SPRING}
      className="absolute top-1 bottom-1 z-0 rounded-full pointer-events-none"
      style={{ background: 'var(--c1)' }}
    />
  )
}

// ─── Hover cursor — ink, fades out on mouse-leave ─────────────────────────
function SlidingCursor({ position }: { position: CursorPos }) {
  return (
    <motion.div
      animate={position}
      transition={CURSOR_SPRING}
      className="absolute top-1 bottom-1 z-0 rounded-full pointer-events-none"
      style={{ background: 'var(--ink)' }}
    />
  )
}

// ─── Desktop pill nav ──────────────────────────────────────────────────────
function DesktopPillNav({
  phase, pathname, onMenuOpen,
}: {
  phase: Phase; pathname: string; onMenuOpen: () => void
}) {
  const [position, setPosition]   = useState<CursorPos>({ left: 0, width: 0, opacity: 0 })
  const [activePos, setActivePos] = useState({ left: 0, width: 0 })
  const activeRef = useRef<HTMLAnchorElement | null>(null)

  const leftLinks  = LEFT_LINKS.filter(href => NAV.find(n => n.href === href)?.phases.includes(phase))
  const rightLinks = RIGHT_LINKS.filter(href => NAV.find(n => n.href === href)?.phases.includes(phase))

  // Measure active tab position for the persistent c1 cursor
  useEffect(() => {
    if (!activeRef.current) return
    const { width, left: absLeft } = activeRef.current.getBoundingClientRect()
    const parentLeft = activeRef.current.closest('ul')?.getBoundingClientRect().left ?? 0
    setActivePos({ left: absLeft - parentLeft, width })
  }, [pathname])

  const allLinks = [...leftLinks, ...rightLinks]

  return (
    <div className="hidden md:flex items-center gap-3">

      {/* ── Sliding pill ──────────────────────────────────────────── */}
      <ul
        className="relative flex items-center rounded-full border-[1.5px] border-ink px-1 overflow-visible"
        style={{
          height: 44,
          background: 'color-mix(in oklch, var(--bg) 92%, transparent)',
          backdropFilter: 'blur(8px)',
        }}
        onMouseLeave={() => setPosition(pv => ({ ...pv, opacity: 0 }))}
      >
        {/* Left links */}
        {leftLinks.map(href => {
          const isActive = pathname === href
          return (
            <NavTabWithRef key={href} href={href}
              label={NAV.find(n => n.href === href)!.label}
              isActive={isActive}
              setPosition={setPosition}
              activeRef={isActive ? activeRef : undefined}
            />
          )
        })}

        {/* ── Logo — centered, overflows pill ──────────────── */}
        <li className="relative z-20 mx-2 flex items-center" style={{ pointerEvents: 'none' }}>
          <Link to="/paradox" aria-label="Home" style={{ pointerEvents: 'auto' }}>
            <img
              src="/paradox/paradox-logo.png"
              alt="Paradox"
              className="no-outline"
              style={{
                height: 80,                    // intentionally taller than 44px pill
                width: 'auto',
                transform: 'rotate(-4deg)',
                display: 'block',
                position: 'relative',
                zIndex: 30,
                filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.18))',
              }}
              draggable={false}
            />
          </Link>
        </li>

        {/* Right links */}
        {rightLinks.map(href => {
          const isActive = pathname === href
          return (
            <NavTabWithRef key={href} href={href}
              label={NAV.find(n => n.href === href)!.label}
              isActive={isActive}
              setPosition={setPosition}
              activeRef={isActive ? activeRef : undefined}
            />
          )
        })}

        {/* Instagram external link — styled as a pill tab */}
        <a
          href="https://instagram.com/paradox.twenty26"
          target="_blank"
          rel="noreferrer"
          className="relative z-10 flex items-center gap-1.5 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] select-none whitespace-nowrap"
          style={{ color: 'white', mixBlendMode: 'difference' as const }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
          </svg>
          Instagram
        </a>

        {/* Active pill — persistent c1 red under current page */}
        <ActiveCursor left={activePos.left} width={activePos.width} />

        {/* Hover pill — ink, fades on mouse-leave */}
        <SlidingCursor position={position} />
      </ul>

      {/* Hamburger — sits above the overflowing logo (z-30) */}
      <motion.button
        whileTap={{ scale: 0.96 }}
        transition={SPRING}
        onClick={onMenuOpen}
        className="w-11 h-11 rounded-full flex items-center justify-center border-[1.5px] border-ink transition-[background-color,color]"
        style={{ position: 'relative', zIndex: 35, background: 'var(--ink)', color: 'var(--bg)' }}
        aria-label="Open menu"
      >
        <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor" aria-hidden="true">
          <rect y="0"    width="16" height="1.5" rx="0.75"/>
          <rect y="4.75" width="12" height="1.5" rx="0.75"/>
          <rect y="9.5"  width="8"  height="1.5" rx="0.75"/>
        </svg>
      </motion.button>
    </div>
  )
}

// ─── Main export ───────────────────────────────────────────────────────────
export function Nav() {
  const [open, setOpen]   = useState(false)
  const { pathname }      = useLocation()

  // Paradox 2026 has concluded — pin the site to its post-event state (Scores
  // surfaced; registration, schedule, sponsor and after-party retired).
  // We no longer read site_phase from the separate Paradox DB, so a flag left on
  // pre_event/live can't make registration or spot entry read as "open" again.
  const phase: Phase = 'post_event'

  // Close the mobile menu on navigation. Adjusted during render (same
  // prevBase/prevPathname technique as components/Img.tsx and
  // terrathon/components/Nav.tsx) instead of an effect, so a route change
  // closes the menu in the same render instead of a tick later.
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setOpen(false)
  }

  return (
    <>
      <motion.header
        initial={{ y: -48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 30 }}
        className="sticky top-0 z-40 overflow-visible
          md:border-b-[1.5px] md:border-ink"
        style={{
          /* Desktop: frosted bg. Mobile: fully transparent — just logo + button float */
          background: 'transparent',
          position: 'sticky', zIndex: 40,
        }}
      >
        {/* Desktop-only frosted bg layer */}
        <div className="absolute inset-0 hidden md:block pointer-events-none"
          style={{
            background: 'color-mix(in oklch, var(--bg) 88%, transparent)',
            backdropFilter: 'blur(12px)',
          }}
        />
        <div className="max-w-[1280px] mx-auto flex items-center h-[72px] overflow-visible px-4 sm:px-8">

          {/* Mobile: logo left */}
          <Link to="/paradox" aria-label="Home" className="md:hidden">
            <img
              src="/paradox/paradox-logo.png" alt="Paradox"
              className="no-outline"
              style={{ height: 80, width: 'auto', transform: 'rotate(-4deg)', display: 'block' }}
              draggable={false}
            />
          </Link>

          {/* Desktop: pill centered */}
          <div className="hidden md:flex flex-1 justify-center">
            <DesktopPillNav phase={phase} pathname={pathname} onMenuOpen={() => setOpen(true)} />
          </div>

          {/* Mobile hamburger right */}
          <motion.button
            whileTap={{ scale: 0.96 }} transition={SPRING}
            onClick={() => setOpen(true)}
            className="w-11 h-11 rounded-full flex items-center justify-center border-[1.5px] border-ink ml-auto md:hidden"
            style={{ background: 'var(--ink)', color: 'var(--bg)' }}
            aria-label="Open menu"
          >
            <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor">
              <rect y="0"    width="16" height="1.5" rx="0.75"/>
              <rect y="4.75" width="12" height="1.5" rx="0.75"/>
              <rect y="9.5"  width="8"  height="1.5" rx="0.75"/>
            </svg>
          </motion.button>
        </div>
      </motion.header>

      <AnimatePresence initial={false}>
        {open && <NavOverlay current={pathname} phase={phase} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  )
}

// ─── Overlay nav link ──────────────────────────────────────────────────────
function OverlayLink({
  href, label, n, isActive, hoverBg, hoverFg, onClose,
}: {
  href: string; label: string; n: string; isActive: boolean;
  hoverBg: string; hoverFg: string; onClose: () => void;
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      to={href} onClick={onClose}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-end gap-2 p-3 py-4 rounded-xl border border-bg/10 min-h-[64px]"
      style={{
        background: (isActive || hovered) ? hoverBg : 'transparent',
        color:      (isActive || hovered) ? hoverFg : 'var(--bg)',
        transitionProperty: 'background-color, color',
        transitionDuration: '0.15s',
      }}
    >
      <span className="font-mono text-[9px] tracking-[0.06em] opacity-40 mb-0.5 shrink-0">{n}</span>
      <span className="font-display leading-none flex-1" style={{ fontSize: 'clamp(22px, 5vw, 28px)' }}>
        {label}
      </span>
      {isActive && <span className="font-mono text-[9px] shrink-0 mb-1 opacity-70">●</span>}
    </Link>
  )
}

// ─── Full-screen overlay ───────────────────────────────────────────────────
function NavOverlay({ current, phase, onClose }: { current: string; phase: Phase; onClose: () => void }) {
  const visibleNav = NAV.filter(it => it.phases.includes(phase))
  const waUrl = useWhatsAppGroup()

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      className="fixed inset-0 z-[100] flex flex-col overflow-y-auto"
      style={{ position: 'fixed', zIndex: 100, background: 'var(--ink)', color: 'var(--bg)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-8 border-b border-bg/10 sticky top-0 z-10 h-[72px]"
        style={{ background: 'var(--ink)' }}>
        <img src="/paradox/paradox-logo.png" alt="Paradox"
          className="no-outline"
          style={{ height: 56, width: 'auto', transform: 'rotate(-4deg)', display: 'block' }}
          draggable={false}
        />
        <motion.button
          whileTap={{ scale: 0.9 }} transition={SPRING} onClick={onClose}
          className="w-10 h-10 rounded-full border-[1.5px] border-bg/25 flex items-center justify-center font-mono text-lg"
          style={{ color: 'var(--bg)' }} aria-label="Close menu"
        >✕</motion.button>
      </div>

      {/* Grid of nav links */}
      <div className="flex-1 grid grid-cols-2 px-4 sm:px-8 py-3 gap-2 content-start">
        {visibleNav.map((it, i) => (
          <motion.div key={it.href}
            initial={{ opacity: 0, x: i % 2 === 0 ? -18 : 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 30, delay: i * 0.025 }}
          >
            <OverlayLink
              href={it.href} label={it.label} n={it.n}
              isActive={current === it.href}
              hoverBg={HOVER_BG[i % 4]} hoverFg={HOVER_COLOR[i % 4]}
              onClose={onClose}
            />
          </motion.div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 sm:px-8 pb-6 pt-4 border-t border-bg/10 space-y-2.5">
        {phase !== 'post_event' && (
          <MotionLink to="/paradox/register" onClick={onClose}
            whileTap={{ scale: 0.96 }} transition={SPRING}
            className="flex justify-center items-center px-5 py-3.5 rounded-full font-body font-bold text-base border-[1.5px] border-bg/20 min-h-[52px]"
            style={{ background: 'var(--c1)', color: 'var(--bg)', boxShadow: '4px 4px 0 rgba(255,255,255,0.15)' }}
          >
            <span>Register for Paradox →</span>
          </MotionLink>
        )}
        <motion.a
          href={waUrl}
          target="_blank"
          rel="noreferrer"
          whileTap={{ scale: 0.96 }}
          transition={SPRING}
          className="flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-full font-body font-semibold text-[15px] border-[1.5px] min-h-[52px] w-full"
          style={{
            background: '#25D366',
            borderColor: '#25D366',
            color: '#0A0A0A',
            transitionProperty: 'background-color, border-color',
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Join the WhatsApp Group
        </motion.a>
        <motion.a
          href="https://instagram.com/paradox.twenty26"
          target="_blank"
          rel="noreferrer"
          whileTap={{ scale: 0.96 }}
          transition={SPRING}
          className="flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-full font-body font-semibold text-[15px] border-[1.5px] min-h-[52px] w-full"
          style={{
            borderColor: 'rgba(255,255,255,0.18)',
            color: 'var(--bg)',
            background: 'rgba(255,255,255,0.06)',
            transitionProperty: 'background-color, border-color',
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
          </svg>
          @paradox.twenty26
        </motion.a>
        <div className="flex justify-between items-center font-mono text-[10px] tracking-[0.08em] uppercase opacity-30 pt-1">
          <span>@ngo.aquaterra</span>
          <span>jun 1–6 · kolkata</span>
          {/* Admin link removed from public nav — the desk is reached by URL only
              (/paradox/admin). Note this is discovery-reduction, not access
              control: the tab gating is client-side. */}
        </div>
      </div>
    </motion.div>
  )
}
