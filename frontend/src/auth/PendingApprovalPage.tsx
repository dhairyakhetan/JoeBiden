import Img from '../components/Img'
import './PendingApprovalPage.css'
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import PendingWishCard from '../components/PendingWishCard'
import { readGuestApplied, clearGuestApply } from '../lib/guestApply'
import { sized } from '../lib/imageUrl'
import { feedService } from '../services/feedService'
import { Post } from '../services/api'
import { SAMPLE_POSTS, applySampleLikes } from '../data/samplePosts'
import { jobOpenings, JobOpening, CAT_COLORS } from '../lib/jobOpenings'
import { trackAwaitingApproval } from '../lib/funnel'
import { APPROVAL_TIME } from '../lib/orgFacts'
import { claimStoredReferral } from '../referrals/claimStoredReferral'

// Category colour = one canonical hue per vertical (see lib/jobOpenings.CAT_COLORS);
// 'general'/unknown categories fall back to the brand green.
const catColor = (cat?: string) => CAT_COLORS[cat?.toLowerCase() || ''] || 'var(--welfare)'

// ── Compact masonry post card ────────────────────────────────────
function MasonryPostCard({ post, delay }: { post: Post; delay: number }) {
  const color = catColor(post.category)
  const body = post.body || ''
  const preview = body.length > 140 ? body.slice(0, 140) + '…' : body
  const initials = (name?: string) => (name || 'AQ').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const hasImage = post.images && post.images.length > 0
  const imageUrl = hasImage ? post.images![0].blobUrl : null

  return (
    <div
      style={{
        breakInside: 'avoid',
        marginBottom: 14,
        // Step 36. 20 was off-scale (DESIGN.md §1: 999/32/22/14 only); this
        // is a card on the cream masonry ground, so --r-inner is the value
        // the feed's own post cards use at this size.
        borderRadius: 'var(--r-inner)',
        overflow: 'hidden',
        /* 2026-09-10: the radius was migrated in step 36 but the edge and shadow
           were left on the retired motif, and this card repeats N times down a
           masonry column - so it was the densest concentration of 2px-ink +
           hard-offset left in the app, on the screen where a new member waits
           for days. Hairline + the resting lift, matching the feed's own cards. */
        border: 'var(--hair-2)',
        boxShadow: 'var(--lift-1)',
        background: 'var(--card)',
        animation: `masonry-in 0.5s ${delay}s ease both`,
        cursor: 'default',
      }}
    >
      {/* Image - if present */}
      {hasImage && (
        <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', overflow: 'hidden' }}>
          <Img
            src={sized(imageUrl!, 'card')}
            alt={`Photo from ${post.authorName}'s post`}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            loading="lazy"
          />
          {/* Step 36: the black linear-gradient overlay is DELETED. It existed
              to give the category chip something to sit on, but the chip
              already carries its own solid hue and a 1.5px keyline, so the
              gradient was darkening every photo on the page to solve a
              contrast problem that no longer existed. */}
          {/* Category chip on image */}
          <div style={{
            position: 'absolute', top: 12, left: 12,
            background: color, color: '#0A0A0A',
            fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            padding: '3px 9px', borderRadius: 999,
            border: '1.5px solid rgba(0,0,0,0.15)',
          }}>
            {post.category || 'general'}
          </div>
        </div>
      )}

      {/* Card body */}
      <div style={{ padding: '14px 16px 16px' }}>
        {/* Author row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
            background: color, border: 'var(--hair-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--display)', fontSize: 11, fontWeight: 800, color: '#0A0A0A',
          }}>
            {initials(post.authorName)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {post.authorName || 'AQ Member'}
            </div>
            {post.teamName && (
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>
                {post.teamName}
              </div>
            )}
          </div>
          {/* Category pill - no image variant */}
          {!hasImage && (
            <div style={{
              background: color, color: '#0A0A0A',
              fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.07em',
              padding: '3px 8px', borderRadius: 999,
              flexShrink: 0,
            }}>
              {post.category || 'general'}
            </div>
          )}
        </div>

        {/* Body preview */}
        {preview && (
          <p style={{ fontFamily: 'var(--eina)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, margin: 0 }}>
            {preview}
          </p>
        )}

        {/* Footer: likes + lock notice */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
            {post.likeCount > 0 && <span>♥ {post.likeCount}</span>}
          </div>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span>🔒</span> full access on approval
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Skeleton card ────────────────────────────────────────────────
function SkeletonCard({ delay }: { delay: number }) {
  return (
    <div style={{
      breakInside: 'avoid', marginBottom: 14,
      // §11.2: a skeleton must match the geometry of what replaces it - and
      // what replaces it is the card above, at --r-inner. It was 18 against
      // that card's 20, so it never matched either.
      borderRadius: 'var(--r-inner)', overflow: 'hidden',
      border: '2px solid var(--line)',
      background: 'var(--card)',
      animationDelay: `${delay}s`,
    }}>
      <div className="v6-skeleton" style={{ height: 160, borderRadius: 0 }} />
      <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="v6-skeleton sk-circle" style={{ width: 30, height: 30 }} />
        <div className="v6-skeleton" style={{ height: 13, width: '60%' }} />
        <div className="v6-skeleton" style={{ height: 11, width: '90%' }} />
        <div className="v6-skeleton" style={{ height: 11, width: '75%' }} />
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────
// 3-2-1 count before redirecting an approved member home (then
// ApprovedWelcomeModal, already wired via the aq_just_approved sessionStorage
// flag, fires on the home route). Skippable via ?skipCountdown=1 so this
// doesn't become a hardcoded blocking delay in front of QA/automated checks.
const APPROVAL_COUNTDOWN_SECONDS = 3

const PendingApprovalPage = () => {
  // A visitor who applied for a role signed out (lib/guestApply.ts): their application is kept, and this says what happens next.
  const [appliedFor] = useState<string | null>(() => readGuestApplied())
  useEffect(() => { clearGuestApply() }, [])
  const navigate = useNavigate()
  const { member, isAuthenticated, isLoading: authLoading, refreshMember, logout } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [isSample, setIsSample] = useState(false)
  // Openings-while-pending (2026-09-14): applying doesn't actually require an
  // approved account - RLS's job_applications_auth_insert only checks
  // applicant_id = self, and OpeningDetailPage's apply flow already gates on
  // isAuthenticated, not member.status. This surfaces that real capability
  // instead of making a member wait for approval to even see it - the
  // approved-only "black popup" (/choose-team) used to be the first place
  // openings showed up; now it's here, before the wait even starts. The HOD
  // side of this (not showing these applications on the hiring desks until
  // the applicant's own account is approved) is enforced in
  // lib/jobOpenings.ts's getApplications/getApplicationsForOpenings.
  const [openRoles, setOpenRoles] = useState<JobOpening[]>([])
  const [openRolesLoading, setOpenRolesLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const [cols, setCols] = useState(2)
  const [approvalCountdown, setApprovalCountdown] = useState<number | null>(null)

  // Audit pass, 2026-09-06: this route is public (not wrapped in
  // ProtectedRoute - a pending member fails `requireActive`, so it has to
  // be), but unlike its sibling RejectedPage.tsx it had no equivalent guard
  // of its own, so it rendered its full "YOUR ACCOUNT IS UNDER REVIEW... an
  // HoD usually reviews within a week... checking status automatically" copy
  // for a plain, never-applied guest who simply typed the URL - a real
  // logical error (asserting a status about the visitor that isn't true).
  // The other member statuses (active/rejected) are already redirected
  // elsewhere by the effect below once `member` loads; the one gap was
  // `!isAuthenticated`, where none of those checks ever fire at all.
  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate('/login', { replace: true })
  }, [authLoading, isAuthenticated, navigate])

  // Responsive column count
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth
      if (w < 560) setCols(1)
      else if (w < 900) setCols(2)
      else setCols(3)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Auto-refresh membership status every 30s
  useEffect(() => {
    if (!isAuthenticated) return
    const interval = setInterval(() => { refreshMember() }, 30000)
    return () => clearInterval(interval)
  }, [refreshMember, isAuthenticated])

  // Funnel: the account exists and is waiting on a director. Fired once per
  // mount, NOT on the 30s refresh loop above — this page can sit open for a
  // long time and re-firing would drown the event in duplicates.
  useEffect(() => {
    if (member?.status === 'pending_approval') trackAwaitingApproval()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Redirect when approved or rejected. Approval gets a visible 3-2-1
  // countdown first (skippable via ?skipCountdown=1, e.g. for automated
  // checks) so the transition doesn't feel like a jarring instant snap away
  // from the page the member was just reading.
  useEffect(() => {
    if (member?.status === 'active') {
      // Section 15. THIS is the first moment the claim is possible: this page
      // polls every 30s, and `claim_member_referral` raises 'not an active
      // member' for anyone whose status is still pending_approval - which is
      // every step of the funnel before this line. Fire and forget, never
      // awaited: the countdown below must not wait on an attribution write,
      // and a link that is stale, reused, expired or the member's own returns
      // false and is a silent no-op by design. Nothing about it is rendered;
      // the member is being taken home.
      void claimStoredReferral()
      // Tells ApprovedWelcomeModal (mounted on the home route) to greet
      // this member once - cleared as soon as it's read.
      try { sessionStorage.setItem('aq_just_approved', '1') } catch { /* private mode */ }
      const skip = new URLSearchParams(window.location.search).get('skipCountdown') === '1'
      if (skip) { navigate('/', { replace: true }); return }
      setApprovalCountdown(APPROVAL_COUNTDOWN_SECONDS)
    } else if (member?.status === 'rejected' || member?.status === 'deleted') navigate('/rejected', { replace: true })
  }, [member, navigate])

  useEffect(() => {
    if (approvalCountdown === null) return
    if (approvalCountdown <= 0) { navigate('/', { replace: true }); return }
    const t = setTimeout(() => setApprovalCountdown(c => (c ?? 1) - 1), 1000)
    return () => clearTimeout(t)
  }, [approvalCountdown, navigate])

  // Load feed preview.
  //
  // SAMPLE_POSTS is a fixture: invented students (Priyasha Chatterjee, Arjun
  // Mehta) and invented numbers (847 attendees, ₹24,300 raised). The public
  // homepage renders the same fixture but captions it "sample preview — these
  // are example posts"; this page didn't, so someone waiting on approval —
  // deciding whether the org they just applied to is real — was reading
  // fabricated activity as the live feed. Track which one we're showing so the
  // caption below can tell the truth.
  useEffect(() => {
    const sample = () => {
      setPosts(applySampleLikes(SAMPLE_POSTS) as unknown as Post[])
      setIsSample(true)
    }
    feedService.getFeed({ page: 1, limit: 18 })
      .then(r => {
        if (r.success && r.data.length > 0) { setPosts(r.data); setIsSample(false) }
        else sample()
      })
      .catch(sample)
      .finally(() => setLoading(false))
  }, [])

  // Load open roles - independent of the feed preview above, so a slow/failed
  // feed load never holds up the one section on this page a pending member
  // can actually DO something with.
  useEffect(() => {
    jobOpenings.getOpen()
      .then(setOpenRoles)
      .catch(() => setOpenRoles([]))
      .finally(() => setOpenRolesLoading(false))
  }, [])

  // Mirrors RejectedPage.tsx's own guard: nothing to render for a signed-out
  // visitor (the effect above is already sending them to /login) or while
  // auth is still resolving.
  if (authLoading || !isAuthenticated) {
    return null
  }

  return (
    <div className="route-enter" style={{ minHeight: '100dvh', background: 'var(--bg)' }}>

      {/* ── Sticky review banner ── */}
      {/* Step 31: a full-bleed sticky bar becomes an inset card. `position:
          sticky`, `top: var(--nav-h, 70px)` and `zIndex: 40` are kept - the
          banner still has to follow the reader down the page. */}
      {!dismissed && (
        <div style={{
          position: 'sticky', top: 'var(--nav-h, 70px)', zIndex: 40,
          margin: '8px 10px',
          /* 2026-09-10: was `background: '#0A0A0A'` (raw hex) with
             `border: 2px solid var(--ink)` - an ink border on an ink ground,
             i.e. a border that paints nothing. Dropped, and the fill tokenised. */
          background: 'var(--ink)',
          borderRadius: 'var(--r-inner)',
          padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        }}>
          {/* Step 32: the dot was a box-shadow ring animated by `pending-pulse`.
              A box-shadow cannot be clipped or composited as cheaply as a
              transform, and it could not grow past the banner's old edge. The
              halo is now its own absolutely positioned span scaling under the
              dot, so the dot itself never moves. */}
          <span style={{ position: 'relative', width: 10, height: 10, flexShrink: 0, display: 'inline-flex' }}>
            <span aria-hidden style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: '2px solid var(--welfare)',
              animation: 'pending-ring 2s ease-out infinite',
            }} />
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: 'var(--welfare)',
            }} />
          </span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 15, color: '#fff' }}>
              your account is under review
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
              {/* Was hardcoded "within a week" - imported from orgFacts now so this
                  can't silently drift from /register's promise again (see the
                  APPROVAL_TIME comment in lib/orgFacts.ts). */}
              an HoD usually reviews applications {APPROVAL_TIME} · meanwhile, explore what's happening inside AQ
            </div>
          </div>
          {/* No flexShrink:0 here - with two nowrap stickers (142px + 231px)
              plus the ✕, this group's single-line width is ~427px. flexShrink:0
              forced the whole banner (and the page) to that width, overflowing
              a 375px phone by 72px. Letting it shrink lets its own flexWrap
              stack the stickers instead. */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Explicit status chip - distinct from the "checking..." sticker
                below, which describes the polling mechanism, not the status
                itself. Uses the shared .sticker component (lemon + wobble)
                instead of a hand-rolled pill so it matches the rest of the
                design system's "sticker" language. */}
            {/* Step 33: 26px pills with 2px ink borders. Both strings are kept,
                and they stay TWO separate chips - the comment above records why
                the status chip and the polling chip are distinct. No
                flexShrink: 0, per the note about the 375px overflow. */}
            <span className="pending-chip" style={{ background: 'var(--lemon)', transform: 'rotate(-2deg)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0A0A0A' }} />
              pending approval
            </span>
            <span className="pending-chip" style={{ background: 'var(--welfare)' }}>
              checking status automatically…
            </span>
            <button
              onClick={() => setDismissed(true)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1, minWidth: 40, minHeight: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              aria-label="Dismiss banner"
            >✕</button>
          </div>
        </div>
      )}

      {dismissed && (
        <button
          onClick={() => setDismissed(false)}
          style={{
            position: 'sticky', top: 'var(--nav-h, 70px)', zIndex: 40,
            width: '100%', background: '#0A0A0A', border: 'none',
            borderBottom: '1px solid var(--welfare)',
            padding: '8px 20px', cursor: 'pointer',
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--welfare)',
            textAlign: 'left',
          }}
        >● account under review. tap to see details</button>
      )}

      {/* ── Open roles - look while you wait ──
          Since 2 Nov 2026 a pending member cannot apply (the database refuses it, lib/joinGate.ts). They can browse,
          and opening a role offers "remind me", which becomes a card at the top of their feed once they are approved. */}
      <div style={{ padding: 'clamp(24px, 4vw, 40px) var(--page-px) 0', maxWidth: 'var(--frame-max)', margin: '0 auto' }}>
        {appliedFor && (
          <div role="status" style={{ background: 'var(--welfare)', color: 'var(--ink)', border: 'var(--hair-2)', borderRadius: 'var(--r-inner)', padding: '14px 18px', marginBottom: 16 }}>
            <div className="h-display" style={{ fontSize: 22, lineHeight: 1.05, marginBottom: 6 }}>your application for {appliedFor} is saved.</div>
            <p style={{ margin: 0, fontFamily: 'var(--eina)', fontSize: 14, lineHeight: 1.55 }}>
              First HR confirms you as part of AquaTerra. Then the team reaches out to you. We will also remind you at the top of your feed.
            </p>
          </div>
        )}
        <PendingWishCard />
        <div className="h-display" style={{ fontSize: 'clamp(24px, 5vw, 32px)', lineHeight: 0.96, marginBottom: 8 }}>
          while you wait,
          <br />
          <span style={{ fontStyle: 'italic', fontFamily: 'var(--serif)', color: 'var(--welfare-ink)', fontWeight: 400 }}>see what&apos;s open</span>
          <span>.</span>
        </div>
        <p className="muted" style={{ fontSize: 13, marginBottom: 20 }}>
          you can apply once your account is approved. open a role and tap &ldquo;remind me&rdquo;, and we&apos;ll ask you again the moment you&apos;re in.
        </p>

        {openRolesLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginBottom: 28 }}>
            {[0, 1, 2].map(i => (
              <div key={i} className="v6-skeleton" style={{ height: 92, borderRadius: 'var(--r-inner)' }} />
            ))}
          </div>
        ) : openRoles.length === 0 ? (
          <div className="card" style={{ padding: 20, marginBottom: 28 }}>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>no roles are open right now - check back soon.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginBottom: 28 }}>
            {openRoles.slice(0, 6).map(role => {
              const color = catColor(role.category)
              return (
                <Link
                  key={role.id}
                  to={`/opportunities/${role.id}`}
                  className="card"
                  style={{
                    display: 'block', padding: '16px 18px', textDecoration: 'none',
                    borderRadius: 'var(--r-inner)', border: 'var(--hair-2)', boxShadow: 'var(--lift-1)',
                    borderLeft: `4px solid ${color}`,
                  }}
                >
                  <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 15, color: 'var(--ink)', lineHeight: 1.25, marginBottom: 6 }}>
                    {role.title}
                  </div>
                  <div className="mono xs muted">
                    {role.teamName ? `${role.teamName} team` : role.category}{role.commitment ? ` · ${role.commitment}` : ''}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Feed preview header ──
          Top padding shrunk from a flat clamp(28,4vw,48) to clamp(8,2vw,28):
          this section now sits directly under the "open roles" one above it,
          which already ends in its own 28px marginBottom - the original
          value stacked a second full hero-sized gap on top of that, reading
          as two consecutive full-height headlines with no content between
          them on a phone. Font size is also a clamp now (was a flat 40),
          so this reads as a subhead under the openings section rather than
          a second hero competing with it at narrow widths. */}
      <div style={{ padding: 'clamp(8px, 2vw, 28px) var(--page-px) 0', maxWidth: 'var(--frame-max)', margin: '0 auto' }}>
        {/* Step 34. The italic "what's happening" span and both isSample
            caption branches below are unchanged. */}
        <div className="h-display" style={{ fontSize: 'clamp(28px, 6vw, 40px)', lineHeight: 0.92, marginBottom: 8 }}>
          meanwhile, here's
          <br />
          <span style={{ fontStyle: 'italic', fontFamily: 'var(--serif)', color: 'var(--welfare-ink)', fontWeight: 400 }}>what's happening</span>
          <span>.</span>
        </div>
        {/* Said "live AQ community feed" unconditionally — including when the
            fixture was on screen, which made it a false claim on the page
            where trust is thinnest. Matches the homepage's caption now. */}
        <p className="muted" style={{ fontSize: 13, marginBottom: 20 }}>
          {isSample
            ? <>★ sample preview: these are example posts. the real feed unlocks once you're approved.</>
            : <>live AQ community feed: full access once you're approved.</>}
        </p>

        {/* ── Read-only compose bar preview - a taste of what unlocks on approval ── */}
        <div
          className="card"
          style={{
            // Step 35. The hatch overlay below is kept verbatim: it is what
            // says "this is switched off" without a word of copy.
            padding: '14px 16px', marginBottom: 28,
            borderRadius: 'var(--r-inner)', border: 'var(--hair-2)',
            display: 'flex', alignItems: 'center', gap: 12,
            position: 'relative', overflow: 'hidden',
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              backgroundImage: 'repeating-linear-gradient(135deg, rgba(0,0,0,0.05) 0 8px, transparent 8px 16px)',
            }}
          />
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-2)', border: 'var(--hair-3)', flexShrink: 0, position: 'relative' }} />
          <input
            className="input"
            placeholder="share what you're working on…"
            disabled
            readOnly
            aria-label="Post composer (unlocks after approval)"
            style={{ flex: 1, cursor: 'not-allowed', background: 'var(--bg-2)', color: 'var(--ink-3)', position: 'relative', borderRadius: 999 }}
          />
          <span className="sticker sticker--diecut" style={{ fontSize: 10, padding: '4px 10px', flexShrink: 0, background: 'var(--bg-3)', color: 'var(--ink-3)', position: 'relative', ['--sticker-ground' as string]: 'var(--card)' }}>
            🔒 locked
          </span>
        </div>
      </div>

      {/* ── MASONRY GRID ── */}
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        padding: '0 var(--page-px) 48px',
      }}>
        {loading ? (
          <div style={{ columnCount: cols, columnGap: 14 }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <SkeletonCard key={i} delay={i * 0.06} />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="card" style={{ padding: 48, textAlign: 'center', maxWidth: 400, margin: '0 auto' }}>
            <div className="h-display" style={{ fontSize: 28 }}>stay tuned.</div>
            <p className="muted">posts will start appearing here soon.</p>
          </div>
        ) : (
          <div style={{ columnCount: cols, columnGap: 14 }}>
            {posts.map((post, i) => (
              <MasonryPostCard key={post.uuid || i} post={post} delay={i * 0.06} />
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom CTA ── */}
      <div style={{ padding: '0 var(--page-px) 64px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{
          background: '#0A0A0A', borderRadius: 'var(--r-outer)',
          border: '2px solid var(--welfare)',
          padding: 'clamp(24px, 4vw, 36px)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 16,
        }}>
          <div>
            <div className="h-display" style={{ fontSize: 22, color: '#fff' }}>
              not you? <span style={{ fontStyle: 'italic', fontFamily: 'var(--serif)', color: 'var(--welfare-ink)' }}>that's fine.</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 4, marginBottom: 0 }}>
              wrong account? log out and try again.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/')}
              className="btn btn-sm"
              style={{ background: 'transparent', color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.2)' }}
            >
              browse as guest
            </button>
            <button
              onClick={async () => { await logout(); navigate('/login', { replace: true }) }}
              className="btn btn-sm"
              style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}
            >
              log out & start over
            </button>
          </div>
        </div>
      </div>

      {/* ── Approval countdown overlay ── */}
      {approvalCountdown !== null && (
        <div
          role="status"
          aria-live="assertive"
          style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(10,10,10,0.82)', backdropFilter: 'blur(8px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18,
          }}
        >
          <div className="h-display" style={{ fontSize: 24, color: '#fff' }}>
            you&apos;re approved<span style={{ color: 'var(--welfare-ink)' }}>.</span>
          </div>
          <div
            key={approvalCountdown}
            style={{
              width: 96, height: 96, borderRadius: '50%',
              border: '3px solid var(--welfare)', color: 'var(--welfare-ink)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--display)', fontWeight: 800, fontSize: 40,
              animation: 'countdown-pop 1s ease',
            }}
          >
            {approvalCountdown > 0 ? approvalCountdown : '→'}
          </div>
          <p style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
            taking you home…
          </p>
        </div>
      )}

    </div>
  )
}

export default PendingApprovalPage
