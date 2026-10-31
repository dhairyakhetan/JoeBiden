import { useEffect, useRef, useState } from 'react'
import { ARC_IDS, photo, photoSrc } from '../data/photos'
import { prefersReducedMotion } from '../lib/hooks'
import { arcPose } from '../lib/arc'

/**
 * A curved cover-flow of event photos, the festival-site signature: cards in the middle stand edge-on like pages of a book and
 * open out toward both edges, where they face the viewer. The pose maths is `arcPose` (pure, tested). It idles on a slow drift and
 * follows the pointer; reduced motion gets it still. It is decoration (the Vault is the accessible gallery), so it is hidden
 * from assistive tech and its images carry no alt text.
 */
export function PhotoArc({ ids = ARC_IDS, className = '' }: { ids?: readonly string[]; className?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [shift, setShift] = useState(0)
  const [unit, setUnit] = useState(1)
  const target = useRef<number | null>(null)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setUnit(Math.max(0.42, Math.min(1.15, el.clientWidth / 1100)))
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (prefersReducedMotion()) return
    const el = box.current
    if (!el) return
    let raf = 0
    let visible = true
    let cur = 0
    const t0 = performance.now()
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([e]) => { visible = e.isIntersecting }) : null
    io?.observe(el)
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      target.current = ((e.clientX - r.left) / r.width - 0.5) * 4.5
    }
    const onLeave = () => { target.current = null }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (!visible) return
      const idle = Math.sin((now - t0) / 5200) * 1.4
      const want = target.current ?? idle
      cur += (want - cur) * 0.06
      setShift(prev => (Math.abs(prev - cur) > 0.003 ? cur : prev))
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); io?.disconnect(); el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerleave', onLeave) }
  }, [])

  const mid = (ids.length - 1) / 2
  return (
    <div ref={box} className={'lv-arc ' + className} aria-hidden>
      {ids.map((id, i) => {
        const p = arcPose(i - mid - shift)
        return (
          <figure
            key={id}
            className="lv-arc-item"
            style={{ transform: `translate(-50%, -50%) translate3d(${(p.x * unit).toFixed(1)}px, ${p.y.toFixed(1)}px, ${p.z.toFixed(1)}px) rotateY(${p.rot.toFixed(1)}deg) scale(${p.scale.toFixed(3)})`, zIndex: p.order }}
          >
            <img src={photoSrc(id, 's')} alt="" width={360} height={480} loading={Math.abs(i - mid) < 4 ? 'eager' : 'lazy'} decoding="async" draggable={false} data-id={photo(id).id} />
          </figure>
        )
      })}
    </div>
  )
}
