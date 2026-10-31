import { useEffect, useState } from 'react'
import sopService, { type Sop } from '../services/sopService'
import { useToast } from '../components/Toast'
import { localDateISO } from '../lib/uiHelpers'

/**
 * The tasks assigned to you — walkthrough item 7.4, "SOPs/Goals hydrated
 * across people: assigning a task shows up for the assignee".
 * ────────────────────────────────────────────────────────────────────────────
 * The desk could already set `sops.led_by_member_id`, and NOTHING anywhere
 * read it back for the person it pointed at. There was no "my tasks" query in
 * the codebase at all, and there could not have been one: `sops`' SELECT
 * policy admitted directors, super admins and members of the task's own
 * department, but not the assignee. Verified live on 2026-09-11 - a welfare
 * goal assigned to a member outside welfare returned zero rows to them while
 * still letting them UPDATE it. The migration
 * `sops_assignee_can_see_own_task` makes SELECT agree with UPDATE.
 *
 * This card is the "go and look" half. The notification fired from
 * `sopService` on assignment is the half that arrives on its own; neither is
 * sufficient alone.
 *
 * RENDERS NOTHING when there are no open tasks. A permanently empty "your
 * tasks" card on every member's profile would be the same defect as the home
 * page's retired points tile - a promise the data cannot keep. Live today
 * `sops` holds 0 rows, so this is invisible for everyone until the desk is
 * used, which is the correct behaviour rather than a placeholder.
 */
export default function MyTasksCard() {
  const { error: toastError } = useToast()
  const [tasks, setTasks] = useState<Sop[] | null>(null)
  const [busy, setBusy] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    sopService.getMine()
      .then(r => { if (!cancelled) setTasks(r.data) })
      // Silent: an unreachable task list must not put an error banner on a
      // profile page whose main job is unrelated. The card just stays hidden.
      .catch(() => { if (!cancelled) setTasks([]) })
    return () => { cancelled = true }
  }, [])

  const markDone = async (t: Sop) => {
    setBusy(t.id)
    try {
      await sopService.updateStatus(t.id, 'completed')
      setTasks(prev => (prev || []).filter(x => x.id !== t.id))
    } catch (e: any) {
      toastError('couldn’t mark that done.', e?.message ?? 'try again.')
    } finally {
      setBusy(null)
    }
  }

  if (!tasks || tasks.length === 0) return null

  // The viewer's own date, not the UTC one: in IST the UTC slice reads a day
  // early until 05:30, which marked a task due today as already overdue.
  const today = localDateISO()

  return (
    <section className="card" style={{ padding: 18, marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <h2 className="h-display" style={{ fontSize: 20, margin: 0 }}>on you</h2>
        <span className="mono small muted">{tasks.length} open</span>
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tasks.map(t => {
          // Overdue is a fact about the date, not a styling flourish - it is
          // the one thing that changes what you should do about the task next.
          const overdue = !!t.dueOn && t.dueOn < today
          return (
            <li
              key={t.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                paddingBottom: 10, borderBottom: 'var(--hair)',
              }}
            >
              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.25 }}>{t.task}</div>
                <div className="mono small muted" style={{ marginTop: 3 }}>
                  {t.departmentSlug}
                  {t.kind === 'goal' && t.urgency ? ` · ${t.urgency}` : ''}
                  {t.dueOn ? ' · ' : ''}
                  {t.dueOn && (
                    <span style={overdue ? { color: 'var(--tomato-ink)', fontWeight: 700 } : undefined}>
                      {overdue ? 'overdue ' : 'due '}{t.dueOn}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => markDone(t)}
                disabled={busy === t.id}
                style={{ flex: 'none', minHeight: 44 }}
                aria-label={`Mark "${t.task}" done`}
              >
                {busy === t.id ? '…' : 'done'}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
