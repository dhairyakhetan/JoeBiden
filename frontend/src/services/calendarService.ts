import { supabaseCommunity } from '../lib/supabaseCommunity'
import { supabase } from '../lib/supabase'
import breakService, { MemberBreak } from './breakService'
import { jobOpenings, JobOpening } from '../lib/jobOpenings'
import { localDateISO } from '../lib/uiHelpers'
import { logSupabaseError } from '../lib/errorTracking'
import { withFunctionLogging } from '../lib/functionLog'

// Read-only aggregation for the /calendar surface (handoff/21 §4). Every
// query here reads data the product already has — no new tables. Per the
// service-layer contract (CLAUDE.md), these throw on error; the calling
// component wraps in try/catch.

export interface DriveEvent {
  id: number
  date: string // workshop_date, YYYY-MM-DD
  title: string
  slug: string
}

export interface BirthdayMember {
  uuid: string
  fullName: string
  month: number // 0-indexed, matches Date#getMonth()
  day: number
}

const calendarServiceImpl = {
  /** Welfare drives, past and upcoming — welfare_projects.workshop_date.
   *  Drafts excluded (never a real, happened-or-scheduled drive). */
  async getDrives(): Promise<DriveEvent[]> {
    const { data, error } = await (supabase as any)
      .from('welfare_projects')
      .select('id, header, slug, workshop_date, is_draft')
      .not('workshop_date', 'is', null)
      .or('is_draft.is.null,is_draft.eq.false')
      .order('workshop_date', { ascending: false })
      .limit(500)
    if (error) throw logSupabaseError('calendarService.getDrives', error)
    return ((data || []) as any[])
      .filter(r => !!r.workshop_date)
      .map(r => ({ id: r.id, date: r.workshop_date as string, title: r.header as string, slug: r.slug as string }))
  },

  /** The caller's own break history — member_breaks, RLS-scoped to own rows
   *  (plus leads/directors, who don't call this from the calendar). */
  async getMyBreaks(): Promise<MemberBreak[]> {
    return breakService.getMyBreakHistory()
  },

  /** Openings with a deadline — job_openings.deadline. SOP goal due dates are
   *  out of scope (that desk has no UI yet). Includes closed/paused openings
   *  too, since a past deadline is still real calendar history. */
  async getDeadlines(): Promise<JobOpening[]> {
    const all = await jobOpenings.getAllIncludeDeleted()
    return all.filter(o => !!o.deadline && o.status !== 'deleted')
  },

  /**
   * The single nearest upcoming drive (workshop_date >= today). Null when
   * there isn't one — a caller must render nothing extra, not a fabricated
   * link.
   *
   * HAS NO CALLER as of 2026-09-11, deliberately. HomePage briefly used it to
   * fill the home grid's drive tile (item 2.2, replacing a headline over an
   * empty field); the owner then decided the upcoming-drive feature will not
   * be used for now (item 7.3), so the fetch was removed and that tile is
   * unconditionally the archive.
   *
   * Kept rather than deleted: it is correct, indexed, and one line from being
   * useful again the day drives start being scheduled ahead of time. Counted
   * live when it was removed: 558 drives, latest workshop_date 2026-09-05,
   * ZERO ahead of today - which is why it returned null every time.
   */
  async getNextUpcomingDrive(): Promise<DriveEvent | null> {
    // Local date, not UTC - see lib/uiHelpers.localDateISO.
    const todayIso = localDateISO()
    const { data, error } = await (supabase as any)
      .from('welfare_projects')
      .select('id, header, slug, workshop_date, is_draft')
      .gte('workshop_date', todayIso)
      .or('is_draft.is.null,is_draft.eq.false')
      .order('workshop_date', { ascending: true })
      .limit(1)
    if (error) throw logSupabaseError('calendarService.getNextUpcomingDrive', error)
    const row = (data || [])[0] as any
    if (!row) return null
    return { id: row.id, date: row.workshop_date, title: row.header, slug: row.slug }
  },

  /** Other members' birthdays, opt-in only (birthday_public = true). The
   *  viewer's OWN birthday is not included here — the caller already has it
   *  from useAuth().member and merges it in, since it must show regardless
   *  of birthday_public. */
  async getPublicBirthdays(): Promise<BirthdayMember[]> {
    const { data, error } = await supabaseCommunity
      .from('members')
      .select('uuid, full_name, birthday')
      .eq('birthday_public', true)
      .eq('status', 'active')
      .not('birthday', 'is', null)
      .limit(2000)
    if (error) throw logSupabaseError('calendarService.getPublicBirthdays', error)
    return ((data || []) as any[])
      .filter(r => !!r.birthday)
      .map(r => {
        const d = new Date(r.birthday + 'T00:00:00')
        return { uuid: r.uuid as string, fullName: r.full_name as string, month: d.getMonth(), day: d.getDate() }
      })
  },
}

export const calendarService = withFunctionLogging('calendarService', calendarServiceImpl)

export default calendarService
