import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Img from '../../components/Img'
import { Post } from '../../services/api'
import followService from '../../services/followService'
import { useToast } from '../../components/Toast'
import { getInitials, hashColor } from '../../lib/uiHelpers'
import { PostMeta } from './postParsing'

interface PostHeaderProps {
  post: Post
  displayTitle: string
  chipMeta: PostMeta[]
  member: any
  isAuthenticated: boolean
}

// The content pane's header (03.3.1): title, author row + Follow, tagged
// members and the plain structured-fact chips (Type/Location/… - not named
// by 03.3.1, so it keeps the nearest documented visual, the cream --r-inner
// well family, rather than the old ink-translucent pill it used to be).
// The category pill + back link moved up to PostPage's page-header row
// (03.3.2) and the ink sidebar chrome (halftone/Burst) is gone with it.
export default function PostHeader({ post, displayTitle, chipMeta, member, isAuthenticated }: PostHeaderProps) {
  const { success: toastSuccess, error: toastError } = useToast()
  const authorColor = hashColor(post.authorName || post.authorUuid || '')
  const initials = getInitials(post.authorName || 'U')
  const isOwner = member?.uuid === post.authorUuid
  // /profile/:uuid is the self-view (no follow button); /member/:uuid is the
  // public view - only route to /profile when the author IS the viewer.
  const profilePath = isOwner ? `/profile/${post.authorUuid}` : `/member/${post.authorUuid}`

  // Real follow state (03.3.1) - `follows` exists live and followService.ts
  // already backs a working Follow button on PublicProfilePage.tsx; this
  // mirrors that exact pattern (optimistic toggle, busy lock, toast, rollback)
  // rather than a second one. Not a new query shape - same service, new caller.
  const [isFollowing, setIsFollowing] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)
  const canFollow = isAuthenticated && !isOwner && !!post.authorUuid

  useEffect(() => {
    if (!canFollow || !post.authorUuid) return
    let cancelled = false
    followService.isFollowing(post.authorUuid)
      .then(v => { if (!cancelled) setIsFollowing(v) })
      .catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canFollow, post.authorUuid])

  const handleFollow = async () => {
    if (!canFollow || followBusy || !post.authorUuid) return
    setFollowBusy(true)
    const next = !isFollowing
    setIsFollowing(next)
    try {
      if (next) await followService.followByUuid(post.authorUuid)
      else await followService.unfollowByUuid(post.authorUuid)
      toastSuccess(next ? `Following ${post.authorName}` : `Unfollowed ${post.authorName}`)
    } catch (e: any) {
      setIsFollowing(!next)
      toastError(e?.message ?? "Couldn't update that.")
    } finally {
      setFollowBusy(false)
    }
  }

  return (
    <div className="pp-head">
      {displayTitle && <h1 className="pp-title">{displayTitle}</h1>}

      {chipMeta.length > 0 && (
        <div className="pp-meta-row">
          {chipMeta.map((m, i) => (
            <span key={i} className="pp-chip">
              <i>{m.label}</i>{m.value}
            </span>
          ))}
        </div>
      )}

      <div className="pp-author-row">
        <Link to={profilePath} className="pp-author">
          <div className="avatar pp-author-avatar" style={{ background: authorColor, overflow: 'hidden' }}>
            {post.authorAvatar
              ? <Img ctx="avatar" src={post.authorAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
              : initials}
          </div>
          <div>
            <div className="pp-author-name">{post.authorName}</div>
            {(post as any).authorSchool && <div className="mono xs pp-author-school">{(post as any).authorSchool}</div>}
          </div>
        </Link>
        {canFollow && (
          <button type="button" className="pp-follow" onClick={handleFollow} disabled={followBusy} aria-pressed={isFollowing}>
            {isFollowing ? '✓ following' : '+ follow'}
          </button>
        )}
      </div>

      {/* "with" row - other members tagged in this activity (03.3.1: a cream
          --r-inner well, avatar-stacked circles ringed in --bg not --card
          since the well itself is cream). */}
      {post.taggedMembers && post.taggedMembers.length > 0 && (
        <div className="pp-tagged-well">
          <div className="pp-tagged-avatars">
            {post.taggedMembers.slice(0, 6).map(t => (
              <div key={t.uuid} className="avatar avatar-stacked" style={{ background: hashColor(t.fullName || t.uuid || ''), overflow: 'hidden' }}>
                {getInitials(t.fullName || 'U')}
              </div>
            ))}
          </div>
          <span className="pp-tagged-names">
            with{' '}
            {post.taggedMembers.map((t, i) => (
              <span key={t.uuid}>
                <Link to={member?.uuid === t.uuid ? `/profile/${t.uuid}` : `/member/${t.uuid}`} className="pp-tagged-name-link">
                  {t.fullName}
                </Link>
                {i < post.taggedMembers!.length - 1 ? ', ' : ''}
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  )
}
