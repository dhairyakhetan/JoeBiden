import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Post } from '../services/api'
import savedPostsService from '../services/savedPostsService'
import savedStore from '../lib/savedStore'
import { useToast } from '../components/Toast'
import FeedPostCard from './FeedPostCard'
import { feedItemFromPost } from './feedItemFromPost'
import { shapeFeed } from '../lib/feedShape'
import { useFeedCardBatch } from '../hooks/useFeedCardBatch'
import { useEmptyJoke } from '../lib/emptyJokes'
import { useMeta } from '../hooks/useMeta'
import { pageMetadata } from '../lib/metaConfig'
import Skeleton from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'

// redesign 08.4: "posts" / "drives" / "openings" as a hairline chip row
// (01's `.chip` pattern). A saved drive or opening is a `posts` row mirrored
// from welfare_projects/job_openings (see CLAUDE.md's search-consolidation
// note and api.ts's `Post.sourceType`) - filtering is client-side over the
// page already loaded below, so this adds zero queries.
const KIND_FILTERS: Array<[string, string]> = [
  ['all', 'all'],
  ['posts', 'posts'],
  ['drives', 'drives'],
  ['openings', 'openings'],
]
function matchesKind(post: Post, kind: string): boolean {
  if (kind === 'all') return true
  if (kind === 'drives') return post.sourceType === 'welfare_project'
  if (kind === 'openings') return post.sourceType === 'job_opening'
  // "posts": native posts and blog mirrors - anything that isn't a drive/opening.
  return post.sourceType !== 'welfare_project' && post.sourceType !== 'job_opening'
}

export default function SavedPostsPage() {
  useMeta(pageMetadata.savedPosts)
  const emptyLine = useEmptyJoke('saved', 'tap the bookmark icon on any post to save it here.')
  const toast = useToast()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [count, setCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [kind, setKind] = useState('all')
  // Batch per-card saved-state + linked-opening so the list fires 2 queries
  // total instead of 2 per card.
  const { savedSet, openings } = useFeedCardBatch(posts)
  const visiblePosts = useMemo(() => posts.filter(p => matchesKind(p, kind)), [posts, kind])
  // Section 10 mount, this page: same shapeFeed() pass HomePage.tsx runs,
  // minus composeFeed's C25 author-collapse grouping - a saved-posts list is
  // a curated set the viewer chose, not a long chronological feed with one
  // author dominating it, so nothing here should ever collapse into rows.
  // FeedPostCard's own `shaped` check already ignores a decision outside
  // SHAPED_SHAPES, so this is passed through unfiltered.
  const shapeDecisions = useMemo(
    () => shapeFeed(visiblePosts.map(p => feedItemFromPost(p, ''))),
    [visiblePosts],
  )

  const load = useCallback(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    savedPostsService.getSavedPosts({ page: 1, limit: 50 })
      .then(r => {
        if (cancelled) return
        if (r.success) {
          setPosts(r.data)
          setCount(r.pagination.totalItems)
        }
      })
      .catch(e => {
        // The written sentence unconditionally - `e.message` put raw Postgres
        // text in the headline directly above a hint written for a human.
        console.error('[SavedPostsPage] load failed:', e)
        if (!cancelled) setError('we couldn’t load your saved posts.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => load(), [load])

  // 08.4: "removes the row - with an undo toast, not a confirm (06.6.3).
  // Removing something from a list of things you chose to keep needs an
  // inverse." The delete itself still fires immediately (same
  // optimistic-remove-with-rollback-on-failure shape as before); "undo" is
  // the inverse action (re-save), not a deferred/cancelled network call -
  // matching Toast.tsx's generic `action()` primitive (the same one
  // director/adminKit.tsx's useUndoableAction builds on), a 5s window to
  // match that convention.
  const handleUnsave = async (post: Post) => {
    // Optimistic remove
    setPosts(prev => prev.filter(p => p.uuid !== post.uuid))
    setCount(c => Math.max(0, c - 1))
    // Item 8.2: tell the session-wide store, so the same post's card on the
    // feed or a profile flips its bookmark now rather than on its next mount.
    savedStore.set(post.postId, false)
    try {
      await savedPostsService.unsave(post.postId)
      toast.action('removed from saved.', {
        label: 'Undo',
        onClick: async () => {
          try {
            await savedPostsService.save(post.postId)
            savedStore.set(post.postId, true)   // item 8.2 - undo re-syncs too
            setPosts(prev => (prev.some(p => p.uuid === post.uuid) ? prev : [post, ...prev]))
            setCount(c => c + 1)
          } catch {
            toast.error('couldn’t undo that.')
          }
        },
      }, { duration: 5000 })
    } catch (err: any) {
      // Roll back on failure
      savedStore.set(post.postId, true)   // item 8.2 - the store rolls back too
      setPosts(prev => [post, ...prev])
      setCount(c => c + 1)
      console.error('Unsave failed:', err)
      toast.error('couldn’t unsave that.', err?.message)
    }
  }

  return (
    <div className="route-enter">
      {/* ── Hero ── */}
      <section className="bleed-under-nav" data-nav-tint="ink" style={{
        background: 'var(--ink)', color: 'var(--paper)',
        padding: 'calc(var(--nav-h, 70px) + clamp(24px,4vw,40px)) var(--page-px,24px) clamp(24px,3vw,40px)',
        borderBottom: 'var(--hair-2)', position: 'relative', overflow: 'hidden',
      }}>
        <div className="halftone" style={{ position: 'absolute', inset: 0, color: 'var(--lemon)', opacity: 0.1 }} />
        <div className="container" style={{ position: 'relative' }}>
          <span className="sticker sticker-lemon wobble sticker--diecut" style={{ display: 'inline-flex', marginBottom: 16, ['--sticker-ground' as string]: 'var(--bg)' }}>
            ★ SAVED
          </span>
          <h1 className="h-display" style={{
            fontSize: 'clamp(48px, 8vw, 84px)', margin: 0, lineHeight: 0.92, color: 'var(--paper)',
          }}>
            your <span style={{ fontStyle: 'italic', fontFamily: 'var(--serif)', fontWeight: 400, color: 'var(--lemon-ink)' }}>bookmarks</span>.
          </h1>
          {/* --nav-fg-faint (0.55 · 5.6:1) is the paper-on-ink floor rung.
              The 0.50 of raw white this replaced was an invented alpha. */}
          <p style={{ fontSize: 15, marginTop: 14, color: 'var(--nav-fg-faint)', fontFamily: 'var(--code)', fontVariantNumeric: 'tabular-nums' }}>
            {count} post{count !== 1 ? 's' : ''} saved · synced across your devices
          </p>
        </div>
      </section>

      {/* ── Content ── */}
      <div className="aq-wrap" style={{ paddingTop: 'clamp(20px,4vw,28px)', paddingBottom: 100 }}>
        {error && !loading && (
          <ErrorState
            message={error}
            hint="check your connection and try again."
            onRetry={load}
            className="mb-5"
          />
        )}
        {!loading && posts.length > 0 && (
          <div className="row gap-2" role="group" aria-label="Filter saved by kind" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
            {KIND_FILTERS.map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                className={'chip ' + (kind === k ? 'chip-active' : '')}
                onClick={() => setKind(k)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {loading ? (
          <Skeleton variant="card" count={3} />
        ) : visiblePosts.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {visiblePosts.map((post, i) => (
              <div key={post.uuid} style={{ position: 'relative' }}>
                <FeedPostCard post={post} seed={i} savedInitial={savedSet.has(post.postId)} linkedOpening={openings.get(post.uuid) ?? null} decision={shapeDecisions[i]} />
                {/* Unsave button - floats top-right inside the card */}
                <button
                  onClick={() => handleUnsave(post)}
                  title="Remove bookmark"
                  style={{
                    position: 'absolute', top: 14, right: 14, zIndex: 10,
                    background: 'var(--card)', border: '2px solid var(--line-2)',
                    borderRadius: 999,
                    // 40px hit-area floor (was ~24px tall). Keep tight visual
                    // chrome via padding rather than enlarging the chip text.
                    minHeight: 40, padding: '0 14px',
                    display: 'inline-flex', alignItems: 'center',
                    fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
                    color: 'var(--ink-3)', cursor: 'pointer',
                    transition: 'color 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--tomato)'; e.currentTarget.style.borderColor = 'var(--tomato)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-3)'; e.currentTarget.style.borderColor = 'var(--line-2)' }}
                >
                  unsave
                </button>
              </div>
            ))}
          </div>
        ) : error ? null : posts.length > 0 ? (
          // A kind filter with nothing under it is a different state from
          // truly nothing saved - the items still exist, just not in this
          // bucket, so this gets a lighter inline line rather than the full
          // "nothing saved yet" well (which would misreport an empty account).
          <div className="mono xs muted" style={{ textAlign: 'center', padding: '40px 0' }}>
            nothing saved under "{kind}".
          </div>
        ) : (
          <EmptyState
            // The app's own bookmark glyph, not an emoji (ACCEPTANCE §F).
            icon="🔖"
            title="nothing saved yet."
            hint={emptyLine}
            action={<Link to="/" className="btn btn-primary">browse the feed →</Link>}
          />
        )}
      </div>
    </div>
  )
}
