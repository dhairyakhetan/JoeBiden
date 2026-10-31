import { useCallback, useEffect, useRef, useState, Suspense, lazy } from 'react'
import { ORG_FACTS, displayCount } from '../lib/orgFacts'
import useDialog from '../hooks/useDialog'
import './HomeIntro.css'
// The flux loader (which uses framer-motion) is lazy so motion never lands on
// the home page's critical path. The intro itself reads reduced-motion natively.
const ProgressiveFluxLoader = lazy(() => import('./ProgressiveFluxLoader'))

/**
 * HomeIntro - a once-per-visitor, skippable intro overlay for the home page.
 * Shows the branded ProgressiveFluxLoader sweeping 0→100 with phase labels,
 * then fades out to reveal the page. Gated by localStorage so it only plays on
 * a visitor's first home load; honours reduced-motion by not showing at all.
 * Never scroll-locks the page underneath, and a tap anywhere on the overlay
 * (not just the small skip link) dismisses it immediately.
 */

const KEY = 'aq_home_intro_v1'
// Audit fix (design-audit/01-public/home-feed.md, FIX-TRACKING #16): a
// first-time visitor's highest-leverage seconds were spent waiting through
// branded chrome before any real content. Was 2600 - cut to near the audit's
// own "closer to 1s" fallback, scroll is never locked, and the whole overlay
// (not just the small skip link) now dismisses on tap.
const SWEEP_MS = 1100

const PHASES = [
  { at: 0, label: 'student-led' },
  { at: 30, label: 'kolkata born' },
  { at: 62, label: 'zero fees' },
  { at: 100, label: 'welcome' },
]

export default function HomeIntro() {
  const [reduced] = useState(() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
  })
  // Decide once, at init: first visit + motion allowed → show. Lazy initialiser
  // (not an effect) so there's no first-paint flash and no effect-time setState.
  const [active, setActive] = useState(() => {
    let seen = true
    try { seen = localStorage.getItem(KEY) === '1' } catch { seen = false }
    return !seen && !reduced
  })
  const [closing, setClosing] = useState(false)
  const [progress, setProgress] = useState(0)
  const closedRef = useRef(false)

  const finish = useCallback(() => {
    if (closedRef.current) return
    closedRef.current = true
    try { localStorage.setItem(KEY, '1') } catch { /* private mode - fine, just shows again */ }
    setActive(false)
  }, [])

  const beginClose = useCallback(() => {
    setClosing(true)
    window.setTimeout(finish, 520)
  }, [finish])

  const skip = useCallback(() => {
    setProgress(100)
    beginClose()
  }, [beginClose])

  // Escape, Tab-trap, initial focus and focus-restore for the overlay - was a
  // hand-rolled Escape-only listener below. Handed `skip` (not `finish`) so
  // Escape plays the same close animation as the visible Skip button.
  const panelRef = useDialog(active, skip)

  // Drive the sweep + lock scroll while active.
  // Uses setInterval (advances even when rAF is throttled, e.g. a backgrounded
  // tab) plus a HARD safety timeout that force-dismisses no matter what - a
  // full-screen scroll-locking overlay must never be able to trap the user.
  useEffect(() => {
    if (!active) return
    const start = Date.now()
    let doneTimer = 0
    const id = window.setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / SWEEP_MS) * 100)
      setProgress(pct)
      if (pct >= 100) { window.clearInterval(id); doneTimer = window.setTimeout(beginClose, 520) }
    }, 30)
    const safety = window.setTimeout(beginClose, SWEEP_MS + 900)
    return () => {
      clearInterval(id)
      clearTimeout(doneTimer)
      clearTimeout(safety)
    }
  }, [active, beginClose])

  if (!active) return null

  // Peek cards - small previews of what's waiting past the intro (a post
  // snippet, a member avatar, a stat), flying in from the edges and settling
  // near the corners rather than over the wordmark. Design ref: cards flying
  // in from off-screen while the brand loads.
  const PEEKS: { corner: React.CSSProperties; rot: number; delay: number; kind: 'post' | 'avatar' | 'stat' }[] = [
    { corner: { top: '10%', left: '8%' }, rot: -6, delay: 0.05, kind: 'avatar' },
    { corner: { top: '14%', right: '9%' }, rot: 5, delay: 0.16, kind: 'post' },
    { corner: { bottom: '16%', left: '11%' }, rot: 4, delay: 0.28, kind: 'stat' },
    { corner: { bottom: '12%', right: '7%' }, rot: -4, delay: 0.4, kind: 'avatar' },
  ]

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to AquaTerra"
      tabIndex={-1}
      onClick={skip}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'var(--bg)', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 'clamp(28px, 6vw, 52px)', padding: 'clamp(24px, 6vw, 64px)',
        opacity: closing ? 0 : 1,
        transform: closing ? 'scale(1.015)' : 'scale(1)',
        transition: 'opacity 0.5s cubic-bezier(.2,.7,.2,1), transform 0.5s cubic-bezier(.2,.7,.2,1)',
      }}
    >
      {PEEKS.map((p, i) => (
        <div
          key={i}
          aria-hidden
          className="aq-intro-peek"
          style={{
            position: 'absolute', ...p.corner,
            animationDelay: `${p.delay}s`,
            ['--peek-rot' as string]: `${p.rot}deg`,
          } as React.CSSProperties}
        >
          {p.kind === 'avatar' && <span className="aq-intro-peek-avatar" />}
          {p.kind === 'post' && (
            <>
              <span className="aq-intro-peek-avatar" style={{ width: 18, height: 18 }} />
              <span className="aq-intro-peek-line" style={{ width: 46 }} />
              <span className="aq-intro-peek-line" style={{ width: 30 }} />
            </>
          )}
          {p.kind === 'stat' && <span className="aq-intro-peek-stat">{displayCount(ORG_FACTS.membersTotal)}</span>}
        </div>
      ))}

      {/* Brand wordmark */}
      <div style={{
        fontFamily: 'var(--display)', fontWeight: 900,
        fontSize: 'clamp(48px, 12vw, 132px)', letterSpacing: '-0.05em', lineHeight: 0.85,
        color: 'var(--ink)', textAlign: 'center', textTransform: 'uppercase',
        position: 'relative',
      }}>
        AQUA<span style={{ color: 'var(--welfare-ink)' }}>TERRA</span>
        <span style={{ color: 'var(--welfare-ink)' }}>.</span>
      </div>

      <Suspense fallback={<div style={{ minHeight: 96 }} aria-hidden />}>
        <ProgressiveFluxLoader value={progress} phases={PHASES} />
      </Suspense>

      {/* Skip - a round arrow button, per the design ref, with a visible label
          beside it so the control stays unambiguous (not icon-only). */}
      <button
        onClick={skip}
        aria-label="Skip intro"
        style={{
          marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 10,
          background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 6px 6px 16px',
        }}
      >
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--ink-3)',
        }}>skip intro</span>
        <span style={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          background: 'var(--bg-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </span>
      </button>
    </div>
  )
}
