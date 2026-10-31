import Portal from './Portal'
import Img from './Img'
import { useState, useEffect, useCallback, useRef } from 'react'
import { generateBlogGraphic, downloadBlogGraphic, BLOG_TEMPLATE_NAMES, type BlogData, type BlogFormat, type BlogResult } from './blogGenerator'
import TemplatePicker from './TemplatePicker'
import useDialog from '../hooks/useDialog'

interface BlogStudioModalProps {
  data: BlogData
  onClose: () => void
}

const FORMATS: { value: BlogFormat; label: string; dim: string; ratio: string }[] = [
  { value: 'post', label: 'Post', dim: '1080 × 1440', ratio: '4 / 5' },
  { value: 'story', label: 'Story', dim: '1080 × 1920', ratio: '9 / 16' },
]

// Role-gated blog-graphic studio. Rolls a brand-compliant template each
// generate/regenerate so every export is fresh (or pins a chosen one via the
// design picker). Always ends on the "READ NOW · ngoaquaterra.com/blogs" CTA.
export default function BlogStudioModal({ data, onClose }: BlogStudioModalProps) {
  const [format, setFormat] = useState<BlogFormat>('post')
  const [template, setTemplate] = useState<string | null>(null)
  const [result, setResult] = useState<BlogResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reqId = useRef(0)

  const run = useCallback(async (fmt: BlogFormat, tpl: string | null) => {
    const id = ++reqId.current
    setBusy(true); setError(null)
    try {
      const res = await generateBlogGraphic(data, fmt, { template: tpl ?? undefined })
      if (id === reqId.current) setResult(res)
    } catch (e) {
      console.error('Blog graphic generation failed:', e)
      if (id === reqId.current) setError('Could not generate - try again.')
    } finally {
      if (id === reqId.current) setBusy(false)
    }
  }, [data])

  useEffect(() => { run(format, template) }, [format, run]) // eslint-disable-line react-hooks/exhaustive-deps

  // Was an Escape listener only — no Tab trap and no scroll-lock.
  const panelRef = useDialog(true, onClose)

  const handleDownload = () => {
    if (!result) return
    const slug = (data.slug || 'blog').slice(0, 32)
    downloadBlogGraphic(result.dataUrl, `aquaterra-blog-${format}-${slug}.png`)
  }

  return (
    <Portal>
<div
      role="presentation"
      onClick={e => { e.stopPropagation(); onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 320, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Blog graphic studio"
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 460, background: 'var(--card)', borderRadius: 'var(--r-md)', border: 'var(--hair-2)', boxShadow: 'var(--lift-4)', overflow: 'hidden', maxHeight: '92dvh', display: 'flex', flexDirection: 'column', animation: 'sheetUp 0.22s var(--ease-out)', outline: 'none' }}
      >
        {/* Overlay-layer migration: the studio panel's 2px ink border became a
            hairline and gained --lift-4 (the modal depth) in its place; the 2px
            --line header/footer rules became --hair, and the 10/8 off-scale
            radii inside moved onto --r-tight. */}
        {/* Header */}
        <div style={{ padding: '14px 18px 12px', borderBottom: 'var(--hair)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: 18 }}>📰</span>
            <div>
              <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 17, lineHeight: 1 }}>blog studio</div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 3, letterSpacing: '0.03em' }}>
                share graphic · instagram-ready
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

        {/* Format toggle */}
        <div style={{ padding: '14px 18px 6px', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8, background: 'var(--bg-2)', padding: 5, borderRadius: 'var(--r-tight)', border: 'var(--hair-2)' }}>
            {FORMATS.map(f => {
              const active = format === f.value
              return (
                <button
                  key={f.value}
                  onClick={() => setFormat(f.value)}
                  aria-pressed={active}
                  style={{ flex: 1, padding: '9px 4px', borderRadius: 'var(--r-tight)', cursor: 'pointer', border: 'none', background: active ? 'var(--ink)' : 'transparent', color: active ? 'var(--card)' : 'var(--ink-2)', transition: 'background 0.16s, color 0.16s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
                >
                  <span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 14 }}>{f.label}</span>
                  <span className="mono" style={{ fontSize: 9.5, opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>{f.dim}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Preview */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', aspectRatio: FORMATS.find(f => f.value === format)!.ratio, height: 'min(46dvh, 420px)', borderRadius: 'var(--r-tight)', overflow: 'hidden', border: 'var(--hair-2)', background: 'var(--bg-2)', display: 'grid', placeItems: 'center', flexShrink: 0, transition: 'aspect-ratio 0.2s' }}>
            {result && (
              <Img src={result.dataUrl} alt="Generated blog graphic preview" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: busy ? 0.4 : 1, transition: 'opacity 0.2s' }} />
            )}
            {busy && (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 30, height: 30, border: '3px solid var(--line-2)', borderTopColor: 'var(--welfare)', borderRadius: '50%', animation: 'login-spin 0.8s linear infinite' }} />
                  <span className="mono" style={{ fontSize: 11, color: 'var(--welfare-ink)' }}>designing…</span>
                </div>
              </div>
            )}
            {error && !busy && (
              <div role="alert" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 20, textAlign: 'center' }}>
                <span className="mono" style={{ fontSize: 12, color: 'var(--tomato-ink)' }}>{error}</span>
              </div>
            )}
          </div>
          {result && !busy && (
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.03em' }}>
              ✦ {result.template}{result.usedPhoto ? ' · photo' : ' · typographic'}
            </div>
          )}
          <TemplatePicker
            names={BLOG_TEMPLATE_NAMES}
            selected={template}
            onSelect={tpl => { setTemplate(tpl); run(format, tpl) }}
          />
        </div>

        {/* Actions */}
        <div style={{ padding: '12px 18px', borderTop: 'var(--hair)', display: 'flex', gap: 10, flexShrink: 0, paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <button
            className="btn btn-sm"
            onClick={() => run(format, template)}
            disabled={busy}
            style={{ flex: 1, transition: 'transform 0.1s var(--ease-out)' }}
            onMouseDown={e => !busy && ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.96)')}
            onMouseUp={e => ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)')}
            title="Generate a new random design"
          >
            ↻ regenerate
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={handleDownload}
            disabled={busy || !result}
            style={{ flex: 1.4, transition: 'transform 0.1s var(--ease-out)' }}
            onMouseDown={e => !busy && result && ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.96)')}
            onMouseUp={e => ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)')}
          >
            ↓ download PNG
          </button>
        </div>
      </div>
    </div>
</Portal>
  )
}
