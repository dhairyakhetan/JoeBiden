import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import Img from '../Img'
import { useModalA11y } from '../../hooks/useDialog'
import './fx.css'

/**
 * The interaction kit for the giving-back pages (/impact, the library, stories, explorers). Rules it keeps:
 *  - text is never hidden waiting for an animation (crawlers and slow phones see everything at once);
 *  - every motion stops under prefers-reduced-motion, and tilt is off on touch screens;
 *  - every photo goes through <Img>, which resizes it (lib/imageUrl.ts), and links back to its drive.
 * Front-end only, never the HoD desk (CLAUDE.md: the desk stays motion-light).
 */

export function useReducedMotionPref(): boolean {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const on = () => setReduced(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return reduced
}

/** True once the element has scrolled into view (and stays true). */
export function useInView<T extends Element>(rootMargin = '0px 0px -10% 0px'): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return }
    const io = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { setSeen(true); io.disconnect() } }, { rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [seen, rootMargin])
  return [ref, seen]
}

/** A number that counts up from zero the first time it scrolls into view. The real value is in the DOM text first. */
export function CountOnView({ value, className, durationMs = 900 }: { value: number; className?: string; durationMs?: number }) {
  const reduced = useReducedMotionPref()
  const [ref, seen] = useInView<HTMLSpanElement>()
  const [shown, setShown] = useState<number | null>(null)
  useEffect(() => {
    if (!seen || reduced || value <= 0) return
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))))
      if (t < 1) raf = requestAnimationFrame(tick)
      else setShown(null)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [seen, reduced, value, durationMs])
  return <span ref={ref} className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>{(shown ?? value).toLocaleString('en-IN')}</span>
}

/** Pointer tilt for a card: sets --rx/--ry, read by .fx-tilt in fx.css. Off for touch and reduced motion. */
export function useTilt<T extends HTMLElement>(max = 6) {
  const ref = useRef<T | null>(null)
  const reduced = useReducedMotionPref()
  useEffect(() => {
    const el = ref.current
    if (!el || reduced || !window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width - 0.5
      const y = (e.clientY - r.top) / r.height - 0.5
      el.style.setProperty('--ry', `${(x * max).toFixed(2)}deg`)
      el.style.setProperty('--rx', `${(-y * max).toFixed(2)}deg`)
    }
    const leave = () => { el.style.setProperty('--ry', '0deg'); el.style.setProperty('--rx', '0deg') }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave) }
  }, [reduced, max])
  return ref
}

export function TiltLink({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  const ref = useTilt<HTMLAnchorElement>()
  return <Link ref={ref} to={to} className={`fx-tilt ${className || ''}`}>{children}</Link>
}

/** A bar that grows to its width when it scrolls into view. Width is correct without JS. */
export function GrowBar({ pct, fill }: { pct: number; fill: string }) {
  const [ref, seen] = useInView<HTMLSpanElement>()
  return (
    <span ref={ref} className="fx-bar">
      <span className={`fx-bar-fill${seen ? ' is-in' : ''}`} style={{ ['--w' as string]: `${Math.max(2, Math.min(100, pct))}%`, background: fill }} />
    </span>
  )
}

export interface Photo { slug: string; title: string; img: string; alt?: string; date?: string | null; place?: string | null; caption?: string }

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '')

/**
 * Photo mosaic + lightbox. Tiles are real buttons (keyboard and screen reader reachable); the lightbox is a modal
 * dialog with focus trap and Escape (useModalA11y), arrow keys and swipe to move, and a link to the drive's write-up.
 */
export function PhotoMosaic({ photos, label, initial = 9 }: { photos: Photo[]; label: string; initial?: number }) {
  const [open, setOpen] = useState<number | null>(null)
  const [all, setAll] = useState(false)
  const list = all ? photos : photos.slice(0, initial)
  if (!photos.length) return null
  return (
    <section className="fx-mosaic-wrap" aria-label={label}>
      <ul className="fx-mosaic">
        {list.map((p, i) => (
          <li key={p.slug + i} className={`fx-tile fx-tile-${(i % 7) + 1}`}>
            <button type="button" className="fx-tile-btn" onClick={() => setOpen(i)} aria-label={`Open photo: ${p.title}${p.date ? `, ${fmt(p.date)}` : ''}`}>
              <Img src={p.img} alt={p.alt || p.title} ctx="card" />
              <span className="fx-tile-cap" aria-hidden>{p.title}</span>
            </button>
          </li>
        ))}
      </ul>
      {photos.length > initial && !all && (
        <button type="button" className="btn btn-sm fx-more" onClick={() => setAll(true)}>show all {photos.length} photos</button>
      )}
      {open !== null && <Lightbox photos={list} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </section>
  )
}

function Lightbox({ photos, index, onIndex, onClose }: { photos: Photo[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null)
  useModalA11y(true, panel, onClose)
  const p = photos[index]
  const go = useCallback((d: number) => onIndex((index + d + photos.length) % photos.length), [index, photos.length, onIndex])
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1) }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [go])
  const startX = useRef<number | null>(null)
  return (
    <div className="fx-lb-back" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={panel} className="fx-lb" role="dialog" aria-modal="true" aria-label={`Photo ${index + 1} of ${photos.length}: ${p.title}`} tabIndex={-1}
        onTouchStart={e => { startX.current = e.touches[0].clientX }}
        onTouchEnd={e => { if (startX.current === null) return; const dx = e.changedTouches[0].clientX - startX.current; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); startX.current = null }}>
        <button type="button" className="iconbtn fx-lb-x" onClick={onClose} aria-label="Close photo" title="Close"><XMarkIcon width={20} height={20} aria-hidden /></button>
        <figure className="fx-lb-fig">
          <Img key={p.img} src={p.img} alt={p.alt || p.title} ctx="full" eager />
          <figcaption className="fx-lb-cap">
            <strong>{p.title}</strong>
            <span>{[fmt(p.date), p.place].filter(Boolean).join(' · ')}</span>
            {p.caption && <span className="fx-lb-sum">{p.caption}</span>}
            <Link to={`/projects/${p.slug}`} className="fx-lb-link" onClick={onClose}>read this drive →</Link>
          </figcaption>
        </figure>
        {photos.length > 1 && <>
          <button type="button" className="iconbtn fx-lb-nav fx-lb-prev" onClick={() => go(-1)} aria-label="Previous photo"><ChevronLeftIcon width={22} height={22} aria-hidden /></button>
          <button type="button" className="iconbtn fx-lb-nav fx-lb-next" onClick={() => go(1)} aria-label="Next photo"><ChevronRightIcon width={22} height={22} aria-hidden /></button>
          <span className="fx-lb-count" aria-live="polite">{index + 1} / {photos.length}</span>
        </>}
      </div>
    </div>
  )
}

/** A strip of photos that drifts sideways (pauses on hover/focus, static under reduced motion). Purely a doorway: each links to its drive. */
export function PhotoDrift({ photos }: { photos: Photo[] }) {
  if (photos.length < 4) return null
  const row = photos.slice(0, 14)
  return (
    <div className="fx-drift" aria-label="photos from recent drives">
      <ul className="fx-drift-track">
        {[...row, ...row].map((p, i) => (
          <li key={i} aria-hidden={i >= row.length ? true : undefined}>
            <Link to={`/projects/${p.slug}`} tabIndex={i >= row.length ? -1 : undefined} className="fx-drift-a">
              <Img src={p.img} alt={i >= row.length ? '' : p.alt || p.title} ctx="thumb" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
