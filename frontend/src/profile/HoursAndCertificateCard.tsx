import { useCallback, useEffect, useRef, useState } from 'react'
import { AcademicCapIcon } from '@heroicons/react/24/outline'
import certificateService, { CertificateRequest, DocType, HoursSummary } from '../services/certificateService'
import { useToast } from '../components/Toast'
import { CERTIFICATE_WAIT_TIME } from '../lib/orgFacts'
import '../styles/routes/profile.css'

const DOC_LABEL: Record<DocType, string> = { certificate: 'a certificate', lor: 'a letter of recommendation', lov: 'a letter of volunteering' }
const DOC_BTN_LABEL: Record<DocType, string> = { certificate: 'certificate', lor: 'letter of recommendation', lov: 'letter of volunteering' }

// Section 06: the three tinted chips (rgba fills with hand-picked hex text,
// none of them tokens) become the shared `.pf-status` pill from profile.css —
// ink keyline, palette fill, solid ink text. Only the class varies now.
const STATUS_CLASS: Record<CertificateRequest['status'], string> = {
  pending:  'pf-status pf-status-pending',
  issued:   'pf-status pf-status-issued',
  declined: 'pf-status pf-status-declined',
}
const STATUS_LABEL: Record<CertificateRequest['status'], string> = {
  pending: 'pending', issued: 'issued ✓', declined: 'declined',
}

/**
 * Hours + certificate/LoR/LoV request card. Own profile only — matches
 * ProfilePage's existing card idioms (.card, h-display numerals, mono xs
 * upper muted labels) rather than the ink-seam redesign this branch didn't
 * adopt. Hides itself entirely until the member has at least one counted
 * drive, same as the ported version.
 */
/**
 * `initialSummary` kills a duplicate fetch, it does not replace one.
 *
 * ProfilePage already loads the same getHoursSummary for the identity
 * card's hours tile, so an own-profile render issued the identical
 * drive_attendance read twice and the two copies could briefly disagree,
 * settling independently. When the parent has it, this card uses it and only
 * fetches the requests list; a reload after submitting a request still
 * refetches both, because the parent's copy is stale by then.
 *
 * Same seam FeedPostCard's `savedInitial`/`linkedOpening` props already use.
 */
export default function HoursAndCertificateCard({ memberId, initialSummary }: { memberId: number; initialSummary?: HoursSummary | null }) {
  const toast = useToast()
  const [summary, setSummary] = useState<HoursSummary | null>(initialSummary ?? null)
  // Latest parent summary, read by the effect below without being a dep.
  const initialSummaryRef = useRef(initialSummary)
  initialSummaryRef.current = initialSummary
  const [requests, setRequests] = useState<CertificateRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [note, setNote] = useState('')
  const [requesting, setRequesting] = useState(false)

  const load = useCallback(async (reuseSummary?: HoursSummary | null) => {
    setLoading(true)
    try {
      const [s, r] = await Promise.all([
        reuseSummary ? Promise.resolve(reuseSummary) : certificateService.getHoursSummary(memberId),
        certificateService.getOwnRequests(memberId),
      ])
      setSummary(s)
      setRequests(r.data)
    } catch { /* the card hides itself on failure rather than showing a broken shell */ }
    finally { setLoading(false) }
  }, [memberId])
  // Keyed on `memberId` only, NOT on `initialSummary`.
  //
  // The parent's summary arrives asynchronously and its object identity churns
  // (ProfilePage's hours effect re-runs whenever `currentMember` is replaced),
  // so listing it as a dependency re-ran `load` on every one of those - each
  // time flipping `loading` true, which the render guard turns into `return
  // null`. The card vanished and came back, and refetched the requests list
  // each time: the opposite of the one-fetch-saved this prop exists for.
  // `initialSummaryRef` reads the latest value without subscribing to it.
  useEffect(() => { load(initialSummaryRef.current) }, [load])

  const submitRequest = async (docType: DocType) => {
    setRequesting(true)
    try {
      await certificateService.requestDocument(memberId, docType, note)
      toast.success(`${DOC_LABEL[docType]} requested`, `HR usually decides ${CERTIFICATE_WAIT_TIME}.`)
      setPickerOpen(false); setNote('')
      load()
    } catch (e: any) {
      toast.error("couldn't submit that request.", e?.message || 'try again.')
    } finally {
      setRequesting(false)
    }
  }

  if (loading || !summary) return null
  if (summary.driveCount === 0) return null // nothing to certify yet

  const hasPending = requests.some(r => r.status === 'pending')

  return (
    <div className="card">
      <div className="pf-label-row">
        <span className="pf-label">hours volunteered</span>
        <AcademicCapIcon className="pf-label-aside" width={15} height={15} strokeWidth={1.8} aria-hidden="true" />
      </div>
      {/* One unit, one figure. There is no 50-hour threshold anywhere in this
          codebase, so the old 37%-toward-50 progress bar claimed a milestone
          that does not exist; it is deleted, not restyled. If a threshold is
          ever wanted, add CERTIFICATE_HOURS to lib/orgFacts.ts and import it
          so the number lives in exactly one place. */}
      <div className="pf-figure">
        {summary.totalHours}h
        {summary.undercounted && <span style={{ fontSize: 15, fontWeight: 400, fontFamily: 'var(--eina)', letterSpacing: 0, color: 'var(--ink-3)' }}>+</span>}
      </div>
      <div className="pf-sub">
        {summary.driveCount} drive{summary.driveCount === 1 ? '' : 's'}
        {summary.earliestDate && summary.latestDate && ` · ${summary.earliestDate} – ${summary.latestDate}`}
      </div>

      {requests.length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {requests.slice(0, 3).map(r => (
            <div key={r.id} className="pf-request-row">
              <span style={{ flex: '1 1 auto', minWidth: 0, fontFamily: 'var(--eina)', fontWeight: 800, fontSize: 12.5 }}>{DOC_LABEL[r.docType]}</span>
              <span className={STATUS_CLASS[r.status]}>{STATUS_LABEL[r.status]}</span>
            </div>
          ))}
        </div>
      )}

      {!pickerOpen ? (
        <div className="pf-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={hasPending}
            onClick={() => setPickerOpen(true)}
            // 04.5: the disabled state is its own look (a flat cream pill),
            // not the generic dimmed .btn:disabled - "do not hide it".
            style={hasPending ? { background: 'var(--bg)', color: 'var(--ink-3)', cursor: 'default', opacity: 1 } : undefined}
          >
            {hasPending ? 'request pending…' : '+ request a certificate'}
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          <input
            className="input"
            style={{ width: '100%' }}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="anything HR should know (optional)"
            maxLength={280}
          />
          <div className="pf-actions">
            <button type="button" className="btn btn-primary" disabled={requesting} onClick={() => submitRequest('certificate')}>
              {DOC_BTN_LABEL.certificate}
            </button>
            <button type="button" className="btn" disabled={requesting} onClick={() => submitRequest('lov')}>
              {DOC_BTN_LABEL.lov}
            </button>
            <button type="button" className="btn" disabled={requesting} onClick={() => submitRequest('lor')}>
              {DOC_BTN_LABEL.lor}
            </button>
            <button type="button" className="btn btn-ghost" disabled={requesting} onClick={() => setPickerOpen(false)}>
              cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
