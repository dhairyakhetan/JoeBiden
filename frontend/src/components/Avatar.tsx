import Img from './Img'
import { sized } from '../lib/imageUrl'

interface AvatarProps {
  src?: string
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
}

// Per-name fill from the category/signal hue tokens (no raw palette). A char-code
// hash (not name length) so distinct names get distinct hues - mirrors the
// hashColor used elsewhere in the app. Applied inline because the hue is dynamic
// (a runtime-built Tailwind arbitrary class is never emitted by the JIT scanner).
const HUES = ['var(--welfare)', 'var(--sky)', 'var(--grape)', 'var(--teal)', 'var(--pink)', 'var(--lemon)']
function hueFor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return HUES[Math.abs(h) % HUES.length]
}

const Avatar = ({ src, name, size = 'md', className = '' }: AvatarProps) => {
  /* An identity the caller could not resolve. Section 31's third addition to
     the poster block set: a dashed circle, NO initials and NO name.
     Before this it fell back to the literal string 'User', hashed that string
     for a hue, and rendered a solid coloured circle carrying the letter "U" -
     a fabricated identity that reads as a real person, which is the same
     failure class as rendering a figure with no source. The dashed circle says
     "not resolved", which is information. */
  const unresolved = !name || !name.trim()

  const safeName = name || ''

  // Generate initials
  const initials = safeName
    .split(' ')
    .map(n => n[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const bg = hueFor(safeName)

  // Brand avatar ring - a hard 2px ink ring (§Phase 2 Avatar spec) instead of the
  // old faint 1px outline, so avatars read as scrapbook stickers on any surface.
  const ringStyle = { boxShadow: '0 0 0 2px var(--ink)' } as const

  if (unresolved && !src) {
    return (
      <div
        className={`${SIZES[size]} aq-ident ${className}`}
        role="img"
        aria-label="identity not resolved"
      />
    )
  }

  if (src) {
    return (
      <Img
        src={sized(src, 'avatar')}
        alt={safeName}
        className={`${SIZES[size]} rounded-full object-cover ${className}`}
        style={ringStyle}
        referrerPolicy="no-referrer"
      />
    )
  }

  return (
    <div
      className={`${SIZES[size]} rounded-full flex items-center justify-center font-medium ${className}`}
      style={{ ...ringStyle, background: bg, color: 'var(--ink)' }}
    >
      {initials}
    </div>
  )
}

export default Avatar
