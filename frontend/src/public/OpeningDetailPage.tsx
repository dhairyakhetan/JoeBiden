import { useState, useEffect } from 'react'
import { count } from '../lib/uiHelpers'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { jobOpenings, JobOpening, CAT_COLORS } from '../lib/jobOpenings'
import { useMeta } from '../hooks/useMeta'
import { useJsonLd, abs } from '../hooks/useJsonLd'
import ShareModal from '../components/ShareModal'
import Breadcrumbs from '../components/Breadcrumbs'
import { APPROVAL_TIME } from '../lib/orgFacts'
import ApplyModal from './ApplyModal'
import './OpeningDetail.css'

const CAT_ICON: Record<string, string> = {
  events: '🎪', welfare: '🌱', labs: '⚡', operations: '⚙️', content: '✍️',
}

// Full-page, uniquely-addressable view of a single job opening
// (`/opportunities/:id`). The listing on /opportunities shows a compact card;
// this is the shareable permalink that shows the team and the full content -
// description, skills, commitment, deadline, and what the application will ask.
// Apply reuses the tested flow on the list page via ?opening=<id>.
export default function OpeningDetailPage() {
  const { id = '' } = useParams()
  const { isAuthenticated, member, isLoading: authLoading } = useAuth()
  const [applyOpen, setApplyOpen] = useState(false)
  const [hasApplied, setHasApplied] = useState(false)
  // pending | reviewed | accepted | rejected. The page used to say "you applied, the team will reach out" forever, even after
  // the person had been accepted or declined.
  const [appStatus, setAppStatus] = useState<string | null>(null)
  // Coming back from sign-in (?apply=1) the form opens by itself: the visitor already said they want this role.
  const [search, setSearch] = useSearchParams()
  const wantsApply = search.get('apply') === '1'
  const [op, setOp] = useState<JobOpening | null | undefined>(undefined) // undefined = loading, null = not found
  const [error, setError] = useState<string | null>(null)
  // This page is described in its own header comment as "the shareable
  // permalink" and carried no share affordance at all - the only way to get a
  // story or poster for a role was the leader-only manage popover on
  // /opportunities. The sheet is open to every reader; generating a graphic is
  // client-side canvas work with no write behind it.
  const [showShareModal, setShowShareModal] = useState(false)

  useEffect(() => {
    let cancelled = false
    setOp(undefined); setError(null)
    jobOpenings.getById(id)
      .then(found => { if (!cancelled) setOp(found ?? null) })
      .catch(e => { console.error('[OpeningDetailPage] load failed:', e); if (!cancelled) { setError('Something went wrong.'); setOp(null) } })
    return () => { cancelled = true }
  }, [id])

  useMeta({
    title: op
      ? `${op.title}${op.teamName ? ` · ${op.teamName}` : ''} | Volunteer Role · AquaTerra`
      : 'Volunteer Opening · AquaTerra',
    description: op
      ? (op.description.replace(/\s+/g, ' ').trim().slice(0, 158)
         || `${op.title}: an unpaid student volunteer role at AquaTerra, Kolkata's student-run NGO. Real responsibility, apply in two minutes.`)
      : "An open, unpaid student volunteer role at AquaTerra. Real work with Kolkata's student-run NGO. Apply in two minutes.",
    // A closed or paused role keeps a live, indexable URL serving "this role
    // isn't here" under a real title. generate-sitemap.mjs already drops
    // non-open roles (status=eq.open), but the sitemap only controls
    // discovery, not what stays indexed once found. Expired JobPostings that
    // remain indexable are a documented cause of rich-result penalties.
    noIndex: !!op && op.status !== 'open',
  })

  // JobPosting - ONLY the fields we genuinely hold. These are unpaid student
  // volunteer roles, so employmentType is VOLUNTEER and no salary, benefits or
  // remote/onsite claim is asserted; `jobLocation` is the org's real Kolkata
  // base. Emitted only for a role that is actually open and has Google's four
  // required fields (title, description, datePosted, hiringOrganization) -
  // otherwise we publish nothing rather than guess.
  useJsonLd('opening-jobposting', op && op.status === 'open' && op.title && op.description && op.createdAt ? {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: op.title,
    description: op.description,
    datePosted: op.createdAt,
    ...(op.deadline ? { validThrough: op.deadline } : {}),
    employmentType: 'VOLUNTEER',
    hiringOrganization: { '@type': 'Organization', name: 'AquaTerra', sameAs: abs('') },
    jobLocation: {
      '@type': 'Place',
      address: { '@type': 'PostalAddress', addressLocality: 'Kolkata', addressRegion: 'West Bengal', addressCountry: 'IN' },
    },
    ...(op.teamName ? { department: { '@type': 'Organization', name: `${op.teamName} team` } } : {}),
    ...(op.skills.length ? { skills: op.skills.join(', ') } : {}),
    url: abs(`/opportunities/${op.id}`),
    directApply: true,
  } : null)

  // The trail is rendered below by <Breadcrumbs>, which emits this same
  // BreadcrumbList itself — one array feeding both, so the schema can't claim
  // a hierarchy the page doesn't show.
  const crumbs: Array<[string, string]> = op
    ? [['Home', '/'], ['Opportunities', '/opportunities'], [op.title, `/opportunities/${op.id}`]]
    : []

  const accent = op ? (CAT_COLORS[op.category] || 'var(--welfare)') : 'var(--welfare)'
  // Freeze "now" at mount rather than reading Date.now() during render - a
  // countdown that's off by the render's own duration is imperceptible, but
  // calling an impure function during render breaks purity guarantees. A
  // useState lazy initializer (unlike a useMemo callback) is guaranteed to
  // run exactly once, which is what the lint rule requires here.
  const [now] = useState(() => Date.now())
  const daysLeft = op?.deadline ? Math.ceil((new Date(op.deadline).getTime() - now) / 86400000) : null
  const isOpen = op?.status === 'open'
  const opId = op?.id
  useEffect(() => {
    if (!opId || authLoading) return
    if (!member) {
      if (isOpen && wantsApply) { setApplyOpen(true); setSearch({}, { replace: true }) }
      return
    }
    jobOpenings.getApplicationStatus(opId, member.member_id).then(status => {
      setHasApplied(!!status)
      setAppStatus(status)
      if (isOpen && wantsApply && !status) setApplyOpen(true)
      if (isOpen && wantsApply) setSearch({}, { replace: true })
    })
  }, [opId, member, isOpen, wantsApply, setSearch, authLoading])

  if (op === undefined) {
    return (
      <div className="aq-wrap" style={{ maxWidth: 780, padding: '48px var(--page-px)' }}>
        <div className="mono" style={{ color: 'var(--ink-3)' }}>loading opening…</div>
      </div>
    )
  }

  if (op === null) {
    return (
      <div className="aq-wrap" style={{ maxWidth: 780, padding: '64px var(--page-px)', textAlign: 'center' }}>
        <div style={{ fontSize: 54, marginBottom: 8 }}>🔍</div>
        <span className="sticker sticker-tomato wobble sticker--diecut" style={{ display: 'inline-flex', marginBottom: 14, ['--sticker-ground' as string]: 'var(--bg)' }}>★ not found</span>
        <h1 className="h-display" style={{ fontSize: 'clamp(28px,6vw,44px)', margin: '0 0 10px' }}>this role isn&apos;t here.</h1>
        <p style={{ color: 'var(--ink-2)', margin: '0 0 22px' }}>
          {error ? 'We couldn’t load this opening. It may have been closed or removed.' : 'This opening may have been closed, filled, or removed.'}
        </p>
        <Link to="/opportunities" className="btn btn-primary" style={{ display: 'inline-flex' }}>see all open roles →</Link>
      </div>
    )
  }

  const applyStyle = { background: accent, borderColor: 'var(--ink)', color: 'var(--ink)', boxShadow: 'var(--shadow-cta)', fontWeight: 800, minHeight: 48, fontSize: 16 } as const
  const statusLine = { fontWeight: 800, textTransform: 'uppercase', color: 'var(--ink-2)', minHeight: 48, display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } as const
  const applyCta = (appStatus === 'accepted') ? (
    <span className="mono xs" style={statusLine}>
      ✓ you’re on the team.
      <Link to="/teams" className="aq-thread-link">see your teams →</Link>
    </span>
  ) : (appStatus === 'rejected') ? (
    <span className="mono xs" style={statusLine}>
      not selected this time.
      <Link to="/opportunities" className="aq-thread-link">see other roles →</Link>
    </span>
  ) : !isOpen ? null : hasApplied ? (
    <span className="mono xs" style={statusLine}>
      ✓ you applied. the team will reach out.
    </span>
  ) : (
    <button className="btn btn-primary" style={applyStyle} onClick={() => setApplyOpen(true)}>
      Apply for this role →
    </button>
  )

  return (
    <div className="route-enter aq-wrap" style={{ maxWidth: 780, padding: '28px var(--page-px) 64px' }}>
      {/* Replaces a bare "← all openings" link. The trail carries the same
          affordance plus the hierarchy, so stacking both would be two controls
          doing one job. */}
      <Breadcrumbs
        items={crumbs}
        id="opening-breadcrumb"
        className="opening-crumbs"
      />

      <article
        style={{
          // Rounded minimalism: hairline edge, 32px outer radius, resting
          // soft lift (was a 3px ink border at 20px with a 6px hard offset).
          background: 'var(--card)', border: 'var(--hair-2)', borderRadius: 'var(--r-outer)',
          boxShadow: 'var(--lift-1)', position: 'relative', overflow: 'hidden',
        }}
      >
        {/* Category cap + faint icon watermark - same motif as the list card. */}
        <div aria-hidden style={{ position: 'absolute', left: 0, top: 18, bottom: 18, width: 7, borderRadius: '0 7px 7px 0', background: accent }} />
        <div aria-hidden style={{ position: 'absolute', top: -20, right: -10, fontSize: 120, lineHeight: 1, opacity: 0.07, transform: 'rotate(8deg)', pointerEvents: 'none', userSelect: 'none' }}>
          {CAT_ICON[op.category] || '★'}
        </div>

        <div style={{ padding: '24px 26px 26px 28px', display: 'flex', flexDirection: 'column', gap: 14, position: 'relative' }}>
          {/* category · team · status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
              letterSpacing: '0.06em', padding: '4px 11px', borderRadius: 999,
              background: accent, color: 'var(--ink)', border: 'var(--hair-2)',
            }}>{op.category}</span>
            {op.teamName && (
              <Link to="/teams" className="mono xs" style={{ fontWeight: 700, color: 'var(--ink-2)', textDecoration: 'none' }}>
                · {op.teamName} team
              </Link>
            )}
            <span style={{ flex: 1 }} />
            {!isOpen && (
              <span className="mono xs" style={{ fontWeight: 800, textTransform: 'uppercase', color: 'var(--ink-3)' }}>
                {op.status === 'closed' ? 'role closed' : 'applications paused'}
              </span>
            )}
          </div>

          {/* title */}
          <h1 className="h-display" style={{ fontSize: 'clamp(26px, 6vw, 42px)', letterSpacing: '-0.03em', lineHeight: 1.03, margin: 0, textWrap: 'balance' } as React.CSSProperties}>
            {op.title}
          </h1>

          <div className="od-chips">
            {op.commitment && <span className="od-chip"><span aria-hidden>⏱</span> {op.commitment}</span>}
            {daysLeft !== null && daysLeft > 0 && (
              <span className={'od-chip' + (daysLeft <= 3 ? ' od-chip-warn' : '')}>
                {daysLeft <= 3 ? '⚠ ' : ''}{count(daysLeft, 'day')} left
              </span>
            )}
            <span className="od-chip">posted by {op.createdByName}</span>
          </div>

          {/* content */}
          <p style={{ fontFamily: 'var(--eina)', fontSize: 15.5, lineHeight: 1.65, color: 'var(--ink)', margin: '4px 0 0', whiteSpace: 'pre-wrap', textWrap: 'pretty' } as React.CSSProperties}>
            {op.description}
          </p>

          {/* skills */}
          {op.skills.length > 0 && (
            <div>
              <div className="mono xs upper muted" style={{ fontWeight: 700, marginBottom: 8 }}>what helps</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {op.skills.map(s => (
                  <span key={s} style={{
                    fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
                    padding: '4px 11px', borderRadius: 999,
                    background: `color-mix(in srgb, ${accent} 15%, white)`, color: 'var(--ink)',
                    border: `1px solid color-mix(in srgb, ${accent} 45%, white)`,
                  }}>{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* what the application asks */}
          {op.customQuestions && op.customQuestions.length > 0 && (
            <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 14 }}>
              <div className="mono xs upper muted" style={{ fontWeight: 700, marginBottom: 8 }}>the application asks</div>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {op.customQuestions.map(q => (
                  <li key={q.id} style={{ fontSize: 14, color: 'var(--ink-2)' }}>
                    {q.label}{q.required ? ' *' : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <section aria-labelledby="od-stages-h">
            <h2 id="od-stages-h" className="mono xs upper muted" style={{ fontWeight: 700, margin: '4px 0 10px' }}>how applying works</h2>
            <ol className="od-stages">
              {[
                { t: isAuthenticated ? 'Answer a few questions' : 'Sign in, then answer a few questions', d: 'about two minutes, no CV, no cover letter', bg: 'var(--grape)' },
                { t: 'The team lead reads it', d: 'a real person on that team, not a filter', bg: 'var(--tomato)' },
                { t: 'You hear back either way', d: `usually ${APPROVAL_TIME}, in your Notifications`, bg: 'var(--lemon)' },
              ].map((st, i) => (
                <li key={st.t} className="od-stage" style={{ background: st.bg }}>
                  <span className="od-stage-n mono">stage {i + 1}</span>
                  <span className="od-stage-t">{st.t}</span>
                  <span className="od-stage-d">{st.d}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </article>

      <div className="od-bar">
        {isOpen ? applyCta : (
          <Link to="/opportunities" className="btn btn-primary" style={{ minHeight: 48 }}>see other open roles →</Link>
        )}
        <button className="btn od-bar-share" onClick={() => setShowShareModal(true)} title="Share this role - link, story card or poster">
          <span aria-hidden>↗</span> share
        </button>
      </div>

      {applyOpen && (
        <ApplyModal op={op} member={member ?? null} onClose={() => setApplyOpen(false)} onApplied={() => { setHasApplied(true); setApplyOpen(false) }} />
      )}

      {/* Share sheet - link / QR / story card / poster studio for this role.
          `teamCategory` is the opening's own category, the same value this
          page already accents with, so the graphic and the page agree. */}
      {showShareModal && (
        <ShareModal
          url={`${window.location.origin}/opportunities/${op.id}`}
          storyData={{
            type: 'opening',
            openingTitle: op.title,
            description: op.description,
            skills: op.skills,
            teamName: op.teamName,
            teamCategory: op.category,
          }}
          posterData={{
            body: op.title,
            authorName: op.createdByName,
            category: op.category,
            uuid: op.id,
            hiring: {
              skills: op.skills,
              commitment: op.commitment,
              deadline: op.deadline ? new Date(op.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : undefined,
              teamName: op.teamName,
            },
          }}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  )
}
