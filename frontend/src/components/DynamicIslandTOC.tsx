import './DynamicIslandTOC.css'
import { useState, useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useReducedMotion, type Transition } from 'framer-motion'

/**
 * DynamicIslandTOC - an Apple-Dynamic-Island-style floating table of contents.
 * Adapted from the recipe to the AquaTerra stack: inline styles + brand vars
 * (no shadcn tokens / Tailwind utilities / cn), framer-motion (already a dep),
 * an inline X icon (no lucide), no Lenis. Themed as a dark pill with cream text
 * and mint accents so it pops on the cream pages. Reduced-motion safe.
 *
 * Drive it off explicit `[data-toc]` elements (default selector); tag any
 * section anchor with `data-toc data-toc-title="…"` and it appears here.
 */

type HeadingData = { id: string; text: string; level: number; element: HTMLElement }

const ease: Transition['ease'] = [0.22, 1, 0.36, 1]
const islandTransition: Transition = { type: 'tween', ease, duration: 0.5 }

const CREAM = 'var(--bg)'
const INK = 'var(--ink)'
const MINT = 'var(--welfare)'

function CircleProgress({ percentage }: { percentage: number }) {
  const size = 24
  const strokeWidth = 2.5
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(244,239,224,0.25)" strokeWidth={strokeWidth} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={MINT} strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        strokeLinecap="round"
      />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

export default function DynamicIslandTOC({ selector = '[data-toc]' }: { selector?: string }) {
  const reduced = useReducedMotion()
  const [headings, setHeadings] = useState<HeadingData[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [progress, setProgress] = useState(0)

  /* Reserve the island's own footprint at the foot of the page.
     This renders through createPortal into <body>, so it sits OUTSIDE the page
     it belongs to and nothing in that page's layout knows it is there. The
     island is fixed, 52px tall, 28px off the bottom - so on both routes that
     use it (/about, /brand) it parked permanently on top of the last thing on
     the page. Measured at the true page bottom on /about: it covered the
     Paradox banner card, which is a real link nobody could see under it.
     pointer-events: none on the rail meant the card stayed CLICKABLE, which is
     worse - it was hidden but still live.
     Scoped to while this component is mounted and removed on unmount, so no
     other route pays for it. The two values below mirror the rail's own
     `bottom` in DynamicIslandTOC.css; change them together. */
  useEffect(() => {
    document.body.classList.add('has-toc-island')
    return () => document.body.classList.remove('has-toc-island')
  }, [])

  // Scan headings (slight delay lets the page render first).
  useEffect(() => {
    const scan = () => {
      const els = Array.from(document.querySelectorAll(selector)) as HTMLElement[]
      const valid = els
        .filter(el => !el.hasAttribute('data-toc-ignore'))
        .map((el, index) => {
          if (!el.id) {
            const gen = el.textContent?.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '') || `toc-${index}`
            el.id = gen
          }
          const depthAttr = el.getAttribute('data-toc-depth')
          let level = 2
          if (depthAttr) level = parseInt(depthAttr, 10)
          else {
            const tag = el.tagName.toUpperCase()
            if (tag.startsWith('H') && tag.length === 2) level = parseInt(tag[1], 10)
          }
          const text = el.getAttribute('data-toc-title') || el.textContent || 'Section'
          return { id: el.id, text, level, element: el }
        })
      valid.sort((a, b) => (a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
      setHeadings(valid)
    }
    const t = setTimeout(scan, 120)
    return () => clearTimeout(t)
  }, [selector])

  // Scroll progress only (active-heading tracking moved to the
  // IntersectionObserver effect below).
  // rAF-batched: raw scroll events fire faster than the screen repaints, and
  // reading scrollY/scrollHeight on every one would force a re-render per
  // event. Coalescing to one computation per frame caps re-renders to the
  // frame rate. Progress is rounded to whole percent so setProgress only
  // re-renders on an actual 1% step, not every sub-pixel - visually identical
  // on the 24px ring.
  useEffect(() => {
    let ticking = false
    const compute = () => {
      ticking = false
      const total = document.documentElement.scrollHeight - window.innerHeight
      setProgress(total > 0 ? Math.round(Math.min(100, Math.max(0, (window.scrollY / total) * 100))) : 0)
    }
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(compute)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    compute()
    return () => window.removeEventListener('scroll', onScroll)
  }, [headings])

  // Active-heading tracking via IntersectionObserver instead of polling every
  // heading's getBoundingClientRect() on scroll. A heading counts as "active"
  // while it intersects a band near the top of the viewport (rootMargin pulls
  // the effective area to roughly the top 30%); among currently-intersecting
  // headings we keep the last one in document order, matching the previous
  // "most recently crossed y<=120" semantics without the manual rect math.
  const intersectingRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    intersectingRef.current = new Set()
    if (headings.length === 0) return
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).id
        if (entry.isIntersecting) intersectingRef.current.add(id)
        else intersectingRef.current.delete(id)
      }
      let current: string | null = null
      for (const h of headings) {
        if (intersectingRef.current.has(h.id)) current = h.id
      }
      if (!current) current = headings[0].id
      setActiveId(current)
    }, { rootMargin: '-120px 0px -70% 0px', threshold: 0 })
    headings.forEach(h => observer.observe(h.element))
    return () => observer.disconnect()
  }, [headings])

  const activeHeading = headings.find(h => h.id === activeId)
  const minLevel = useMemo(() => (headings.length === 0 ? 1 : Math.min(...headings.map(h => h.level))), [headings])

  // Nothing worth navigating - don't show the island.
  if (headings.length < 2) return null
  if (typeof document === 'undefined') return null

  // Portalled to <body> so no page-level transform (e.g. the .route-enter
  // entrance) can become the containing block and break position:fixed.
  return createPortal(
    <>
      {/* Rail offset: clears the top nav (backdrop starts below it) and, on
          mobile, sits above the bottom nav bar so the pill never overlaps it. */}

      {/* Every transition below is gated on `reduced`. Four of them were not:
          the island itself honoured prefers-reduced-motion and snapped open,
          while its backdrop, both content cross-fades and the heading swap kept
          animating for up to 600ms - so the one surface that was supposed to be
          still was the only part that moved, which is worse than animating the
          whole thing. */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={reduced ? { duration: 0 } : islandTransition}
            onClick={() => setIsExpanded(false)}
            /* starts below the navbar so the nav stays visually clear */
            style={{ position: 'fixed', top: 'var(--nav-h, 70px)', left: 0, right: 0, bottom: 0, zIndex: 9998, background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
          />
        )}
      </AnimatePresence>

      {/* Full-width centering rail - centers via flex so framer-motion's
          entrance transform can't clobber a translateX(-50%). */}
      {/* `display` and `justify-content` live in DynamicIslandTOC.css, NOT here.
          They were inline, and inline style beats the cascade - so the media
          query that hides this rail on a phone had no effect at all and the
          island kept floating over the reading column. CLAUDE.md names this
          exact trap for the HoD desk; it applies just as well here. Anything
          a media query may need to change has to be in the stylesheet. */}
      <div className="bp-toc-rail" style={{ position: 'fixed', left: 0, right: 0, zIndex: 9999, pointerEvents: 'none' }}>
      <motion.div
        initial={reduced ? false : { y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 25 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'auto' }}
      >
        <motion.div
          onClick={() => { if (!isExpanded) setIsExpanded(true) }}
          initial={false}
          /* borderRadius is 32 in BOTH states — DESIGN.md §1: "a radius that is
             not 999, 32, 22 or 14 is a bug." This was 26 closed / 24 expanded,
             two hand-typed values on no rung of the scale, and they were the
             only illegal radii left on /about and /brand. Held constant across
             the transition on purpose: the island is one surface growing, not
             two shapes. */
          animate={{ width: isExpanded ? 340 : 280, height: isExpanded ? 400 : 52, borderRadius: isExpanded ? 32 : 32 }}
          transition={reduced ? { duration: 0 } : islandTransition}
          style={{
            position: 'relative', overflow: 'hidden', cursor: isExpanded ? 'default' : 'pointer',
            maxWidth: 'calc(100vw - 24px)',
            // Never let the expanded island reach up under the top navbar -
            // cap its height below the nav (the inner list scrolls instead).
            maxHeight: 'calc(100svh - var(--nav-h, 70px) - 40px)',
            background: INK, color: CREAM, border: '1px solid rgba(244,239,224,0.12)',
            boxShadow: '0 18px 50px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.25)',
          }}
          aria-label="Table of contents"
          // Collapsed, this element IS the only opener, so it has to be a real
          // button: focusable, announced, Enter/Space activated. Expanded, the
          // role is dropped - the panel then contains its own Close button and
          // the TOC links, and a role="button" wrapper around interactive
          // children is invalid and swallows them for screen readers.
          role={isExpanded ? undefined : 'button'}
          tabIndex={isExpanded ? -1 : 0}
          aria-expanded={isExpanded}
          onKeyDown={e => {
            if (!isExpanded && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              setIsExpanded(true)
            }
          }}
        >
          {/* CLOSED PILL */}
          <motion.div
            initial={false}
            animate={{ opacity: isExpanded ? 0 : 1, scale: isExpanded ? 0.95 : 1, filter: isExpanded ? 'blur(4px)' : 'blur(0px)' }}
            transition={reduced ? { duration: 0 } : { ...islandTransition, delay: isExpanded ? 0 : 0.1 }}
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', gap: 16, padding: '0 18px', pointerEvents: isExpanded ? 'none' : 'auto' }}
          >
            <div style={{ height: 8, width: 8, flexShrink: 0, borderRadius: '50%', background: MINT }} />
            <div style={{ position: 'relative', display: 'flex', height: '100%', flex: 1, alignItems: 'center', overflow: 'hidden', textAlign: 'left' }}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={activeId || 'empty'}
                  initial={reduced ? false : { opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={reduced ? { opacity: 0 } : { opacity: 0, y: -15 }}
                  transition={reduced ? { duration: 0 } : { duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  style={{ display: 'block', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--eina)', fontSize: 14, fontWeight: 600, color: CREAM }}
                >
                  {activeHeading?.text || 'Contents'}
                </motion.span>
              </AnimatePresence>
            </div>
            <CircleProgress percentage={progress} />
          </motion.div>

          {/* EXPANDED MENU */}
          <motion.div
            inert={!isExpanded} // collapsed, its buttons would be focusable ghosts inside the role="button" wrapper
            initial={false}
            animate={{ opacity: isExpanded ? 1 : 0, scale: isExpanded ? 1 : 1.05 }}
            transition={reduced ? { duration: 0 } : { ...islandTransition, delay: isExpanded ? 0.1 : 0 }}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', pointerEvents: isExpanded ? 'auto' : 'none' }}
          >
            <div style={{ display: 'flex', flexShrink: 0, alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px 12px' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(244,239,224,0.5)' }}>
                TABLE OF CONTENTS
              </span>
              <button
                onClick={e => { e.stopPropagation(); setIsExpanded(false) }}
                /* An 18px icon at `padding: 0` measured 18.9x18.9 - well under
                   DESIGN.md §2's 32px absolute floor, and this is the only way
                   to dismiss the expanded sheet. 13px of padding takes it to
                   44x44 without moving the glyph; the negative margins absorb
                   the growth so the header row's height is unchanged. */
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(244,239,224,0.6)', display: 'flex', padding: 13, margin: -13 }}
                aria-label="Close"
              >
                <XIcon />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '0 10px 14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {headings.map(h => {
                  const isActive = activeId === h.id
                  const isHovered = hoveredId === h.id
                  const indent = Math.max(0, h.level - minLevel)
                  const paddingLeft = indent * 14 + 12
                  const itemStyle: CSSProperties = {
                    display: 'flex', width: '100%', flexShrink: 0, alignItems: 'center',
                    /* 14 = --r-tight, the innermost rung of DESIGN.md §1's
                       scale (the island's own 32 outer, then 14 for the rows
                       inside it). Was 9, which is on no rung.
                       minHeight 44 is DESIGN.md §2's hit-target floor: these
                       rows measured 39px tall, and 39 is on none of the four
                       documented exception sizes (42 dock / 40 desk row / 38
                       chip / 32 comment foot). Padding goes 9 -> 12 so the row
                       reaches the floor by its own content rather than by a
                       min-height override on a squashed box. */
                    borderRadius: 14, minHeight: 44, border: 'none', cursor: 'pointer', textAlign: 'left',
                    padding: '12px 12px 12px ' + paddingLeft + 'px', fontFamily: 'var(--eina)', fontSize: 14,
                    transition: 'background 0.25s ease, color 0.25s ease',
                    background: isActive ? 'rgba(244,239,224,0.12)' : isHovered ? 'rgba(244,239,224,0.06)' : 'transparent',
                    /* Resting colour is 0.55 (--nav-fg-faint, 5.58:1 on the ink
                       island), not 0.45. DESIGN.md §2 measures 0.45 at 4.06:1
                       and rules it "legal for non-text only" — and this is the
                       DEFAULT state of every row in the menu, so it was the
                       state most of these six controls were read in. */
                    color: isActive ? CREAM : isHovered ? 'rgba(244,239,224,0.85)' : 'rgba(244,239,224,0.55)',
                    fontWeight: isActive ? 600 : 400,
                  }
                  return (
                    <button
                      key={h.id}
                      onMouseEnter={() => setHoveredId(h.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={e => {
                        e.stopPropagation()
                        const y = h.element.getBoundingClientRect().top + window.scrollY - 80
                        window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' })
                        setIsExpanded(false)
                      }}
                      style={itemStyle}
                    >
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.text}</span>
                      <motion.span
                        initial={false}
                        animate={{ scale: isActive ? 1 : 0, opacity: isActive ? 1 : 0 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        style={{ marginLeft: 12, height: 6, width: 6, flexShrink: 0, borderRadius: '50%', background: MINT, display: 'inline-block' }}
                      />
                    </button>
                  )
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
      </div>
    </>,
    document.body
  )
}
