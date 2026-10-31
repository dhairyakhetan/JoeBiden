import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { EVENT, SPORT_COPY, CONTACTS, ASK_PHONE } from '../config'
import { SPORT_ORDER, type PublicEvent, type SportSlug } from '../lib/types'
import { rupees, dayRange, prettyPhone, waNumber, squadLabel } from '../lib/format'
import { SPORT_PHOTOS } from '../lib/photos'
import { SPORT_ACCENT } from '../components/SportIcons'
import { SportMark } from '../components/SportMarks'
import { Markdown } from '../components/Markdown'
import { WhatsAppMark } from '../components/BrandMarks'
import { TerraThonNotFound } from './NotFound'
import { fadeInUp } from '../../lib/motion'

interface Props {
  events: PublicEvent[]
  loading: boolean
  error: string | null
  reload: () => void
}

/** The sticker beside the sport name on the approved board. One file per sport. */
const SPORT_STICKER: Record<SportSlug, string> = {
  pickleball: '/terrathon/paddle.webp',
  cricket: '/terrathon/cricket.webp',
  fifa: '/terrathon/controller.webp',
}

function Fact({ label, value, hint, accent }: { label: string; value: React.ReactNode; hint?: string; accent?: boolean }) {
  // House rule 8: copy is never trimmed to fit. If a frozen string does not
  // fit its slab, the SLAB is the wrong size. An earlier pass did the opposite
  // and shrank this value to 15.5px so "Sat, 3 Oct + Sun, 4 Oct" would squeeze
  // into half a 375px screen, which is how a grid ends up with four different
  // type sizes in it. One size now, and the TRACK is sized to hold the longest
  // word (see the grid below), so nothing here needs a per-value escape hatch.
  return (
    <div
      className="tt-card"
      style={{
        padding: 'var(--tt-sp-5)',
        minWidth: 0,
        ...(accent
          ? { borderColor: 'var(--tt-go)', background: 'rgba(36, 203, 126, 0.1)' }
          : null),
      }}
    >
      <div
        className="tt-kick"
        style={{ fontSize: 'var(--tt-fs-meta)', letterSpacing: '0.14em', color: accent ? 'var(--tt-go-ink)' : 'var(--tt-muted)' }}
      >
        {label}
      </div>
      {/* No `.tt-num` here. These values are as often words as digits
          ("Confirming", "TBC", "Solo") and they are static, so a tabular digit
          column buys nothing and would drag the whole grid onto the mono face. */}
      <div
        className="tt-poster-line"
        style={{
          marginTop: 6,
          fontFamily: 'var(--tt-display)',
          fontSize: 25,
          lineHeight: 1.12,
          color: accent ? 'var(--tt-go)' : 'var(--tt-ink)',
          // NOT `anywhere`, which is what printed the venue as "CONFIR/MING".
          // `anywhere` lets a break fall between any two letters AND drops the
          // longest word out of the min-content width, so the box never
          // reports that it is too small; it just quietly mangles the word.
          // `break-word` only breaks a word that cannot fit a line of its own,
          // which after the track fix below should never happen; it stays as
          // the safety net for a venue name nobody has typed yet.
          overflowWrap: 'break-word',
        }}
      >
        {value}
      </div>
      {hint && <div style={{ marginTop: 5, fontSize: 'var(--tt-fs-meta)', lineHeight: 1.45, color: 'var(--tt-muted)' }}>{hint}</div>}
    </div>
  )
}

type TabKey = 'format' | 'who' | 'pool'

// The FAQ lives on the home page now, in one place. It answered the same
// questions on all three sport pages, which meant three copies to keep in
// step and three places for someone to find a different answer.

export function TerraThonSport({ events, loading, error, reload }: Props) {
  const { sport } = useParams<{ sport: string }>()
  const [tab, setTab] = useState<TabKey>('format')
  // Called unconditionally, ahead of this component's several early returns
  // below (rules of hooks) - the not-found/error/loading branches never
  // reach the "the other two" section this is actually for, but the hook
  // itself must still run on every render regardless of which branch wins.
  const reduce = useReducedMotion()

  // A real 404, not a bounce to the index. React Router ranks the ':sport'
  // route above '*', so every unknown one-segment URL under /terrathon lands
  // here and never reaches NotFoundPage, and a typo'd or stale link (exactly
  // what an Instagram bio produces) was silently redirecting to the home page
  // with no explanation that anything had gone wrong.
  if (!sport || !SPORT_ORDER.includes(sport as SportSlug)) {
    return <TerraThonNotFound />
  }
  const slug = sport as SportSlug

  if (error) {
    return (
      <div className="tt-wrap tt-page">
        <div className="tt-card" role="alert" style={{ borderColor: 'var(--tt-danger)' }}>
          <h1 style={{ fontSize: 28, color: 'var(--tt-danger)' }}>Couldn't load this sport</h1>
          <p style={{ margin: '8px 0 16px', color: 'var(--tt-muted)' }}>{error}</p>
          <button type="button" className="tt-btn tt-btn--ghost" onClick={reload}>Try again</button>
        </div>
      </div>
    )
  }

  const event = events.find((e) => e.slug === slug)

  if (loading && !event) {
    return (
      <div className="tt-wrap tt-page">
        <div className="tt-card" style={{ height: 300, opacity: 0.4 }} aria-hidden="true" />
        <span className="tt-sr" role="status">Loading</span>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="tt-wrap tt-page">
        <div className="tt-card">
          <h1 style={{ fontSize: 28 }}>Not running this year</h1>
          <p style={{ margin: '8px 0 16px', color: 'var(--tt-muted)' }}>
            That sport is not part of TerraThon 2026.
          </p>
          <Link to={EVENT.base} className="tt-btn tt-btn--ghost">See what is</Link>
        </div>
      </div>
    )
  }

  const copy = SPORT_COPY[slug]
  const accent = SPORT_ACCENT[slug]
  const photos = SPORT_PHOTOS[slug]
  const sportIndex = SPORT_ORDER.indexOf(slug) + 1
  const solo = event.team_size_max === 1
  const split = event.prize_split
  const ASK_CONTACT = CONTACTS.find((c) => c.phone === ASK_PHONE)
  const others = SPORT_ORDER.filter((s) => s !== slug)

  // squadLabel() gives "7 + 1"; this header prints the count on its own line
  // with the unit underneath, so it drops the trailing " players".
  const teamSizeValue = squadLabel(event).replace(/ players$/, '')
  const teamSizeHint = solo ? 'one player' : event.team_size_min === event.team_size_max ? 'players' : 'players plus substitute'

  // No paddingBottom on the root any more. It was a hand-rolled 96px reserve
  // for the sticky CTA, and terrathon.css now reserves the bar's real height
  // on .tt-content whenever one is rendered, so the two were stacking to
  // about 184px of dead space under every sport page.
  return (
    <div>
      {/* Genuinely missing from terrathon.css: a keyboard-operable tab pill
          and its panel cross-fade. Both primitives below (.tt-tabbar,
          .tt-tabbtn, .tt-tabpanel) are new and scoped to this file only;
          nothing in the class vocabulary above already does this job. */}
      <style>{`
        .tt-sport-tabbar {
          display: inline-flex;
          gap: 8px;
          padding: 6px;
          border-radius: var(--tt-r-pill);
          background: rgba(10, 10, 10, 0.07);
          max-width: 100%;
          overflow-x: auto;
        }
        .tt-sport-tabbtn {
          flex: 0 0 auto;
          border: 0;
          border-radius: var(--tt-r-pill);
          padding: 12px 20px;
          min-height: 44px;
          font-family: var(--tt-poster);
          font-size: 12.5px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          cursor: pointer;
          background: transparent;
          color: #3A3A38;
          transition: background-color 160ms cubic-bezier(0.2, 0, 0, 1), color 160ms cubic-bezier(0.2, 0, 0, 1);
        }
        .tt-sport-tabbtn[aria-selected="true"] {
          background: #0A0A0A;
          color: var(--tt-go);
        }
        .tt-sport-tabbtn:focus-visible {
          outline: 3px solid var(--tt-hot);
          outline-offset: 2px;
        }
        @keyframes tt-sport-panel { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .tt-sport-panel { animation: tt-sport-panel 320ms cubic-bezier(0.2, 0, 0, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          .tt-sport-tabbtn { transition-duration: 1ms; }
          .tt-sport-panel { animation: none; }
        }
      `}</style>

      {/* ── Photo band, then the title on the slab ───────────────────────────
          The sport name used to sit ON the scene under a dark scrim, coloured
          with that sport's own hue. Measured: Pickleball 1.36:1, FIFA 2.21,
          Cricket 2.88, the hue was landing on a scene filled with the same
          hue. Splitting them lets the picture be a picture and the title be
          legible, and it matches the register screen.

          The picture is now a real photograph of this sport at an AquaTerra
          session rather than the drawn StadiumScene. A drawing of a pitch is
          decoration; a captain deciding whether to enter wants to see the
          court they will actually be standing on. See lib/photos.ts. */}
      <header>
        {/* Wraps only the picture, not the slab below it, so `bottom: 0` on
            the timing bubble lands exactly on the picture/slab seam rather
            than on the bottom of the whole header. */}
        <div style={{ position: 'relative' }}>
          <img
            className="tt-photo"
            src={photos.hero}
            alt={photos.heroAlt}
            width={1600}
            height={900}
            /* Eager and high priority: this is the largest element above the
               fold, so it is the page's LCP. Lazy-loading it would delay the
               one paint the score is measured on. */
            loading="eager"
            fetchPriority="high"
            decoding="async"
            style={{
              display: 'block',
              width: '100%',
              height: '30vh',
              minHeight: 180,
              maxHeight: 280,
              objectFit: 'cover',
              borderBottom: '2px solid var(--tt-line)',
            }}
          />
          {/* The lemon timing bubble that used to straddle this seam is gone.
              It said the same thing as the "Report by" card in the fact strip
              one screen down, which also carries the match window, so the page
              stated one fact three ways in three treatments. The card is the
              source of truth and it is the one that stays. */}
        </div>
        <div className="tt-slab" style={{ borderBottom: '2px solid var(--ink, #0A0A0A)', position: 'relative', overflow: 'hidden' }}>
          {/* The sticker beside the name, matching the approved board: a
              flat-vector sport mark, large, rotated, floating clear of the
              reading column. Decorative, so it stays out of the tab order and
              carries no alt text; the header's h1 already names the sport. */}
          <img
            src={SPORT_STICKER[slug]}
            alt=""
            aria-hidden="true"
            width={96}
            height={96}
            loading="eager"
            decoding="async"
            style={{
              position: 'absolute',
              top: 18,
              right: 'var(--tt-sp-5)',
              width: 'clamp(56px, 9vw, 96px)',
              height: 'clamp(56px, 9vw, 96px)',
              objectFit: 'contain',
              transform: 'rotate(-14deg)',
              pointerEvents: 'none',
            }}
          />
          <div className="tt-wrap" style={{ paddingBlock: 'var(--tt-block)' }}>
            <div className="tt-kick" style={{ marginBottom: 8 }}>
              {EVENT.name} &middot; Sport {sportIndex} of {SPORT_ORDER.length}
            </div>
            <h1 className="tt-h1-poster" style={{ maxWidth: '82%' }}>
              {event.display_name}
            </h1>
            <div className="tt-poster-line" style={{ marginTop: 10, fontSize: 'clamp(16px, 2.6vw, 22px)', color: 'var(--tt-go)' }}>
              {copy.subtitle}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
              <span className="tt-chip" style={{ background: accent, color: '#0A0A0A' }}>
                {rupees(event.fee_inr)} {solo ? '/ player' : '/ team'}
              </span>
              <span className="tt-chip">{dayRange(event.day_first, event.day_last)}</span>
              {event.filling_fast && event.accepting && <span className="tt-chip tt-chip--hot">Filling fast</span>}
              {!event.accepting && <span className="tt-chip tt-chip--on">Registrations closed</span>}
            </div>
          </div>
        </div>
      </header>

      {/* `.tt-sec--top` (padding-block: var(--tt-section) 0, defined in
          terrathon.css) is what was missing here. The grid's own `gap`
          only spaces sections from EACH OTHER; it does nothing for the
          seam above the first one, so Key facts was sitting flush against
          the slab with zero space while every section below it got a full
          --tt-section gap. No bottom padding: .tt-content already reserves
          the sticky bar's height, and adding one here would stack a second
          reserve under the Contact section the way the old paddingBottom
          used to (see the comment above this component's return). */}
      <div className="tt-wrap tt-sec--top" style={{ display: 'grid', gap: 'var(--tt-section)' }}>
        {/* ── Key facts, four up ─────────────────────────────────────────────
            215px, not 160px, and the number is measured rather than picked.
            These values set in NeutralFace caps at 25px, which runs about
            0.70em per glyph, and "CONFIRMING" measures 171px. A 160px track
            minus the card's 2x20px padding leaves a 120px text column, so
            the longest realistic value missed by 50px and broke mid-word.
            171 + 40 of padding + slack is where 215 comes from. `min(100%,
            …)` keeps it honest at 320px, where one column is all that fits.

            No "Entry fee" and no "Date" card, same call as before: both are
            already on the screen twice over, in the hero's fee/date chips
            and again in the sticky CTA at the foot. Prize pool takes the
            board's green "happy number" treatment instead of Entry, since
            this strip does not carry a fee card to accent. */}
        <section>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 215px), 1fr))' }}>
            <Fact label="Team size" value={teamSizeValue} hint={teamSizeHint} />
            <Fact
              label="Prize pool"
              value={rupees(event.prize_pool_inr)}
              hint={split ? `${rupees(split.winner ?? null)} winner · ${rupees(split.runner_up ?? null)} runner-up` : undefined}
              accent
            />
            <Fact
              label="Venue"
              value={event.venue || 'Confirming'}
              hint={event.venue ? undefined : 'We will post it in the event group and here'}
            />
            <Fact
              label="Report by"
              value={event.report_time || 'TBC'}
              hint={event.match_window ? `Matches run ${event.match_window}. Carry your school or college ID` : 'Carry your school or college ID'}
            />
          </div>
          {event.venue_map_url && (
            <a href={event.venue_map_url} target="_blank" rel="noreferrer noopener" className="tt-btn tt-btn--quiet" style={{ marginTop: 12 }}>
              Open in Maps
            </a>
          )}
        </section>

        {/* ── The tabbed card ────────────────────────────────────────────────
            FORMAT / WHO CAN PLAY / PRIZE POOL, on the cream plate the board
            draws it on. Rules never get retyped: the FORMAT panel renders
            `event.rules_md` through Markdown when it exists, and falls back
            to the honest "being finalised" copy when it does not, same as
            the standalone Rules section used to. Eligibility is the one
            genuinely global fact TerraThon has (born on/after 1 Jan 2005,
            re-checked server-side by terrathon_register), so that panel is
            the same for all three sports by construction, not by omission. */}
        <section className="tt-plate">
          <div role="tablist" aria-label={`${event.display_name} details`} className="tt-sport-tabbar">
            <button
              type="button"
              role="tab"
              id="tt-sport-tab-format"
              aria-selected={tab === 'format'}
              aria-controls="tt-sport-panel-format"
              tabIndex={tab === 'format' ? 0 : -1}
              className="tt-sport-tabbtn"
              onClick={() => setTab('format')}
            >
              Format
            </button>
            <button
              type="button"
              role="tab"
              id="tt-sport-tab-who"
              aria-selected={tab === 'who'}
              aria-controls="tt-sport-panel-who"
              tabIndex={tab === 'who' ? 0 : -1}
              className="tt-sport-tabbtn"
              onClick={() => setTab('who')}
            >
              Who can play
            </button>
            <button
              type="button"
              role="tab"
              id="tt-sport-tab-pool"
              aria-selected={tab === 'pool'}
              aria-controls="tt-sport-panel-pool"
              tabIndex={tab === 'pool' ? 0 : -1}
              className="tt-sport-tabbtn"
              onClick={() => setTab('pool')}
            >
              Prize pool
            </button>
          </div>

          {tab === 'format' && (
            <div role="tabpanel" id="tt-sport-panel-format" aria-labelledby="tt-sport-tab-format" className="tt-sport-panel" style={{ marginTop: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <SportMark sport={slug} size={24} />
                <h2 style={{ fontSize: 22, textTransform: 'uppercase' }}>What you're registering for</h2>
              </div>
              <p style={{ margin: '0 0 16px', fontSize: 'var(--tt-fs-body)', lineHeight: 1.7 }}>{copy.vibe}</p>
              {event.rules_md ? (
                <Markdown source={event.rules_md} />
              ) : (
                // Honest placeholder. Saying "no rules" would be false, and a
                // blank panel reads as a broken page.
                <div style={{ paddingTop: 14, borderTop: '1px solid var(--tt-hairline)' }}>
                  <h3 style={{ fontSize: 18 }}>Being finalised</h3>
                  <p style={{ margin: '8px 0 0', fontSize: 'var(--tt-fs-body)', lineHeight: 1.65, color: 'var(--tt-muted)' }}>
                    The full rules, eligibility and match format go up here before registrations close,
                    and are read out at the venue on the day. Message us if you need a specific answer
                    before then.
                  </p>
                </div>
              )}
              <div className="tt-oncream-dark" style={{ marginTop: 16, padding: '14px 18px', fontSize: 'var(--tt-fs-body)' }}>
                The umpire's and referee's decisions are final. No appeals.
              </div>
            </div>
          )}

          {tab === 'who' && (
            <div role="tabpanel" id="tt-sport-panel-who" aria-labelledby="tt-sport-tab-who" className="tt-sport-panel" style={{ marginTop: 28 }}>
              <div className="tt-h2-poster">Born on or after 1 January 2005.</div>
              <p style={{ marginTop: 14, maxWidth: 640, fontSize: 'var(--tt-fs-lead)', lineHeight: 1.6, color: 'var(--tt-muted)' }}>
                {solo
                  ? 'This has to be true for you, and we check it when you register and again at the gate.'
                  : 'Every member of your team has to meet this, not just the captain. We ask for a date of birth when you register and check IDs at the gate, so a squad that does not clear it will not get on the court.'}
              </p>
              <div style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ padding: '14px 20px', borderRadius: 'var(--tt-r-in)', background: 'rgba(122,43,138,0.1)' }}>
                  <span className="tt-kick" style={{ color: 'var(--tt-hot)', fontSize: 12 }}>Bring</span>
                  <div style={{ marginTop: 4, fontSize: 15 }}>School or college ID</div>
                </div>
                <div style={{ padding: '14px 20px', borderRadius: 'var(--tt-r-in)', background: 'rgba(122,43,138,0.1)' }}>
                  <span className="tt-kick" style={{ color: 'var(--tt-hot)', fontSize: 12 }}>Bring</span>
                  <div style={{ marginTop: 4, fontSize: 15 }}>Your entry confirmation</div>
                </div>
              </div>
            </div>
          )}

          {tab === 'pool' && (
            <div
              role="tabpanel"
              id="tt-sport-panel-pool"
              aria-labelledby="tt-sport-tab-pool"
              className="tt-sport-panel"
              style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 40, flexWrap: 'wrap' }}
            >
              <div>
                <div className="tt-kick" style={{ color: 'var(--tt-hot)' }}>Total pool</div>
                <div
                  className="tt-code"
                  style={{ fontFamily: 'var(--tt-display)', fontSize: 'clamp(48px, 7vw, 88px)', lineHeight: 1, letterSpacing: '-0.04em', color: 'var(--tt-hot)' }}
                >
                  {rupees(event.prize_pool_inr)}
                </div>
              </div>
              <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
                <div className="tt-oncream-dark" style={{ display: 'flex', alignItems: 'baseline', gap: 16, padding: '16px 22px' }}>
                  <span className="tt-poster-line" style={{ fontSize: 'var(--tt-fs-body)', color: 'var(--tt-go)' }}>Winner</span>
                  <span style={{ flexGrow: 1, height: 1, background: 'rgba(242,239,227,0.25)' }} />
                  <span className="tt-code" style={{ fontSize: 28, fontWeight: 700 }}>{rupees(split?.winner ?? null)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, padding: '16px 22px', borderRadius: 'var(--tt-r)', border: '3px solid rgba(10,10,10,0.16)' }}>
                  <span className="tt-poster-line" style={{ fontSize: 'var(--tt-fs-body)', color: 'var(--tt-hot)' }}>Runners up</span>
                  <span style={{ flexGrow: 1, height: 1, background: 'rgba(10,10,10,0.18)' }} />
                  <span className="tt-code" style={{ fontSize: 28, fontWeight: 700 }}>{rupees(split?.runner_up ?? null)}</span>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 14.5, lineHeight: 1.55, color: 'var(--tt-muted)' }}>
                  Prize money comes out of the pool. What is left over after the pool and the venue goes
                  to AquaTerra's welfare work, which is the whole point of the weekend.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* ── Register ───────────────────────────────────────────────────────
            The biggest call to action in the page body (the `.tt-sticky` bar
            at the foot stays separate; this is the one a captain reaches by
            reading, not by having the page follow them down). Reuses `.tt-btn`
            at a larger size via inline padding/font-size rather than a new
            class, same way `.tt-btn--poster` already does it above the fold
            elsewhere in this section. Gated on `event.accepting` for the same
            reason the sticky bar is: once entries close there is nothing here
            to click through to. */}
        {event.accepting && (
          <section style={{ display: 'grid', justifyItems: 'center', textAlign: 'center' }}>
            <Link
              to={`${EVENT.base}/register/${slug}`}
              className="tt-btn"
              style={{ fontSize: 20, padding: '0 var(--tt-sp-8)', minHeight: 64, width: '100%', maxWidth: 420 }}
            >
              Register Now
            </Link>
          </section>
        )}

        {/* ── Contact ────────────────────────────────────────────────────────
            One person, not a row of them. Every sport page's question goes to
            the same number so nobody has to guess who owns which sport. */}
        {ASK_CONTACT && (
          <section>
            <h2 style={{ fontSize: 26, textTransform: 'uppercase', marginBottom: 12 }}>Ask about {event.display_name}</h2>
            <a
              href={`https://wa.me/${waNumber(ASK_PHONE)}?text=${encodeURIComponent(`Hi, a question about TerraThon ${event.display_name}: `)}`}
              target="_blank"
              rel="noreferrer noopener"
              className="tt-btn"
            >
              <WhatsAppMark />
              WhatsApp {ASK_CONTACT.name.split(' ')[0]} &middot; {prettyPhone(ASK_PHONE)}
            </a>
          </section>
        )}

        {/* ── The other two ─────────────────────────────────────────────────
            Matches the board's closing block: the two sports this page is
            not, each linking to its own page (not the shared home page),
            since that is the actual next step for someone who lands here
            for the wrong sport. */}
        <section>
          <div className="tt-kick">The other two</div>
          <div style={{ marginTop: 14, display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))' }}>
            {others.map((s, i) => {
              const otherEvent = events.find((e) => e.slug === s)
              return (
                <motion.div
                  key={s}
                  initial={reduce ? false : fadeInUp.hidden}
                  whileInView={fadeInUp.visible}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.28, ease: [0.2, 0, 0, 1], delay: reduce ? 0 : i * 0.06 }}
                >
                <Link
                  to={`${EVENT.base}/${s}`}
                  className="tt-card"
                  style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', textDecoration: 'none', color: 'var(--tt-ink)' }}
                >
                  <img src={SPORT_STICKER[s]} alt="" aria-hidden="true" width={54} height={54} style={{ width: 54, height: 54, objectFit: 'contain', flexShrink: 0 }} />
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <div className="tt-poster-line" style={{ fontSize: 20 }}>{otherEvent?.display_name ?? SPORT_COPY[s].subtitle}</div>
                    <div style={{ marginTop: 4, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--tt-go)' }}>
                      {otherEvent ? `${dayRange(otherEvent.day_first, otherEvent.day_last)} · ${rupees(otherEvent.fee_inr)}` : 'See details'}
                    </div>
                  </div>
                  {/* flexShrink: 0. A glyph this size has no useful narrower state, and the
                      section-wide `.tt-card > * { min-width: 0 }` rule, which exists so a
                      card can collapse below its own min-content, would otherwise squeeze
                      it into a 16px box and clip the head off the arrow. */}
                  <span aria-hidden="true" style={{ fontSize: 22, color: 'var(--tt-hot)', flexShrink: 0 }}>&rarr;</span>
                </Link>
                </motion.div>
              )
            })}
          </div>
        </section>
      </div>

      {/* Sticky mobile CTA, priced so the commitment is never a surprise. */}
      {event.accepting && (
        <div className="tt-sticky">
          <Link to={`${EVENT.base}/register/${slug}`} className="tt-btn" style={{ width: '100%' }}>
            {/* Short enough to stay on one line in a full-width bar at 320px.
                "Register your team for ₹2,400" wrapped to two and the bar
                looked broken on every phone. */}
            {solo ? `Enter · ${rupees(event.fee_inr)}` : `Enter a team · ${rupees(event.fee_inr)}`}
          </Link>
        </div>
      )}
    </div>
  )
}
