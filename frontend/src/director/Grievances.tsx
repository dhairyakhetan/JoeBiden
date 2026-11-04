import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '../components/Toast'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import {
  AdminLayout, AdminTabHeader, DataToolbar, FilterPill, EmptyLedger,
  AdminSkeleton, AdminErrorState, AdminRow, StatusStamp, type StampTone,
} from './adminKit'
import {
  grievanceService, isOverdue, daysSince, CATEGORIES, CATEGORY_LABEL, STATUS_LABEL, RESPONSE_DAYS,
  type Grievance, type GrievanceNote, type GrievanceAuditRow, type GrievanceStatus, type GrievanceCategory, type HrMember,
} from '../services/grievanceService'

/**
 * `/director/grievances` (handoff C-33): the HR desk for grievances raised on /grievance. HR and Super Admin only. The route
 * guard (deskAccess privilege `super`) and the database rules say the same thing: Directors and HoDs get zero rows, and a
 * grievance that names an HR member is hidden from that member.
 *
 * There is no delete and no export here on purpose: a grievance is resolved or closed, never removed, and its text never
 * leaves the desk (no CSV, no Sheets). Descriptions and notes are rendered as plain text. Nothing here logs them.
 */
const STATUS_TONE: Record<GrievanceStatus, StampTone> = { new: 'pending', in_review: 'custom', resolved: 'approved', closed: 'approved' }
const STATUSES: GrievanceStatus[] = ['new', 'in_review', 'resolved', 'closed']

function fmt(iso: string | null): string {
  if (!iso) return ''
  try { return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) } catch { return '' }
}
function fmtDay(iso: string | null): string {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return '' }
}

function Row({ g, hr, onChanged }: { g: Grievance; hr: HrMember[]; onChanged: () => void }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notes, setNotes] = useState<GrievanceNote[] | null>(null)
  const [audit, setAudit] = useState<GrievanceAuditRow[] | null>(null)
  const [newNote, setNewNote] = useState('')
  const [resolution, setResolution] = useState(g.resolutionNote || '')
  const overdue = isOverdue(g)

  const loadDetail = useCallback(async () => {
    try {
      const [n, a] = await Promise.all([grievanceService.notes(g.id), grievanceService.audit(g.id)])
      setNotes(n); setAudit(a)
    } catch (e: any) { toast.error('Could not load the notes', e?.message || 'Try again.') }
  }, [g.id, toast])
  useEffect(() => { if (open && notes === null) void loadDetail() }, [open, notes, loadDetail])

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true)
    try { await fn(); toast.success(ok); onChanged(); void loadDetail() }
    catch (e: any) { toast.error('That did not save', e?.message || 'Try again.') }
    finally { setBusy(false) }
  }

  return (
    <AdminRow
      busy={busy}
      stamp={<StatusStamp label={STATUS_LABEL[g.status].toLowerCase()} tone={STATUS_TONE[g.status]} color="var(--sky)" />}
      primary={`${CATEGORY_LABEL[g.category]} · ${g.submitterName || 'a member'}`}
      secondary={
        <>
          <div className="adm-lcard-facts">
            {overdue && <span className="qtag" style={{ ['--cc' as any]: 'var(--tomato, #E5484D)' }}>overdue · {daysSince(g.createdAt)} days</span>}
            {g.assignedTo && <span className="qtag" style={{ ['--cc' as any]: 'var(--sky)' }}>assigned to {hr.find(h => h.memberId === g.assignedTo)?.fullName || 'someone'}</span>}
          </div>
          <button type="button" className="adm-disclose" aria-expanded={open} onClick={e => { e.stopPropagation(); setOpen(v => !v) }}>
            {open ? 'hide the details' : 'open the details'}
            {open ? <ChevronUpIcon strokeWidth={2.2} aria-hidden /> : <ChevronDownIcon strokeWidth={2.2} aria-hidden />}
          </button>
        </>
      }
      meta={fmtDay(g.createdAt)}
      onToggleExpand={() => setOpen(v => !v)}
      expanded={!open ? undefined : (
        <div style={{ display: 'grid', gap: 14 }} onClick={e => e.stopPropagation()}>
          <div>
            <div className="mono xs upper muted" style={{ fontWeight: 700, marginBottom: 4 }}>what they wrote</div>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'var(--eina)', fontSize: 14.5, lineHeight: 1.6 }}>{g.description}</p>
          </div>
          <div className="mono xs muted" style={{ display: 'grid', gap: 2 }}>
            <span>sent {fmt(g.createdAt)} by {g.submitterName || 'a member'}</span>
            {g.aboutText && <span>about: {g.aboutText}</span>}
            {g.incidentDate && <span>it happened: {fmtDay(g.incidentDate)}</span>}
            {g.resolvedAt && <span>{g.status === 'closed' ? 'closed' : 'resolved'} {fmt(g.resolvedAt)}</span>}
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'grid', gap: 4, minWidth: 160 }}>
              <span className="mono xs upper muted" style={{ fontWeight: 700 }}>status</span>
              <select className="input" value={g.status} disabled={busy} onChange={e => run(() => grievanceService.setStatus(g.id, e.target.value as GrievanceStatus), 'Status updated')}>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4, minWidth: 200 }}>
              <span className="mono xs upper muted" style={{ fontWeight: 700 }}>assigned to</span>
              <select className="input" value={g.assignedTo ?? ''} disabled={busy} onChange={e => run(() => grievanceService.assign(g.id, e.target.value ? Number(e.target.value) : null), 'Assignment updated')}>
                <option value="">nobody yet</option>
                {hr.map(h => <option key={h.memberId} value={h.memberId}>{h.fullName}</option>)}
              </select>
            </label>
          </div>

          <div>
            <label htmlFor={`res-${g.id}`} className="mono xs upper muted" style={{ fontWeight: 700, display: 'block', marginBottom: 4 }}>resolution note</label>
            <textarea id={`res-${g.id}`} className="input" style={{ width: '100%', minHeight: 70 }} maxLength={4000} value={resolution} onChange={e => setResolution(e.target.value)} placeholder="What was decided or done." />
            <button type="button" className="btn btn-sm" style={{ marginTop: 6 }} disabled={busy || resolution.trim() === (g.resolutionNote || '').trim()} onClick={() => run(() => grievanceService.setResolutionNote(g.id, resolution), 'Resolution note saved')}>save the note</button>
          </div>

          <div>
            <div className="mono xs upper muted" style={{ fontWeight: 700, marginBottom: 4 }}>internal notes (only HR sees these)</div>
            {notes === null ? <span className="mono xs muted">loading…</span> : notes.length === 0 ? <span className="mono xs muted">no notes yet</span> : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
                {notes.map(n => (
                  <li key={n.id} style={{ background: 'var(--bg-2)', borderRadius: 'var(--r-tight)', padding: '8px 12px' }}>
                    <div className="mono xs muted">{n.authorName || 'HR'} · {fmt(n.createdAt)}</div>
                    <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 14 }}>{n.note}</div>
                  </li>
                ))}
              </ul>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <input className="input" style={{ flex: 1, minWidth: 200 }} value={newNote} maxLength={4000} onChange={e => setNewNote(e.target.value)} placeholder="add an internal note" aria-label="Add an internal note" />
              <button type="button" className="btn btn-sm" disabled={busy || !newNote.trim()} onClick={() => run(async () => { await grievanceService.addNote(g.id, newNote); setNewNote('') }, 'Note added')}>add note</button>
            </div>
          </div>

          <div>
            <div className="mono xs upper muted" style={{ fontWeight: 700, marginBottom: 4 }}>history</div>
            {audit === null ? <span className="mono xs muted">loading…</span> : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}>
                {audit.map(a => (
                  <li key={a.id} className="mono xs muted">
                    {fmt(a.at)} · {a.actorName || 'someone'} · {a.action.replace(/_/g, ' ')}{a.fromStatus && a.toStatus ? ` (${a.fromStatus.replace('_', ' ')} to ${a.toStatus.replace('_', ' ')})` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    />
  )
}

export default function Grievances() {
  const [rows, setRows] = useState<Grievance[]>([])
  const [hr, setHr] = useState<HrMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<'open' | GrievanceStatus | 'all'>('open')
  const [category, setCategory] = useState<GrievanceCategory | 'all'>('all')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [list, people] = await Promise.all([grievanceService.list(), grievanceService.hrMembers()])
      setRows(list); setHr(people)
    } catch (e: any) { setError(e?.message || 'Failed to load grievances') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows
      .filter(r => status === 'all' || (status === 'open' ? r.status === 'new' || r.status === 'in_review' : r.status === status))
      .filter(r => category === 'all' || r.category === category)
      .filter(r => !term || (r.submitterName || '').toLowerCase().includes(term))
  }, [rows, status, category, search])

  const newCount = rows.filter(r => r.status === 'new').length
  const overdueCount = rows.filter(r => isOverdue(r)).length

  return (
    <AdminLayout>
      <div style={{ paddingBottom: 80 }}>
        <AdminTabHeader
          label="Grievances"
          title="Grievances"
          count={filtered.length}
          subtitle={`Raised on the grievance form. Only HR and Super Admins can read them. We promise a reply within ${RESPONSE_DAYS} days${overdueCount ? `: ${overdueCount} ${overdueCount === 1 ? 'is' : 'are'} past that now` : ''}.`}
        />
        <DataToolbar search={search} onSearch={setSearch} searchPlaceholder="Search by who sent it...">
          <div className="adm-hscroll">
            <FilterPill active={status === 'open'} onClick={() => setStatus('open')}>open{newCount > 0 && ` (${newCount} new)`}</FilterPill>
            {STATUSES.map(s => <FilterPill key={s} active={status === s} onClick={() => setStatus(s)}>{STATUS_LABEL[s].toLowerCase()}</FilterPill>)}
            <FilterPill active={status === 'all'} onClick={() => setStatus('all')}>all</FilterPill>
          </div>
          <div className="adm-hscroll">
            <FilterPill active={category === 'all'} onClick={() => setCategory('all')}>any category</FilterPill>
            {CATEGORIES.map(c => <FilterPill key={c} active={category === c} onClick={() => setCategory(c)}>{CATEGORY_LABEL[c].toLowerCase()}</FilterPill>)}
          </div>
        </DataToolbar>

        {loading ? <AdminSkeleton rows={4} /> : error ? <AdminErrorState message={error} onRetry={load} /> : filtered.length === 0 ? (
          <EmptyLedger message={status === 'open' ? 'nothing open' : 'no matches'} sub={status === 'open' ? 'a grievance shows up here the moment a member sends one.' : 'try a different filter.'} />
        ) : (
          filtered.map(g => <Row key={g.id} g={g} hr={hr} onChanged={load} />)
        )}
      </div>
    </AdminLayout>
  )
}
