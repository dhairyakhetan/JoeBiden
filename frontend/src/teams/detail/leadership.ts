import { hasLeaderAccess } from '../../lib/roles'

/**
 * Team page members list (2026-10-03, HR ask: "members list with roles, with
 * HODs and Directors highlighted"). Leaders come first, everyone keeps their
 * existing relative order otherwise (the sort is stable). "Leader" is
 * hasLeaderAccess(orgRole), never a hand-rolled role check, so it follows the
 * role model in lib/roles.ts.
 */
export function leadersFirst<T extends { orgRole?: string | null }>(members: T[]): T[] {
  const leaders: T[] = []
  const rest: T[] = []
  for (const m of members) (hasLeaderAccess(m.orgRole) ? leaders : rest).push(m)
  return [...leaders, ...rest]
}

export const isTeamLeader = (m: { orgRole?: string | null }) => hasLeaderAccess(m.orgRole)
