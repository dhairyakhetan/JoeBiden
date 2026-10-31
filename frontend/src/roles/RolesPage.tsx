import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useCapabilities } from '../auth/CapabilityContext'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import { isSuperAdmin, getRoleLabel } from '../lib/roles'
import {
  CAPABILITIES,
  CAPABILITY_GROUPS,
  CAPABILITY_ROLES,
  ceilingAllows,
  isCellTogglable,
  lockReason,
  matrixCellKey,
  matrixEnabled,
  type Capability,
  type CapabilityRole,
} from '../lib/capabilities'
import roleCapabilityMatrixService from '../services/roleCapabilityMatrixService'
import { AdminLayout, AdminTabHeader, AdminSkeleton, AdminErrorState } from '../director/adminKit'
import './RolesPage.css'

/**
 * Roles & Permissions — a real permission engine, not a reference page.
 * ────────────────────────────────────────────────────────────────────────────
 * WHAT THIS REPLACED, and why: this screen used to list prose describing what
 * each role could do, with an "edit" button that changed only the prose. It was
 * rejected in exactly those terms ("it's not supposed to be like an edit, and
 * then there's like a text I can edit... I cannot work like this"). The ask was
 * a wired check table: tick a feature on or off for a role and have it mean
 * something.
 *
 * So every cell here is wired. Unticking a desk removes it from that role's nav
 * AND makes its URL refuse (App.tsx wraps each desk in DeskCapabilityGate);
 * unticking an action removes the control and the code path behind it.
 *
 * ── WHAT THE PAGE REFUSES TO PRETEND ───────────────────────────────────────
 * A cell above a role's RLS ceiling is rendered LOCKED, never as an unticked
 * box. Ticking "member can reach Approvals" would be a lie: the members table's
 * own policies would still refuse the read, so the box would do nothing. The
 * lock carries the reason, which is more useful than a dead checkbox.
 *
 * super_admin's whole column is locked ON for the same honesty, plus one
 * practical reason: it is the only role that can reach this page, so allowing
 * it to be unticked here would let somebody lock the org out of its own
 * permissions screen. The database enforces that too
 * (role_capabilities_super_admin_never_restricted), so it does not rely on this
 * component remembering to disable the input.
 *
 * The old prose table `role_capability_notes` is still in the database, with
 * its rows intact, but nothing reads it any more: `roleCapabilityService` was
 * deleted with this change rather than left as an unreferenced file. Each
 * capability's own hint now carries the operative detail, and it names the RLS
 * policy that sets the ceiling, which the prose never did. If that reference
 * text is wanted back on screen it is one query away.
 */

type SaveState = { key: string; role: CapabilityRole } | null

export default function RolesPage() {
  const { member } = useAuth()
  const { matrix, refresh, error: matrixError } = useCapabilities()
  const { success, error: toastError } = useToast()
  const confirm = useConfirm()

  const canEdit = isSuperAdmin(member?.role)

  // A local mirror so a tick responds instantly; the shared matrix is refreshed
  // from the server afterwards so every other surface in the app agrees.
  const [local, setLocal] = useState(matrix)
  const [saving, setSaving] = useState<SaveState>(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)

  useEffect(() => { setLocal(matrix) }, [matrix])
  useEffect(() => {
    let cancelled = false
    refresh().finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [refresh])

  const restrictionCount = useMemo(
    () => Object.values(local).filter(v => v === false).length,
    [local],
  )

  const grouped = useMemo(
    () => CAPABILITY_GROUPS.map(g => ({ group: g, items: CAPABILITIES.filter(c => c.group === g) })),
    [],
  )

  const toggle = useCallback(async (cap: Capability, role: CapabilityRole) => {
    if (!canEdit || !member?.member_id) return
    if (!isCellTogglable(cap.key, role)) return

    const cellKey = matrixCellKey(cap.key, role)
    const currentlyOn = matrixEnabled(local, cap.key, role)
    const next = !currentlyOn

    // Optimistic, then reconciled against the server by refresh() below. On
    // failure the previous value is put back rather than left showing a change
    // that did not save.
    setLocal(prev => {
      const copy = { ...prev }
      if (next) delete copy[cellKey]
      else copy[cellKey] = false
      return copy
    })
    setSaving({ key: cap.key, role })

    try {
      await roleCapabilityMatrixService.setEnabled(cap.key, role, next, member.member_id)
      await refresh()
      success(
        next ? 'switched on.' : 'switched off.',
        `${getRoleLabel(role)} ${next ? 'can now' : 'can no longer'} ${cap.label.toLowerCase()}.`,
      )
    } catch (e: any) {
      setLocal(prev => {
        const copy = { ...prev }
        if (currentlyOn) delete copy[cellKey]
        else copy[cellKey] = false
        return copy
      })
      toastError("that didn't save.", e?.message)
    } finally {
      setSaving(null)
    }
  }, [canEdit, member?.member_id, local, refresh, success, toastError])

  const resetAll = useCallback(async () => {
    if (!canEdit || restrictionCount === 0) return
    const ok = await confirm({
      title: 'reset every permission?',
      body: `this clears all ${restrictionCount} restriction${restrictionCount === 1 ? '' : 's'} at once and hands every role back the full access its database ceiling allows. it can't be undone in one step - you'd have to untick each one again.`,
      confirmLabel: 'reset them',
      danger: true,
    })
    if (!ok) return
    setResetting(true)
    try {
      const n = await roleCapabilityMatrixService.resetAll()
      await refresh()
      success('reset.', `cleared ${n} restriction${n === 1 ? '' : 's'}.`)
    } catch (e: any) {
      toastError("couldn't reset.", e?.message)
    } finally {
      setResetting(false)
    }
  }, [canEdit, restrictionCount, confirm, refresh, success, toastError])

  return (
    <AdminLayout wide>
      <AdminTabHeader
        label="Permissions"
        title="Roles & permissions"
        subtitle="Tick what each role may do. Unticking a desk hides its tab and blocks its URL; unticking an action removes the control. A greyed cell is one the database itself refuses, so ticking it would change nothing."
        count={restrictionCount}
      />

      {matrixError && (
        <AdminErrorState
          message={`The permission matrix didn't load (${matrixError}). Everyone currently has the full access their role allows.`}
          onRetry={() => { void refresh() }}
        />
      )}

      {!canEdit && (
        <p className="rp-readonly" role="note">
          You can see this matrix but not change it. Editing is Super Admin and HR only, enforced by the database, not just by this page.
        </p>
      )}

      {loading ? (
        <AdminSkeleton rows={6} variant="row" />
      ) : (
        <>
          <div className="rp-scroll">
            <table className="rp-table">
              <caption className="sr-only">
                Permissions by role. Columns are roles, rows are capabilities.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="rp-th-cap">Capability</th>
                  {CAPABILITY_ROLES.map(role => (
                    <th scope="col" key={role} className="rp-th-role">
                      <span className="rp-role-name">{getRoleLabel(role)}</span>
                    </th>
                  ))}
                </tr>
              </thead>

              {grouped.map(({ group, items }) => (
                <tbody key={group}>
                  <tr className="rp-group-row">
                    <th scope="colgroup" colSpan={CAPABILITY_ROLES.length + 1}>{group}</th>
                  </tr>
                  {items.map(cap => (
                    <tr key={cap.key}>
                      <th scope="row" className="rp-th-cap">
                        <span className="rp-cap-label">{cap.label}</span>
                        <span className="rp-cap-hint">{cap.hint}</span>
                      </th>

                      {CAPABILITY_ROLES.map(role => {
                        const allowed = ceilingAllows(cap.key, role)
                        const togglable = isCellTogglable(cap.key, role)
                        const on = role === 'super_admin' ? true : matrixEnabled(local, cap.key, role)
                        const busy = saving?.key === cap.key && saving?.role === role
                        const reason = lockReason(cap.key, role)
                        const label = `${cap.label} for ${getRoleLabel(role)}`

                        if (!allowed) {
                          return (
                            <td key={role} className="rp-cell rp-cell-blocked">
                              <span className="rp-lock" title={reason ?? undefined} aria-label={`${label}: not available, the database refuses this for this role`}>
                                &ndash;
                              </span>
                            </td>
                          )
                        }

                        return (
                          <td key={role} className={`rp-cell${on ? ' is-on' : ''}${busy ? ' is-busy' : ''}`}>
                            <label className="rp-toggle">
                              <input
                                type="checkbox"
                                checked={on}
                                disabled={!canEdit || !togglable || busy || resetting}
                                onChange={() => void toggle(cap, role)}
                                aria-label={label}
                                title={reason ?? undefined}
                              />
                              <span className="rp-box" aria-hidden="true">{on ? '✓' : ''}</span>
                            </label>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>

          <div className="rp-foot">
            <p className="rp-foot-note">
              <strong>{restrictionCount}</strong> restriction{restrictionCount === 1 ? '' : 's'} in force.
              Nothing is stored for a permission that is simply on, so an empty matrix means stock access.
            </p>
            {canEdit && restrictionCount > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void resetAll()} disabled={resetting}>
                {resetting ? 'resetting…' : 'reset all to stock'}
              </button>
            )}
          </div>

          <section className="rp-explainer card">
            <h2 className="rp-explainer-h">How this is enforced</h2>
            <ul className="rp-explainer-list">
              <li><strong>Desks</strong> are checked twice: the tab disappears from the rail, and the route itself refuses, so the URL cannot be typed past it.</li>
              <li><strong>Actions</strong> remove the control inside the desk that performs them.</li>
              <li><strong>A dash</strong> means the database will not serve that capability to that role at all. Ticking it would change nothing, so there is nothing to tick.</li>
              <li><strong>Super Admin</strong> is never restrictable, so this page can always be reached to undo a change. The database enforces that, not just this screen.</li>
              <li>These toggles narrow access; they never widen it. Row-level security remains the real boundary underneath.</li>
            </ul>
          </section>
        </>
      )}
    </AdminLayout>
  )
}
