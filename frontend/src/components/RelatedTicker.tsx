import Img from './Img'
import './RelatedTicker.css'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

export interface RelatedTickerItem {
  key: string
  href: string
  title: string
  image?: string
  alt?: string
  tag: string
  color?: string
}

/**
 * RelatedTicker - a compact auto-scrolling marquee mixing two content kinds
 * (e.g. a team's posts + the projects it ran) into one strip. Same seamless
 * double-track/pause-on-hover/reduced-motion mechanics as FeaturedTicker,
 * but generic over `href` + a `tag` badge instead of being project-only, and
 * sized for sitting inline at the top of a content section rather than as a
 * full-bleed hero strip.
 */
export default function RelatedTicker({ items, ariaLabel = 'Related content' }: { items: RelatedTickerItem[]; ariaLabel?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [onScreen, setOnScreen] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { rootMargin: '120px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  if (!items.length) return null
  // Repeat until there are enough items that the single copy spans the track
  // (avoids a visible gap in the loop with only 2-3 items).
  let base = items
  while (base.length < 6) base = [...base, ...items]
  const loop = [...base, ...base]
  const duration = Math.max(22, base.length * 4)

  return (
    <div className={`rtk${onScreen ? '' : ' rtk-off'}`} role="list" aria-label={ariaLabel} ref={ref}>
      <div className="rtk-track" style={{ animationDuration: `${duration}s` }}>
        {loop.map((it, i) => {
          const dupe = i >= base.length
          return (
            <Link
              key={`${it.key}-${i}`}
              to={it.href}
              className="rtk-card"
              role="listitem"
              aria-hidden={dupe || undefined}
              tabIndex={dupe ? -1 : 0}
              style={{ ['--rtk-accent' as string]: it.color || 'var(--welfare)' } as React.CSSProperties}
            >
              <div className="rtk-card-img">
                {it.image
                  ? <Img ctx="thumb" src={it.image} alt={dupe ? '' : (it.alt || it.title)} loading="lazy" decoding="async" />
                  : <div className="rtk-card-noimg" />}
              </div>
              <div className="rtk-card-body">
                <span className="rtk-card-tag">{it.tag}</span>
                <span className="rtk-card-title">{it.title}</span>
              </div>
            </Link>
          )
        })}
      </div>

    </div>
  )
}
