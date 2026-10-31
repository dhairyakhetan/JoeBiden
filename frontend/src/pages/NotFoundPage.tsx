import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { useMeta } from '../hooks/useMeta'
import { Mascot } from '../components/Mascot'
import { fadeInUp, staggerContainer } from '../lib/motion'

export default function NotFoundPage() {
  // A 404 must never be indexed - noindex so crawlers drop soft-404 URLs
  // instead of ranking the error page.
  useMeta({
    title: 'Page Not Found | AquaTerra',
    description: 'The page you are looking for does not exist. Head back to AquaTerra.',
    noIndex: true,
  })

  // 18-mascots-and-motion.md, 18.0: the roaming companion should also read
  // bhoot on a 404, matching this page's own illustration below. The
  // catch-all route (App.tsx's `<Route path="*">`) has no path prefix of its
  // own for Companion.tsx to match against - "404" isn't a URL, it's "didn't
  // match anything else" - so this page names itself via a body attribute
  // instead, the same lightweight cross-component-signal pattern the app
  // already uses for "an overlay is open" (document.body.style.overflow).
  useEffect(() => {
    document.body.dataset.mascotPage = '404'
    return () => { delete document.body.dataset.mascotPage }
  }, [])

  const reduce = useReducedMotion()

  // This route is its own lazy chunk (App.tsx: `lazy(() => import('./pages/
  // NotFoundPage'))`), reached only after an actual 404 - unlike PublicLayout
  // (see its own comment on why a page-transition was removed from there),
  // importing framer-motion here costs nothing on every other page's load.
  return (
    <motion.div
      className="route-enter aq-wrap"
      variants={reduce ? undefined : staggerContainer}
      initial={reduce ? undefined : 'hidden'}
      animate={reduce ? undefined : 'visible'}
      style={{
        paddingTop: 'clamp(48px, 9vw, 96px)',
        paddingBottom: 'clamp(48px, 9vw, 96px)',
        textAlign: 'center',
        minHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* decorative - two stars, wandered off to the margins. The compass
          emoji this used to be had no colour-emoji fallback in this font
          stack (it painted as a flat outline glyph), so it's the same ★
          mark used everywhere else in the brand instead - consistent, and
          guaranteed to actually render. */}
      <span aria-hidden style={{ position: 'absolute', top: '10%', left: '9%', fontSize: 'clamp(20px, 3.6vw, 32px)', transform: 'rotate(-14deg)', opacity: 0.45 }}>★</span>
      <span aria-hidden style={{ position: 'absolute', bottom: '14%', right: '9%', fontSize: 'clamp(28px, 5vw, 44px)', transform: 'rotate(10deg)', opacity: 0.55 }}>★</span>

      {/* Section 01 step 28 wanted a mascot here. Section 09 exists now, so it
          lands. `stumped` is the pose for "he cannot find it either"; the page
          is paper, so bhoot is not hue-on-hue. Its own wobble (mascot.css's
          mcWobble) already plays on mount - the stagger below just decides
          when it's allowed to start relative to its neighbours. */}
      <motion.div variants={reduce ? undefined : fadeInUp}>
        <Mascot character="bhoot" pose="stumped" size={110} />
      </motion.div>
      <motion.span
        variants={reduce ? undefined : fadeInUp}
        className="sticker sticker-tomato wobble sticker--diecut"
        style={{ transform: 'rotate(-3deg)', ['--sticker-ground' as string]: 'var(--bg)' }}
      >
        ★ page not found
      </motion.span>

      <motion.div variants={reduce ? undefined : fadeInUp} style={{ position: 'relative', marginTop: 'clamp(14px, 2.5vw, 22px)' }}>
        <div
          aria-hidden
          className="h-display"
          style={{
            fontSize: 'clamp(96px, 20vw, 200px)',
            lineHeight: 0.85,
            letterSpacing: '-0.04em',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <span>4</span>
          <span style={{ display: 'inline-block', transform: 'rotate(-12deg)', color: 'var(--grape-ink)' }}>0</span>
          <span>4</span>
        </div>

        {/* "LOST" - a rubber-stamp style badge, hard border, no blur. Its own
            entrance is a stamp-down (scaled up + more rotated, snapping to
            rest) rather than the plain fadeInUp every sibling uses - the one
            flourish that earns its keep, since the copy already calls it a
            rubber stamp. */}
        <motion.div
          aria-hidden
          initial={reduce ? undefined : { opacity: 0, scale: 1.6, rotate: -28 }}
          animate={reduce ? undefined : { opacity: 1, scale: 1, rotate: -10 }}
          transition={reduce ? undefined : { type: 'spring', duration: 0.5, bounce: 0.35, delay: 0.5 }}
          style={{
            position: 'absolute',
            top: '2%',
            right: 'clamp(-4%, -2%, 2%)',
            border: '2px solid var(--tomato-ink)',
            borderRadius: 'var(--r-tight)',
            color: 'var(--tomato-ink)',
            fontFamily: 'var(--mono)',
            fontWeight: 800,
            fontSize: 'clamp(11px, 1.8vw, 15px)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            padding: '5px 12px',
            transform: reduce ? 'rotate(-10deg)' : undefined,
            background: 'var(--bg)',
          }}
        >
          lost
        </motion.div>
      </motion.div>

      <motion.h1 variants={reduce ? undefined : fadeInUp} className="h-display" style={{ fontSize: 'clamp(28px, 5vw, 44px)', marginTop: 18 }}>
        lost in the field.
      </motion.h1>
      <motion.p variants={reduce ? undefined : fadeInUp} style={{ color: 'var(--ink-2)', marginTop: 12, fontSize: 16, maxWidth: 420 }}>
        this link is broken, or the page wandered off on a drive of its own. happens to the best of us.
      </motion.p>

      {/* 12-secondary-pages.md §12.12: "a real <h1>, a sentence, and one link
          home. Not a search box - someone who mistyped a URL does not want
          to search." Previously also offered a `/search` link and a row of
          four category chips; both removed so the only way out of a 404 is
          the one link the spec names. */}
      <motion.div variants={reduce ? undefined : fadeInUp} className="row gap-2" style={{ marginTop: 28, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link to="/" className="btn btn-primary">take me home →</Link>
      </motion.div>
    </motion.div>
  )
}
