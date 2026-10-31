import { lazy, Suspense, useEffect, useState } from 'react'
import { FX_EVENT, effectsEnabled, type CelebrationDetail } from '../lib/delight'

// The renderer is its own chunk: this host stays in the eager graph, the particles do not.
const CelebrationLayer = lazy(() => import('./CelebrationLayer'))

type Burst = CelebrationDetail & { id: number }

/** Mounted once, next to GlobalShortcuts. Listens for `celebrate()` and hands bursts to the lazy renderer. */
export default function CelebrationHost() {
  const [bursts, setBursts] = useState<Burst[]>([])

  useEffect(() => {
    let n = 0
    const on = (e: Event) => {
      // celebrate() already checked; the host checks again so no other dispatcher can slip an effect past the switch.
      if (!effectsEnabled()) return
      const detail = (e as CustomEvent<CelebrationDetail>).detail
      // Five at once is plenty; a mashed button must not stack a hundred particles.
      setBursts(b => [...b.slice(-4), { ...detail, id: ++n }])
    }
    window.addEventListener(FX_EVENT, on)
    return () => window.removeEventListener(FX_EVENT, on)
  }, [])

  if (!bursts.length) return null
  return (
    <Suspense fallback={null}>
      <CelebrationLayer bursts={bursts} onDone={id => setBursts(b => b.filter(x => x.id !== id))} />
    </Suspense>
  )
}
