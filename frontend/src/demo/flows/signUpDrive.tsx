import OpportunitiesPage from '../../public/OpportunitiesPage'
import { buildFakeMember, type Member } from '../runtime/fakeIdentity'
import type { TableHandler } from '../runtime/queryBuilder'
import { clickElement, setReactFieldValue, findByText } from '../coach/domActions'
import type { DemoFlow, FixtureStore } from './types'

// ── 19.4: "Sign up for a drive" (3 steps, "the shortest, good for
// impatience"). 19.1's Unresolved #1 rule applies here in a way it didn't for
// applyForRole.tsx: THERE IS NO DISTINCT ADVANCE-SIGNUP FEATURE FOR A DRIVE
// IN THE LIVE APP. Checked directly rather than assumed:
//   - HomePage.tsx's own comments say it outright: "no service exposes the
//     member's own accepted signups for a drive still ahead" and "the page
//     fetches no drive rows" (search HomePage.tsx for `upcomingSignup`).
//   - `drive_attendance` (certificateService.getHoursSummary's own source) is
//     written at CHECK-IN time by a lead standing at the drive with a phone
//     (drives/DriveCheckIn.tsx, gated to that drive's lead/a director) - it
//     records who showed up, not who signed up in advance.
//   - The feed's own "upcoming drive" card (feed/cards/family03Records.tsx,
//     CardDrive) even LOOKS like it has one - the CTA defaults to "Put my
//     name down" - but that comment block says the filled/needed pair behind
//     it "is prose, not a filled/needed pair" and is never populated on a
//     real row; the button just links to the drive's own (read-only) detail
//     page, which - checked directly - offers nothing beyond a past-tense
//     "joined this drive" stat linking to /members.
//
// So the closest REAL mechanic a member has for "putting their name down for
// a specific drive" is the same one applyForRole.tsx demos generically: a
// job_openings row a lead posted, with `category: 'welfare'` and a
// `commitment` that names one specific date rather than an ongoing role.
// OpeningEditModal.tsx (director's/lead's posting screen, see
// hodPostOpening.tsx) puts no restriction on this - "commitment" is a free
// text field, and leads really do post one-off, single-day openings
// alongside ongoing ones. This flow's fixture opening is framed that way
// (a specific Saturday, not "help the welfare team"), and its 3 steps are a
// genuine SUBSET of applyForRole.tsx's 5 (open -> phone -> submit, skipping
// the optional message and the custom question) - both true to the same
// real form, not two different features wearing the same UI. Reported in
// the build's final summary as a discovered gap + the judgment call made
// about it, per this pass's own instructions on exactly this situation.
const OPENING_ID = '00000000-0000-4000-b000-000000000002'

function futureIso(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 86_400_000).toISOString()
}
function pastIso(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString()
}

function buildOpeningFixture() {
  return {
    id: OPENING_ID,
    title: 'Winter Blanket Drive - Saturday Volunteer',
    description: 'One morning, one van, a hundred blankets - Topsia this time. We need hands to load, carry and hand them out. No experience needed.',
    category: 'welfare',
    team_name: 'Welfare',
    skills: ['punctual', 'can lift a box'],
    commitment: 'one Saturday, 9am-1pm',
    deadline: futureIso(9),
    status: 'open',
    closed_at: null,
    deleted_at: null,
    created_by_name: 'Ishita Banerjee',
    created_by_role: 'hod',
    created_at: pastIso(2),
    linked_post_id: null,
    // No custom questions, deliberately - see this file's header comment:
    // the 3-step version of this real form skips both the optional message
    // AND any custom question, which only exists at all when a lead added
    // one (lib/jobOpenings.ts's CustomQuestion[]).
    custom_questions: [],
  }
}

const PHONE_TEXT = '90512 34567'

function buildHandlers({ member, store }: { member: Member; store: FixtureStore }): Record<string, TableHandler> {
  store.seed('job_openings', [buildOpeningFixture()])

  return {
    'rpc:get_own_member': () => ({ data: [member], error: null }),

    // Same narrow shape as applyForRole.tsx's own members handler - the
    // auto-pause sweep's currentMemberIsLeader() check (lib/jobOpenings.ts).
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
      // hasApplied() - this fixture's member never has, so "Apply ->" stays live.
      return { data: [], error: null }
    },

    // apply()'s fire-and-forget "tell the lead" notification lookup chain -
    // never awaited by the UI, so empty is enough (resolves to zero
    // recipients rather than an error).
    teams: () => ({ data: [], error: null }),
    team_members: () => ({ data: [], error: null }),
  }
}

const flow: DemoFlow = {
  id: 'sign-up-drive',
  name: 'Sign up for a drive',
  durationLabel: 'under a minute',
  role: 'member',
  roleBorrowed: false,
  buildMember: () => buildFakeMember({ fullName: 'Ritwik Sarkar', role: 'member', classGrade: '9' }),
  buildHandlers,
  Backdrop: () => <OpportunitiesPage />,
  steps: [
    {
      id: 'open-apply',
      title: 'Found one? Put your name down.',
      body: 'Every open shift is real - a lead posted this because Saturday actually needs more hands.',
      findTarget: () => findByText(document, `#opening-${OPENING_ID} button`, 'Apply'),
      doItForMe: ({ target }) => clickElement(target),
      isComplete: () => !!document.querySelector('[aria-label^="Apply for"]'),
    },
    {
      id: 'phone',
      title: 'Add your number.',
      body: "So whoever's leading Saturday can reach you if the plan changes.",
      findTarget: () => document.querySelector<HTMLInputElement>('[aria-label^="Apply for"] input[type="tel"]'),
      doItForMe: ({ target }) => setReactFieldValue(target as HTMLInputElement, PHONE_TEXT),
      isComplete: (target) => ((target as HTMLInputElement | null)?.value.trim().length ?? 0) >= 10,
    },
    {
      id: 'submit',
      title: 'Now send it.',
      body: "No cover letter needed for this one - just showing up is the ask.",
      manualHint: 'or tap the arrow yourself',
      // Found by actually submitting and watching it happen, not by reading
      // the modal in isolation: OpportunitiesPage.tsx's ApplyModal DOES render
      // a "you're in." success state inside itself (`done`) - but the PARENT
      // wires `onApplied={() => { setHasApplied(true); setApplyOpen(false) }}`,
      // and both state updates fire inside the same synchronous submit()
      // handler. React batches them into one commit, so `applyOpen` is already
      // false by the time anything could paint `done`'s content - the success
      // screen exists in the code but is never actually visible. Same failure
      // shape applyForRole.tsx already documented for a DIFFERENT modal (this
      // page's own modal looked, from reading it alone, like it avoided that -
      // it doesn't, once you look at how its caller wires onApplied). isComplete
      // instead watches the one thing that DOES survive: the opening card's own
      // "applied" badge (hasApplied flipping), never on a plain Cancel.
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
    headline: <>you just<br />signed up for<br />a drive.</>,
    body: "That's it - the lead sees you on the list, and you show up Saturday. No forms, no fees, ever.",
  },
}

export default flow
