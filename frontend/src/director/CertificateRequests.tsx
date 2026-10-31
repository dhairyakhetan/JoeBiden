import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import certificateService, { CertificateRequest, DocType, RequestStatus } from '../services/certificateService'
import { generateCertificate, downloadCertificate } from '../components/certificateGenerator'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import { I } from '../components/v6Shared'
import { ChevronDownIcon, ChevronUpIcon, XMarkIcon } from '@heroicons/react/24/outline'
import {
  AdminLayout, AdminTabHeader, DataToolbar, FilterPill, EmptyLedger,
  AdminSkeleton, AdminErrorState, AdminRow, AdminRowActions, StatusStamp, type StampTone,
} from './adminKit'

/**
 * `/director/certificates` - the HR desk's certificate/LoR/LoV queue
 * (handoff/16-welfare-record.md §4/§5): every request shows the hours,
 * drive count, and date range as derived from the real roster at the
 * moment the member asked, and a director issues or declines with a note -
 * "exactly like every other desk in handoff/07." There is no automatic LoR
 * - every decision here is a person's, never a threshold check.
 */

const DOC_LABEL: Record<DocType, string> = { certificate: 'Certificate', lor: 'Letter of Recommendation', lov: 'Letter of Volunteering' }

// handoff/20-admin-desks.md §20.4: "Columns: member · document type · note ·
// requested · status." The row's top-right `stamp` slot is this desk-family's
// shared status vocabulary (see FormResponses/HiringResponses' own
// STATUS_TONE maps) - document type moves to a `qtag` chip in `secondary` so
// both the type AND the actual pending/issued/declined status are visible at
// once, instead of the type silently standing in for status.
const STATUS_TONE: Record<RequestStatus, StampTone> = { pending: 'pending', issued: 'approved', declined: 'rejected' }

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return '' }
}

function DecideRow({ request, onDecided }: { request: CertificateRequest; onDecided: (r: CertificateRequest) => void }) {
  const { member } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  // One `open` toggle drives both directions: on a pending request it reveals
  // the decline-note field; on an already-decided one it reveals who decided
  // and why. (AdminRow only renders `expanded` when `onToggleExpand` is also
  // set, so every row - not just pending ones - needs a live toggle or the
  // decided-info panel below would never be reachable.)
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [generating, setGenerating] = useState(false)
  const isPending = request.status === 'pending'

  // Owner: "generate certificate option with all formalities." Issuing used
  // to only flip `status`, with no actual document behind it - this draws
  // one on the spot from the request's own DB-derived hours/drive-count/date
  // snapshot (certificateGenerator.ts), so HR has something to hand the
  // member rather than just a changed status label.
  const handleDownload = async () => {
    setGenerating(true)
    try {
      const dataUrl = await generateCertificate(request)
      downloadCertificate(dataUrl, `aq-${request.docType}-${(request.memberName || 'member').toLowerCase().replace(/\s+/g, '-')}.png`)
    } catch (e: any) {
      toast.error('couldn’t generate that document.', e?.message || 'try again.')
    } finally {
      setGenerating(false)
    }
  }

  const decide = async (status: 'issued' | 'declined') => {
    if (status === 'declined' && !note.trim()) { setOpen(true); return }
    if (status === 'issued') {
      const ok = await confirm({
        title: `issue this ${DOC_LABEL[request.docType].toLowerCase()}?`,
        body: `${request.memberName || 'this member'} will see it marked issued.`,
        confirmLabel: 'issue it',
      })
      if (!ok) return
    }
    setBusy(true)
    try {
      const result = await certificateService.decide(request.id, status, note, member?.member_id)
      onDecided(result.data)
      toast.success(status === 'issued' ? 'issued' : 'declined')
      setOpen(false)
    } catch (e: any) {
      toast.error('couldn’t save that decision.', e?.message || 'try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminRow
      busy={busy}
      stamp={<StatusStamp label={request.status} tone={STATUS_TONE[request.status]} />}
      primary={request.memberName || 'unknown member'}
      secondary={
        <>
          <div className="adm-lcard-facts">
            <span className="qtag" style={{ ['--cc' as any]: 'var(--sky)' }}>{DOC_LABEL[request.docType]}</span>
          </div>
          {request.hoursAtRequest ?? '?'}h &middot; {request.driveCountAtRequest ?? '?'} drives
          {request.dateRangeStart && <> &middot; {fmtDate(request.dateRangeStart)} &ndash; {fmtDate(request.dateRangeEnd)}</>}
          {request.memberNote && (
            <div className="adm-lcard-facts">
              <span className="adm-note">"{request.memberNote}"</span>
            </div>
          )}
          <button
            type="button"
            className="adm-disclose"
            aria-expanded={open}
            onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
          >
            {open
              ? (isPending ? 'hide the decision' : 'hide who decided')
              : (isPending ? 'decide with a note' : 'who decided, and why')}
            {open
              ? <ChevronUpIcon strokeWidth={2.2} aria-hidden />
              : <ChevronDownIcon strokeWidth={2.2} aria-hidden />}
          </button>
        </>
      }
      meta={fmtDate(request.requestedAt)}
      onToggleExpand={() => setOpen(v => !v)}
      expanded={!open ? undefined : !isPending ? (
        <p className="mono xs muted" style={{ margin: 0 }}>
          {request.status === 'issued' ? 'issued' : 'declined'} by a director
          {request.decisionNote && <> &middot; "{request.decisionNote}"</>}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} onClick={e => e.stopPropagation()}>
          <input
            className="input"
            style={{ width: '100%' }}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="reason (required to decline, optional to issue)"
            autoFocus
          />
          <p className="adm-note">decline stays disabled until this has text. issue does not need one.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm adm-approve" disabled={busy} onClick={() => decide('issued')}><I.check /> issue</button>
            <button className="btn btn-sm adm-reject" disabled={busy || !note.trim()} onClick={() => decide('declined')}><XMarkIcon width={14} height={14} strokeWidth={2.4} aria-hidden /> decline</button>
          </div>
        </div>
      )}
      actions={
        isPending ? (
          <AdminRowActions sheetTitle={`${DOC_LABEL[request.docType]} for ${request.memberName}`}>
            <button className="btn btn-sm adm-approve" disabled={busy} onClick={() => decide('issued')}><I.check /> issue</button>
            <button className="btn btn-sm adm-reject" disabled={busy} onClick={() => setOpen(true)}><XMarkIcon width={14} height={14} strokeWidth={2.4} aria-hidden /> decline</button>
          </AdminRowActions>
        ) : request.status === 'issued' ? (
          <button className="btn btn-sm" disabled={generating} onClick={handleDownload}>
            {generating ? 'generating…' : 'download'}
          </button>
        ) : undefined
      }
    />
  )
}

export default function CertificateRequests() {
  const [requests, setRequests] = useState<CertificateRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'issued' | 'declined'>('pending')
  const [search, setSearch] = useState('')

  const fetchRequests = async () => {
    setLoading(true); setError(null)
    try {
      const result = await certificateService.listAll()
      setRequests(result.data)
    } catch (e: any) {
      setError(e?.message || 'Failed to load requests')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { fetchRequests() }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return requests
      .filter(r => statusFilter === 'all' || r.status === statusFilter)
      .filter(r => !term || (r.memberName || '').toLowerCase().includes(term))
  }, [requests, statusFilter, search])

  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <AdminLayout>
      <div style={{ paddingBottom: 80 }}>
        <AdminTabHeader
          label="Certificates"
          title="Certificates, LoRs & LoVs"
          count={filtered.length}
          subtitle="A member asks, HR decides - hours and drive count come from the real roster, not a typed guess."
        />

        <DataToolbar search={search} onSearch={setSearch} searchPlaceholder="Search by name...">
          <div className="adm-hscroll">
          <FilterPill active={statusFilter === 'pending'} onClick={() => setStatusFilter('pending')}>pending{pendingCount > 0 && ` (${pendingCount})`}</FilterPill>
          <FilterPill active={statusFilter === 'issued'} onClick={() => setStatusFilter('issued')}>issued</FilterPill>
          <FilterPill active={statusFilter === 'declined'} onClick={() => setStatusFilter('declined')}>declined</FilterPill>
          <FilterPill active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>all</FilterPill>
          </div>
        </DataToolbar>

        {loading ? (
          <AdminSkeleton rows={4} />
        ) : error ? (
          <AdminErrorState message={error} onRetry={fetchRequests} />
        ) : filtered.length === 0 ? (
          <EmptyLedger
            message={statusFilter === 'pending' ? 'nothing pending' : 'no matches'}
            sub={statusFilter === 'pending' ? 'requests will show up here the moment a member asks.' : 'try a different filter or search.'}
          />
        ) : (
          filtered.map(r => (
            <DecideRow key={r.id} request={r} onDecided={updated => setRequests(prev => prev.map(x => (x.id === updated.id ? updated : x)))} />
          ))
        )}
      </div>
    </AdminLayout>
  )
}
