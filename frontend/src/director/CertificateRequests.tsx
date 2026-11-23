import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { isSuperAdmin } from '../lib/roles'
import certificateService from '../services/certificateService'
import {
  clearedCases, groupIntoCases, pendingCases, summariseHods,
  type CertCase, type CertTypeInfo, type DeskDoc, type OrgSubTeam, type OrgTeam,
} from '../certificates/certificateLogic'
import {
  AdminLayout, AdminTabHeader, DataToolbar, FilterPill, EmptyLedger, AdminSkeleton, AdminErrorState, AdminRow, StatusStamp,
} from './adminKit'
import CertificateDocBlock, { caseChips, claimedChip, fmtDate, type DeskCtx } from './CertificateCaseDetail'
import './CertificateRequests.css'

/**
 * `/director/certificates`: the certificate pipeline, as seen by every leader.
 *
 * A member asks on /certificates and tags the HoDs who have seen their work. Every HoD can READ the queue. Only a tagged HoD can
 * answer (vouch, cannot vouch, not sure); any leader can add a note; HR and tagged HoDs can write the text themselves (the route
 * for an informal "I need it now"); only HR can issue or decline. Cleared requests keep who decided and when.
 *
 * One row per MEMBER, not per document: everything a person has open is clubbed into one case, however many rounds it was asked
 * for in, with their earlier decisions shown as history. What each person may do is `powersFor` in certificates/certificateLogic.ts,
 * and the database enforces the same rules again (scripts/certificate_pipeline_2026_11_20.sql).
 */

type Tab = 'pending' | 'cleared'
type PendingFilter = 'all' | 'mine' | 'notext'

function CaseRow({ c, tab, ctx }: { c: CertCase; tab: Tab; ctx: DeskCtx }) {
  const [open, setOpen] = useState(false)
  const docs = tab === 'pending' ? c.open : c.closed
  const others = tab === 'pending' ? c.closed : c.open
  const needsMyAnswer = tab === 'pending' && docs.some(d => d.hods.some(h => h.memberId === ctx.viewer.memberId && h.response == null))
  const noText = tab === 'pending' && docs.some(d => !d.draft)
  const claimed = docs.map(claimedChip).find(Boolean)

  return (
    <AdminRow
      stamp={tab === 'pending'
        ? <StatusStamp label={`${docs.length} waiting`} tone="pending" />
        : <StatusStamp label={docs.every(d => d.status === 'issued') ? 'issued' : docs.every(d => d.status === 'declined') ? 'declined' : 'decided'} tone={docs.every(d => d.status === 'issued') ? 'approved' : 'rejected'} />}
      primary={c.memberName}
      secondary={
        <>
          <div className="adm-lcard-facts">
            <span className="qtag" style={{ ['--cc' as any]: 'var(--sky)' }}>{caseChips(docs)}</span>
            {needsMyAnswer && <span className="qtag" style={{ ['--cc' as any]: 'var(--lemon)' }}>needs your answer</span>}
            {noText && <span className="qtag" style={{ ['--cc' as any]: 'var(--bg)' }}>no text yet</span>}
            {others.length > 0 && <span className="qtag" style={{ ['--cc' as any]: 'var(--bg)' }}>{tab === 'pending' ? `${others.length} earlier decided` : `${others.length} still open`}</span>}
          </div>
          {claimed && <span>{claimed}</span>}
          {tab === 'pending' && docs.length > 0 && (() => {
            const s = summariseHods(docs.flatMap(d => d.hods))
            return s.total > 0 ? <span> &middot; {s.approve} approve, {s.disapprove} do not, {s.clueless} not sure, {s.waiting} waiting</span> : null
          })()}
        </>
      }
      meta={tab === 'pending' ? `since ${fmtDate(c.oldestOpenAt)}` : fmtDate(c.latestDecidedAt)}
      onToggleExpand={() => setOpen(v => !v)}
      expanded={open ? (
        <div className="cdesk-detail" onClick={e => e.stopPropagation()}>
          {docs.map(d => <CertificateDocBlock key={d.id} doc={d} ctx={ctx} />)}
          {others.length > 0 && (
            <div>
              <p className="cdesk-label">{tab === 'pending' ? 'earlier certificates for this member' : 'still open for this member'}</p>
              <div className="cdesk-history">
                {others.map(d => (
                  <div key={d.id} className="cdesk-history-row">
                    <span>
                      <strong>{d.typeLabel}</strong> &middot; {d.status === 'pending' ? `asked ${fmtDate(d.requestedAt)}` : `${d.status} ${fmtDate(d.decidedAt)}${d.decidedByName ? ` by ${d.decidedByName}` : ''}`}
                    </span>
                    {d.status !== 'pending' && <span className="cdesk-sub">{d.claimedMinHours != null ? `${d.claimedMinHours} h claimed` : ''}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : undefined}
    />
  )
}

export default function CertificateRequests() {
  const { member } = useAuth()
  const viewer = useMemo(() => ({ memberId: (member as any)?.member_id as number | undefined, role: (member as any)?.role as string | undefined }), [member])
  const hr = isSuperAdmin(viewer.role)

  const [docs, setDocs] = useState<DeskDoc[]>([])
  const [capped, setCapped] = useState(false)
  const [types, setTypes] = useState<CertTypeInfo[]>([])
  const [org, setOrg] = useState<{ teams: OrgTeam[]; subTeams: OrgSubTeam[] }>({ teams: [], subTeams: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('pending')
  const [filter, setFilter] = useState<PendingFilter>('all')
  const [search, setSearch] = useState('')

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    setError(null)
    try {
      const [desk, t, o] = await Promise.all([certificateService.listDesk(), certificateService.listTypes(), certificateService.listOrg()])
      setDocs(desk.docs); setCapped(desk.capped); setTypes(t); setOrg(o)
    } catch (e: any) {
      setError(e?.message || 'Failed to load requests')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const ctx: DeskCtx = useMemo(() => ({ viewer, types, teams: org.teams, subTeams: org.subTeams, refresh: () => load(true) }), [viewer, types, org, load])

  const cases = useMemo(() => groupIntoCases(docs), [docs])
  const term = search.trim().toLowerCase()

  const pending = useMemo(() => pendingCases(cases).filter(c => {
    if (term && !c.memberName.toLowerCase().includes(term)) return false
    if (filter === 'mine') return c.open.some(d => d.hods.some(h => h.memberId === viewer.memberId && h.response == null))
    if (filter === 'notext') return c.open.some(d => !d.draft)
    return true
  }), [cases, term, filter, viewer.memberId])
  const cleared = useMemo(() => clearedCases(cases).filter(c => !term || c.memberName.toLowerCase().includes(term)), [cases, term])

  const shown = tab === 'pending' ? pending : cleared
  const waitingOnMe = cases.filter(c => c.open.some(d => d.hods.some(h => h.memberId === viewer.memberId && h.response == null))).length
  const openCount = cases.filter(c => c.open.length > 0).length

  return (
    <AdminLayout>
      <div style={{ paddingBottom: 80 }}>
        <AdminTabHeader
          label="Certificates"
          title="Certificates and letters"
          count={shown.length}
          subtitle={hr
            ? 'A member asks, the HoDs they tag vouch, and HR decides. The hours a member types are a claim, shown beside what attendance records.'
            : 'You can read every request. If a member tagged you, say whether you can vouch for them. Any HoD can add a note. HR decides.'}
        />

        <DataToolbar search={search} onSearch={setSearch} searchPlaceholder="Search by name...">
          <div className="adm-hscroll">
            <FilterPill active={tab === 'pending'} onClick={() => setTab('pending')}>pending{openCount > 0 && ` (${openCount})`}</FilterPill>
            <FilterPill active={tab === 'cleared'} onClick={() => setTab('cleared')}>cleared</FilterPill>
            {tab === 'pending' && (
              <>
                <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>everyone</FilterPill>
                <FilterPill active={filter === 'mine'} onClick={() => setFilter('mine')}>needs my answer{waitingOnMe > 0 && ` (${waitingOnMe})`}</FilterPill>
                <FilterPill active={filter === 'notext'} onClick={() => setFilter('notext')}>no text yet</FilterPill>
              </>
            )}
          </div>
        </DataToolbar>

        {capped && <p className="cdesk-cap">Showing the newest 600 documents. Older ones are still in the database.</p>}

        {loading ? (
          <AdminSkeleton rows={4} />
        ) : error ? (
          <AdminErrorState message={error} onRetry={() => load()} />
        ) : shown.length === 0 ? (
          <EmptyLedger
            message={tab === 'pending' ? (filter === 'all' && !term ? 'nothing pending' : 'no matches') : (term ? 'no matches' : 'nothing cleared yet')}
            sub={tab === 'pending' ? 'requests show up here the moment a member asks.' : 'issued and declined requests are kept here, with who decided.'}
          />
        ) : (
          shown.map(c => <CaseRow key={`${tab}-${c.memberId}`} c={c} tab={tab} ctx={ctx} />)
        )}
      </div>
    </AdminLayout>
  )
}
