import { useEffect, useMemo, useRef, useState } from 'react'
import AuthContext from '../auth/AuthContext'
import { makeDevPreviewMember } from '../lib/devPreview'
import BugReportsPage from '../bugs/BugReportsPage'
import BugShortcut from '../bugs/BugShortcut'
import { bugReportService, type BugReport, type BugReportEvent } from '../services/bugReportService'

/**
 * /dev/bugs: the /bugs page against an in-memory fake, no session, no network.
 *
 * Same rule as /dev/authed and /dev/desk: no production component gains a mock path. The
 * `bugReportService` singleton's methods are swapped here and restored on unmount, and
 * cross-origin `fetch` is disabled so a missed seam fails fast instead of reaching Supabase.
 *
 * The fake mirrors the database triggers closely enough to exercise the UI honestly:
 * solving also takes it up, reopening clears verification, verifying needs solved, and an
 * approval is recorded. It does NOT prove the real rules; that is the rolled-back
 * simulations recorded in scripts/bug_reports_2026_10_05.sql.
 *
 * Every fixture is obviously synthetic. DEV-only: App.tsx imports this behind
 * `import.meta.env.DEV`, so Rollup drops it from the production bundle.
 */

type Scenario = 'member' | 'leader' | 'empty' | 'loading' | 'error'

const T = (mins: number) => new Date(Date.UTC(2026, 9, 5, 10, 0) - mins * 60_000).toISOString()

// A tiny labelled placeholder instead of a real screenshot (no real member data in fixtures).
const shot = (label: string, hue: string) =>
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="780"><rect width="390" height="780" fill="${hue}"/>` +
    `<text x="195" y="390" font-family="sans-serif" font-size="28" text-anchor="middle" fill="#0A0A0A">${label}</text></svg>`)

const base = (over: Partial<BugReport>): BugReport => ({
  id: 'x', created_at: T(60), updated_at: T(60),
  reporter_member_id: 900, reporter_uuid: '00000000-0000-4000-8000-000000000dev', reporter_name: 'Test Member', reporter_role: 'member',
  page_url: 'https://www.ngoaquaterra.com/projects/1018', page_path: '/projects/1018',
  viewport_w: 390, viewport_h: 780, user_agent: null, capture_method: 'shortcut',
  severity: 'med', kind: 'bug', description: 'x', screenshots: [], attachments: [],
  approved_for_fix: false, approved_by: null,
  taken_up: false, taken_up_at: null, solved: false, solved_at: null,
  verified: false, verified_at: null, verified_by: null,
  declined_reason: null, needs_info_note: null, fix_pr_url: null, resolution_note: null,
  ...over,
})

function fixtures(): { bugs: BugReport[]; events: BugReportEvent[] } {
  const bugs: BugReport[] = [
    base({ id: 'b1', created_at: T(30), severity: 'high', screenshots: ['t/one.png', 't/two.png'],
      description: 'the sticker has overflowing text that crops the home button on a phone. it only happens on the projects page and only when the title is long.' }),
    base({ id: 'b2', created_at: T(300), reporter_member_id: 901, reporter_name: 'Test Leader', reporter_role: 'hod', capture_method: 'form',
      approved_for_fix: true, approved_by: 901, taken_up: true, taken_up_at: T(200), severity: 'med',
      page_url: 'https://www.ngoaquaterra.com/director/member-of-month', page_path: '/director/member-of-month',
      description: 'the member of the month desk does not let a head of department choose a second member for the same team.' }),
    base({ id: 'b3', created_at: T(1500), reporter_member_id: 901, reporter_name: 'Test Leader', reporter_role: 'hod',
      approved_for_fix: true, taken_up: true, solved: true, solved_at: T(1000), severity: 'low',
      fix_pr_url: 'https://github.com/example/example/pull/1', resolution_note: 'Fixed by widening the picker.',
      page_path: '/teams', page_url: 'https://www.ngoaquaterra.com/teams', description: 'a typo in the teams page heading.' }),
    base({ id: 'b4', created_at: T(3000), reporter_member_id: 901, reporter_name: 'Test Leader', reporter_role: 'hod',
      approved_for_fix: true, taken_up: true, solved: true, verified: true, verified_by: 901, severity: 'high',
      page_path: '/', page_url: 'https://www.ngoaquaterra.com/', description: 'the home page flickers on first load.' }),
    base({ id: 'b6', created_at: T(20), reporter_member_id: 901, reporter_name: 'Test Leader', reporter_role: 'hod',
      approved_for_fix: true, taken_up: true, severity: 'low', page_path: '/faq', page_url: 'https://www.ngoaquaterra.com/faq',
      needs_info_note: 'Which question on the FAQ page? Please describe what you saw.', description: 'something looks wrong on the faq.' }),
    base({ id: 'b7', created_at: T(10), reporter_member_id: 901, reporter_name: 'Test Leader', reporter_role: 'hod', kind: 'feature',
      approved_for_fix: true, severity: 'high', page_path: '/director', page_url: 'https://www.ngoaquaterra.com/director',
      attachments: ['00000000-0000-4000-8000-000000000dev/11111111-1111-4111-8111-111111111111-approval-brief.pdf', '00000000-0000-4000-8000-000000000dev/22222222-2222-4222-8222-222222222222-notes.txt'],
      description: 'a head of department should be able to attach a file when they approve a post, so the author sees the reason.' }),
    base({ id: 'b5', created_at: T(4000), reporter_member_id: 902, reporter_name: 'Another Member',
      declined_reason: 'Works as designed: posts wait for a leader to approve them.',
      page_path: '/my-posts', page_url: 'https://www.ngoaquaterra.com/my-posts', description: 'my post is not showing on the feed yet.' }),
  ]
  const ev = (id: number, bug_id: string, mins: number, label: string, kind: string, note: string | null = null): BugReportEvent =>
    ({ id, bug_id, at: T(mins), actor_member_id: null, actor_label: label, kind, note })
  const events: BugReportEvent[] = [
    ev(1, 'b1', 30, 'Test Member', 'filed', 'filed by a member, waiting for a leader to approve it for fixing'),
    ev(2, 'b2', 300, 'Test Leader', 'filed', 'filed by a leader, approved for fixing'),
    ev(3, 'b2', 200, 'routine', 'taken_up'),
    ev(4, 'b3', 1500, 'Test Leader', 'filed', 'filed by a leader, approved for fixing'),
    ev(5, 'b3', 1000, 'routine', 'solved', 'https://github.com/example/example/pull/1'),
    ev(6, 'b5', 4000, 'Another Member', 'filed', 'filed by a member, waiting for a leader to approve it for fixing'),
    ev(7, 'b5', 3900, 'Test Leader', 'declined', 'Works as designed: posts wait for a leader to approve them.'),
  ]
  return { bugs, events }
}

export default function BugSurfaces() {
  const [scenario, setScenario] = useState<Scenario>('leader')
  const [ready, setReady] = useState(false)
  const store = useRef(fixtures())
  // Test seam, dev only: lets a browser test change the 'database' behind the page's back.
  ;(window as any).__bugStore = store
  const scenarioRef = useRef<Scenario>(scenario)
  scenarioRef.current = scenario

  useEffect(() => {
    const real = { ...bugReportService }
    const realFetch = window.fetch
    // Cross-origin requests (Supabase, analytics) fail fast. Same-origin static files stay
    // reachable on purpose: the shortcut's page capture reads the site's own fonts and
    // images, and blocking those would test a degraded capture, not the real one.
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href)
      if (url.origin !== window.location.origin) return Promise.reject(new Error('[dev/bugs] cross-origin network is disabled in the preview harness'))
      return realFetch.call(window, input as any, init)
    }) as typeof window.fetch
    let nextEvent = 100

    bugReportService.list = async () => {
      const s = scenarioRef.current
      if (s === 'loading') return await new Promise<BugReport[]>(() => {})
      if (s === 'error') throw new Error('[fixture] list failed')
      if (s === 'empty') return []
      // RLS: a member sees only their own rows.
      return s === 'member' ? store.current.bugs.filter(b => b.reporter_member_id === 900) : [...store.current.bugs]
    }
    bugReportService.events = async ids => store.current.events.filter(e => ids.includes(e.bug_id))
    bugReportService.attachmentUrls = async paths => Object.fromEntries(paths.map(p => [p, 'https://fixture.invalid/' + encodeURIComponent(p)]))
    bugReportService.signedUrls = async paths => Object.fromEntries(paths.map((p, i) => [p, shot('screenshot ' + (i + 1), i % 2 ? '#DDEFFF' : '#FFF3C4')]))
    bugReportService.submit = async (_uuid, input) => {
      const id = 'new' + nextEvent++
      const leader = scenarioRef.current === 'leader'
      const row = base({
        id, created_at: new Date().toISOString(), reporter_member_id: leader ? 901 : 900,
        reporter_name: leader ? 'Test Leader' : 'Test Member', reporter_role: leader ? 'hod' : 'member',
        page_url: input.pageUrl, page_path: input.pagePath, severity: input.severity, kind: input.kind,
        description: input.description, screenshots: input.files.map((_, i) => `t/new-${i}.png`),
        attachments: (input.attachments ?? []).map((f, i) => `00000000-0000-4000-8000-000000000dev/${'3'.repeat(8)}-3333-4333-8333-333333333333-${f.name.toLowerCase()}`.replace(/\s+/g, '-') + (i ? '' : '')),
        capture_method: input.captureMethod, approved_for_fix: leader,
      })
      store.current.bugs = [row, ...store.current.bugs]
      store.current.events.push({ id: nextEvent++, bug_id: id, at: new Date().toISOString(), actor_member_id: null,
        actor_label: row.reporter_name!, kind: 'filed',
        note: leader ? 'filed by a leader, approved for fixing' : 'filed by a member, waiting for a leader to approve it for fixing' })
      return id
    }
    bugReportService.update = async (id, patch) => {
      const cur = store.current.bugs.find(b => b.id === id)
      if (!cur) throw new Error('[fixture] not found')
      const next: BugReport = { ...cur, ...patch, updated_at: new Date().toISOString() }
      const log = (kind: string, note: string | null = null) =>
        store.current.events.push({ id: nextEvent++, bug_id: id, at: new Date().toISOString(), actor_member_id: null, actor_label: 'Test Leader', kind, note })
      if (patch.description !== undefined && patch.description !== cur.description) {
        // Mirrors the database: only while waiting; a member's edit takes the approval away.
        if (cur.taken_up || cur.solved || cur.declined_reason) throw new Error('[fixture] already being worked on')
        const leader = scenarioRef.current === 'leader'
        if (!leader && cur.approved_for_fix) { next.approved_for_fix = false; next.approved_by = null }
        log('edited', 'previous text: ' + cur.description.slice(0, 900))
      }
      if (patch.taken_up !== undefined && patch.taken_up !== cur.taken_up) log(patch.taken_up ? 'taken_up' : 'untaken')
      if (patch.solved !== undefined && patch.solved !== cur.solved) {
        if (patch.solved) { next.taken_up = true; log('solved') } else {
          // Mirrors the database: a leader's send-back clears taken_up so the routine claims it again.
          next.verified = false; next.taken_up = false
          next.rework_count = (cur.rework_count ?? 0) + 1
          log('reopened', patch.rework_note ?? null)
        }
      }
      if (patch.verified !== undefined && patch.verified !== cur.verified) {
        if (patch.verified && !next.solved) throw new Error('only a solved report can be verified')
        log(patch.verified ? 'verified' : 'unverified')
      }
      if (patch.approved_for_fix && !cur.approved_for_fix) { next.approved_by = 901; log('approved_for_fix') }
      if (patch.declined_reason && patch.declined_reason !== cur.declined_reason) log('declined', patch.declined_reason)
      if (patch.severity && patch.severity !== cur.severity) log('severity_changed', cur.severity + ' to ' + patch.severity)
      store.current.bugs = store.current.bugs.map(b => (b.id === id ? next : b))
      return next
    }

    setReady(true)
    return () => {
      Object.assign(bugReportService, real)
      window.fetch = realFetch
    }
  }, [])

  const member = useMemo(() => {
    const leader = scenario === 'leader'
    return {
      ...makeDevPreviewMember(leader ? 'director' : 'member'),
      member_id: leader ? 901 : 900,
      uuid: '00000000-0000-4000-8000-000000000dev',
      full_name: leader ? 'Test Leader' : 'Test Member',
    } as any
  }, [scenario])

  const value = useMemo(() => ({
    member, isLoading: false, isAuthenticated: true, memberLoadFailed: false,
    logout: async () => {}, refreshMember: async () => {},
  }), [member])

  if (!ready) return <div style={{ padding: 40 }}>installing fixtures...</div>

  return (
    <AuthContext.Provider value={value as any}>
      <div style={{ padding: '12px var(--page-px, 16px)', display: 'flex', gap: 8, flexWrap: 'wrap' }} role="group" aria-label="scenario">
        {(['member', 'leader', 'empty', 'loading', 'error'] as Scenario[]).map(s => (
          <button key={s} type="button" aria-pressed={scenario === s} className={'chip ' + (scenario === s ? 'chip-active' : '')}
            onClick={() => setScenario(s)}>{s}</button>
        ))}
      </div>
      {/* The real shortcut, mounted here because the app-level one sees a signed-out visitor. */}
      <BugShortcut />
      <BugReportsPage key={scenario} />
    </AuthContext.Provider>
  )
}
