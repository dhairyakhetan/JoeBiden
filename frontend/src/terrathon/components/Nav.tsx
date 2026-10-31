import { useState, useEffect } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { EVENT } from '../config'
import { SPORT_ORDER, type PublicEvent } from '../lib/types'
import { isSoundOn, setSoundOn } from '../lib/sound'
import { rupees } from '../lib/format'
import { SportMark } from './SportMarks'

const B = EVENT.base

/**
 * One icon swapping for another, without either of them blinking.
 *
 * Both of this bar's toggles used to render `{on ? <pathsA/> : <pathsB/>}`,
 * which replaces the geometry between two frames: the speaker's waves and its
 * cross, the burger's three bars and its X. There is no state in between, so
 * the two most-tapped controls in the section acknowledged a tap by flickering.
 *
 * Both variants stay mounted in the same grid cell and cross-fade on opacity,
 * scale and blur. The button's background and border already flip colour on the
 * same change, so motion is never the only thing saying what happened.
 */
function IconSwap({ show, children }: { show: boolean; children: React.ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <motion.g
      initial={false}
      animate={{ opacity: show ? 1 : 0, scale: show ? 1 : 0.25, filter: show ? 'blur(0px)' : 'blur(4px)' }}
      transition={reduce ? { duration: 0 } : { type: 'spring', duration: 0.3, bounce: 0 }}
      style={{ transformOrigin: '12px 12px' }}
    >
      {children}
    </motion.g>
  )
}

function SoundToggle() {
  const [on, setOn] = useState(false)
  // Read in an effect, not in useState's initialiser: localStorage throws in
  // some private-mode configurations and this must never break the header.
  useEffect(() => { setOn(isSoundOn()) }, [])
  const toggle = () => { const next = !on; setOn(next); setSoundOn(next) }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? 'Turn celebration sound off' : 'Turn celebration sound on'}
      title={on ? 'Turn celebration sound off' : 'Turn celebration sound on'}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 44, height: 44, flex: '0 0 auto',
        borderRadius: 'var(--tt-r-pill)', border: '2px solid var(--ink, #0A0A0A)',
        background: on ? 'var(--tt-lemon)' : 'transparent',
        color: on ? '#0A0A0A' : 'var(--tt-ink)', cursor: 'pointer',
      }}
    >
      {/* 2.5, matching the burger beside it AND the sport chips in the same
          bar. One bar is one surface, and a surface gets one stroke weight. */}
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11 5 6.5 9H3v6h3.5L11 19Z" />
        <IconSwap show={on}>
          <path d="M15.2 9.2a4 4 0 0 1 0 5.6" /><path d="M17.8 6.6a7.6 7.6 0 0 1 0 10.8" />
        </IconSwap>
        <IconSwap show={!on}>
          <path d="M16 9.5 21 14.5" /><path d="M21 9.5 16 14.5" />
        </IconSwap>
      </svg>
    </button>
  )
}

/**
 * The header is a chip rail, not a link list.
 *
 * Every destination is a tappable pill with a 2px ink rule, which reads as one
 * system with the sport cards and the status stickers, and gives the three
 * sports the prominence they need: on a page whose whole job is "pick one of
 * three and sign up", burying them in a dropdown was the wrong call.
 */
export function Nav({ events }: { events: PublicEvent[] }) {
  const [menu, setMenu] = useState(false)
  const location = useLocation()

  // Close the mobile menu on navigation. Adjusted during render (React's
  // documented "adjust state when a prop changes" pattern, same technique
  // components/Img.tsx already uses for prevBase) rather than in an effect,
  // so a route change closes the menu in the same render instead of a tick
  // later.
  const [prevPathname, setPrevPathname] = useState(location.pathname)
  if (location.pathname !== prevPathname) {
    setPrevPathname(location.pathname)
    setMenu(false)
  }

  const ordered = SPORT_ORDER
    .map((s) => events.find((e) => e.slug === s))
    .filter(Boolean) as PublicEvent[]

  return (
    <header
      style={{
        position: 'sticky', top: 0, zIndex: 50,
        // Night, very slightly translucent so the starfield behind it keeps
        // moving as the page scrolls rather than being masked by a flat bar.
        // Not fully transparent: the wordmark has to stay readable over the
        // poster art that scrolls beneath it.
        background: 'rgba(5, 6, 10, 0.93)',
        backdropFilter: 'saturate(140%) blur(8px)',
        WebkitBackdropFilter: 'saturate(140%) blur(8px)',
        borderBottom: '2px solid rgba(221, 108, 238, 0.55)',
      }}
    >
      <div className="tt-wrap" style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 62 }}>
        <Link
          to={B}
          className="tt-hit tt-navmark"
          aria-label="TerraThon 2026 home"
          style={{
            fontFamily: 'var(--tt-display)', fontWeight: 700, fontSize: 21,
            letterSpacing: '-0.01em', textTransform: 'uppercase',
            color: 'var(--tt-ink)', textDecoration: 'none', lineHeight: 1,
            display: 'inline-flex', alignItems: 'baseline', gap: 7, minWidth: 0,
          }}
        >
          {/* Read from config rather than typed here. This header used to
              hardcode the word and the year, which made it the one place
              nobody would remember to change, because it goes through neither
              EVENT nor the shared Wordmark component. The rendering is
              unchanged: NeutralFace is caps-only and textTransform is
              uppercase above, so EVENT.wordmark sets identically to the
              literal it replaced. */}
          {EVENT.wordmark}
          <span style={{ fontFamily: 'var(--tt-code)', fontSize: 'var(--tt-fs-meta)', letterSpacing: '0.18em', color: 'var(--tt-go)' }}>{EVENT.wordmarkYear.slice(-2)}</span>
        </Link>

        {/* Plain uppercase links, not a chip per sport. The chip rail
            repeated the three sport cards that sit one screen below it and
            made the bar read as a filter row rather than navigation. The
            approved board carries four words and the register pill. */}
        <nav aria-label="TerraThon" className="tt-navrail">
          <NavLink to={`${B}/schedule`} className={({ isActive }) => `tt-navlink ${isActive ? 'is-on' : ''}`}>
            Schedule
          </NavLink>
          <NavLink to={`${B}/rules`} className={({ isActive }) => `tt-navlink ${isActive ? 'is-on' : ''}`}>
            Rules
          </NavLink>
          <NavLink to={`${B}/contact`} className={({ isActive }) => `tt-navlink ${isActive ? 'is-on' : ''}`}>
            Contact
          </NavLink>
        </nav>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 9, alignItems: 'center' }}>
          <SoundToggle />
          {/* The quiet variant, not the hot one.
              At 1280 the home page carried five tomato primaries: this one, the
              poster's, one per sport card and the closing band's. The three
              page-level ones shared a label and a treatment, so at any scroll
              position two identically weighted "Register Now" buttons were in view
              and neither read as THE action. The component's own CSS states the
              rule it was breaking: one hot primary.

              This is the persistent fallback, not the ask. The poster makes
              the ask at the top and the closing band makes it at the bottom, and
              both keep the tomato. It stays a full 44px button either way. */}
          <Link to={`${B}/register`} className="tt-btn tt-btn--quiet tt-navcta" style={{ minHeight: 44, padding: '0 22px', fontSize: 'var(--tt-fs-meta)', borderColor: 'var(--tt-hot)' }}>
            Register Now
          </Link>
          <button
            type="button"
            onClick={() => setMenu((v) => !v)}
            aria-expanded={menu}
            aria-label={menu ? 'Close menu' : 'Open menu'}
            className="tt-burger"
            style={{
              width: 44, height: 44, flex: '0 0 auto', borderRadius: 'var(--tt-r-pill)',
              border: '2px solid var(--ink, #0A0A0A)', background: menu ? 'var(--tt-ink)' : 'transparent',
              color: menu ? 'var(--tt-paper)' : 'var(--tt-ink)', cursor: 'pointer',
            }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <IconSwap show={menu}>
                <path d="M6 6l12 12" /><path d="M18 6 6 18" />
              </IconSwap>
              <IconSwap show={!menu}>
                <path d="M3 7h18" /><path d="M3 12h18" /><path d="M3 17h18" />
              </IconSwap>
            </svg>
          </button>
        </div>
      </div>

      {menu && (
        <div style={{ borderTop: '2px solid var(--ink, #0A0A0A)', background: 'var(--tt-paper-2)' }}>
          <nav aria-label="TerraThon" className="tt-wrap" style={{ display: 'grid', gap: 9, padding: '16px 20px 20px' }}>
            {ordered.map((e) => (
              <Link
                key={e.slug}
                to={`${B}/${e.slug}`}
                className="tt-card"
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', textDecoration: 'none', color: 'inherit', boxShadow: 'none' }}
              >
                <SportMark sport={e.slug} size={22} />
                <span style={{ fontFamily: 'var(--tt-display)', fontWeight: 700, fontSize: 19, textTransform: 'uppercase' }}>{e.display_name}</span>
                <span className="tt-code" style={{ marginLeft: 'auto', fontSize: 'var(--tt-fs-meta)' }}>{rupees(e.fee_inr)}</span>
              </Link>
            ))}
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 2 }}>
              <Link to={`${B}/schedule`} className="tt-chip" style={{ textDecoration: 'none' }}>Schedule</Link>
              <Link to={`${B}/contact`} className="tt-chip" style={{ textDecoration: 'none' }}>Contact</Link>
              {/* Same quiet entry as the footer's, so the desk can be reached
                  from the menu on a phone without hunting for the page foot. */}
              <Link to={`${B}/admin`} className="tt-adminlink" onClick={() => setMenu(false)}>
                Admin
              </Link>
            </div>
          </nav>
        </div>
      )}

      <style>{`
        .tt-navrail { display: none; gap: 22px; align-items: center; margin-left: 22px; }
        .tt-burger  { display: inline-flex; align-items: center; justify-content: center; }
        /* 760, not 1000. The 1000 was sized for five chips carrying a mark and
           a sport name each. The rail is now three short uppercase words, which
           fit from tablet width, so a tablet gets real navigation instead of a
           burger hiding three links. */
        @media (min-width: 760px) {
          .tt-navrail { display: flex; }
          .tt-burger  { display: none; }
        }
        /* nowrap: the quiet variant is narrower than the hot one was, and at
           420px "SIGN UP" broke onto two lines inside a 44px pill. "Register
           Now" is longer still, so nowrap keeps it on one line and the pill
           just grows wider instead. It is hidden on narrow screens, where the
           burger carries the same link, and the breakpoint is 560 rather than
           the old 460: measured at 463px the row ran 463 into a 458 box,
           because "Register Now" is wider than the "Sign up" the 460 was
           picked for. The wordmark, the sound toggle and the burger are what
           have to survive every width. */
        .tt-navcta { white-space: nowrap; }
        @media (max-width: 560px) { .tt-navcta { display: none; } }
        /* The mark may shrink rather than push the row open. */
        @media (max-width: 400px) { .tt-navmark { font-size: 17px !important; } }
      `}</style>
    </header>
  )
}
