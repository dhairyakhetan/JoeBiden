import { supabaseCommunity } from './supabaseCommunity'
import { getCachedMemberId } from './authCache'
import { hasLeaderAccess } from './roles'
import { notificationService } from '../services/notificationService'
import { withRetry } from './asyncUtils'
import { logAction } from './auditLog'
import { ACCEPT_BLOCKED_MESSAGE } from './applicantGate'
import { logSupabaseError } from './errorTracking'
import { withFunctionLogging } from './functionLog'

export type OpeningStatus = 'open' | 'paused' | 'closed' | 'deleted'

export type CustomQuestionType = 'text' | 'textarea' | 'file' | 'video' | 'url' | 'select'
export interface CustomQuestion {
  id: string
  label: string
  type: CustomQuestionType
  required: boolean
  // Short helper text shown under the label on the Apply form, e.g.
  // "PDF preferred, max one page." Optional - old questions predate this
  // field and just render without a hint.
  hint?: string
  // Only used by type === 'select' - the choices an applicant picks from.
  options?: string[]
}
// Keyed by CustomQuestion.id - text/textarea answers store the raw string,
// file answers store the uploaded file's public URL (see
// scripts/job_openings_custom_application_form_2026_07.sql).
export type CustomAnswers = Record<string, string>

export interface JobOpening {
  id: string
  title: string
  description: string
  category: string
  teamName?: string
  /**
   * The real FK to `teams`, added to this type 2026-09-11 for the Hiring
   * desk's team scope (item 6.1). `select('*')` has always returned it; only
   * `team_name` was ever mapped, and that string match was already failing on
   * 40% of live rows (see the note at getApplicationsForOpenings). Undefined on
   * an opening created before the column existed, which the scope treats as
   * out of every team's scope rather than in all of them.
   */
  teamId?: number
  skills: string[]
  commitment?: string
  deadline?: string
  status: OpeningStatus
  closedAt?: string
  deletedAt?: string
  createdByName: string
  createdByRole: string
  createdAt: string
  linkedPostId?: string
  customQuestions?: CustomQuestion[]
}

export const ALLOWED_TRANSITIONS: Record<OpeningStatus, OpeningStatus[]> = {
  open:    ['paused', 'closed', 'deleted'],
  paused:  ['open',   'closed', 'deleted'],
  closed:  ['deleted'],
  deleted: [],
}

function mapRow(row: any): JobOpening {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    teamName: row.team_name ?? undefined,
    teamId: typeof row.team_id === 'number' ? row.team_id : undefined,
    skills: row.skills || [],
    commitment: row.commitment ?? undefined,
    deadline: row.deadline ?? undefined,
    status: row.status as OpeningStatus,
    closedAt: row.closed_at ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
    createdByName: row.created_by_name,
    createdByRole: row.created_by_role,
    createdAt: row.created_at,
    linkedPostId: row.linked_post_id ?? undefined,
    customQuestions: row.custom_questions || [],
  }
}

function canTransition(from: OpeningStatus, to: OpeningStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}

// Retry wrapper for the read paths that feed full-page opening/application
// lists. Before this, getAll/getOpen/getApplications caught their own Supabase
// error and returned `[]` - so a transient failure right after a cold page
// load (before the client's session/token machinery has settled) rendered the
// Hiring/Opportunities page empty with no way to recover short of a full
// browser refresh.
//
// The critical subtlety (learned the hard way in AuthContext.fetchMember): the
// cold-load failure mode is usually NOT a thrown error - it's a request that
// *hangs*. supabase-js acquires a navigator lock to restore/refresh the
// session before its first request; if that stalls, the query promise never
// resolves and never rejects. A plain try/catch retry is useless against that:
// there's nothing to catch, `.then` never fires, and the list sits blank
// forever. So each attempt races a timeout - a hung attempt rejects, which
// lets the retry actually run (by which point the session is warm and the
// second attempt returns instantly). A genuine failure still throws after the
// retries are spent, so the caller can keep whatever was already on screen.
let openCache: { at: number; promise: Promise<JobOpening[]> } | null = null

// The auto-pause sweep in getAll/fetchOpenFresh is a *write* - anon visitors
// and plain members shouldn't be issuing UPDATEs from a read path (RLS blocks
// them anyway, producing noisy failed requests). Only leaders sweep; everyone
// else gets expired openings filtered/re-labelled client-side.
async function currentMemberIsLeader(): Promise<boolean> {
  try {
    const memberId = await getCachedMemberId()
    if (!memberId) return false
    const { data } = await supabaseCommunity
      .from('members')
      .select('role')
      .eq('member_id', memberId)
      .single()
    return hasLeaderAccess(data?.role)
  } catch {
    return false
  }
}


// Last open-roles list, kept for the tab's lifetime so a repeat visit paints at once and the fresh fetch swaps
// it in. Expired deadlines are dropped on read, so a stale list never shows a role that has closed.
const OPEN_STALE_KEY = 'aq_open_roles_v1'
const OPEN_STALE_MS = 10 * 60_000

function writeOpenStale(rows: JobOpening[]): void {
  try { sessionStorage.setItem(OPEN_STALE_KEY, JSON.stringify({ at: Date.now(), rows })) } catch { /* storage unavailable */ }
}

/** The last open list from this tab, or null. Synchronous, never touches the network. */
function peekOpen(): JobOpening[] | null {
  try {
    const raw = sessionStorage.getItem(OPEN_STALE_KEY)
    if (!raw) return null
    const { at, rows } = JSON.parse(raw) as { at: number; rows: JobOpening[] }
    if (!Array.isArray(rows) || Date.now() - at > OPEN_STALE_MS) return null
    const now = new Date()
    return rows.filter(o => !(o.deadline && new Date(o.deadline) < now))
  } catch {
    return null
  }
}

/** Pause openings whose deadline has passed. Leaders only; failures are ignored (the next load tries again). */
async function sweepExpired(ids?: string[]): Promise<void> {
  try {
    if (!(await currentMemberIsLeader())) return
    const q = supabaseCommunity.from('job_openings').update({ status: 'paused' })
    await (ids ? q.in('id', ids) : q.eq('status', 'open').lt('deadline', new Date().toISOString()))
  } catch { /* the filter on read already hides them */ }
}

const jobOpeningsImpl = {
  async getAll(): Promise<JobOpening[]> {
    return withRetry(async () => {
      const { data, error } = await supabaseCommunity
        .from('job_openings')
        .select('*')
        .neq('status', 'deleted')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw logSupabaseError('jobOpenings.getAll', error)
      // Auto-pause expired open openings. The UPDATE is a side-effect write on
      // a read path - only issue it when the caller actually has leader access;
      // everyone still *sees* the expired ones as paused via the map below.
      // It runs after the rows are in hand and is not awaited: the list never
      // waits on a members lookup and an UPDATE it does not depend on.
      const now = new Date()
      const toUpdate = (data || []).filter(o => o.status === 'open' && o.deadline && new Date(o.deadline) < now)
      if (toUpdate.length > 0) void sweepExpired(toUpdate.map(o => o.id))
      return (data || []).map(o => mapRow({ ...o, status: toUpdate.find(u => u.id === o.id) ? 'paused' : o.status }))
    })
  },

  async getAllIncludeDeleted(): Promise<JobOpening[]> {
    return withRetry(async () => {
      const { data, error } = await supabaseCommunity
        .from('job_openings')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw logSupabaseError('jobOpenings.getAllIncludeDeleted', error)
      return (data || []).map(mapRow)
    })
  },

  peekOpen,

  async getOpen(): Promise<JobOpening[]> {
    // The homepage rail and OpeningsStrip both call this on the same render -
    // share one in-flight/recent result so a single visit costs one sweep +
    // one select instead of four requests. 30s is well under how often
    // openings actually change.
    const now = Date.now()
    if (openCache && now - openCache.at < 30_000) return openCache.promise
    const promise = this.fetchOpenFresh()
    openCache = { at: now, promise }
    promise.catch(() => { openCache = null }) // don't cache failures
    return promise
  },

  async fetchOpenFresh(): Promise<JobOpening[]> {
    return withRetry(async () => {
      const { data, error } = await supabaseCommunity
        .from('job_openings')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw logSupabaseError('jobOpenings.fetchOpenFresh', error)
      // Filter deadline-expired rows client-side for everyone, so anon users
      // (whose sessions never run the sweep) don't see expired openings as open.
      const now = new Date()
      const rows = (data || [])
        .map(mapRow)
        .filter(o => !(o.deadline && new Date(o.deadline) < now))
      // Auto-pause the expired ones - leaders only, after the read, not awaited
      // (a write on a read path; the filter above already hides them for
      // everyone, so nothing here waits on it).
      if ((data || []).length !== rows.length) void sweepExpired()
      writeOpenStale(rows)
      return rows
    })
  },

  async getById(id: string): Promise<JobOpening | undefined> {
    const { data, error } = await supabaseCommunity
      .from('job_openings')
      .select('*')
      .eq('id', id)
      .single()
    if (error || !data) return undefined
    return mapRow(data)
  },

  async getByPostId(postId: string): Promise<JobOpening | undefined> {
    // maybeSingle, not single - most posts have NO linked opening, and
    // .single() emits a 406 on the zero-row case (every feed card used to
    // trigger one). maybeSingle returns null cleanly.
    const { data, error } = await supabaseCommunity
      .from('job_openings')
      .select('*')
      .eq('linked_post_id', postId)
      .maybeSingle()
    if (error || !data) return undefined
    return mapRow(data)
  },

  // Batch variant - fetch all openings linked to a set of posts in ONE
  // query, returned as a Map keyed by linked_post_id. Lets feed lists
  // resolve every card's linked-opening up front instead of one query
  // per card (the per-card N+1). Posts with no opening are simply absent
  // from the map.
  async getByPostIds(postIds: string[]): Promise<Map<string, JobOpening>> {
    const out = new Map<string, JobOpening>()
    if (!postIds.length) return out
    const { data, error } = await supabaseCommunity
      .from('job_openings')
      .select('*')
      .in('linked_post_id', postIds)
    if (error || !data) return out
    for (const row of data) {
      const mapped = mapRow(row)
      if ((row as any).linked_post_id) out.set((row as any).linked_post_id, mapped)
    }
    return out
  },

  /**
   * The `teams.team_id` for a team name, or null when no active team has exactly that name.
   *
   * Report 875f0da1: `create` and `update` only ever wrote `team_name`, so almost every opening had a NULL
   * `team_id`. The apply notification finds a team's leads by name (so the HoD was told about the
   * application), but the Hiring desk scopes by `team_id` (`scopeToMyTeams` hides an opening with none), so the
   * same HoD then saw no responses. Writing both keeps the two in step; a name that matches no team stays null
   * (unscoped: super admin and HR still see it) rather than guessing.
   */
  async teamIdForName(teamName?: string | null): Promise<number | null> {
    const name = teamName?.trim()
    if (!name) return null
    const { data, error } = await supabaseCommunity
      .from('teams').select('team_id').eq('name', name).eq('is_active', true).maybeSingle()
    if (error) throw logSupabaseError('jobOpenings.teamIdForName', error)
    return typeof data?.team_id === 'number' ? data.team_id : null
  },

  async create(data: Omit<JobOpening, 'id' | 'createdAt' | 'status'>): Promise<JobOpening> {
    const teamId = await this.teamIdForName(data.teamName)
    // Cast: custom_questions predates the generated database.types (see
    // scripts/job_openings_custom_application_form_2026_07.sql) - same
    // as-any pattern used for post_documents elsewhere in this codebase.
    const { data: row, error } = await (supabaseCommunity as any)
      .from('job_openings')
      .insert({
        title: data.title,
        description: data.description,
        category: data.category,
        team_name: data.teamName,
        team_id: teamId,
        skills: data.skills,
        commitment: data.commitment,
        deadline: data.deadline,
        created_by_name: data.createdByName,
        created_by_role: data.createdByRole,
        linked_post_id: data.linkedPostId,
        custom_questions: data.customQuestions ?? [],
        status: 'open',
      })
      .select()
      .single()
    if (error) throw logSupabaseError('jobOpenings.create', error)
    return mapRow(row)
  },

  async update(id: string, patch: Partial<JobOpening>): Promise<void> {
    const updateData: any = {}
    if (patch.title !== undefined) updateData.title = patch.title
    if (patch.description !== undefined) updateData.description = patch.description
    if (patch.category !== undefined) updateData.category = patch.category
    if (patch.teamName !== undefined) {
      updateData.team_name = patch.teamName
      updateData.team_id = await this.teamIdForName(patch.teamName)
    }
    if (patch.skills !== undefined) updateData.skills = patch.skills
    if (patch.commitment !== undefined) updateData.commitment = patch.commitment
    if (patch.deadline !== undefined) updateData.deadline = patch.deadline
    if (patch.status !== undefined) updateData.status = patch.status
    if (patch.closedAt !== undefined) updateData.closed_at = patch.closedAt
    if (patch.deletedAt !== undefined) updateData.deleted_at = patch.deletedAt
    if (patch.customQuestions !== undefined) updateData.custom_questions = patch.customQuestions
    // `.select()` so an RLS-blocked (or otherwise no-op) write surfaces as a
    // real error instead of silently doing nothing - PostgREST returns no
    // error + zero rows when a write matches nothing.
    const { data, error } = await supabaseCommunity.from('job_openings').update(updateData).eq('id', id).select('id')
    if (error) throw logSupabaseError('jobOpenings.update', error)
    if (!data || data.length === 0) throw new Error("Couldn't update this opening - you may not have permission.")
  },

  async transition(id: string, to: OpeningStatus): Promise<void> {
    const current = await this.getById(id)
    if (!current) throw new Error('Opening not found')
    if (!canTransition(current.status, to)) {
      throw new Error(`Transition ${current.status} → ${to} not allowed`)
    }
    const patch: any = { status: to }
    if (to === 'closed')  patch.closed_at  = new Date().toISOString()
    if (to === 'deleted') patch.deleted_at = new Date().toISOString()
    const { data, error } = await supabaseCommunity.from('job_openings').update(patch).eq('id', id).select('id')
    if (error) throw logSupabaseError('jobOpenings.transition', error)
    if (!data || data.length === 0) throw new Error("Couldn't update this opening - you may not have permission.")
  },

  async pause(id: string)   { await this.transition(id, 'paused') },
  async resume(id: string)  { await this.transition(id, 'open') },
  async close(id: string)   { await this.transition(id, 'closed') },
  async delete_(id: string) { await this.transition(id, 'deleted') },

  async createFromPost(
    postId: string,
    data: Omit<JobOpening, 'id' | 'createdAt' | 'status' | 'linkedPostId'>
  ): Promise<JobOpening> {
    return this.create({ ...data, linkedPostId: postId })
  },

  async apply(openingId: string, applicantId: number, applicantName: string, applicantEmail: string, message: string, customAnswers?: CustomAnswers, applicantPhone?: string): Promise<{ success: boolean; alreadyApplied?: boolean; error?: string }> {
    try {
      const { error } = await (supabaseCommunity as any).from('job_applications').insert({
        opening_id: openingId,
        applicant_id: applicantId,
        applicant_name: applicantName,
        applicant_email: applicantEmail,
        applicant_phone: applicantPhone?.trim() || null,
        message: message.trim() || null,
        custom_answers: customAnswers ?? {},
      })
      if (error) {
        if (error.code === '23505') return { success: false, alreadyApplied: true }
        return { success: false, error: error.message }
      }

      // Tell whoever owns this opening a new application landed. job_openings
      // stores no creator member_id (only created_by_name text), so resolve
      // recipients as data allows: the linked team's leads (via team_name),
      // falling back to a unique full_name match on created_by_name.
      // `team_join_request` is the one recipient-arbitrary type the
      // create_notification RPC allows a plain member to send. Fire-and-forget.
      ;(async () => {
        try {
          const { data: opening } = await supabaseCommunity
            .from('job_openings')
            .select('title, team_name, created_by_name')
            .eq('id', openingId)
            .single()
          if (!opening) return

          let recipientIds: number[] = []
          if (opening.team_name) {
            const { data: team } = await supabaseCommunity
              .from('teams').select('team_id').eq('name', opening.team_name).maybeSingle()
            if (team) {
              const { data: leads } = await supabaseCommunity
                .from('team_members')
                .select('member_id')
                .eq('team_id', team.team_id)
                .eq('role', 'lead')
                .eq('is_active', true)
              recipientIds = (leads || []).map(l => l.member_id)
            }
          }
          if (recipientIds.length === 0 && opening.created_by_name) {
            const { data: creators } = await supabaseCommunity
              .from('members')
              .select('member_id')
              .eq('full_name', opening.created_by_name)
              .limit(2)
            if (creators && creators.length === 1) recipientIds = [creators[0].member_id]
          }

          await Promise.all(recipientIds.map(memberId =>
            notificationService.create({
              memberId,
              type: 'team_join_request',
              title: `${applicantName} applied for ${opening.title}`,
              subtitle: message?.trim() ? message.trim().slice(0, 140) : 'New application received.',
              link: '/director/hiring',
            })
          ))
        } catch (e: any) {
          console.warn('[jobOpenings] apply notification failed:', e?.message)
        }
      })()

      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  },

  async hasApplied(openingId: string, applicantId: number): Promise<boolean> {
    const { data } = await (supabaseCommunity as any).from('job_applications')
      .select('id').eq('opening_id', openingId).eq('applicant_id', applicantId).maybeSingle()
    return !!data
  },

  // `applicant:members!applicant_id(status)` is joined so a desk can tag an application whose applicant's OWN account
  // is not approved yet (lib/applicantGate.ts). Applying is possible before approval, and since 2026-11-01 those
  // applications are shown, tagged, instead of hidden. Accepting one is still refused: see updateApplicationStatus.
  async getApplications(openingId: string): Promise<any[]> {
    return withRetry(async () => {
      const { data, error } = await (supabaseCommunity as any).from('job_applications')
        .select('*, applicant:members!applicant_id(status)')
        .eq('opening_id', openingId)
        .order('created_at', { ascending: false })
      if (error) throw logSupabaseError('jobOpenings.getApplications', error)
      return data || []
    })
  },

  // Batched sibling of getApplications - fetches applications for MANY openings
  // in ONE query and groups them by opening_id. Replaces the N+1 pattern of
  // mapping getApplications over an openings array (HiringResponses desk, the
  // team detail Responses tab), turning N round-trips into 1.
  async getApplicationsForOpenings(openingIds: string[]): Promise<Record<string, any[]>> {
    const grouped: Record<string, any[]> = {}
    for (const id of openingIds) grouped[id] = []
    if (openingIds.length === 0) return grouped
    return withRetry(async () => {
      const { data, error } = await (supabaseCommunity as any).from('job_applications')
        .select('*, applicant:members!applicant_id(status)')
        .in('opening_id', openingIds)
        .order('created_at', { ascending: false })
      if (error) throw logSupabaseError('jobOpenings.getApplicationsForOpenings', error)
      for (const row of (data || [])) {
        // Not filtered by the applicant's account status any more (see lib/applicantGate.ts): the row carries
        // `applicant.status` and the desks tag it.
        ;(grouped[row.opening_id] ||= []).push(row)
      }
      return grouped
    })
  },

  // Slim sibling of getApplicationsForOpenings for the "did I already apply"
  // check (TeamDetailPage's Openings tab) - that call only needs a
  // opening_id/applicant_id boolean set, not select('*') on every applicant's
  // row (including custom_answers JSON and contact fields) for every opening.
  // RLS already scopes SELECT to the caller's own applications for non-leader
  // viewers; the explicit .eq keeps a leader viewer's result correctly scoped
  // to "openings this member himself applied to" rather than every applicant.
  async getMyApplicationOpeningIds(openingIds: string[], applicantMemberId: number): Promise<Set<string>> {
    if (openingIds.length === 0) return new Set()
    return withRetry(async () => {
      const { data, error } = await (supabaseCommunity as any).from('job_applications')
        .select('opening_id')
        .in('opening_id', openingIds)
        .eq('applicant_id', applicantMemberId)
      if (error) throw logSupabaseError('jobOpenings.getMyApplicationOpeningIds', error)
      return new Set((data || []).map((row: any) => row.opening_id as string))
    })
  },

  async updateApplicationStatus(applicationId: string, status: 'pending'|'reviewed'|'accepted'|'rejected', rejectionReason?: string): Promise<void> {
    // .select('id') + zero-row guard so an RLS-blocked (or no-match) write
    // surfaces as a real error instead of a silent no-op the UI treats as success
    // — matching update()/transition() in this file.
    // Accepting someone whose own account is not approved yet is still refused (lib/applicantGate.ts): the desks show
    // those applications, tagged, but an HoD should not clear a person the org has not cleared. Checked here so every
    // screen is covered, including bulk actions.
    if (status === 'accepted') {
      const { data: who, error: whoErr } = await (supabaseCommunity as any)
        .from('job_applications')
        .select('applicant:members!applicant_id(status)')
        .eq('id', applicationId)
        .maybeSingle()
      if (whoErr) throw logSupabaseError('jobOpenings.updateApplicationStatus', whoErr)
      if (who && who.applicant?.status !== 'active') throw new Error(ACCEPT_BLOCKED_MESSAGE)
    }
    const patch: Record<string, unknown> = { status }
    // Only written on an actual rejection, and never cleared on a later
    // status change - it's a record of why THIS rejection happened, not a
    // live field that should blank out if someone re-reviews the applicant.
    if (status === 'rejected' && rejectionReason?.trim()) patch.rejection_reason = rejectionReason.trim()
    const { data, error } = await (supabaseCommunity as any)
      .from('job_applications')
      .update(patch)
      .eq('id', applicationId)
      .select('id, applicant_id, opening_id')
    if (error) throw logSupabaseError('jobOpenings.updateApplicationStatus', error)
    if (!data || data.length === 0) throw new Error("Couldn't update this application: you may not have permission.")
    // job_applications.id is a uuid, so the row is keyed by entity_uuid (entity_id is an integer).
    logAction('job_application_status_changed', 'job_application', undefined, {
      applicantId: data[0].applicant_id, openingId: data[0].opening_id, status,
    }, data[0].id ?? applicationId)

    // Tell the applicant when a decision lands (not for pending/reviewed
    // shuffles). Callers are leaders, so the leader-gated `system` type works.
    // Fire-and-forget - never blocks the status write.
    // ACCEPTED ALSO PUTS THEM ON THE TEAM.
    //
    // This used to only send a notification saying "The team will reach out
    // with next steps" — no team_members row was ever written. The accepted
    // member sat in limbo: told they were in, absent from the roster, and the
    // lead had to remember to go to a different tab and add them by hand.
    //
    // Joins on job_openings.team_id (a real FK as of 2026-09-02), never on
    // team_name — that string match was already failing on 40% of live rows
    // ("Socials" != "Social Media", plus a NULL).
    //
    // Awaited, not fire-and-forget: being on the roster IS the acceptance, so
    // if it fails the caller should hear about it. Duplicate-safe via upsert,
    // so re-accepting is a no-op rather than an error.
    if (status === 'accepted') {
      const { applicant_id, opening_id } = data[0]
      const { data: opening } = await (supabaseCommunity as any)
        .from('job_openings').select('team_id').eq('id', opening_id).single()
      if (opening?.team_id) {
        const { error: rosterErr } = await (supabaseCommunity as any)
          .from('team_members')
          .upsert(
            { team_id: opening.team_id, member_id: applicant_id, role: 'member', is_active: true },
            { onConflict: 'team_id,member_id', ignoreDuplicates: true },
          )
        if (rosterErr) {
          throw new Error(
            `Accepted, but couldn't add them to the team: ${rosterErr.message}. Add them from the team's Members tab.`,
          )
        }
      }
    }

    if (status === 'accepted' || status === 'rejected') {
      const { applicant_id, opening_id } = data[0]
      ;(async () => {
        try {
          const { data: opening } = await supabaseCommunity
            .from('job_openings').select('title').eq('id', opening_id).single()
          const title = opening?.title ? `"${opening.title}"` : 'an opening'
          await notificationService.create({
            memberId: applicant_id,
            type: 'system',
            title: status === 'accepted'
              ? `Your application for ${title} was accepted`
              : `Your application for ${title} was not selected`,
            // Accepted members are now actually ON the roster (above), so say
            // so rather than "the team will reach out" — which was the only
            // thing that used to happen.
            subtitle: status === 'accepted'
              ? "You're on the team. Find it under Teams."
              : (rejectionReason?.trim() || 'Thanks for applying - keep an eye out for future openings.'),
            // /opportunities is a list of OTHER people's open roles, which is
            // the wrong place to land someone reading about their own
            // application. Send the accepted member to their teams; leave the
            // rejected one on the openings list, where re-applying is the
            // useful next step.
            link: status === 'accepted' ? '/teams' : '/opportunities',
          })
        } catch (e: any) {
          console.warn('[jobOpenings] application-status notification failed:', e?.message)
        }
      })()
    }
  },
}

export const jobOpenings = withFunctionLogging('jobOpenings', jobOpeningsImpl)

// One hue per vertical - must stay in sync with the --c-* category tokens in styles/v6.css.
export const CAT_COLORS: Record<string, string> = {
  events:     'var(--sky)',
  welfare:    'var(--welfare)',
  labs:       'var(--lemon)',
  operations: 'var(--teal)',
  content:    'var(--grape)',
}

// audit-ok: Pop mint/orange as status FILLS - OpportunitiesPage mixes them to
// 22% behind ink text, so they are never a text colour.
export const STATUS_COLORS: Record<OpeningStatus, string> = {
  open:    '#00E5A0',
  paused:  '#FFC700',
  closed:  '#FF7A1A',
  deleted: 'var(--danger)',
}

export const STATUS_LABELS: Record<OpeningStatus, string> = {
  open:    'Open',
  paused:  'Paused',
  closed:  'Closed',
  deleted: 'Deleted',
}
