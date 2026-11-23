import { useEffect, useId, useMemo, useState } from 'react'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { sized } from '../lib/imageUrl'
import { getRoleLabel } from '../lib/roles'
import { buildRenderInput, renderCertificatePreview, SAMPLE_CERTIFICATE, SAMPLE_LETTER_BODY } from '../components/certificateGenerator'
import {
  formatMonth, isMonth, LIMITS, monthOf, tagKey, tagPath, type CertTypeInfo, type OrgSubTeam, type OrgTeam, type TeamNode, type TeamTag,
} from './certificateLogic'

/* ── Documents, each with a sample ──────────────────────────────────────── */

function SamplePreview({ type }: { type: CertTypeInfo }) {
  const [url, setUrl] = useState<string | null>(type.sampleImageUrl ? sized(type.sampleImageUrl, 'cover') : null)
  const [failed, setFailed] = useState<string | null>(null)
  useEffect(() => {
    if (url) return
    let live = true
    ;(async () => {
      try {
        const input = buildRenderInput({
          typeKey: type.key, teamNames: [], memberName: 'Sample Name', issuedAt: null, verifyCode: null, watermark: 'Sample',
          ...(type.kind === 'certificate' ? SAMPLE_CERTIFICATE : { body: SAMPLE_LETTER_BODY }),
        })
        const u = await renderCertificatePreview(input)
        if (live) setUrl(u)
      } catch (e) {
        if (live) setFailed(e instanceof Error ? e.message : 'The sample would not draw.')
      }
    })()
    return () => { live = false }
  }, [type, url])

  if (failed) return <div className="cert-sample"><div className="cert-sample-note">no sample for this one yet. the document is still made when approved.</div></div>
  return (
    <div className="cert-sample">
      {url
        ? <img src={url} alt={`Sample of a ${type.label}`} loading="lazy" decoding="async" />
        : <div className="cert-empty">drawing a sample…</div>}
      <div className="cert-sample-note">a sample with a made-up name. yours carries your own details.</div>
    </div>
  )
}

export function DocTypePicker({ types, value, onChange, alreadyPending }: {
  types: CertTypeInfo[]
  value: string[]
  onChange: (next: string[]) => void
  /** Keys the member already has waiting. The database refuses a second one, so the form says so up front. */
  alreadyPending: ReadonlySet<string>
}) {
  const id = useId()
  const [samples, setSamples] = useState<Set<string>>(new Set())
  const toggle = (key: string) => onChange(value.includes(key) ? value.filter(k => k !== key) : [...value, key])
  const toggleSample = (key: string) => setSamples(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })

  return (
    <div className="cert-types" role="group" aria-labelledby={`${id}-label`}>
      {types.map(t => {
        const waiting = alreadyPending.has(t.key)
        const on = value.includes(t.key) && !waiting
        return (
          <div key={t.key} className="cert-type" data-on={on} data-off={waiting}>
            <label className="cert-type-row">
              <input type="checkbox" checked={on} disabled={waiting} onChange={() => toggle(t.key)} aria-describedby={`${id}-${t.key}`} />
              <span>
                <span className="cert-type-name">{t.label}</span>
                <span className="cert-type-blurb" id={`${id}-${t.key}`} style={{ display: 'block' }}>
                  {waiting ? 'You already have one waiting. Wait for it to be decided first.' : t.blurb}
                </span>
              </span>
            </label>
            <button type="button" className="cert-link-btn" aria-expanded={samples.has(t.key)} onClick={() => toggleSample(t.key)}>
              {samples.has(t.key) ? 'hide the sample' : 'see a sample'}
            </button>
            {samples.has(t.key) && <SamplePreview type={t} />}
          </div>
        )
      })}
      <span id={`${id}-label`} hidden>Documents you want</span>
    </div>
  )
}

/* ── Selected chips, shared ─────────────────────────────────────────────── */

function Chips({ items, onRemove }: { items: { key: string; label: string }[]; onRemove: (key: string) => void }) {
  if (items.length === 0) return null
  return (
    <ul className="cert-chips" aria-label="Selected">
      {items.map(i => (
        <li key={i.key} className="cert-chip">
          {i.label}
          <button type="button" aria-label={`Remove ${i.label}`} onClick={() => onRemove(i.key)}>&times;</button>
        </li>
      ))}
    </ul>
  )
}

/* ── Teams and sub-teams ────────────────────────────────────────────────── */

const matches = (name: string, q: string) => name.toLowerCase().includes(q)
const nodeMatches = (n: TeamNode, q: string): boolean =>
  !q || matches(n.name, q) || n.subTeams.some(s => matches(s.name, q)) || n.children.some(c => nodeMatches(c, q))

export function TeamPicker({ tree, teams, subTeams, value, onChange }: {
  tree: TeamNode[]
  teams: OrgTeam[]
  subTeams: OrgSubTeam[]
  value: TeamTag[]
  onChange: (next: TeamTag[]) => void
}) {
  const id = useId()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Set<number>>(new Set())
  const query = q.trim().toLowerCase()
  const selected = useMemo(() => new Set(value.map(tagKey)), [value])

  const toggleTag = (tag: TeamTag) => {
    const k = tagKey(tag)
    onChange(selected.has(k) ? value.filter(t => tagKey(t) !== k) : [...value, tag])
  }
  const toggleOpen = (teamId: number) => setOpen(prev => { const n = new Set(prev); if (n.has(teamId)) n.delete(teamId); else n.add(teamId); return n })

  const containsSelection = (n: TeamNode): boolean =>
    value.some(t => t.teamId === n.teamId) || n.children.some(containsSelection)

  const renderNode = (n: TeamNode, depth: number) => {
    if (!nodeMatches(n, query)) return null
    const expanded = !!query || open.has(n.teamId) || containsSelection(n)
    const hasInside = n.subTeams.length > 0 || n.children.length > 0
    const indent = depth === 0 ? '' : depth === 1 ? 'cert-indent-1' : 'cert-indent-2'
    return (
      <div key={n.teamId} className={indent}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <label className="cert-row" style={{ flex: 1 }}>
            <input type="checkbox" checked={selected.has(tagKey({ teamId: n.teamId, subTeamId: null }))} onChange={() => toggleTag({ teamId: n.teamId, subTeamId: null })} />
            <span>
              <span className="cert-row-name">{n.name}</span>
              {!n.isActive && <span className="cert-retired">past team</span>}
            </span>
          </label>
          {hasInside && (
            <button type="button" className="cert-group-head" style={{ width: 44, justifyContent: 'center', flex: 'none' }}
              aria-expanded={expanded} aria-label={`${expanded ? 'Hide' : 'Show'} what is inside ${n.name}`} onClick={() => toggleOpen(n.teamId)}>
              {expanded ? <ChevronDownIcon width={18} height={18} aria-hidden /> : <ChevronRightIcon width={18} height={18} aria-hidden />}
            </button>
          )}
        </div>
        {expanded && n.subTeams.filter(s => !query || matches(s.name, query) || matches(n.name, query)).map(s => (
          <label key={s.subTeamId} className="cert-row cert-indent-1">
            <input type="checkbox" checked={selected.has(tagKey({ teamId: n.teamId, subTeamId: s.subTeamId }))} onChange={() => toggleTag({ teamId: n.teamId, subTeamId: s.subTeamId })} />
            <span>
              <span className="cert-row-name">{s.name}</span>
              {!s.isActive && <span className="cert-retired">past team</span>}
            </span>
          </label>
        ))}
        {expanded && n.children.map(c => renderNode(c, depth + 1))}
      </div>
    )
  }

  const visible = tree.filter(n => nodeMatches(n, query))
  return (
    <div>
      <Chips
        items={value.map(t => ({ key: tagKey(t), label: tagPath(t, teams, subTeams) }))}
        onRemove={k => onChange(value.filter(t => tagKey(t) !== k))}
      />
      <div className="cert-pick">
        <div className="cert-pick-search">
          <label htmlFor={`${id}-q`} className="sr-only" style={{ position: 'absolute', left: -9999 }}>Search teams</label>
          <input id={`${id}-q`} className="cert-field" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="search teams, e.g. linkedin" autoComplete="off" />
        </div>
        <div className="cert-pick-list">
          {visible.length === 0 ? <div className="cert-empty">no team matches that.</div> : visible.map(n => renderNode(n, 0))}
        </div>
      </div>
    </div>
  )
}

/* ── HoDs ───────────────────────────────────────────────────────────────── */

export interface HodOption { memberId: number; name: string; role: string; teamNames: string[] }

export function HodPicker({ options, value, onChange }: { options: HodOption[]; value: number[]; onChange: (next: number[]) => void }) {
  const id = useId()
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()
  const byId = useMemo(() => new Map(options.map(o => [o.memberId, o])), [options])
  const shown = options.filter(o => !query || matches(o.name, query) || o.teamNames.some(t => matches(t, query)))
  const toggle = (memberId: number) => onChange(value.includes(memberId) ? value.filter(v => v !== memberId) : [...value, memberId])

  return (
    <div>
      <Chips
        items={value.map(v => ({ key: String(v), label: byId.get(v)?.name ?? 'a HoD' }))}
        onRemove={k => onChange(value.filter(v => String(v) !== k))}
      />
      <div className="cert-pick">
        <div className="cert-pick-search">
          <label htmlFor={`${id}-q`} style={{ position: 'absolute', left: -9999 }}>Search HoDs</label>
          <input id={`${id}-q`} className="cert-field" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="search by name or team" autoComplete="off" />
        </div>
        <div className="cert-pick-list">
          {shown.length === 0 ? <div className="cert-empty">no HoD matches that.</div> : shown.map(o => (
            <label key={o.memberId} className="cert-row">
              <input type="checkbox" checked={value.includes(o.memberId)} onChange={() => toggle(o.memberId)} />
              <span>
                <span className="cert-row-name">{o.name}</span>
                <span className="cert-row-sub" style={{ display: 'block' }}>
                  {getRoleLabel(o.role)}{o.teamNames.length > 0 && ` · ${o.teamNames.join(', ')}`}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}


/* ── A month and a year, as two selects (Firefox desktop has no month input) ─ */

export function MonthPicker({ label, value, onChange, error }: { label: string; value: string; onChange: (next: string) => void; error?: boolean }) {
  const thisYear = new Date().getFullYear()
  // Each half is held here until both are chosen: a half-picked month is not a value, but it must not snap back either.
  const [month, setMonth] = useState(isMonth(value) ? value.slice(5) : '')
  const [year, setYear] = useState(isMonth(value) ? value.slice(0, 4) : '')
  useEffect(() => {
    // The parent can set a whole value (the "use this month" shortcut) or clear it after sending.
    if (isMonth(value)) { setYear(value.slice(0, 4)); setMonth(value.slice(5)) }
    else if (value === '') { setYear(''); setMonth('') }
  }, [value])
  const years = Array.from({ length: thisYear - LIMITS.firstYear + 1 }, (_, i) => thisYear - i)
  const names = Array.from({ length: 12 }, (_, i) => formatMonth(`2000-${String(i + 1).padStart(2, '0')}`).split(',')[0])
  const commit = (y: string, m: string) => onChange(y && m ? `${y}-${m}` : '')
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <legend className="cert-hint" style={{ marginBottom: 6, padding: 0 }}>{label}</legend>
      <div style={{ display: 'flex', gap: 8 }}>
        <select className="cert-field" style={{ flex: 1 }} aria-label={`${label}: month`} aria-invalid={error} value={month}
          onChange={e => { setMonth(e.target.value); commit(year, e.target.value) }}>
          <option value="">month</option>
          {names.map((n, i) => <option key={n} value={String(i + 1).padStart(2, '0')}>{n}</option>)}
        </select>
        <select className="cert-field" style={{ flex: 1 }} aria-label={`${label}: year`} aria-invalid={error} value={year}
          onChange={e => { setYear(e.target.value); commit(e.target.value, month) }}>
          <option value="">year</option>
          {years.map(yr => <option key={yr} value={String(yr)}>{yr}</option>)}
        </select>
      </div>
    </fieldset>
  )
}

/** The current month as a form value, for the "still with AQ" shortcut. */
export const thisMonth = () => monthOf(new Date())
