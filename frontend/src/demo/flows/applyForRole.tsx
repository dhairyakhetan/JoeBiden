import OpportunitiesPage from '../../public/OpportunitiesPage'
import { buildFakeMember, type Member } from '../runtime/fakeIdentity'
import type { TableHandler } from '../runtime/queryBuilder'
import { clickElement, setReactFieldValue, findByText } from '../coach/domActions'
import type { DemoFlow, FixtureStore } from './types'

// ── One fictional open role. 19.5: fictional-but-plausible, no blocked stat,
// no real member. The commitment/skills/custom-question text is invented for
// this fixture, not copied from any real live opening. ────────────────────
const OPENING_ID = '00000000-0000-4000-b000-000000000001'
const CUSTOM_QUESTION_ID = 'hours-per-week'

function futureIso(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 86_400_000).toISOString()
}
function pastIso(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString()
}

function buildOpeningFixture() {
  return {
    id: OPENING_ID,
    title: 'Event Day Volunteer',
    description: 'Help run the room on the day itself - registration desk, directing people, keeping the schedule honest. No experience needed, just show up on time and stay calm when the schedule slips (it will).',
    category: 'events',
    team_name: 'Events',
    skills: ['punctual', 'good with people', 'calm under pressure'],
    commitment: '3-4 hrs, one Saturday',
    deadline: futureIso(14),
    status: 'open',
    closed_at: null,
    deleted_at: null,
    created_by_name: 'Sameera Iyer',
    created_by_role: 'hod',
    created_at: pastIso(5),
    linked_post_id: null,
    custom_questions: [
      { id: CUSTOM_QUESTION_ID, label: 'How many hours a week can you realistically commit?', type: 'text', required: false },
    ],
  }
}

const ANSWER_TEXT = 'Around 3-4 hours most weekends.'
const MESSAGE_TEXT = "I've helped run two school events before and I like the logistics side more than being on stage."
const PHONE_TEXT = '98765 43210'

function buildHandlers({ member, store }: { member: Member; store: FixtureStore }): Record<string, TableHandler> {
  store.seed('job_openings', [buildOpeningFixture()])

  return {
    'rpc:get_own_member': () => ({ data: [member], error: null }),

    // jobOpenings.ts's currentMemberIsLeader() (the auto-pause sweep gate) -
    // same narrow shape as postToFeed.tsx's members handler: answer only the
    // exact .eq('member_id', <this member>) lookup, empty otherwise.
    members: (ctx) => {
      const targetsThisMember = ctx.filters.some(f => f.method === 'eq' && f.args[0] === 'member_id' && f.args[1] === member.member_id)
      return { data: targetsThisMember ? [member] : [], error: null }
    },

    job_openings: (ctx) => {
      const idFilter = ctx.filters.find(f => f.method === 'eq' && f.args[0] === 'id')
      const rows = store.rows('job_openings')
      if (idFilter) return { data: rows.filter((r: any) => r.id === idFilter.args[1]), error: null }
      return { data: rows, error: null }
    },

    job_applications: (ctx) => {
      if (ctx.op === 'insert') {
        store.insert('job_applications', ctx.payload)
        return { data: [ctx.payload], error: null }
      }
      // The "have I already applied" check (OpeningCard's hasApplied effect) -
      // this fixture's member never has, so the real "Apply ->" button stays
      // live instead of flipping to a static "already applied" badge.
      return { data: [], error: null }
    },

    // The apply() notification fire-and-forget chain looks these up to find
    // who to notify - best-effort and never awaited by the UI, so an empty
    // result is enough: it just means the (fake, undelivered) notification
    // resolves to zero recipients instead of resolving to nobody with an error.
    teams: () => ({ data: [], error: null }),
    team_members: () => ({ data: [], error: null }),
  }
}

const flow: DemoFlow = {
  id: 'apply-for-role',
  name: 'Apply for a role',
  durationLabel: 'about two minutes',
  role: 'member',
  roleBorrowed: false,
  buildMember: () => buildFakeMember({ fullName: 'Nabanita Roy', role: 'member', classGrade: '10' }),
  buildHandlers,
  Backdrop: () => <OpportunitiesPage />,
  steps: [
    {
      id: 'open-apply',
      title: 'Found one? Tap Apply.',
      body: 'Every open role is real - a lead posted it because the team actually needs the help.',
      // The real card's own id="opening-<id>" (OpeningCard) - "opening-" always
      // makes this a letter-led, unescaped-safe CSS identifier even though the
      // fixture's own id is a uuid-shaped string starting with a digit.
      findTarget: () => findByText(document, `#opening-${OPENING_ID} button`, 'Apply'),
      doItForMe: ({ target }) => clickElement(target),
      isComplete: () => !!document.querySelector('[aria-label^="Apply for"]'),
    },
    {
      id: 'phone',
      title: 'Add your number.',
      body: "The team lead uses this to reach you if you're picked - never shared beyond them.",
      findTarget: () => document.querySelector<HTMLInputElement>('[aria-label^="Apply for"] input[type="tel"]'),
      doItForMe: ({ target }) => setReactFieldValue(target as HTMLInputElement, PHONE_TEXT),
      isComplete: (target) => ((target as HTMLInputElement | null)?.value.trim().length ?? 0) >= 10,
    },
    {
      id: 'message',
      title: "Tell them why you're a good fit.",
      body: 'A couple of honest sentences beat a polished cover letter - this is a real person reading it.',
      findTarget: () => document.querySelector<HTMLTextAreaElement>('[aria-label^="Apply for"] textarea'),
      doItForMe: ({ target }) => setReactFieldValue(target as HTMLTextAreaElement, MESSAGE_TEXT),
      isComplete: (target) => ((target as HTMLTextAreaElement | null)?.value.trim().length ?? 0) >= 10,
    },
    {
      id: 'custom-question',
      title: 'Answer their one question.',
      body: "Some roles ask something specific. This one just wants a realistic number.",
      findTarget: () => document.querySelector<HTMLInputElement>('[aria-label^="Apply for"] input.input'),
      doItForMe: ({ target }) => setReactFieldValue(target as HTMLInputElement, ANSWER_TEXT),
      isComplete: (target) => ((target as HTMLInputElement | null)?.value.trim().length ?? 0) >= 3,
    },
    {
      id: 'submit',
      title: 'Now send it.',
      body: "The team lead sees it immediately and usually replies within a week, either way.",
      manualHint: 'or tap the arrow yourself',
      // Found by actually submitting and watching it happen: OpeningCard's
      // onApplied callback (onClose + setHasApplied in the SAME synchronous
      // handler submit() calls) closes this dialog immediately on success -
      // there is no "you're in." pause to observe here at all (unlike the
      // feed composer's ~800ms "posted!" window), so a check against the
      // dialog's own content can never fire; by the time any frame could
      // read it, the dialog is simply gone. isComplete instead watches the
      // one thing that DOES survive success: the opening card's "applied"
      // badge, which OpeningCard only ever renders once hasApplied flips -
      // never on a plain Cancel/backdrop dismissal. Spotlighting still
      // targets the dialog (that's where the visitor is actually looking).
      findTarget: () => document.querySelector<HTMLElement>('[aria-label^="Apply for"]'),
      doItForMe: ({ target }) => {
        if (!target) return
        const button = findByText(target, 'button', 'Submit application')
        if (button) clickElement(button)
      },
      isComplete: () => {
        const card = document.getElementById(`opening-${OPENING_ID}`)
        return !!card && /applied/i.test(card.textContent || '')
      },
    },
  ],
  endCard: {
    kicker: '★ that\'s the whole loop',
    headline: <>you just<br />applied for<br />a role.</>,
    body: "That's it - no CV, no cover letter. A real team lead reads every application and replies either way, usually within a week.",
  },
}

export default flow
