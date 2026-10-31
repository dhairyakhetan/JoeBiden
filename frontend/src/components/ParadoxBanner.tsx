import { Link } from 'react-router-dom'
import './ParadoxBanner.css'

/**
 * ParadoxBanner - a small Paradox-themed nudge that sits above the home feed.
 * Visually mirrors the "join the chaos" recruitment card (left rail, logged-out
 * state) but in Paradox colors: ink background, cream type, red accent + red
 * CTA. Single CTA, no sponsorship clutter - just a simple "you should know
 * about this" prompt.
 */
export default function ParadoxBanner() {
  return (
    <section className="px-banner" aria-label="Paradox 2026">
      <div className="px-banner__card">
        <span className="px-banner__sticker">★ jun 1–6, 2026 · kolkata · wrapped</span>
        <h2 className="px-banner__title">
          paradox <span className="px-banner__accent">2026.</span>
        </h2>
        <p className="px-banner__sub">
          10+ events. 6 days. 100% of profits funded welfare.
        </p>
        {/* This used to point at /paradox/legacy, a roll-of-honour page built
            entirely on placeholder winners and figures. That page was removed,
            so the CTA lands on the Paradox landing page instead. */}
        <Link to="/paradox" className="px-banner__cta">
          See Paradox <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  )
}
