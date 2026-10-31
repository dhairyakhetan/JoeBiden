import Img from './Img'
import { useState, useEffect, useCallback, useRef } from 'react'
import { dataUrlToFile } from '../lib/uiHelpers'
import { generatePoster, downloadPoster, POSTER_TEMPLATE_NAMES, POSTER_TYPOGRAPHIC_TEMPLATE_NAMES, POSTER_HIRING_TEMPLATE_NAMES, type PosterData, type PosterFormat, type PosterResult } from './posterGenerator'
import TemplatePicker from './TemplatePicker'
import { useToast } from './Toast'
import useDialog from '../hooks/useDialog'
import './PosterStudioModal.css'

interface PosterStudioModalProps {
  data: PosterData
  onClose: () => void
}

// Web Share API *with files* - see the matching comment in ShareModal.tsx.
// Duplicated rather than imported: the two modals don't otherwise share a
// module, and this is a three-line capability probe, not worth a new shared
// file for.
const canShareFiles = (() => {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false
  try {
    return navigator.canShare({ files: [new File([''], 'probe.png', { type: 'image/png' })] })
  } catch { return false }
})()


const FORMATS: { value: PosterFormat; label: string; dim: string; ratio: string }[] = [
  { value: 'post', label: 'Post', dim: '1080 × 1440', ratio: '4 / 5' },
  { value: 'story', label: 'Story', dim: '1080 × 1920', ratio: '9 / 16' },
]

// Instagram graphic studio. Picks a random brand-compliant template every
// generate/regenerate so each export is a fresh design (or pins a chosen one
// via the design picker).
//
// It used to be role-gated: FeedPostCard hand-rolled
// `['hod','director','super_admin'].includes(role)` and PostPage used
// `hasLeaderAccess`, so a member could not make a graphic out of their own
// post. There is nothing to gate - this writes nothing, reads nothing, and
// only redraws content the viewer is already looking at - so the studio is now
// reached from ShareModal's poster row by anyone who can open the share sheet.
// The one caller that stays leader-scoped is OpportunitiesPage's ManagePopover,
// and that is because the popover itself is opening MANAGEMENT (edit, pause,
// close, delete), not because the studio is.
export default function PosterStudioModal({ data, onClose }: PosterStudioModalProps) {
  const { error: toastError } = useToast()
  const [format, setFormat] = useState<PosterFormat>('post')
  const [template, setTemplate] = useState<string | null>(null)
  const [result, setResult] = useState<PosterResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // In-flight state for the share-sheet handoff, separate from `busy` (canvas
  // generation) so a slow tap-to-share doesn't read as "regenerating".
  const [sharing, setSharing] = useState(false)
  const reqId = useRef(0)

  const lastTemplate = useRef<string | null>(null)

  const run = useCallback(async (fmt: PosterFormat, tpl: string | null) => {
    const id = ++reqId.current
    setBusy(true); setError(null)
    try {
      // When not pinning a template, exclude the last-drawn one so regenerate
      // doesn't redraw the same design on a small sub-pool.
      const res = await generatePoster(data, fmt, {
        template: tpl ?? undefined,
        exclude: tpl ? undefined : (lastTemplate.current ?? undefined),
      })
      lastTemplate.current = res.template
      if (id === reqId.current) setResult(res)
    } catch (e) {
      console.error('Poster generation failed:', e)
      if (id === reqId.current) setError('Could not generate - try again.')
    } finally {
      if (id === reqId.current) setBusy(false)
    }
  }, [data])

  // First design on open + whenever the format changes.
  useEffect(() => { run(format, template) }, [format, run]) // eslint-disable-line react-hooks/exhaustive-deps

  // Was an Escape listener only — no Tab trap and no scroll-lock.
  const panelRef = useDialog(true, onClose)

  const posterFilename = () => {
    const slug = (data.uuid || 'post').slice(0, 6)
    return `aquaterra-${format}-${slug}.png`
  }

  const posterShareTitle = data.hiring
    ? (data.hiring.teamName ? `${data.hiring.teamName} is hiring` : 'Open role at AquaTerra')
    : 'AquaTerra'

  const handleDownload = () => {
    if (!result) return
    downloadPoster(result.dataUrl, posterFilename())
  }

  // Primary action once a design is ready. Hands the PNG to the OS share
  // sheet (Instagram appears there as a target, same as any native app share)
  // when the browser can share files at all; otherwise falls back to the
  // existing download flow. See the matching handler in ShareModal.tsx for
  // why this is a share-sheet handoff rather than Graph API auto-publish.
  const handleShare = async () => {
    if (!result) return
    const filename = posterFilename()
    if (!canShareFiles) { downloadPoster(result.dataUrl, filename); return }
    setSharing(true)
    try {
      const file = await dataUrlToFile(result.dataUrl, filename)
      if (!navigator.canShare({ files: [file] })) { downloadPoster(result.dataUrl, filename); return }
      await navigator.share({ files: [file], title: posterShareTitle })
    } catch (e: any) {
      if (e?.name === 'AbortError') return // user backed out of the share sheet - not a failure
      console.error('Poster share failed:', e)
      toastError('couldn’t open the share sheet', 'downloading the image instead')
      downloadPoster(result.dataUrl, filename)
    } finally {
      setSharing(false)
    }
  }

  const fmt = FORMATS.find(f => f.value === format)!
  return (
    <div role="presentation" className="ps-back" onClick={e => { e.stopPropagation(); onClose() }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Poster studio" tabIndex={-1} className="ps-panel" onClick={e => e.stopPropagation()}>
        <header className="ps-head">
          <div className="ps-title">
            <span aria-hidden className="ps-spark">✦</span>
            <div>
              <div className="ps-h1">poster studio</div>
              <div className="mono ps-sub">a fresh brand design every time · instagram-ready</div>
            </div>
          </div>
          <button type="button" className="ps-x" onClick={e => { e.stopPropagation(); onClose() }} aria-label="Close">✕</button>
        </header>

        <div className="ps-body">
          <section className="ps-stage" aria-label="Preview">
            <div className="ps-frame" style={{ aspectRatio: fmt.ratio }}>
              {result && <Img src={result.dataUrl} alt="Generated poster preview" className={'ps-img' + (busy ? ' is-busy' : '')} />}
              {busy && (
                <div className="ps-busy" role="status">
                  <span className="ps-spin" aria-hidden />
                  <span className="mono">designing…</span>
                </div>
              )}
              {error && !busy && <div role="alert" className="ps-err"><span className="mono">{error}</span></div>}
            </div>
            {result && !busy && <div className="mono ps-cap">✦ {result.template}{result.usedPhoto ? ' · photo' : ' · typographic'}</div>}
          </section>

          <section className="ps-controls" aria-label="Options">
            <div className="ps-field">
              <span className="mono ps-label">format</span>
              <div className="ps-seg" role="group" aria-label="Format">
                {FORMATS.map(f => (
                  <button key={f.value} type="button" onClick={() => setFormat(f.value)} aria-pressed={format === f.value} className={'ps-seg-btn' + (format === f.value ? ' is-on' : '')}>
                    <span className="ps-seg-name">{f.label}</span>
                    <span className="mono ps-seg-dim">{f.dim}</span>
                  </button>
                ))}
              </div>
            </div>
            <TemplatePicker
              wrap
              names={data.hiring ? POSTER_HIRING_TEMPLATE_NAMES : data.imageUrl ? POSTER_TEMPLATE_NAMES : POSTER_TYPOGRAPHIC_TEMPLATE_NAMES}
              selected={template}
              onSelect={tpl => { setTemplate(tpl); run(format, tpl) }}
            />
            {!data.hiring && !data.imageUrl && (
              <p className="ps-note">This post has no photo, so only the typographic designs are offered.</p>
            )}
          </section>
        </div>

        <footer className="ps-foot">
          <button type="button" className="btn btn-sm ps-regen" onClick={() => run(format, template)} disabled={busy} title="Generate a new random design">↻ regenerate</button>
          <button type="button" className="btn btn-sm btn-primary ps-go" onClick={handleShare} disabled={busy || !result || sharing}>
            {sharing ? 'opening share sheet…' : canShareFiles ? '↗ share' : '↓ download PNG'}
          </button>
          {canShareFiles && (
            <button type="button" className="ps-alt" onClick={handleDownload} disabled={busy || !result}>download PNG instead</button>
          )}
        </footer>
      </div>
    </div>
  )
}
