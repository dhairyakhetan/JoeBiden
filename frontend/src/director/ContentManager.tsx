import { useState, useEffect, useCallback, useMemo, useRef, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowTopRightOnSquareIcon,
  ChatBubbleBottomCenterTextIcon,
  ChevronDownIcon,
  ClockIcon,
  HeartIcon,
  MapPinIcon,
  PencilSquareIcon,
  StarIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { sanitizeFilterTerm } from '../lib/pgrestEscape'
import { withRetry } from '../lib/asyncUtils'
import feedService from '../services/feedService'
import { directorService } from '../services/directorService'
import { useDebounce } from '../hooks/useDebounce'
import {
  AdminLayout, AdminTabHeader, DataToolbar, FilterPill, EmptyLedger, AdminErrorState,
  AdminSkeleton, StatusStamp, AdminRowActions, BottomSheet, useIsPhone,
  type StampTone,
} from './adminKit'
import { useConfirm } from '../components/Confirm'
import { useCan } from '../auth/CapabilityContext'
import { useAuth } from '../auth/AuthContext'
import { logAction } from '../lib/auditLog'
import { useToast } from '../components/Toast'
import { CAT_COLORS, timeAgo } from '../lib/uiHelpers'

interface ManagedPost {
  postId: number
  uuid: string
  body: string
  category: string
  status: string
  authorName: string
  authorUuid: string
  createdAt: string
  likeCount: number
  commentCount: number
  pinned: boolean
  featured: boolean
  scheduledFor: string | null
}

// Status → StatusStamp tone (the Field Ledger's ink-stamp vocabulary).
const STATUS_TONE: Record<string, StampTone> = {
  published:      'approved',
  pending_review: 'pending',
  rejected:       'rejected',
  scheduled:      'pending',
}

/** The desk's review target, in hours. Only used to decide whether the SLA
 *  banner appears and to name the target on it. */
const SLA_HOURS = 48

/** Whole hours a timestamp is in the past. Negative for a future time. */
const hoursSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / 36e5

/**
 * The triage deck is a >= 1025px composition. `useIsPhone` already owns the
 * <= 600px question for row actions; this is the other end of the same idea,
 * and it is a PRESENTATION branch only - both branches read the same `posts`
 * state and call the same handlers.
 */
function useIsDesk(): boolean {
  const [isDesk, setIsDesk] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1025px)').matches,
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(min-width: 1025px)')
    const onChange = () => setIsDesk(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return isDesk
}

const ContentManager = () => {
  const confirm = useConfirm()
  // /director/roles capability. Can only narrow the posts DELETE policy.
  const canDeletePost = useCan('action.delete_post')
  // Moderation actions (verdicts, status, edit, pin, feature) narrow the same way.
  const canModerate = useCan('action.moderate_post')
  const { member: me } = useAuth()
  const [rejecting, setRejecting] = useState<ManagedPost | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const toast = useToast()
  const isPhone = useIsPhone()
  const isDesk = useIsDesk()
  const [posts, setPosts] = useState<ManagedPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  /** The last load's failure message, or null. Kept on screen (unlike the
   *  toast) so the desk cannot sit there reading "no posts found". */
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'pending_review' | 'rejected' | 'scheduled'>('all')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [total, setTotal] = useState(0)
  // A7 - true until a fetch has to fall back to COLS_BASE, i.e. until the
  // `featured` column is proved missing. The feature button renders disabled
  // with its existing tooltip rather than pretending the flag is simply off.
  const [featuredAvailable, setFeaturedAvailable] = useState(true)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editBody, setEditBody] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  // A2 - post ids whose body the reader has chosen to expand past the 4-line
  // clamp. Per row, never desk-wide.
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [pinningId, setPinningId] = useState<number | null>(null)
  const [featuringId, setFeaturingId] = useState<number | null>(null)
  const [statusChangingId, setStatusChangingId] = useState<number | null>(null)

  // Deck state. `deckIndex` is an index into `posts`; `keysOpen` is the ? sheet.
  const [deckIndex, setDeckIndex] = useState(0)
  const [keysOpen, setKeysOpen] = useState(false)
  const railRef = useRef<HTMLDivElement | null>(null)
  const railItemRefs = useRef<Array<HTMLButtonElement | null>>([])

  const debouncedSearch = useDebounce(search, 300)

  const fetchPosts = useCallback(async (pageNum: number, q: string, status: string, append = false) => {
    if (append) setIsLoadingMore(true); else setIsLoading(true)
    try {
      // Read from post_feed_view - it already filters deleted_at IS NULL, has
      // author info inlined (no FK ambiguity), and exposes like_count /
      // comment_count. Writes still target the `posts` table directly below.
      // `featured` (posts_featured_flag_2026_07.sql) may not exist on the view
      // yet if that migration hasn't been applied. Select it, but fall back to
      // a select without it on a "column does not exist" error so this critical
      // moderation tab never breaks just because the migration is pending - the
      // feature toggle simply reads as "off" for every post until then.
      const COLS_WITH_FEATURED = `post_id, uuid, body, category, status, created_at, pinned, featured,
          author_uuid, author_name, like_count, comment_count, scheduled_for`
      const COLS_BASE = `post_id, uuid, body, category, status, created_at, pinned,
          author_uuid, author_name, like_count, comment_count, scheduled_for`

      const runQuery = (cols: string) => {
        let query = supabaseCommunity
          .from('post_feed_view')
          .select(cols, { count: 'exact' })
          .order('created_at', { ascending: false })
          .range((pageNum - 1) * 20, pageNum * 20 - 1)
        if (status !== 'all') query = query.eq('status', status)
        // `body` AND `article_body`: for a blog, `body` is the ~630-char
        // generated excerpt, so searching this desk for a phrase from the
        // middle of an essay found nothing. Same fix searchService got;
        // article_body is exposed on post_feed_view for filtering only and
        // is deliberately absent from the select list below.
        //
        // sanitizeFilterTerm is REQUIRED now and was not before: inside
        // `.ilike(col, value)` the term is a value, but inside `.or(...)` a
        // comma or a bracket is filter GRAMMAR, so an unescaped one 400s the
        // whole request. Same guard searchService applies for the same reason.
        const safeQ = sanitizeFilterTerm(q)
        if (safeQ) query = query.or(`body.ilike.%${safeQ}%,article_body.ilike.%${safeQ}%`)
        return query
      }

      // withRetry - this tab's own "Lock ... was released because another
      // request stole it" reports were the navigator-lock cold-load race
      // asyncUtils.ts documents: a query fired before supabase-js's session
      // restore had settled, the lock got stolen out from under it, and the
      // request neither resolved nor rejected on its own. jobOpenings.ts and
      // searchService.ts already wrap their reads in this for the same
      // reason; this desk's own fetch never got it.
      let { data, count, error } = await withRetry(async () => await runQuery(COLS_WITH_FEATURED))
      if (error && /featured/.test(error.message || '')) {
        setFeaturedAvailable(false)
        ;({ data, count, error } = await withRetry(async () => await runQuery(COLS_BASE)))
      }
      if (error) throw error

      const mapped: ManagedPost[] = (data || []).map((p: any) => ({
        postId: p.post_id,
        uuid: p.uuid,
        body: p.body,
        category: p.category,
        status: p.status,
        authorName: p.author_name || 'Unknown',
        authorUuid: p.author_uuid || '',
        createdAt: p.created_at,
        likeCount: p.like_count || 0,
        commentCount: p.comment_count || 0,
        pinned: p.pinned || false,
        featured: p.featured || false,
        scheduledFor: p.scheduled_for ?? null,
      }))

      if (!append) setLoadError(null)
      if (append) setPosts(prev => [...prev, ...mapped]); else setPosts(mapped)
      setTotal(count || 0)
      setHasMore((count || 0) > pageNum * 20)
    } catch (e: any) {
      const msg = e?.message || String(e)
      console.error('ContentManager fetch error:', e)
      // A toast is not enough on its own: it disappears, and what stays on
      // screen is "no posts found", which reads as a measured answer. The desk
      // needs to keep saying the load failed.
      if (!append) setLoadError(msg)
      toast.error(`Could not load posts - ${msg}`)
    }
    finally { setIsLoading(false); setIsLoadingMore(false) }
  }, [])

  useEffect(() => { setPage(1); fetchPosts(1, debouncedSearch, statusFilter) }, [debouncedSearch, statusFilter, fetchPosts])

  // A new filter or search rebuilds the list, so the deck's cursor and the
  // expanded bodies both belong to a list that no longer exists.
  useEffect(() => { setDeckIndex(0); setExpandedIds(new Set()) }, [debouncedSearch, statusFilter])

  const flash = (msg: string, isErr = false) => { if (isErr) toast.error(msg); else toast.success(msg) }

  const denyModerate = () => { toast.error('you don’t have permission to moderate posts.', 'ask a super admin to re-enable it on /director/roles.') }

  const handleSaveEdit = async (post: ManagedPost) => {
    if (!canModerate) { denyModerate(); return }
    if (!editBody.trim()) return
    setIsSaving(true)
    try {
      await feedService.updatePost(post.uuid, { body: editBody.trim() })
      setPosts(prev => prev.map(p => p.postId === post.postId ? { ...p, body: editBody.trim() } : p))
      setEditingId(null)
      // Editing someone else's words is a staff action worth a trace.
      if (!me?.uuid || me.uuid !== post.authorUuid) {
        logAction('post_edited_by_staff', 'post', post.postId, { author: post.authorName })
      }
      flash(`Post by ${post.authorName} updated.`)
    } catch (e: any) {
      flash(e?.message ?? 'Failed to update post.', true)
    }
    finally { setIsSaving(false) }
  }

  const handleDelete = async (post: ManagedPost) => {
    // Set on /director/roles. Narrows the posts DELETE policy, never widens it.
    if (!canDeletePost) return
    const ok = await confirm({ title: 'Delete post?', body: 'This takes the post off the feed, search and this desk. It can’t be undone from here.', confirmLabel: 'Delete', danger: true })
    if (!ok) return
    setDeletingId(post.postId)
    try {
      await feedService.deletePost(post.uuid)
      logAction('post_deleted_by_staff', 'post', post.postId, { author: post.authorName })
      setPosts(prev => prev.filter(p => p.postId !== post.postId))
      setTotal(t => t - 1)
      flash(`Post deleted.`)
    } catch (e: any) {
      flash(e?.message ?? 'Failed to delete.', true)
    }
    finally { setDeletingId(null) }
  }

  const handleStatusChange = async (post: ManagedPost, newStatus: string, reason?: string) => {
    if (newStatus === post.status) return
    if (!canModerate) { denyModerate(); return }
    // Rejecting needs a reason the author will read: collect it first.
    if (newStatus === 'rejected' && reason === undefined) {
      setRejectReason(''); setRejecting(post); return
    }
    // Moving off 'scheduled' cancels the timed publish and there is no way to
    // restore it from any screen - confirm before a stray <select> change wipes it.
    if (post.status === 'scheduled') {
      const ok = await confirm({
        title: newStatus === 'published' ? 'Publish this post now?' : 'Cancel the scheduled publish?',
        body: newStatus === 'published'
          ? 'It goes live immediately instead of at its scheduled time.'
          : 'The scheduled time will be cleared and the post will not auto-publish.',
        confirmLabel: newStatus === 'published' ? 'Publish now' : 'Cancel schedule',
        danger: newStatus !== 'published',
      })
      if (!ok) return
    }
    setStatusChangingId(post.postId)
    try {
      // Approve / reject go through directorService, which stamps the reviewer,
      // writes the audit row and tells the author.
      if (newStatus === 'rejected' || (newStatus === 'published' && post.status !== 'scheduled')) {
        if (newStatus === 'rejected') await directorService.rejectPost(post.postId, reason ?? '')
        else await directorService.approvePost(post.postId)
        setPosts(prev => prev.map(p => p.postId === post.postId ? { ...p, status: newStatus, scheduledFor: null } : p))
        flash(newStatus === 'rejected' ? 'Post rejected. The author has been told why.' : 'Post approved. The author has been told.')
        return true
      }
      // Build a real audit-trail update: stamp reviewer + timestamp, and clear
      // rejection_note when transitioning out of 'rejected'.
      const reviewerId = await directorService.getCurrentMemberId()
      const baseUpdate = {
        status: newStatus,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        ...(newStatus !== 'rejected' ? { rejection_note: null } : {}),
        // Leaving a scheduled post: drop the timer so scheduled_for can never
        // linger on a non-scheduled row (a stale value would re-fire at the old
        // time if the row ever went back to 'scheduled').
        ...(post.status === 'scheduled' && newStatus !== 'scheduled' ? { scheduled_for: null } : {}),
        // "Publish now" must match what the cron does when it auto-publishes -
        // reset created_at so the post lands at the top of the feed instead of
        // being buried at its authoring time (every feed query orders by it).
        ...(post.status === 'scheduled' && newStatus === 'published'
          ? { created_at: new Date().toISOString() }
          : {}),
      }

      // Cast: the generated types predate scheduled_posts_2026_07.sql, so
      // `scheduled_for` isn't in the Posts Update type yet (same pattern as
      // feedService's `stats` / post_documents casts).
      const { error } = await (supabaseCommunity.from('posts') as any)
        .update(baseUpdate)
        .eq('post_id', post.postId)
      if (error) throw error
      logAction('post_status_changed', 'post', post.postId, { from: post.status, to: newStatus })

      setPosts(prev => prev.map(p => p.postId === post.postId
        ? { ...p, status: newStatus, scheduledFor: newStatus === 'scheduled' ? p.scheduledFor : null }
        : p))
      flash(`Status → ${newStatus}`)
      return true
    } catch (e: any) {
      // A11 - the optimistic state is never written before the update resolves,
      // so a failure leaves the row exactly where it was. Name the failure.
      flash(e?.message ?? 'Status update failed.', true)
      return false
    } finally {
      setStatusChangingId(null)
    }
  }

  const handleTogglePin = async (post: ManagedPost) => {
    if (!canModerate) { denyModerate(); return }
    setPinningId(post.postId)
    try {
      const newPinned = !post.pinned
      await feedService.pinPost(post.uuid, newPinned)
      setPosts(prev => prev.map(p => p.postId === post.postId ? { ...p, pinned: newPinned } : p))
      flash(newPinned ? 'Pinned to notice board' : 'Unpinned from notice board')
    } catch (e: any) {
      flash(e?.message ?? 'Pin update failed.', true)
    }
    finally { setPinningId(null) }
  }

  // Feature/unfeature on the Projects page's "featured drives" band - separate
  // from pin (notice board). Requires posts_featured_flag_2026_07.sql.
  const handleToggleFeature = async (post: ManagedPost) => {
    if (!canModerate) { denyModerate(); return }
    setFeaturingId(post.postId)
    try {
      const newFeatured = !post.featured
      await feedService.featurePost(post.uuid, newFeatured)
      setPosts(prev => prev.map(p => p.postId === post.postId ? { ...p, featured: newFeatured } : p))
      flash(newFeatured ? 'Featured on the Projects page' : 'Removed from featured')
    } catch (e: any) {
      flash(e?.message ?? 'Feature update failed - has the featured migration been run?', true)
    }
    finally { setFeaturingId(null) }
  }

  /* ── Derived, from rows already in state. No new query. ────────────────── */

  // The oldest thing still waiting, in hours. Null when nothing is queued.
  const oldestWaitHours = useMemo(() => {
    const queued = posts.filter(p => p.status === 'pending_review')
    if (queued.length === 0) return null
    return Math.floor(Math.max(...queued.map(p => hoursSince(p.createdAt))))
  }, [posts])

  const queuedCount = useMemo(() => posts.filter(p => p.status === 'pending_review').length, [posts])

  const clearFilters = () => { setSearch(''); setStatusFilter('all') }

  /* ── The deck's keyboard layer (B7). Bound to the deck container via its
       own tabIndex, never to `document`, so typing in the search field is
       never captured. ── */
  const current = posts[deckIndex]

  const moveDeck = (delta: number) => {
    setDeckIndex(i => {
      const next = Math.min(posts.length - 1, Math.max(0, i + delta))
      // 12a - scroll the rail with scrollTop arithmetic, never scrollIntoView,
      // which would also scroll the page and yank the detail pane away.
      const rail = railRef.current
      const item = railItemRefs.current[next]
      if (rail && item) {
        const top = item.offsetTop - rail.offsetTop
        const bottom = top + item.offsetHeight
        if (top < rail.scrollTop) rail.scrollTop = top - 8
        else if (bottom > rail.scrollTop + rail.clientHeight) rail.scrollTop = bottom - rail.clientHeight + 8
      }
      return next
    })
  }

  const verdict = async (post: ManagedPost, newStatus: 'published' | 'rejected') => {
    if (!canModerate) { denyModerate(); return }
    if (newStatus === 'rejected') { setRejectReason(''); setRejecting(post); return }
    const ok = await handleStatusChange(post, newStatus)
    // 12a - advance to the next item after a decision. The decided row stays
    // in the rail until the next refetch, so an undo can restore it in place.
    if (ok) moveDeck(1)
  }

  const onDeckKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { setKeysOpen(false); return }
    if (e.key === '?') { e.preventDefault(); setKeysOpen(true); return }
    if (!current) return
    if (e.key === 'j' || e.key === 'J') { e.preventDefault(); moveDeck(1); return }
    if (e.key === 'k' || e.key === 'K') { e.preventDefault(); moveDeck(-1); return }
    if (e.key === 'a' || e.key === 'A') { e.preventDefault(); verdict(current, 'published'); return }
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); verdict(current, 'rejected') }
  }

  /* ── Small presentational helpers shared by both compositions. ────────── */

  const catAccent = (category: string) => CAT_COLORS[category] || 'var(--welfare)'

  const scheduleLine = (post: ManagedPost) => {
    if (post.status !== 'scheduled' || !post.scheduledFor) return null
    const overdueBy = Math.floor(hoursSince(post.scheduledFor))
    // A9 - a scheduled time already in the past is not "pending", and showing
    // it as a future time is a lie the desk can check for free.
    if (overdueBy > 0) {
      return <span className="cm-overdue">overdue by {overdueBy}h</span>
    }
    return (
      <span className="cm-sched">
        <ClockIcon width={11} height={11} strokeWidth={1.8} aria-hidden />
        publishes {new Date(post.scheduledFor).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
      </span>
    )
  }

  const authorNode = (post: ManagedPost) => (
    // A3 - a deleted author resolves to no uuid. Keep the mapper's `Unknown`
    // fallback and drop the profile link rather than leave it dangling.
    post.authorUuid
      ? <Link to={`/profile/${post.authorUuid}`} className="cm-author">{post.authorName}</Link>
      : <span className="cm-author">{post.authorName}</span>
  )

  const rowActions = (post: ManagedPost) => (
    <>
      <Link to={`/post/${post.uuid}`} className="adm-actpill">
        view <ArrowTopRightOnSquareIcon width={13} height={13} strokeWidth={1.8} aria-hidden />
      </Link>
      {canModerate && <button type="button" className="adm-actpill"
        onClick={() => { setEditingId(post.postId); setEditBody(post.body) }}>
        <PencilSquareIcon width={13} height={13} strokeWidth={1.8} aria-hidden />edit
      </button>}
      {canModerate && post.status === 'published' && (
        <button
          type="button"
          className={'adm-actpill' + (post.pinned ? ' is-on' : '')}
          disabled={pinningId === post.postId}
          onClick={() => handleTogglePin(post)}
          style={post.pinned ? { color: 'var(--welfare)' } : undefined}
          title={post.pinned ? 'Unpin from notice board' : 'Pin to notice board'}
        >
          <MapPinIcon width={13} height={13} strokeWidth={1.8} aria-hidden />
          {pinningId === post.postId ? 'pinning…' : post.pinned ? 'pinned' : 'pin'}
        </button>
      )}
      {/* Feature on the Projects page - distinct from pin (notice board).
          Only meaningful for published posts. */}
      {canModerate && post.status === 'published' && (
        <button
          type="button"
          className={'adm-actpill' + (post.featured ? ' is-on' : '')}
          disabled={featuringId === post.postId || !featuredAvailable}
          onClick={() => handleToggleFeature(post)}
          // --grape measured 4.35:1 as 11px text (AA needs 4.5) - darkened for
          // the label while the border keeps the undarkened hue.
          style={post.featured ? { color: 'color-mix(in srgb, var(--grape) 78%, black)', borderColor: 'var(--grape)' } : undefined}
          title={
            !featuredAvailable
              ? 'Feature update failed - has the featured migration been run?'
              : post.featured ? 'Remove from the Projects featured drives' : 'Feature on the Projects page'
          }
        >
          <StarIcon width={13} height={13} strokeWidth={1.8} aria-hidden />
          {featuringId === post.postId ? 'saving…' : post.featured ? 'featured' : 'feature'}
        </button>
      )}
      {canDeletePost && (
        <button
          type="button"
          className="adm-actpill is-danger"
          onClick={() => handleDelete(post)}
          disabled={deletingId === post.postId}
        >
          <TrashIcon width={13} height={13} strokeWidth={1.8} aria-hidden />
          {deletingId === post.postId ? 'deleting…' : 'delete'}
        </button>
      )}
    </>
  )

  const statusSelect = (post: ManagedPost) => (
    <span className="adm-selectpill">
      <select
        value={post.status}
        onChange={e => handleStatusChange(post, e.target.value)}
        disabled={statusChangingId === post.postId || !canModerate}
        aria-label={`Status of the post by ${post.authorName}`}
      >
        {post.status === 'scheduled' && <option value="scheduled">scheduled</option>}
        <option value="published">{post.status === 'scheduled' ? 'publish now' : 'published'}</option>
        <option value="pending_review">queued</option>
        <option value="rejected">rejected</option>
      </select>
      <ChevronDownIcon width={12} height={12} strokeWidth={1.8} aria-hidden />
    </span>
  )

  const bodyBlock = (post: ManagedPost) => {
    // A1 - an empty body gets no paragraph at all. Never an empty clamp box,
    // never the string "null".
    if (!post.body || !post.body.trim()) return null
    const expanded = expandedIds.has(post.postId)
    // A2 - only offer "read all" when there is genuinely more than the clamp
    // shows. 4 lines at this measure is roughly 260 characters.
    const isLong = post.body.length > 260 || post.body.split('\n').length > 4
    return (
      <>
        <p className={'cm-clamp' + (expanded ? '' : ' is-clamped')}>{post.body}</p>
        {isLong && (
          <button
            type="button"
            className="cm-readall"
            onClick={() => setExpandedIds(prev => {
              const next = new Set(prev)
              if (next.has(post.postId)) next.delete(post.postId); else next.add(post.postId)
              return next
            })}
          >
            {expanded ? 'show less' : 'read all'}
          </button>
        )}
      </>
    )
  }

  /* ── Compositions ─────────────────────────────────────────────────────── */

  const slaBanner = oldestWaitHours != null && oldestWaitHours > SLA_HOURS ? (
    <div className="cm-sla">
      <ClockIcon width={15} height={15} strokeWidth={1.8} aria-hidden />
      <span className="cm-sla-text">Oldest has waited {oldestWaitHours} hours</span>
      <span className="cm-sla-target">sla {SLA_HOURS}h</span>
    </div>
  ) : null

  // Error BEFORE empty: a failed query has no answer to report, and "no posts
  // found / try a different search" invites a super admin to go hunting for
  // content that was never fetched.
  const emptyState = loadError
    ? <AdminErrorState message={`Could not load posts - ${loadError}`} onRetry={() => fetchPosts(1, debouncedSearch, statusFilter)} />
    : search
    // A13 - quote the term back and offer the way out. Filters stay visible.
    ? <EmptyLedger
        message={`no posts matching "${search}"`}
        sub="Try a different search or status filter."
        action={<button type="button" className="cm-loadmore" onClick={clearFilters}>clear filters</button>}
      />
    : <EmptyLedger
        message="no posts found"
        sub="Try a different search or status filter."
        action={statusFilter !== 'all'
          ? <button type="button" className="cm-loadmore" onClick={clearFilters}>clear filters</button>
          : undefined}
      />

  const listFoot = hasMore ? (
    <div style={{ textAlign: 'center', paddingTop: 8 }}>
      <button type="button" className="cm-loadmore" disabled={isLoadingMore}
        onClick={() => { const p = page + 1; setPage(p); fetchPosts(p, debouncedSearch, statusFilter, true) }}>
        {isLoadingMore ? 'loading…' : 'load more →'}
      </button>
    </div>
  ) : (
    // A14 - the end of the list is a rule reading the real total, never a
    // button that does nothing.
    <div className="cm-end">{total} {total === 1 ? 'post' : 'posts'} in total</div>
  )

  const cards = (
    <div className="cm-cards">
      {posts.map(post => {
        const accent = catAccent(post.category)
        const statusTone = STATUS_TONE[post.status] || 'approved'
        const isEditingThis = editingId === post.postId

        return (
          <div key={post.postId} className="cm-card" style={{ ['--cc' as any]: accent }}>
            {/* Header row */}
            <div className="cm-head">
              <span className="cm-cat">{post.category}</span>
              <StatusStamp label={post.status === 'pending_review' ? 'queued' : post.status} tone={statusTone} />
              {authorNode(post)}
              {scheduleLine(post) || <span className="mono xs muted">{timeAgo(post.createdAt)}</span>}
              <span className="cm-counts">
                <span><HeartIcon width={11} height={11} strokeWidth={1.8} aria-hidden />{post.likeCount}</span>
                <span><ChatBubbleBottomCenterTextIcon width={11} height={11} strokeWidth={1.8} aria-hidden />{post.commentCount}</span>
              </span>
            </div>

            {/* Body - inline editable */}
            <div className="cm-body">
              {isEditingThis ? (
                <>
                  <textarea
                    autoFocus
                    className="cm-editor"
                    value={editBody}
                    onChange={e => setEditBody(e.target.value)}
                    rows={Math.max(3, editBody.split('\n').length + 1)}
                    style={{ ['--cc' as any]: accent }}
                  />
                  <div className="cm-editor-acts">
                    <button type="button" onClick={() => setEditingId(null)} disabled={isSaving}>cancel</button>
                    <button type="button" className="is-save" onClick={() => handleSaveEdit(post)} disabled={isSaving || !editBody.trim()}>
                      {isSaving ? 'saving…' : 'save →'}
                    </button>
                  </div>
                </>
              ) : bodyBlock(post)}
            </div>

            {/* Action row. Everything except the status select routes through
                AdminRowActions, which is already the desk's phone rule: an
                inline cluster at >= 601px, one 44x44 button plus a sheet at
                <= 600px. Verdicts are NOT in here - see the deck. */}
            {!isEditingThis && (
              <div className="cm-foot">
                <AdminRowActions sheetTitle={`Actions for the post by ${post.authorName}`}>
                  {rowActions(post)}
                </AdminRowActions>
                {statusSelect(post)}
              </div>
            )}
          </div>
        )
      })}
      {listFoot}
    </div>
  )

  const deck = (
    <div className="cm-deck" tabIndex={0} onKeyDown={onDeckKeyDown} aria-label="Triage deck">
      <div className="cm-deckframe">
        <div className="cm-deckhead">
          <div style={{ flex: '1 1 auto', minWidth: 220 }}>
            <span className="adm-header-label">{statusFilter === 'pending_review' ? 'queue' : statusFilter}</span>
            <div className="cm-deckhead-title">
              {queuedCount > 0
                ? `${queuedCount} waiting on you`
                : `${posts.length} ${posts.length === 1 ? 'post' : 'posts'} loaded`}
            </div>
          </div>
          <div className="cm-keys">
            <span className="cm-keyname">keys</span>
            <span className="cm-keycap">A</span><span className="cm-keyname">approve</span>
            <span className="cm-keycap">R</span><span className="cm-keyname">changes</span>
            <span className="cm-keycap">J</span><span className="cm-keycap">K</span><span className="cm-keyname">move</span>
            <button type="button" className="cm-keycap" onClick={() => setKeysOpen(true)} aria-haspopup="dialog">?</button>
            <span className="cm-keyname">all keys</span>
          </div>
        </div>

        <div className="cm-decksplit">
          <div className="cm-rail" ref={railRef}>
            <div className="cm-railhead">
              <span>the queue</span>
              <span style={{ flex: 1 }} />
              {/* B8 - the count announces as it changes. */}
              <span aria-live="polite">{posts.length} loaded</span>
            </div>
            {posts.map((post, i) => (
              <button
                key={post.postId}
                type="button"
                ref={el => { railItemRefs.current[i] = el }}
                className={'cm-railitem' + (i === deckIndex ? ' is-current' : '')}
                onClick={() => setDeckIndex(i)}
                aria-current={i === deckIndex ? 'true' : undefined}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="cm-cat" style={{ ['--cc' as any]: catAccent(post.category) }}>{post.category}</span>
                  <span style={{ flex: 1 }} />
                  <span className="cm-railitem-by">{timeAgo(post.createdAt)}</span>
                </span>
                <span className="cm-railitem-title">
                  {post.body && post.body.trim() ? post.body.split('\n')[0] : 'no body'}
                </span>
                <span className="cm-railitem-by">{post.authorName}</span>
              </button>
            ))}
            <div className="cm-railnote">
              decisions apply immediately and the deck advances. undo sits in the toast for 5 seconds.
            </div>
          </div>

          {current ? (
            <div className="cm-detail">
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                <span className="cm-cat" style={{ ['--cc' as any]: catAccent(current.category) }}>{current.category}</span>
                <StatusStamp
                  label={current.status === 'pending_review' ? 'queued' : current.status}
                  tone={STATUS_TONE[current.status] || 'approved'}
                />
                {scheduleLine(current)}
                <span style={{ flex: 1 }} />
                <span className="mono xs muted adm-nums">
                  {String(deckIndex + 1).padStart(2, '0')} / {String(posts.length).padStart(2, '0')}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {authorNode(current)}
                <span className="mono xs muted">{timeAgo(current.createdAt)}</span>
              </div>

              <div className="cm-detail-title">
                {current.body && current.body.trim() ? current.body.split('\n')[0] : 'no body'}
              </div>

              {current.body && current.body.trim()
                ? <p className="cm-detail-body">{current.body}</p>
                : null}

              {/* 12b - fact chips derived from rows already in state. No new
                  query, and nothing here is rendered without a source. */}
              <div className="cm-facts">
                <span className="cm-fact">{current.likeCount} {current.likeCount === 1 ? 'like' : 'likes'}</span>
                <span className="cm-fact">{current.commentCount} {current.commentCount === 1 ? 'comment' : 'comments'}</span>
                <span className="cm-fact">waiting {Math.max(0, Math.floor(hoursSince(current.createdAt)))}h</span>
                {current.pinned && <span className="cm-fact">pinned</span>}
                {current.featured && <span className="cm-fact">featured</span>}
              </div>

              <div className="cm-verdicts">
                <button type="button" className="cm-verdict is-approve"
                  disabled={statusChangingId === current.postId || !canModerate}
                  onClick={() => verdict(current, 'published')}>
                  approve <span className="cm-keycap">A</span>
                </button>
                <button type="button" className="cm-verdict"
                  disabled={statusChangingId === current.postId || !canModerate}
                  onClick={() => verdict(current, 'rejected')}>
                  ask for changes <span className="cm-keycap">R</span>
                </button>
                {canModerate && <button type="button" className="cm-verdict is-ghost"
                  onClick={() => { setEditingId(current.postId); setEditBody(current.body) }}>
                  edit body
                </button>}
                <span style={{ flex: 1 }} />
                {canDeletePost && <button type="button" className="cm-verdict is-danger"
                  disabled={deletingId === current.postId}
                  onClick={() => handleDelete(current)}>
                  delete
                </button>}
              </div>

              {editingId === current.postId && (
                <div>
                  <textarea
                    autoFocus
                    className="cm-editor"
                    value={editBody}
                    onChange={e => setEditBody(e.target.value)}
                    rows={Math.max(3, editBody.split('\n').length + 1)}
                    style={{ ['--cc' as any]: catAccent(current.category) }}
                  />
                  <div className="cm-editor-acts">
                    <button type="button" onClick={() => setEditingId(null)} disabled={isSaving}>cancel</button>
                    <button type="button" className="is-save" onClick={() => handleSaveEdit(current)} disabled={isSaving || !editBody.trim()}>
                      {isSaving ? 'saving…' : 'save →'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="cm-detail">{emptyState}</div>
          )}
        </div>
      </div>

      <BottomSheet open={keysOpen} onClose={() => setKeysOpen(false)} title="Keyboard">
        <div className="mono" style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
          <div><span className="cm-keycap">A</span> approve the current post</div>
          <div><span className="cm-keycap">R</span> ask for changes</div>
          <div><span className="cm-keycap">J</span> next post</div>
          <div><span className="cm-keycap">K</span> previous post</div>
          <div><span className="cm-keycap">?</span> this list</div>
          <div><span className="cm-keycap">Esc</span> close</div>
        </div>
      </BottomSheet>
    </div>
  )

  return (
    <AdminLayout wide>
      <div style={{ paddingBottom: 60 }}>
        <AdminTabHeader
          label="Posts"
          title="All posts"
          count={total}
          subtitle="Every post on the feed: approve or reject, edit, pin, feature or delete."
        />

        {/* Controls - one shared toolbar (search + status pills), replacing the
            desk's own hand-rolled input + btn row. */}
        <DataToolbar search={search} onSearch={setSearch} searchPlaceholder="Search post body…">
          {(['all', 'published', 'scheduled', 'pending_review', 'rejected'] as const).map(s => (
            <FilterPill key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
              {s === 'all' ? 'all' : s === 'pending_review' ? 'queue' : s}
            </FilterPill>
          ))}
        </DataToolbar>

        {slaBanner}

        {isLoading ? (
          <AdminSkeleton rows={5} variant="card" />
        ) : posts.length === 0 ? (
          emptyState
        ) : isDesk && !isPhone ? deck : cards}

      <BottomSheet open={!!rejecting} onClose={() => { if (statusChangingId == null) setRejecting(null) }} title="Reject this post?">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p className="adm-note">{rejecting?.authorName} gets a notification with your reason. Be kind and specific.</p>
          <textarea className="cm-editor" rows={4} value={rejectReason} autoFocus
            onChange={e => setRejectReason(e.target.value)} placeholder="What should they change?" />
          <div className="cm-editor-acts">
            <button type="button" onClick={() => setRejecting(null)} disabled={statusChangingId != null}>cancel</button>
            <button type="button" className="is-save" disabled={!rejectReason.trim() || statusChangingId != null}
              onClick={async () => {
                if (!rejecting) return
                const target = rejecting
                const ok = await handleStatusChange(target, 'rejected', rejectReason.trim())
                if (ok) { setRejecting(null); moveDeck(1) }
              }}>
              {statusChangingId != null ? 'rejecting…' : 'reject post'}
            </button>
          </div>
        </div>
      </BottomSheet>
      </div>
    </AdminLayout>
  )
}

export default ContentManager
