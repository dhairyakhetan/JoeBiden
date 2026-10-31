import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import './v6Shared.css'
import { likeBurst, springPop } from '../lib/motion'
import { celebrate } from '../lib/delight'
import { CountUp } from './CountUp'

// v6 shared components - exact prototype shapes, icons, and UI primitives

// The operator/official AquaTerra account posts under the display name
// "AquaTerra" (see `official@ngoaquaterra.com` in the members table). No
// dedicated `is_official` column exists on `members`/`posts` to key off of,
// so this matches the known display name - narrow but accurate for the one
// account it needs to cover, and avoids a schema migration for a single flag.
export function isOfficialAccount(authorName?: string | null): boolean {
  return (authorName || '').trim().toLowerCase() === 'aquaterra'
}

/** Small filled checkmark badge - matches the brand's one-★-tick convention. */
export function VerifiedTick({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Verified official account" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="11" fill="var(--sky)" stroke="var(--ink)" strokeWidth="1.5" />
      <path d="M7 12.5l3 3 7-7" fill="none" stroke="#0A0A0A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// SVG shapes
export function Star({ size = 80, color = 'var(--lemon)', stroke = '#0A0A0A', style, className }: {
  size?: number; color?: string; stroke?: string; style?: React.CSSProperties; className?: string
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={style} className={className}>
      <path d="M50 5 L60 38 L95 38 L67 58 L78 92 L50 72 L22 92 L33 58 L5 38 L40 38 Z"
        fill={color} stroke={stroke} strokeWidth="3" strokeLinejoin="round" />
    </svg>
  )
}

export function Burst({ size = 100, color = 'var(--welfare)', stroke = '#0A0A0A', style, points = 12 }: {
  size?: number; color?: string; stroke?: string; style?: React.CSSProperties; points?: number
}) {
  const pts: string[] = []
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2
    const r = i % 2 === 0 ? 48 : 24
    pts.push((50 + Math.cos(a) * r) + ',' + (50 + Math.sin(a) * r))
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
      <polygon points={pts.join(' ')} fill={color} stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

// Icons object (matches prototype I.xxx usage)
export const I = {
  heart: (filled: boolean) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
    </svg>
  ),
  comment: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  share: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/></svg>,
  search: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  plus: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  bell: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/></svg>,
  back: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  close: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  check: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><polyline points="20 6 9 17 4 12"/></svg>,
  more: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>,
  star: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.5 7.5h7.5l-6 4.5 2.5 7.5-6.5-4.5-6.5 4.5 2.5-7.5-6-4.5h7.5z"/></svg>,
  fire: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14a8 8 0 0016 0c0-4.16-2-7.85-6.5-13.33z"/></svg>,
  sparkles: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l1.5 6.5L20 8l-6.5 1.5L12 16l-1.5-6.5L4 8l6.5-1.5z"/><path d="M19 14l.7 3 3 .7-3 .7L19 22l-.7-3-3-.7 3-.7z"/></svg>,
  bookmark: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>,
  camera: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  link: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
  flag: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
  globe: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15 15 0 010 20 15 15 0 010-20z"/></svg>,
  rocket: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c4 4 5 8 5 12l-3 2v3l-2-1-2 1v-3l-3-2c0-4 1-8 5-12zm0 7a2 2 0 100-4 2 2 0 000 4z"/></svg>,
  pulse: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="2 12 7 12 10 4 14 20 17 12 22 12"/></svg>,
  gear: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>,
  pen: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 19l7-7 3 3-7 7H12v-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>,
  bolt: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  wave: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M2 12c2 0 2-3 5-3s3 3 5 3 3-3 5-3 3 3 5 3"/><path d="M2 17c2 0 2-3 5-3s3 3 5 3 3-3 5-3 3 3 5 3"/></svg>,
  hash: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>,
}

// Marquee component
export function Marquee({ items, color = 'lemon', reverse = false }: {
  items: string[]; color?: string; reverse?: boolean
}) {
  const cls = 'marquee' + (color === 'pink' ? ' marquee-pink' : color === 'mint' ? ' marquee-mint' : color === 'tomato' ? ' marquee-tomato' : '')
  return (
    <div className={cls + (reverse ? ' marquee-rev' : '')}>
      <div className="marquee-track">
        {/* Tripled for a seamless loop; only the first pass is announced. */}
        {[...items, ...items, ...items].map((it, i) => (
          <span key={i} aria-hidden={i >= items.length || undefined}>{it}<span className="dot"></span></span>
        ))}
      </div>
    </div>
  )
}

// PostImage placeholder
export function PostImage({ kind, color, stickerOk = true }: { kind?: string; color?: string; stickerOk?: boolean }) {
  const labels: Record<string, string> = {
    moss: 'BIO LAB / SEA MOSS TANK', beach: 'BEACH CLEANUP / SAT 8AM',
    tutor: 'YOUTH CENTER / SUNDAY', zine: 'ZINE 04 / TIDE',
    summit: 'SPRING SUMMIT 2026', data: 'RIVER MICROPLASTIC DATA',
    default: 'DROP YOUR PHOTO HERE',
  }
  const label = labels[kind || 'default'] || labels.default
  return (
    <div className="post-img-placeholder" style={{ '--catColor': color } as React.CSSProperties}>
      <div style={{ position: 'relative', textAlign: 'center', padding: 20 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700 }}>[ {label} ]</div>
        {stickerOk && (
          <div className="sticker sticker-mint" style={{ position: 'absolute', top: -50, right: -30, fontSize: 11, padding: '4px 10px' }}>NEW</div>
        )}
      </div>
    </div>
  )
}

// LikeButton - cross-fade heart icons (Principle 7: contextual icon animations),
// plus a like-burst (spring overshoot + a few particles) on LIKE only, and a
// count that rolls up/down instead of snapping. Unlike stays quiet - no
// burst, no particles - the asymmetry itself is the signal ("this direction
// is the fun one"). Reused across FeedPostCard/PostFocusModal/HomePage/
// PostPage, so the upgrade lands everywhere at once.
const PARTICLE_ANGLES = [-65, -38, -12, 14, 40, 66]
export function LikeButton({ liked, count, onToggle }: { liked: boolean; count: number; onToggle: () => void }) {
  const reduced = useReducedMotion()
  const [justLiked, setJustLiked] = useState(false)
  const prevLiked = useRef(liked)
  const likeBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (liked && !prevLiked.current && !reduced) {
      setJustLiked(true)
      celebrate('hearts', likeBtnRef.current)
      const t = setTimeout(() => setJustLiked(false), 500)
      return () => clearTimeout(t)
    }
    prevLiked.current = liked
  }, [liked, reduced])

  return (
    <button
      ref={likeBtnRef}
      className={'btn btn-sm like-btn' + (liked ? ' like-btn--on' : '')}
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      aria-label={liked ? 'Unlike' : 'Like'}
      title={liked ? 'Unlike' : 'Like'}
      aria-pressed={liked}
      style={{ position: 'relative' }}
    >
      {/* Both icons always in DOM - cross-fade via CSS transitions */}
      <motion.span
        className="like-icons"
        aria-hidden="true"
        style={{ display: 'inline-block' }}
        animate={justLiked ? likeBurst : { scale: 1 }}
      >
        <span className="like-icon-off">{I.heart(false)}</span>
        <span className="like-icon-on">{I.heart(true)}</span>
      </motion.span>
      <span className="like-count"><CountUp value={count} /></span>

      {!reduced && (
        <AnimatePresence>
          {justLiked && (
            <span aria-hidden="true" style={{ position: 'absolute', left: 10, top: '50%', width: 0, height: 0, pointerEvents: 'none' }}>
              {PARTICLE_ANGLES.map((deg, i) => {
                // Alternating distance/size instead of one uniform ring - a
                // burst where every particle travels the same distance reads
                // as a diagram of a burst, not a burst.
                const dist = 18 + (i % 2) * 10
                return (
                  <motion.span
                    key={i}
                    initial={{ opacity: 1, x: 0, y: 0, scale: 0.6, rotate: 0 }}
                    animate={{
                      opacity: 0,
                      x: Math.cos((deg * Math.PI) / 180) * dist,
                      y: Math.sin((deg * Math.PI) / 180) * -dist,
                      scale: i % 2 ? 1.15 : 0.85,
                      rotate: deg > 0 ? 25 : -25,
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ ...springPop, delay: i * 0.018 }}
                    style={{ position: 'absolute', fontSize: i % 2 ? 11 : 9, color: 'var(--pink, #FF4D8C)' }}
                  >
                    ♥
                  </motion.span>
                )
              })}
            </span>
          )}
        </AnimatePresence>
      )}
    </button>
  )
}
