import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Img from '../../components/Img'
import { getInitials, hashColor, timeAgo } from '../../lib/uiHelpers'

// The ONE comment bubble, per changelog 03.5.1 / 03.5.3. Used inline on the
// post detail page (PostComments.tsx) today. `feed/FeedPostCard.tsx`'s bottom
// comment sheet still hand-rolls its own markup (two duplicate avatar-hash
// implementations + a local timeAgo — see that file's `showCommentSheet`
// block) and has not been switched over to this component yet; that file is
// owned by 01-home-feed.md/15-post-cards.md, not this one, so it is reported
// rather than edited here (see the PR notes). When it is, it should render
// exactly this component so the feed sheet and the detail page never fork.
//
// `@Full Name`-shaped tokens in the body render as a mention mark
// (`.aq-comment-mention`) - this app has no structured @mention feature (no
// comment_mentions table), so it is a plain text-pattern highlight, not a
// link to a profile. It exists because `reply` (below) prefills the composer
// with "@name " per 03.5.2's parent_id fallback, so replies really do start
// with that shape in the body text.
const MENTION_RE = /(@[A-Z][\p{L}'-]*(?:\s[A-Z][\p{L}'-]*){0,2})/gu

function renderBody(text: string) {
  const parts = text.split(MENTION_RE)
  return parts.map((part, i) =>
    i % 2 === 1
      ? <span key={i} className="aq-comment-mention">{part}</span>
      : <span key={i}>{part}</span>
  )
}

export interface CommentBubbleData {
  uuid: string
  body: string
  createdAt: string
  authorName: string
  authorUuid?: string
  authorAvatar?: string | null
  authorRole?: string | null
  isTemp?: boolean
  isFailed?: boolean
  commentId?: number
  /** Set when this comment is a reply and the parent's author name is known
   *  (same loaded page - see feedService.getComments' own comment on why a
   *  parent from an earlier page shows no name here). */
  parentAuthorName?: string | null
}

interface CommentBubbleProps {
  comment: CommentBubbleData
  /** Is the current viewer this comment's author, or a leader - controls the delete control. */
  canDelete: boolean
  /** Viewer is the author themselves - used only to pick the profile route. */
  isOwnProfile: boolean
  /** HoD/director badge next to the name. */
  isHoD: boolean
  onDelete?: () => void
  onReply?: (authorName: string, commentId: number) => void
  onRetry?: () => void
  onDismissFailed?: () => void
}

const LINE_CLAMP = 4

export default function CommentBubble({
  comment, canDelete, isOwnProfile, isHoD, onDelete, onReply, onRetry, onDismissFailed,
}: CommentBubbleProps) {
  const bodyRef = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)

  // Only the FIRST render (clamped) needs measuring - re-check whenever the
  // text itself changes (e.g. the optimistic row is replaced by the saved one).
  useLayoutEffect(() => {
    if (expanded) return
    const el = bodyRef.current
    if (!el) return
    setOverflowing(el.scrollHeight > el.clientHeight + 1)
  }, [comment.body, expanded])

  const color = hashColor(comment.authorName || comment.authorUuid || '')
  const initials = getInitials(comment.authorName || 'U')
  const profilePath = comment.authorUuid
    ? (isOwnProfile ? `/profile/${comment.authorUuid}` : `/member/${comment.authorUuid}`)
    : undefined

  return (
    <div className="aq-comment-row">
      {comment.parentAuthorName && (
        <span className="aq-comment-replyline mono">↳ replying to {comment.parentAuthorName}</span>
      )}
      <div
        className="aq-comment"
        style={{
          opacity: comment.isTemp && !comment.isFailed ? 0.55 : 1,
          // The 4-line cap is a stadium past ~3 lines (999px radius on a tall
          // box reads as a pill, not a bubble) - switch to the card radius
          // once expanded. 03.5.1.
          borderRadius: expanded ? 'var(--r-inner)' : 'var(--r-pill)',
        }}
      >
        {profilePath ? (
          <Link to={profilePath} style={{ flexShrink: 0 }}>
            <div className="aq-comment-avatar avatar" style={{ background: color, overflow: 'hidden' }}>
              {comment.authorAvatar
                ? <Img ctx="avatar" src={comment.authorAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                : initials}
            </div>
          </Link>
        ) : (
          <div className="aq-comment-avatar avatar" style={{ background: color, overflow: 'hidden' }}>{initials}</div>
        )}
        <div className="aq-comment-text">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {profilePath
              ? <Link to={profilePath} className="aq-comment-author" style={{ textDecoration: 'none', color: 'var(--ink)' }}>{comment.authorName}</Link>
              : <span className="aq-comment-author">{comment.authorName}</span>}
            {isHoD && <span className="aq-comment-hod">hod</span>}
            <span className="mono" style={{ fontSize: 9, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>
              {comment.isFailed ? 'not sent' : timeAgo(comment.createdAt)}
            </span>
          </div>
          <p
            ref={bodyRef}
            className="aq-comment-body"
            style={expanded ? undefined : { display: '-webkit-box', WebkitLineClamp: LINE_CLAMP, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {renderBody(comment.body)}
          </p>
          {overflowing && (
            <button type="button" className="aq-comment-more" onClick={() => setExpanded(v => !v)}>
              {expanded ? 'show less' : 'show more'}
            </button>
          )}
        </div>
      </div>

      {comment.isFailed ? (
        <div className="aq-comment-foot">
          <span className="mono" style={{ fontSize: 10, color: 'var(--danger-ink)', fontWeight: 700 }}>didn't send.</span>
          {onRetry && <button type="button" className="aq-comment-reply" onClick={onRetry}>retry</button>}
          {onDismissFailed && <button type="button" className="aq-comment-reply" onClick={onDismissFailed}>dismiss</button>}
        </div>
      ) : !comment.isTemp ? (
        <div className="aq-comment-foot">
          {onReply && comment.commentId != null && (
            <button type="button" className="aq-comment-reply" onClick={() => onReply(comment.authorName, comment.commentId!)}>reply</button>
          )}
          {canDelete && onDelete && <button type="button" className="aq-comment-reply" onClick={onDelete}>delete</button>}
        </div>
      ) : null}
    </div>
  )
}
