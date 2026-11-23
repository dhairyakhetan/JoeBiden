/**
 * /dev/desk verification kit: an in-memory Supabase fake plus the fixtures that
 * go under it. DEV ONLY (imported from DeskSurfaces, which is itself behind
 * `import.meta.env.DEV` in App.tsx).
 *
 * WHY A QUERY ENGINE AND NOT METHOD SWAPS
 *
 * The first version of /dev/desk replaced service methods one by one. That
 * proves a desk renders; it proves nothing about the service code underneath
 * (the search filter string, the keyset cursor, the status guards on a write,
 * the "already decided" path). So the real services run here, against a tiny
 * PostgREST-shaped engine: select / eq / neq / in / is / not / ilike / gt.. /
 * or(... and(...)) / order / range / limit / single / maybeSingle / insert /
 * update / upsert / delete, plus views derived from `members`.
 * What this does NOT model: RLS, triggers, column grants, SECURITY DEFINER
 * functions. Those are checked in the real database, not here.
 *
 * Nothing leaves the browser: window.fetch is already rejected by the harness.
 *
 * Handles for a test script, on `window.__dev`:
 *   calls            every write the fake saw, in order
 *   failNext(key,m)  make the next matching write fail. key = '<table>.<op>'
 *                    (members.update, posts.update) | 'rpc.<name>' |
 *                    'jobOpenings.updateApplicationStatus'
 *   mutate(t,match,patch)  change rows behind the UI's back (a stale tab)
 *   store            the live tables
 */
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { jobOpenings } from '../lib/jobOpenings'
import { clearAuthCache } from '../lib/authCache'
import { currentPeriod, shiftPeriod } from '../services/memberOfMonthService'
import { makeDevPreviewMember } from '../lib/devPreview'

export type Scenario = 'populated' | 'empty' | 'loading' | 'error'
export type Ctrl = {
  scenario: () => Scenario
  viewerRole: () => string
  writes: () => 'fake' | 'throw'
}

type Row = Record<string, any>
export const VIEWER_ID = 9000

// ── fixtures ────────────────────────────────────────────────────────────────
const day = (n: number) => new Date(Date.UTC(2026, 8, 1 + n, 10, 0, 0)).toISOString()
const ago = (n: number, h = 10) => { const d = new Date(); d.setUTCHours(h, 0, 0, 0); d.setUTCDate(d.getUTCDate() - n); return d.toISOString() }
const RANK: Record<string, number> = { super_admin: 0, hr: 0, director: 1, hod: 2, member: 3 }

function mem(id: number, over: Row): Row {
  return {
    member_id: id, uuid: `fixture-${id}`, auth_uid: null, email: `m${id}@example.invalid`,
    full_name: `Member ${id}`, avatar_url: null, class_grade: 'Class 11', phone: `+91 00000 ${String(id).padStart(5, '0')}`,
    instagram: null, linkedin: null, school_name: 'Test School', role: 'member', status: 'active',
    created_at: day(id % 200), updated_at: day(id % 200), break_end: null, join_reason: null,
    contacted_at: null, previously_removed: false, rejection_note: null, ...over,
  }
}

const GRADES = ['Class 8', 'Class 9', 'Class 10', 'Class 11', 'College 1st Year']

function buildMembers(): Row[] {
  const rows: Row[] = [
    mem(9001, { full_name: 'Test Member', email: 'test.member@example.invalid', instagram: 'test_member' }),
    mem(9002, { full_name: 'Placeholder With A Deliberately Long Name', email: 'a.very.long.placeholder.address.for.layout@example.invalid', role: 'hod', class_grade: 'College 2nd Year', school_name: 'A School Whose Name Is Longer Than The Column' }),
    mem(9003, { full_name: 'Test HR', email: 'test.hr@example.invalid', role: 'hr', class_grade: 'Alumni', phone: null, school_name: null }),
    mem(9004, { full_name: 'Test On Break', email: 'test.break@example.invalid', class_grade: 'Class 12', break_end: '2026-12-01' }),
    mem(9005, { full_name: 'Test Archived', email: 'test.archived@example.invalid', status: 'archived', phone: null }),
    mem(9006, { full_name: 'Test Removed', email: 'test.deleted@example.invalid', status: 'deleted', phone: null, class_grade: null }),
    mem(9007, { full_name: 'Test Super Admin', email: 'test.super@example.invalid', role: 'super_admin', class_grade: 'Alumni' }),
    mem(9008, { full_name: 'Test Suspended', email: 'test.suspended@example.invalid', status: 'suspended' }),
    mem(9009, { full_name: 'Test Plain Member Two', email: 'test.plain2@example.invalid' }),
    mem(9010, { full_name: 'Test Director', email: 'test.director@example.invalid', role: 'director' }),
  ]
  // 25 pending applicants, oldest first. Page one holds 20, so index 22 is on page two.
  for (let i = 0; i < 25; i++) {
    const id = 9101 + i
    const name = i === 22 ? 'Zubin Quirke' : i === 24 ? 'Yara Ostrowski' : `Applicant ${String(i + 1).padStart(2, '0')}`
    rows.push(mem(id, {
      full_name: name, email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.invalid`,
      status: 'pending_approval', class_grade: i === 22 ? 'College 1st Year' : GRADES[i % 4],
      created_at: day(i), updated_at: day(i), join_reason: i === 1
        ? 'A deliberately long joining reason, written as one unbroken paragraph so the card has to decide what to do with it rather than being handed a tidy sentence that fits by luck.'
        : 'A short reason, the common case.',
      contacted_at: [2, 5, 24].includes(i) ? day(i + 1) : null,
      previously_removed: i === 1,
    }))
  }
  rows.push(
    mem(9201, { full_name: 'Rejected Person One', status: 'rejected', rejection_note: 'Incomplete form.', updated_at: day(40) }),
    mem(9202, { full_name: 'Rejected Person Two', status: 'rejected', rejection_note: 'Duplicate.', updated_at: day(41) }),
  )
  return rows.map(r => ({ ...r, role_rank: RANK[r.role] ?? 3 }))
}

function buildStore(): Record<string, Row[]> {
  const pm = currentPeriod()
  const nextPm = shiftPeriod(pm, 1)
  const team = (id: number, name: string, category: string, is_active = true) => ({ team_id: id, uuid: `fixture-team-${id}`, name, category, is_active })
  const teams = [
    team(1, 'Welfare Projects', 'welfare'), team(2, 'Events', 'events'), team(3, 'Content', 'content'),
    team(4, 'Operations', 'operations'), team(5, 'Labs', 'labs'), team(6, 'Social Media', 'content'),
    team(7, 'Retired Old Team', 'events', false),
  ]
  const cand = (id: number, name: string) => ({ member_id: id, uuid: `fixture-${id}`, full_name: name, avatar_url: null, class_grade: 'Class 11', status: 'active' })
  const team_members: Row[] = []
  for (const t of teams) {
    for (const [i, n] of ['Asha Verma', 'Bikram Roy', 'Chitra Sen'].entries()) {
      team_members.push({ team_id: t.team_id, is_active: true, members: cand(8000 + t.team_id * 10 + i, `${n} ${t.name.split(' ')[0]}`) })
    }
  }
  const pick = (id: number, period: string, teamId: number, memberId: number, name: string) => {
    const t = teams.find(x => x.team_id === teamId)!
    return {
      id, period, team_id: teamId, member_id: memberId, citation: 'Showed up every single weekend.', picked_by: VIEWER_ID,
      created_at: ago(5), photo_url: null, photo_uploaded_at: null,
      member: { member_id: memberId, uuid: `fixture-${memberId}`, full_name: name, avatar_url: null },
      picker: { member_id: VIEWER_ID, full_name: 'Test Viewer' },
      team: { team_id: t.team_id, uuid: t.uuid, name: t.name, category: t.category },
    }
  }
  const post = (id: number, over: Row) => ({
    post_id: id, slug: `essay-${id}`, title: `Essay ${id}`, article_body: 'Body.', article: { byline: 'Test Writer', read_minutes: 4 },
    category: 'content', created_at: ago(id % 9), source_kind: 'blog', status: 'pending_review', deleted_at: null,
    published_at: null, scheduled_for: null, author_id: 9001, post_images: [], ...over,
  })
  const action = (i: number): Row => {
    const kinds = ['team_member_added', 'TEAM_MEMBER_ADDED', 'member_approved', 'post_approved', 'cron_publish_scheduled', 'member_role_changed', 'cron_expire_openings']
    const a = kinds[i % kinds.length]
    return {
      log_id: 5000 - i, action: a, entity_type: a.toLowerCase().includes('member') ? 'member' : 'post', entity_id: 9000 + i,
      details: i % 3 === 0 ? { note: `row ${i}` } : null, created_at: ago(Math.floor(i / 3), 8 + (i % 8)),
      member_id: a.startsWith('cron_') ? null : i % 2 ? 9007 : 9003, members: a.startsWith('cron_') ? null : { full_name: i % 2 ? 'Test Super Admin' : 'Test HR' },
    }
  }
  const opening = (id: string, title: string, team_id: number, team_name: string, cat: string) => ({
    id, title, description: 'An opening.', category: cat, team_name, team_id, skills: [], status: 'open',
    created_by_name: 'Test HoD', created_by_role: 'hod', created_at: ago(20), custom_questions: [],
  })
  const app = (id: string, opening_id: string, name: string, status: string, applicantStatus: string, i: number) => ({
    id, opening_id, applicant_id: 9300 + i, applicant_name: name, applicant_email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.invalid`,
    applicant_phone: '+91 00000 00500', message: i % 2 ? 'I would love to help.' : null, status, created_at: ago(i),
    custom_answers: {}, applicant: { status: applicantStatus },
  })
  // Certificate pipeline fixtures (20 Nov 2026). One document per row; the desk clubs them by member.
  const cert = (id: number, memberId: number, status: string, doc: string, over: Row = {}) => ({
    id, member_id: memberId, doc_type: doc, status, member_note: null, submission_id: `sub-${memberId}`,
    claimed_min_hours: 40, period_start: '2025-03-01', period_end: '2026-07-01', verify_code: status === 'issued' ? `AQ-${String(id).padStart(4, '0')}-AAAA-BBBB-CCCC` : null,
    hours_at_request: 0, drive_count_at_request: 0, date_range_start: null, date_range_end: null,
    requested_at: ago(id), decided_by: status === 'pending' ? null : 9003, decided_at: status === 'pending' ? null : ago(1),
    decision_note: status === 'declined' ? 'Not enough hours.' : null, ...over,
  })
  const certType = (key: string, label: string, kind: string, needs_hod: boolean, structured: boolean, routine_drafts: boolean, order: number) =>
    ({ key, label, blurb: `${label}, fixture.`, kind, layout: kind === 'certificate' ? 'landscape' : 'portrait', needs_hod, structured, routine_drafts, has_standard_wording: structured, drafting_brief: 'fixture', sample_image_url: null, display_order: order, is_active: true })
  return {
    members: buildMembers(),
    teams, team_members,
    member_of_the_month: [pick(1, pm, 1, 8010, 'Asha Verma Welfare'), pick(2, nextPm, 2, 8020, 'Asha Verma Events')],
    member_of_the_month_periods: [
      { period: pm, is_open: true, opened_at: ago(3) }, { period: nextPm, is_open: true, opened_at: ago(1) },
    ],
    posts: [
      post(101, { headliner: 'x' }), post(102, {}), post(103, { post_images: [{ blob_url: 'data:image/svg+xml;utf8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Crect width=%2240%22 height=%2240%22 fill=%22%2399c%22/%3E%3C/svg%3E', display_order: 0 }] }),
      post(201, { status: 'published', published_at: ago(10) }), post(202, { status: 'published', published_at: ago(20) }),
      post(203, { status: 'scheduled', published_at: ago(-9), scheduled_for: ago(-9) }),
      post(301, { source_kind: null, title: 'A member post', status: 'pending_review' }), post(302, { source_kind: null, title: 'Another member post', status: 'pending_review' }),
    ],
    post_images: [],
    community_audit_logs: Array.from({ length: 70 }, (_, i) => action(i)),
    job_openings: [
      opening('op-1', 'Social Media Lead', 6, 'Social Media', 'content'), opening('op-2', 'Welfare Volunteer', 1, 'Welfare Projects', 'welfare'),
    ],
    // People HR has not cleared yet: their sign-up (members 9101..) is still pending_approval, so the list below is derived
    // from member status and an approval in the harness moves them out (see rpc team_waiting_applicants).
    waiting_applicants: [
      { interest_id: 'wi-1', member_id: 9101, opening_id: 'op-1', message: 'I have run our school page for two years.', custom_answers: {}, created_at: ago(1) },
      { interest_id: 'wi-2', member_id: 9102, opening_id: 'op-1', message: null, custom_answers: {}, created_at: ago(2) },
      { interest_id: 'wi-3', member_id: 9103, opening_id: 'op-2', message: 'Free on weekends.', custom_answers: {}, created_at: ago(3) },
    ],
    job_applications: [
      app('ap-1', 'op-1', 'Ira Banerjee', 'pending', 'active', 1), app('ap-2', 'op-1', 'Jay Mukherjee', 'pending', 'active', 2),
      app('ap-3', 'op-1', 'Kiran Pal', 'pending', 'pending_approval', 3), app('ap-4', 'op-2', 'Lata Dey', 'pending', 'active', 4),
      app('ap-5', 'op-2', 'Mohan Gupta', 'pending', 'active', 5), app('ap-6', 'op-2', 'Nila Ghosh', 'reviewed', 'active', 6),
    ],
    certificate_types: [
      certType('cert_recognition', 'Certificate of Recognition', 'certificate', false, true, false, 10), certType('cert_internship', 'Certificate of Internship', 'certificate', false, true, false, 20),
      certType('lor', 'Letter of Recommendation', 'letter', true, false, true, 30), certType('letter_recognition', 'Letter of Recognition', 'letter', true, false, true, 40),
      certType('letter_internship', 'Letter of Internship', 'letter', true, false, true, 50), certType('letter_acceptance', 'Letter of Acceptance', 'letter', false, false, false, 60),
      certType('letter_offer', 'Offer Letter', 'letter', false, false, false, 70),
    ],
    sub_teams: [
      { sub_team_id: 1, team_id: 6, name: 'LinkedIn Team', is_active: true }, { sub_team_id: 2, team_id: 1, name: 'Dog Feeding', is_active: false },
    ],
    certificate_requests: [
      // Case A: Test Member has TWO open documents (clubbed) and an earlier issued certificate (history). The viewer is tagged on #1 and has not answered.
      cert(1, 9001, 'pending', 'lor', { member_note: 'Led the reels team through Paradox. Good at explaining things to new volunteers.' }),
      cert(5, 9001, 'pending', 'cert_recognition', { claimed_min_hours: 40.5 }),
      cert(6, 9001, 'issued', 'cert_recognition', { decided_at: ago(60), claimed_min_hours: 20 }),
      // Case B: a long name, a split vote, a note, no text yet.
      cert(2, 9009, 'pending', 'lor', { claimed_min_hours: 120, member_note: 'A long request note, written as one paragraph, because a one-line note proves nothing about how this row behaves.' }),
      // Cleared.
      cert(3, 9004, 'issued', 'cert_internship'), cert(4, 9008, 'declined', 'cert_recognition', { decided_by: 9007 }),
    ],
    certificate_request_hods: [
      { request_id: 1, hod_member_id: VIEWER_ID, response: null, responded_at: null }, { request_id: 1, hod_member_id: 9002, response: 'approve', responded_at: ago(1) },
      { request_id: 1, hod_member_id: 9010, response: 'clueless', responded_at: ago(1) },
      { request_id: 2, hod_member_id: 9002, response: 'approve', responded_at: ago(1) }, { request_id: 2, hod_member_id: 9010, response: 'disapprove', responded_at: ago(1) },
    ],
    certificate_request_teams: [
      { id: 1, request_id: 1, team_id: 6, sub_team_id: 1 }, { id: 2, request_id: 1, team_id: 3, sub_team_id: null }, { id: 3, request_id: 5, team_id: 6, sub_team_id: 1 },
      { id: 4, request_id: 2, team_id: 1, sub_team_id: 2 }, { id: 5, request_id: 3, team_id: 4, sub_team_id: null },
    ],
    certificate_request_notes: [
      { id: 1, request_id: 2, author_id: 9002, body: 'Reliable on drives, but I only saw them twice.', created_at: ago(1) },
    ],
    certificate_drafts: [
      { request_id: 1, body: 'AquaTerra is a student-led non-profit organisation based in Kolkata, committed to promoting social and environmental welfare through youth-driven initiatives.\n\nWe are pleased to write this letter of recommendation for Test Member, who has been associated with AquaTerra from March, 2025 to July, 2026.', source: 'claude', drafted_by: null, drafted_at: ago(1) },
      { request_id: 5, body: 'This is to certify that Test Member has been a valuable part of our organization and contributed over 40.5 hours to our welfare endeavours between March, 2025 and July, 2026.', source: 'standard', drafted_by: null, drafted_at: ago(5) },
      { request_id: 3, body: 'This is to certify that Test On Break has been a valuable part of our organization and contributed over 40 hours to our welfare endeavours between March, 2025 and July, 2026.', source: 'standard', drafted_by: null, drafted_at: ago(2) },
      { request_id: 6, body: 'This is to certify that Test Member has been a valuable part of our organization and contributed over 20 hours to our welfare endeavours between March, 2025 and July, 2026.', source: 'standard', drafted_by: null, drafted_at: ago(60) },
    ],
    // Fixture grievances (invented text, fixture ids). One is old enough to show the overdue marker; one has a long unbroken string.
    grievances: [
      { id: 'g0000000-0000-4000-8000-000000000001', created_at: new Date(Date.now() - 9 * 86_400_000).toISOString(), updated_at: new Date().toISOString(), submitter_id: 9001, category: 'safety', description: 'Fixture text for a concern about a venue. It runs to a couple of lines so the details panel has something to wrap.', about_text: null, incident_date: null, status: 'new', assigned_to: null, resolution_note: null, resolved_at: null, members: { full_name: 'Test Member' } },
      { id: 'g0000000-0000-4000-8000-000000000002', created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(), updated_at: new Date().toISOString(), submitter_id: 9002, category: 'misconduct_leader', description: 'A'.repeat(300) + ' fixture text with a very long unbroken start to prove it wraps.', about_text: 'Test Person', incident_date: '2026-10-20', status: 'in_review', assigned_to: null, resolution_note: null, resolved_at: null, members: { full_name: 'Placeholder With A Deliberately Long Name' } },
      { id: 'g0000000-0000-4000-8000-000000000003', created_at: new Date(Date.now() - 20 * 86_400_000).toISOString(), updated_at: new Date().toISOString(), submitter_id: 9001, category: 'other', description: 'Fixture text for a resolved concern.', about_text: null, incident_date: null, status: 'resolved', assigned_to: null, resolution_note: 'Fixture resolution.', resolved_at: new Date(Date.now() - 10 * 86_400_000).toISOString(), members: { full_name: 'Test Member' } },
    ],
    grievance_notes: [],
    // AQ Core: one fixture member starts with the badge.
    core_members: [{ member_id: 9001, added_by: null, added_at: day(2) }],
    grievance_audit: [],
    // Fixture enquiries (invented text). Still two new contact rows and one new collab row for the landing counts.
    contact_submissions: [
      { id: 1, status: 'new', name: 'Test Contact', email: 'test.contact@example.invalid', phone: null, role: 'parent', message: 'A short fixture question.', created_at: day(40), notes: null },
      { id: 2, status: 'new', name: 'Test Contact Two', email: 'two@example.invalid', phone: '+91 00000 00402', role: null, message: 'Another fixture message.', created_at: day(41), notes: null },
    ],
    collaboration_submissions: [
      { id: 1, status: 'new', org_name: 'Test School', contact_name: 'Test Teacher', email: 'teacher@example.invalid', phone: '+91 00000 00501', collab_type: 'Event co-hosting', message: 'Fixture collaboration request.', created_at: day(42), notes: null },
      { id: 2, status: 'closed', org_name: 'Test Organisation', contact_name: 'Test Lead', email: 'org@example.invalid', phone: null, collab_type: 'Sponsorship', message: 'A closed fixture request.', created_at: day(20), notes: 'Fixture note: closed after a call.' },
    ],
    volunteer_applications: [
      { id: 9301, full_name: 'Test Enquiry', phone: '+91 00000 00301', email: 'test.enquiry@example.invalid', class_grade: 'Class 11', school: 'Test School', message: 'A short enquiry.', reviewed: false, created_at: day(30) },
      { id: 9302, full_name: 'Test Long Enquiry', phone: '+91 00000 00302', email: 'long@example.invalid', class_grade: 'College 3rd Year', school: 'A School Whose Name Is Longer Than The Column', message: 'A long enquiry message.', reviewed: true, created_at: day(31) },
    ],
    duplicate_phones: [
      { phone_key: '9100000001', member_id: 9001, full_name: 'Test Member', email: 'test.member@example.invalid', phone: '+91 91000 00001', status: 'active', class_grade: 'Class 11', created_at: day(1) },
      { phone_key: '9100000001', member_id: 9109, full_name: 'Applicant 09', email: 'applicant.09@example.invalid', phone: '91000 00001', status: 'pending_approval', class_grade: 'Class 9', created_at: day(9) },
      { phone_key: '9100000002', member_id: 9002, full_name: 'Placeholder With A Deliberately Long Name', email: 'a.very.long.placeholder.address.for.layout@example.invalid', phone: '+91 91000 00002', status: 'active', class_grade: null, created_at: day(2) },
      { phone_key: '9100000002', member_id: 9004, full_name: 'Test On Break', email: 'test.break@example.invalid', phone: '+91 91000 00002', status: 'active', class_grade: 'Class 12', created_at: day(3) },
      { phone_key: '9100000002', member_id: 9005, full_name: 'Test Archived', email: 'test.archived@example.invalid', phone: '9100000002', status: 'archived', class_grade: 'Class 10', created_at: day(4) },
    ],
  }
}

export const store: Record<string, Row[]> = buildStore()

// ── engine ──────────────────────────────────────────────────────────────────
const unq = (s: string) => s.replace(/^"(.*)"$/, '$1')
const asNum = (v: any) => (v !== null && v !== '' && !isNaN(Number(v)) ? Number(v) : null)
function cmp(a: any, b: any): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  const na = asNum(a), nb = asNum(b)
  if (na !== null && nb !== null) return na - nb
  const ta = typeof a === 'string' ? Date.parse(a) : NaN, tb = typeof b === 'string' ? Date.parse(String(b)) : NaN
  if (!isNaN(ta) && !isNaN(tb) && /\d{4}-\d\d-\d\d/.test(String(a))) return ta - tb
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0
}
function likeRe(p: string): RegExp {
  let out = ''
  for (let i = 0; i < p.length; i++) {
    const c = p[i]
    if (c === '\\' && i + 1 < p.length) { out += p[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); continue }
    out += c === '%' ? '.*' : c === '_' ? '.' : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${out}$`, 'is')
}
type Pred = (r: Row) => boolean
function pred(col: string, op: string, raw: any): Pred {
  const val = typeof raw === 'string' ? unq(raw) : raw
  switch (op) {
    case 'eq': return r => (val === null ? r[col] == null : r[col] != null && String(r[col]) === String(val))
    case 'neq': return r => r[col] == null || String(r[col]) !== String(val)
    case 'gt': return r => r[col] != null && cmp(r[col], val) > 0
    case 'gte': return r => r[col] != null && cmp(r[col], val) >= 0
    case 'lt': return r => r[col] != null && cmp(r[col], val) < 0
    case 'lte': return r => r[col] != null && cmp(r[col], val) <= 0
    case 'like': case 'ilike': { const re = likeRe(String(val)); return r => r[col] != null && re.test(String(r[col])) }
    case 'is': return r => (val === null || val === 'null' ? r[col] == null : r[col] === (val === 'true' || val === true))
    case 'in': {
      const list: any[] = Array.isArray(val) ? val : String(val).replace(/^\(|\)$/g, '').split(',').map(s => unq(s.trim()))
      const set = new Set(list.map(String))
      return r => r[col] != null && set.has(String(r[col]))
    }
    default: return () => true
  }
}
function splitTop(s: string): string[] {
  const out: string[] = []; let depth = 0, cur = ''
  for (const c of s) {
    if (c === '(') depth++
    if (c === ')') depth--
    if (c === ',' && depth === 0) { out.push(cur); cur = '' } else cur += c
  }
  if (cur) out.push(cur)
  return out
}
function parseOr(s: string): Pred {
  const items = splitTop(s).map(it => {
    if (it.startsWith('and(') && it.endsWith(')')) {
      const inner = splitTop(it.slice(4, -1)).map(x => parseOr(x))
      return (r: Row) => inner.every(p => p(r))
    }
    const a = it.indexOf('.'), b = it.indexOf('.', a + 1)
    return pred(it.slice(0, a), it.slice(a + 1, b), it.slice(b + 1))
  })
  return r => items.some(p => p(r))
}

const calls: { fn: string; args: any }[] = []
const failures = new Map<string, string>()
let ctrl: Ctrl

function rowsOf(table: string): Row[] {
  const m = store.members
  switch (table) {
    case 'member_directory_view': return m
    case 'pending_member_approvals': return m.filter(r => r.status === 'pending_approval')
    case 'rejected_member_approvals': return m.filter(r => r.status === 'rejected')
    case 'post_feed_view': return store.posts
    default: return (store[table] ||= [])
  }
}
const VIEWS = new Set(['member_directory_view', 'pending_member_approvals', 'rejected_member_approvals', 'post_feed_view'])
const baseOf = (t: string) => (t === 'post_feed_view' ? 'posts' : VIEWS.has(t) ? 'members' : t)

class Q implements PromiseLike<any> {
  op = 'select'; preds: Pred[] = []; patch: Row = {}; ins: Row[] = []; conflict = ''
  orders: { c: string; asc: boolean }[] = []; lo = 0; hi: number | null = null; lim: number | null = null
  mode: '' | 'maybe' | 'single' = ''; head = false; wantCount = false; returning = false
  constructor(public table: string) {}
  select(_c?: string, o?: { count?: string; head?: boolean }) {
    if (this.op === 'select') { this.wantCount = !!o?.count; this.head = !!o?.head } else this.returning = true
    return this
  }
  insert(v: Row | Row[]) { this.op = 'insert'; this.ins = Array.isArray(v) ? v : [v]; return this }
  upsert(v: Row | Row[], o?: { onConflict?: string }) { this.op = 'upsert'; this.ins = Array.isArray(v) ? v : [v]; this.conflict = o?.onConflict ?? ''; return this }
  update(p: Row) { this.op = 'update'; this.patch = p; return this }
  delete() { this.op = 'delete'; return this }
  eq(c: string, v: any) { this.preds.push(pred(c, 'eq', v)); return this }
  neq(c: string, v: any) { this.preds.push(pred(c, 'neq', v)); return this }
  gt(c: string, v: any) { this.preds.push(pred(c, 'gt', v)); return this }
  gte(c: string, v: any) { this.preds.push(pred(c, 'gte', v)); return this }
  lt(c: string, v: any) { this.preds.push(pred(c, 'lt', v)); return this }
  lte(c: string, v: any) { this.preds.push(pred(c, 'lte', v)); return this }
  ilike(c: string, v: any) { this.preds.push(pred(c, 'ilike', v)); return this }
  like(c: string, v: any) { this.preds.push(pred(c, 'like', v)); return this }
  is(c: string, v: any) { this.preds.push(pred(c, 'is', v)); return this }
  in(c: string, v: any[]) { this.preds.push(pred(c, 'in', v)); return this }
  not(c: string, op: string, v: any) { const p = pred(c, op, v); this.preds.push(r => !p(r)); return this }
  or(s: string) { this.preds.push(parseOr(s)); return this }
  order(c: string, o?: { ascending?: boolean }) { this.orders.push({ c, asc: o?.ascending !== false }); return this }
  range(a: number, b: number) { this.lo = a; this.hi = b; return this }
  limit(n: number) { this.lim = n; return this }
  maybeSingle() { this.mode = 'maybe'; return this }
  single() { this.mode = 'single'; return this }
  then<A, B>(res?: (v: any) => A | PromiseLike<A>, rej?: (e: any) => B | PromiseLike<B>) { return this.run().then(res, rej) }
  catch(rej: (e: any) => any) { return this.run().catch(rej) }
  finally(f: () => void) { return this.run().finally(f) }

  private shape(rows: Row[], count: number | null, error: any = null) {
    if (error) return { data: null, error, count: null }
    if (this.mode === 'maybe') return { data: rows[0] ?? null, error: null, count }
    if (this.mode === 'single') return rows[0] ? { data: rows[0], error: null, count } : { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' }, count }
    return { data: this.head ? null : rows, error: null, count }
  }

  private async run(): Promise<any> {
    const s = ctrl.scenario()
    const key = `${this.table}.${this.op}`
    if (this.op === 'select') {
      if (s === 'loading') return new Promise(() => {})
      if (s === 'error') return { data: null, error: { message: '[fixture] read failed', code: 'PGRST000' }, count: null }
      const all = s === 'empty' ? [] : rowsOf(this.table).filter(r => this.preds.every(p => p(r)))
      const sorted = [...all]
      for (const o of [...this.orders].reverse()) sorted.sort((a, b) => (o.asc ? 1 : -1) * cmp(a[o.c], b[o.c]))
      let out = sorted
      if (this.hi !== null) out = out.slice(this.lo, this.hi + 1)
      if (this.lim !== null) out = out.slice(0, this.lim)
      return this.shape(out.map(r => ({ ...r })), this.wantCount ? all.length : null)
    }
    // writes
    calls.push({ fn: key, args: { patch: this.patch, ins: this.ins } })
    const fail = failures.get(key)
    if (fail) { failures.delete(key); return this.shape([], null, { message: fail, code: 'FIXTURE' }) }
    if (ctrl.writes() === 'throw') return this.shape([], null, { message: `[dev/desk] ${key} is disabled (writes: throw)`, code: 'FIXTURE' })
    const base = baseOf(this.table)
    const tbl = (store[base] ||= [])
    if (this.op === 'update') {
      const hit = tbl.filter(r => this.preds.every(p => p(r)))
      hit.forEach(r => Object.assign(r, this.patch))
      // certificate_requests_no_reopen stamps who decided and when; the fake emulates that one trigger so the desk shows the real result.
      if (base === 'certificate_requests' && this.patch.status) hit.forEach(r => Object.assign(r, { decided_by: VIEWER_ID, decided_at: new Date().toISOString(), ...(this.patch.status === 'issued' ? { verify_code: `AQ-${Date.now().toString(16).toUpperCase().padStart(16, '0').slice(-16).replace(/(.{4})(?=.)/g, '$1-')}` } : {}) }))
      return this.shape(this.returning ? hit.map(r => ({ ...r })) : [], null)
    }
    if (this.op === 'delete') {
      const hit = tbl.filter(r => this.preds.every(p => p(r)))
      store[base] = tbl.filter(r => !hit.includes(r))
      return this.shape(this.returning ? hit : [], null)
    }
    const made: Row[] = []
    for (const v of this.ins) {
      const cols = this.conflict ? this.conflict.split(',') : []
      const ex = cols.length ? tbl.find(r => cols.every(c => String(r[c]) === String(v[c]))) : null
      if (ex) { Object.assign(ex, v); made.push(ex); continue }
      const row: Row = { ...v }
      if (row.id == null && !('post_id' in row) && !('member_id' in row) && !('period' in row && base === 'member_of_the_month_periods')) row.id = Math.max(0, ...tbl.map(r => Number(r.id) || 0)) + 1
      if (base === 'member_of_the_month') {
        const t = store.teams.find(x => x.team_id === row.team_id)
        const cand = store.team_members.map(x => x.members).find(m => m.member_id === row.member_id)
        row.member = { member_id: row.member_id, uuid: cand?.uuid, full_name: cand?.full_name ?? 'a member', avatar_url: null }
        row.picker = { member_id: VIEWER_ID, full_name: 'Test Viewer' }
        row.team = t ? { team_id: t.team_id, uuid: t.uuid, name: t.name, category: t.category } : null
        row.created_at = new Date().toISOString()
      }
      tbl.push(row); made.push(row)
    }
    return this.shape(this.returning ? made.map(r => ({ ...r })) : [], null)
  }
}

export function viewerMember(role: string) {
  return { ...makeDevPreviewMember(role), member_id: VIEWER_ID, full_name: 'Test Viewer', email: 'viewer@example.invalid', uuid: 'fixture-viewer' } as any
}

function rpcQ(name: string, args: any): Q {
  const q = new Q('__rpc')
  const orig = q.then.bind(q)
  ;(q as any).run = async () => {
    const key = `rpc.${name}`
    if (ctrl.scenario() === 'loading' && name === 'get_duplicate_phone_groups') return new Promise(() => {})
    if (ctrl.scenario() === 'error' && name === 'get_duplicate_phone_groups') return { data: null, error: { message: '[fixture] read failed' } }
    const READS = ['get_own_member', 'get_duplicate_phone_groups', 'log_action', 'team_waiting_applicants', 'public_core_team', 'certificate_desk_counts', 'certificate_hod_options', 'verify_certificate']
    if (!READS.includes(name)) calls.push({ fn: key, args })
    else if (name === 'log_action') calls.push({ fn: key, args })
    const fail = failures.get(key)
    if (fail) { failures.delete(key); return { data: null, error: { message: fail } } }
    if (ctrl.writes() === 'throw' && !READS.includes(name)) return { data: null, error: { message: `[dev/desk] ${key} disabled` } }
    const setStatus = (status: string, extra: Row = {}) => {
      const r = store.members.find(m => m.member_id === args?.p_member_id)
      if (r) Object.assign(r, { status }, extra)
      return { data: null, error: null }
    }
    switch (name) {
      case 'get_own_member': { const r = viewerMember(ctrl.viewerRole()); return { data: r, error: null } }
      case 'get_duplicate_phone_groups': return { data: ctrl.scenario() === 'empty' ? [] : store.duplicate_phones, error: null }
      case 'team_waiting_applicants': {
        if (ctrl.scenario() === 'empty') return { data: [], error: null }
        const canApprove = ['hr', 'super_admin'].includes(ctrl.viewerRole())
        const rows = (store.waiting_applicants as Row[]).flatMap(w => {
          const m = store.members.find(x => x.member_id === w.member_id)
          const o = store.job_openings.find(x => x.id === w.opening_id)
          if (!m || m.status !== 'pending_approval' || !o) return []
          return [{ ...w, opening_title: o.title, team_name: o.team_name, full_name: m.full_name, class_grade: m.class_grade, applied_at: w.created_at, can_approve: canApprove }]
        })
        return { data: rows, error: null }
      }
      case 'public_core_team': {
        if (ctrl.scenario() === 'empty') return { data: [], error: null }
        const rows = (store.core_members as Row[]).flatMap(c => {
          const m = store.members.find(x => x.member_id === c.member_id)
          return m && m.status === 'active' ? [{ member_id: m.member_id, uuid: m.uuid, full_name: m.full_name, avatar_url: m.avatar_url ?? null, role: m.role }] : []
        })
        return { data: rows, error: null }
      }
      case 'core_add_by_emails': {
        const out = ((args?.p_emails ?? []) as string[]).map(e => {
          const m = store.members.find(x => (x.email || '').toLowerCase() === e && x.status === 'active')
          if (!m) return { email: e, result: 'not_found', full_name: null }
          if ((store.core_members as Row[]).some(c => c.member_id === m.member_id)) return { email: e, result: 'already', full_name: m.full_name }
          ;(store.core_members as Row[]).push({ member_id: m.member_id, added_by: VIEWER_ID, added_at: new Date().toISOString() })
          return { email: e, result: 'added', full_name: m.full_name }
        })
        return { data: out, error: null }
      }
      case 'certificate_desk_counts': {
        const reqs = ctrl.scenario() === 'empty' ? [] : (store.certificate_requests as Row[]).filter(r => r.status === 'pending')
        const mine = (store.certificate_request_hods as Row[]).filter(h => h.hod_member_id === VIEWER_ID && h.response == null).map(h => h.request_id)
        const drafted = new Set((store.certificate_drafts as Row[]).map(d => d.request_id))
        return { data: [{ pending_total: reqs.length, awaiting_my_response: reqs.filter(r => mine.includes(r.id)).length, awaiting_draft: reqs.filter(r => !drafted.has(r.id)).length }], error: null }
      }
      case 'certificate_hod_options': return { data: store.members.filter(m => ['hod', 'director'].includes(m.role) && m.status === 'active' && m.member_id !== VIEWER_ID).map(m => ({ member_id: m.member_id, full_name: m.full_name, avatar_url: null, role: m.role, team_names: ['Test Team'] })), error: null }
      case 'submit_certificate_requests': {
        const reqs = store.certificate_requests as Row[]
        const types: string[] = [...new Set<string>(args?.p_doc_types ?? [])]
        if (!args?.p_period_start || !args?.p_period_end || args.p_period_start > args.p_period_end) return { data: null, error: { message: 'certificate_bad_period' } }
        if (types.some(t => reqs.some(r => r.member_id === VIEWER_ID && r.status === 'pending' && r.doc_type === t))) return { data: null, error: { message: 'certificate_already_pending' } }
        const sub = `sub-${Date.now()}`
        const out = types.map(t => {
          const id = Math.max(0, ...reqs.map(r => r.id)) + 1
          reqs.push({ id, member_id: VIEWER_ID, doc_type: t, status: 'pending', member_note: args.p_highlights ?? null, submission_id: sub, claimed_min_hours: args.p_min_hours,
            period_start: args.p_period_start, period_end: args.p_period_end, verify_code: null,
            hours_at_request: 0, drive_count_at_request: 0, date_range_start: null, date_range_end: null, requested_at: new Date().toISOString(), decided_by: null, decided_at: null, decision_note: null })
          for (const h of args.p_hod_ids ?? []) (store.certificate_request_hods as Row[]).push({ request_id: id, hod_member_id: h, response: null, responded_at: null })
          for (const tm of args.p_teams ?? []) (store.certificate_request_teams as Row[]).push({ id: Date.now() + id, request_id: id, team_id: tm.team_id, sub_team_id: tm.sub_team_id })
          // Fixed-wording certificates are drafted at submit, as the database does.
          if ((store.certificate_types as Row[]).find(x => x.key === t)?.structured) {
            const month = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).replace(' ', ', ')
            ;(store.certificate_drafts as Row[]).push({ request_id: id, body: `This is to certify that Test Viewer has been a valuable part of our organization and contributed over ${args.p_min_hours} hours to our welfare endeavours between ${month(args.p_period_start)} and ${month(args.p_period_end)}.`, source: 'standard', drafted_by: null, drafted_at: new Date().toISOString() })
          }
          return { request_id: id, request_doc_type: t }
        })
        return { data: out, error: null }
      }
      case 'verify_certificate': {
        const code = String(args?.p_code ?? '').trim().toUpperCase()
        const r = (store.certificate_requests as Row[]).find(x => x.status === 'issued' && x.verify_code === code)
        if (!r) return { data: [], error: null }
        const holder = store.members.find(m => m.member_id === r.member_id)
        const label = (store.certificate_types as Row[]).find(t => t.key === r.doc_type)?.label
        return { data: [{ holder_name: holder?.full_name ?? 'a member', doc_label: label, issued_on: String(r.decided_at).slice(0, 10) }], error: null }
      }
      case 'certificate_respond': {
        const h = (store.certificate_request_hods as Row[]).find(x => x.request_id === args?.p_request_id && x.hod_member_id === VIEWER_ID)
        if (!h) return { data: null, error: { message: 'certificate_not_tagged' } }
        Object.assign(h, { response: args.p_response, responded_at: new Date().toISOString() })
        if (args.p_note) (store.certificate_request_notes as Row[]).push({ id: Date.now(), request_id: args.p_request_id, author_id: VIEWER_ID, body: args.p_note, created_at: new Date().toISOString() })
        return { data: null, error: null }
      }
      case 'certificate_add_note':
        ;(store.certificate_request_notes as Row[]).push({ id: Date.now(), request_id: args?.p_request_id, author_id: VIEWER_ID, body: args?.p_body, created_at: new Date().toISOString() })
        return { data: null, error: null }
      case 'certificate_set_draft': {
        const drafts = store.certificate_drafts as Row[]
        const row = { request_id: args?.p_request_id, body: args?.p_body, source: args?.p_source ?? 'manual', drafted_by: VIEWER_ID, drafted_at: new Date().toISOString() }
        const i = drafts.findIndex(d => d.request_id === row.request_id)
        if (i >= 0) drafts[i] = row; else drafts.push(row)
        return { data: null, error: null }
      }
      case 'soft_delete_member': return setStatus('deleted', { deleted_at: new Date().toISOString() })
      case 'restore_member': return setStatus('active', { deleted_at: null })
      case 'restart_member_as_applicant': return setStatus('pending_approval', { class_grade: null })
      default: return { data: null, error: null }
    }
  }
  void orig
  return q
}

/** Re-seed the viewer's own row so role-based lookups (getPickableTeams) see the right role. */
function seedViewer(role: string) {
  const row = { ...mem(VIEWER_ID, { full_name: 'Test Viewer', email: 'viewer@example.invalid', role, status: 'active' }), role_rank: RANK[role] ?? 3 }
  const i = store.members.findIndex(m => m.member_id === VIEWER_ID)
  if (i >= 0) store.members[i] = row; else store.members.unshift(row)
}

export function installVerifyStubs(c: Ctrl): () => void {
  ctrl = c
  const sb = supabaseCommunity as any
  const realFrom = sb.from, realRpc = sb.rpc, realGetSession = sb.auth.getSession
  // fresh data per mount, but keep the same object so window.__dev.store stays valid
  const fresh = buildStore()
  for (const k of Object.keys(store)) delete store[k]
  Object.assign(store, fresh)
  seedViewer(c.viewerRole())
  clearAuthCache()
  calls.length = 0; failures.clear()

  sb.from = (t: string) => new Q(t)
  sb.rpc = (name: string, args: any) => rpcQ(name, args)
  sb.auth.getSession = async () => ({ data: { session: { user: { id: 'dev-auth-uid' }, access_token: 'dev' } }, error: null })

  // job openings: reads through the engine (real mapRow), the write is faked so the
  // account-approval gate inside the real method does not need a members join.
  const jo = jobOpenings as any
  const realUpdate = jo.updateApplicationStatus
  jo.updateApplicationStatus = async (id: string, status: string, reason?: string) => {
    const key = 'jobOpenings.updateApplicationStatus'
    calls.push({ fn: key, args: { id, status, reason } })
    await new Promise(r => setTimeout(r, 150))
    const fail = failures.get(key)
    if (fail) { failures.delete(key); throw new Error(fail) }
    if (c.writes() === 'throw') throw new Error('[dev/desk] updateApplicationStatus disabled')
    const r = store.job_applications.find(a => a.id === id)
    if (r) r.status = status
  }

  ;(window as any).__dev = {
    calls,
    store,
    failNext: (key: string, msg = 'fixture failure') => failures.set(key, msg),
    mutate: (table: string, match: Row, patch: Row) => {
      const t = store[baseOf(table)] || []
      const hit = t.filter(r => Object.entries(match).every(([k, v]) => String(r[k]) === String(v)))
      hit.forEach(r => Object.assign(r, patch))
      return hit.length
    },
  }
  return () => {
    sb.from = realFrom; sb.rpc = realRpc; sb.auth.getSession = realGetSession
    jo.updateApplicationStatus = realUpdate
    delete (window as any).__dev
    clearAuthCache()
  }
}
