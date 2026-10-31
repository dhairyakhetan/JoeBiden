import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { useMeta } from '../hooks/useMeta'
import { pageMetadata } from '../lib/metaConfig'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import OfflineBanner from '../components/OfflineBanner'
import StaleBanner from '../components/StaleBanner'
import { useStaleAfterIdle } from '../lib/staleAfterIdle'
import { isRateLimited, retryAfterSeconds, rateLimitMessage } from '../lib/rateLimit'
import { useAnnouncer } from '../components/LiveRegion'
import CreatePostModal from './CreatePostModal'
import { readComposerDraft, seedComposerDraft } from './composer/useComposerDraft'
import { useConfirm } from '../components/Confirm'
import type { ResubmitTarget } from './composer/resubmit'

type Post = {
  post_id: number
  uuid: string
  author_id: number
  category: string
  body: string
  status: string
  rejection_note: string | null
  created_at: string
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'published') {
    return (
      <span className="chip" style={{ background: 'var(--welfare)', color: '#0A0A0A', fontWeight: 700, fontSize: 11 }}>
        ✓ published
      </span>
    )
  }
  if (status === 'pending_review') {
    return (
      // ACCEPTANCE.md §F: emoji are banned in AquaTerra-authored copy (only
      // the DB-templated birthday cake is exempt). The lemon chip tint already
      // carries "waiting", which is what the hourglass was doing twice.
      <span className="chip" style={{ background: 'var(--lemon)', color: '#0A0A0A', fontWeight: 700, fontSize: 11 }}>
        in review
      </span>
    )
  }
  if (status === 'scheduled') {
    return (
      <span className="chip" style={{ background: 'var(--sky)', color: '#0A0A0A', fontWeight: 700, fontSize: 11 }}>
        ⏰ scheduled
      </span>
    )
  }
  if (status === 'rejected') {
    // Ink text, not white - cream-on-tomato fails contrast (#fff on
    // --tomato is well under WCAG AA).
    return (
      <span className="chip" style={{ background: 'var(--tomato)', color: '#0A0A0A', fontWeight: 700, fontSize: 11 }}>
        ✕ rejected
      </span>
    )
  }
  return (
    <span className="chip" style={{ background: 'var(--bg-2)', color: 'var(--ink-3)', fontWeight: 600, fontSize: 11 }}>
      {status}
    </span>
  )
}

// DESIGN.md §1: 6 and 20 are both off-scale. Text lines take --r-tight;
// the two pill placeholders take 999 like the chips they stand in for.
function SkeletonCard() {
  return (
    <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div className="v6-skeleton" style={{ width: '60%', height: 14, borderRadius: 'var(--r-tight)' }} />
        <div className="v6-skeleton sk-pill" style={{ width: 72, height: 22, borderRadius: 999 }} />
      </div>
      <div className="v6-skeleton" style={{ width: '90%', height: 12, borderRadius: 'var(--r-tight)' }} />
      <div className="v6-skeleton" style={{ width: '75%', height: 12, borderRadius: 'var(--r-tight)' }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <div className="v6-skeleton sk-pill" style={{ width: 60, height: 20, borderRadius: 999 }} />
        <div className="v6-skeleton" style={{ width: 80, height: 12, borderRadius: 'var(--r-tight)', marginTop: 4 }} />
      </div>
    </div>
  )
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

type StatusFilter = 'all' | 'published' | 'scheduled' | 'pending_review' | 'rejected'

const STATUS_FILTERS: Array<[StatusFilter, string]> = [
  ['all', 'all'],
  ['published', '✓ published'],
  ['scheduled', '⏰ scheduled'],
  // §F again - the filter chip and the badge must say the same thing.
  ['pending_review', 'in review'],
  ['rejected', '✕ rejected'],
]

/** The most posts this page will load at once. See fetchPosts. */
const MY_POSTS_CAP = 200

export default function MyPostsPage() {
  useMeta(pageMetadata.myPosts)
  const { member } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  /** How many this author actually has, which may exceed MY_POSTS_CAP. */
  const [totalPosts, setTotalPosts] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rateLimited, setRateLimited] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  // changelog/22-social-engine.md §22.1 - "edit and resubmit" opens the
  // composer, prefilled, from a rejected row.
  const [composerOpen, setComposerOpen] = useState(false)
  // Non-null only while a rejected post is being edited in place.
  const [editTarget, setEditTarget] = useState<ResubmitTarget | null>(null)
  const confirm = useConfirm()
  // §11.13: ONE live region for this whole surface. Both things that change
  // without a page move - the filter result count and the composer opening -
  // announce through it.
  const { announce, region } = useAnnouncer()

  const fetchPosts = useCallback(async () => {
    if (!member) return
    setIsLoading(true)
    setError(null)
    try {
      // Bounded. This was an unbounded select of every post the author had
      // ever written - 576 rows including every `body` for the org account,
      // mounted all at once, and growing without limit. Worse, PostgREST has
      // its own max-rows ceiling, so past it the list would have started
      // truncating silently rather than saying so.
      //
      // A hard page size with client-side status filtering would make the
      // per-status chip counts lie (they would count only the loaded page), so
      // the cap is high and the page SAYS when it has been hit instead.
      const { data, error: dbError, count } = await supabaseCommunity
        .from('posts')
        .select(
          'post_id, uuid, author_id, category, body, status, rejection_note, created_at, scheduled_for',
          { count: 'exact' },
        )
        .eq('author_id', member.member_id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(0, MY_POSTS_CAP - 1)

      if (dbError) throw dbError
      setPosts((data ?? []) as any[])
      setTotalPosts(count ?? (data ?? []).length)
    } catch (err) {
      console.error('MyPostsPage fetch error:', err)
      // §11.1 state 7: a recognisable rate limit says it is temporary and
      // self-resolving; anything else keeps the ordinary sentence. See
      // lib/rateLimit.ts for what "recognisable" can and cannot mean here.
      const limited = isRateLimited(err)
      setRateLimited(limited)
      setError(limited ? rateLimitMessage(retryAfterSeconds(err)) : "couldn't load your posts.")
    } finally {
      setIsLoading(false)
    }
  }, [member])

  // §11.1 state 8. This list drives real actions (delete, edit-and-resubmit,
  // and it reports moderation status), so acting on a four-hour-old copy of it
  // is exactly the failure the state exists for. Suppressed while the composer
  // is open - it holds unsaved input, and §11 forbids anything moving under a
  // member mid-task.
  const { stale, markFresh, dismiss: dismissStale } = useStaleAfterIdle({ enabled: !composerOpen })

  useEffect(() => {
    fetchPosts()
    markFresh()
  }, [fetchPosts, markFresh])

  const refreshStale = useCallback(() => { fetchPosts(); markFresh() }, [fetchPosts, markFresh])

  const filteredPosts = statusFilter === 'all' ? posts : posts.filter(p => p.status === statusFilter)

  // §22.1: "Edit and resubmit as the primary action. A rejection with no path
  // forward is a dead end, and for a 14-year-old it reads as being told off by
  // an invisible authority."
  //
  // This is now a REAL in-place edit, per the owner's ruling. The earlier
  // comment here (and its twin in composer/useComposerDraft.ts) described the
  // old behaviour: the rejected row was left untouched and its text merely
  // copied into the composer as a draft, so resubmitting created a SECOND post
  // and the queue grew a duplicate while the rejected original sat there
  // forever. Both comments were also, at one point, flatly wrong that no
  // post-edit service existed - `feedService.updatePost` has always been there.
  //
  // What happens now: the body and category still arrive through the composer's
  // own documented restore seam (nothing about CreatePostModal's draft handling
  // changes), but the modal is additionally handed `editPost`, so its submit
  // writes `updatePost(uuid, { body, category, status: 'pending_review' })`
  // against THIS row. Same post, edited, back in the queue.
  const editAndResubmit = async (post: Post) => {
    // §11.5: losing a half-written post is the worst failure in the product.
    // Seeding the draft would overwrite one, so ask first - and only when
    // there is actually something to lose.
    const existing = readComposerDraft()
    if (existing) {
      const ok = await confirm({
        title: 'replace your saved draft?',
        body: 'the composer is holding an unfinished post. opening this one replaces it.',
        confirmLabel: 'replace it',
        danger: true,
      })
      if (!ok) return
    }
    seedComposerDraft({ body: post.body, category: post.category })
    setEditTarget({ uuid: post.uuid, body: post.body, category: post.category })
    setComposerOpen(true)
    announce('composer opened with your rejected post. saving sends this same post back for review.')
  }

  // Cleared on close as well as on success: leaving a stale edit target behind
  // would silently turn the next ordinary "+ new post" into an overwrite of the
  // rejected one.
  const closeComposer = () => { setComposerOpen(false); setEditTarget(null) }

  return (
    <div className="route-enter aq-wrap" style={{ paddingTop: 'clamp(28px, 4vw, 48px)', paddingBottom: 80 }}>
      {/* §11.5: the offline state is a BANNER at the top of the content
          column, never a toast - "a toast expires and the condition does
          not". Renders nothing while online. */}
      <OfflineBanner />
      {/* §11.1 state 8. Renders nothing while offline, so it and the banner
          above it can never both be speaking. */}
      {stale && <StaleBanner onRefresh={refreshStale} onDismiss={dismissStale} busy={isLoading} />}
      {region}
      <h1 className="h-display" style={{ fontSize: 'clamp(36px, 6vw, 56px)', marginBottom: 6 }}>my posts.</h1>
      <p style={{ color: 'var(--ink-2)', marginBottom: 20, fontSize: 15, lineHeight: 1.5 }}>
        your activity and moderation status
      </p>

      {!isLoading && !error && posts.length > 0 && (
        <div className="row gap-2 flex-wrap" style={{ marginBottom: 24 }}>
          {STATUS_FILTERS.map(([key, label]) => (
            <button
              key={key}
              className={'chip ' + (statusFilter === key ? 'chip-active' : '')}
              onClick={() => {
                setStatusFilter(key)
                // §11.13: "every filter result count". The list below changes
                // silently otherwise.
                const n = key === 'all' ? posts.length : posts.filter(p => p.status === key).length
                announce(`${n} ${n === 1 ? 'post' : 'posts'}.`)
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* The cap is high enough that almost nobody meets it, but when someone
          does the chip counts above describe the loaded window rather than
          their whole history - so say so rather than quietly under-reporting. */}
      {!isLoading && !error && totalPosts > posts.length && (
        <p className="mono xs muted" style={{ marginTop: -14, marginBottom: 20 }}>
          showing your {posts.length} most recent of {totalPosts}. the counts above cover those {posts.length}.
        </p>
      )}

      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      )}

      {!isLoading && error && (
        <ErrorState
          message={error}
          hint={rateLimited ? 'nothing is broken - the server is just asking us to slow down.' : 'check your connection and try again.'}
          onRetry={fetchPosts}
          variant="block"
        />
      )}

      {!isLoading && !error && posts.length === 0 && (
        <EmptyState
          title="nothing here yet."
          hint="you haven't posted anything yet."
          action={<Link to="/" className="btn btn-primary btn-lg">create a post →</Link>}
        />
      )}

      {!isLoading && !error && posts.length > 0 && filteredPosts.length === 0 && (
        <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--ink-2)', fontSize: 15 }}>
            no posts match this filter yet.
          </p>
        </div>
      )}

      {!isLoading && !error && filteredPosts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredPosts.map(post => {
            // Only published posts have a public /post/:uuid page — pending &
            // rejected posts 404 there, so those render as non-clickable cards
            // instead of dead-end links (the rejection note is shown inline).
            const isPublished = post.status === 'published'
            const card = (
              <div className={'card' + (isPublished ? ' card-hover' : '')} style={{ padding: '18px 20px' }}>
                {/* Top row: body preview + status badge */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                  <p style={{
                    margin: 0,
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: 'var(--ink)',
                    flex: 1,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {post.body.slice(0, 100)}{post.body.length > 100 ? '…' : ''}
                  </p>
                  <div style={{ flexShrink: 0 }}>
                    <StatusBadge status={post.status} />
                  </div>
                </div>

                {/* Meta row: category chip + date */}
                <div className="row gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="chip" style={{ fontSize: 11, background: 'var(--bg-2)', color: 'var(--ink-2)' }}>
                    {post.category}
                  </span>
                  <span className="mono xs muted">
                    {formatDate(post.created_at)}
                  </span>
                  {post.status === 'scheduled' && (post as any).scheduled_for && (
                    <span className="mono xs" style={{ color: 'var(--sky-ink, #0a6cbf)', fontWeight: 700 }}>
                      → publishes {new Date((post as any).scheduled_for).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  )}
                </div>

                {/* §22.1's rejected state. Two fixes:
                    1. The callout used to be gated on `rejection_note` too, so
                       a rejection with no reason recorded rendered NOTHING -
                       the post simply looked rejected with no explanation at
                       all. §22.1 requires the fallback sentence.
                    2. `Edit and resubmit` as the primary action. Before this
                       the row was a deliberate dead end.
                    Radius: `0 8px 8px 0` was off-scale (DESIGN.md §1) - now
                    `0 var(--r-tight) var(--r-tight) 0`, square against the
                    3px tomato rule it hangs off. */}
                {post.status === 'rejected' && (
                  <div style={{
                    marginTop: 10,
                    padding: '10px 12px',
                    background: 'rgba(255,77,46,0.07)',
                    borderLeft: '3px solid var(--tomato)',
                    borderRadius: '0 var(--r-tight) var(--r-tight) 0',
                  }}>
                    <p style={{
                      margin: 0,
                      fontSize: 13,
                      fontStyle: 'italic',
                      color: 'var(--ink-2)',
                      lineHeight: 1.5,
                    }}>
                      {post.rejection_note || 'a HoD did not publish this'}
                    </p>
                    <button
                      className="btn btn-sm btn-primary"
                      // DESIGN.md touch-target floor. `.btn-sm` is
                      // `padding: 6px 12px; font-size: 12px` in v6.css, which
                      // measures ~30px tall - well under 44. Only `home.css`
                      // and `director.css` raise it, and neither applies on
                      // this route, so the floor is set here.
                      style={{ marginTop: 10, minHeight: 44, minWidth: 44 }}
                      onClick={() => editAndResubmit(post)}
                    >
                      edit and resubmit
                    </button>
                  </div>
                )}
              </div>
            )
            return isPublished ? (
              <Link key={post.post_id} to={`/post/${post.uuid}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                {card}
              </Link>
            ) : (
              <div key={post.post_id}>{card}</div>
            )
          })}
          <Link to="/" className="btn btn-primary" style={{ alignSelf: 'center', marginTop: 8 }}>
            + new post
          </Link>
        </div>
      )}

      {/* Restores the draft seeded above on open. `editPost` is what makes the
          submit an UPDATE of that same row rather than a new post; it is null
          for every other way this composer is reached. */}
      <CreatePostModal
        isOpen={composerOpen}
        onClose={closeComposer}
        onPostCreated={() => { closeComposer(); fetchPosts() }}
        editPost={editTarget}
      />
    </div>
  )
}
