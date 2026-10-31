import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { LIVE } from '../config'
import { loaderLine } from '../lib/loader'
import { prefersReducedMotion } from '../lib/hooks'

const KEY = 'lv_seen'

/** "Turning the lights on" with Kolkata's coordinates. Under 1.5 seconds, once per session, skipped for reduced motion. */
export function Loader() {
  const { pathname } = useLocation()
  const [show, setShow] = useState(() => {
    try { return sessionStorage.getItem(KEY) !== '1' && !prefersReducedMotion() } catch { return false }
  })
  useEffect(() => {
    if (!show) return
    try { sessionStorage.setItem(KEY, '1') } catch { /* storage blocked: it will show once more */ }
    const t = window.setTimeout(() => setShow(false), 1300)
    return () => window.clearTimeout(t)
  }, [show])
  if (!show) return null
  return (
    <div className="lv-loader" role="status" aria-label="Loading">
      <p className="lv-loader-line">{loaderLine(pathname)}</p>
      <p className="lv-loader-geo">{LIVE.coordinates}</p>
      <span className="lv-loader-bar" aria-hidden />
    </div>
  )
}
