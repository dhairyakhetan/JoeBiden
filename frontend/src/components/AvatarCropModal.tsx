import { useEffect, useMemo, useRef, useState } from 'react'
import { useModalA11y } from '../hooks/useDialog'

/**
 * Owner report: "profile picture ko crop ya adjust krna ka option nhi hai,
 * it just gets uploaded directly after choosing." EditProfilePage.tsx's
 * `handleAvatarChange` went straight from the file picker to
 * `profileService.uploadAvatar()` with no step in between - whatever crop
 * the browser's own file picker preview implied was whatever got uploaded.
 *
 * This is a plain drag-to-reposition + zoom cropper, output as a single
 * square JPEG. It intentionally does not try to be a full editor (rotate,
 * filters, etc.) - the ask was specifically "crop or adjust", and a square
 * reposition/zoom covers avatars, which are never displayed as anything but
 * a circle/square.
 */

const VIEWPORT = 280
const OUTPUT_SIZE = 512
const MAX_ZOOM = 3

interface Props {
  file: File
  onCancel: () => void
  onConfirm: (cropped: File) => void
}

export default function AvatarCropModal({ file, onCancel, onConfirm }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; startOffset: { x: number; y: number } } | null>(null)

  useModalA11y(true, panelRef, onCancel, saving)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setImgUrl(url)
    const img = new Image()
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Scale so the image's shorter edge exactly covers the square viewport at
  // zoom=1 - the same "cover" fit every card image in the app uses, just
  // computed here instead of via CSS since the crop math needs the number.
  const baseScale = useMemo(() => {
    if (!natural) return 1
    return VIEWPORT / Math.min(natural.w, natural.h)
  }, [natural])

  const scale = baseScale * zoom
  const dispW = natural ? natural.w * scale : VIEWPORT
  const dispH = natural ? natural.h * scale : VIEWPORT

  // The image first becomes drawable (natural loads) with offset still at
  // its initial {0,0} - for anything non-square that pins the top-left
  // corner in view instead of the centre, so e.g. a landscape photo opened
  // showing its left edge rather than its middle until the member happened
  // to drag it. Centre exactly once, the moment the image's real dimensions
  // are known; every later change (zoom) only clamps the existing offset so
  // a zoom-out can't leave a gap at the edge, without wiping out a drag the
  // member already made.
  const centeredRef = useRef(false)
  useEffect(() => {
    if (!natural) return
    if (!centeredRef.current) {
      centeredRef.current = true
      setOffset(clampOffset({ x: (VIEWPORT - dispW) / 2, y: (VIEWPORT - dispH) / 2 }, dispW, dispH))
      return
    }
    setOffset(prev => clampOffset(prev, dispW, dispH))
  }, [dispW, dispH, natural])

  function clampOffset(o: { x: number; y: number }, w: number, h: number) {
    const minX = Math.min(0, VIEWPORT - w)
    const minY = Math.min(0, VIEWPORT - h)
    return {
      x: Math.max(minX, Math.min(0, o.x)),
      y: Math.max(minY, Math.min(0, o.y)),
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, startOffset: offset }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setOffset(clampOffset({ x: dragRef.current.startOffset.x + dx, y: dragRef.current.startOffset.y + dy }, dispW, dispH))
  }
  const onPointerUp = () => { dragRef.current = null }

  const handleUse = async () => {
    if (!imgUrl || !natural) return
    setSaving(true)
    try {
      const img = new Image()
      img.src = imgUrl
      await img.decode()

      const canvas = document.createElement('canvas')
      canvas.width = OUTPUT_SIZE
      canvas.height = OUTPUT_SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('canvas unavailable')

      // Map the visible viewport window back to source-image pixels.
      const sx = -offset.x / scale
      const sy = -offset.y / scale
      const sSize = VIEWPORT / scale
      ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

      const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9))
      if (!blob) throw new Error('crop failed')
      const cropped = new File([blob], file.name.replace(/\.[^./\\]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: Date.now() })
      onConfirm(cropped)
    } catch {
      // A failed crop must not trap the member with no way to save a photo -
      // fall back to the original, unedited file rather than blocking them.
      onConfirm(file)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-back" onClick={e => { if (e.target === e.currentTarget && !saving) onCancel() }}>
      <div ref={panelRef} className="modal" role="dialog" aria-modal="true" aria-label="Crop your photo" tabIndex={-1} style={{ maxWidth: 360 }}>
        <div className="panel-h">
          <h2 style={{ margin: 0, font: 'inherit' }}>Adjust your photo</h2>
          <button type="button" className="iconbtn no" onClick={onCancel} disabled={saving} aria-label="Cancel" title="Cancel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div
          style={{
            width: VIEWPORT, height: VIEWPORT, margin: '4px auto 14px', borderRadius: '50%',
            overflow: 'hidden', position: 'relative', touchAction: 'none', cursor: 'grab',
            border: 'var(--hair-3)', background: 'var(--bg-2)',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {imgUrl && (
            <img
              src={imgUrl}
              alt=""
              draggable={false}
              style={{
                position: 'absolute', left: 0, top: 0,
                width: dispW, height: dispH,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
                userSelect: 'none', pointerEvents: 'none',
              }}
            />
          )}
        </div>

        <label htmlFor="avatar-zoom" className="adm-block-label">zoom</label>
        <input
          id="avatar-zoom"
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={e => setZoom(Number(e.target.value))}
          style={{ width: '100%', marginBottom: 16 }}
        />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onCancel} disabled={saving}>cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleUse} disabled={saving || !natural}>
            {saving ? 'saving…' : 'use this photo'}
          </button>
        </div>
      </div>
    </div>
  )
}
