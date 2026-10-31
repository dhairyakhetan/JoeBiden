import { supabaseCommunity } from '../lib/supabaseCommunity'
import { localDateISO } from '../lib/uiHelpers'
import { getCachedMemberId } from '../lib/authCache'
import { notificationService } from './notificationService'
import { logSupabaseError } from '../lib/errorTracking'
import { withFunctionLogging } from '../lib/functionLog'

/**
 * sopService - the `sops` desk (handoff/20-sops-and-todos.md §4). Two kinds
 * of row share one table: `procedure` (standing, no deadline, grouped by
 * sub_division) and `goal` (deadlined, urgency-ranked) - see the `Sop.kind`
 * discriminant below. `sop_templates` (the WhatsApp script-template browser)
 * is a deliberately separate, out-of-scope concern - not touched here.
 *
 * Mirrors the throw-on-error / `{success, data}` shape every other
 * `services/*.ts` file uses (see teamService.ts, achievementService.ts) -
 * components wrap every call in try/catch and own their own toast feedback
 * per CLAUDE.md's Feedback pattern; nothing in here calls useToast.
 */

export type SopKind = 'procedure' | 'goal'
export type SopStatus = 'not_started' | 'in_progress' | 'completed'
export type SopUrgency = 'P1' | 'P2' | 'P3'

export interface Sop {
  id: number
  departmentSlug: string
  subDivision: string | null
  task: string
  description: string | null
  kind: SopKind
  urgency: SopUrgency | null
  ledByText: string
  /** FK to members - null when `ledByText` is free text that doesn't resolve
   *  to a real member (e.g. "Reel HoD, Design HoD" or "Not Applicable /
   *  Everyone"). §4.4 - display the raw text in that case, never force-resolve. */
  ledByMemberId: number | null
  status: SopStatus
  assignedOn: string | null
  dueOn: string | null
  completedOn: string | null
  notes: string | null
  docLinks: string[] | null
  /** Procedures only - "last touched". Null means never run; don't fabricate a date (§4.2). */
  lastRunAt: string | null
  createdAt: string
  updatedAt: string
}

export interface SopInput {
  departmentSlug: string
  subDivision?: string | null
  task: string
  description?: string | null
  kind: SopKind
  urgency?: SopUrgency | null
  ledByText: string
  ledByMemberId?: number | null
  dueOn?: string | null
  notes?: string | null
  docLinks?: string[] | null
}

const mapRow = (row: any): Sop => ({
  id: row.id,
  departmentSlug: row.department_slug,
  subDivision: row.sub_division,
  task: row.task,
  description: row.description,
  kind: row.kind,
  urgency: row.urgency,
  ledByText: row.led_by_text,
  ledByMemberId: row.led_by_member_id,
  status: row.status,
  assignedOn: row.assigned_on,
  dueOn: row.due_on,
  completedOn: row.completed_on,
  notes: row.notes,
  docLinks: row.doc_links,
  lastRunAt: row.last_run_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

/**
 * Tell the assignee a task is now theirs — item 7.4's other half.
 *
 * The desk could already set `led_by_member_id`, and nothing anywhere told the
 * person. A "my tasks" card only helps someone who thinks to go and look; the
 * notification is what makes an assignment ARRIVE.
 *
 * Fires only when the assignee actually CHANGES (`prior !== next`), so editing
 * a task's notes does not re-notify whoever holds it, and never when a leader
 * assigns a task to themselves.
 *
 * Fire-and-forget, and deliberately not awaited: `notificationService.create`
 * is the one non-throwing service in this codebase by design (CLAUDE.md), and
 * a failed notification must not fail the assignment that triggered it.
 */
function notifyAssignee(sop: Sop, priorAssigneeId: number | null): void {
  const next = sop.ledByMemberId
  if (next == null || next === priorAssigneeId) return
  void (async () => {
    try {
      const actor = await getCachedMemberId()
      if (actor === next) return   // assigned it to themselves
      await notificationService.create({
        memberId: next,
        type: 'system',
        title: sop.kind === 'goal' ? 'A goal was assigned to you' : 'A procedure is now yours',
        subtitle: sop.task,
        fullNote: [
          sop.description,
          sop.dueOn ? `Due ${sop.dueOn}.` : null,
        ].filter(Boolean).join(' ') || undefined,
        link: '/profile/me',
      })
    } catch { /* non-fatal by design - see above */ }
  })()
}

const sopServiceImpl = {
  async getCurrentMemberId() {
    const id = await getCachedMemberId()
    if (id == null) throw new Error('Not authenticated')
    return id
  },

  /**
   * Every row the viewer's RLS lets them SELECT - `is_member_of_department()`
   * already scopes this server-side (any active member of a matching-category
   * team, or any director/super_admin), so this deliberately does NOT filter
   * by department client-side; the desk's own tab/pill state does that.
   */
  async list() {
    const { data, error } = await supabaseCommunity
      .from('sops')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw logSupabaseError('sopService.list', error)
    return { success: true, data: (data || []).map(mapRow) }
  },

  /**
   * The tasks assigned to the signed-in member — walkthrough item 7.4,
   * "assigning a task shows up for the assignee".
   * ──────────────────────────────────────────────────────────────────────────
   * This could not have been written before 2026-09-11. The two `sops`
   * policies disagreed about whether an assignee is a legitimate party to
   * their own row: UPDATE matched `led_by_member_id = get_current_member_id()`,
   * SELECT did not. Verified live before the fix - a welfare goal assigned to
   * a member who is not on a welfare team returned ZERO rows to that member,
   * while letting them update it. Migration `sops_assignee_can_see_own_task`
   * makes SELECT agree with UPDATE, using the same expression UPDATE already
   * had, so nobody gained sight of anything that is not theirs.
   *
   * Completed tasks are excluded, and goals are ordered by due date with
   * undated ones last: this is a "what is on me" list, not an archive.
   */
  async getMine(): Promise<{ success: boolean; data: Sop[] }> {
    const memberId = await this.getCurrentMemberId()
    const { data, error } = await supabaseCommunity
      .from('sops')
      .select('*')
      .eq('led_by_member_id', memberId)
      .neq('status', 'completed')
      .order('due_on', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (error) throw logSupabaseError('sopService.getMine', error)
    return { success: true, data: (data || []).map(mapRow) }
  },

  async create(input: SopInput) {
    const payload = {
      department_slug: input.departmentSlug,
      sub_division: input.subDivision?.trim() || null,
      task: input.task.trim(),
      description: input.description?.trim() || null,
      kind: input.kind,
      urgency: input.kind === 'goal' ? (input.urgency ?? null) : null,
      led_by_text: input.ledByText.trim(),
      led_by_member_id: input.ledByMemberId ?? null,
      due_on: input.kind === 'goal' ? (input.dueOn || null) : null,
      notes: input.notes?.trim() || null,
      doc_links: input.docLinks && input.docLinks.length > 0 ? input.docLinks : null,
    }
    const { data, error } = await supabaseCommunity
      .from('sops')
      .insert(payload)
      .select('*')
      .single()

    if (error) throw logSupabaseError('sopService.create', error)
    notifyAssignee(mapRow(data), null)
    return { success: true, data: mapRow(data) }
  },

  async update(id: number, input: SopInput) {
    // Read the CURRENT assignee before writing, so the notification below
    // fires on an actual change of hands rather than on every save. Without
    // this, editing a task's notes would re-notify whoever holds it.
    const { data: prior } = await supabaseCommunity
      .from('sops').select('led_by_member_id').eq('id', id).maybeSingle()
    const priorAssignee = (prior as any)?.led_by_member_id ?? null

    const payload = {
      department_slug: input.departmentSlug,
      sub_division: input.subDivision?.trim() || null,
      task: input.task.trim(),
      description: input.description?.trim() || null,
      kind: input.kind,
      urgency: input.kind === 'goal' ? (input.urgency ?? null) : null,
      led_by_text: input.ledByText.trim(),
      led_by_member_id: input.ledByMemberId ?? null,
      due_on: input.kind === 'goal' ? (input.dueOn || null) : null,
      notes: input.notes?.trim() || null,
      doc_links: input.docLinks && input.docLinks.length > 0 ? input.docLinks : null,
    }
    const { data, error } = await supabaseCommunity
      .from('sops')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw logSupabaseError('sopService.update', error)
    notifyAssignee(mapRow(data), priorAssignee)
    return { success: true, data: mapRow(data) }
  },

  /** Status-only mutation for the inline row control - gated in the component
   *  to viewers who pass the row's own UPDATE RLS (led_by_member_id match, or
   *  director/super_admin), matching §4.6. `completed_on` follows status: set
   *  to today on completion, cleared if reopened - never left stale. */
  async updateStatus(id: number, status: SopStatus) {
    const patch = {
      status,
      completed_on: status === 'completed' ? localDateISO() : null,
    }
    const { data, error } = await supabaseCommunity
      .from('sops')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw logSupabaseError('sopService.updateStatus', error)
    return { success: true, data: mapRow(data) }
  },

  /** Procedures only - "mark as run today" (§4.2's `last_run_at` signal),
   *  deliberately separate from status since a procedure's status isn't a
   *  progress bar and never "finishes". */
  async markRun(id: number) {
    const { data, error } = await supabaseCommunity
      .from('sops')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw logSupabaseError('sopService.markRun', error)
    return { success: true, data: mapRow(data) }
  },

  async remove(id: number) {
    const { error } = await supabaseCommunity.from('sops').delete().eq('id', id)
    if (error) throw logSupabaseError('sopService.remove', error)
    return { success: true }
  },
}

export const sopService = withFunctionLogging('sopService', sopServiceImpl)

export default sopService
