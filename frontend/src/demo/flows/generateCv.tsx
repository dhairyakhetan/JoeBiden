import ProfilePage from '../../profile/ProfilePage'
import { buildFakeMember, type Member } from '../runtime/fakeIdentity'
import type { TableHandler, HandlerCtx } from '../runtime/queryBuilder'
import { clickElement, setReactFieldValue, findByText, nextFrame } from '../coach/domActions'
import { buildOwnProfileHandlers } from './profileFixtures'
import type { DemoFlow, FixtureStore } from './types'

// ── 19.4: "Generate a CV" (3 steps, "the outcome a 17-year-old actually
// wants"). profile/CvCard.tsx (the real screen) has TWO independent features
// stacked in one card block: an always-visible education list (its own
// open/type/save cycle) and the CV generator itself (generate -> preview ->
// print). That's 3 real clicks for education alone plus 2 more for the CV,
// five total against a 3-step budget - too many to demo individually.
//
// Step 1 below folds "open the add-education form" and "type the school
// name" into ONE coach step rather than two, using the SAME `findTarget`
// re-evaluated every frame CoachMark already relies on for every other step:
// it returns the "+ add education" button until the form is open, then
// seamlessly returns the institution input once it appears - a manual
// clicker sees the spotlight follow the real UI's own natural sequence with
// no extra step, and "Do it for me" chains the click and the keystroke with
// one `nextFrame()` between them (coach/domActions.ts's own helper, built
// for exactly this - "gives React one paint cycle to react to a click/input
// before the next lookup runs"). This keeps three steps meaningful (add a
// fact about yourself, save it, generate the document) instead of forcing a
// 4th/5th step that would just be "click print" with nothing left to teach.
function driveAttendanceRow(id: number, header: string, daysAgo: number, hours: number) {
  const start = new Date(Date.now() - daysAgo * 86_400_000)
  const end = new Date(start.getTime() + hours * 3_600_000)
  return {
    checked_in_at: start.toISOString(),
    checked_out_at: end.toISOString(),
    status: 'left',
    drive: { id, header, workshop_date: start.toISOString(), scheduled_end: end.toISOString() },
  }
}

const SCHOOL_NAME = 'La Martiniere for Girls'

function buildHandlers({ member, store }: { member: Member; store: FixtureStore }): Record<string, TableHandler> {
  const base = buildOwnProfileHandlers({ member, store })
  store.seed('drive_attendance', [
    driveAttendanceRow(1, 'Winter Blanket Drive', 30, 4),
    driveAttendanceRow(2, 'ShikshAQ Weekend Session', 9, 3),
  ])
  store.seed('member_education', [])

  return {
    ...base,
    drive_attendance: () => ({ data: store.rows('drive_attendance'), error: null }),

    member_education: (ctx: HandlerCtx) => {
      if (ctx.op === 'insert') {
        const payload = ctx.payload as Record<string, unknown>
        const row = {
          id: 7000 + store.rows('member_education').length,
          institution: payload.institution,
          credential: payload.credential ?? null,
          start_year: payload.start_year ?? null,
          end_year: payload.end_year ?? null,
          grade: payload.grade ?? null,
        }
        store.insert('member_education', row)
        return { data: [row], error: null }
      }
      if (ctx.op === 'update') {
        const idFilter = ctx.filters.find(f => f.method === 'eq' && f.args[0] === 'id')
        const rows = store.rows('member_education') as any[]
        const row = idFilter ? rows.find(r => r.id === idFilter.args[1]) : undefined
        if (row) Object.assign(row, ctx.payload)
        return { data: row ? [row] : [], error: null }
      }
      if (ctx.op === 'delete') {
        const idFilter = ctx.filters.find(f => f.method === 'eq' && f.args[0] === 'id')
        const rows = store.rows('member_education') as any[]
        const row = idFilter ? rows.find(r => r.id === idFilter.args[1]) : undefined
        return { data: row ? [{ id: row.id }] : [], error: null }
      }
      return { data: store.rows('member_education'), error: null }
    },
  }
}

const flow: DemoFlow = {
  id: 'generate-cv',
  name: 'Generate a CV',
  durationLabel: 'under a minute',
  role: 'member',
  roleBorrowed: false,
  buildMember: () => buildFakeMember({ fullName: 'Debojit Sen', role: 'member', classGrade: '11' }),
  buildHandlers,
  Backdrop: () => <ProfilePage isOwn />,
  steps: [
    {
      id: 'add-school',
      title: 'Add your school.',
      body: "Your CV is built from your real AquaTerra record - this is the one fact only you can add to it.",
      findTarget: () => {
        const input = document.querySelector<HTMLInputElement>('.card input.input[placeholder*="La Martiniere" i]')
        if (input) return input
        return findByText(document, '.card .pf-actions button', 'add education')
      },
      doItForMe: async ({ target }) => {
        if (!target) return
        if (target instanceof HTMLInputElement) { setReactFieldValue(target, SCHOOL_NAME); return }
        clickElement(target)
        await nextFrame()
        await nextFrame()
        const input = document.querySelector<HTMLInputElement>('.card input.input[placeholder*="La Martiniere" i]')
        if (input) setReactFieldValue(input, SCHOOL_NAME)
      },
      isComplete: (target) => target instanceof HTMLInputElement && target.value.trim().length >= 3,
    },
    {
      id: 'save-school',
      title: 'Save it.',
      body: "It's added to your record - and to the CV below, automatically.",
      findTarget: () => findByText(document, '.card button.btn-primary', 'add entry'),
      doItForMe: ({ target }) => clickElement(target),
      // The save button vanishes the instant it succeeds (setEduForm(null)
      // in the same handler that updates the list) - watch the read-only row
      // it leaves behind instead, same pattern as every other "send" step
      // in this file's sibling flows.
      isComplete: () => {
        const rows = Array.from(document.querySelectorAll('.pf-edu-row'))
        return rows.some(r => (r.textContent || '').includes(SCHOOL_NAME))
      },
    },
    {
      id: 'generate',
      title: 'Now build it.',
      body: 'Tenure, teams, hours, achievements, education - everything real, nothing invented.',
      manualHint: 'or tap the arrow yourself',
      findTarget: () => findByText(document, '.card button.btn-primary', 'generate my cv'),
      doItForMe: ({ target }) => clickElement(target),
      isComplete: () => !!document.querySelector('[aria-label="Your CV"]'),
    },
  ],
  endCard: {
    kicker: '★ that\'s the whole loop',
    headline: <>you just<br />generated<br />your CV.</>,
    body: "Real hours, a real team, a real record - one page, ready to print or save as a PDF whenever you need it.",
  },
}

export default flow
