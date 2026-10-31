import { useEffect, useRef, useState } from 'react'
import { createTabLock, type TabLock } from '../lib/singleTabLock'

/**
 * Wraps the whole app (see App.tsx). When AquaTerra is open in more than one
 * tab/window for the same browser profile, only the "leader" tab renders the
 * real app - every other tab shows this hold screen instead. That's what
 * actually prevents the "Lock ... was released because another request
 * stole it" error class, rather than just retrying around it: with only one
 * tab ever running the app's Supabase client, there is no second client left
 * to contend with during a session refresh.
 *
 * Not a security boundary, just a courtesy - a background tab is still
 * signed in, it just isn't actively querying. "use this tab instead" lets
 * someone deliberately switch which tab is live (e.g. they opened a second
 * tab on purpose).
 */
const SingleTabGate = ({ children }: { children: React.ReactNode }) => {
  const [isActive, setIsActive] = useState(true)
  const lockRef = useRef<TabLock | null>(null)

  useEffect(() => {
    // A Terra Notes demo (the Wisdom Woods app, shown in a frame) is opened in its OWN tab on purpose, straight from a
    // page in the first tab. It is static; it must not be met with "open in another tab". (In production that URL is a
    // standalone file that never loads this app at all; this covers the SPA fallback, e.g. the dev server.)
    if (/^\/terranotes\/.*\/demo\/?$/.test(window.location.pathname)) return
    lockRef.current = createTabLock(setIsActive)
    return () => lockRef.current?.destroy()
  }, [])

  if (!isActive) {
    return (
      <div
        style={{
          minHeight: '100dvh', display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: 'var(--page-px, 24px)', background: 'var(--bg)',
        }}
      >
        <div className="card" style={{ padding: 28, maxWidth: 420, textAlign: 'center' }}>
          <div className="h-display" style={{ fontSize: 24, margin: 0 }}>open in another tab</div>
          <p style={{ color: 'var(--ink-2)', marginTop: 10, lineHeight: 1.6 }}>
            AquaTerra is already open in another tab or window. Keeping it to one tab avoids sign-in hiccups when your session refreshes.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => lockRef.current?.takeOver()}>
              use this tab instead
            </button>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export default SingleTabGate
