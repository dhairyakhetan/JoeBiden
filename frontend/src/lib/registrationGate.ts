import { isRegistrationComplete } from './profileNudge'
import { isUnblockableTestAccount } from './testAccounts'

/**
 * The app-wide "give us your number first" gate (owner request, 5 Nov 2026).
 *
 * Until now the rule "a member needs a class and a plausible phone" (isRegistrationComplete) was enforced right after a Google
 * sign-in and on the protected pages only. A member who already had a saved session could still land on the public home feed or
 * any public page and carry on without ever being asked. This closes that: a signed-in member who is still waiting for approval
 * or is approved, and has no usable number on file, is sent to /register wherever they are, until they have given one. /register
 * already knows how to send an existing member back to where they were headed once it is done.
 *
 * Not gated: the pages needed to finish or leave the flow (register, login, the auth callback, the waiting and rejected pages),
 * the legal and contact pages (so nobody has to hand over a number before reading the policy), and the event and sub-apps that run
 * their own sign-in (Terrathon, AquaTerra Live, Paradox) plus the dev harnesses. Rejected, suspended and deleted accounts are left
 * to ProtectedRoute, which sends them to /rejected. The owner's demo account is exempt, as everywhere else.
 */
export const REGISTRATION_GATE_EXEMPT_PREFIXES = [
  '/register', '/login', '/auth', '/logout', '/pending', '/rejected',
  '/privacy-policy', '/equity-policy', '/contact', '/faq',
  '/terrathon', '/live', '/paradox', '/dev',
]

function isExempt(pathname: string): boolean {
  return REGISTRATION_GATE_EXEMPT_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
}

type GateMember = { class_grade: string | null; phone: string | null; status?: string | null; email?: string | null }

/** Where to send this visitor, or null when they may stay. Pure, so it can be tested without a router. */
export function registrationGateTarget(args: { pathname: string; member: GateMember | null | undefined; isLoading: boolean }): string | null {
  const { pathname, member, isLoading } = args
  if (isLoading || !member) return null
  if (member.status !== 'active' && member.status !== 'pending_approval') return null
  if (member.email && isUnblockableTestAccount(member.email)) return null
  if (isRegistrationComplete(member)) return null
  if (isExempt(pathname)) return null
  return '/register'
}
