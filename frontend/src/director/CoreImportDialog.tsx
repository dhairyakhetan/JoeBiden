import { useRef, useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useModalA11y } from './adminKit'
import { useToast } from '../components/Toast'
import coreMemberService, { type CoreImportRow } from '../services/coreMemberService'
import { parseEmailList, refreshCoreMembers } from '../lib/coreMembers'

/**
 * Bring the core members over from the Google Sheet (bug tracker 081395e9).
 * Paste the sheet's email column (or the whole sheet: anything that is not an
 * email is ignored). Each email is matched to an active member; one already
 * core is left alone, so pasting the same sheet twice adds nobody twice.
 * HR and super admin only; the database refuses anyone else.
 */
export default function CoreImportDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const panelRef = useRef<HTMLDivElement>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<CoreImportRow[] | null>(null)
  useModalA11y(true, panelRef, onClose, busy)
  const emails = parseEmailList(text)

  const run = async () => {
    if (emails.length === 0) return
    setBusy(true)
    try {
      const rows = await coreMemberService.addByEmails(emails)
      setResults(rows)
      refreshCoreMembers()
      const added = rows.filter(r => r.result === 'added').length
      if (added === 0) toast.info('nobody new to add.', 'everyone matched was already in AQ Core, or no email matched.')
      else toast.success(added === 1 ? '1 member added to AQ Core.' : `${added} members added to AQ Core.`)
    } catch (e: any) {
      toast.error('the list was not imported.', e?.message)
    } finally {
      setBusy(false)
    }
  }

  const count = (r: CoreImportRow['result']) => (results ?? []).filter(x => x.result === r).length
  const missing = (results ?? []).filter(r => r.result === 'not_found' || r.result === 'ambiguous')

  return (
    <div className="modal-back" onClick={e => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Import the core members list" className="modal">
        <div className="modal-head">
          <h3 style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.01em', margin: 0 }}>Import AQ Core list</h3>
          <button className="iconbtn" onClick={onClose} aria-label="Close" title="Close" disabled={busy}>
            <XMarkIcon width={18} height={18} strokeWidth={2.2} aria-hidden />
          </button>
        </div>
        <div className="modal-body">
          {results === null ? (
            <>
              <p style={{ marginTop: 0, color: 'var(--ink-2)' }}>
                Paste the email column from the core members sheet. Each email is matched to an active member. Anyone already in AQ Core is left as they are.
              </p>
              <label htmlFor="core-import" className="mono xs upper muted" style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>emails</label>
              <textarea
                id="core-import"
                className="textarea"
                rows={8}
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={'one@example.com\ntwo@example.com'}
              />
              <p className="mono xs muted" style={{ margin: '8px 0 0' }} aria-live="polite">
                {emails.length === 1 ? '1 email found' : `${emails.length} emails found`}
              </p>
              <div className="row gap-2" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
                <button className="btn btn-sm" onClick={onClose} disabled={busy}>cancel</button>
                <button className="btn btn-sm btn-primary" onClick={run} disabled={emails.length === 0 || busy} aria-busy={busy || undefined}>
                  {busy ? 'importing…' : emails.length ? `add ${emails.length} to AQ Core` : 'add to AQ Core'}
                </button>
              </div>
            </>
          ) : (
            <>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
                <li><strong>{count('added')}</strong> added to AQ Core</li>
                <li><strong>{count('already')}</strong> were already in AQ Core</li>
                <li><strong>{missing.length}</strong> not matched to an active member</li>
              </ul>
              {missing.length > 0 && (
                <>
                  <p className="mono xs upper muted" style={{ fontWeight: 700, margin: '14px 0 6px' }}>not matched (check the email, or they may not have joined yet)</p>
                  <ul className="code xs" style={{ margin: 0, paddingLeft: 18, maxHeight: 180, overflowY: 'auto', fontFamily: 'var(--code)' }}>
                    {missing.map(r => <li key={r.email}>{r.email}{r.result === 'ambiguous' ? ' (more than one account)' : ''}</li>)}
                  </ul>
                </>
              )}
              <div className="row gap-2" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
                <button className="btn btn-sm" onClick={() => { setResults(null); setText('') }}>import more</button>
                <button className="btn btn-sm btn-primary" onClick={onClose}>done</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
