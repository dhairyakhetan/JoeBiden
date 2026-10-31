import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useCapabilities } from '../auth/CapabilityContext'
import { getRoleLabel } from '../lib/roles'
import PermissionDenied from '../components/PermissionDenied'
import type { NavKey } from './deskAccess'

/**
 * The ROUTE half of a desk capability toggle.
 * ────────────────────────────────────────────────────────────────────────────
 * Unticking a desk on /director/roles hides its nav entry. On its own that
 * would be worth nothing: CLAUDE.md records that "a lower-privileged leader can
 * reach a super-admin-only screen by typing the URL directly" has already
 * shipped as a real bug on this project, and hiding a link is not a gate.
 *
 * So the generated routes in App.tsx wrap every desk in this, and the nav and
 * the URL now refuse together. `deskAccess.test.ts` already asserts the
 * privilege guard and the nav gate agree for every desk against every role;
 * `capabilities.test.ts` does the same for the capability layer.
 *
 * This sits INSIDE ProtectedRoute, never instead of it. The privilege check
 * (`requireDirector` / `requireSuperAdmin`, mirroring RLS) runs first and is
 * the thing that actually protects the data. This layer can only narrow what
 * that already allowed, which is the whole contract in lib/capabilities.ts.
 *
 * While the matrix is still loading it renders nothing rather than the desk.
 * That costs a frame on the first desk opened in a session — the matrix is
 * fetched once and an unrestricted org fetches zero rows — and it avoids
 * flashing a desk that is about to be refused, which would leak the very
 * content the toggle exists to withhold.
 */
export default function DeskCapabilityGate({
  deskKey,
  children,
}: {
  deskKey: NavKey
  children: ReactNode
}) {
  const { member } = useAuth()
  const { can, ready } = useCapabilities()

  if (!ready) return null

  if (!can(`desk.${deskKey}`)) {
    return <PermissionDenied variant="capability" requiredRole={getRoleLabel(member?.role)} />
  }

  return <>{children}</>
}
