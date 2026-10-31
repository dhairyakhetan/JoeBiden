import { CSSProperties } from 'react'

type Variant = 'line' | 'block' | 'card' | 'avatar' | 'pill'

interface SkeletonProps {
  variant?: Variant
  width?: number | string
  height?: number | string
  radius?: number | string
  /** Render N copies stacked (with a subtle staggered pulse). */
  count?: number
  className?: string
  style?: CSSProperties
  /** Screen-reader text for the `count > 1` group's single status
   *  announcement (see below). Only used when `count > 1`. */
  label?: string
}

// DESIGN.md §1: "a radius that is not 999, 32, 22 or 14 is a bug", and §11.2
// maps the two skeleton shapes onto that scale directly - `.sk` is
// `--r-inner`, `.sk--tight` is 14. A placeholder that does not match the
// geometry of the thing it stands in for is a layout shift waiting to happen,
// so 6 -> 14 (text lines, the tight end) and 20 -> 22 (the card shape).
const DEFAULTS: Record<Variant, { height: number | string; radius: number | string; width: number | string }> = {
  line:   { height: 12, radius: 'var(--r-tight)', width: '100%' },
  block:  { height: 120, radius: 'var(--r-tight)', width: '100%' },
  card:   { height: 260, radius: 'var(--r-inner)', width: '100%' },
  avatar: { height: 40, radius: '50%', width: 40 },
  pill:   { height: 22, radius: 999, width: 72 },
}

/**
 * Shared loading placeholder - wraps the canonical `.skeleton` shimmer (index.css:
 * --bg-2 fill + aq-pulse) so no screen hand-rolls its own loading markup.
 * Honors reduced-motion via the global CSS animation catch-all.
 *
 * Per changelog/11-system-states.md §11.2: a loading group gets `aria-busy`
 * and ONE `role="status"` announcement, never one per placeholder block. The
 * `count > 1` path IS such a group (N copies of one repeating shape, e.g.
 * "8 skeleton cards"), so it owns that single announcement here; the
 * individual blocks inside it stay `aria-hidden`.
 *
 * A single `<Skeleton>` (count===1, the default) stays a plain, silent
 * visual primitive with no role of its own - it's the building block a page
 * composes several of into ONE hand-assembled composite skeleton (e.g. an
 * avatar line + two text lines making up one card shape). In that pattern
 * the composing PAGE owns the single aria-busy/role="status" wrapper around
 * its whole composite, same reasoning as above; adding one here too would
 * announce once per instance instead of once per loading surface.
 */
export default function Skeleton({ variant = 'line', width, height, radius, count = 1, className = '', style, label = 'Loading…' }: SkeletonProps) {
  const d = DEFAULTS[variant]
  const base: CSSProperties = {
    width: width ?? d.width,
    height: height ?? d.height,
    borderRadius: radius ?? d.radius,
    ...style,
  }
  if (count === 1) return <div className={`skeleton ${className}`} style={base} aria-hidden="true" />
  return (
    <div role="status" aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`skeleton ${className}`} style={{ ...base, animationDelay: `${i * 0.08}s` }} aria-hidden="true" />
      ))}
    </div>
  )
}
