import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AcademicCapIcon } from '@heroicons/react/24/outline'
import certificateService, { type CertificateRequest, type HoursSummary } from '../services/certificateService'
import { certificateLink } from '../certificates/certificateLogic'
import '../styles/routes/profile.css'

// Section 06: the three tinted chips (rgba fills with hand-picked hex text,
// none of them tokens) become the shared `.pf-status` pill from profile.css —
// ink keyline, palette fill, solid ink text. Only the class varies now.
const STATUS_CLASS: Record<CertificateRequest['status'], string> = {
  pending:  'pf-status pf-status-pending',
  issued:   'pf-status pf-status-issued',
  declined: 'pf-status pf-status-declined',
}
const STATUS_LABEL: Record<CertificateRequest['status'], string> = {
  pending: 'in review', issued: 'ready ✓', declined: 'not issued',
}

type Row = CertificateRequest & { typeLabel: string }

/**
 * Hours + certificates card. Own profile only - matches ProfilePage's existing card idioms (.card, h-display numerals, mono xs
 * upper muted labels).
 *
 * Asking for a document now happens on its own page, /certificates (20 Nov 2026): it needs the teams a member was in, the HoDs
 * who have seen their work and a minimum-hours figure, which do not fit in a profile card. This card keeps what a profile is
 * good for: the hours the roster verifies, the latest requests and where they stand, and one way in.
 *
 * It always renders for the owner. It used to hide itself until a member had a counted drive; with no attendance recorded yet
 * that hid it from everyone, and the way to ask for a certificate with it.
 *
 * `initialSummary` kills a duplicate fetch, it does not replace one: ProfilePage already loads the same getHoursSummary for the
 * identity card's hours tile. Keyed on `memberId` only, never on the summary's identity, which churns on every parent render.
 */
export default function HoursAndCertificateCard({ memberId, initialSummary }: { memberId: number; initialSummary?: HoursSummary | null }) {
  const [summary, setSummary] = useState<HoursSummary | null>(initialSummary ?? null)
  const initialSummaryRef = useRef(initialSummary)
  initialSummaryRef.current = initialSummary
  const [requests, setRequests] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (reuseSummary?: HoursSummary | null) => {
    setLoading(true)
    try {
      const [s, r] = await Promise.all([
        reuseSummary ? Promise.resolve(reuseSummary) : certificateService.getHoursSummary(memberId),
        certificateService.getOwnRequests(memberId),
      ])
      setSummary(s)
      setRequests(r.data)
    } catch { /* keep whatever we have; the link below still works */ }
    finally { setLoading(false) }
  }, [memberId])
  useEffect(() => { load(initialSummaryRef.current) }, [load])

  if (loading && !summary) return null
  const hasHours = !!summary && summary.driveCount > 0

  return (
    <div className="card">
      <div className="pf-label-row">
        <span className="pf-label">{hasHours ? 'hours volunteered' : 'certificates'}</span>
        <AcademicCapIcon className="pf-label-aside" width={15} height={15} strokeWidth={1.8} aria-hidden="true" />
      </div>

      {hasHours && summary && (
        <>
          {/* One unit, one figure. There is no 50-hour threshold anywhere in this codebase; if one is ever wanted, add it to
              lib/orgFacts.ts so the number lives in exactly one place. */}
          <div className="pf-figure">
            {summary.totalHours}h
            {summary.undercounted && <span style={{ fontSize: 15, fontWeight: 400, fontFamily: 'var(--eina)', letterSpacing: 0, color: 'var(--ink-3)' }}>+</span>}
          </div>
          <div className="pf-sub">
            {summary.driveCount} drive{summary.driveCount === 1 ? '' : 's'}
            {summary.earliestDate && summary.latestDate && ` · ${summary.earliestDate} – ${summary.latestDate}`}
          </div>
        </>
      )}

      {requests.length > 0 && (
        <div style={{ marginTop: hasHours ? 16 : 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {requests.slice(0, 3).map(r => (
            <div key={r.id} className="pf-request-row">
              <span style={{ flex: '1 1 auto', minWidth: 0, fontFamily: 'var(--eina)', fontWeight: 800, fontSize: 12.5 }}>{r.typeLabel}</span>
              {r.status === 'issued'
                ? <Link to={certificateLink(r.id)} className={STATUS_CLASS[r.status]}>{STATUS_LABEL[r.status]}</Link>
                : <span className={STATUS_CLASS[r.status]}>{STATUS_LABEL[r.status]}</span>}
            </div>
          ))}
        </div>
      )}

      <div className="pf-actions">
        <Link to="/certificates" className="btn btn-primary">
          {requests.length > 0 ? 'certificates →' : '+ ask for a certificate'}
        </Link>
      </div>
    </div>
  )
}
