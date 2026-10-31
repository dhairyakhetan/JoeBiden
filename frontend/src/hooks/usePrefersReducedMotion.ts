import { useEffect, useState } from 'react'

/**
 * Does this visitor want motion kept to a minimum?
 *
 * WHY THIS EXISTS RATHER THAN framer-motion's useReducedMotion
 *
 * Both answer the same question, and for a component that ALREADY imports
 * framer-motion for real animation work, `useReducedMotion` from there is the
 * right call and 30 files use it. Use that one.
 *
 * This hook is for the other case: a module in the EAGER entry graph that wants
 * nothing from framer-motion except this one boolean. `components/Toast.tsx` was
 * exactly that, and it cost the whole site 127KB - the vendor-motion chunk is
 * `modulepreload`ed on every route, logged-out public pages included, because a
 * handful of eagerly-imported modules referenced the package at all.
 * `components/Confirm.tsx` had already worked this out independently and says so
 * in its own header ("No framer-motion: this provider is mounted at app root on
 * every page"). Audit 2026-09-17, efficiency P2.
 *
 * It also replaces three byte-for-byte copies of this hook that had been
 * hand-written in AQFooter.tsx, Companion.tsx and Confirm.tsx (audit, P3).
 *
 * Reads the media query synchronously in the initial state so the first paint is
 * already correct, and subscribes to changes because a visitor can toggle the OS
 * setting while the tab is open. SSR/prerender safe: no window means no
 * preference, which is the same default the CSS catch-all in v6.css assumes.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    // Re-read on mount: the OS setting can change between the initial state
    // and the effect, and in a prerendered document the initial state was
    // computed with no window at all.
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}

export default usePrefersReducedMotion
