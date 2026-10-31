import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import roleCapabilityMatrixService from '../services/roleCapabilityMatrixService'
import { effectiveCan, type CapabilityMatrix } from '../lib/capabilities'

/**
 * Makes the permission matrix from /director/roles available to the whole app.
 * ────────────────────────────────────────────────────────────────────────────
 * `useCan('desk.posts')` is the single question every gated surface asks. It
 * answers with `ceilingAllows && matrixEnabled` (see lib/capabilities.ts), so a
 * toggle can only ever narrow what RLS already permits.
 *
 * ── WHY IT FAILS OPEN, DELIBERATELY ────────────────────────────────────────
 * If the matrix cannot be fetched, `can()` answers from the ceiling alone —
 * i.e. exactly the permissions the app had before this engine existed.
 *
 * That is the safe direction here, and it is worth being explicit about why,
 * because "fail open" normally is not. This matrix is not a security boundary:
 * RLS is, and RLS is untouched by a failed fetch. A member whose network
 * dropped still cannot read a row the database refuses them. Failing CLOSED
 * would instead mean a flaky connection silently strips a director of every
 * desk mid-shift and shows them an app that looks broken. So the failure mode
 * is "the org's own restrictions are briefly not applied", never "someone sees
 * data they should not".
 *
 * Anything that must hold under a hostile client belongs in RLS, or in a policy
 * that calls the `role_can()` SQL function — not here.
 *
 * ── LOADED ONCE ────────────────────────────────────────────────────────────
 * The matrix is small (only real restrictions are stored — an unrestricted org
 * fetches zero rows) and changes rarely, so it is fetched once per session and
 * refreshed explicitly by the Roles page after a save, rather than re-queried
 * per navigation.
 */

type CapabilityContextValue = {
  matrix: CapabilityMatrix
  /** True if the signed-in member may do this. */
  can: (capabilityKey: string) => boolean
  /** True once the first fetch has settled, either way. */
  ready: boolean
  /** Set when the fetch failed; `can()` is running on ceilings alone. */
  error: string | null
  refresh: () => Promise<void>
}

const CapabilityContext = createContext<CapabilityContextValue | undefined>(undefined)

export function CapabilityProvider({ children }: { children: ReactNode }) {
  const { member } = useAuth()
  const role = member?.role ?? null

  const [matrix, setMatrix] = useState<CapabilityMatrix>({})
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    // A signed-out visitor has no grant on the table and no role to gate, so
    // asking would be a guaranteed 401 on every public page load.
    if (!role) {
      setMatrix({})
      setReady(true)
      setError(null)
      return
    }
    try {
      const next = await roleCapabilityMatrixService.getMatrix()
      setMatrix(next)
      setError(null)
    } catch (e: any) {
      // Fail open onto the ceilings — see the header.
      setMatrix({})
      setError(e?.message ?? 'Could not load the permission matrix.')
    } finally {
      setReady(true)
    }
  }, [role])

  useEffect(() => { void refresh() }, [refresh])

  const can = useCallback(
    (capabilityKey: string) => effectiveCan(matrix, capabilityKey, role),
    [matrix, role],
  )

  const value = useMemo<CapabilityContextValue>(
    () => ({ matrix, can, ready, error, refresh }),
    [matrix, can, ready, error, refresh],
  )

  return <CapabilityContext.Provider value={value}>{children}</CapabilityContext.Provider>
}

export function useCapabilities(): CapabilityContextValue {
  const ctx = useContext(CapabilityContext)
  if (!ctx) throw new Error('useCapabilities must be used inside a CapabilityProvider')
  return ctx
}

/** The everyday form: `const canModerate = useCan('action.moderate_post')`. */
export function useCan(capabilityKey: string): boolean {
  return useCapabilities().can(capabilityKey)
}

export default CapabilityContext
