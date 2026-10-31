import Img from './Img'
import '../styles/routes/feed.css'
import '../styles/lightbox.css'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useModalA11y } from '../hooks/useDialog'
import { createPortal } from 'react-dom'
import { acquireScrollLock } from '../lib/scrollLock'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { modalBackdropTransition, modalPanelTransition } from '../lib/motion'
import { Link, useNavigate } from 'react-router-dom'
import { Post } from '../services/api'
import { safeExternalHref } from '../lib/safeUrl'
import { useAuth } from '../auth/AuthContext'
import feedService from '../services/feedService'
import { I, LikeButton } from './v6Shared'
import { hashColor, CAT_COLORS } from '../lib/uiHelpers'
import { setAuthIntent, type GateCategory } from '../lib/authIntent'
import { derivePostHeadline } from '../feed/postHeadline'

// Compact variant (no "ago" on m/h, unlike lib/uiHelpers' timeAgo) - keeps
// this modal's meta line tighter. Deliberately not consolidated.
function timeAgo(iso: string) {
  const d=Math.floor((Date.now()-new Date(iso).getTime())/1000)
  if(d<60) return 'just now'; if(d<3600) return `${Math.floor(d/60)}m`
  if(d<86400) return `${Math.floor(d/3600)}h`
  const days=Math.floor(d/86400)
  if(days<30) return `${days}d ago`
  if(days<365) return `${Math.floor(days/30)}mo ago`
  return `${Math.floor(days/365)}y ago`
}

interface PostFocusModalProps {
  /**
   * Drives both visibility and exit animation. When toggled false the
   * modal stays mounted long enough for AnimatePresence to play the
   * exit transition before unmounting the inner card.
   */
  isOpen: boolean
  /** Last opened post - required to stay non-null during the exit so
   *  the card can render its leaving frame. Callers should keep
   *  passing the same post while isOpen drops to false. */
  post: Post
  onClose: () => void
}

export default function PostFocusModal({ isOpen, post, onClose }: PostFocusModalProps) {
  const navigate = useNavigate()
  const { member, isAuthenticated } = useAuth()
  const [liked, setLiked] = useState(post.isLiked || false)
  const [likeCount, setLikeCount] = useState(post.likeCount || 0)
  const [isLiking, setIsLiking] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  const accent = CAT_COLORS[post.category] || 'var(--c-welfare)'
  const authorColor = hashColor(post.authorName || '')
  const initials = (post.authorName || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  // Same headline/body split FeedCard uses (feed/postHeadline.ts) so a post
  // reads identically whether it's seen as a card or expanded here.
  const { headline, rest, truncated } = useMemo(() => derivePostHeadline(post.body), [post.body])
  const hasMedia = !!(post.images && post.images.length > 0)
  // /profile/:uuid is the self-view (no follow button); /member/:uuid is the
  // public view - only route to /profile when the author IS the viewer.
  const profilePath = member?.uuid === post.authorUuid ? `/profile/${post.authorUuid}` : `/member/${post.authorUuid}`

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return
    return acquireScrollLock()
  }, [isOpen])

  // Escape, the Tab trap, focus-in and focus-restore, and the body
  // scroll-lock. This used to be an Escape listener ONLY: the panel declared
  // aria-modal="true", telling assistive tech the page behind it was inert,
  // while Tab walked straight out into it and focus was never moved into the
  // dialog or returned to the card that opened it.
  const panelRef = useRef<HTMLDivElement | null>(null)
  useModalA11y(isOpen, panelRef, onClose)

  const handleLike = async () => {
    if (!isAuthenticated) {
      setAuthIntent({ kind: 'post', action: 'like', excerpt: post.body || '', category: post.category as GateCategory })
      navigate('/login'); onClose(); return
    }
    if (isLiking) return
    const wasLiked = liked
    const priorCount = likeCount
    setLiked(!wasLiked); setLikeCount(c => wasLiked ? c-1 : c+1); setIsLiking(true)
    try {
      const r = await feedService.toggleLike(post.uuid, (post as any).postId, priorCount)
      if (r.success) { setLiked(r.data.liked); setLikeCount(r.data.likeCount) }
    } catch { setLiked(wasLiked); setLikeCount(c => wasLiked ? c+1 : c-1) }
    setIsLiking(false)
  }

  return createPortal(
    <MotionConfig reducedMotion="user">
    <AnimatePresence>
      {isOpen && (
      <motion.div
        key="focus-overlay"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={modalBackdropTransition}
        style={{
          position: 'fixed', inset: 0, zIndex: 400,
          // Routed onto the shared scrim tokens (tokens.css) instead of a
          // hand-rolled rgba/blur pair - matches every other full-focus
          // overlay in the app (ApprovedWelcomeModal, etc.) exactly rather
          // than approximating it.
          background: 'var(--scrim-strong)',
          backdropFilter: 'var(--scrim-blur)',
          WebkitBackdropFilter: 'var(--scrim-blur)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px 16px',
        }}
      >
        {/* Card */}
        <motion.div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Post"
          onClick={e => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 4 }}
          transition={modalPanelTransition}
          style={{
            width: '100%', maxWidth: 560,
            background: 'var(--card)',
            borderRadius: 'var(--r-outer)',
            border: 'none',
            boxShadow: 'var(--lift-4)',
            maxHeight: '88dvh',
            overflowY: 'auto',
            paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
          }}
        >
          {/* Accent bar - flush with the panel's own top edge, so its corners
              match the panel's OUTER radius (32), not an inset one. 03.6. */}
          <div style={{ height: 4, background: accent, borderRadius: 'var(--r-outer) var(--r-outer) 0 0' }} />

          {/* Header */}
          <div style={{ padding: '16px 18px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link to={profilePath} onClick={e => { e.stopPropagation(); onClose() }} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              <div className="avatar" style={{ background: authorColor, width: 38, height: 38, fontSize: 13, overflow: 'hidden', flexShrink: 0 }}>
                {post.authorAvatar ? <Img ctx="avatar" src={post.authorAvatar} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} referrerPolicy="no-referrer" /> : initials}
              </div>
              <div>
                <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 14, color: 'var(--ink)' }}>{post.authorName}</div>
                <div className="mono xs muted">{timeAgo(post.createdAt)}</div>
              </div>
            </Link>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {/* When there's a photo the category shows as the floated pill
                  over it instead (matching FeedCard's hasMedia branch) - a
                  text-only post has nowhere to float it, so it stays here. */}
              {!hasMedia && <span className={'chip cat-' + post.category} style={{ fontSize: 10 }}>{post.category}</span>}
              <button
                onClick={onClose}
                aria-label="Close"
                title="Close"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--ink-3)', fontSize: 20, lineHeight: 1,
                  // 44×44 hit area (was 40×40; the audit lists the modal × as
                  // a P0 hit-target failure).
                  minWidth: 44, minHeight: 44, padding: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 999,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-3)')}
              >✕</button>
            </div>
          </div>

          {/* Images - `img.blobUrl || img.url` normalises Supabase blob
              URLs (new posts) and plain CDN URLs (legacy/sample posts).
              Both keys are optional on the Post.images type. */}
          {post.images && post.images.length > 0 && (
            <div style={{ margin: '14px 0 0', overflow: 'hidden', position: 'relative' }}>
              {/* Floated category pill - same class/markup as FeedCard's
                  feed-card-cat-float, so a post's category badge looks
                  identical whether seen as a card or expanded here. */}
              <span className="feed-card-cat-float">
                <span className="chip-dot" aria-hidden="true" style={{ background: accent }} />
                {post.category}
              </span>
              {post.images.length === 1 ? (
                <Img
                  ctx="card"
                  src={post.images[0].blobUrl || post.images[0].url}
                  alt={`Photo from ${post.authorName}'s post`}
                  style={{ width: '100%', maxHeight: 380, objectFit: 'cover', display: 'block', cursor: 'zoom-in' }}
                  onClick={() => {
                    const src = post.images![0].blobUrl || post.images![0].url
                    if (src) setLightboxSrc(src)
                  }}
                />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                  {post.images.slice(0, 4).map((img, i) => {
                    const src = img.blobUrl || img.url
                    return (
                      <Img key={src || `img-${i}`} ctx="card" src={src} alt={`${(post as any).authorName || 'AquaTerra'}'s ${(post as any).category || ''} post photo · AquaTerra`.replace(/\s+/g, ' ')}
                        style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', cursor: 'zoom-in' }}
                        onClick={() => { if (src) setLightboxSrc(src) }}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Body - headline/rest split, same as FeedCard's feed-card-title
              (h2) + feed-card-snippet, so the post reads the same expanded
              here as it does on the card that opened it. */}
          <div style={{ padding: '16px 18px' }}>
            <h2 className="h-display feed-card-title">
              {headline}{truncated ? '…' : ''}
            </h2>
            {rest && (
              <p className="feed-card-snippet" style={{ display: 'block', WebkitLineClamp: 'unset', overflow: 'visible', fontSize: 15, lineHeight: 1.78, whiteSpace: 'pre-wrap' }}>
                {rest}
              </p>
            )}
            {(post as any).linkUrl && (
              <a href={safeExternalHref((post as any).linkUrl)} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="feed-link-cta"
                style={{ marginTop: 14, display: 'inline-flex' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                {(post as any).linkTitle || (post as any).linkUrl.replace(/^https?:\/\//,'').slice(0,40)}
              </a>
            )}
          </div>

          {/* Document attachments - rendered when `attachDocuments`
              from lib/postDocuments has hydrated the post. PDFs and
              PPTXs each link out to the public Supabase Storage URL. */}
          {(post as any).documents && (post as any).documents.length > 0 && (
            <div style={{
              margin: '0 18px 14px',
              padding: '10px 12px',
              background: 'var(--bg-2)',
              borderRadius: 22,
              border: 'var(--hair)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}>
              <div className="mono xs upper muted" style={{ marginBottom: 4 }}>attachments</div>
              {(post as any).documents.map((doc: any, i: number) => {
                const lowerName = (doc.fileName || '').toLowerCase()
                const isPdf  = doc.mimeType === 'application/pdf' || lowerName.endsWith('.pdf')
                const isPptx = (doc.mimeType || '').includes('presentationml') || lowerName.endsWith('.pptx')
                const kind = isPdf ? 'pdf' : isPptx ? 'slides' : 'file'
                // No emoji in AquaTerra-authored copy (ACCEPTANCE §F). `I` has
                // no document glyph, so 01.19 option (a) applies: reuse the
                // nearest existing key rather than hand-writing a new SVG.
                const Icon = I.link
                const sizeKb = doc.size ? Math.round(doc.size / 1024) : null
                return (
                  <a
                    key={i}
                    href={safeExternalHref(doc.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px',
                      borderRadius: 14,
                      background: 'var(--card)',
                      border: 'var(--hair-3)',
                      textDecoration: 'none',
                      transition: 'border-color 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line-2)')}
                  >
                    <span style={{ display: 'inline-flex', flexShrink: 0, color: 'var(--ink-3)' }} aria-label={kind}><Icon /></span>
                    <span style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--ink)',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {doc.fileName || `Attachment ${i + 1}`}
                    </span>
                    {sizeKb !== null && (
                      <span className="mono xs muted" style={{ fontVariantNumeric: 'tabular-nums' }}>{sizeKb}kb</span>
                    )}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0, opacity: 0.4 }} aria-hidden>
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                )
              })}
            </div>
          )}

          {/* Actions */}
          <div style={{ padding: '12px 18px 16px', borderTop: '1px solid var(--line)', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <LikeButton liked={liked} count={likeCount} onToggle={handleLike} />
            <button className="btn btn-sm btn-ghost" onClick={() => { onClose(); navigate(`/post/${post.uuid}#comments`) }}>
              <I.comment />
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{post.commentCount || 0}</span>
            </button>
            <span style={{ flex: 1 }} />
            <button className="btn btn-sm btn-ghost" onClick={() => { onClose(); navigate(`/post/${post.uuid}`) }}
              style={{ fontFamily: 'var(--mono)', fontSize: 11, color: accent }}>
              full post →
            </button>
          </div>
        </motion.div>

        {/* Lightbox - rendered inside the overlay so it inherits the
            exit animation when the focus modal closes. */}
        {lightboxSrc && (
          <div className="aq-lightbox-overlay" onClick={() => setLightboxSrc(null)} style={{ zIndex: 500 }}>
            <Img ctx="full" eager src={lightboxSrc} alt={`Photo from ${post.authorName}'s post, enlarged`} className="aq-lightbox-img" onClick={e => e.stopPropagation()} />
            <button className="aq-lightbox-close" onClick={() => setLightboxSrc(null)} aria-label="Close" title="Close">✕</button>
          </div>
        )}
      </motion.div>
      )}
    </AnimatePresence>
    </MotionConfig>,
    document.body
  )
}
