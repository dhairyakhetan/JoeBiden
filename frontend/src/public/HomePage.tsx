import QuickApply from '../components/QuickApply'
import Portal from '../components/Portal'
import Img from '../components/Img'
import '../styles/routes/home.css'
import '../styles/routes/feed.css'
import { useState, useEffect, useCallback, useMemo, useRef, Suspense, lazy, memo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
// Lazy-loading the compose modal (it pulls framer-motion, mounted only after
// first open) keeps motion off the home page's critical path.
const CreatePostModal = lazy(() => import('../feed/CreatePostModal'))
import { feedService, type FeedTab } from '../services/feedService'
import profileService from '../services/profileService'
import teamService from '../services/teamService'
import { Post } from '../services/api'
import { setAuthIntent } from '../lib/authIntent'
import { SAMPLE_POSTS, applySampleLikes, sampleToPost } from '../data/samplePosts'
import { I } from '../components/v6Shared'
import { hasLeaderAccess } from '../lib/roles'
import { jobOpenings, CAT_COLORS as JOB_CAT_COLORS } from '../lib/jobOpenings'
import { getCached, setCached } from '../lib/swrCache'
import { readFeedSnapshot, writeFeedSnapshot } from '../lib/feedSnapshot'
import OpeningsStrip from '../components/OpeningsStrip'
import EmptyState from '../components/EmptyState'
import StaleBanner from '../components/StaleBanner'
import { useStaleAfterIdle } from '../lib/staleAfterIdle'
import { isRateLimited, retryAfterSeconds, rateLimitMessage, retryLabel } from '../lib/rateLimit'
import { useMeta } from '../hooks/useMeta'
import { pageMetadata } from '../lib/metaConfig'
import SharedFeedPostCard from '../feed/FeedPostCard'
import { useFeedCardBatch } from '../hooks/useFeedCardBatch'
import { composeFeed } from '../feed/cards/feedCompose'
import FeedCard from '../feed/cards/FeedCard'
import { SHAPED_SHAPES, feedItemFromPost, isGroupable } from '../feed/feedItemFromPost'
import useDialog from '../hooks/useDialog'
import { getInitials, hashColor } from '../lib/uiHelpers'
// Section 14 / 34: the ink greeting block. AdaptiveGrid renders the block, the
// greeting AND the grid together, which is why there is no separate grid
// surface on this page - mounting it any other way is the thing section 34's
// first non-negotiable forbids. Imported, never modified.
import AdaptiveGrid from '../components/AdaptiveGrid'
import { chooseGridRecipe, type GridContext, type GridRecipeId } from '../lib/gridRecipes'
import { APPROVAL_TIME } from '../lib/orgFacts'
import certificateService from '../services/certificateService'
import { Mascot } from '../components/Mascot'
import { FeedBurst } from '../components/BurstReveal'
import InterestChip from '../components/InterestChip'
import ProfileNudgeCard from '../components/ProfileNudgeCard'

// ─── Constants ────────────────────────────────────────────────────────────────

// Each vertical gets exactly one hue, matching the --c-* category tokens in
// v6.css (--c-welfare/--c-events/--c-labs/--c-ops/--c-content) - the same
// tokens the .cat-* chip classes render with on every feed card. Keep these
// in lockstep with v6.css so the rail tiles and the card chips agree.

// Trimmed to the single "All" reset tile (was six: All + the five verticals)
// per the redesign follow-up - "All" already covers "show everything", so the
// five per-category tiles were extra chrome with no functional loss on
// removal. Deep links (`?category=welfare` etc., e.g. from
// /everything-we-do) still work: `filter` state and `handleFilterClick` are
// unchanged, this only trims what's clickable from this card. `.cat-all`
// already spans both columns of `.rail-cat-grid` as a full-width bar (see
// home.css), so a single-entry array renders correctly with no grid changes.
const CATS = [
  { k: '', l: 'All', icon: <I.sparkles />, color: 'var(--welfare)' },
]


// ─── Section 14 · the hi block's own copy ─────────────────────────────────────
//
// The greeting row is the only part of the block this file owns; every tile
// below it comes from lib/gridRecipes.ts. Rules being honoured here:
//   · no exclamation marks (section 14, "greeting" row of the spec table)
//   · no em dashes anywhere in user-facing copy (project rule)
//   · NeutralFace is caps-only, so the greeting is uppercased at the source
//     rather than with text-transform, which would do nothing on a face that
//     has no lowercase glyphs to transform.
//   · the line states ONE fact, and it is the fact the chosen recipe answers,
//     which is why it is keyed on the recipe id rather than written once.
function timeOfDayWord(d: Date): string {
  const h = d.getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

// Disabled pending further development - hide the smart-grid greeting/
// AdaptiveGrid block until it's improved (owner request, 2026-09-12). Flip
// back to `true` once it's ready; the component and its data are untouched.
const SMART_GRID_ENABLED = false

const HI_LINES: Record<string, string> = {
  G12: 'You are down for a drive this week. Everything else can wait.',
  G04: 'Nothing on your list right now. Here is the next one going out.',
  // G19 read "You have not been on a drive yet. Here is what is running."
  // COUNTED, 2026-09-05, against the live table rather than assumed:
  // `drive_attendance` holds ZERO rows. Digital check-in went live on
  // 2026-08-31 and every drive before it was taken on paper, so a driveCount
  // of 0 means "no digital record exists", not "has never been on a drive" -
  // and G19's predicate reads `(attendedCount ?? 0) === 0`, which cannot tell
  // the two apart. The old line asserted the member's history from an empty
  // table. The recipe's job is to say what is available, so the line says only
  // that now, and claims nothing about the person reading it.
  G19: 'Here is everything running right now. Pick whatever fits your week.',
  G01: 'You are new here. Start with the handbook, then pick a drive.',
  G27: 'There are rows waiting on your desk.',
  G33: 'Your break is on. Nudges are off, and nothing here is asking.',
  // Added 2026-09-07 with the three recipes the logic pass introduced.
  // G21/G09 are member-facing (own submissions; unread trail), G30 is the
  // leader's resolved-empty desk - which only ever renders when queueDepth
  // came back as a real 0, never when a queue read failed. "Your desk is
  // clear" on an unresolved read would be the worst claim this block makes.
  // Two sentences each, deliberately: AdaptiveGrid's splitSay() breaks on the
  // first '. ' so the payload takes Eina 700 and the tail takes the italic
  // serif accent. A one-sentence line renders entirely at payload weight,
  // which is correct but flatter - these three read better split.
  G21: 'Something of yours is still being read. Nothing else needs you today.',
  G09: 'You left a few things half-open. Pick up wherever you like.',
  G30: 'Your desk is clear. Here is the rest of what is going on.',
  G38: 'Everything AquaTerra is doing, in one place.',
}

type NoticeItem = {
  id: string
  title: string      // custom title set by director (stored as pinned_title in DB)
  postUuid: string   // uuid of the actual feed post
  postBody: string   // cached body snippet
  authorName: string // cached author
  category: string   // cached category for accent
  pinnedAt: string   // when pinned
}

// Load from DB - posts with pinned = true. The notice board renders in both
// the mobile and desktop rails, so share one in-flight fetch per page view
// instead of issuing the same query twice.
let noticesInFlight: Promise<NoticeItem[]> | null = null
function loadNoticesFromDB(): Promise<NoticeItem[]> {
  if (!noticesInFlight) {
    noticesInFlight = fetchNoticesFresh()
    // Next explicit load (e.g. after editing pins) refetches.
    noticesInFlight.finally(() => { setTimeout(() => { noticesInFlight = null }, 5000) })
  }
  return noticesInFlight
}
async function fetchNoticesFresh(): Promise<NoticeItem[]> {
  try {
    const result = await feedService.getPinnedPosts()
    if (!result.success) return []
    return result.data.map((p: any) => ({
      id: p.uuid,
      title: p.pinnedTitle || p.body.slice(0, 70).trimEnd(),
      postUuid: p.uuid,
      postBody: p.body.slice(0, 100),
      authorName: p.authorName,
      category: p.category,
      pinnedAt: p.createdAt,
    }))
  } catch { return [] }
}

// Save to DB - diff old vs new and call pinPost accordingly.
// Best-effort + per-item guarded: pinPost now throws on a silently-
// blocked write (0 rows), so each call is wrapped so one failure can't
// abort the whole diff or surface as an unhandled rejection out of the
// onSave handler. Failures are logged; the notice board is non-critical.
async function saveNoticesToDB(prevItems: NoticeItem[], nextItems: NoticeItem[]) {
  const prevUuids = new Set(prevItems.map(i => i.postUuid))
  const nextUuids = new Set(nextItems.map(i => i.postUuid))
  const safePin = async (uuid: string, pinned: boolean, title?: string) => {
    try { await feedService.pinPost(uuid, pinned, title) }
    catch (e: any) { console.warn('[notice board] pin sync failed', uuid, e?.message) }
  }

  // Pin new additions
  for (const item of nextItems) {
    if (!prevUuids.has(item.postUuid)) {
      await safePin(item.postUuid, true, item.title)
    } else {
      // Title may have changed
      const prev = prevItems.find(p => p.postUuid === item.postUuid)
      if (prev && prev.title !== item.title) {
        await safePin(item.postUuid, true, item.title)
      }
    }
  }
  // Unpin removals
  for (const item of prevItems) {
    if (!nextUuids.has(item.postUuid)) {
      await safePin(item.postUuid, false)
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// This file used to define its own local, hand-written FeedPostCard (~600
// lines) alongside importing the real shared feed/FeedPostCard.tsx - the
// local copy was used only for the sample-post fallback below (shown when a
// visitor's feed is empty or a fetch fails), which made it the
// least-exercised, easiest-to-drift code path while being exactly what a
// brand-new visitor is most likely to see. It has been removed; the sample
// fallback now renders through MemoSharedFeedPostCard like every other post,
// via the sampleToPost() adapter in data/samplePosts.ts.
const MemoSharedFeedPostCard = memo(SharedFeedPostCard)

// 22.5's backfill divider, factored out only so the `.map()` above can stay
// a single returned element per post (a fragment can't carry the `key` AND
// wrap a conditional sibling any other way without one).
function FragmentWithDivider({ showDivider, label = '★ trending this month', flush = false, children }: {
  showDivider: boolean; label?: string; flush?: boolean; children: React.ReactNode
}) {
  return (
    <>
      {showDivider && (
        <div
          role="separator"
          className="mono xs upper muted"
          // `flush` drops the rule + top padding for a heading that sits at the
          // very top of the list (the pinned block), where a border above
          // nothing reads as a stray line.
          style={flush
            ? { fontWeight: 700, margin: '0 0 14px' }
            : { fontWeight: 700, margin: '20px 0 14px', paddingTop: 20, borderTop: '2px solid var(--line)' }}
        >
          {label}
        </div>
      )}
      {children}
    </>
  )
}

// ─── Left rail ────────────────────────────────────────────────────────────────

function LeftRail({ member, filter, setFilter, postCount, userPostCount, userLikeCount, userTeamCount }: {
  member: any; filter: string; setFilter: (f: string) => void; postCount: number; userPostCount: number | null
  userLikeCount: number | null; userTeamCount: number | null
}) {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const initials = getInitials(member?.full_name || 'U')
  const avatarColor = hashColor(member?.full_name || member?.uuid || '')

  return (
    <aside className="home-left">
      {member ? (
        <div className="rail-card rail-id" style={{ background: 'var(--ink)', borderColor: 'var(--ink)' }}>
          {/* Compact horizontal profile row */}
          {/* Section 17: the whole row is the button (it always was), now with a
              44px floor and a springy press so it reads as one. */}
          <button
            className="rail-id-row"
            onClick={() => navigate(`/profile/${member.uuid}`)}
          >
            <div className="avatar" style={{ background: avatarColor, overflow: 'hidden', flexShrink: 0, width: 52, height: 52, fontSize: 18 }}>
              {member.avatar_url
                ? <Img ctx="avatar" src={member.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                : initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="rail-id-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.full_name || 'you'}</div>
              <div className="mono xs" style={{ marginTop: 1, color: 'rgba(244,239,224,0.55)' }}>@{member.uuid?.slice(0, 8) || 'member'}</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 1, color: 'rgba(244,239,224,0.55)', flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          {/* Stats row */}
          <div className="rail-id-stats">
            {/* likes and teams were hardcoded '-' — not a loading state, a
                permanent placeholder that could never resolve. Two thirds of
                your own profile card read as broken. Both numbers already
                existed (profileService.getLifetimeLikes, teamService
                .getTeamsForMember — the same ones /profile/me renders). */}
            <div><b>{userPostCount ?? '–'}</b><span>posts</span></div>
            <div className="is-hero"><b>{userLikeCount ?? '–'}</b><span>likes</span></div>
            <div><b>{userTeamCount ?? '–'}</b><span>teams</span></div>
          </div>
        </div>
      ) : (
        <div className="rail-card rail-join" style={{
          background: 'var(--ink)',
          border: 'none',
          color: 'var(--paper)',
          position: 'relative',
        }}>
          <span className="sticker" style={{
            alignSelf: 'flex-start', transform: 'rotate(-2.5deg)',
            background: 'var(--lemon)', color: 'var(--ink)',
            fontWeight: 800, fontSize: 10, padding: '4px 10px',
            borderRadius: 999, letterSpacing: '0.06em',
            border: 'var(--hair-2)', boxShadow: 'var(--lift-1)',
          }}>★ kolkata, 2021</span>
          <div className="h-display" style={{ fontSize: 26, lineHeight: 1.05, marginTop: 10, color: '#ffffff' }}>
            {/* accent-lint-ok: `.rail-join` sets background: var(--ink) two elements up, so the ground is #0A0A0A, not cream - the checker assumes a light ground it cannot resolve. Measured on #0A0A0A: --welfare 4.55:1 (passes for this 26px display word), --welfare-ink only 3.20:1. The "fix" measures worse. */}
            join the <span style={{ fontStyle: 'italic', fontFamily: 'var(--serif)', color: 'var(--welfare)', fontWeight: 400 }}>chaos</span>.
          </div>
          <p style={{ fontSize: 13, margin: '8px 0 14px', color: 'rgba(244,239,224,0.66)', lineHeight: 1.5 }}>
            Usually replies {APPROVAL_TIME}. free forever.
          </p>
          <div className="row gap-2">
            <Link to="/login" className="btn btn-sm btn-primary" onClick={() => setAuthIntent({ kind: 'apply' })}>Join the work →</Link>
          </div>
        </div>
      )}

      {/* Category nav - visual tile grid */}
      <div className="rail-card rail-cats">
        <div className="rail-h">
          {/* Section 17's "pick one" die-cut, the one sticker on this surface,
              inline beside the label exactly as AQ Home Cleanup draws it.
              The other two the section lists are not rendered: "4 applied"
              would be a figure with no source (no applicant count is fetched
              here) and "first drive ✱" belongs to a lead photo the live feed
              has no column for. Rule 4: never render a figure with no source. */}
          <span className="rail-cats-h">
            <span className="mono xs upper" style={{ fontWeight: 700 }}>browse</span>
            <span className="rail-cats-sticker" aria-hidden="true">pick one</span>
          </span>
          <span className="mono xs muted">{postCount} posts</span>
        </div>
        <div className="rail-cat-grid">
          {CATS.map(c => {
            const isActive = filter === c.k
            return (
              <button
                key={c.k}
                className={'rail-cat-tile cat-' + (c.k || 'all') + (isActive ? ' is-hero' : '')}
                onClick={() => setFilter(c.k)}
                style={{ ['--cc' as any]: c.color }}
              >
                <span className="rail-cat-tile-icon">{c.icon}</span>
                <span className="rail-cat-tile-label">{c.l}</span>
                {c.k === '' && <span className="mono rail-cat-count">{postCount}</span>}
              </button>
            )
          })}
        </div>

        {/* ── QUICK LINKS ── merged into the same card as "browse" (was a
            second, separately-styled rail-card in the right rail - two
            different-looking tile grids stacked across the page read as an
            inconsistency, not two intentional sections). Same hairline/gap
            recipe feed.css's `.feed-card-foot` uses for "new block below,
            divided by a rule" (border-top + margin/padding), so the card
            reads as one shell with two tile groups rather than two shells.
            `.rail-quicklink` was already built on the same recipe as
            `.rail-cat-tile` (color-mix tint, --r-inner, an is-hero tile that
            goes full-ink) - home.css now sizes both grids identically so the
            merge is a single visual system, not a matching coat of paint. */}
        <div style={{ borderTop: 'var(--hair)', marginTop: 12, paddingTop: 10 }}>
          {/* Four plain tiles, a clean 2x2 in `.rail-quicklink-grid` (2
              columns, see home.css) - no `is-wide`/`is-hero` tile anymore
              now that About (the old hero, with the ink stamp + founding
              date) and Open Roles are gone from this list. */}
          <div className="rail-quicklink-grid">
            {RAIL_QUICK_LINKS.map(l => {
              const Icon = l.icon
              return (
                <Link key={l.to} to={l.to} className="rail-quicklink" style={{ ['--qc' as any]: l.c, ['--qc-ink' as any]: l.ink }}>
                  <Icon />
                  {l.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {member && (
        <button
          className="rail-logout-btn"
          onClick={() => { logout(); navigate('/') }}
          style={{ marginTop: 4 }}
        >
          log out →
        </button>
      )}
    </aside>
  )
}

// ─── Right rail ───────────────────────────────────────────────────────────────

// Same five hues as the --c-* tokens in v6.css (one accent per vertical) -
// used as plain hex here (not var()) because callers append alpha, e.g.
// `accent + '22'`, which var() can't do.
const CAT_COLORS_NB: Record<string, string> = {
  events: 'var(--sky)', welfare: 'var(--welfare)', labs: 'var(--lemon)', operations: 'var(--teal)', content: 'var(--grape)',
}
// The *-ink partner for each category hue - raw hues fail 4.5:1 as glyph
// colour on a light/tinted ground (same note as the browse tiles' --cc-ink,
// 01.5/01.8). operations uses --ops directly: it already clears AA.
const CAT_INK: Record<string, string> = {
  events: 'var(--sky-ink)', welfare: 'var(--welfare-ink)', labs: 'var(--lemon-ink)', operations: 'var(--ops)', content: 'var(--grape-ink)',
}

// Compact rail quick-links (replaces the old trending rail). Trimmed to four
// entries - was six (Projects/Teams/Blog/Members/Open Roles/About) until the
// redesign follow-up dropped About (redundant with the global nav) and Open
// Roles (has its own dedicated /opportunities entry point via the "open
// roles" rail card and OpeningsStrip above the fold) - same order, same hues
// for the four that remain.
//
// `icon`: three of `I`'s 25 keys have no folder/people glyph (01.19's "three
// glyphs I does not have"). Adding them needs sign-off on a shared component,
// so this uses 01.19's fallback (a) - nearest existing key - until then:
// Projects -> I.globe, Teams -> I.wave, Members -> I.hash. Blog is 01.19's
// direct mapping (I.pen).
//
// No `wide`/`hero` tile anymore: with About gone there is no hero, and
// Projects's old `wide: true` (a lone full-width row above a 3+1 remainder)
// is dropped too so the four entries lay out as a clean 2x2 in
// `.rail-quicklink-grid` instead of leaving Members stranded alone on its
// own row.
const RAIL_QUICK_LINKS: { to: string; label: string; c: string; ink: string; icon: () => React.ReactElement }[] = [
  { to: '/projects', label: 'Projects', c: 'var(--welfare)', ink: 'var(--welfare-ink)', icon: I.globe },
  { to: '/teams', label: 'Teams', c: 'var(--sky)', ink: 'var(--sky-ink)', icon: I.wave },
  { to: '/blog', label: 'Blog', c: 'var(--grape)', ink: 'var(--grape-ink)', icon: I.pen },
  { to: '/members', label: 'Members', c: 'var(--lemon)', ink: 'var(--lemon-ink)', icon: I.hash },
]

function NoticeBoardEditModal({ notices, onSave, onClose }: {
  notices: NoticeItem[]
  onSave: (items: NoticeItem[]) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<NoticeItem[]>(notices.map(n => ({ ...n })))
  const [searchQ, setSearchQ] = useState('')
  const [addingTitle, setAddingTitle] = useState<{ post: any; title: string } | null>(null)
  // The candidate pool doesn't depend on the search text (getFeed always returns
  // the same page-1/limit-8 set) - fetch it once when the modal opens instead of
  // re-running the whole feed pipeline (count + likes + documents) per keystroke,
  // then filter the cached pool locally. Same results, one request instead of N.
  const [searchPool, setSearchPool] = useState<any[] | null>(null)
  useEffect(() => {
    let cancelled = false
    // Deliberately doesn't touch `searching` - that indicator is reserved for
    // "computing your search", not this modal-open prefetch, so there's no
    // new "…" flash before the user has typed anything.
    feedService.getFeed({ page: 1, limit: 8 })
      .then(result => { if (!cancelled) setSearchPool(result.success ? result.data : []) })
      .catch(() => { if (!cancelled) setSearchPool([]) })
    return () => { cancelled = true }
  }, [])

  const inputSt: React.CSSProperties = {
    width: '100%', padding: '8px 10px', background: 'var(--bg-2)',
    border: 'var(--hair-3)', borderRadius: 22, color: 'var(--ink)',
    /* 16px to suppress iOS Safari focus-zoom */
    fontFamily: 'var(--eina)', fontSize: 16, outline: 'none', boxSizing: 'border-box',
  }

  const handleSearch = (q: string) => {
    setSearchQ(q)
  }

  // Pure derivation from searchQ/searchPool, not effect+state - the pool
  // fetched once on modal-open (see the effect above) never depended on `q`,
  // so filtering it is synchronous and needs no extra render pass.
  const searching = searchQ.trim().length >= 2 && !searchPool
  const searchResults = useMemo(() => {
    const q = searchQ.trim().toLowerCase()
    if (q.length < 2 || !searchPool) return []
    return searchPool
      .filter((p: any) => p.body?.toLowerCase().includes(q) || p.authorName?.toLowerCase().includes(q))
      .slice(0, 5)
  }, [searchQ, searchPool])

  const pickPost = (post: any) => {
    setAddingTitle({ post, title: post.body?.slice(0, 60) || '' })
    setSearchQ('')
  }

  const panelRef = useDialog(true, onClose)

  const confirmAdd = () => {
    if (!addingTitle || !addingTitle.title.trim()) return
    const item: NoticeItem = {
      id: Date.now().toString(),
      title: addingTitle.title.trim(),
      postUuid: addingTitle.post.uuid,
      postBody: addingTitle.post.body?.slice(0, 100) || '',
      authorName: addingTitle.post.authorName || '',
      category: addingTitle.post.category || 'welfare',
      pinnedAt: new Date().toISOString(),
    }
    setDraft(prev => [...prev, item])
    setAddingTitle(null)
  }

  return (
    <Portal>
<div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Edit notice board" tabIndex={-1} onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'var(--card)', borderRadius: 32, overflow: 'hidden', border: 'var(--hair-2)', boxShadow: 'var(--lift-4)', maxHeight: '88dvh', display: 'flex', flexDirection: 'column', outline: 'none' }}>

        {/* Header */}
        <div style={{ background: 'var(--welfare)', padding: '16px 20px', color: 'var(--ink)', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 18 }}>edit notice board</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, marginTop: 2, opacity: 0.7 }}>pin up to 3 posts - visible to all members</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Current pinned posts */}
          {draft.length === 0 ? (
            <div style={{ padding: '12px 0', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', textAlign: 'center' }}>
              no posts pinned yet - search below to add one.
            </div>
          ) : (
            draft.map((item, idx) => {
              const accent = CAT_COLORS_NB[item.category] || 'var(--welfare)'
              return (
                <div key={item.id} style={{ border: 'none', borderRadius: 22, overflow: 'hidden', background: 'var(--bg)' }}>
                  {/* Accent bar */}
                  <div style={{ height: 4, background: accent }} />
                  <div style={{ padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: accent, flexShrink: 0, marginTop: 1 }}>{idx + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <input
                        style={{ ...inputSt, padding: '6px 8px', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 13 }}
                        value={item.title}
                        onChange={e => setDraft(prev => prev.map(n => n.id === item.id ? { ...n, title: e.target.value } : n))}
                        placeholder="Custom title…"
                        maxLength={80}
                      />
                      <div style={{ fontFamily: 'var(--eina)', fontSize: 11, color: 'var(--ink-3)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.postBody.slice(0, 70)}{item.postBody.length > 70 ? '…' : ''}
                      </div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>
                        by {item.authorName} · <span style={{ color: accent }}>{item.category}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setDraft(prev => prev.filter(n => n.id !== item.id))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 16, lineHeight: 1, padding: '4px 6px', borderRadius: 6, transition: 'color 0.12s', minWidth: 32, minHeight: 32 }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-3)')}
                    >×</button>
                  </div>
                </div>
              )
            })
          )}

          {/* Add a post - search */}
          {draft.length < 3 && !addingTitle && (
            <div style={{ borderTop: draft.length > 0 ? '1px dashed var(--line-2)' : 'none', paddingTop: draft.length > 0 ? 12 : 0 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 8 }}>
                search posts to pin
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  style={inputSt}
                  value={searchQ}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder="search by keyword or author…"
                />
                {searching && (
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>…</span>
                )}
              </div>
              {searchResults.length > 0 && (
                <div style={{ marginTop: 6, border: 'none', borderRadius: 22, overflow: 'hidden', background: 'var(--bg)' }}>
                  {searchResults.map((p: any) => {
                    const ac = CAT_COLORS_NB[p.category] || 'var(--welfare)'
                    const alreadyPinned = draft.some(d => d.postUuid === p.uuid)
                    return (
                      <button
                        key={p.uuid}
                        disabled={alreadyPinned}
                        onClick={() => pickPost(p)}
                        style={{
                          width: '100%', textAlign: 'left', display: 'flex', gap: 10, padding: '10px 12px',
                          background: alreadyPinned ? 'var(--bg-3)' : 'transparent',
                          border: 'none', borderBottom: '1px solid var(--line)',
                          cursor: alreadyPinned ? 'not-allowed' : 'pointer', opacity: alreadyPinned ? 0.5 : 1,
                          transition: 'background 0.12s',
                        }}
                        onMouseEnter={e => { if (!alreadyPinned) (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        <span style={{ width: 3, background: ac, borderRadius: 2, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 12, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.body?.slice(0, 60)}{(p.body?.length || 0) > 60 ? '…' : ''}
                          </div>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>
                            {p.authorName} · <span style={{ color: ac }}>{p.category}</span>
                            {alreadyPinned && ' · already pinned'}
                          </div>
                        </div>
                        {!alreadyPinned && <span style={{ color: 'var(--welfare-ink)', fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, flexShrink: 0, alignSelf: 'center' }}>pin +</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Title entry after picking post */}
          {addingTitle && (
            <div style={{ border: '2px solid var(--welfare)', borderRadius: 14, padding: 14, background: 'color-mix(in srgb, var(--welfare) 8%, transparent)' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--welfare-ink)', marginBottom: 8 }}>set a title for this notice</div>
              <div style={{ fontFamily: 'var(--eina)', fontSize: 12, color: 'var(--ink-3)', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                → {addingTitle.post.body?.slice(0, 70)}
              </div>
              <input
                style={{ ...inputSt, marginBottom: 10 }}
                value={addingTitle.title}
                onChange={e => setAddingTitle(prev => prev ? { ...prev, title: e.target.value } : null)}
                placeholder="e.g. Sundarbans relief recap"
                maxLength={80}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') confirmAdd() }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm btn-primary" onClick={confirmAdd} disabled={!addingTitle.title.trim()} style={{ background: 'var(--welfare)', borderColor: 'var(--welfare)', color: 'var(--ink)' }}>add to board ✓</button>
                <button className="btn btn-sm btn-ghost" onClick={() => setAddingTitle(null)}>cancel</button>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--line)', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} className="btn btn-sm btn-ghost">cancel</button>
          <button onClick={() => { onSave(draft); onClose() }} className="btn btn-sm btn-primary">save board</button>
        </div>
      </div>
    </div>
</Portal>
  )
}

// MEMBER OF THE MONTH HOME-PAGE RAIL REMOVED 2026-09-14 (owner request): a
// MoM pick now auto-posts to the feed itself (director/MemberOfMonth.tsx's
// handleSave), so this standalone card duplicated an announcement that
// already shows up as a real post. Removed entirely, both the desktop rail
// mount and the tablet/phone centre-column mount - see RightRail and the
// feed-list section below for the removal notes at each former call site.
// MomLemonCard itself is unchanged and still used elsewhere (the winner's
// own profile, teams/detail/AboutTab.tsx).

// 7 days, in ms - the closing-soon sticker's window (01.8).
const CLOSING_SOON_MS = 7 * 24 * 60 * 60 * 1000

function RightRail({ isDirector = false }: { isDirector?: boolean }) {
  const [railOpenRoles, setRailOpenRoles] = useState<any[]>([])
  // The rail only ever shows 3, but the header wants the true live count -
  // jobOpenings.getOpen() already returns the full array before the slice
  // below, so capture its length rather than issue a second query (01.8).
  const [railOpenRolesTotal, setRailOpenRolesTotal] = useState<number | null>(null)
  const [rolesLoading, setRolesLoading] = useState(true)
  const [notices, setNotices] = useState<NoticeItem[]>([])
  const [noticesLoading, setNoticesLoading] = useState(true)
  const [editingNotices, setEditingNotices] = useState(false)
  // Which pin is the hero card. Touch-swipeable on mobile (already the only
  // way to move between pins); the arrows below are the desktop equivalent -
  // pointer:fine visitors have no swipe gesture and were stuck on pin 1.
  const [pinIdx, setPinIdx] = useState(0)
  const noticeTouchX = useRef<number | null>(null)

  useEffect(() => {
    jobOpenings.getOpen()
      .then(roles => { setRailOpenRolesTotal(roles.length); setRailOpenRoles(roles.slice(0, 3)) })
      .catch(() => setRailOpenRoles([]))
      .finally(() => setRolesLoading(false))
    loadNoticesFromDB()
      .then(setNotices)
      .catch(() => setNotices([]))
      .finally(() => setNoticesLoading(false))
  }, [])

  // Wraps in both directions so "prev" from pin 1 reaches the last pin.
  const activeNoticeIdx = notices.length ? ((pinIdx % notices.length) + notices.length) % notices.length : 0
  const goToNotice = (i: number) => setPinIdx(i)
  const handleNoticeTouchStart = (e: React.TouchEvent) => { noticeTouchX.current = e.touches[0].clientX }
  const handleNoticeTouchEnd = (e: React.TouchEvent) => {
    if (noticeTouchX.current === null || notices.length < 2) return
    const dx = e.changedTouches[0].clientX - noticeTouchX.current
    noticeTouchX.current = null
    // Below this, it reads as a tap/scroll rather than an intentional swipe.
    if (Math.abs(dx) < 40) return
    goToNotice(activeNoticeIdx + (dx < 0 ? 1 : -1))
  }

  return (
    <aside className="home-right">

      {/* ── NOTICE BOARD ── the first pin is a hero card; any further pins peek
          out from under it as a stack (01.7). `taped` (a scrapbook tape strip)
          is dropped - it belonged to the removed decorative doodle layer and
          had no other caller. */}
      <div className="rail-card">
        <div className="rail-h">
          <span className="rail-card-title">
            {/* Section 17's cast table: Tuk dozes on the notice board, because
                nothing pinned there is urgent. Decorative, so no `label`. */}
            <Mascot character="tuk" pose="sleep" size={26} />
            notice board
          </span>
          {isDirector && (
            <button
              className="rail-h-link"
              onClick={() => setEditingNotices(true)}
            >
              edit →
            </button>
          )}
        </div>
        {noticesLoading ? (
          <div aria-hidden>
            <div className="v6-skeleton" style={{ height: 46, borderRadius: 22 }} />
          </div>
        ) : notices.length === 0 ? (
          <div className="rail-empty">
            {isDirector ? 'nothing pinned yet - click edit to add posts.' : 'nothing posted yet.'}
          </div>
        ) : (
          <div
            className="rail-notice-deck"
            onTouchStart={handleNoticeTouchStart}
            onTouchEnd={handleNoticeTouchEnd}
          >
            {/* Rotated so the active pin (arrows/swipe move this) is always
                the hero at the front of the stack, the rest peeking behind it
                in their normal order - same "deck" look as before, just able
                to bring a different pin to the front now. */}
            {[...notices.slice(activeNoticeIdx), ...notices.slice(0, activeNoticeIdx)].map((item, idx) => {
              const accent = CAT_COLORS_NB[item.category] || 'var(--welfare)'
              return idx === 0 ? (
                <Link key={item.id} to={`/post/${item.postUuid}`} className="rail-notice-hero" style={{ ['--cc' as any]: accent }}>
                  <span className="rail-notice-eyebrow">pin {activeNoticeIdx + 1} of {notices.length} · {item.category}</span>
                  <div className="rail-notice-title">{item.title}</div>
                  <div className="rail-notice-meta">by {item.authorName}</div>
                </Link>
              ) : (
                <Link key={item.id} to={`/post/${item.postUuid}`} className="rail-notice-stub" style={{ ['--cc' as any]: accent }} aria-label={item.title} />
              )
            })}
            {notices.length > 1 && (
              <>
                {/* Desktop-only (hover:hover + pointer:fine, same gate as
                    .arch-hover in projects.css): the deck already has a
                    working touch swipe, but a mouse/trackpad visitor has no
                    equivalent gesture and was stuck on pin 1 forever. */}
                <button
                  type="button"
                  className="rail-notice-arrow rail-notice-arrow-prev"
                  onClick={() => goToNotice(activeNoticeIdx - 1)}
                  aria-label="Previous pinned notice"
                  title="Previous pinned notice"
                >‹</button>
                <button
                  type="button"
                  className="rail-notice-arrow rail-notice-arrow-next"
                  onClick={() => goToNotice(activeNoticeIdx + 1)}
                  aria-label="Next pinned notice"
                  title="Next pinned notice"
                >›</button>
              </>
            )}
            <div className="rail-notice-dots" aria-hidden="true">
              {notices.map((_, idx) => <span key={idx} className={idx === activeNoticeIdx ? 'is-active' : undefined} />)}
            </div>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editingNotices && (
        <NoticeBoardEditModal
          notices={notices}
          onSave={async items => {
            await saveNoticesToDB(notices, items)
            setNotices(items)
          }}
          onClose={() => setEditingNotices(false)}
        />
      )}

      {/* MEMBER OF THE MONTH RAIL REMOVED 2026-09-14 (owner request): now that
          a MoM pick auto-posts to the feed itself (director/MemberOfMonth.tsx's
          handleSave, added earlier this session), a standalone grid section
          repeating the same announcement here was redundant - the win already
          shows up as a real post. Open roles now sits directly under the
          notice board instead of below this section. */}

      {/* ── OPEN ROLES ── the first opening is a hero card; the rest are
          tinted rows with a round "go" affordance (01.8). */}
      <div className="rail-card">
        <div className="rail-h">
          <span className="rail-card-title">open roles</span>
          <span className="row" style={{ alignItems: 'center', gap: 12 }}>
            {/* Only rendered once the true count has actually landed - never a
                figure with no source, and never a 0 while still loading. */}
            {railOpenRolesTotal != null && <span className="mono xs muted">{railOpenRolesTotal} live</span>}
            <Link to="/opportunities" className="linktab rail-h-link">all</Link>
          </span>
        </div>
        {rolesLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-hidden>
            {[0, 1, 2].map(i => <div key={i} className="v6-skeleton" style={{ height: 42, borderRadius: 22 }} />)}
          </div>
        ) : railOpenRoles.length === 0 ? (
          <div style={{ padding: '16px 0', textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
            no openings right now
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {railOpenRoles.map((op, idx) => {
              const accent = JOB_CAT_COLORS[op.category] || 'var(--welfare)'
              const accentInk = CAT_INK[op.category] || 'var(--welfare-ink)'
              // Deadline field is real (JobOpening.deadline, jobOpenings.ts) -
              // the sticker shows only on the hero, and only inside a 7-day
              // window, per 01.8.
              const deadlineMs = op.deadline ? new Date(op.deadline).getTime() : NaN
              const closingSoon = idx === 0 && Number.isFinite(deadlineMs) && deadlineMs > Date.now() && deadlineMs - Date.now() <= CLOSING_SOON_MS
              return idx === 0 ? (
                <div key={op.id} className="rail-role is-hero" style={{ ['--rc' as any]: accent, ['--rc-ink' as any]: accentInk }}>
                  {closingSoon && (
                    <span className="sticker rail-role-sticker">
                      closes {new Date(deadlineMs).toLocaleDateString('en-GB', { weekday: 'short' }).toLowerCase()}
                    </span>
                  )}
                  <div className="rail-role-body">
                    <Link to={`/opportunities/${op.id}`} className="rail-role-link"><div className="rail-role-title">{op.title}</div></Link>
                    <div className="rail-role-meta">
                      <span style={{ fontWeight: 700 }}>{op.category}</span>{op.teamName ? ` · ${op.teamName}` : ''}
                    </div>
                  </div>
                  <QuickApply op={op} className="quick-apply-rail" />
                </div>
              ) : (
                <div key={op.id} className="rail-role" style={{ ['--rc' as any]: accent, ['--rc-ink' as any]: accentInk }}>
                  <span className="rail-role-dot" style={{ background: accent }} />
                  <div className="rail-role-body">
                    <Link to={`/opportunities/${op.id}`} className="rail-role-link"><div className="rail-role-title">{op.title}</div></Link>
                    <div className="rail-role-meta">
                      <span style={{ fontWeight: 700 }}>{op.category}</span>{op.teamName ? ` · ${op.teamName}` : ''}
                    </div>
                  </div>
                  <QuickApply op={op} className="quick-apply-rail" />
                </div>
              )
            })}
          </div>
        )}
        <Link to="/opportunities" className="rail-card-cta">
          view all openings →
        </Link>
      </div>

      {/* QUICK LINKS moved into the left rail's "browse" card (merged with the
          category grid into one consistent tile system - both were two
          separately-styled rail-cards before). See LeftRail above. */}

      {/* footer */}
      <div className="rail-foot mono xs muted">
        <span>aquaterra · open access</span>
        <span>· v7 ·</span>
        <span>made with care</span>
      </div>

    </aside>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  useMeta(pageMetadata.home)
  const { isAuthenticated, member } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  // Seed the category filter from ?category= (e.g. the department links on
  // /everything-we-do, which used to point at the retired /feed page).
  const [searchParams] = useSearchParams()
  const [filter, setFilter] = useState(() => searchParams.get('category') || '')
  // changelog/22-social-engine.md §22.5 shipped three feed tabs ("for you" /
  // "latest" / "my teams"). REMOVED 2026-09-14, owner request: the "for you"
  // and "my teams" tabs were slow and not worth keeping - the home feed is
  // always newest-first now, with no tab switcher at all. `sort` stays a
  // constant (not state) so every downstream consumer below (cache keys,
  // the getFeed call, the meta line) needs no further change.
  const sort: FeedTab = 'latest'
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  // Mount the lazy compose modal only once the user first opens it.
  const [createMounted, setCreateMounted] = useState(false)
  useEffect(() => { if (showCreateModal) setCreateMounted(true) }, [showCreateModal])
  const [totalFeedPosts, setTotalFeedPosts] = useState(0)
  const [userPostCount, setUserPostCount] = useState<number | null>(null)
  const [userLikeCount, setUserLikeCount] = useState<number | null>(null)
  const [userTeamCount, setUserTeamCount] = useState<number | null>(null)
  // Section 14: hours + drive count for the hi block. certificateService
  // .getHoursSummary is an EXISTING read (HoursAndCertificateCard already
  // calls it); nothing new is queried and no endpoint is added. It is what
  // makes attendedCount resolvable, which is what keeps a member on a break
  // out of G19 ("find something to do") - see the note on gridCtx below.
  // `null` while in flight, then either the summary or `false` if the call
  // failed. The distinction matters: the recipe must resolve ONCE, not pick
  // G19 ("you have not been on a drive yet") on the first paint and then flip
  // to G04 when the count lands a moment later.
  const [hoursSummary, setHoursSummary] = useState<{ totalHours: number; driveCount: number } | false | null>(null)
  const [feedError, setFeedError] = useState<string | null>(null)
  // §11.1 state 7. A rate limit is temporary and self-resolving, so it is NOT
  // the generic "couldn't load" state: the sentence has to say so, and the
  // retry has to wait out any stated cooldown rather than hammering the same
  // limit. `feedRetryIn` is a countdown in seconds, or null when the error did
  // not state one (the common case - see lib/rateLimit.ts on why Retry-After
  // is unreadable through supabase-js).
  const [feedRateLimited, setFeedRateLimited] = useState(false)
  const [feedRetryIn, setFeedRetryIn] = useState<number | null>(null)
  const [usingSamplePreview, setUsingSamplePreview] = useState(false)

  const isActive = isAuthenticated && member?.status === 'active'
  const [interestShowing, setInterestShowing] = useState(false)

  // Per-tab SWR cache for the page-1 feed so returning to home paints the last
  // posts INSTANTLY (no spinner) while we revalidate in the background. Keyed by
  // member + category + feed tab; cleared when the tab closes (sessionStorage).
  const feedKey = useCallback((cat: string, tab: FeedTab) => `aq_feed_v2_${member?.uuid || 'anon'}_${cat || 'all'}_${tab}`, [member?.uuid])

  const fetchPosts = useCallback(async (pageNum: number, cat: string, append = false) => {
    const firstPage = !append && pageNum === 1
    let hadCache = false
    if (firstPage) {
      const cached = getCached<{ data: any[]; total: number; hasMore: boolean }>(feedKey(cat, sort))
        ?? readFeedSnapshot<{ data: any[]; total: number; hasMore: boolean }>(member?.uuid, cat, sort)
      if (cached?.data?.length) {
        hadCache = true
        setPosts(cached.data); setHasMore(cached.hasMore); setTotalFeedPosts(cached.total)
        setFeedError(null); setUsingSamplePreview(false)
        // revalidate silently - no spinner over the cached list
      } else {
        setLoading(true); setFeedError(null); setUsingSamplePreview(false)
      }
    } else if (append) setIsLoadingMore(true)
    else { setLoading(true); setFeedError(null); setUsingSamplePreview(false) }
    try {
      const result = await feedService.getFeed({ page: pageNum, limit: 20, category: cat || undefined, tab: sort })
      if (append) setPosts(prev => [...prev, ...result.data])
      else {
        setPosts(result.data)
        if (pageNum === 1) {
          const snap = { data: result.data, total: result.pagination.totalItems, hasMore: result.pagination.hasNextPage }
          setCached(feedKey(cat, sort), snap)
          writeFeedSnapshot(member?.uuid, cat, sort, snap)
        }
      }
      setHasMore(result.pagination.hasNextPage)
      if (!append) setTotalFeedPosts(result.pagination.totalItems)
    } catch (e: any) {
      // Active members get real errors, not a fake feed - but never blank a
      // working cached view on a transient revalidation failure.
      if (!append && !hadCache) {
        setPosts([])
        setHasMore(false)
        setTotalFeedPosts(0)
        // §11.1 state 7 before state 3: a recognisable rate limit gets its own
        // sentence and a cooldown; everything unrecognised falls through to
        // the ordinary error, unchanged.
        if (isRateLimited(e)) {
          const secs = retryAfterSeconds(e)
          setFeedRateLimited(true)
          setFeedRetryIn(secs)
          setFeedError(rateLimitMessage(secs))
        } else {
          setFeedRateLimited(false)
          setFeedRetryIn(null)
          // Never surface the raw error string here - it can be a Supabase/
          // GoTrue internal message (e.g. a multi-tab auth-lock contention
          // error: 'Lock "lock:sb-...-auth-token" was released because
          // another request stole it') that means nothing to a member and
          // reads like the app is broken. Log it for diagnosis, show one
          // generic, always-true sentence with the existing retry action.
          if (e) console.error('feed load failed', e)
          setFeedError('Could not load the feed. Pull to refresh.')
        }
      }
    } finally {
      setLoading(false); setIsLoadingMore(false)
    }
  }, [feedKey, sort, member?.uuid])

  const fetchPublicPosts = useCallback(async () => {
    // Same cache-then-revalidate treatment members get: paint the last-seen
    // guest feed instantly, refresh silently underneath. Guests have no tab
    // concept (getFeed is called below with no `tab` at all, unchanged) -
    // 'latest' here is just a fixed, arbitrary cache-key segment.
    const cached = getCached<{ data: any[]; total: number }>(feedKey('guest', 'latest'))
      ?? readFeedSnapshot<{ data: any[]; total: number }>(undefined, 'guest', 'latest')
    const hadCache = !!cached?.data?.length
    if (hadCache) {
      setPosts(cached!.data); setTotalFeedPosts(cached!.total)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setFeedError(null)
    setUsingSamplePreview(false)
    try {
      const result = await feedService.getFeed({ page: 1, limit: 10 })
      if (result.data.length > 0) {
        setPosts(result.data)
        setTotalFeedPosts(result.pagination.totalItems)
        // Guests paginate too. This used to be left at its `true` default with
        // no way to advance, so a logged-out visitor got exactly 10 posts and a
        // dead end — the infinite scroll only ever ran for signed-in members.
        setHasMore(result.pagination.hasNextPage)
        setCached(feedKey('guest', 'latest'), { data: result.data, total: result.pagination.totalItems })
        writeFeedSnapshot(undefined, 'guest', 'latest', { data: result.data, total: result.pagination.totalItems })
      } else {
        // Guest landing has nothing real to show - fall back to a labelled
        // sample preview so the page isn't blank. Only on empty success,
        // never on error.
        setPosts(applySampleLikes(SAMPLE_POSTS).map(sampleToPost))
        setUsingSamplePreview(true)
        setHasMore(false)
      }
    } catch (e: any) {
      // Never blank a working cached view on a transient revalidation failure.
      if (!hadCache) {
        setPosts([])
        if (isRateLimited(e)) {
          const secs = retryAfterSeconds(e)
          setFeedRateLimited(true)
          setFeedRetryIn(secs)
          setFeedError(rateLimitMessage(secs))
        } else {
          setFeedRateLimited(false)
          setFeedRetryIn(null)
          // See the member-feed catch above - never render the raw error text.
          if (e) console.error('guest feed load failed', e)
          setFeedError('Could not load the feed.')
        }
      }
    }
    setLoading(false)
  }, [feedKey])

  // The cooldown countdown for §11.1 state 7. It is a display timer, not a
  // poll: it only ticks while a rate-limit error is on screen WITH a stated
  // wait, it never fetches anything, and it stops itself at zero.
  useEffect(() => {
    if (!feedRateLimited || feedRetryIn === null || feedRetryIn <= 0) return
    const id = setTimeout(() => setFeedRetryIn(n => (n === null ? null : Math.max(0, n - 1))), 1000)
    return () => clearTimeout(id)
  }, [feedRateLimited, feedRetryIn])

  const reloadFeed = useCallback(() => {
    setFeedRateLimited(false)
    setFeedRetryIn(null)
    if (isActive) fetchPosts(1, filter)
    else fetchPublicPosts()
  }, [isActive, filter, fetchPosts, fetchPublicPosts])

  // §11.1 state 8 — staleness after a long idle. The prompt is SUPPRESSED
  // while the composer is open (`enabled`), because §11 forbids anything
  // pulling content out from under a member mid-task and an open modal is
  // exactly that; the flag survives, it just waits. See lib/staleAfterIdle.ts
  // for why this prompts rather than silently refetching.
  const { stale, markFresh, dismiss: dismissStale } = useStaleAfterIdle({ enabled: !showCreateModal })

  useEffect(() => {
    if (isActive) fetchPosts(1, filter)
    else fetchPublicPosts()
    // Every completed load resets the staleness clock - including the ones
    // triggered by a filter or tab change, which are as good as a refresh.
    markFresh()
  }, [isActive, filter, fetchPosts, fetchPublicPosts, markFresh])

  const handleStaleRefresh = useCallback(() => {
    reloadFeed()
    markFresh()
  }, [reloadFeed, markFresh])

  // Fetch the logged-in user's own rail stats (separate from the feed total).
  // All three fire together and each settles independently, so one slow call
  // can't hold the other two on a dash.
  useEffect(() => {
    if (!isActive || !member?.uuid) return
    profileService.getMemberPosts(member.uuid, { page: 1, limit: 1 })
      .then(r => { if (r.success) setUserPostCount(r.pagination.totalItems) })
      .catch(() => {})
    profileService.getLifetimeLikes(member.uuid)
      .then(n => setUserLikeCount(n))
      .catch(() => {})
    teamService.getTeamsForMember(member.uuid)
      .then(r => { if (r.success) setUserTeamCount(r.data.teams.length) })
      .catch(() => {})
    if (typeof member.member_id === 'number') {
      certificateService.getHoursSummary(member.member_id)
        .then(s => setHoursSummary({ totalHours: s.totalHours, driveCount: s.driveCount }))
        // `false` on failure: settled, but with nothing to report. The fields
        // stay undefined, which is what makes the hi block fall back to a
        // dashed live marker rather than a zero. A zero is a claim.
        .catch(() => setHoursSummary(false))
    } else {
      // No member_id, so the call can never be made. Settled with nothing,
      // rather than pending forever.
      setHoursSummary(false)
    }
  }, [isActive, member?.uuid, member?.member_id])

  const handleFilterClick = (k: string) => {
    setPage(1); setFilter(k)
  }

  const handlePostCreated = () => { setPage(1); if (isActive) fetchPosts(1, filter) }

  // ── Infinite scroll ──
  // The sentinel IS the "load more" button rather than an empty div above it:
  // if IntersectionObserver never fires (older browser, the element never
  // paints, JS-disabled edge cases) the control is still there and still
  // works, and keyboard/screen-reader users get a real focusable affordance
  // instead of a list that only extends on scroll.

  const loadMore = useCallback(() => {
    // `loading` guards the first-page fetch: without it, a filter change (which
    // re-renders with the old list still on screen and the sentinel in view)
    // would fire page 2 against the OLD category while page 1 of the new one is
    // still in flight, and append mismatched posts.
    if (isLoadingMore || loading || !hasMore || usingSamplePreview) return
    const p = page + 1
    setPage(p)
    fetchPosts(p, filter, true)
  }, [isLoadingMore, loading, hasMore, usingSamplePreview, page, filter, fetchPosts])

  // Found live: this used to be a plain `useRef` + a `[loadMore, hasMore,
  // usingSamplePreview]`-keyed effect that called `new IntersectionObserver`
  // itself. `loadMore`'s own identity changes on every `isLoadingMore`
  // true->false flip (it's in that callback's own deps), which re-ran the
  // effect, tore down the observer and created a fresh one - and
  // `observe()` reports the CURRENT intersection state immediately, so if
  // the sentinel was still inside the (deliberately generous, 600px)
  // rootMargin - true almost every time on a short page or a tall screen -
  // the brand-new observer fired again right away with no further
  // scrolling, cascading through every remaining page back-to-back. Same
  // bug class already found and fixed once in MemberDirectory.tsx.
  //
  // Fixed the way PublicProjectsPage.tsx's own sentinel already does it
  // correctly: a stable ref that always holds the LATEST `loadMore` closure
  // (plain assignment on every render - a ref write, not a state write, so
  // it never itself triggers a re-render) plus a callback ref on the
  // sentinel div. The observer is created exactly once per real DOM-node
  // mount/unmount (which happens only when hasMore/usingSamplePreview
  // actually change and React mounts or removes the div) and is never torn
  // down and recreated just because a page finished loading.
  const loadMoreFnRef = useRef(loadMore)
  loadMoreFnRef.current = loadMore

  const loadMoreObserverRef = useRef<IntersectionObserver | null>(null)
  const loadMoreSentinelRef = useCallback((node: HTMLDivElement | null) => {
    loadMoreObserverRef.current?.disconnect()
    loadMoreObserverRef.current = null
    if (!node) return
    // 600px of rootMargin so the next page starts loading roughly a card-and-a-
    // half before the reader reaches the bottom — the fetch is usually done by
    // the time they get there, so the feed reads as continuous rather than
    // stopping to spin.
    loadMoreObserverRef.current = new IntersectionObserver(
      entries => { if (entries[0]?.isIntersecting) loadMoreFnRef.current() },
      { rootMargin: '600px 0px' },
    )
    loadMoreObserverRef.current.observe(node)
  }, [])

  // Stable identity so MemoSharedFeedPostCard isn't busted on every HomePage render.
  const handleCardLike = useCallback(() => { if (isActive) fetchPosts(1, filter) }, [isActive, filter, fetchPosts])

  // Ranking now happens server-side per tab (feedService.getFeed's `tab`
  // param, §22.5) - `posts` already IS the right set for whichever of
  // for-you/latest/my-teams is selected. This is a defensive re-filter by
  // category on top of that (usually a no-op, since the fetch already
  // passed the same category), kept only to avoid a flash of the previous
  // filter's posts during the gap between a filter click and its fetch
  // landing. The old client-side "trending" re-sort is gone - it was dead
  // even before the tabs existed, since no control had set `sort` to
  // 'trending' since the sort bar shipped with a single 'latest' button.
  const displayed = useMemo(() => {
    const list = [...posts]
    return filter ? list.filter(p => p.category === filter) : list
  }, [posts, filter])

  // ── SECTION 10 step 5/6 · the shape pass ───────────────────────────────────
  //
  // Resolved ONCE for the whole list, in a useMemo, and never in a render
  // body: `chooseCardShape` mutates its session (that is what the hero cap,
  // the ask throttle and the per-author collapse are made of), so calling it
  // during render would consume the caps again on every re-render and twice
  // per render under StrictMode. `feedShape.ts`'s own doc comment says so.
  //
  // `composeFeed` runs the same chooser in list order and then collapses the
  // adjacent same-author runs rule 05.7 demoted - with one host policy passed
  // in: only rows that lose nothing by collapsing may group (see
  // `isGroupable`). A row with a photo, a stat pill or a like count stays its
  // own card and is re-shaped to whatever its content actually is.
  //
  // The output is consumed as three lookups rather than as a list, so the
  // pinned hoist and the two bracketing headings below keep operating on
  // `displayed` exactly as they did. Composition changes how many cards the
  // rows occupy; it never changes which rows are on the page or in what order.
  const { shapeByUuid, groupLeadByUuid, swallowedUuids } = useMemo(() => {
    const items = displayed.map(p => feedItemFromPost(p, ''))
    const groupableById = new Map(displayed.map((p, i) => [items[i].id, isGroupable(p)]))
    const composed = composeFeed(items, undefined, {
      groupable: it => groupableById.get(it.id) ?? false,
    })
    // Variety is `composeFeed`'s own last step now (see its `varyRuns` note):
    // it rotates repeated designs onto the next shape a row can support, and
    // it does so over the COMPOSED cards, which is exactly this list. This
    // memo used to run that rule a second time here because composition
    // re-shapes rows and the pre-composition pass was therefore operating on a
    // list the renderer never reads - fixed at the source instead.
    const shapeByUuid = new Map<string, ReturnType<typeof composeFeed>[number]['decision']>()
    const groupLeadByUuid = new Map<string, ReturnType<typeof composeFeed>[number]>()
    const swallowedUuids = new Set<string>()
    for (let ci = 0; ci < composed.length; ci++) {
      const card = composed[ci]
      if (card.size > 1 && card.members) {
        groupLeadByUuid.set(card.members[0].id, card)
        card.members.slice(1).forEach(m => swallowedUuids.add(m.id))
      } else {
        shapeByUuid.set(card.item.id, card.decision)
      }
    }
    return { shapeByUuid, groupLeadByUuid, swallowedUuids }
  }, [displayed])

  // Batched saved-state + linked-opening for the shared FeedPostCard - see
  // MemoSharedFeedPostCard above. Empty input (rather than batching against
  // the sample fallback's fake ids) when usingSamplePreview - those posts
  // are passed savedInitial={false}/linkedOpening={null} directly below
  // instead, so the card never self-fetches against a non-existent row.
  const { savedSet, openings } = useFeedCardBatch(usingSamplePreview ? [] : displayed)

  const avatarColor = hashColor(member?.full_name || member?.uuid || '')
  const memberInitials = getInitials(member?.full_name || 'U')

  // ── Section 14 / 34: the adaptive hi block ────────────────────────────────
  //
  // Everything the recipes read is assembled HERE, from data this page already
  // has, which is what section 34 step 1's "no new endpoint" means. A field
  // left `undefined` is not a gap to be tidied with a zero: it is what makes
  // the dashed live marker reachable.
  //
  // NOT RESOLVED, deliberately, and each one costs a recipe:
  //   · upcomingSignup  no service exposes the member's own accepted signups
  //                     for a drive still ahead, so G12 cannot fire and the
  //                     live strip has no source (see the note at its mount).
  //   · queueDepth      no service sums a director's waiting rows, so G27
  //                     cannot fire.
  //   · nextOpenDrive   REMOVED 2026-09-11 (item 7.3), after briefly being
  //                     wired. The sequence matters: this page originally
  //                     rendered a tile headed "the next drive" over a field
  //                     nothing ever filled, so it was wired to
  //                     calendarService.getNextUpcomingDrive - which returned
  //                     null, correctly, because zero of 558 drives are
  //                     future-dated. Asked how an upcoming drive would ever
  //                     be created, the owner said the feature will not be
  //                     used for now. So the fetch is gone and G04's tile is
  //                     unconditionally the archive: one query fewer per home
  //                     load, and no surface that can never fill.
  //   · points          the welfare points system was RETIRED on 2026-09-04
  //                     (decision 12; PointsLedgerCard and its file are gone
  //                     from the profile). It stays undefined so no figure is
  //                     claimed. FIXED (changelog/22-social-engine.md §22.7):
  //                     `lib/gridRecipes.pointsTile` is gone - the five
  //                     recipes that rendered it now render `profileTile`
  //                     ("your profile", no figure, so nothing is claimed)
  //                     at the same span instead. This comment previously
  //                     described that as a still-open defect; it had
  //                     already been fixed in gridRecipes.ts by the time this
  //                     note was corrected, which is exactly the kind of
  //                     drift a stale comment causes - verify the live file,
  //                     not this paragraph.
  //   · labsCount / openRolesCount  fetched inside RightRail, not here.
  // Adding any of them is a data question, not a design one.
  const gridCtx = useMemo<GridContext>(() => {
    const approved = member?.approved_at ? new Date(member.approved_at).getTime() : NaN
    // G19's predicate reads `(attendedCount ?? 0) === 0`, so an unresolved
    // count is indistinguishable from a real zero to it. Holding the age back
    // until the one async call has SETTLED is what stops a five-year member
    // being told they have never been on a drive for the first 300ms.
    const settled = hoursSummary !== null
    const summary = hoursSummary || null

    // THE BREAK GUARD. G33 is last in the walk and section 34 puts it there on
    // purpose, so that a member on a break who ALSO signed up for a drive sees
    // the drive: they chose it. That ordering has a side effect the section did
    // not intend once `upcomingSignup` is unresolvable, because G04, G19 and
    // G01 all sit ABOVE G33 and all three match on facts a member on a break
    // still has. The result is that the break recipe never renders and the
    // block nudges the one person every one of the four documents says must
    // not be nudged.
    //
    // The half of that this file owns is the CONTEXT, not the order: for a
    // member on an active break with nothing they have signed up for, the page
    // hands the block the break and withholds the three fields the recipes
    // above G33 match on. G33's own predicate reading is reproduced here, so
    // if that rule ever changes this reads false rather than drifting quietly.
    // The other fix is to move G33 above G04 in lib/gridRecipes.ts, which is
    // not this file's to make.
    const breakEndMs = member?.break_end ? new Date(member.break_end).getTime() : NaN
    const onBreak = !!member?.break_start && Number.isFinite(breakEndMs) && breakEndMs > Date.now()
    // `upcomingSignup` is undefined today, so this currently reads as
    // `onBreak`. It is written the long way so that the day a signup becomes
    // resolvable, the drive they chose still wins, exactly as section 34 says.
    const quiet = onBreak /* && !upcomingSignup, which is always undefined here */

    return {
      signedIn: !!isActive,
      firstName: member?.full_name?.trim().split(/\s+/)[0],
      daysSinceApproved: !quiet && settled && Number.isFinite(approved)
        ? Math.floor((Date.now() - approved) / 86400000)
        : undefined,
      // lib/roles, never a hand-rolled role === 'hod' || role === 'director'.
      isDirector: hasLeaderAccess(member?.role),
      breakStart: member?.break_start ?? null,
      breakEnd: member?.break_end ?? null,
      attendedCount: quiet ? undefined : summary?.driveCount,
      hours: quiet ? undefined : summary?.totalHours,
      teamsCount: userTeamCount ?? undefined,
    }
  }, [isActive, member, hoursSummary, userTeamCount])

  // The block's own copy. `chooseGridRecipe` is pure and holds no session
  // state (unlike the feed-card chooser), so calling it here against `gridCtx`
  // and again inside AdaptiveGrid against `gridCtx` PLUS its own enrichment
  // (queueDepth, ownPending, unreadCount, savedCount - none of which this
  // host ever has) used to be assumed incapable of disagreeing. They can, and
  // by design do once enrichment resolves: G27/G30/G21/G09 can only ever be
  // reached from the enriched context, so this memo alone could never select
  // them even though HI_LINES below carries copy for all four. `recipeId`
  // here is therefore only the pre-enrichment GUESS - the initial paint, and
  // the fallback until AdaptiveGrid's `onRecipeChange` reports the id it is
  // actually rendering (see `liveRecipeId` below, and the effect that resets
  // it whenever `gridCtx` moves out from under it, e.g. on sign-out).
  const hi = useMemo(() => {
    const now = new Date()
    const first = gridCtx.firstName
    const recipe = chooseGridRecipe(gridCtx)
    return {
      recipeId: recipe.id,
      eyebrow: `${now.toLocaleDateString('en-GB', { weekday: 'long' }).toLowerCase()} ${timeOfDayWord(now)}`,
      // Caps at the source: NeutralFace has no lowercase glyphs, so
      // text-transform would have nothing to transform.
      greeting: first ? `${timeOfDayWord(now)}, ${first}.`.toUpperCase() : 'HI THERE.',
    }
  }, [gridCtx])

  // AdaptiveGrid's own answer, once it has one. Reset to `undefined` whenever
  // `gridCtx` changes identity so a stale id from a previous member/session
  // can never survive into this one - `hi.recipeId` covers the gap until the
  // fresh `onRecipeChange` call lands. The mascot's pose AND the greeting
  // line below both key off this, never off `hi.recipeId` alone, so neither
  // can show a state the grid itself has already moved on from.
  const [liveRecipeId, setLiveRecipeId] = useState<GridRecipeId | undefined>(undefined)
  useEffect(() => { setLiveRecipeId(undefined) }, [gridCtx])
  const effectiveRecipeId = liveRecipeId ?? hi.recipeId
  const hiLine = useMemo(() => HI_LINES[effectiveRecipeId] ?? HI_LINES.G38, [effectiveRecipeId])

  return (
    <div className="route-enter">
      <OpeningsStrip />
      <div className="home-shell">
        {/* LEFT RAIL */}
        <LeftRail
          member={isActive ? member : null}
          filter={filter}
          setFilter={handleFilterClick}
          postCount={totalFeedPosts}
          userPostCount={userPostCount}
          userLikeCount={userLikeCount}
          userTeamCount={userTeamCount}
        />

        {/* CENTER FEED — a <div>, not a <main>. PublicLayout already renders the
            page's one and only <main id="main-content"> (the skip link's target);
            a second one nested inside it is invalid HTML and leaves assistive tech
            with two competing "main" landmarks. */}
        <div className="home-center">
          {/* sr-only h1: states what the site is (see the longer note by the
              "the feed." h2 further down). Rendered unconditionally, first in
              home-center, so it precedes every h2 on this page regardless of
              auth state. .sr-only is position:absolute, so this
              takes no layout space; visually nothing moves. */}
          <h1 className="sr-only">AquaTerra, a student-led NGO and community in Kolkata</h1>

          {/* SECTION 14 + 17 · the adaptive hi block, the FIRST of the two
              additions section 17 allows at the top of the centre column.
              One ink block per screen and it IS the greeting: AdaptiveGrid
              renders the block, the greeting and the grid together, so there
              is no way to mount the grid as a separate paper section.

              Signed-in actives only. A guest resolves to G38 (every member
              predicate requires signedIn), which would be a greeting with a
              single map tile and nothing to say, and AQ Home Hi's own layout
              rule is that a signed-out visitor keeps the marketing hero
              instead. So the block is absent for guests rather than empty.

              THE SECOND ADDITION, THE LIVE STRIP, IS NOT MOUNTED, and the
              reason is the schema rather than the plumbing. It renders only
              when the member has an ACCEPTED SIGNUP for a drive starting
              within twelve hours that has not ended, and there is no signup.
              `lib/database.types.ts` has no signup or RSVP table at all: the
              only drive-and-member table is `drive_attendance`, which records
              a check-in that has already happened, and the only service over
              it (attendanceService) reads per drive (getRoster) or lists the
              director triage set (listDrives), never a given member's own
              future rows. Resolving one would be a new table and a new
              endpoint, which section 34 step 1 forbids.

              Its own spec settles what to do in the meantime: absent, not
              empty. No placeholder, no skeleton, no "nothing today" variant,
              and above all no countdown to a drive we could not read. */}
          {SMART_GRID_ENABLED && isActive && (
            <AdaptiveGrid
              // Collapsed by default: the greeting stays, the tile grid is one tap
              // away. See AdaptiveGrid's `collapsible` for why.
              collapsible
              ctx={gridCtx}
              eyebrow={hi.eyebrow}
              greeting={hi.greeting}
              line={hiLine}
              // Reports the id AdaptiveGrid actually rendered (post-
              // enrichment) back up so `hiLine` and the mascot's pose below
              // can never describe a recipe the grid has already left.
              onRecipeChange={setLiveRecipeId}
              // Section 17's cast table, row 2: Nolen sits in the hi block,
              // idle, and section 14 switches him to `sleep` on the break
              // recipe. AdaptiveGrid exposes exactly one free child slot and
              // this is it; the component is imported, never modified, and its
              // sticker budget for this screen is already spent on the browse
              // card's "pick one", so nothing is displaced. Positioned from
              // home.css. Decorative, so no `label` and no announcement.
              // Keyed off `effectiveRecipeId` (AdaptiveGrid's own answer once
              // it has one), not the host-only guess: `queueDepth`/
              // `ownPending` only resolve inside AdaptiveGrid's enrichment, so
              // the pre-enrichment guess can never even produce G27/G30/G21/
              // G09, but it CAN wrongly still say G33 (break) after
              // enrichment resolves one of those four ahead of the break
              // recipe in the walk order - showing the sleeping mascot over a
              // grid that has already moved on to "your join request is
              // waiting" and dropped the break's "nudges are off" promise.
              sticker={
                <span className="home-hi-mascot" aria-hidden="true">
                  <Mascot character="nolen" pose={effectiveRecipeId === 'G33' ? 'sleep' : 'idle'} size={44} />
                </span>
              }
            />
          )}

          <header className="home-feed-head">
            <div>
              {/* The homepage's ONLY heading element used to be "the feed.",
                  as an <h1>. prerender-meta.mjs injects a topical h1 into
                  index.html, but main.tsx mounts with createRoot().render(),
                  which DISCARDS the prerendered body - so non-JS crawlers saw
                  the good heading while Googlebot, which renders JS, saw "the
                  feed." on the page targeting "student-led NGO Kolkata".

                  The sr-only h1 that states what the site is (matching the
                  prerendered one, so the two can't disagree) now renders
                  unconditionally near the top of home-center, so it always
                  precedes every h2 on the page. "the feed." stays the h2 it
                  always was semantically. Visually nothing moves. */}
              <h2 className="h-display home-feed-title">
                the <span style={{ fontStyle: 'italic', fontFamily: 'var(--serif)', fontWeight: 400, color: 'var(--welfare-ink)' }}>feed</span>.
              </h2>
              {/* Section 17, meta type: JetBrains Mono uppercase for every
                  piece of meta on this page, this line included. The STRING is
                  frozen ("{filter} · {sort} · {n} posts", and n counts posts);
                  only the family, size and case change. */}
              <p className="home-feed-meta">
                {filter || 'everything'} · latest · {totalFeedPosts || displayed.length} posts
              </p>
            </div>
            <div className="row gap-2 home-feed-actions">
              {/* "for you" and "my teams" tabs REMOVED 2026-09-14 (owner
                  request: slow, not worth keeping). The feed is always
                  newest-first now, for signed-in members and guests alike -
                  same static inert pill both used to see, no tablist. */}
              <button className="tab active" aria-disabled="true" tabIndex={-1}><I.pulse /> latest</button>
              <Link to="/opportunities" className="chip">
                <I.star /> openings
              </Link>
            </div>
          </header>

          {/* Section 17 radii + guardrail 1's contrast rule. Radius 14 -> 18,
              matching the sample-preview notice directly below it (both are
              the same class of centre-column notice, and they disagreed).
              The text colour was `var(--tomato, var(--tomato))`, a fallback
              chain to itself; --tomato is #FF4D2E at 3.31:1 and fails AA as
              body text. --rust is the palette's only red that clears 4.5:1,
              and tokens.css names it for exactly this. The string is
              unchanged, and the retry affordance is unchanged apart from its
              hit area. */}
          {/* §11.1 state 8. Above the error block and above the list, in the
              same slot the offline banner occupies on other surfaces - and it
              renders nothing while offline, so the two never speak at once. */}
          {stale && (
            <StaleBanner onRefresh={handleStaleRefresh} onDismiss={dismissStale} busy={loading} />
          )}

          {feedError && (
            <div
              role={feedRateLimited ? 'status' : 'alert'}
              style={{
                marginBottom: 14,
                padding: '12px 16px',
                borderRadius: 22,
                // A rate limit is a wait, not a fault: lemon, the same tint the
                // offline banner uses for "a condition, not your mistake",
                // instead of the danger red. Ink on the tint, per §11.4's
                // contrast rule.
                background: feedRateLimited
                  ? 'color-mix(in srgb, var(--lemon) 34%, var(--card))'
                  : 'color-mix(in srgb, var(--danger) 10%, transparent)',
                border: feedRateLimited
                  ? '1px solid color-mix(in srgb, var(--lemon) 55%, transparent)'
                  : '1px solid color-mix(in srgb, var(--danger) 38%, transparent)',
                color: feedRateLimited ? 'var(--ink)' : 'var(--danger)',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {feedError}{' '}
              <button
                className="home-inline-action"
                // While a stated cooldown is still running, retrying can only
                // hit the same limit again - so the control says how long is
                // left and does nothing until it is over.
                disabled={feedRateLimited && !!feedRetryIn && feedRetryIn > 0}
                onClick={reloadFeed}
              >
                {feedRateLimited ? retryLabel(feedRetryIn) : 'retry'}
              </button>
            </div>
          )}

          {/* AQ Home Cleanup draws this notice as `2px dashed rgba(27,138,90,.55)`
              on `rgba(27,138,90,.08)` at radius 18. It was rendering on
              rgba(0,229,160,...), a mint that is in no token and in no
              canvas - the guardrail is "do not add colours", and this one was
              added by hand. Same alphas, same dash, welfare green. Both
              strings are frozen and unchanged; `usingSamplePreview` itself is
              on section 17's frozen list and is not touched. */}
          {usingSamplePreview && !isActive && (
            <div
              style={{
                marginBottom: 14,
                padding: '11px 15px',
                borderRadius: 22,
                background: 'color-mix(in srgb, var(--welfare) 8%, transparent)',
                // audit-ok: dashed - the sample-preview notice, the first case 00.12 keeps
                border: '2px dashed color-mix(in srgb, var(--welfare) 55%, transparent)',
                color: 'var(--ink-2)',
                fontFamily: 'var(--mono)',
                fontSize: 12,
              }}
            >
              ★ sample preview. these are example posts.{' '}
              <Link to="/login" className="home-inline-action" style={{ color: 'var(--welfare-ink)', fontWeight: 700 }} onClick={() => setAuthIntent({ kind: 'apply' })}>Join AquaTerra →</Link>
            </div>
          )}

          {/* compose */}
          {isActive && (
            <div className="card home-compose">
              <div className="home-compose-row">
                <div className="avatar" style={{ background: avatarColor, overflow: 'hidden', flexShrink: 0 }}>
                  {member?.avatar_url
                    ? <Img ctx="avatar" src={member.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                    : memberInitials}
                </div>
                <button className="input home-compose-input" onClick={() => setShowCreateModal(true)}>
                  what did you make today?
                </button>
                <div className="row gap-1">
                  <button className="btn btn-sm btn-ghost home-compose-icon" aria-label="Add a photo to your post" onClick={() => setShowCreateModal(true)} title="photo"><I.camera /></button>
                  <button className="btn btn-sm btn-ghost home-compose-icon" aria-label="Add a link to your post" onClick={() => setShowCreateModal(true)} title="link"><I.link /></button>
                  <button className="btn btn-sm btn-primary" onClick={() => setShowCreateModal(true)} data-mascot-target="compose"><I.plus /> Post</button>
                </div>
              </div>
            </div>
          )}

          {/* mobile category chips */}
          <div className="home-mobile-cats row gap-2">
            {CATS.map(c => (
              <button key={c.k} className={'chip ' + (filter === c.k ? 'chip-active' : '')} onClick={() => handleFilterClick(c.k)}>
                {c.k !== '' && <span className="chip-dot" style={{ background: c.color }} />}
                {c.l}
                {c.k === '' && <span className="mono">{totalFeedPosts}</span>}
              </button>
            ))}
          </div>


          {/* MEMBER OF THE MONTH tablet/phone instance REMOVED 2026-09-14 -
              see the matching removal note in RightRail above; a MoM win now
              auto-posts to the feed instead of getting a second, separate
              announcement here. */}

          {/* 18.2, the burst-and-settle load animation: first session only,
              then instant (its own `aq_burst_seen` sessionStorage flag).
              Renders nothing itself - it finds the first few real
              `.feed-card` elements below once they exist and animates them
              in place, so this mount is the only change here; the card list
              and its map below are untouched. */}
          <FeedBurst containerSelector=".home-feed-list" cardSelector=".feed-card" count={3} />

          {/* feed list */}
          <div className="home-feed-list">
            {/* First card in the stream (2026-09-07). Self-contained: loads its
                own state, renders null unless there is something to nudge about,
                and retires itself for good after a second dismissal. Ordered
                AFTER the post-approval team picker, which is a one-time moment;
                this card is snoozeable and will still be here afterwards. */}
            {/* A member just approved who had asked to be reminded about a role or team (feed chip). Above the
                profile nudge: it is the thing they came for. Renders null when there is nothing to ask. */}
            <InterestChip enabled={isActive} onVisibleChange={setInterestShowing} />
            {/* One prompt at a time: the profile nudge waits while the interest chip is showing. */}
            <ProfileNudgeCard enabled={isActive && !interestShowing} />
            {loading && displayed.length === 0 ? (
              // Section 01.17: shaped to match the card's new photo-first order
              // (01.15.2) - a skeleton whose shape doesn't match what loads
              // reads as the page jumping (UX-GAPS #26).
              [0, 1, 2].map(i => (
                // Built out of the card's OWN classes (.feed-card-media /
                // -head / -body / -foot) rather than a hand-measured copy, so
                // the media's 4/3 box, the head's 12/8/10 padding, the body's
                // gutter and the footer's hairline + 44px row are the same
                // objects at every width and cannot drift when feed.css
                // changes. Only the text runs are placeholders: a three-line
                // title and one snippet line, which is the commonest body
                // shape on the live feed (measured 2026-09).
                <div key={i} className="feed-card" aria-hidden="true" style={{ cursor: 'default', pointerEvents: 'none' }}>
                  <div className="feed-card-media" style={{ background: 'var(--bg-2)' }} />
                  <div className="feed-card-head">
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--bg-2)', flexShrink: 0 }} />
                    {/* 15 + 8 + 13 = 36px, the exact height of the real name
                        line plus its mono meta line, so the head is 58px in
                        both states. */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ width: '60%', height: 15, background: 'var(--bg-2)', borderRadius: 999 }} />
                      <div style={{ width: '40%', height: 13, background: 'var(--bg-2)', borderRadius: 999 }} />
                    </div>
                  </div>
                  <div className="feed-card-body">
                    <div style={{ marginBottom: 6 }}>
                      {['100%', '96%', '58%'].map(w => (
                        <div key={w} style={{ width: w, height: 24, display: 'flex', alignItems: 'center' }}>
                          <span style={{ display: 'block', width: '100%', height: 15, background: 'var(--bg-2)', borderRadius: 999 }} />
                        </div>
                      ))}
                    </div>
                    <div style={{ height: 23, display: 'flex', alignItems: 'center' }}>
                      <span style={{ display: 'block', width: '80%', height: 12, background: 'var(--bg-2)', borderRadius: 999 }} />
                    </div>
                  </div>
                  <div className="feed-card-foot">
                    {[64, 64, 44].map((w, n) => (
                      <span key={n} style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '0 11px' }}>
                        <span style={{ display: 'block', width: w, height: 20, background: 'var(--bg-2)', borderRadius: 999 }} />
                      </span>
                    ))}
                    <span style={{ flex: 1 }} />
                    <span style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '0 11px' }}>
                      <span style={{ display: 'block', width: 20, height: 20, background: 'var(--bg-2)', borderRadius: 999 }} />
                    </span>
                  </div>
                </div>
              ))
            ) : displayed.length === 0 ? (
              <EmptyState
                icon="✍️"
                title="nothing here yet."
                hint={isActive ? 'try another filter - or post the first one.' : 'try another filter, or join to post the first one.'}
                action={isActive
                  ? <button type="button" className="btn btn-primary" onClick={() => setShowCreateModal(true)}>post the first one →</button>
                  : <Link to="/login" className="btn btn-primary">join to post →</Link>}
                secondary={filter ? <button type="button" className="btn" onClick={() => setFilter('')}>clear filter</button> : undefined}
              />
            ) : (
              displayed.map((post, i) => {
                // 22.5's backfill rule: when the for-you tab's newest page
                // returns fewer than 5 posts, feedService.getFeed appends
                // the last 30 days' most-liked posts and flags each with
                // `isBackfill` - rendered here as a one-time divider before
                // the first one. "Labelled with existing copy" per
                // SOCIAL-ENGINE.md: adapts SearchPage.tsx's own "★ trending
                // this week" rail header (same mono/upper/muted treatment),
                // with "this month" instead of "this week" because the
                // window this pulls from really is 30 days, not 7 - reusing
                // "this week" verbatim would misstate what's actually shown.
                const isFirstBackfill = (post as any).isBackfill && !(displayed[i - 1] as any)?.isBackfill

                // Pinned posts: feedService hoists them to the front of page 1
                // and excludes them from every ranged page, so they are always
                // the leading run here and never appear twice. Two headings
                // bracket that run so a reader can see where the notice block
                // stops - without them, two arbitrary posts just sit out of
                // date order at the top and read as a bug.
                const prev: any = displayed[i - 1]
                const isFirstPinned = !!post.pinned && !prev?.pinned
                const isFirstAfterPinned = !post.pinned && !!prev?.pinned

                const dividerLabel = isFirstPinned ? '★ pinned by the team'
                  : isFirstAfterPinned ? '★ the rest of the feed'
                  : '★ trending this month'
                const showDivider = !!isFirstBackfill || isFirstPinned || isFirstAfterPinned

                // Collapsed into an earlier C25 group: its rows are rendered
                // by the group's leading card, so it must not render again.
                // (Only rows `isGroupable` allowed to collapse ever get here,
                // and adjacency means the leader is always above it.)
                const uuid = post.uuid || ''
                if (swallowedUuids.has(uuid)) return null
                const group = groupLeadByUuid.get(uuid)
                if (group) {
                  return (
                    <FragmentWithDivider
                      key={post.uuid || i}
                      showDivider={showDivider}
                      label={dividerLabel}
                      flush={isFirstPinned && i === 0}
                    >
                      {/* A group carries no per-post engagement because there
                          is no single post to engage with - every row is a
                          link into the post itself, where the like, the
                          bookmark and the comment sheet live. Only rows that
                          lose nothing by collapsing reach this branch. */}
                      <FeedCard item={group.item} decision={group.decision} seed={i} />
                    </FragmentWithDivider>
                  )
                }

                // Shapes outside SHAPED_SHAPES (C08 pinned above all) fall
                // through as `undefined`, and the card renders its live
                // layout unchanged.
                const decision = shapeByUuid.get(uuid)
                const shapeDecision = decision && SHAPED_SHAPES.has(decision.shape) ? decision : undefined

                return (
                  <FragmentWithDivider
                    key={post.uuid || i}
                    showDivider={showDivider}
                    label={dividerLabel}
                    flush={isFirstPinned && i === 0}
                  >
                    <MemoSharedFeedPostCard
                      /* The ONE list whose first card really is the page's
                         above-fold LCP element. Every other FeedPostCard list
                         re-mints a seed 0 for a below-fold photo. */
                      allowEager
                      post={post}
                      seed={i}
                      onLikeToggle={handleCardLike}
                      // Sample-preview fallback posts are never real DB rows, so
                      // skip the card's own saved-state/linked-opening self-fetch
                      // (which would otherwise fire a network request against a
                      // fake id) by passing these explicitly instead of leaving
                      // them undefined.
                      savedInitial={usingSamplePreview ? false : savedSet.has(post.postId)}
                      linkedOpening={usingSamplePreview ? null : (openings.get(post.uuid) ?? null)}
                      decision={shapeDecision}
                    />
                  </FragmentWithDivider>
                )
              })
            )}

            {!loading && hasMore && !usingSamplePreview && (
              <div ref={loadMoreSentinelRef} style={{ textAlign: 'center', padding: '16px 0' }}>
                <button
                  className="rail-card-cta"
                  disabled={isLoadingMore}
                  onClick={loadMore}
                >
                  {isLoadingMore ? 'loading…' : 'load more →'}
                </button>
                {/* Announce the append to screen readers — the visual cue is
                    just more cards appearing, which is silent otherwise. */}
                <span className="sr-only" role="status" aria-live="polite">
                  {isLoadingMore ? 'Loading more posts' : ''}
                </span>
              </div>
            )}

            {!loading && displayed.length > 0 && !hasMore && (
              <div className="home-feed-end">
                {/* Section 17's cast table: Bhoot closes the feed, idle. The
                    two strings beside it are frozen and unchanged. */}
                <Mascot character="bhoot" pose="idle" size={44} />
                <span className="sticker sticker--diecut" style={{ ['--sticker-ground' as string]: 'var(--bg)' }}>★ that's all for now</span>
                <p className="mono xs muted" style={{ marginTop: 10 }}>more posts coming · refresh in a sec</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT RAIL */}
        <RightRail isDirector={isAuthenticated && hasLeaderAccess(member?.role)} />
      </div>

      {isActive && createMounted && (
        <Suspense fallback={null}>
          <CreatePostModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onPostCreated={handlePostCreated}
          />
        </Suspense>
      )}
    </div>
  )
}
