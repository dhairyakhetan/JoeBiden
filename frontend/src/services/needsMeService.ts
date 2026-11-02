import { supabaseCommunity } from '../lib/supabaseCommunity'
import { taskService } from './taskService'
import { dueState, relationOf } from '../tasks/taskModel'

/**
 * "What is waiting on me": one list that gathers the things the member would otherwise have to remember to look for in
 * five different places. Every row is a real, current thing with a link straight to it. Member-facing only: a leader's
 * queues (approvals, posts, hiring) live on their desk and are counted there.
 *
 *   tasks       overdue or due within 48 h where the member is the performer or supervisor   -> /tasks
 *   drive       a drive they were made lead of that is not yet completed                     -> its check-in sheet
 *   bug fix     a report of theirs marked done that they have not yet confirmed              -> /bugs
 *
 * Never throws: a source that fails simply contributes no row, so the card can only ever under-report, never break the feed.
 */
export interface NeedRow {
  key: string
  icon: string
  text: string
  to: string
  urgent?: boolean
}

const db = supabaseCommunity as any

async function taskRows(memberId: number): Promise<NeedRow[]> {
  try {
    const tasks = await taskService.list()
    let overdue = 0, soon = 0
    for (const t of tasks) {
      const rel = relationOf(t, memberId)
      if (rel !== 'performer' && rel !== 'supervisor') continue
      const d = dueState(t)
      if (d === 'overdue') overdue++
      else if (d === 'due_soon') soon++
    }
    const out: NeedRow[] = []
    if (overdue > 0) out.push({ key: 'tasks-overdue', icon: '!', urgent: true, to: '/tasks', text: `${overdue} ${overdue === 1 ? 'task is' : 'tasks are'} overdue` })
    if (soon > 0) out.push({ key: 'tasks-soon', icon: '◷', to: '/tasks', text: `${soon} ${soon === 1 ? 'task is' : 'tasks are'} due in the next two days` })
    return out
  } catch { return [] }
}

async function driveRows(memberId: number): Promise<NeedRow[]> {
  try {
    const since = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)
    const { data } = await db.from('welfare_projects')
      .select('id, header, workshop_date')
      .eq('drive_lead_member_id', memberId)
      .is('attendance_completed_at', null)
      .gte('workshop_date', since)
      .order('workshop_date', { ascending: true })
      .limit(3)
    return ((data || []) as any[]).map(d => ({
      key: `drive-${d.id}`, icon: '★', to: `/drive/${d.id}/check-in`,
      text: `You’re running ${d.header || 'a drive'}. Open the check-in sheet`,
    }))
  } catch { return [] }
}

async function bugRows(memberId: number): Promise<NeedRow[]> {
  try {
    const { count } = await db.from('bug_reports')
      .select('id', { count: 'exact', head: true })
      .eq('reporter_member_id', memberId).eq('solved', true).is('reporter_confirm', null).eq('closed_no_change', false)
    return count ? [{ key: 'bugs', icon: '✓', to: '/bugs', text: `${count === 1 ? 'A report of yours was' : `${count} reports of yours were`} marked done. Did it work?` }] : []
  } catch { return [] }
}

export async function loadNeeds(memberId: number): Promise<NeedRow[]> {
  const [a, b, c] = await Promise.all([taskRows(memberId), driveRows(memberId), bugRows(memberId)])
  return [...a, ...b, ...c]
}

export default { loadNeeds }
