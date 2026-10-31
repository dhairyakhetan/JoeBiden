import Img from '../components/Img'
import '../styles/routes/feed.css'
import { useState, useEffect, useRef, useMemo, memo } from 'react'
import { useModalA11y } from '../hooks/useDialog'
import { createPortal } from 'react-dom'
import { useNavigate, Link } from 'react-router-dom'
import ImageLightbox from '../components/ImageLightbox'
import { Post } from '../services/api'
import { safeExternalHref } from '../lib/safeUrl'
import { useAuth } from '../auth/AuthContext'
import feedService from '../services/feedService'
import savedPostsService from '../services/savedPostsService'
import savedStore from '../lib/savedStore'
import useSavedPost from '../hooks/useSavedPost'
import { sized } from '../lib/imageUrl'
import { I, LikeButton, isOfficialAccount, VerifiedTick } from '../components/v6Shared'
import ShareModal from '../components/ShareModal'
import { jobOpenings, CAT_COLORS } from '../lib/jobOpenings'
import { useToast } from '../components/Toast'
import PostFocusModal from '../components/PostFocusModal'
import HiringCard from '../components/HiringCard'
import { useIsMobile } from '../hooks/useMobile'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import { checkText, BLOCK_MESSAGE } from '../lib/profanityFilter'
import { getInitials, hashColor, timeAgo } from '../lib/uiHelpers'
import { useEmptyJoke } from '../lib/emptyJokes'
import { setAuthIntent, type GateCategory } from '../lib/authIntent'
import FeedCard from './cards/FeedCard'
import { SHAPED_SHAPES, feedItemFromPost } from './feedItemFromPost'
import type { ShapeDecision } from '../lib/feedShape'
import { derivePostHeadline } from './postHeadline'

interface FeedPostCardProps {
  post: Post
  seed?: number
  /**
   * May this card's photo load EAGERLY when it is `seed === 0`?
   *
   * Default false, and that default is the fix. `seed` is a list index, so
   * every list that renders FeedPostCard re-mints a seed 0 - the related-posts
   * rail on a post page, both profile tabs, the team About tab, saved posts.
   * Each of those then eager-loaded a below-the-fold photograph that competed
   * with the page's REAL LCP image for bandwidth on first paint.
   *
   * Only a list whose first card is genuinely the page's largest above-fold
   * element should opt in, which today is the home feed and nothing else.
   */
  allowEager?: boolean
  onLikeToggle?: () => void
  // Optional batched data from the list parent. When provided, the card
  // skips its own per-card fetch (the N+1). `savedInitial` = is this post
  // bookmarked by the viewer; `linkedOpening` = the job opening linked to
  // this post, or null if none (undefined = "not provided, self-fetch").
  savedInitial?: boolean
  linkedOpening?: any
  /**
   * SECTION 10 step 5, mounted at last (2026-09-07).
   *
   * When the host has resolved a shape for this row (`composeFeed` /
   * `shapeFeed`, once per list in a useMemo - never in a render body, because
   * the chooser mutates its session), the card renders through that shape
   * instead of the one fixed layout below. EVERYTHING ELSE IN THIS FILE IS
   * UNCHANGED: the same state, the same handlers, the same always-mounted
   * `ShareModal` / comment sheet / `ImageLightbox` / `PostFocusModal`
   * siblings, the same profanity gate, the same job-opening dispatch. Only
   * the <article> in the middle is swapped.
   *
   * That is deliberate and it is the whole reason this wiring was deferred:
   * the behaviour lives in ONE place, so a shape cannot drop half of it by
   * omission. A shape outside `SHAPED_SHAPES` falls back to the live layout,
   * and every other caller of this component (Saved, Profile, Search, Team,
   * Related) passes no decision at all and renders exactly as it did.
   */
  decision?: ShapeDecision
}

function FeedPostCard({ post, seed = 0, allowEager = false, onLikeToggle, savedInitial, linkedOpening: linkedOpeningProp, decision }: FeedPostCardProps) {
  // Headline / snippet split, on a word boundary.
  //
  // Members write one continuous paragraph, so the card has to invent its own
  // headline. Doing that with a raw character slice cut words in half and set
  // the two halves in different type — a live post read "…each note a tof" as
  // the headline and "fee was distributed" as the body underneath it.
  //
  // 2026-09-07. This used to be a word-boundary slice of the raw body, which
  // had no notion of a title - so a body opening with its OWN title line
  // (a title line, a blank line, then the body) it took the title AND
  // the first sentence mashed into one bold <h2>, with the body then repeated
  // underneath. It shipped on the PINNED HERO, and three cards down the same
  // page the .aqc family was already answering the question correctly. Two
  // contradictory answers to "what is a post title" on one screen.
  // derivePostHeadline() delegates to splitPostBody() - the .aqc answer - and
  // keeps the old boundary cut only as the degrade for a run-on paragraph.
  const { headline, rest } = useMemo(() => derivePostHeadline(post.body), [post.body])

  const navigate = useNavigate()
  const { member, isAuthenticated } = useAuth()
  const { success, info, error: toastError } = useToast()
  const [liked, setLiked] = useState(post.isLiked || false)
  const [likeCount, setLikeCount] = useState(post.likeCount || 0)
  const [isLiking, setIsLiking] = useState(false)
  // The share sheet now carries link / story / poster on one surface, so
  // there is no second piece of state (and no role gate) for the poster.
  const [showShareModal, setShowShareModal] = useState(false)
  // Item 8.2. This used to be a private `useState(savedInitial ?? false)`, so
  // two cards for the SAME post held two independent booleans and only the one
  // you clicked ever moved - bookmark on the feed, open the post on a profile,
  // still unsaved. It now reads the one session-wide store, falling back to
  // the batched prop until the store has been told about this post.
  const bookmarked = useSavedPost(post.postId, savedInitial)
  const setBookmarked = (v: boolean) => savedStore.set(post.postId, v)
  const [bookmarkBusy, setBookmarkBusy] = useState(false)
  const [bookmarkPop, setBookmarkPop] = useState(false)
  const [linkedOpening, setLinkedOpening] = useState<any>(linkedOpeningProp ?? undefined)
  const [showFocusModal, setShowFocusModal] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [showCommentSheet, setShowCommentSheet] = useState(false)
  const [sheetComments, setSheetComments] = useState<any[]>([])
  const [sheetLoading, setSheetLoading] = useState(false)
  const [sheetInput, setSheetInput] = useState('')
  const [sheetSubmitting, setSheetSubmitting] = useState(false)
  const [sheetCount, setSheetCount] = useState(post.commentCount || 0)

  const isMobile = useIsMobile()
  const emptyLine = useEmptyJoke('comments', 'be the first to say something.')

  const cardRef = useRef<HTMLElement>(null)
  // The comment sheet is a real modal - fixed, full-screen scrim, blurred page
  // behind it - and it had none of the dialog behaviour the rest of the app
  // already has. Focus stayed on the card underneath, Escape did nothing, and
  // Tab walked through the covered feed instead of the comment list, so a
  // keyboard user's only way out was to reload. `useModalA11y` is the same hook
  // PostFocusModal, Confirm and Sheet use; the sheet was simply never given it.
  const sheetPanelRef = useRef<HTMLDivElement>(null)
  const closeCommentSheet = () => { setShowCommentSheet(false); setSheetComments([]); setSheetInput('') }
  useModalA11y(showCommentSheet, sheetPanelRef, closeCommentSheet)
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const el = cardRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: '300px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    // Parent already resolved this in a batched query → don't self-fetch.
    if (linkedOpeningProp !== undefined) return
    if (!post.uuid) return
    jobOpenings.getByPostId(post.uuid)
      .then(setLinkedOpening)
      .catch((err) => { console.warn('[FeedPostCard] linked opening fetch failed', post.uuid, err); setLinkedOpening(undefined) })
  }, [post.uuid, linkedOpeningProp])

  useEffect(() => {
    if (!showCommentSheet || !post.uuid) return
    setSheetLoading(true)
    feedService.getComments(post.uuid, { page: 1, limit: 5, postId: post.postId })
      .then(r => { if (r.success) { setSheetComments(r.data); setSheetCount(r.pagination.totalItems) } })
      .catch((err) => console.warn('[FeedPostCard] sheet comments fetch failed', post.uuid, err))
      .finally(() => setSheetLoading(false))
  }, [showCommentSheet, post.uuid])

  // Load the real bookmark state for this post once on mount - unless the
  // parent already batched it (savedInitial provided).
  useEffect(() => {
    if (savedInitial !== undefined) return
    if (!isAuthenticated || !post.postId) return
    // Item 8.2: skip the fetch entirely when the store already knows this
    // post - a post seen once on the feed costs nothing to render again on a
    // profile. Seeding rather than setting, so "asked and not saved" is
    // recorded as a known false.
    if (savedStore.get(post.postId) !== undefined) return
    let cancelled = false
    savedPostsService.getSavedSet([post.postId])
      .then(set => { if (!cancelled) savedStore.seed([post.postId], set) })
      .catch((err) => console.warn('[FeedPostCard] saved-state fetch failed', post.postId, err))
    return () => { cancelled = true }
  }, [isAuthenticated, post.postId, savedInitial])

  // `e` is optional: the shaped branch's meta row already stops the click
  // before it reaches the card shell, so it has nothing to stop here.
  // The auth-intent hero (lib/authIntent.ts): written right before every
  // navigate('/login') below that a signed-out visitor can trigger from this
  // card, so LoginPage can say honestly which post and which action. No
  // author name - see authIntent.ts's own rule 1.
  const gatePostIntent = (action: 'like' | 'save' | 'comment') =>
    setAuthIntent({ kind: 'post', action, excerpt: post.body || '', category: (post.category as GateCategory) })

  const handleBookmark = async (e?: { stopPropagation: () => void }) => {
    e?.stopPropagation()
    if (!isAuthenticated) { gatePostIntent('save'); navigate('/login'); return }
    if (bookmarkBusy) return
    const next = !bookmarked
    // Optimistic icon flip for responsiveness, but the success/info toast fires
    // only AFTER the write resolves — otherwise a failed save showed a green
    // "Saved" immediately followed by a red "Could not save" (contradictory).
    setBookmarked(next)
    if (next) {
      setBookmarkPop(true)
      setTimeout(() => setBookmarkPop(false), 400)
    }
    setBookmarkBusy(true)
    try {
      if (next) { await savedPostsService.save(post.postId); success('saved to bookmarks') }
      else { await savedPostsService.unsave(post.postId); info('removed from bookmarks') }
    } catch (err: any) {
      setBookmarked(!next)
      console.error('Bookmark toggle failed:', err)
      toastError(next ? 'couldn’t save that.' : 'couldn’t unsave that.', err?.message)
    } finally {
      setBookmarkBusy(false)
    }
  }

  const authorColor = hashColor(post.authorName || post.authorUuid || '')
  const initials = getInitials(post.authorName || 'U')
  // /profile/:uuid is the self-view (no follow button); /member/:uuid is the
  // public view. Only route to /profile when the author IS the viewer -
  // this used to check `member` (is anyone logged in), which sent every
  // author link for every logged-in viewer to the no-follow page.
  const profilePath = member?.uuid === post.authorUuid ? `/profile/${post.authorUuid}` : `/member/${post.authorUuid}`

  const goPost = () => setShowFocusModal(true)

  // Hoisted above the job-opening early return: a hook cannot be called
  // conditionally, and that branch returns before the shaped branch below.
  const shapedItem = useMemo(() => feedItemFromPost(post, profilePath), [post, profilePath])

  // Text-only posts have no media block, so the author row becomes the card's
  // first child and the category pill has nowhere to float (01.15.2/01.15.3).
  const hasMedia = !!(post.images && post.images.length > 0)

  const handleLike = async () => {
    if (isLiking) return
    if (!isAuthenticated) { gatePostIntent('like'); navigate('/login'); return }
    const wasLiked = liked
    const priorCount = likeCount
    setLiked(!wasLiked)
    setLikeCount(c => wasLiked ? c - 1 : c + 1)
    setIsLiking(true)
    try {
      const result = await feedService.toggleLike(post.uuid, post.postId, priorCount)
      if (result.success) { setLiked(result.data.liked); setLikeCount(result.data.likeCount) }
    } catch (err: any) {
      setLiked(wasLiked); setLikeCount(c => wasLiked ? c + 1 : c - 1)
      toastError('couldn’t register that. try again.', err?.message)
    }
    setIsLiking(false)
    onLikeToggle?.()
  }

  const handleSheetComment = async () => {
    if (!sheetInput.trim() || sheetSubmitting) return
    if (!isAuthenticated) { gatePostIntent('comment'); navigate('/login'); return }
    const body = sheetInput.trim()
    // No moderation queue exists for comments - both severity tiers hard-block.
    if ((await checkText(body)).severity !== 'clean') { toastError(BLOCK_MESSAGE); return }
    const tempComment = {
      uuid: 'temp-' + Date.now(), body,
      createdAt: new Date().toISOString(),
      authorUuid: member?.uuid, authorName: member?.full_name || 'You',
      authorAvatar: member?.avatar_url || null, isTemp: true,
    }
    setSheetComments(prev => [...prev, tempComment])
    setSheetCount(c => c + 1)
    setSheetInput('')
    setSheetSubmitting(true)
    try {
      const result = await feedService.addComment(post.uuid, body, post.postId)
      if (result.success) setSheetComments(prev => prev.map(c => c.uuid === tempComment.uuid ? result.data : c))
    } catch (err: any) {
      setSheetComments(prev => prev.filter(c => c.uuid !== tempComment.uuid))
      setSheetCount(c => c - 1)
      setSheetInput(body)
      toastError('comment didn’t post. try again.', err?.message)
    }
    setSheetSubmitting(false)
  }

  // Hiring posts render as a compact, distinct ticket instead of a full post card.
  if ((post as any).sourceType === 'job_opening') {
    const op = linkedOpening
    const metaBits = [op?.commitment, op?.deadline ? `closes ${new Date(op.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : null].filter(Boolean)
    return (
      <HiringCard
        title={(post as any).sourceTitle || post.body.slice(0, 80)}
        category={post.category}
        meta={metaBits.length ? metaBits.join(' · ') : undefined}
        href={safeExternalHref((post as any).linkUrl) || '/opportunities'}
        seed={seed}
      />
    )
  }


  // ── the shaped branch (section 10 step 5) ──────────────────────────────────
  // A shape renders the author, the photo, the headline and the meta row. It
  // does NOT render the six host-resolved blocks below, and there is no
  // shape-level place for them: the welfare dedupe needs to see both `stats`
  // and `sourceStat`, which only this component can. So they are composed here
  // once and handed down through `CardProps.extras` (see types.ts), which is
  // the ONLY thing that field carries.
  //
  // The markup is deliberately the same markup and the same feed.css classes
  // the live layout uses further down - not a second styling of the same data.
  // If you change one, change both; they are duplicated rather than hoisted so
  // that the live layout below stays readable as one continuous card.
  const shaped = !!decision && SHAPED_SHAPES.has(decision.shape)
  const docs: any[] = (post as any).documents || []
  const extrasNode = !shaped ? null : (
    <div className="feed-card-extras" onClick={e => e.stopPropagation()}>
      {linkedOpening && linkedOpening.status !== 'open' && (
        <div className="feed-closed-notice">
          <span style={{ fontSize: 13 }}>⚠</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--danger)', fontWeight: 700 }}>
            This role is no longer accepting applications.
          </span>
        </div>
      )}
      {(post as any).sourceType === 'welfare_project' && (() => {
        const summary = (post as any).sourceSummary as string | null
        const stat = (post as any).sourceStat as string | null
        const statPromoted = !!(post as any).stats?.some(
          (st: { label: string }) => stat?.toLowerCase().includes(String(st.label).toLowerCase()),
        )
        const line = summary || (!statPromoted ? stat : null)
        if (!line) return null
        const norm = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim()
        if (norm(post.body).includes(norm(line))) return null
        return (
          <p className="feed-card-snippet" style={{ marginTop: 0 }}>
            {line.length > 200 ? line.slice(0, 197) + '…' : line}
          </p>
        )
      })()}
      {!!(post as any).stats?.length && (
        <div className="feed-stats">
          {(post as any).stats.map((st: { value: string; label: string }, i: number) => (
            <span key={i} className="feed-stat">
              <b>{st.value}</b>
              <span>{st.label}</span>
            </span>
          ))}
        </div>
      )}
      {(post as any).linkUrl && (
        <a href={safeExternalHref((post as any).linkUrl)} target="_blank" rel="noopener noreferrer" className="feed-link-cta">
          <span className="feed-link-thumb" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </span>
          <span style={{ minWidth: 0 }}>
            <span className="feed-link-title" style={{ display: 'block' }}>
              {(post as any).linkTitle || (post as any).linkUrl.replace(/^https?:\/\//, '').slice(0, 40)}
            </span>
            <span className="feed-link-host" style={{ display: 'block' }}>
              {(post as any).linkUrl.replace(/^https?:\/\//, '').split('/')[0]}
            </span>
          </span>
        </a>
      )}
      {docs.length > 0 && (
        <button
          className="btn btn-sm btn-ghost"
          onClick={goPost}
          title={`${docs.length} attachment${docs.length !== 1 ? 's' : ''}`}
          aria-label={`${docs.length} attachment${docs.length !== 1 ? 's' : ''}`}
          style={{ opacity: 0.75, alignSelf: 'flex-start' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
          <span className="mono" style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{docs.length}</span>
        </button>
      )}
    </div>
  )

  return (
    <MotionConfig reducedMotion="user">
    <>
    {shaped && decision ? (
      // The IntersectionObserver, the pause class and the category custom
      // property stay on the host element, exactly as on the <article> below:
      // one observer per list item, never one per shape.
      <div
        ref={cardRef as any}
        className={!visible ? 'aq-animations-paused' : undefined}
        style={{ ['--cc' as string]: CAT_COLORS[post.category] } as React.CSSProperties}
      >
        <FeedCard
          item={shapedItem}
          decision={decision}
          seed={seed}
          allowEager={allowEager}
          visible={visible}
          liked={liked}
          saved={bookmarked}
          likeCount={likeCount}
          commentCount={sheetCount}
          busy={{ like: isLiking, save: bookmarkBusy }}
          savePop={bookmarkPop}
          onLike={handleLike}
          onSave={() => handleBookmark()}
          onComment={() => setShowCommentSheet(true)}
          onShare={() => setShowShareModal(true)}
          onOpen={goPost}
          onOpenImage={src => setLightboxSrc(src)}
          onOpenAuthor={() => navigate(profilePath)}
          extras={extrasNode}
        />
      </div>
    ) : (
    <article
      ref={cardRef}
      className={`feed-card${!visible ? ' aq-animations-paused' : ''}`}
      style={{ ['--cc' as string]: CAT_COLORS[post.category] } as React.CSSProperties}
      onClick={goPost}
    >
      {/* MEDIA - first child now (01.15.2), so the scroll is a column of
          images with their attribution beneath. Only rendered if real images
          exist. `img.blobUrl || img.url` normalises the two shapes Post.images
          may carry: new posts ship a Supabase storage URL as `blobUrl`,
          legacy/sample posts pre-stored a plain CDN URL as `url`. Both
          fields are optional on the Post type. */}
      {post.images && post.images.length > 0 && (
        <div className="feed-card-media" style={{ position: 'relative' }}>
          {post.images.length === 1 ? (
            <Img
              ctx="card"
              // The home feed has no hero, so the FIRST card's photo is the
              // page's LCP element - and it was shipping loading="lazy", which
              // defers it past layout at low fetch priority. Every other route
              // already marks its above-fold image eager (AQNav, BlogPostPage,
              // PublicProjectsPage, AboutTab); the feed was the one that didn't.
              // Only seed 0 gets it: eager-loading the whole list would undo
              // the lazy-loading that keeps the rest of the feed cheap.
              eager={allowEager && seed === 0}
              className="no-long-press"
              src={post.images[0].blobUrl || post.images[0].url}
              alt={`Photo from ${post.authorName}'s post`}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onClick={e => {
                e.stopPropagation()
                const src = post.images![0].blobUrl || post.images![0].url
                if (src) setLightboxSrc(src)
              }}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', height: '100%' }}>
              {post.images.slice(0, 2).map((img, i) => {
                const src = img.blobUrl || img.url
                // Stable key - use the resolved URL, fall back to index
                // if both URL fields somehow missing (defensive only).
                return (
                  <Img key={src || `img-${i}`} ctx="card" className="no-long-press" src={src} alt={`${post.authorName || 'AquaTerra'}'s ${post.category || ''} post photo · AquaTerra`.replace(/\s+/g, ' ')}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onClick={e => { e.stopPropagation(); if (src) setLightboxSrc(src) }}
                  />
                )
              })}
            </div>
          )}
          {/* Category, stated once - on the photo when there is one, in the
              author row when there is not (01.15.3 / 01.15.4). */}
          <span className="feed-card-cat-float">
            <span className="chip-dot" aria-hidden="true" style={{ background: 'var(--cc)' }} />
            {post.category}
          </span>
        </div>
      )}

      {/* AUTHOR HEADER */}
      <header className="feed-card-head">
        <button
          className="row gap-2"
          onClick={e => { e.stopPropagation(); navigate(profilePath) }}
          style={{ alignItems: 'center', minWidth: 0, flex: 1, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          {/* Initials are solid ink on every hue: hashColor returns six accents
              and white initials fail AA on two of them (grape 4.35:1, ops
              3.82:1). Ink passes on all six. */}
          <div className="avatar" style={{ background: isOfficialAccount(post.authorName) ? '#fff' : authorColor, color: 'var(--ink)', width: 34, height: 34, fontSize: 12, flexShrink: 0, overflow: 'hidden' }}>
            {isOfficialAccount(post.authorName)
              ? <Img src="/stamp-ink-96.png" alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} />
              : post.authorAvatar
                ? <Img ctx="avatar" src={post.authorAvatar} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                : initials}
          </div>
          <div style={{ minWidth: 0, textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, fontSize: 13.5, lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {post.authorName}
              {isOfficialAccount(post.authorName) && <VerifiedTick />}
            </div>
            <div className="mono xs muted" style={{ marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {(post as any).authorSchool && `${(post as any).authorSchool} · `}{timeAgo(post.createdAt)}
            </div>
          </div>
        </button>
        {!hasMedia && (
          <div className="row gap-2" style={{ alignItems: 'center' }}>
            {/* "each card design should have variations that helps make
                everything feel lively and varied" - a text-only post is the
                single most common feed shape, and its category chip always
                sat perfectly flat. A tiny deterministic tilt (post.uuid
                hash, same non-reshuffling rule PostStreamCard's variants
                use) instead of a shared `.chip` CSS change, which would hit
                every chip in the app (filters, tabs, category pills) - not
                just this one spot. */}
            <span
              className={'chip cat-' + post.category}
              style={post.uuid.charCodeAt(0) % 2 === 1 ? { transform: 'rotate(-2.5deg)' } : undefined}
            >
              {post.category}
            </span>
            {/* ⋮ removed - no action defined yet */}
          </div>
        )}
      </header>

      {/* Job opening badge - shown when post has a linked role that's no longer open */}
      {linkedOpening && linkedOpening.status !== 'open' && (
        <div className="feed-closed-notice" onClick={e => e.stopPropagation()}>
          <span style={{ fontSize: 13 }}>⚠</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--danger)', fontWeight: 700 }}>
            This role is no longer accepting applications.
          </span>
        </div>
      )}

      {/* BODY — headline is the opening of the post, cut at a WORD boundary.
          The old `slice(0, 120)` / `slice(120, 300)` pair cut mid-word and put
          the two halves in different type styles, so a real post on the live
          feed read "…and with each note a tof" / "fee was distributed". */}
      <div className="feed-card-body">
        {/* h2, not h3: each card is an <article> sitting directly under the
            route's single <h1>, so h3 skipped a level and left the page with no
            h2 at all (WCAG 1.3.1). `.feed-card-title` pins its own size, weight
            and line-height, so the level is purely semantic here. */}
        {/* The title is a real <Link> so the card has a keyboard-reachable,
            focusable, middle-clickable route into the post. A plain click is
            intercepted and handed back to the card's own goPost() (the focus
            modal), so mouse behaviour is unchanged; a modified click falls
            through to the browser and opens /post/:uuid in a new tab. The
            <article> is deliberately NOT given role="button"/tabIndex, which
            would nest this link and the footer controls inside a widget. */}
        <h2 className="h-display feed-card-title">
          <Link
            to={`/post/${post.uuid}`}
            onClick={e => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
              e.preventDefault()
              e.stopPropagation()
              goPost()
            }}
            style={{ color: 'inherit', textDecoration: 'none' }}
          >
            {headline}{headline.length < post.body.length ? '…' : ''}
          </Link>
        </h2>
        {rest && <p className="feed-card-snippet">{rest}</p>}
        {/* Welfare-project write-up. A project's mirrored post body is just its
            header, so without this the card was a title and a photo with none
            of the work described. `sourceSummary` is the project's own
            short_summary; `sourceStat` is its key_statistic, shown only when
            the view did NOT already turn it into a stat pill below (it promotes
            the short numeric ones like "16 cards made!" and leaves full
            sentences here) — otherwise the same sentence appears twice. */}
        {(post as any).sourceType === 'welfare_project' && (() => {
          const summary = (post as any).sourceSummary as string | null
          const stat = (post as any).sourceStat as string | null
          const statPromoted = !!(post as any).stats?.some(
            (s: { label: string }) => stat?.toLowerCase().includes(String(s.label).toLowerCase()),
          )
          const line = summary || (!statPromoted ? stat : null)
          if (!line) return null
          // A mirrored project's body often already opens with its own summary,
          // so this printed the same sentence twice in two type styles. Compare
          // on normalized text, not identity — the body is the header plus the
          // summary, so `includes` is the right test, not equality.
          const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
          if (norm(post.body).includes(norm(line))) return null
          return (
            <p className="feed-card-snippet" style={{ marginTop: 6 }}>
              {line.length > 200 ? line.slice(0, 197) + '…' : line}
            </p>
          )
        })()}
        {/* Stat blocks - compact highlighted pills, same data as the colored
            rail on the full post page. */}
        {!!(post as any).stats?.length && (
          <div className="feed-stats">
            {(post as any).stats.map((s: { value: string; label: string }, i: number) => (
              <span key={i} className="feed-stat">
                <b>{s.value}</b>
                <span>{s.label}</span>
              </span>
            ))}
          </div>
        )}
        {/* Link CTA */}
        {(post as any).linkUrl && (
          <a href={safeExternalHref((post as any).linkUrl)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="feed-link-cta">
            <span className="feed-link-thumb" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </span>
            <span style={{ minWidth: 0 }}>
              <span className="feed-link-title" style={{ display: 'block' }}>
                {(post as any).linkTitle || (post as any).linkUrl.replace(/^https?:\/\//, '').slice(0, 40)}
              </span>
              <span className="feed-link-host" style={{ display: 'block' }}>
                {(post as any).linkUrl.replace(/^https?:\/\//, '').split('/')[0]}
              </span>
            </span>
          </a>
        )}
      </div>

      {/* ACTIONS */}
      <footer className="feed-card-foot">
        <LikeButton liked={liked} count={likeCount} onToggle={handleLike} />
        <button
          className="btn btn-sm btn-ghost"
          onClick={e => { e.stopPropagation(); setShowCommentSheet(true) }}
          title="comments"
          aria-label="Comments"
        >
          <I.comment />
          <span className="mono" style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {sheetCount}
          </span>
        </button>
        <button
          className="btn btn-sm btn-ghost"
          onClick={e => { e.stopPropagation(); setShowShareModal(true) }}
          title="share"
          aria-label="Share this post"
        >
          <I.share />
        </button>
        {/* Attachment chip - appears only when the post has documents.
            Tapping it opens the focus modal where the full list renders
            with download links. */}
        {(post as any).documents && (post as any).documents.length > 0 && (
          <button
            className="btn btn-sm btn-ghost"
            onClick={e => { e.stopPropagation(); goPost() }}
            title={`${(post as any).documents.length} attachment${(post as any).documents.length !== 1 ? 's' : ''}`}
            aria-label={`${(post as any).documents.length} attachment${(post as any).documents.length !== 1 ? 's' : ''}`}
            style={{ opacity: 0.75 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
            <span className="mono" style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {(post as any).documents.length}
            </span>
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button
          className={'btn btn-sm btn-ghost' + (bookmarkPop ? ' bookmark-pop' : '')}
          onClick={handleBookmark}
          title={bookmarked ? 'Remove bookmark' : 'Bookmark post'}
          aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark post'}
          aria-pressed={bookmarked}
          style={{
            /* Raw --lemon (#FFC700) as a glyph on white is 1.61:1 and
               effectively invisible; --lemon-ink is 5.92:1 (01.15.8). */
            color: bookmarked ? 'var(--lemon-ink)' : 'var(--ink-2)',
            /* contextual icon animation - scale + opacity hint so the
               filled/unfilled swap feels like the icon "blooms" rather
               than just changing colour. */
            transition: 'color 0.18s, transform 0.22s var(--ease-out)',
            transform: bookmarked ? 'scale(1.08)' : 'scale(1)',
          }}
        >
          <I.bookmark />
        </button>
      </footer>
    </article>
    )}

    {/* Share modal - rendered via portal to escape article's onClick bubble */}
    {showShareModal && createPortal(
      <ShareModal
        url={`${window.location.origin}/post/${post.uuid}`}
        storyData={{
          type: 'post',
          title: post.body.slice(0, 100),
          body: post.body,
          authorName: post.authorName || 'AQ Member',
          authorAvatar: post.authorAvatar,
          authorSchool: (post as any).authorSchool,
          category: post.category,
          uuid: post.uuid,
          imageUrl: post.images && post.images.length > 0
            ? (post.images[0].blobUrl || post.images[0].url)
            : undefined,
        }}
        posterData={{
          body: post.body,
          authorName: post.authorName || 'AQ Member',
          authorSchool: (post as any).authorSchool,
          category: post.category,
          uuid: post.uuid,
          imageUrl: post.images && post.images.length > 0
            ? (post.images[0].blobUrl || post.images[0].url)
            : undefined,
          images: post.images && post.images.length > 1
            ? post.images.map(im => im.blobUrl || im.url).filter((u): u is string => !!u)
            : undefined,
        }}
        onClose={() => setShowShareModal(false)}
      />,
      document.body
    )}

    {/* Inline comment sheet */}
    {showCommentSheet && createPortal(
      <div
        onClick={closeCommentSheet}
        style={{
          position: 'fixed', inset: 0, zIndex: 310,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}
      >
        <div
          ref={sheetPanelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Comments"
          tabIndex={-1}
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 560,
            background: 'var(--card)',
            borderRadius: '32px 32px 0 0',
            border: 'none',
            boxShadow: 'var(--lift-4)',
            maxHeight: '76dvh',
            display: 'flex', flexDirection: 'column',
            animation: 'commentSheetIn 0.22s var(--ease-out)',
          }}
        >
          {/* Sheet header */}
          <div style={{ padding: '14px 18px 12px', borderBottom: 'var(--hair)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 17 }}>comments</span>
              {sheetCount > 0 && (
                <span className="mono xs" style={{ background: 'var(--bg-2)', borderRadius: 999, padding: '2px 9px', fontVariantNumeric: 'tabular-nums', fontSize: 11, fontWeight: 700 }}>
                  {sheetCount}
                </span>
              )}
            </div>
            <button
              onClick={() => { setShowCommentSheet(false); setSheetComments([]); setSheetInput('') }}
              aria-label="Close comments"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--ink-3)', fontSize: 18, lineHeight: 1,
                // 44×44, no negative margin: the sheet header has room, and
                // the audit lists the modal × as a P0 hit-target failure.
                minWidth: 44, minHeight: 44, padding: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 999,
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-3)')}
            >✕</button>
          </div>

          {/* Post snippet - context */}
          <div style={{ padding: '12px 18px 10px', borderBottom: 'var(--hair)', flexShrink: 0, background: 'var(--bg-2)' }}>
            <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 13, color: 'var(--ink)', lineHeight: 1.3 }}>
              {post.body.slice(0, 90)}{post.body.length > 90 ? '…' : ''}
            </div>
            <div className="mono xs muted" style={{ marginTop: 4 }}>
              {post.authorName} · <a href={`/post/${post.uuid}#comments`} onClick={e => { e.stopPropagation(); setShowCommentSheet(false) }} style={{ color: 'var(--welfare-ink)', textDecoration: 'none', fontWeight: 700 }}>view full post →</a>
            </div>
          </div>

          {/* Comments list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {sheetLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 18px' }}>
                {[1,2,3].map(i => (
                  <div key={i} className="v6-skeleton" style={{ height: 56, borderRadius: 14, animationDelay: `${i * 0.07}s` }} />
                ))}
              </div>
            ) : sheetComments.length === 0 ? (
              <div style={{ padding: '32px 18px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 18, marginBottom: 6 }}>
                  no comments yet.
                </div>
                <p className="muted" style={{ fontSize: 13 }}>{emptyLine}</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {sheetComments.map((c, idx) => {
                // hashColor / getInitials / timeAgo from lib/uiHelpers - the
                // sheet used to hand-roll all three (01.15.9).
                const cColor = hashColor(c.authorName || '')
                const cInits = getInitials(c.authorName || 'U')
                return (
                  <motion.div
                    key={c.uuid}
                    layout
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: c.isTemp ? 0.55 : 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
                    style={{
                    display: 'flex', gap: 12, padding: '13px 18px',
                    borderBottom: idx < sheetComments.length - 1 ? 'var(--hair)' : 'none',
                  }}>
                    <div className="avatar" style={{ background: cColor, color: 'var(--ink)', width: 32, height: 32, fontSize: 11, overflow: 'hidden', flexShrink: 0 }}>
                      {c.authorAvatar
                        ? <Img ctx="avatar" src={c.authorAvatar} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                        : cInits}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 12, color: 'var(--ink)' }}>{c.authorName}</span>
                        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{timeAgo(c.createdAt)}</span>
                      </div>
                      <p style={{ fontFamily: 'var(--eina)', fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-2)', margin: 0 }}>{c.body}</p>
                    </div>
                  </motion.div>
                )
                })}
              </AnimatePresence>
            )}
          </div>

          {/* Comment input */}
          <div style={{ padding: '12px 16px', borderTop: 'var(--hair)', flexShrink: 0, paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
            {isAuthenticated ? (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <div className="avatar" style={{ background: hashColor(member?.full_name || ''), color: 'var(--ink)', width: 32, height: 32, fontSize: 11, overflow: 'hidden', flexShrink: 0 }}>
                  {member?.avatar_url ? <Img ctx="avatar" src={member.avatar_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" /> : getInitials(member?.full_name || 'U')}
                </div>
                <input
                  value={sheetInput}
                  onChange={e => setSheetInput(e.target.value.slice(0, 500))}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSheetComment() } }}
                  placeholder="say something..."
                  style={{
                    flex: 1, padding: '9px 14px', background: 'var(--bg)',
                    border: 'var(--hair-3)', borderRadius: 999, color: 'var(--ink)',
                    /* 16px to suppress iOS Safari focus-zoom */
                    fontFamily: 'var(--eina)', fontSize: 16, outline: 'none',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--ink)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(10,10,10,0.18)')}
                />
                <button
                  className="btn btn-sm btn-primary"
                  onClick={handleSheetComment}
                  disabled={sheetSubmitting || !sheetInput.trim()}
                  style={{ flexShrink: 0 }}
                >
                  {sheetSubmitting ? '…' : '↑'}
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '4px 0' }}>
                <span style={{ fontFamily: 'var(--eina)', fontSize: 13, color: 'var(--ink-3)' }}>
                  <a href="/login" onClick={e => { e.preventDefault(); gatePostIntent('comment'); navigate('/login') }} style={{ color: 'var(--welfare-ink)', fontWeight: 700, textDecoration: 'none' }}>Log in</a>
                  {' '}to leave a comment.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>,
      document.body
    )}

    {/* Always mounted - internal AnimatePresence handles enter/exit. */}
    <ImageLightbox src={sized(lightboxSrc, 'full')} onClose={() => setLightboxSrc(null)} />

    {/* Focus modal - always mounted; isOpen drives AnimatePresence
        so the exit animation plays before unmount. */}
    <PostFocusModal isOpen={showFocusModal} post={post} onClose={() => setShowFocusModal(false)} />
    </>
    </MotionConfig>
  )
}

// Memoized - rendered in lists on Saved / Search / Profile pages. The
// parents pass a stable `post` object + numeric `seed`; `onLikeToggle`
// is optional. memo prevents every card re-rendering when the parent
// re-renders for unrelated reasons (e.g. search keystroke). Output
// identical.
export default memo(FeedPostCard)
