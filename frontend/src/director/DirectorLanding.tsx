import { useOutletContext, Link } from 'react-router-dom'
import type { DirectorContext } from './DirectorDashboard'
import type { NavKey } from './deskAccess'
import { prefetchDesk, prefetchDeskByPath } from './deskModules'
import { GROUP_HUES, visibleDeskGroups } from './deskAccess'
import { useAuth } from '../auth/AuthContext'
import { useCapabilities } from '../auth/CapabilityContext'
import { getRoleLabel } from '../lib/roles'
import { EmptyLedger } from './adminKit'

/**
 * The `/director` index route - the cover page of the ledger, not just a
 * counter. It answers three questions before the director picks a tab:
 * who am I acting as, what does the desk look like right now, and what
 * actually needs me today.
 *
 * Redesign 06.4 (2026-09) inverted the DOM order: scope -> title -> triage ->
 * stat strip -> desk list. The stat bento used to sit ABOVE the "what needs
 * you today" card even though four of its six tiles were the same queue
 * counts - an HoD checking between classes read the top of the screen and
 * left. The triage card is now the page's subject. 17.2 (2026-09, on top of
 * 06.4) then replaced the stat strip itself with the jigsaw block below it -
 * see that section's own comment for which of its six planned figures are
 * real.
 *
 * EVERY number here comes from `DashboardStats` (directorService.getDashboardStats)
 * or the layout's category-scoped pending-post count - nothing on this page is
 * invented or approximated. Two figures the redesign wanted (the triage hero's
 * "oldest is N days old" queue age, and a "+N since you last opened" count)
 * are NOT rendered: `getDashboardStats()` returns plain counts with no
 * created-at, and the landing has no list data to derive either from without
 * adding a query - which `WORKFLOW.md` rule 3 forbids ("never add a query to
 * make a design work... omit the element"). Both are logged as unresolved in
 * the build report rather than faked.
 *
 * Enquiries and Hiring used to be omitted from "what needs you today" because the
 * stats service produced no count for them, and inventing one would have been
 * worse than omitting it. They are counted for real now
 * (pendingEnquiries / pendingApplications), so they appear like every other
 * queue - previously those two desks carried no unread signal anywhere in the UI.
 */
const DirectorLanding = () => {
  const { stats, statsError, isSuperAdmin, myCategories, scopedPendingPosts } = useOutletContext<DirectorContext>()
  const { member } = useAuth()
  const { can } = useCapabilities()

  const pendingApprovals = stats?.pendingMemberApprovals || 0
  const pendingPosts = (scopedPendingPosts ?? stats?.pendingPostReviews) || 0
  const pendingEnquiries = stats?.pendingEnquiries || 0
  const pendingApplications = stats?.pendingApplications || 0
  // Restated here (the layout chrome shows it too) because the landing is
  // where a director orients - "which desk am I reading?" should not require
  // looking back up at the nav.
  // getRoleLabel, not a literal, so the 'hr' role reads as "hr" here instead of
  // inheriting super_admin's wording. For super_admin the string is unchanged.
  const scopeLabel = isSuperAdmin
    ? `acting as · ${getRoleLabel(member?.role).toLowerCase()} · all teams`
    : myCategories.length > 0
      ? `acting as · ${getRoleLabel(member?.role)} · teams: ${myCategories.join(', ')}`
      : `acting as · ${getRoleLabel(member?.role)}`

  const scopeNote = isSuperAdmin
    ? 'across every team'
    : myCategories.length > 0
      ? `for your ${myCategories.join(' + ')} team${myCategories.length === 1 ? '' : 's'}`
      : 'in your desk'

  // Redesign 17.2 replaces 06.4.3's stat strip (two totals: approved
  // members, published posts) with the jigsaw block below, which is built
  // entirely from the same four queue counts `todo` already uses - neither
  // total survives on the landing in 17's design. `stats.totalActiveMembers`/
  // `totalPublishedPosts` are unused here as a result; both desks (Members,
  // Content) still show their own real counts on their own pages.

  // Only real, non-zero queues make the list - an empty list is itself the
  // answer ("nothing waiting"), and is far more useful than five zeroes.
  const todo = ([
    { show: isSuperAdmin && pendingApprovals > 0, count: pendingApprovals, noun: pendingApprovals === 1 ? 'member sign-up' : 'member sign-ups', verb: 'waiting on approval', to: '/director/approvals' },
    { show: pendingPosts > 0, count: pendingPosts, noun: pendingPosts === 1 ? 'post' : 'posts', verb: 'waiting in the review queue', to: '/director/posts' },
    { show: pendingEnquiries > 0, count: pendingEnquiries, noun: pendingEnquiries === 1 ? 'enquiry' : 'enquiries', verb: 'nobody has replied to yet', to: '/director/enquiries' },
    { show: pendingApplications > 0, count: pendingApplications, noun: pendingApplications === 1 ? 'application' : 'applications', verb: 'waiting on a decision', to: '/director/hiring' },
  ] as const).filter(t => t.show)

  // 17.2 Verification 5: "No `0` badge anywhere; no zero in a display-scale
  // figure", and States/Partial failure: "if three of six counts resolve,
  // render three blocks, not six with markers". The jigsaw used to render
  // every block unconditionally and only fell back to the clear slab when ALL
  // four queues were empty - so with e.g. approvals=3 and enquiries=0 a `0`
  // rendered at 58px under the label `enquiries`. Blocks are now gated on the
  // SAME non-zero predicate `todo` already computes, and the surviving blocks
  // re-balance the row fractions instead of leaving a hole.
  const jigsaw = ([
    { show: isSuperAdmin && pendingApprovals > 0, to: '/director/approvals', n: pendingApprovals, label: 'accounts waiting', cc: 'var(--tomato)' },
    { show: pendingPosts > 0, to: '/director/posts', n: pendingPosts, label: 'posts in queue', cc: 'var(--lemon)' },
    { show: pendingEnquiries > 0, to: '/director/enquiries', n: pendingEnquiries, label: 'enquiries', cc: '' },
    { show: pendingApplications > 0, to: '/director/hiring', n: pendingApplications, label: 'applications', cc: 'var(--sky)' },
  ] as const).filter(b => b.show)
  // 17.2's row shape: the leading block is the wide one (1.35fr), the rest are
  // even. A row of one is simply full width.
  const jigCols = (n: number) => (n <= 1 ? '1fr' : ['1.35fr', ...Array(n - 1).fill('1fr')].join(' '))
  const jigRow1 = jigsaw.slice(0, 3)
  const jigRow2 = jigsaw.slice(3)

  const todoTotal = todo.reduce((n, t) => n + t.count, 0)

  // The desk list calls the SAME shared filter the rail calls (deskAccess.ts)
  // rather than keeping a second hand-written copy of the expression - it used
  // to be a third place where `superOnly` was interpreted. This list therefore
  // cannot show a director a desk the route guard would then refuse; the unit
  // test asserts exactly that, for every desk against every role.
  const visibleGroups = visibleDeskGroups({ role: member?.role, canApproveMembers: isSuperAdmin, can })

  const deskCount = visibleGroups.reduce((n, g) => n + g.items.length, 0)

  // Only the desks the stats object actually counts get a chip (the rail also
  // counts Certificates, which the landing has no figure for). Every
  // other desk reads `clear`, never a zero and never an invented number.
  const deskCounts: Partial<Record<NavKey, number>> = {
    approvals: isSuperAdmin ? pendingApprovals || undefined : undefined,
    posts: pendingPosts || undefined,
    hiring: pendingApplications || undefined,
    enquiries: pendingEnquiries || undefined,
  }
  const needYouCount = Object.values(deskCounts).filter((n): n is number => !!n).length

  // GROUP_HUES (raw, saturated) is right for a chrome fill (the rail dot, the
  // row tint) but fails 4.5:1 as GLYPH/NUMERAL colour on the light desk-list
  // row - lemon measures 1.61:1. This is the `*-ink`/`--ops` partner per
  // group, same formula 01.5 uses for the public feed's category glyphs.
  const GROUP_INK: Record<string, string> = {
    queue: 'var(--lemon-ink)',
    people: 'var(--welfare-ink)',
    intake: 'var(--sky-ink)',
    admin: 'var(--ops)',
  }

  return (
    <>
      <div className="mono xs upper muted ops-landing-scope">{scopeLabel}</div>

      <h1 className="ops-landing-title">the <i>desk</i>.</h1>

      {/* 17.3 asks for three additions to this header that are NOT built,
          each per that section's own explicit fallback:
          - a meta line ("total waiting, oldest age, +N since you last
            opened") - two of its three parts (age, +N) have no reachable
            data (see the file-level comment above), and the total alone
            already renders as the triage sticker below.
          - an `Export` pill - no export/download service exists to call.
          - `Approve all N` - directorService has no bulk-approve endpoint,
            only per-item `approveMember`/`approvePost`; 17.3 says "if bulk
            approve does not exist... render disabled with a title, or omit
            it" - a disabled button with no path to ever become enabled
            adds clutter with no benefit, so it is omitted rather than
            shipped inert. */}

      {/* ── Triage - the page's subject. What needs the operator today,
          rendered as a jigsaw of tiles rather than a list row. ── */}
      <div className="ops-triage">
        <div className="ops-triage-head">
          <span className="ops-triage-title">What needs you today</span>
          {todo.length > 0 && (
            <span className="ops-triage-total" aria-live="polite">
              {todoTotal} <span className="ops-triage-total-word">open</span>
            </span>
          )}
        </div>
        {statsError ? (
          // The counts did not load. Saying "nice work, all clear" here is the
          // worst possible wrong answer: it is indistinguishable from the good
          // news it imitates, and an HoD acts on it by closing the tab.
          <EmptyLedger
            message="couldn’t count your queues"
            sub="This is a loading problem, not an empty desk — open a desk directly to see what is waiting."
          />
        ) : todo.length === 0 ? (
          <EmptyLedger
            message={`nothing waiting ${scopeNote} - nice work`}
            sub="Every queue you can see is clear."
          />
        ) : (
          <div className="ops-jigsaw">
            {[jigRow1, jigRow2].filter(r => r.length > 0).map((row, ri) => (
              <div key={ri} className="ops-jigsaw-row" style={{ gridTemplateColumns: jigCols(row.length) }}>
                {row.map(b => (
                  <Link
                    key={b.to}
                    to={b.to}
                    className={'ops-block' + (b.cc ? '' : ' is-ink')}
                    onPointerEnter={() => prefetchDeskByPath(b.to)}
                    onFocus={() => prefetchDeskByPath(b.to)}
                    style={b.cc ? { ['--cc' as any]: b.cc } : undefined}
                  >
                    <span className="ops-block-n adm-nums">{b.n}</span>
                    <span className="ops-block-label">{b.label}</span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Every desk, named and reachable from the landing. Until now the only
          way to see the full set was the horizontal nav strip, where a desk
          scrolled off the right edge was effectively hidden, and neither the
          strip nor the sidebar showed a desk's route. Additive: switching
          desks from the rail is still one tap. */}
      <div className="ops-desks">
        <div className="ops-desks-header">
          <span className="ops-desks-title">all {deskCount} desks</span>
          {needYouCount > 0 && <span className="mono ops-desks-needyou">{needYouCount} need you</span>}
        </div>
        <div className="ops-desks-panel">
          <div className="ops-desks-groups">
            {visibleGroups.map(g => (
              <div key={g.label} className="ops-desks-group">
                <div className="ops-desks-grouphead">
                  <span className="ops-desks-grouplabel">{g.label}</span>
                  <span className="ops-desks-grouprule" aria-hidden />
                  <span className="ops-desks-groupcount">{String(g.items.length).padStart(2, '0')}</span>
                </div>
                <div className="ops-desks-grouprows">
                  {g.items.map(item => {
                    const c = deskCounts[item.key]
                    return (
                      <Link
                        key={item.key}
                        to={`/director/${item.path}`}
                        className={'ops-desk-row' + (c != null ? ' has-count' : '')}
                        title={item.blurb}
                        onPointerEnter={() => prefetchDesk(item.key)}
                        onFocus={() => prefetchDesk(item.key)}
                        style={{ ['--cc' as any]: GROUP_HUES[g.label], ['--cc-ink' as any]: GROUP_INK[g.label] }}
                      >
                        <span className="ops-desk-glyph" aria-hidden>{item.icon}</span>
                        <span className="ops-desk-meta">
                          <span className="ops-desk-name">{item.label}</span>
                          {/* Item 4.3, and a deliberate change to 06-hod-desk
                              §08's approved row: this second line used to read
                              `/director/members`. The route path is developer
                              metadata on a page built for student HoDs - it is
                              in the URL bar one click later anyway - and this
                              was the only slot in the row where a sentence
                              could live. Same slot, same position; mono 9px
                              swapped for prose, because a full sentence set in
                              9px mono is unreadable. Tooltip kept on the row
                              too, for the truncated case. */}
                          <span className="ops-desk-blurb">{item.blurb}</span>
                        </span>
                        {c != null
                          ? <span className="ops-desk-count adm-nums">{c}</span>
                          : <span className="ops-desk-clear">clear</span>}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

export default DirectorLanding
