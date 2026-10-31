import { useRef, useState } from 'react'
import { useModalA11y } from '../hooks/useDialog'
import { useToast } from '../components/Toast'
import breakService, { BREAK_REASONS, BreakReason } from '../services/breakService'

/**
 * HR-initiated break, from the Members desk — owner request: "HR... manually
 * have the option to put people on a break till... from today till a certain
 * date or from certain day to certain date." HR/super_admin, or a team lead
 * on a member of their own team — matches `hr_set_member_break()`'s own
 * `is_super_admin() OR is_team_lead_of_member()` check server-side (widened
 * 2026-09-12, see hr_set_member_break_allow_team_lead_2026_09_12.sql).
 *
 * Deliberately its own small dialog rather than a HR-mode branch bolted onto
 * BreakModal.tsx (the member's own self-service flow): that one owns its own
 * copy/reassurance/presets tuned for "I am telling my team I'm stepping
 * away," which reads wrong once the subject is someone else entirely.
 */
const todayStr = () => new Date().toISOString().slice(0, 10)

interface Props {
  /** Single-target form (the original shape). */
  memberId?: number
  memberName?: string
  /** Bulk form (Members desk multi-select) - applies the same form to every
   *  target, one `setMemberBreak` call each via Promise.allSettled so one
   *  target's failure (e.g. a team lead out of scope for that member) can't
   *  silently swallow the rest. */
  members?: { memberId: number; fullName: string }[]
  onClose: () => void
}

export default function MemberBreakDialog({ memberId, memberName, members, onClose }: Props) {
  const toast = useToast()
  const panelRef = useRef<HTMLDivElement>(null)
  const [start, setStart] = useState(todayStr())
  const [end, setEnd] = useState('')
  const [reason, setReason] = useState<BreakReason>('other')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const targets = members ?? (memberId != null ? [{ memberId, fullName: memberName ?? 'this member' }] : [])
  const isBulk = targets.length > 1

  /**
   * Bulk-only: "same dates for everyone" (merge, the original bulk
   * behaviour - one shared `start`/`end` above applies to all) vs
   * "different dates per person" (split - each target gets its own pair of
   * date inputs). Owner report: selecting two members with different
   * actual end dates had no way to give them different ones - the single
   * shared form was the only option. Reason/note stay shared either way -
   * only dates were the reported problem.
   */
  const [splitDates, setSplitDates] = useState(false)
  const [perTargetDates, setPerTargetDates] = useState<Record<number, { start: string; end: string }>>(
    () => Object.fromEntries(targets.map(t => [t.memberId, { start: todayStr(), end: '' }])),
  )
  const setPerTargetField = (memberId: number, field: 'start' | 'end', value: string) =>
    setPerTargetDates(prev => ({ ...prev, [memberId]: { ...prev[memberId], [field]: value } }))

  useModalA11y(true, panelRef, onClose, saving)

  const untilLabel = end ? new Date(end + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
  const splitReady = isBulk && splitDates && targets.every(t => perTargetDates[t.memberId]?.end)
  const canSubmit = isBulk && splitDates ? splitReady : !!end

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || saving || targets.length === 0) return
    setSaving(true)
    try {
      if (isBulk) {
        const results = await Promise.allSettled(
          targets.map(t => {
            const dates = splitDates ? perTargetDates[t.memberId] : { start, end }
            return breakService.setMemberBreak(t.memberId, { start: dates.start, end: dates.end, reason, note: note.trim() || undefined })
          })
        )
        const failed = results.filter(r => r.status === 'rejected').length
        const succeeded = results.length - failed
        if (failed === 0) toast.success(`${succeeded} member${succeeded === 1 ? '' : 's'} put on a break`, splitDates ? 'each until their own date' : `until ${untilLabel}`)
        else if (succeeded === 0) toast.error("that didn't save for anyone.", `${failed} failed`)
        else toast.error(`${succeeded} saved, ${failed} didn't.`, "the ones that failed may be outside your team.")
        onClose()
      } else {
        await breakService.setMemberBreak(targets[0].memberId, { start, end, reason, note: note.trim() || undefined })
        toast.success(`${targets[0].fullName} is on a break`, `until ${untilLabel}`)
        onClose()
      }
    } catch (err: any) {
      toast.error("that didn't save.", err?.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-back" onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }}>
      <div ref={panelRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="mbd-title" tabIndex={-1}>
        <div className="panel-h">
          <h2 id="mbd-title" style={{ margin: 0, font: 'inherit' }}>
            {isBulk ? `Put ${targets.length} members on a break` : `Put ${targets[0]?.fullName ?? 'this member'} on a break`}
          </h2>
          <button type="button" className="iconbtn no" onClick={onClose} disabled={saving} aria-label="Close" title="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="adm-note is-quiet" style={{ marginBottom: 14 }}>
          They'll be notified. This doesn't remove anything from their account - it's the same record they could set for themselves.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isBulk && (
            <div>
              <span className="adm-block-label">dates</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className={'chip' + (!splitDates ? ' chip-active' : '')} onClick={() => setSplitDates(false)}>
                  same for everyone
                </button>
                <button type="button" className={'chip' + (splitDates ? ' chip-active' : '')} onClick={() => setSplitDates(true)}>
                  different per person
                </button>
              </div>
            </div>
          )}

          {isBulk && splitDates ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {targets.map(t => {
                const d = perTargetDates[t.memberId] ?? { start: todayStr(), end: '' }
                return (
                  <div key={t.memberId} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, alignItems: 'end' }}>
                    <div className="mono xs" style={{ fontWeight: 700 }}>{t.fullName}</div>
                    <div>
                      <label htmlFor={`mbd-start-${t.memberId}`} className="adm-block-label">from</label>
                      <input
                        id={`mbd-start-${t.memberId}`} type="date" className="input" style={{ width: '100%' }}
                        value={d.start} onChange={e => setPerTargetField(t.memberId, 'start', e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor={`mbd-end-${t.memberId}`} className="adm-block-label">until <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input
                        id={`mbd-end-${t.memberId}`} type="date" className="input" style={{ width: '100%' }}
                        value={d.end} min={d.start} required onChange={e => setPerTargetField(t.memberId, 'end', e.target.value)}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label htmlFor="mbd-start" className="adm-block-label">from</label>
                <input id="mbd-start" type="date" className="input" style={{ width: '100%' }} value={start} onChange={e => setStart(e.target.value)} />
              </div>
              <div>
                <label htmlFor="mbd-end" className="adm-block-label">until <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input id="mbd-end" type="date" className="input" style={{ width: '100%' }} value={end} min={start} required onChange={e => setEnd(e.target.value)} />
              </div>
            </div>
          )}

          <div>
            <span className="adm-block-label">reason</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {BREAK_REASONS.map(r => (
                <button key={r.value} type="button" onClick={() => setReason(r.value)} className={'chip' + (reason === r.value ? ' chip-active' : '')}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="mbd-note" className="adm-block-label">note (optional, visible to them)</label>
            <textarea id="mbd-note" className="textarea" style={{ width: '100%', minHeight: 60, resize: 'vertical' }}
              rows={2} maxLength={280} value={note} onChange={e => setNote(e.target.value)} placeholder="anything they should know" />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={onClose} disabled={saving}>cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !end} aria-busy={saving}>
              {saving ? 'saving…' : 'set break'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
