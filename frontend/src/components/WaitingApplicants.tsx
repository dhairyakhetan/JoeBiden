import { useState } from 'react'
import type { WaitingApplicant } from '../lib/jobOpenings'
import type { CustomQuestion } from '../lib/jobOpenings'
import { OpeningAnswersDisplay } from './OpeningQuestionBuilder'
import { directorService } from '../services/directorService'
import { useToast } from './Toast'
import { useConfirm } from './Confirm'

/**
 * Applicants for a role who are not part of AquaTerra yet: HR has not cleared their account. A team sees them here, in
 * their own clearly marked group, so a lead who opens a role and sees 20 applications can tell which 10 they can act on
 * now. They cannot be accepted until HR approves the account; the application then moves into the normal list by itself
 * (database trigger, scripts/applicants_one_list_2026_11_12.sql). HR and super admin get an approve button right here.
 * Name, class, note and answers only: never a phone or an email.
 */
export default function WaitingApplicants({ items, questionsByOpening, onChanged }: {
  items: WaitingApplicant[]
  questionsByOpening: Record<string, CustomQuestion[]>
  /** Called after HR approves someone, so the caller reloads both lists. */
  onChanged: () => void
}) {
  const { success: toastSuccess, error: toastError } = useToast()
  const confirm = useConfirm()
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<Set<number>>(new Set())
  if (items.length === 0) return null

  const toggle = (id: string) => setOpen(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const approve = async (w: WaitingApplicant) => {
    const ok = await confirm({
      title: `Approve ${w.fullName}?`,
      body: `This makes them an AquaTerra member. Their application for ${w.openingTitle} then goes to the team straight away.`,
      confirmLabel: 'Approve',
    })
    if (!ok) return
    setBusy(prev => new Set(prev).add(w.memberId))
    try {
      await directorService.approveMember(w.memberId)
      toastSuccess(`${w.fullName} approved`)
      onChanged()
    } catch (e: any) {
      toastError('couldn’t approve.', e?.message ?? 'try again.')
    } finally {
      setBusy(prev => { const n = new Set(prev); n.delete(w.memberId); return n })
    }
  }

  return (
    <section aria-label="Waiting for HR" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div className="mono xs upper" style={{ fontWeight: 800 }}>{`waiting for HR (${items.length})`}</div>
        <p className="muted" style={{ fontSize: 13, margin: '4px 0 0', maxWidth: '62ch' }}>
          These people applied but are not part of AquaTerra yet. You can read what they sent now. You can accept them once HR approves their account, and each application then moves into the list below on its own.
        </p>
      </div>
      {items.map(w => {
        const hasDetail = !!w.message || Object.keys(w.answers || {}).length > 0
        const isOpen = open.has(w.interestId)
        return (
          <div key={w.interestId} className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{w.fullName}</div>
                <div className="mono" style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
                  not part of AquaTerra yet{w.classGrade ? ` · ${w.classGrade}` : ''} · {w.openingTitle}
                </div>
              </div>
              {w.canApprove ? (
                <button type="button" className="btn btn-sm btn-primary" style={{ minHeight: 44 }} disabled={busy.has(w.memberId)} onClick={() => approve(w)}>
                  {busy.has(w.memberId) ? 'Approving…' : 'Approve account'}
                </button>
              ) : (
                <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }} title="HR has to clear this account before the team can accept the application.">HR has to clear them first</span>
              )}
            </div>
            {hasDetail && (
              <>
                <button type="button" className="btn btn-sm btn-ghost" style={{ minHeight: 40, marginTop: 8 }} aria-expanded={isOpen} onClick={() => toggle(w.interestId)}>
                  {isOpen ? 'hide application' : 'read application'}
                </button>
                {isOpen && (
                  <div style={{ marginTop: 8 }}>
                    {w.message && <p style={{ margin: '0 0 8px', whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 13 }}>{w.message}</p>}
                    <OpeningAnswersDisplay questions={questionsByOpening[w.openingId] || []} answers={w.answers} />
                  </div>
                )}
              </>
            )}
          </div>
        )
      })}
    </section>
  )
}
