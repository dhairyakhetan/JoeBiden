import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../components/Toast'
import type { ReportBugInitial } from './ReportBugModal'
import { HOLD_MS, isBugChord, movedTooFar, shortcutAllowed, type Pt } from './shortcutLogic'

// The form and the capture library load on first use only. What ships eagerly is this small
// listener, so the entry bundle barely moves.
const ReportBugModal = lazy(() => import('./ReportBugModal'))

const points = (list: TouchList): Pt[] => Array.from(list, t => ({ x: t.clientX, y: t.clientY }))

/**
 * The invisible way to report a bug from any page: Alt+Shift+B on a computer, or press and hold
 * with two fingers for 0.7 seconds on a phone. Nothing is drawn until it fires. On trigger it
 * takes a picture of the page, then opens the form with the page link and the picture already
 * in it, so the member only types what went wrong. The reporter is the signed-in member; the
 * database records that, not this code.
 *
 * Mounted once, inside the router and the providers. Only an active member has a listener.
 */
export default function BugShortcut() {
  const { member, isAuthenticated } = useAuth()
  const toast = useToast()
  const { pathname } = useLocation()
  const active = isAuthenticated && member?.status === 'active'
  const allowed = shortcutAllowed(pathname, active)
  const [initial, setInitial] = useState<ReportBugInitial | null>(null)
  const busy = useRef(false)
  const openRef = useRef(false)
  openRef.current = initial !== null

  const trigger = useCallback(async () => {
    if (busy.current || openRef.current) return
    busy.current = true
    try {
      navigator.vibrate?.(25)
      toast.info('taking a picture of this page')
      const { captureViewport } = await import('./capture')
      const file = await captureViewport()
      setInitial({
        pageUrl: window.location.href,
        files: file ? [file] : [],
        captureMethod: 'shortcut',
        captureFailed: !file,
      })
    } finally {
      busy.current = false
    }
  }, [toast])

  useEffect(() => {
    if (!allowed) return
    const onKey = (e: KeyboardEvent) => {
      if (!isBugChord(e)) return
      e.preventDefault()
      void trigger()
    }

    let timer: ReturnType<typeof setTimeout> | undefined
    let start: Pt[] = []
    const cancel = () => { if (timer) clearTimeout(timer); timer = undefined }
    const onTouchStart = (e: TouchEvent) => {
      cancel()
      if (e.touches.length !== 2) return
      start = points(e.touches)
      timer = setTimeout(() => { timer = undefined; void trigger() }, HOLD_MS)
    }
    const onTouchMove = (e: TouchEvent) => { if (timer && movedTooFar(start, points(e.touches))) cancel() }

    window.addEventListener('keydown', onKey)
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', cancel, { passive: true })
    window.addEventListener('touchcancel', cancel, { passive: true })
    return () => {
      cancel()
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', cancel)
      window.removeEventListener('touchcancel', cancel)
    }
  }, [allowed, trigger])

  if (!initial) return null
  return (
    <Suspense fallback={null}>
      <ReportBugModal open initial={initial} onClose={() => setInitial(null)} />
    </Suspense>
  )
}
