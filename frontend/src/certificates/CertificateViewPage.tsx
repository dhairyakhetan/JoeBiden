import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useMeta } from '../hooks/useMeta'
import { useToast } from '../components/Toast'
import { hasLeaderAccess } from '../lib/roles'
import certificateService from '../services/certificateService'
import {
  buildRenderInput, CertificateTemplateMissingError, CertificateTextTooLongError, downloadBlob, renderCertificatePdf, renderCertificatePreview, type RenderInput,
} from '../components/certificateGenerator'
import { certificateFilename, certificateLink } from './certificateLogic'
import './certificates.css'

/**
 * `/certificates/:id`: one issued document, to look at and download.
 *
 * Who sees what is the database's decision, not this page's: the owner reads the text only once HR has issued it, a leader reads it
 * always, and anyone else gets nothing back, which this page shows as "not found" so it does not confirm that an id exists.
 * HR copies this page's link to hand a member their document without sending a file.
 */
export default function CertificateViewPage() {
  useMeta({ title: 'Your certificate | AquaTerra', description: 'Your certificate from AquaTerra.', image: '', path: '/certificates', noIndex: true })
  const { id } = useParams()
  const requestId = Number(id)
  const { member } = useAuth()
  const leader = hasLeaderAccess((member as any)?.role)
  const toast = useToast()

  const [state, setState] = useState<'loading' | 'missing' | 'error' | 'pending' | 'declined' | 'ready'>('loading')
  const [render, setRender] = useState<RenderInput | null>(null)
  const [meta, setMeta] = useState<{ label: string; typeKey: string } | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!Number.isInteger(requestId) || requestId < 1) { setState('missing'); return }
    setState('loading')
    try {
      const one = await certificateService.getOne(requestId)
      if (!one) { setState('missing'); return }
      if (one.request.status === 'declined') { setNote(one.request.decisionNote); setState('declined'); return }
      if (one.request.status === 'pending' || !one.draft || !one.type) { setState('pending'); return }
      const teamNames = one.tags.map((t: { teamId: number }) => one.org.teams.find((x: { teamId: number }) => x.teamId === t.teamId)?.name ?? '').filter(Boolean)
      setRender(buildRenderInput({
        typeKey: one.type.key, teamNames, memberName: one.request.memberName || 'AquaTerra Member', issuedAt: one.request.decidedAt,
        verifyCode: one.request.verifyCode, body: one.draft.body, hours: one.request.claimedMinHours,
        periodStart: one.request.periodStart, periodEnd: one.request.periodEnd,
      }))
      setMeta({ label: one.type.label, typeKey: one.type.key })
      setState('ready')
    } catch {
      setState('error')
    }
  }, [requestId])
  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!render) return
    let live = true
    setPreviewError(null)
    renderCertificatePreview(render).then(u => { if (live) setPreview(u) }).catch((e: unknown) => {
      if (live) setPreviewError(e instanceof CertificateTextTooLongError || e instanceof CertificateTemplateMissingError ? e.message : 'The document would not draw. Try again.')
    })
    return () => { live = false }
  }, [render])

  const download = async () => {
    if (!render) return
    setBusy(true)
    try {
      downloadBlob(await renderCertificatePdf(render), certificateFilename(meta?.typeKey ?? 'document', render.memberName))
    } catch (e: any) {
      toast.error('could not make the PDF.', e instanceof CertificateTextTooLongError || e instanceof CertificateTemplateMissingError ? e.message : 'Try again.')
    } finally {
      setBusy(false)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${certificateLink(requestId)}`)
      toast.success('link copied', 'Only the person it was issued to, and the HR team and HoDs, can open it.')
    } catch {
      toast.error('could not copy the link.', 'Copy it from the address bar.')
    }
  }

  return (
    <div className="route-enter cert-page">
      <p className="cert-lede-small" style={{ margin: '0 0 12px' }}><Link to="/certificates">&larr; all certificates</Link></p>
      <h1 className="h-display" style={{ fontSize: 'clamp(28px, 5vw, 42px)', margin: 0 }}>{meta ? meta.label.toLowerCase() + '.' : 'your document.'}</h1>

      {state === 'loading' && <p className="cert-lede">loading…</p>}
      {state === 'missing' && <p className="cert-lede">We cannot find that document. It may belong to someone else, or the link may be wrong.</p>}
      {state === 'error' && <p className="cert-lede" role="alert">Something went wrong. <button type="button" className="cert-link-btn" onClick={() => void load()}>try again</button></p>}
      {state === 'pending' && <p className="cert-lede">This one is still in review. You will get a notification the moment it is ready.</p>}
      {state === 'declined' && (
        <p className="cert-lede">This request was not issued.{note ? ` Reason: ${note}` : ' Ask the HR team if you would like to know more.'}</p>
      )}

      {state === 'ready' && render && (
        <>
          <div className="cert-doc">
            {preview ? <img src={preview} alt={`${meta?.label ?? 'Document'} for ${render.memberName}`} /> : <div className="cert-empty">{previewError ?? 'drawing your document…'}</div>}
          </div>
          {previewError && <div role="alert" className="aq-field-error cert-error">{previewError}</div>}
          <div className="cert-doc-actions">
            <button type="button" className="btn btn-primary" disabled={busy || !!previewError} onClick={download} style={{ minHeight: 48 }}>
              {busy ? 'Making the PDF…' : 'Download PDF'}
            </button>
            {leader && <button type="button" className="btn" onClick={copyLink} style={{ minHeight: 48 }}>Copy link to share</button>}
          </div>
          <p className="cert-lede-small" style={{ marginTop: 16 }}>
            Whoever you give this to can check it is genuine at <Link to="/verify">ngoaquaterra.com/verify</Link> with the code printed on it.
          </p>
        </>
      )}
    </div>
  )
}
