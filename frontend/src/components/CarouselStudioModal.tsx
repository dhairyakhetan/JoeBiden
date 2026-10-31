import Portal from './Portal'
import Img from './Img'
import { useState, useEffect, useCallback, useRef } from 'react'
import { generateCarousel, downloadCarousel, CAROUSEL_COVER_STYLES, type CarouselProject, type CarouselResult } from './carouselGenerator'
import TemplatePicker from './TemplatePicker'
import useDialog from '../hooks/useDialog'

interface CarouselStudioModalProps {
  project: CarouselProject
  onClose: () => void
}

// Role-gated multi-slide carousel studio. Turns one welfare project into a
// ready-to-post Instagram deck (cover · story · stat · photos · CTA) in the
// brand language. Regenerate rolls a new accent + decoration across the set
// (or pins a chosen cover look via the design picker - the rest of the deck
// still reshuffles, since each slide slot rolls its own sub-look).
export default function CarouselStudioModal({ project, onClose }: CarouselStudioModalProps) {
  const [coverStyle, setCoverStyle] = useState<string | null>(null)
  const [result, setResult] = useState<CarouselResult | null>(null)
  const [active, setActive] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reqId = useRef(0)

  const lastCover = useRef<string | null>(null)

  const run = useCallback(async (style: string | null) => {
    const id = ++reqId.current
    setBusy(true); setError(null)
    try {
      // When not pinning a cover look, exclude the last-drawn one so regenerate
      // doesn't keep redrawing the same cover.
      const res = await generateCarousel(project, {
        coverStyle: style ?? undefined,
        exclude: style ? undefined : (lastCover.current ?? undefined),
      })
      // Only the latest request may record the drawn cover - a slow, superseded
      // generate must not pollute the exclusion source with a cover the user
      // never saw (regenerate could then redraw the one it meant to exclude).
      if (id === reqId.current) { lastCover.current = res.coverStyle; setResult(res); setActive(0) }
    } catch (e) {
      console.error('Carousel generation failed:', e)
      if (id === reqId.current) setError('Could not generate - try again.')
    } finally {
      if (id === reqId.current) setBusy(false)
    }
  }, [project])

  useEffect(() => { run(coverStyle) }, [run]) // eslint-disable-line react-hooks/exhaustive-deps

  // Revoke this result's slide object URLs when it's replaced by a fresh
  // generate (regenerate / cover-style change) or on unmount - never while
  // still displayed, since the cleanup only runs on the next effect run or
  // teardown, by which point `result` (and therefore `cur`/thumbnails) has
  // already moved on to the new deck.
  useEffect(() => {
    if (!result) return
    return () => { result.slides.forEach(sl => URL.revokeObjectURL(sl.url)) }
  }, [result])

  // Escape + Tab trap + focus restore + scroll-lock (was Escape only).
  const panelRef = useDialog(true, onClose)

  // ←/→ to page through slides — studio-specific, so it stays local.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); setActive(i => Math.max(0, i - 1)) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setActive(i => (result ? Math.min(result.slides.length - 1, i + 1) : i)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [result])

  const [zipping, setZipping] = useState(false)

  const handleDownload = async () => {
    if (!result || zipping) return
    const slug = (project.slug || 'project').slice(0, 32)
    setZipping(true); setError(null)
    try {
      await downloadCarousel(result.slides, slug)
    } catch (e) {
      console.error('Carousel download failed:', e)
      setError('Could not build the download - try again.')
    } finally {
      setZipping(false)
    }
  }

  const slides = result?.slides ?? []
  const total = slides.length
  const cur = slides[active]

  return (
    <Portal>
<div
      onClick={e => { e.stopPropagation(); onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 320,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        ref={panelRef}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Carousel studio"
        tabIndex={-1}
        style={{
          outline: 'none',
          width: '100%', maxWidth: 480,
          background: 'var(--card)', borderRadius: 'var(--r-md)', border: 'var(--hair-2)', boxShadow: 'var(--lift-4)',
          overflow: 'hidden', maxHeight: '94dvh', display: 'flex', flexDirection: 'column',
          animation: 'sheetUp 0.22s var(--ease-out)',
        }}
      >
        {/* Overlay-layer migration: the studio panel's 2px ink border became a
            hairline and gained --lift-4 (the modal depth) in its place; the 2px
            --line header/footer rules became --hair, and the 10/8 off-scale
            radii inside moved onto --r-tight. */}
        {/* Header */}
        <div style={{ padding: '14px 18px 12px', borderBottom: 'var(--hair)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: 18 }}>🎠</span>
            <div>
              <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 17, lineHeight: 1 }}>carousel studio</div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 3, letterSpacing: '0.03em' }}>
                project deck · instagram-ready{total > 0 ? ` · ${total} slides` : ''}
              </div>
            </div>
          </div>
          <button
            onClick={e => { e.stopPropagation(); onClose() }}
            aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 18, width: 44, height: 44, display: 'grid', placeItems: 'center', borderRadius: 'var(--r-tight)', transition: 'color 0.12s' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-3)')}
          >✕</button>
        </div>

        {/* Preview */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              position: 'relative',
              // Match the actual 1080×1440 (3:4) canvas - a 4:5 box with
              // object-fit:cover cropped ~6% of every slide out of the
              // preview, so what the user approved wasn't what downloaded.
              aspectRatio: '3 / 4',
              height: 'min(52dvh, 480px)',
              borderRadius: 'var(--r-tight)', overflow: 'hidden',
              border: 'var(--hair-2)', background: 'var(--bg-2)',
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}
          >
            {cur && (
              <Img
                src={cur.url}
                alt={`Slide ${active + 1} preview`}
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', opacity: busy ? 0.4 : 1, transition: 'opacity 0.2s' }}
              />
            )}
            {busy && (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 30, border: '3px solid var(--line-2)', borderTopColor: 'var(--welfare)', borderRadius: '50%', animation: 'login-spin 0.8s linear infinite' }} />
                  <span className="mono" style={{ fontSize: 11, color: 'var(--welfare-ink)' }}>building deck…</span>
                </div>
              </div>
            )}
            {error && !busy && (
              <div role="alert" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 20, textAlign: 'center' }}>
                <span className="mono" style={{ fontSize: 12, color: 'var(--tomato-ink)' }}>{error}</span>
              </div>
            )}

            {/* Prev / next */}
            {total > 1 && !busy && (
              <>
                <button
                  onClick={() => setActive(i => Math.max(0, i - 1))}
                  disabled={active === 0}
                  aria-label="Previous slide"
                  style={navBtn('left', active === 0)}
                >←</button>
                <button
                  onClick={() => setActive(i => Math.min(total - 1, i + 1))}
                  disabled={active === total - 1}
                  aria-label="Next slide"
                  style={navBtn('right', active === total - 1)}
                >→</button>
                <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', color: 'rgba(255,255,255,0.9)', fontFamily: 'var(--code)', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999, fontVariantNumeric: 'tabular-nums' }}>
                  {String(active + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
                </div>
              </>
            )}
          </div>

          {/* Thumbnail strip */}
          {total > 1 && !busy && (
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', maxWidth: '100%', padding: '3px 0 4px', scrollbarWidth: 'none', overscrollBehaviorX: 'none' }}>
              {slides.map((sl, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  aria-label={`View slide ${i + 1}`}
                  style={{
                    // 7 -> --r-tight. The 2px ink ring stays: here it is the
                    // selected-slide state, not panel chrome, and a hairline
                    // version of it would be invisible next to `transparent`.
                    width: 44, height: 55, flexShrink: 0, borderRadius: 'var(--r-tight)', overflow: 'hidden',
                    border: '2px solid ' + (active === i ? 'var(--ink)' : 'transparent'),
                    padding: 0, background: 'none', cursor: 'pointer',
                    transform: active === i ? 'scale(1.05)' : 'scale(1)',
                    transition: 'border-color 0.15s, transform 0.15s',
                  }}
                >
                  <Img src={sl.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          )}

          {cur && !busy && (
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.03em' }}>
              ✦ {cur.kind} slide
            </div>
          )}
          <TemplatePicker
            names={[...CAROUSEL_COVER_STYLES]}
            selected={coverStyle}
            onSelect={style => { setCoverStyle(style); run(style) }}
            label="cover style"
          />
        </div>

        {/* Actions */}
        <div style={{ padding: '12px 18px', borderTop: 'var(--hair)', display: 'flex', gap: 10, flexShrink: 0, paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <button
            className="btn btn-sm"
            onClick={() => run(coverStyle)}
            disabled={busy}
            style={{ flex: 1, transition: 'transform 0.1s var(--ease-out)' }}
            onMouseDown={e => !busy && ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.96)')}
            onMouseUp={e => ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)')}
            title="Generate a new design across the deck"
          >
            ↻ regenerate
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={handleDownload}
            disabled={busy || zipping || total === 0}
            style={{ flex: 1.5, transition: 'transform 0.1s var(--ease-out)' }}
            onMouseDown={e => !busy && !zipping && total > 0 && ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.96)')}
            onMouseUp={e => ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)')}
          >
            {zipping ? 'zipping…' : `↓ download .zip${total > 0 ? ` (${total})` : ''}`}
          </button>
        </div>
      </div>
    </div>
</Portal>
  )
}

function navBtn(side: 'left' | 'right', disabled: boolean): React.CSSProperties {
  return {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    [side]: 10,
    width: 40, height: 40, borderRadius: '50%', border: 'none',
    background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', color: '#fff',
    fontSize: 18, display: 'grid', placeItems: 'center',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.3 : 1,
    transition: 'opacity 0.15s, background 0.15s',
  }
}
