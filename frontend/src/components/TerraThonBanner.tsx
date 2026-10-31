import { Link } from 'react-router-dom'

/**
 * Promo card for TerraThon 2026, on every public route.
 *
 * Deliberately self-contained: no import from `src/terrathon/*`. That whole
 * section is a lazy route group, and importing even its config from here would
 * pull those modules into the eagerly-loaded entry chunk, which is exactly the
 * regression the bundle budget exists to catch. The constants below are the
 * entire dependency, and the four stickers are plain files under
 * `public/terrathon/` so none of this reaches the JS graph either.
 *
 * It removes itself the day after the event rather than needing anyone to
 * remember: a dead "register now" bar on a finished event is worse than no bar.
 *
 * Rewritten 2026-09-21. It used to be a flat tomato strip running edge to edge,
 * which read as a cookie notice rather than as the event — it carried none of
 * the poster's language and nothing to look at. This is the poster: starfield
 * ground, the wordmark in a cream card inside a magenta outline, and the three
 * torn-paper sport stickers the campaign is actually printed with.
 */
const EVENT_ENDS = '2026-10-04'
const BASE = '/terrathon'

/** The poster palette. Local on purpose: none of these are AQ brand tokens. */
const SKY = '#05060A'
const PAPER = '#F2EFE3'
const GRASS = '#24CB7E'
const ORCHID = '#DD6CEE'

function hasEnded(now: Date): boolean {
  // Compare in IST. The card should survive the whole of the last day for
  // someone in Kolkata, not vanish at 05:30 local because the server is UTC.
  const ist = new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10)
  return ist > EVENT_ENDS
}

export default function TerraThonBanner() {
  if (hasEnded(new Date())) return null

  return (
    <aside
      aria-label="TerraThon 2026"
      style={{
        // Several AQ heroes carry `bleed-under-nav`, a negative top margin that
        // pulls the section up beneath the fixed nav — and, without this, up
        // over the banner too, hiding it completely on /about and friends. Its
        // inner sits at z-index 5, so this claims 6 and paints above the bleed.
        position: 'relative',
        zIndex: 6,
        padding: '14px 20px',
      }}
    >
      <Link to={BASE} className="tt-promo" aria-label="TerraThon 2026: three sports, 2 to 4 October, Kolkata. Sign up.">
        <span className="tt-promo__stars" aria-hidden="true" />

        {/* The lockup, as it is printed */}
        <span className="tt-promo__lockup">
          <span className="tt-promo__plate">
            <span className="tt-promo__word">
              TERRA<span className="tt-promo__word--b">THON</span>
            </span>
          </span>
          <span className="tt-promo__sub">THREE SPORTS. ONE WEEKEND.</span>
        </span>

        {/* The middle: what and when */}
        <span className="tt-promo__mid">
          <span className="tt-promo__dates">2&ndash;4 OCTOBER 2026 &middot; KOLKATA</span>
          <span className="tt-promo__blurb">
            Pickleball, cricket and FIFA. Every entry fee goes to AquaTerra&rsquo;s welfare work.
          </span>
        </span>

        {/* The stickers, overlapped the way they sit on the poster */}
        <span className="tt-promo__cast" aria-hidden="true">
          <img src="/terrathon/paddle-sm.webp" alt="" width={126} height={126} loading="lazy" decoding="async" style={{ transform: 'rotate(-9deg)' }} />
          <img src="/terrathon/cricket-sm.webp" alt="" width={126} height={126} loading="lazy" decoding="async" style={{ transform: 'rotate(7deg)', marginLeft: -26 }} />
          <img src="/terrathon/controller-sm.webp" alt="" width={126} height={126} loading="lazy" decoding="async" style={{ transform: 'rotate(-4deg)', marginLeft: -26 }} />
        </span>

        <span className="tt-promo__cta">
          GRAB A SLOT
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h13M12 5l7 7-7 7" />
          </svg>
        </span>

        <img src="/terrathon/star-sm.webp" alt="" width={54} height={54} loading="lazy" decoding="async" className="tt-promo__star" />
      </Link>

      <style>{`
        .tt-promo {
          position: relative;
          display: flex;
          align-items: center;
          gap: 26px;
          max-width: 1180px;
          margin: 0 auto;
          padding: 24px 28px;
          min-height: 184px;
          box-sizing: border-box;
          border: 3px solid ${ORCHID};
          border-radius: 32px;
          background-color: ${SKY};
          overflow: hidden;
          text-decoration: none;
          color: ${PAPER};
          transition-property: border-color, transform;
          transition-duration: 180ms;
          transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
        }
        .tt-promo:hover { border-color: ${GRASS}; }
        .tt-promo:active { transform: scale(0.99); }
        .tt-promo:focus-visible { outline: 3px solid ${GRASS}; outline-offset: 3px; }

        /* The starfield. Painted, not an image file, so it costs nothing. */
        .tt-promo__stars {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image:
            radial-gradient(1.5px 1.5px at 7% 22%, #fff 50%, transparent 51%),
            radial-gradient(1px 1px at 19% 68%, #cfd8e3 50%, transparent 51%),
            radial-gradient(1.5px 1.5px at 31% 14%, #fff 50%, transparent 51%),
            radial-gradient(1px 1px at 44% 81%, #b9c4d2 50%, transparent 51%),
            radial-gradient(1.5px 1.5px at 57% 33%, #fff 50%, transparent 51%),
            radial-gradient(1px 1px at 66% 72%, #cfd8e3 50%, transparent 51%),
            radial-gradient(1.5px 1.5px at 78% 19%, #fff 50%, transparent 51%),
            radial-gradient(1px 1px at 88% 58%, #b9c4d2 50%, transparent 51%),
            radial-gradient(1.5px 1.5px at 96% 86%, #fff 50%, transparent 51%);
        }

        .tt-promo__lockup { position: relative; flex: 0 0 auto; display: flex; flex-direction: column; gap: 9px; }
        .tt-promo__plate {
          display: inline-block;
          padding: 9px 16px 11px;
          border-radius: 16px;
          background: ${PAPER};
        }
        .tt-promo__word {
          display: block;
          font-family: 'NeutralFace', system-ui, sans-serif;
          font-weight: 700;
          /* 36px needs 230px; the plate is 202px at 320 and flush at 360. Scales down only on narrow phones. */
          font-size: clamp(28px, 9.6vw, 36px);
          line-height: 1;
          letter-spacing: -0.035em;
          text-transform: uppercase;
          color: #0A0A0A;
        }
        .tt-promo__word--b { color: #7A2B8A; }
        .tt-promo__sub {
          font-family: 'NeutralFace', system-ui, sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: ${GRASS};
        }

        .tt-promo__mid { position: relative; flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 7px; }
        .tt-promo__dates {
          font-family: 'NeutralFace', system-ui, sans-serif;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: ${PAPER};
        }
        .tt-promo__blurb { font-size: 13.5px; line-height: 1.45; color: rgba(242,239,227,0.78); }

        .tt-promo__cast { position: relative; flex: 0 0 auto; display: flex; align-items: center; }
        .tt-promo__cast img { display: block; width: 126px; height: 126px; object-fit: contain; }

        .tt-promo__cta {
          position: relative;
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 24px;
          min-height: 44px;
          box-sizing: border-box;
          border-radius: 999px;
          background: ${GRASS};
          color: #062B18;
          font-family: 'NeutralFace', system-ui, sans-serif;
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }

        .tt-promo__star { position: absolute; top: 12px; left: 236px; width: 50px; height: 50px; transform: rotate(-14deg); pointer-events: none; }

        /* The stickers are the first thing to go when the row gets tight:
           the wordmark, the dates and the call to action are what it is for. */
        @media (max-width: 1040px) {
          .tt-promo__cast img:nth-child(3) { display: none; }
          .tt-promo__star { display: none; }
        }
        @media (max-width: 880px) {
          .tt-promo { gap: 18px; }
          .tt-promo__cast { display: none; }
        }
        @media (max-width: 640px) {
          .tt-promo {
            flex-direction: column;
            align-items: stretch;
            gap: 16px;
            padding: 20px;
            border-radius: 26px;
          }
          .tt-promo__cta { justify-content: center; }
          .tt-promo__blurb { display: none; }
        }

        @media (prefers-reduced-motion: reduce) {
          .tt-promo { transition: none; }
          .tt-promo:active { transform: none; }
        }
      `}</style>
    </aside>
  )
}
