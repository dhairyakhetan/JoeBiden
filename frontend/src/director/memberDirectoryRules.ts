import { isSuperAdmin } from '../lib/roles'

/**
 * Pure rules for the Members desk's row actions, kept out of the component so
 * they can be pinned by tests and shared by the card grid and the desktop table.
 */

/** Archiving takes an account off every live list. Doing it to a super admin or
 *  HR account would lock out the people who hold every admin power, so only
 *  someone in that tier may archive one. Nobody archives themselves here. */
export function canArchiveMember(actorRole: string | null | undefined, targetRole: string | null | undefined, isSelf: boolean): boolean {
  if (isSelf) return false
  if (isSuperAdmin(targetRole) && !isSuperAdmin(actorRole)) return false
  return true
}

/** Why archive is unavailable, for the button tooltip; null when it is allowed. */
export function archiveBlockedReason(actorRole: string | null | undefined, targetRole: string | null | undefined, isSelf: boolean): string | null {
  if (isSelf) return 'You cannot archive your own account'
  if (!canArchiveMember(actorRole, targetRole, isSelf)) return 'Only a super admin or HR can archive this account'
  return null
}

/** The delete control is for live rows only: a row already in the Deleted
 *  filter is restored or restarted, never deleted again. Super admin tier only. */
export function showDeleteControl(actorRole: string | null | undefined, status: DirectoryStatusView): boolean {
  return isSuperAdmin(actorRole) && status !== 'deleted' && !isReadOnlyStatusView(status)
}

/** Monotonic request token: only the latest request may write results. */
export function createRequestTokens() {
  let latest = 0
  return {
    next: () => ++latest,
    isLatest: (t: number) => t === latest,
  }
}

/** Every status view the Members desk can show. */
export type DirectoryStatusView = 'active' | 'pending_approval' | 'suspended' | 'archived' | 'deleted'

/** Pending and suspended people are shown read-only: approving or rejecting an
 *  applicant belongs to the Approvals desk, and a suspension is a sanction this
 *  desk does not undo. No teams, break, archive or delete controls on those rows. */
export function isReadOnlyStatusView(status: DirectoryStatusView): boolean {
  return status === 'pending_approval' || status === 'suspended'
}

/** Only HR and super admin see the Approvals desk, so only they get the link. */
export function showApprovalsLink(actorRole: string | null | undefined, status: DirectoryStatusView): boolean {
  return status === 'pending_approval' && isSuperAdmin(actorRole)
}

/** Header subtitle noun for a status view, before any role filter is applied. */
export function statusViewNoun(status: DirectoryStatusView): string {
  switch (status) {
    case 'archived': return 'people who have left'
    case 'deleted': return 'deleted accounts'
    case 'pending_approval': return 'people waiting for approval'
    case 'suspended': return 'suspended accounts'
    default: return 'active members'
  }
}

/** Suffix appended after a role label ("HoDs who have left"). */
export function statusViewSuffix(status: DirectoryStatusView): string {
  switch (status) {
    case 'archived': return ' who have left'
    case 'deleted': return ' (deleted)'
    case 'pending_approval': return ' (waiting for approval)'
    case 'suspended': return ' (suspended)'
    default: return ''
  }
}

/** Empty-state copy for a status view with no rows and no search. */
export function statusViewEmpty(status: DirectoryStatusView): { message: string; sub: string } {
  switch (status) {
    case 'pending_approval': return { message: 'no one is waiting', sub: 'New sign-ups waiting for approval will appear here.' }
    case 'suspended': return { message: 'no suspended accounts', sub: 'Nobody is suspended right now.' }
    case 'archived': return { message: 'no one has left', sub: 'People who leave AQ will appear here.' }
    case 'deleted': return { message: 'nothing deleted', sub: 'Deleted accounts will appear here.' }
    default: return { message: 'no members yet', sub: 'Approved members will appear here.' }
  }
}
