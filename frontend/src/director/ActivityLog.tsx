import { useEffect, useMemo, useState } from 'react'
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { withRetry } from '../lib/asyncUtils'
import {
  AdminLayout, AdminTabHeader, DataToolbar, FilterPill, EmptyLedger,
  AdminSkeleton, AdminErrorState, AdminRow,
} from './adminKit'

/**
 * `/director/activity-log` - super_admin/HR only, matching
 * `community_audit_logs`' own RLS ("Super admin can view audit logs" is its
 * only SELECT policy - a leader-privilege desk here would just show a
 * permission error, so the nav gate has to agree).
 *
 * Owner request: "an edit log page that basically logs all the functions,
 * HoDs and people are doing on the website." The write side of this has
 * existed since 2026-09-11/12 (log_action() RPC, wired into
 * approve/reject-member, approve/reject-post, and job application status
 * changes; a trigger separately logs every team_members change) - see
 * scripts/log_action_and_hr_set_member_break_2026_09_12.sql and
 * scripts/team_membership_audit_log_2026_09_11.sql. Neither file's closing
 * note was optimistic about coverage ("which actions actually call this is
 * a frontend decision" / "nothing in the app reads these rows yet") - this
 * is that reader, for whatever has been wired up to write so far. It is
 * NOT a claim that every action on the desk is logged; widening which
 * writes call logAction() is separate, ongoing work.
 *
 * `member_id` on a row is the ACTOR, not necessarily the person the action
 * was about (that's `entity_id` + `entity_type`, e.g. entity_type='member').
 * A null member_id means the write had no session behind it (a trigger
 * firing from the SQL editor or a service-role job) - shown as "system",
 * never guessed at.
 */

type LogRow = {
  log_id: number
  action: string
  entity_type: string | null
  entity_id: number | null
  details: Record<string, unknown> | null
  created_at: string | null
  member_id: number | null
  members: { full_name: string | null } | null
}

const PAGE_SIZE = 50

function fmtWhen(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  } catch { return iso }
}

/** ACTION or SOME_ACTION -> "action" / "some action" - readable without a
 *  hand-maintained label map that would drift the moment a new action name
 *  ships (this desk deliberately doesn't gatekeep which actions can appear). */
function prettyAction(action: string): string {
  return action.replace(/_/g, ' ').toLowerCase()
}

function summarizeDetails(details: Record<string, unknown> | null): string | null {
  if (!details || typeof details !== 'object') return null
  const entries = Object.entries(details).filter(([, v]) => v !== null && v !== undefined && v !== '')
  if (entries.length === 0) return null
  return entries.map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(' · ')
}

export default function ActivityLog() {
  const [rows, setRows] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState<'all' | string>('all')

  const fetchPage = async (offset: number, append: boolean) => {
    if (append) setLoadingMore(true); else { setLoading(true); setError(null) }
    try {
      const { data, error: e } = await withRetry(async () => supabaseCommunity
        .from('community_audit_logs')
        .select('log_id, action, entity_type, entity_id, details, created_at, member_id, members(full_name)')
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1))
      if (e) throw e
      const page = (data as any[] as LogRow[]) ?? []
      setRows(prev => append ? [...prev, ...page] : page)
      setHasMore(page.length === PAGE_SIZE)
    } catch (e: any) {
      // This desk is director-only diagnostic tooling - the real reason
      // (usually an RLS/permission mismatch) is exactly what a super_admin
      // reading this page needs, unlike a member-facing surface.
      console.error('[ActivityLog] load failed:', e)
      if (!append) setError(e?.message || 'Could not load the activity log.')
    } finally {
      setLoading(false); setLoadingMore(false)
    }
  }

  useEffect(() => { fetchPage(0, false) }, [])

  const actionOptions = useMemo(() => {
    const seen = new Set<string>()
    for (const r of rows) seen.add(r.action)
    return Array.from(seen).sort()
  }, [rows])

  const term = search.trim().toLowerCase()
  const filtered = useMemo(() => rows
    .filter(r => actionFilter === 'all' || r.action === actionFilter)
    .filter(r => !term
      || r.action.toLowerCase().includes(term)
      || (r.members?.full_name || '').toLowerCase().includes(term)
      || (r.entity_type || '').toLowerCase().includes(term)),
    [rows, actionFilter, term])

  return (
    <AdminLayout>
      <div style={{ paddingBottom: 80 }}>
        <AdminTabHeader
          label="Activity Log"
          title="Who did what"
          count={filtered.length}
          subtitle="Approvals, rejections, breaks and team changes, traced back to whoever made them. Only what's been wired up to log itself so far - not everything on the desk yet."
        />

        <DataToolbar search={search} onSearch={setSearch} searchPlaceholder="Search by action, person, or entity…">
          {actionOptions.length > 0 && (
            <div className="adm-hscroll">
              <FilterPill active={actionFilter === 'all'} onClick={() => setActionFilter('all')}>all</FilterPill>
              {actionOptions.map(a => (
                <FilterPill key={a} active={actionFilter === a} onClick={() => setActionFilter(a)}>{prettyAction(a)}</FilterPill>
              ))}
            </div>
          )}
        </DataToolbar>

        {loading ? (
          <AdminSkeleton rows={6} />
        ) : error ? (
          <AdminErrorState message={error} onRetry={() => fetchPage(0, false)} />
        ) : filtered.length === 0 ? (
          <EmptyLedger
            message={rows.length === 0 ? 'nothing logged yet' : 'no matches'}
            sub={rows.length === 0 ? 'actions that write to the audit log will show up here as they happen.' : 'try a different search or filter.'}
          />
        ) : (
          <>
            {filtered.map(r => {
              const detail = summarizeDetails(r.details)
              return (
                <AdminRow
                  key={r.log_id}
                  primary={prettyAction(r.action)}
                  secondary={
                    <>
                      {r.members?.full_name ?? 'system'}
                      {r.entity_type && <> · {r.entity_type}{r.entity_id != null && <> #{r.entity_id}</>}</>}
                      {detail && (
                        <div className="adm-lcard-facts">
                          <span className="adm-note mono xs">{detail}</span>
                        </div>
                      )}
                    </>
                  }
                  meta={fmtWhen(r.created_at)}
                />
              )
            })}
            {hasMore && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                <button className="btn btn-sm" disabled={loadingMore} onClick={() => fetchPage(rows.length, true)}>
                  {loadingMore ? 'loading…' : 'load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  )
}
