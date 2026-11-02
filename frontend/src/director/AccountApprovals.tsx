import Img from '../components/Img'
import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import directorService, { PendingMember, RejectedMember, isAlreadyDecided } from '../services/directorService'
import { cursorFromLast, appendUnique } from '../services/keysetCursor'
import {
  useModalA11y,
  AdminLayout, AdminTabHeader, DataToolbar, FilterPill, EmptyLedger,
  AdminSkeleton, AdminRow, AdminErrorState, BulkActionBar,
  useRowSelection, useUndoableAction,
} from './adminKit'
import { useToast } from '../components/Toast'
import { useCan } from '../auth/CapabilityContext'
import { useAuth } from '../auth/AuthContext'
import { isSuperAdmin as isSuperAdminRole } from '../lib/roles'
import { I } from '../components/v6Shared'
import { ChevronDownIcon, ChevronUpIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { getInitials, hashColor } from '../lib/uiHelpers'
import DuplicatePhones from './DuplicatePhones'
import { createRequestTokens } from './memberDirectoryRules'
import {
  SEARCH_DEBOUNCE_MS, buildFilters, contactedFilterForView, headerCount, isFiltered, mergeGrades, normalizeGrade,
} from './accountApprovalsQuery'
// `.adm-sort` lives here (shared admin-desk primitive, despite the filename -
// TeamManagement/MemberOfMonth/CategoryManagement already reuse it the same
// way MemberDirectory does), not in a dedicated AccountApprovals stylesheet.
import '../styles/routes/director-people.css'

/**
 * Section 18 - the disclosure affordance, made real.
 *
 * Source appended `why they joined ▾` to the END of the secondary line, after
 * an email, a phone number and a class grade, so the only cue that a row opens
 * was a fragment of a run-on sentence. Both word pairs are frozen and reused
 * here verbatim; only the shape changes.
 */
function Disclose({ open, onToggle, openLabel, closeLabel }: {
  open: boolean
  onToggle: () => void
  openLabel: string
  closeLabel: string
}) {
  return (
    <button
      type="button"
      className="adm-disclose"
      aria-expanded={open}
      onClick={e => { e.stopPropagation(); onToggle() }}
    >
      {open ? closeLabel : openLabel}
      {open
        ? <ChevronUpIcon strokeWidth={2.2} aria-hidden />
        : <ChevronDownIcon strokeWidth={2.2} aria-hidden />}
    </button>
  )
}

/** A pending member with the string `id` the shared selection/undo primitives key on. */
type Row = PendingMember & { id: string }
type RejectedRow = RejectedMember & { id: string }

/**
 * Sort for the pending queue only - the rejected tab has no sort control
 * (same asymmetry as the class-grade filter, which is also pending-only).
 * `oldest` matches `getPendingApprovals`'s server order (`created_at`
 * ascending) exactly, so it's the default: picking it back changes nothing
 * about what's on screen, it just un-does whichever other sort was applied.
 */
type PendingSortBy = 'oldest' | 'newest' | 'name' | 'grade'

const PENDING_SORT_OPTIONS: { value: PendingSortBy; label: string }[] = [
  { value: 'oldest', label: 'Date applied (oldest first)' },
  { value: 'newest', label: 'Date applied (newest first)' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'grade', label: 'Class grade' },
]

/** "applied 3d ago" - mono, relative, matches the queue desks' meta voice. */
const appliedAgo = (dateStr: string) => {
  if (!dateStr) return 'applied - unknown'
  const t = new Date(dateStr).getTime()
  if (Number.isNaN(t)) return 'applied - unknown'
  const s = Math.floor((Date.now() - t) / 1000)
  if (s < 3600) return `applied ${Math.max(1, Math.floor(s / 60))}m ago`
  if (s < 86400) return `applied ${Math.floor(s / 3600)}h ago`
  return `applied ${Math.floor(s / 86400)}d ago`
}

/** Same relative-time shape as appliedAgo, for the rejected queue's "rejected Nd ago". */
const rejectedAgo = (dateStr: string) => {
  if (!dateStr) return 'rejected - unknown'
  const t = new Date(dateStr).getTime()
  if (Number.isNaN(t)) return 'rejected - unknown'
  const s = Math.floor((Date.now() - t) / 1000)
  if (s < 3600) return `rejected ${Math.max(1, Math.floor(s / 60))}m ago`
  if (s < 86400) return `rejected ${Math.floor(s / 3600)}h ago`
  return `rejected ${Math.floor(s / 86400)}d ago`
}


const AccountApprovals = () => {
  const { member: currentMember } = useAuth()
  const toast = useToast()
  // Set on /director/roles. True unless a super admin has switched
  // "Approve or reject accounts" off for this role; it can only narrow what the
  // members UPDATE policy already permits, never widen it.
  const canDecide = useCan('action.approve_member')
  // Account approvals are HR / super admin only (since 2026-09-12) and are not
  // team-scoped, so there is no per-desk scope to describe in the empty state.

  const [hasAccess, setHasAccess] = useState<boolean | null>(null)
  const [members, setMembers] = useState<PendingMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [search, setSearch] = useState('')
  const [gradeFilter, setGradeFilter] = useState<'all' | string>('all')
  const [sortBy, setSortBy] = useState<PendingSortBy>('oldest')
  /** Every grade in the pending queue (separate query), so the pills never shrink to what is loaded. */
  const [allGrades, setAllGrades] = useState<string[]>([])
  /** A filter-change refetch: keeps the toolbar mounted (and the search box focused), unlike the first load. */
  const [isFetching, setIsFetching] = useState(false)
  /** The search text the server has been asked about: `search` after a ~250 ms pause. */
  const [debouncedSearch, setDebouncedSearch] = useState('')
  /** Exact totals for the pending/contacted split under the ACTIVE search and grade - see
   *  directorService.getPendingContactedCounts's own doc comment for why
   *  `rows.length` (whatever's been paginated in) is not good enough here. */
  const [contactedCounts, setContactedCounts] = useState<{ notContacted: number; contacted: number } | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Pending/contacted/all read the same view; the contacted split, search and
  // grade are all applied by the server (see accountApprovalsQuery.ts).
  // `rejected` is the one genuinely different Supabase view with its own pagination.
  const [view, setView] = useState<'pending' | 'contacted' | 'all' | 'rejected' | 'duplicates'>('pending')
  const [markingContacted, setMarkingContacted] = useState<number | null>(null)
  const [rejected, setRejected] = useState<RejectedMember[]>([])
  const [isLoadingRejected, setIsLoadingRejected] = useState(false)
  const [rejectedLoaded, setRejectedLoaded] = useState(false)
  const [rejectedError, setRejectedError] = useState<string | null>(null)
  const [rejectedPage, setRejectedPage] = useState(1)
  const [rejectedHasMore, setRejectedHasMore] = useState(true)
  const [isLoadingMoreRejected, setIsLoadingMoreRejected] = useState(false)
  const [totalRejected, setTotalRejected] = useState<number | null>(null)

  // Reject flow - single row OR the whole selection through one shared note.
  const [rejectingMember, setRejectingMember] = useState<PendingMember | null>(null)
  const [rejectingBulk, setRejectingBulk] = useState(false)
  const [rejectionNote, setRejectionNote] = useState('')
  const [isRejecting, setIsRejecting] = useState(false)
  const rejectPanelRef = useRef<HTMLDivElement>(null)
  const closeReject = () => { setRejectingMember(null); setRejectingBulk(false); setRejectionNote('') }
  useModalA11y(!!rejectingMember || rejectingBulk, rejectPanelRef, closeReject, isRejecting)

  useEffect(() => {
    // Narrowed to super_admin/HR only 2026-09-12 (owner: general sign-up
    // approvals aren't team-scopable, so this stays unscoped-only rather
    // than opening to team leads the way posts/member-status did).
    setHasAccess(isSuperAdminRole(currentMember?.role))
  }, [currentMember?.role])

  // Server-side filters for the active view. Held in a ref so the async fetchers
  // below always read the latest, never a stale closure.
  const filters = useMemo(() => buildFilters(debouncedSearch, gradeFilter), [debouncedSearch, gradeFilter])
  const contactedFilter = contactedFilterForView(view)
  const queryRef = useRef({ filters, contactedFilter })
  queryRef.current = { filters, contactedFilter }
  const pageTokens = useRef(createRequestTokens()).current
  const countTokens = useRef(createRequestTokens()).current
  const activePageToken = useRef(0)
  const firstLoadDone = useRef(false)

  // First page when `append` is false; otherwise the next page AFTER the last
  // row held (keyset). Approving or rejecting removes a row server-side, so an
  // offset of page*20 skipped the sign-ups that slid up into the gap.
  // A first-page fetch takes a new token; any response (first page or "load
  // more") that is no longer the latest query is dropped, so a slow answer to
  // an earlier keystroke can never overwrite a newer one.
  const fetchMembers = async (append = false) => {
    const { filters: f, contactedFilter: c } = queryRef.current
    const token = append ? activePageToken.current : pageTokens.next()
    if (!append) activePageToken.current = token
    if (append) setIsLoadingMore(true)
    else {
      if (firstLoadDone.current) setIsFetching(true); else setIsLoading(true)
      setLoadError(null)
    }
    try {
      const after = append ? cursorFromLast(members, m => m.createdAt, m => m.memberId) : null
      const result = await directorService.getPendingApprovals({
        limit: 20, after, search: f.search, classGrade: f.classGrade, contacted: c,
      })
      if (!pageTokens.isLatest(token)) return
      if (result.success) {
        if (append) setMembers(prev => appendUnique(prev, result.data, m => m.memberId)); else setMembers(result.data)
        setHasMore(result.pagination.hasNextPage)
      }
    } catch (err: any) {
      if (!pageTokens.isLatest(token)) return
      const msg = err?.message || err?.error_description || 'Something went wrong.'
      if (!append) setLoadError(msg)
      toast.error(`Could not load pending approvals - ${msg}`)
      console.error('[AccountApprovals] fetchMembers error:', err)
    }
    finally {
      if (pageTokens.isLatest(token)) {
        if (!append) firstLoadDone.current = true
        setIsLoading(false); setIsLoadingMore(false); setIsFetching(false)
      }
    }
  }

  const refreshContactedCounts = async () => {
    const token = countTokens.next()
    try {
      const counts = await directorService.getPendingContactedCounts({
        search: queryRef.current.filters.search, classGrade: queryRef.current.filters.classGrade,
      })
      if (countTokens.isLatest(token)) setContactedCounts(counts)
    } catch { /* header falls back to rows.length below - not worth a toast for a count */ }
  }

  // Debounce typing so each keystroke is not a round trip.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [search])

  // One effect for access, tab (contacted split), settled search and grade.
  // `filters` is memoised on the normalised values, so whitespace-only edits
  // do not refetch.
  useEffect(() => {
    if (hasAccess === true) { fetchMembers(); refreshContactedCounts() }
    else if (hasAccess === false) setIsLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess, filters, contactedFilter])

  // The grade pill list comes from its own query, once.
  useEffect(() => {
    if (hasAccess !== true) return
    directorService.getPendingGrades().then(setAllGrades).catch(() => { /* pills fall back to loaded rows */ })
  }, [hasAccess])

  const fetchRejected = async (pageNum: number, append = false) => {
    if (append) setIsLoadingMoreRejected(true); else { setIsLoadingRejected(true); setRejectedError(null) }
    try {
      const result = await directorService.getRejectedApprovals({ page: pageNum, limit: 20 })
      if (result.success) {
        if (append) setRejected(prev => [...prev, ...result.data]); else setRejected(result.data)
        setRejectedHasMore(result.pagination.hasNextPage)
        setTotalRejected(result.pagination.totalItems ?? null)
        setRejectedPage(pageNum)
        setRejectedLoaded(true)
      }
    } catch (err: any) {
      const msg = err?.message || err?.error_description || 'Something went wrong.'
      if (!append) setRejectedError(msg)
      toast.error(`Could not load rejected accounts - ${msg}`)
      console.error('[AccountApprovals] fetchRejected error:', err)
    }
    finally { setIsLoadingRejected(false); setIsLoadingMoreRejected(false) }
  }

  // Fetched lazily on first switch to the rejected tab, not up front - most
  // director visits only ever touch the pending queue.
  useEffect(() => {
    if (view === 'rejected' && hasAccess === true && !rejectedLoaded) fetchRejected(1)
  }, [view, hasAccess, rejectedLoaded])

  const grades = useMemo(
    () => mergeGrades(allGrades, [...members.map(m => m.classGrade), normalizeGrade(gradeFilter)]),
    [allGrades, members, gradeFilter],
  )

  // Memoized so useRowSelection's identity-based reset doesn't fire every render.
  // Search and the grade pill narrow the queue first; sort only reorders what's
  // left, so the three compose the way a spreadsheet's filter-then-sort does -
  // narrowing never fights the ordering, and vice versa.
  const rows = useMemo<Row[]>(() => {
    // Search, grade and the contacted split are applied by the server. The
    // contacted check stays here only so a row marked contacted moves out of
    // the pending tab immediately, before any refetch.
    const filtered = members
      .filter(m => view === 'pending' ? !m.contactedAt : view === 'contacted' ? !!m.contactedAt : true)
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'name':
          return a.fullName.localeCompare(b.fullName)
        case 'grade': {
          // Ungraded rows sort last, not first - localeCompare('', x) < 0
          // would otherwise float every "no class on file" row to the top.
          const ag = a.classGrade || '', bg = b.classGrade || ''
          if (!ag && bg) return 1
          if (ag && !bg) return -1
          return ag.localeCompare(bg) || a.fullName.localeCompare(b.fullName)
        }
        case 'oldest':
        default:
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      }
    })
    return sorted.map(m => ({ ...m, id: String(m.memberId) }))
  }, [members, sortBy, view])

  const narrowed = isFiltered(filters)

  const selection = useRowSelection(rows)

  // Grade pills are derived from the pending queue, so the rejected tab only
  // filters by search text - a grade pill it can't satisfy would look broken.
  const rejectedRows = useMemo<RejectedRow[]>(() => {
    const term = search.trim().toLowerCase()
    return rejected
      .filter(m => !term || m.fullName.toLowerCase().includes(term) || m.email.toLowerCase().includes(term))
      .map(m => ({ ...m, id: String(m.memberId) }))
  }, [rejected, search])

  // Approve is optimistic with a 5s undo window (F2): the row leaves the queue
  // immediately, and the network call only fires when the window closes. Undo
  // therefore never needs a server-side "unapprove" - it just cancels.
  const removedRef = useRef<Map<string, { member: PendingMember; index: number }>>(new Map())

  const restore = (id: string) => {
    const entry = removedRef.current.get(id)
    if (!entry) return
    removedRef.current.delete(id)
    setMembers(prev => {
      if (prev.some(m => m.memberId === entry.member.memberId)) return prev
      const next = [...prev]
      next.splice(Math.min(entry.index, next.length), 0, entry.member)
      return next
    })
  }

  const approve = useUndoableAction<Row>({
    label: row => `${row.fullName} approved`,
    action: async row => {
      try {
        await directorService.approveMember(row.memberId)
        removedRef.current.delete(row.id)
        refreshContactedCounts()
      } catch (e) {
        if (isAlreadyDecided(e)) {
          // Already decided elsewhere: the row is gone for good. Do not put it
          // back, and say so instead of the generic failure toast.
          removedRef.current.delete(row.id)
          toast.info('already decided.', (e as Error).message)
          refreshContactedCounts()
          return
        }
        restore(row.id)
        throw e
      }
    },
    undo: async row => { restore(row.id) },
  })

  const handleApprove = (row: Row) => {
    // The capability gate is enforced on the CODE PATH, not only by hiding the
    // button below. A stale tab open from before a super admin unticked
    // "Approve or reject accounts" would still have the button rendered, and
    // this is what stops it acting. RLS remains the real boundary underneath.
    if (!canDecide) return
    const index = members.findIndex(m => m.memberId === row.memberId)
    removedRef.current.set(row.id, { member: row, index: index === -1 ? 0 : index })
    setMembers(prev => prev.filter(m => m.memberId !== row.memberId))
    approve.run(row)
  }

  const handleMarkContacted = async (row: Row) => {
    if (!canDecide || row.contactedAt) return
    setMarkingContacted(row.memberId)
    const now = new Date().toISOString()
    // Optimistic, no undo window - unlike approve/reject this doesn't
    // notify the applicant or change their status, so there's nothing
    // destructive to roll back; a failure just re-shows the button.
    setMembers(prev => prev.map(m => m.memberId === row.memberId ? { ...m, contactedAt: now } : m))
    try {
      await directorService.markContacted(row.memberId)
      refreshContactedCounts()
    } catch (e: any) {
      setMembers(prev => prev.map(m => m.memberId === row.memberId ? { ...m, contactedAt: null } : m))
      toast.error(`couldn't mark ${row.fullName} as contacted.`, e?.message)
    } finally {
      setMarkingContacted(null)
    }
  }

  const handleBulkApprove = () => {
    const targets = rows.filter(r => selection.isSelected(r.id))
    selection.clear()
    targets.forEach(handleApprove)
  }

  const handleReject = async () => {
    if (!canDecide) return
    const note = rejectionNote.trim()
    if (!note) return
    const targets = rejectingBulk ? rows.filter(r => selection.isSelected(r.id)) : rejectingMember ? [rejectingMember] : []
    if (targets.length === 0) return
    setIsRejecting(true)
    try {
      // allSettled, not all - same reasoning as PostModeration's bulk reject.
      // A rejection notifies the applicant, and a first-failure abort left
      // every row in the queue including the ones already written, so the
      // retry sent a second rejection to people who had already had one.
      const results = await Promise.allSettled(
        targets.map(t => directorService.rejectMember(t.memberId, note)),
      )
      const doneIds = new Set(
        targets.filter((_, i) => results[i].status === 'fulfilled').map(t => t.memberId),
      )
      const goneIds = new Set(
        targets.filter((_, i) => { const r = results[i]; return r.status === 'rejected' && isAlreadyDecided(r.reason) }).map(t => t.memberId),
      )
      const failed = targets.length - doneIds.size
      setMembers(prev => prev.filter(m => !doneIds.has(m.memberId) && !goneIds.has(m.memberId)))
      selection.clear()
      if (doneIds.size > 0 || goneIds.size > 0) refreshContactedCounts()
      // The rejected tab was loaded before this reject: mark it stale so the
      // next visit refetches instead of showing the old list.
      if (doneIds.size > 0) { setRejectedLoaded(false); setRejectedPage(1) }

      if (failed === 0) {
        toast.success(doneIds.size === 1
          ? `${targets[0].fullName}'s application rejected.`
          : `${doneIds.size} applications rejected.`)
        closeReject()
      } else {
        const firstErr = results.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined
        toast.error(
          doneIds.size === 0
            ? 'none of those could be rejected.'
            : `${doneIds.size} rejected, ${failed} couldn’t be.`,
          firstErr?.reason?.message ?? 'the ones still listed were not changed - pick them again to retry.',
        )
        // Closes, for the same reason as PostModeration's identical branch:
        // `targets` comes from the live selection, and setMembers above changes
        // the rows array identity, which makes useRowSelection clear itself -
        // so an open panel would show "reject 0" and its confirm would be a
        // silent no-op.
        closeReject()
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to reject')
    }
    finally { setIsRejecting(false) }
  }

  const toggleExpand = (id: string) => setExpanded(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  if (hasAccess === null || (hasAccess === true && isLoading)) {
    return <AdminLayout><AdminSkeleton rows={5} /></AdminLayout>
  }

  if (hasAccess === false) {
    return (
      <div className="route-enter dir-page" style={{ textAlign: 'center' }}>
        {/* h1, not a div: this branch replaces the ENTIRE page, so without it
            the document has no heading at all and a screen reader has
            nothing to announce on arrival. Same visual treatment. */}
        <h1 className="h-display" style={{ fontSize: 40, margin: 0 }}>access restricted.</h1>
        <p className="muted" style={{ marginTop: 12 }}>only HR and super admins can review member applications.</p>
        <Link to="/director" className="btn btn-primary" style={{ marginTop: 20, display: 'inline-flex' }}>back to dashboard</Link>
      </div>
    )
  }

  const emptyMessage = narrowed
    ? 'nothing matches that search'
    : view === 'contacted'
      ? 'nobody contacted yet'
      : 'nothing waiting - nice work'

  return (
    <AdminLayout>
      <div className="route-enter" style={{ paddingBottom: 96, maxWidth: 880 }}>
        {/* Counts come from the server for the active search and grade, so the
            header agrees with the list however much of it has been loaded. */}
        <AdminTabHeader
          label="Approvals"
          title="Account approvals"
          count={view === 'duplicates'
            ? undefined
            : view === 'rejected'
            ? (search.trim() ? rejectedRows.length : (totalRejected ?? rejectedRows.length))
            : headerCount(view, contactedCounts, rows.length)}
          subtitle={
            view === 'pending' ? 'Review pending member sign-ups.'
            : view === 'contacted' ? "Reached out, still deciding."
            : view === 'all' ? 'Every pending sign-up, contacted or not.'
            : view === 'duplicates' ? 'Live accounts that share a phone number, so HR can reach the people involved.'
            : 'Applications turned down, and why.'
          }
        />

        {/* pending/contacted/all read the same view with a server-side contacted
            split; rejected is a genuinely different Supabase view
            with its own pagination. Strings are unchanged. */}
        <div className="adm-seg" role="group" aria-label="Queue" style={{ marginBottom: 12 }}>
          <button type="button" className={view === 'pending' ? 'is-active' : ''} aria-pressed={view === 'pending'} onClick={() => setView('pending')}>pending</button>
          <button type="button" className={view === 'contacted' ? 'is-active' : ''} aria-pressed={view === 'contacted'} onClick={() => setView('contacted')}>contacted</button>
          <button type="button" className={view === 'all' ? 'is-active' : ''} aria-pressed={view === 'all'} onClick={() => setView('all')}>all</button>
          <button type="button" className={view === 'rejected' ? 'is-active' : ''} aria-pressed={view === 'rejected'} onClick={() => setView('rejected')}>rejected</button>
          <button type="button" className={view === 'duplicates' ? 'is-active' : ''} aria-pressed={view === 'duplicates'} onClick={() => setView('duplicates')}>shared phones</button>
        </div>

        {view !== 'duplicates' && <DataToolbar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search name or email…"
          actionsInline
          actions={view !== 'rejected' ? (
            <label className="adm-sort">
              <span>sort</span>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as PendingSortBy)} aria-label="Sort pending approvals">
                {PENDING_SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          ) : undefined}
        >
          {view !== 'rejected' && (
            <div className="adm-hscroll">
              <FilterPill active={gradeFilter === 'all'} onClick={() => setGradeFilter('all')}>all</FilterPill>
              {grades.map(g => (
                <FilterPill key={g} active={gradeFilter === g} onClick={() => setGradeFilter(g)}>{g}</FilterPill>
              ))}
            </div>
          )}
        </DataToolbar>}

      {view === 'duplicates' ? (
        <DuplicatePhones />
      ) : view === 'rejected' ? (
        rejectedError ? (
          <AdminErrorState message={`Could not load rejected accounts - ${rejectedError}`} onRetry={() => fetchRejected(1)} />
        ) : isLoadingRejected ? (
          <AdminSkeleton rows={5} />
        ) : rejectedRows.length === 0 ? (
          <EmptyLedger
            message={rejected.length === 0 ? 'no rejected applications' : 'nothing matches that search'}
            sub={rejected.length === 0 ? 'Applications you turn down land here, with the reason.' : 'Try a different name or email.'}
          />
        ) : (
          <>
            {rejectedRows.map(row => (
              <AdminRow
                key={row.id}
                expanded={row.rejectionNote && expanded.has(row.id) ? (
                  <>
                    <div className="mono xs upper" style={{ fontWeight: 700, marginBottom: 6, color: 'var(--ink-3)' }}>reason given</div>
                    {row.rejectionNote}
                  </>
                ) : undefined}
                onToggleExpand={row.rejectionNote ? () => toggleExpand(row.id) : undefined}
                primary={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="adm-avatar" aria-hidden>
                      {row.avatarUrl
                        ? <Img ctx="avatar" src={row.avatarUrl} alt="" referrerPolicy="no-referrer" />
                        : <div className="adm-avatar-fallback" style={{ background: hashColor(row.fullName) }}>{getInitials(row.fullName)}</div>}
                    </div>
                    <span>{row.fullName}</span>
                  </div>
                }
                secondary={
                  <>
                    {row.email}
                    {row.phone && <> · {row.phone}</>}
                    {row.classGrade && <> · {row.classGrade}</>}
                    {row.rejectionNote && (
                      <Disclose
                        open={expanded.has(row.id)}
                        onToggle={() => toggleExpand(row.id)}
                        openLabel="reason given"
                        closeLabel="hide reason"
                      />
                    )}
                  </>
                }
                meta={rejectedAgo(row.rejectedAt)}
              />
            ))}
            {rejectedHasMore && (
              <div style={{ padding: 16, textAlign: 'center' }}>
                <button onClick={() => fetchRejected(rejectedPage + 1, true)} disabled={isLoadingMoreRejected} className="btn btn-sm adm-loadmore">
                  {isLoadingMoreRejected ? 'loading...' : 'load more →'}
                </button>
              </div>
            )}
          </>
        )
      ) : loadError ? (
        <AdminErrorState message={`Could not load pending approvals - ${loadError}`} onRetry={() => fetchMembers()} />
      ) : isFetching ? (
        <AdminSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <EmptyLedger
          message={emptyMessage}
          sub={!narrowed ? 'New sign-ups land here the moment they register.' : 'Try a different name, email, or class filter.'}
        />
      ) : (
        <>
          {rows.map(row => (
            <AdminRow
              key={row.id}
              busy={approve.pending.has(row.id)}
              selected={selection.isSelected(row.id)}
              onSelect={() => selection.toggle(row.id)}
              expanded={row.joinReason && expanded.has(row.id) ? (
                <>
                  <div className="mono xs upper" style={{ fontWeight: 700, marginBottom: 6, color: 'var(--ink-3)' }}>why they want to join</div>
                  {row.joinReason}
                </>
              ) : undefined}
              onToggleExpand={row.joinReason ? () => toggleExpand(row.id) : undefined}
              primary={
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="adm-avatar" aria-hidden>
                    {row.avatarUrl
                      ? <Img ctx="avatar" src={row.avatarUrl} alt="" referrerPolicy="no-referrer" />
                      : <div className="adm-avatar-fallback" style={{ background: hashColor(row.fullName) }}>{getInitials(row.fullName)}</div>}
                  </div>
                  <span>{row.fullName}</span>
                  {/* 2026-09-14: this account was soft-deleted at some point
                      before (including via the self-service "appeal" on
                      RejectedPage.tsx) - flagged so a director reviewing this
                      application isn't reading it as a first-time applicant. */}
                  {row.previouslyRemoved && (
                    <span
                      className="mono xs"
                      style={{
                        fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
                        color: 'var(--paper)', background: 'var(--tomato)',
                        padding: '2px 8px', borderRadius: 999, flexShrink: 0,
                      }}
                      title="This account was removed before and is re-applying."
                    >
                      removed before
                    </span>
                  )}
                </div>
              }
              secondary={
                <>
                  {row.email}
                  {row.phone && <> · {row.phone}</>}
                  {row.classGrade && <> · {row.classGrade}</>}
                  {row.joinReason && (
                    <Disclose
                      open={expanded.has(row.id)}
                      onToggle={() => toggleExpand(row.id)}
                      openLabel="why they joined"
                      closeLabel="hide reason"
                    />
                  )}
                </>
              }
              meta={appliedAgo(row.createdAt)}
              actions={
                <div className="adm-verdicts">
                  {/* Hidden, not disabled: a control you may never use is
                      clutter, and the handler refuses regardless. */}
                  {!canDecide ? (
                    <span className="mono xs muted">view only</span>
                  ) : (<>
                  {/* Marks that HR reached out to confirm this applicant's
                      membership before deciding - doesn't approve/reject on
                      its own. Once set it's a fact, not a toggle: no undo
                      button, and the row just moves to the "contacted" tab. */}
                  {row.contactedAt ? (
                    <span className="mono xs muted" title={new Date(row.contactedAt).toLocaleString()}>contacted</span>
                  ) : (
                    <button
                      onClick={() => handleMarkContacted(row)}
                      disabled={markingContacted === row.memberId}
                      className="btn btn-sm"
                      aria-busy={markingContacted === row.memberId || undefined}
                    >
                      {markingContacted === row.memberId ? '…' : 'contacted'}
                    </button>
                  )}
                  <button onClick={() => handleApprove(row)} className="btn btn-sm adm-approve">
                    <I.check /> approve
                  </button>
                  <button onClick={() => { setRejectingMember(row); setRejectingBulk(false); setRejectionNote('') }} className="btn btn-sm adm-reject" aria-label="reject">
                    <XMarkIcon width={14} height={14} strokeWidth={2.4} aria-hidden /> <span className="adm-verdict-label">reject</span>
                  </button>
                  </>)}
                </div>
              }
            />
          ))}
          {hasMore && (
            <div style={{ padding: 16, textAlign: 'center' }}>
              <button onClick={() => fetchMembers(true)} disabled={isLoadingMore} className="btn btn-sm">
                {isLoadingMore ? 'loading...' : 'load more →'}
              </button>
            </div>
          )}
        </>
      )}

      {view !== 'rejected' && view !== 'duplicates' && (
        <BulkActionBar count={selection.count} onClear={selection.clear} busy={isRejecting}>
          {canDecide && <button className="btn btn-sm adm-approve" onClick={handleBulkApprove}>approve selected</button>}
          {canDecide && <button className="btn btn-sm adm-reject" onClick={() => { setRejectingBulk(true); setRejectingMember(null); setRejectionNote('') }}>reject selected</button>}
        </BulkActionBar>
      )}

      {/* Rejection modal - one note, applied to one row or the whole selection. */}
      {(rejectingMember || rejectingBulk) && (
        <div className="modal-back" onClick={e => { if (e.target === e.currentTarget) closeReject() }}>
          <div ref={rejectPanelRef} role="dialog" aria-modal="true" aria-label="Reject application" className="modal">
            <div className="modal-head">
              <h3 style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.01em', margin: 0, color: 'var(--danger)' }}>Reject application</h3>
              <button className="iconbtn" onClick={closeReject} aria-label="Close" title="Close">
                <XMarkIcon width={18} height={18} strokeWidth={2.2} aria-hidden />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 16, color: 'var(--ink-2)' }}>
                {rejectingBulk
                  ? <>reject <strong style={{ color: 'var(--ink)' }}>{selection.count} selected applications</strong>? each applicant gets an in-app notification with the reason below.</>
                  : <>reject <strong style={{ color: 'var(--ink)' }}>{rejectingMember?.fullName}</strong>? they will see an in-app notification with the reason below.</>}
              </p>
              <label htmlFor="rej-note" className="mono xs upper muted" style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>rejection reason *</label>
              <textarea
                id="rej-note"
                className="textarea"
                value={rejectionNote}
                onChange={e => setRejectionNote(e.target.value)}
                rows={3}
                placeholder="be specific. the applicant will see this."
              />
              <div className="row gap-2" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
                <button onClick={closeReject} className="btn btn-sm" disabled={isRejecting}>cancel</button>
                <button onClick={handleReject} disabled={!rejectionNote.trim() || isRejecting} className="btn btn-sm" style={{ background: 'var(--danger)', color: 'var(--paper)', borderRadius: 999, minHeight: 44, whiteSpace: 'nowrap' }}>
                  {isRejecting ? '...' : 'confirm rejection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  )
}

export default AccountApprovals
