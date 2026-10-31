import ThesisBand from './ThesisBand'
import { useEffect, useRef, useState } from 'react'
import './AQFooter.css'
import '../styles/footer.css'
import { Link, useLocation } from 'react-router-dom'
import ParadoxBanner from './ParadoxBanner'
import Img from './Img'
import Sticker from './Sticker'
import { useAuth } from '../auth/AuthContext'
import { PLACE_AND_YEAR, ORG_FACTS, displayCount } from '../lib/orgFacts'
import { setAuthIntent } from '../lib/authIntent'
import { prefetchRouteByPath } from '../lib/routeModules'
import { Mascot } from './Mascot'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

/* ═══════════════════════════════════════════════════════════════════════════
   THE FOOTER — four sections.

     1  the hi bubbles     — eight circular video windows orbiting the wordmark
     2  the facts + links  — 2a: three live-figure fact tiles (still a bento);
                             2b: every footer destination, as three plain
                             label-and-stack link columns (2026-09-08 — see
                             AQFooter.css §2 for why these are no longer cards)
     3  the "AQ is…" wall  — oversized manifesto with inline sticker glyphs,
                             absorbing the §14.4 CTA
     4  the closing bar    — stamp, socials, legal

   ── The three §14.0 constraints, and where each one lives ──────────────────
   1. ONE IntersectionObserver gates everything (the useEffect below). Nothing
      runs until the footer is within 200px of the viewport; everything stops
      when it leaves.
   2. ONE rAF loop for the whole footer (`tick`). It drives the bubble orbit
      AND the bubble frame draws. There is no second loop, and no CSS
      animation with a JS counterpart.
   3. framer-motion is NOT imported. It is 44.4KB gz that the perf audit is
      trying to get out of the modulepreload list; a footer that imports it
      re-pins it on every route. Everything here is plain DOM.

   AQFooter is lazy-imported by PublicLayout and is the only consumer of
   AQFooter.css and styles/footer.css, so all of the above ships in a lazy
   chunk rather than in the critical CSS.

   ── ONE decoder, eight bubbles ─────────────────────────────────────────────
   public/hi/hi-reel.mp4 is ONE pre-stitched 2560x320 reel holding 8 square
   320x320 frames. HiStrip's own docblock records that eight <video> elements
   were tried and rejected ("eight decoders, which phones handle badly").

   A single <video> element can only be painted in one place in the DOM, so
   the literal "eight masked windows onto the same element" is not
   expressible: eight hosts would need eight nodes. The technique that keeps
   the constraint that actually matters — ONE decoder — is one hidden <video>
   plus eight <canvas> windows, each blitting a different 320px slice of that
   one decoded frame:

       ctx.drawImage(video, n * 320, 0, 320, 320, 0, 0, size, size)

   Eight 320x320 blits from an already-decoded frame, throttled to ~12fps,
   inside the footer's single rAF loop. `document.querySelectorAll('footer
   video').length === 1` holds.

   Before the video has data — and always, under reduced motion — each bubble
   shows the poster still for its own frame, as a background-position slice
   of hi-reel.jpg. So the composition is complete with zero JS.
   ═══════════════════════════════════════════════════════════════════════════ */

const FRAME_COUNT = 8
const FRAME_PX = 320
/** Backing-store size for each bubble canvas. One number, not per-bubble. */
const CANVAS_PX = 160
/** ~12fps. This is ambient texture; 60fps of blits buys nothing. */
const DRAW_INTERVAL_MS = 80

/** Authored orbit placement: left%, top%, size step, and the phase/amplitude
 *  of its drift. Percentages keep the cluster inside its host at every width,
 *  so nothing here can push the page wider (the 375/360 overflow rule). */
const BUBBLES: Array<{ x: number; y: number; s: 'lg' | 'md' | 'sm'; phase: number; amp: number }> = [
  { x: 10, y: 26, s: 'lg', phase: 0.0, amp: 9 },
  { x: 26, y: 78, s: 'md', phase: 1.1, amp: 7 },
  { x: 39, y: 8, s: 'sm', phase: 2.3, amp: 11 },
  { x: 56, y: 90, s: 'sm', phase: 3.4, amp: 10 },
  { x: 69, y: 13, s: 'md', phase: 4.2, amp: 7 },
  { x: 89, y: 29, s: 'lg', phase: 5.0, amp: 8 },
  { x: 92, y: 75, s: 'md', phase: 5.8, amp: 9 },
  { x: 7, y: 68, s: 'sm', phase: 2.9, amp: 11 },
]


/* ── live figures ──────────────────────────────────────────────────────────
   ORG_FACTS is build-time and every number in this footer comes from it —
   never hand-typed (BRAND_VOICE.md §3). A fact that does not resolve renders
   as a dashed live marker, never as a zero: a zero is a claim. */
function liveFigure(n: number | null | undefined, exact = false): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null
  return exact ? String(n) : displayCount(n)
}

export default function AQFooter() {
  const { isAuthenticated } = useAuth()
  const { pathname } = useLocation()
  const reducedMotion = usePrefersReducedMotion()

  const footerRef = useRef<HTMLElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const bubbleRefs = useRef<(HTMLSpanElement | null)[]>([])
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const ctxRefs = useRef<(CanvasRenderingContext2D | null)[]>([])

  const [isInView, setIsInView] = useState(false)
  const inViewRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const lastDrawRef = useRef(0)

  // ── the ONE rAF loop + the ONE IntersectionObserver (§14.0 1 and 2) ─────
  // Both live in a single effect so the loop can be a plain self-scheduling
  // function: no ref-through-render trick, no stale closure, and nothing to
  // keep in sync across two hooks.
  useEffect(() => {
    const el = footerRef.current
    if (!el) return

    const stop = () => {
      if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    }

    function tick(now: number) {
      if (!inViewRef.current) { rafRef.current = null; return }

      // (a) orbit — one transform write per bubble, no layout read.
      const t = now * 0.00022
      for (let i = 0; i < BUBBLES.length; i++) {
        const bubble = bubbleRefs.current[i]
        if (!bubble) continue
        const b = BUBBLES[i]
        const dx = Math.cos(t + b.phase) * b.amp
        const dy = Math.sin(t + b.phase) * b.amp * 0.7
        bubble.style.transform = `translate(-50%, -50%) translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)`
      }

      // (b) the eight frame blits, throttled — same loop, no second scheduler.
      const v = videoRef.current
      if (v && v.readyState >= 2 && now - lastDrawRef.current >= DRAW_INTERVAL_MS) {
        lastDrawRef.current = now
        for (let i = 0; i < FRAME_COUNT; i++) {
          const ctx = ctxRefs.current[i]
          if (!ctx) continue
          try {
            ctx.drawImage(v, i * FRAME_PX, 0, FRAME_PX, FRAME_PX, 0, 0, CANVAS_PX, CANVAS_PX)
          } catch { /* frame not decodable yet — the poster slice stands in */ }
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    const ensureLoop = () => {
      if (!inViewRef.current || reducedMotion) return
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick)
    }

    const syncVideo = () => {
      const v = videoRef.current
      if (!v) return
      if (inViewRef.current && !document.hidden && !reducedMotion) {
        v.play().catch(() => { /* autoplay blocked — the poster slices stand in */ })
      } else {
        v.pause()
      }
    }

    /* ── the jump-scroll fix ────────────────────────────────────────────────
       An IntersectionObserver reports a CROSSING. It fires once on observe and
       then only when the intersecting state changes — which is exactly right
       for a read-down and exactly wrong for every way of ARRIVING inside the
       footer without crossing its edge: an anchor jump, a back-to-top, a
       browser-restored scroll position, a fast flick that coalesces frames.
       The review reproduced it: class absent, video `paused: true,
       currentTime: 0`, and eight canvases still transparent.

       `measure()` is the direct read the observer cannot give — geometry now,
       not a crossing. It is driven by `scrollend` (fires ONCE after a scroll
       settles; not a per-frame listener, so the ONE-rAF-loop constraint is
       untouched), by `hashchange`, and by `pageshow` for a bfcache restore.
       `scrollend` is not universal yet, so a coalescing timeout on a passive
       `scroll` listener stands in where it is missing — same once-per-settle
       shape, never per frame. */
    let settleTimer: ReturnType<typeof setTimeout> | null = null

    const apply = (visible: boolean) => {
      if (visible === inViewRef.current) {
        // Already in the right state — but the loop or the video may still be
        // stopped from a previous exit, so re-assert both rather than return.
        if (visible) { ensureLoop(); syncVideo() }
        return
      }
      inViewRef.current = visible
      setIsInView(visible)
      if (visible) ensureLoop(); else stop()
      syncVideo()
    }

    const measure = () => {
      const node = footerRef.current
      if (!node) return
      const r = node.getBoundingClientRect()
      // The same 200px margin the observer uses, so the two agree.
      apply(r.bottom > -200 && r.top < window.innerHeight + 200)
    }

    const onSettle = () => { measure() }
    const onScroll = () => {
      if (settleTimer) clearTimeout(settleTimer)
      settleTimer = setTimeout(measure, 120)
    }

    const io = new IntersectionObserver(([entry]) => {
      apply(entry.isIntersecting)
    }, { rootMargin: '200px' })

    io.observe(el)
    const onVis = () => { if (document.hidden) stop(); else ensureLoop(); syncVideo() }
    document.addEventListener('visibilitychange', onVis)

    const hasScrollEnd = typeof window !== 'undefined' && 'onscrollend' in window
    if (hasScrollEnd) window.addEventListener('scrollend', onSettle)
    else window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('hashchange', onSettle)
    window.addEventListener('pageshow', onSettle)
    // And once now, for a route that mounts with the footer already on screen.
    measure()

    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      if (hasScrollEnd) window.removeEventListener('scrollend', onSettle)
      else window.removeEventListener('scroll', onScroll)
      window.removeEventListener('hashchange', onSettle)
      window.removeEventListener('pageshow', onSettle)
      if (settleTimer) clearTimeout(settleTimer)
      stop()
    }
  }, [reducedMotion])

  // Grab the eight 2D contexts once. Under reduced motion no canvas is
  // rendered at all, so this is a no-op there.
  useEffect(() => {
    if (reducedMotion) return
    for (let i = 0; i < FRAME_COUNT; i++) {
      const c = canvasRefs.current[i]
      ctxRefs.current[i] = c ? c.getContext('2d') : null
    }
  }, [reducedMotion])

  // ── section 2's data ─────────────────────────────────────────────────────
  const drives = liveFigure(ORG_FACTS.drivesWrittenUp)
  const members = liveFigure(ORG_FACTS.membersTotal)
  const departments = liveFigure(ORG_FACTS.departmentsActive, true)

  const FEATURES: Array<{ to: string; fig: string | null; unit: string; note: string; cls: string }> = [
    { to: '/projects', fig: drives, unit: 'drives written up', note: 'projects & what we do', cls: 'aq-bento-a' },
    { to: '/members', fig: members, unit: `members, ages ${ORG_FACTS.ageRange}`, note: 'members', cls: 'aq-bento-b' },
    { to: '/teams', fig: departments, unit: 'departments', note: 'teams', cls: 'aq-bento-c' },
  ]

  const LISTS: Array<{ h: string; cls: string; links: Array<[string, string]> }> = [
    {
      h: 'read & connect', cls: 'aq-col-d',
      links: [['blog', '/blog'], ['quick links', '/links'], ['search', '/search'], ['feed', '/'], ['contact', '/contact']],
    },
    {
      h: 'organisation', cls: 'aq-col-e',
      links: [['about', '/about'], ['open books', '/accounts'], ['faq', '/faq'], ['equity policy', '/equity-policy'], ['privacy policy', '/privacy-policy'], ['collaborate', '/collaborations'], ['brand book', '/brand'], ['paradox', '/paradox']],
    },
    {
      h: 'be a part', cls: 'aq-col-f',
      links: [
        (isAuthenticated ? ['my profile', '/profile/me'] : ['join the work', '/login']) as [string, string],
        ['open roles', '/opportunities'], ['volunteer handbook', '/volunteer'], ['guided demos', '/demo'], ['support us', '/support'],
      ],
    },
  ]

  return (
    <div className="container aq-footer-frame">
      <footer className={'aq-footer' + (isInView ? ' is-in-view' : '')} ref={footerRef}>

        {/* ══ 1 · the hi bubbles ══════════════════════════════════════════ */}
        <div className="aq-orbit-bleed">
          <div className="aq-orbit">
            {/* The ONE decoder. Kept in the DOM (not display:none, which stops
                decode) at 2px and near-zero opacity; every visible frame is a
                canvas blit of this element. */}
            {!reducedMotion && (
              <video
                ref={videoRef}
                className="aq-orbit-src"
                src="/hi/hi-reel.mp4"
                poster="/hi/hi-reel.jpg"
                muted
                loop
                playsInline
                preload="none"
                aria-hidden
                tabIndex={-1}
              />
            )}

            <div
              className="aq-orbit-ring"
              role="img"
              aria-label="Students and kids from AquaTerra drives waving hello"
            >
              {BUBBLES.map((b, i) => (
                <span
                  key={i}
                  ref={el => { bubbleRefs.current[i] = el }}
                  className={`aq-bubble aq-bubble--${b.s}`}
                  style={{
                    left: `${b.x}%`,
                    top: `${b.y}%`,
                    // the poster slice for this frame — visible before the
                    // video has data, and the only layer under reduced motion
                    backgroundPosition: `${(i / (FRAME_COUNT - 1)) * 100}% 50%`,
                  }}
                >
                  {!reducedMotion && (
                    <canvas
                      ref={el => { canvasRefs.current[i] = el }}
                      width={CANVAS_PX}
                      height={CANVAS_PX}
                      aria-hidden
                    />
                  )}
                </span>
              ))}
            </div>

            <div className="aq-orbit-word" aria-hidden="true">AQUATERRA</div>
          </div>
        </div>

        {/* ══ 2a · the facts strip — three live figures, still a bento ═══ */}
        <div className="aq-footer-in">
          <nav className="aq-bento" aria-label="AquaTerra in numbers">
            {FEATURES.map(f => (
              <Link
                key={f.to}
                to={f.to}
                className={`aq-tile aq-tile--feature ${f.cls}`}
                onMouseEnter={() => prefetchRouteByPath(f.to)}
                onFocus={() => prefetchRouteByPath(f.to)}
              >
                {f.fig
                  ? <span className="aq-tile-fig">{f.fig}</span>
                  : <span className="aq-tile-fig aq-tile-fig--pending" aria-label="figure unavailable">—</span>}
                <span className="aq-tile-unit">{f.unit}</span>
                <span className="aq-tile-go">{f.note} <span aria-hidden>→</span></span>
              </Link>
            ))}
          </nav>

          {/* ══ 2b · the link columns — plain, stacked, spaced ═════════════
              2026-09-08: pulled out of the bento (see AQFooter.css for why).
              Three labelled columns, each a single vertical stack of links —
              no card, no sub-columns — so it stacks to one column per section
              on a phone instead of squeezing into a second sub-grid. */}
          <nav className="aq-foot-links" aria-label="Footer links">
            {LISTS.map(col => (
              <div key={col.h} className={`aq-foot-col ${col.cls}`}>
                <h2 className="aq-foot-col-h">{col.h}</h2>
                <ul className="aq-foot-col-links">
                  {col.links.map(([label, href]) => (
                    <li key={href}>
                      <Link
                        to={href}
                        className="aq-footer-link"
                        onMouseEnter={() => prefetchRouteByPath(href)}
                        onFocus={() => prefetchRouteByPath(href)}
                      >{label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* ══ 2b · the thesis — the one line, on every public page (owner, 2026-10-18) ══ */}
        {/* /about already carries the thesis in its own body: showing it again in the footer put the same card twice on one page */}
        {pathname !== '/about' && (
          <div className="aq-footer-in">
            <ThesisBand variant="footer" />
          </div>
        )}

        {/* ══ 3 · the manifesto — absorbs the §14.4 CTA ══════════════════ */}
        <div className="aq-footer-in">
          <section className="aq-manifesto">
            {/* REMOVED 2026-09-14, owner request: the "aq is —" eyebrow above
                (added at an earlier owner request) read as orphaned/weird in
                practice - the em dash hands off to a headline two lines down,
                which is too much of a gap for the sentence to visibly
                complete. Gone; the manifesto now opens straight on the
                headline below. */}
            <h2 className="aq-mf-line">
              come and do something
              {/* size 92, not 72: stickers.css sizes a `status` word at
                  0.082 * --stk-size, so 72px computed to 5.904px — under every
                  size DESIGN.md §3 allows. Sizing up alone cannot fix it at
                  every width (110px would land the ratio on 9.02px on desktop
                  and still fall under 7px at the two narrower breakpoints, and
                  a 110px glyph inline in the headline costs ~60px of footer
                  height on its own), so footer.css pins the word to a flat 9px
                  — a documented rung — and the size here is chosen for the
                  composition instead. Local override; the shared 0.082 ratio
                  has another consumer and is left alone. */}
              <span className="aq-mf-glyph"><Sticker shape="circle" hue="lemon" rotate={-6} size={92} type="status">est 2021</Sticker></span>
              <span className="aq-mf-glyph"><Sticker shape="hexagon" hue="sky" rotate={4} size={92} type="status">student run</Sticker></span>
              <span className="aq-mf-em"> real</span>.
            </h2>
            <p className="aq-mf-lede">Free forever. No donations, no fees. Pick a team, show up, and get to work.</p>
            {isAuthenticated
              ? <Link to="/" className="aq-mf-cta" onMouseEnter={() => prefetchRouteByPath('/')} onFocus={() => prefetchRouteByPath('/')}>open the feed <span aria-hidden>→</span></Link>
              : <Link to="/login" className="aq-mf-cta" onClick={() => setAuthIntent({ kind: 'apply' })} onMouseEnter={() => prefetchRouteByPath('/login')} onFocus={() => prefetchRouteByPath('/login')}>Join the work <span aria-hidden>→</span></Link>}
          </section>
        </div>

        {/* ══ 3b · the letter ════════════════════════════════════════════
            Asked for in the walkthrough - "last section of footer, a letter to
            the people who made AQ what it is, from the people who make AQ what
            it is" - designed, approved as an artifact, and then never built.
            This is that section.

            It is the one place in the footer that inverts to paper-on-cream:
            everything above it is ink ground, so the letter reads as a card
            somebody actually handed you rather than another block of chrome.
            Caveat for the signature, which is the only handwriting on the
            public site and is exactly what a signature is for. */}
        <div className="aq-footer-in">
          <section className="aq-letter" aria-labelledby="aq-letter-h">
            <h2 id="aq-letter-h" className="sr-only">A letter from the AquaTerra team</h2>
            <p className="aq-letter-open">welcome, friend</p>
            <p className="aq-letter-body">
              AquaTerra exists because a few students in Kolkata decided a Saturday
              afternoon could go to a feeding drive instead of nothing in particular,
              and then showed up again the next one.
            </p>
            <p className="aq-letter-body">
              whether it is your first drive or your fiftieth, this is a letter to the
              people who make AQ what it is: <em>you</em>. not the org account, not the
              desk, the volunteer who turned up.
            </p>
            <p className="aq-letter-body">thank you for making it real.</p>
            <p className="aq-letter-sign">love, the AquaTerra team</p>
          </section>
        </div>

        {/* The Paradox card sits right under the letter: on a phone the two read as one card (footer.css), and the
            closing bar is the last thing in the footer again, where the legal line belongs. */}
        <ParadoxBanner />

        {/* ══ 4 · the closing bar ════════════════════════════════════════ */}
        <div className="aq-footer-in">
          <div className="aq-close">
            <div className="aq-close-id">
              {/* 02.4 / 14.6: stamp-ink.png (square) at 22px in the 34px disc —
                  never logo.png, a 1332x225 wordmark that renders ~5px tall
                  here. `no-outline` because the global img outline rule draws
                  a square across every rounded image otherwise. */}
              <span className="aq-foot-disc">
                <Img src="/stamp-ink-96.png" alt="AquaTerra" className="no-outline" />
              </span>
              <span className="aq-foot-brand-word">aquaterra</span>
              {/* bhoot ("ghost") is the cast's one flat/neutral-mouth character -
                  nolen's default grin read as a cute smiling face here, which
                  the owner asked to be neutral. */}
              <Mascot character="bhoot" pose="idle" size={26} />
            </div>

            <div className="aq-close-soc">
              <a className="aq-soc" href="https://instagram.com/ngo.aquaterra" target="_blank" rel="noopener noreferrer">instagram</a>
              <a className="aq-soc" href={ORG_FACTS.linkedinUrl} target="_blank" rel="noopener noreferrer">linkedin</a>
            </div>

            <div className="aq-close-legal">
              <span>© 2026 AQUATERRA - open community, no rights reserved.</span>
              <span>
                {PLACE_AND_YEAR}
                {members ? <span className="aq-close-n"> · {members} members</span> : null}
              </span>
            </div>
          </div>
        </div>

      </footer>
    </div>
  )
}
