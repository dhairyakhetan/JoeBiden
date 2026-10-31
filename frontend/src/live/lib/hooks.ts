import { useEffect, useState } from 'react'

/** The current time, ticking every `ms`, paused while the tab is hidden so a background tab does no work. */
export function useNow(ms = 1000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let id: number | undefined
    const start = () => { setNow(new Date()); id = window.setInterval(() => setNow(new Date()), ms) }
    const stop = () => { if (id !== undefined) { window.clearInterval(id); id = undefined } }
    const onVis = () => { stop(); if (document.visibilityState === 'visible') start() }
    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onVis)
    return () => { stop(); document.removeEventListener('visibilitychange', onVis) }
  }, [ms])
  return now
}

/** True when the visitor asked for less motion. Read once; the section also has a CSS media query. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/**
 * Fade sections in as they scroll into view. Adds `is-in` to every `.lv-reveal` and `.lv-wipe` under `root` once seen. The hidden start state
 * is only switched on here (class `lv-anim`), so with no JavaScript, no IntersectionObserver or reduced motion the page is
 * simply all visible.
 */
export function useScrollReveal(root: { current: HTMLElement | null }): void {
  useEffect(() => {
    const el = root.current
    if (!el || typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) return
    const targets = Array.from(el.querySelectorAll<HTMLElement>('.lv-reveal, .lv-wipe'))
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target) }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })
    el.classList.add('lv-anim')
    targets.forEach(t => io.observe(t))
    return () => { io.disconnect(); el.classList.remove('lv-anim') }
  }, [root])
}
