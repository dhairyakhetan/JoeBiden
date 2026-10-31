import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import AuthContext from '../auth/AuthContext'
import { makeDevPreviewMember } from '../lib/devPreview'
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { jobOpenings } from '../lib/jobOpenings'
import { teamService } from '../services/teamService'
import profileService from '../services/profileService'
import profileNudgeService, { type NudgeContext } from '../services/profileNudgeService'
import ProfileNudgeCard from '../components/ProfileNudgeCard'
import AdaptiveGrid from '../components/AdaptiveGrid'
import { GRID_RECIPES, type GridContext, type GridRecipeId } from '../lib/gridRecipes'
import { StatusStamp } from '../director/adminKit'

const ChooseTeamPage = lazy(() => import('../onboarding/ChooseTeamPage'))
const CreatePostModal = lazy(() => import('../feed/CreatePostModal'))

/**
 * /dev/authed — the signed-out preview harness.
 *
 * WHY: a large amount of UI ships behind a login that no reviewer here is
 * permitted to pass, so it has never been seen rendered at any width. Every
 * contrast figure quoted for those surfaces was COMPUTED from token hex values
 * rather than sampled from pixels. This route closes that permanently.
 *
 * HOW, and the one rule that matters: **no production component gains a mock
 * code path.** A file that behaves differently under a flag is worse than the
 * gap this closes. Everything below is done at the harness boundary instead:
 *
 *   - context      → a real `AuthContext.Provider` wrapping the subject, so
 *                    `useAuth()` resolves the way it does in the app.
 *   - props        → `AdaptiveGrid` and `CreatePostModal` already take their
 *                    whole world as props; they need nothing else.
 *   - I/O          → the exported service SINGLETONS (`profileNudgeService`,
 *                    `profileService`, `jobOpenings`, `teamService`) and the
 *                    Supabase client's `.from()` are swapped for fixtures on
 *                    mount and restored on unmount. The swap lives here; the
 *                    modules themselves are untouched on disk.
 *   - network      → `window.fetch` is replaced with an immediate rejection
 *                    while this route is mounted, so a missed seam fails fast
 *                    and offline rather than reaching Supabase. There is no
 *                    session, so nothing could return member data anyway.
 *
 * PII: every fixture is obviously synthetic — "Test Member",
 * `+91 00000 00000`, `test.member@example.invalid`. Nothing here is copied
 * from the database or from any spreadsheet.
 *
 * GATING: DEV-only, on the same line as `/dev/components` in App.tsx
 * (`{import.meta.env.DEV && <Route .../>}`) and lazily imported, so the route
 * is never registered in a production build and the chunk is never requested.
 * (Verified: Rollup still EMITS the lazy chunk in `dist/assets/`, exactly as it
 * does for ComponentGallery/VariationsGallery/CardCatalogue — a dynamic import
 * behind a runtime conditional is not tree-shaken. It is unreachable, not
 * absent, which is the precedent's own posture.) `robots: noindex` is set on
 * mount and removed on unmount, matching dev/ComponentGallery.tsx.
 */

// ── fixture member ──────────────────────────────────────────────────────────
const FIXTURE_MEMBER = {
  ...makeDevPreviewMember('member'),
  full_name: 'Test Member',
  email: 'test.member@example.invalid',
} as any

const FIXTURE_LEADER = { ...FIXTURE_MEMBER, role: 'director' } as any

function authValue(member: any) {
  return {
    member,
    isLoading: false,
    isAuthenticated: !!member,
    memberLoadFailed: false,
    logout: async () => {},
    refreshMember: async () => {},
  }
}

function Authed({ member = FIXTURE_MEMBER, children }: { member?: any; children: ReactNode }) {
  const value = useMemo(() => authValue(member), [member])
  return <AuthContext.Provider value={value as any}>{children}</AuthContext.Provider>
}

// ── labelling ───────────────────────────────────────────────────────────────
function Case({ component, state, note, children }: {
  component: string; state: string; note?: string; children: ReactNode
}) {
  return (
    <div className="devah-case">
      <p className="devah-case-label">
        <span className="devah-case-comp">{component}</span>
        <span className="devah-case-state">{state}</span>
      </p>
      {note ? <p className="devah-case-note">{note}</p> : null}
      <div className="devah-case-body">{children}</div>
    </div>
  )
}

function Group({ title, blurb, children }: { title: string; blurb?: string; children: ReactNode }) {
  return (
    <section className="devah-group">
      <h2 className="devah-group-title">{title}</h2>
      {blurb ? <p className="devah-group-blurb">{blurb}</p> : null}
      {children}
    </section>
  )
}

// ── ProfileNudgeCard fixtures ───────────────────────────────────────────────
type Facts = NudgeContext['facts']

const PHONE = '+91 00000 00000'

function facts(done: Array<'avatar' | 'class' | 'phone' | 'school' | 'bio'>, guardian = false): Facts {
  const has = (k: string) => done.includes(k as any)
  return {
    avatarUrl: has('avatar') ? 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==' : null,
    classGrade: has('class') ? '11' : null,
    phone: has('phone') && !guardian ? PHONE : null,
    guardianPhone: has('phone') && guardian ? PHONE : null,
    schoolId: has('school') ? 1 : null,
    bio: has('bio') ? 'Test fixture bio — one sentence is plenty.' : null,
  }
}

function ctxOf(f: Facts, state = { dismissCount: 0, snoozedUntil: null as string | null }): NudgeContext {
  return { memberId: 999999, facts: f, state, hasGuardianColumn: true, hasStateColumns: true }
}

/**
 * The nudge fetches its own context in a mount effect, so a page rendering
 * many of them at once needs each mount to receive a DIFFERENT fixture. The
 * queue below is consumed in mount order, which for a static tree with no
 * StrictMode double-invoke (see main.tsx — there is none) is document order.
 * `key` is stamped on each card so a re-render never re-consumes.
 */
type NudgeCase = { label: string; note?: string; ctx: NudgeContext | 'hang' | 'throw' }

const NUDGE_CASES: NudgeCase[] = [
  { label: 'loading (skeleton)', note: 'getContext() never settles', ctx: 'hang' },
  { label: '0 of 5 — nothing filled in yet', ctx: ctxOf(facts([])) },
  { label: '2 of 5 — in progress', ctx: ctxOf(facts(['avatar', 'class'])) },
  { label: '4 of 5 — one item left (phone)', ctx: ctxOf(facts(['avatar', 'class', 'school', 'bio'])) },
  { label: '4 of 5 — one item left (bio)', ctx: ctxOf(facts(['avatar', 'class', 'phone', 'school'])) },
  { label: "4 of 5 — the phone item satisfied by a guardian's number", note: 'guardian_phone set, own phone null: the checklist ticks phone either way.', ctx: ctxOf(facts(['avatar', 'class', 'phone', 'school'], true)) },
  { label: '5 of 5 — complete', note: 'renders NOTHING by design: load() sees isComplete and goes straight to phase "gone". The celebration is only reachable after an in-card edit.', ctx: ctxOf(facts(['avatar', 'class', 'phone', 'school', 'bio'])) },
  { label: 'snoozed', note: 'renders NOTHING by design: nudgeVisibility() !== "show".', ctx: ctxOf(facts([]), { dismissCount: 1, snoozedUntil: new Date(Date.now() + 6e8).toISOString() }) },
  { label: 'retired (2 dismissals)', note: 'renders NOTHING by design.', ctx: ctxOf(facts([]), { dismissCount: 2, snoozedUntil: null }) },
  { label: 'load error', note: 'renders NOTHING by design — a decorative prompt must never shout. The visible error state is per-ROW: open the phone row on the "one item left (phone)" card above and save an implausible number.', ctx: 'throw' },
]

// ── ChooseTeamPage scenarios ────────────────────────────────────────────────
type TeamScenario = 'zero-open-roles' | 'roles-present' | 'already-member' | 'request-pending' | 'loading' | 'load-error'

const TEAM_SCENARIOS: { id: TeamScenario; label: string; note: string }[] = [
  { id: 'zero-open-roles', label: 'zero open roles', note: "today's real state: eight tiles, every chip is the team-kind fallback, and the band offers the openings page" },
  { id: 'roles-present', label: 'roles present', note: 'two synthetic openings, so the "n open" chips and the open-hirings band both populate' },
  { id: 'already-member', label: 'already a member', note: "pick Welfare Projects — the chip reads \"you're on this\" and the foot offers the team" },
  { id: 'request-pending', label: 'request pending', note: 'pick Events — the chip reads "request pending" and the foot says it is with the leads' },
  { id: 'loading', label: 'loading', note: 'eight card skeletons plus the band skeleton' },
  { id: 'load-error', label: 'load error', note: 'the teams read rejects' },
]

const FIXTURE_TEAMS = [
  { team_id: 1, uuid: 'aaaaaaa1-0000-4000-8000-00000000team', name: 'Events' },
  { team_id: 2, uuid: 'aaaaaaa2-0000-4000-8000-00000000team', name: 'Welfare Team' },
  { team_id: 3, uuid: 'aaaaaaa3-0000-4000-8000-00000000team', name: 'Social Media' },
  { team_id: 4, uuid: 'aaaaaaa4-0000-4000-8000-00000000team', name: 'Human Resources' },
]

const FIXTURE_OPENINGS: any[] = [
  { id: 'op-1', title: 'Test opening — events coordinator', category: 'events', teamName: 'Events', commitment: '4 hrs / week' },
  { id: 'op-2', title: 'Test opening — welfare field lead', category: 'welfare', teamName: 'Welfare Team', commitment: 'weekends' },
]

// ── AdaptiveGrid contexts, one per recipe, in evaluation order ──────────────
const NOW = new Date('2026-09-07T10:00:00Z')
const base: GridContext = { signedIn: true, firstName: 'Test', now: NOW, labsCount: 6, teamsCount: 8, openRolesCount: 0, hours: 18.5 }

const GRID_CASES: { id: GridRecipeId; ctx: GridContext }[] = [
  { id: 'G12', ctx: { ...base, upcomingSignup: { title: 'Test drive — riverside cleanup', place: 'Kolkata', inDays: 3, dateLabel: 'Thu 10 Sep', goingCount: 12, href: '/calendar' } } },
  { id: 'G04', ctx: { ...base, upcomingSignup: null, attendedCount: 4, nextOpenDrive: { title: 'Test drive — book donation', place: 'Kolkata', dateLabel: 'Sat 12 Sep', spotsLabel: '9 spots', href: '/calendar' } } },
  { id: 'G27', ctx: { ...base, attendedCount: 0, isDirector: true, queueDepth: 7, deptLabel: 'welfare and content', queues: [{ key: 'posts', label: 'posts in review', count: 5, href: '/director/content' }, { key: 'joins', label: 'join requests', count: 2, href: '/director/teams' }] } },
  { id: 'G01', ctx: { ...base, attendedCount: 0, daysSinceApproved: 2, departmentName: 'Welfare Projects' } },
  { id: 'G21', ctx: { ...base, attendedCount: 0, daysSinceApproved: 30, ownPending: { label: 'your join request is waiting', count: 1, href: '/teams' } } },
  { id: 'G09', ctx: { ...base, attendedCount: 0, daysSinceApproved: 30, ownPending: null, unreadCount: 3, savedCount: 5 } },
  { id: 'G30', ctx: { ...base, attendedCount: 0, daysSinceApproved: 30, isDirector: true, queueDepth: 0, queues: [], ownPending: null, unreadCount: 0, savedCount: 0, deptLabel: 'welfare' } },
  { id: 'G19', ctx: { ...base, attendedCount: 0, daysSinceApproved: 30, ownPending: null, unreadCount: 0, savedCount: 0 } },
  // inDays 40 fails G12's <=14 window while still failing G04's !upcomingSignup,
  // and attendedCount 2 fails G19 — so the break recipe is the first match.
  { id: 'G33', ctx: { ...base, attendedCount: 2, upcomingSignup: { title: 'Test drive — later', inDays: 40 }, breakStart: '2026-09-01', breakEnd: '2026-10-01', ownPending: null, unreadCount: 0, savedCount: 0 } },
  { id: 'G38', ctx: {} },
]

// ── the harness ─────────────────────────────────────────────────────────────
export default function AuthedSurfaces() {
  const [ready, setReady] = useState(false)
  const [teamScenario, setTeamScenario] = useState<TeamScenario>('zero-open-roles')
  // Starts CLOSED. CreatePostModal is position:fixed, so an open composer
  // covers the whole viewport and hides sections 1-4 — which defeats the point
  // of a harness you scroll through. The button below opens it on demand.
  const [composerOpen, setComposerOpen] = useState(false)
  const [newComposerOpen, setNewComposerOpen] = useState(false)
  const scenarioRef = useRef<TeamScenario>(teamScenario)
  scenarioRef.current = teamScenario

  // robots: noindex, exactly as dev/ComponentGallery.tsx does it.
  useEffect(() => {
    document.title = 'authed surfaces - AquaTerra (dev)'
    const m = document.createElement('meta')
    m.name = 'robots'; m.content = 'noindex'
    document.head.appendChild(m)
    return () => { document.head.removeChild(m) }
  }, [])

  // Install every fixture seam BEFORE the subjects mount, and restore on
  // unmount so navigating away from the harness leaves the app untouched.
  useEffect(() => {
    const realFetch = window.fetch
    const realGetContext = profileNudgeService.getContext
    const realSaveState = profileNudgeService.saveState
    const realSaveNumbers = (profileNudgeService as any).saveContactNumbers
    const realGetMember = profileService.getCurrentMember
    const realGetOpen = jobOpenings.getOpen
    const realFrom = (supabaseCommunity as any).from
    const realMyTeams = teamService.getMyTeams
    const realGetTeam = teamService.getTeam
    const realJoin = (teamService as any).createJoinRequest
    const realGetTeamOptions = teamService.getTeamOptions

    // Hard offline. Anything that slips a fixture seam fails fast instead of
    // reaching the network — and there is no session, so it could not read
    // member data in any case.
    window.fetch = (() => Promise.reject(new Error('[dev/authed] network is disabled in the preview harness'))) as any

    let cursor = 0
    profileNudgeService.getContext = (async () => {
      const c = NUDGE_CASES[Math.min(cursor++, NUDGE_CASES.length - 1)].ctx
      if (c === 'hang') return await new Promise<NudgeContext>(() => {})
      if (c === 'throw') throw new Error('[fixture] context read failed')
      return c
    }) as any
    profileNudgeService.saveState = (async () => {}) as any
    ;(profileNudgeService as any).saveContactNumbers = async () => {
      throw new Error('[fixture] writes are disabled in the preview harness')
    }
    profileService.getCurrentMember = (async () => FIXTURE_MEMBER) as any

    jobOpenings.getOpen = (async () => {
      const s = scenarioRef.current
      if (s === 'loading') return await new Promise<any[]>(() => {})
      return s === 'roles-present' ? FIXTURE_OPENINGS : []
    }) as any

    // ChooseTeamPage issues four reads through the client. Only `.select()`
    // (with optional `.eq()` chaining) is used, so a thenable chain is enough.
    ;(supabaseCommunity as any).from = (table: string) => {
      const s = scenarioRef.current
      const resolve = () => {
        if (s === 'loading') return new Promise(() => {})
        if (s === 'load-error' && table === 'teams') {
          return Promise.resolve({ data: null, error: { message: '[fixture] teams read failed', code: 'PGRST000' } })
        }
        if (table === 'teams') return Promise.resolve({ data: FIXTURE_TEAMS, error: null })
        if (table === 'team_members') {
          return Promise.resolve({ data: s === 'already-member' ? [{ team_id: 2 }] : [], error: null })
        }
        if (table === 'team_join_requests') {
          return Promise.resolve({ data: s === 'request-pending' ? [{ team_id: 1, status: 'pending' }] : [], error: null })
        }
        return Promise.resolve({ data: [], error: null })
      }
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        update: () => chain,
        order: () => chain,
        limit: () => chain,
        then: (res: any, rej: any) => resolve().then(res, rej),
        catch: (rej: any) => resolve().catch(rej),
        finally: (f: any) => resolve().finally(f),
      }
      return chain
    }

    // NOTE the shape: getMyTeams returns `data` as the Team[] itself (its
    // PaginatedResponse<Team> puts the array at `.data`, not `.data.teams`),
    // which is what CreatePostModal's `setMyTeams(result.data)` consumes.
    teamService.getMyTeams = (async () => ({
      success: true,
      data: [],
      pagination: { currentPage: 1, totalPages: 0, totalItems: 0, itemsPerPage: 50, hasNextPage: false, hasPrevPage: false },
    })) as any
    teamService.getTeam = (async () => { throw new Error('[fixture] disabled') }) as any
    // The composer's "Tag teams" picker reads every active team.
    teamService.getTeamOptions = (async () =>
      (FIXTURE_TEAMS as any[]).map(t => ({ teamId: t.team_id, name: t.name, category: t.category ?? 'welfare' }))) as any
    ;(teamService as any).createJoinRequest = async () => {
      throw new Error('[fixture] writes are disabled in the preview harness')
    }

    setReady(true)
    return () => {
      window.fetch = realFetch
      profileNudgeService.getContext = realGetContext
      profileNudgeService.saveState = realSaveState
      ;(profileNudgeService as any).saveContactNumbers = realSaveNumbers
      profileService.getCurrentMember = realGetMember
      jobOpenings.getOpen = realGetOpen
      ;(supabaseCommunity as any).from = realFrom
      teamService.getMyTeams = realMyTeams
      teamService.getTeam = realGetTeam
      teamService.getTeamOptions = realGetTeamOptions
      ;(teamService as any).createJoinRequest = realJoin
    }
  }, [])

  if (!ready) return <div style={{ padding: 40 }}>installing fixtures…</div>

  return (
    <div className="devah">
      <style>{CSS}</style>

      <header className="devah-head">
        <p className="devah-kicker">★ dev · signed-out preview harness</p>
        <h1 className="devah-title">the surfaces nobody has seen.</h1>
        <p className="devah-lede">
          Every case below is fixture-driven, session-free and offline (<code>window.fetch</code> is
          disabled while this route is mounted). No production component was given a mock code path —
          context comes from a real <code>AuthContext.Provider</code>, data comes from props or from
          service singletons swapped at this boundary and restored on unmount.
        </p>
      </header>

      {/* ── 1. ProfileNudgeCard ────────────────────────────────────────── */}
      <Group
        title="1 · components/ProfileNudgeCard"
        blurb="The in-feed 'complete your profile' card. Cards are laid out in one column at the feed's real width so the checklist wraps the way it does in the stream."
      >
        <div className="devah-feed">
          {NUDGE_CASES.map((c, i) => (
            <Case key={c.label} component="ProfileNudgeCard" state={`${i + 1}/${NUDGE_CASES.length} — ${c.label}`} note={c.note}>
              <Authed>
                <ProfileNudgeCard />
              </Authed>
            </Case>
          ))}
        </div>
        <p className="devah-foot">
          Phone modes: the &quot;my number&quot; / &quot;a guardian&apos;s&quot; segmented control lives
          inside the phone row&apos;s sub-form. Open it on any card whose phone item is still
          outstanding (&quot;add a WhatsApp number&quot; → the row&apos;s action button) — both modes,
          the helper copy and the inline validation error are reachable there with no network.
        </p>
      </Group>

      {/* ── 2. ChooseTeamPage ──────────────────────────────────────────── */}
      <Group
        title="2 · onboarding/ChooseTeamPage"
        blurb="The post-approval team picker. One scenario at a time: the page fetches on mount and every instance would otherwise share one fixture."
      >
        <div className="devah-switch" role="group" aria-label="ChooseTeamPage scenario">
          {TEAM_SCENARIOS.map(s => (
            <button
              key={s.id}
              type="button"
              className={'devah-switch-btn ' + (teamScenario === s.id ? 'is-on' : '')}
              aria-pressed={teamScenario === s.id}
              onClick={() => setTeamScenario(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <Case
          component="ChooseTeamPage"
          state={TEAM_SCENARIOS.find(s => s.id === teamScenario)!.label}
          note={TEAM_SCENARIOS.find(s => s.id === teamScenario)!.note}
        >
          <Authed>
            <Suspense fallback={<div style={{ padding: 24 }}>loading…</div>}>
              <ChooseTeamPage key={teamScenario} />
            </Suspense>
          </Authed>
        </Case>
      </Group>

      {/* ── 3. AdaptiveGrid ────────────────────────────────────────────── */}
      <Group
        title="3 · components/AdaptiveGrid — all ten recipes"
        blurb="Rendered with enrich={false}, so each block is driven purely by the ctx prop and issues no reads. Recipes are in GRID_RECIPES evaluation order; each ctx is the minimum that makes that recipe the FIRST match."
      >
        {GRID_CASES.map(({ id, ctx }) => {
          const r = GRID_RECIPES.find(x => x.id === id)!
          return (
            <Case key={id} component="AdaptiveGrid" state={`${id} — ${r.name}`} note={r.predicateText}>
              <Authed>
                <AdaptiveGrid
                  ctx={ctx}
                  enrich={false}
                  eyebrow="good morning"
                  greeting="HI TEST."
                  line="here is what is waiting on you today."
                />
              </Authed>
            </Case>
          )
        })}
      </Group>

      {/* ── 4. adminKit StatusStamp ────────────────────────────────────── */}
      <Group
        title="4 · director/adminKit — StatusStamp tones"
        blurb="Wrapped in .admin, which is what scopes styles/routes/director.css. All four tones now take full --ink as the label colour; only the 6px dot keeps the hue."
      >
        <div className="admin devah-stamps">
          <Case component="StatusStamp" state="tone=pending">
            <StatusStamp label="pending" tone="pending" />
          </Case>
          <Case component="StatusStamp" state="tone=approved">
            <StatusStamp label="approved" tone="approved" />
          </Case>
          <Case component="StatusStamp" state="tone=rejected">
            <StatusStamp label="rejected" tone="rejected" />
          </Case>
          <Case component="StatusStamp" state="tone=custom (--sky)">
            <StatusStamp label="events" tone="custom" color="var(--sky)" />
          </Case>
          <Case component="StatusStamp" state="tone=custom (--welfare)">
            <StatusStamp label="welfare" tone="custom" color="var(--welfare)" />
          </Case>
          <Case component="StatusStamp" state="tone=custom (--grape)">
            <StatusStamp label="labs" tone="custom" color="var(--grape)" />
          </Case>
        </div>
        <div className="admin devah-stamps">
          <Case component="StatusStamp" state="on a card ground (.card)">
            <div className="card" style={{ padding: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <StatusStamp label="pending" tone="pending" />
              <StatusStamp label="approved" tone="approved" />
              <StatusStamp label="rejected" tone="rejected" />
              <StatusStamp label="queued" tone="custom" color="var(--lemon)" />
            </div>
          </Case>
        </div>
      </Group>

      {/* ── 5. composer edit-and-resubmit ──────────────────────────────── */}
      <Group
        title="5 · feed/CreatePostModal — edit and resubmit"
        blurb="The composer with an editPost target, i.e. the §22.1 resubmit mode. It renders without a session: the team picker's read is stubbed to an empty list and the submit path is never taken here."
      >
        <button type="button" className="devah-switch-btn" onClick={() => setComposerOpen(o => !o)}>
          {composerOpen ? 'close the composer' : 'open the composer (resubmit mode)'}
        </button>
        <Case
          component="CreatePostModal"
          state="editPost set — resubmit mode"
          note="Submitting is blocked at the fixture boundary; the resubmit copy, the seeded body/category and the blocked-affordance messaging are what this case is for."
        >
          <Authed>
            <Suspense fallback={<div style={{ padding: 24 }}>loading…</div>}>
              <CreatePostModal
                isOpen={composerOpen}
                onClose={() => setComposerOpen(false)}
                onPostCreated={() => {}}
                editPost={{
                  uuid: '00000000-0000-4000-8000-0000000post1',
                  body: 'A rejected test post being edited and sent back for review.',
                  category: 'welfare',
                }}
              />
            </Suspense>
          </Authed>
        </Case>
        <button type="button" className="devah-switch-btn" onClick={() => setNewComposerOpen(o => !o)}>
          {newComposerOpen ? 'close the new-post composer' : 'open the composer (new post)'}
        </button>
        <Case
          component="CreatePostModal"
          state="new post — shows the Tag teams picker"
          note="No editPost: the picker lists every team from the stubbed getTeamOptions. Submitting is blocked at the fixture boundary."
        >
          <Authed>
            <Suspense fallback={<div style={{ padding: 24 }}>loading…</div>}>
              <CreatePostModal
                isOpen={newComposerOpen}
                onClose={() => setNewComposerOpen(false)}
                onPostCreated={() => {}}
              />
            </Suspense>
          </Authed>
        </Case>
      </Group>

      <footer className="devah-foot devah-end">
        <p>
          Fixture leader role is used only by AdaptiveGrid&apos;s director recipes via ctx, never by a
          role check that could widen anything: <code>{String(FIXTURE_LEADER.role)}</code>.
        </p>
      </footer>
    </div>
  )
}

const CSS = `
.devah { max-width: 1100px; margin: 0 auto; padding: var(--sp-7) var(--page-px) var(--sp-8); }
.devah-head { margin-bottom: var(--sp-8); }
.devah-kicker { font-family: var(--font-mono, monospace); text-transform: uppercase; font-size: 11px; color: var(--ink-3); margin: 0 0 4px; }
.devah-title { font-size: clamp(30px, 5vw, 48px); color: var(--ink); margin: 0 0 12px; }
.devah-lede { color: var(--ink-2); max-width: 62ch; font-size: 15px; line-height: 1.6; margin: 0; }
.devah-group { margin: 0 0 var(--sp-8); }
.devah-group-title { font-size: 20px; color: var(--ink); margin: 0 0 6px; }
.devah-group-blurb { color: var(--ink-2); max-width: 70ch; font-size: 14px; line-height: 1.6; margin: 0 0 var(--sp-5); }
.devah-case { margin: 0 0 var(--sp-6); }
.devah-case-label { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; margin: 0 0 4px; }
.devah-case-comp { font-family: var(--font-mono, monospace); font-size: 11px; color: var(--ink); background: var(--bg-2); padding: 3px 8px; border-radius: var(--r-tight, 14px); }
.devah-case-state { font-size: 13px; color: var(--ink-2); font-weight: 600; }
.devah-case-note { margin: 0 0 8px; font-size: 12.5px; line-height: 1.55; color: var(--ink-3); max-width: 72ch; }
.devah-case-body { }
.devah-feed { max-width: 620px; }
.devah-switch { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 var(--sp-5); }
.devah-switch-btn { min-height: 44px; min-width: 44px; padding: 10px 16px; border-radius: var(--r-pill, 999px); border: 1px solid rgba(10,10,10,0.16); background: var(--card, #fff); color: var(--ink); font: inherit; font-size: 13px; cursor: pointer; }
.devah-switch-btn.is-on { background: var(--ink); color: var(--paper, #F4EFE0); border-color: var(--ink); }
.devah-stamps { display: flex; flex-wrap: wrap; gap: var(--sp-5); align-items: flex-start; }
.devah-foot { font-size: 13px; line-height: 1.6; color: var(--ink-2); max-width: 72ch; }
.devah-end { margin-top: var(--sp-8); padding-top: var(--sp-5); border-top: 1px solid rgba(10,10,10,0.12); }
`
