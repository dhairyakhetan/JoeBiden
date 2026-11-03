import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { EVENT, EVENT_OVER } from '../config'
import { SPORT_ORDER, type PublicEvent, type SportSlug, type RegisterErrorCode } from '../lib/types'
import { register as submitRegistration } from '../lib/api'
import { useDraft } from '../lib/hooks'
import { normalisePhone, tidyPhone, rupees, dayRange, squadLabel } from '../lib/format'
import { unlock as unlockAudio } from '../lib/sound'
import { SPORT_PHOTOS } from '../lib/photos'
import { SuccessMoment } from '../components/SuccessMoment'
import { SPORT_ACCENT } from '../components/SportIcons'
import { SportMark } from '../components/SportMarks'
import { RulesDialog } from '../components/RulesDialog'

interface Props {
  events: PublicEvent[]
  loading: boolean
  error: string | null
  reload: () => void
}

interface Draft {
  captain_name: string
  dob: string
  phone: string
  email: string
  team_name: string
  rules: boolean
  website: string
  requestId: string
}

const BLANK: Draft = {
  captain_name: '', dob: '', phone: '', email: '', team_name: '',
  // Agreed by default, on the event director's instruction, and still
  // required: untick it and the form refuses to submit. The tick is the
  // record that it was agreed to, not a hurdle to clear, so it starts in the
  // state nearly everyone leaves it in and the rules stay one click away.
  rules: true,
  website: '', requestId: '',
}

/**
 * Eligibility: born on or after 1 January 2005.
 *
 * The same date is enforced inside terrathon_register, which is the rule that
 * actually holds; this one exists so somebody finds out while they are still
 * looking at the field, rather than after pressing Register Now. Kept as a literal
 * date string and compared as a string: both sides are ISO yyyy-mm-dd, so this
 * never has to think about timezones, which is where date comparisons on a
 * phone with a wrong clock normally go wrong.
 */
const MIN_DOB = '2005-01-01'
const MIN_DOB_LABEL = '1 January 2005'

/**
 * Floor, mirroring the table's `CHECK (age between 5 and 99)`. terrathon_register
 * now enforces this too and rejects with `{ok:false, code:'TOO_YOUNG', min_age:5}`
 * instead of letting a date inside the last five years reach the INSERT and raise
 * an uncaught 23514. Kept as a computed cutoff date, not a fixed year, so it stays
 * correct as "today" moves.
 */
const MIN_AGE_YEARS = 5

function minAgeCutoff(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - MIN_AGE_YEARS)
  return d.toISOString().slice(0, 10)
}

type DobVerdict = 'empty' | 'invalid' | 'eligible' | 'too-old' | 'too-young'

function dobVerdict(raw: string): DobVerdict {
  if (!raw) return 'empty'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return 'invalid'
  const today = new Date().toISOString().slice(0, 10)
  if (raw > today) return 'invalid'
  if (raw < MIN_DOB) return 'too-old'
  if (raw > minAgeCutoff()) return 'too-young'
  return 'eligible'
}

const DONE_KEY = 'tt_registered_sports_v1'

function readDoneSports(): SportSlug[] {
  try { return JSON.parse(sessionStorage.getItem(DONE_KEY) || '[]') } catch { return [] }
}
function markDone(slug: SportSlug) {
  try {
    sessionStorage.setItem(DONE_KEY, JSON.stringify(Array.from(new Set([...readDoneSports(), slug]))))
  } catch { /* private mode */ }
}

const ERROR_COPY: Record<RegisterErrorCode, string> = {
  BAD_REQUEST: 'Something was missing from that submission. Refresh and try again.',
  NO_SUCH_EVENT: 'That sport is not running this year.',
  EVENT_CLOSED: 'Registrations for this sport have closed.',
  INVALID_NAME: 'Enter your full name.',
  INVALID_DOB: 'Enter your date of birth.',
  TOO_OLD: 'You need to be born on 1 January 2005 or after to play.',
  INVALID_PHONE: 'Enter a 10-digit Indian mobile number.',
  CONSENT_REQUIRED: 'Tick the box to continue.',
  DUPLICATE: 'This number is already registered for this sport. Message us if that looks wrong.',
  TEAM_NAME_TAKEN: 'That team name is taken. Pick a new one.',
  TOO_YOUNG: `You need to be at least ${MIN_AGE_YEARS} years old to register.`,
}

/** Aliased because the verdict line and the field error both want this text. */
const TOO_YOUNG_COPY = ERROR_COPY.TOO_YOUNG

/** TerraThon is over (config.EVENT_OVER): no form, nothing collected. The database refuses registrations too. */
export function TerraThonRegister(props: Props) {
  if (EVENT_OVER) {
    return (
      <section className="tt-reg" aria-labelledby="tt-closed-h" style={{ padding: 'var(--tt-sp-8) var(--tt-gutter, 20px)', maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
        <h1 id="tt-closed-h" className="tt-h2-poster" style={{ margin: 0 }}>That’s a wrap.</h1>
        <p style={{ marginTop: 16, lineHeight: 1.6 }}>
          {EVENT.name} ran on 2 to 4 October and registration is closed. Thank you to everyone who played, volunteered and cheered.
          Follow <a href={EVENT.instagram} target="_blank" rel="noreferrer noopener">@aquaterra.live</a> for what comes next.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 24 }}>
          <Link to={`${EVENT.base}/schedule`} className="tt-btn tt-btn--quiet" style={{ minHeight: 44 }}>See the schedule</Link>
          <Link to={`${EVENT.base}/contact`} className="tt-btn tt-btn--quiet" style={{ minHeight: 44 }}>Contact</Link>
        </div>
      </section>
    )
  }
  return <TerraThonRegisterForm {...props} />
}

function TerraThonRegisterForm({ events, loading, error, reload }: Props) {
  const { sport: sportParam } = useParams<{ sport?: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const reduce = useReducedMotion()

  // The sport can arrive three ways: in the path (/register/cricket, which is
  // what the Instagram links use), as ?sport=, or not at all. All three land on
  // the same one screen; the only difference is whether a chip starts selected.
  const fromPath = sportParam && SPORT_ORDER.includes(sportParam as SportSlug) ? (sportParam as SportSlug) : null
  const fromQuery = SPORT_ORDER.includes((params.get('sport') || '') as SportSlug) ? (params.get('sport') as SportSlug) : null
  const [sport, setSport] = useState<SportSlug | null>(fromPath ?? fromQuery)

  useEffect(() => { if (fromPath) setSport(fromPath) }, [fromPath])

  const [draft, patch, clearDraft] = useDraft<Draft>('tt_draft_v2', BLANK)
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [done, setDone] = useState<{ refCode: string; waitlisted: boolean; sport: SportSlug } | null>(null)

  useEffect(() => {
    if (!draft.requestId) patch({ requestId: crypto.randomUUID() })
  }, [draft.requestId, patch])

  // Focus on success is deliberately NOT handled here.
  //
  // Swapping the <form> for <SuccessMoment> removes the focused submit button
  // from the DOM and drops focus to <body>, which left a screen-reader user
  // with no confirmation, no heading and no reference code at the one moment
  // on this page that most needs announcing. SuccessMoment now owns that: it
  // holds a ref to its own heading and focuses it once its entrance
  // choreography finishes.
  //
  // Reaching in from here with a querySelector would race that choreography
  // and depend on the other component's markup, and two components both
  // moving focus is how you get it moved twice.

  const verdict = dobVerdict(draft.dob)
  const event = sport ? events.find((e) => e.slug === sport) : undefined
  // A sport closes only when an admin closes it; the closing time and the spot
  // limit never shut the form (a full sport waitlists).
  const closedForSignup = !!event && event.status !== 'open'
  const open = useMemo(
    () => SPORT_ORDER.map((s) => events.find((e) => e.slug === s)).filter((e): e is PublicEvent => !!e),
    [events],
  )

  // Cricket and FIFA share Sat 3 Oct. Two venues, one clock.
  const clash = useMemo(() => {
    if (!event?.day_first) return null
    const overlap = readDoneSports()
      .filter((s) => s !== sport)
      .map((s) => events.find((e) => e.slug === s))
      .filter((e): e is PublicEvent => !!e?.day_first)
      .filter((e) => {
        const aS = event.day_first as string, aE = (event.day_last || event.day_first) as string
        const bS = e.day_first as string, bE = (e.day_last || e.day_first) as string
        return aS <= bE && bS <= aE
      })
    return overlap.length ? overlap.map((e) => e.display_name).join(' and ') : null
  }, [event, events, sport])

  if (sportParam && !fromPath) return <Navigate to={`${EVENT.base}/register`} replace />

  if (error) {
    return (
      <div className="tt-wrap tt-page" style={{ maxWidth: 560 }}>
        <div className="tt-card" role="alert" style={{ borderColor: 'var(--tt-danger)' }}>
          <h1 style={{ fontSize: 28, color: 'var(--tt-danger)' }}>Couldn't load the sports</h1>
          <p style={{ margin: '8px 0 16px', color: 'var(--tt-muted)' }}>{error}</p>
          <button type="button" className="tt-btn tt-btn--ghost" onClick={reload}>Try again</button>
        </div>
      </div>
    )
  }
  if (loading && !events.length) {
    return (
      <div className="tt-wrap tt-page" style={{ maxWidth: 560 }}>
        <span className="tt-sr" role="status">Loading</span>
        <div className="tt-card" style={{ height: 340, opacity: 0.35 }} aria-hidden="true" />
      </div>
    )
  }

  const accent = sport ? SPORT_ACCENT[sport] : 'var(--tt-volt)'

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!sport) e.sport = 'Pick a sport.'
    // Live sport, but the admin closed it: the
    // picker's disabled chips never catch this once the sport arrived
    // pre-selected from a shared link, so it is re-checked here too. A FULL
    // event is deliberately not this case: it waitlists gracefully.
    else if (event && closedForSignup) e.sport = 'Registrations for this sport have closed.'
    if (draft.captain_name.trim().length < 2) e.captain_name = 'Enter your full name.'
    // 80 chars mirrors the live function's INVALID_NAME cap, so a pasted
    // WhatsApp-roster name is stopped by the input itself rather than
    // reaching the server and coming back with "Enter your full name" under
    // a field that plainly has one.
    else if (draft.captain_name.trim().length > 80) e.captain_name = 'Enter your full name.'
    // The eligibility rule, said once here and enforced again in the RPC.
    const v = dobVerdict(draft.dob)
    if (v === 'empty' || v === 'invalid') e.dob = 'Enter your date of birth.'
    else if (v === 'too-old') e.dob = `You need to be born on ${MIN_DOB_LABEL} or after to play.`
    else if (v === 'too-young') e.dob = TOO_YOUNG_COPY
    if (!normalisePhone(draft.phone)) e.phone = 'Enter a 10-digit Indian mobile number.'
    if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) e.email = 'That email does not look right.'
    if (!draft.rules) e.consent = 'Tick the box to continue.'
    setErrs(e)
    if (Object.keys(e).length) {
      // On the NEXT frame, not now. `setErrs` is React state, so the
      // `aria-invalid` attributes and `.tt-err` nodes this looks for do not
      // exist in the DOM yet when validate() returns. Querying synchronously
      // found nothing on a first submit and a stale error from the previous
      // attempt on later ones; so on a phone, where the button sits below a
      // long form, five errors appeared off-screen above and the page never
      // moved. Tapping Register Now looked like it did nothing at all.
      requestAnimationFrame(() => {
        const field = document.querySelector<HTMLElement>('[aria-invalid="true"]')
        const target = field ?? document.querySelector<HTMLElement>('.tt-err')
        target?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
        // Focus the control, not the message: a keyboard or screen-reader user
        // needs to land on the field they have to fix, and scrolling alone
        // tells them nothing.
        field?.focus({ preventScroll: true })
      })
    }
    return Object.keys(e).length === 0
  }

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate() || !sport) return
    // Resume the AudioContext while the tap gesture is still live: iOS blocks
    // playback that starts after a network round trip.
    unlockAudio()
    setBusy(true)
    setBanner(null)
    try {
      const utm: Record<string, string> = {}
      for (const k of ['src', 'utm_source', 'utm_medium', 'utm_campaign']) {
        const v = params.get(k)
        if (v) utm[k] = v
      }
      const res = await submitRegistration({
        sport,
        client_request_id: draft.requestId || crypto.randomUUID(),
        captain_name: draft.captain_name.trim(),
        dob: draft.dob,
        phone: draft.phone,
        email: draft.email.trim() || undefined,
        team_name: draft.team_name.trim() || undefined,
        rules_consent: draft.rules ? 'true' : 'false',
        // Always false. The marketing opt-in checkbox was removed from the
        // form on 2026-09-21, so nobody can consent through this path any
        // more. The field stays in the payload because terrathon_register
        // takes it, and sending a hardcoded false is honest: no consent was
        // given. Put the box back before ever sending this as true.
        updates_opt_in: 'false',
        source: 'web',
        utm,
        website: draft.website,
      })

      // Every failure below has to be SEEN. The submit button sits at the foot
      // of a long form on a phone, and both of these render above it: the
      // banner at the very top, a field error wherever its field is. Setting
      // state and stopping the spinner, with nothing appearing in the
      // viewport, is indistinguishable from the button not working; which is
      // exactly how this was reported. Same next-frame trick validate() uses,
      // because the node does not exist until React paints.
      const revealFailure = () => {
        requestAnimationFrame(() => {
          const target =
            document.querySelector<HTMLElement>('[aria-invalid="true"]')
            ?? document.querySelector<HTMLElement>('[role="alert"]')
          target?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
          if (target?.tagName === 'INPUT' || target?.tagName === 'SELECT') {
            target.focus({ preventScroll: true })
          }
        })
      }

      if (res.ok) {
        markDone(sport)
        clearDraft()
        setDone({ refCode: res.ref_code, waitlisted: res.status === 'waitlist', sport })
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
      } else {
        const msg = ERROR_COPY[res.code] ?? 'Something went wrong. Try again.'
        if (res.code === 'TOO_YOUNG') setErrs({ dob: msg })
        else if (res.code === 'INVALID_PHONE') setErrs({ phone: msg })
        else if (res.code === 'INVALID_DOB') setErrs({ dob: 'Enter your date of birth.' })
        else if (res.code === 'TOO_OLD') setErrs({ dob: `You need to be born on ${MIN_DOB_LABEL} or after to play.` })
        else if (res.code === 'INVALID_NAME') setErrs({ captain_name: msg })
        else if (res.code === 'CONSENT_REQUIRED') setErrs({ consent: msg })
        else if (res.code === 'TEAM_NAME_TAKEN') setErrs({ team_name: msg })
        else setBanner(msg)
        revealFailure()
      }
    } catch {
      // The draft is in sessionStorage and requestId is stable, so a retry is
      // safe and cannot create a second registration.
      setBanner("Couldn't reach the server. Your details are saved, so just try again.")
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('[role="alert"]')
          ?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
      })
    } finally {
      setBusy(false)
    }
  }

  const firstName = draft.captain_name.trim().split(/\s+/)[0] || 'captain'
  const solo = event?.team_size_max === 1

  return (
    <div className="tt-reg">
      {/* Picture above, title bar below. The picture used to sit UNDER a heavy
          scrim with the title floating on top, which turned a clean colour
          block into mud and made the sport name hard to read at small sizes.
          Separating them lets the picture be a picture and the title be legible.

          Real photographs, not the drawn StadiumScene. This was the last page
          still showing the illustration after every other surface moved to
          AquaTerra's own session photos, and it showed it in the pre-inversion
          house hues, so the one screen where somebody decides to commit money
          carried a cartoon pitch in colours the campaign does not use. */}
      <div className="tt-reg__hero">
        <div className="tt-reg__scene">
          {sport
            ? (
              <img
                className="tt-photo"
                src={SPORT_PHOTOS[sport].hero}
                alt={SPORT_PHOTOS[sport].heroAlt}
                width={1600}
                height={900}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )
            : (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {SPORT_ORDER.map((s, i) => (
                  <div key={s} style={{ position: 'relative', overflow: 'hidden', borderRight: i < 2 ? '2px solid var(--tt-line)' : undefined }}>
                    <img
                      className="tt-photo"
                      src={SPORT_PHOTOS[s].hero}
                      alt={SPORT_PHOTOS[s].heroAlt}
                      width={1600}
                      height={900}
                      loading="lazy"
                      decoding="async"
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                ))}
              </div>
            )}
        </div>

        <div className="tt-slab tt-reg__bar">
          <div className="tt-kick" style={{ marginBottom: 8 }}>TerraThon 2026</div>
          <h1 style={{ fontSize: 'clamp(34px, 7vw, 54px)', lineHeight: 0.92 }}>
            {event ? event.display_name : 'Take your spot'}
          </h1>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {event ? (
              <>
                {/* Ink text stated explicitly. Inside a slab the base chip rule
                    makes text paper, which on a bright fill measured 2.88:1. */}
                <span className="tt-chip" style={{ background: accent, color: '#0A0A0A', fontFamily: 'var(--tt-code)' }}>
                  {rupees(event.fee_inr)} {solo ? '/ player' : '/ team'}
                </span>
                <span className="tt-chip" style={{ background: 'transparent', color: 'var(--tt-ink, #F2EFE3)', fontFamily: 'var(--tt-code)' }}>
                  {dayRange(event.day_first, event.day_last)}
                </span>
              </>
            ) : (
              <span className="tt-chip" style={{ background: 'transparent', color: 'var(--tt-ink, #F2EFE3)' }}>
                Three sports, three days
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="tt-reg__sheet">
        <div className="tt-reg__inner">
          {done ? (
            <SuccessMoment
              sport={done.sport}
              event={events.find((e) => e.slug === done.sport)!}
              refCode={done.refCode}
              waitlisted={done.waitlisted}
              firstName={firstName}
            />
          ) : (
            <form onSubmit={onSubmit} noValidate>
              <div style={{ marginBottom: 24 }}>
                <span className="tt-kick">Step 1 of 2</span>
                <h2 className="tt-reg__kicker tt-h2-poster" style={{ marginTop: 6 }}>Register Now</h2>
                <p style={{ margin: '10px 0 0', fontSize: 'var(--tt-fs-body)', lineHeight: 1.6, color: 'var(--tt-muted)' }}>
                  One person registers for the whole team. We'll collect the rest
                  of the names on WhatsApp afterwards, so you don't need everyone's
                  details right now.
                </p>
              </div>

              {banner && (
                <div role="alert" className="tt-card" style={{ borderColor: 'var(--tt-danger)', padding: 14, marginBottom: 18 }}>
                  <p style={{ margin: 0, fontSize: 'var(--tt-fs-body)' }}>{banner}</p>
                </div>
              )}

              {event && closedForSignup && (
                <div role="alert" className="tt-card" style={{ borderColor: 'var(--tt-danger)', padding: 14, marginBottom: 18 }}>
                  <p style={{ margin: 0, fontSize: 'var(--tt-fs-body)' }}>
                    Registrations for {event.display_name} have closed.
                  </p>
                </div>
              )}

              {clash && (
                <div className="tt-card" style={{ borderColor: 'var(--tt-amber)', padding: 14, marginBottom: 18 }}>
                  <p style={{ margin: 0, fontSize: 'var(--tt-fs-body)', color: 'var(--tt-amber)' }}>
                    You already registered for {clash}, which runs the same day. Two venues, one clock.
                    Make sure you can make both.
                  </p>
                </div>
              )}

              <div style={{ display: 'grid', gap: 20 }}>
                {/* ── Sport ─────────────────────────────────────────────── */}
                <fieldset
                  style={{ border: 'none', padding: 0, margin: 0 }}
                  aria-invalid={!!errs.sport}
                  aria-describedby={errs.sport ? 'tt-sport-e' : undefined}
                  // Not natively focusable; needed so validate()'s
                  // `[aria-invalid="true"]` query can find and focus it when
                  // the sport picker is the only thing wrong with the form.
                  tabIndex={-1}
                >
                  <legend className="tt-label" style={{ padding: 0, marginBottom: 10 }}>Which sport?</legend>
                  <div className="tt-sportpick">
                    {open.map((e) => {
                      const active = sport === e.slug
                      const id = `tt-sport-${e.slug}`
                      return (
                        <label
                          key={e.slug}
                          htmlFor={id}
                          className="tt-sportpick__btn"
                          data-active={active}
                          data-disabled={!e.accepting}
                          style={{ ['--sport-hue' as string]: SPORT_ACCENT[e.slug] }}
                        >
                          <input
                            type="radio"
                            id={id}
                            name="tt-sport"
                            className="tt-sportpick__radio"
                            value={e.slug}
                            checked={active}
                            disabled={!e.accepting}
                            onChange={() => {
                              setSport(e.slug)
                              setErrs((x) => ({ ...x, sport: '' }))
                              // Keep the URL honest, so a refresh or a shared link
                              // lands on the same sport they just picked.
                              navigate(`${EVENT.base}/register/${e.slug}`, { replace: true })
                            }}
                          />
                          <SportMark sport={e.slug} size={26} />
                          <span className="tt-sportpick__name">{e.display_name}</span>
                          <span className="tt-sportpick__fee">
                            {e.accepting ? rupees(e.fee_inr) : 'Closed'}
                          </span>
                          <span className="tt-sportpick__size">
                            {squadLabel(e)}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                  {errs.sport && <p className="tt-err" id="tt-sport-e" role="alert">{errs.sport}</p>}
                </fieldset>

                {event && (
                  <aside className="tt-summary" aria-label={`${event.display_name} details`}>
                    <span className="tt-kick">You're entering</span>
                    <p className="tt-summary__title tt-poster-line" style={{ marginTop: 4 }}>{event.display_name}</p>
                    <dl className="tt-summary__grid">
                      <div>
                        <dt>Dates</dt>
                        <dd style={{ fontFamily: 'var(--tt-code)' }}>{dayRange(event.day_first, event.day_last)}</dd>
                      </div>
                      <div>
                        <dt>Venue</dt>
                        <dd style={{ fontFamily: 'var(--tt-code)' }}>{event.venue || 'TBA'}</dd>
                      </div>
                      <div>
                        <dt>Report time</dt>
                        <dd style={{ fontFamily: 'var(--tt-code)' }}>{event.report_time || 'TBC'}</dd>
                      </div>
                      <div>
                        <dt>Squad size</dt>
                        <dd style={{ fontFamily: 'var(--tt-code)' }}>{solo ? 'Solo entry' : squadLabel(event)}</dd>
                      </div>
                    </dl>
                    <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                      <div className="tt-stat tt-stat--go" style={{ flex: 1 }}>
                        <span className="tt-stat__k">Entry fee</span>
                        <span className="tt-stat__v">{rupees(event.fee_inr)} {solo ? '/ player' : '/ team'}</span>
                      </div>
                    </div>
                  </aside>
                )}

                <div className="tt-plate tt-reg__plate">
                <div>
                  <label className="tt-label" htmlFor="tt-name">Your name</label>
                  <input
                    id="tt-name" className="tt-input" autoComplete="name" value={draft.captain_name}
                    // Mirrors the live function's INVALID_NAME cap (80 chars).
                    maxLength={80}
                    aria-invalid={!!errs.captain_name} aria-describedby={errs.captain_name ? 'tt-name-e' : undefined}
                    onChange={(e) => patch({ captain_name: e.target.value })}
                  />
                  {errs.captain_name && <p className="tt-err" id="tt-name-e">{errs.captain_name}</p>}
                </div>

                <div className="tt-reg__row">
                  <div>
                    <label className="tt-label" htmlFor="tt-dob">Date of birth</label>
                    <input
                      id="tt-dob" className="tt-input" type="date"
                      autoComplete="bday" enterKeyHint="next"
                      /* A floor as well as a ceiling. The eligibility rule is
                         born on or after MIN_DOB, so the native picker can
                         refuse an ineligible date outright and, on a phone,
                         opens near the right years instead of this month. */
                      min={MIN_DOB}
                      max={new Date().toISOString().slice(0, 10)}
                      value={draft.dob}
                      aria-invalid={verdict === 'too-old' || verdict === 'too-young' || !!errs.dob}
                      aria-describedby={errs.dob ? 'tt-dob-e' : 'tt-dob-v'}
                      onChange={(e) => patch({ dob: e.target.value })}
                    />
                    {errs.dob && <p className="tt-err" id="tt-dob-e">{errs.dob}</p>}
                  </div>

                  <div>
                    <label className="tt-label" htmlFor="tt-phone">WhatsApp number</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span className="tt-prefix">+91</span>
                      <input
                        id="tt-phone" className="tt-input" type="tel" inputMode="numeric"
                        autoComplete="tel-national" enterKeyHint="next"
                        /* 24, not 11. maxLength truncates a PASTE before any
                           handler runs, and there is a visible +91 chip right
                           beside this field inviting people to paste a number
                           that carries one. "+91 98305 54654" arrived as
                           "+91 98305 5" and the person had to notice and fix
                           it. The room is here so the paste survives; onChange
                           below is what actually bounds the value. */
                        maxLength={24}
                        value={draft.phone}
                        aria-invalid={!!errs.phone} aria-describedby={errs.phone ? 'tt-phone-e' : 'tt-phone-h'}
                        onChange={(e) => patch({ phone: tidyPhone(e.target.value) })}
                      />
                    </div>
                    {errs.phone
                      ? <p className="tt-err" id="tt-phone-e">{errs.phone}</p>
                      : <p className="tt-help" id="tt-phone-h">This is where we message you.</p>}
                  </div>

                  {/* The verdict, the moment a full date exists.
                      aria-live="polite" so it is announced rather than only
                      seen, and the colour is never the only signal: each
                      state has its own words and its own mark.

                      It spans the whole row rather than sitting in the date
                      cell, which is the narrow one. Inside it, a sentence
                      this long wrapped to roughly one word per line and grew
                      a 113px-tall box under a 234px field. It is tied to the
                      input by aria-describedby, not by nesting, so moving it
                      out costs nothing to a screen reader. */}
                    <p
                      id="tt-dob-v"
                      // role="alert" already implies an assertive live region;
                      // adding aria-live="polite" alongside it left an explicit
                      // aria-live winning over the role's implicit one, so the
                      // "too old"/"too young" messages, which most need to
                      // interrupt, were likely announced only politely. Only
                      // one of the two is ever set now.
                      role={verdict === 'too-old' || verdict === 'too-young' ? 'alert' : undefined}
                      aria-live={verdict === 'too-old' || verdict === 'too-young' ? undefined : 'polite'}
                      className={
                        'tt-reg__verdict ' + (
                          verdict === 'eligible' ? 'tt-verdict tt-verdict--ok'
                          : verdict === 'too-old' || verdict === 'too-young' ? 'tt-verdict tt-verdict--no'
                          : 'tt-help'
                        )
                      }
                    >
                      {verdict === 'eligible'
                        ? `That date of birth is within range. Please make sure your teammates are born on ${MIN_DOB_LABEL} or after.`
                        : verdict === 'too-old'
                          ? `Sorry, you are too old to register for this event. You need to be born on ${MIN_DOB_LABEL} or after.`
                          : verdict === 'too-young'
                            ? TOO_YOUNG_COPY
                            : `You need to be born on ${MIN_DOB_LABEL} or after to play.`}
                  </p>
                </div>

                <div>
                  <label className="tt-label" htmlFor="tt-team-name">Team name (optional)</label>
                  <input
                    id="tt-team-name" className="tt-input" autoComplete="off" value={draft.team_name}
                    maxLength={60}
                    aria-invalid={!!errs.team_name} aria-describedby={errs.team_name ? 'tt-team-name-e' : undefined}
                    onChange={(e) => patch({ team_name: e.target.value })}
                  />
                  {errs.team_name && <p className="tt-err" id="tt-team-name-e">{errs.team_name}</p>}
                </div>

                {/* The optional email disclosure was removed on 2026-09-21.
                    Nothing in the funnel ever sent an email: the slot is
                    confirmed over WhatsApp, on the number collected above, and
                    that is the only channel the desk works from. Asking for a
                    second contact the organisers will not use costs a tap and
                    collects a personal identifier for nothing. The field stays
                    in the Draft and in the payload as undefined so the
                    existing row shape and the RPC are untouched. */}

                <div>
                  {/* One required tick, not two. The guardian box was removed
                      on the event director's instruction, and the RPC no
                      longer demands it either.

                      The tick starts AGREED, and is still required: clear it
                      and the form refuses to submit, with the same message it
                      always had. */}
                  <label className="tt-check">
                    <input
                      type="checkbox" checked={draft.rules}
                      aria-invalid={!!errs.consent}
                      aria-describedby={errs.consent ? 'tt-consent-e' : undefined}
                      onChange={(e) => patch({ rules: e.target.checked })}
                    />
                    <span>
                      I'll follow the{' '}
                      {/* Opens a dialog over the form rather than a second tab,
                          so skimming the rules never costs your place in a
                          half-filled form and there is nothing to navigate back
                          from on a phone.
                          Two things here look like bugs and aren't, so they
                          don't get "fixed" on a later pass:
                          - Pressing this does NOT toggle the surrounding label's
                            checkbox. A label does nothing for clicks targeted at
                            an interactive descendant, and that was verified in
                            the browser, not just read in the spec.
                          - It gets no 44px tap overlay. It is inline in a
                            sentence, which WCAG 2.5.8 exempts, and an overlay
                            would swallow taps meant for the checkbox. */}
                      <button
                        type="button"
                        className="tt-inlinebtn"
                        onClick={() => setRulesOpen(true)}
                      >
                        event rules
                      </button>
                      {' '}and the entry fee is non-refundable once confirmed.
                    </span>
                  </label>
                  {errs.consent && <p className="tt-err" id="tt-consent-e" role="alert">{errs.consent}</p>}
                </div>
                </div>
              </div>

              {/* Honeypot. Off-screen rather than display:none, which some bots skip. */}
              <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                <label htmlFor="tt-website">Website</label>
                <input id="tt-website" tabIndex={-1} autoComplete="off" value={draft.website}
                       onChange={(e) => patch({ website: e.target.value })} />
              </div>

              <motion.button
                type="submit"
                className="tt-btn"
                disabled={busy || closedForSignup}
                whileTap={reduce ? undefined : { scale: 0.97 }}
                style={{ width: '100%', marginTop: 26, minHeight: 56 }}
              >
                {busy
                  ? <><BouncingBall /> Registering you</>
                  : event ? `Register Now for ${event.display_name}` : 'Register Now'}
              </motion.button>

              <p style={{ margin: '14px 0 0', fontSize: 'var(--tt-fs-meta)', lineHeight: 1.6, color: 'var(--tt-muted)', textAlign: 'center' }}>
                Submitting this does not charge you. We'll message you on WhatsApp with the payment details next.
              </p>
            </form>
          )}
        </div>
      </div>

      {/* Mounted once, outside the form. A <dialog> is top-layer, so where it
          sits in the tree does not affect where it paints; but keeping it out
          of the <form> means its buttons can never be mistaken for a submit. */}
      <RulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} event={event} />

      <style>{`
        .tt-reg { position: relative; }
        .tt-reg__hero { position: relative; }
        .tt-reg__scene {
          position: relative; height: 26vh; min-height: 150px; max-height: 240px;
          border-bottom: 2px solid var(--ink, #0A0A0A);
        }
        .tt-reg__bar { padding: var(--tt-block) var(--tt-sp-5); }
        /* --bg was never defined once the poster flip landed (terrathon.css
           has no such token), so this silently fell back to the OLD cream
           page colour and the sheet never actually sat on the night ground
           the rest of the page uses. --tt-paper is the real token. */
        .tt-reg__sheet { position: relative; background: var(--tt-paper, #05060A); }
        /* 20px side gutter, not 24: .tt-wrap uses 20 on every other page in the
           section, and the ink bar directly above this sheet uses 20 too, so a
           24 here stepped the form 4px in from the band it hangs off. The
           96px bottom was another hand-picked value; --tt-section ends the
           page on the same rhythm as everywhere else. */
        .tt-reg__inner { max-width: 600px; margin: 0 auto; padding: var(--tt-sp-3) var(--tt-sp-5) var(--tt-section); }
        .tt-reg__row { display: grid; gap: 20px 16px; grid-template-columns: 1fr; }
        /* 110px was sized for the old age field, which held two digits. A date
           input has to fit dd-mm-yyyy AND the browser's own picker button, and
           at 110px Chrome clipped the year: the field read "01-02-" with no
           year at all. 190px is measured, not guessed. */
        @media (min-width: 480px) { .tt-reg__row { grid-template-columns: 190px 1fr; } }
        /* The eligibility verdict is a row-wide sentence, not a caption on the
           date cell. Left in the cell it wrapped one word per line. */
        .tt-reg__verdict { grid-column: 1 / -1; margin: 0; }

        .tt-prefix {
          display: inline-flex; align-items: center; padding: 0 13px;
          border-radius: var(--tt-r-btn); background: var(--tt-raised);
          border: 1px solid var(--tt-hairline-2); color: var(--tt-muted);
          font-size: 15px; flex: 0 0 auto;
        }

        /* Named .tt-reg__kicker, not .tt-poster: terrathon.css already owns
           that class name for the hero art frame (aspect-ratio box), and
           reusing it here stretched this heading to a 74vh art box instead of
           a line of text. */
        .tt-reg__kicker { font-family: var(--tt-poster, var(--tt-display)); text-transform: uppercase; }

        /* auto-fit off the CONTAINER, not a viewport query. This picker sits
           in the narrow half of a split layout, so at a 900px viewport its
           column is about 300px and a hard three-up gave each card 95px, which
           clipped "Pickleball" at 21px. The old 420px media query never fired
           because the viewport was wide even though the column was not. */
        .tt-sportpick { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 165px), 1fr)); }
        /* Real radios, visually hidden but not display:none (which drops them
           from the tab order in some browsers) and not opacity:0 sitting under
           the label's own click area either, since either would still leave a
           focus ring with nowhere visible to land. Positioned over the label
           instead, so the browser's native focus outline draws around the
           whole card and a sighted keyboard user can actually see where they are. */
        .tt-sportpick__radio {
          position: absolute; inset: 0; margin: 0; opacity: 0; cursor: pointer;
        }
        .tt-sportpick__radio:disabled { cursor: not-allowed; }
        .tt-sportpick__btn {
          position: relative;
          display: flex; flex-direction: column; align-items: flex-start; gap: 6px;
          padding: 14px; min-height: 96px; cursor: pointer; text-align: left;
          background: var(--tt-surface); color: var(--tt-text);
          border: 3px solid var(--tt-line); border-radius: var(--tt-r-card);
          font-family: inherit; transition-property: background-color, border-color, transform; transition-duration: 140ms; transition-timing-function: cubic-bezier(0.2, 0, 0, 1);
        }
        @media (max-width: 420px) {
          .tt-sportpick__btn { flex-direction: row; align-items: center; min-height: 64px; gap: 12px; flex-wrap: wrap; }
          .tt-sportpick__fee { margin-left: auto; }
          .tt-sportpick__size { flex-basis: 100%; }
        }
        .tt-sportpick__btn:hover:not([data-disabled='true']) { background: var(--tt-raised); }
        .tt-sportpick__btn:active:not([data-disabled='true']) { transform: scale(0.96); }
        /* Selected = full-strength orchid border and a tinted fill, per the
           poster system. Resting cards sit at the same outline used
           everywhere else (--tt-line), so the selected one is the only card
           that reads as "chosen". */
        .tt-sportpick__btn[data-active='true'] {
          border-color: var(--tt-hot, #DD6CEE);
          background: color-mix(in srgb, var(--tt-hot, #DD6CEE) 16%, var(--tt-surface));
        }
        .tt-sportpick__btn[data-active='true'] .tt-sportpick__fee { opacity: 0.9; }
        .tt-sportpick__btn[data-disabled='true'] { opacity: 0.4; cursor: not-allowed; }
        /* The visible focus ring the radio itself can't otherwise show once
           its own box is invisible: :focus-visible on the sibling radio
           drives an outline on the card via :has, with a fallback for
           browsers without :has support that leaves it on the input itself. */
        .tt-sportpick__radio:focus-visible {
          outline: 3px solid var(--tt-lemon, #FFD166); outline-offset: 2px;
        }
        .tt-sportpick__btn:has(.tt-sportpick__radio:focus-visible) {
          outline: 3px solid var(--tt-lemon, #FFD166); outline-offset: 2px;
        }
        /* A sport name is one word and must never break inside itself. The card is
           about 95px wide in the three-up grid and "CRICKET" at 21px needed
           more, so the section-wide overflow-wrap: anywhere on the button
           split it as "CRICKE T". The name opts out of that and scales to the
           card instead. */
        .tt-sportpick__name {
          font-family: var(--tt-display);
          /* 18 at the top, not 21: the longest name is Pickleball, which sets
             about 126px at 18 and fits the 165px track once its padding is
             taken off. */
          font-size: clamp(14px, 2.4vw, 18px);
          line-height: 1.05;
          text-transform: uppercase;
          overflow-wrap: normal;
          word-break: keep-all;
          hyphens: none;
        }
        .tt-sportpick__fee { font-family: var(--tt-code); font-size: 12.5px; opacity: 0.8; font-variant-numeric: tabular-nums; }
        .tt-sportpick__size { font-size: var(--tt-fs-label); opacity: 0.7; }

        /* The form's surface is .tt-plate, terrathon.css's own cream panel
           (see its comment there: "in practice means the steps panel and the
           registration form"). It resets --tt-ink/--tt-muted/--tt-line/
           --tt-card/--tt-hot-ink/--tt-cyan and friends for anything nested
           inside, which is what .tt-input, .tt-label, .tt-help, .tt-err and
           .tt-inlinebtn all read, so the whole field set and the "event
           rules" link invert for free. Only one real gap below. */
        .tt-reg__plate { display: grid; gap: 20px; }
        /* .tt-prefix's own background token (--tt-raised) is defined once at
           :root from --tt-paper-2, so it does not pick up .tt-plate's
           redefinition of --tt-paper-2 the way --tt-card does; left alone it
           drew a near-black chip that swallowed its own "+91" text. */
        .tt-reg__plate .tt-prefix { color: var(--tt-muted); background: rgba(10,10,10,0.06); border-color: var(--tt-line); }

        .tt-summary {
          border: 3px solid var(--tt-line); border-radius: var(--tt-r-card);
          padding: 16px 18px; display: grid; gap: 10px;
        }
        .tt-summary__title {
          margin: 0; font-family: var(--tt-poster, var(--tt-display)); text-transform: uppercase;
          font-size: 16px; letter-spacing: 0.02em;
        }
        .tt-summary__grid {
          margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px;
        }
        .tt-summary__grid dt {
          margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;
          color: var(--tt-muted);
        }
        .tt-summary__grid dd {
          margin: 4px 0 0; font-size: 14px; font-variant-numeric: tabular-nums;
        }
        @media (min-width: 640px) {
          .tt-summary__grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }

        .tt-more { border-top: 1px solid var(--tt-hairline); padding-top: 14px; }
        .tt-more > summary {
          cursor: pointer; font-size: 13.5px; color: var(--tt-cyan);
          list-style: none; padding: 6px 0; min-height: 32px;
        }
        .tt-more > summary::-webkit-details-marker { display: none; }
        .tt-more > summary::before { content: '+ '; }
        .tt-more[open] > summary::before { content: '− '; }

        @media (min-width: 900px) {
          .tt-reg { display: grid; grid-template-columns: 42fr 58fr; align-items: start; }
          .tt-reg__hero {
            position: sticky; top: 62px; min-height: calc(100dvh - 62px);
            display: flex; flex-direction: column;
            border-right: 2px solid var(--ink, #0A0A0A);
          }
          .tt-reg__scene { height: 44vh; max-height: none; flex: 0 0 auto; }
          .tt-reg__bar { flex: 1; padding: 34px 40px; display: flex; flex-direction: column; justify-content: center; }
          .tt-reg__inner { padding: 48px 48px 96px; }
        }
      `}</style>
    </div>
  )
}

/** The submit loader: a ball that bounces rather than a generic spinner. */
function BouncingBall() {
  return (
    <span aria-hidden="true" style={{ display: 'inline-block', width: 14, height: 14, position: 'relative' }}>
      <span
        style={{
          position: 'absolute', inset: 0, borderRadius: '50%', background: 'currentColor',
          animation: 'tt-bounce 0.6s ease-in-out infinite',
        }}
      />
      <style>{`@keyframes tt-bounce { 0%,100% { transform: translateY(0) scaleY(1); } 45% { transform: translateY(-7px) scaleY(1.08); } 55% { transform: translateY(-7px); } 90% { transform: translateY(0) scaleY(0.82); } }`}</style>
    </span>
  )
}
