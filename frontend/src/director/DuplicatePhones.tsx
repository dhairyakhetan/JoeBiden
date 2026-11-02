import { useEffect, useMemo, useState } from 'react'
import directorService from '../services/directorService'
import { useToast } from '../components/Toast'
import {
  DataToolbar, EmptyLedger, AdminSkeleton, AdminRow, AdminErrorState,
} from './adminKit'
import {
  groupDuplicatePhones, matchesDuplicateSearch,
  type DuplicatePhoneGroup, type DuplicatePhoneRow,
} from '../lib/duplicatePhones'

/**
 * Accounts that share a phone number, for HR and super admin (owner, 2 Nov
 * 2026). Mounted as a tab of the Approvals desk, which is already gated to
 * exactly those two roles, and the RPC re-checks the role itself, so a stale
 * tab or a hand-typed call by anyone else gets an error, not data.
 *
 * Phones and emails are shown in full on purpose (owner decision).
 */
export default function DuplicatePhones() {
  const toast = useToast()
  const [rows, setRows] = useState<DuplicatePhoneRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true); setError(null)
    try {
      setRows(await directorService.getDuplicatePhoneRows())
    } catch (err: any) {
      const msg = err?.message || 'Something went wrong.'
      setError(msg)
      toast.error(`Could not load duplicate phones - ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [])

  const groups = useMemo<DuplicatePhoneGroup[]>(() => groupDuplicatePhones(rows), [rows])
  const shown = useMemo(() => groups.filter(g => matchesDuplicateSearch(g, search)), [groups, search])

  return (
    <>
      <DataToolbar search={search} onSearch={setSearch} searchPlaceholder="Search name, email or number…" />

      {error ? (
        <AdminErrorState message={`Could not load duplicate phones - ${error}`} onRetry={load} />
      ) : loading ? (
        <AdminSkeleton rows={5} />
      ) : groups.length === 0 ? (
        <EmptyLedger
          message="no shared phone numbers"
          sub="Every live account has its own number."
        />
      ) : shown.length === 0 ? (
        <EmptyLedger message="nothing matches that search" sub="Try a name, an email or part of a number." />
      ) : (
        shown.map(group => (
          <section key={group.phoneKey} style={{ marginBottom: 20 }} aria-label={`Accounts sharing ${group.phoneKey}`}>
            <div className="mono xs upper" style={{ fontWeight: 700, margin: '0 0 6px', color: 'var(--ink-3)' }}>
              {group.members[0].phone} · {group.members.length} accounts
            </div>
            {group.members.map(m => (
              <AdminRow
                key={m.memberId}
                primary={<span>{m.fullName || 'no name yet'}</span>}
                secondary={
                  <>
                    {m.email}
                    {m.phone && <> · {m.phone}</>}
                    {m.classGrade && <> · {m.classGrade}</>}
                  </>
                }
                meta={<>{m.status.replace(/_/g, ' ')}</>}
              />
            ))}
          </section>
        ))
      )}
    </>
  )
}
