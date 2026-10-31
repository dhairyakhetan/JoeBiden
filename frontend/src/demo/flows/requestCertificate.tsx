import ProfilePage from '../../profile/ProfilePage'
import { buildFakeMember, type Member } from '../runtime/fakeIdentity'
import type { TableHandler, HandlerCtx } from '../runtime/queryBuilder'
import { clickElement, setReactFieldValue, findByText } from '../coach/domActions'
import { buildOwnProfileHandlers } from './profileFixtures'
import type { DemoFlow, FixtureStore } from './types'

// ── 19.4: "Request a certificate" (spec says 4 steps, "the parent-facing
// outcome, so tone matters"). Built and TESTED as 3, with the mismatch
// reported here rather than papered over with a step that does nothing:
// profile/HoursAndCertificateCard.tsx (the real screen) has exactly THREE
// distinct clickable moments, not four -
//   1. "+ request a certificate" opens an inline picker.
//   2. an optional note field.
//   3. one of three doc-type buttons (certificate/LoV/LoR) - which SUBMITS
//      immediately on click. Choosing and submitting are the same click in
//      the real UI; there is no separate confirm step to demo.
// A fourth step ("watch it land in the queue") was tried and rejected: the
// request row this would spotlight already exists by the time step 3's own
// completion pause ends, so CoachMark's isComplete would read true on the
// very first frame - the coach card would flash for under a second and
// auto-advance with no visitor action, which is worse than being honest
// about 3. FLOW_LISTINGS in registry.ts is updated to say 3, not 4, to
// match what actually ships (a launcher promising a 4th step that never
// asks anything of you would itself be a small honesty bug).
//
// The fixture member needs *some* logged hours, or the whole card hides
// itself (HoursAndCertificateCard: "if (summary.driveCount === 0) return
// null"). drive_attendance rows below are shaped exactly like
// certificateService.getHoursSummary's own embedded select
// (`drive:welfare_projects(id, header, workshop_date, scheduled_end)`) -
// fabricated inline rather than joined, same technique postToFeed.tsx uses
// for author/image sub-objects.
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

const NOTE_TEXT = 'applying for a summer program - need it by the 20th if possible.'

function buildHandlers({ member, store }: { member: Member; store: FixtureStore }): Record<string, TableHandler> {
  const base = buildOwnProfileHandlers({ member, store })
  store.seed('drive_attendance', [
    driveAttendanceRow(1, 'Winter Blanket Drive', 40, 4),
    driveAttendanceRow(2, 'Sundarban Education Drive', 12, 5.5),
  ])
  store.seed('certificate_requests', [])

  return {
    ...base,
    drive_attendance: () => ({ data: store.rows('drive_attendance'), error: null }),

    certificate_requests: (ctx: HandlerCtx) => {
      if (ctx.op === 'insert') {
        const payload = ctx.payload as Record<string, unknown>
        const row = {
          id: 9000 + store.rows('certificate_requests').length,
          member_id: member.member_id,
          doc_type: payload.doc_type,
          status: 'pending',
          member_note: payload.member_note ?? null,
          hours_at_request: payload.hours_at_request ?? null,
          drive_count_at_request: payload.drive_count_at_request ?? null,
          date_range_start: payload.date_range_start ?? null,
          date_range_end: payload.date_range_end ?? null,
          requested_at: new Date().toISOString(),
          decided_by: null,
          decided_at: null,
          decision_note: null,
        }
        store.insert('certificate_requests', row)
        return { data: [row], error: null }
      }
      const rows = store.rows('certificate_requests') as any[]
      return { data: rows.filter(r => r.member_id === member.member_id), error: null }
    },
  }
}

const flow: DemoFlow = {
  id: 'request-certificate',
  name: 'Request a certificate',
  durationLabel: 'about a minute',
  role: 'member',
  roleBorrowed: false,
  buildMember: () => buildFakeMember({ fullName: 'Ankita Ghosh', role: 'member', classGrade: '12' }),
  buildHandlers,
  Backdrop: () => <ProfilePage isOwn />,
  steps: [
    {
      id: 'open-request',
      title: 'Ask for it.',
      body: "Your logged hours are real - this turns them into something a parent or a college can actually read.",
      findTarget: () => findByText(document, '.pf-actions button', 'request a certificate'),
      doItForMe: ({ target }) => clickElement(target),
      isComplete: () => !!document.querySelector('.card input.input[placeholder*="HR should know" i]'),
    },
    {
      id: 'note',
      title: 'Tell HR anything useful.',
      body: "Optional, but a deadline or a reason gets a faster answer.",
      findTarget: () => document.querySelector<HTMLInputElement>('.card input.input[placeholder*="HR should know" i]'),
      doItForMe: ({ target }) => setReactFieldValue(target as HTMLInputElement, NOTE_TEXT),
      isComplete: (target) => ((target as HTMLInputElement | null)?.value.trim().length ?? 0) >= 5,
    },
    {
      id: 'choose',
      title: 'Pick the certificate.',
      body: 'HR decides, usually within a week - the same real SLA as everything else here.',
      manualHint: 'or tap the arrow yourself',
      // Found by testing: submitRequest() fires on this SAME click and the
      // picker closes (setPickerOpen(false)) synchronously inside it, so the
      // button is gone before any in-place confirmation could paint. Watch
      // the request row that survives instead (pf-request-row, "pending") -
      // never a plain toast check here because the toast's own text
      // ("a certificate requested") would also match a LoV/LoR request,
      // which is fine, but the row is the more honest signal of the two.
      findTarget: () => findByText(document, '.pf-actions button', 'certificate'),
      doItForMe: ({ target }) => clickElement(target),
      isComplete: () => {
        const rows = Array.from(document.querySelectorAll('.pf-request-row'))
        return rows.some(r => /pending/i.test(r.textContent || ''))
      },
    },
  ],
  endCard: {
    kicker: '★ that\'s the whole loop',
    headline: <>you just<br />requested a<br />certificate.</>,
    body: 'HR reviews it against your real logged hours and decides, usually within a week. No fee, no catch.',
  },
}

export default flow
