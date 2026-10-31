import './PostPage.css'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline'
import { Post } from '../services/api'
import Img from '../components/Img'
import ShareModal from '../components/ShareModal'
import { useAuth } from '../auth/AuthContext'
import feedService from '../services/feedService'
import profileService from '../services/profileService'
import savedPostsService from '../services/savedPostsService'
import { supabase as cmsSupabase } from '../lib/supabase'
import { pushRecent } from '../lib/recentlyViewed'
import { hasLeaderAccess, isSuperAdmin as isSuperAdminRole } from '../lib/roles'
import { useToast } from '../components/Toast'
import { useFeedCardBatch } from '../hooks/useFeedCardBatch'
import { useConfirm } from '../components/Confirm'
import { I } from '../components/v6Shared'
import { MotionConfig } from 'framer-motion'
import { useMeta } from '../hooks/useMeta'
import { useJsonLd, breadcrumbLd } from '../hooks/useJsonLd'
import { checkText, BLOCK_MESSAGE } from '../lib/profanityFilter'
import { CAT_COLORS, getInitials, hashColor } from '../lib/uiHelpers'
import { setAuthIntent, type GateCategory } from '../lib/authIntent'
import { getCategoryIcon } from './post/categoryIcons'
import { CAT_TO_DEPT } from '../lib/categories'
import { parsePost } from './post/postParsing'
import PostHeader from './post/PostHeader'
import PostBody from './post/PostBody'
import PostActionBar from './post/PostActionBar'
import PostComments from './post/PostComments'
import PostRelated from './post/PostRelated'
import PostMedia from './post/PostMedia'

const PostPage = () => {
  const { uuid } = useParams<{ uuid: string }>()
  const { member, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const { error: toastError, success: toastSuccess } = useToast()
  const confirm = useConfirm()

  const [post, setPost] = useState<Post | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [isLiking, setIsLiking] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)
  const [bookmarkBusy, setBookmarkBusy] = useState(false)
  // A quick pop on SAVE only, not on remove - same asymmetry LikeButton's
  // burst already uses (lib/motion.ts: "the asymmetry is the point").
  const [justSaved, setJustSaved] = useState(false)
  const [comments, setComments] = useState<any[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentsError, setCommentsError] = useState(false)
  // A FAILED load is not a deleted post. Kept separate from `notFound` so the
  // page never states as fact that something was removed when it simply could
  // not be fetched.
  const [loadError, setLoadError] = useState(false)
  /** Bumped by the retry button so the load effect re-runs for the same uuid. */
  const [reloadKey, setReloadKey] = useState(0)
  const [commentInput, setCommentInput] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  /** Real threading (2026-09-14, social-system IA audit): which comment
   *  handleReplyTo targeted, so addComment can carry a real parent_comment_id
   *  instead of just the old "@name " text-prefill fallback. Cleared on send. */
  const [replyingTo, setReplyingTo] = useState<{ commentId: number; authorName: string } | null>(null)
  const [commentPage, setCommentPage] = useState(1)
  const [commentsHasMore, setCommentsHasMore] = useState(false)
  const [commentCount, setCommentCount] = useState(0)
  const [isEditingPost, setIsEditingPost] = useState(false)
  const [editPostBody, setEditPostBody] = useState('')
  const [isSavingPost, setIsSavingPost] = useState(false)
  const [isDeletingPost, setIsDeletingPost] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const [isPinning, setIsPinning] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [relByAuthor, setRelByAuthor] = useState<Post[]>([])
  const [relByCategory, setRelByCategory] = useState<Post[]>([])
  const [relLoading, setRelLoading] = useState(false)
  // Batch-resolve saved/opening state for every related-rail card in one pair
  // of queries instead of each FeedPostCard self-fetching (was up to ~16 extra
  // requests per post view across the two rails).
  const { savedSet: relSavedSet, openings: relOpenings } = useFeedCardBatch([...relByAuthor, ...relByCategory])
  // Welfare posts mirror a welfare_project; this holds that project's full
  // long-form writeup so the complete story shows on the post automatically.
  const [projectWriteup, setProjectWriteup] = useState<string | null>(null)

  // Per-route SEO from the REAL post. This used to pass `pageMetadata.post`
  // straight through, so every single post page shipped the literal, unsubstituted
  // template "{postTitle} | Student Community Post" as its <title> and
  // "{postImage}" as its og:image.
  const parsedForMeta = post ? parsePost(post.body || '') : null
  const metaTitle = (parsedForMeta?.title || parsedForMeta?.body || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 70)
  const metaDescription = [parsedForMeta?.title, parsedForMeta?.body]
    .filter(Boolean)
    .join(' - ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
  const metaImage = post?.images?.[0]
    ? ((post.images[0] as any).blobUrl || (post.images[0] as any).url || '')
    : (post?.linkImage || '')

  // ── Canonical / indexation ────────────────────────────────────────────────
  // Almost every post here is a MIRROR: the blog→post, project→post and
  // opening→post triggers create a feed post for content whose real home is
  // /blog/:slug, /projects/:slug or /opportunities/:id. As of this audit that
  // is 555 of 556 published posts — so /post/:uuid is not an untapped SEO
  // surface, it is 555 duplicate URLs competing with pages that are already in
  // the sitemap. Point each one's canonical at the source so the ranking signal
  // consolidates there instead of being split.
  //
  // The remainder are member-authored. Those get noindex: the authors are
  // students, many of them minors, and a personal community post is not
  // something to publish into a search index by default.
  const sourceType = (post as any)?.sourceType as string | null | undefined
  const sourceSlug = (post as any)?.sourceSlug as string | null | undefined
  const sourceHref = sourceType && sourceSlug
    ? (sourceType === 'welfare_project' ? `/projects/${sourceSlug}`
      : sourceType === 'blog' ? `/blog/${sourceSlug}`
      : sourceType === 'job_opening' ? `/opportunities/${sourceSlug}`
      : null)
    : null

  useMeta({
    // While the post is loading, emit the site default rather than a wrong
    // title a crawler could latch onto.
    title: post && metaTitle ? `${metaTitle} | AquaTerra` : 'AquaTerra Community Post',
    description: post
      ? (metaDescription || `A community update from ${post.authorName} on AquaTerra.`)
      : 'A post from the AquaTerra student community in Kolkata.',
    image: metaImage,
    type: 'article',
    author: post?.authorName || undefined,
    publishDate: post?.createdAt || undefined,
    // Mirrored -> canonical to the source. Member-authored -> stay on self and
    // noindex. Never canonicalize while `post` is still null, or a slow load
    // would emit a self-canonical for a page that is about to become a mirror.
    url: sourceHref ?? undefined,
    noIndex: !!post && !sourceHref,
  })

  // Breadcrumb only. These are short community updates, not editorial articles -
  // emitting Article/NewsArticle here would claim a rich-result type the visible
  // content doesn't support.
  useJsonLd('post-breadcrumb', post && metaTitle ? breadcrumbLd([
    ['Home', '/'], ['Projects', '/projects'], [metaTitle, `/post/${post.uuid}`],
  ]) : null)

  // Read inside the fetch's `.then()` without re-running the fetch whenever
  // auth resolves after mount (see the gate below) - a ref stays current
  // without adding member to this effect's dependency list.
  const memberRef = useRef(member)
  useEffect(() => { memberRef.current = member }, [member])

  useEffect(() => {
    if (!uuid) return
    setIsLoading(true)
    setCommentsLoading(true)
    setProjectWriteup(null)
    feedService.getPost(uuid)
      .then(async result => {
        if (!result.success) { setNotFound(true); setCommentsLoading(false); return }
        const p = result.data.post
        // 22.1 / UX-GAPS #18: a member posting and then opening their own
        // post used to see "post not found" for anything not yet published -
        // the same silent gap MyPostsPage's own comment already names ("Only
        // published posts have a public /post/:uuid page"). `posts.status` is
        // readable by its author or a director under a live RLS policy
        // ("Authors and directors can view pending posts") verified against
        // the database, not assumed - so let them through and show 03.7's
        // status well instead of a false 404.
        const viewer = memberRef.current
        const canSeeUnpublished = viewer?.uuid === p.authorUuid || hasLeaderAccess(viewer?.role)
        if (p.status !== 'published' && !canSeeUnpublished) {
          setNotFound(true); setCommentsLoading(false); return
        }
        setPost(p)
        // Auto-attach the linked welfare project's long writeup.
        if ((p as any).sourceType === 'welfare_project' && (p as any).sourceSlug) {
          cmsSupabase.from('welfare_projects')
            .select('long_writeup, short_summary')
            .eq('slug', (p as any).sourceSlug)
            .maybeSingle()
            .then(
              ({ data }) => setProjectWriteup((data as any)?.long_writeup || (data as any)?.short_summary || null),
              () => {},
            )
        }
        // Record for the "recently viewed" rail on the feed home.
        const rvTitle = (p.body || '').split('\n').map(s => s.trim()).find(Boolean) || 'Post'
        pushRecent({
          kind: 'post',
          id: p.uuid,
          title: rvTitle.length > 80 ? rvTitle.slice(0, 77) + '…' : rvTitle,
          subtitle: p.authorName ? `by ${p.authorName}` : undefined,
          image: p.images?.[0] ? ((p.images[0] as any).blobUrl || (p.images[0] as any).url) : undefined,
          href: `/post/${p.uuid}`,
        })
        setLiked(p.isLiked || false)
        setLikeCount(p.likeCount || 0)
        setIsPinned(p.pinned || false)
        // Use known postId to skip uuid→post_id roundtrip in getComments
        // Seed the count from the post row FIRST. If the comment fetch fails,
        // the header must not claim 0 on a thread the post itself says has 30 -
        // that zero was the most convincing part of the lie.
        setCommentCount(p.commentCount || 0)
        setCommentsError(false)
        feedService.getComments(uuid, { page: 1, limit: 10, postId: p.postId })
          .then(r => {
            if (r.success) {
              setComments(r.data)
              setCommentCount(r.pagination.totalItems)
              setCommentsHasMore(r.pagination.hasNextPage)
              setCommentPage(1)
              setCommentsError(false)
            } else {
              setCommentsError(true)
            }
          })
          .catch(e => { setCommentsError(true); console.error(e) })
          .finally(() => setCommentsLoading(false))
      })
      .catch((e: any) => {
        // PGRST116 is PostgREST's "no rows returned" from .single() - that IS a
        // genuine not-found. Everything else (offline, DNS, 5xx, a rate limit)
        // is a failure to LOAD, and telling the reader the author deleted the
        // post is both wrong and unrecoverable: the not-found screen has no
        // retry, so a member following a shared link on a weak connection
        // concludes the post is gone and never tries again.
        const code = e?.code || e?.error?.code
        if (code === 'PGRST116') setNotFound(true)
        else setLoadError(true)
        setCommentsLoading(false)
      })
      .finally(() => setIsLoading(false))
  }, [uuid, reloadKey])

  // Bookmark state - no batch parent to supply this on a standalone detail
  // page, so it self-fetches once (the same fallback FeedPostCard uses when
  // it isn't handed `savedInitial`), never on every render.
  useEffect(() => {
    if (!post || !isAuthenticated) { setBookmarked(false); return }
    let cancelled = false
    savedPostsService.getSavedSet([post.postId])
      .then(set => { if (!cancelled) setBookmarked(set.has(post.postId)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [post?.postId, isAuthenticated])

  // Related content - "more from {author}" and "more in {category}". Reuses the
  // same author-posts / category-feed queries the rest of the app uses; both are
  // single reads, filtered to exclude the current post and capped at 4.
  useEffect(() => {
    if (!post) return
    let cancelled = false
    setRelLoading(true)
    setRelByAuthor([])
    setRelByCategory([])
    Promise.allSettled([
      post.authorUuid
        ? profileService.getMemberPosts(post.authorUuid, { page: 1, limit: 5 })
        : Promise.resolve({ success: true, data: [] as Post[] } as any),
      feedService.getFeed({ page: 1, limit: 6, category: post.category }),
    ]).then(([authorRes, catRes]) => {
      if (cancelled) return
      if (authorRes.status === 'fulfilled' && authorRes.value?.success) {
        setRelByAuthor(authorRes.value.data.filter((p: Post) => p.uuid !== post.uuid).slice(0, 4))
      }
      if (catRes.status === 'fulfilled' && catRes.value?.success) {
        setRelByCategory(catRes.value.data.filter((p: Post) => p.uuid !== post.uuid).slice(0, 4))
      }
    }).finally(() => { if (!cancelled) setRelLoading(false) })
    return () => { cancelled = true }
  }, [post?.uuid, post?.authorUuid, post?.category])

  // The auth-intent hero (lib/authIntent.ts) - written right before every
  // navigate('/login') this page can trigger, so LoginPage can honestly say
  // which post and which action. No author name - authIntent.ts's own rule.
  const gatePostIntent = (action: 'like' | 'save' | 'comment') => {
    if (!post) return
    setAuthIntent({ kind: 'post', action, excerpt: post.body || '', category: post.category as GateCategory })
  }

  const handleLike = async () => {
    if (!isAuthenticated) { gatePostIntent('like'); navigate('/login'); return }
    if (isLiking || !post) return
    const wasLiked = liked
    const priorCount = likeCount
    setLiked(!wasLiked); setLikeCount(c => wasLiked ? c - 1 : c + 1)
    setIsLiking(true)
    try {
      const result = await feedService.toggleLike(post.uuid, post.postId, priorCount)
      if (result.success) { setLiked(result.data.liked); setLikeCount(result.data.likeCount) }
    } catch (e: any) {
      setLiked(wasLiked); setLikeCount(c => wasLiked ? c + 1 : c - 1)
      toastError('couldn’t register that. try again.', e?.message)
    }
    setIsLiking(false)
  }

  // Mirrors FeedPostCard's handleBookmark exactly (UX-GAPS #24: the toast
  // fires only AFTER the write resolves, never optimistically) - the page
  // header row is a second caller of the same pattern, not a new one.
  const handleBookmark = async () => {
    if (!isAuthenticated) { gatePostIntent('save'); navigate('/login'); return }
    if (bookmarkBusy || !post) return
    const next = !bookmarked
    setBookmarked(next)
    if (next) { setJustSaved(true); setTimeout(() => setJustSaved(false), 400) }
    setBookmarkBusy(true)
    try {
      if (next) { await savedPostsService.save(post.postId); toastSuccess('Saved to bookmarks') }
      else { await savedPostsService.unsave(post.postId); toastSuccess('Removed from bookmarks') }
    } catch (e: any) {
      setBookmarked(!next)
      toastError(next ? 'Could not save post' : "couldn't unsave that.", e?.message)
    } finally {
      setBookmarkBusy(false)
    }
  }

  // Share opens the shared sheet rather than firing a bare
  // navigator.share/clipboard copy inline. Nothing is lost - the sheet's first
  // two rows ARE native share and copy link, with the same clipboard fallback -
  // and it is what carries the story card and the poster studio, neither of
  // which this page offered to anyone but a leader before.
  const handleShare = () => setShowShareModal(true)

  const handleTogglePin = async () => {
    if (!post) return
    setIsPinning(true)
    try {
      const newPinned = !isPinned
      await feedService.pinPost(post.uuid, newPinned)
      setIsPinned(newPinned)
      toastSuccess(newPinned ? 'Pinned to the notice board' : 'Unpinned from the notice board')
    } catch (e: any) { toastError(e?.message ?? "Couldn't update the notice board.") }
    finally { setIsPinning(false) }
  }

  const handleDeletePost = async () => {
    if (!post || isDeletingPost) return
    const ok = await confirm({
      title: 'Delete this post?',
      // deletePost is a SOFT delete and never touches post_comments, so
      // "permanently removes the post and its comments" was a data-handling
      // promise the code does not keep - the same claim the privacy policy
      // leans on. Say what actually happens.
      body: 'This takes the post off the feed. You can’t undo it from here.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    setIsDeletingPost(true)
    try {
      await feedService.deletePost(post.uuid)
      toastSuccess('Post deleted')
      navigate(-1)
    }
    catch (e: any) { toastError(e?.message ?? "Couldn't delete this post.") }
    finally { setIsDeletingPost(false) }
  }

  const handleSavePostEdit = async () => {
    if (!post || !editPostBody.trim()) return
    setIsSavingPost(true)
    try {
      await feedService.updatePost(post.uuid, { body: editPostBody.trim() })
      setPost(p => p ? { ...p, body: editPostBody.trim() } : p)
      setIsEditingPost(false)
      toastSuccess('Post updated')
    } catch (e: any) { toastError(e?.message ?? "Couldn't save your edit.") }
    finally { setIsSavingPost(false) }
  }

  // Posts one comment body under a given temp id; shared by a fresh submit
  // and a retry of a previously-failed one so the two never drift apart.
  const postCommentBody = async (tempUuid: string, body: string, parentCommentId?: number | null) => {
    try {
      const result = await feedService.addComment(uuid!, body, post?.postId, parentCommentId)
      if (result.success) {
        setComments(prev => prev.map(c => c.uuid === tempUuid ? result.data : c))
      }
    } catch (e: any) {
      // KEEP the rollback (03.5.2) - but as a distinct "didn't send" bubble
      // with a retry affordance (03.7), not a silent removal: the toast is
      // gone in three seconds and the comment text used to go with it.
      setComments(prev => prev.map(c => c.uuid === tempUuid ? { ...c, isTemp: false, isFailed: true } : c))
      toastError('comment didn’t post. try again.', e?.message)
    }
  }

  const handleAddComment = async () => {
    if (!commentInput.trim() || isSubmittingComment || !uuid) return
    const body = commentInput.trim()
    // No moderation queue exists for comments - both severity tiers hard-block.
    if ((await checkText(body)).severity !== 'clean') { toastError(BLOCK_MESSAGE); return }
    setIsSubmittingComment(true)
    const tempUuid = 'temp-' + Date.now()
    const parentCommentId = replyingTo?.commentId ?? null
    const tempComment = {
      commentId: Date.now(),
      uuid: tempUuid,
      body,
      createdAt: new Date().toISOString(),
      authorId: member?.member_id,
      authorUuid: member?.uuid,
      authorName: member?.full_name || 'You',
      authorAvatar: member?.avatar_url || null,
      authorRole: member?.role || 'member',
      isTemp: true,
      parentCommentId,
      parentAuthorName: replyingTo?.authorName ?? null,
    }
    setComments(prev => [...prev, tempComment])
    setCommentCount(c => c + 1)
    setCommentInput('')
    setReplyingTo(null)
    await postCommentBody(tempUuid, body, parentCommentId)
    setIsSubmittingComment(false)
  }

  const handleRetryComment = async (tempUuid: string) => {
    const target = comments.find(c => c.uuid === tempUuid)
    if (!target || isSubmittingComment || !uuid) return
    setIsSubmittingComment(true)
    setComments(prev => prev.map(c => c.uuid === tempUuid ? { ...c, isFailed: false, isTemp: true } : c))
    await postCommentBody(tempUuid, target.body, target.parentCommentId ?? null)
    setIsSubmittingComment(false)
  }

  const handleDismissFailedComment = (tempUuid: string) => {
    setComments(prev => prev.filter(c => c.uuid !== tempUuid))
    setCommentCount(c => Math.max(0, c - 1))
  }

  const handleReplyTo = (authorName: string, commentId: number) => {
    // Real threading (2026-09-14): sets replyingTo so handleAddComment
    // attaches a real parent_comment_id (see comments_add_parent_comment_id
    // migration) and the parent comment's own author gets notified, not
    // just the post's. The "@name " text prefill stays too - it's still the
    // only visible cue in the flat, unindented comment list that this reply
    // was addressed to someone, and CommentBubble.tsx's mention-highlight
    // already expects that shape.
    setReplyingTo({ commentId, authorName })
    setCommentInput(prev => (prev.trim() ? prev.trim() + ' ' : '') + `@${authorName} `)
    requestAnimationFrame(() => {
      const el = document.getElementById('post-comment-input') as HTMLInputElement | null
      el?.focus()
      el?.setSelectionRange(el.value.length, el.value.length)
    })
  }

  const handleDeleteComment = async (commentUuid: string) => {
    const ok = await confirm({
      title: 'Delete this comment?',
      body: "The comment will be removed for everyone. This can't be undone.",
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    const removed = comments.find(c => c.uuid === commentUuid)
    setComments(prev => prev.filter(c => c.uuid !== commentUuid))
    setCommentCount(c => c - 1)
    try {
      await feedService.deleteComment(commentUuid)
    } catch (e: any) {
      // Roll the optimistic removal back so the comment reappears, and
      // tell the user why (e.g. RLS blocked it).
      if (removed) setComments(prev => [...prev, removed])
      setCommentCount(c => c + 1)
      toastError(e?.message ?? "Couldn't delete this comment.")
    }
  }

  const loadMoreComments = async () => {
    if (!uuid || !commentsHasMore) return
    const nextPage = commentPage + 1
    try {
      const result = await feedService.getComments(uuid, { page: nextPage, limit: 10, postId: post?.postId })
      if (result.success) {
        setComments(prev => [...prev, ...result.data])
        setCommentsHasMore(result.pagination.hasNextPage)
        setCommentPage(nextPage)
      }
    } catch (e: any) {
      console.error(e)
      toastError('couldn’t load more comments. try again.', e?.message)
    }
  }

  if (isLoading) {
    return (
      <div className="route-enter post-page-root">
        <div className="pp-header-row">
          <div className="v6-skeleton sk-pill" style={{ width: 84, height: 44, borderRadius: 999 }} />
          <div className="v6-skeleton sk-pill" style={{ width: 96, height: 44, borderRadius: 999 }} />
        </div>
        <div className="post-shell">
          <div className="post-media-outer">
            <div className="post-media-pane">
              <div className="v6-skeleton" style={{ aspectRatio: '4/3', borderRadius: 'var(--r-inner)' }} />
            </div>
          </div>
          <div className="post-secondary-col">
            <div className="post-content-col sk-group" style={{ paddingTop: 18 }}>
              <div className="v6-skeleton" style={{ width: '85%', height: 32, marginBottom: 10 }} />
              <div className="v6-skeleton" style={{ width: '55%', height: 32, marginBottom: 22 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="v6-skeleton sk-circle" style={{ width: 38, height: 38 }} />
                <div className="v6-skeleton" style={{ width: 130, height: 14 }} />
              </div>
              {[100, 96, 92, 68].map((w, i) => (
                <div key={i} className="v6-skeleton" style={{ width: `${w}%`, height: 14, marginTop: 18 }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loadError && !post) {
    return (
      <div className="route-enter aq-wrap pp-notfound" style={{ paddingTop: 'clamp(44px, 8vw, 80px)', paddingBottom: 'clamp(44px, 8vw, 80px)', textAlign: 'center', maxWidth: 600, margin: '24px auto' }}>
        <h1 className="h-display" style={{ fontSize: 40, margin: 0 }}>couldn’t load this post.</h1>
        <p className="muted" style={{ marginTop: 12 }}>
          The post is probably fine — this is a connection problem on our side.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: 24, display: 'inline-flex' }}
          onClick={() => { setLoadError(false); setIsLoading(true); setReloadKey(k => k + 1) }}
        >
          try again
        </button>
      </div>
    )
  }

  if (notFound || !post) {
    return (
      <div className="route-enter aq-wrap pp-notfound" style={{ paddingTop: 'clamp(44px, 8vw, 80px)', paddingBottom: 'clamp(44px, 8vw, 80px)', textAlign: 'center', maxWidth: 600, margin: '24px auto' }}>
        {/* h1, not a div: this branch replaces the ENTIRE page, so without it
            the document has no heading at all and a screen reader has
            nothing to announce on arrival. Same visual treatment. */}
        <h1 className="h-display" style={{ fontSize: 40, margin: 0 }}>post not found.</h1>
        <p className="muted" style={{ marginTop: 12 }}>this post doesn't exist or has been removed.</p>
        {/* changelog/11-system-states.md §11.6: `/post/:uuid` -> "that post is
            gone" -> the action is "back to the feed". `← go back` named no
            destination, and the visitor who most needs this arrived from a
            shared dead link with no history to go back through.
            The href stays `/`, which IS the feed: App.tsx routes `/feed` to
            `<Navigate to="/" replace />`, so pointing at `/feed` would only
            add a redirect hop to the same screen. */}
        <Link to="/" className="btn btn-primary" style={{ marginTop: 24, display: 'inline-flex' }}>← back to the feed</Link>
      </div>
    )
  }

  const accent = CAT_COLORS[post.category] || 'var(--welfare)'
  const isOwner = member?.uuid === post.authorUuid
  const isSuperAdmin = isSuperAdminRole(member?.role)
  const canManagePost = isOwner || hasLeaderAccess(member?.role)
  // Mirrors `posts_update` exactly. The policy is
  //   (author_id = self AND status IN ('pending_review','rejected')) OR is_director()
  // and this read `isOwner || isSuperAdmin`, which was wrong in BOTH directions:
  // an author whose post had been approved was shown ✎, rewrote it, and got a
  // permission error on their own post; while a hod/director was denied an edit
  // the database would have allowed, because isSuperAdminRole is narrower than
  // is_director(). hasLeaderAccess is the TS twin of is_director().
  const canEditPost =
    (isOwner && (post.status === 'pending_review' || post.status === 'rejected')) ||
    hasLeaderAccess(member?.role)
  const CatIcon = getCategoryIcon(post.category)
  // 03.7 - shown only to whoever the live RLS policy already lets read a
  // non-published post (its author, or a director/HoD): everyone else was
  // already turned back at "not found" above, so reaching this point with a
  // non-published status means the viewer is exactly that audience.
  const showStatusWell = post.status !== 'published'
  const isRejectedStatus = post.status === 'rejected'

  // Pull title / structured metadata / narrative apart for proper presentation.
  const { title: displayTitle, meta: postMeta, body: displayBody } = parsePost(post.body)
  // "Impact" (and any long value) gets a prominent highlight in the body; the
  // short identifying facts (Type, Location, Volunteers…) become hero chips.
  const highlightMeta = postMeta.filter(m => m.label.toLowerCase() === 'impact' || m.value.length > 34)
  const chipMeta = postMeta.filter(m => !(m.label.toLowerCase() === 'impact' || m.value.length > 34))

  return (
    <MotionConfig reducedMotion="user">
    <div className="route-enter post-page-root">

      {/* ── Page header row (03.3.2) - back / category / share / bookmark,
          one row of white pill capsules, above the grid, both breakpoints
          (see the CSS file's mismatch note on 02's segmented-ink chrome). ── */}
      <div className="pp-header-row">
        <button type="button" className="pp-hcap" onClick={() => navigate(-1)} aria-label="Go back">
          <ArrowLeftIcon width={15} height={15} strokeWidth={2} /> back
        </button>
        <Link
          to={CAT_TO_DEPT[post.category] ? `/everything-we-do#${CAT_TO_DEPT[post.category]}` : '/everything-we-do'}
          className="pp-hcap"
          style={{ color: accent }}
        >
          <CatIcon width={13} height={13} strokeWidth={1.8} /> {post.category}
        </Link>
        <span className="pp-header-spacer" />
        <button type="button" className="pp-hcap pp-hcap--icon" onClick={handleShare} aria-label="Share this post" title="share">
          <I.share />
        </button>
        <button
          type="button"
          className={'pp-hcap pp-hcap--icon' + (justSaved ? ' pp-hcap--pop' : '')}
          onClick={handleBookmark}
          disabled={bookmarkBusy}
          aria-label={bookmarked ? 'Remove bookmark' : 'Save this post'}
          aria-pressed={bookmarked}
          title={bookmarked ? 'saved' : 'save'}
        >
          <I.bookmark />
        </button>
      </div>

      <div className="post-shell">

        {/* .post-media-outer is the flex item that stretches to match
            .post-secondary-col's height; .post-media-pane inside it is what
            actually sticks, sized to its own content. See PostPage.css for
            why this two-layer split replaced an earlier CSS Grid row-span
            version that measured out to a ~360px dead gap on a short post. */}
        <div className="post-media-outer">
          <div className="post-media-pane">
            <PostMedia post={post} />
          </div>
        </div>

        <div className="post-secondary-col">
          <div className="post-content-col">
            {showStatusWell && (
              <div className={`pp-status-well${isRejectedStatus ? ' is-rejected' : ''}`}>
                <span className="pp-status-dot" aria-hidden />
                <span className="pp-status-text">
                  {post.status === 'pending_review' && <>awaiting review. <b>visible only to you and your HoD</b> until it's approved.</>}
                  {post.status === 'scheduled' && <>scheduled. <b>publishes {(post as any).scheduledFor ? new Date((post as any).scheduledFor).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'soon'}</b> - visible only to you until then.</>}
                  {isRejectedStatus && <>not approved. <b>visible only to you.</b> ask your HoD for details.</>}
                  {!['pending_review', 'scheduled', 'rejected'].includes(post.status) && <>not yet published. <b>visible only to you.</b></>}
                </span>
              </div>
            )}

            <PostHeader
              post={post}
              displayTitle={displayTitle}
              chipMeta={chipMeta}
              member={member}
              isAuthenticated={isAuthenticated}
            />

            <PostBody
              post={post}
              highlightMeta={highlightMeta}
              displayBody={displayBody}
              projectWriteup={projectWriteup}
            />

            <PostActionBar
              post={post}
              liked={liked}
              likeCount={likeCount}
              onToggleLike={handleLike}
              commentCount={commentCount}
              onShare={handleShare}
              canEditPost={canEditPost}
              isEditingPost={isEditingPost}
              onStartEdit={() => { setEditPostBody(post.body); setIsEditingPost(true) }}
              isSuperAdmin={isSuperAdmin}
              isPinned={isPinned}
              isPinning={isPinning}
              onTogglePin={handleTogglePin}
              canManagePost={canManagePost}
              isDeletingPost={isDeletingPost}
              onDeletePost={handleDeletePost}
              editPostBody={editPostBody}
              setEditPostBody={setEditPostBody}
              isSavingPost={isSavingPost}
              onCancelEdit={() => setIsEditingPost(false)}
              onSaveEdit={handleSavePostEdit}
            />
          </div>

          <PostComments
          comments={comments}
          commentsLoading={commentsLoading}
          commentsError={commentsError}
          onRetryLoadComments={() => { if (uuid) { setCommentsLoading(true); setCommentsError(false); feedService.getComments(uuid, { page: 1, limit: 10 }).then(r => { if (r.success) { setComments(r.data); setCommentCount(r.pagination.totalItems); setCommentsHasMore(r.pagination.hasNextPage); setCommentPage(1) } else setCommentsError(true) }).catch(() => setCommentsError(true)).finally(() => setCommentsLoading(false)) } }}
          commentCount={commentCount}
          commentInput={commentInput}
          setCommentInput={setCommentInput}
          isSubmittingComment={isSubmittingComment}
          onAddComment={handleAddComment}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          onDeleteComment={handleDeleteComment}
          onRetryComment={handleRetryComment}
          onDismissFailedComment={handleDismissFailedComment}
          onReplyTo={handleReplyTo}
          commentsHasMore={commentsHasMore}
          onLoadMore={loadMoreComments}
          isAuthenticated={isAuthenticated}
          member={member}
          onGuestClick={() => gatePostIntent('comment')}
        />

          <PostRelated
            post={post}
            relLoading={relLoading}
            relByAuthor={relByAuthor}
            relByCategory={relByCategory}
            relSavedSet={relSavedSet}
            relOpenings={relOpenings}
          />
        </div>{/* /.post-secondary-col */}

      </div>

      {/* Phone-only sticky reply bar (03.4) - see the CSS file's note on why
          it stacks above the bottom nav instead of replacing it. */}
      {isAuthenticated ? (
        <div className="pp-reply-bar">
          <div className="avatar pp-reply-bar-avatar" style={{ background: hashColor(member?.full_name || member?.uuid || ''), overflow: 'hidden' }}>
            {member?.avatar_url
              ? <Img ctx="avatar" src={member.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
              : getInitials(member?.full_name || 'U')}
          </div>
          <input
            className="pp-reply-bar-input"
            value={commentInput}
            onChange={e => setCommentInput(e.target.value.slice(0, 500))}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment() } }}
            placeholder="say something..."
            aria-label="Write a comment"
          />
          <button
            type="button"
            className="pp-reply-bar-send"
            onClick={handleAddComment}
            disabled={isSubmittingComment || !commentInput.trim()}
            aria-label="Send comment"
            title="Send comment"
          >
            {isSubmittingComment ? <span className="pp-spin" /> : <PaperAirplaneIcon width={16} height={16} strokeWidth={2} />}
          </button>
        </div>
      ) : (
        <div className="pp-reply-bar">
          <Link to="/login" className="pp-reply-bar-guest" onClick={() => gatePostIntent('comment')}>Log in to leave a comment.</Link>
        </div>
      )}

      {/* Share sheet - link, story card and poster studio on one surface, open
          to anyone who can read the post (a member sharing their own post
          included). Portalled so it escapes the article's stacking context. */}
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
            imageUrl: post.images?.length ? ((post.images[0] as any).blobUrl || (post.images[0] as any).url) : undefined,
          }}
          posterData={{
            body: post.body,
            authorName: post.authorName || 'AQ Member',
            authorSchool: (post as any).authorSchool,
            category: post.category,
            uuid: post.uuid,
            imageUrl: post.images?.length ? ((post.images[0] as any).blobUrl || (post.images[0] as any).url) : undefined,
            images: post.images && post.images.length > 1
              ? post.images.map((im: any) => im.blobUrl || im.url)
              : undefined,
          }}
          onClose={() => setShowShareModal(false)}
        />,
        document.body
      )}

    </div>
    </MotionConfig>
  )
}

export default PostPage
