import * as React from 'react'
import { AnimatePresence, motion, useReducedMotion, type Transition } from 'framer-motion'

/**
 * ProgressiveFluxLoader - adapted from the recipe to the AquaTerra stack:
 * inline styles + brand CSS vars (no shadcn tokens / Tailwind utilities / cn),
 * recoloured to a brand mint → lemon "flux", framer-motion (already a dep),
 * fully reduced-motion safe. Supports a controlled `value` (0–100) or a
 * self-running sweep when `value` is omitted.
 */

export interface FluxPhase {
  /** Progress threshold (0–100) at or past which `label` shows. */
  at: number
  label: string
}

export interface ProgressiveFluxLoaderProps {
  value?: number
  phases?: FluxPhase[]
  /** Seconds for one full sweep when uncontrolled. Default 3. */
  duration?: number
  /** Restart from 0 after 100 (uncontrolled only). Default false. */
  loop?: boolean
  showLabel?: boolean
  /** CSS background for the fill. Defaults to the brand mint→lemon flux. */
  gradient?: string
  onComplete?: () => void
  className?: string
  style?: React.CSSProperties
}

const DEFAULT_PHASES: FluxPhase[] = [
  { at: 0, label: 'warming up' },
  { at: 30, label: 'loading projects' },
  { at: 65, label: 'almost there' },
  { at: 100, label: 'welcome' },
]

// Brand "flux" - deep mint → bright mint → lemon and back, so the moving sheen
// reads symmetrically. Recolour per instance via the `gradient` prop.
const FLUX_FROM = '#1B8A5A'
const FLUX_MID = '#00E5A0'
const FLUX_TO = '#FFC700'
const DEFAULT_GRADIENT = `linear-gradient(90deg, ${FLUX_FROM} 0%, ${FLUX_MID} 35%, ${FLUX_TO} 55%, ${FLUX_MID} 78%, ${FLUX_FROM} 100%)`
const BAR_SHADOW =
  // audit-ok: a Pop-mint GLOW on the loader, not a surface or text colour.
  '0 0 18px rgba(0,229,160,0.45), 0 0 32px rgba(255,199,0,0.30), inset 0 1.5px 0 rgba(255,255,255,0.5), inset 0 -2px 3px rgba(0,60,40,0.30)'
const SHEEN = 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)'

const EASE: Transition['ease'] = [0.22, 1, 0.36, 1]

function pickLabel(value: number, sorted: FluxPhase[]) {
  let active = sorted[0]?.label ?? ''
  for (const p of sorted) if (value >= p.at) active = p.label
  return active
}

export default function ProgressiveFluxLoader({
  value,
  phases = DEFAULT_PHASES,
  duration = 3,
  loop = false,
  showLabel = true,
  gradient = DEFAULT_GRADIENT,
  onComplete,
  className,
  style,
}: ProgressiveFluxLoaderProps) {
  const reduced = !!useReducedMotion()
  const isControlled = typeof value === 'number'
  const [internal, setInternal] = React.useState(0)

  const onCompleteRef = React.useRef(onComplete)
  React.useEffect(() => { onCompleteRef.current = onComplete })
  const completedRef = React.useRef(false)

  // Uncontrolled self-run sweep.
  React.useEffect(() => {
    if (isControlled) return
    let raf = 0, timer = 0
    let start: number | null = null
    const totalMs = Math.max(500, duration * 1000)
    const tick = (ts: number) => {
      if (start === null) start = ts
      const pct = Math.min(100, ((ts - start) / totalMs) * 100)
      setInternal(pct)
      if (pct >= 100) {
        if (!completedRef.current) { completedRef.current = true; onCompleteRef.current?.() }
        if (loop) {
          start = null; completedRef.current = false
          timer = window.setTimeout(() => { setInternal(0); raf = requestAnimationFrame(tick) }, 600)
        }
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); clearTimeout(timer) }
  }, [isControlled, duration, loop])

  const raw = isControlled ? (value as number) : internal
  const current = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0

  React.useEffect(() => {
    if (!isControlled) return
    if (current >= 100 && !completedRef.current) { completedRef.current = true; onCompleteRef.current?.() }
    else if (current < 100) completedRef.current = false
  }, [isControlled, current])

  const sorted = React.useMemo(() => [...phases].sort((a, b) => a.at - b.at), [phases])
  const label = React.useMemo(() => pickLabel(current, sorted), [current, sorted])
  const rounded = Math.round(current)

  return (
    <div
      className={className}
      style={{ width: '100%', maxWidth: 420, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, ...style }}
    >
      {showLabel && (
        <div style={{ position: 'relative', height: 48, width: '100%', userSelect: 'none' }}>
          {reduced ? (
            <div aria-hidden style={labelBase}>{label}</div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={label}
                aria-hidden
                style={labelBase}
                initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -12, filter: 'blur(6px)', transition: { duration: 0.25, ease: [0.7, 0, 0.84, 0] } }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                {label}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      )}

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rounded}
        aria-valuetext={label ? `${rounded}% – ${label}` : `${rounded}%`}
        aria-label="Loading"
        style={{
          position: 'relative', height: 18, width: '100%', overflow: 'hidden',
          borderRadius: 999, background: 'var(--bg-3)',
          boxShadow: 'inset 0 2px 3px rgba(0,0,0,0.12), inset 0 -1px 2px rgba(255,255,255,0.6)',
        }}
      >
        <motion.div
          style={{ position: 'relative', height: '100%', borderRadius: 999, background: gradient, boxShadow: BAR_SHADOW }}
          initial={false}
          animate={{ width: `${current}%` }}
          transition={reduced ? { duration: 0 } : { duration: 0.55, ease: EASE }}
        >
          {!reduced && (
            <motion.span
              aria-hidden
              style={{ position: 'absolute', inset: '0 auto 0 0', width: '50%', borderRadius: 999, background: SHEEN, mixBlendMode: 'screen', pointerEvents: 'none' }}
              animate={{ x: ['-110%', '210%'] }}
              transition={{ duration: 1.6, ease: 'linear', repeat: Infinity }}
            />
          )}
        </motion.div>
      </div>
    </div>
  )
}

const labelBase: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  textAlign: 'center', fontFamily: 'var(--display)', fontWeight: 900,
  fontSize: 'clamp(26px, 5vw, 38px)', letterSpacing: '-0.03em', textTransform: 'lowercase',
  color: 'var(--ink-2)',
}
