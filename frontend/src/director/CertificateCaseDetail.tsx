import { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import { I } from '../components/v6Shared'
import certificateService, { AlreadyDecidedError } from '../services/certificateService'
import {
  buildRenderInput, CertificateTemplateMissingError, CertificateTextTooLongError, downloadBlob, renderCertificatePdf, renderCertificatePreview,
} from '../components/certificateGenerator'
import {
  certificateErrorMessage, certificateFilename, certificateLink, DRAFT_SOURCE_LABEL, formatHours, hoursLine, joinList, LIMITS, periodLabel, powersFor,
  RESPONSE_LABEL, standardWording, summariseHods, tagPath,
  type CertResponse, type CertTypeInfo, type DeskDoc, type OrgSubTeam, type OrgTeam, type Viewer,
} from '../certificates/certificateLogic'
import './CertificateRequests.css'

/**
 * Everything one document shows on the desk, and the controls each person may use on it. `powersFor` decides which controls
 * exist; the database decides again. A control that is off says why instead of going quiet.
 */

export interface DeskCtx {
  viewer: Viewer
  types: CertTypeInfo[]
  teams: OrgTeam[]
  subTeams: OrgSubTeam[]
  /** Reload the desk. Every action ends here, so the screen is always the database's version. */
  refresh: () => Promise<void> | void
}

const RESPONSE_TONE: Record<CertResponse, string> = { approve: 'var(--welfare)', disapprove: 'var(--tomato)', clueless: 'var(--sky)' }

export function fmtDate(iso: string | null): string {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return '' }
}

function ResponseTag({ response }: { response: CertResponse | null }) {
  if (!response) return <span className="qtag" style={{ ['--cc' as any]: 'var(--bg)' }}>waiting</span>
  return <span className="qtag" style={{ ['--cc' as any]: RESPONSE_TONE[response] }}>{RESPONSE_LABEL[response]}</span>
}

/** What the renderer needs for a desk document. Unissued ones are watermarked so a draft is never mistaken for a document. */
function renderInputFor(doc: DeskDoc, ctx: DeskCtx) {
  const teamNames = doc.tags.map(t => ctx.teams.find(x => x.teamId === t.teamId)?.name ?? '').filter(Boolean)
  return buildRenderInput({
    typeKey: doc.typeKey, teamNames, memberName: doc.memberName, issuedAt: doc.decidedAt, verifyCode: doc.verifyCode, body: doc.draft?.body,
    hours: doc.claimedMinHours, periodStart: doc.periodStart, periodEnd: doc.periodEnd, watermark: doc.status === 'issued' ? null : 'Preview',
  })
}

/** The preview, drawn from the saved text, so HR sees exactly what the member will get. */
function Preview({ doc, type, ctx }: { doc: DeskDoc; type: CertTypeInfo | undefined; ctx: DeskCtx }) {
  const [url, setUrl] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  if (!doc.draft || !type) return null
  const draw = async () => {
    setLoading(true); setErr(null)
    try {
      setUrl(await renderCertificatePreview(renderInputFor(doc, ctx)))
    } catch (e) {
      setErr(e instanceof CertificateTextTooLongError || e instanceof CertificateTemplateMissingError ? e.message : 'The preview would not draw. Try again.')
    } finally { setLoading(false) }
  }
  return (
    <div>
      {!url && <button type="button" className="btn btn-sm" disabled={loading} onClick={draw}>{loading ? 'drawing…' : 'preview the document'}</button>}
      {err && <p role="alert" className="cdesk-note" style={{ marginTop: 6 }}>{err}</p>}
      {url && (
        <>
          <div className="cdesk-preview"><img src={url} alt={`${doc.typeLabel} for ${doc.memberName}`} /></div>
          <button type="button" className="adm-disclose" style={{ marginTop: 6 }} onClick={() => setUrl(null)}>hide the preview</button>
        </>
      )}
    </div>
  )
}

export default function CertificateDocBlock({ doc, ctx }: { doc: DeskDoc; ctx: DeskCtx }) {
  const toast = useToast()
  const confirm = useConfirm()
  const type = ctx.types.find(t => t.key === doc.typeKey)
  const powers = powersFor(ctx.viewer, doc)
  const mineAnswer = doc.hods.find(h => h.memberId === ctx.viewer.memberId)?.response ?? null
  const summary = summariseHods(doc.hods)

  const [busy, setBusy] = useState(false)
  const [respNote, setRespNote] = useState('')
  const [noteText, setNoteText] = useState('')
  const [editing, setEditing] = useState(false)
  const [textDraft, setTextDraft] = useState('')
  const [reason, setReason] = useState('')

  const run = async (fn: () => Promise<unknown>, ok?: string, okDetail?: string): Promise<boolean> => {
    setBusy(true)
    try {
      await fn()
      if (ok) toast.success(ok, okDetail)
      await ctx.refresh()
      return true
    } catch (e: any) {
      if (e instanceof AlreadyDecidedError) { toast.info('already decided.', 'someone else got to this one first. showing the latest.'); await ctx.refresh(); return false }
      toast.error('that did not save.', certificateErrorMessage(e, e?.message || 'try again.'))
      return false
    } finally { setBusy(false) }
  }

  const respond = (r: CertResponse) => run(async () => { await certificateService.respond(doc.id, r, respNote); setRespNote('') }, 'answer saved', 'HR can see it.')
  const addNote = () => noteText.trim() && run(async () => { await certificateService.addNote(doc.id, noteText); setNoteText('') }, 'note added', 'Leaders can read it. The member cannot.')

  const standard = type?.hasStandardWording
    ? standardWording({ structured: !!type.structured, memberName: doc.memberName, minHours: doc.claimedMinHours, periodStart: doc.periodStart, periodEnd: doc.periodEnd })
    : null

  const saveText = async () => {
    if (await run(() => certificateService.setDraft(doc.id, textDraft, 'manual'), 'text saved', 'HR can approve it now.')) setEditing(false)
  }
  const useStandard = () => standard && run(() => certificateService.setDraft(doc.id, standard, 'standard'), 'standard wording saved', 'Read it, then approve.')

  const approve = async () => {
    const ok = await confirm({
      title: `issue this ${doc.typeLabel.toLowerCase()}?`,
      body: `${doc.memberName} will be told it is ready and can download it. Check the preview first: this cannot be undone.`,
      confirmLabel: 'issue it',
    })
    if (!ok) return
    await run(() => certificateService.decide(doc.id, 'issued', reason, doc.typeLabel), 'issued', `${doc.memberName} has been told. Share the link, or download it to send.`)
  }
  const decline = async () => {
    if (!reason.trim()) { toast.info('add a reason first.', 'The member is told why.'); return }
    await run(() => certificateService.decide(doc.id, 'declined', reason, doc.typeLabel), 'declined')
  }

  const download = async () => {
    if (!doc.draft || !type) return
    setBusy(true)
    try {
      downloadBlob(await renderCertificatePdf(renderInputFor(doc, ctx)), certificateFilename(type.key, doc.memberName))
    } catch (e) {
      toast.error('could not make the PDF.', e instanceof CertificateTextTooLongError || e instanceof CertificateTemplateMissingError ? e.message : 'try again.')
    } finally { setBusy(false) }
  }
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${certificateLink(doc.id)}`)
      toast.success('link copied', `Only ${doc.memberName}, HR and HoDs can open it.`)
    } catch { toast.error('could not copy the link.', 'Open the document and copy it from the address bar.') }
  }

  const pending = doc.status === 'pending'

  return (
    <section className="cdesk-doc" aria-label={`${doc.typeLabel} for ${doc.memberName}`}>
      <div className="cdesk-doc-head">
        <span className="cdesk-doc-title">{doc.typeLabel}</span>
        <span className="cdesk-sub">asked {fmtDate(doc.requestedAt)}</span>
      </div>

      <div>
        <p className="cdesk-label">hours</p>
        <p className="cdesk-quote">{hoursLine(doc)}</p>
        {doc.periodStart && doc.periodEnd && <p className="cdesk-quote">says they were with AQ from {periodLabel(doc.periodStart, doc.periodEnd)}</p>}
        <p className="cdesk-note">The member typed the hours and the months. They are a claim until someone who saw their work agrees.</p>
      </div>

      <div>
        <p className="cdesk-label">teams they were part of</p>
        {doc.tags.length === 0 ? <p className="cdesk-sub">none recorded</p> : (
          <ul className="cdesk-list">{doc.tags.map(t => <li key={`${t.teamId}:${t.subTeamId ?? ''}`}>{tagPath(t, ctx.teams, ctx.subTeams)}</li>)}</ul>
        )}
      </div>

      {doc.highlights && (
        <div>
          <p className="cdesk-label">what they asked to be mentioned</p>
          <p className="cdesk-quote">&ldquo;{doc.highlights}&rdquo;</p>
        </div>
      )}

      <div>
        <p className="cdesk-label">
          HoDs tagged{doc.hods.length > 0 && ` · ${summary.approve} approve, ${summary.disapprove} do not, ${summary.clueless} not sure, ${summary.waiting} waiting`}
        </p>
        {doc.hods.length === 0 ? <p className="cdesk-sub">none tagged</p> : (
          <ul className="cdesk-list">
            {doc.hods.map(h => (
              <li key={h.memberId} className="cdesk-hod">
                <span>{h.name}{h.memberId === ctx.viewer.memberId && ' (you)'}</span>
                <ResponseTag response={h.response} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {doc.notes.length > 0 && (
        <div>
          <p className="cdesk-label">notes from leaders</p>
          <ul className="cdesk-list">
            {doc.notes.map(n => <li key={n.id}><strong>{n.authorName}</strong> ({fmtDate(n.createdAt)}): {n.body}</li>)}
          </ul>
        </div>
      )}

      {powers.canRespond && (
        <div>
          <p className="cdesk-label">your answer, as a tagged HoD</p>
          <div className="cdesk-resp" role="group" aria-label="Your answer">
            {(['approve', 'disapprove', 'clueless'] as CertResponse[]).map(r => (
              <button key={r} type="button" className="btn btn-sm" disabled={busy} aria-pressed={mineAnswer === r} onClick={() => respond(r)}>
                {r === 'approve' ? <><I.check /> I can vouch</> : r === 'disapprove' ? <><XMarkIcon width={14} height={14} strokeWidth={2.4} aria-hidden /> I cannot vouch</> : 'not sure / not involved'}
              </button>
            ))}
          </div>
          <input className="cdesk-field" style={{ marginTop: 8 }} value={respNote} maxLength={LIMITS.maxNote} onChange={e => setRespNote(e.target.value)}
            aria-label="Optional note with your answer" placeholder="optional note with your answer" />
          <p className="cdesk-note">You can change your answer while the request is open. HR reads it; the member does not.</p>
        </div>
      )}

      {powers.canNote && (
        <div>
          <p className="cdesk-label">add a note for HR</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="cdesk-field" value={noteText} maxLength={LIMITS.maxNote} onChange={e => setNoteText(e.target.value)}
              aria-label="Note for HR" placeholder="something HR should know about this person" />
            <button type="button" className="btn btn-sm" disabled={busy || !noteText.trim()} onClick={addNote}>add</button>
          </div>
        </div>
      )}

      <div>
        <p className="cdesk-label">the text{doc.draft && ` · ${DRAFT_SOURCE_LABEL[doc.draft.source]}${doc.draft.draftedByName ? ` (${doc.draft.draftedByName})` : ''}`}</p>
        {doc.draft ? <p className="cdesk-text">{doc.draft.body}</p> : (
          <p className="cdesk-text-empty">No text yet. It is written at the next draft run{powers.canSetText ? ', or you can write it yourself below' : ''}.</p>
        )}
        {doc.draft && <div style={{ marginTop: 8 }}><Preview doc={doc} type={type} ctx={ctx} /></div>}

        {powers.canSetText && !editing && (
          <div className="cdesk-actions" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => { setTextDraft(doc.draft?.body ?? ''); setEditing(true) }}>
              {doc.draft ? 'edit the text' : 'write the text myself'}
            </button>
            {standard && <button type="button" className="btn btn-sm" disabled={busy} onClick={useStandard}>{doc.draft ? 'restore the standard wording' : 'use the standard wording'}</button>}
          </div>
        )}
        {powers.canSetText && editing && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <textarea className="cdesk-field" rows={9} value={textDraft} maxLength={LIMITS.maxDraft} onChange={e => setTextDraft(e.target.value)}
              aria-label="The text of the document" placeholder="Paste or write the text. A blank line starts a new paragraph." />
            <p className="cdesk-note">
              Use this when someone needs it now and cannot wait for the next draft. It replaces any draft. {textDraft.length} / {LIMITS.maxDraft}
            </p>
            <div className="cdesk-actions">
              <button type="button" className="btn btn-sm adm-approve" disabled={busy || !textDraft.trim()} onClick={saveText}>save the text</button>
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => setEditing(false)}>cancel</button>
            </div>
          </div>
        )}
      </div>

      {pending && ctx.viewer.role && (powers.canDecide || powers.decideBlockedReason) && (
        <div>
          <p className="cdesk-label">HR decision</p>
          <input className="cdesk-field" value={reason} maxLength={LIMITS.maxNote} onChange={e => setReason(e.target.value)}
            aria-label="Reason" placeholder="reason (required to decline, optional to issue)" />
          {powers.decideBlockedReason && <p className="cdesk-note" style={{ marginTop: 6 }}>{powers.decideBlockedReason}</p>}
          <div className="cdesk-actions" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-sm adm-approve" disabled={busy || !powers.canDecide} onClick={approve}><I.check /> issue</button>
            <button type="button" className="btn btn-sm adm-reject" disabled={busy || powers.isOwn} onClick={decline}>
              <XMarkIcon width={14} height={14} strokeWidth={2.4} aria-hidden /> decline
            </button>
          </div>
        </div>
      )}

      {!pending && (
        <div>
          <p className="cdesk-label">{doc.status === 'issued' ? 'issued' : 'declined'}</p>
          <p className="cdesk-quote">
            {doc.status === 'issued' ? 'Issued' : 'Declined'} by {doc.decidedByName ?? 'HR'} on {fmtDate(doc.decidedAt)}
            {doc.decisionNote && <> &middot; &ldquo;{doc.decisionNote}&rdquo;</>}
          </p>
          {doc.status === 'issued' && doc.verifyCode && <p className="cdesk-note" style={{ marginTop: 4 }}>verification code {doc.verifyCode}. anyone holding the document can check it at /verify.</p>}
          {powers.canDownload && (
            <div className="cdesk-actions" style={{ marginTop: 8 }}>
              <button type="button" className="btn btn-sm" disabled={busy} onClick={download}>{busy ? 'making the PDF…' : 'download PDF'}</button>
              <button type="button" className="btn btn-sm" onClick={copyLink}>copy link to share</button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/** "40 h" style chip text for a case row. */
export const caseChips = (docs: DeskDoc[]) => joinList([...new Set(docs.map(d => d.typeLabel))])
export const claimedChip = (d: DeskDoc) => (d.claimedMinHours != null ? `${formatHours(d.claimedMinHours)} h claimed` : '')
