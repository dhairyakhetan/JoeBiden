import { supabaseCommunity } from '../lib/supabaseCommunity'
import type { CapabilityMatrix, CapabilityRole } from '../lib/capabilities'
import { matrixCellKey, TOP_TIER_NEVER_RESTRICTABLE } from '../lib/capabilities'
import { isSuperAdmin } from '../lib/roles'
import { logSupabaseError } from '../lib/errorTracking'
import { withFunctionLogging } from '../lib/functionLog'

// ─────────────────────────────────────────────────────────────────────────────
// roleCapabilityMatrixService — the real permission engine behind
// /director/roles.
//
// Table: public.role_capabilities (capability_key, role, enabled, updated_by,
// updated_at), migration `role_capabilities_toggle_engine`.
//
// NOT to be confused with `roleCapabilityService`, which reads
// `role_capability_notes` — the PROSE describing each role. That one is
// documentation; this one decides.
//
// ── ABSENT ROW MEANS ENABLED ────────────────────────────────────────────────
// The table stores ONLY restrictions. A missing row reads as enabled, so an
// empty table reproduces today's behaviour exactly, and re-ticking a box
// DELETES its row rather than storing `true`. That keeps the table readable as
// a plain list of "things somebody deliberately turned off", and it means the
// engine can be rolled back to stock by emptying one table.
//
// ── RLS DOES THE REAL GATING ────────────────────────────────────────────────
//   · SELECT: any authenticated member. Each one needs to know which desks and
//     buttons to render for their own role; the table holds no personal data.
//   · INSERT/UPDATE/DELETE: is_super_admin() only.
//   · anon holds no grant at all.
//   · A CHECK constraint refuses any row disabling something for super_admin,
//     so nobody can untick their way out of the only page that undoes it.
//
// Contract, matching every other service here: THIS THROWS. No toasts — the
// calling component catches and reports via useToast(), per CLAUDE.md.
// ─────────────────────────────────────────────────────────────────────────────

// `lib/database.types.ts` is a checked-in generated file that predates this
// table, so the typed client would reject the name outright. Same `as any`
// escape hatch roleCapabilityService and directorService already use.
const db = supabaseCommunity as any

export interface CapabilityRestriction {
  capabilityKey: string
  role: CapabilityRole
  enabled: boolean
  updatedById: number | null
  updatedAt: string
}

const mapRow = (r: any): CapabilityRestriction => ({
  capabilityKey: r.capability_key,
  role: r.role,
  enabled: r.enabled,
  updatedById: r.updated_by ?? null,
  updatedAt: r.updated_at,
})

const roleCapabilityMatrixServiceImpl = {
  /**
   * The whole matrix, as `{ 'desk.posts::hod': false }`. Only restrictions are
   * stored, so anything absent from the returned object is enabled — callers
   * must go through `effectiveCan()` rather than reading this directly, so the
   * RLS ceiling is applied too.
   */
  async getMatrix(): Promise<CapabilityMatrix> {
    const { data, error } = await db
      .from('role_capabilities')
      .select('capability_key, role, enabled')
    if (error) throw logSupabaseError('roleCapabilityMatrixService.getMatrix', error)
    const matrix: CapabilityMatrix = {}
    for (const row of data || []) {
      matrix[matrixCellKey(row.capability_key, row.role)] = row.enabled
    }
    return matrix
  },

  /** Every restriction with its audit trail, for the "recent changes" list. */
  async listRestrictions(): Promise<CapabilityRestriction[]> {
    const { data, error } = await db
      .from('role_capabilities')
      .select('*')
      .eq('enabled', false)
      .order('updated_at', { ascending: false })
    if (error) throw logSupabaseError('roleCapabilityMatrixService.listRestrictions', error)
    return (data || []).map(mapRow)
  },

  /**
   * Turn a capability on or off for one role.
   *
   * Enabling DELETES the row (see the absent-row rule above); disabling upserts
   * one. Both paths verify the write actually landed, because PostgREST returns
   * NO error and zero rows when RLS denies a write — without that guard a
   * non-admin who reached the control would get a success toast for a write
   * that never happened. That bug class has been fixed repeatedly across this
   * codebase (achievementService, memberOfMonthService, jobOpenings), so it is
   * guarded here from the start.
   */
  async setEnabled(
    capabilityKey: string,
    role: CapabilityRole,
    enabled: boolean,
    updatedBy: number,
  ): Promise<void> {
    if (role === 'super_admin' && !enabled) {
      // The database refuses this too. Failing here first turns a constraint
      // violation into a sentence the operator can act on.
      throw new Error('Super Admin cannot be restricted — otherwise this page could lock itself away.')
    }

    // `hr` IS restrictable in general, deliberately - see TOP_TIER_NEVER_RESTRICTABLE
    // in lib/capabilities.ts. The single exception is the matrix's own desk: in an
    // org whose only top-tier account is `hr` (the normal shape, since `hr` exists
    // so HR staff do not read as super admins), unticking it leaves nobody able to
    // reach the page that would tick it back on.
    // Unlike the super_admin case above, the database does NOT yet refuse this -
    // scripts/role_capabilities_hr_never_locked_out_2026_09_17.sql is not applied -
    // so for now this check is the only thing standing in the way.
    if (!enabled && isSuperAdmin(role) && TOP_TIER_NEVER_RESTRICTABLE.has(capabilityKey)) {
      throw new Error('HR cannot lose the Roles & Permissions desk — it is the only way to undo a change like this.')
    }

    if (enabled) {
      const { data, error } = await db
        .from('role_capabilities')
        .delete()
        .eq('capability_key', capabilityKey)
        .eq('role', role)
        .select('capability_key')
      if (error) throw logSupabaseError('roleCapabilityMatrixService.setEnabled', error)
      // Zero rows here is the ordinary case: the restriction was never stored,
      // so "enabled" was already true. Only a thrown error is a real failure.
      void data
      return
    }

    const { data, error } = await db
      .from('role_capabilities')
      .upsert(
        {
          capability_key: capabilityKey,
          role,
          enabled: false,
          updated_by: updatedBy,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'capability_key,role' },
      )
      .select('capability_key')
    if (error) throw logSupabaseError('roleCapabilityMatrixService.setEnabled', error)
    if (!(data || [])[0]) {
      throw new Error("That change didn't save — you may not have permission to edit permissions.")
    }
  },

  /** Clear every restriction, returning the whole org to stock permissions. */
  async resetAll(): Promise<number> {
    const { data, error } = await db
      .from('role_capabilities')
      .delete()
      .eq('enabled', false)
      .select('capability_key')
    if (error) throw logSupabaseError('roleCapabilityMatrixService.resetAll', error)
    return (data || []).length
  },
}

export const roleCapabilityMatrixService = withFunctionLogging('roleCapabilityMatrixService', roleCapabilityMatrixServiceImpl)

export default roleCapabilityMatrixService
