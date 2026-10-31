import ProfilePage from '../../profile/ProfilePage'
import { buildFakeMember, type Member } from '../runtime/fakeIdentity'
import type { TableHandler } from '../runtime/queryBuilder'
import { clickElement, findByText } from '../coach/domActions'
import { buildOwnProfileHandlers } from './profileFixtures'
import type { DemoFlow, FixtureStore } from './types'

// ── 19.4: "Take a break and come back" (3 steps, "shows the org is not
// extractive"). The real screen is profile/BreakModal.tsx, opened from
// profile/ProfilePage.tsx's own trigger card.
//
// This is the one flow in this pass that needs DemoProvider's `member` to
// visibly change mid-flow: BreakModal's onSaved={() => refreshMember()}
// (ProfilePage.tsx) is how the real screen expects "I just set a break" to
// become "the banner on my own profile now says so" - and ProfilePage's
// `onBreak` is derived straight from `currentMember.break_end`. Before this
// pass's fix to demo/DemoProvider.tsx, refreshMember() was a hard no-op (a
// deliberate simplification that happened to be correct for the two flows
// that never called it) - the break banner would have silently never
// appeared even though the fixture write "succeeded", because the auth
// context's own `member` never changed identity for React to notice. This
// flow's step 3 is the actual live proof that fix works: its isComplete
// watches for the REAL break banner (`.pf-break-sentence`), not a toast or a
// timer, so a regression there would show up here as a stuck "lost the
// spot" instead of a quiet false pass.
const BREAK_PRESET_LABEL = 'one week'

function buildHandlers({ member, store }: { member: Member; store: FixtureStore }): Record<string, TableHandler> {
  return buildOwnProfileHandlers({ member, store })
}

const flow: DemoFlow = {
  id: 'take-a-break',
  name: 'Take a break and come back',
  durationLabel: 'under a minute',
  role: 'member',
  roleBorrowed: false,
  buildMember: () => buildFakeMember({ fullName: 'Priyam Dasgupta', role: 'member', classGrade: '10' }),
  buildHandlers,
  Backdrop: () => <ProfilePage isOwn />,
  steps: [
    {
      id: 'open-break',
      title: 'Exams coming up?',
      body: "Nothing is removed while you're away, and your spot on the team is kept - that's the actual rule, not a nice way of saying it.",
      findTarget: () => document.querySelector<HTMLElement>('.pf-break-trigger'),
      doItForMe: ({ target }) => clickElement(target),
      isComplete: () => !!document.querySelector('#break-modal-title'),
    },
    {
      id: 'pick-length',
      title: 'Pick how long.',
      body: 'One tap sets both dates - there is no form to fill in by hand.',
      findTarget: () => findByText(document, '.chip', BREAK_PRESET_LABEL),
      doItForMe: ({ target }) => clickElement(target),
      isComplete: (target) => target?.getAttribute('aria-pressed') === 'true',
    },
    {
      id: 'set-break',
      title: 'Set it.',
      body: 'Your leads see it - nobody else does, and there is nothing left for you to do until you come back.',
      manualHint: 'or tap the arrow yourself',
      // BreakModal closes itself the instant the write "succeeds"
      // (onSaved(); onClose(), same handler) - same vanishing-control shape
      // as every other "send" step in this file's siblings. isComplete
      // watches the break BANNER on the profile instead, which only renders
      // once DemoProvider's refreshMember() has actually pushed the fixture
      // mutation back into the auth context - see this file's header
      // comment for why that specific signal matters here.
      findTarget: () => findByText(document, 'button[type="submit"]', 'set break'),
      doItForMe: ({ target }) => clickElement(target),
      isComplete: () => !!document.querySelector('.pf-break-sentence'),
    },
  ],
  endCard: {
    kicker: '★ that\'s the whole loop',
    headline: <>you just<br />took a break -<br />and kept your spot.</>,
    body: "Your leads see it, your place on the team stays exactly as it was, and 'come back early' is one tap whenever you're ready.",
  },
}

export default flow
