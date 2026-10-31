import Img from '../components/Img'
import './TeamDetailPage.css'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import teamService, { TeamDetails, PendingTeamPost, JoinRequest } from '../services/teamService'
import AddMemberModal from './AddMemberModal'
import { useCan } from '../auth/CapabilityContext'
import CreateTeamPostModal from './CreateTeamPostModal'
import JoinRequestModal from './JoinRequestModal'
import { useAuth } from '../auth/AuthContext'
import { supabase, OBJ_CAT_MAP, normalizeObj } from '../lib/supabase'
import { sized } from '../lib/imageUrl'
import { pushRecent } from '../lib/recentlyViewed'
import { hasLeaderAccess, isSuperAdmin as isSuperAdminRole } from '../lib/roles'
import ShareModal from '../components/ShareModal'
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import { useIsMobile } from '../hooks/useMobile'
import { jobOpenings, CAT_COLORS } from '../lib/jobOpenings'
import { deptColorForTeamName, deptKindForTeamName, isDarkDepartmentFill, KIND_LABEL } from '../lib/departments'
import { Post } from '../services/api'
import { useMeta } from '../hooks/useMeta'
import { useJsonLd, breadcrumbLd, abs, PUBLISHER_LD } from '../hooks/useJsonLd'
import { pageMetadata } from '../lib/metaConfig'
import { useFeedCardBatch } from '../hooks/useFeedCardBatch'
import memberOfMonthService, { MemberOfMonthPick } from '../services/memberOfMonthService'
import { teamFollowService } from '../services/followService'
import {
  WelfareProjectLite, OpeningStatus, TeamOpening, isOpenStatus, STATUS_BADGE, initials,
} from './detail/shared'
import OpeningEditModal from './detail/OpeningEditModal'
import ApplyForOpeningModal from './detail/ApplyForOpeningModal'
import AboutTab from './detail/AboutTab'
import MembersTab from './detail/MembersTab'
import PendingPostsTab from './detail/PendingPostsTab'
import OpeningsTab from './detail/OpeningsTab'
import TasksTab from './detail/TasksTab'
import ApplicationsTab from './detail/ApplicationsTab'
import ResponsesTab from './detail/ResponsesTab'

// Word-boundary truncation for the meta description so a real team's free-text
// description doesn't get chopped mid-word like a raw CMS `.slice()`.
function metaTrim(s: string, max = 158) {
  const clean = (s || '').replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  if (clean.length <= max) return clean
  return clean.slice(0, max - 1).replace(/\s+\S*$/, '').trimEnd() + '…'
}

// Module-scoped cache of the (heavy, member-embedded) getTeam result, keyed by
// uuid. Lets a return visit within the session paint the hero instantly while
// the real fetch revalidates in the background (same pattern as TeamsPage's
// list cache / ProjectManager's _listCache).
const _teamCache = new Map<string, TeamDetails>()

const TeamDetailPage = () => {
  const { uuid } = useParams<{ uuid: string }>()
  const [searchParams] = useSearchParams()
  const { member: currentMember, isLoading: authLoading } = useAuth()
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast()
  const confirm = useConfirm()
  const isMobile = useIsMobile()
  const [team, setTeam] = useState<TeamDetails | null>(() => (uuid ? _teamCache.get(uuid) ?? null : null))
  // Substitute the real team name into the {teamName} title/description templates
  // (previously passed raw, so the page title read literally "{teamName} | …").
  useMeta({
    ...pageMetadata.teamDetail,
    title: team?.name ? `${team.name} | AquaTerra Student Team` : 'Student Team | AquaTerra',
    description: team?.name
      ? (metaTrim(team.description || '')
         || `${team.name}, AquaTerra's ${team.category || 'student-led'} department, a student-run team owning real work in Kolkata.`)
      : 'A student-led AquaTerra team running real community projects in Kolkata.',
    image: team?.logoUrl || '',
    imageAlt: team?.name ? `${team.name} team logo` : undefined,
  })

  // The team is a real sub-unit of the organisation, and its member count is
  // the same number rendered on the page. No Person list here - individual
  // members are described on their own /member/:uuid Person pages.
  useJsonLd('team-org', team?.name ? {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: team.name,
    url: abs(`/teams/${team.uuid}`),
    ...(team.description ? { description: team.description.replace(/\s+/g, ' ').trim().slice(0, 300) } : {}),
    ...(team.logoUrl ? { logo: team.logoUrl } : {}),
    // Deliberately no `numberOfEmployees` - these are unpaid student
    // volunteers, and that property would imply paid staff.
    parentOrganization: PUBLISHER_LD,
  } : null)

  useJsonLd('team-breadcrumb', team?.name ? breadcrumbLd([
    ['Home', '/'], ['Teams', '/teams'], [team.name, `/teams/${team.uuid}`],
  ]) : null)
  const [suggestedTeams, setSuggestedTeams] = useState<{ uuid: string; name: string; category: string; memberCount: number; logoUrl?: string }[]>([])
  const [suggestLoading, setSuggestLoading] = useState(false)
  // A warm cache paints immediately - don't block behind the full skeleton.
  const [isLoading, setIsLoading] = useState(() => !(uuid && _teamCache.has(uuid)))
  const [activeTab, setActiveTab] = useState<'about' | 'members' | 'openings' | 'tasks' | 'pending' | 'applications' | 'responses'>('about')
  const [openings, setOpenings] = useState<TeamOpening[]>([])
  const [openingsLoading, setOpeningsLoading] = useState(false)
  // Which openings the CURRENT viewer has personally applied to - separate
  // from myJoinRequest (a team-level `team_join_requests` row). These used to
  // share state: applying for an opening refreshed myJoinRequest, and the
  // per-opening "Apply" button gated on myJoinRequest, so an unrelated
  // pending team join request falsely marked every opening as "application
  // pending," and applying to an opening never actually flipped its own button.
  const [appliedOpeningIds, setAppliedOpeningIds] = useState<Set<string>>(new Set())
  // "Responses" tab - every applicant across every one of this team's
  // openings in one place, instead of expanding them one opening at a time.
  const [openingResponses, setOpeningResponses] = useState<Record<string, any[]>>({})
  const [responsesLoading, setResponsesLoading] = useState(false)
  /** The responses fetch FAILED, as opposed to no one having applied yet. */
  const [responsesError, setResponsesError] = useState(false)
  const [teamPosts, setTeamPosts] = useState<Post[]>([])
  const [teamPostsLoading, setTeamPostsLoading] = useState(false)
  /** The team-posts fetch FAILED, as opposed to the team having no posts. */
  const [teamPostsError, setTeamPostsError] = useState(false)
  // Batch-resolve saved/opening state for the team's post list in one pair of
  // queries instead of each FeedPostCard self-fetching (was 2×N requests).
  const { savedSet: teamPostsSavedSet, openings: teamPostsOpenings } = useFeedCardBatch(teamPosts)
  const [teamProjects, setTeamProjects] = useState<WelfareProjectLite[]>([])
  const [teamProjectsLoading, setTeamProjectsLoading] = useState(false)
  // Team's current Member of the Month (2026-09-14, social-system IA audit):
  // MoM picks are team-scoped in the data model (member_of_the_month.team_id)
  // but previously surfaced only on the winner's own profile and the home
  // rail - a visitor reading "what's this team like" never saw the single
  // most human signal even though the data already had the answer.
  const [teamMoMs, setTeamMoMs] = useState<MemberOfMonthPick[]>([])
  // Follow a team (2026-09-14, social-system IA audit): lightweight "show me
  // this team's posts" for someone who isn't ready to join - see
  // teamFollowService in followService.ts.
  const [isFollowingTeam, setIsFollowingTeam] = useState(false)
  const [teamFollowBusy, setTeamFollowBusy] = useState(false)
  // Same "pop on follow, never on unfollow" moment PublicProfilePage's own
  // follow button already uses - kept identical rather than re-derived.
  const [teamFollowPop, setTeamFollowPop] = useState(false)
  const [editingOpening, setEditingOpening] = useState<TeamOpening | 'new' | null>(null)
  const [applyingFor, setApplyingFor] = useState<TeamOpening | null>(null)
  const [expandedApplicants, setExpandedApplicants] = useState<Record<string, any[]>>({})
  const [loadingApplicants, setLoadingApplicants] = useState<Record<string, boolean>>({})
  const [sharingOpening, setSharingOpening] = useState<TeamOpening | null>(null)
  // Deep-link target from a shared opening link/QR (?opening=<id>) - jumps to
  // the Openings tab, scrolls the specific card into view, and auto-opens the
  // apply modal if the visitor is eligible to apply right now.
  const [highlightedOpeningId, setHighlightedOpeningId] = useState<string | null>(null)
  const deepLinkHandledRef = useRef(false)
  // /director/roles capability. Narrows team_members writes, never widens:
  // is_director() OR is_team_lead() still decides what the database accepts.
  const canManageRoster = useCan('action.manage_team_roster')
  // It ANDs into the existing `canManageMembers` rather than adding a second
  // gate: that prop already controls the add button and every per-member menu,
  // so one expression keeps them from drifting apart.
  const [showAddMemberModal, setShowAddMemberModal] = useState(false)
  const [showCreatePostModal, setShowCreatePostModal] = useState(false)
  const [showJoinRequestModal, setShowJoinRequestModal] = useState(false)
  const [memberMenuOpen, setMemberMenuOpen] = useState<number | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const menuButtonRefs = useRef<Map<number, HTMLButtonElement>>(new Map())
  const [updatingMember, setUpdatingMember] = useState<number | null>(null)

  // Close the member-actions menu on Escape (the fixed click-catcher covers
  // pointer users; this is the keyboard path - same pattern as PostFocusModal).
  useEffect(() => {
    if (memberMenuOpen === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMemberMenuOpen(null); setMenuPosition(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [memberMenuOpen])

  const [pendingPosts, setPendingPosts] = useState<PendingTeamPost[]>([])
  const [pendingPostsLoading, setPendingPostsLoading] = useState(false)
  const [pendingPostsCount, setPendingPostsCount] = useState(0)
  const [approvingPost, setApprovingPost] = useState<number | null>(null)
  const [rejectingPost, setRejectingPost] = useState<number | null>(null)
  const [rejectionNote, setRejectionNote] = useState('')
  const [pendingPostsError, setPendingPostsError] = useState<string | null>(null)

  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([])
  const [joinRequestsLoading, setJoinRequestsLoading] = useState(false)
  const [joinRequestsCount, setJoinRequestsCount] = useState(0)
  const [myJoinRequest, setMyJoinRequest] = useState<JoinRequest | null>(null)
  const [cancellingRequest, setCancellingRequest] = useState(false)
  const [processingRequest, setProcessingRequest] = useState<string | null>(null)
  const [joinRequestsError, setJoinRequestsError] = useState<string | null>(null)

  const isSuperAdmin = isSuperAdminRole(currentMember?.role)
  const isGlobalDirector = hasLeaderAccess(currentMember?.role)
  // Audit pass, 2026-09-06: `isTeamCreator` compared `team?.createdByUuid`
  // (never assigned anywhere in this file - grepped the whole file, this was
  // its only reference) against `currentMember?.uuid`. For a signed-OUT
  // guest both sides are `undefined`, and `undefined === undefined` is
  // `true`, so every logged-out visitor silently passed as "the team's
  // creator" - live-verified on the Welfare Team page, which let a guest
  // open the leader-only "Pending Posts" tab. The live `teams` table does
  // have a real `created_by` column, but it's an integer `member_id`, not a
  // uuid, so even a wired-up version of this check would need to compare
  // against `currentMember?.member_id`, not `.uuid`, and "team creator gets
  // elevated rights" isn't part of the role model CLAUDE.md documents in the
  // first place (member < lead < hod/director < super_admin, plus
  // category-scoped moderation) - removed rather than half-fixed, leaving
  // the three checks that were already correctly wired.
  const isTeamLead = team?.members?.some(m => m.uuid === currentMember?.uuid && m.role === 'lead')
  const isTeamMember = team?.members?.some(m => m.uuid === currentMember?.uuid)
  const canManageMembers = isSuperAdmin || isGlobalDirector || isTeamLead
  const canManageOpenings = canManageMembers || hasLeaderAccess(currentMember?.role)
  const canChangeRoles = isSuperAdmin
  // NOT isTeamLead. `posts_select` is
  //   status='published' OR author_id = self OR is_director()
  // and `posts_update` is the same shape, so a team lead reading their team's
  // pending queue sees an EMPTY tab even when posts are genuinely waiting, and
  // approving one throws. Showing a moderation tab the database refuses to
  // serve is worse than not showing it: the lead concludes there is nothing to
  // review. Narrowed to the roles is_director() actually covers.
  //
  // If team-scoped moderation is wanted, it has to be added to both `posts`
  // policies first (an EXISTS over team_members with role='lead'), and this
  // line follows that change - not the other way round.
  const canApprovePosts = isSuperAdmin || isGlobalDirector
  const canManageJoinRequests = isSuperAdmin || isGlobalDirector || isTeamLead
  const canApply = !!currentMember && !isTeamMember && !myJoinRequest && !isSuperAdmin && !isGlobalDirector

  useEffect(() => {
    if (!team?.uuid || !currentMember) { setIsFollowingTeam(false); return }
    let cancelled = false
    teamFollowService.isFollowingTeamByUuid(team.uuid).then(v => { if (!cancelled) setIsFollowingTeam(v) })
    return () => { cancelled = true }
  }, [team?.uuid, currentMember])

  const handleToggleFollowTeam = async () => {
    if (!team?.uuid || teamFollowBusy) return
    setTeamFollowBusy(true)
    const next = !isFollowingTeam
    setIsFollowingTeam(next) // optimistic, matches followService's own button pattern elsewhere
    if (next) { setTeamFollowPop(true); setTimeout(() => setTeamFollowPop(false), 300) }
    try {
      if (next) await teamFollowService.followTeamByUuid(team.uuid)
      else await teamFollowService.unfollowTeamByUuid(team.uuid)
    } catch (e: any) {
      setIsFollowingTeam(!next)
      toastError(next ? 'couldn’t follow this team.' : 'couldn’t unfollow this team.', e?.message)
    } finally {
      setTeamFollowBusy(false)
    }
  }

  const [teamError, setTeamError] = useState<string | null>(null)
  // Banner gate. An <img> onError is NOT enough here: the SPA rewrite answers a
  // missing /foo.jpg with index.html at HTTP 200 (content-type text/html), and
  // the browser then leaves the element at complete=false forever — firing
  // neither load nor error, so the card would sit there as an empty box. A
  // detached Image() probe does resolve correctly (error for the HTML response,
  // load for a real image), so render the banner only once it truly decodes.
  const [bannerOk, setBannerOk] = useState(false)

  // Probe the banner asset; only show the card if it actually decodes (see the
  // bannerOk declaration above for why onError can't be trusted here).
  useEffect(() => {
    const url = team?.bannerUrl
    if (!url) { setBannerOk(false); return }
    let alive = true
    const probe = new Image()
    probe.onload = () => { if (alive) setBannerOk(true) }
    probe.onerror = () => { if (alive) setBannerOk(false) }
    // Same URL (and thus cache key) the real <Img ctx="cover" .../> render
    // below will request - otherwise the browser fetches the banner twice.
    probe.src = sized(url, 'cover')
    return () => { alive = false }
  }, [team?.bannerUrl])

  const toggleApplicants = async (openingId: string) => {
    if (expandedApplicants[openingId]) {
      setExpandedApplicants(prev => { const n = { ...prev }; delete n[openingId]; return n })
      return
    }
    setLoadingApplicants(prev => ({ ...prev, [openingId]: true }))
    // try/catch/finally, matching fetchOpenings and fetchAllResponses below.
    // Without them a throw from getApplications (it wraps a query that throws,
    // and withRetry rethrows after its retries) skipped BOTH remaining lines:
    // the button relabelled to "loading…" and stayed there for the life of the
    // page, clicking again re-entered the same failing branch, and the only
    // trace was an unhandled rejection in the console.
    try {
      const apps = await jobOpenings.getApplications(openingId)
      setExpandedApplicants(prev => ({ ...prev, [openingId]: apps }))
    } catch (e: any) {
      toastError('applicants didn’t load.', e?.message)
    } finally {
      setLoadingApplicants(prev => ({ ...prev, [openingId]: false }))
    }
  }

  // ── Fetch openings from Supabase ──────────────────────────────────────────
  // Retry on a transient cold-load failure before giving up - without it a
  // single failed fetch left the tab permanently blank, since `openings` only
  // ever gets set on success. Crucially each attempt races a timeout: the
  // cold-load failure mode is usually a *hung* request (supabase-js stalling on
  // session restore), not a thrown error - and a plain error-only retry can't
  // see a hang (the promise never settles). The timeout turns a hang into a
  // rejection so the retry actually runs. (Mirrors lib/jobOpenings withRetry.)
  const fetchOpenings = async (teamName: string) => {
    setOpeningsLoading(true)
    try {
      const runQuery = () => supabaseCommunity
        .from('job_openings')
        .select('id,title,description,skills,commitment,category,status,created_at,created_by_name,created_by_role,custom_questions')
        .eq('team_name', teamName)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false })
      const withTimeout = <T,>(p: PromiseLike<T>, ms: number): Promise<T> =>
        Promise.race([Promise.resolve(p), new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timed out')), ms))])
      let data: any[] | null = null
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          const res = await withTimeout(runQuery(), 6000)
          if (res.error) throw res.error
          data = res.data; break
        } catch (err) {
          if (attempt === 2) throw err
          await new Promise(r => setTimeout(r, 500))
        }
      }
      setOpenings(
        (data || []).map((row: any) => ({
          id: row.id,
          title: row.title,
          description: row.description,
          skills: row.skills || [],
          commitment: row.commitment || '',
          category: row.category || '',
          status: row.status as OpeningStatus,
          createdAt: row.created_at,
          createdByName: row.created_by_name || '',
          createdByRole: row.created_by_role || '',
          customQuestions: (row.custom_questions || []) as any,
          deadline: row.deadline ?? null,
        }))
      )
    } catch (e: any) {
      console.error('[fetchOpenings]', e)
      toastError('openings didn’t load.')
    } finally {
      setOpeningsLoading(false)
    }
  }

  const fetchTeamPosts = async (teamUuid: string) => {
    setTeamPostsLoading(true)
    setTeamPostsError(false)
    try {
      const posts = await teamService.getTeamPosts(teamUuid)
      setTeamPosts(posts)
    } catch (e: any) {
      // Without this the tab fell through to "no posts from this team yet." -
      // a confident claim about a team that may have dozens.
      console.error('[fetchTeamPosts]', e)
      setTeamPostsError(true)
    } finally {
      setTeamPostsLoading(false)
    }
  }

  // Projects don't carry a team reference - a project's department is derived
  // from its objective via OBJ_CAT_MAP (same map PublicProjectDetailPage uses),
  // so "this team's projects" means "welfare_projects whose derived category
  // matches this team's category". Read-only decorative fetch (ticker), so a
  // failure just leaves the ticker empty rather than surfacing an error.
  const fetchTeamProjects = async (category: string) => {
    setTeamProjectsLoading(true)
    try {
      const { data, error } = await supabase
        .from('welfare_projects')
        .select('slug,header,main_image,main_image_alt,objective,workshop_date')
        .eq('is_draft', false)
        .order('workshop_date', { ascending: false })
        .limit(24)
      if (error) throw error
      const matched = ((data ?? []) as WelfareProjectLite[])
        .filter(p => (OBJ_CAT_MAP[normalizeObj(p.objective)] || 'welfare') === category)
        .slice(0, 8)
      setTeamProjects(matched)
    } catch (e) {
      console.error('[fetchTeamProjects]', e)
    } finally {
      setTeamProjectsLoading(false)
    }
  }

  // This team's current Member of the Month, if any - a decorative,
  // best-effort fetch (matches fetchTeamProjects' own contract): a failure
  // just leaves the card absent rather than surfacing an error on a page
  // that isn't primarily about MoM. Signed-in members only: see the effect
  // below that calls it.
  const fetchTeamMoM = async (teamUuid: string) => {
    try {
      const all = await memberOfMonthService.getCurrentForAllTeams()
      setTeamMoMs(all.filter(p => p.teamUuid === teamUuid))
    } catch (e) {
      console.error('[fetchTeamMoM]', e)
    }
  }

  const fetchTeam = async () => {
    if (!uuid) return
    // On a cache hit we're revalidating in the background - keep the cached
    // hero on screen instead of flashing the skeleton.
    if (!_teamCache.has(uuid)) setIsLoading(true)
    setTeamError(null)
    // Posts only need the route uuid - fire this in PARALLEL with the heavy
    // getTeam (member-embed) query instead of waiting for it. It's the heaviest
    // of the secondary fetches, so starting it a round-trip earlier is the
    // biggest first-paint win on this page.
    fetchTeamPosts(uuid)
    try {
      const result = await teamService.getTeam(uuid)
      if (result.success) {
        const t = result.data.team
        _teamCache.set(uuid, t)
        setTeam(t)
        pushRecent({
          kind: 'team',
          id: t.uuid,
          title: t.name,
          subtitle: teamService.getCategoryLabel(t.category),
          image: (t as any).logoUrl || undefined,
          href: `/teams/${t.uuid}`,
        })
        // Openings needs team.name, projects needs team.category - these stay
        // in the second wave. Posts already started above.
        fetchOpenings(t.name)
        fetchTeamProjects(t.category)
      } else {
        setTeamError('not_found')
      }
    } catch (error: any) {
      console.error('Failed to fetch team:', error)
      const msg = error?.message || ''
      // Only a genuinely missing table/relation is "db not setup". A permission
      // error (e.g. an anon-visible read that touches a column anon can't select)
      // is NOT missing schema — mislabelling it sent logged-out visitors the
      // "run community_supabase_teams_setup.sql" screen. Fall through to
      // not_found for those instead of the alarming setup message.
      if (msg.includes('does not exist') || msg.includes('relation')) {
        setTeamError('db_not_setup')
      } else {
        setTeamError('not_found')
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchTeam() }, [uuid])

  // Member of the Month is members-only data: its select policy is `to authenticated` and `anon`
  // has no grant, so a signed-out visitor's request was always refused, and every refusal was
  // logged as an error (daily since 2026-09-28, which is what raised the nightly health alert).
  // The card was already absent for them, so skip the request. It waits for auth to finish
  // loading and re-runs when it does, so a member whose session resolves after the page loads
  // still gets the card.
  const signedIn = !!currentMember
  useEffect(() => {
    if (!uuid || authLoading || !signedIn) return
    fetchTeamMoM(uuid)
  }, [uuid, authLoading, signedIn])

  // Same-category team suggestions - "more teams in {category}". Single read via
  // the existing getTeams(category) filter, excluding the current team, capped.
  useEffect(() => {
    if (!team?.uuid || !team.category) return
    let cancelled = false
    setSuggestLoading(true)
    setSuggestedTeams([])
    teamService.getTeams({ category: team.category, limit: 5 })
      .then(r => {
        if (cancelled) return
        if (r.success) {
          setSuggestedTeams(
            r.data
              .filter(t => t.uuid !== team.uuid)
              .slice(0, 4)
              .map(t => ({ uuid: t.uuid, name: t.name, category: t.category, memberCount: t.memberCount, logoUrl: t.logoUrl }))
          )
        }
      })
      .catch(err => console.warn('[TeamDetailPage] team suggestions fetch failed', err))
      .finally(() => { if (!cancelled) setSuggestLoading(false) })
    return () => { cancelled = true }
  }, [team?.uuid, team?.category])

  useEffect(() => {
    if (!uuid || !currentMember || isTeamMember || isSuperAdmin || isGlobalDirector) return
    teamService.getMyJoinRequest(uuid)
      .then(result => { if (result.success) setMyJoinRequest(result.data.request) })
      .catch(() => {})
  }, [uuid, currentMember, isTeamMember, isSuperAdmin, isGlobalDirector])

  const fetchPendingPosts = async () => {
    if (!uuid) return
    setPendingPostsLoading(true); setPendingPostsError(null)
    try {
      const result = await teamService.getPendingPosts(uuid, { limit: 50 })
      if (result.success) {
        setPendingPosts(result.data)
        setPendingPostsCount(result.pagination?.totalItems || result.data.length)
      }
    } catch (error: any) { setPendingPostsError(error?.message || 'Failed to load pending posts') }
    finally { setPendingPostsLoading(false) }
  }

  useEffect(() => {
    if (activeTab === 'pending' && canApprovePosts) fetchPendingPosts()
  }, [uuid, activeTab, canApprovePosts])

  const fetchAllResponses = async () => {
    if (!openings.length) { setOpeningResponses({}); setResponsesError(false); return }
    setResponsesLoading(true); setResponsesError(false)
    try {
      // One batched query instead of one per opening.
      const byOpening = await jobOpenings.getApplicationsForOpenings(openings.map(o => o.id))
      setOpeningResponses(byOpening)
    } catch (e) {
      console.error('[fetchAllResponses]', e)
      // A toast alone left the tab showing "no responses yet." - a leader
      // reads that as "nobody applied," which is the opposite of the truth.
      setResponsesError(true)
      toastError('responses didn’t load.')
    } finally {
      setResponsesLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'responses' && canManageOpenings) fetchAllResponses()
  }, [uuid, activeTab, canManageOpenings, openings])

  // Per-opening "did I already apply" state - see appliedOpeningIds above.
  // job_applications' SELECT RLS scopes non-director members to their own
  // rows already, but a director/hod/super_admin viewer sees every
  // applicant's rows here (their role qualifies the RLS OR-clause), so this
  // must still filter to the viewer's own applicant_id explicitly rather
  // than treating "any row came back" as "I applied."
  const fetchMyApplications = async () => {
    if (!currentMember || openings.length === 0) { setAppliedOpeningIds(new Set()); return }
    try {
      const mine = await jobOpenings.getMyApplicationOpeningIds(openings.map(o => o.id), currentMember.member_id)
      setAppliedOpeningIds(mine)
    } catch (e) {
      console.error('[fetchMyApplications]', e)
    }
  }

  useEffect(() => {
    if (activeTab === 'openings' && currentMember && !isTeamMember) fetchMyApplications()
  }, [uuid, activeTab, currentMember, isTeamMember, openings])

  // ── Deep link from a shared opening link/QR (?opening=<id>) ────────────────
  // Runs once openings have loaded. Auto-opens the apply modal for a visitor
  // who's eligible to apply right now; otherwise switches to the Openings tab
  // and scrolls/highlights the specific card so its status (open/paused/
  // closed) and the "log in to apply" affordance are immediately visible -
  // covers logged-out visitors and non-open openings without a dead end.
  useEffect(() => {
    if (deepLinkHandledRef.current) return
    if (openingsLoading || openings.length === 0) return
    const targetId = searchParams.get('opening')
    if (!targetId) return
    const target = openings.find(op => op.id === targetId)
    if (!target) return
    deepLinkHandledRef.current = true
    setActiveTab('openings')
    if (target.status === 'open' && canApply) {
      setApplyingFor(target)
    } else {
      setHighlightedOpeningId(target.id)
      setTimeout(() => {
        document.getElementById(`opening-${target.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 150)
      if (target.status !== 'open') {
        toastInfo(`"${target.title}" is no longer accepting applications`, `Status: ${STATUS_BADGE[target.status].label}`)
      }
    }
  }, [openings, openingsLoading, searchParams, canApply])

  const fetchJoinRequests = async () => {
    if (!uuid) return
    setJoinRequestsLoading(true); setJoinRequestsError(null)
    try {
      const result = await teamService.getJoinRequests(uuid)
      if (result.success) { setJoinRequests(result.data.requests); setJoinRequestsCount(result.data.total) }
    } catch (error: any) { setJoinRequestsError(error?.message || 'Failed to load applications') }
    finally { setJoinRequestsLoading(false) }
  }

  useEffect(() => {
    if (activeTab === 'applications' && canManageJoinRequests) fetchJoinRequests()
  }, [uuid, activeTab, canManageJoinRequests])

  const handleApprovePost = async (postId: number) => {
    if (!uuid) return
    setApprovingPost(postId)
    try {
      const result = await teamService.approvePost(uuid, postId)
      if (result.success) {
        toastSuccess('Post approved ✓', 'Now live on the feed.')
        setPendingPosts(prev => prev.filter(p => p.postId !== postId))
        setPendingPostsCount(prev => Math.max(0, prev - 1))
      }
    } catch (error: any) {
      const msg = error?.message || 'Failed to approve post'
      toastError(msg); setPendingPostsError(msg)
    } finally { setApprovingPost(null) }
  }

  const handleRejectPost = async (postId: number) => {
    if (!uuid || !rejectionNote.trim()) { setPendingPostsError('add a note so they know why.'); return }
    const ok = await confirm({
      title: 'Reject this post?',
      body: 'The author will be notified with your rejection note.',
      confirmLabel: 'Reject',
      danger: true,
    })
    if (!ok) return
    setApprovingPost(postId)
    try {
      const result = await teamService.rejectPost(uuid, postId, rejectionNote.trim())
      if (result.success) {
        toastSuccess('Post rejected', 'Author has been notified.')
        setPendingPosts(prev => prev.filter(p => p.postId !== postId))
        setPendingPostsCount(prev => Math.max(0, prev - 1))
        setRejectingPost(null); setRejectionNote('')
      }
    } catch (error: any) {
      const msg = error?.message || 'Failed to reject post'
      toastError(msg); setPendingPostsError(msg)
    } finally { setApprovingPost(null) }
  }

  const handleRemoveMember = async (memberId: number) => {
    if (!uuid) return
    const ok = await confirm({
      title: 'Remove this member?',
      body: 'They will lose access to the team and any team-only posts.',
      confirmLabel: 'Remove',
      danger: true,
    })
    if (!ok) return
    if (!canManageRoster) return
    setUpdatingMember(memberId)
    try {
      const result = await teamService.removeMember(uuid, memberId)
      if (result.success) { toastSuccess('Member removed'); fetchTeam() }
      else toastError('couldn’t remove them. try again.')
    } catch { toastError('couldn’t remove them. try again.') }
    finally { setUpdatingMember(null); setMemberMenuOpen(null); setMenuPosition(null) }
  }

  const handleUpdateRole = async (memberId: number, newRole: string) => {
    if (!uuid) return
    setUpdatingMember(memberId)
    try {
      const result = await teamService.updateMemberRole(uuid, memberId, newRole)
      if (result.success) { toastSuccess('Role updated ✓'); fetchTeam() }
      else toastError('couldn’t change that role.')
    } catch { toastError('couldn’t change that role.') }
    finally { setUpdatingMember(null); setMemberMenuOpen(null); setMenuPosition(null) }
  }

  const handleCancelJoinRequest = async () => {
    if (!uuid || !myJoinRequest) return
    setCancellingRequest(true)
    try {
      await teamService.cancelJoinRequest(uuid, myJoinRequest.uuid)
      setMyJoinRequest(null)
      toastSuccess('application cancelled.')
    } catch { toastError('couldn’t cancel that application.') }
    finally { setCancellingRequest(false) }
  }

  const handleApproveJoinRequest = async (requestUuid: string) => {
    if (!uuid) return
    setProcessingRequest(requestUuid)
    try {
      const result = await teamService.approveJoinRequest(uuid, requestUuid)
      if (result.success) {
        toastSuccess('approved.', 'Member added to the team.')
        setJoinRequests(prev => prev.filter(r => r.uuid !== requestUuid))
        setJoinRequestsCount(prev => Math.max(0, prev - 1))
        fetchTeam()
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to approve application'
      toastError(msg); setJoinRequestsError(msg)
    } finally { setProcessingRequest(null) }
  }

  const handleRejectJoinRequest = async (requestUuid: string) => {
    if (!uuid) return
    const ok = await confirm({
      title: 'Decline this application?',
      body: 'The applicant will not join the team.',
      confirmLabel: 'Decline',
      danger: true,
    })
    if (!ok) return
    setProcessingRequest(requestUuid)
    try {
      const result = await teamService.rejectJoinRequest(uuid, requestUuid)
      if (result.success) {
        toastSuccess('declined.')
        setJoinRequests(prev => prev.filter(r => r.uuid !== requestUuid))
        setJoinRequestsCount(prev => Math.max(0, prev - 1))
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to reject application'
      toastError(msg); setJoinRequestsError(msg)
    } finally { setProcessingRequest(null) }
  }

  if (isLoading) {
    // Shaped like the real shell (header capsules -> crest slot -> identity
    // text -> tab row -> roster rows), the way PostPage's skeleton is shaped
    // like its media pane + content column. Neutral placeholders only.
    return (
      <div className="route-enter td-page-root">
        <div className="td-header-row">
          {[84, 120, 132].map((w, i) => (
            <div key={i} className="v6-skeleton sk-pill" style={{ width: w, height: 44, borderRadius: 999 }} />
          ))}
        </div>
        <div className="td-shell">
          <div className="td-id-outer">
            <div className="td-id-pane">
              <div className="v6-skeleton" style={{ aspectRatio: '4/3', maxHeight: 'min(52vh, 360px)', borderRadius: 'var(--r-inner)' }} />
              <div className="td-id-body sk-group">
                <div className="v6-skeleton" style={{ width: '62%', height: 34, marginBottom: 16 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  {[92, 76].map((w, i) => <div key={i} className="v6-skeleton sk-pill" style={{ width: w, height: 32 }} />)}
                </div>
                {[100, 88].map((w, i) => (
                  <div key={i} className="v6-skeleton" style={{ width: `${w}%`, height: 13, marginTop: 14 }} />
                ))}
              </div>
            </div>
          </div>
          <div className="td-col">
            <div className="td-tabs-wrap">
              <div className="v6-skeleton" style={{ height: 52, borderRadius: 999 }} />
            </div>
            <div className="card" style={{ padding: 'var(--pad-card)' }}>
              <div className="sk-group" style={{ padding: 8 }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} style={{ display: 'flex', gap: 14, padding: '12px 0', alignItems: 'center' }}>
                    <div className="v6-skeleton sk-circle" style={{ width: 44, height: 44 }} />
                    <div style={{ flex: 1 }}>
                      <div className="v6-skeleton" style={{ width: '38%', height: 14, marginBottom: 7 }} />
                      <div className="v6-skeleton" style={{ width: '24%', height: 11 }} />
                    </div>
                    <div className="v6-skeleton sk-pill" style={{ width: 58, height: 28 }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!team) {
    if (teamError === 'db_not_setup') {
      // Copy unchanged, container moved onto --card / --r-outer, matching
      // PostPage's `.pp-notfound`. The sticker stays - a stamped sticker is
      // one of the two objects DESIGN.md still allows a hard offset on.
      return (
        <div className="route-enter aq-wrap td-notfound">
          <span className="sticker sticker-lemon wobble sticker--diecut" style={{ display: 'inline-flex', marginBottom: 20, ['--sticker-ground' as string]: 'var(--bg)' }}>⚠ DB SETUP NEEDED</span>
          <h1 className="h-display" style={{ fontSize: 'clamp(28px, 5vw, 40px)', margin: '0 0 12px' }}>teams need setup.</h1>
          <p style={{ color: 'var(--ink-2)', fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
            The teams database tables haven't been created yet. Run <code>community_supabase_teams_setup.sql</code> in your Supabase SQL editor to set everything up.
          </p>
          <Link to="/teams" className="td-cta td-cta--ghost">← back to teams</Link>
        </div>
      )
    }
    return (
      <div className="route-enter aq-wrap td-notfound">
        {/* h1, not a div: this branch replaces the ENTIRE page, so without it
            the document has no heading at all and a screen reader has
            nothing to announce on arrival. Same visual treatment. */}
        <h1 className="h-display" style={{ fontSize: 40, margin: 0 }}>team not found.</h1>
        {/* Same shape as post detail's not-found: the destination is named,
            because a visitor arriving on a dead shared link has no history. */}
        <p className="muted" style={{ marginTop: 12 }}>this team doesn't exist or has been removed.</p>
        <Link to="/teams" className="btn btn-primary" style={{ marginTop: 24, display: 'inline-flex' }}>← back to teams</Link>
      </div>
    )
  }

  // The live `teams` table has 8 rows sharing 5 `category` values, so a plain
  // CAT_COLORS[category] lookup collides 3 teams onto teal and 2 onto grape
  // (same bug already fixed on TeamsPage.tsx's TeamCard). Match this team's
  // own name to its department card's literal colour first, matching
  // TeamsPage's fix, so a team's hero and its card on /teams agree.
  const catColor = deptColorForTeamName(team.name) || CAT_COLORS[team.category] || 'var(--accent)'
  // 05.0/05.3: volunteer team vs. student business, the same real distinction
  // the /teams grid cards now carry (lib/departments.ts). Undefined for a team
  // name that doesn't map to one of the eight departments (e.g. a stale
  // dead-database fallback row) - the pill is simply omitted rather than
  // guessing which kind it is.
  const kind = deptKindForTeamName(team.name)
  // Text on the department hue. This file used to hand-roll the rule as
  // `catColor === 'var(--ink-2)'` - the exact per-file copy that
  // lib/departments.ts's own doc block records as having been re-broken five
  // times. It was broken here too: 2026-09-06 moved Crftd to `var(--ink)`
  // and Human Resources off `--ink-2` onto `--pink`, so this check matched
  // NOTHING - Crftd's hero rendered #0A0A0A text on a #0A0A0A fill (1.00:1)
  // and HR got the paper treatment it no longer needs. Now the single
  // source, keyed off luminance, not a token literal.
  const crestInk = isDarkDepartmentFill(catColor) ? 'var(--paper)' : 'var(--ink)'
  const deptEmoji = ({ events: '🎪', welfare: '🌱', labs: '⚡', operations: '⚙️', content: '✍️' } as Record<string, string>)[team.category] || '★'
  // Hero shows only the LEAD sentence - descriptions are full multi-paragraph
  // copy, which reads as a wall of text in the identity card. The complete
  // text lives in the "what we do" card on the About tab.
  const descLead = (() => {
    const flat = (team.description || '').replace(/\s+/g, ' ').trim()
    if (!flat) return ''
    const firstSentence = flat.match(/^.*?[.!?](?=\s|$)/)?.[0]
    if (firstSentence && firstSentence.length <= 200) return firstSentence
    return flat.length > 190 ? flat.slice(0, 187).trimEnd() + '…' : flat
  })()
  const existingMemberIds = team.members?.map(m => m.memberId) || []
  const openOpenings = openings.filter(o => isOpenStatus(o.status))
  const totalResponses = Object.values(openingResponses).reduce((s, a) => s + a.length, 0)

  // About-tab ticker - team's own posts + the welfare projects it ran,
  // interleaved most-recent-first so the strip reads as one activity feed
  // rather than two separate lists bolted together. This used to be a plain
  // concatenation (all posts, then all projects) despite this same comment
  // claiming it was date-interleaved - a team whose most recent activity was
  // a project rather than a post would show it buried after up to 6 older
  // posts. Posts sort on `createdAt`; projects have no created_at in this
  // lite fetch, but are already queried ordered by `workshop_date` (their
  // real chronological field), so that's what's used here too.
  // Not annotated as RelatedTickerItem[] directly - each entry carries an
  // extra `date` field used only for the sort below and dropped by the time
  // this is passed as a prop (structural typing, not a literal assignment,
  // so the extra field doesn't trigger an excess-property error there).
  const aboutTickerItems = [
    ...teamPosts.slice(0, 8).map(p => ({
      key: `post-${p.uuid}`,
      href: `/post/${p.uuid}`,
      title: p.body?.slice(0, 60) || 'Untitled post',
      image: p.images?.[0]?.blobUrl || p.images?.[0]?.url,
      tag: 'post',
      color: catColor,
      date: p.createdAt,
    })),
    ...teamProjects.slice(0, 8).map(pr => ({
      key: `project-${pr.slug}`,
      href: `/projects/${pr.slug}`,
      title: pr.header,
      image: pr.main_image || undefined,
      alt: pr.main_image_alt || undefined,
      tag: 'project',
      color: CAT_COLORS[OBJ_CAT_MAP[normalizeObj(pr.objective)] || 'welfare'] || catColor,
      date: pr.workshop_date,
    })),
  ]
    .sort((a, b) => (b.date ? new Date(b.date).getTime() : 0) - (a.date ? new Date(a.date).getTime() : 0))
    .slice(0, 8)

  // The tab strip was six plain <button>s in a div: no tablist, no arrow keys,
  // selection carried only by `.tab.active`'s background. Roving focus is driven
  // off the rendered [role=tab] nodes rather than a mirrored array, because four
  // of the six tabs are conditional on permissions.
  const onTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
    const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
    const i = tabs.indexOf(document.activeElement as HTMLButtonElement)
    if (i < 0) return
    e.preventDefault()
    const next = e.key === 'Home' ? 0
      : e.key === 'End' ? tabs.length - 1
      : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length
      : (i + 1) % tabs.length
    tabs[next].focus()
    tabs[next].click()
  }

  return (
    <div className="route-enter td-page-root">

      {/* ── Header capsule row ────────────────────────────────────────────
          Taken from post detail (03.3.2 / .pp-header-row): one row of white
          pill capsules above the shell, at BOTH breakpoints. It replaces the
          page's old split back affordance - a desktop-only `← back to teams`
          button plus a second, differently-styled `← TEAMS` link buried
          inside the mobile hero - with the single object /post/:uuid uses.
          The category capsule is the analogue of post detail's category
          capsule and links to the same filtered index the department cards
          elsewhere link to. */}
      <div className="td-header-row">
        <Link to="/teams" className="td-hcap">
          <span aria-hidden>←</span> teams
        </Link>
        <Link to={`/teams?category=${encodeURIComponent(team.category)}`} className="td-hcap">
          <span aria-hidden>{deptEmoji}</span> {teamService.getCategoryLabel(team.category)}
        </Link>
        {kind && <span className="td-hcap td-hcap--static">{KIND_LABEL[kind]}</span>}
        <span className="td-header-spacer" />
      </div>

      <div className="td-shell">

        {/* .td-id-outer is the flex item that stretches to match .td-col's
            height; .td-id-pane inside it is what actually sticks, sized to
            its own content. Same two-layer split, and for the same measured
            reason, as PostPage.css's .post-media-outer / .post-media-pane. */}
        <div className="td-id-outer">
          <div className="td-id-pane">

            {/* ── Crest ──────────────────────────────────────────────────
                The slot a post's photo occupies, at --r-inner inside the
                card's --r-outer. Measured live 2026-09-07: zero of the eight
                teams have a logo and exactly one has a banner, so the hue +
                monogram block is the PRIMARY state and gets the deliberate
                treatment - department hue at full strength, the department's
                own glyph as a low-contrast watermark, initials at display
                scale. Text colour comes from isDarkDepartmentFill(), the
                single source (lib/departments.ts); never re-derived here. */}
            <div className="td-crest" style={{ background: catColor, color: crestInk }}>
              {bannerOk && team.bannerUrl ? (
                <Img
                  ctx="cover"
                  eager
                  className="td-crest-img"
                  src={team.bannerUrl}
                  alt={`${team.name} banner`}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <>
                  <span className="td-crest-mark" aria-hidden>{deptEmoji}</span>
                  {team.logoUrl ? (
                    <Img
                      ctx="avatar"
                      eager
                      className="td-crest-logo"
                      src={team.logoUrl}
                      alt={`${team.name} logo`}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="td-crest-mono" aria-hidden>{initials(team.name)}</span>
                  )}
                </>
              )}
            </div>

            <div className="td-id-body">
              <h1 className="td-name">{team.name}</h1>

              {/* .pp-chip's vocabulary: cream pill, mono micro-label, value. */}
              <div className="td-metarow">
                <span className="td-chip"><i>members</i> {team.memberCount}</span>
                {openOpenings.length > 0 ? (
                  <button type="button" className="td-chip td-chip--btn" onClick={() => setActiveTab('openings')}>
                    <i>open roles</i> {openOpenings.length}
                  </button>
                ) : (
                  <span className="td-chip"><i>open roles</i> none right now</span>
                )}
              </div>

              {descLead && <p className="td-desc">{descLead}</p>}

              {team.skills && team.skills.length > 0 && (
                <div className="td-skills">
                  {team.skills.map(s => <span key={s} className="td-skill">{s}</span>)}
                </div>
              )}

              <div className="td-actions">
                {isTeamMember && (
                  <button type="button" className="td-cta" onClick={() => setShowCreatePostModal(true)}>
                    <span aria-hidden>✎</span> create post
                  </button>
                )}
                {canApply && (
                  <button type="button" className="td-cta td-cta--ghost" onClick={() => setShowJoinRequestModal(true)}>
                    <span aria-hidden>+</span> join team
                  </button>
                )}
                {/* Follow, not join - for a member who isn't ready to join
                    but wants this team's posts to reach them (their feed's
                    "my teams" tab, and any future new-post fan-out) without
                    the commitment of actually joining. Not shown to members
                    - they already get everything via team_members. */}
                {!!currentMember && !isTeamMember && !!team?.uuid && (
                  <button
                    type="button"
                    className={'td-cta td-cta--ghost' + (teamFollowPop ? ' td-cta--pop' : '')}
                    onClick={handleToggleFollowTeam}
                    disabled={teamFollowBusy}
                    aria-pressed={isFollowingTeam}
                  >
                    <span aria-hidden>{isFollowingTeam ? '✓' : '+'}</span> {isFollowingTeam ? 'following' : 'follow team'}
                  </button>
                )}
              </div>

              {!isTeamMember && myJoinRequest && (
                <div className="td-pending">
                  <span className="td-pending-text">application pending</span>
                  <span className="td-header-spacer" />
                  <button
                    type="button"
                    className="td-cta td-cta--ghost"
                    onClick={handleCancelJoinRequest}
                    disabled={cancellingRequest}
                  >
                    {cancellingRequest ? 'cancelling…' : 'cancel'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* display:contents on phone, so the tab strip flows directly under
            the identity pane and the two fuse into one card (matching half
            radii, no wrapper) - PostPage's phone treatment exactly. */}
        <div className="td-col">

          <div className="td-tabs-wrap">
            <div className="td-tabs" role="tablist" aria-label="Team sections" onKeyDown={onTabKeyDown}>
              {(['about', 'members'] as const).map(t => (
                <button
                  key={t} type="button" role="tab" id={`tab-${t}`}
                  aria-selected={activeTab === t} aria-controls={`panel-${t}`}
                  tabIndex={activeTab === t ? 0 : -1}
                  className="td-tab"
                  onClick={() => setActiveTab(t)}
                >
                  {t}{t === 'members' ? <span className="td-tab-count">{team.memberCount}</span> : null}
                </button>
              ))}
              <button
                type="button" role="tab" id="tab-openings"
                aria-selected={activeTab === 'openings'} aria-controls="panel-openings"
                tabIndex={activeTab === 'openings' ? 0 : -1}
                className="td-tab"
                onClick={() => setActiveTab('openings')}
              >
                openings{openOpenings.length > 0 && <span className="td-tab-count">{openOpenings.length}</span>}
              </button>
              {(isTeamMember || canApprovePosts) && (
                <button
                  type="button" role="tab" id="tab-tasks"
                  aria-selected={activeTab === 'tasks'} aria-controls="panel-tasks"
                  tabIndex={activeTab === 'tasks' ? 0 : -1}
                  className="td-tab"
                  onClick={() => setActiveTab('tasks')}
                >
                  tasks
                </button>
              )}
              {canApprovePosts && (
                <button
                  type="button" role="tab" id="tab-pending"
                  aria-selected={activeTab === 'pending'} aria-controls="panel-pending"
                  tabIndex={activeTab === 'pending' ? 0 : -1}
                  className="td-tab"
                  onClick={() => setActiveTab('pending')}
                >
                  pending posts{pendingPostsCount > 0 && <span className="td-tab-count">{pendingPostsCount}</span>}
                </button>
              )}
              {canManageJoinRequests && (
                <button
                  type="button" role="tab" id="tab-applications"
                  aria-selected={activeTab === 'applications'} aria-controls="panel-applications"
                  tabIndex={activeTab === 'applications' ? 0 : -1}
                  className="td-tab"
                  onClick={() => setActiveTab('applications')}
                >
                  applications{joinRequestsCount > 0 && <span className="td-tab-count">{joinRequestsCount}</span>}
                </button>
              )}
              {canManageOpenings && (
                <button
                  type="button" role="tab" id="tab-responses"
                  aria-selected={activeTab === 'responses'} aria-controls="panel-responses"
                  tabIndex={activeTab === 'responses' ? 0 : -1}
                  className="td-tab"
                  onClick={() => setActiveTab('responses')}
                >
                  responses{totalResponses > 0 && <span className="td-tab-count">{totalResponses}</span>}
                </button>
              )}
            </div>
          </div>

          {/* The panel is a transparent column of cards, not a card itself -
              each tab body (teams/detail/*Tab.tsx) already renders its own
              `.card`s, exactly as post detail's secondary column holds the
              comments card and the related rail without wrapping them. */}
          <div className="td-panel" role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`} tabIndex={0}>

            {activeTab === 'about' && (
              <AboutTab
                team={team}
                catColor={catColor}
                isMobile={isMobile}
                bannerOk={bannerOk}
                aboutTickerItems={aboutTickerItems}
                teamPosts={teamPosts}
                teamPostsLoading={teamPostsLoading}
                teamPostsError={teamPostsError}
                teamPostsSavedSet={teamPostsSavedSet}
                teamPostsOpenings={teamPostsOpenings}
                teamProjectsLoading={teamProjectsLoading}
                currentMoMs={teamMoMs}
                openings={openings}
                openingsLoading={openingsLoading}
                canApply={!!canApply}
                onRequestJoin={() => setShowJoinRequestModal(true)}
                onSeeOpenings={() => setActiveTab('openings')}
                isTeamMember={!!isTeamMember}
                onCompose={() => setShowCreatePostModal(true)}
              />
            )}

            {activeTab === 'members' && (
              <MembersTab
                team={team}
                currentMember={currentMember}
                canManageMembers={!!canManageMembers && canManageRoster}
                catColor={catColor}
                isMobile={isMobile}
                onAddMember={() => setShowAddMemberModal(true)}
                onViewOpenings={() => setActiveTab('openings')}
                memberMenuOpen={memberMenuOpen}
                setMemberMenuOpen={setMemberMenuOpen}
                setMenuPosition={setMenuPosition}
                menuButtonRefs={menuButtonRefs}
              />
            )}

            {activeTab === 'pending' && canApprovePosts && (
              <PendingPostsTab
                pendingPosts={pendingPosts}
                pendingPostsLoading={pendingPostsLoading}
                pendingPostsError={pendingPostsError}
                setPendingPostsError={setPendingPostsError}
                rejectingPost={rejectingPost}
                setRejectingPost={setRejectingPost}
                rejectionNote={rejectionNote}
                setRejectionNote={setRejectionNote}
                approvingPost={approvingPost}
                catColor={catColor}
                handleApprovePost={handleApprovePost}
                handleRejectPost={handleRejectPost}
              />
            )}

            {activeTab === 'openings' && (
              <OpeningsTab
                openings={openings}
                openingsLoading={openingsLoading}
                openOpenings={openOpenings}
                canManageOpenings={!!canManageOpenings}
                isMobile={isMobile}
                highlightedOpeningId={highlightedOpeningId}
                catColor={catColor}
                teamName={team.name}
                currentMember={currentMember}
                isTeamMember={isTeamMember}
                appliedOpeningIds={appliedOpeningIds}
                expandedApplicants={expandedApplicants}
                setExpandedApplicants={setExpandedApplicants}
                loadingApplicants={loadingApplicants}
                toggleApplicants={toggleApplicants}
                onAddOpening={() => setEditingOpening('new')}
                onEditOpening={op => setEditingOpening(op)}
                onApply={op => setApplyingFor(op)}
                onShare={op => setSharingOpening(op)}
              />
            )}

            {activeTab === 'tasks' && (isTeamMember || canApprovePosts) && <TasksTab teamUuid={team.uuid} teamName={team.name} />}

            {activeTab === 'applications' && canManageJoinRequests && (
              <ApplicationsTab
                joinRequests={joinRequests}
                joinRequestsLoading={joinRequestsLoading}
                joinRequestsError={joinRequestsError}
                setJoinRequestsError={setJoinRequestsError}
                processingRequest={processingRequest}
                catColor={catColor}
                isMobile={isMobile}
                handleApproveJoinRequest={handleApproveJoinRequest}
                handleRejectJoinRequest={handleRejectJoinRequest}
              />
            )}

            {activeTab === 'responses' && canManageOpenings && (
              <ResponsesTab
                openings={openings}
                openingResponses={openingResponses}
                setOpeningResponses={setOpeningResponses}
                responsesLoading={responsesLoading}
                responsesError={responsesError}
                onRetryResponses={fetchAllResponses}
                totalResponses={totalResponses}
                isMobile={isMobile}
              />
            )}
          </div>

          {/* ── More teams in this category ──
              Post detail's related rail (.pp-related / .pp-related-h): same
              head, same place at the foot of the scrolling column. A team
              suggestion is one line rather than a full card, so the tiles
              are --r-inner rather than --r-outer. */}
          {(suggestLoading || suggestedTeams.length > 0) && (
            <div className="td-more">
              <h2 className="td-sec-h">more in {teamService.getCategoryLabel(team.category)}</h2>
              {suggestLoading ? (
                <div className="td-more-list">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="v6-skeleton" style={{ width: 200, height: 60, borderRadius: 'var(--r-inner)', animationDelay: `${i * 0.06}s` }} />
                  ))}
                </div>
              ) : (
                <div className="td-more-list">
                  {suggestedTeams.map(t => {
                    const tc = deptColorForTeamName(t.name) || CAT_COLORS[t.category] || 'var(--accent)'
                    return (
                      <Link key={t.uuid} to={`/teams/${t.uuid}`} className="td-more-item">
                        <span className="td-more-crest" style={{ background: tc, color: isDarkDepartmentFill(tc) ? 'var(--paper)' : 'var(--ink)' }}>
                          {t.logoUrl
                            ? <Img ctx="avatar" src={t.logoUrl} alt={`${t.name} logo`} referrerPolicy="no-referrer" />
                            : initials(t.name || 'T')}
                        </span>
                        <span style={{ minWidth: 0 }}>
                          <span className="td-more-name" style={{ display: 'block' }}>{t.name}</span>
                          <span className="td-more-count" style={{ display: 'block' }}>{t.memberCount} {t.memberCount === 1 ? 'member' : 'members'}</span>
                        </span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )}

        </div>{/* /.td-col */}
      </div>{/* /.td-shell */}


      {/* Modals */}
      <AddMemberModal isOpen={showAddMemberModal} onClose={() => setShowAddMemberModal(false)} onSuccess={fetchTeam} teamUuid={uuid || ''} existingMemberIds={existingMemberIds} />

      {team && (
        <CreateTeamPostModal
          isOpen={showCreatePostModal}
          onClose={() => setShowCreatePostModal(false)}
          onSuccess={() => { if (canApprovePosts) fetchPendingPosts() }}
          teamUuid={uuid || ''}
          teamName={team.name}
          teamCategory={team.category}
          members={team.members || []}
        />
      )}

      {team && (
        <JoinRequestModal
          isOpen={showJoinRequestModal}
          onClose={() => setShowJoinRequestModal(false)}
          teamName={team.name}
          teamUuid={uuid || ''}
          onSuccess={() => {
            if (uuid) teamService.getMyJoinRequest(uuid).then(r => { if (r.success) setMyJoinRequest(r.data.request) }).catch(() => {})
          }}
        />
      )}

      {/* ── Opening Share / Story Modal ──
          Deep-links to this specific opening (?opening=<id>), not just the
          team page - TeamDetailPage's own ?opening deep-link effect (above)
          picks this up on load and jumps straight to the opening's apply
          flow. Stable across edits: keyed on the opening's own uuid `id`,
          same one used for job_applications. */}
      {sharingOpening && uuid && team && (
        <ShareModal
          url={`${window.location.origin}/teams/${uuid}?opening=${sharingOpening.id}`}
          storyData={{
            type: 'opening',
            teamName: team.name,
            teamCategory: team.category,
            openingTitle: sharingOpening.title,
            description: sharingOpening.description,
            skills: sharingOpening.skills,
            teamUuid: uuid,
          }}
          posterData={{
            body: sharingOpening.title,
            authorName: sharingOpening.createdByName,
            category: sharingOpening.category,
            uuid: sharingOpening.id,
            hiring: {
              skills: sharingOpening.skills,
              commitment: sharingOpening.commitment,
              teamName: team.name,
            },
          }}
          onClose={() => setSharingOpening(null)}
        />
      )}

      {/* ── Opening Edit Modal - proper component, split into its own file ── */}
      {editingOpening !== null && uuid && (
        <OpeningEditModal
          opening={editingOpening}
          teamName={team?.name}
          teamUuid={uuid}
          teamCategory={team?.category}
          member={currentMember ? { fullName: currentMember.full_name || '', role: currentMember.role || 'hod' } : null}
          onClose={() => setEditingOpening(null)}
          onSaved={() => { if (team?.name) fetchOpenings(team.name) }}
        />
      )}

      {/* ── Apply for Opening Modal - proper component, split into its own file ── */}
      {applyingFor && uuid && team && (
        <ApplyForOpeningModal
          opening={applyingFor}
          teamName={team.name}
          teamUuid={uuid}
          catColor={catColor}
          onClose={() => setApplyingFor(null)}
          onSuccess={() => { fetchMyApplications() }}
        />
      )}

      {/* Member Actions Dropdown (Portal) */}
      {memberMenuOpen !== null && menuPosition && createPortal(
        (() => {
          const targetMember = team?.members?.find(m => m.memberId === memberMenuOpen)
          const busy = updatingMember === memberMenuOpen
          const availableRoles = teamService.getRoles().filter(role => {
            if (role === 'member') return true
            if (role === 'lead') return canChangeRoles
            return false
          })
          return (
            <>
              <div role="presentation" style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => { setMemberMenuOpen(null); setMenuPosition(null) }} />
              <div className="menu" style={{ position: 'fixed', zIndex: 9999, top: menuPosition.top, left: menuPosition.left }}>
                {canChangeRoles && availableRoles.length > 1 && (
                  <>
                    <div className="mono xs upper muted" style={{ padding: '4px 12px' }}>change role</div>
                    {availableRoles.map(role => (
                      <button key={role} type="button" className="menu-item" onClick={() => { if (!busy) handleUpdateRole(memberMenuOpen, role) }}
                        style={{ color: targetMember?.role === role ? 'var(--welfare)' : undefined, opacity: busy ? 0.5 : 1, cursor: busy ? 'wait' : 'pointer', pointerEvents: busy ? 'none' : undefined }}
                      >
                        {teamService.getRoleLabel(role)}{targetMember?.role === role ? ' ✓' : ''}
                      </button>
                    ))}
                    <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }} />
                  </>
                )}
                <button type="button" className="menu-item danger" onClick={() => { if (!busy) handleRemoveMember(memberMenuOpen) }}
                  style={{ opacity: busy ? 0.5 : 1, cursor: busy ? 'wait' : 'pointer', pointerEvents: busy ? 'none' : undefined }}>
                  {busy ? 'Working…' : 'Remove from Team'}
                </button>
              </div>
            </>
          )
        })(),
        document.body
      )}
    </div>
  )
}

export default TeamDetailPage
