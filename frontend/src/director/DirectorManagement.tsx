import Img from '../components/Img'
import { useState, useEffect, useCallback, useMemo } from 'react'
import directorService, { Director, EligibleMember } from '../services/directorService'
import { useDebounce } from '../hooks/useDebounce'
import { useAuth } from '../auth/AuthContext'
import { isSuperAdmin as isSuperAdminRole } from '../lib/roles'
import {
  AdminLayout, AdminTabHeader, DataToolbar, EmptyLedger, StatusStamp,
  AdminSkeleton, AdminRow, AdminErrorState,
} from './adminKit'
import { useConfirm } from '../components/Confirm'
import { useCan } from '../auth/CapabilityContext'
import { useToast } from '../components/Toast'
import { logAction } from '../lib/auditLog'
import { ChevronDownIcon } from '@heroicons/react/24/outline'

/**
 * Super-admin-only desk for promoting members to HoD, changing an HoD's title,
 * and removing HoD access.
 *
 * Every mutation here is an access change, so all three keep an explicit
 * `useConfirm` - none of them are converted to an undo toast, because a role
 * change takes effect server-side immediately and there is nothing to "cancel"
 * inside a 5s window. Busy state is tracked per member id (not one desk-wide
 * flag) so promoting one person never freezes the rest of the list.
 *
 * The single search box changes meaning with the mode: while the "Add HoD"
 * panel is open it queries eligible members server-side; otherwise it filters
 * the current HoD list locally. The placeholder says which.
 *
 * SELF-LOCKOUT GUARD (20.10, sanctioned exception to "no logic changes" -
 * this is a safety fix, not a design change): "top tier" below is computed
 * from `director.role` via lib/roles.ts's `isSuperAdmin()` helper, NOT from
 * `Director.isSuperAdmin` (directorService.getAllDirectors(), which is
 * `m.role === 'super_admin'` - a strict-equality check written before the
 * `hr` role existed). That flag is `false` for an `hr` row, so before this
 * fix an `hr` account viewing this desk saw full controls - including on
 * THEIR OWN row - with no self-check anywhere in this file, and one click
 * plus one generic confirm would demote them out of admin access mid-session
 * with no recovery from the UI. `lib/roles.ts` is explicit that `hr` is
 * "deliberately EQUAL IN POWER to super_admin" and to "always use these
 * helpers" rather than hand-rolled role checks - this was exactly that kind
 * of hand-rolled check. Fixing it here (client-side, from data already
 * fetched) closes the gap without touching directorService.ts or any
 * Supabase call shape; `Director.isSuperAdmin` has no other reader in the
 * codebase (confirmed by grep), so nothing else depends on the old flag.
 * Both handlers below ALSO carry their own self-id check as defense in
 * depth, since a hidden button is not a security boundary a future change
 * elsewhere in this file couldn't accidentally bypass.
 */

const initials = (name: string) => (name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2)

const ROLE_LABEL: Record<string, string> = {
  member: 'Member', lead: 'Lead', hod: 'HoD', director: 'Director', hr: 'HR', super_admin: 'Super Admin',
}

const DirectorManagement = () => {
  const confirm = useConfirm()
  // /director/roles capability. Can only narrow what members_guard_privileged_cols already allows.
  const canAssignRole = useCan('action.assign_role')
  const toast = useToast()
  const { member: currentMember } = useAuth()
  const [directors, setDirectors] = useState<Director[]>([])
  const [eligibleMembers, setEligibleMembers] = useState<EligibleMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoadingEligible, setIsLoadingEligible] = useState(false)
  const [search, setSearch] = useState('')
  const [showEligible, setShowEligible] = useState(false)
  /** Member ids with a mutation in flight - per-row, never desk-wide. */
  const [busy, setBusy] = useState<Set<number>>(new Set())

  const debouncedSearch = useDebounce(search, 300)
  const setBusyFor = (id: number, on: boolean) =>
    setBusy(prev => { const next = new Set(prev); if (on) next.add(id); else next.delete(id); return next })

  const fetchDirectors = async () => {
    setLoadError(null)
    try {
      const result = await directorService.getAllDirectors()
      if (result.success) setDirectors(result.data.directors)
    } catch (err: any) {
      const msg = err?.message || err?.error_description || 'Something went wrong.'
      setLoadError(msg)
      toast.error(`Could not load HoDs - ${msg}`)
    }
    finally { setIsLoading(false) }
  }

  const fetchEligibleMembers = useCallback(async (searchQuery: string) => {
    setIsLoadingEligible(true)
    try {
      const result = await directorService.getEligibleMembers({ search: searchQuery, limit: 50 })
      if (result.success) setEligibleMembers(result.data)
    } catch { toast.error('couldn’t load eligible members.', 'try that search again.') }
    finally { setIsLoadingEligible(false) }
  }, [toast])

  useEffect(() => { fetchDirectors() }, [])
  useEffect(() => { if (showEligible) fetchEligibleMembers(debouncedSearch) }, [debouncedSearch, showEligible, fetchEligibleMembers])

  const handlePromote = async (memberId: number, memberName: string) => {
    if (!canAssignRole) { toast.error('you don’t have permission to change roles.', 'ask a super admin to re-enable it on /director/roles.'); return }
    if (!(await confirm({ title: 'Promote to HoD?', body: `Promote ${memberName} to HoD? They'll gain moderation access.`, confirmLabel: 'Promote' }))) return
    setBusyFor(memberId, true)
    try {
      const result = await directorService.promoteToDirector(memberId)
      if (result.success) {
        // Assign at least one default category (operations) so HoD can review posts
        try {
          await directorService.assignCategory(memberId, 'operations')
        } catch (catErr: any) {
          // Don't fail the whole promotion if category assignment fails - but
          // say so, rather than swallowing it into the console.
          toast.info(`${memberName} promoted, but no default category could be assigned.`, catErr?.message)
        }
        logAction('MEMBER_PROMOTED_TO_HOD', 'member', memberId, { memberName })
        toast.success(`${memberName} has been promoted to HoD`)
        await fetchDirectors(); await fetchEligibleMembers(debouncedSearch)
      }
    } catch (err: any) { toast.error(err?.message ?? 'Failed to promote member') }
    finally { setBusyFor(memberId, false) }
  }

  const handleDemote = async (memberId: number, memberName: string, isTopTier: boolean) => {
    if (!canAssignRole) { toast.error('you don’t have permission to change roles.', 'ask a super admin to re-enable it on /director/roles.'); return }
    if (isTopTier) { toast.error('can’t demote a super admin or HR account from this desk.'); return }
    // Self-lockout guard (20.10) - see the file header comment. The visible
    // "− remove" button already can't reach a top-tier row (isTopTier check
    // above, in the caller), so this can only fire if that ever changes -
    // it stays regardless, as the guard that doesn't depend on a button
    // being hidden.
    if (memberId === currentMember?.member_id) {
      toast.error('you can’t remove yourself from here.', 'ask another super admin or HR account.')
      return
    }
    if (!(await confirm({ title: 'Remove HoD?', body: `Remove ${memberName} as director? This removes all their category assignments.`, confirmLabel: 'Remove', danger: true }))) return
    setBusyFor(memberId, true)
    try {
      const result = await directorService.demoteToMember(memberId)
      if (result.success) {
        logAction('MEMBER_DEMOTED_FROM_HOD', 'member', memberId, { memberName })
        toast.success(`${memberName} has been demoted to member`)
        await fetchDirectors()
        if (showEligible) await fetchEligibleMembers(debouncedSearch)
      }
    } catch (err: any) { toast.error(err?.message ?? 'Failed to demote director') }
    finally { setBusyFor(memberId, false) }
  }

  const handleChangeRole = async (memberId: number, memberName: string, currentRole: string | undefined, newRole: 'member' | 'hod' | 'director' | 'super_admin') => {
    // Self-lockout guard (20.10) - see the file header comment. The role
    // <select> already can't reach a top-tier row (isTopTier check at the
    // call site), so a top-tier viewer's own row never renders this control -
    // this is the guard that survives even if that ever changes.
    if (memberId === currentMember?.member_id) {
      toast.error('you can’t change your own role from here.', 'ask another super admin or HR account.')
      return
    }
    if (!canAssignRole) { toast.error('you don’t have permission to change roles.', 'ask a super admin to re-enable it on /director/roles.'); return }
    const roleLabel = ROLE_LABEL[newRole] ?? newRole
    const fromLabel = (currentRole && ROLE_LABEL[currentRole]) ?? currentRole ?? 'their current role'
    // Role changes are irreversible from the user's point of view (access
    // changes server-side immediately) - always an explicit confirm.
    // 20.10: name the consequence, which starts with naming BOTH roles, not
    // just the destination (mirrors the identical fix in MemberDirectory).
    const ok = await confirm({
      title: 'Change role?',
      body: `Change ${memberName}'s role from ${fromLabel} to ${roleLabel}? Their access changes immediately. There is no undo on this desk: nothing a five-second window could cancel.`,
      confirmLabel: 'Change role',
      danger: newRole === 'super_admin',
    })
    if (!ok) return
    setBusyFor(memberId, true)
    try {
      const result = await directorService.changeRole(memberId, newRole)
      if (result.success) {
        logAction('MEMBER_ROLE_CHANGED', 'member', memberId, { memberName, from: currentRole, to: newRole })
        toast.success(`${memberName}'s role changed to ${roleLabel}`)
        await fetchDirectors()
      }
    } catch (err: any) { toast.error(err?.message ?? 'Failed to change role') }
    finally { setBusyFor(memberId, false) }
  }

  const term = search.trim().toLowerCase()
  const visibleDirectors = useMemo(() => (
    showEligible || !term
      ? directors
      : directors.filter(d => d.fullName.toLowerCase().includes(term) || d.email.toLowerCase().includes(term))
  ), [directors, showEligible, term])

  return (
    <AdminLayout>
      <AdminTabHeader
        label="People"
        title="Manage HoDs"
        subtitle="Promote members or remove HoD access."
        count={directors.length}
        actions={
          canAssignRole ? (
            <button onClick={() => { setShowEligible(v => !v); setSearch('') }} className="btn btn-sm btn-primary">
              {showEligible ? 'Cancel' : '+ Add HoD'}
            </button>
          ) : undefined
        }
      />

      {showEligible ? (
        <div className="adm-block is-sky" style={{ marginTop: 0, marginBottom: 12 }}>
          <span className="adm-block-label">promote mode</span>
          <DataToolbar
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Search members to promote…"
          />
          <p className="adm-note">searching all members</p>
        </div>
      ) : (
        <DataToolbar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search current HoDs…"
        />
      )}

      {/* Add HoD panel - the search above drives this list while it's open. */}
      {showEligible && (
        <div className="card" style={{ marginBottom: 16, padding: 0 }}>
          <div className="panel-h"><b>Select a member to promote</b></div>
          {isLoadingEligible ? (
            <AdminSkeleton rows={3} />
          ) : eligibleMembers.length === 0 ? (
            <EmptyLedger
              message={search ? 'no members match' : 'no eligible members'}
              sub={search ? 'Try a different name or email.' : 'Everyone eligible already holds a desk role.'}
            />
          ) : eligibleMembers.map(member => (
            <AdminRow
              key={member.memberId}
              busy={busy.has(member.memberId)}
              primary={
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* `.adm-avatar` (soft, no border) - not the public brand's
                      `.avatar` (hard 2px ink ring + a rotate-on-hover bounce),
                      which was the one brutalist leftover on this desk. */}
                  <div className="adm-avatar" style={{ width: 30, height: 30, flexShrink: 0 }}>
                    {member.avatarUrl
                      ? <Img ctx="avatar" src={member.avatarUrl} alt="" referrerPolicy="no-referrer" />
                      : <span className="adm-avatar-fallback" style={{ fontSize: 10, background: 'var(--accent)' }}>{initials(member.fullName)}</span>}
                  </div>
                  <span>{member.fullName}</span>
                </div>
              }
              secondary={
                <>
                  {member.email}
                  {busy.has(member.memberId) && (
                    <div style={{ marginTop: 6 }}>
                      <span className="adm-working" role="status">working…</span>
                    </div>
                  )}
                </>
              }
              actions={
                canAssignRole ? (
                  <button
                    onClick={() => handlePromote(member.memberId, member.fullName)}
                    className="btn btn-sm adm-approve"
                  >
                    promote
                  </button>
                ) : <span className="adm-marker">no controls</span>
              }
            />
          ))}
        </div>
      )}

      {/* Current HoDs */}
      {isLoading ? (
        <AdminSkeleton rows={5} />
      ) : loadError ? (
        <AdminErrorState message={`Could not load HoDs - ${loadError}`} onRetry={() => { setIsLoading(true); fetchDirectors() }} />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="panel-h"><b>Current HoDs ({directors.length})</b></div>
          {visibleDirectors.length === 0 ? (
            <EmptyLedger
              message={directors.length === 0 ? 'no HoDs yet' : 'nothing matches'}
              sub={directors.length === 0 ? 'Promote a member to staff the desk.' : 'Try a different name or email.'}
            />
          ) : visibleDirectors.map(director => {
            // isTopTier, not director.isSuperAdmin - see the file header
            // comment (20.10 self-lockout guard). This is what decides
            // whether the row gets any controls at all, so it has to be
            // right for `hr` as well as `super_admin`.
            const isTopTier = isSuperAdminRole(director.role)
            return (
              <AdminRow
                key={director.memberId}
                busy={busy.has(director.memberId)}
                stamp={
                  <StatusStamp
                    label={ROLE_LABEL[director.role ?? ''] ?? director.role ?? 'hod'}
                    tone={isTopTier ? 'rejected' : 'custom'}
                    color={isTopTier ? undefined : 'var(--sky)'}
                  />
                }
                primary={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Same fix as the eligible-members list above - `.adm-avatar`,
                        not the public brand's hard-bordered, hover-rotating `.avatar`. */}
                    <div className="adm-avatar" style={{ width: 36, height: 36, flexShrink: 0 }}>
                      {director.avatarUrl
                        ? <Img ctx="avatar" src={director.avatarUrl} alt="" referrerPolicy="no-referrer" />
                        : <span className="adm-avatar-fallback" style={{ fontSize: 12, background: 'var(--accent)' }}>{initials(director.fullName)}</span>}
                    </div>
                    <span>{director.fullName}</span>
                  </div>
                }
                secondary={
                  <>
                    {director.email}
                    {director.categories.length > 0 && <> · {director.categories.join(', ')}</>}
                    {busy.has(director.memberId) && (
                      <div style={{ marginTop: 6 }}>
                        <span className="adm-working" role="status">working…</span>
                      </div>
                    )}
                  </>
                }
                meta={isTopTier || !canAssignRole ? <span className="adm-marker">no controls</span> : undefined}
                actions={isTopTier || !canAssignRole ? undefined : (
                  <div className="adm-rowacts">
                    <span className="adm-selectpill">
                      <select
                        value={director.role}
                        onChange={e => handleChangeRole(director.memberId, director.fullName, director.role, e.target.value as 'member' | 'hod' | 'director' | 'super_admin')}
                        aria-label={`Role for ${director.fullName}`}
                      >
                        <option value="hod">HoD</option>
                        <option value="director">Director</option>
                      </select>
                      <ChevronDownIcon width={12} height={12} strokeWidth={2.2} aria-hidden />
                    </span>
                    <button
                      className="btn btn-sm adm-reject"
                      onClick={() => handleDemote(director.memberId, director.fullName, isTopTier)}
                    >
                      − remove
                    </button>
                  </div>
                )}
              />
            )
          })}
        </div>
      )}
    </AdminLayout>
  )
}

export default DirectorManagement
