import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useMeta } from '../hooks/useMeta'
import calendarService, { DriveEvent, BirthdayMember } from '../services/calendarService'
import { MemberBreak } from '../services/breakService'
import { JobOpening } from '../lib/jobOpenings'
import { FOUNDED_YEAR } from '../lib/orgFacts'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import Skeleton from '../components/Skeleton'

// /calendar - a new authed, member-facing route (handoff/21 §4). Read-only:
// four toggleable layers (welfare drives, the viewer's own exam breaks, job/
// SOP deadlines, opted-in birthdays) over a month grid (>=900px) or an
// agenda list (mobile). No new tables - see services/calendarService.ts.
//
// Rebuilt here in THIS branch's neubrutalist front-end system (hard ink
// borders/offset shadows, rotated .sticker badges, chip toggles) rather than
// the ink-seam/soft-card system the redesign branch's version used - see
// CLAUDE.md's design-language section. Functional behavior (service calls,
// the 4-layer toggle, responsive split, business rules) is unchanged.

type LayerKey = 'drives' | 'breaks' | 'deadlines' | 'birthdays'

const LAYER_META: Record<LayerKey, { label: string; color: string }> = {
  drives:    { label: 'drives',    color: 'var(--c-welfare)' },
  breaks:    { label: 'my breaks', color: 'var(--grape)' },
  deadlines: { label: 'deadlines', color: 'var(--c-events)' },
  birthdays: { label: 'birthdays', color: 'var(--pink)' },
}

const pad = (n: number) => String(n).padStart(2, '0')
const dateKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
const MONTH_NAMES = ['january','february','march','april','may','june','july','august','september','october','november','december']
const WEEKDAY_LABELS = ['S','M','T','W','T','F','S']

/** Every calendar day between start and end (inclusive), capped at 120 days
 *  as a sanity bound - a real exam break is never that long, and this just
 *  protects the grid build from a malformed row. */
function daysBetween(start: string, end: string): string[] {
  const out: string[] = []
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return out
  let cur = s
  let guard = 0
  while (cur.getTime() <= e.getTime() && guard < 120) {
    out.push(dateKey(cur.getFullYear(), cur.getMonth(), cur.getDate()))
    cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1)
    guard++
  }
  return out
}

interface DayEvents {
  drives: DriveEvent[]
  breaks: MemberBreak[]
  deadlines: JobOpening[]
  birthdays: (BirthdayMember & { isSelf?: boolean })[]
}

function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: 7, height: 7, borderRadius: '50%', background: color, border: '1px solid rgba(10,10,10,0.18)', flexShrink: 0 }}
    />
  )
}

export default function CalendarPage() {
  useMeta({ title: 'Your calendar | AquaTerra', description: 'Welfare drives, your exam breaks, hiring deadlines and opted-in birthdays, all in one AquaTerra calendar.', noIndex: true })
  const { member } = useAuth()

  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth()) // 0-indexed

  const [drives, setDrives] = useState<DriveEvent[]>([])
  const [myBreaks, setMyBreaks] = useState<MemberBreak[]>([])
  const [deadlines, setDeadlines] = useState<JobOpening[]>([])
  const [birthdays, setBirthdays] = useState<BirthdayMember[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [layerOn, setLayerOn] = useState<Record<LayerKey, boolean>>({
    drives: true, breaks: true, deadlines: true, birthdays: true,
  })
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const load = useCallback(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setLoadError(null)
      const results = await Promise.allSettled([
        calendarService.getDrives(),
        calendarService.getMyBreaks(),
        calendarService.getDeadlines(),
        calendarService.getPublicBirthdays(),
      ])
      if (cancelled) return
      const [d, b, j, bd] = results
      if (d.status === 'fulfilled') setDrives(d.value)
      if (b.status === 'fulfilled') setMyBreaks(b.value)
      if (j.status === 'fulfilled') setDeadlines(j.value)
      if (bd.status === 'fulfilled') setBirthdays(bd.value)
      if (results.every(r => r.status === 'rejected')) {
        setLoadError("couldn't load the calendar. try refreshing.")
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => load(), [load])

  // ── index everything by day key for O(1) lookups while building the grid ──
  const drivesByDate = useMemo(() => {
    const m = new Map<string, DriveEvent[]>()
    for (const d of drives) { if (!m.has(d.date)) m.set(d.date, []); m.get(d.date)!.push(d) }
    return m
  }, [drives])

  const deadlinesByDate = useMemo(() => {
    const m = new Map<string, JobOpening[]>()
    for (const j of deadlines) {
      if (!j.deadline) continue
      const key = j.deadline.slice(0, 10)
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(j)
    }
    return m
  }, [deadlines])

  const breaksByDate = useMemo(() => {
    const m = new Map<string, MemberBreak[]>()
    for (const b of myBreaks) {
      for (const key of daysBetween(b.start, b.end)) {
        if (!m.has(key)) m.set(key, [])
        m.get(key)!.push(b)
      }
    }
    return m
  }, [myBreaks])

  // Birthdays recur every year - indexed by "month-day", not a specific date.
  // The viewer's own birthday always shows regardless of birthday_public.
  const birthdaysByMonthDay = useMemo(() => {
    const m = new Map<string, (BirthdayMember & { isSelf?: boolean })[]>()
    const add = (bd: BirthdayMember & { isSelf?: boolean }) => {
      const key = `${bd.month}-${bd.day}`
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(bd)
    }
    for (const bd of birthdays) add(bd)
    if (member?.birthday) {
      const d = new Date(member.birthday + 'T00:00:00')
      if (!Number.isNaN(d.getTime())) {
        add({ uuid: member.uuid, fullName: member.full_name, month: d.getMonth(), day: d.getDate(), isSelf: true })
      }
    }
    return m
  }, [birthdays, member])

  const eventsForDay = useCallback((y: number, m: number, d: number): DayEvents => {
    const key = dateKey(y, m, d)
    return {
      drives: layerOn.drives ? (drivesByDate.get(key) || []) : [],
      breaks: layerOn.breaks ? (breaksByDate.get(key) || []) : [],
      deadlines: layerOn.deadlines ? (deadlinesByDate.get(key) || []) : [],
      birthdays: layerOn.birthdays ? (birthdaysByMonthDay.get(`${m}-${d}`) || []) : [],
    }
  }, [layerOn, drivesByDate, breaksByDate, deadlinesByDate, birthdaysByMonthDay])

  const totalCount = (ev: DayEvents) => ev.drives.length + ev.breaks.length + ev.deadlines.length + ev.birthdays.length

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay()
  const isToday = (y: number, m: number, d: number) => y === today.getFullYear() && m === today.getMonth() && d === today.getDate()

  const goPrevMonth = () => {
    setSelectedDay(null)
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) } else setViewMonth(m => m - 1)
  }
  const goNextMonth = () => {
    setSelectedDay(null)
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) } else setViewMonth(m => m + 1)
  }
  const goToday = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setSelectedDay(dateKey(today.getFullYear(), today.getMonth(), today.getDate())) }

  const toggleLayer = (k: LayerKey) => setLayerOn(prev => ({ ...prev, [k]: !prev[k] }))

  // "N drives since {FOUNDED_YEAR}" - only shown once real data has loaded,
  // never as a placeholder while fetching.
  const driveCountLine = !loading && drives.length > 0 ? `${drives.length} drives since ${FOUNDED_YEAR}` : null

  const selected = selectedDay
    ? (() => {
        const [y, m, d] = selectedDay.split('-').map(Number)
        return { y, m: m - 1, d, events: eventsForDay(y, m - 1, d) }
      })()
    : null

  // ── agenda (mobile): every day in the viewed month that has at least one
  // visible event, in order. ──────────────────────────────────────────────
  const agendaDays = useMemo(() => {
    const out: { y: number; m: number; d: number; events: DayEvents }[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      const ev = eventsForDay(viewYear, viewMonth, d)
      if (totalCount(ev) > 0) out.push({ y: viewYear, m: viewMonth, d, events: ev })
    }
    return out
  }, [viewYear, viewMonth, daysInMonth, eventsForDay])

  return (
    <div className="route-enter">
      {/* ── Hero ── */}
      <section style={{
        background: 'var(--bg-2)',
        padding: 'clamp(32px,5vw,56px) var(--page-px,24px) clamp(20px,3vw,32px)',
        borderBottom: 'var(--hair-2)',
      }}>
        <div className="container">
          <span className="sticker sticker-mint wobble sticker--diecut" style={{ ['--sticker-ground' as string]: 'var(--bg)' }}>★ CALENDAR</span>
          <h1 className="h-display" style={{ fontSize: 'clamp(44px, 7vw, 80px)', margin: '10px 0 0', lineHeight: 0.92 }}>
            what's <span style={{ fontStyle: 'italic', fontFamily: 'var(--serif)', fontWeight: 400, color: 'var(--welfare-ink)' }}>happening</span>.
          </h1>
          <p className="muted" style={{ marginTop: 8, fontSize: 14, fontFamily: 'var(--code)', fontVariantNumeric: 'tabular-nums' }}>
            {driveCountLine || 'welfare drives, your breaks, deadlines and birthdays'}
          </p>
        </div>
      </section>

      <div className="container" style={{ paddingTop: 'clamp(20px,4vw,28px)', paddingBottom: 100 }}>
        {/* ── Toolbar: month nav + layer toggles ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          {/* flexWrap here (missing before) is the fix for a measured 8px
              overflow at 360px: prev + a 168px-min month label (fixed so the
              label's own width change across months doesn't shift the
              buttons) + next + "today" don't fit One row's worth of
              360px minus the container's padding. Wrapping only engages
              this narrow - it stays one line at 375px and up, already
              measured clean. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <button className="btn btn-icon" onClick={goPrevMonth} aria-label="previous month" title="previous month">‹</button>
            <span className="h-display" style={{ fontSize: 19, minWidth: 168, textAlign: 'center' }}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button className="btn btn-icon" onClick={goNextMonth} aria-label="next month" title="next month">›</button>
            <button className="btn btn-sm" onClick={goToday}>today</button>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/* 00.7: an active filter chip is ink, not the category's own hue -
                a colour-filled "on" state is exactly the "category-colour
                collision" 00.7 retired .chip.cat for. The hue survives as the
                .chip-dot marker in both states. (.chip-active, not .chip.on -
                that's the class the codebase actually shipped 00.7 under;
                see v6.css line ~528. A separate, stale !important override
                further down v6.css was silently cancelling it product-wide
                until this pass deleted it.) */}
            {(Object.keys(LAYER_META) as LayerKey[]).map(k => {
              const meta = LAYER_META[k]
              const on = layerOn[k]
              return (
                <button
                  key={k}
                  className={on ? 'chip chip-active' : 'chip'}
                  onClick={() => toggleLayer(k)}
                  aria-pressed={on}
                >
                  <span className="chip-dot" aria-hidden="true" style={{ background: meta.color }} />
                  {meta.label}
                </button>
              )
            })}
          </div>
        </div>

        {loadError && (
          <ErrorState message={loadError} hint="check your connection and try again." onRetry={load} className="mb-4" />
        )}

        {loading ? (
          <Skeleton variant="card" height={420} />
        ) : (
          <>
            {/* ── Desktop: month grid ── */}
            <div className="cal-grid-view">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
                {WEEKDAY_LABELS.map((w, i) => (
                  <div key={i} className="mono xs muted" style={{ textAlign: 'center', fontWeight: 700, padding: '4px 0' }}>{w}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                {Array.from({ length: firstWeekday }).map((_, i) => (
                  <div key={`empty-${i}`} aria-hidden="true" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const d = i + 1
                  const ev = eventsForDay(viewYear, viewMonth, d)
                  const count = totalCount(ev)
                  const key = dateKey(viewYear, viewMonth, d)
                  const dToday = isToday(viewYear, viewMonth, d)
                  const dSelected = selectedDay === key
                  // The day cell's own fill, so the count badge's die-cut
                  // keyline (13.1: "the colour BEHIND it") can match it.
                  const dayFill = dSelected ? 'var(--lemon)' : dToday ? 'var(--bg-3)' : 'var(--card)'
                  return (
                    <button
                      key={d}
                      onClick={() => setSelectedDay(selectedDay === key ? null : key)}
                      style={{
                        position: 'relative',
                        aspectRatio: '1',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
                        gap: 4,
                        padding: '7px 4px 8px',
                        background: dayFill,
                        border: dToday || dSelected ? 'var(--hair-2)' : 'var(--hair)',
                        borderRadius: 'var(--r-tight)',
                        boxShadow: dSelected ? 'var(--lift-2)' : 'none',
                        cursor: 'pointer',
                        transition: 'box-shadow .12s',
                      }}
                    >
                      <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{d}</span>
                      {count > 0 && (
                        // Ink fill (never the same hue as any of the three
                        // possible day-cell grounds) so the badge stays
                        // readable regardless of state; the die-cut keyline
                        // still matches whichever ground is actually behind
                        // it (13.1), so it reads as cut into that ground
                        // rather than floating with a mismatched ring.
                        <span
                          className="sticker sticker--diecut"
                          aria-hidden="true"
                          style={{ position: 'absolute', top: -8, right: -6, padding: '1px 6px', fontSize: 10, minWidth: 0, background: 'var(--ink)', color: 'var(--paper)', ['--sticker-ground' as string]: dayFill }}
                        >
                          {count}
                        </span>
                      )}
                      {count > 0 && (
                        <div style={{ display: 'flex', gap: 3, marginTop: 'auto' }}>
                          {ev.drives.length > 0 && <Dot color={LAYER_META.drives.color} />}
                          {ev.breaks.length > 0 && <Dot color={LAYER_META.breaks.color} />}
                          {ev.deadlines.length > 0 && <Dot color={LAYER_META.deadlines.color} />}
                          {ev.birthdays.length > 0 && <Dot color={LAYER_META.birthdays.color} />}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {selected && (
                <DayPanel y={selected.y} m={selected.m} d={selected.d} events={selected.events} />
              )}
            </div>

            {/* ── Mobile: agenda list ── */}
            <div className="cal-agenda-view">
              {agendaDays.length === 0 ? (
                <EmptyState
                  icon="🗓️"
                  title="nothing this month."
                  hint="try another month, or check back later."
                  action={<button type="button" className="btn" onClick={goToday}>jump to today</button>}
                  secondary={<Link to="/projects" className="btn btn-primary">browse past drives →</Link>}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {agendaDays.map(({ y, m, d, events }) => (
                    <div key={`${y}-${m}-${d}`}>
                      <div className="mono xs" style={{ fontWeight: 700, marginBottom: 8, color: isToday(y, m, d) ? 'var(--welfare-ink)' : 'var(--ink-2)' }}>
                        {MONTH_NAMES[m].slice(0, 3)} {d}{isToday(y, m, d) ? ' · today' : ''}
                      </div>
                      <AgendaItems events={events} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Month grid on >=900px, agenda list below that breakpoint - matches
          the rest of the front-end's responsive convention (MembersPage,
          TeamsPage use the same 900px band for grid->stack collapses). */}
      <style>{`
        .cal-grid-view { display: block; }
        .cal-agenda-view { display: none; }
        @media (max-width: 899px) {
          .cal-grid-view { display: none; }
          .cal-agenda-view { display: block; }
        }
      `}</style>
    </div>
  )
}

function DayPanel({ y, m, d, events }: { y: number; m: number; d: number; events: DayEvents }) {
  const count = events.drives.length + events.breaks.length + events.deadlines.length + events.birthdays.length
  return (
    <div className="card" style={{ marginTop: 18, padding: '18px 20px' }}>
      <h3 className="h-display" style={{ fontSize: 20, marginBottom: 12 }}>{MONTH_NAMES[m]} {d}, {y}</h3>
      {count === 0 ? (
        <p className="mono xs muted">nothing on this day.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {events.drives.map(dr => (
            <div key={`dr-${dr.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Dot color={LAYER_META.drives.color} />
              <Link to={`/projects/${dr.slug}`} style={{ fontWeight: 600, fontSize: 14 }}>{dr.title}</Link>
            </div>
          ))}
          {events.breaks.map(b => (
            <div key={`brk-${b.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Dot color={LAYER_META.breaks.color} />
              <span style={{ fontSize: 14 }}>on a break · {b.reason}</span>
            </div>
          ))}
          {events.deadlines.map(j => (
            <div key={`dl-${j.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Dot color={LAYER_META.deadlines.color} />
              <Link to={`/opportunities/${j.id}`} style={{ fontWeight: 600, fontSize: 14 }}>{j.title} closes</Link>
            </div>
          ))}
          {events.birthdays.map(bd => (
            <div key={`bd-${bd.uuid}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Dot color={LAYER_META.birthdays.color} />
              <span style={{ fontSize: 14 }}>{bd.isSelf ? 'your birthday' : `${bd.fullName}'s birthday`}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AgendaItems({ events }: { events: DayEvents }) {
  // Flatten all four layers into one ordered list up front so the divider
  // between rows can correctly omit itself on the true last row, regardless
  // of which layer(s) happen to be toggled off for this day.
  const rows: { key: string; color: string; content: React.ReactNode; to?: string }[] = [
    ...events.drives.map(dr => ({ key: `dr-${dr.id}`, color: LAYER_META.drives.color, content: dr.title, to: `/projects/${dr.slug}` })),
    ...events.breaks.map(b => ({ key: `brk-${b.id}`, color: LAYER_META.breaks.color, content: `on a break · ${b.reason}` })),
    ...events.deadlines.map(j => ({ key: `dl-${j.id}`, color: LAYER_META.deadlines.color, content: `${j.title} closes`, to: `/opportunities/${j.id}` })),
    ...events.birthdays.map(bd => ({ key: `bd-${bd.uuid}`, color: LAYER_META.birthdays.color, content: bd.isSelf ? 'your birthday' : `${bd.fullName}'s birthday` })),
  ]
  return (
    <div className="card" style={{ padding: '6px 16px' }}>
      {rows.map((row, i) => {
        const rowStyle: React.CSSProperties = {
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
          borderBottom: i === rows.length - 1 ? 'none' : 'var(--hair)',
        }
        return row.to ? (
          <Link key={row.key} to={row.to} style={rowStyle}>
            <Dot color={row.color} />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{row.content}</span>
          </Link>
        ) : (
          <div key={row.key} style={rowStyle}>
            <Dot color={row.color} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>{row.content}</span>
          </div>
        )
      })}
    </div>
  )
}
