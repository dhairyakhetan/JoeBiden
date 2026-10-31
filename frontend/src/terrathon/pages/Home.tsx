import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { EVENT, PARTNERS } from '../config'
import { SPORT_ORDER, type PublicEvent } from '../lib/types'
import { useServerOffset } from '../lib/hooks'
import { dayRange, rupees } from '../lib/format'
import { Wordmark } from '../components/Wordmark'
import { LiveCountdown } from '../components/Countdown'
import { SportCard } from '../components/SportCard'
import { SportMark } from '../components/SportMarks'
import { sized } from '../../lib/imageUrl'
import { fadeInUp } from '../../lib/motion'
import { TerraThonFaq } from '../components/Faq'
import { StarStickers } from '../components/StarStickers'
import { SPORT_PHOTOS } from '../lib/photos'

interface Props {
  events: PublicEvent[]
  loading: boolean
  error: string | null
  reload: () => void
}

/** The four steps, drawn rather than described. Show, don't tell. */
const STEPS: Array<{ n: string; title: string; body: string; fill: string }> = [
  // One hue for all four. The board sets every numeral in orchid on the cream
  // plate; four different fills made a numbered sequence look like a colour
  // key to categories that do not exist, and two of them were off palette.
  // An explicit hex, not var(--tt-hot). These badges sit inside .tt-plate,
  // which redefines --tt-hot to the DARK orchid because on a cream surface
  // that is the readable one for TEXT. This value is a FILL with an ink
  // numeral on top, so it needs the bright orchid regardless of which surface
  // it lands on. Reading the token gave ink on dark orchid at 2.39:1.
  { n: '01', title: 'Register', body: 'Name, date of birth, contact number and sport. Under a minute, and no team list needed.', fill: '#DD6CEE' },
  { n: '02', title: 'We reach out', body: 'Our team messages you on WhatsApp within 24 hours with the payment QR code.', fill: '#DD6CEE' },
  { n: '03', title: 'Pay', body: 'Pay the QR we send you. We confirm you by hand once it lands.', fill: '#DD6CEE' },
  { n: '04', title: 'Play', body: 'Your QR entry pass comes back on the same thread. Show it at the gate.', fill: '#DD6CEE' },
]

export function TerraThonHome({ events, loading, error, reload }: Props) {
  const offset = useServerOffset()
  const reduce = useReducedMotion()

  const ordered = SPORT_ORDER
    .map((s) => events.find((e) => e.slug === s))
    .filter(Boolean) as PublicEvent[]

  // Added up from the live rows, never typed in: a prize total written by hand
  // is the first number to go stale when one sport's pool changes.
  const prizeTotal = ordered.reduce((n, e) => n + (e.prize_pool_inr ?? 0), 0)

  const days = [...ordered]
    .filter((e) => e.day_first)
    .sort((a, b) => (a.day_first as string).localeCompare(b.day_first as string))

  // The hero's dates come from the same rows `days` is built from, not a
  // literal. "Friday to Sunday, 2 to 4 October" used to be typed directly into
  // the poster markup, which is exactly the kind of fact this codebase has
  // been burned by before (see the fundraiser-is-over guard below): correct
  // this year, silently wrong the next, with nothing to catch it. `null` when
  // no event has a `day_first` yet, so the headline can be skipped rather than
  // showing a made-up range while the fetch is loading or failed.
  const heroDateRange = (() => {
    if (days.length === 0) return null
    const first = new Date(days[0].day_first as string)
    const lastIso = days.reduce((max, e) => {
      const end = (e.day_last || e.day_first) as string
      return end > max ? end : max
    }, days[0].day_first as string)
    const last = new Date(lastIso)
    const tz = { timeZone: 'Asia/Kolkata' } as const
    const weekdayFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'long', ...tz })
    const dayFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', ...tz })
    const monthFmt = new Intl.DateTimeFormat('en-IN', { month: 'long', ...tz })
    const sameDay = first.getTime() === last.getTime()
    return {
      weekdays: sameDay ? weekdayFmt.format(first) : `${weekdayFmt.format(first)} to ${weekdayFmt.format(last)}`,
      dates: sameDay
        ? `${dayFmt.format(first)} ${monthFmt.format(first)}`
        : `${dayFmt.format(first)} to ${dayFmt.format(last)} ${monthFmt.format(last)}`,
    }
  })()

  // The hero CTA always points at /terrathon/register, so its label must not
  // say otherwise. `ordered` is empty until the fetch lands, which made
  // `anyOpen` false for that window and put "See the sports" on a button that
  // goes to the sign-up form, caught on a cold load, where the wrong label is
  // visible for as long as the request takes. Only claim nothing is open once
  // the data is actually in and actually says so.
  const anyOpen = ordered.some((e) => e.accepting)
  const knownAllClosed = !loading && ordered.length > 0 && !anyOpen

  return (
    <div>
      {/* ═══ THE POSTER ═════════════════════════════════════════════════════
          One picture, the name over it, two lines of facts and a single ask.
          This replaced a stack of six text blocks (chips, wordmark, tagline,
          paragraph, two buttons, countdown card), which is why the old hero
          read as a list rather than an invitation. The clock sits inside this
          same slab: the house rule is at most two ink sections per screen, and
          giving the countdown a band of its own made five. */}
      <section className="tt-slab" style={{ borderBottom: '2px solid var(--ink, #0A0A0A)' }}>
        <div className="tt-wrap tt-hero-stage" style={{ paddingBlock: 'var(--tt-sp-3)', position: 'relative', isolation: 'isolate' }}>

          {/* Blue star stickers, decoration only: absolutely positioned over
              the stage, aria-hidden and pointer-events: none so they never sit
              over the plate's text or steal a click meant for the CTAs.
              The positions that used to live here moved into StarStickers
              unchanged, so the inner pages can wear the same punctuation
              instead of this being the only page that does. */}
          <StarStickers variant="hero" />

          {/* A plain div, deliberately. This used to be a motion.div running
              `fadeInUp` on mount, and it is the one element on the site that
              must never do that: it is the hero, it is above the fold, and it
              is the first thing painted. Reveal-on-scroll is for things below
              the fold; the cards further down still use it. */}
          {/* Left aligned, not centred. The approved design sets the lockup
              hard against the gutter with the supporting lines stacked under
              it; centring everything was what made this read as a recoloured
              version of the old page rather than the poster. */}
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'left', paddingBlock: 'clamp(24px, 5vw, 64px)' }}>
            {/* .tt-kick, the shared "what kind of block is this" line, rather
                than a fourth hand-rolled kicker style on this page alone. */}
            <span className="tt-kick" style={{ marginBottom: 'clamp(14px, 2vw, 26px)' }}>
              Team AquaTerra presents
            </span>
            {/* The cream plate lockup: a cream panel inside a thick orchid
                border. Two nested boxes because the border and the fill need
                different radii to read as one thick ring rather than a single
                stroke.

                32 outer / 22 inner, not 34 / 26. Two reasons, and the second
                is why it was worth touching a hero that already looked fine.
                First, 34 and 26 are not on the AQ radius scale, which is
                999 / 32 / 22 / 14 and has exactly three documented exceptions
                elsewhere in the repo; a rendered sweep of this page reported
                SIX distinct radii because of these two. Second, concentricity
                is outer minus inset equals inner, and the inset here was a
                clamp running 6 to 10px against a fixed 8px difference, so the
                ring was only truly concentric at one viewport width. 32 - 10
                = 22 with a flat 10px inset is correct at every width. */}
            <div
              style={{
                display: 'inline-block',
                maxWidth: 980,
                width: '100%',
                padding: 10,
                borderRadius: 32,
                border: '3px solid var(--tt-hot, #DD6CEE)',
                background: 'rgba(221, 108, 238, 0.06)',
              }}
            >
              {/* .tt-oncream is the token half of .tt-plate without its box,
                  because this panel draws its own. Without it the wordmark's
                  year set in --tt-danger, which the palette flip LIGHTENED for
                  the night ground, and measured 2.0:1 on this cream. */}
              <div
                className="tt-oncream"
                style={{
                  borderRadius: 22,
                  /* An explicit hex, NOT var(--ink). .tt-oncream on this same
                     element redefines --ink to #0A0A0A so the wordmark inside
                     comes out dark, and a custom property resolves at the point
                     of use, so reading --ink here picks up that NEW value. It
                     painted a black panel and then black letters on it: 1:1,
                     the mark gone. Same trap .tt-slab and .tt-plate both carry
                     a warning about. */
                  background: '#F2EFE3',
                  padding: 'clamp(16px, 5vw, 40px) clamp(12px, 4vw, 32px)',
                }}
              >
                {/* `flat`: no drop shadow and no year. The board's lockup is a
                    solid mark in a cream card, and the coloured offset under it
                    read as a double print. The year lives on the nav, which is
                    where the board puts it.

                    10.2vw, down from 11.6 and up from the original 9.4. The
                    board sets the mark at 152 on a 1440 canvas, about 10.6% of
                    the width. 9.4 made the hero read as a page heading rather
                    than a poster, but 11.6 overshot in the other direction and
                    was measured overflowing: at a 445px viewport the nine
                    glyphs wanted 282px inside a 265px card, so the final N sat
                    flush on the orchid outline. The card's padding is fixed
                    while the mark is proportional, so this got WORSE the
                    narrower the phone, on every phone width, not just one.

                    10.2 is the largest value that leaves the mark clear of the
                    border, verified by diffing scrollWidth against clientWidth
                    at 320, 390 and 445. Re-measure the same way if this moves
                    again; the poster's own ratio does not survive the padding. */}
                <Wordmark as="h1" tone="paper" flat size={132} style={{ fontSize: 'clamp(33px, 10.2vw, 132px)' }} />
                {/* Inside the card, as the board draws it. It used to sit on
                    the night ground below the card, which split one object into
                    two. */}
                <div
                  className="tt-poster-line"
                  style={{
                    marginTop: 'clamp(8px, 1.4vw, 16px)',
                    fontSize: 'clamp(var(--tt-fs-meta), 2.1vw, 30px)',
                    color: '#0A0A0A',
                  }}
                >
                  Three sports. One weekend.
                </div>
              </div>
            </div>

            {/* The dates, loud, right under the lockup. Still derived from
                `days`, not typed in here. See the comment above
                `heroDateRange`. Renders nothing while the data has not
                loaded, rather than a made-up range. */}
            {heroDateRange && (
              <div
                style={{
                  marginTop: 10,
                  fontFamily: 'var(--tt-display)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  lineHeight: 1.08,
                  fontSize: 'clamp(24px, 5.6vw, 40px)',
                  color: 'var(--tt-ink)',
                }}
              >
                {heroDateRange.dates}
                <span className="tt-code" style={{ display: 'block', fontSize: 'clamp(13px, 1.4vw, 17px)', fontWeight: 400, marginTop: 6, textTransform: 'none', color: 'var(--tt-ink-3)' }}>
                  {heroDateRange.weekdays} &middot; Kolkata
                </span>
              </div>
            )}

            <p
              style={{
                /* Flush left, not `auto`. Everything in this stack shares the
                   gutter edge; centring this one block left it hanging in from
                   the lockup above and the buttons below. */
                margin: '18px 0 0',
                maxWidth: 520,
                fontSize: 'clamp(var(--tt-fs-body), 1.5vw, var(--tt-fs-lead))',
                lineHeight: 1.6,
                color: 'var(--tt-ink-2)',
              }}
            >
              A weekend tournament run by Team AquaTerra across three sports. One
              registration per team, and you do not need your team list to register.
            </p>

            <div style={{ marginTop: 'clamp(20px, 2.6vw, 30px)', display: 'flex', gap: 12, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
              {/* The primary CTA always points at /terrathon/register, so its
                  label must not promise an open slot once every sport has
                  genuinely closed (not merely "not loaded yet", see
                  `knownAllClosed` above). */}
              <Link to={`${EVENT.base}/register`} className="tt-btn">
                {knownAllClosed ? 'Join the waitlist' : 'Grab a slot'}
              </Link>
              <a href="#sports" className="tt-btn tt-btn--quiet">
                See the sports
              </a>
            </div>
          </div>

          {/* The clock, inside the poster's own slab rather than a band of its
              own. One ink section, not two. */}
          {/* The board, at full size and centred.
              It was the largest object on the screen for a while, on the
              reasoning that "when" is the question a countdown answers. The
              approved poster design puts the lockup first and everything else
              in support of it, and a flip board bigger than the wordmark read
              as a dashboard bolted under a poster. Same component, same guard,
              supporting size, left aligned with the rest of the stack. */}
          <div style={{ marginTop: 'clamp(22px, 3vw, 38px)' }}>
            {/* Loading and "genuinely no events" are not the same state.
                `resolveCountdown` (lib/countdown.ts) falls back to an "over"
                message when it finds no row with a `day_first`, which is
                correct once the feed has actually loaded and come back
                empty, but `usePublicEvents` starts `events` at `[]`, so
                calling this on every render told every visitor on every
                cold load, and permanently on a failed fetch, that the
                fundraiser was already done. A neutral skeleton here, matched
                to the one the sports grid already uses below, replaces that
                until there is real data to read. */}
            {loading || error ? (
              <div className="tt-card" style={{ height: 96, opacity: 0.4 }} aria-hidden="true" />
            ) : (
              <LiveCountdown events={events} offset={offset} size="sm" tone="ink" />
            )}
          </div>

          {/* The sport chip rail is gone. It linked to the same three sports
              whose cards are the very next section, so it was a duplicate of
              the thing it sat directly above. The approved design goes
              straight from the lockup to the cards. */}
        </div>
      </section>

      {/* ═══ (the marquee that used to sit here is gone) ════════════════════
          ──────────────────────────────────────────────────────────────────
          It scrolled "Cricket · Pickleball · FIFA · 2 to 4 Oct" on a 26s
          infinite loop, two tracks of six repeats, and it sat between the chip
          rail (which lists all three sports and the dates) and the listing,
          which shows all three as cards. It carried nothing the reader did not
          already have twice.

          What it cost: each sport name appeared 15 times on this page, 12 of
          them from this band. It was also the last perpetual animation left
          after the hero's ball loops were stopped, so it was the only thing on
          the page permanently asking for attention while someone tried to read
          a price. The slab below already ends on a 2px ink rule, so the edge
          between the dark hero and the paper listing survives without it. */}

      {/* ═══ SOLUTION: the three sports ═════════════════════════════════════
          On ink, not paper. This is the page's most important section and it
          was its most timid: cream cards on a cream ground, with nothing to
          push against. The band also breaks up a run of four identical cream
          sections, so the page now alternates ground instead of scrolling as
          one long sheet. */}
      {/* 64, the measured height of the sticky header. At 62 the heading's
          cap-line sat 2px under it when the nav's "Sports" link jumped here. */}
      <section id="sports" className="tt-sec" style={{ scrollMarginTop: 64 }}>
        <div className="tt-wrap">
        {/* No kicker here, and no longer the exception: the three that used
            to sit above the other section heads have gone with it.
            The reference this section's cards are built from runs a plain
            uppercase head and nothing else, and a kicker above a listing is
            decoration where the cards are already doing the talking. The note
            stays because it carries information: "no team list needed" is the
            actual objection someone has at exactly this point. */}
        {/* `.tt-headrow`, not a bare flex row with `margin-left: auto`. The
            note is pinned to the right of the heading, which works while the
            two share a line, but "The sports" alone measures 263px of a
            375px phone, so the note wrapped to a line of its own AND KEPT the
            auto margin, landing as a right-aligned, two-line, rotated
            fragment floating in the gap above the cards. It read as a
            leftover, not an annotation. The class drops the rotation and the
            auto margin once it can no longer sit beside the heading. */}
        <div className="tt-headrow" style={{ marginBottom: 'var(--tt-block)' }}>
          <h2 className="tt-h2-poster">Pick your sport</h2>
          {/* Green, not tomato. --tomato-ink is the section's lightened red and
              read as a salmon fragment beside the heading; the poster puts its
              meta lines in the torn-paper green. Copy trimmed too: "sign up"
              was renamed to "register" everywhere else today. */}
          <span className="tt-note" style={{ color: 'var(--tt-go)' }}>
            no team list needed
          </span>
        </div>

        {error ? (
          // Never a cheerful empty state after a failure. "No sports yet" when
          // the fetch died is this codebase's most repeated real bug.
          <div className="tt-card" role="alert" style={{ boxShadow: '5px 5px 0 0 var(--tomato, #FF4D2E)' }}>
            <h3 style={{ fontSize: 24 }}>Couldn't load the sports</h3>
            <p style={{ margin: '10px 0 18px', color: 'var(--ink-2, #2A2A28)', fontSize: 'var(--tt-fs-body)' }}>{error}</p>
            <button type="button" className="tt-btn tt-btn--plain" onClick={reload}>Try again</button>
          </div>
        ) : loading ? (
          <div className="tt-sports-grid">
            {[0, 1, 2].map((i) => (
              <div key={i} className="tt-card" style={{ height: 460, opacity: 0.4 }} aria-hidden="true" />
            ))}
            <span className="tt-sr" role="status">Loading sports</span>
          </div>
        ) : ordered.length === 0 ? (
          <div className="tt-card">
            <h3 style={{ fontSize: 24 }}>Nothing is open yet</h3>
            <p style={{ margin: '10px 0 0', color: 'var(--ink-2, #2A2A28)', fontSize: 'var(--tt-fs-body)' }}>
              Sports appear here the moment they open. The Instagram gets the announcement first.
            </p>
          </div>
        ) : (
          <div className="tt-sports-grid">
            {ordered.map((e, i) => <SportCard key={e.slug} event={e} index={i} />)}
          </div>
        )}
        </div>
      </section>

      {/* ═══ PROOF RAIL: real photographs ══════════════════════════════════
          Not illustration. These are AquaTerra's own sessions, one hero and
          two rail shots per sport that is currently open, straight from
          SPORT_PHOTOS. Every image is lazy-loaded (the hero used elsewhere on
          the page is the only thing above the fold; these are below it) and
          carries its real alt text, with width/height set so nothing shifts
          as they load in. */}
      {ordered.length > 0 && (
        <section className="tt-wrap tt-sec--top">
          <h2 className="tt-h2-poster" style={{ marginTop: 10, marginBottom: 8 }}>From our own sessions</h2>
          <p style={{ margin: '0 0 var(--tt-block)', maxWidth: 560, fontSize: 'var(--tt-fs-body)', lineHeight: 1.65, color: 'var(--ink-2, #2A2A28)' }}>
            Every photo below is AquaTerra's own, shot at our own sessions. Nothing here is stock.
          </p>

          <div className="tt-photo-grid">
            {ordered.map((e) => {
              const photos = SPORT_PHOTOS[e.slug]
              if (!photos) return null
              return (
                <div key={e.slug} className="tt-photo-grid__group">
                  <img
                    className="tt-photo"
                    src={photos.hero}
                    alt={photos.heroAlt}
                    width={1600}
                    height={900}
                    loading="lazy"
                    decoding="async"
                    style={{ width: '100%', height: 'auto', display: 'block', border: '3px solid var(--tt-line)', borderRadius: 'var(--tt-r)' }}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                    {photos.shots.map((shot, i) => (
                      <img
                        className="tt-photo"
                        key={shot}
                        src={shot}
                        alt={photos.shotAlts[i]}
                        width={800}
                        height={600}
                        loading="lazy"
                        decoding="async"
                        style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 14, border: '2px solid var(--tt-line)' }}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ═══ HOW IT WORKS ═══════════════════════════════════════════════════
          Four panels, not four paragraphs. Each carries its number as the
          graphic, so the sequence reads before any of the copy does. On a
          cream plate (.tt-plate) so it reads as a different surface from
          the dark ground the rest of the page sits on. */}
      <section className="tt-wrap tt-sec--top">
        <div className="tt-plate" style={{ padding: 'clamp(20px, 4vw, 36px)' }}>
        {/* No eyebrow. "How it works" is the heading; "From tap to court"
            said the same thing one size smaller, which is decoration standing
            where hierarchy already works. */}
        <h2 className="tt-h2-poster" style={{ marginTop: 10, marginBottom: 8 }}>How it works</h2>
        <p style={{ margin: '0 0 var(--tt-block)', maxWidth: 560, fontSize: 'var(--tt-fs-body)', lineHeight: 1.65, color: 'var(--ink-2, #2A2A28)' }}>
          Four steps, and only the first one happens on this website.
        </p>

        <ol className="tt-steps">
          {STEPS.map((s, i) => (
            <motion.li
              key={s.n}
              className="tt-card"
              initial={reduce ? false : fadeInUp.hidden}
              whileInView={fadeInUp.visible}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.28, ease: [0.2, 0, 0, 1], delay: reduce ? 0 : i * 0.06 }}
              style={{ padding: 0, overflow: 'hidden', listStyle: 'none' }}
            >
              <div
                style={{
                  background: s.fill,
                  borderBottom: '2px solid var(--ink, #0A0A0A)',
                  padding: '14px 18px',
                  fontFamily: 'var(--tt-code)',
                  fontSize: 34,
                  lineHeight: 1,
                  color: '#0A0A0A',
                }}
              >
                {s.n}
              </div>
              <div style={{ padding: '16px 18px 20px' }}>
                <h3 style={{ fontSize: 22 }}>{s.title}</h3>
                <p style={{ margin: '8px 0 0', fontSize: 'var(--tt-fs-body)', lineHeight: 1.6, color: 'var(--ink-2, #2A2A28)' }}>{s.body}</p>
              </div>
            </motion.li>
          ))}
        </ol>

        {/* The one thing every applicant needs to hear before they pay: a
            submitted form is not a confirmed slot. Dark, deliberately, so it
            reads as a warning rather than another step. */}
        <div
          style={{
            marginTop: 'var(--tt-block)',
            /* No --tt-card and no --bg here. This block sits INSIDE .tt-plate,
               which flips --tt-card to white and leaves --bg cream, so the pair
               painted cream type on a white box at 1.15:1. .tt-oncream-dark
               states both colours outright for exactly this reason. */
            padding: '16px 20px',
            fontSize: 'var(--tt-fs-body)',
            lineHeight: 1.6,
          }}
          className="tt-oncream-dark"
        >
          <strong>Your slot is confirmed once payment is made and we confirm it, not when the form is submitted.</strong>
        </div>
        </div>
      </section>

      {/* ═══ The three days, as ticket stubs ════════════════════════════════ */}
      {days.length > 0 && (
        <section className="tt-wrap tt-sec--top">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 'var(--tt-block)' }}>
            <div>
              {/* No eyebrow: the chip rail, the stubs below and the dates in
                  the poster all already say three days. */}
              <h2 className="tt-h2-poster" style={{ marginTop: 10 }}>The weekend</h2>
            </div>
            <Link to={`${EVENT.base}/schedule`} className="tt-btn tt-btn--plain" style={{ marginLeft: 'auto' }}>
              Full schedule
            </Link>
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            {days.map((e) => (
              <Link key={e.slug} to={`${EVENT.base}/${e.slug}`} className="tt-ticket" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="tt-ticket__stub">
                  <SportMark sport={e.slug} size={26} />
                  <span className="tt-code" style={{ fontSize: 'var(--tt-fs-meta)', marginTop: 6 }}>
                    {dayRange(e.day_first, e.day_last)}
                  </span>
                </div>
                {/* The price shares the TITLE's line, not the whole block's.
                    It used to sit in a second flex column beside a stack of
                    {title + venue}, which meant the title column's width was
                    set by the longer of the two lines (the venue) and then
                    shrank against the price. At 375px that left it 156px while
                    "PICKLEBALL" measures 165px in NeutralFace caps at 26px, so
                    the title overran its own box by 9px, closed the 14px gap
                    and printed as "PICKLEBALL₹750". Nothing reported an
                    overflow, because the box was the right size for the venue
                    line sitting under it.

                    Pairing the two things that actually compete for the line
                    is the fix, but they cannot always share one: at 375px the
                    body has 195px of content width and the pair needs 165 + 14
                    + 48 = 227. So .tt-ticket__head stacks them below 420px and
                    sits them on a line above it. The break is on WIDTH, not on
                    content, which is what keeps the three prices level with
                    each other: all three stubs stack, or all three do not. */}
                <div className="tt-ticket__body">
                  <div className="tt-ticket__head">
                    {/* Clamped, and opted out of the section's overflow-wrap.
                        Measured at 320px: "Pickleball" at a flat 26px sets
                        204px into the stub's 165px column, and because
                        .tt-ticket inherits the section-wide
                        `overflow-wrap: anywhere` it did not wrap at the word,
                        it SPLIT the word, and the schedule's first row read
                        "PICKLEB / ALL". Register's own sport picker already
                        solved exactly this and its comment records the same
                        arithmetic, so this is that fix, not a new one: scale
                        the name to the column and forbid the mid-word break,
                        rather than letting a long name find its own line. */}
                    <h3
                      style={{
                        fontSize: 'clamp(19px, 5.2vw, 26px)',
                        minWidth: 0,
                        overflowWrap: 'normal',
                        wordBreak: 'keep-all',
                        hyphens: 'none',
                      }}
                    >
                      {e.display_name}
                    </h3>
                    <span className="tt-code" style={{ fontSize: 'var(--tt-fs-body)', lineHeight: 1.5 }}>
                      {rupees(e.fee_inr)}
                    </span>
                  </div>
                  <div style={{ marginTop: 5, fontSize: 'var(--tt-fs-body)', color: 'var(--ink-3, #5A5A55)' }}>
                    {e.venue || 'Venue confirms shortly'}
                    {e.report_time ? ` · report by ${e.report_time}` : ''}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ═══ PROOF ══════════════════════════════════════════════════════════ */}
      <section className="tt-wrap tt-sec--top">
        <div className="tt-card tt-card--paper tt-card--lift" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: 'clamp(24px, 5vw, 40px)' }}>
            {/* No eyebrow: the heading is "It's a tournament and a
                fundraiser", which is the why. */}
            {/* Two things together, and neither alone was enough. `text-wrap:
                balance` stops a word being orphaned on its own line, but it
                cannot help when the longest word already fills the column: at
                30px in NeutralFace caps, "TOURNAMENT" nearly does, and the
                headline still broke as IT'S A / TOURNAMENT / AND / A
                FUNDRAISER. The smaller floor is what actually gives it room.
                NeutralFace caps are wider than they look on paper, so measure
                this one, don't eyeball it. */}
            <h2 style={{ fontSize: 'clamp(25px, 5.4vw, 46px)', marginTop: 10, maxWidth: 20 + 'ch', textWrap: 'balance' }}>
              It's a tournament and a fundraiser
            </h2>
            {/* This is the one place the fundraiser is explained, so it states
                the facts and stops. The sentence that used to close it, "the
                work carries on long after the trophies are handed out," was
                the most sermon-like line on the site, and a team deciding
                whether to enter a cricket tournament does not need to be told
                what their entry fee means about them.

                What it gained instead is specifics. The section was one
                sentence and three figures, two of which ("3 sports", "running
                since 2021") the page had already said. A prize pool you can
                add up yourself, and a plain line on where the rest goes, do the
                job that a paragraph of sentiment was failing to do. */}
            <p style={{ margin: '14px 0 0', maxWidth: 640, fontSize: 'var(--tt-fs-lead)', lineHeight: 1.65, color: 'var(--ink-2, #2A2A28)' }}>
              TerraThon is run by Team AquaTerra, a student-led volunteer organisation that has been
              running in Kolkata since 2021. Every rupee that is not paying for a turf, a referee or
              a trophy goes into the welfare projects we run through the year.
            </p>
            <ul style={{ margin: '16px 0 0', paddingLeft: 20, display: 'grid', gap: 8, maxWidth: 640, fontSize: 'var(--tt-fs-body)', lineHeight: 1.6, color: 'var(--ink-2, #2A2A28)' }}>
              <li><strong>{rupees(prizeTotal)} of prize money</strong> across the three sports, paid to winners and runners-up.</li>
              {/* The price half of this line is gone on purpose: a "from ₹X"
                  teaser next to a prize figure reads as a cost-benefit pitch,
                  which is not the point of this section. The team point still
                  needed to stand on its own once the price it used to lean on
                  was removed, so it is rewritten as a complete sentence rather
                  than a fragment. */}
              {ordered.length > 0 && (
                <li><strong>One registration covers your whole team</strong>, so nobody signs up twice.</li>
              )}
              <li><strong>12A and 80G certified</strong>, so what you pay is going somewhere accountable.</li>
            </ul>
            {/* The board's explicit "SEE THE PROJECTS" ask, missing from this
                section before. Points at the main site's own projects listing,
                a real prerendered route, not an anchor on this page. */}
            <a
              href={`${EVENT.mainSite}/projects`}
              target="_blank"
              rel="noreferrer noopener"
              className="tt-btn tt-btn--ghost"
              style={{ marginTop: 22 }}
            >
              See the projects
            </a>
          </div>

          {/* The four-stat strip that used to close this card is gone.
              Measured against the copy 40px above it, three of its four
              figures were already on screen: the bullets state the prize
              total and the 12A/80G registration in words, and the hero,
              the sport cards and the schedule all say three sports. Four
              stat-sized numbers promised four facts and delivered one,
              "running since 2021", which is now the second clause of the
              paragraph above, where it reads as a sentence rather than a
              credential.

              It also never fitted: the array was four items and `.tt-proof`
              is `repeat(3, 1fr)` above 700px, so the fourth wrapped onto a
              row of its own carrying a left border with nothing to its
              left. */}
        </div>

        {/* Partners render only when real ones exist. A "your logo here" wall on
            a fundraiser page is the first thing a real sponsor would notice. */}
        {PARTNERS.length > 0 && (
          <div style={{ marginTop: 26 }}>
            <div className="tt-kicker" style={{ color: 'var(--ink-3, #5A5A55)', marginBottom: 14 }}>With support from</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
              {PARTNERS.map((p) => (
                // A sponsor with a url gets a real link. The field was on the
                // type and rendered by neither site until now.
                <a
                  key={p.name}
                  className="tt-card"
                  href={p.url}
                  target={p.url ? '_blank' : undefined}
                  rel={p.url ? 'noreferrer noopener sponsored' : undefined}
                  aria-label={p.url ? `${p.name} (opens in a new tab)` : undefined}
                  style={{ padding: '12px 18px', boxShadow: 'none', display: 'inline-block', textDecoration: 'none', color: 'inherit' }}
                >
                  {p.logo
                    ? <img src={sized(p.logo, 'thumb')} alt={p.name} height={26} loading="lazy" decoding="async" style={{ display: 'block', height: 26, width: 'auto' }} />
                    : <span style={{ fontFamily: 'var(--tt-display)', fontWeight: 700, fontSize: 'var(--tt-fs-body)', textTransform: 'uppercase' }}>{p.name}</span>}
                </a>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ═══ FAQ ═══════════════════════════════════════════════════════════
          Three questions, not nine.

          This rendered the full list, and so does /terrathon/contact, so the
          same nine answers were published on two routes and the money and
          eligibility ones again on /terrathon/rules. Identical strings, three
          places to edit, and the refund answer is the one that must never
          disagree with itself.

          The three kept are the ones that stop someone registering: how they
          pay, when they are actually in, and whether they get their money
          back. Everything else is a question you ask after you have entered,
          and it is one tap away on a page built to answer it. */}
      <section className="tt-wrap tt-sec--top">
        <h2 className="tt-h2-poster" style={{ marginBottom: 'var(--tt-block)' }}>Questions</h2>
        <TerraThonFaq
          only={['How do I pay?', 'When is my slot confirmed?', 'Can I get a refund?']}
        />
        <Link
          to="/terrathon/contact"
          className="tt-btn tt-btn--ghost"
          style={{ marginTop: 18 }}
        >
          Every other question
        </Link>
      </section>

      {/* ═══ CLOSE ══════════════════════════════════════════════════════════ */}
      <section className="tt-sec tt-close">
        <div className="tt-wrap" style={{ textAlign: 'center' }}>
          <h2 className="tt-h1-poster">
            Get your team<br />on the list
          </h2>
          <p style={{
            margin: '0 auto',
            marginBlock: 'var(--tt-sp-4) var(--tt-sp-6)',
            maxWidth: 440,
            fontSize: 'var(--tt-fs-lead)',
            lineHeight: 1.6,
            color: 'var(--ink-2, #2A2A28)',
          }}>
            Under a minute to register. Bring the team details later, on WhatsApp.
          </p>
          <Link to={`${EVENT.base}/register`} className="tt-btn" style={{ minHeight: 'var(--tt-ctl-lg)' }}>
            Register Here
          </Link>
        </div>
      </section>

      <style>{`
        .tt-photo-grid {
          display: grid; gap: 22px; grid-template-columns: 1fr;
        }
        @media (min-width: 760px) {
          .tt-photo-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }

        /* A heading with a note pinned to its right, which stops being pinned
           the moment the two cannot share a line. */
        .tt-headrow { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 6px 16px; }
        .tt-headrow > .tt-note { max-width: 100%; }
        @media (min-width: 620px) {
          .tt-headrow > .tt-note {
            margin-left: auto; margin-bottom: 7px;
            transform: rotate(-2deg); transform-origin: right bottom;
          }
        }

        .tt-sports-grid {
          display: grid; gap: 16px;
          grid-auto-flow: column; grid-auto-columns: 86%;
          overflow-x: auto; scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          padding: 17px 20px 14px; margin-inline: -20px;
          /* Without this the rail eats the gutter it just paid for. The
             negative margin pulls the scroll container out to the screen edge
             and the padding puts the cards back on the 20px line, but
             scroll-snap-type: x mandatory snaps the first card's start edge
             to the SCROLLPORT's start edge, which ignores that padding. The
             browser therefore parks the rail at scrollLeft: 20 and the first
             card sits flush at x=0 while the heading above it sits at x=20.
             Proven rather than reasoned: setting scrollLeft to 0 by hand,
             the snap put it straight back to 20. scroll-padding is what
             moves the snapport in to meet the gutter. */
          scroll-padding-inline: 20px;
          scrollbar-width: none;
        }
        .tt-sports-grid::-webkit-scrollbar { display: none; }
        .tt-sports-grid > * { scroll-snap-align: start; }
        @media (min-width: 860px) {
          .tt-sports-grid {
            grid-auto-flow: row; grid-template-columns: repeat(3, minmax(0, 1fr));
            grid-auto-columns: auto; overflow: visible;
            margin-inline: 0; padding: 17px 0 0;
          }
        }

        .tt-steps {
          display: grid; gap: 14px; margin: 0; padding: 0;
          grid-template-columns: 1fr;
        }
        @media (min-width: 620px) { .tt-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (min-width: 1000px) { .tt-steps { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
      `}</style>
    </div>
  )
}
