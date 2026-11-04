import { supabaseCommunity } from '../lib/supabaseCommunity'
import { logSupabaseError } from '../lib/errorTracking'
import { getCachedMemberId } from '../lib/authCache'

/**
 * Grievances (handoff C-32 and C-33). Tables and rules: scripts/grievances_2026_11_03.sql.
 *
 * Who sees what is decided by the database, not here: a member can submit and see only the STATUS of their own submissions
 * (`my_grievances()`); HR and Super Admin read and work them; Directors and HoDs get zero rows; the person a grievance names
 * never sees it. Nothing in this file logs, emails or exports a grievance's text, and none of it goes into a URL.
 *
 * Service contract as everywhere: these THROW on error and the component owns the toast. Never log `description` or `note`.
 */
// The generated database types predate these tables, so the client is used untyped here (same as other newer services).
const db = supabaseCommunity as any

export type GrievanceCategory = 'harassment' | 'discrimination' | 'safety' | 'misconduct_member' | 'misconduct_leader' | 'other'
export type GrievanceStatus = 'new' | 'in_review' | 'resolved' | 'closed'

export const CATEGORY_LABEL: Record<GrievanceCategory, string> = {
  harassment: 'Harassment',
  discrimination: 'Discrimination',
  safety: 'Safety',
  misconduct_member: 'Misconduct by a member',
  misconduct_leader: 'Misconduct by a HoD or HR',
  other: 'Other',
}
export const CATEGORIES = Object.keys(CATEGORY_LABEL) as GrievanceCategory[]
export const STATUS_LABEL: Record<GrievanceStatus, string> = { new: 'New', in_review: 'In review', resolved: 'Resolved', closed: 'Closed' }

/** The promise the form makes. A grievance still new or in review after this long is marked overdue on the desk. */
export const RESPONSE_DAYS = 7

export const DESCRIPTION_MIN = 10
export const DESCRIPTION_MAX = 4000

export interface MyGrievance { id: string; createdAt: string; category: GrievanceCategory; status: GrievanceStatus; resolvedAt: string | null }

export interface GrievanceInput {
  category: GrievanceCategory
  description: string
  aboutText?: string
  incidentDate?: string
}

export interface Grievance {
  id: string
  createdAt: string
  updatedAt: string
  submitterId: number
  submitterName: string | null
  category: GrievanceCategory
  description: string
  aboutText: string | null
  incidentDate: string | null
  status: GrievanceStatus
  assignedTo: number | null
  resolutionNote: string | null
  resolvedAt: string | null
}
export interface GrievanceNote { id: number; authorId: number; authorName: string | null; note: string; createdAt: string }
export interface GrievanceAuditRow { id: number; actorName: string | null; action: string; fromStatus: string | null; toStatus: string | null; at: string }
export interface HrMember { memberId: number; fullName: string }

/** Whole days since an ISO time. */
export function daysSince(iso: string, now: number = Date.now()): number {
  return Math.floor((now - new Date(iso).getTime()) / 86_400_000)
}

/** Overdue: still new or in review after RESPONSE_DAYS. Resolved and closed are never overdue. */
export function isOverdue(g: { status: GrievanceStatus; createdAt: string }, now: number = Date.now()): boolean {
  return (g.status === 'new' || g.status === 'in_review') && daysSince(g.createdAt, now) >= RESPONSE_DAYS
}

/** A submitter-friendly problem with the form, or null when it can be sent. */
export function grievanceProblem(input: GrievanceInput): string | null {
  const text = input.description.trim()
  if (!CATEGORIES.includes(input.category)) return 'pick what this is about.'
  if (text.length < DESCRIPTION_MIN) return `tell us a little more (at least ${DESCRIPTION_MIN} characters).`
  if (text.length > DESCRIPTION_MAX) return `that is longer than ${DESCRIPTION_MAX} characters. please shorten it.`
  if (input.incidentDate && new Date(input.incidentDate).getTime() > Date.now()) return 'the date cannot be in the future.'
  return null
}

const NAME = (r: any): string | null => r?.members?.full_name ?? null

export const grievanceService = {
  async submit(input: GrievanceInput): Promise<void> {
    const memberId = await getCachedMemberId()
    if (!memberId) throw new Error('Please sign in to send this.')
    const problem = grievanceProblem(input)
    if (problem) throw new Error(problem)
    const { error } = await db.from('grievances').insert({
      submitter_id: memberId,
      category: input.category,
      description: input.description.trim(),
      about_text: input.aboutText?.trim() || null,
      incident_date: input.incidentDate || null,
    } as never)
    if (error) {
      if ((error as { code?: string }).code === '54000') throw new Error('You have sent several today. Please wait a day, or write to the HR team.')
      throw logSupabaseError('grievanceService.submit', error)
    }
  },

  /** Status only: no text comes back. */
  async listMine(): Promise<MyGrievance[]> {
    const { data, error } = await db.rpc('my_grievances' as never)
    if (error) throw logSupabaseError('grievanceService.listMine', error)
    return ((data as any[]) || []).map(r => ({ id: r.id, createdAt: r.created_at, category: r.category, status: r.status, resolvedAt: r.resolved_at ?? null }))
  },

  // ── the HR desk ──────────────────────────────────────────────────────────
  async list(): Promise<Grievance[]> {
    const { data, error } = await db
      .from('grievances')
      .select('id, created_at, updated_at, submitter_id, category, description, about_text, incident_date, status, assigned_to, resolution_note, resolved_at, members!submitter_id(full_name)')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) throw logSupabaseError('grievanceService.list', error)
    return ((data as any[]) || []).map(r => ({
      id: r.id, createdAt: r.created_at, updatedAt: r.updated_at, submitterId: r.submitter_id, submitterName: NAME(r),
      category: r.category, description: r.description, aboutText: r.about_text ?? null, incidentDate: r.incident_date ?? null,
      status: r.status, assignedTo: r.assigned_to ?? null, resolutionNote: r.resolution_note ?? null, resolvedAt: r.resolved_at ?? null,
    }))
  },

  /** The "new" count for the menu badge: head count, no text fetched. */
  async newCount(): Promise<number> {
    const { count, error } = await db.from('grievances').select('id', { count: 'exact', head: true }).eq('status', 'new')
    if (error) throw logSupabaseError('grievanceService.newCount', error)
    return count ?? 0
  },

  async notes(id: string): Promise<GrievanceNote[]> {
    const { data, error } = await db
      .from('grievance_notes').select('id, author_id, note, created_at, members!author_id(full_name)').eq('grievance_id', id).order('created_at', { ascending: true })
    if (error) throw logSupabaseError('grievanceService.notes', error)
    return ((data as any[]) || []).map(r => ({ id: r.id, authorId: r.author_id, authorName: NAME(r), note: r.note, createdAt: r.created_at }))
  },

  async audit(id: string): Promise<GrievanceAuditRow[]> {
    const { data, error } = await db
      .from('grievance_audit').select('id, actor_id, action, from_status, to_status, at, members!actor_id(full_name)').eq('grievance_id', id).order('at', { ascending: true })
    if (error) throw logSupabaseError('grievanceService.audit', error)
    return ((data as any[]) || []).map(r => ({ id: r.id, actorName: NAME(r), action: r.action, fromStatus: r.from_status ?? null, toStatus: r.to_status ?? null, at: r.at }))
  },

  async setStatus(id: string, status: GrievanceStatus): Promise<void> {
    const { data, error } = await db.from('grievances').update({ status } as never).eq('id', id).select('id')
    if (error) throw logSupabaseError('grievanceService.setStatus', error)
    if (!data || data.length === 0) throw new Error('That grievance is no longer yours to change.')
  },

  async assign(id: string, memberId: number | null): Promise<void> {
    const { data, error } = await db.from('grievances').update({ assigned_to: memberId } as never).eq('id', id).select('id')
    if (error) throw logSupabaseError('grievanceService.assign', error)
    if (!data || data.length === 0) throw new Error('That grievance is no longer yours to change.')
  },

  async setResolutionNote(id: string, note: string): Promise<void> {
    const { data, error } = await db.from('grievances').update({ resolution_note: note.trim() || null } as never).eq('id', id).select('id')
    if (error) throw logSupabaseError('grievanceService.setResolutionNote', error)
    if (!data || data.length === 0) throw new Error('That grievance is no longer yours to change.')
  },

  async addNote(id: string, note: string): Promise<void> {
    const memberId = await getCachedMemberId()
    if (!memberId) throw new Error('Please sign in again.')
    const { error } = await db.from('grievance_notes').insert({ grievance_id: id, author_id: memberId, note: note.trim() } as never)
    if (error) throw logSupabaseError('grievanceService.addNote', error)
  },

  /** HR and Super Admin, for the "assign to" list. Names and ids only. */
  async hrMembers(): Promise<HrMember[]> {
    const { data, error } = await db
      .from('members').select('member_id, full_name').in('role', ['hr', 'super_admin']).eq('status', 'active').order('full_name')
    if (error) throw logSupabaseError('grievanceService.hrMembers', error)
    return ((data as any[]) || []).map(r => ({ memberId: r.member_id, fullName: r.full_name }))
  },
}

export default grievanceService
