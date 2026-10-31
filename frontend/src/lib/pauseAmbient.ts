import '../styles/components/ambient.css'
// Decorative loops (tickers, marquees, floats, spinning badges) keep the compositor busy even when they are scrolled far out
// of view. This holds every match still while it is more than a screen away, and lets it run again on approach.
// It only toggles `data-ambient-off`, which styles/components/ambient.css turns into `animation-play-state: paused`.
const SELECTOR = [
  '.marquee', '.wobble', '.sticker-float', '.spin-slow', '.float', '.aq-ticker-track', '.ab-badge-spin', '.livedot',
  '.hi-strip-track', '.aq-openings-strip-track', '.rtk-track',
].join(',')

export function startAmbientPause(): () => void {
  if (typeof IntersectionObserver === 'undefined' || typeof MutationObserver === 'undefined') return () => {}
  const io = new IntersectionObserver(
    entries => entries.forEach(e => e.target.toggleAttribute('data-ambient-off', !e.isIntersecting)),
    { rootMargin: '100% 0px' },
  )
  const seen = new WeakSet<Element>()
  const scan = (root: ParentNode) => root.querySelectorAll(SELECTOR).forEach(n => { if (!seen.has(n)) { seen.add(n); io.observe(n) } })
  scan(document)
  let queued = false
  const mo = new MutationObserver(() => {
    if (queued) return
    queued = true
    requestAnimationFrame(() => { queued = false; scan(document) })
  })
  mo.observe(document.body, { childList: true, subtree: true })
  return () => { mo.disconnect(); io.disconnect() }
}
