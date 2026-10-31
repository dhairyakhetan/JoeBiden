import { Post } from '../../services/api'
import { I, LikeButton } from '../../components/v6Shared'
import { timeAgo, count } from '../../lib/uiHelpers'

interface PostActionBarProps {
  post: Post
  liked: boolean
  likeCount: number
  onToggleLike: () => void
  commentCount: number
  onShare: () => void
  canEditPost: boolean
  isEditingPost: boolean
  onStartEdit: () => void
  isSuperAdmin: boolean
  isPinned: boolean
  isPinning: boolean
  onTogglePin: () => void
  canManagePost: boolean
  isDeletingPost: boolean
  onDeletePost: () => void
  editPostBody: string
  setEditPostBody: (v: string) => void
  isSavingPost: boolean
  onCancelEdit: () => void
  onSaveEdit: () => void
}

// The in-flow action row (03.3.1): border-top hairline, 44px bare-glyph
// buttons, a mono timestamp on the right - plus the inline post-body editor
// it toggles. `share` opens the shared ShareModal sheet (link, story card,
// poster studio); bookmark lives in the page-header row now (03.3.2), not
// here - see PostPage.tsx.
//
// "Bare-glyph" is followed for edit/pin (icon + aria-label/title, no visible
// word) but NOT for delete: a destructive, rarely-used control keeps a short
// visible label on purpose (defensible deviation, not an oversight - a bare
// trash glyph is an easy mis-tap next to like/comment/share).
export default function PostActionBar({
  post, liked, likeCount, onToggleLike, commentCount, onShare,
  canEditPost, isEditingPost, onStartEdit, isSuperAdmin,
  isPinned, isPinning, onTogglePin, canManagePost, isDeletingPost, onDeletePost,
  editPostBody, setEditPostBody, isSavingPost, onCancelEdit, onSaveEdit,
}: PostActionBarProps) {
  return (
    <>
      <div className="pp-actions">
        <LikeButton liked={liked} count={likeCount} onToggle={onToggleLike} />
        <a href="#comments" className="pp-action-btn" aria-label={count(commentCount, 'comment')}>
          <I.comment />
          <span className="mono pp-action-count">{commentCount}</span>
        </a>
        <button type="button" className="pp-action-btn" onClick={onShare} aria-label="Share this post" title="share">
          <I.share />
        </button>
        {canEditPost && !isEditingPost && (
          <button type="button" className="pp-action-btn" onClick={onStartEdit} aria-label="Edit post" title="edit">
            ✎
          </button>
        )}
        {isSuperAdmin && post.status === 'published' && (
          <button
            type="button"
            className="pp-action-btn"
            onClick={onTogglePin}
            disabled={isPinning}
            aria-label={isPinned ? 'Unpin from the notice board' : 'Pin to the notice board'}
            aria-pressed={isPinned}
            title={isPinned ? 'unpin' : 'pin'}
            style={isPinned ? { color: 'var(--welfare-ink)' } : undefined}
          >
            {isPinning ? '…' : '📌'}
          </button>
        )}
        {canManagePost && (
          <button
            type="button"
            className="pp-action-btn pp-action-btn--danger"
            onClick={onDeletePost}
            disabled={isDeletingPost}
          >
            {isDeletingPost ? 'deleting…' : 'delete'}
          </button>
        )}
        <span className="pp-actions-spacer" />
        <span className="mono xs pp-actions-time">{timeAgo(post.createdAt)}</span>
      </div>

      {isEditingPost && (
        <div className="pp-edit">
          <div className="mono xs upper pp-edit-label">editing post body</div>
          <textarea
            autoFocus
            className="pp-edit-textarea"
            value={editPostBody}
            onChange={e => setEditPostBody(e.target.value)}
            rows={Math.max(5, editPostBody.split('\n').length + 2)}
          />
          <div className="pp-edit-actions">
            <button type="button" className="btn btn-sm" onClick={onCancelEdit} disabled={isSavingPost}>cancel</button>
            <button type="button" className="btn btn-sm btn-primary" onClick={onSaveEdit} disabled={isSavingPost || !editPostBody.trim()}>
              {isSavingPost ? 'saving…' : 'save changes →'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
