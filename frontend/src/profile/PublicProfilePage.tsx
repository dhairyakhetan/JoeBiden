import Img from '../components/Img'
import { useState, useEffect, useMemo } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { resolveMemberIdFromUuid } from '../lib/authCache'
import profileService, { MemberProfile } from '../services/profileService'
import { Post, Achievement } from '../services/api'
import achievementService from '../services/achievementService'
import { safeExternalHref } from '../lib/safeUrl'
import followService from '../services/followService'
import teamService from '../services/teamService'
import wallService, { WallNote as WallNoteData } from '../services/wallService'
import WallTab from './wall/WallTab'
import PeopleListModal from '../components/PeopleListModal'
import MemberOfMonthProfileBadge from './MemberOfMonthProfileBadge'
import FeedPostCard from '../feed/FeedPostCard'
import PhotoCollection from './PhotoCollection'
import { feedItemFromPost } from '../feed/feedItemFromPost'
import { shapeFeed } from '../lib/feedShape'
import { useFeedCardBatch } from '../hooks/useFeedCardBatch'
import { setAuthIntent } from '../lib/authIntent'
import { pushRecent } from '../lib/recentlyViewed'
import { isOfficialAccount, VerifiedTick } from '../components/v6Shared'
import { getRoleLabel } from '../lib/roles'
import { deptColorForTeamName } from '../lib/departments'
import { useIsMobile } from '../hooks/useMobile'
import { useToast } from '../components/Toast'
import { useMeta } from '../hooks/useMeta'
import { useJsonLd, breadcrumbLd } from '../hooks/useJsonLd'
import { pageMetadata } from '../lib/metaConfig'
import { getInitials, hashColor } from '../lib/uiHelpers'
import { ORG_FACTS, displayCount } from '../lib/orgFacts'
import '../styles/routes/profile.css'

const formatDate = (dateStr?: string) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}
// Word-boundary truncation for the meta description so a member's free-text bio
// isn't chopped mid-word like a raw CMS `.slice()`. (Bio is a public field; the
// Person JSON-LD below is likewise limited to public fields only.)
function metaTrim(s: string, max = 158) {
  const clean = (s || '').replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  if (clean.length <= max) return clean
  return clean.slice(0, max - 1).replace(/\s+\S*$/, '').trimEnd() + '…'
}

export default function PublicProfilePage() {
  const { uuid } = useParams<{ uuid: string }>()
  const [searchParams] = useSearchParams()
  const { member: currentMember, isLoading: authLoading } = useAuth()
  const isMobile = useIsMobile()
  const toast = useToast()
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  /** The read FAILED. Separate from `profile === null` meaning "no such member" -
   *  telling an HoD that a volunteer's account does not exist, when the request
   *  simply did not complete, reads as "this person was deleted". */
  const [profileError, setProfileError] = useState(false)
  const [profileReloadKey, setProfileReloadKey] = useState(0)
  // Substitute the real member name into the {userName} title/description templates
  // (previously passed raw, so the page title read literally "{userName} | …").
  useMeta({
    ...pageMetadata.publicProfile,
    title: profile?.fullName ? `${profile.fullName} | AquaTerra Member` : 'Member Profile | AquaTerra',
    description: profile?.fullName
      ? (metaTrim(profile.bio || '')
         || `${profile.fullName}, an AquaTerra member, part of the student-led community running real drives and projects in Kolkata.`)
      : 'A member of AquaTerra, the student-led community in Kolkata.',
    image: profile?.avatarUrl || undefined,
    imageAlt: profile?.fullName ? `${profile.fullName}'s profile photo` : undefined,
    // noindex, and robots.txt now ALLOWS /member/ for search engines so this
    // instruction is actually readable. Disallow prevents crawling, not
    // indexing: a profile linked from an Instagram bio or a WhatsApp group can
    // still be indexed as a bare URL, and because Google was forbidden from
    // fetching it, it never saw any on-page instruction. noindex is the
    // strictly STRONGER exclusion. This is the same reasoning robots.txt
    // already spells out for /post/ - it just was never applied here, and
    // these are real students, many of them minors.
    noIndex: true,
  })

  // Person schema REMOVED alongside the noIndex above. It only ever carried
  // public fields (name, role label, bio, avatar - email/phone/school/class
  // were always excluded), but structured data exists to be consumed by
  // machines that index a page, and this page is now explicitly noindex. On a
  // page about a minor, emitting a machine-readable name+photo+bio record to
  // every crawler that fetches it buys nothing and costs something.
  // personLd's import is dropped with it; getRoleLabel is still used below.

  useJsonLd('member-breadcrumb', profile?.fullName ? breadcrumbLd([
    ['Home', '/'], ['Members', '/members'], [profile.fullName, `/member/${uuid}`],
  ]) : null)
  const [posts, setPosts] = useState<Post[]>([])
  // Batch per-card saved-state + linked-opening for the authored-posts tab.
  const feedCardBatch = useFeedCardBatch(posts)
  // Section 10 mount, this page: every row here is already the SAME author
  // (the profile's own), so composeFeed's author-collapse cap would fire on
  // row 4 of this list every time - the wrong tool for a single-author
  // gallery. Plain shapeFeed() only; FeedPostCard ignores a decision outside
  // SHAPED_SHAPES on its own.
  const shapeDecisions = useMemo(
    () => shapeFeed(posts.map(p => feedItemFromPost(p, ''))),
    [posts],
  )
  const [achievements, setAchievements] = useState<Achievement[]>([])
  // §16.4: a wall-note notification deep-links to `?tab=wall`.
  const [activeTab, setActiveTab] = useState<'posts' | 'tagged' | 'achievements' | 'about' | 'wall'>(
    () => (searchParams.get('tab') === 'wall' ? 'wall' : 'posts'),
  )
  const [wallNotes, setWallNotes] = useState<WallNoteData[]>([])
  const [wallEnabled, setWallEnabled] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingPosts, setIsLoadingPosts] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPostCount, setTotalPostCount] = useState(0)

  // Tagged posts - posts where this member appears in `post_tags` but is
  // not the author. Volunteers who attend a lot but don't post personally
  // would otherwise see an empty profile.
  const [taggedPosts, setTaggedPosts] = useState<Post[]>([])
  const [isLoadingTagged, setIsLoadingTagged] = useState(false)
  const [taggedTotal, setTaggedTotal] = useState(0)
  const [taggedHasMore, setTaggedHasMore] = useState(false)
  const [taggedPage, setTaggedPage] = useState(1)
  const [linkCopied, setLinkCopied] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followPop, setFollowPop] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  // Member's team memberships - shown as chips in the "about" tab.
  const [memberTeams, setMemberTeams] = useState<{ uuid: string; name: string; category: string }[]>([])
  // "Builders alongside {name}" - people who share a team with this member.
  const [alongside, setAlongside] = useState<{ uuid: string; fullName: string; avatarUrl?: string; role?: string }[]>([])
  const [alongsideLoading, setAlongsideLoading] = useState(false)
  const isOwn = currentMember?.uuid === uuid
  const [peopleList, setPeopleList] = useState<null | 'followers' | 'following'>(null)
  // The viewer's own teams, to say which ones they share with this person (the LinkedIn "mutual connections" cue).
  const [myTeamUuids, setMyTeamUuids] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!currentMember || isOwn) { setMyTeamUuids(new Set()); return }
    let live = true
    teamService.getMyTeams({ limit: 100 })
      .then(r => { if (live) setMyTeamUuids(new Set((r.data || []).map((t: any) => t.uuid))) })
      .catch(() => { /* a cue that cannot load simply does not show */ })
    return () => { live = false }
  }, [currentMember?.uuid, isOwn])

  /* Section 06 step 14, and the page's privacy boundary. `status` is
     'pending' | 'approved' | 'rejected'; only 'approved' is public. This page
     was rendering the raw list and counting `achievements.length` in the hero
     stat, so a visitor could read the tally of someone else's UNapproved
     submissions - ProfilePage already guards exactly this and says so in a
     comment ("the public stat must not leak the tally of a member's
     unapproved submissions"); the guard had never been added here. No query
     changed: this filters rows already fetched. */
  const visibleAchievements = isOwn ? achievements : achievements.filter(a => a.status === 'approved')

  useEffect(() => {
    if (!uuid) return
    setIsLoading(true)
    profileService.getPublicProfile(uuid)
      .then(r => {
        if (r.success) {
          setProfile(r.data.profile)
          const prof = r.data.profile
          pushRecent({
            kind: 'profile',
            id: prof.uuid,
            title: prof.fullName || 'Member',
            subtitle: prof.role === 'director' ? 'Director' : (prof.schoolName || undefined),
            image: prof.avatarUrl,
            href: `/profile/${prof.uuid}`,
          })
        }
      })
      .catch((err) => { setProfileError(true); console.warn('[PublicProfilePage] profile fetch failed', uuid, err) })
      .finally(() => setIsLoading(false))
  }, [uuid, profileReloadKey])

  useEffect(() => {
    if (!uuid) return
    setIsLoadingPosts(true)
    profileService.getMemberPosts(uuid, { page: 1, limit: 20 })
      .then(r => {
        if (r.success) {
          setPosts(r.data)
          setHasMore(r.pagination.hasNextPage)
          setPage(1)
          setTotalPostCount(r.pagination.totalItems)
        }
      })
      .catch((err) => console.warn('[PublicProfilePage] posts fetch failed', uuid, err))
      .finally(() => setIsLoadingPosts(false))
  }, [uuid])

  useEffect(() => {
    if (!uuid) return
    setIsLoadingTagged(true)
    profileService.getTaggedPosts(uuid, { page: 1, limit: 20 })
      .then(r => {
        if (r.success) {
          setTaggedPosts(r.data)
          setTaggedHasMore(r.pagination.hasNextPage)
          setTaggedPage(1)
          setTaggedTotal(r.pagination.totalItems)
        }
      })
      .catch((err) => console.warn('[PublicProfilePage] tagged posts fetch failed', uuid, err))
      .finally(() => setIsLoadingTagged(false))
  }, [uuid])

  useEffect(() => {
    if (!uuid) return
    achievementService.getMemberAchievements(uuid, { limit: 50 })
      .then(r => { if (r.success) setAchievements(r.data) })
      .catch((err) => console.warn('[PublicProfilePage] achievements fetch failed', uuid, err))
  }, [uuid])

  // §16.5: fetched once here (like every other tab count on this page) so
  // the tab's visibility/count is known before it is ever clicked - "on
  // someone else's it renders only if they have notes and wall_enabled".
  //
  // Members only (owner decision 2026-10-09): profile_notes is not readable by a signed-out
  // visitor, so asking made the database refuse every anonymous view of /member/:uuid
  // ("permission denied", about twice a day). A signed-out visitor sees no wall, same as a
  // member whose wall is empty. Waits for the session to finish loading so a member is not
  // mistaken for a visitor while it restores.
  const signedIn = !!currentMember
  useEffect(() => {
    if (!uuid || authLoading || !signedIn) return
    wallService.getWall(uuid)
      .then(w => { setWallNotes(w.notes); setWallEnabled(w.wallEnabled) })
      .catch((err) => console.warn('[PublicProfilePage] wall fetch failed', uuid, err))
  }, [uuid, authLoading, signedIn])

  // Real follow state from DB
  useEffect(() => {
    if (!uuid) return
    // Pull counts for everyone (public-readable)
    followService.getCounts(uuid)
      .then(c => { setFollowerCount(c.followers); setFollowingCount(c.following) })
      .catch((err) => console.warn('[PublicProfilePage] follow counts fetch failed', uuid, err))
    // Pull "am I following them?" only for logged-in non-self viewers
    if (currentMember && !isOwn) {
      followService.isFollowing(uuid)
        .then(setIsFollowing)
        .catch((err) => console.warn('[PublicProfilePage] isFollowing fetch failed', uuid, err))
    }
  }, [uuid, currentMember, isOwn])

  // Team memberships - resolve member_id from uuid, then read team_members
  // joined to teams. Public-readable per existing RLS on those tables.
  useEffect(() => {
    if (!uuid) return
    let cancelled = false
    ;(async () => {
      try {
        const memberId = await resolveMemberIdFromUuid(uuid)
        if (!memberId || cancelled) return
        const { data: rows } = await supabaseCommunity
          .from('team_members')
          .select('teams(uuid, name, category)')
          .eq('member_id', memberId)
          // Membership is a SOFT remove - teamService.setMembership sets
          // is_active=false rather than deleting the row (so re-adding someone
          // does not collide with the unique constraint). Without this filter a
          // member removed from a team keeps wearing that team's chip on their
          // public profile forever. RLS does not help: team_members SELECT is
          // USING (true).
          .eq('is_active', true)
        if (cancelled) return
        // PostgREST returns the embedded `teams` as an object for a
        // to-one FK, but can return an array depending on how the
        // relationship is inferred. Normalise both shapes to a flat
        // list so we never render `/teams/undefined` from a nested
        // array slipping through `.filter(Boolean)`.
        const teams = ((rows ?? []) as any[])
          .flatMap(r => (Array.isArray(r.teams) ? r.teams : [r.teams]))
          .filter((t) => t && t.uuid)
        setMemberTeams(teams as any[])
      } catch (err) {
        console.warn('[PublicProfilePage] member teams fetch failed', uuid, err)
      }
    })()
    return () => { cancelled = true }
  }, [uuid])

  // "Builders alongside {name}" - teammates from every team this member is on.
  // Resolve member_id → the member's team_ids → the other members on those
  // teams, deduped and capped. Core to the "people over profiles" positioning.
  useEffect(() => {
    if (!uuid) return
    let cancelled = false
    setAlongside([])
    setAlongsideLoading(true)
    ;(async () => {
      try {
        // Shared, deduped resolver: this page and the four services it calls
        // all needed the same uuid -> member_id row, and each fired its own
        // request for it before its real query could start.
        const myId = await resolveMemberIdFromUuid(uuid)
        if (!myId || cancelled) return
        const { data: myTeams } = await supabaseCommunity
          .from('team_members').select('team_id').eq('member_id', myId).eq('is_active', true)
        const teamIds = ((myTeams ?? []) as any[]).map(r => r.team_id).filter(Boolean)
        if (!teamIds.length || cancelled) return
        const { data: mateRows } = await supabaseCommunity
          .from('team_members')
          .select('members(uuid, full_name, avatar_url, role)')
          .in('team_id', teamIds)
          .neq('member_id', myId)
          // Same soft-remove rule: a removed teammate is not a teammate.
          .eq('is_active', true)
        if (cancelled) return
        const seen = new Set<string>()
        const mates = ((mateRows ?? []) as any[])
          .flatMap(r => (Array.isArray(r.members) ? r.members : [r.members]))
          .filter((p) => p && p.uuid && p.uuid !== uuid)
          .filter((p) => { if (seen.has(p.uuid)) return false; seen.add(p.uuid); return true })
          .slice(0, 8)
          .map((p) => ({ uuid: p.uuid, fullName: p.full_name, avatarUrl: p.avatar_url ?? undefined, role: p.role }))
        setAlongside(mates)
      } catch (err) {
        console.warn('[PublicProfilePage] builders-alongside fetch failed', uuid, err)
      } finally {
        if (!cancelled) setAlongsideLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [uuid])

  const handleFollow = async () => {
    if (!currentMember || !uuid || isOwn || followBusy) return
    setFollowBusy(true)
    const next = !isFollowing
    // Optimistic update
    setIsFollowing(next)
    setFollowerCount(c => Math.max(0, c + (next ? 1 : -1)))
    if (next) { setFollowPop(true); setTimeout(() => setFollowPop(false), 300) }
    const who = profile?.fullName ? ` ${profile.fullName}` : ''
    try {
      if (next) await followService.followByUuid(uuid)
      else await followService.unfollowByUuid(uuid)
      toast.success(next ? `Following${who}` : `Unfollowed${who}`)
    } catch (e: any) {
      // Roll back on failure
      setIsFollowing(!next)
      setFollowerCount(c => Math.max(0, c + (next ? -1 : 1)))
      console.error('Follow toggle failed:', e)
      toast.error(next ? 'Could not follow - try again' : 'Could not unfollow - try again', e?.message)
    } finally {
      setFollowBusy(false)
    }
  }

  const loadMore = async () => {
    if (!uuid || !hasMore) return
    const next = page + 1
    try {
      const r = await profileService.getMemberPosts(uuid, { page: next, limit: 20 })
      if (r.success) { setPosts(prev => [...prev, ...r.data]); setHasMore(r.pagination.hasNextPage); setPage(next) }
    } catch {}
  }

  const handleShare = async () => {
    const url = `${window.location.origin}/member/${uuid}`
    try { await navigator.clipboard.writeText(url) } catch {
      const el = document.createElement('input'); el.value = url
      document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el)
    }
    setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000)
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%),1fr))', gap: 16 }} className="sk-group">
            {[1,2,3].map(i => <div key={i} className="v6-skeleton" style={{ height: 260, borderRadius: 'var(--r-inner)' }} />)}
          </div>
        </div>
      </div>
    )
  }

  if (profileError && !profile) {
    return (
      <div className="route-enter aq-wrap" style={{ paddingTop: 'clamp(44px, 8vw, 80px)', paddingBottom: 'clamp(44px, 8vw, 80px)', textAlign: 'center' }}>
        <h1 className="h-display" style={{ fontSize: 40, margin: 0 }}>couldn’t load this profile.</h1>
        <p className="muted" style={{ marginTop: 12 }}>
          The member is probably fine — this is a connection problem on our side.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: 24, display: 'inline-flex' }}
          onClick={() => { setProfileError(false); setIsLoading(true); setProfileReloadKey(k => k + 1) }}
        >
          try again
        </button>
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
        <Link to="/" className="btn btn-primary" style={{ marginTop: 24, display: 'inline-flex' }}>back to home</Link>
      </div>
    )
  }

  // `full_name` is nullable in the DB - coalesce so the `.split()` calls
  // below can't crash the whole page on a member with no name set.
  const displayName = profile.fullName || 'Member'
  const avatarColor = hashColor(displayName)

  return (
    <div className="route-enter">
      {/* Identity card - 04.7. White, never ink: ink is reserved for the
          viewer's own surfaces (04.1), so a visitor can tell at a glance this
          is someone else's account. */}
      <div className="aq-wrap" style={{ paddingTop: isMobile ? 14 : 'clamp(20px,4vw,28px)' }}>
        <div className="pf-identity is-other">
          <div className="pf-id-row">
            <div className="pf-id-top">
              <div className="pf-portrait" style={{ width: isMobile ? 84 : 132, height: isMobile ? 84 : undefined, background: avatarColor }}>
                {profile.avatarUrl
                  ? <Img ctx="avatar" src={profile.avatarUrl} alt={displayName} referrerPolicy="no-referrer" />
                  : <span className="pf-initials" style={{ fontSize: isMobile ? 30 : 44 }}>{getInitials(displayName)}</span>}
              </div>
              <div className="pf-namewrap">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <h1 className="pf-name" style={{ fontSize: 'clamp(40px, 7vw, 72px)', letterSpacing: '-0.045em', lineHeight: 0.92 }}>
                      {displayName}
                    </h1>
                    {isOfficialAccount(displayName) && <VerifiedTick size={19} />}
                  </div>
                  {/* Meta line's construction is illustrative in the mock
                      ("welfare projects · la martiniere · member since 2023"
                      is not read from source) - kept to fields the page
                      already fetches: role, school, join date. */}
                  <div className="pf-eyebrow">
                    {[getRoleLabel(profile.role), profile.schoolName, profile.createdAt ? `member since ${formatDate(profile.createdAt)}` : null]
                      .filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="pf-chips">
                  {/* memberTeams is real, already-fetched data (used by the
                      "about" tab below) - promoted here too so this identity
                      card matches the own-profile one's chip row instead of
                      showing only the school. No new query: same effect,
                      same state, read a second time. */}
                  {!isOwn && memberTeams.some(t => myTeamUuids.has(t.uuid)) && (
                    <span className="mono xs" style={{ width: '100%', fontWeight: 700 }}>
                      you’re both on {memberTeams.filter(t => myTeamUuids.has(t.uuid)).map(t => t.name).join(', ')}
                    </span>
                  )}
                  {memberTeams.map(t => (
                    <Link key={t.uuid} to={`/teams/${t.uuid}`} className="pf-chip">
                      <span className="pf-chip-dot" style={{ background: deptColorForTeamName(t.name) || 'var(--ink-3)' }} aria-hidden="true" />
                      {t.name}
                    </Link>
                  ))}
                  {profile.schoolName && (
                    <Link to="/schools" className="pf-chip">{profile.schoolName}</Link>
                  )}
                  {/* LinkedIn is readable by any signed-in member (column grant) and chosen by the member. Instagram is
                      deliberately not here: that column is closed to other members. */}
                  {signedIn && safeExternalHref(profile.linkedin) && (
                    <a href={safeExternalHref(profile.linkedin)} target="_blank" rel="noopener noreferrer" className="pf-chip">LinkedIn ↗</a>
                  )}
                </div>
              </div>
            </div>
            <div className="pf-id-side">
              <div className="pf-bento-tile" style={{ flex: 1 }}>
                <div className="pf-bento-well" style={{ background: 'color-mix(in srgb, var(--welfare) 22%, transparent)', padding: '12px 13px' }}>
                  <span className="pf-bento-label" style={{ color: 'var(--welfare-ink)' }}>posts</span>
                  <b className="pf-bento-figure" style={{ fontSize: 28 }}>{totalPostCount}</b>
                </div>
              </div>
              <div className="pf-bento-tile" style={{ flex: 1 }}>
                <div className="pf-bento-well" style={{ background: 'color-mix(in srgb, var(--tomato) 22%, transparent)', padding: '12px 13px' }}>
                  {/* Not "likes" - no such figure is fetched anywhere on this
                      page (04.7's own text: "use whatever two figures the page
                      already has and label them literally" - the mock's tomato
                      tile assumed a likes-earned count that only the OWN-profile
                      card computes via getLifetimeLikes; adding it here would be
                      a second fetch this file's rules forbid). `followers` is
                      real and already fetched by followService.getCounts. */}
                  <span className="pf-bento-label" style={{ color: 'var(--tomato-ink)' }}>followers</span>
                  <button type="button" onClick={() => setPeopleList('followers')} aria-label={`See who follows ${displayName}`} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit', textAlign: 'left' }}><b className="pf-bento-figure" style={{ fontSize: 28 }}>{followerCount}</b></button>
                </div>
              </div>
            </div>
          </div>
          {profile.bio && (
            <p className="truncate-2" style={{ fontSize: 15, color: 'var(--ink-2)', maxWidth: 560, margin: 0 }}>{profile.bio}</p>
          )}
          <div className="pf-idbuttons" style={{ justifyContent: 'flex-end' }}>
            {isOwn
              ? <Link to="/profile/edit" className="pf-editbtn" style={{ flex: 'none', padding: '0 18px' }}>edit profile</Link>
              // Logged-out visitors get no CTA here - the full-width banner
              // below (with the person's name + real member count) already
              // makes the same ask with better copy; both visible without
              // scrolling was two competing versions of one message.
              : !currentMember
                ? null
                : <button
                    className="pf-editbtn"
                    onClick={handleFollow}
                    disabled={followBusy}
                    style={{
                      flex: 'none', padding: '0 18px',
                      background: isFollowing ? 'var(--bg-2)' : 'var(--ink)',
                      color: isFollowing ? 'var(--ink-2)' : 'var(--paper)',
                      transition: 'background 0.15s, color 0.15s',
                      transform: followPop ? 'scale(1.06)' : 'scale(1)',
                      opacity: followBusy ? 0.6 : 1,
                      cursor: followBusy ? 'wait' : undefined,
                    }}
                  >
                    {isFollowing ? '✓ following' : '+ follow'}
                  </button>
            }
            <button className="pf-sharebtn" onClick={handleShare} aria-label={linkCopied ? 'Profile link copied' : 'Share profile'} title={linkCopied ? 'Profile link copied' : 'Share profile'}>
              {linkCopied ? '✓' : '↗'}
            </button>
          </div>
        </div>
      </div>

      {/* Join banner for unauthenticated visitors */}
      {!currentMember && (
        <div style={{ background: 'var(--lemon)', color: '#0A0A0A', padding: '14px 0', borderBottom: 'var(--hair-2)' }}>
          <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700 }}>join AquaTerra to interact with {profile.fullName} and {displayCount(ORG_FACTS.membersTotal)} members.</span>
            <div className="row gap-2">
              <Link to="/login" className="btn btn-sm" style={{ background: '#0A0A0A', color: 'var(--lemon)' }} onClick={() => setAuthIntent({ kind: 'apply' })}>Show up with us →</Link>
            </div>
          </div>
        </div>
      )}

      <div className="aq-wrap" style={{ paddingTop: 'clamp(20px,4vw,28px)', paddingBottom: 80 }}>
        <PhotoCollection posts={posts} />
        {/* 22.4's second placement: absent unless a pick exists for THIS
            member for the current calendar month (no stale-month fallback) -
            see MemberOfMonthProfileBadge. `uuid` comes straight from the
            route param, not the `profile` fetch, so it's available on the
            very first render rather than waiting on that request too. */}
        {uuid && (
          <div style={{ marginBottom: 20, maxWidth: 340 }}>
            <MemberOfMonthProfileBadge uuid={uuid} />
          </div>
        )}

        {/* Section 31's TABS block: a 999px bar with one filled ink pill.
            Four mutually exclusive views, inside the block's 3-to-5 range. */}
        <div className="tabs tabs--seg" role="tablist">
          <button role="tab" aria-selected={activeTab === 'posts'} className={'tab ' + (activeTab === 'posts' ? 'active' : '')} onClick={() => setActiveTab('posts')}>
            posts <span className="count">{totalPostCount}</span>
          </button>
          <button role="tab" aria-selected={activeTab === 'tagged'} className={'tab ' + (activeTab === 'tagged' ? 'active' : '')} onClick={() => setActiveTab('tagged')}>
            tagged <span className="count">{taggedTotal}</span>
          </button>
          <button role="tab" aria-selected={activeTab === 'achievements'} className={'tab ' + (activeTab === 'achievements' ? 'active' : '')} onClick={() => setActiveTab('achievements')}>
            achievements <span className="count">{visibleAchievements.length}</span>
          </button>
          <button role="tab" aria-selected={activeTab === 'about'} className={'tab ' + (activeTab === 'about' ? 'active' : '')} onClick={() => setActiveTab('about')}>about</button>
          {/* §16.5: added as a 5th tab rather than reflowing this page's
              existing 4 (posts/tagged/achievements/about existed before 16;
              04.3's "never merge or rename an existing tab" applies here by
              the same logic). isOwn is possible on THIS page too (a member
              can reach /member/:own-uuid), so the same "renders even at
              zero, own profile only" rule from ProfilePage applies. */}
          {/* Signed-in visitors see the tab even on an empty wall: it is where the first note gets written. Before this,
              a wall with no notes had no tab and no composer, so no wall could ever start. */}
          {(isOwn || (wallEnabled && (wallNotes.length > 0 || signedIn))) && (
            <button role="tab" aria-selected={activeTab === 'wall'} className={'tab ' + (activeTab === 'wall' ? 'active' : '')} onClick={() => setActiveTab('wall')}>
              Wall {wallNotes.length > 0 && <span className="count">{wallNotes.length}</span>}
            </button>
          )}
        </div>

        <div style={{ paddingTop: 24 }}>
          {activeTab === 'posts' && (
            isLoadingPosts ? (
              <div style={{ padding: 40, textAlign: 'center' }}><div className="mono xs upper muted">loading...</div></div>
            ) : posts.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))', gap: 18 }}>
                {posts.map((post, i) => <FeedPostCard key={post.postId} post={post} seed={i} savedInitial={feedCardBatch.savedSet.has(post.postId)} linkedOpening={feedCardBatch.openings.get(post.uuid) ?? null} decision={shapeDecisions[i]} />)}
                {hasMore && (
                  <button onClick={loadMore} className="btn" style={{ gridColumn: '1/-1', justifyContent: 'center' }}>load more</button>
                )}
              </div>
            ) : (
              <div className="card">
                <div className="pf-empty-well">
                  <div className="h-display" style={{ fontSize: 28 }}>no posts yet.</div>
                  <p className="muted" style={{ marginTop: 8 }}>{displayName} hasn't posted anything yet.</p>
                  <Link to="/" className="aq-thread-link" style={{ marginTop: 14 }}>
                    see what the community is posting →
                  </Link>
                </div>
              </div>
            )
          )}

          {activeTab === 'tagged' && (
            isLoadingTagged ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-hidden="true">
                {[1, 2, 3].map(i => <div key={i} className="v6-skeleton" style={{ height: 64, borderRadius: 14, animationDelay: `${i * 0.08}s` }} />)}
              </div>
            ) : taggedPosts.length > 0 ? (
              // Compact activity timeline. Each tagged post = one drive
              // / workshop / event the member was part of. Shown as a
              // scannable row (date · category · title · others-tagged)
              // rather than full feed cards so a 30-activity history
              // doesn't make the page scroll forever. Click → /post/uuid.
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {taggedPosts.map((post) => {
                  // First non-empty line of body - most welfare posts open
                  // with the activity name ("Sundarbans relief - phase 3").
                  // Fallback to linkTitle, then a generic label.
                  const firstLine = (post.body || '')
                    .split('\n')
                    .map(s => s.trim())
                    .find(Boolean)
                  const title = firstLine
                    ? (firstLine.length > 110 ? firstLine.slice(0, 107) + '…' : firstLine)
                    : ((post as any).linkTitle || 'Activity')
                  const otherTagged = (post.taggedMembers || []).filter(t => t.uuid !== uuid)
                  const dateLabel = (() => {
                    try {
                      const d = new Date(post.createdAt)
                      return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                    } catch { return '' }
                  })()
                  return (
                    <Link
                      key={post.postId}
                      to={`/post/${post.uuid}`}
                      className="card"
                      style={{
                        textDecoration: 'none',
                        color: 'inherit',
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      {/* Meta row: date · category */}
                      <div className="row gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                        <span
                          className="mono xs"
                          style={{
                            fontWeight: 700,
                            color: 'var(--ink-3)',
                            fontVariantNumeric: 'tabular-nums',
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                          }}
                        >
                          {dateLabel}
                        </span>
                        {post.category && (
                          <span className={'chip cat-' + post.category} style={{ fontSize: 10 }}>
                            {post.category}
                          </span>
                        )}
                      </div>
                      {/* Title */}
                      <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 16, lineHeight: 1.3, color: 'var(--ink)' }}>
                        {title}
                      </div>
                      {/* Other-tagged count + author */}
                      <div className="row gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="mono xs muted">
                          logged by {post.authorName}
                        </span>
                        {otherTagged.length > 0 && (
                          <>
                            <span className="mono xs" style={{ opacity: 0.3 }}>·</span>
                            <span className="mono xs muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              with {otherTagged.length} other{otherTagged.length !== 1 ? 's' : ''}
                            </span>
                          </>
                        )}
                      </div>
                    </Link>
                  )
                })}
                {taggedHasMore && (
                  <button
                    onClick={async () => {
                      if (!uuid) return
                      const next = taggedPage + 1
                      const r = await profileService.getTaggedPosts(uuid, { page: next, limit: 20 })
                      if (r.success) {
                        setTaggedPosts(prev => [...prev, ...r.data])
                        setTaggedHasMore(r.pagination.hasNextPage)
                        setTaggedPage(next)
                      }
                    }}
                    className="btn"
                    style={{ alignSelf: 'center', marginTop: 8 }}
                  >
                    load more
                  </button>
                )}
              </div>
            ) : (
              <div className="card">
                <div className="pf-empty-well">
                  <div className="h-display" style={{ fontSize: 28 }}>no activities yet.</div>
                  <p className="muted" style={{ marginTop: 8 }}>{displayName} hasn't been tagged in any drives, events, or workshops yet.</p>
                  {signedIn && !isOwn && wallEnabled && (
                    <button type="button" className="aq-thread-link" style={{ marginTop: 10, background: 'none', border: 0, padding: 0, cursor: 'pointer', minHeight: 44 }} onClick={() => setActiveTab('wall')}>leave {displayName.split(' ')[0]} a note →</button>
                  )}
                  {isOwn && <Link to="/projects" className="aq-thread-link" style={{ display: 'inline-block', marginTop: 10 }}>find a drive to join →</Link>}
                </div>
              </div>
            )
          )}

          {activeTab === 'achievements' && (
            visibleAchievements.length > 0 ? (
              <div className="stag" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: 14 }}>
                {/* 04.0 bug 2: this card used to carry a per-index rotation
                    (`rotate(${i % 2 ? 1 : -1.2}deg)`) plus hover handlers that
                    straightened it - an achievement is a claim about what
                    someone did, with a verification state attached, i.e. data,
                    and only chrome may rotate. Both the inline transform and
                    the hover handlers are deleted, not just reset to 0deg. */}
                {visibleAchievements.map((a) => (
                  <div key={a.uuid} className="card">
                    <div className="row gap-3" style={{ alignItems: 'flex-start' }}>
                      <div style={{ width: 44, height: 44, borderRadius: 'var(--r-tight)', background: 'var(--lemon)', display: 'grid', placeItems: 'center', fontSize: 22, flexShrink: 0 }}>
                        {a.achievementType === 'leadership' ? '🏆' : a.achievementType === 'academic' ? '📚' : a.achievementType === 'competition' ? '🥇' : '★'}
                      </div>
                      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                        <div className="row gap-2" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                          <div style={{ flex: '1 1 auto', minWidth: 0, fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{a.title}</div>
                          {/* Two states, never a third: the verification pill
                              (04.4) replaces the old rotated `.pf-stamp` ink
                              stamp. Non-approved rows only ever reach this
                              branch on the owner's own /member/ URL, per the
                              filter above. */}
                          {a.status === 'approved'
                            ? <span className="pf-verified">verified</span>
                            : <span className="pf-awaiting"><span className="pf-awaiting-dot" aria-hidden="true" />awaiting verification</span>}
                        </div>
                        {a.description && <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 0 8px' }}>{a.description}</p>}
                        <div className="row gap-2 flex-wrap">
                          <span className="chip">{a.achievementType?.replace('_', ' ')}</span>
                          <span className="mono xs muted">{new Date(a.achievementDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                          {a.proofUrl && <a href={safeExternalHref(a.proofUrl)} target="_blank" rel="noopener noreferrer" className="mono xs" style={{ color: 'var(--welfare-ink)' }}>view proof →</a>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card">
                <div className="pf-empty-well">
                  <div className="h-display" style={{ fontSize: 28 }}>no achievements yet.</div>
                  {signedIn && !isOwn && wallEnabled && (
                    <button type="button" className="aq-thread-link" style={{ marginTop: 10, background: 'none', border: 0, padding: 0, cursor: 'pointer', minHeight: 44 }} onClick={() => setActiveTab('wall')}>leave {displayName.split(' ')[0]} a note →</button>
                  )}
                </div>
              </div>
            )
          )}

          {activeTab === 'about' && (
            <div className="card" style={{ padding: 28, maxWidth: 680 }}>
              <div className="serif" style={{ fontSize: 40, lineHeight: 1, marginBottom: 16 }}>about.</div>
              <p style={{ fontSize: 16, lineHeight: 1.65 }}>{profile.bio || `${profile.fullName} hasn't added a bio yet.`}</p>
              <div style={{ borderTop: 'var(--hair-2)', margin: '20px 0', paddingTop: 16 }}>
                <div className="row" style={{ gap: 20, flexWrap: 'wrap' }}>
                  {profile.schoolName && <div><span className="mono xs upper muted">school</span><div style={{ fontWeight: 700 }}>{profile.schoolName}</div></div>}
                  {profile.createdAt && <div><span className="mono xs upper muted">joined</span><div style={{ fontWeight: 700 }}>{formatDate(profile.createdAt)}</div></div>}
                  <div><span className="mono xs upper muted">role</span><div style={{ fontWeight: 700 }}>{profile.role}</div></div>
                  {/* `following` moved here from the old hero stat row - the
                      identity card's hero tiles are now capped at two (04.7),
                      and dropping this figure entirely would delete real,
                      already-fetched data rather than just restyle it. */}
                  <div><span className="mono xs upper muted">following</span><div style={{ fontWeight: 700 }}><button type="button" onClick={() => setPeopleList('following')} aria-label={`See who ${displayName} follows`} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3 }}>{followingCount}</button></div></div>
                </div>
              </div>
              {memberTeams.length > 0 && (
                <div style={{ borderTop: 'var(--hair-2)', marginTop: 16, paddingTop: 16 }}>
                  <span className="mono xs upper muted">teams</span>
                  <div className="row gap-2 flex-wrap pf-teams" style={{ marginTop: 8 }}>
                    {memberTeams.map(t => (
                      <Link
                        key={t.uuid}
                        to={`/teams/${t.uuid}`}
                        className="chip"
                        style={{ textDecoration: 'none' }}
                      >
                        {t.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {activeTab === 'wall' && (
            <WallTab
              recipientUuid={uuid!}
              recipientName={displayName}
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

        {peopleList && uuid && (
          <PeopleListModal
            title={peopleList === 'followers' ? 'Followers' : 'Following'}
            viewerUuid={currentMember?.uuid}
            load={() => (peopleList === 'followers' ? followService.getFollowers(uuid) : followService.getFollowing(uuid))}
            onClose={() => setPeopleList(null)}
          />
        )}

        {/* ── Builders alongside - shared-team peers ── */}
        {(alongsideLoading || alongside.length > 0) && (
          <div style={{ marginTop: 44 }}>
            <div className="mono xs upper muted" style={{ fontWeight: 700, marginBottom: 16 }}>
              ★ builders alongside {profile.fullName}
            </div>
            {alongsideLoading ? (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="v6-skeleton" style={{ width: 168, height: 60, borderRadius: 14, animationDelay: `${i * 0.06}s` }} />
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {alongside.map(p => (
                  <Link
                    key={p.uuid}
                    to={currentMember?.uuid === p.uuid ? `/profile/${p.uuid}` : `/member/${p.uuid}`}
                    className="card"
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px 10px 10px', textDecoration: 'none' }}
                  >
                    <div className="avatar" style={{ background: hashColor(p.fullName || p.uuid), width: 40, height: 40, fontSize: 13, flexShrink: 0, overflow: 'hidden' }}>
                      {p.avatarUrl
                        ? <Img ctx="avatar" src={p.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                        : getInitials(p.fullName || 'U')}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 14, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{p.fullName}</div>
                      {p.role && <div className="mono xs muted">{getRoleLabel(p.role)}</div>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
