import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { PaperAirplaneIcon } from '@heroicons/react/24/outline'
import { hasLeaderAccess } from '../../lib/roles'
import { hashColor, getInitials } from '../../lib/uiHelpers'
import { useEmptyJoke } from '../../lib/emptyJokes'
import Img from '../../components/Img'
import CommentBubble from './CommentBubble'

interface PostCommentsProps {
  comments: any[]
  commentsLoading: boolean
  /** The comment fetch FAILED. Distinct from "loaded, and there are none" -
   *  conflating the two told a reader a 30-comment thread was empty. */
  commentsError?: boolean
  onRetryLoadComments?: () => void
  commentCount: number
  commentInput: string
  setCommentInput: (v: string) => void
  isSubmittingComment: boolean
  onAddComment: () => void
  onDeleteComment: (uuid: string) => void
  onRetryComment: (uuid: string) => void
  onDismissFailedComment: (uuid: string) => void
  onReplyTo: (authorName: string, commentId: number) => void
  /** The comment currently being replied to, if any - shown as a small
   *  chip above the compose box with a way to cancel back to a top-level
   *  comment. Real threading, 2026-09-14 (social-system IA audit). */
  replyingTo?: { commentId: number; authorName: string } | null
  onCancelReply?: () => void
  commentsHasMore: boolean
  onLoadMore: () => void
  isAuthenticated: boolean
  member: any
  /** Fires when a signed-out visitor presses the guest "Log in" prompt below -
   *  PostPage.tsx uses it to record the auth-intent hero's 'comment' gate for
   *  this post before the Link navigates. Optional so nothing else that
   *  renders this component has to know about it. */
  onGuestClick?: () => void
}

// Comments, inline on the detail page (03.5.2). The feed keeps its own bottom
// sheet (FeedPostCard.tsx, out of this file's scope - see CommentBubble.tsx's
// header comment); both are meant to converge on the ONE `CommentBubble` this
// file already uses.
export default function PostComments({
  comments, commentsLoading, commentsError, onRetryLoadComments, commentCount, commentInput, setCommentInput,
  isSubmittingComment, onAddComment, onDeleteComment, onRetryComment, onDismissFailedComment, onReplyTo,
  commentsHasMore, onLoadMore, isAuthenticated, member, onGuestClick, replyingTo, onCancelReply,
}: PostCommentsProps) {
  // Client-side only - re-orders the already-fetched page(s), no query change
  // (03.5.2). Because `getComments` pages oldest-first, "newest" only
  // reverses what has actually loaded so far, not the true global newest -
  // an accepted quirk of "no query change", not a bug to chase here.
  const [sortOrder, setSortOrder] = useState<'oldest' | 'newest'>('oldest')
  const emptyLine = useEmptyJoke('comments', 'be the first to say something.')
  const sortedComments = useMemo(
    () => (sortOrder === 'newest' ? [...comments].reverse() : comments),
    [comments, sortOrder],
  )
  const remaining = Math.max(0, commentCount - comments.length)

  return (
    <section id="comments" className="pp-comments-card">
      <div className="pp-comments-head">
        <div className="pp-comments-title">
          <span className="pp-comments-h">comments</span>
          {commentCount > 0 && <span className="pp-comments-count">{commentCount}</span>}
        </div>
        {comments.length > 1 && (
          <div className="pp-comments-sort" role="group" aria-label="Sort comments">
            <button type="button" aria-pressed={sortOrder === 'oldest'} onClick={() => setSortOrder('oldest')}>oldest</button>
            <button type="button" aria-pressed={sortOrder === 'newest'} onClick={() => setSortOrder('newest')}>newest</button>
          </div>
        )}
      </div>

      {isAuthenticated && replyingTo && (
        <div className="pp-replying-to mono">
          replying to {replyingTo.authorName}
          {onCancelReply && (
            <button type="button" onClick={onCancelReply} aria-label="Cancel reply" title="Cancel reply">✕</button>
          )}
        </div>
      )}

      {isAuthenticated ? (
        <div className="pp-compose">
          <div className="avatar pp-compose-avatar" style={{ background: hashColor(member?.full_name || member?.uuid || ''), overflow: 'hidden' }}>
            {member?.avatar_url
              ? <Img ctx="avatar" src={member.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
              : getInitials(member?.full_name || 'U')}
          </div>
          <input
            id="post-comment-input"
            className="pp-compose-input"
            value={commentInput}
            onChange={e => setCommentInput(e.target.value.slice(0, 500))}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onAddComment() } }}
            placeholder="say something..."
            /* 16px suppresses iOS Safari's focus-zoom. */
            style={{ fontSize: 16 }}
          />
          <button
            type="button"
            className="pp-compose-send"
            onClick={onAddComment}
            disabled={isSubmittingComment || !commentInput.trim()}
            aria-label="Send comment"
            title="Send comment"
          >
            {isSubmittingComment ? <span className="pp-spin" /> : <PaperAirplaneIcon width={15} height={15} strokeWidth={2} />}
          </button>
        </div>
      ) : (
        <div className="pp-comments-guest">
          <span><Link to="/login" onClick={onGuestClick}>Log in</Link> to leave a comment.</span>
        </div>
      )}

      {commentsLoading ? (
        <div className="pp-comments-list" aria-hidden>
          {[180, 140, 205].map((w, i) => (
            <div key={i} className="aq-comment-skel">
              <div className="v6-skeleton aq-comment-skel-avatar" />
              <div className="v6-skeleton aq-comment-skel-bar" style={{ width: w, animationDelay: `${i * 0.08}s` }} />
            </div>
          ))}
        </div>
      ) : comments.length > 0 ? (
        <div className="pp-comments-list">
          <AnimatePresence initial={false}>
            {sortedComments.map(c => {
              const isOwn = member?.uuid === c.authorUuid
              return (
                <motion.div
                  key={c.uuid}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                >
                  <CommentBubble
                    comment={c}
                    isOwnProfile={isOwn}
                    canDelete={isOwn || hasLeaderAccess(member?.role)}
                    isHoD={hasLeaderAccess(c.authorRole)}
                    onDelete={() => onDeleteComment(c.uuid)}
                    onReply={onReplyTo}
                    onRetry={() => onRetryComment(c.uuid)}
                    onDismissFailed={() => onDismissFailedComment(c.uuid)}
                  />
                </motion.div>
              )
            })}
          </AnimatePresence>
          {commentsHasMore && (
            <button type="button" className="pp-comments-more" onClick={onLoadMore}>
              {remaining} more comment{remaining !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      ) : commentsError ? (
        // A failed load is NOT an empty thread. Saying "be the first to say
        // something" over 30 comments nobody could fetch invites a reply into a
        // conversation the reader cannot see.
        <div className="pp-comments-empty" role="alert">
          <div className="pp-comments-empty-title">comments didn’t load.</div>
          <p className="pp-comments-empty-sub">
            This is a connection problem, not an empty thread — there may well be replies here.
          </p>
          {onRetryLoadComments && (
            <button type="button" className="pp-comments-more" onClick={onRetryLoadComments} style={{ marginTop: 12 }}>
              try again
            </button>
          )}
        </div>
      ) : (
        <div className="pp-comments-empty">
          <div className="pp-comments-empty-title">no comments yet.</div>
          <p className="pp-comments-empty-sub">{emptyLine}</p>
        </div>
      )}
    </section>
  )
}
