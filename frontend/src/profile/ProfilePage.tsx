import Img from '../components/Img'
import { useState, useEffect, useMemo } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import profileService, { MemberProfile } from '../services/profileService'
import { Post, Achievement } from '../services/api'
import achievementService from '../services/achievementService'
import { teamService, Team } from '../services/teamService'
import breakService, { isCurrentlyOnBreak } from '../services/breakService'
import certificateService, { HoursSummary } from '../services/certificateService'
import BreakModal, { BREAK_REASSURANCE } from './BreakModal'
import HoursAndCertificateCard from './HoursAndCertificateCard'
import CvCard from './CvCard'
import MemberOfMonthClaimCard from './MemberOfMonthClaimCard'
import MyTasksCard from './MyTasksCard'
import MemberOfMonthProfileBadge from './MemberOfMonthProfileBadge'
import FeedPostCard from '../feed/FeedPostCard'
import PhotoCollection from './PhotoCollection'
import { feedItemFromPost } from '../feed/feedItemFromPost'
import { shapeFeed } from '../lib/feedShape'
import { useFeedCardBatch } from '../hooks/useFeedCardBatch'
import AchievementsList from './AchievementsList'
import BadgeShelf from './BadgeShelf'
import ProfileTasks from '../tasks/ProfileTasks'
import wallService, { WallNote as WallNoteData } from '../services/wallService'
import WallTab from './wall/WallTab'
import { getRoleLabel } from '../lib/roles'
import { deptColorForTeamName } from '../lib/departments'
import { useIsMobile } from '../hooks/useMobile'
import { useMeta } from '../hooks/useMeta'
import { pageMetadata } from '../lib/metaConfig'
import { getInitials, hashColor } from '../lib/uiHelpers'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import { MoonIcon, LinkIcon } from '@heroicons/react/24/outline'
import { claimStoredReferral } from '../referrals/claimStoredReferral'
import '../styles/routes/profile.css'

/** Real, honest "how long you've been here" - months under a year, whole
 *  years after. Never fabricated: derived straight from members.created_at. */
function membershipDuration(createdAt?: string | null): string | null {
  if (!createdAt) return null
  const joined = new Date(createdAt)
  if (Number.isNaN(joined.getTime())) return null
  const now = new Date()
  const months = (now.getFullYear() - joined.getFullYear()) * 12 + (now.getMonth() - joined.getMonth())
  if (months < 1) return null
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`
  const years = Math.floor(months / 12)
  return `${years} year${years === 1 ? '' : 's'}`
}

function isBirthdayToday(birthday?: string | null): boolean {
  if (!birthday) return false
  const b = new Date(birthday + 'T00:00:00')
  if (Number.isNaN(b.getTime())) return false
  const now = new Date()
  return b.getMonth() === now.getMonth() && b.getDate() === now.getDate()
}

interface ProfilePageProps {
  isOwn?: boolean
}

type Tab = 'posts' | 'tagged' | 'achievements' | 'tasks' | 'about' | 'wall'

const ProfilePage = ({ isOwn: isOwnProp = false }: ProfilePageProps) => {
  useMeta(pageMetadata.profile)
  const { uuid } = useParams<{ uuid: string }>()
  const [searchParams] = useSearchParams()
  const { member: currentMember, refreshMember } = useAuth()
  const isMobile = useIsMobile()
  const toast = useToast()
  const confirm = useConfirm()
  const [showBreakModal, setShowBreakModal] = useState(false)
  const [endingBreak, setEndingBreak] = useState(false)

  // Shareable break-request link (owner request): HR can send one generic
  // URL - `/profile/me?break=1` - to anyone; since /profile/me always
  // resolves to whoever is logged in, it opens THIS modal for whoever
  // clicks it, no per-person link needed. Effect (not read inline in the
  // JSX below) because it must run before any early return further down
  // this component, and because opening should happen once, not on every
  // render `searchParams` happens to be read.
  useEffect(() => {
    const isSelf = isOwnProp || currentMember?.uuid === uuid
    if (!isSelf || !currentMember) return
    if (searchParams.get('break') !== '1') return
    if (isCurrentlyOnBreak((currentMember as any).break_end)) return
    setShowBreakModal(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMember?.member_id])

  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const { savedSet, openings } = useFeedCardBatch(posts)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [achievementCount, setAchievementCount] = useState(0)
  const [likesEarned, setLikesEarned] = useState(0)
  const [teams, setTeams] = useState<Team[]>([])
  const [taggedPosts, setTaggedPosts] = useState<Post[]>([])
  const [taggedCount, setTaggedCount] = useState(0)
  const [taggedPage, setTaggedPage] = useState(1)
  const [taggedHasMore, setTaggedHasMore] = useState(true)
  // Section 10 mount, this page: own-profile posts are all one author, so
  // composeFeed's author-collapse cap is the wrong tool here (see
  // PublicProfilePage's identical note) - plain shapeFeed() only. Two
  // separate decision arrays: `taggedPosts` is a DIFFERENT list from
  // `posts` (the "tagged" tab, not "posts"), so it needs its own shapeFeed()
  // pass - reusing one array indexed by `i` across both would pair a
  // tagged-tab card with a shape chosen for an unrelated own-post at the
  // same index.
  const shapeDecisions = useMemo(
    () => shapeFeed(posts.map(p => feedItemFromPost(p, ''))),
    [posts],
  )
  const taggedShapeDecisions = useMemo(
    () => shapeFeed(taggedPosts.map(p => feedItemFromPost(p, ''))),
    [taggedPosts],
  )
  // §16.4: a wall-note notification deep-links to `?tab=wall` - every
  // notification must have a destination, never a detail page of its own.
  const [activeTab, setActiveTab] = useState<Tab>(() => (searchParams.get('tab') === 'wall' ? 'wall' : 'posts'))
  const [wallNotes, setWallNotes] = useState<WallNoteData[]>([])
  const [wallEnabled, setWallEnabled] = useState(true)
  // Section 04.1's identity-card hours hero tile + the stat bento's `drives`
  // tile both need HoursAndCertificateCard's own summary shape. Rather than
  // prop-drilling that component's internal fetch (a bigger refactor of a
  // working, tested component than a restyle should make), this mirrors the
  // exact precedent HomePage.tsx already set for the SAME service call
  // ("certificateService.getHoursSummary is an EXISTING read... nothing new
  // is queried and no endpoint is added") — HoursAndCertificateCard keeps its
  // own independent call for the certificate-request UI below.
  const [hoursSummary, setHoursSummary] = useState<HoursSummary | null>(null)
  const [hoursLoading, setHoursLoading] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  /** The tab's content fetch FAILED, as opposed to the member having none. */
  const [contentError, setContentError] = useState(false)
  /** A `load more` request is in flight - guards the double-click. */
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [totalPostCount, setTotalPostCount] = useState(0)
  const [linkCopied, setLinkCopied] = useState(false)

  const isOwn = isOwnProp || (currentMember?.uuid === uuid)
  const profileUuid = isOwnProp ? currentMember?.uuid : uuid

  useEffect(() => {
    const fetchProfile = async () => {
      if (!profileUuid) return
      setIsLoading(true)
      try {
        // These five reads are INDEPENDENT - none needs another's result - but
        // they were awaited one after the other, so the skeleton was held for
        // the SUM of five round trips instead of the longest one. At a 200ms
        // RTT that is ~1s of skeleton for no reason, and one slow call (the
        // lifetime-likes sum over the org account's 576 posts) delayed the
        // identity card, the team chips and the wall behind it.
        //
        // allSettled, not all: a single rejected read must not blank the other
        // four, which is what the shared try/catch used to do. Each result is
        // handled on its own, same as PublicProfilePage already does.
        const [profileRes, acRes, likesRes, teamsRes, wallRes, taggedRes] = await Promise.allSettled([
          isOwn
            ? profileService.getOwnProfile()
            : profileService.getPublicProfile(profileUuid),
          // limit 1 with an exact count: the page only renders the TALLY here,
          // and the tab's own fetch re-sets it from real rows later. Pulling 50
          // full rows to display a number also capped the stat at 50, so a
          // member with 60 approved achievements read "50".
          achievementService.getMemberAchievements(profileUuid, {
            page: 1, limit: 1, ...(isOwn ? {} : { status: 'approved' }),
          }),
          profileService.getLifetimeLikes(profileUuid),
          teamService.getTeamsForMember(profileUuid),
          // §16.5: the wall tab's count/visibility needs to be known before the
          // tab is ever clicked - one cheap read, not a per-note fetch.
          wallService.getWall(profileUuid),
          // Same "count now, real rows later" pattern as achievements above.
          // taggedCount used to only ever get set by the tagged tab's OWN
          // fetch (see the activeTab==='tagged' branch below), which never
          // runs until someone actually clicks the tab - so the badge that
          // would have told them "you were tagged in something" never showed
          // in the first place, and the tab looked identical whether or not
          // there was anything behind it.
          profileService.getTaggedPosts(profileUuid, { page: 1, limit: 1 }),
        ])

        if (profileRes.status === 'fulfilled' && profileRes.value.success) {
          const v: any = profileRes.value.data
          setProfile(isOwn ? v.member : v.profile)
        } else if (profileRes.status === 'rejected') {
          console.error('Failed to fetch profile:', profileRes.reason)
        }

        // Non-owners see the APPROVED tally only - pending/rejected are private
        // to the owner (matching AchievementsList), so the public stat must not
        // leak how many submissions of theirs were turned down. That used to be
        // a client-side filter over 50 fetched rows, which both capped the stat
        // at 50 and did not hold for a DIRECTOR viewing someone else (RLS lets
        // them read every status). It is a status-filtered exact count now.
        if (acRes.status === 'fulfilled' && acRes.value.success) {
          setAchievementCount(acRes.value.pagination?.totalItems ?? acRes.value.data.length)
        }

        if (likesRes.status === 'fulfilled') setLikesEarned(likesRes.value)
        if (teamsRes.status === 'fulfilled' && teamsRes.value.success) setTeams(teamsRes.value.data.teams)
        if (wallRes.status === 'fulfilled') {
          setWallNotes(wallRes.value.notes)
          setWallEnabled(wallRes.value.wallEnabled)
        }
        if (taggedRes.status === 'fulfilled' && taggedRes.value.success) {
          setTaggedCount(taggedRes.value.pagination.totalItems)
        }
      } catch (error) { console.error('Failed to fetch profile:', error) }
      finally { setIsLoading(false) }
    }
    fetchProfile()
  }, [profileUuid, isOwn])

  // Own profile only - feeds both the identity card's hours hero tile and the
  // stat bento's `drives` tile from ONE call, so neither invents its own
  // number. Not fetched for a visited (non-own) profile: hours are private
  // (04.7 - "hours are not proposed for the public profile").
  useEffect(() => {
    if (!isOwn || !currentMember) { setHoursLoading(false); return }
    const memberId = (currentMember as any).member_id
    if (!memberId) { setHoursLoading(false); return }
    let cancelled = false
    setHoursLoading(true)
    certificateService.getHoursSummary(memberId)
      .then(s => { if (!cancelled) setHoursSummary(s) })
      .catch(err => console.error('[ProfilePage] getHoursSummary failed:', err))
      .finally(() => { if (!cancelled) setHoursLoading(false) })
    return () => { cancelled = true }
  }, [isOwn, currentMember])

  // Section 15, the catch-up half of the referral claim.
  //
  // PendingApprovalPage claims the moment an HoD approves someone who happens
  // to have that page open. Most people do not: they are approved while away
  // and come back through /login → /auth/callback → home, never touching
  // /pending again. Their own profile is the first surface they reach that is
  // BOTH reliably visited and only reachable while active, and active is the
  // hard requirement - `claim_member_referral` raises for anyone else.
  //
  // Costs nothing when there is no invite to claim: `claimStoredReferral`
  // makes no network call at all unless an id is in storage, and the RPC is
  // idempotent, so a member who already has a referrer gets `false` back.
  // A `false` is a stale or reused link and is a silent no-op, never a toast.
  const [claimTried, setClaimTried] = useState(false)
  useEffect(() => {
    if (!isOwn || claimTried) return
    if (currentMember?.status !== 'active') return
    setClaimTried(true)
    void claimStoredReferral().then(outcome => {
      // The one thing worth saying out loud, and it names nobody: there is no
      // opt-in-to-be-named column on `members`, so the referrer is never
      // identified to the person they referred.
      if (outcome === 'claimed') toast.success('The member who invited you has been credited.')
    })
  }, [isOwn, claimTried, currentMember?.status, toast])

  // Public birthday notice-board post - fires from the same trigger point as
  // the private card below (own profile, on their birthday), matching "on
  // the member's own next visit, never on a schedule". The RPC is idempotent
  // and a safe no-op most days (not their birthday, already opted out,
  // already posted this year) - see profileService.createBirthdayNotice().
  // Silent/non-blocking: the private card below is the actual feedback the
  // member sees, so a failure here just logs.
  useEffect(() => {
    if (!isOwn || !currentMember || !isBirthdayToday((currentMember as any).birthday)) return
    profileService.createBirthdayNotice().catch(err =>
      console.error('[ProfilePage] createBirthdayNotice failed (non-blocking):', err))
  }, [isOwn, currentMember])

  useEffect(() => {
    const fetchContent = async () => {
      if (!profileUuid) return
      setIsLoadingContent(true)
      setContentError(false)
      try {
        if (activeTab === 'achievements') {
          // Same status scoping as the page-load count above - a director
          // viewing someone else may READ every status, so an unfiltered call
          // here would show their pending and rejected submissions.
          const result = await achievementService.getMemberAchievements(profileUuid, {
            page: 1, limit: 20, ...(isOwn ? {} : { status: 'approved' }),
          })
          if (result.success) {
            setAchievements(result.data)
            // The exact total, NOT `data.length`. Taking the page length here
            // overwrote the correct count with 20 the moment the tab opened:
            // a member with 35 achievements watched the stat drop to 20 on the
            // same screen with nothing having changed.
            setAchievementCount(result.pagination?.totalItems ?? result.data.length)
            setHasMore(result.pagination.hasNextPage)
            setPage(1)
          }
        } else if (activeTab === 'posts') {
          const result = await profileService.getMemberPosts(profileUuid, { page: 1, limit: 20 })
          if (result.success) {
            setPosts(result.data)
            setHasMore(result.pagination.hasNextPage)
            setPage(1)
            setTotalPostCount(result.pagination.totalItems)
          }
        } else if (activeTab === 'tagged') {
          const result = await profileService.getTaggedPosts(profileUuid, { page: 1, limit: 20 })
          if (result.success) {
            setTaggedPosts(result.data)
            setTaggedHasMore(result.pagination.hasNextPage)
            setTaggedPage(1)
            setTaggedCount(result.pagination.totalItems)
          }
        }
      } catch (error) {
        // Was console.error only, so the render below fell through to the
        // confident "no posts yet" well - a claim about the MEMBER made from a
        // failure of the network.
        setContentError(true)
        console.error('Failed to fetch content:', error)
      }
      finally { setIsLoadingContent(false) }
    }
    fetchContent()
  }, [profileUuid, activeTab])

  // `loadingMore` guards the double-click: without it a second tap fired the
  // same page again and appended the same 20 posts twice, and a failure was
  // completely silent.
  const loadMorePosts = async () => {
    if (!profileUuid || !hasMore || loadingMore) return
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const result = await profileService.getMemberPosts(profileUuid, { page: nextPage, limit: 20 })
      if (result.success) { setPosts(prev => [...prev, ...result.data]); setHasMore(result.pagination.hasNextPage); setPage(nextPage) }
    } catch (error) {
      console.error('Failed to load more posts:', error)
      toast.error('couldn’t load more posts.', 'Check your connection and try again.')
    } finally { setLoadingMore(false) }
  }

  const loadMoreTagged = async () => {
    if (!profileUuid || !taggedHasMore || loadingMore) return
    const nextPage = taggedPage + 1
    setLoadingMore(true)
    try {
      const result = await profileService.getTaggedPosts(profileUuid, { page: nextPage, limit: 20 })
      if (result.success) { setTaggedPosts(prev => [...prev, ...result.data]); setTaggedHasMore(result.pagination.hasNextPage); setTaggedPage(nextPage) }
    } catch (error) {
      console.error('Failed to load more tagged posts:', error)
      toast.error('couldn’t load more posts.', 'Check your connection and try again.')
    } finally { setLoadingMore(false) }
  }

  const handleShareProfile = async () => {
    const targetUuid = profile?.uuid
    if (!targetUuid) return
    const url = `${window.location.origin}/member/${targetUuid}`
    try { await navigator.clipboard.writeText(url) } catch {
      const el = document.createElement('input'); el.value = url
      document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el)
    }
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const handleComeBackEarly = async () => {
    const ok = await confirm({
      title: 'come back early?',
      body: 'this clears your break. your leads will see you as active again.',
      confirmLabel: "I'm back",
      cancelLabel: 'not yet',
    })
    if (!ok) return
    setEndingBreak(true)
    try {
      await breakService.endBreakEarly()
      await refreshMember()
      toast.success('welcome back.')
    } catch (e: any) {
      toast.error("couldn't end the break.", e?.message)
    } finally {
      setEndingBreak(false)
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  if (isLoading) {
    return (
      <div className="route-enter">
        {/* Hero */}
        <div style={{ background: 'var(--bg-2)', padding: 'clamp(28px,5vw,52px) var(--page-px,24px)', borderBottom: '1px solid var(--line)' }}>
          <div style={{ maxWidth: 960, margin: '0 auto' }}>
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="v6-skeleton sk-circle" style={{ width: 88, height: 88 }} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div className="v6-skeleton" style={{ width: 200, height: 28, marginBottom: 10 }} />
                <div className="v6-skeleton" style={{ width: 140, height: 13, marginBottom: 16 }} />
                <div style={{ display: 'flex', gap: 18 }}>
                  {[44, 44, 44].map((w, i) => <div key={i} className="v6-skeleton" style={{ width: w, height: 18 }} />)}
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Tabs + cards */}
        <div style={{ maxWidth: 960, margin: '0 auto', padding: 'clamp(20px,4vw,28px) var(--page-px,24px) 80px' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            {[80, 120, 70].map((w, i) => <div key={i} className="v6-skeleton sk-pill" style={{ width: w, height: 34 }} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 16 }} className="sk-group">
            {[1,2,3].map(i => <div key={i} className="v6-skeleton" style={{ height: 260, borderRadius: 'var(--r-inner)' }} />)}
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="route-enter aq-wrap" style={{ paddingTop: 'clamp(44px, 8vw, 80px)', paddingBottom: 'clamp(44px, 8vw, 80px)', textAlign: 'center' }}>
        {/* h1, not a div: this branch replaces the ENTIRE page, so without it
            the document has no heading at all and a screen reader has
            nothing to announce on arrival. Same visual treatment. */}
        <h1 className="h-display" style={{ fontSize: 40, margin: 0 }}>profile not found.</h1>
        <Link to="/" className="btn btn-primary" style={{ marginTop: 24, display: 'inline-flex' }}>← back to feed</Link>
      </div>
    )
  }

  const avatarColor = hashColor(profile.fullName)
  const firstName = profile.fullName.split(' ')[0]
  const onBreak = isOwn && !!currentMember && isCurrentlyOnBreak((currentMember as any).break_end)
  const driveCount = hoursSummary?.driveCount ?? 0

  return (
    <div className="route-enter">
      {/* Identity card - section 04.1/04.6/04.7. Own profile is ink (reserved
          for your own surfaces); ProfilePage.tsx also renders another ACTIVE
          member's profile at /profile/:uuid (App.tsx), a case 04.1 does not
          separately name since it assumes this component is always "your
          own" - `.is-other` re-tokens to the same white card 04.7 specifies
          for PublicProfilePage, so a visitor never mistakes the account for
          their own. */}
      <div className="aq-wrap" style={{ paddingTop: isMobile ? 14 : 'clamp(20px,4vw,28px)' }}>
        <div className={'pf-identity' + (isOwn ? '' : ' is-other')}>
          <div className="pf-id-row">
            <div className="pf-id-top">
              <div className="pf-portrait" style={{ background: avatarColor }}>
                {profile.avatarUrl
                  ? <Img ctx="avatar" src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" />
                  : <span className="pf-initials">{getInitials(profile.fullName)}</span>}
                {isOwn && (
                  <Link to="/profile/edit?uploadAvatar=1" className="pf-avatar-edit" aria-label="Change profile picture">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </Link>
                )}
              </div>
              <div className="pf-namewrap">
                <div>
                  <div className="pf-eyebrow">{profile.createdAt ? `joined ${formatDate(profile.createdAt)}` : ' '}</div>
                  {/* KEPT verbatim: text-wrap:balance + overflow-wrap/word-break
                      guard a long name from breaking the layout (04.1) - the
                      portrait is a flex sibling with its own reserved width,
                      never absolutely positioned under this heading. */}
                  <h1 className="pf-name" style={{ textWrap: 'balance', overflowWrap: 'break-word', wordBreak: 'break-word' } as React.CSSProperties}>
                    {profile.fullName}
                  </h1>
                </div>
                <div className="pf-chips">
                  {profile.role !== 'member' && (
                    <span className="pf-chip">{getRoleLabel(profile.role)}</span>
                  )}
                  {teams.map(t => (
                    <Link key={t.uuid} to={`/teams/${t.uuid}`} className="pf-chip">
                      <span className="pf-chip-dot" style={{ background: deptColorForTeamName(t.name) || 'var(--ink-3)' }} aria-hidden="true" />
                      {t.name}
                    </Link>
                  ))}
                  {profile.schoolName && <span className="pf-chip">{profile.schoolName}</span>}
                </div>
              </div>
            </div>
            <div className="pf-id-side">
              {/* The hours hero tile self-hides exactly like
                  HoursAndCertificateCard's own guards (loading, no summary,
                  or zero counted drives) - 04.1 says to design this column to
                  collapse gracefully rather than showing "0h". */}
              {isOwn && !hoursLoading && hoursSummary && hoursSummary.driveCount > 0 && (
                <div className="pf-hourtile">
                  <span className="pf-hourtile-label">hours volunteered</span>
                  <span>
                    <b className="pf-hourtile-figure">
                      {hoursSummary.totalHours}h
                      {hoursSummary.undercounted && <span style={{ fontSize: 15, fontWeight: 400, fontFamily: 'var(--eina)', color: 'var(--ink-3)' }}>+</span>}
                    </b>
                    <span className="pf-hourtile-sub">
                      {hoursSummary.driveCount} drive{hoursSummary.driveCount === 1 ? '' : 's'}
                      {hoursSummary.earliestDate && hoursSummary.latestDate && ` · ${hoursSummary.earliestDate} – ${hoursSummary.latestDate}`}
                    </span>
                  </span>
                </div>
              )}
              <div className="pf-idbuttons">
                {isOwn && <Link to="/profile/edit" className="pf-editbtn">edit profile</Link>}
                <button className="pf-sharebtn" onClick={handleShareProfile} aria-label={linkCopied ? 'Profile link copied' : 'Share profile'} title={linkCopied ? 'Profile link copied' : 'Share profile'}>
                  {linkCopied ? '✓' : '↗'}
                </button>
              </div>
            </div>
          </div>

          {/* Break status - own profile only. Member-initiated: setting/ending
              a break is never available on someone else's profile. 04.6: a
              banner INSIDE the ink identity card, not a separate card. */}
          {onBreak && (
            <div className="pf-break">
              <span className="pf-break-avatar" aria-hidden="true">
                {profile.avatarUrl
                  ? <Img ctx="avatar" src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" />
                  : <MoonIcon className="pf-break-moon" strokeWidth={1.8} />}
              </span>
              <div className="pf-break-text">
                <div className="pf-break-sentence">
                  on a break until {new Date((currentMember as any).break_end + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                </div>
                {/* BREAK_REASSURANCE: real, tested, deliberately shared copy
                    with BreakModal (see that file) - kept, not dropped, even
                    though 04.6 elsewhere says "no second line" (see profile.css
                    comment on .pf-break-sub for the full reasoning). */}
                <p className="pf-break-sub">{BREAK_REASSURANCE}</p>
              </div>
              <div className="pf-break-actions">
                <button className="pf-break-btn" onClick={handleComeBackEarly} disabled={endingBreak} aria-busy={endingBreak}>
                  {endingBreak ? 'saving...' : 'come back early'}
                </button>
                <button className="pf-break-btn" onClick={() => setShowBreakModal(true)}>edit break</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stat bento - section 04.2. Four tiles for the owner (posts, likes,
          drives, achievements); the `drives` tile is own-only because its
          source (hoursSummary, above) is only fetched for the owner - hours
          and its companion drive count are not proposed for a visited
          profile (04.7). */}
      <div className="aq-wrap" style={{ paddingTop: 14 }}>
        <div className="pf-bento">
          <div className="pf-bento-tile">
            <div className="pf-bento-well" style={{ background: 'color-mix(in srgb, var(--welfare) 22%, transparent)' }}>
              <span className="pf-bento-label" style={{ color: 'var(--welfare-ink)' }}>posts</span>
              <b className="pf-bento-figure">{totalPostCount}</b>
            </div>
          </div>
          <div className="pf-bento-tile">
            <div className="pf-bento-well" style={{ background: 'color-mix(in srgb, var(--tomato) 22%, transparent)' }}>
              <span className="pf-bento-label" style={{ color: 'var(--tomato-ink)' }}>likes earned</span>
              <b className="pf-bento-figure">{likesEarned}</b>
            </div>
          </div>
          {isOwn && (
            <div className="pf-bento-tile">
              <div className="pf-bento-well" style={{ background: 'color-mix(in srgb, var(--sky) 22%, transparent)' }}>
                <span className="pf-bento-label" style={{ color: 'var(--sky-ink)' }}>drives</span>
                {/* An em dash when the hours fetch failed, not a confident 0.
                    `hoursSummary?.driveCount ?? 0` cannot tell "you attended
                    none" from "we could not find out", and telling a member who
                    has been on twenty drives that they have been on none is the
                    more damaging of the two. */}
                <b className="pf-bento-figure">{hoursSummary ? driveCount : '–'}</b>
              </div>
            </div>
          )}
          <div className="pf-bento-tile">
            <div className="pf-bento-well" style={{ background: 'color-mix(in srgb, var(--lemon) 30%, transparent)' }}>
              <span className="pf-bento-label" style={{ color: 'var(--lemon-ink)' }}>achievements</span>
              <b className="pf-bento-figure">{achievementCount}</b>
            </div>
          </div>
        </div>
        {/* Own profile only: badges are derived from the counts above (no storage, no ranking). Waits for the hours fetch so the
            drives and hours badges are not judged against a zero that just means "not loaded yet". */}
        {isOwn && hoursSummary && (
          <BadgeShelf inputs={{ posts: totalPostCount, likes: likesEarned, drives: driveCount, hours: hoursSummary.totalHours, teams: teams.length, achievements: achievementCount }} />
        )}
        <PhotoCollection posts={posts} />
      </div>

      {/* Private birthday acknowledgement - own profile only, fires regardless
          of birthday_public (that toggle only gates the PUBLIC notice-board
          post, handled by the effect above). Never fabricates a stat: the
          membership-duration line only renders when real created_at math
          produces at least a month. */}
      {isOwn && currentMember && isBirthdayToday((currentMember as any).birthday) && (
        <div className="aq-wrap" style={{ paddingTop: 16 }}>
          <div className="card" style={{ padding: '18px 20px', background: 'var(--lemon)', border: 'var(--hair-2)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div aria-hidden="true" style={{ width: 40, height: 40, borderRadius: '50%', background: '#fff', border: 'var(--hair-3)', flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 18 }}>★</div>
            <div>
              <div className="h-display" style={{ fontSize: 20, color: '#0A0A0A' }}>happy birthday{firstName ? `, ${firstName}` : ''}.</div>
              {membershipDuration(profile.createdAt) && (
                <div style={{ fontSize: 13, color: '#0A0A0A', opacity: 0.75, marginTop: 2 }}>
                  you've been with AquaTerra {membershipDuration(profile.createdAt)}.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Section 15, the profile invite block. A LINK to /invite, never the
          composer: one page owns minting, so there is exactly one place a link
          can be made and exactly one tracker that knows about it.

          Own profile only, and only while active, because /invite is
          `requireActive` - `current_member_id()` is the member row WHERE
          status = 'active', so a pending member could fill the composer in and
          never complete the INSERT. Offering a link that bounces is worse than
          not offering it.

          This is the contextual marketing push the guardrails ask every member
          surface for, and the lateral exit out of a page that otherwise ends
          in its own tabs. It carries no count and no leaderboard: the badge
          figure lives on /invite where it is read at render, and a count here
          would be a second place for it to drift. */}
      {isOwn && currentMember && currentMember.status === 'active' && (
        <div className="aq-wrap" style={{ paddingTop: 16 }}>
          <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div aria-hidden="true" style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--welfare)', border: 'var(--hair-3)', flexShrink: 0, display: 'grid', placeItems: 'center' }}>
              <LinkIcon width={20} height={20} strokeWidth={1.8} style={{ color: 'var(--ink)' }} />
            </div>
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <div className="h-display" style={{ fontSize: 20 }}>bring someone in.</div>
              <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '2px 0 0', lineHeight: 1.5 }}>
                Send one person a link and write a line about why. An HoD reads that line
                next to their application.
              </p>
            </div>
            <Link to="/invite" className="btn" style={{ minHeight: 44, flexShrink: 0 }}>
              make an invite link →
            </Link>
          </div>
        </div>
      )}

      {/* Own profile only, and the private-card boundary in section 06: hours,
          the certificate queue, class, phone, email, the break note and the
          activity log render here and on an HoD desk, never on a public
          profile for any role.
          REMOVED 2026-09-04 (decision 12, REDESIGN_FEATURE_REQUESTS.md): this
          block also rendered PointsLedgerCard above the hours card. The welfare
          points system is retired, so the card and its file are gone.
          `points_ledger`, `services/pointsService.ts` and every RLS policy on
          the table are deliberately UNTOUCHED so the decision is reversible
          without a migration. */}
      {isOwn && currentMember && (
        <div className="aq-wrap" style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* FR11-b: the winner's own photo-upload step. Own-profile-only for
              the same reason every card in this block is - reached from the
              "you're the pick" notification's link (/profile/me) too. Hides
              itself entirely unless this member currently has an unclaimed
              pick, same convention as HoursAndCertificateCard below. */}
          {/* 22.4's second placement: the lemon recognition card itself
              (distinct from the claim-your-photo card below it - this one is
              the "you were picked" badge, absent unless a pick exists for
              THIS calendar month; see MemberOfMonthProfileBadge). */}
          <MemberOfMonthProfileBadge uuid={(currentMember as any).uuid} />
          {/* Item 7.4. First in this block on purpose: a task someone has
              assigned you is the one thing here that is waiting on YOU, so it
              outranks the badge, the hours and the CV, all of which are
              records of what you have already done. Renders nothing when
              there are no open tasks - see MyTasksCard. */}
          <MyTasksCard />
          <MemberOfMonthClaimCard memberId={(currentMember as any).member_id} />
          {/* Hand it the summary this page already fetched, so the own profile
              stops issuing the same drive_attendance read twice. */}
          <HoursAndCertificateCard memberId={(currentMember as any).member_id} initialSummary={hoursSummary} />
          {/* FR9: generate a CV from this member's own AquaTerra record. Sits
              inside the same own-profile-only block as the hours card and for
              the same reason - it prints the member's email, phone and class,
              which never appear on a public profile for any role. Unlike the
              hours card it does NOT hide itself at zero drives; tenure and
              teams alone are worth a CV. */}
          <CvCard member={currentMember as any} />
          {/* The break TRIGGER (04.5) - own profile, not currently on a
              break. BUG FOUND WHILE RESTYLING: this control used to render as
              its own full-width row directly under the hero, outside this
              card stack; folding the break STATE into the ink identity card
              (04.6) means the not-on-break case needs an explicit home too,
              or the only way to open BreakModal disappears. Placed here,
              matching 6a's aside (a third white side-card, sibling to the
              certificate and CV cards). Real string, ProfilePage.tsx's own
              (verbatim): "going on a break?". No sub-line - leave the slot
              empty rather than inventing one ("pause without leaving" is
              the mock's invented copy). */}
          {!onBreak && (
            <div className="card">
              <button type="button" className="pf-break-trigger" onClick={() => setShowBreakModal(true)}>
                <span className="pf-break-trigger-icon"><MoonIcon width={18} height={18} strokeWidth={1.8} /></span>
                <span className="pf-break-trigger-label">going on a break?</span>
                <svg className="pf-break-trigger-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
              </button>
            </div>
          )}
        </div>
      )}

      <div className="aq-wrap" style={{ paddingTop: isMobile ? 16 : 'clamp(24px,5vw,40px)', paddingBottom: isMobile ? 48 : 80 }}>
        {/* Section 31's TABS block: a 999px bar with one filled ink pill.
            Four mutually exclusive views, inside the block's 3-to-5 range. */}
        <div className="tabs tabs--seg" role="tablist">
          <button role="tab" aria-selected={activeTab === 'posts'} className={'tab ' + (activeTab === 'posts' ? 'active' : '')} onClick={() => setActiveTab('posts')}>
            posts <span className="count">{totalPostCount}</span>
          </button>
          <button role="tab" aria-selected={activeTab === 'tagged'} className={'tab ' + (activeTab === 'tagged' ? 'active' : '')} onClick={() => setActiveTab('tagged')}>
            tagged {taggedCount > 0 && <span className="count">{taggedCount}</span>}
          </button>
          <button role="tab" aria-selected={activeTab === 'achievements'} className={'tab ' + (activeTab === 'achievements' ? 'active' : '')} onClick={() => setActiveTab('achievements')}>achievements</button>
          <button role="tab" aria-selected={activeTab === 'tasks'} className={'tab ' + (activeTab === 'tasks' ? 'active' : '')} onClick={() => setActiveTab('tasks')}>tasks</button>
          <button role="tab" aria-selected={activeTab === 'about'} className={'tab ' + (activeTab === 'about' ? 'active' : '')} onClick={() => setActiveTab('about')}>about</button>
          {/* §16.5: a 5th tab, added rather than fit into the file's assumed
              3-tab "Achievements · Posts · Wall {n}" row - this page already
              ships 4 tabs (posts/tagged/achievements/about) before 16 exists,
              and 04.3 says never merge or rename an existing one. Renders
              even at zero on your own profile (so the off-switch stays
              reachable); on someone else's it renders only with notes AND
              wall_enabled, per §16.5. */}
          {(isOwn || (wallEnabled && wallNotes.length > 0)) && (
            <button role="tab" aria-selected={activeTab === 'wall'} className={'tab ' + (activeTab === 'wall' ? 'active' : '')} onClick={() => setActiveTab('wall')}>
              Wall {wallNotes.length > 0 && <span className="count">{wallNotes.length}</span>}
            </button>
          )}
        </div>

        <div style={{ paddingTop: 28 }}>
          {activeTab === 'posts' && (
            isLoadingContent ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))', gap: 18 }} aria-hidden="true">
                {[1, 2, 3].map(i => <div key={i} className="v6-skeleton" style={{ height: 260, borderRadius: 'var(--r-inner)', animationDelay: `${i * 0.08}s` }} />)}
              </div>
            ) : posts.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))', gap: 18 }}>
                {posts.map((post, i) => (
                  <FeedPostCard key={post.postId} post={post} seed={i} savedInitial={savedSet.has(post.postId)} linkedOpening={openings.get(post.uuid) ?? null} decision={shapeDecisions[i]} />
                ))}
                {hasMore && (
                  <button onClick={loadMorePosts} className="btn" style={{ gridColumn: '1/-1', justifyContent: 'center' }}>load more</button>
                )}
              </div>
            ) : contentError ? (
              <div className="card">
                <div className="pf-empty-well">
                  <div className="h-display" style={{ fontSize: 28 }}>couldn’t load these posts.</div>
                  <p className="muted">That’s a connection problem, not an empty profile.</p>
                </div>
              </div>
            ) : (
              <div className="card">
                <div className="pf-empty-well">
                  <div style={{ fontSize: 80, fontFamily: 'var(--display)' }}>¯\_(ツ)_/¯</div>
                  <div className="h-display" style={{ fontSize: 32, marginTop: 12 }}>no posts yet</div>
                  <p className="muted">when {isOwn ? 'you post' : `${profile.fullName} posts`}, it'll show up here.</p>
                </div>
              </div>
            )
          )}
          {activeTab === 'tagged' && (
            isLoadingContent ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))', gap: 18 }} aria-hidden="true">
                {[1, 2, 3].map(i => <div key={i} className="v6-skeleton" style={{ height: 260, borderRadius: 'var(--r-inner)', animationDelay: `${i * 0.08}s` }} />)}
              </div>
            ) : taggedPosts.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))', gap: 18 }}>
                {taggedPosts.map((post, i) => (
                  <FeedPostCard key={post.postId} post={post} seed={i} savedInitial={savedSet.has(post.postId)} linkedOpening={openings.get(post.uuid) ?? null} decision={taggedShapeDecisions[i]} />
                ))}
                {taggedHasMore && (
                  <button onClick={loadMoreTagged} className="btn" style={{ gridColumn: '1/-1', justifyContent: 'center' }}>load more</button>
                )}
              </div>
            ) : contentError ? (
              <div className="card">
                <div className="pf-empty-well">
                  <div className="h-display" style={{ fontSize: 28 }}>couldn’t load these posts.</div>
                  <p className="muted">That’s a connection problem, not an empty profile.</p>
                </div>
              </div>
            ) : (
              <div className="card">
                <div className="pf-empty-well">
                  <div style={{ fontSize: 80, fontFamily: 'var(--display)' }}>¯\_(ツ)_/¯</div>
                  <div className="h-display" style={{ fontSize: 32, marginTop: 12 }}>no tagged posts yet</div>
                  <p className="muted">when someone tags {isOwn ? 'you' : profile.fullName} in a post, it'll show up here.</p>
                </div>
              </div>
            )
          )}
          {activeTab === 'achievements' && (
            isLoadingContent ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} aria-hidden="true">
                {[1, 2, 3].map(i => <div key={i} className="v6-skeleton" style={{ height: 96, borderRadius: 'var(--r-inner)', animationDelay: `${i * 0.08}s` }} />)}
              </div>
            ) : contentError ? (
              // Before the two branches below, not after: a failed fetch left a
              // VISITOR reading "hasn't added any achievements yet" and an OWNER
              // reading an empty list, both of which say the opposite of what
              // happened. Same treatment the posts and tagged tabs already have.
              <div className="card">
                <div className="pf-empty-well">
                  <div className="h-display" style={{ fontSize: 28 }}>couldn’t load these achievements.</div>
                  <p className="muted">That’s a connection problem, not an empty profile.</p>
                </div>
              </div>
            ) : achievements.length > 0 || isOwn ? (
              // Own profile always renders the real component - even with zero
              // achievements - so the "+ Add achievement" flow stays reachable.
              // (Previously an owner with no achievements saw a purely decorative
              // mock grid with no way to add one; only visitors get that preview.)
              <AchievementsList
                achievements={achievements}
                isLoading={false}
                isOwn={isOwn}
                profileName={profile.fullName}
                onRefresh={async () => {
                  if (!profileUuid) return
                  try {
                    // Mirrors the tab fetch above exactly: status-scoped for a
                    // visitor, exact total rather than the page length.
                    const result = await achievementService.getMemberAchievements(profileUuid, {
                      page: 1, limit: 20, ...(isOwn ? {} : { status: 'approved' }),
                    })
                    if (result.success) {
                      setAchievements(result.data)
                      setAchievementCount(result.pagination?.totalItems ?? result.data.length)
                    }
                  } catch (error) { console.error('Failed to refresh achievements:', error) }
                }}
              />
            ) : (
              // Visitor viewing a member with no approved achievements — show an
              // honest empty state, never a decorative mock grid that reads as
              // real badges the person holds.
              <div className="card">
                <div className="pf-empty-well">
                  <div className="mono xs upper muted">{firstName} hasn't added any achievements yet</div>
                </div>
              </div>
            )
          )}
          {activeTab === 'tasks' && profileUuid && <ProfileTasks memberUuid={profileUuid} isOwn={isOwn} name={profile.fullName} />}

          {activeTab === 'about' && (
            <div className="card" style={{ padding: 28, maxWidth: 720 }}>
              <div className="serif" style={{ fontSize: 48, lineHeight: 1, marginBottom: 16 }}>about.</div>
              {profile.bio ? (
                <p style={{ fontSize: 17, lineHeight: 1.6 }}>{profile.bio}</p>
              ) : isOwn ? (
                <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--ink-3)', fontStyle: 'italic' }}>
                  No bio yet. <Link to="/profile/edit" style={{ color: 'var(--welfare-ink)', textDecoration: 'underline' }}>Add one →</Link>
                </p>
              ) : (
                <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--ink-3)' }}>{profile.fullName} hasn't added a bio yet.</p>
              )}
              <div style={{ borderTop: 'var(--hair-2)', margin: '20px 0', paddingTop: 16 }}>
                <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
                  {profile.schoolName && <div><span className="mono xs upper muted">school</span><div style={{ fontWeight: 700 }}>{profile.schoolName}</div></div>}
                  {profile.classGrade && <div><span className="mono xs upper muted">class</span><div style={{ fontWeight: 700 }}>{profile.classGrade}</div></div>}
                  {profile.createdAt && <div><span className="mono xs upper muted">joined</span><div style={{ fontWeight: 700 }}>{formatDate(profile.createdAt)}</div></div>}
                  <div><span className="mono xs upper muted">role</span><div style={{ fontWeight: 700 }}>{profile.role}</div></div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'wall' && (
            <WallTab
              recipientUuid={profileUuid!}
              recipientName={profile.fullName}
              isOwn={isOwn}
              currentMemberUuid={currentMember?.uuid}
              notes={wallNotes}
              wallEnabled={wallEnabled}
              loading={isLoading}
              onNotesChange={setWallNotes}
              onWallEnabledChange={setWallEnabled}
            />
          )}
        </div>
      </div>

      {isOwn && (
        <BreakModal
          isOpen={showBreakModal}
          onClose={() => setShowBreakModal(false)}
          onSaved={() => { refreshMember() }}
        />
      )}
    </div>
  )
}

export default ProfilePage
