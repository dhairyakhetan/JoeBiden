import Img from '../components/Img'
import ImageLightbox from '../components/ImageLightbox'
import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import directorService, { isAlreadyDecided } from '../services/directorService'
import notificationService from '../services/notificationService'
import { logAction } from '../lib/auditLog'
import { cursorFromLast, appendUnique } from '../services/keysetCursor'
import { Post } from '../services/api'
import { getCategoryInfo } from '../feed/CategoryFilter'
import { safeExternalHref } from '../lib/safeUrl'
import {
  useModalA11y,
  AdminLayout, AdminTabHeader, DataToolbar, FilterPill, EmptyLedger,
  AdminSkeleton, AdminRow, AdminErrorState, BulkActionBar, BottomSheet, StatusStamp,
  useIsPhone, useRowSelection, useUndoableAction,
} from './adminKit'
import { useToast } from '../components/Toast'
import { useCan } from '../auth/CapabilityContext'
import { I } from '../components/v6Shared'
import { ChevronDownIcon, ChevronUpIcon, XMarkIcon } from '@heroicons/react/24/outline'
import type { DirectorContext } from './DirectorDashboard'
import { count, getInitials, timeAgo } from '../lib/uiHelpers'

// The 5 categories' correct, distinct hues live in the --c-* CSS custom
// properties (v6.css) - the `chip cat-{category}` badge already renders
// through those. Use the same source for the stamp/accent colour.
const CATEGORY_VAR: Record<string, string> = {
  events: 'var(--c-events)',
  welfare: 'var(--c-welfare)',
  labs: 'var(--c-labs)',
  operations: 'var(--c-ops)',
  content: 'var(--c-content)',
}

/** A pending post with the string `id` the shared selection/undo primitives key on. */
type Row = Post & { id: string }



const PostModeration = () => {
  const toast = useToast()
  // `myCategories` holds the NAMES of the teams the leader is assigned to
  // (director_scopes); it is only a label here. The server narrows the queue
  // by team (`scopedTeamIds`, see getPendingPosts and lib/postScope.ts).
  const { myCategories, myScopeTeamIds, isSuperAdmin } = useOutletContext<DirectorContext>()
  const scopeLabels = useMemo(() => (!isSuperAdmin ? myCategories : []), [isSuperAdmin, myCategories])
  // Memoized: a fresh `[]` each render would give `rows` a new identity and
  // useRowSelection clears on items-identity change.
  const scopedTeamIds = useMemo(() => (!isSuperAdmin ? myScopeTeamIds : []), [isSuperAdmin, myScopeTeamIds])
  const hasTeamScope = scopedTeamIds.length > 0

  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState<'all' | string>('all')
  const [totalPending, setTotalPending] = useState<number | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  // Presentation only: the phone bulk sheet.
  const [bulkOpen, setBulkOpen] = useState(false)
  const isPhone = useIsPhone()

  // Set on /director/roles. Narrows, never widens, the posts UPDATE policy.
  const canModerate = useCan('action.moderate_post')
  const [rejectingPost, setRejectingPost] = useState<Post | null>(null)
  const [rejectingBulk, setRejectingBulk] = useState(false)
  const [rejectionNote, setRejectionNote] = useState('')
  const [isRejecting, setIsRejecting] = useState(false)
  const rejectPanelRef = useRef<HTMLDivElement>(null)
  const closeReject = () => { setRejectingPost(null); setRejectingBulk(false); setRejectionNote('') }
  useModalA11y(!!rejectingPost || rejectingBulk, rejectPanelRef, closeReject, isRejecting)

  // "ask" - a third, non-destructive verdict: send the author a note through
  // the real notifications system without approving or rejecting the post,
  // so it stays in the queue while they add detail.
  const [askingPost, setAskingPost] = useState<Post | null>(null)
  const [askNote, setAskNote] = useState('')
  const [isAsking, setIsAsking] = useState(false)
  const closeAsk = () => { setAskingPost(null); setAskNote('') }
  const handleAsk = async () => {
    const note = askNote.trim()
    if (!askingPost || !note) return
    setIsAsking(true)
    try {
      // createOrThrow, not create: here the notification IS the action, so a
      // failed send must show as a failure instead of a false "sent".
      const sent = await notificationService.createOrThrow({
        memberId: askingPost.authorId,
        type: 'system',
        title: 'A director asked for more detail on your post',
        fullNote: note,
        link: `/post/${askingPost.uuid}`,
      })
      if (!sent) {
        toast.info('that is your own post.', 'there is nobody to ask - edit it or decide it directly.')
        closeAsk()
        return
      }
      logAction('post_detail_requested', 'post', askingPost.postId, { authorId: askingPost.authorId })
      toast.success('sent.', `${askingPost.authorName} will see your note - the post stays in the queue.`)
      closeAsk()
    } catch (e: any) {
      toast.error('could not send that.', e?.message)
    } finally {
      setIsAsking(false)
    }
  }

  // Photo strip - tappable to a real lightbox, never rendered full-size in
  // the queue itself.
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  // First page when `append` is false; otherwise the next page AFTER the last
  // row held (keyset). Deciding a post removes it server-side, so an offset of
  // page*20 skipped the rows that slid up into the gap.
  const fetchPosts = async (append = false) => {
    if (append) setIsLoadingMore(true); else { setIsLoading(true); setLoadError(null) }
    try {
      const after = append ? cursorFromLast(posts, p => p.createdAt, p => p.postId) : null
      const result = await directorService.getPendingPosts({ limit: 20, scopeTeamIds: scopedTeamIds, after })
      if (result.success) {
        if (append) setPosts(prev => appendUnique(prev, result.data, p => p.postId)); else setPosts(result.data)
        setHasMore(result.pagination.hasNextPage)
        // The header counted one page of 20 and presented it as the size of the
        // queue. Only the first page carries the exact total; later pages keep it.
        if (!append) setTotalPending(result.pagination.totalItems ?? null)
      }
    } catch (err: any) {
      const msg = err?.message || err?.error_description || 'Something went wrong.'
      if (!append) setLoadError(msg)
      toast.error(`Could not load posts queue - ${msg}`)
      console.error('[PostModeration] fetchPosts error:', err)
    }
    finally { setIsLoading(false); setIsLoadingMore(false) }
  }

  // The scope is stable after the director-desk context loads; re-running on
  // every identity change would refetch needlessly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchPosts() }, [])

  // Category pills come from the posts actually in the queue.
  const filterCategories = useMemo(
    () => Array.from(new Set(posts.map(p => p.category))).filter(Boolean).sort(),
    [posts],
  )

  const rows = useMemo<Row[]>(() => {
    const term = search.trim().toLowerCase()
    return posts
      .filter(p => catFilter === 'all' || p.category === catFilter)
      .filter(p => !term || (p.body || '').toLowerCase().includes(term) || (p.authorName || '').toLowerCase().includes(term))
      .map(p => ({ ...p, id: String(p.postId) }))
  }, [posts, catFilter, search])

  // A team-scoped leader is always seeing a subset, so their header should
  // count what they can actually act on, never the global queue.
  const isNarrowed = catFilter !== 'all' || search.trim() !== '' || hasTeamScope

  const selection = useRowSelection(rows)

  const removedRef = useRef<Map<string, { post: Post; index: number }>>(new Map())

  const restore = (id: string) => {
    const entry = removedRef.current.get(id)
    if (!entry) return
    removedRef.current.delete(id)
    setPosts(prev => {
      if (prev.some(p => p.postId === entry.post.postId)) return prev
      const next = [...prev]
      next.splice(Math.min(entry.index, next.length), 0, entry.post)
      return next
    })
  }

  // Approve = optimistic + 5s undo window; the network call only fires when
  // the window closes, so undo is a cancel, not a server-side rollback.
  const approve = useUndoableAction<Row>({
    label: row => `Post by ${row.authorName} approved`,
    action: async row => {
      try {
        await directorService.approvePost(row.postId)
        removedRef.current.delete(row.id)
        setTotalPending(t => (t == null ? t : Math.max(0, t - 1)))
      } catch (e) {
        if (isAlreadyDecided(e)) {
          // Somebody else got there first: the row is gone for good, so do not
          // put it back, and say so instead of the generic failure toast.
          removedRef.current.delete(row.id)
          toast.info('already decided.', e.message)
          return
        }
        restore(row.id)
        throw e
      }
    },
    undo: async row => { restore(row.id) },
  })

  const handleApprove = (row: Row) => {
    // Guarded on the code path as well as the button: a tab left open from
    // before the capability was switched off still has the control rendered.
    if (!canModerate) return
    const index = posts.findIndex(p => p.postId === row.postId)
    removedRef.current.set(row.id, { post: row, index: index === -1 ? 0 : index })
    setPosts(prev => prev.filter(p => p.postId !== row.postId))
    approve.run(row)
  }

  const handleBulkApprove = () => {
    const targets = rows.filter(r => selection.isSelected(r.id))
    selection.clear()
    targets.forEach(handleApprove)
  }

  const handleReject = async () => {
    if (!canModerate) return
    const note = rejectionNote.trim()
    if (!note) return
    const targets = rejectingBulk ? rows.filter(r => selection.isSelected(r.id)) : rejectingPost ? [rejectingPost] : []
    if (targets.length === 0) return
    setIsRejecting(true)
    try {
      // allSettled, not all. Rejecting a post notifies its author, and a
      // Promise.all that rejects on the first failure left EVERY row in the
      // queue with the selection intact - including the ones whose write had
      // already landed. The moderator retries, and those authors get a second
      // "your post needs changes" notification for the same post.
      const results = await Promise.allSettled(
        targets.map(t => directorService.rejectPost(t.postId, note)),
      )
      const doneIds = new Set(
        targets.filter((_, i) => results[i].status === 'fulfilled').map(t => t.postId),
      )
      // A post someone else already decided is gone from the queue too: drop it
      // from the list (the failure toast below still counts it as not done by us).
      const goneIds = new Set(
        targets.filter((_, i) => { const r = results[i]; return r.status === 'rejected' && isAlreadyDecided(r.reason) }).map(t => t.postId),
      )
      const failed = targets.length - doneIds.size
      // The rows that went through leave the list, so a retry cannot re-send
      // their notification. useRowSelection clears itself whenever the items
      // array's identity changes, so this setPosts also drops the selection -
      // the moderator re-picks the failures, which is the safe direction.
      setPosts(prev => prev.filter(p => !doneIds.has(p.postId) && !goneIds.has(p.postId)))
      setTotalPending(t => (t == null ? t : Math.max(0, t - doneIds.size - goneIds.size)))
      selection.clear()

      if (failed === 0) {
        toast.success(doneIds.size === 1 ? 'post rejected.' : `${doneIds.size} posts rejected.`)
        closeReject()
      } else {
        const firstErr = results.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined
        toast.error(
          doneIds.size === 0
            ? 'none of those could be rejected.'
            : `${doneIds.size} rejected, ${failed} couldn’t be.`,
          firstErr?.reason?.message ?? 'the ones still listed were not changed - pick them again to retry.',
        )
        // The panel CLOSES here, even though the failures still need a
        // decision. Leaving it open was the first instinct and it was wrong:
        // `targets` is derived from the live selection, setPosts above changes
        // the rows array identity, and useRowSelection clears itself on that -
        // so the open panel read "reject 0 selected posts?" and its confirm
        // button did nothing at all, silently. A closed panel and a toast that
        // says what is left is honest; a dead button is not.
        closeReject()
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to reject post')
    }
    finally { setIsRejecting(false) }
  }

  const toggleExpand = (id: string) => setExpanded(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const scopeNote = hasTeamScope && scopeLabels.length > 0 ? scopeLabels.join(', ') : null

  if (isLoading) {
    return <AdminLayout><AdminSkeleton rows={5} /></AdminLayout>
  }

  return (
    <AdminLayout>
      <div className="route-enter" style={{ paddingBottom: 96, maxWidth: 880 }}>
        <AdminTabHeader
          label="Post queue"
          title="Post moderation"
          count={isNarrowed ? rows.length : (totalPending ?? rows.length)}
          subtitle={scopeNote ? `Approve or reject pending ${scopeNote} posts.` : 'Approve or reject pending community posts.'}
        />

        <DataToolbar search={search} onSearch={setSearch} searchPlaceholder="Search post text or author…">
          <div className="adm-hscroll">
            <FilterPill active={catFilter === 'all'} onClick={() => setCatFilter('all')}>all</FilterPill>
            {filterCategories.map(c => (
              <FilterPill key={c} active={catFilter === c} onClick={() => setCatFilter(c)}>
                <span className="adm-swatch" style={{ ['--sw' as any]: CATEGORY_VAR[c] || 'var(--ink-3)' }} aria-hidden />
                {getCategoryInfo(c).label}
              </FilterPill>
            ))}
          </div>
        </DataToolbar>
        {/* The pills are scoped to what this viewer can act on, so their
            ABSENCE is meaningful: a welfare director never sees an Events
            filter because they cannot moderate one. Say that in words. */}
        {hasTeamScope && (
          <p className="adm-note is-quiet" style={{ marginBottom: 10 }}>
            your queue is the posts tagged to your teams, plus any post nobody has tagged yet.
          </p>
        )}

      {loadError ? (
        <AdminErrorState message={`Could not load the post queue - ${loadError}`} onRetry={() => fetchPosts()} />
      ) : rows.length === 0 ? (
        <EmptyLedger
          message={scopeNote ? `all clear in ${scopeNote}` : 'all clear'}
          sub={scopeNote ? `No ${scopeNote} posts pending moderation.` : 'No posts pending moderation.'}
        />
      ) : (
        <>
          {rows.map(row => {
            const catInfo = getCategoryInfo(row.category)
            const catColor = CATEGORY_VAR[row.category] || 'var(--hod-ink-3, var(--ink-3))'
            const firstImage = row.images?.[0]?.blobUrl || row.images?.[0]?.url
            const isOpen = expanded.has(row.id)
            const isApproving = approve.pending.has(row.id)
            return (
              <AdminRow
                key={row.id}
                // Approve is optimistic and the network call fires only when
                // the 5s window CLOSES, so undo is a cancel, not a rollback -
                // which is why approve alone needs no confirm. The row stays
                // on screen and says so, rather than vanishing into a toast.
                className={isApproving ? 'is-approving' : undefined}
                meta={isApproving ? <span className="adm-working" role="status">approving… undo below</span> : undefined}
                busy={isApproving}
                selected={selection.isSelected(row.id)}
                onSelect={() => selection.toggle(row.id)}
                onToggleExpand={() => toggleExpand(row.id)}
                expanded={isOpen ? (
                  <>
                    <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{row.body}</p>
                    {row.taggedMembers && row.taggedMembers.length > 0 && (
                      <div className="row gap-2 flex-wrap" style={{ marginTop: 10 }}>
                        {row.taggedMembers.map(m => (
                          <Link key={m.uuid} to={`/profile/${m.uuid}`} className="chip" style={{ fontSize: 11 }}>@{m.fullName}</Link>
                        ))}
                      </div>
                    )}
                    {row.linkUrl && (
                      <a href={safeExternalHref(row.linkUrl)} target="_blank" rel="noopener noreferrer" className="adm-extlink" style={{ marginTop: 8 }}>
                        {row.linkTitle || row.linkUrl}
                      </a>
                    )}
                    {/* Numbers a member entered in their post (posts.stats, the same
                        up-to-2 value/label pairs the feed card renders as pills),
                        surfaced here with the line that tells a director what
                        verifying actually commits to. */}
                    {row.stats && row.stats.length > 0 ? (
                      <>
                        <div className="row gap-2 flex-wrap" style={{ marginTop: 10 }}>
                          {row.stats.map((s, i) => (
                            <span key={i} className="qtag" style={{ ['--cc' as any]: 'var(--welfare)' }}>
                              {s.value} {s.label}
                            </span>
                          ))}
                        </div>
                        <p className="adm-consequence">
                          these numbers enter the org's totals
                        </p>
                      </>
                    ) : (
                      <p className="adm-consequence">
                        no numbers given - ask before approving
                      </p>
                    )}
                  </>
                ) : undefined}
                stamp={<StatusStamp label={catInfo.label} tone="custom" color={catColor} />}
                primary={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    {firstImage
                      ? (
                        <div className="adm-avatar is-square" aria-hidden>
                          <Img ctx="thumb" src={firstImage} alt="" loading="lazy" />
                        </div>
                      )
                      : (
                        <div className="adm-avatar" aria-hidden>
                          {row.authorAvatar
                            ? <Img ctx="avatar" src={row.authorAvatar} alt="" referrerPolicy="no-referrer" />
                            : <div className="adm-avatar-fallback" style={{ background: catColor }}>{getInitials(row.authorName)}</div>}
                        </div>
                      )}
                    <span>{row.authorName}</span>
                    <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                      {timeAgo(row.createdAt)}
                    </span>
                  </div>
                }
                secondary={
                  <>
                    <span className="adm-clamp" style={{ display: '-webkit-box' }}>{row.body}</span>
                    {/* A single compact strip, never a full-size image in the queue
                        itself; each thumb opens the real lightbox. */}
                    {row.images && row.images.length > 0 && (
                      <div
                        className="row gap-2 flex-wrap"
                        role="group"
                        aria-label={`${row.images.length} photo${row.images.length === 1 ? '' : 's'} attached`}
                        style={{ marginTop: 8 }}
                      >
                        {row.images.slice(0, 4).map((img, i) => {
                          const src = img.blobUrl || img.url
                          if (!src) return null
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={e => { e.stopPropagation(); setLightboxSrc(src) }}
                              aria-label={`View photo ${i + 1} of ${row.images!.length}`}
                              style={{
                                padding: 0, border: 'var(--hod-border-w) solid var(--hod-border)', borderRadius: 'var(--r-tight)',
                                width: 40, height: 40, overflow: 'hidden', flex: 'none', cursor: 'pointer',
                              }}
                            >
                              <Img ctx="thumb" src={src} alt="" loading="lazy" />
                            </button>
                          )
                        })}
                        {row.images.length > 1 && (
                          <span className="mono xs upper muted" style={{ fontWeight: 700, alignSelf: 'center' }}>{row.images.length} photos</span>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      className="adm-disclose"
                      aria-expanded={isOpen}
                      onClick={e => { e.stopPropagation(); toggleExpand(row.id) }}
                    >
                      {isOpen ? 'hide full post' : 'read full post'}
                      {isOpen
                        ? <ChevronUpIcon strokeWidth={2.2} aria-hidden />
                        : <ChevronDownIcon strokeWidth={2.2} aria-hidden />}
                    </button>
                  </>
                }
                actions={
                  <div className="adm-verdicts">
                    {canModerate ? (<>
                    <button onClick={() => handleApprove(row)} className="btn btn-sm adm-approve">
                      <I.check /> approve
                    </button>
                    <button onClick={() => { setAskingPost(row); setAskNote('') }} className="btn btn-sm adm-ask">
                      ask…
                    </button>
                    <button onClick={() => { setRejectingPost(row); setRejectingBulk(false); setRejectionNote('') }} className="btn btn-sm adm-reject" aria-label="reject">
                      <XMarkIcon width={14} height={14} strokeWidth={2.4} aria-hidden /> <span className="adm-verdict-label">reject</span>
                    </button>
                    </>) : <span className="mono xs muted">view only</span>}
                  </div>
                }
              />
            )
          })}
          {hasMore && (
            <div style={{ textAlign: 'center', padding: 16 }}>
              <button onClick={() => fetchPosts(true)} disabled={isLoadingMore} className="btn btn-sm adm-loadmore">
                {isLoadingMore ? 'loading...' : 'load more →'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Two irreversible-looking verbs plus a count chip and a 44px clear do
          not fit 390px. On a phone they collapse to one control opening a
          sheet whose title states the count; both strings and both write
          paths are unchanged, and bulk approve still runs each row through
          the same undo window a single approve does. */}
      <BulkActionBar count={selection.count} onClear={selection.clear} busy={isRejecting}>
        {isPhone ? (
          <button className="btn btn-sm" onClick={() => setBulkOpen(true)}>decide…</button>
        ) : (
          <>
            {canModerate && <button className="btn btn-sm adm-approve" onClick={handleBulkApprove}>approve selected</button>}
            {canModerate && <button className="btn btn-sm adm-reject" onClick={() => { setRejectingBulk(true); setRejectingPost(null); setRejectionNote('') }}>reject selected</button>}
          </>
        )}
      </BulkActionBar>

      <BottomSheet open={bulkOpen} onClose={() => setBulkOpen(false)} title={`Decide ${count(selection.count, 'post')}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {canModerate && <button className="adm-sheet-opt" onClick={() => { setBulkOpen(false); handleBulkApprove() }}>approve selected</button>}
          {canModerate && <button className="adm-sheet-opt" onClick={() => { setBulkOpen(false); setRejectingBulk(true); setRejectingPost(null); setRejectionNote('') }}>reject selected</button>}
        </div>
      </BottomSheet>

      <BottomSheet open={!!askingPost} onClose={closeAsk} title="Ask for more detail">
        <div className="adm-block is-lemon" style={{ marginTop: 0, marginBottom: 10 }}>
          <p className="mono xs" style={{ color: 'var(--ink)', margin: 0, fontWeight: 700, lineHeight: 1.5 }}>
            {askingPost?.authorName} gets a notification with your note - the post stays in the queue, nothing is approved or rejected.
          </p>
        </div>
        <textarea
          className="textarea"
          value={askNote}
          onChange={e => setAskNote(e.target.value)}
          rows={3}
          placeholder="what do you need before you can approve this?"
          autoFocus
        />
        <div className="row gap-2" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
          <button onClick={closeAsk} className="btn btn-sm" disabled={isAsking}>cancel</button>
          <button onClick={handleAsk} disabled={!askNote.trim() || isAsking} className="btn btn-sm adm-approve" style={{ minHeight: 46 }}>
            {isAsking ? '...' : 'send'}
          </button>
        </div>
      </BottomSheet>

      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />

      {(rejectingPost || rejectingBulk) && (
        <div className="modal-back" onClick={e => { if (e.target === e.currentTarget) closeReject() }}>
          <div ref={rejectPanelRef} role="dialog" aria-modal="true" aria-label="Reject post" className="modal">
            <div className="modal-head">
              <h3 style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.01em', margin: 0, color: 'var(--danger)' }}>Reject post</h3>
              <button className="iconbtn" onClick={closeReject} aria-label="Close" title="Close">
                <XMarkIcon width={18} height={18} strokeWidth={2.2} aria-hidden />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 12, color: 'var(--ink-2)' }}>
                {rejectingBulk
                  ? <>reject <strong style={{ color: 'var(--ink)' }}>{selection.count} selected posts</strong>? each author sees the reason below.</>
                  : <>reject this post by <strong style={{ color: 'var(--ink)' }}>{rejectingPost?.authorName}</strong>? they will see the reason below.</>}
              </p>
              {rejectingPost && (
                <div className="card" style={{ padding: '10px 14px', marginBottom: 14, background: 'var(--bg-2)' }}>
                  <p className="adm-clamp" style={{ fontSize: 13, color: 'var(--ink-2)', margin: 0 }}>{rejectingPost.body}</p>
                </div>
              )}
              <label htmlFor="pm-note" className="mono xs upper muted" style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>rejection reason *</label>
              <textarea id="pm-note" className="textarea" value={rejectionNote} onChange={e => setRejectionNote(e.target.value)} rows={3} placeholder="be specific. the author will see this." />
              <div className="row gap-2" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
                <button onClick={closeReject} className="btn btn-sm">cancel</button>
                <button onClick={handleReject} disabled={!rejectionNote.trim() || isRejecting} className="btn btn-sm" style={{ background: 'var(--danger)', color: 'var(--paper)', borderRadius: 999, minHeight: 44, whiteSpace: 'nowrap' }}>
                  {isRejecting ? '...' : 'reject post'}
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

export default PostModeration
