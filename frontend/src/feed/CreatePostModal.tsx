import { celebrate } from '../lib/delight'
import Img from '../components/Img'
import './CreatePostModal.css'
import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import { springPop } from '../lib/motion'
import feedService, { CreatePostData } from '../services/feedService'
import blogService from '../services/blogService'
import BlogBlockEditor from '../components/BlogBlockEditor'
import teamService, { Team, TeamMember, SubTeam } from '../services/teamService'
import { useAuth } from '../auth/AuthContext'
import { useDebounce } from '../hooks/useDebounce'
import { feedService as feedServiceForSearch } from '../services/feedService'
import { hasLeaderAccess, isSuperAdmin } from '../lib/roles'
import { jobOpenings, CAT_COLORS } from '../lib/jobOpenings'
import { useToast } from '../components/Toast'
import { useIsMobile } from '../hooks/useMobile'
import { checkText, BLOCK_MESSAGE } from '../lib/profanityFilter'
import useDialog from '../hooks/useDialog'
import Field from '../components/Field'
import { getCategoryIcon } from './post/categoryIcons'
import { getInitials, hashColor } from '../lib/uiHelpers'
import { suggestCategory } from './composer/suggestCategory'
import { useComposerDraft, type ComposerDraft } from './composer/useComposerDraft'
import { resubmitBlockReason, buildResubmitPatch } from './composer/resubmit'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges'
import GatedButton from '../components/GatedButton'
import TeamTagPicker from './composer/TeamTagPicker'
import {
  XMarkIcon,
  PhotoIcon,
  LinkIcon,
  PaperClipIcon,
  TagIcon,
  ChartBarIcon,
  MapPinIcon,
  CalendarDaysIcon,
  ClockIcon,
  BriefcaseIcon,
  DocumentTextIcon,
  PencilSquareIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'

interface CreatePostModalProps {
  isOpen: boolean
  onClose: () => void
  onPostCreated: () => void
  /**
   * "Edit and resubmit" (§22.1). When set, the composer edits THIS post in
   * place via `feedService.updatePost` and returns the same row to the
   * moderation queue as pending_review — it does not create a second post.
   * The body/category still arrive through the ordinary draft-restore seam
   * (`seedComposerDraft`); this prop only changes where submit writes to.
   */
  editPost?: import('./composer/resubmit').ResubmitTarget | null
}

interface SearchedMember {
  memberId: number
  uuid: string
  fullName: string
  avatarUrl?: string
  classGrade?: string
  role: string | null
}

// ── Client-side image downscaling ────────────────────────────────────────────
// Re-encode a raster image before staging: longer edge capped at 1600px (never
// upscaled), WebP q0.8 (JPEG q0.85 where WebP encoding is unavailable). Small
// files (<300KB) and non-raster types (GIF animation, SVG vectors) pass
// through untouched. Throws on failure - the caller falls back to the
// original file.
const MAX_EDGE = 1600
const SKIP_BYTES = 300 * 1024

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file) } catch { /* fall through */ }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image decode failed')) }
    img.src = url
  })
}

async function downscaleImage(file: File): Promise<File> {
  if (file.size < SKIP_BYTES) return file
  if (!/^image\/(jpe?g|png|webp|avif|bmp|heic|heif)$/i.test(file.type)) return file

  const bitmap = await loadBitmap(file)
  const srcW = 'naturalWidth' in bitmap ? bitmap.naturalWidth : bitmap.width
  const srcH = 'naturalHeight' in bitmap ? bitmap.naturalHeight : bitmap.height
  if (!srcW || !srcH) throw new Error('Image has no dimensions')

  const scale = Math.min(1, MAX_EDGE / Math.max(srcW, srcH)) // never upscale
  const w = Math.max(1, Math.round(srcW * scale))
  const h = Math.max(1, Math.round(srcH * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D unavailable')
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h)
  if ('close' in bitmap) bitmap.close()

  // Feature-detect WebP encoding; fall back to JPEG.
  const supportsWebp = canvas.toDataURL('image/webp').startsWith('data:image/webp')
  const type = supportsWebp ? 'image/webp' : 'image/jpeg'
  const quality = supportsWebp ? 0.8 : 0.85

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), type, quality)
  )
  // If re-encoding somehow grew the file (already well-optimized source),
  // keep the original.
  if (blob.size >= file.size) return file

  const ext = supportsWebp ? '.webp' : '.jpg'
  const base = file.name.replace(/\.[a-z0-9]+$/i, '') || 'image'
  return new File([blob], base + ext, { type, lastModified: file.lastModified })
}

const CATEGORIES = [
  { value: 'events', label: 'Events' },
  { value: 'welfare', label: 'Welfare' },
  { value: 'content', label: 'Content' },
  { value: 'operations', label: 'Operations' },
  { value: 'labs', label: 'Labs' },
]

const initials = (name: string) => (name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2)

const CreatePostModal = ({ isOpen, onClose, onPostCreated, editPost = null }: CreatePostModalProps) => {
  const isEditing = !!editPost
  const { member } = useAuth()
  const { success, error: toastError, info } = useToast()
  const navigate = useNavigate()
  // The composer is a bottom sheet up to 1024px and a centred modal from
  // 1025px (redesign breakpoint tiers). The layout itself lives in
  // CreatePostModal.css; this flag only picks the framer-motion variant.
  const isMobile = useIsMobile(1024)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [category, setCategory] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [postMode, setPostMode] = useState<'normal' | 'job' | 'blog'>('normal')
  const isJobOpening = postMode === 'job'
  const isBlogPost = postMode === 'blog'
  const [jobCommitment, setJobCommitment] = useState('')
  const [jobDeadline, setJobDeadline] = useState('')
  const [submitDone, setSubmitDone] = useState(false)
  const [submitError, setSubmitError] = useState(false)

  const flashError = (msg: string) => {
    setError(msg)
    setSubmitError(true)
    toastError(msg)                                 // always fire a toast too
    setTimeout(() => setSubmitError(false), 2200)
  }
  const [blogContent, setBlogContent] = useState('')
  // Welfare posts double as welfare-project entries, so they require project
  // details (a location + at least one drive photo). Blog posts require a
  // headliner + cover image. Enforced in handleSubmit + surfaced below.
  const [welfareLocation, setWelfareLocation] = useState('')
  // Event/welfare posts also require: 2+ photos, a drive-link (Drive/Photos
  // folder), at least one tagged person, and a volunteer count - enforced in
  // handleSubmit below. No dedicated `volunteers` column on `posts` (that
  // only exists on the separate CMS `welfare_projects` table), so the count
  // gets stamped onto the body like the location line already does.
  const [volunteerCount, setVolunteerCount] = useState('')
  // Up to 2 highlighted stat blocks (value + label), shown in a colored rail
  // on the feed card + full post page - same visual language as the welfare
  // project detail page's "volunteers" / "the impact" cards. Welfare posts
  // auto-fill stat #1 from the volunteer count already collected above (see
  // the effect below); stat #2 and non-welfare posts are filled manually.
  const [stats, setStats] = useState<{ value: string; label: string }[]>([])
  const statsAutoFilled = useRef(false)
  useEffect(() => {
    if (category !== 'welfare') return
    if (!volunteerCount.trim()) return
    setStats(prev => {
      // Only auto-fill the "volunteers" slot - never clobber something the
      // member already typed themselves into slot 0.
      if (prev[0] && prev[0].label !== 'volunteers') return prev
      if (statsAutoFilled.current && prev[0]?.value === volunteerCount) return prev
      statsAutoFilled.current = true
      const next = [...prev]
      next[0] = { value: volunteerCount, label: 'volunteers' }
      return next
    })
  }, [category, volunteerCount])
  const [linkUrl, setLinkUrl] = useState('')
  // User-typed title for the link preview well (03.2.6 well 5). No metadata
  // endpoint exists to fetch this automatically (grepped feedService.ts and
  // this file - neither fetches OG tags anywhere), and the file's own
  // fallback for that case is "render the host and the user-typed title
  // only" - this field is what makes that title exist to type. `linkTitle`
  // is already an accepted, already-persisted field on CreatePostData/
  // posts.link_title; this only finishes wiring a UI to a column that was
  // already round-tripping, not a new Supabase shape.
  const [linkTitle, setLinkTitle] = useState('')
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [images, setImages] = useState<File[]>([])
  const [imageUrls, setImageUrls] = useState<string[]>([])

  // ── 03.2 composer restyle additions ────────────────────────────────────
  // Opens minimal (photo/body/category); "more" reveals title/tag people or
  // team members/link. Auto-forced open for anything that already has
  // required or filled-in fields in there, so nothing gets hidden FROM the
  // person who actually needs it - see the file-level note on why this file
  // only moves the four fields 03.2 names into "more", not every field.
  const [moreOpen, setMoreOpen] = useState(false)
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [categoryTouched, setCategoryTouched] = useState(false)
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null)

  // PDF / PPTX attachments - uploaded to Supabase Storage on submit
  // (see feedService.uploadDocuments). 3-file ceiling enforced both
  // here and by the file picker; backend re-validates.
  const [documents, setDocuments] = useState<File[]>([])
  const docInputRef = useRef<HTMLInputElement>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  const [myTeams, setMyTeams] = useState<Team[]>([])
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [selectedTeamUuid, setSelectedTeamUuid] = useState<string>('')
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<TeamMember[]>([])
  const [teamMembersLoading, setTeamMembersLoading] = useState(false)
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([])
  // Teams this post is tagged with (post_teams, 2026-10-03). Written after the
  // post exists, via feedService.tagPostTeams, on every non-blog path.
  const [taggedTeamIds, setTaggedTeamIds] = useState<number[]>([])
  // Optional sub-department tag within the selected team (e.g. "Instagram"
  // within Social Media) — see sub_teams_hierarchy_2026_09_17.sql.
  const [teamSubTeams, setTeamSubTeams] = useState<SubTeam[]>([])
  const [selectedSubTeamUuid, setSelectedSubTeamUuid] = useState<string>('')

  const [tagQuery, setTagQuery] = useState('')
  const [tagResults, setTagResults] = useState<SearchedMember[]>([])
  const [tagSearching, setTagSearching] = useState(false)
  const [taggedPeople, setTaggedPeople] = useState<SearchedMember[]>([])

  const debouncedTagQuery = useDebounce(tagQuery, 300)
  const isDirector = hasLeaderAccess(member?.role)
  const [shake, setShake] = useState(false)

  // ── Post as the AquaTerra org account (super_admin only) ────────────────
  // A super_admin (or hr — isSuperAdmin() covers both, see lib/roles.ts) can
  // switch the composer's author identity to the canonical AquaTerra org
  // account (members.email = 'official@ngoaquaterra.com') instead of posting
  // under their own name — see create_post_as_org() in
  // scripts/post_as_org_account_2026_09.sql for why this requires a
  // SECURITY DEFINER RPC rather than a plain author_id override (posts'
  // INSERT policy only ever allows author_id = your own member id, and
  // post_images/post_documents' INSERT policies have no director/
  // super-admin fallback at all). This client-side isSuperAdmin() check is
  // defense-in-depth, not the real boundary — the RPC re-checks
  // is_super_admin() itself and resolves the org account server-side, never
  // from a client-supplied id.
  //
  // Scoped to the plain "normal post, no team" path only: a team post goes
  // through teamService.createTeamPost (a different write path this feature
  // does not touch), and blog/job-opening posts go through their own
  // services too. Widening "post as org" to those would mean auditing each
  // of those paths' own RLS separately — out of scope here.
  const canPostAsOrg = isSuperAdmin(member?.role) && !isEditing && !selectedTeamUuid && !isJobOpening && !isBlogPost
  const [postAsOrg, setPostAsOrg] = useState(false)
  // If the composer moves into a mode "post as org" doesn't cover (a team is
  // picked, or the mode switches to blog/opening), silently keeping the
  // toggle on would mean handleSubmit's team/blog/job branches ignore it
  // without saying so — turn it off the moment it stops applying instead.
  useEffect(() => {
    if (!canPostAsOrg && postAsOrg) setPostAsOrg(false)
  }, [canPostAsOrg, postAsOrg])

  // Scheduled posts — only roles that publish immediately (director/hod/
  // super_admin) may schedule, and only for a normal feed post (not a team
  // post, blog, or job opening, which have their own flows). The post is
  // inserted as status='scheduled' and auto-published by a pg_cron job.
  const [scheduleOn, setScheduleOn] = useState(false)
  const [scheduleAt, setScheduleAt] = useState('')
  const canSchedule =
    hasLeaderAccess(member?.role) &&
    !selectedTeamUuid && !isJobOpening && !isBlogPost
  // datetime-local min = 5 minutes from now, in the browser's local time.
  const minScheduleAt = (() => {
    const d = new Date(Date.now() + 5 * 60_000)
    return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
  })()

  // Refs updated after handleClose/handleSubmit are defined (below).
  const handleCloseRef = useRef<() => void>(() => {})
  const handleSubmitRef = useRef<() => void>(() => {})
  // Synchronous double-submit lock (see handleSubmit) - a ref, not state, so it
  // blocks the second click immediately without waiting for a re-render.
  const submitLockRef = useRef(false)

  useEffect(() => {
    if (!isOpen) return
    setTeamsLoading(true)
    teamService.getMyTeams({ limit: 50 })
      .then(result => { if (result.success) setMyTeams(result.data) })
      .catch(() => {})
      .finally(() => setTeamsLoading(false))
  }, [isOpen])

  useEffect(() => {
    if (!selectedTeamUuid) { setSelectedTeamMembers([]); setSelectedMemberIds([]); setTeamSubTeams([]); setSelectedSubTeamUuid(''); return }
    setTeamMembersLoading(true)
    setSelectedSubTeamUuid('')
    teamService.getTeam(selectedTeamUuid)
      .then(result => {
        if (result.success) {
          setSelectedTeamMembers(result.data.team.members.filter(m => m.uuid !== member?.uuid))
        }
      })
      .catch(() => {})
      .finally(() => setTeamMembersLoading(false))
    teamService.getSubTeams(selectedTeamUuid).then(setTeamSubTeams).catch(() => setTeamSubTeams([]))
  }, [selectedTeamUuid, member?.uuid])

  const searchPeople = useCallback(async (query: string) => {
    if (query.length < 2) { setTagResults([]); return }
    setTagSearching(true)
    try {
      const response = await feedServiceForSearch.searchMembers(query)
      if (response.success) {
        // Show all results except the current user; already-tagged members stay
        // visible so users can see who they've already tagged (shown with ✓).
        setTagResults(response.data.members.filter(
          (m: SearchedMember) => m.uuid !== member?.uuid
        ))
      }
    } catch { } finally { setTagSearching(false) }
  }, [member?.uuid])

  useEffect(() => {
    if (!selectedTeamUuid) searchPeople(debouncedTagQuery)
  }, [debouncedTagQuery, selectedTeamUuid, searchPeople])

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    // Reset the input's value on EVERY path, immediately. A file input does not
    // fire `change` when the same file is chosen twice, so after any rejection
    // - the max-4 early return, the 4MB skip, or a failed downscale - re-picking
    // that exact photo did nothing at all and looked like a dead button. The
    // files are already captured in `files` above, so clearing here is safe.
    e.target.value = ''
    // A blog persists ONLY image[0] as its cover (blogService.create takes a
    // single featuredImage), so letting the picker take four meant three
    // uploads landed in storage referenced by no row - invisible, unreachable
    // from any desk, and never collected. Cap it at the one that counts.
    const maxImages = isBlogPost ? 1 : 4
    if (images.length + files.length > maxImages) {
      setError(maxImages === 1 ? 'A blog takes one cover photo.' : 'Maximum 4 images allowed')
      return
    }
    // Downscale each raster image client-side before staging - a modern phone
    // photo is 4-12MB, but a feed card never renders wider than ~1600px, so
    // re-encoding here cuts upload time and storage dramatically. GIF/SVG pass
    // through untouched (animation/vectors would break), as do already-small
    // files. If the optimizer throws for any reason, the original file is
    // staged instead - never block a post on the optimizer.
    const processed: File[] = []
    for (const file of files) {
      let staged = file
      try {
        staged = await downscaleImage(file)
      } catch { /* fall back to the original file */ }
      if (staged.size > 4 * 1024 * 1024) {
        setError(`"${file.name}" is too large (max 4MB after compression)`)
        continue
      }
      processed.push(staged)
    }
    processed.forEach(file => {
      const reader = new FileReader()
      reader.onload = (evt) => setImageUrls(prev => [...prev, evt.target?.result as string])
      reader.readAsDataURL(file)
    })
    setImages(prev => [...prev, ...processed])
  }

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
    setImageUrls(prev => prev.filter((_, i) => i !== index))
  }

  // 03.2.3's named simpler alternative to a full pointer-events drag
  // implementation: a small control that swaps a tile with the one before
  // it. Image 0 is the card's hero/LCP element, so being able to reorder at
  // all is the part that matters.
  const swapImageWithPrevious = (index: number) => {
    if (index <= 0) return
    setImages(prev => { const next = [...prev]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next })
    setImageUrls(prev => { const next = [...prev]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next })
  }

  // ── Body auto-grow (03.2.4) ── rows grow with content, no inner scrollbar
  // until the sheet itself takes over scrolling.
  useLayoutEffect(() => {
    const el = bodyTextareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [body, isOpen])

  // ── Category suggestion (03.2.5) ── client-side keyword map only, no
  // model call, no network request. Never applied silently - it sets a real,
  // visibly-selected, overridable value; it stops once the member has
  // touched the category row themselves, so it can never fight a real choice.
  const suggestion = useMemo(() => (selectedTeamUuid ? { suggested: null, alternates: [] } : suggestCategory(body)), [body, selectedTeamUuid])
  useEffect(() => {
    if (categoryTouched || selectedTeamUuid || !suggestion.suggested) return
    setCategory(suggestion.suggested)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestion.suggested, categoryTouched, selectedTeamUuid])
  const chooseCategory = (value: string) => { setCategoryTouched(true); setCategory(value) }

  // ── Draft autosave (03.2.2) ── localStorage only, debounced, never image
  // blobs. Tagged-member IDs round-trip through storage because the file
  // names them explicitly, but only the TEAM-tagging path (selectedMemberIds)
  // can be re-hydrated correctly on restore: it is a plain numeric id list
  // checked against `selectedTeamMembers`, which the existing
  // selectedTeamUuid effect below already reloads. The free (non-team)
  // taggedPeople path needs each person's name/avatar to render a chip, which
  // the draft does not store - rebuilding it would mean an extra fetch on
  // restore, which is exactly the kind of query this pass is not allowed to
  // add for a design reason. So a restored draft's non-team tags are NOT
  // reapplied to the visible chip list - a real, reported limitation, not a
  // silent gap. See the PR notes.
  const currentDraft: ComposerDraft = useMemo(() => ({
    body, title, category, linkUrl,
    taggedMemberIds: selectedTeamUuid ? selectedMemberIds : taggedPeople.map(p => p.memberId),
    teamUuid: selectedTeamUuid,
  }), [body, title, category, linkUrl, selectedTeamUuid, selectedMemberIds, taggedPeople])
  const applyDraft = useCallback((d: ComposerDraft) => {
    setBody(d.body); setTitle(d.title); setCategory(d.category); setLinkUrl(d.linkUrl)
    if (d.category) setCategoryTouched(true)
    if (d.linkUrl) setShowLinkInput(true)
    if (d.teamUuid) setSelectedTeamUuid(d.teamUuid)
    if (d.taggedMemberIds.length) setSelectedMemberIds(d.taggedMemberIds)
    if (d.title || d.taggedMemberIds.length || d.teamUuid || d.linkUrl) setMoreOpen(true)
  }, [])
  const { draftStatus, clearDraft } = useComposerDraft(isOpen, currentDraft, applyDraft)

  // ── Unsaved-changes guard (11.9 state 10) ──
  // handleClose below used to note that no guard existed anywhere in this
  // file and that it was "a gap to report, not to add here". This is that gap,
  // filled — and filled around the draft rather than over it.
  //
  // The draft is the reason this is NOT a plain "you have typed something"
  // prompt. Body, title, category, link and tags are written to localStorage
  // and restored on the next open, so warning about them would be a warning
  // about nothing: the member gets them back. What the draft explicitly never
  // stores is blobs and the mode-specific fields — images, documents, the blog
  // body, the drive stats, the schedule. Those are gone the moment the sheet
  // closes, and they are the only thing worth stopping someone for.
  const unpersistable = !!(
    images.length || documents.length || imageUrls.length || blogContent.trim() ||
    stats.length || scheduleAt || welfareLocation.trim() ||
    jobCommitment.trim() || jobDeadline || linkTitle.trim() || taggedPeople.length
  )
  const { confirmDiscard } = useUnsavedChanges({
    dirty: unpersistable,
    unpersistable,
    submitting: isSubmitting,
    submitted: submitDone,
    enabled: isOpen,
    body: images.length || documents.length
      ? "your text is saved as a draft, but the files you attached aren't. closing loses them."
      : "some of what you've filled in here isn't saved as a draft. closing loses it.",
  })

  const toggleTeamMember = (memberId: number) =>
    setSelectedMemberIds(prev => prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId])

  const addTaggedPerson = (person: SearchedMember) => {
    setTaggedPeople(prev => [...prev, person]); setTagQuery(''); setTagResults([])
  }

  const removeTaggedPerson = (memberId: number) =>
    setTaggedPeople(prev => prev.filter(p => p.memberId !== memberId))

  // Write the chosen team tags once the post exists. The post is already saved,
  // so a failure here is reported and never fails the submit (same contract as
  // the attachment warnings below).
  const tagTeamsAfterCreate = async (postUuid?: string) => {
    if (taggedTeamIds.length === 0) return
    if (!postUuid) {
      toastError('Post created, but team tags were not saved', 'Open the post to try again.')
      return
    }
    try {
      await feedService.tagPostTeams(postUuid, taggedTeamIds)
    } catch (e: any) {
      toastError('Post created, but team tags were not saved', e?.message || 'Try again from the post.')
    }
  }

  const handleSubmit = async () => {
    // Hard guard against a double-submit: React 19 concurrent rendering can let a
    // rage-click slip a second call in before isSubmitting/disabled propagates,
    // which would fire two POSTs (duplicate post). JS runs handleSubmit
    // synchronously up to the first await, so a ref lock set just before the
    // async work blocks the second entry. Released in the finally below.
    if (submitLockRef.current) return
    const activeTeam = myTeams.find(t => t.uuid === selectedTeamUuid) || null
    const finalCategory = activeTeam ? activeTeam.category : category
    const triggerShake = () => {
      setShake(true); setTimeout(() => setShake(false), 500)
      // Scroll error into view after state update
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
    }
    const fail = (msg: string) => { setError(msg); toastError(msg); triggerShake() }
    if (!finalCategory)                              { fail('pick a category.'); return }
    if (!isBlogPost && !body.trim())                 { fail('write something first.'); return }
    if (!isBlogPost && body.trim().length < 10)      { fail('Post must be at least 10 characters'); return }
    if (isBlogPost && !blogContent.trim())           { fail('Article content is empty'); return }
    if (isJobOpening && !title.trim())               { fail('Job opening requires a role title. Fill in the Title field above.'); return }
    // 03.2.6.1: the title length bar turns danger past its UI-only 100-char
    // soft cap and disables send - this is the submit-time backstop for the
    // same rule (defense in depth, not a second source of truth: 100 is
    // still not a real DB constraint, see the well's own comment above).
    if (isDirector && title.length > 100)            { fail('Title is too long - keep it under 100 characters.'); return }

    // ── Edit-and-resubmit (§22.1) ────────────────────────────────────────
    // A resubmit rewrites body + category on an EXISTING row. Everything else
    // the post carries — photos, documents, tags, link, team — is already on
    // that row and stays attached, which is precisely why the media/tag/
    // location requirements below must not run: the composer cannot see the
    // photos that are already there, so enforcing "at least 2 photos" would
    // make a rejected welfare post permanently un-resubmittable.
    //
    // The profanity gate below is NOT skipped. An edit passes through it
    // exactly as a new post does — editing must never become a way around
    // moderation.
    if (isEditing) {
      const blocked = resubmitBlockReason({
        imageCount: images.length, documentCount: documents.length,
        blogContent, scheduleOn, teamUuid: selectedTeamUuid,
      })
      if (blocked) { fail(blocked); return }
      if (isJobOpening) { fail("a rejected post can't be turned into an opening. post that from the team page."); return }
    }

    // Welfare posts are welfare-project entries - require project details.
    if (!isEditing && finalCategory === 'welfare' && !isJobOpening) {
      if (!welfareLocation.trim())                   { fail('Welfare projects need a location - where did the drive happen?'); return }
    }
    // Event & welfare posts document a real drive/event - require multiple
    // photos, a drive link, at least one tagged person, and a volunteer count.
    if (!isEditing && (finalCategory === 'welfare' || finalCategory === 'events') && !isJobOpening) {
      const taggedCount = selectedTeamUuid ? selectedMemberIds.length : taggedPeople.length
      if (images.length < 2)                         { fail('Add at least 2 photos from the drive/event.'); return }
      if (!linkUrl.trim())                           { fail('Add a drive link (Google Drive/Photos folder with the full album).'); return }
      // Not inside a <form>, so the input's type="url" never gets native
      // browser validation - check the shape ourselves before allowing submit.
      try { new URL(linkUrl.trim()) } catch { fail("that link doesn't look right — paste the full https://... url."); return }
      if (taggedCount === 0)                         { fail('Tag at least one person who was there.'); return }
      if (!volunteerCount.trim() || Number(volunteerCount) <= 0) { fail('Enter how many volunteers took part.'); return }
    }
    // Blog posts require a headliner + cover image.
    if (isBlogPost) {
      if (!title.trim())                             { fail('Give your blog a headliner (fill in the Title field).'); return }
      if (images.length === 0)                       { fail('Blogs need a cover image.'); return }
    }

    // Directors get more room; standard members stay under 1000
    const bodyLimit = isDirector ? 5000 : 1000
    if (body.trim().length > bodyLimit) { fail(`Post must be ${bodyLimit} characters or fewer`); return }

    // Schedule validation (the UI is already gated to leaders on a feed post).
    if (scheduleOn) {
      if (!scheduleAt) { fail('Pick a date & time to schedule this post.'); return }
      if (new Date(scheduleAt).getTime() <= Date.now() + 60_000) { fail('Schedule time must be in the future.'); return }
    }

    // Site-wide obscenity filter - checks every free-text field going into this
    // post. 'block' stops the submit outright; 'flag' is handled below (forces
    // pending_review even for leaders instead of blocking).
    const filterFields = [title, body, blogContent, welfareLocation]
    const filterResults = await Promise.all(filterFields.map(checkText))
    if (filterResults.some(r => r.severity === 'block')) { fail(BLOCK_MESSAGE); return }
    const forceReview = filterResults.some(r => r.severity === 'flag')

    // Combine title + body for directors (title becomes the natural headline on the card)
    const finalBody = (() => {
      const base = (() => {
        // (The old blog arm lived here — it flattened title + teaser + article
        // into a post body. Blog mode now returns early from the submit handler
        // after writing a real `blogs` row, so this is never reached for a blog
        // and keeping it would just be a second, divergent definition of what a
        // blog post looks like.)
        if (isDirector && title.trim()) {
          return `${title.trim()}\n\n${body.trim()}`
        }
        return body.trim()
      })()
      // Welfare project detail: stamp the drive location onto the body.
      const withLocation = finalCategory === 'welfare' && welfareLocation.trim()
        ? `${base}\n\n📍 ${welfareLocation.trim()}`
        : base
      // Event/welfare drives: stamp the volunteer count too.
      return (finalCategory === 'welfare' || finalCategory === 'events') && volunteerCount.trim()
        ? `${withLocation}\n\n👥 ${volunteerCount.trim()} volunteers`
        : withLocation
    })()

    submitLockRef.current = true
    setIsSubmitting(true); setError(null)
    try {
      // §22.1's real edit. One UPDATE against the row the member is looking at:
      // the new text, the (possibly changed) category, and status back to
      // pending_review so the SAME post reappears in the HoD queue instead of a
      // duplicate. `forceReview` needs no special handling here — a resubmit is
      // unconditionally pending_review already, which is the strictest outcome
      // the flag could ask for.
      //
      // No upload step runs: resubmitBlockReason above guarantees there are no
      // new files to upload, and the ones already on the post are untouched.
      if (editPost) {
        await feedService.updatePost(editPost.uuid, buildResubmitPatch(finalBody, finalCategory))
        success('sent back for review ✓', 'your HoD will see the edited version of this post.')
        clearDraft()
        setSubmitDone(true); onPostCreated(); setTimeout(() => discardAndClose(), 800)
        return
      }

      // A failed upload must abort the post, not silently publish a text-only
      // version. There used to be no `else` here: on failure uploadedImageUrls
      // stayed [], the post was created without the photos, and the button
      // still went green with "✓ posted!" - so the author was told it worked
      // while the images the post existed for were gone. This is the most
      // likely failure in the app (up to four 4MB files on mobile data).
      // `return` inside the try still runs the finally below, so the submit
      // lock releases; flashError keeps the composer open with the text intact.
      let uploadedImageUrls: string[] = []
      if (images.length > 0) {
        const uploadResult = await feedService.uploadImages(images)
        if (!uploadResult.success) {
          flashError('your photos didn’t upload. your post is still here. check your connection and try again.')
          return
        }
        uploadedImageUrls = uploadResult.data.images.map(img => img.url)
      }

      // Upload documents in parallel with the post creation. Each doc
      // object carries fileName + mimeType + size so the backend can
      // persist the original filename for the post card UI.
      // Same false-success shape as the images above.
      let uploadedDocuments: { url: string; fileName: string; mimeType: string; size: number }[] = []
      if (documents.length > 0) {
        const docResult = await feedService.uploadDocuments(documents)
        if (!docResult.success) {
          flashError('your files didn’t upload. your post is still here. check your connection and try again.')
          return
        }
        uploadedDocuments = docResult.data.documents
      }

      // ── Blog post ──────────────────────────────────────────────────────
      // Writes a real `blogs` row rather than a post. This used to just
      // concatenate title + teaser + article into a normal post body, which
      // meant picking "blog" did not actually produce a blog: no /blog/:slug
      // page, no BlogPosting schema, no sitemap entry, no scheduling.
      //
      // Item 4.2 (2026-09-12): there is no separate `blogs` row and no mirror
      // trigger any more - this writes ONE post with source_kind='blog', so the
      // article and the feed card are literally the same row rather than two
      // rows kept in step by a trigger. That "kept in step" was where the
      // publication state of fourteen essays drifted apart.
      if (isBlogPost) {
        const created = await blogService.create({
          headliner: title.trim(),
          body: blogContent.trim(),
          writtenBy: member?.full_name || 'AquaTerra',
          featuredImage: uploadedImageUrls[0] || null,
          featuredImageAlt: `${title.trim()} - AquaTerra blog cover`,
          category: finalCategory,
          // Leaders publish (or schedule) directly; a member's blog is saved
          // undated, which is exactly what makes it a draft — the read policy
          // hides undated rows and the write policies only permit undated ones.
          publishedDate: isDirector
            ? (scheduleOn && scheduleAt
                ? new Date(scheduleAt).toISOString()
                : new Date().toISOString())
            : null,
        })
        if (isDirector && scheduleOn && scheduleAt) {
          success('blog scheduled.', `Goes live on ${new Date(scheduleAt).toLocaleString()}.`)
        } else if (isDirector) {
          success('blog published.', `Live at /blog/${created.slug}`)
        } else {
          success('sent for review.', 'An HoD will publish it. You can keep editing it until then.')
        }
        clearDraft()
        setSubmitDone(true); onPostCreated(); setTimeout(() => discardAndClose(), 800)
        return
      }

      if (selectedTeamUuid) {
        const result = await teamService.createTeamPost(selectedTeamUuid, {
          category: finalCategory, body: finalBody,
          taggedMemberIds: selectedMemberIds.length > 0 ? selectedMemberIds : undefined,
          imageUrls: uploadedImageUrls.length > 0 ? uploadedImageUrls : undefined,
          documentUrls: uploadedDocuments.length > 0 ? uploadedDocuments : undefined,
          linkUrl: linkUrl || undefined,
          linkTitle: linkTitle.trim() || undefined,
          subTeamUuid: selectedSubTeamUuid || undefined,
          forceReview,
        })
        if (result.success) {
          await tagTeamsAfterCreate(result.data?.post?.uuid)
          // Also register as job opening if job mode is on
          if (isJobOpening && title.trim()) {
            const activeTeamObj = myTeams.find(t => t.uuid === selectedTeamUuid)
            const postUuid = result.data?.post?.uuid
            if (!postUuid) {
              // No real post uuid came back - don't fabricate one (a
              // Date.now() string would create an opening linked to a
              // non-existent post that getByPostId can never match, so
              // the opening↔post link breaks silently). Surface it.
              toastError('Post created but opening not linked', 'Add the opening from the team page.')
            } else {
              try {
                await jobOpenings.createFromPost(postUuid, {
                  title: title.trim(),
                  description: body.trim(),
                  category: finalCategory,
                  teamName: activeTeamObj?.name,
                  // Inherit the team's skills so an opening ships with the real
                  // list instead of the empty array this always used to send.
                  skills: activeTeamObj?.skills ?? [],
                  commitment: jobCommitment.trim() || undefined,
                  deadline: jobDeadline ? new Date(jobDeadline).toISOString() : undefined,
                  createdByName: member?.full_name || 'HoD',
                  createdByRole: member?.role || 'hod',
                })
                success('Opening posted!', 'Now live on the Opportunities page.')
              } catch (openingErr: any) {
                // Post succeeded - just warn about opening
                toastError('Post created but opening failed to save', openingErr?.message || 'Try adding it from the team page.')
              }
            }
          } else {
            const isHoD = hasLeaderAccess(member?.role)
            if (forceReview) {
              success('Post submitted for review ✓', 'Flagged for a quick moderator check before it goes live.')
            } else if (isHoD) {
              success('Post submitted!', 'Published immediately.')
            } else {
              success('Post submitted for review ✓', 'Your HoD will approve it shortly. Check Notifications for updates.')
            }
          }
          // Live straight away earns confetti; held for review or scheduled earns the smaller sparkle. After the write, never before.
          celebrate((result.data?.post as any)?.status === 'published' ? 'confetti' : 'stars')
          clearDraft()
          setSubmitDone(true); onPostCreated(); setTimeout(() => discardAndClose(), 800)
        }
        else { toastError(result.message || 'post didn’t save. your text is still here.', 'try again.'); flashError(result.message || 'post didn’t save. your text is still here.') }
      } else {
        const postData: CreatePostData = {
          category: finalCategory, body: finalBody,
          imageUrls: uploadedImageUrls.length > 0 ? uploadedImageUrls : undefined,
          documentUrls: uploadedDocuments.length > 0 ? uploadedDocuments : undefined,
          linkUrl: linkUrl || undefined,
          linkTitle: linkTitle.trim() || undefined,
          taggedMemberIds: taggedPeople.length > 0 ? taggedPeople.map(p => p.memberId) : undefined,
          forceReview,
          stats,
          scheduledFor: scheduleOn && scheduleAt ? new Date(scheduleAt).toISOString() : undefined,
          postAsOrgAccount: canPostAsOrg && postAsOrg ? true : undefined,
        }
        const result = await feedService.createPost(postData)
        if (result.success) {
          // Image/document/tag/category sub-inserts inside createPost() are
          // best-effort and never throw - a failure there doesn't fail the
          // post, so surface it here instead of staying silent (mirrors the
          // "post created but opening failed" warning just below).
          if (result.attachmentWarnings?.length) {
            toastError('Post created, but some attachments failed to save', 'Some photos, files, or tags may be missing - check the post.')
          }
          await tagTeamsAfterCreate(result.data?.post?.uuid)
          // If marked as job opening, register it in the job openings system
          if (isJobOpening && title.trim()) {
            const postUuid = result.data?.post?.uuid
            if (!postUuid) {
              // Don't fabricate an id - see the team-path branch above.
              toastError('Post created but opening not linked', 'Add the opening from the team page.')
            } else {
              try {
                await jobOpenings.createFromPost(postUuid, {
                  title: title.trim(),
                  description: body.trim(),
                  category: finalCategory,
                  skills: [],
                  commitment: jobCommitment.trim() || undefined,
                  deadline: jobDeadline ? new Date(jobDeadline).toISOString() : undefined,
                  createdByName: member?.full_name || 'HoD',
                  createdByRole: member?.role || 'director',
                })
                success('Opening posted!', 'Now live on the Opportunities page.')
              } catch (openingErr: any) {
                // Post succeeded - warn about the opening separately
                toastError('Post created but opening failed to save', openingErr?.message || 'Try adding it from the team page.')
              }
            }
          } else if ((result.data?.post as any)?.status === 'scheduled') {
            // Report the SAVED state, not the local checkbox — a flagged post is
            // held for review even when "schedule" was ticked, and saying
            // "Scheduled ✓" then would be a lie.
            const savedAt = (result.data?.post as any)?.scheduledFor ?? scheduleAt
            const when = new Date(savedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
            success('Scheduled ✓', `This post auto-publishes on ${when}.`)
          } else {
            const isHoD = hasLeaderAccess(member?.role)
            if (forceReview) {
              success('Post submitted for review ✓', 'Flagged for a quick moderator check before it goes live.')
            } else if (isHoD) {
              success('Post submitted!', 'Published immediately.')
            } else {
              success('Post submitted for review ✓', 'Your HoD will approve it shortly. Check Notifications for updates.')
            }
          }
          clearDraft()
          setSubmitDone(true); onPostCreated(); setTimeout(() => discardAndClose(), 800)
        }
        else { toastError('post didn’t save. your text is still here.', 'try again.'); flashError('post didn’t save. your text is still here.') }
      }
    } catch (err: any) {
      // `err.message` was being dropped here, so a real reason from the service
      // layer (e.g. updatePost's "you may not have permission") was replaced by
      // the generic sentence. Services throw with a member-readable message —
      // prefer it, and keep the generic line as the last resort.
      const fallback = isEditing
        ? 'the edit didn’t save. your text is still here.'
        : 'post didn’t save. your text is still here.'
      const msg = err?.response?.data?.message || err?.message || fallback
      toastError(msg)
      flashError(msg)
    } finally { setIsSubmitting(false); submitLockRef.current = false }
  }

  /**
   * The guarded exit — the scrim, the × and Escape all come through here.
   * `handleSubmit`'s own success path calls `discardAndClose` instead, so a
   * completed post never asks anything.
   */
  const handleClose = async () => {
    if (!(await confirmDiscard())) return
    discardAndClose()
  }

  const discardAndClose = () => {
    setCategory(''); setTitle(''); setBody(''); setLinkUrl(''); setLinkTitle(''); setShowLinkInput(false)
    setPostMode('normal'); setJobCommitment(''); setJobDeadline(''); setBlogContent(''); setWelfareLocation('')
    setStats([]); statsAutoFilled.current = false
    setSubmitDone(false); setSubmitError(false)
    setImages([]); setImageUrls([]); setDocuments([]); setError(null)
    setSelectedTeamUuid(''); setSelectedTeamMembers([]); setSelectedMemberIds([])
    setTagQuery(''); setTagResults([]); setTaggedPeople([])
    setScheduleOn(false); setScheduleAt('')
    setPostAsOrg(false)
    // 03.2's own instruction: KEEP the scrim's click-to-dismiss and whatever
    // unsaved-changes guard exists. There now IS one - §11.9 state 10, added
    // above as `confirmDiscard` and asked in `handleClose`, never here. This
    // function is the unconditional discard the guard runs once it has an
    // answer (and the one the success path calls directly). A backdrop tap or
    // the close button still discards the in-memory form - the thing that
    // survives is the localStorage draft, deliberately: "on dismiss, keep it"
    // (03.2.2), which is exactly why the guard only speaks up about the parts
    // the draft cannot hold.
    setMoreOpen(false); setShowAllCategories(false); setCategoryTouched(false)
    onClose()
  }

  handleCloseRef.current = () => { void handleClose() }
  handleSubmitRef.current = handleSubmit

  // Escape, Tab trap, focus restore and body scroll-lock now come from the
  // shared hook. The hand-rolled version here had the first three but not the
  // scroll-lock, so the feed scrolled behind the composer on touch.
  const panelRef = useDialog(isOpen, () => handleCloseRef.current())

  // Cmd/Ctrl+Enter to submit — composer-specific, so it stays local.
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmitRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen])

  const selectedTeam = myTeams.find(t => t.uuid === selectedTeamUuid) || null

  // Mirrors `.cp-label` in CreatePostModal.css. It stays an object because
  // `<Field labelStyle>` takes a style, not a class name.
  const labelSt: React.CSSProperties = {
    fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 9,
    letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--ink-3)',
    display: 'block', marginBottom: 6,
  }

  // Post type. Values written stay 'normal' | 'blog' | 'job'; the reset
  // behaviour on mode change is the one the two-toggle row had, extended to
  // the explicit "post" chip (which clears both modes' extra fields).
  const chooseMode = (mode: 'normal' | 'blog' | 'job') => {
    setPostMode(mode)
    if (mode === 'blog') {
      setBlogContent('')
      // The one-cover cap was enforced only in handleImageSelect, so a member
      // who picked four photos and THEN switched to article mode still had
      // four staged - and blogService.create persists only the first, leaving
      // three uploads in storage referenced by nothing. Trimming here means
      // the cap holds however the member arrives at it, and it happens before
      // anything is uploaded, so nothing is orphaned.
      setImages(prev => (prev.length > 1 ? prev.slice(0, 1) : prev))
      setImageUrls(prev => (prev.length > 1 ? prev.slice(0, 1) : prev))
    }
    if (mode === 'job') { setJobCommitment(''); setJobDeadline('') }
    if (mode === 'normal') { setBlogContent(''); setJobCommitment(''); setJobDeadline('') }
  }

  const activeCategory = selectedTeam ? selectedTeam.category : category
  const linkIsRequired =
    category === 'welfare' || category === 'events' ||
    selectedTeam?.category === 'welfare' || selectedTeam?.category === 'events'

  // 03.2: "more" holds title / tagged members / team / link. Forced open
  // (and the toggle hidden, since there is nothing left to toggle) whenever
  // one of those - or something that needs them - is already in play, so
  // "minimal by default" never hides a field someone actually needs:
  // directors (title, and the opening's own team-for-opening field),
  // welfare/events (a required link + required tagging), an opening, a
  // blog, an already-selected team, or content already typed into one of
  // the panel's own fields (so opening "more", typing, then some OTHER
  // state change never yanks it shut on you).
  const moreForcedOpen =
    isDirector || isJobOpening || isBlogPost ||
    category === 'welfare' || category === 'events' ||
    selectedTeam?.category === 'welfare' || selectedTeam?.category === 'events' ||
    !!selectedTeamUuid || !!title || !!linkUrl || taggedPeople.length > 0 || selectedMemberIds.length > 0
  const moreVisible = moreOpen || moreForcedOpen

  // The dock's tag/link buttons are jumps, not a second control: they open
  // "more" (03.2's fields moved there - tag people, team, link) and focus
  // the relevant field. Deferred a frame so the field exists in the DOM
  // after `setMoreOpen` re-renders it in.
  const focusInMorePanel = (elementId: string) => {
    setMoreOpen(true)
    requestAnimationFrame(() => {
      const el = document.getElementById(elementId) as HTMLInputElement | null
      if (el) { el.scrollIntoView({ block: 'nearest' }); el.focus() }
    })
  }
  const focusTagging = () => {
    const search = document.getElementById('post-tag-search') as HTMLInputElement | null
    if (search) { search.scrollIntoView({ block: 'nearest' }); search.focus(); return }
    if (document.getElementById('cp-tag-cap')) {
      document.getElementById('cp-tag-cap')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      return
    }
    // Neither tagging surface is in the DOM yet - it's behind "more".
    focusInMorePanel('post-tag-search')
  }

  return (
    <MotionConfig reducedMotion="user">
    <AnimatePresence>
      {isOpen && (
    <motion.div
      className="cp-overlay"
      onClick={() => void handleClose()}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? 'Edit and resubmit your post' : 'Create a post'}
        tabIndex={-1}
        initial={isMobile ? { opacity: 0, y: '40%' } : { opacity: 0, scale: 0.96, y: 10 }}
        animate={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, scale: 1, y: 0 }}
        exit={isMobile ? { opacity: 0, y: 24 } : { opacity: 0, scale: 0.98, y: 6 }}
        transition={springPop}
        className={`cp-sheet${shake ? ' aq-shake' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Grab handle - sheet affordance below 1025px, hidden above it. */}
        <div className="cp-grab" aria-hidden />

        {/* Header - 03.2.1: close button, then the flexible middle, then the
            draft-state readout (only when a draft genuinely exists). */}
        <div className="cp-head">
          <button className="cp-close" onClick={() => void handleClose()} aria-label="Close" title="Close">
            <XMarkIcon width={16} height={16} strokeWidth={1.8} />
          </button>
          <span className="cp-head-title">
            {isEditing ? 'Edit post' : 'New post'}
            <span className="cp-head-sub">
              {isEditing
                // Say what actually happens: the same post is rewritten and
                // sent back. Not "publishes immediately" even for a leader —
                // a resubmit is unconditionally pending_review.
                ? 'the same post goes back for review'
                : (isDirector ? 'publishes immediately' : 'goes to HoD review')}
            </span>
          </span>
          {draftStatus !== 'none' && (
            <span className="composer-draftstate">{draftStatus === 'restored' ? 'draft restored' : 'draft saved'}</span>
          )}
        </div>

        <div className="cp-body">

        {/* Posting-as row - avatar, name, team and category, plus the jump to
            the team selector. Grounds the compose in a real person. */}
        {member && (
          <div className="cp-as">
            <div className="avatar" style={{ width: 34, height: 34, flexShrink: 0, overflow: 'hidden', background: 'var(--accent)', color: '#0A0A0A' }}>
              {postAsOrg
                ? 'AT'
                : (member.avatar_url
                    ? <Img ctx="avatar" src={member.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                    : (member.full_name || 'U').slice(0, 2).toUpperCase())}
            </div>
            <span style={{ flex: '1 1 auto', minWidth: 0 }}>
              <span className="cp-as-name" style={{ display: 'block' }}>{postAsOrg ? 'AquaTerra' : (member.full_name || 'You')}</span>
              <span className="cp-as-sub" style={{ display: 'block' }}>
                {postAsOrg ? 'org account' : (selectedTeam ? selectedTeam.name : (isDirector ? 'director' : 'member'))}
                {activeCategory ? ` · ${activeCategory}` : ''}
              </span>
            </span>
            {/* Identity switcher — super_admin/hr only (isSuperAdmin(), see
                canPostAsOrg above). Toggles whether the post that's about to
                be created is authored by the signed-in super_admin or by the
                canonical AquaTerra org account. Only shown where it can
                actually apply (see canPostAsOrg's own comment on scope). */}
            {canPostAsOrg && (
              <button
                type="button"
                className="cp-as-action"
                onClick={() => setPostAsOrg(v => !v)}
                aria-pressed={postAsOrg}
              >
                {postAsOrg ? 'post as you' : 'post as AquaTerra'}
              </button>
            )}
            {!postAsOrg && myTeams.length > 0 && (!isDirector || isJobOpening) && (
              <button
                type="button"
                className="cp-as-action"
                onClick={() => focusInMorePanel('post-team')}
              >
                change team
              </button>
            )}
          </div>
        )}
        {postAsOrg && (
          <p className="cp-note" style={{ marginTop: -8 }}>
            this post will publish under the AquaTerra org account, not your own name.
          </p>
        )}


        {/* Team Selector (03.2.6 well 4, "post to") - normal members only,
            EXCEPT job-opening mode: a director posting a role still needs to
            say which team it's for (job_openings.team_name), so directors
            get the dropdown back for that one case instead of the
            free-text-less gap that used to leave every director-created
            opening's team blank. Behind "more" (forced open for job-opening
            mode, since the field is effectively required there). */}
        {moreVisible && (!isDirector || isJobOpening) && myTeams.length > 0 && (
          <div className="cp-field">
            <label htmlFor="post-team" className="cp-label">
              {isJobOpening ? 'Team this opening is for' : 'Post Through Team'}
              {' '}<span className="cp-label-opt">{isJobOpening ? '(recommended)' : '(Optional)'}</span>
            </label>
            {teamsLoading ? (
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>LOADING...</div>
            ) : (
              <select
                id="post-team"
                value={selectedTeamUuid}
                onChange={e => { setSelectedTeamUuid(e.target.value); setSelectedMemberIds([]); setTaggedPeople([]) }}
                className="cp-input"
              >
                <option value="">{isJobOpening ? 'No team' : 'No team (general post)'}</option>
                {myTeams.map(t => <option key={t.uuid} value={t.uuid}>{t.name}</option>)}
              </select>
            )}
            {/* States the behaviour the accept-to-roster path already has; it
                changes no write. */}
            {isJobOpening && selectedTeamUuid && (
              <p className="cp-note">approving an applicant adds them to this team</p>
            )}
          </div>
        )}

        {/* Sub-team tag (e.g. "Instagram" within Social Media) - only when
            a team is selected and it actually has sub-teams. */}
        {moreVisible && selectedTeamUuid && teamSubTeams.length > 0 && (
          <div className="cp-field">
            <label htmlFor="post-subteam" className="cp-label">
              Sub-team <span className="cp-label-opt">(Optional)</span>
            </label>
            <select
              id="post-subteam"
              value={selectedSubTeamUuid}
              onChange={e => setSelectedSubTeamUuid(e.target.value)}
              className="cp-input"
            >
              <option value="">None</option>
              {teamSubTeams.map(st => <option key={st.uuid} value={st.uuid}>{st.name}</option>)}
            </select>
          </div>
        )}

        {/* Category - HoDs always choose one directly. Normal members only
            see this as a fallback when they aren't posting through a team
            (a selected team supplies its own category instead).
            A radiogroup, not one control: the caption names the group and
            each chip carries aria-checked. */}
        {(isDirector || !selectedTeam) && (
          <div className="cp-field">
            <span id="cp-cat-cap" className="cp-label">Category <span style={{ color: 'var(--accent-ink)' }} aria-hidden>*</span></span>
            {selectedTeam ? (
              <div className="cp-chip-line">
                <span className="cp-chip" style={{ background: CAT_COLORS[selectedTeam.category] || 'var(--accent)', color: '#0A0A0A', cursor: 'default' }}>
                  {(() => { const Ic = getCategoryIcon(selectedTeam.category); return <Ic width={14} height={14} strokeWidth={1.8} /> })()}
                  {CATEGORIES.find(c => c.value === selectedTeam.category)?.label || selectedTeam.category}
                </span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>Team category</span>
              </div>
            ) : (suggestion.suggested && !showAllCategories) ? (
              // 03.2.5 - the suggested chip pre-selected (full fill + tick),
              // up to 2 hairline alternates, then a "more" chip for the rest.
              // Mismatch, reported not guessed: this file says "the full six"
              // / "KEEP all six category labels" from lib/categories.ts, but
              // that file's live, DB-CHECK-constrained CATEGORY_SLUGS has
              // exactly five (events/welfare/content/operations/labs) - built
              // against the real five.
              <div className="cp-chiprow" role="radiogroup" aria-labelledby="cp-cat-cap">
                <span className="cp-suggest-label">suggested</span>
                {[suggestion.suggested, ...suggestion.alternates].map((slug, i) => {
                  const cat = CATEGORIES.find(c => c.value === slug)
                  if (!cat) return null
                  const Icon = getCategoryIcon(slug)
                  const on = category === slug
                  const isMain = i === 0
                  return (
                    <button
                      key={slug}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => chooseCategory(slug)}
                      className={`cp-chip${isMain ? '' : ' cp-chip--alt'}`}
                      style={on ? { background: CAT_COLORS[slug] || 'var(--accent)', color: '#0A0A0A' } : undefined}
                    >
                      {isMain
                        ? <Icon width={14} height={14} strokeWidth={1.8} />
                        : <span className="cp-chip-dot" style={{ background: CAT_COLORS[slug] }} />}
                      {cat.label}
                      {isMain && on && <span aria-hidden>✓</span>}
                    </button>
                  )
                })}
                <button type="button" className="cp-chip cp-chip--more" onClick={() => setShowAllCategories(true)} aria-label="Show all categories">
                  more
                </button>
              </div>
            ) : (
              <div className="cp-chiprow" role="radiogroup" aria-labelledby="cp-cat-cap">
                {CATEGORIES.map(cat => {
                  const on = category === cat.value
                  const Icon = getCategoryIcon(cat.value)
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => chooseCategory(cat.value)}
                      className="cp-chip"
                      style={on ? { background: CAT_COLORS[cat.value] || 'var(--accent)', color: '#0A0A0A' } : undefined}
                    >
                      <Icon width={14} height={14} strokeWidth={1.8} />
                      {cat.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* 03.2: the manual "more"/"less" disclosure for title/tag people/
            team/link. Hidden once one of those is already forced open (there
            is nothing left to toggle - see moreForcedOpen above). */}
        {!moreForcedOpen && (
          <button
            type="button"
            className="cp-chip cp-chip--more"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => setMoreOpen(v => !v)}
            aria-expanded={moreOpen}
          >
            {moreOpen ? 'less' : 'more'}
          </button>
        )}

        {/* Welfare project details - required when the post is a welfare drive.
            Welfare posts double as welfare-project entries, so we require the
            drive location (+ a photo, enforced on submit). */}
        {(category === 'welfare' || selectedTeam?.category === 'welfare') && !isJobOpening && (
          <div className="cp-group">
            <div className="cp-group-head">
              <MapPinIcon width={14} height={14} strokeWidth={1.8} />
              welfare project details
            </div>
            <p className="cp-note" style={{ margin: 0 }}>welfare posts become project entries - a location is required.</p>
            <Field label="Location" required labelStyle={labelSt}>
              {id => (
                <input
                  id={id}
                  className="cp-input cp-input--sm"
                  value={welfareLocation}
                  onChange={e => setWelfareLocation(e.target.value)}
                  placeholder="e.g. Ballygunge, Kolkata"
                  maxLength={80}
                />
              )}
            </Field>
          </div>
        )}

        {/* Event/welfare drive requirements - 2+ photos (checked against the
            image picker below), a drive link, tagging, and a volunteer count.
            All four enforced in handleSubmit; this panel only owns the count
            input + a reminder of the others so nothing feels sprung at submit. */}
        {(category === 'welfare' || category === 'events' || selectedTeam?.category === 'welfare' || selectedTeam?.category === 'events') && !isJobOpening && (
          <div className="cp-group">
            <div className="cp-group-head">
              <CalendarDaysIcon width={14} height={14} strokeWidth={1.8} />
              drive/event details
            </div>
            <p className="cp-note" style={{ margin: 0 }}>
              required: at least 2 photos (below), a drive link, at least one tagged person, and a volunteer count.
            </p>
            <Field label="Volunteers" required labelStyle={labelSt}>
              {id => (
                <input
                  id={id}
                  className="cp-input cp-input--sm"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={volunteerCount}
                  onChange={e => setVolunteerCount(e.target.value)}
                  placeholder="e.g. 12"
                  style={{ maxWidth: 160 }}
                />
              )}
            </Field>
          </div>
        )}

        {/* Stat blocks - up to 2, shown in a highlighted colored rail on both
            the feed card and the full post page (same treatment the welfare
            project detail page already gives volunteers/key-statistic).
            Welfare posts get slot 1 auto-filled from the volunteer count
            above; everything else here is optional and manual. */}
        {/* Repeating pairs of controls — the caption names the GROUP, and each
            input names itself via aria-label (the row index matters, so a single
            shared label couldn't say which pair a field belongs to). */}
        <div className="cp-field" role="group" aria-labelledby="cp-stats-cap">
          <span id="cp-stats-cap" className="cp-label" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <ChartBarIcon width={13} height={13} strokeWidth={1.8} />
            Stat blocks <span className="cp-label-opt">(Optional. Up to 2 - a number + what it means.)</span>
          </span>
          <div className="cp-stats">
            {stats.map((s, i) => (
              <div key={i} className="cp-stat-row">
                <input
                  className="cp-input cp-input--sm cp-stat-num"
                  aria-label={`Stat block ${i + 1} number`}
                  value={s.value}
                  onChange={e => setStats(prev => prev.map((p, pi) => pi === i ? { ...p, value: e.target.value } : p))}
                  placeholder="e.g. 150"
                  maxLength={24}
                />
                <input
                  className="cp-input cp-input--sm cp-stat-label"
                  aria-label={`Stat block ${i + 1} label`}
                  value={s.label}
                  onChange={e => setStats(prev => prev.map((p, pi) => pi === i ? { ...p, label: e.target.value } : p))}
                  placeholder="e.g. volunteers"
                  maxLength={40}
                />
                <button
                  type="button"
                  className="cp-iconbtn"
                  aria-label="Remove stat block"
                  title="Remove stat block"
                  onClick={() => { statsAutoFilled.current = false; setStats(prev => prev.filter((_, pi) => pi !== i)) }}
                >
                  <XMarkIcon width={15} height={15} strokeWidth={1.8} />
                </button>
              </div>
            ))}
            {stats.length < 2 && (
              <button
                type="button"
                className="cp-add"
                onClick={() => setStats(prev => [...prev, { value: '', label: '' }])}
              >
                + add stat block
              </button>
            )}
          </div>
        </div>

        {/* Title (03.2.6 well 1) - directors only. `posts.title` has NO
            database length constraint (confirmed live - unconstrained text,
            not a capped varchar), so 100 below is a UI-only soft cap, not a
            discovered fact - chosen to match the mock as a reasonable
            default. Optional today, so the label suffix says so per
            03.2.6's own instruction to keep whichever is true rather than
            guess. */}
        {moreVisible && isDirector && (
          <div className="cp-well">
            <label htmlFor="post-title" className="cp-well-label">
              title <span className="cp-label-opt">· optional</span>
            </label>
            <input
              id="post-title"
              className="cp-well-title-input"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Short, punchy headline..."
              maxLength={120}
            />
            <div className="cp-title-bar-row">
              <div className="cp-title-bar-track">
                <div
                  className={`cp-title-bar-fill${title.length > 100 ? ' is-over' : ''}`}
                  style={{ width: `${Math.min(100, (title.length / 100) * 100)}%` }}
                />
              </div>
              <span className={`cp-title-bar-count${title.length > 100 ? ' is-over' : ''}`}>{title.length}/100</span>
            </div>
          </div>
        )}

        {/* ── Mode toggles - directors / HoDs, any post type ── */}
        {isDirector && (
          <div className="cp-field" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <span id="cp-mode-cap" className="cp-label">Post type</span>
              {/* Three chips writing the same postMode values the two-toggle
                  row wrote: normal, blog, job. */}
              <div className="cp-chiprow" role="radiogroup" aria-labelledby="cp-mode-cap">
                {([
                  { mode: 'normal', label: 'post',    Icon: PencilSquareIcon },
                  { mode: 'blog',   label: 'article', Icon: DocumentTextIcon },
                  { mode: 'job',    label: 'opening', Icon: BriefcaseIcon },
                ] as const).map(({ mode, label, Icon }) => {
                  const on = postMode === mode
                  return (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => chooseMode(mode)}
                      className="cp-chip"
                      style={on ? { background: 'var(--ink)', color: 'var(--paper)' } : undefined}
                    >
                      <Icon width={14} height={14} strokeWidth={1.8} />
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Job opening extra fields - one bordered group card so the two
                fields read as belonging to the opening, not to the post. */}
            {isJobOpening && (
              <div className="cp-group">
                <div className="cp-group-head">
                  <BriefcaseIcon width={14} height={14} strokeWidth={1.8} />
                  the ask
                </div>
                <div className="cp-pair">
                  <div>
                    <label htmlFor="post-job-commitment" className="cp-label">
                      Commitment <span className="cp-label-opt">(optional)</span>
                    </label>
                    <input id="post-job-commitment" className="cp-input cp-input--sm" value={jobCommitment} onChange={e => setJobCommitment(e.target.value)} placeholder="e.g. 2-3 hrs/week" />
                  </div>
                  <div className="cp-pair-fixed">
                    <label htmlFor="post-job-deadline" className="cp-label">
                      Deadline <span className="cp-label-opt">(auto-pauses)</span>
                    </label>
                    <input id="post-job-deadline" type="date" className="cp-input cp-input--sm" value={jobDeadline} onChange={e => setJobDeadline(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
                  </div>
                </div>
                <p className="cp-note" style={{ margin: 0 }}>deadline cannot be before today</p>
              </div>
            )}

          </div>
        )}

        {/* Body */}
        <div className="cp-field cp-fieldset">
          <label htmlFor="post-body" className="cp-label">
            {isDirector ? (isBlogPost ? 'Teaser / subtitle' : 'Body') : "What's happening?"}
            <span style={{ color: 'var(--accent-ink)' }}> *</span>
          </label>
          <textarea
            id="post-body"
            ref={bodyTextareaRef}
            /* 03.2.4: the main body field looks like nothing at all -
               border/background/padding stripped, 19px/1.45, auto-grow via
               the effect above. The blog teaser keeps its bordered look
               (cp-textarea--teaser); this class isn't named by 03.2.4. */
            className={isBlogPost ? 'cp-textarea cp-textarea--teaser' : 'cp-body-textarea'}
            rows={isDirector ? 6 : 4}
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={isDirector ? (isBlogPost ? 'Short teaser shown on the feed card…' : 'Write the full content of your post...') : 'Share your thoughts, ideas, or updates with the community...'}
          />
          {isBlogPost && (
            <p className="cp-hint">this is the card preview, not the article. the full piece goes below.</p>
          )}
          <span className={`cp-count${body.length > (isDirector ? 4500 : 900) ? ' cp-count--over' : ''}`}>
            {body.length}/{isDirector ? 5000 : 1000}
          </span>
        </div>

        {/* Not while editing: the resubmit path rewrites text only, so tags chosen
            here would never be saved. */}
        {!isBlogPost && !isEditing && (
          <TeamTagPicker value={taggedTeamIds} onChange={setTaggedTeamIds} disabled={isSubmitting} />
        )}

        {/* Blog article content field. Moved BELOW the teaser (it used to sit
            above, inside the post-type block) so the teaser's "the full piece
            goes below" line is literally true on the page. */}
        {isDirector && isBlogPost && (
          <div className="cp-field" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="cp-label" style={{ marginBottom: 0 }}>Article content</span>
            {/* Real formatting controls. Output is markdown because
                BlogPostPage already parses '## ' and '> ', and the 36
                imported blogs are plain text in that same shape. */}
            <BlogBlockEditor
              value={blogContent}
              onChange={setBlogContent}
              placeholder="Write the full article here. Use the buttons above for headings and pull quotes."
            />
            <p className="cp-note" style={{ margin: 0 }}>
              stored as markdown. the blog renderer parses <b>##</b> for headings and <b>&gt;</b> for pull quotes, so the toolbar inserts exactly those.
            </p>
          </div>
        )}

        {/* Team Member Tagging. Checkbox list — each row is its own wrapping
            <label>, so the caption names the group rather than pretending to
            be a label itself. */}
        {moreVisible && selectedTeamUuid && (
          <div style={{ marginBottom: 18 }} role="group" aria-labelledby="cp-tag-cap">
            <span id="cp-tag-cap" style={labelSt}>Tag Team Members <span style={{ fontWeight: 400, opacity: 0.6 }}>(Optional)</span></span>
            {teamMembersLoading ? (
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>LOADING...</div>
            ) : selectedTeamMembers.length === 0 ? (
              <p style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-3)' }}>No other members in this team.</p>
            ) : (
              <div style={{ maxHeight: 176, overflowY: 'auto', border: '1px solid var(--line-2)', borderRadius: 'var(--r)', background: 'var(--bg-2)' }}>
                {selectedTeamMembers.length > 1 && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '2px solid var(--line)', cursor: 'pointer', background: 'var(--bg-3, var(--bg-2))' }}>
                    <input
                      type="checkbox"
                      checked={selectedMemberIds.length === selectedTeamMembers.length}
                      onChange={() => {
                        if (selectedMemberIds.length === selectedTeamMembers.length) {
                          setSelectedMemberIds([])
                        } else {
                          setSelectedMemberIds(selectedTeamMembers.map(m => m.memberId))
                        }
                      }}
                      style={{ width: 14, height: 14, accentColor: 'var(--accent)', flexShrink: 0 }}
                    />
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-2)' }}>
                      {selectedMemberIds.length === selectedTeamMembers.length ? 'deselect all' : 'tag all'}
                    </span>
                    <span className="mono xs muted" style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
                      {selectedTeamMembers.length} members
                    </span>
                  </label>
                )}
                {selectedTeamMembers.map(m => (
                  <label key={m.memberId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--line)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedMemberIds.includes(m.memberId)}
                      onChange={() => toggleTeamMember(m.memberId)}
                      style={{ width: 14, height: 14, accentColor: 'var(--accent)', flexShrink: 0 }}
                    />
                    <div className="avatar" style={{ width: 28, height: 28, fontSize: 10, background: 'var(--accent)', flexShrink: 0, overflow: 'hidden' }}>
                      {m.avatarUrl ? <Img ctx="avatar" src={m.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" /> : initials(m.fullName)}
                    </div>
                    <span style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 12, color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.fullName}</span>
                  </label>
                ))}
              </div>
            )}
            {selectedMemberIds.length > 0 && (
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 6 }}>
                {selectedMemberIds.length} member{selectedMemberIds.length !== 1 ? 's' : ''} tagged
              </div>
            )}
          </div>
        )}

        {/* Tag People (03.2.6 well 2, non-team). Reuses the composer's own
            existing member search (feedService.searchMembers) - already a
            real, working, post_tags-writing implementation - restyled to
            the well pattern rather than swapped for search/SearchPage.tsx's
            or the notice-board modal's search, which would be a second,
            redundant implementation for no functional gain. */}
        {moreVisible && !selectedTeamUuid && (
          <div className="cp-well">
            <label htmlFor="post-tag-search" className="cp-well-label">
              tag members {(category === 'welfare' || category === 'events')
                ? <span style={{ color: 'var(--accent-ink)' }}>*</span>
                : <span className="cp-label-opt">· optional</span>}
            </label>
            {taggedPeople.length > 0 && (
              <div className="cp-well-chips">
                {taggedPeople.map(p => (
                  <span key={p.memberId} className="cp-well-chip">
                    <div className="avatar cp-well-chip-avatar" style={{ background: hashColor(p.fullName || String(p.memberId)), overflow: 'hidden' }}>
                      {p.avatarUrl ? <Img ctx="avatar" src={p.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" /> : getInitials(p.fullName)}
                    </div>
                    <span>{p.fullName}</span>
                    <button type="button" className="cp-well-chip-rm" onClick={() => removeTaggedPerson(p.memberId)} aria-label={`Remove ${p.fullName}`} title={`Remove ${p.fullName}`}>
                      <XMarkIcon width={10} height={10} strokeWidth={2} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div style={{ position: 'relative' }}>
              <div className="cp-well-search">
                <span className="cp-well-search-at" aria-hidden>@</span>
                <input
                  id="post-tag-search"
                  value={tagQuery}
                  onChange={e => setTagQuery(e.target.value)}
                  placeholder="search"
                  autoComplete="off"
                />
              </div>
              {tagSearching && (
                <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>...</span>
              )}
            </div>
            {tagResults.length > 0 && (
              <div style={{ border: '1px solid var(--line-2)', borderRadius: 'var(--r)', background: 'var(--bg-3)', boxShadow: 'var(--shadow-lg)', marginTop: 4, maxHeight: 160, overflowY: 'auto' }}>
                {tagResults.map(m => {
                  const alreadyTagged = taggedPeople.some(p => p.memberId === m.memberId)
                  return (
                    <button key={m.memberId} type="button"
                      onClick={() => alreadyTagged ? removeTaggedPerson(m.memberId) : addTaggedPerson(m)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', borderBottom: '1px solid var(--line)', textAlign: 'left',
                        background: alreadyTagged ? 'var(--bg-2)' : 'transparent',
                        opacity: alreadyTagged ? 0.7 : 1,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = alreadyTagged ? 'var(--bg-2)' : 'transparent')}
                    >
                      <div className="avatar" style={{ width: 28, height: 28, fontSize: 10, background: 'var(--accent)', flexShrink: 0, overflow: 'hidden' }}>
                        {m.avatarUrl ? <Img ctx="avatar" src={m.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" /> : initials(m.fullName)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 12, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {alreadyTagged && <span style={{ color: 'var(--welfare-ink)', marginRight: 5 }}>✓</span>}
                          {m.fullName}
                        </div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.classGrade || ''}</div>
                      </div>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: alreadyTagged ? 'var(--ink-3)' : 'var(--accent)' }}>
                        {alreadyTagged ? 'tagged' : '+ tag'}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            {tagQuery.length >= 2 && tagResults.length === 0 && !tagSearching && (
              <p style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }}>No members found</p>
            )}
          </div>
        )}

        {/* Attachments row (03.2.3) - part of the always-visible minimal set
            (photo/body/category), so it renders even at zero photos: the add
            tile IS the entry point. Fixed 74x74 flex row, not a 3-column
            grid - scrolls horizontally past 4 tiles rather than shrinking. */}
        <div className="cp-field">
          {imageUrls.length > 0 && <span className="cp-label">{isBlogPost ? 'cover photo' : `photos · ${imageUrls.length} of 4`}</span>}
          <div className="cp-photos">
            {imageUrls.map((url, index) => (
              <div key={index} className={`cp-photo${submitError ? ' is-failed' : ''}`}>
                <Img src={url} alt={`Selected image ${index + 1} of ${imageUrls.length}`} />
                <button type="button" className="cp-photo-rm" onClick={() => removeImage(index)} aria-label={`Remove image ${index + 1}`} title={`Remove image ${index + 1}`}>
                  <XMarkIcon width={12} height={12} strokeWidth={1.8} />
                </button>
                {index === 0 && !submitError && !isSubmitting && <span className="cp-cover-badge">cover</span>}
                {/* Reorder (03.2.3's named simpler alternative to a full drag
                    implementation) - swaps with the previous tile. Image 0
                    has no "previous" to swap with. */}
                {index > 0 && !isSubmitting && (
                  <button type="button" className="cp-photo-swap" onClick={() => swapImageWithPrevious(index)} aria-label={`Move image ${index + 1} earlier`} title={`Move image ${index + 1} earlier`}>
                    ⇄
                  </button>
                )}
                {/* Batch upload/error state, not real per-file progress:
                    feedService.uploadImages resolves once for the whole
                    batch (see handleSubmit) and reports no per-file status,
                    so every staged tile shows the SAME state together. A
                    failed batch is retried by re-submitting - tapping the
                    badge re-runs the same handleSubmit the POST button does,
                    since there is no separate per-file retry unit to call. */}
                {isSubmitting ? (
                  <span className="cp-photo-badge cp-photo-badge--uploading" aria-label="Uploading">
                    <span className="cp-spin" />
                  </span>
                ) : submitError ? (
                  <button type="button" className="cp-photo-badge cp-photo-badge--failed" onClick={handleSubmit} aria-label="Upload failed - tap to retry" title="Upload failed - tap to retry">
                    !
                  </button>
                ) : null}
              </div>
            ))}
            {images.length < (isBlogPost ? 1 : 4) && (
              <button type="button" className="cp-photo-add" onClick={() => fileInputRef.current?.click()} aria-label={isBlogPost ? 'Add a cover photo' : 'Add photos'} title={isBlogPost ? 'Add a cover photo' : 'Add photos'}>
                <PhotoIcon width={20} height={20} strokeWidth={1.8} />
                add
              </button>
            )}
          </div>
          {imageUrls.length > 0 && (
            <p className="cp-note">resized to 1600px on the long edge before upload · first photo becomes the feed cover</p>
          )}
        </div>

        {/* Link Input - always shown for welfare/events (drive link is
            required there, see the panel above), regardless of whether a
            team is attributed. Previously hidden outright whenever a team
            was selected, which made the required drive link unreachable on
            a team-attributed welfare/event post. */}
        {/* Link (03.2.6 well 5). Once a URL is present, it becomes a preview
            well: thumb, a user-typed title, the mono host, remove. No
            metadata endpoint exists to fetch a real title/image (grepped
            feedService.ts and this file) - the well renders the host plus
            whatever title the member types, per the file's own named
            fallback, rather than adding one. */}
        {moreVisible && (linkIsRequired || showLinkInput || linkUrl) && (
          <div className="cp-well">
            <span className="cp-well-label">
              {linkIsRequired ? <>drive link <span style={{ color: 'var(--accent-ink)' }}>*</span></> : <>link <span className="cp-label-opt">· optional</span></>}
            </span>
            {linkUrl ? (
              <div className="cp-well-link">
                <div className="cp-well-link-thumb" aria-hidden>
                  <LinkIcon width={20} height={20} strokeWidth={2} />
                </div>
                <div className="cp-well-link-body">
                  <input
                    className="cp-well-link-title"
                    value={linkTitle}
                    onChange={e => setLinkTitle(e.target.value)}
                    placeholder="add a title (optional)"
                    maxLength={100}
                    aria-label="Link title"
                  />
                  <span className="cp-well-link-host">
                    {(() => { try { return new URL(linkUrl).host } catch { return linkUrl } })()}
                  </span>
                </div>
                <button type="button" className="cp-well-link-rm" onClick={() => { setLinkUrl(''); setLinkTitle('') }} aria-label="Remove link" title="Remove link">
                  <XMarkIcon width={14} height={14} strokeWidth={2} />
                </button>
              </div>
            ) : (
              <input
                id="post-link-url" className="cp-input cp-input--sm" type="url" value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder={linkIsRequired ? 'Google Drive/Photos folder link' : 'https://example.com'}
              />
            )}
            {linkIsRequired && !linkUrl && (
              <p className="cp-hint">required for a drive recap, so the full album stays findable</p>
            )}
          </div>
        )}

        {/* Hidden pickers. The visible triggers live in the sticky bar below. */}
        <input ref={fileInputRef} type="file" accept="image/*" multiple={!isBlogPost} style={{ display: 'none' }} onChange={handleImageSelect} />
        <input
          ref={docInputRef}
          type="file"
          accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = Array.from(e.target.files || [])
            if (documents.length + files.length > 3) {
              flashError('Maximum 3 documents allowed')
              if (docInputRef.current) docInputRef.current.value = ''
              return
            }
            setDocuments(prev => [...prev, ...files])
            if (docInputRef.current) docInputRef.current.value = ''
          }}
        />

        {/* Document preview list - shown only when at least one doc is staged.
            Uses existing typography utilities; no new CSS. */}
        {documents.length > 0 && (
          <div className="cp-field">
            <span className="cp-label">attachment</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {documents.map((doc, i) => (
                <div key={i} className="cp-doc">
                  {/* The 📄 / 📊 emoji were interface chrome, so they become a
                      heroicon per the project's emoji rule. */}
                  <PaperClipIcon width={16} height={16} strokeWidth={1.8} style={{ flexShrink: 0, color: 'var(--ink-3)' }} />
                  <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <span className="cp-doc-name" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</span>
                    <span className="cp-doc-size" style={{ display: 'block' }}>{(doc.size / 1024).toFixed(0)}kb</span>
                  </span>
                  <button
                    type="button"
                    className="cp-doc-rm"
                    onClick={() => setDocuments(prev => prev.filter((_, idx) => idx !== i))}
                    aria-label={`Remove ${doc.name}`}
                    title={`Remove ${doc.name}`}
                  >
                    <XMarkIcon width={13} height={13} strokeWidth={1.8} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Review notice - a quiet left accent bar rather than a full boxed
            panel, so it reads as a footnote, not another competing surface. */}
        {!isDirector && (
          <div className="cp-review">
            {selectedTeamUuid
              ? 'Team leads will review your post before it appears on the feed.'
              : 'Your post will be reviewed by an HoD before appearing on the feed.'
            }
          </div>
        )}

        {/* Error - same quiet left-accent language as the review notice
            above, just in the error color, so it doesn't read as a separate
            heavier UI language - placed just above submit so it's visible
            without scrolling up. */}
        {error && (
          <div ref={errorRef} role="alert" className="cp-err">
            <ExclamationCircleIcon width={18} height={18} strokeWidth={1.8} />
            <span className="cp-err-text">{error}</span>
            <button className="cp-err-x" onClick={() => setError(null)} aria-label="Dismiss error" title="Dismiss error">
              <XMarkIcon width={14} height={14} strokeWidth={2} />
            </button>
          </div>
        )}

        {/* Publish row. The 'now' / 'schedule' chips are leaders-only on a
            normal feed post; a scheduled post is stored as status='scheduled'
            and auto-published by pg_cron. The flat pills beside them state
            the path this author is on and change no write. */}
        {(canSchedule || !isDirector || isBlogPost || isJobOpening) && (
          <div className="cp-field">
            <span className="cp-label">publish</span>
            <div className="cp-publish">
              {canSchedule && (
                <>
                  <button
                    type="button"
                    className="cp-chip"
                    aria-pressed={!scheduleOn}
                    onClick={() => setScheduleOn(false)}
                    style={!scheduleOn ? { background: 'var(--ink)', color: 'var(--paper)' } : undefined}
                  >
                    now
                  </button>
                  <button
                    type="button"
                    className="cp-chip"
                    aria-pressed={scheduleOn}
                    onClick={() => setScheduleOn(true)}
                    style={scheduleOn ? { background: 'var(--ink)', color: 'var(--paper)' } : undefined}
                  >
                    <CalendarDaysIcon width={13} height={13} strokeWidth={1.8} />
                    schedule
                  </button>
                </>
              )}
              {/* States the review path this author is actually on. */}
              {!isDirector && <span className="cp-flat-pill">hod review first</span>}
              {isDirector && isBlogPost && (
                <span className="cp-flat-pill">
                  <ClockIcon width={13} height={13} strokeWidth={1.8} />
                  undated = draft
                </span>
              )}
              {isJobOpening && <span className="cp-flat-pill">posts to the feed too</span>}
            </div>
            {canSchedule && scheduleOn && (
              <input
                type="datetime-local"
                value={scheduleAt}
                min={minScheduleAt}
                onChange={e => setScheduleAt(e.target.value)}
                aria-label="Publish date and time"
                className="cp-input cp-input--sm"
                style={{ marginTop: 8, maxWidth: 260, fontFamily: 'var(--mono)', fontSize: 13 }}
              />
            )}
          </div>
        )}

        </div>{/* /.cp-body */}

        {/* Sticky bottom bar - the ink dock (03.1). Collapsed: attachment
            jump-shortcuts on the left, send on the right. Expanded (03.2.6):
            `less` on the left, a mono "{n} photos · {n} tagged" summary in
            the middle, wide send on the right - moreVisible covers both the
            manual toggle and every forced-open case, so the dock always
            matches what the panel above it is actually showing.
            Where this file quotes "Post" as the verbatim live string:
            mismatch, reported not guessed - the real button reads "POST →"/
            "SCHEDULE →" (plus done/error/busy states), not "Post". Kept as
            it ships today rather than retyped from the file. */}
        <div className="cp-bar">
          {(() => {
            const sendButton = (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || submitDone}
                className={`aq-dock-send aq-dock-send--wide${submitError ? ' is-error' : ''}`}
              >
                {submitDone ? (
                  isEditing ? '✓ resubmitted!' : scheduleOn ? '✓ scheduled!' : '✓ posted!'
                ) : submitError ? (
                  '✕ couldn\'t save. retry'
                ) : isSubmitting ? (
                  <>
                    <span className="cp-spin" style={{ width: 12, height: 12, borderWidth: 2, borderColor: 'rgba(10,10,10,.3)', borderTopColor: 'var(--ink)' }} />
                    {isEditing ? 'resubmitting…' : scheduleOn ? 'scheduling…' : 'posting…'}
                  </>
                ) : (
                  isEditing ? 'RESUBMIT →' : scheduleOn ? 'SCHEDULE →' : 'POST →'
                )}
              </button>
            )
            // §11.9 state 11. This used to be a plain `disabled` icon button:
            // no label, no reason, and (being disabled) not focusable, so a
            // member who had already attached three files got a dead grey clip
            // and no explanation anywhere. It stays focusable now and says why
            // on tap - a dock icon has nowhere to put an inline line, so the
            // reason is announced instead of printed (hint="none").
            const docReason = documents.length >= 3 ? 'three files is the limit.' : null
            const docButton = (
              <GatedButton
                type="button"
                className="aq-dock-btn"
                onClick={() => docInputRef.current?.click()}
                reason={docReason}
                hint="none"
                onBlocked={r => info(r)}
                aria-label="Attach a document"
                title="Attach PDF or PPTX (max 3)"
              >
                <PaperClipIcon width={16} height={16} strokeWidth={1.8} />
                {documents.length > 0 && <span className="aq-dock-btn-count">{documents.length}</span>}
              </GatedButton>
            )
            return moreVisible ? (
              <div className="aq-dock">
                <button type="button" className="aq-dock-text" onClick={() => setMoreOpen(false)}>less</button>
                {docButton}
                <span className="aq-dock-meta">
                  {images.length} photo{images.length !== 1 ? 's' : ''} · {(selectedTeamUuid ? selectedMemberIds.length : taggedPeople.length)} tagged
                </span>
                {sendButton}
              </div>
            ) : (
              <div className="aq-dock">
                <button type="button" className="aq-dock-btn" onClick={focusTagging} aria-label="Tag members" title="Tag members">
                  <TagIcon width={17} height={17} strokeWidth={1.8} />
                </button>
                {!selectedTeamUuid && (
                  <button type="button" className="aq-dock-btn" onClick={() => focusInMorePanel('post-link-url')} aria-label="Add a link" title="Add a link">
                    <LinkIcon width={17} height={17} strokeWidth={1.8} />
                  </button>
                )}
                {docButton}
                <span className="aq-dock-meta" />
                {/* Desktop-only: the shortcut it names needs a hardware keyboard. */}
                <span className="cp-kbd">⌘↵ to submit</span>
                {sendButton}
              </div>
            )
          })()}
          {submitDone && (
            /* Quick way to land on the post-status tracker while the modal is
               still mid-dismiss. The modal auto-closes in 800ms; this
               short-circuits it. Not part of the dock proper (03.1 does not
               name a second action here) - a plain text link under it. */
            <button
              type="button"
              onClick={() => { discardAndClose(); navigate('/my-posts') }}
              style={{
                display: 'block', margin: '8px auto 0', background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', textDecoration: 'underline',
              }}
            >
              view my posts →
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
    </MotionConfig>
  )
}

export default CreatePostModal
