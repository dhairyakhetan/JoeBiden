import { useEffect, useMemo, useRef, useState } from 'react'
import Modal from '../components/Modal'
import Field from '../components/Field'
import { useToast } from '../components/Toast'
import { useAuth } from '../auth/AuthContext'
import { bugReportService } from '../services/bugReportService'
import { BUG_LIMITS, checkAttachment, safePageUrl, type BugKind, type BugSeverity, type CaptureMethod } from './bugModel'
import { acceptScreenshot } from './shrinkImage'
import './BugReports.css'

export interface ReportBugInitial {
  /** Where the member was when they opened this. Defaults to the current page. */
  pageUrl?: string
  /** Screenshots already in hand (the shortcut captures one before opening this). */
  files?: File[]
  captureMethod?: CaptureMethod
  /** The shortcut tried to take a picture of the page and could not. */
  captureFailed?: boolean
  /** Which option starts selected. Defaults to a bug. */
  kind?: BugKind
}

interface Props {
  open: boolean
  onClose: () => void
  initial?: ReportBugInitial
  onSubmitted?: (id: string) => void
}

const SEVERITIES: Record<BugKind, Array<[BugSeverity, string, string]>> = {
  bug: [
    ['high', 'high', 'blocks something people need to do'],
    ['med', 'medium', 'wrong or broken, but there is a way round'],
    ['low', 'low', 'cosmetic or minor'],
  ],
  feature: [
    ['high', 'high', 'people are waiting on this'],
    ['med', 'medium', 'would make things clearly better'],
    ['low', 'low', 'nice to have'],
  ],
}

const KINDS: Array<[BugKind, string, string]> = [
  ['bug', 'something is broken', 'it used to work, or does the wrong thing'],
  ['feature', 'a new feature or change', 'something the site should do that it does not'],
]

const COPY: Record<BugKind, { label: string; hint: string; placeholder: string; weight: string }> = {
  bug: {
    label: 'what went wrong?',
    hint: 'say what you did, what you expected, and what happened instead.',
    placeholder: 'for example: on a phone, the sticker text covers the home button',
    weight: 'how bad is it?',
  },
  feature: {
    label: 'what should the site do?',
    hint: 'say who it is for, what they are trying to do, and what would make it easy.',
    placeholder: 'for example: let a head of department attach a file when they approve a post',
    weight: 'how much do you want it?',
  },
}

/**
 * The bug report form. Used from /bugs ("report a bug") and by the invisible shortcut.
 * Mutation convention (CLAUDE.md): pending state while in flight, a toast on success, an
 * explicit error (never a silent console log) on failure.
 */
export default function ReportBugModal({ open, onClose, initial, onSubmitted }: Props) {
  const { member } = useAuth()
  const toast = useToast()
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.ngoaquaterra.com'
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<BugSeverity>('med')
  const [kind, setKind] = useState<BugKind>(initial?.kind ?? 'bug')
  const [pageInput, setPageInput] = useState(initial?.pageUrl ?? (typeof window !== 'undefined' ? window.location.href : ''))
  const [files, setFiles] = useState<File[]>(initial?.files ?? [])
  const [fileError, setFileError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const docInput = useRef<HTMLInputElement>(null)
  const [docs, setDocs] = useState<File[]>([])
  const [docError, setDocError] = useState<string | null>(null)

  // Previews are object URLs; revoke them so a long session does not hold the images.
  const previews = useMemo(() => files.map(f => URL.createObjectURL(f)), [files])
  useEffect(() => () => { previews.forEach(u => URL.revokeObjectURL(u)) }, [previews])

  const remaining = BUG_LIMITS.maxScreenshots - files.length
  const trimmed = description.trim()
  const tooShort = trimmed.length < BUG_LIMITS.descriptionMin
  const memberUuid = (member as any)?.uuid as string | undefined

  async function addFiles(picked: File[]) {
    setFileError(null)
    const next: File[] = []
    for (const f of picked.slice(0, remaining)) {
      const r = await acceptScreenshot(f)
      if (r.ok) next.push(r.file)
      else setFileError(r.reason)
    }
    if (picked.length > remaining) setFileError(`up to ${BUG_LIMITS.maxScreenshots} screenshots per report.`)
    if (next.length) setFiles(prev => [...prev, ...next])
  }

  function addDocs(picked: File[]) {
    setDocError(null)
    const room = BUG_LIMITS.maxAttachments - docs.length
    const next: File[] = []
    for (const f of picked.slice(0, Math.max(room, 0))) {
      const chk = checkAttachment(f)
      if (chk.ok) next.push(f)
      else setDocError(chk.reason)
    }
    if (picked.length > room) setDocError(`up to ${BUG_LIMITS.maxAttachments} documents per report.`)
    if (next.length) setDocs(prev => [...prev, ...next])
  }

  function onPaste(e: React.ClipboardEvent) {
    const images = Array.from(e.clipboardData?.files ?? []).filter(f => f.type.startsWith('image/'))
    if (images.length) { e.preventDefault(); void addFiles(images) }
  }

  async function submit() {
    if (submitting || tooShort || !memberUuid) return
    setSubmitting(true)
    setError(null)
    try {
      const page = safePageUrl(pageInput, origin)
      const id = await bugReportService.submit(memberUuid, {
        description: trimmed,
        severity,
        kind,
        pageUrl: page.url,
        pagePath: page.path,
        files,
        attachments: docs,
        captureMethod: initial?.captureMethod ?? 'form',
      })
      toast.success(kind === 'feature' ? 'request sent' : 'bug reported', 'it is on the list. you can follow it on the bugs and requests page.')
      onSubmitted?.(id)
      onClose()
    } catch (err) {
      const message = (err as { message?: string })?.message ?? ''
      // The database refuses an 11th report in an hour with this wording.
      const limited = /too many reports/i.test(message)
      setError(limited ? 'you have filed 10 reports in the last hour. try again a little later.' : "couldn't send your report. check your connection and try again.")
      toast.error("couldn't send your report", limited ? 'ten reports an hour is the limit.' : 'nothing was filed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={open} onClose={submitting ? () => {} : onClose} title="report a bug or request a feature" size="md" fullScreenMobile>
      <div className="bug-form" onPaste={onPaste}>
        <fieldset className="bug-sev">
          <legend className="bug-label">what is this?</legend>
          <div className="bug-kind-row">
            {KINDS.map(([value, label, hint]) => (
              <label key={value} className={'bug-sev-opt' + (kind === value ? ' on' : '')}>
                <input type="radio" name="bug-kind" value={value} checked={kind === value} onChange={() => setKind(value)} />
                <span className="bug-sev-name">{label}</span>
                <span className="bug-sev-hint">{hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <Field
          label={COPY[kind].label}
          required
          hint={`${trimmed.length}/${BUG_LIMITS.descriptionMax}. ${COPY[kind].hint}`}
        >
          {(id, describedBy) => (
            <textarea
              id={id}
              aria-describedby={describedBy}
              className="input bug-textarea"
              rows={5}
              maxLength={BUG_LIMITS.descriptionMax}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={COPY[kind].placeholder}
              autoFocus
            />
          )}
        </Field>

        <fieldset className="bug-sev">
          <legend className="bug-label">{COPY[kind].weight}</legend>
          <div className="bug-sev-row">
            {SEVERITIES[kind].map(([value, label, hint]) => (
              <label key={value} className={'bug-sev-opt' + (severity === value ? ' on' : '')}>
                <input type="radio" name="bug-severity" value={value} checked={severity === value} onChange={() => setSeverity(value)} />
                <span className="bug-sev-name">{label}</span>
                <span className="bug-sev-hint">{hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <Field label="page" hint="the page this is about. already filled in.">
          {(id, describedBy) => (
            <input
              id={id}
              aria-describedby={describedBy}
              className="input"
              type="text"
              maxLength={BUG_LIMITS.urlMax}
              value={pageInput}
              onChange={e => setPageInput(e.target.value)}
              inputMode="url"
            />
          )}
        </Field>

        <div className="bug-shots">
          <div className="bug-label">screenshots <span className="bug-opt">({files.length}/{BUG_LIMITS.maxScreenshots}, optional)</span></div>
          {files.length > 0 && (
            <ul className="bug-shot-list">
              {files.map((_, i) => (
                <li key={previews[i]} className="bug-shot">
                  <img src={previews[i]} alt={`screenshot ${i + 1}`} />
                  <button type="button" className="bug-shot-x" aria-label={`remove screenshot ${i + 1}`}
                    onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}>
                    remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            hidden
            onChange={e => { void addFiles(Array.from(e.target.files ?? [])); e.target.value = '' }}
          />
          <div className="bug-shot-actions">
            <button type="button" className="btn" onClick={() => fileInput.current?.click()} disabled={remaining <= 0 || submitting}>
              attach a screenshot
            </button>
            <span className="bug-hint">you can also paste an image here. screenshots stay private to you and the leaders who fix bugs.</span>
          </div>
          {initial?.captureMethod === 'shortcut' && files.length > 0 && (
            <p className="bug-hint">this is a redrawing of the page you were on, so it may differ a little from what you saw. remove it if it shows anything private, or attach a real screenshot instead.</p>
          )}
          {initial?.captureFailed && (
            <p className="bug-hint">we could not take a picture of this page. attach a screenshot if it helps.</p>
          )}
          {fileError && <p className="bug-err" role="alert">{fileError}</p>}
        </div>

        <div className="bug-shots">
          <div className="bug-label">documents <span className="bug-opt">({docs.length}/{BUG_LIMITS.maxAttachments}, optional)</span></div>
          {docs.length > 0 && (
            <ul className="bug-doc-list">
              {docs.map((f, i) => (
                <li key={f.name + i} className="bug-doc">
                  <span className="bug-doc-name">{f.name}</span>
                  <span className="bug-hint">{Math.max(1, Math.round(f.size / 1024))} KB</span>
                  <button type="button" className="bug-shot-x bug-doc-x" aria-label={`remove ${f.name}`} disabled={submitting}
                    onClick={() => setDocs(prev => prev.filter((_, j) => j !== i))}>remove</button>
                </li>
              ))}
            </ul>
          )}
          <input ref={docInput} type="file" accept=".pdf,.txt,.docx,.xlsx" multiple hidden
            onChange={e => { addDocs(Array.from(e.target.files ?? [])); e.target.value = '' }} />
          <div className="bug-shot-actions">
            <button type="button" className="btn" onClick={() => docInput.current?.click()} disabled={docs.length >= BUG_LIMITS.maxAttachments || submitting}>
              attach a document
            </button>
            <span className="bug-hint">pdf, text, word (.docx) or excel (.xlsx), up to 10 MB each. only you and the leaders can open them.</span>
          </div>
          {docError && <p className="bug-err" role="alert">{docError}</p>}
        </div>

        {error && <p className="bug-err" role="alert">{error}</p>}
      </div>

      <Modal.Footer>
        <button type="button" className="btn" onClick={onClose} disabled={submitting}>cancel</button>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={tooShort || !memberUuid || submitting} aria-busy={submitting}>{submitting ? 'sending...' : kind === 'feature' ? 'send request' : 'send report'}</button>
      </Modal.Footer>
    </Modal>
  )
}
