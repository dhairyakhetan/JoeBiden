import type React from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { Mascot } from './Mascot'
import type { MascotCharacter } from '../lib/mascotCast'
import { safeExternalHref } from '../lib/safeUrl'
import './Companion.css'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

// Same public number QuickLinksPage.tsx's WHATSAPP constant already uses -
// there is exactly one WhatsApp contact for the org, not a companion-specific
// one, so this is that number, not a new one.
const WHATSAPP_HREF = 'https://wa.me/919748679979'

/* ─────────────────────────────────────────────────────────────────────────
   The companion — changelog/18-mascots-and-motion.md §18.1.

   Replaces the retired `Mascot.tsx` (the abstract "eyes that track the
   pointer" blob, an earlier redesign phase's roaming device). This file
   keeps that component's PROVEN ENGINEERING — the self-stopping motion
   discipline, the overlay-hide via the shared `body.style.overflow==='hidden'`
   signal, waking on demand rather than polling — but the actual MOTION spec
   is new and deliberately calmer than the old one: the old companion always
   chased the live pointer and parked on a CTA; this one is idle by default,
   drifts a short distance along the bottom edge at most once every 45s, and
   only starts trailing the pointer at all once the bone beside it has been
   dragged (or tapped, on phones) off — a session-scoped opt-in, not a
   standing behaviour.

   Renders the REAL cast (`components/Mascot.tsx`, née `AQMascot.tsx`) rather
   than a generic blob, picking a character from the route via the table
   18.0 decided:
     home / feed, onboarding -> nolen   (the default - everywhere else too)
     About                   -> tuk
     auth pages (login/register/callback/pending/rejected) -> bhoot
     404                     -> bhoot   (NotFoundPage marks itself; see below)
   ───────────────────────────────────────────────────────────────────────── */

const FOLLOW_KEY = 'aq_companion_follow'
const DISMISSED_KEY = 'aq_companion_dismissed'

function readFlag(key: string): boolean {
  try { return sessionStorage.getItem(key) === '1' } catch { return false }
}
function writeFlag(key: string) {
  try { sessionStorage.setItem(key, '1') } catch { /* private mode - session-only feature, fine to no-op */ }
}

function clearFlag(key: string) {
  try { sessionStorage.removeItem(key) } catch { /* as above */ }
}

// Never on these. /director, /settings, /drive/ match the retired
// companion's own list exactly. /paradox is a deliberate addition: that
// sub-app is "its own visual system entirely" (CLAUDE.md) with its own
// Nav/Footer/AuthProvider/ToastProvider, so a stray companion from the main
// app has no business roaming over it — nothing under paradox/** is touched
// to make this true, it's just one more prefix in this file's own list.
//
// 2026-09-07, adversarial visual review: the AUTH ROUTES are added here as a
// P0 fix. `/login` at 360px was measured with the companion's 44x49 box (plus
// its 58px "DRAG ME" bubble to the left of it) sitting directly on top of the
// three-step explainer - covering "A DIRECTOR APPROVES YOU" and the step-3
// body copy. The existing `denseContentHit` fade below is a mitigation, not a
// guarantee: it polls at 500ms, samples only five points of the companion's
// box, and deliberately ignores plain body text, so it does not catch this.
// The sign-in funnel is the highest-value surface on the site and there is no
// version of "a mascot roams over the sign-up instructions" that is worth a
// conversion; a positional nudge would only move the collision, since it was
// reproduced on three different routes. So: the companion is simply absent on
// the funnel. (`CHARACTER_BY_PREFIX`'s auth -> `bhoot` entries are now
// unreachable and kept only so 18.0's table still reads as written; `bhoot`
// is still live on 404, which is how it is actually seen.)
const HIDDEN_PREFIXES = [
  // `/terrathon` for the same reason as `/paradox`: both are sub-apps with
  // their own nav, footer and visual system, and a roaming AquaTerra mascot
  // dragging itself across an event ticketing funnel reads as another site's
  // widget leaking in. It also parked itself on top of the sport page's
  // sticky "Enter a team" CTA at desktop widths.
  '/director', '/settings', '/drive/', '/paradox', '/terrathon', '/terranotes', '/live',
  '/login', '/register', '/auth', '/pending', '/rejected',
]

// 18.0's route -> character table. First match wins; nolen is the fallback
// for every route not named here (home/feed, onboarding, and everything
// else — matching "the one a member sees daily").
const CHARACTER_BY_PREFIX: [string, MascotCharacter][] = [
  ['/about', 'tuk'],
  ['/login', 'bhoot'],
  ['/register', 'bhoot'],
  ['/auth', 'bhoot'],
  ['/pending', 'bhoot'],
  ['/rejected', 'bhoot'],
]

function characterForRoute(pathname: string): MascotCharacter {
  // 404: see NotFoundPage.tsx - the catch-all route has no path prefix of
  // its own to match here, so the page names itself.
  if (typeof document !== 'undefined' && document.body.dataset.mascotPage === '404') return 'bhoot'
  const hit = CHARACTER_BY_PREFIX.find(([prefix]) => pathname.startsWith(prefix))
  return hit ? hit[1] : 'nolen'
}


const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

// This file's own number - the changelog states it explicitly as "a
// different, genuinely its own number from the admin desk's unrelated 600px
// breakpoint." Not shared with any other module on purpose.
const MOBILE_BP = 760
const isMobileViewport = () =>
  typeof window !== 'undefined' && window.matchMedia(`(max-width: ${MOBILE_BP}px)`).matches

const AMBIENT_INTERVAL_MS = 45_000 // "at most once every 45 seconds"
const AMBIENT_SETTLE_MS = 1500
const FOLLOW_SETTLE_MS = 640 // "a long delay (~600ms)"
const FOLLOW_DEAD_ZONE_PX = 90 // "a large dead-zone, so it trails rather than tracks"
const BONE_MOVE_THRESHOLD_PX = 6 // tells a drag apart from a click, not a "committed yet" gate
const BONE_DRAG_EASE_MS = 300 // the fetch's per-move ease - short, so it reads as chasing a moving point

export default function Companion() {
  const location = useLocation()
  const reducedMotion = usePrefersReducedMotion()
  const sealId = useId()

  const [dismissed, setDismissed] = useState(() => readFlag(DISMISSED_KEY))
  const [followMode, setFollowMode] = useState(() => readFlag(FOLLOW_KEY))
  const followModeRef = useRef(followMode)
  useEffect(() => { followModeRef.current = followMode }, [followMode])
  /**
   * Whether the motion effect has already placed the mascot in this activation.
   * Item 9.1: the effect re-runs on every route change (it must - see the note
   * at its top), and without this it re-homed the mascot each time, which is
   * the teleport-on-click the walkthrough reported.
   */
  const positionedRef = useRef(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ dragging: false, moved: false, x: 0, y: 0 })
  // Bridges the bone's pointer handlers (component scope) into the
  // positioning effect's own `setPos`/`target` closure below, the same
  // ref-into-effect-closure pattern `followModeRef` already uses in this
  // file - the effect owns the only writer of `root.style.transform`, so the
  // "mascot fetches the bone" motion has to go through it rather than a
  // second, competing writer.
  const setTargetRef = useRef<((x: number, y: number, ms: number) => void) | null>(null)
  // Live pointer position while the bone is being dragged pre-commit - only
  // the small glyph (not the disc) renders here, via a portal so it is not
  // reparented under the root's own `transform` (a transformed ancestor is a
  // containing block for a `position: fixed` descendant, which would make the
  // ghost track the ROOT's translate instead of the viewport).
  const [dragPt, setDragPt] = useState<{ x: number; y: number } | null>(null)

  // 2026-09-07, same review: the other two measured collisions (`/` @375 over
  // a feed card's share button and stat well, `/projects` @375 over the "the
  // drives" heading and the "live feed" label) are both PHONE collisions, and
  // they are collisions for a structural reason - at 360-375px there is no
  // gutter for a 44px fixed ornament to sit in. Every column is full-bleed,
  // and the one corner it could home to is already spoken for by the mobile
  // dock and the thumb-reach zone. Rather than keep chasing individual
  // overlaps route by route, the companion does not render below its own
  // MOBILE_BP at all: it is decoration, and the phone viewport has no room to
  // spare for it. On desktop the bottom-right gutter is real, so it stays -
  // with the existing footer / TOC-rail / toast / dense-content fades as the
  // second line of defence there.
  const [phone, setPhone] = useState(isMobileViewport)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(`(max-width: ${MOBILE_BP}px)`)
    const handler = () => setPhone(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const hidden = phone || HIDDEN_PREFIXES.some(p => location.pathname.startsWith(p))
  const character = characterForRoute(location.pathname)

  // ── motion: ambient roam, then (once the bone is taken) pointer-follow.
  // Both are discrete-event CSS transitions, not a per-frame rAF loop - see
  // Companion.css's header note for why that's the deliberate 18.3 answer.
  // Mounted whenever the companion is visible and motion is allowed; NOT
  // re-run when `followMode` merely flips true (that would snap the mascot
  // back to its home corner instead of letting it ease from wherever it
  // already was) - the effect reads `followModeRef` for that instead. ────
  useEffect(() => {
    if (hidden || dismissed || reducedMotion) {
      // Next activation is a fresh one and SHOULD land at home.
      positionedRef.current = false
      return
    }
    const root = rootRef.current
    if (!root) return

    let overlayOpen = false
    let target = { x: 0, y: 0 }
    let ambientTimer: number | undefined

    const homeAnchor = () => {
      const mobile = isMobileViewport()
      return {
        x: window.innerWidth - (mobile ? 40 : 54),
        // Clear the mobile bottom bar (~74px incl. safe-area) and the
        // desktop scroll-to-top FAB (bottom:80/right:20/44x44, v6.css).
        y: window.innerHeight - (mobile ? 128 : 70),
      }
    }

    const setPos = (x: number, y: number, ms: number) => {
      target = { x, y }
      root.style.transition = `transform ${ms}ms cubic-bezier(0.22, 1, 0.36, 1)`
      root.style.transform = `translate(${x}px, ${y}px)`
    }
    setTargetRef.current = setPos

    // ── Item 9.1, half one: do NOT re-home on a route change. ──────────────
    //
    // The comment that stood here said this effect "only (re)runs when the
    // companion transitions from not-rendered/not-allowed to allowed, so there
    // is no 'wherever it was before' to ease from yet". That was true when it
    // was written and stopped being true when `location.pathname` was added to
    // the dependency list: the effect now re-runs on EVERY navigation, and
    // these three lines then snapped the mascot back to its home corner with
    // `transition: none`. Click any link and the mascot teleports. In follow
    // mode it abandons the cursor it was following and jumps to the corner.
    // That is the reported "glitchy on click".
    //
    // The pathname dependency itself is right and stays - the footer and the
    // TOC rail are different DOM nodes on a new page, and those observers do
    // need re-attaching. Only the POSITION reset was wrong on that path.
    //
    // So: home once per activation, and on a mere route change read the
    // current translate back so `target` (which the follow dead-zone and the
    // ambient jitter both measure against) stays truthful without moving
    // anything. The format is ours and always exactly `translate(Xpx, Ypx)`.
    root.style.opacity = '1'
    if (!positionedRef.current) {
      root.style.transition = 'none'
      const home = homeAnchor()
      target = home
      root.style.transform = `translate(${home.x}px, ${home.y}px)`
      positionedRef.current = true
    } else {
      const m = /translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px\s*\)/.exec(root.style.transform)
      target = m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : homeAnchor()
    }

    const scheduleAmbient = () => {
      ambientTimer = window.setTimeout(() => {
        // Follow mode is a one-way, session-long switch once entered -
        // ambient roaming retires for good rather than fighting it.
        if (followModeRef.current) return
        if (!document.hidden && !overlayOpen) {
          const anchor = homeAnchor()
          // "travels a short distance along the bottom edge" - small,
          // mostly-horizontal jitter around the home corner; never toward
          // the centre, never off-screen.
          const dx = (Math.random() - 0.5) * 60
          const dy = -Math.random() * 20
          setPos(
            clamp(anchor.x + dx, 24, window.innerWidth - 24),
            clamp(anchor.y + dy, 24, window.innerHeight - 24),
            AMBIENT_SETTLE_MS
          )
        }
        scheduleAmbient()
      }, AMBIENT_INTERVAL_MS)
    }
    if (!followModeRef.current) scheduleAmbient()

    // ── follow mode: desktop mouse tracks continuously past a dead-zone;
    // touch updates only on the last tap, never mid-scroll-drag. ─────────
    const onMove = (e: PointerEvent) => {
      if (!followModeRef.current || overlayOpen || e.pointerType !== 'mouse') return
      if (Math.hypot(e.clientX - target.x, e.clientY - target.y) < FOLLOW_DEAD_ZONE_PX) return
      setPos(clamp(e.clientX, 30, window.innerWidth - 30), clamp(e.clientY, 30, window.innerHeight - 30), FOLLOW_SETTLE_MS)
    }
    const onTap = (e: PointerEvent) => {
      if (!followModeRef.current || overlayOpen || e.pointerType === 'mouse') return
      setPos(clamp(e.clientX, 30, window.innerWidth - 30), clamp(e.clientY, 30, window.innerHeight - 30), FOLLOW_SETTLE_MS)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onTap, { passive: true })

    const onResize = () => { if (!followModeRef.current) setPos(homeAnchor().x, homeAnchor().y, 400) }
    window.addEventListener('resize', onResize, { passive: true })

    // Reused from the retired companion: every dialog/sheet/lightbox in the
    // app already flips this while open (useDialog.ts, Confirm.tsx,
    // Sheet.tsx, PostFocusModal.tsx, HomeIntro.tsx), so it doubles as the
    // one signal for "something modal is covering the screen right now" -
    // hide rather than just stop, so it can never sit on top of a scrim.
    let footerVisible = false
    let railVisible = false
    let toastVisible = false
    let denseContentHit = false
    const applyVisibility = () => {
      root.style.opacity = (overlayOpen || footerVisible || railVisible || toastVisible || denseContentHit) ? '0' : '1'
    }
    const bodyObserver = new MutationObserver(() => {
      overlayOpen = document.body.style.overflow === 'hidden'
      applyVisibility()
    })
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['style'] })

    // Found 2026-09-06: `homeAnchor()`'s corner is a fixed distance from the
    // VIEWPORT edge, so it stays put on screen while the page scrolls
    // underneath it - which means it drifts over whatever happens to be
    // sitting at that corner once you scroll far enough, including
    // `AQFooter.tsx`'s own quick-links grid and its own nolen/tuk/bhoot wall
    // die-cuts (18.0's "footer wall: all three, as die-cuts"), and (audit
    // pass, 2026-09-06) `DynamicIslandTOC`'s `.bp-toc-rail` - the reading
    // progress pill on About/Brand, also a big persistent bar pinned near
    // the bottom. Two independent mascot systems, or a mascot and a reading
    // rail, overlapping at the one place they're both deliberately dense is
    // a real collision, not a design choice - fade the companion out for the
    // same reason it already fades for a dialog scrim: it must never sit on
    // top of content it isn't allowed to obscure.
    //
    // `AQFooter` is `lazy()`-loaded (see PublicLayout.tsx) and the TOC rail
    // delays its own heading scan ~120ms (DynamicIslandTOC.tsx) and may
    // never mount at all (it renders nothing under 2 headings) - so on a
    // fresh load neither element is guaranteed to exist in the DOM yet when
    // THIS effect runs. Poll briefly instead of assuming either is already
    // there; once each is found, watch it for good. Give up after a few
    // seconds rather than polling forever on a page the rail will never
    // appear on.
    const barObservers: IntersectionObserver[] = []
    let footerAttached = false
    let railAttached = false
    let barPoll: number | undefined
    let barPollAttempts = 0
    const MAX_BAR_POLL_ATTEMPTS = 15 // ~4.5s at 300ms - generous for a lazy mount
    const attachBarObservers = () => {
      if (!footerAttached) {
        const footerEl = document.querySelector('footer.aq-footer')
        if (footerEl) {
          const io = new IntersectionObserver(([entry]) => { footerVisible = entry.isIntersecting; applyVisibility() }, { threshold: 0 })
          io.observe(footerEl)
          barObservers.push(io)
          footerAttached = true
        }
      }
      if (!railAttached) {
        const railEl = document.querySelector('.bp-toc-rail')
        if (railEl) {
          const io = new IntersectionObserver(([entry]) => { railVisible = entry.isIntersecting; applyVisibility() }, { threshold: 0 })
          io.observe(railEl)
          barObservers.push(io)
          railAttached = true
        }
      }
      return footerAttached && railAttached
    }
    if (!attachBarObservers()) {
      barPoll = window.setInterval(() => {
        barPollAttempts++
        if (attachBarObservers() || barPollAttempts >= MAX_BAR_POLL_ATTEMPTS) {
          if (barPoll) window.clearInterval(barPoll)
        }
      }, 300)
    }

    // Audit pass, 2026-09-06: the two bars above are the "big persistent
    // chrome" case, but the companion also parks on top of perfectly
    // ordinary page content that scrolls underneath its fixed corner -
    // confirmed live on the home feed (a post photo) and the Teams page (a
    // numbered step). There is no one shared class name across every post
    // card "family" (feed/cards/parts.tsx's `CardPhoto` covers most of them,
    // but family03's fullbleed shape and the /projects archive masonry each
    // use their own), so this can't be fixed with a selector list the way
    // the footer/rail are. Instead: while the companion is visible, poll
    // (not a per-frame loop - see this file's header note) whether real,
    // non-decorative content - media or anything a member could actually
    // click - currently sits under the companion's own on-screen box, using
    // `elementFromPoint`. Ordinary body text is deliberately NOT in this
    // list: the companion grazing a paragraph's trailing whitespace is a
    // minor, non-blocking, decorative overlap, not the same class of bug as
    // sitting on a photo or blocking a real control.
    const DENSE_SELECTOR = 'img, video, picture, canvas, button, a, input, textarea, select, [role="button"]'
    const checkDenseHit = () => {
      // ── Item 9.1, half two: the overlap guard fights follow mode. ────────
      //
      // DENSE_SELECTOR includes `a`, `button` and `[role="button"]`. In follow
      // mode the mascot is pinned to the pointer, and a pointer is very often
      // resting on exactly those. So the guard fired constantly: the mascot
      // followed the cursor onto a link, decided it was obscuring something,
      // faded to 0, and the 500ms poll brought it back the moment the cursor
      // moved off - a flicker that reads as "glitchy on click, sometimes
      // vanishes". Two features written for different situations, colliding.
      //
      // The guard's own rationale settles which one yields: it exists for
      // ACCIDENTAL overlap, the mascot parked in a corner while content
      // scrolls underneath it. Follow mode is the opposite - the member took
      // the bone specifically to make the mascot go where they point, so it
      // being over what they are pointing at is the feature working. The
      // dialog/footer/rail/toast guards all still apply in follow mode; only
      // this one, whose whole subject is incidental overlap, stands down.
      if (followModeRef.current) { denseContentHit = false; applyVisibility(); return }

      const rect = root.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) { denseContentHit = false; applyVisibility(); return }
      // Hide the companion from its own hit-test via `visibility`, not
      // `pointer-events` - the bone and dismiss button set their own
      // `pointer-events: auto` and would not inherit a parent override, but
      // `visibility: hidden` removes the whole subtree from hit-testing
      // regardless, with nothing repainted in between (synchronous, same tick).
      const prevVisibility = root.style.visibility
      root.style.visibility = 'hidden'
      const points: [number, number][] = [
        [rect.left + 1, rect.top + 1],
        [rect.right - 1, rect.top + 1],
        [rect.left + 1, rect.bottom - 1],
        [rect.right - 1, rect.bottom - 1],
        [(rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2],
      ]
      let hit = false
      for (const [x, y] of points) {
        if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue
        const el = document.elementFromPoint(x, y)
        if (el && el.closest(DENSE_SELECTOR)) { hit = true; break }
      }
      root.style.visibility = prevVisibility
      denseContentHit = hit
      applyVisibility()
    }
    // Run once immediately as well as on the interval - otherwise the very
    // first paint always has up to 500ms of the companion sitting on whatever
    // is under it before the first sample can fade it out.
    checkDenseHit()

    /**
     * EVENT-DRIVEN, not a 500ms poll (audit 2026-09-17, efficiency P2).
     *
     * This used to be `setInterval(checkDenseHit, 500)`, running for the whole
     * life of every desktop page. Each tick forces synchronous layout twice -
     * once for getBoundingClientRect, once for up to five elementFromPoint
     * calls - so the page paid two forced reflows a second, forever, whether or
     * not anything had moved. On an idle tab reading an article that is pure
     * waste.
     *
     * What the answer actually depends on: where the companion is, and what is
     * underneath it. Both change on scroll, on resize, and when the companion
     * itself moves - all of which already fire events here. So listen instead,
     * coalesced through rAF so a scroll burst costs one sample per frame at
     * most.
     *
     * The slow interval stays as a safety net, at 2s rather than 0.5s, for the
     * one case events miss: content that appears under a stationary companion
     * with no scroll and no resize (a lazy image landing, a feed page
     * appending). Four times cheaper, and it skips entirely while the tab is
     * hidden, where a hit test is both invisible and meaningless.
     */
    let densePending = false
    const sampleDenseHit = () => {
      if (densePending || document.hidden) return
      densePending = true
      requestAnimationFrame(() => { densePending = false; checkDenseHit() })
    }
    window.addEventListener('scroll', sampleDenseHit, { passive: true })
    window.addEventListener('resize', sampleDenseHit)
    document.addEventListener('visibilitychange', sampleDenseHit)
    const denseHitPoll = window.setInterval(() => {
      if (!document.hidden) checkDenseHit()
    }, 2000)

    // The toast stack (`.aq-toasts`, Toast.tsx) is mounted app-wide the
    // whole time (ToastProvider wraps everything above Companion in
    // App.tsx), always at the same bottom-right corner the companion homes
    // to on desktop - it just renders zero children until a toast fires.
    // That rules out IntersectionObserver here: verified live that an empty,
    // zero-height `.aq-toasts` still reports `isIntersecting: true` (a
    // degenerate zero-area box is still "in" the viewport), which would have
    // hidden the companion permanently, on every single page, which is
    // exactly the kind of new collision this pass is supposed to avoid
    // introducing. Watch `childList` instead and key off whether a toast is
    // actually rendered.
    const toastsEl = document.querySelector('.aq-toasts')
    let toastObserver: MutationObserver | undefined
    if (toastsEl) {
      toastVisible = toastsEl.children.length > 0
      toastObserver = new MutationObserver(() => {
        toastVisible = toastsEl.children.length > 0
        applyVisibility()
      })
      toastObserver.observe(toastsEl, { childList: true })
    }

    return () => {
      if (ambientTimer) window.clearTimeout(ambientTimer)
      if (barPoll) window.clearInterval(barPoll)
      window.clearInterval(denseHitPoll)
      window.removeEventListener('scroll', sampleDenseHit)
      window.removeEventListener('resize', sampleDenseHit)
      document.removeEventListener('visibilitychange', sampleDenseHit)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onTap)
      window.removeEventListener('resize', onResize)
      bodyObserver.disconnect()
      barObservers.forEach(io => io.disconnect())
      toastObserver?.disconnect()
      setTargetRef.current = null
    }
  }, [hidden, dismissed, reducedMotion, location.pathname])

  /**
   * Put the bone back.
   *
   * Taking the bone was a one-way door: `commitFollowMode` wrote the flag and
   * nothing ever cleared it, so once the mascot started following there was no
   * way to stop it short of dismissing the mascot entirely. Reported in the
   * 2026-09-10 walkthrough - "how do I place the bone back? I also need the
   * option to place the bone back" - and the plate below is the affordance that
   * was specified for exactly this and never built.
   */
  const releaseFollowMode = () => {
    clearFlag(FOLLOW_KEY)
    setFollowMode(false)
  }

  const commitFollowMode = () => {
    writeFlag(FOLLOW_KEY)
    setFollowMode(true)
  }
  const dismiss = () => {
    writeFlag(DISMISSED_KEY)
    setDismissed(true)
  }

  // Desktop: swipe/drag the bone past a small threshold. Mobile: a plain
  // tap (`onClick`) - a real tap always fires `click`, and a scroll that
  // merely passed over the element never does, so this is already immune
  // to "a drag inside a scrolling page fights the scroll" (14's finding)
  // without any custom touch bookkeeping.
  const onBonePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isMobileViewport() || e.pointerType !== 'mouse') return
    dragRef.current = { dragging: true, moved: false, x: e.clientX, y: e.clientY }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* unsupported - drag still works via move/up */ }
  }
  const onBonePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.dragging) return
    if (!dragRef.current.moved) {
      const d = Math.hypot(e.clientX - dragRef.current.x, e.clientY - dragRef.current.y)
      // A small, separate threshold from the old commit-on-threshold one -
      // this just tells a real drag apart from a mouse twitching on
      // mousedown, so a plain click never starts a ghost that then has
      // nowhere to land.
      if (d < BONE_MOVE_THRESHOLD_PX) return
      dragRef.current.moved = true
    }
    const x = clamp(e.clientX, 30, window.innerWidth - 30)
    const y = clamp(e.clientY, 30, window.innerHeight - 30)
    setDragPt({ x: e.clientX, y: e.clientY })
    // The "fetch": the mascot eases toward wherever the bone currently is,
    // continuously, for as long as the pointer is down - not a one-shot
    // threshold check that then hands off to a rigid follow-lockstep.
    setTargetRef.current?.(x, y, BONE_DRAG_EASE_MS)
  }
  const endBoneDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const wasDragging = dragRef.current.dragging && dragRef.current.moved
    dragRef.current.dragging = false
    dragRef.current.moved = false
    setDragPt(null)
    if (!wasDragging) return
    // Commit lands the mascot's target exactly where the bone was dropped,
    // not wherever the ambient/follow effect would otherwise have homed it.
    const x = clamp(e.clientX, 30, window.innerWidth - 30)
    const y = clamp(e.clientY, 30, window.innerHeight - 30)
    setTargetRef.current?.(x, y, FOLLOW_SETTLE_MS)
    commitFollowMode()
  }
  const cancelBoneDrag = () => {
    dragRef.current.dragging = false
    dragRef.current.moved = false
    setDragPt(null)
  }
  const onBoneClick = () => { if (isMobileViewport()) commitFollowMode() }

  if (hidden || dismissed) return null

  // Reduced motion: "the mascot renders idle and static... entirely absent,
  // not slowed down" refers to the ROAM/FOLLOW/BONE mechanic, not the
  // element itself - it still renders, fixed in place, with no JS motion of
  // any kind (mascot.css's own reduced-motion block already stops the
  // character's little idle bob independently of this file).
  if (reducedMotion) {
    return (
      <div className="aq-companion-root aq-companion-static" aria-hidden="true">
        <div className="aq-companion-body">
          <Mascot character={character} pose="idle" size={44} />
          <button type="button" className="aq-companion-x" onClick={dismiss} tabIndex={-1}>×</button>
        </div>
      </div>
    )
  }

  const dragging = dragRef.current.dragging && dragRef.current.moved && !!dragPt
  const waHref = safeExternalHref(WHATSAPP_HREF)

  return (
    <div className="aq-companion-root" ref={rootRef} aria-hidden="true">
      <div className="aq-companion-body">
        {!followMode && (
          <div
            className={'aq-companion-bone' + (dragging ? ' is-dragging' : '')}
            onPointerDown={onBonePointerDown}
            onPointerMove={onBonePointerMove}
            onPointerUp={endBoneDrag}
            onPointerCancel={cancelBoneDrag}
            onClick={onBoneClick}
          >
            <svg width="58" height="58" viewBox="0 0 104 104">
              {/* 13.6 template: the keyline is the GROUND, not the ink.
                  `--sticker-ground` is declared on `.aq-companion-root`.
                  This disc token stays at HOME during a drag (it fades via
                  `.is-dragging` in Companion.css) - only the bone glyph
                  itself (BoneGlyph below) travels to the cursor, so the
                  circle chrome around it is never what's "stuck" to the
                  pointer. */}
              <circle cx="52" cy="52" r="50" fill="var(--sky)" stroke="var(--sticker-ground, var(--bg))" strokeWidth="3" />
              <path id={`comp-seal-${sealId}`} d="M52 92a40 40 0 010-80a40 40 0 010 80" fill="none" />
              <text fontFamily="var(--mono)" fontSize="9" fontWeight="800" letterSpacing="2" fill="var(--ink)">
                <textPath href={`#comp-seal-${sealId}`} startOffset="4%">· DRAG ME · DRAG ME ·</textPath>
              </text>
              <g transform="translate(30, 42)"><BoneGlyphPaths /></g>
            </svg>
          </div>
        )}
        {followMode && (
          <div className="aq-companion-home">
            {/* The rounded-rect CTA the plate now sits on. Only rendered once
                the mascot has actually wandered off (follow mode) - it fills
                exactly the empty corner the mascot vacated, per the report. */}
            <a
              className="aq-companion-cta"
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={-1}
            >
              <span className="aq-companion-cta-label">reach out</span>
            </a>
            <div
              className="aq-companion-plate"
              onClick={e => { e.stopPropagation(); releaseFollowMode() }}
              onPointerDown={e => e.stopPropagation()}
            >
              <svg width="58" height="58" viewBox="0 0 104 104">
                <circle cx="52" cy="52" r="50" fill="var(--lemon)" stroke="var(--sticker-ground, var(--bg))" strokeWidth="3" />
                <path id={`comp-plate-${sealId}`} d="M52 92a40 40 0 010-80a40 40 0 010 80" fill="none" />
                <text fontFamily="var(--mono)" fontSize="9" fontWeight="800" letterSpacing="2" fill="var(--ink)">
                  <textPath href={`#comp-plate-${sealId}`} startOffset="4%">· PUT IT BACK · PUT IT BACK ·</textPath>
                </text>
                {/* the plate: an ellipse rim with an inner well, so it reads as a
                    dish to drop the bone into rather than another token. */}
                <g transform="translate(52, 56)">
                  <ellipse cx="0" cy="0" rx="26" ry="12" fill="var(--paper, #F7F3E8)" stroke="var(--ink)" strokeWidth="2.4" />
                  <ellipse cx="0" cy="-1.5" rx="16" ry="6.5" fill="none" stroke="var(--ink)" strokeWidth="2" />
                </g>
              </svg>
            </div>
          </div>
        )}
        <Mascot character={character} pose="idle" size={44} />
        <button type="button" className="aq-companion-x" onClick={dismiss} tabIndex={-1}>×</button>
      </div>
      {dragging && dragPt && typeof document !== 'undefined' && createPortal(
        // Portalled to <body>, NOT a child of `.aq-companion-root` - the root
        // carries its own `transform`, which makes it a containing block for
        // any `position: fixed` descendant (CSS transforms do that), so a
        // ghost nested under it would track the root's translate instead of
        // the raw viewport/pointer coordinates this is meant to sit at.
        <div
          className="aq-companion-bone-ghost"
          style={{ left: dragPt.x, top: dragPt.y }}
          aria-hidden="true"
        >
          <svg width="44" height="44" viewBox="0 0 104 104">
            <g transform="translate(30, 42)"><BoneGlyphPaths /></g>
          </svg>
        </div>,
        document.body
      )}
    </div>
  )
}

/** Just the bone bar-and-knobs, shared by the resting token and the drag
 *  ghost, so the two never drift out of sync with each other. */
function BoneGlyphPaths() {
  return (
    <>
      <rect x="8" y="6.5" width="28" height="7" fill="var(--paper, #F7F3E8)" stroke="var(--ink)" strokeWidth="2.4" />
      <circle cx="6" cy="6" r="6.5" fill="var(--paper, #F7F3E8)" stroke="var(--ink)" strokeWidth="2.4" />
      <circle cx="6" cy="14" r="6.5" fill="var(--paper, #F7F3E8)" stroke="var(--ink)" strokeWidth="2.4" />
      <circle cx="38" cy="6" r="6.5" fill="var(--paper, #F7F3E8)" stroke="var(--ink)" strokeWidth="2.4" />
      <circle cx="38" cy="14" r="6.5" fill="var(--paper, #F7F3E8)" stroke="var(--ink)" strokeWidth="2.4" />
    </>
  )
}
