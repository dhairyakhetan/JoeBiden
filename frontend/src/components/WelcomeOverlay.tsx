import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { supabase } from '../lib/supabase'
import { sized } from '../lib/imageUrl'
import { ORG_FACTS, displayCount } from '../lib/orgFacts'
import { setAuthIntent } from '../lib/authIntent'
import { Mascot } from './Mascot'
import './WelcomeOverlay.css'
import useDialog from '../hooks/useDialog'

/**
 * First-visit welcome for brand-new, logged-out visitors. Shows ONCE
 * (localStorage), only once auth has resolved to "not signed in", and never on
 * the auth / intake / sub-app routes where it would be noise.
 *
 * REDESIGN 2026-09-09: replaced the 2026-07 "letter from Kolkata" envelope -
 * a multi-stage wax-seal/flap/pocket choreography built from raw gradients
 * and an inset-shadow "poured wax" blob, styled against no design token in
 * the current system. Same job (welcome + two honest CTAs + a hint of real
 * documentary photography), now built from the same pieces every other
 * current surface uses: a `.sticker--diecut` eyebrow, a mascot cameo (the
 * same `ilish`/cheer pairing AQNav's own mega-menu "join the chaos" card
 * uses for this exact message), the modal shell's own tokens
 * (`--bd-hero`/`--r-md`/`--shadow-cta`, matching every `.aqm-panel`), and the
 * stamped-primary/ghost-secondary button pair already correct per DESIGN.md
 * §1 (kept verbatim from the old file). One pop-in, not a four-beat reveal -
 * framer-motion is deliberately not imported here (see HomeIntro's own note
 * on why): this sits on the very first paint a new visitor gets, same as
 * that component, so the entrance is a plain CSS keyframe instead.
 *
 * Both CTAs are honest about where they go: "explore the community" simply
 * closes the card and leaves you on the public site, and "become a part"
 * goes to /login - Google OAuth is the one working door and it handles new
 * sign-ups and returning members alike.
 */
const SEEN_KEY = 'aq_welcome_v1'
const JOIN_PATH = '/login'

// /demo added per changelog/19-guided-demos.md: a guided-demo visitor is
// always logged out from this component's own point of view (it reads the
// real, unshadowed auth context - see demo/DemoProvider.tsx's header for why
// that instance can't fix this from its own side), so without this
// exclusion the real first-visit card can pop up mid-walkthrough and cover
// the coach mark with an unrelated modal.
const EXCLUDED = ['/login', '/register', '/pending', '/rejected', '/brand', '/auth/callback', '/demo']
// The event sub-apps are excluded for the same reason as each other: each is a
// self-contained funnel someone reaches from an Instagram link with one job in
// mind, and a community-recruitment card over the top of it is an interruption,
// not an introduction. Add any future sub-app here at the same time you route it.
const SUB_APPS = ['/paradox', '/terrathon', '/live']
const isExcluded = (path: string) =>
  SUB_APPS.some(p => path.startsWith(p)) || EXCLUDED.some(p => path === p || path.startsWith(p + '/'))

/** Scatter positions for the photo pile - kept out of render so they're stable. */
const PHOTO_SLOTS = [
  { cls: 'p1', rot: -7 },
  { cls: 'p2', rot: 6 },
]

export default function WelcomeOverlay() {
  const { isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [photos, setPhotos] = useState<string[]>([])

  useEffect(() => {
    if (isLoading || isAuthenticated) return
    if (isExcluded(pathname)) return
    let seen = false
    try { seen = localStorage.getItem(SEEN_KEY) === '1' } catch { /* private mode */ }
    if (seen) return
    const t = setTimeout(() => setOpen(true), 550)
    return () => clearTimeout(t)
  }, [isLoading, isAuthenticated, pathname])

  // Real drive photos for the scatter. Decorative: if this fails or returns
  // nothing the card is unaffected, so it's fire-and-forget by design.
  useEffect(() => {
    if (!open) return
    let alive = true
    ;(async () => {
      try {
        const { data } = await supabase
          .from('welfare_projects')
          .select('main_image')
          .eq('is_draft', false)
          .not('main_image', 'is', null)
          .limit(24)
        if (!alive || !data) return
        const urls = (data as any[])
          .map(r => r.main_image as string)
          .filter(u => typeof u === 'string' && u.length > 8)
        // Shuffle so repeat visitors (private mode, cleared storage) get variety.
        for (let i = urls.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[urls[i], urls[j]] = [urls[j], urls[i]]
        }
        setPhotos(urls.slice(0, PHOTO_SLOTS.length))
      } catch { /* decorative only */ }
    })()
    return () => { alive = false }
  }, [open])

  const persist = () => { try { localStorage.setItem(SEEN_KEY, '1') } catch { /* ignore */ } }

  const dismiss = () => {
    persist()
    setClosing(true)
    setTimeout(() => { setOpen(false); setClosing(false) }, 200)
  }

  const go = (path: string) => {
    persist()
    setClosing(true)
    setTimeout(() => { setOpen(false); navigate(path) }, 180)
  }

  /** Primary CTA: stay on the public site, just get the card out of the way. */
  const explore = () => {
    if (pathname === '/') dismiss()
    else go('/')
  }

  // Escape, the Tab trap, focus-in and focus-restore all come from the shared
  // hook.
  const panelRef = useDialog(open, dismiss)

  if (!open) return null

  return (
    <div className={`aqwc-scrim${closing ? ' is-closing' : ''}`} onClick={dismiss}>
      {/* Scattered real drive photos - decorative, hidden below 1080px (see
          .css) where there's no room beside the card for them. */}
      <div className="aqwc-photos" aria-hidden>
        {PHOTO_SLOTS.map((slot, i) => {
          const src = photos[i]
          if (!src) return null
          return (
            <figure key={slot.cls} className={`aqwc-photo ${slot.cls}`} style={{ ['--rot' as string]: `${slot.rot}deg` }}>
              <img src={sized(src, 'thumb')} alt="" loading="lazy" referrerPolicy="no-referrer" />
            </figure>
          )
        })}
      </div>

      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to AquaTerra"
        className={`aqwc-panel${closing ? ' is-closing' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <button className="aqwc-x" onClick={dismiss} aria-label="Close" title="Close">✕</button>

        <div className="aqwc-mascot"><Mascot character="ilish" pose="cheer" size={64} /></div>

        <span className="sticker sticker-mint sticker--diecut aqwc-eyebrow" style={{ ['--sticker-ground' as string]: 'var(--card)' }}>
          ★ new here?
        </span>

        <h2 className="aqwc-head">
          we&rsquo;re <span className="aqwc-serif">AquaTerra</span>.
        </h2>

        <p className="aqwc-body">
          {displayCount(ORG_FACTS.membersTotal)} students running real welfare, climate &amp; education work
          out of Kolkata. free to join, since 2021.
        </p>

        <div className="aqwc-cta-row">
          <button className="aqwc-btn aqwc-btn-primary" onClick={explore}>
            explore the community <span aria-hidden>→</span>
          </button>
          <button className="aqwc-btn aqwc-btn-ghost" onClick={() => { setAuthIntent({ kind: 'apply' }); go(JOIN_PATH) }}>
            become a part
          </button>
        </div>
      </div>
    </div>
  )
}
