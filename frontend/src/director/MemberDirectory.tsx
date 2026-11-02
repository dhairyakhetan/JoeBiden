import Img from '../components/Img'
import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import directorService, { DirectoryMember } from '../services/directorService'
import teamService from '../services/teamService'
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { useDebounce } from '../hooks/useDebounce'
import { useAuth } from '../auth/AuthContext'
import { useCan } from '../auth/CapabilityContext'
import {
  useModalA11y,
  AdminLayout, AdminTabHeader, DataToolbar, EmptyLedger, FilterPill,
  AdminSkeleton, AdminErrorState, BulkActionBar,
} from './adminKit'
import { useConfirm, HoldToConfirmButton } from '../components/Confirm'
import { useToast } from '../components/Toast'
import '../styles/routes/director-people.css'
import { getInitials, hashColor } from '../lib/uiHelpers'
import { isSuperAdmin as isSuperAdminRole, hasLeaderAccess, getRoleLabel } from '../lib/roles'
import {
  canArchiveMember, archiveBlockedReason, showDeleteControl, createRequestTokens,
  isReadOnlyStatusView, showApprovalsLink, statusViewNoun, statusViewSuffix, statusViewEmpty,
  type DirectoryStatusView,
} from './memberDirectoryRules'
import MemberTeamsDialog from './MemberTeamsDialog'
import MemberBreakDialog from './MemberBreakDialog'
import BreaksOverview from './BreaksOverview'
import { isCurrentlyOnBreak } from '../services/breakService'
import { useLongPress } from '../hooks/useLongPress'
// `Field` was only used by the deleted RedeemPointsModal and its two trigger
// buttons (redesign 2026-09, points removal). `hasLeaderAccess` came back
// 2026-09-11 for item 4.4's teams control, which is leader-level work.

const formatDate = (dateStr: string) => {
  if (!dateStr) return 'unknown'
  try { return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) }
  catch { return '' }
}

// Mirrors adminKit's useIsPhone pattern, inverted: the sheet-style table
// below needs real desktop width to be legible (10 columns), the card grid
// stays the truth below that - not a manual toggle, the breakpoint decides.
//
// REDESIGN 2026-09, section 13: the split moved 860 -> 1025 so it lands on the
// project's real desktop tier (phone <= 600, tablet 601-1024, desktop >= 1025).
// At 860 a tablet in portrait got the nine-column sheet, which is the exact
// "squeezed table on a small screen" the section forbids. The paired rule in
// director-people.css (`.mdir-grid-wrap { display: none }`) moved with it; the
// two must always name the same width or both layouts render at once.
const DESKTOP_TABLE_MQ = '(min-width: 1025px)'
function useIsDesktopTable(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(DESKTOP_TABLE_MQ).matches,
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(DESKTOP_TABLE_MQ)
    const onChange = () => setIsDesktop(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return isDesktop
}

/** A <tr> that also answers a long-press/right-click, for item 2's per-row
 *  quick-action shortcut. A dedicated component rather than calling
 *  useLongPress inline inside the row `.map()` - a hook cannot be called once
 *  per array element, only once per component instance. */
function LongPressTr({ enabled, onLongPress, className, children }: {
  enabled: boolean
  onLongPress: (x: number, y: number) => void
  className?: string
  children: ReactNode
}) {
  const longPress = useLongPress(onLongPress)
  return <tr className={className} {...(enabled ? longPress : {})}>{children}</tr>
}

/** Same as `LongPressTr` above, for the phone/tablet card grid. */
function LongPressCard({ enabled, onLongPress, className, children }: {
  enabled: boolean
  onLongPress: (x: number, y: number) => void
  className?: string
  children: ReactNode
}) {
  const longPress = useLongPress(onLongPress)
  return (
    <div className={className} style={{ position: 'relative' }} {...(enabled ? longPress : {})}>
      {children}
    </div>
  )
}

// 'lead' retired 2026-09-15 (owner decision: directors/HoDs are the only
// leadership tier - see scripts/retire_lead_role_2026_09_15.sql). Keep this
// type in sync with members_role_check, not with which values happen to be
// populated.
type AQRole = 'member' | 'hod' | 'director' | 'super_admin'

/* REDESIGN 2026-09, section 13: the local `ROLE_LABELS` map is DELETED. It was
   a hand-written role list with five entries, and `lib/roles.ts` has six roles
   (`hr` is the sixth, equal in power to `super_admin`), so an hr row rendered
   its raw value here while every other surface rendered "HR". `getRoleLabel`
   from `lib/roles.ts` is the one label source and covers all six.

   The `<option>` list further down is NOT the same thing and stays hand-written
   on purpose: it is the set of PROMOTION TARGETS a super admin may pick, which
   is deliberately narrower than the set of roles that exist (`hr` is set in the
   database, never granted from this desk). */

type RoleFilter = 'all' | AQRole | 'hr'
type SortBy = 'role' | 'newest' | 'oldest' | 'name'

const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: 'Everyone' },
  { value: 'super_admin', label: 'Super Admins' },
  { value: 'hr', label: 'HR' },
  { value: 'director', label: 'Directors' },
  { value: 'hod', label: 'HoDs' },
  { value: 'member', label: 'Members' },
]

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'role', label: 'Role (leadership first)' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name', label: 'Name (A–Z)' },
]


/* ──────────────────────────────────────────────────────────────────────────
   CONTACT REVEAL, section 13. The audit is the point.

   The Equity Policy's Direct Messaging principle reads "Do not text or call
   another member privately without their prior permission." A leader who
   uncovers one member's phone number for another is granting an exception to a
   written rule, so a reveal is an EVENT, not a free read: it is recorded before
   the value appears, and if the recording fails the value does not appear.

   `contact_access_log` exists live (applied 2026-09-04). Its RLS is
   INSERT where `actor_id = current_member_id()`, SELECT where you are the
   target or you are a leader, and deliberately NO update and NO delete policy:
   a log the actor can edit is not a log.

   The `as any` cast matches `directorService.getMemberDirectory`'s cast on
   `member_directory_view`. NOTE the original reason for it is gone:
   `lib/database.types.ts` was regenerated against the live schema on
   2026-09-12, so the view IS typed now. The cast is kept because the query
   shapes here still differ from the generated Row type, not because the types
   are stale - if you are here to remove it, that is now a safe thing to try.
   ────────────────────────────────────────────────────────────────────────── */

type ContactField = 'email' | 'phone' | 'instagram'
type ContactAction = 'reveal' | 'copy'

/** `${memberId}:${field}` - the unit of both "is it revealed" and "is it busy",
    so a reveal in flight dims one control and never the desk. */
const contactKey = (memberId: number, field: ContactField) => `${memberId}:${field}`

/** One leading `@`, never two. Undefined stays undefined so renderContact can
    tell "not on file" from a stored value. */
const instagramHandle = (raw?: string | null) => {
  const h = (raw ?? '').replace(/^@+/, '').trim()
  return h ? `@${h}` : undefined
}

/** The masked stand-in. One string for both fields, so nothing about the shape
    of the hidden value (a domain, a digit count) leaks before the log row. */

/** Digits only, for the copy button. The number goes to the clipboard so it can
    be pasted wherever the leader has already been given permission to use it;
    this desk never opens a chat and never builds a wa.me link. */
const digitsOnly = (s: string) => s.replace(/\D+/g, '')

/* REDESIGN 2026-09: `RedeemPointsModal` is DELETED along with the welfare
   points system (user decision, see REDESIGN_FEATURE_REQUESTS.md item 12).
   It let a leader spend a member's points against a Crftd discount or event
   entry by writing a negative row to points_ledger.

   THE DATA LAYER IS UNTOUCHED: points_ledger, its RLS and
   services/pointsService.ts all still exist, so this reverses by restoring
   this component. What is gone is the only UI that could reach it. */


const MemberDirectory = () => {
  const { member: currentMember } = useAuth()
  const confirm = useConfirm()
  // /director/roles capabilities. Both narrow only; RLS stays the boundary.
  const canAssignRole = useCan('action.assign_role')
  const canRevealContact = useCan('action.reveal_contact')
  const toast = useToast()
  const isSuperAdmin = isSuperAdminRole(currentMember?.role)

  const [members, setMembers] = useState<DirectoryMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('role')
  const [, setPage] = useState(1)
  /** Infinite-scroll sentinel - observed instead of a "load more" click. */
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [totalMembers, setTotalMembers] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<{ memberId: number; fullName: string; email: string } | null>(null)
  /**
   * Item 3.1 - which cohort the desk is showing. `active` is the live
   * directory; `archived` is the owner's "place for people who have left".
   * Kept separate from `roleFilter` because they are different questions -
   * "which role" and "still here or not" - and combining them into one pill
   * row would make "HoDs" silently mean "active HoDs" with no way to say so.
   */
  /** `deleted` added 2026-09-12 - browsable so a soft-deleted account can be
   *  restored (see handleRestoreDeleted below); distinct from `archived`,
   *  which is a self-reported departure, not an admin removal. */
  const [statusFilter, setStatusFilter] = useState<DirectoryStatusView>('active')
  /** Item 3.1 - the member currently being archived/restored, for per-row busy. */
  const [archiving, setArchiving] = useState<number | null>(null)
  /** 2026-09-12 - the member currently being restored from 'deleted'. */
  const [restoringDeleted, setRestoringDeleted] = useState<number | null>(null)
  /** 2026-09-14 - the member currently being restarted as a new applicant. */
  const [restartingDeleted, setRestartingDeleted] = useState<number | null>(null)
  /** Item 4.4 - the member whose team assignments are open, or null. */
  const [teamsTarget, setTeamsTarget] = useState<{ memberId: number; fullName: string } | null>(null)
  const [breakTarget, setBreakTarget] = useState<{ memberId: number; fullName: string } | null>(null)
  /** "on a break" filter chip - client-side, on top of whatever page(s) are
   *  already loaded, same as how `contactsOpen` above is a client-only set:
   *  break status is computed (isCurrentlyOnBreak), not a `status` column the
   *  server query can `.eq()` on. */
  const [onBreakOnly, setOnBreakOnly] = useState(false)
  /** Row multi-select for the bulk break action. A plain `Set<number>` of
   *  memberIds rather than adminKit's `useRowSelection` - that hook keys on a
   *  generic `id: string` shape DirectoryMember doesn't have, and this desk
   *  already has its own per-row Set-state convention (see `contactsOpen`). */
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set())
  const toggleSelected = (memberId: number) => setSelectedIds(prev => {
    const next = new Set(prev)
    if (next.has(memberId)) next.delete(memberId); else next.add(memberId)
    return next
  })
  /** The member(s) targeted by the bulk break dialog - set only when opened. */
  const [bulkBreakTargets, setBulkBreakTargets] = useState<{ memberId: number; fullName: string }[] | null>(null)
  /** Long-press/right-click quick-action menu for one row. */
  const [longPressMenu, setLongPressMenu] = useState<{ memberId: number; fullName: string; x: number; y: number } | null>(null)
  /**
   * Item 5.2 - which cards currently show their contact rows. Per-card rather
   * than one global "show contacts" switch: a global toggle would reveal every
   * address on screen at once, which is the opposite of what gating them
   * behind a tap is for. Not persisted either - a fresh page starts closed, so
   * the desk never opens with a wall of student phone numbers on it.
   */
  const [contactsOpen, setContactsOpen] = useState<Set<number>>(() => new Set())
  const toggleContacts = (memberId: number) => setContactsOpen(prev => {
    const next = new Set(prev)
    if (next.has(memberId)) next.delete(memberId); else next.add(memberId)
    return next
  })
  const [isDeleting, setIsDeleting] = useState(false)
  const [roleChanging, setRoleChanging] = useState<number | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  // PER-ROW BUSY, not desk-wide. A SET of `${memberId}:${field}` keys, not a
  // single key: with one key, a second copy started while the first is in
  // flight is silently swallowed by the guard while its button still looks
  // live, which is a dead control rather than a busy one. A desk-wide flag
  // froze the whole page on four other desks before this rule was written down.
  const [contactBusy, setContactBusy] = useState<Set<string>>(() => new Set())
  const markBusy = (key: string, busy: boolean) => setContactBusy(prev => {
    const next = new Set(prev)
    if (busy) next.add(key); else next.delete(key)
    return next
  })
  const deletePanelRef = useRef<HTMLDivElement>(null)
  useModalA11y(!!deleteTarget, deletePanelRef, () => setDeleteTarget(null), isDeleting)
  const isDesktopTable = useIsDesktopTable()

  /**
   * The break controls used to be gated purely on `hasLeaderAccess` - any
   * leader could open the dialog for ANY member, and only the server-side
   * `hr_set_member_break()` RPC (is_super_admin() OR is_team_lead_of_member())
   * would reject an out-of-scope target. That is a correct security boundary
   * but a confusing UI, so this scopes the button itself too: `null` while
   * unloaded (nothing shown yet - fail closed on the UI only, never on the
   * RPC), a `Set<number>` of member ids on this leader's own led team(s)
   * once fetched.
   *
   * BUG, fixed: this used to read `myTeamIds` from DirectorContext, which is
   * the POST-MODERATION scope (teams actually led UNION every team in a
   * director's assigned categories, per teamService.getMyDeskTeamIds's own
   * doc comment) - a director assigned to a category but leading no team of
   * their own got `myTeamMemberIds` full of that category's members, so the
   * button/filter/select showed for people `hr_set_member_break()` (which
   * only ever checks is_team_lead_of_member(), no category concept) would
   * then reject. Calling getMyDeskTeamIds() with no categories returns only
   * the team(s) this member actually holds an active `role='lead'` row on -
   * exactly what the RPC checks - so the UI can no longer offer a button the
   * RPC will refuse. Empty means unscoped, same fail-open rule as the
   * function's own doc comment (a leader with no lead row keeps the reach
   * they had before this existed) - `null` is the "unscoped" state.
   */
  const [myTeamMemberIds, setMyTeamMemberIds] = useState<Set<number> | null>(null)
  useEffect(() => {
    if (isSuperAdmin) { setMyTeamMemberIds(null); return }
    let cancelled = false
    teamService.getMyDeskTeamIds().then(async (ledTeamIds) => {
      if (cancelled) return
      if (ledTeamIds.length === 0) { setMyTeamMemberIds(null); return }
      const { data } = await supabaseCommunity
        .from('team_members')
        .select('member_id')
        .in('team_id', ledTeamIds)
        .eq('is_active', true)
      if (cancelled) return
      setMyTeamMemberIds(new Set((data || []).map((r: any) => r.member_id)))
    })
    return () => { cancelled = true }
  }, [isSuperAdmin])

  /** Can the current viewer put THIS member on a break - the UI-level mirror
   *  of hr_set_member_break()'s own check. */
  const canBreakMember = (memberId: number) =>
    !isReadOnlyStatusView(statusFilter) && (isSuperAdmin || myTeamMemberIds === null || myTeamMemberIds.has(memberId))

  /**
   * Write one row to `contact_access_log`, and throw unless it lands.
   *
   * `.select('id')` plus a zero-row check, per the desk's own rule: PostgREST
   * returns NO error and zero rows when a write is denied by RLS, which is
   * indistinguishable from success on the wire. Without the check, an INSERT
   * that RLS silently dropped would still uncover the number.
   */
  const logContactAccess = async (targetId: number, field: ContactField, action: ContactAction) => {
    const actorId = currentMember?.member_id
    if (!actorId) throw new Error('no signed-in member to record as the actor')
    const { data, error } = await (supabaseCommunity as any)
      .from('contact_access_log')
      .insert({ actor_id: actorId, target_id: targetId, field, action })
      .select('id')
    if (error) throw error
    if (!data || data.length === 0) throw new Error('the access log did not accept the row')
  }

  /**
   * Copy an already-revealed value. Logged as its own `copy` row: a reveal is
   * one person reading a number on screen, a copy is that number leaving the
   * desk, and the policy question is different for each. Same order, same
   * refusal: nothing reaches the clipboard until the row is in.
   */
  const copyContact = async (memberId: number, field: ContactField, value: string) => {
    const key = contactKey(memberId, field)
    if (contactBusy.has(key)) return
    const payload = field === 'phone' ? digitsOnly(value) : value
    markBusy(key, true)
    // Which half failed decides what to tell them: a refused audit row means
    // nothing was copied AND nothing is on record, a blocked clipboard means
    // the row IS on record but their clipboard is unchanged. Saying "that copy
    // was not recorded" for the second would be the opposite of the truth.
    let logged = false
    try {
      await logContactAccess(memberId, field, 'copy')
      logged = true
      try {
        await navigator.clipboard.writeText(payload)
      } catch {
        // The fallback only runs when navigator.clipboard ALREADY failed -
        // exactly the permission-denied / insecure-context case where
        // execCommand('copy') returns false too. Its result was discarded, so
        // the HoD was told the number was on their clipboard, pasted into
        // WhatsApp and got whatever had been there before - after a
        // contact_access_log row had already been written naming them.
        const el = document.createElement('input'); el.value = payload
        document.body.appendChild(el); el.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(el)
        if (!ok) throw new Error('your browser blocked the clipboard.')
      }
      setCopiedKey(key)
      toast.success(field === 'phone' ? 'number copied.' : field === 'instagram' ? 'handle copied.' : 'email copied.')
      setTimeout(() => setCopiedKey(k => k === key ? null : k), 1500)
    } catch (e: any) {
      toast.error(
        logged
          ? 'nothing reached your clipboard.'
          : 'that copy was not recorded, so nothing was copied.',
        logged
          ? 'the access log row was written. select the value and copy it by hand.'
          : (e?.message ?? String(e)),
      )
    } finally {
      markBusy(key, false)
    }
  }

  /**
   * The masked contact control, used identically by the desktop sheet and the
   * phone card so the two projections cannot drift into different rules.
   *
   * Affordance ledger: there is no reveal step any more (the value shows
   * directly). The copy button is the one control, and it is the logged
   * extraction event. It is >= 44px on phone via `.mdir-contact-btn`.
   */
  const renderContact = (memberId: number, fullName: string, field: ContactField, value?: string | null) => {
    if (!value) return <span className="mono mdir-contact-none">not on file</span>
    // "Reveal a member's email or phone" switched off for this role on
    // /director/roles. The value stays masked and the copy control - the real
    // extraction event - is not rendered at all, so `contact_access_log`
    // records nothing, which is correct: nothing was accessed.
    if (!canRevealContact) return <span className="mono mdir-contact-none is-hidden" title="Your role cannot reveal contact details">hidden for your role</span>
    const key = contactKey(memberId, field)
    const busy = contactBusy.has(key)
    // No reveal gate: the value is shown directly. Copying stays a logged
    // action (copyContact/logContactAccess below) - that's a real
    // data-extraction event distinct from reading a value already on screen,
    // and removing the click-to-reveal step doesn't remove that distinction.
    return (
      <div className="mdir-contact">
        {/* `title` because the value TRUNCATES rather than wrapping:
            director-people.css sets `flex-wrap: nowrap` on .mdir-contact so
            every row is the same height, which means a long address
            (agarwal.bhavishya2008@gmail.com) is cut off with no way to read the
            rest. The copy button beside it puts the full value on the clipboard,
            but a leader often needs to READ it, not paste it. Audit 2026-09-17. */}
        <span className="mono mdir-contact-value" title={value}>{value}</span>
        <button
          type="button"
          className={'mdir-contact-btn mdir-copybtn' + (copiedKey === key ? ' is-copied' : '')}
          onClick={() => copyContact(memberId, field, value)}
          disabled={busy}
          aria-busy={busy || undefined}
          title={field === 'phone' ? 'Copy the number only' : field === 'instagram' ? 'Copy the Instagram handle' : 'Copy the email address'}
          aria-label={`Copy ${fullName}'s ${field}`}
        >
          {copiedKey === key ? '✓' : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          )}
        </button>
      </div>
    )
  }

  const debouncedSearch = useDebounce(search, 300)

  // Stale-response guard: every call takes a token and only the newest one may
  // write state. Without it, a slow response for an old search/filter could land
  // after a newer one and overwrite it, or a load-more for the old filter could
  // append rows onto the new list.
  const requestTokens = useRef(createRequestTokens()).current
  const fetchMembers = useCallback(async (pageNum: number, searchQuery: string, role: RoleFilter, sort: SortBy, append = false, status: DirectoryStatusView = 'active') => {
    const token = requestTokens.next()
    if (append) setIsLoadingMore(true); else { setIsLoading(true); setIsLoadingMore(false); setLoadError(null) }
    try {
      const result = await directorService.getMemberDirectory({ page: pageNum, limit: 20, search: searchQuery, role, sort, status })
      if (!requestTokens.isLatest(token)) return
      if (result.success) {
        if (append) setMembers(prev => [...prev, ...result.data]); else setMembers(result.data)
        setHasMore(result.pagination.hasNextPage)
        setTotalMembers(result.pagination.totalItems)
      }
    } catch (e: any) {
      if (!requestTokens.isLatest(token)) return
      const msg = e?.message ?? String(e)
      if (!append) setLoadError(msg)
      toast.error('members didn’t load.', msg)
    }
    finally { if (requestTokens.isLatest(token)) { setIsLoading(false); setIsLoadingMore(false) } }
  }, [toast, requestTokens])

  /**
   * Item 3.1. Archive someone, or bring them back. A confirm rather than a
   * hold-to-confirm: this is reversible in one tap from the Archive pill, so
   * it does not deserve the ceremony `deleteMember` gets - but it changes what
   * the whole org sees, so it is not silent either.
   */
  const handleArchive = async (member: DirectoryMember) => {
    const goingToArchive = statusFilter !== 'archived'
    if (goingToArchive) {
      const blocked = archiveBlockedReason(currentMember?.role, member.role, member.memberId === currentMember?.member_id)
      if (blocked) { toast.error(blocked + '.'); return }
    }
    const ok = await confirm({
      title: goingToArchive ? 'Archive this member?' : 'Bring them back?',
      body: goingToArchive
        ? `${member.fullName} comes off the public directory and the live member list. Nothing is deleted - their posts, drives and profile all stay, and you can restore them from the Archive filter.`
        : `${member.fullName} goes back on the public directory and the live member list.`,
      confirmLabel: goingToArchive ? 'Archive' : 'Restore',
    })
    if (!ok) return
    setArchiving(member.memberId)
    try {
      await directorService.setArchived(member.memberId, goingToArchive)
      toast.success(goingToArchive ? `${member.fullName} archived` : `${member.fullName} restored`)
      setPage(1)
      fetchMembers(1, debouncedSearch, roleFilter, sortBy, false, statusFilter)
    } catch (e: any) {
      toast.error(goingToArchive ? 'couldn’t archive them.' : 'couldn’t restore them.', e?.message)
    } finally {
      setArchiving(null)
    }
  }

  /** Undo a soft-delete (see directorService.deleteMember's own note). Plain
   *  confirm, not hold-to-confirm - restoring is the safe direction, same
   *  reasoning as handleArchive's restore branch above. */
  const handleRestoreDeleted = async (member: DirectoryMember) => {
    const ok = await confirm({
      title: 'Restore this account?',
      body: `${member.fullName} goes back to active - nothing was ever actually removed, so this fully undoes the delete.`,
      confirmLabel: 'Restore',
    })
    if (!ok) return
    setRestoringDeleted(member.memberId)
    try {
      await directorService.restoreDeletedMember(member.memberId)
      toast.success(`${member.fullName} restored`)
      setPage(1)
      fetchMembers(1, debouncedSearch, roleFilter, sortBy, false, statusFilter)
    } catch (e: any) {
      toast.error('couldn’t restore them.', e?.message)
    } finally {
      setRestoringDeleted(null)
    }
  }

  /** 2026-09-14: distinct from restore above. This sends the account back
   *  through the real apply -> pending -> approve funnel instead of
   *  straight to active - built for demo accounts that get deleted and
   *  re-applied with on purpose to show people what the funnel looks like.
   *  See restart_member_as_applicant_2026_09_14.sql. Danger-styled confirm:
   *  unlike a plain restore, this clears their class/grade and puts them
   *  back in the pending queue, a bigger behavioural change than "undo". */
  const handleRestartAsApplicant = async (member: DirectoryMember) => {
    const ok = await confirm({
      title: 'Restart as a new applicant?',
      body: `${member.fullName} goes back to "pending approval" instead of active - their registration step (name/class) resets too, so logging in replays the real apply flow from scratch. Use this for demo accounts, not real reinstatements.`,
      confirmLabel: 'Restart',
      danger: true,
    })
    if (!ok) return
    setRestartingDeleted(member.memberId)
    try {
      await directorService.restartMemberAsApplicant(member.memberId)
      toast.success(`${member.fullName} is a pending applicant again`)
      setPage(1)
      fetchMembers(1, debouncedSearch, roleFilter, sortBy, false, statusFilter)
    } catch (e: any) {
      toast.error('couldn’t restart them.', e?.message)
    } finally {
      setRestartingDeleted(null)
    }
  }

  // Any change to search / role filter / sort resets to page 1 and refetches.
  useEffect(() => { setPage(1); fetchMembers(1, debouncedSearch, roleFilter, sortBy, false, statusFilter) }, [debouncedSearch, roleFilter, sortBy, statusFilter, fetchMembers])

  // Infinite scroll: the sentinel below the list replaces the old
  // click-to-load-more button - loading the next page as soon as it nears
  // the viewport instead of waiting for a click.
  //
  // BUG, fixed: `isLoadingMore` used to sit in this effect's own dependency
  // array. IntersectionObserver.observe() reports the CURRENT intersection
  // state immediately, not just on a future crossing - so on any viewport
  // where the sentinel stayed inside the 400px rootMargin after a page
  // loaded (short lists, tall screens, a fast scroll near the bottom), the
  // isLoadingMore:true->false flip at the end of one fetch re-ran this
  // effect, tore down the old observer, and the new one's very first
  // `observe()` call fired again immediately - loading every remaining page
  // back-to-back with no further scrolling. `isLoadingMoreRef` reads the
  // live value inside the callback without being a dependency, so the
  // observer is created once per hasMore/filter change and just stays put
  // across individual page loads.
  const isLoadingMoreRef = useRef(false)
  isLoadingMoreRef.current = isLoadingMore
  useEffect(() => {
    const el = loadMoreRef.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !isLoadingMoreRef.current) {
        setPage(p => {
          const next = p + 1
          fetchMembers(next, debouncedSearch, roleFilter, sortBy, true, statusFilter)
          return next
        })
      }
    }, { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, debouncedSearch, roleFilter, sortBy, statusFilter, fetchMembers])

  const handleDelete = async () => {
    if (!deleteTarget) return
    // Guard: never let a user delete themselves from here. Use settings instead.
    if (deleteTarget.memberId === currentMember?.member_id) {
      toast.error("You can't delete your own account from the directory."); return
    }
    // Guard: only super_admins can delete other super_admins.
    const target = members.find(m => m.memberId === deleteTarget.memberId)
    if (isSuperAdminRole(target?.role) && !isSuperAdmin) {
      toast.error('only a super admin can delete another super admin.'); return
    }
    setIsDeleting(true)
    try {
      const result = await directorService.deleteMember(deleteTarget.memberId)
      toast.success(result.message || `${deleteTarget.fullName} deleted.`)
      setDeleteTarget(null); setPage(1); fetchMembers(1, debouncedSearch, roleFilter, sortBy, false, statusFilter)
    } catch (error: any) {
      toast.error(error?.message ?? error.response?.data?.message ?? 'Failed to delete member')
    }
    finally { setIsDeleting(false) }
  }

  const handleRoleChange = async (memberId: number, fullName: string, newRole: AQRole) => {
    // Capability first: a confirmed change must never silently do nothing.
    if (!canAssignRole) { toast.error('your role can’t change roles.'); return }
    // Protect: can't change your own role
    if (memberId === currentMember?.member_id) { toast.error("You can't change your own role."); return }
    // Protect: only super_admins can demote another super_admin
    const target = members.find(m => m.memberId === memberId)
    if (isSuperAdminRole(target?.role) && !isSuperAdmin) {
      toast.error("Only a super admin can change another super admin's role.")
      return
    }
    if (newRole === 'super_admin' && !isSuperAdmin) {
      toast.error('only a super admin can promote someone to super admin.')
      return
    }
    // Confirm - a mis-click on this <select> silently mutated a role before.
    // 20.3: name BOTH roles, not just the destination - "set role to X" alone
    // doesn't tell a super admin what they're changing FROM before committing.
    const ok = await confirm({
      title: 'Change role?',
      body: `Change ${fullName}'s role from ${getRoleLabel(target?.role)} to ${getRoleLabel(newRole)}? Their access changes immediately.`,
      confirmLabel: 'Change role',
      danger: newRole === 'super_admin',
    })
    if (!ok) return
    setRoleChanging(memberId)
    try {
      await directorService.changeRole(memberId, newRole)
      toast.success(`${fullName} → ${getRoleLabel(newRole)}`)
      // Optimistically update the local list so UI refreshes instantly
      setMembers(prev => prev.map(m => m.memberId === memberId ? { ...m, role: newRole } : m))
    } catch (err: any) { toast.error(err.message || 'couldn’t change that role.') }
    finally { setRoleChanging(null) }
  }

  const visibleMembers = onBreakOnly ? members.filter(m => isCurrentlyOnBreak(m.breakEnd)) : members
  const canBreakAnyone = hasLeaderAccess(currentMember?.role)
  const canTeams = hasLeaderAccess(currentMember?.role)

  /** Select-all only selects what's currently visible/matching (the active
   *  filters/search) AND in scope for a break (see `canBreakMember`) - never
   *  the whole org across unloaded pages, and never a member outside a HoD's
   *  own team just because they happened to be on screen. */
  const selectableMembers = visibleMembers.filter(m => canBreakMember(m.memberId))
  const toggleSelectAll = () => setSelectedIds(prev => {
    if (prev.size === selectableMembers.length && selectableMembers.length > 0) return new Set()
    return new Set(selectableMembers.map(m => m.memberId))
  })

  const openBulkBreak = () => {
    const targets = visibleMembers
      .filter(m => selectedIds.has(m.memberId))
      .map(m => ({ memberId: m.memberId, fullName: m.fullName }))
    if (targets.length === 0) return
    setBulkBreakTargets(targets)
  }

  const closeLongPressMenu = () => setLongPressMenu(null)

  return (
    <AdminLayout wide>
      {/* No inner maxWidth here (was 940px) - the wide desktop sheet
          (name/email/phone/instagram/class/school/role/joined/actions) was capped narrower
          than `.adm-layout`'s own container even before AdminLayout's `wide`
          bump, leaving a real, measured strip of unused width to its right
          on every screen wide enough to render the table at all. */}
      <div className="route-enter" style={{ paddingBottom: 80 }}>
        <AdminTabHeader
          label="Members"
          title="Member directory"
          // Item 3.1: this said "active members" unconditionally, which would
          // be a plain lie while the archive is showing.
          subtitle={`${totalMembers.toLocaleString()} ${
            roleFilter === 'all'
              ? statusViewNoun(statusFilter)
              : ROLE_FILTERS.find(f => f.value === roleFilter)!.label.toLowerCase()
                + statusViewSuffix(statusFilter)
          }`}
        />

      {/* One toolbar - search + role filters + sort (was two hand-rolled bars) */}
      <DataToolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search by name or email…"
        actionsInline
        actions={
          <label className="adm-sort">
            <span>sort</span>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)} aria-label="Sort members">
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        }
      >
        {ROLE_FILTERS.map(f => (
          <FilterPill key={f.value} active={roleFilter === f.value} onClick={() => setRoleFilter(f.value)}>
            {f.label}
          </FilterPill>
        ))}
        {/* Item 3.1, the archive. A SEPARATE pair from the role pills above,
            with a divider, because they answer different questions: the row
            above is "which role", this is "still here or not". Merging them
            would make "HoDs" silently mean "active HoDs" with no way to say
            otherwise. Two pills rather than a third "everyone" option - a
            directory that mixes current and departed members in one list is
            the thing having an archive is supposed to prevent. */}
        <span className="mdir-filter-divider" aria-hidden />
        <FilterPill active={statusFilter === 'active'} onClick={() => setStatusFilter('active')}>
          Here now
        </FilterPill>
        <FilterPill active={statusFilter === 'archived'} onClick={() => setStatusFilter('archived')}>
          Archive
        </FilterPill>
        {/* Deleted accounts - super_admin only, matching who can restore
            them (restore_member()'s own is_super_admin() gate). A plain HoD
            filtering to this would see rows with no working action on them. */}
        <FilterPill active={statusFilter === 'pending_approval'} onClick={() => setStatusFilter('pending_approval')}>
          Pending
        </FilterPill>
        <FilterPill active={statusFilter === 'suspended'} onClick={() => setStatusFilter('suspended')}>
          Suspended
        </FilterPill>
        {isSuperAdmin && (
          <FilterPill active={statusFilter === 'deleted'} onClick={() => setStatusFilter('deleted')}>
            Deleted
          </FilterPill>
        )}
        {/* Item 1 - a computed status, not a `status` column, so this is a
            plain client-side filter on top of what's already loaded, same
            shape as the divider pair above rather than a third value folded
            into `statusFilter`. Leader-visible only - a plain member has no
            break-related controls on this desk at all. */}
        {canBreakAnyone && (
          <>
            <span className="mdir-filter-divider" aria-hidden />
            <FilterPill active={onBreakOnly} onClick={() => setOnBreakOnly(v => !v)}>
              On a break
            </FilterPill>
          </>
        )}
        {canBreakAnyone && (
          <FilterPill
            active={selectMode}
            onClick={() => { setSelectMode(v => !v); setSelectedIds(new Set()) }}
          >
            {selectMode ? 'Cancel select' : 'Select'}
          </FilterPill>
        )}
      </DataToolbar>

      {/* THE CROSS-REFERENCE. `/equity-policy` carries the other half of this,
          a "cross reference, not policy" aside under the Direct Messaging
          principle. Neither surface asserts the rule alone: the policy says a
          member's number is not yours to pass on, and this desk says what
          happens when you look at one anyway. Keep both, or the audit reads as
          bureaucracy instead of as the enforcement of a written promise. */}
      <p className="mdir-audit-note">
        <span className="mdir-audit-tag">recorded</span>
        Revealing or copying a phone number or an email writes a row naming you, the member and the time.
        It is the {' '}
        <Link to="/equity-policy#core-principles">Direct Messaging principle</Link>
        {' '} in the equity policy that a reveal grants an exception to.
      </p>

      {/* "On a break" shows the dedicated view (who is away now, then who has a break booked, with
          dates) instead of filtering the loaded page: that filter missed anyone not on the page and
          showed no dates (bug report 2026-10-30). */}
      {onBreakOnly ? (
        <BreaksOverview />
      ) : isLoading ? (
        <AdminSkeleton rows={6} variant="grid" />
      ) : loadError ? (
        <AdminErrorState
          message={`Could not load the directory - ${loadError}`}
          onRetry={() => fetchMembers(1, debouncedSearch, roleFilter, sortBy, false, statusFilter)}
        />
      ) : visibleMembers.length === 0 ? (
        <EmptyLedger
          message={search ? 'no results' : onBreakOnly ? 'no one is on a break' : statusViewEmpty(statusFilter).message}
          sub={search ? 'Try different keywords.' : onBreakOnly ? 'Nobody currently loaded matches.' : statusViewEmpty(statusFilter).sub}
          action={search ? <button type="button" className="btn btn-sm" onClick={() => setSearch('')}>clear search</button> : undefined}
        />
      ) : (
        <>
          {/* Desktop sheet view (≥1025px) - real columns, sortable headers,
              per-field copy buttons that write a contact_access_log row. The card grid below it is what
              phone/tablet actually render (CSS breakpoint, not JS toggle -
              see .mdir-table-wrap / .mdir-grid-wrap in director-people.css). */}
          {isDesktopTable && (
            <div className="mdir-table-wrap">
              <table className="mdir-table">
                <thead>
                  <tr>
                    {selectMode && (
                      <th style={{ width: 32 }}>
                        <input
                          type="checkbox"
                          aria-label="Select all visible members"
                          checked={selectableMembers.length > 0 && selectedIds.size === selectableMembers.length}
                          ref={el => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < selectableMembers.length }}
                          onChange={toggleSelectAll}
                        />
                      </th>
                    )}
                    <th>
                      <button type="button" className={sortBy === 'name' ? 'is-active' : ''} onClick={() => setSortBy('name')}>
                        name {sortBy === 'name' && '↓'}
                      </button>
                    </th>
                    <th>email</th>
                    <th>phone</th>
                    {/* Instagram is a contact field, gated exactly like phone:
                        it goes through renderContact so the capability check,
                        the "hidden for your role" fallback and the
                        contact_access_log copy row all apply. It used to render
                        ungated in the phone card's meta line. */}
                    <th>instagram</th>
                    <th>class</th>
                    {/* Item 5.1. The desktop table has horizontal room the
                        phone card does not, so school gets its own column here
                        rather than sharing the class line. */}
                    <th>school</th>
                    <th>
                      <button type="button" className={sortBy === 'role' ? 'is-active' : ''} onClick={() => setSortBy('role')}>
                        role {sortBy === 'role' && '↓'}
                      </button>
                    </th>
                    <th>
                      <button
                        type="button"
                        className={sortBy === 'newest' || sortBy === 'oldest' ? 'is-active' : ''}
                        onClick={() => setSortBy(sortBy === 'newest' ? 'oldest' : 'newest')}
                        title="Click to flip newest/oldest"
                      >
                        joined {sortBy === 'newest' ? '↓' : sortBy === 'oldest' ? '↑' : ''}
                      </button>
                    </th>
                    <th style={{ textAlign: 'right' }}>actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMembers.map(member => {
                    const isSelf = member.memberId === currentMember?.member_id
                    const isProtectedAdmin = isSuperAdminRole(member.role) && !isSuperAdmin
                    return (
                      <LongPressTr
                        key={member.memberId}
                        className={member.status !== 'active' ? 'is-inactive' : undefined}
                        enabled={canBreakMember(member.memberId)}
                        onLongPress={(x, y) => setLongPressMenu({ memberId: member.memberId, fullName: member.fullName, x, y })}
                      >
                        {selectMode && (
                          <td onClick={e => e.stopPropagation()}>
                            {canBreakMember(member.memberId) && (
                              <input
                                type="checkbox"
                                aria-label={`Select ${member.fullName}`}
                                checked={selectedIds.has(member.memberId)}
                                onChange={() => toggleSelected(member.memberId)}
                              />
                            )}
                          </td>
                        )}
                        <td>
                          <Link to={`/profile/${member.uuid}`} className="mdir-td-name" style={{ textDecoration: 'none', color: 'inherit' }}>
                            <div className="people-av" style={{ background: hashColor(member.fullName) }}>
                              {member.avatarUrl
                                ? <Img ctx="avatar" src={member.avatarUrl} alt="" referrerPolicy="no-referrer" />
                                : getInitials(member.fullName)}
                            </div>
                            {member.fullName}
                          </Link>
                        </td>
                        <td>{renderContact(member.memberId, member.fullName, 'email', member.email)}</td>
                        <td>{renderContact(member.memberId, member.fullName, 'phone', member.phone)}</td>
                        <td>{renderContact(member.memberId, member.fullName, 'instagram', instagramHandle(member.instagram))}</td>
                        <td className="mono">{member.classGrade || '–'}</td>
                        <td className="mono">{member.schoolName || '–'}</td>
                        <td>
                          {isSuperAdmin ? (
                            <select
                              className="mdir-select"
                              style={{ maxWidth: 130 }}
                              value={member.role || 'member'}
                              disabled={roleChanging === member.memberId || isSelf || isProtectedAdmin || !canAssignRole}
                              title={!canAssignRole ? 'Your role cannot change roles' : undefined}
                              onChange={e => handleRoleChange(member.memberId, member.fullName, e.target.value as AQRole)}
                              aria-label={`Role for ${member.fullName}`}
                            >
                              <option value="member">Member</option>
                              <option value="hod">HoD</option>
                              <option value="director">Director</option>
                              {(isSuperAdmin || isSuperAdminRole(member.role)) && <option value="super_admin">Super Admin</option>}
                              {/* 'hr' is not offered as a promotion target here (that is set
                                  in the database); the option exists only so an existing hr
                                  row renders its own value instead of a blank select. */}
                              {(member.role as string) === 'hr' && <option value="hr">HR</option>}
                            </select>
                          ) : (
                            <span className={'role' + (member.role === 'hod' ? ' role-hod' : member.role === 'director' ? ' role-director' : '')} style={{ fontSize: 10 }}>
                              {getRoleLabel(member.role)}
                            </span>
                          )}
                        </td>
                        <td className="mono">{formatDate(member.createdAt)}</td>
                        <td>
                          <div className="mdir-td-actions">
                            {/* Always-visible, matching the card grid's own
                                break button below - previously reachable only
                                via long-press/right-click on this row, which
                                is a fast shortcut, not the only way in. */}
                            {statusFilter !== 'deleted' && canBreakMember(member.memberId) && (
                              <button
                                type="button"
                                className="mdir-teamsbtn"
                                onClick={() => setBreakTarget({ memberId: member.memberId, fullName: member.fullName })}
                                title={`Put ${member.fullName} on a break`}
                              >
                                break
                              </button>
                            )}
                            {isReadOnlyStatusView(statusFilter) ? (
                              showApprovalsLink(currentMember?.role, statusFilter)
                                ? <Link to="/director/approvals" className="mdir-teamsbtn">review in Approvals</Link>
                                : <span className="mono xs muted">{statusFilter === 'pending_approval' ? 'waiting for approval' : 'suspended'}</span>
                            ) : statusFilter === 'deleted' ? (
                              <>
                                <button
                                  type="button"
                                  className="mdir-teamsbtn"
                                  onClick={() => handleRestoreDeleted(member)}
                                  disabled={restoringDeleted === member.memberId || restartingDeleted === member.memberId}
                                  aria-busy={restoringDeleted === member.memberId || undefined}
                                >
                                  {restoringDeleted === member.memberId ? '…' : 'restore'}
                                </button>
                                <button
                                  type="button"
                                  className="mdir-teamsbtn"
                                  onClick={() => handleRestartAsApplicant(member)}
                                  disabled={restoringDeleted === member.memberId || restartingDeleted === member.memberId}
                                  aria-busy={restartingDeleted === member.memberId || undefined}
                                  title="Send back through the apply flow as a fresh applicant - for demo accounts, not real reinstatements."
                                >
                                  {restartingDeleted === member.memberId ? '…' : 'restart as applicant'}
                                </button>
                              </>
                            ) : (
                              <>
                                {canTeams && (
                                  <button
                                    type="button"
                                    className="mdir-teamsbtn"
                                    onClick={() => setTeamsTarget({ memberId: member.memberId, fullName: member.fullName })}
                                    title={`Teams for ${member.fullName}`}
                                  >
                                    teams
                                  </button>
                                )}
                                {canTeams && (
                                  <button
                                    type="button"
                                    className="mdir-teamsbtn"
                                    onClick={() => handleArchive(member)}
                                    disabled={archiving === member.memberId || (statusFilter !== 'archived' && !canArchiveMember(currentMember?.role, member.role, isSelf))}
                                    aria-busy={archiving === member.memberId || undefined}
                                    title={(statusFilter !== 'archived' && archiveBlockedReason(currentMember?.role, member.role, isSelf))
                                      || (statusFilter === 'archived' ? 'Bring them back' : 'They have left AQ')}
                                  >
                                    {archiving === member.memberId ? '…' : statusFilter === 'archived' ? 'restore' : 'archive'}
                                  </button>
                                )}
                                {showDeleteControl(currentMember?.role, statusFilter) && (
                                  <button
                                    onClick={() => !(isSelf || isProtectedAdmin) && setDeleteTarget({ memberId: member.memberId, fullName: member.fullName, email: member.email })}
                                    disabled={isSelf || isProtectedAdmin}
                                    className="btn btn-sm"
                                    style={{ background: 'none', color: 'var(--ink-3)', minWidth: 32, opacity: (isSelf || isProtectedAdmin) ? 0.3 : 1 }}
                                    title={isSelf ? "You can't delete yourself" : isProtectedAdmin ? 'Only a super admin can delete this account' : 'Delete account'}
                                    aria-label={`Delete ${member.fullName}'s account`}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                      <path d="M4 7h16" /><path d="M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                                      <path d="M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13" /><path d="M10 11v6" /><path d="M14 11v6" />
                                    </svg>
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </LongPressTr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* A card GRID, not a dense list - `.adm-grid` so director.css's
              tablet (2col) / phone (1col, no horizontal scroll) rules apply. */}
          <div className="adm-grid mdir-grid mdir-grid-wrap" style={{ marginBottom: 16 }}>
            {visibleMembers.map(member => (
              <LongPressCard
                key={member.memberId}
                className="card mdir-card"
                enabled={canBreakMember(member.memberId)}
                onLongPress={(x, y) => setLongPressMenu({ memberId: member.memberId, fullName: member.fullName, x, y })}
              >
                {selectMode && canBreakMember(member.memberId) && (
                  <input
                    type="checkbox"
                    aria-label={`Select ${member.fullName}`}
                    checked={selectedIds.has(member.memberId)}
                    onClick={e => e.stopPropagation()}
                    onChange={() => toggleSelected(member.memberId)}
                    style={{ position: 'absolute', top: 10, right: 10, width: 18, height: 18, zIndex: 1 }}
                  />
                )}
                <Link to={`/profile/${member.uuid}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <div className="mdir-card-top">
                    <div className="adm-avatar" aria-hidden>
                      {member.avatarUrl
                        ? <Img ctx="avatar" src={member.avatarUrl} alt="" referrerPolicy="no-referrer" />
                        : <div className="adm-avatar-fallback" style={{ background: hashColor(member.fullName) }}>{getInitials(member.fullName)}</div>}
                    </div>
                    <div className="mdir-ident">
                      <div className="row gap-2" style={{ marginBottom: 3, flexWrap: 'wrap' }}>
                        <span className="mdir-name">{member.fullName}</span>
                        {/* role-hod (sky) / role-director (pink) are the shared color vocabulary
                            (v6.css) - these were previously swapped (HoD rendered pink, Director
                            rendered sky) via ad-hoc inline overrides; use the matching class per role
                            instead of hand-picking a color each time. */}
                        {isSuperAdminRole(member.role) && <span className="role" style={{ fontSize: 11, background: 'var(--hod-danger)', color: '#fff' }}>{getRoleLabel(member.role)}</span>}
                        {member.role === 'hod' && <span className="role role-hod" style={{ fontSize: 11 }}>HoD</span>}
                        {member.role === 'director' && <span className="role role-director" style={{ fontSize: 11 }}>Director</span>}
                      </div>
                      {/* Item 5.1, "auto-hydrate with the real fields". School
                          (1,034 of 1,379 members) and Instagram (552) were
                          already in the fetched row - the query is a
                          `select('*')` on a view that carries both - and were
                          being dropped by the mapper. They join the two lines
                          that already exist rather than adding new ones: the
                          card was measured at its density floor on 2026-09-11
                          (257px at 375px wide) and two more rows would undo
                          that pass. Net height change: zero. */}
                      {(member.classGrade || member.schoolName) && (
                        <div className="mdir-line">
                          {[member.classGrade, member.schoolName].filter(Boolean).join(' · ')}
                        </div>
                      )}
                      <div className="mdir-line" style={{ marginTop: 3 }}>
                        joined {formatDate(member.createdAt)}
                      </div>
                    </div>
                  </div>
                </Link>
                {/* Contacts sit OUTSIDE the <Link>. Two reasons, both real: a
                    <button> nested in an <a> is invalid HTML and gets an
                    unpredictable activation target, and a reveal that fired
                    because someone tapped the card on the way to the profile is
                    exactly the accidental audit row this section exists to
                    avoid. Revealing here is always deliberate.

                    ITEM 5.2, owner's decision 2026-09-11: the two contact rows
                    are now COLLAPSED BEHIND A TAP. This reverses the previous
                    decision that they stay visible, and it is the owner's to
                    reverse - the density pass had taken the card to 257px on a
                    375px viewport and reported that the remaining ~215px was
                    content that could not shrink under a 44px tap floor. The
                    contact pair is ~106px of that, so hiding it is the single
                    biggest thing available.

                    What does NOT change: revealing a number is still a
                    deliberate act and still writes a `contact_access_log` row
                    naming the viewer, the member and the time. This adds one
                    tap in front of that; it does not weaken the audit, and the
                    standing notice above the list still says so. */}
                {contactsOpen.has(member.memberId) ? (
                  <div className="mdir-contactrow">
                    <span className="mdir-contact-label">email</span>
                    {renderContact(member.memberId, member.fullName, 'email', member.email)}
                    <span className="mdir-contact-label">phone</span>
                    {renderContact(member.memberId, member.fullName, 'phone', member.phone)}
                    <span className="mdir-contact-label">instagram</span>
                    {renderContact(member.memberId, member.fullName, 'instagram', instagramHandle(member.instagram))}
                    <button
                      type="button"
                      className="mdir-contacts-toggle"
                      onClick={() => toggleContacts(member.memberId)}
                      aria-expanded
                      aria-label={`Hide contact details for ${member.fullName}`}
                    >
                      hide
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="mdir-contacts-toggle mdir-contacts-toggle--closed"
                    onClick={() => toggleContacts(member.memberId)}
                    aria-expanded={false}
                    aria-label={`Show contact details for ${member.fullName}`}
                  >
                    contacts
                  </button>
                )}
                {/* Item 4.4, "assign teams to people from the Members desk".
                    Deliberately inside the EXISTING `.mdir-admin` row rather
                    than a new line on the card: the card was measured at its
                    density floor on 2026-09-11 (257px at 375px wide) and eight
                    teams' worth of chips per card would undo that pass. The
                    trigger adds no height. It is `leader`, not super-admin
                    only - putting someone on a team is ordinary HoD work, and
                    team_members' own RLS is the real gate. */}
                {/* A deleted row gets two controls: restore (back to active,
                    the real reinstatement path) and restart (back to
                    pending_approval, for a demo account someone wants to
                    re-run the apply funnel on - 2026-09-14). Teams/break/
                    archive/role-change/delete on an already-deleted account
                    either mean nothing or double up on state this view
                    exists to undo, so they're skipped entirely rather than
                    shown disabled. */}
                {isReadOnlyStatusView(statusFilter) ? (
                  showApprovalsLink(currentMember?.role, statusFilter) ? (
                    <div className="mdir-admin" onClick={e => e.preventDefault()}>
                      <Link to="/director/approvals" className="mdir-teamsbtn">review in Approvals</Link>
                    </div>
                  ) : null
                ) : statusFilter === 'deleted' ? (
                  <div className="mdir-admin" onClick={e => e.preventDefault()} style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="mdir-teamsbtn"
                      onClick={() => handleRestoreDeleted(member)}
                      disabled={restoringDeleted === member.memberId || restartingDeleted === member.memberId}
                    >
                      {restoringDeleted === member.memberId ? '…' : 'restore'}
                    </button>
                    <button
                      type="button"
                      className="mdir-teamsbtn"
                      onClick={() => handleRestartAsApplicant(member)}
                      disabled={restoringDeleted === member.memberId || restartingDeleted === member.memberId}
                      title="Send back through the apply flow as a fresh applicant - for demo accounts, not real reinstatements."
                    >
                      {restartingDeleted === member.memberId ? '…' : 'restart as applicant'}
                    </button>
                  </div>
                ) : hasLeaderAccess(currentMember?.role) && (
                  <div className="mdir-admin" onClick={e => e.preventDefault()}>
                    <button
                      type="button"
                      className="mdir-teamsbtn"
                      onClick={() => setTeamsTarget({ memberId: member.memberId, fullName: member.fullName })}
                      title={`Teams for ${member.fullName}`}
                    >
                      teams
                    </button>
                    {/* Item 3.1. Archiving is NOT deleting - the row, the
                        posts, the drives and the wall notes all stay; the
                        person just comes off the live lists. So it sits next
                        to the teams control at ordinary weight, not next to
                        the destructive delete button, and it is reversible
                        from the Archive pill with one tap. Leader-level for
                        the same reason team assignment is: recording that
                        someone has left is ordinary HoD work. */}
                    <button
                      type="button"
                      className="mdir-teamsbtn"
                      onClick={() => handleArchive(member)}
                      disabled={archiving === member.memberId || (statusFilter !== 'archived' && !canArchiveMember(currentMember?.role, member.role, member.memberId === currentMember?.member_id))}
                      title={(statusFilter !== 'archived' && archiveBlockedReason(currentMember?.role, member.role, member.memberId === currentMember?.member_id))
                        || (statusFilter === 'archived' ? 'Bring them back' : 'They have left AQ')}
                    >
                      {archiving === member.memberId ? '…' : statusFilter === 'archived' ? 'restore' : 'archive'}
                    </button>
                    {/* Put-on-break: widened 2026-09-12 alongside
                        hr_set_member_break()'s own widening (is_super_admin()
                        OR is_team_lead_of_member()), then scoped the same day
                        via `myTeamMemberIds` (a live team_members fetch) so a
                        HoD only sees this for members actually on one of
                        their own teams - the RPC stays the real boundary
                        either way, this just keeps the button from offering
                        something it would refuse. */}
                    {canBreakMember(member.memberId) && (
                      <button
                        type="button"
                        className="mdir-teamsbtn"
                        onClick={() => setBreakTarget({ memberId: member.memberId, fullName: member.fullName })}
                        title={`Put ${member.fullName} on a break`}
                      >
                        break
                      </button>
                    )}
                    {/* The role select and the delete control stay SUPER-ADMIN
                        ONLY - the row's condition widened to `leader` for the
                        teams button above, and these two must not widen with
                        it. Deleting an account and changing a role are the two
                        most consequential controls on this desk. */}
                    {isSuperAdmin && (() => {
                      const isSelf = member.memberId === currentMember?.member_id
                      const isProtectedAdmin = isSuperAdminRole(member.role) && !isSuperAdmin
                      const disabled = roleChanging === member.memberId || isSelf || isProtectedAdmin || !canAssignRole
                      return (
                        <select
                          className="mdir-select"
                          value={member.role || 'member'}
                          disabled={disabled}
                          onChange={e => handleRoleChange(member.memberId, member.fullName, e.target.value as AQRole)}
                          aria-label={`Role for ${member.fullName}`}
                          aria-busy={roleChanging === member.memberId || undefined}
                          title={!canAssignRole ? 'Your role cannot change roles' : isSelf ? "You can't change your own role" : isProtectedAdmin ? 'Only a super admin can change this role' : 'Change role'}
                        >
                          <option value="member">Member</option>
                          <option value="hod">HoD</option>
                          <option value="director">Director</option>
                          {/* Only show super_admin option to super_admins; otherwise it just appears for display purposes */}
                          {(isSuperAdmin || isSuperAdminRole(member.role)) && (
                            <option value="super_admin">Super Admin</option>
                          )}
                        </select>
                      )
                    })()}
                    {isSuperAdmin && (() => {
                      const isSelf = member.memberId === currentMember?.member_id
                      const isProtectedAdmin = isSuperAdminRole(member.role) && !isSuperAdmin
                      const disabled = isSelf || isProtectedAdmin
                      return (
                        <button
                          onClick={() => !disabled && setDeleteTarget({ memberId: member.memberId, fullName: member.fullName, email: member.email })}
                          disabled={disabled}
                          className="btn btn-sm"
                          style={{
                            background: 'none',
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            // 44 not 40: inline styles beat the stylesheet's phone
                            // touch-target floor, so this has to carry it itself.
                            color: 'var(--ink-3)', minWidth: 44, justifyContent: 'center', flexShrink: 0,
                            opacity: disabled ? 0.3 : 1,
                          }}
                          title={isSelf ? "You can't delete yourself" : isProtectedAdmin ? 'Only a super admin can delete this account' : 'Delete account'}
                          aria-label={`Delete ${member.fullName}'s account`}
                        >
                          {/* REAL BUG, fixed: this rendered as a bare 🗑 emoji at
                              fontSize 14 - the desk's font stack has no colour-emoji
                              glyph for that character, so it drew as an illegible
                              ~10.5px vertical stroke on the product's most
                              destructive control. Outline SVG instead. */}
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M4 7h16" />
                            <path d="M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                            <path d="M6 7l1 13a2 2 0 002 2h6a2 2 0 002-2l1-13" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                          </svg>
                        </button>
                      )
                    })()}
                  </div>
                )}
              </LongPressCard>
            ))}
          </div>
          {hasMore && (
            <div ref={loadMoreRef} style={{ textAlign: 'center', padding: '12px 0', minHeight: 1 }}>
              {isLoadingMore && <span className="mono xs muted">loading...</span>}
            </div>
          )}
        </>
      )}

      {selectMode && (
        <BulkActionBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())}>
          <button type="button" className="btn btn-sm btn-primary" onClick={openBulkBreak}>
            put {selectedIds.size} on a break
          </button>
        </BulkActionBar>
      )}

      {/* Item 4.4 - assign this member to teams, from the Members side. */}
      {teamsTarget && (
        <MemberTeamsDialog
          memberId={teamsTarget.memberId}
          memberName={teamsTarget.fullName}
          onClose={() => setTeamsTarget(null)}
        />
      )}

      {breakTarget && (
        <MemberBreakDialog
          memberId={breakTarget.memberId}
          memberName={breakTarget.fullName}
          onClose={() => setBreakTarget(null)}
        />
      )}

      {bulkBreakTargets && (
        <MemberBreakDialog
          members={bulkBreakTargets}
          onClose={() => setBulkBreakTargets(null)}
        />
      )}

      {/* Item 2 - the long-press/right-click quick-action shortcut. A fixed-
          position menu at the press point rather than a full modal - this is
          a faster path to the same `setBreakTarget` the row's own "break"
          button already opens, not a new surface. */}
      {longPressMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={closeLongPressMenu} />
          <div
            role="menu"
            className="card"
            style={{
              position: 'fixed', zIndex: 41, padding: 6, minWidth: 168,
              left: Math.min(longPressMenu.x, window.innerWidth - 180),
              top: Math.min(longPressMenu.y, window.innerHeight - 90),
            }}
          >
            <div className="mono xs muted" style={{ padding: '4px 8px' }}>{longPressMenu.fullName}</div>
            <button
              type="button"
              role="menuitem"
              className="btn btn-sm"
              style={{ width: '100%', justifyContent: 'flex-start' }}
              onClick={() => { setBreakTarget({ memberId: longPressMenu.memberId, fullName: longPressMenu.fullName }); closeLongPressMenu() }}
            >
              put on a break
            </button>
          </div>
        </>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="modal-back" onClick={e => { if (e.target === e.currentTarget && !isDeleting) setDeleteTarget(null) }}>
          <div ref={deletePanelRef} role="dialog" aria-modal="true" aria-label="Delete account" className="modal">
            <div className="modal-head">
              <h3 style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.01em', margin: 0, color: 'var(--hod-danger)' }}>Delete account</h3>
              <button className="btn btn-sm" onClick={() => setDeleteTarget(null)} disabled={isDeleting} aria-label="Close">✕</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 10 }}>delete <strong>{deleteTarget.fullName}</strong>'s account ({deleteTarget.email})?</p>
              <p className="mono xs" style={{ color: 'var(--ink-3)', lineHeight: 1.6, marginBottom: 16 }}>
                this removes their account from every active list - the directory, the feed, search, everywhere. nothing is actually deleted: their posts, comments, likes and session data all stay, and a super admin can restore the account in full from the "deleted" filter.
              </p>
              <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
                <button onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="btn btn-sm">cancel</button>
                {isDeleting ? (
                  <button disabled className="btn btn-sm" style={{ background: 'var(--hod-danger)', color: '#fff', border: 'none' }}>...</button>
                ) : (
                  <HoldToConfirmButton holdMs={1200} danger label="hold to delete account" onConfirm={handleDelete} />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      </div>
    </AdminLayout>
  )
}

export default MemberDirectory
