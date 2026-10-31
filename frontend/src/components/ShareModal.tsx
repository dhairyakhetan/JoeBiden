import Portal from './Portal'
import Img from './Img'
import { useState, useEffect } from 'react'
import { dataUrlToFile } from '../lib/uiHelpers'
// qrcode is dynamically imported inside the opening-share effect below — a
// static import pulled the whole vendor-paradox-heavy chunk (~525KB, physics +
// barcode scanner) onto every member route that renders a ShareModal, for a QR
// generator only used on opening shares.
import { generateStory, downloadStory, STORY_POST_TEMPLATE_NAMES, STORY_OPENING_TEMPLATE_NAMES, type StoryData } from './StoryGenerator'
import TemplatePicker from './TemplatePicker'
import PosterStudioModal from './PosterStudioModal'
import type { PosterData } from './posterGenerator'
import { useToast } from './Toast'
import useDialog from '../hooks/useDialog'

interface ShareModalProps {
  url: string
  storyData: StoryData
  // Optional poster payload. When present the sheet grows a third export
  // path - the poster studio - so link / story / poster all live on one
  // surface instead of the poster hanging off a separate, role-gated
  // button next to the share icon. Poster generation is client-side canvas
  // work with no write behind it, so it is offered to every viewer that
  // can see the share sheet.
  posterData?: PosterData
  onClose: () => void
}

const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
// Web Share API *with files* is a separate, narrower capability than plain
// navigator.share(url) above - Instagram only shows up as a share-sheet
// target when the OS-level sheet receives an actual file, not a link. Probed
// once at module load (support doesn't change mid-session) with a throwaway
// PNG File, same pattern as canNativeShare.
const canShareFiles = (() => {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false
  try {
    return navigator.canShare({ files: [new File([''], 'probe.png', { type: 'image/png' })] })
  } catch { return false }
})()

// Data URLs never touch the network, so fetch() on one resolves entirely
// in-process - this is the standard, dependency-free way back to a Blob/File
// without hand-rolling base64 decoding.

export default function ShareModal({ url, storyData, posterData, onClose }: ShareModalProps) {
  const { error: toastError } = useToast()
  // Poster studio, opened from the row below. It is a sibling overlay at a
  // higher z-index (320 vs this sheet's 300), so the share sheet stays behind
  // it and is still there when the studio closes.
  const [showPoster, setShowPoster] = useState(false)
  // Escape + Tab trap + focus restore + body scroll-lock. This used to be an
  // Escape listener only, so Tab walked straight out of the sheet onto the feed
  // behind it and the page scrolled under the sheet on touch.
  //
  // Handed `false` while the poster studio is stacked on top: both dialogs
  // bind their Escape/Tab handler to `document`, and `stopPropagation` does
  // not stop a sibling listener on the same node. Left always-on, Escape in
  // the studio closed the sheet underneath it too, and Tab inside the studio
  // was yanked back into the sheet by this trap's "focus left the panel"
  // branch. Standing down here leaves exactly one live trap at a time; the
  // hook's own focus-restore and scroll-lock hand off in the right order.
  const panelRef = useDialog(!showPoster, onClose)

  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [generated, setGenerated] = useState(false)
  // In-flight state for the share-sheet handoff (as opposed to `generating`,
  // which covers drawing the canvas). Separate because a slow tap-to-share can
  // sit on the OS sheet for a while and the button needs its own disabled/label
  // state during that window.
  const [sharingStory, setSharingStory] = useState(false)
  const [template, setTemplate] = useState<string | null>(null)
  const [lastTemplate, setLastTemplate] = useState<string | null>(null)
  // QR code - hiring-specific (Phase 8): a physical flyer/poster for an
  // opening needs something scannable, not just a copyable link. Generated
  // client-side, error-correction level M keeps it legible at typical
  // print/scan sizes even though the encoded URL (team uuid + opening uuid)
  // runs long - a URL shortener was considered and judged unnecessary since
  // a ~100-char URL is well within a QR code's comfortable density range.
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const isOpening = storyData.type === 'opening'

  useEffect(() => {
    if (!isOpening) return
    let cancelled = false
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(url, { width: 480, margin: 2, errorCorrectionLevel: 'M' }))
      .then(dataUrl => { if (!cancelled) setQrDataUrl(dataUrl) })
      .catch(err => console.error('QR code generation failed:', err))
    return () => { cancelled = true }
  }, [url, isOpening])

  const handleDownloadQr = () => {
    if (!qrDataUrl) return
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = `aq-${(storyData.openingTitle || 'opening').toLowerCase().replace(/\s+/g, '-').slice(0, 40)}-qr.png`
    a.click()
  }

  const templateNames = storyData.type === 'post' ? STORY_POST_TEMPLATE_NAMES : STORY_OPENING_TEMPLATE_NAMES

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(url) } catch {
      const el = document.createElement('input'); el.value = url
      document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el)
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: storyData.type === 'post' ? (storyData.title || 'AquaTerra post') : (storyData.openingTitle || 'Open role'),
        url,
      })
    } catch { /* user cancelled */ }
  }

  const handleGenerateStory = async (tpl?: string | null) => {
    setGenerating(true)
    try {
      const pin = (tpl ?? template) ?? undefined
      // When not pinning a specific design, exclude the last-drawn template so
      // "regenerate" on a small pool doesn't keep redrawing the same one.
      const { dataUrl, template: used } = await generateStory(storyData, {
        template: pin,
        exclude: pin ? undefined : (lastTemplate ?? undefined),
      })
      setPreview(dataUrl); setGenerated(true); setLastTemplate(used)
    } catch (e: any) {
      // Was a console.error only, which is a silent failure on the page: the
      // dashed generate button simply stopped spinning and nothing said why.
      console.error('Story generation failed:', e)
      toastError('couldn’t draw that story card. try again.', e?.message)
    } finally { setGenerating(false) }
  }

  const storyFilename = () => storyData.type === 'post'
    ? `aq-post-${(storyData.uuid || 'post').slice(0, 6)}.png`
    : `aq-${(storyData.teamName || 'team').toLowerCase().replace(/\s+/g, '-')}-opening.png`

  const storyShareTitle = () => storyData.type === 'post'
    ? (storyData.title || 'AquaTerra post')
    : (storyData.openingTitle || 'Open role')

  const handleDownload = () => {
    if (!preview) return
    downloadStory(preview, storyFilename())
  }

  // Primary action on a generated story card. Hands the PNG itself to the
  // OS-level share sheet (Instagram shows up there as a target the way any
  // native app does with a shared image) when the browser supports sharing
  // files at all; otherwise falls straight back to the existing download flow
  // - true auto-publish to Instagram isn't realistic for a volunteer org (see
  // CLAUDE.md), so a share-sheet/download handoff is the deliberate design.
  const handleShareStory = async () => {
    if (!preview) return
    const filename = storyFilename()
    if (!canShareFiles) { downloadStory(preview, filename); return }
    setSharingStory(true)
    try {
      const file = await dataUrlToFile(preview, filename)
      // Re-check with the real file, not just the module-load probe - some
      // browsers gate on more than mime type (size, file count).
      if (!navigator.canShare({ files: [file] })) { downloadStory(preview, filename); return }
      await navigator.share({ files: [file], title: storyShareTitle(), text: url })
    } catch (e: any) {
      // A user backing out of the share sheet rejects with AbortError - that's
      // a choice, not a failure, and must not toast an error at someone who
      // just decided not to share.
      if (e?.name === 'AbortError') return
      console.error('Story share failed:', e)
      toastError('couldn’t open the share sheet', 'downloading the image instead')
      downloadStory(preview, filename)
    } finally {
      setSharingStory(false)
    }
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '14px 18px',
    borderBottom: '1px solid var(--line)',
    cursor: 'pointer', background: 'none', border: 'none',
    width: '100%', textAlign: 'left',
    transition: 'background 0.12s, transform 0.1s var(--ease-out)',
  }

  return (
    <Portal>
<div
      role="presentation"
      onClick={e => { e.stopPropagation(); onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0 12px 12px',
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Share"
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 460,
          background: 'var(--card)',
          // Overlay layer migrated to rounded minimalism: the retired sheet was
          // 20px + a 3px ink border + a 6px hard offset. Outer panel radius is
          // --r-outer, its edge a hairline, and a modal's depth is --lift-4.
          borderRadius: 'var(--r-outer)',
          border: 'var(--hair-2)',
          boxShadow: 'var(--lift-4)',
          overflow: 'hidden',
          animation: 'sheetUp 0.2s var(--ease-out)',
        }}
      >
        {/* Handle + header */}
        {/* header divider: 2px --line -> --hair, the in-panel divider token */}
        <div style={{ padding: '14px 18px 12px', borderBottom: 'var(--hair)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 17 }}>share</div>
          <button
            onClick={e => { e.stopPropagation(); onClose() }}
            aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 18, lineHeight: 1, width: 44, height: 44, display: 'grid', placeItems: 'center', borderRadius: 'var(--r-tight)', transition: 'color 0.12s' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-3)')}
          >✕</button>
        </div>

        {/* 1 - Native share (only on mobile / browsers that support it) */}
        {canNativeShare && (
          <button
            style={{ ...rowStyle, borderBottom: '1px solid var(--line)' }}
            onClick={handleNativeShare}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-2)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}
            onMouseDown={e => ((e.currentTarget as HTMLElement).style.transform = 'scale(0.96)')}
            onMouseUp={e => ((e.currentTarget as HTMLElement).style.transform = 'scale(1)')}
          >
            {/* row icon tile: off-scale 12 -> --r-tight, 1.5px --line edge -> hairline */}
            <span style={{ width: 40, height: 40, borderRadius: 'var(--r-tight)', background: 'var(--bg-2)', display: 'grid', placeItems: 'center', fontSize: 20, flexShrink: 0, border: 'var(--hair-2)' }}>↗</span>
            <div>
              <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 14 }}>Share</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>open in messages, whatsapp, more</div>
            </div>
          </button>
        )}

        {/* 2 - Copy link */}
        <button
          style={{ ...rowStyle }}
          onClick={handleCopy}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-2)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}
          onMouseDown={e => ((e.currentTarget as HTMLElement).style.transform = 'scale(0.96)')}
          onMouseUp={e => ((e.currentTarget as HTMLElement).style.transform = 'scale(1)')}
        >
          <span style={{
            width: 40, height: 40, borderRadius: 'var(--r-tight)', flexShrink: 0,
            background: copied ? 'var(--welfare)' : 'var(--bg-2)',
            display: 'grid', placeItems: 'center', fontSize: 18,
            // resting edge is the hairline; the copied state still swaps to an
            // accent border, just at hairline weight instead of 1.5px
            border: copied ? '1px solid var(--welfare)' : 'var(--hair-2)',
            transition: 'background 0.2s, border-color 0.2s',
            color: 'var(--ink)',
          }}>
            {copied ? '✓' : '🔗'}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 14, color: copied ? 'var(--welfare)' : 'var(--ink)' }}>
              {copied ? 'Link copied!' : 'Copy link'}
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {url.replace(/^https?:\/\//, '')}
            </div>
          </div>
        </button>

        {/* 3 - QR code (hiring flyers/posters - opening shares only) */}
        {isOpening && (
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* QR plate: 10 -> --r-tight, 1.5px edge -> hairline, raw #fff -> --card */}
            <div style={{ width: 72, height: 72, borderRadius: 'var(--r-tight)', border: 'var(--hair-2)', background: 'var(--card)', flexShrink: 0, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
              {qrDataUrl
                ? <Img src={qrDataUrl} alt="QR code linking to this opening" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                : <div style={{ width: 20, height: 20, border: '2px solid var(--line-2)', borderTopColor: 'var(--welfare)', borderRadius: '50%', animation: 'login-spin 0.8s linear infinite' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 14 }}>QR code</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>scan to open this role directly</div>
              <button
                className="btn btn-sm"
                onClick={handleDownloadQr}
                disabled={!qrDataUrl}
                style={{ marginTop: 8, fontSize: 12 }}
              >
                ↓ download PNG
              </button>
            </div>
          </div>
        )}

        {/* 4 - Poster studio. Only rendered when the caller handed the sheet a
            poster payload; the studio itself draws post (4:5) and story (9:16)
            formats with a template picker. */}
        {posterData && (
          <button
            style={{ ...rowStyle }}
            onClick={e => { e.stopPropagation(); setShowPoster(true) }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-2)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}
            onMouseDown={e => ((e.currentTarget as HTMLElement).style.transform = 'scale(0.96)')}
            onMouseUp={e => ((e.currentTarget as HTMLElement).style.transform = 'scale(1)')}
          >
            <span style={{ width: 40, height: 40, borderRadius: 'var(--r-tight)', background: 'var(--bg-2)', display: 'grid', placeItems: 'center', flexShrink: 0, border: 'var(--hair-2)', color: 'var(--grape-ink)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="3.4" />
                <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 14 }}>Poster studio</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>post 1080×1440 or story 1080×1920</div>
            </div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--ink-3)', flexShrink: 0 }} aria-hidden>→</span>
          </button>
        )}

        {/* 5 - Instagram story card */}
        <div style={{ padding: '14px 18px 18px' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-3)', marginBottom: 10 }}>
            ✦ story card
          </div>

          {!generated ? (
            <button
              onClick={() => handleGenerateStory()}
              disabled={generating}
              style={{
                width: '100%', padding: '13px 0',
                // audit-ok: dashed - 'generate a story card', a provisional artefact
                borderRadius: 14, border: '2px dashed var(--welfare)',
                background: 'color-mix(in srgb, var(--welfare) 8%, transparent)',
                cursor: generating ? 'wait' : 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                transition: 'background 0.15s, transform 0.1s var(--ease-out)',
              }}
              onMouseEnter={e => !generating && ((e.currentTarget as HTMLButtonElement).style.background = 'color-mix(in srgb, var(--welfare) 14%, transparent)')}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'color-mix(in srgb, var(--welfare) 8%, transparent)')}
              onMouseDown={e => !generating && ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.96)')}
              onMouseUp={e => ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)')}
            >
              {generating ? (
                <>
                  <div style={{ width: 26, height: 26, border: '2.5px solid var(--line-2)', borderTopColor: 'var(--welfare)', borderRadius: '50%', animation: 'login-spin 0.8s linear infinite' }} />
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--welfare-ink)' }}>designing…</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 26 }}>🎨</span>
                  <span style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 14, color: 'var(--welfare-ink)' }}>generate story card</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>1080×1920 · instagram ready</span>
                </>
              )}
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              {/* preview thumb tile: radius 10 -> --r-tight, 2px --line -> hairline */}
              {preview && (
                <div style={{ flexShrink: 0, borderRadius: 'var(--r-tight)', overflow: 'hidden', border: 'var(--hair-2)', width: 80, aspectRatio: '9/16' }}>
                  <Img src={preview} alt="Story preview" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
              )}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 14 }}>story ready ✓</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                  {canShareFiles
                    ? '1080×1920 PNG · pick instagram from the share sheet'
                    : '1080×1920 PNG · download, then post it from instagram'}
                </div>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={handleShareStory}
                  disabled={sharingStory}
                  style={{ alignSelf: 'flex-start', transition: 'transform 0.1s var(--ease-out)' }}
                  onMouseDown={e => !sharingStory && ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.96)')}
                  onMouseUp={e => ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)')}
                >
                  {sharingStory ? 'opening share sheet…' : canShareFiles ? '↗ share image' : '↓ download PNG'}
                </button>
                {/* Download stays reachable as a fallback once share is the
                    primary action, instead of disappearing behind it. */}
                {canShareFiles && (
                  <button
                    onClick={handleDownload}
                    style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                  >
                    download PNG instead
                  </button>
                )}
                <button
                  onClick={() => handleGenerateStory()} disabled={generating}
                  style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                >
                  regenerate
                </button>
              </div>
            </div>
          )}
          {generated && (
            <div style={{ marginTop: 12 }}>
              <TemplatePicker
                names={templateNames}
                selected={template}
                onSelect={tpl => { setTemplate(tpl); handleGenerateStory(tpl) }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Poster studio overlay. Rendered inside the sheet's own backdrop (it is
          position:fixed, so it fills the viewport regardless) and inside the
          panel's click-stop, so closing it returns to the share sheet rather
          than dismissing both. */}
      {showPoster && posterData && (
        <PosterStudioModal data={posterData} onClose={() => setShowPoster(false)} />
      )}
    </div>
</Portal>
  )
}
