import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

// audit-ok: the Pop sticker palette (mint/pink/lemon/orange/sky/grape),
// documented on /brand as `STICKERS` in public/BrandPage.tsx. It is a
// decorative FILL palette for stickers, posters and confetti, deliberately
// outside tokens.css - it is not a UI colour and never sets text on cream.
const COLORS = ['#00E5A0', '#FF6BD6', '#FFC700', '#7E5BFF', '#FF7A1A', '#3DA9FC']
const PIECES = 18

/**
 * A brief confetti burst from a fixed screen point - used by the logo
 * easter egg (see AQNav.tsx) and reusable for any "celebrate this moment"
 * spot (milestone crossed, etc). Self-dismisses; renders nothing under
 * prefers-reduced-motion (the celebration is purely decorative, never
 * required to understand what happened).
 */
export function ConfettiBurst({ x, y, onDone }: { x: number; y: number; onDone: () => void }) {
  const reduced = useReducedMotion()
  const [pieces] = useState(() =>
    Array.from({ length: PIECES }, (_, i) => ({
      id: i,
      color: COLORS[i % COLORS.length],
      angle: (i / PIECES) * 360 + Math.random() * 20,
      dist: 60 + Math.random() * 70,
      rotate: Math.random() * 360,
      delay: Math.random() * 0.05,
    }))
  )

  useEffect(() => {
    if (reduced) { onDone(); return }
    const t = setTimeout(onDone, 900)
    return () => clearTimeout(t)
  }, [reduced, onDone])

  if (reduced) return null

  return (
    <div style={{ position: 'fixed', left: x, top: y, width: 0, height: 0, zIndex: 9999, pointerEvents: 'none' }} aria-hidden="true">
      <AnimatePresence>
        {pieces.map(p => (
          <motion.span
            key={p.id}
            initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
            animate={{
              opacity: 0,
              x: Math.cos((p.angle * Math.PI) / 180) * p.dist,
              y: Math.sin((p.angle * Math.PI) / 180) * p.dist + 40, // gentle downward drift
              rotate: p.rotate,
              scale: 0.7,
            }}
            transition={{ duration: 0.8, delay: p.delay, ease: [0.2, 0, 0, 1] }}
            style={{
              position: 'absolute', width: 7, height: 7,
              background: p.color, borderRadius: 2,
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

export default ConfettiBurst
