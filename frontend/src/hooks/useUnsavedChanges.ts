import { useCallback, useEffect, useRef } from 'react'
import { useConfirm } from '../components/Confirm'
import {
  shouldGuard, UNSAVED_BODY, UNSAVED_CANCEL, UNSAVED_CONFIRM, UNSAVED_TITLE,
  type GuardInput,
} from '../lib/unsavedChanges'

/**
 * changelog/11-system-states.md §11.9 state 10 — one guard, four surfaces.
 *
 * Covers both exits a member can take with text still in a field:
 *
 * 1. **The tab / browser exit** — a native `beforeunload`. This is the only
 *    thing the browser will listen to; the string is ignored by every current
 *    browser (they show their own wording), so no copy is invented for it.
 *    The listener is only attached while there is genuinely something to lose,
 *    which also keeps the back/forward cache eligible the rest of the time.
 *
 * 2. **The in-app exit** — `confirmDiscard()`, an awaited `useConfirm()`
 *    dialog, per CLAUDE.md's "strict convention". Call it from the close
 *    button / scrim / back handler and only proceed on `true`.
 *
 * Why the in-app half is a call the surface makes rather than a router-level
 * block: this app mounts `<BrowserRouter>` (App.tsx), not a data router, and
 * react-router's `useBlocker` throws outside a data router. Converting the app
 * to `createBrowserRouter` is a route change, which this pass is not allowed
 * to make. Guarding at the exit the member actually presses is also the more
 * honest shape — it can never fire on a redirect the app itself performs.
 *
 * The guard never fires on a successful submit, never during a write, and
 * never when a draft has already persisted the content (`persisted`) — see
 * `lib/unsavedChanges.ts`, where that rule lives and is unit-tested.
 */
export function useUnsavedChanges(input: GuardInput & {
  /** Override the dialog copy where a surface can name the thing precisely. */
  title?: string
  body?: string
}) {
  const confirm = useConfirm()
  const active = shouldGuard(input)
  // The dialog copy is read at confirm time, not closed over per render.
  // Both refs are written in an effect, never during render: `confirmDiscard`
  // has to stay referentially stable (close handlers in several of these
  // surfaces are held in refs of their own), and a ref written during render
  // is a lint error and, under concurrent rendering, a real one.
  const copyRef = useRef({ title: input.title, body: input.body })
  const activeRef = useRef(active)
  useEffect(() => {
    copyRef.current = { title: input.title, body: input.body }
    activeRef.current = active
  })

  useEffect(() => {
    if (!active) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Legacy browsers want a returnValue set; the text itself is never shown.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [active])

  /**
   * `true` = it is fine to leave (nothing to lose, or the member said so).
   * Await this before closing a sheet or navigating away.
   */
  const confirmDiscard = useCallback(async (): Promise<boolean> => {
    if (!activeRef.current) return true
    return confirm({
      title: copyRef.current.title ?? UNSAVED_TITLE,
      body: copyRef.current.body ?? UNSAVED_BODY,
      confirmLabel: UNSAVED_CONFIRM,
      cancelLabel: UNSAVED_CANCEL,
      danger: true,
    })
  }, [confirm])

  return { guardActive: active, confirmDiscard }
}

export default useUnsavedChanges
