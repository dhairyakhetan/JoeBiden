// The About-page hero: the whole organisation as one interactive picture.
// AquaTerra > departments > sub-departments > people, in one stage.
//
//   - Departments are cards in their own hue, joined to AquaTerra by connector curves that draw in.
//   - A department inside another (Marketing holds Social Media) opens inside its parent.
//   - Tap a card to open its panel: what is inside it, then its people. Tap a chip to go one level deeper;
//     the breadcrumb takes you back up. Every node ends in a real link to its own page.
//   - A search box finds a person, a department or a sub-department and opens straight to it.
//
// Report 717b4b00 and the owner's brief of 2026-10-13 ("make the department structure the hero of the
// about page and a really sexy interactive experience"). Public: people are shown to everyone (owner,
// 2026-10-13), the same fields the team pages already show.
//
// Motion honours prefers-reduced-motion (connectors and cards render in place, no spotlight). Every
// control is a real button or link. Nothing here writes data.
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import teamService, { type DepartmentTreeTeam } from '../services/teamService'
import type { ChartPerson, ChartRoster } from '../lib/chartRoster'
import { buildStage, countTeams, insideChips, openingsByNode, resolvePath, searchStage, type OpeningRef, type StageDept, type StageHit, type StagePath } from '../lib/orgStage'
import { jobOpenings } from '../lib/jobOpenings'
import { deptColorForTeamName, isDarkDepartmentFill } from '../lib/departments'
import { getInitials, hashColor } from '../lib/uiHelpers'
import { springSoft, tapScale } from '../lib/motion'
import { CountUp } from './CountUp'
import Img from './Img'
import './OrgHero.css'

const STACK = 4
const PANEL_PEOPLE_MAX = 72
/** Teams named on a department card before "+N more". High enough that the largest department shows all of them. */
const CARD_CHIPS = 10

/** A department's hue: its own, else its first inner department's, else teal. */
function hueFor(d: StageDept): string {
  return deptColorForTeamName(d.name) || d.kids.map(k => deptColorForTeamName(k.name)).find(Boolean) || 'var(--teal)'
}

function Avatar({ person, size, className = '' }: { person: ChartPerson; size: number; className?: string }) {
  return (
    <span className={'oh-avatar ' + className} style={{ width: size, height: size, background: hashColor(person.name) }}>
      {person.avatarUrl
        ? <Img ctx="avatar" src={person.avatarUrl} alt="" referrerPolicy="no-referrer" />
        : <span aria-hidden="true" style={{ fontSize: Math.round(size * 0.36) }}>{getInitials(person.name)}</span>}
    </span>
  )
}

interface Curve { uuid: string; d: string }

/** CSS variables for a department's wire: its hue, and the paper glow stands in for a dark hue. */
function wireVars(d: StageDept | undefined): React.CSSProperties {
  if (!d) return {}
  const hue = hueFor(d)
  return { ['--dept' as string]: hue, ['--glow' as string]: isDarkDepartmentFill(hue) ? 'var(--paper)' : hue }
}

export default function OrgHero() {
  const reduced = !!useReducedMotion()
  const uid = useId()
  const panelId = `oh-panel-${uid}`
  const [tree, setTree] = useState<DepartmentTreeTeam[] | null>(null)
  const [roster, setRoster] = useState<ChartRoster | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [path, setPath] = useState<StagePath | null>(null)
  const [query, setQuery] = useState('')
  const [hit, setHit] = useState<string | null>(null)
  const [curves, setCurves] = useState<Curve[]>([])

  const stageRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLAnchorElement>(null)
  const cardRefs = useRef(new Map<string, HTMLButtonElement>())
  const panelRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const lastCard = useRef<string | null>(null)
  const opened = useRef(false)

  // ── data ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setFailed(false)
    teamService.getDepartmentTree()
      .then(t => { if (!cancelled) setTree(t) })
      .catch(() => { if (!cancelled) setFailed(true) })
    // People are an extra: if they fail the stage still shows every department and its count.
    teamService.getChartRoster()
      .then(r => { if (!cancelled) setRoster(r) })
      .catch(() => { if (!cancelled) setRoster(null) })
    return () => { cancelled = true }
  }, [attempt])

  const stage = useMemo(() => (tree ? buildStage(tree, roster) : []), [tree, roster])
  // Which teams are hiring: open roles placed on the chart. A failed fetch just means no markers; the chart never depends on it.
  const [openings, setOpenings] = useState<OpeningRef[]>([])
  useEffect(() => {
    let cancelled = false
    jobOpenings.getOpen()
      .then(r => { if (!cancelled) setOpenings(r.map(o => ({ id: o.id, title: o.title, teamId: o.teamId, teamName: o.teamName }))) })
      .catch(() => { /* no markers */ })
    return () => { cancelled = true }
  }, [])
  const openMap = useMemo(() => openingsByNode(stage, openings), [stage, openings])
  const now = useMemo(() => resolvePath(stage, path), [stage, path])
  const hits = useMemo(() => searchStage(stage, query), [stage, query])
  const total = useMemo(() => stage.reduce((n, d) => n + d.count, 0), [stage])
  const teamTotal = useMemo(() => countTeams(stage), [stage])

  // ── connectors: a curve from AquaTerra to every department card ─────────
  const measure = useCallback(() => {
    const stageEl = stageRef.current
    const rootEl = rootRef.current
    if (!stageEl || !rootEl) return
    const s = stageEl.getBoundingClientRect()
    const r = rootEl.getBoundingClientRect()
    const rx = r.left + r.width / 2 - s.left
    const ry = r.bottom - s.top
    const next: Curve[] = []
    cardRefs.current.forEach((el, uuid) => {
      const c = el.getBoundingClientRect()
      const cx = c.left + c.width / 2 - s.left
      const cy = c.top - s.top
      const bend = Math.max(36, (cy - ry) * 0.5)
      next.push({ uuid, d: `M ${rx} ${ry} C ${rx} ${ry + bend}, ${cx} ${cy - bend}, ${cx} ${cy}` })
    })
    setCurves(next)
  }, [])

  useLayoutEffect(() => {
    if (!stage.length) return
    measure()
    const ro = new ResizeObserver(() => measure())
    if (stageRef.current) ro.observe(stageRef.current)
    return () => ro.disconnect()
  }, [stage.length, measure])

  // ── open / close, focus and scroll ──────────────────────────────────────
  const pathKey = path ? `${path.dept}/${path.kid ?? ''}/${path.sub ?? ''}` : ''
  useEffect(() => {
    if (!path || !opened.current) return
    headingRef.current?.focus({ preventScroll: true })
    panelRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathKey])

  const open = (next: StagePath, fromCard?: string) => {
    opened.current = true
    if (fromCard) lastCard.current = fromCard
    setPath(next)
  }
  const close = () => {
    setPath(null)
    setHit(null)
    const back = lastCard.current ? cardRefs.current.get(lastCard.current) : null
    back?.focus({ preventScroll: true })
  }

  const pick = (h: StageHit) => {
    open(h.path, h.path.dept)
    setQuery('')
    setHit(h.personUuid ?? null)
    if (h.personUuid) window.setTimeout(() => setHit(null), 5000)
  }

  useEffect(() => {
    if (!path) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])

  // A soft spotlight that follows a mouse. Not for touch, not for reduced motion.
  const onPointerMove = (e: React.PointerEvent) => {
    if (reduced || e.pointerType !== 'mouse') return
    const el = stageRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - r.left}px`)
    el.style.setProperty('--my', `${e.clientY - r.top}px`)
  }

  // ── render ──────────────────────────────────────────────────────────────
  const reveal = reduced
    ? {}
    : { initial: 'hidden' as const, animate: 'visible' as const, variants: { hidden: {}, visible: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } } } }
  const card = reduced
    ? {}
    : { variants: { hidden: { opacity: 0, transform: 'translateY(18px) scale(0.97)' }, visible: { opacity: 1, transform: 'translateY(0px) scale(1)', transition: springSoft } } }

  return (
    <div className="oh" ref={stageRef} onPointerMove={onPointerMove}>
      <div className="oh-spot" aria-hidden />

      <div className="oh-toolbar">
        <div className="oh-search">
          <label className="oh-search-label" htmlFor={`${panelId}-q`}>find a person or a team</label>
          <input
            id={`${panelId}-q`}
            className="oh-search-input"
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="try a name, a team, a sub-team"
            autoComplete="off"
            spellCheck={false}
            disabled={!stage.length}
            aria-controls={`${panelId}-hits`}
          />
          {query.trim().length >= 2 && (
            <ul id={`${panelId}-hits`} className="oh-hits" aria-label="search results">
              {hits.length === 0 && <li className="oh-hit-none">nothing matches that</li>}
              {hits.map(h => (
                <li key={h.kind + h.label + (h.personUuid ?? '') + h.detail}>
                  <button type="button" className="oh-hit" onClick={() => pick(h)}>
                    <span className={'oh-hit-kind oh-hit-' + h.kind}>{h.kind === 'person' ? 'person' : h.kind === 'sub' ? 'sub-team' : 'team'}</span>
                    <span className="oh-hit-label">{h.label}</span>
                    <span className="oh-hit-detail">{h.detail}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {stage.length > 0 && (
          <p className="oh-total" aria-live="polite">
            <CountUp value={total} className="oh-total-n" /> on a team, <CountUp value={teamTotal} className="oh-total-n" /> teams, {stage.length} departments
          </p>
        )}
      </div>

      <div className="oh-root-wrap">
        <Link ref={rootRef} to="/teams" className="oh-root">
          <span className="oh-root-ring" aria-hidden />
          AquaTerra
        </Link>
      </div>

      {curves.length > 0 && (
        <svg className="oh-wires" aria-hidden focusable="false">
          {curves.map((c, i) => (
            <motion.path
              key={c.uuid}
              d={c.d}
              className={'oh-wire' + (path?.dept === c.uuid ? ' is-on' : '') + (path && path.dept !== c.uuid ? ' is-off' : '')}
              style={wireVars(stage.find(d => d.uuid === c.uuid))}
              initial={reduced ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={reduced ? { duration: 0 } : { duration: 0.9, delay: 0.25 + i * 0.07, ease: [0.2, 0, 0, 1] }}
            />
          ))}
        </svg>
      )}

      {failed && (
        <div className="oh-state" role="alert">
          <p>couldn't load the structure just now.</p>
          <button type="button" className="oh-retry" onClick={() => { setTree(null); setAttempt(a => a + 1) }}>try again</button>
        </div>
      )}

      {!tree && !failed && (
        <div className="oh-grid oh-grid-skeleton" aria-hidden>
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="oh-card oh-skel" />)}
        </div>
      )}

      {stage.length > 0 && (
        <motion.div className={'oh-grid' + (path ? ' has-active' : '')} role="list" {...reveal}>
          {stage.map(d => {
            const hue = hueFor(d)
            const dark = isDarkDepartmentFill(hue)
            const active = path?.dept === d.uuid
            const chips = insideChips(d)
            const shownChips = chips.slice(0, CARD_CHIPS)
            return (
              <motion.div key={d.uuid} role="listitem" className="oh-cell" {...card}>
                <motion.button
                  type="button"
                  ref={el => { if (el) cardRefs.current.set(d.uuid, el); else cardRefs.current.delete(d.uuid) }}
                  className={'oh-card' + (active ? ' is-active' : '') + (dark ? ' is-onink' : '')}
                  style={{ ['--dept' as string]: hue }}
                  aria-expanded={active}
                  aria-controls={panelId}
                  onClick={() => (active && !path?.kid && !path?.sub ? close() : open({ dept: d.uuid }, d.uuid))}
                  whileTap={reduced ? undefined : tapScale}
                >
                  <span className="oh-card-kicker">department</span>
                  {(openMap.get(d.uuid)?.length ?? 0) > 0 && <span className="oh-card-hiring">{openMap.get(d.uuid)!.length} open</span>}
                  <span className="oh-card-name">{d.name}</span>
                  <span className="oh-card-count"><CountUp value={d.count} durationMs={900} /><small>members</small></span>
                  <span className="oh-stack" aria-hidden>
                    {d.people.slice(0, STACK).map(p => <Avatar key={p.uuid} person={p} size={26} />)}
                    {d.people.length > STACK && <span className="oh-stack-more">+{d.people.length - STACK}</span>}
                  </span>
                  <span className="oh-card-chips">
                    {shownChips.length === 0 && <span className="oh-mini">one team</span>}
                    {shownChips.map(c => <span key={c.key} className="oh-mini">{c.label}<HireDot n={openMap.get(c.key)?.length ?? 0} /><b>{c.count}</b></span>)}
                    {chips.length > shownChips.length && <span className="oh-mini oh-mini-more">+{chips.length - shownChips.length} more</span>}
                  </span>
                </motion.button>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      <AnimatePresence initial={false}>
        {now && (
          <Panel
            key="panel"
            id={panelId}
            now={now}
            hit={hit}
            reduced={reduced}
            openMap={openMap}
            onGo={p => open(p)}
            onClose={close}
            panelRef={panelRef}
            headingRef={headingRef}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/** A small marker beside a team that has open roles. Nothing when there are none. */
function HireDot({ n }: { n: number }) {
  if (n <= 0) return null
  return <i className="oh-hire" role="img" aria-label={`${n} open ${n === 1 ? 'role' : 'roles'}`} title={`${n} open ${n === 1 ? 'role' : 'roles'}`} />
}

// ── the panel ──────────────────────────────────────────────────────────────
function Panel({ id, now, hit, reduced, openMap, onGo, onClose, panelRef, headingRef }: {
  id: string
  openMap: Map<string, OpeningRef[]>
  now: NonNullable<ReturnType<typeof resolvePath>>
  hit: string | null
  reduced: boolean
  onGo: (p: StagePath) => void
  onClose: () => void
  panelRef: React.RefObject<HTMLElement | null>
  headingRef: React.RefObject<HTMLHeadingElement | null>
}) {
  const { dept, kid, sub } = now
  const holder = kid ?? dept
  const hue = hueFor(dept)
  const dark = isDarkDepartmentFill(hue)
  const people = sub ? sub.people : holder.people
  const count = sub ? sub.count : holder.count
  const title = sub ? sub.name : holder.name
  const to = sub ? `/teams/${holder.uuid}/sub/${sub.slug}` : `/teams/${holder.uuid}`
  const chips: { key: string; label: string; count: number; path: StagePath }[] = sub
    ? []
    : [
        ...(kid ? [] : dept.kids.map(k => ({ key: k.uuid, label: k.name, count: k.count, path: { dept: dept.uuid, kid: k.uuid } }))),
        ...holder.subs.map(s => ({ key: s.uuid, label: s.name, count: s.count, path: kid ? { dept: dept.uuid, kid: kid.uuid, sub: s.uuid } : { dept: dept.uuid, sub: s.uuid } })),
      ]
  const crumbs: { label: string; path: StagePath | null }[] = [
    { label: 'AquaTerra', path: null },
    { label: dept.name, path: kid || sub ? { dept: dept.uuid } : undefined as never },
    ...(kid ? [{ label: kid.name, path: sub ? { dept: dept.uuid, kid: kid.uuid } : undefined as never }] : []),
    ...(sub ? [{ label: sub.name, path: undefined as never }] : []),
  ]
  const shown = people.slice(0, PANEL_PEOPLE_MAX)
  const hiringHere = openMap.get(sub ? sub.uuid : holder.uuid) ?? []

  return (
    <motion.section
      id={id}
      ref={panelRef}
      className={'oh-panel' + (dark ? ' is-onink' : '')}
      style={{ ['--dept' as string]: hue }}
      aria-labelledby={`${id}-h`}
      initial={reduced ? false : { opacity: 0, transform: 'translateY(22px) scale(0.98)' }}
      animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, transform: 'translateY(12px) scale(0.98)', transition: { duration: 0.16 } }}
      transition={reduced ? { duration: 0 } : springSoft}
    >
      <div className="oh-panel-top">
        <nav className="oh-crumbs" aria-label="where you are">
          {crumbs.map((c, i) => (
            <span key={c.label + i} className="oh-crumb">
              {c.path !== undefined && (i === 0
                ? <button type="button" onClick={onClose}>{c.label}</button>
                : <button type="button" onClick={() => onGo(c.path as StagePath)}>{c.label}</button>)}
              {c.path === undefined && <span aria-current="page">{c.label}</span>}
              {i < crumbs.length - 1 && <span aria-hidden className="oh-crumb-sep">/</span>}
            </span>
          ))}
        </nav>
        <button type="button" className="oh-close" onClick={onClose} aria-label="close this panel">close</button>
      </div>

      <div className="oh-panel-head">
        <h3 id={`${id}-h`} ref={headingRef} tabIndex={-1} className="oh-panel-title">{title}</h3>
        <p className="oh-panel-meta"><strong>{count.toLocaleString()}</strong> {count === 1 ? 'member' : 'members'}</p>
        <Link to={to} className="oh-open">open {sub ? 'sub-team' : 'team'} page <span aria-hidden>→</span></Link>
      </div>

      {chips.length > 0 && (
        <div className="oh-inside">
          <p className="oh-label">{kid || !dept.kids.length ? 'inside' : 'inside this department'}</p>
          <div className="oh-chips">
            {chips.map(c => (
              <button key={c.key} type="button" className="oh-chip" onClick={() => onGo(c.path)}>
                {c.label}<HireDot n={openMap.get(c.key)?.length ?? 0} /><span className="oh-chip-n">{c.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {hiringHere.length > 0 && (
        <div className="oh-roles-here">
          <p className="oh-label">{hiringHere.length === 1 ? 'open role here' : `${hiringHere.length} open roles here`}</p>
          <ul className="oh-roles-list">
            {hiringHere.map(o => (
              <li key={o.id}><Link to={`/opportunities/${o.id}`} className="oh-role">{o.title}<span aria-hidden> →</span></Link></li>
            ))}
          </ul>
        </div>
      )}

      <div className="oh-people-wrap">
        <p className="oh-label">people</p>
        {shown.length > 0 ? (
          <ul className="oh-people">
            {shown.map((p, i) => (
              <li key={p.uuid} style={{ ['--i' as string]: Math.min(i, 24) }}>
                <Link to={`/member/${p.uuid}`} className={'oh-person' + (hit === p.uuid ? ' is-hit' : '')}>
                  <Avatar person={p} size={52} />
                  <span className="oh-person-name">{p.name.split(' ')[0]}</span>
                  <span className="oh-person-full">{p.name}</span>
                </Link>
              </li>
            ))}
            {people.length > shown.length && (
              <li><Link to={to} className="oh-person oh-person-more">+{people.length - shown.length} more</Link></li>
            )}
          </ul>
        ) : (
          <p className="oh-empty">
            {count > 0 ? "the member list isn't available right now. " : 'nobody listed here yet. '}
            <Link to={to}>open the page</Link>
          </p>
        )}
      </div>
    </motion.section>
  )
}
