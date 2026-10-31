import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { EVENT } from '../config'
import { SPORT_ORDER, type PublicEvent, type SportSlug } from '../lib/types'
import { useServerOffset } from '../lib/hooks'
import { LiveCountdown } from '../components/Countdown'
import { daySpan, windowForDay, clockMinutes } from '../lib/format'
import { StarStickers } from '../components/StarStickers'
import { fadeInUp } from '../../lib/motion'

interface Props {
  events: PublicEvent[]
  loading: boolean
  error: string | null
  reload: () => void
}

const STICKER: Record<SportSlug, string> = {
  cricket: '/terrathon/cricket.webp',
  pickleball: '/terrathon/paddle.webp',
  fifa: '/terrathon/controller.webp',
}

const KOLKATA_WEEKDAY_SHORT: Intl.DateTimeFormatOptions = { weekday: 'short', timeZone: 'Asia/Kolkata' }
const KOLKATA_WEEKDAY_LONG: Intl.DateTimeFormatOptions = { weekday: 'long', timeZone: 'Asia/Kolkata' }
const KOLKATA_DAY_NUM: Intl.DateTimeFormatOptions = { day: '2-digit', timeZone: 'Asia/Kolkata' }
const KOLKATA_MONTH: Intl.DateTimeFormatOptions = { month: 'short', timeZone: 'Asia/Kolkata' }

function fmt(iso: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-IN', opts).format(new Date(`${iso}T00:00:00Z`))
}

/** The day after `iso`, as another `yyyy-mm-dd`. */
function addDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** Every date from `first` to `last` inclusive, capped so a bad row can't loop forever. */
function datesBetween(first: string, last: string): string[] {
  const out: string[] = []
  let cur = first
  for (let i = 0; i < 14 && cur <= last; i++) {
    out.push(cur)
    cur = addDay(cur)
  }
  return out
}

/**
 * /terrathon/schedule: a day-by-day timeline, poster board composition.
 *
 * A big Archivo Black date numeral leads each day, with the weekday and sport
 * count underneath, then one slot card per sport running that day carrying its
 * torn-paper sticker, its name in Bungee, its venue as a green meta line, and
 * "Report by" / "Matches" as labelled tabular values. A day-chip filter row
 * up top narrows which days show, and a closing note makes clear reporting
 * time is not kick-off.
 *
 * Days, dates, venues and times all come from `events` (`day_first`/
 * `day_last`, `report_time`, `match_window`, `venue`). Nothing here is a
 * hardcoded fact from the design board.
 */
export function TerraThonSchedule({ events, loading, error, reload }: Props) {
  const offset = useServerOffset()

  const ordered = SPORT_ORDER
    .map((s) => events.find((e) => e.slug === s))
    .filter(Boolean) as PublicEvent[]

  const withDates = ordered.filter((e) => e.day_first)

  const dayMap = new Map<string, PublicEvent[]>()
  for (const e of withDates) {
    const dates = datesBetween(e.day_first as string, e.day_last || (e.day_first as string))
    for (const d of dates) {
      const list = dayMap.get(d) ?? []
      list.push(e)
      dayMap.set(d, list)
    }
  }
  const days = [...dayMap.keys()].sort()
  const firstDay = withDates.reduce<string | null>((min, e) => (
    !min || (e.day_first as string) < min ? (e.day_first as string) : min
  ), null)
  const lastDay = withDates.reduce<string | null>((max, e) => (
    !max || (e.day_last || e.day_first as string) > max ? (e.day_last || e.day_first as string) : max
  ), null)

  const [filter, setFilter] = useState<'all' | string>('all')
  const visibleDays = filter === 'all' ? days : days.filter((d) => d === filter)
  const reduce = useReducedMotion()
  // The timetable: a flat list, one row per sport per visible day, in clock order within the day.
  const tableRows = visibleDays.flatMap((d) => {
    const list = [...(dayMap.get(d) ?? [])]
    list.sort((a, b) => (clockMinutes(a.report_time) ?? 1e9) - (clockMinutes(b.report_time) ?? 1e9) || a.sort_order - b.sort_order)
    return list.map((e, i) => ({ d, e, first: i === 0 }))
  })

  return (
    <div className="tt-wrap tt-page">
      <style>{`
        .ttsc-head { display: flex; align-items: flex-end; gap: var(--tt-sp-6); flex-wrap: wrap; }
        /* 560, not 320. The heading is .tt-h1-poster, which clamps off the
           VIEWPORT at 8.4vw, so at 1280 it wants about 500px, while a 320
           basis handed this column 329 and min-width: 0 let it clip rather
           than push. The basis has to be big enough for the type the column
           carries; the countdown beside it wraps under instead. min() caps the
           basis at the container so a 390px phone does not inherit a 560px
           floor, which pushed the page 23px wide. */
        .ttsc-head__main { flex: 1 1 min(560px, 100%); min-width: 0; }
        /* flex: 1 1 auto with min-width: 0, not 0 0 auto. The flip board inside
           sets its own intrinsic width, and 0 0 auto let the card take it
           whole: measured at 390 it ran to 393 wide starting at x=20, so its
           right edge sat 23px past the viewport. It may now shrink, and the
           board inside wraps. */
        .ttsc-countdown { flex: 1 1 auto; min-width: 0; max-width: 100%; padding: var(--tt-sp-5) var(--tt-sp-6); border: 3px solid var(--tt-hot); border-radius: var(--tt-r-out); }
        .ttsc-daychips { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: var(--tt-block); }
        .ttsc-daychips__label { font-family: var(--tt-code); font-size: 11px; font-weight: 700; letter-spacing: 0.16em; color: var(--tt-ink-3); margin-right: 4px; }
        .ttsc-day { display: grid; gap: var(--tt-sp-5); margin-top: var(--tt-block); }
        .ttsc-dayhead { display: flex; align-items: baseline; gap: 18px; flex-wrap: wrap; }
        .ttsc-daynum {
          font-family: var(--tt-display);
          font-size: clamp(40px, 9vw, 64px);
          line-height: 0.9;
          letter-spacing: -0.03em;
          color: var(--tt-hot);
          font-variant-numeric: tabular-nums;
        }
        .ttsc-daycount {
          font-family: var(--tt-code);
          font-size: var(--tt-fs-meta);
          color: var(--tt-muted);
        }
        .ttsc-slots { display: grid; gap: var(--tt-sp-4); padding-left: var(--tt-sp-6); border-left: 3px solid rgba(221, 108, 238, 0.35); }
        .ttsc-slot {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: var(--tt-sp-4);
        }
        @media (max-width: 720px) {
          .ttsc-slot { grid-template-columns: auto 1fr; }
          .ttsc-slot__act { grid-column: 1 / -1; }
          .ttsc-head { align-items: flex-start; }
        }
        .ttsc-slot__sticker {
          display: flex; align-items: center; justify-content: center;
          width: 64px; height: 64px; flex-shrink: 0;
          background: var(--tt-paper-2, #0E1019);
          border-radius: var(--tt-r-in);
          padding: 8px;
        }
        .ttsc-slot__sticker img { width: 100%; height: 100%; object-fit: contain; display: block; }
        .ttsc-slot__name {
          margin: 0;
        }
        .ttsc-slot__venue {
          margin: 4px 0 0;
          font-family: var(--tt-code);
          font-size: var(--tt-fs-meta);
          color: var(--tt-go);
        }
        .ttsc-slot__facts { display: flex; gap: var(--tt-sp-6); flex-wrap: wrap; margin-top: 10px; }
        .ttsc-fact { display: grid; gap: 2px; }
        .ttsc-fact__label {
          font-family: var(--tt-code);
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--tt-ink-3);
        }
        .ttsc-fact__value {
          font-family: var(--tt-code);
          font-size: var(--tt-fs-body);
          color: var(--tt-ink);
          font-variant-numeric: tabular-nums;
        }
        .ttsc-note {
          margin-top: var(--tt-block);
          display: flex;
          align-items: center;
          gap: var(--tt-sp-6);
          flex-wrap: wrap;
        }
        .ttsc-note__body { flex: 1 1 260px; }
        /* The timetable: one row per sport per day, the whole weekend at a glance. Under 720px each row stacks into a labelled card. */
        .ttsc-tt { margin-top: var(--tt-block); }
        .ttsc-tt__wrap { margin-top: var(--tt-sp-4); border: 3px solid var(--tt-hot); border-radius: var(--tt-r-out); overflow: hidden; }
        .ttsc-table { width: 100%; border-collapse: collapse; font-size: var(--tt-fs-body); }
        .ttsc-table th, .ttsc-table td { padding: 14px 18px; text-align: left; vertical-align: top; border-bottom: 1px solid rgba(221, 108, 238, 0.28); }
        .ttsc-table thead th { font-family: var(--tt-code); font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--tt-ink-3); background: rgba(221, 108, 238, 0.08); }
        .ttsc-table tbody tr:last-child > * { border-bottom: 0; }
        .ttsc-table tr.ttsc-daystart > * { border-top: 3px solid rgba(221, 108, 238, 0.55); }
        .ttsc-table tbody tr:first-child > * { border-top: 0; }
        .ttsc-table__day { font-family: var(--tt-code); font-weight: 700; color: var(--tt-hot); white-space: nowrap; font-variant-numeric: tabular-nums; }
        .ttsc-table__time { font-family: var(--tt-code); font-variant-numeric: tabular-nums; white-space: nowrap; color: var(--tt-ink); }
        .ttsc-table__sport { font-weight: 700; color: var(--tt-ink); }
        .ttsc-table__venue { color: var(--tt-go); font-family: var(--tt-code); font-size: var(--tt-fs-meta); }
        .ttsc-table__tbc { color: var(--tt-muted); font-style: italic; }
        .ttsc-table a { color: inherit; text-decoration: underline; text-underline-offset: 3px; }
        @media (max-width: 720px) {
          .ttsc-table thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
          .ttsc-table, .ttsc-table tbody, .ttsc-table tr, .ttsc-table td { display: block; width: 100%; }
          .ttsc-table tr { padding: 12px 16px; border-bottom: 1px solid rgba(221, 108, 238, 0.28); }
          .ttsc-table tr.ttsc-daystart { border-top: 3px solid rgba(221, 108, 238, 0.55); }
          .ttsc-table tbody tr:first-child { border-top: 0; }
          .ttsc-table th[scope='row'] { display: block; width: 100%; padding: 0 0 6px; border: 0 !important; }
          .ttsc-table td { padding: 3px 0; border: 0 !important; display: flex; gap: 12px; }
          .ttsc-table td::before { content: attr(data-label); flex: 0 0 84px; font-family: var(--tt-code); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--tt-ink-3); padding-top: 3px; }
        }
      `}</style>

      <div className="ttsc-head">
        {/* See Rules.tsx for why the wrapper is positioned. Here the column
            already exists, so it only needs the position, not a new element. */}
        <div className="ttsc-head__main" style={{ position: 'relative', isolation: 'isolate' }}>
          <StarStickers />
          <span className="tt-kick">TerraThon 2026</span>
          <h1 className="tt-h1-poster" style={{ marginTop: 8, textTransform: 'uppercase' }}>The weekend</h1>
          {firstDay && (
            <p className="tt-poster-line" style={{ marginTop: 10, fontSize: 18, color: 'var(--tt-go)' }}>
              {daySpan(firstDay, lastDay)}, Kolkata
            </p>
          )}
          <p style={{ margin: '14px 0 0', maxWidth: 560, fontSize: 'var(--tt-fs-lead)', lineHeight: 1.6, color: 'var(--tt-muted)' }}>
            Three sports across one weekend. Turn up at the reporting time, not the match time.
          </p>
        </div>
        {!loading && !error && days.length > 0 && (
          <div className="ttsc-countdown">
            <LiveCountdown events={events} offset={offset} size="sm" tone="ink" />
          </div>
        )}
      </div>

      {error ? (
        // Never a cheerful empty state after a failure.
        <div className="tt-card" role="alert" style={{ marginTop: 'var(--tt-block)', borderColor: 'var(--tt-danger)' }}>
          <h2 style={{ fontSize: 22 }}>Couldn't load the schedule</h2>
          <p style={{ margin: '8px 0 16px', color: 'var(--tt-muted)', fontSize: 'var(--tt-fs-body)' }}>{error}</p>
          <button type="button" className="tt-btn tt-btn--plain" onClick={reload}>Try again</button>
        </div>
      ) : loading ? (
        <div className="tt-card" style={{ marginTop: 'var(--tt-block)', height: 280, opacity: 0.4 }} aria-hidden="true" />
      ) : days.length === 0 ? (
        <div className="tt-card" style={{ marginTop: 'var(--tt-block)' }}>
          <h2 style={{ fontSize: 22 }}>Dates are being confirmed</h2>
          <p style={{ margin: '8px 0 0', color: 'var(--tt-muted)', fontSize: 'var(--tt-fs-body)' }}>
            The full schedule goes up here the moment venues are locked.
          </p>
        </div>
      ) : (
        <>
          <div className="ttsc-daychips" role="group" aria-label="Filter by day">
            <span className="ttsc-daychips__label" aria-hidden="true">Show</span>
            <button
              type="button"
              className="tt-chip"
              aria-pressed={filter === 'all'}
              style={filter === 'all' ? { background: 'var(--tt-go)', color: '#062B18', borderColor: 'var(--tt-go)' } : undefined}
              onClick={() => setFilter('all')}
            >
              All {days.length} day{days.length === 1 ? '' : 's'}
            </button>
            {days.map((d) => (
              <button
                key={d}
                type="button"
                className="tt-chip"
                aria-pressed={filter === d}
                style={filter === d ? { background: 'var(--tt-go)', color: '#062B18', borderColor: 'var(--tt-go)' } : undefined}
                onClick={() => setFilter(d)}
              >
                {fmt(d, KOLKATA_WEEKDAY_SHORT)} {fmt(d, KOLKATA_DAY_NUM)}
              </button>
            ))}
          </div>


          <section className="ttsc-tt" aria-labelledby="ttsc-tt-h">
            <h2 id="ttsc-tt-h" className="tt-poster-line" style={{ fontSize: 24, margin: 0 }}>Timetable</h2>
            <div className="ttsc-tt__wrap">
              <table className="ttsc-table">
                <caption className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                  TerraThon 2026 timetable: each sport, its day, venue, reporting time and match times
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Day</th>
                    <th scope="col">Report by</th>
                    <th scope="col">Matches</th>
                    <th scope="col">Sport</th>
                    <th scope="col">Venue</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map(({ d, e, first }) => {
                    const matches = windowForDay(e.match_window, d)
                    return (
                      <tr key={`${d}-${e.slug}`} className={first ? 'ttsc-daystart' : undefined}>
                        <th scope="row" className="ttsc-table__day" data-label="Day">
                          {fmt(d, KOLKATA_WEEKDAY_SHORT)} {fmt(d, KOLKATA_DAY_NUM)} {fmt(d, KOLKATA_MONTH)}
                        </th>
                        <td className="ttsc-table__time" data-label="Report by">{e.report_time ?? <span className="ttsc-table__tbc">To be confirmed</span>}</td>
                        <td className="ttsc-table__time" data-label="Matches">{matches ?? <span className="ttsc-table__tbc">To be confirmed</span>}</td>
                        <td className="ttsc-table__sport" data-label="Sport"><Link to={`${EVENT.base}/${e.slug}`}>{e.display_name}</Link></td>
                        <td className="ttsc-table__venue" data-label="Venue">{e.venue ?? <span className="ttsc-table__tbc">Venue to be confirmed</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {visibleDays.map((d, di) => {
            const dayEvents = dayMap.get(d) ?? []
            return (
              <motion.section
                key={d}
                className="ttsc-day"
                aria-label={`${fmt(d, KOLKATA_WEEKDAY_LONG)}, ${fmt(d, KOLKATA_DAY_NUM)} ${fmt(d, KOLKATA_MONTH)}`}
                initial={reduce ? false : fadeInUp.hidden}
                whileInView={fadeInUp.visible}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.28, ease: [0.2, 0, 0, 1], delay: reduce ? 0 : Math.min(di * 0.08, 0.4) }}
              >
                <div className="ttsc-dayhead">
                  <span className="ttsc-daynum" aria-hidden="true">{fmt(d, KOLKATA_DAY_NUM)}</span>
                  <div>
                    <div className="tt-poster-line" style={{ fontSize: 18 }}>{fmt(d, KOLKATA_WEEKDAY_LONG)}</div>
                    <div className="ttsc-daycount">{dayEvents.length} sport{dayEvents.length === 1 ? '' : 's'} running</div>
                  </div>
                </div>

                <div className="ttsc-slots">
                  {dayEvents.map((e) => (
                    <div key={e.slug} className="tt-card tt-card--flat ttsc-slot">
                      <div className="ttsc-slot__sticker">
                        <img src={STICKER[e.slug]} alt="" width={800} height={800} loading="lazy" decoding="async" />
                      </div>
                      <div>
                        <h3 className="ttsc-slot__name tt-poster-line" style={{ fontSize: 22 }}>{e.display_name}</h3>
                        <p className="ttsc-slot__venue">{e.venue ?? 'Venue to be confirmed'}</p>
                        <div className="ttsc-slot__facts">
                          <div className="ttsc-fact">
                            <span className="ttsc-fact__label">Report by</span>
                            <span className="ttsc-fact__value">{e.report_time ?? 'To be confirmed'}</span>
                          </div>
                          <div className="ttsc-fact">
                            <span className="ttsc-fact__label">Matches</span>
                            <span className="ttsc-fact__value">{e.match_window ?? 'To be confirmed'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="ttsc-slot__act">
                        <Link to={`${EVENT.base}/${e.slug}`} className="tt-btn tt-btn--quiet">
                          {e.display_name} page
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.section>
            )
          })}
        </>
      )}

      {days.length > 0 && (
        <div className="tt-plate ttsc-note">
          <div className="ttsc-note__body">
            <h2 className="tt-poster-line" style={{ fontSize: 20, margin: 0 }}>Reporting time is not kick-off</h2>
            <p style={{ margin: '8px 0 0', fontSize: 'var(--tt-fs-body)', lineHeight: 1.55 }}>
              Turn up at the reporting time, not the match time. Fixtures are drawn on the day and a
              squad that is not there when its name is called forfeits. Exact fixtures land in the
              WhatsApp group the night before.
            </p>
          </div>
          <Link to={`${EVENT.base}/register`} className="tt-btn tt-btn--go">Register now</Link>
        </div>
      )}
    </div>
  )
}
