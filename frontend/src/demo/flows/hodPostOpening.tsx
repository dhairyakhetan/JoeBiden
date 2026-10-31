import { Routes, Route } from 'react-router-dom'
import TeamDetailPage from '../../teams/TeamDetailPage'
import { buildFakeMember, type Member } from '../runtime/fakeIdentity'
import type { TableHandler, HandlerCtx } from '../runtime/queryBuilder'
import { clickElement, setReactFieldValue, findByText, nextFrame } from '../coach/domActions'
import type { DemoFlow, FixtureStore } from './types'

// ── 19.4: "A HoD posts an opening" (4 steps). UNLIKE the other two HoD
// flows, this one's real screen is teams/TeamDetailPage.tsx at
// `/teams/:uuid` - checked directly rather than assumed, and it is NOT part
// of the director/* desk at all. director/HiringResponses.tsx (the desk's
// own "Hiring" tab) only reviews applications that already exist; there is
// no "post a new opening" surface anywhere under /director. A team's
// openings are managed from the team's own page - so this flow renders in
// the front-end's neubrutalist system, not the brutalist admin desk, even
// though the acting member is a HoD. That is a real, verified fact about
// this codebase, not a shortcut: `git grep` for "Add Opening" turns up
// exactly teams/TeamDetailPage.tsx/OpeningsTab.tsx and nothing under
// director/. The ribbon still states the borrowed role either way (19.4's
// own rule is about the ROLE being borrowed, not about which visual system
// the screen happens to use).
//
// Same `<Routes location>` override wallNote.tsx established (TeamDetailPage
// also reads its subject from `useParams<{uuid}>()`), but this Backdrop does
// NOT get DemoFlowPage's `demo-hod-flow` body class - `/teams/:uuid` is a
// normal PublicLayout route in the real app too (App.tsx groups it with
// /opportunities, /members, /post/:uuid - all under the same <Route
// element={<PublicLayout/>}>), so the public nav belongs here for real and
// hiding it would be the wrong fix for a screen that isn't part of the desk.
//
// Step 3 fills two REQUIRED fields (title, description - OpeningEditModal's
// own handleSave rejects an empty either one) as one coach step, the same
// "findTarget tracks which control still needs the visitor" technique
// generateCv.tsx uses for its own two-field save: it spotlights the title
// field until it has real content, then seamlessly moves to the description
// field - never spotlighting a field that isn't actually next, and never
// leaving a manual clicker stuck on a submit button that stays disabled for
// a reason the coach mark never pointed at.
const TEAM_UUID = '00000000-0000-4000-b800-000000000001'
const OPENING_TITLE = 'Photography Volunteer'
const OPENING_DESCRIPTION = 'Cover our drives and events with your phone or a camera - we need someone who actually enjoys showing up early for good light.'

function buildTeamFixture() {
  return {
    team_id: 42,
    uuid: TEAM_UUID,
    name: 'Content',
    description: 'Photography, design and the stories that go out under the AquaTerra name.',
    category: 'content',
    logo_url: null,
    banner_url: null,
    skills: ['photography', 'design', 'writing'],
    created_at: new Date(Date.now() - 500 * 86_400_000).toISOString(),
    created_by: 700001,
    creator: { full_name: 'Trina Basak', uuid: '00000000-0000-4000-b800-000000000099' },
    team_members: [],
  }
}

function buildHandlers({ member, store }: { member: Member; store: FixtureStore }): Record<string, TableHandler> {
  store.seed('teams', [buildTeamFixture()])
  store.seed('job_openings', [])
  store.seed('posts', [])

  return {
    'rpc:get_own_member': () => ({ data: [member], error: null }),
    members: (ctx) => {
      const targetsThisMember = ctx.filters.some(f => f.method === 'eq' && (f.args[0] === 'member_id' ? f.args[1] === member.member_id : f.args[0] === 'auth_uid' ? f.args[1] === member.auth_uid : false))
      return { data: targetsThisMember ? [member] : [], error: null }
    },

    teams: (ctx: HandlerCtx) => {
      const rows = store.rows('teams') as any[]
      const uuidFilter = ctx.filters.find(f => f.method === 'eq' && f.args[0] === 'uuid')
      if (uuidFilter) return { data: rows.filter(r => r.uuid === uuidFilter.args[1]), error: null }
      // getTeams({category, limit}) - "more teams like this" rail. None
      // needed for this flow's own steps; empty is honest (a fresh fixture
      // team really does have no siblings seeded).
      return { data: [], error: null }
    },

    // teamService.createTeamPost()'s own insert (the auto-announce-on-the-
    // feed post OpeningEditModal fires for every NEW opening, before the
    // opening row itself is created - see that file's handleSave). Answering
    // this for real (rather than leaving it unregistered) is what lets the
    // demo reach OpeningEditModal's OWN best-case toast ("Live on the
    // Openings tab and announced in the feed") instead of its degraded
    // "the feed announcement didn't go through" branch.
    posts: (ctx: HandlerCtx) => {
      if (ctx.op === 'insert') {
        const payload = ctx.payload as Record<string, unknown>
        const row = { post_id: 5000 + store.rows('posts').length, uuid: `00000000-0000-4000-b800-0000000009${store.rows('posts').length}`, ...payload }
        store.insert('posts', row)
        return { data: [row], error: null }
      }
      return { data: [], error: null }
    },
    post_images: () => ({ data: [], error: null }),
    post_tags: () => ({ data: [], error: null }),
    post_documents: () => ({ data: [], error: null }),

    job_openings: (ctx: HandlerCtx) => {
      const rows = store.rows('job_openings') as any[]
      if (ctx.op === 'insert') {
        const payload = ctx.payload as Record<string, unknown>
        const row = {
          id: `00000000-0000-4000-b800-0000000001${String(rows.length).padStart(2, '0')}`,
          status: 'open',
          created_at: new Date().toISOString(),
          ...payload,
        }
        store.insert('job_openings', row)
        return { data: [row], error: null }
      }
      const teamNameFilter = ctx.filters.find(f => f.method === 'eq' && f.args[0] === 'team_name')
      const notDeleted = rows.filter(r => r.status !== 'deleted')
      if (teamNameFilter) return { data: notDeleted.filter(r => r.team_name === teamNameFilter.args[1]), error: null }
      return { data: notDeleted, error: null }
    },
    job_applications: () => ({ data: [], error: null }),
    welfare_projects: () => ({ data: [], error: null }),
  }
}

// `<Routes location>` override, same restriction as wallNote.tsx/the
// director-desk flows: must start with the branch already matched to reach
// this Backdrop.
const teamLocation = { pathname: `/demo/hod-post-opening/teams/${TEAM_UUID}`, search: '', hash: '', state: null, key: 'demo-hod-post-opening' }

const flow: DemoFlow = {
  id: 'hod-post-opening',
  name: 'A HoD posts an opening',
  durationLabel: 'about a minute',
  role: 'hod',
  roleBorrowed: true,
  buildMember: () => buildFakeMember({ fullName: 'Trina Basak', role: 'hod', classGrade: '12' }),
  buildHandlers,
  Backdrop: () => (
    <Routes location={teamLocation}>
      <Route path="teams/:uuid" element={<TeamDetailPage />} />
    </Routes>
  ),
  steps: [
    {
      id: 'open-tab',
      title: "Open your team's openings.",
      body: "Every role your team needs lives here - and only a lead or a HoD can post one.",
      findTarget: () => document.querySelector<HTMLElement>('#tab-openings'),
      doItForMe: ({ target }) => clickElement(target),
      isComplete: () => document.querySelector('#tab-openings')?.getAttribute('aria-selected') === 'true',
    },
    {
      id: 'add-opening',
      title: 'Post one.',
      body: 'Nobody has to wait for a director to do this - it takes about a minute.',
      findTarget: () => findByText(document, 'button', 'Add Opening'),
      doItForMe: ({ target }) => clickElement(target),
      isComplete: () => !!document.querySelector('[aria-label="Add opening"]'),
    },
    {
      id: 'describe-it',
      title: 'Say what you need.',
      body: "A title and a couple of honest sentences - that's the whole listing.",
      findTarget: () => {
        const modal = document.querySelector<HTMLElement>('[aria-label="Add opening"]')
        if (!modal) return null
        const title = modal.querySelector<HTMLInputElement>('input')
        if (title && title.value.trim().length < 3) return title
        return modal.querySelector<HTMLTextAreaElement>('textarea')
      },
      doItForMe: async ({ target }) => {
        if (!target) return
        if (target instanceof HTMLInputElement) {
          setReactFieldValue(target, OPENING_TITLE)
          await nextFrame()
          await nextFrame()
          const modal = document.querySelector<HTMLElement>('[aria-label="Add opening"]')
          const textarea = modal?.querySelector<HTMLTextAreaElement>('textarea')
          if (textarea) setReactFieldValue(textarea, OPENING_DESCRIPTION)
          return
        }
        setReactFieldValue(target as HTMLTextAreaElement, OPENING_DESCRIPTION)
      },
      isComplete: () => {
        const modal = document.querySelector<HTMLElement>('[aria-label="Add opening"]')
        if (!modal) return false
        const title = modal.querySelector<HTMLInputElement>('input')
        const desc = modal.querySelector<HTMLTextAreaElement>('textarea')
        return (title?.value.trim().length ?? 0) >= 3 && (desc?.value.trim().length ?? 0) >= 3
      },
    },
    {
      id: 'submit',
      title: 'Send it.',
      body: 'It posts to the Openings tab and to the feed at the same time - the whole team sees it immediately.',
      manualHint: 'or tap the arrow yourself',
      // handleSave() closes the modal (onClose()) in the same async function
      // that reports success, so - same shape as every other "send" step in
      // this pass - watch what the submit leaves behind: the new opening
      // card, which did not exist anywhere before this click ("no openings
      // posted yet" was the tab's own empty state one step ago).
      findTarget: () => findByText(document, 'button', 'post opening'),
      doItForMe: ({ target }) => clickElement(target),
      isComplete: () => !!document.querySelector('[id^="opening-"]'),
    },
  ],
  endCard: {
    kicker: '★ that\'s the whole loop',
    headline: <>you just<br />posted an<br />opening.</>,
    body: "Live on the team's page and the feed, right now - no approval queue, because leads run their own team.",
  },
}

export default flow
