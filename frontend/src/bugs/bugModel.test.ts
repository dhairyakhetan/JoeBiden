import { describe, it, expect } from 'vitest'
import {
  bugStage, awaitingCheck, reworkCount, reworkLabel, eventSentence, filterBugs, stageCounts, kindCounts, kindOf, canEditDescription, editClearsApproval, checkAttachment, safeAttachmentName, attachmentLabel, shrinkTarget, safePageUrl, safeHref,
  laneOf, typeOf, laneCounts, groupDuplicates, demand, sortBugs, firstName, canConfirm, evidenceOf, ago, routineState, LANES, TYPE_LABEL,
  friendlyStatus, tabOf, tabCounts, shortTitle, pageName, TYPE_PLAIN, TRACK_PLAIN,
  type BugReport,
} from './bugModel'

const base: BugReport = {
  id: 'b1', created_at: '2026-10-05T10:00:00Z', updated_at: '2026-10-05T10:00:00Z',
  reporter_member_id: 30, reporter_uuid: 'u', reporter_name: 'Test Member', reporter_role: 'member',
  page_url: 'https://www.ngoaquaterra.com/projects/1018', page_path: '/projects/1018',
  viewport_w: 390, viewport_h: 800, user_agent: null, capture_method: 'form',
  severity: 'med', description: 'the sticker text overflows and crops the home button',
  screenshots: [], approved_for_fix: false, approved_by: null,
  taken_up: false, taken_up_at: null, solved: false, solved_at: null,
  verified: false, verified_at: null, verified_by: null,
  declined_reason: null, needs_info_note: null, fix_pr_url: null, resolution_note: null,
}
const mk = (p: Partial<BugReport>): BugReport => ({ ...base, ...p })

describe('bugStage', () => {
  it('walks open, taken up, solved, verified', () => {
    expect(bugStage(base)).toBe('open')
    expect(bugStage(mk({ taken_up: true }))).toBe('taken_up')
    expect(bugStage(mk({ taken_up: true, solved: true }))).toBe('solved')
    expect(bugStage(mk({ taken_up: true, closed_no_change: true }))).toBe('no_change')
    expect(bugStage(mk({ taken_up: true, solved: true, closed_no_change: true }))).toBe('solved')
    expect(bugStage(mk({ taken_up: true, solved: true, verified: true }))).toBe('verified')
  })
  it('a declined report is declined whatever else is ticked', () => {
    expect(bugStage(mk({ declined_reason: 'works as designed', taken_up: true }))).toBe('declined')
  })
})

describe('filterBugs and stageCounts', () => {
  const list = [
    mk({ id: 'a' }),
    mk({ id: 'b', taken_up: true, reporter_name: 'Nysa' }),
    mk({ id: 'c', taken_up: true, solved: true, page_path: '/director/member-of-month' }),
    mk({ id: 'd', declined_reason: 'duplicate' }),
  ]
  it('filters by stage', () => {
    expect(filterBugs(list, { stage: 'open' }).map(b => b.id)).toEqual(['a'])
    expect(filterBugs(list, { stage: 'all' }).length).toBe(4)
  })
  it('searches description, reporter and page, case-insensitively', () => {
    expect(filterBugs(list, { stage: 'all', text: 'NYSA' }).map(b => b.id)).toEqual(['b'])
    expect(filterBugs(list, { stage: 'all', text: 'member-of-month' }).map(b => b.id)).toEqual(['c'])
  })
  it('needsApproval keeps only reports still waiting on a leader', () => {
    const l = [mk({ id: 'x' }), mk({ id: 'y', approved_for_fix: true }), mk({ id: 'z', solved: true })]
    expect(filterBugs(l, { stage: 'all', needsApproval: true }).map(b => b.id)).toEqual(['x'])
  })
  it('counts every stage and the total', () => {
    expect(stageCounts(list)).toEqual({ all: 4, open: 1, taken_up: 1, solved: 1, verified: 0, no_change: 0, declined: 1 })
  })
})

describe('kinds', () => {
  const list = [
    mk({ id: 'a', kind: 'bug' }),
    mk({ id: 'b', kind: 'feature' }),
    mk({ id: 'c' }), // a row that predates the column carries no kind
    mk({ id: 'd', kind: 'feature', taken_up: true }),
  ]
  it('a row with no kind, or an unknown one, is a bug', () => {
    expect(kindOf(mk({}))).toBe('bug')
    expect(kindOf({ kind: 'junk' as never })).toBe('bug')
    expect(kindOf(mk({ kind: 'feature' }))).toBe('feature')
  })
  it('filters by kind and combines with the stage filter', () => {
    expect(filterBugs(list, { stage: 'all', kind: 'feature' }).map(b => b.id)).toEqual(['b', 'd'])
    expect(filterBugs(list, { stage: 'all', kind: 'bug' }).map(b => b.id)).toEqual(['a', 'c'])
    expect(filterBugs(list, { stage: 'taken_up', kind: 'feature' }).map(b => b.id)).toEqual(['d'])
    expect(filterBugs(list, { stage: 'all', kind: 'all' }).length).toBe(4)
    expect(filterBugs(list, { stage: 'all' }).length).toBe(4)
  })
  it('counts each kind and the total', () => {
    expect(kindCounts(list)).toEqual({ all: 4, bug: 2, feature: 2 })
  })
})

describe('attachments', () => {
  it('accepts pdf, txt, docx and xlsx by extension, whatever the case', () => {
    for (const n of ['brief.pdf', 'Notes.TXT', 'plan.docx', 'budget.XLSX']) {
      expect(checkAttachment({ name: n, size: 1000 }).ok).toBe(true)
    }
  })
  it('refuses macro-capable, legacy, web and extensionless files', () => {
    for (const n of ['a.docm', 'a.xlsm', 'a.doc', 'a.xls', 'a.html', 'a.svg', 'a.exe', 'a.js', 'brief', 'pdf', 'a.pdf.exe']) {
      expect(checkAttachment({ name: n, size: 1000 }).ok).toBe(false)
    }
  })
  it('refuses over 10 MB and empty files', () => {
    expect(checkAttachment({ name: 'a.pdf', size: 10 * 1024 * 1024 + 1 }).ok).toBe(false)
    expect(checkAttachment({ name: 'a.pdf', size: 10 * 1024 * 1024 }).ok).toBe(true)
    expect(checkAttachment({ name: 'a.pdf', size: 0 }).ok).toBe(false)
  })
  it('makes a name the database path check accepts', () => {
    const re = /^[a-z0-9._-]{1,80}$/
    for (const n of ['My Brief (final) v2.PDF', 'a..b.pdf', 'weird...name.docx', 'ऊपर.docx', '../../etc/passwd.txt', '.pdf', 'a'.repeat(200) + '.xlsx']) {
      const ext = n.split('.').pop()!.toLowerCase()
      const out = safeAttachmentName(n, ext)
      expect(re.test(out)).toBe(true)
      expect(out.endsWith('.' + ext)).toBe(true)
      expect(out).not.toContain('..')
    }
  })
  it('shows the original name for a stored path', () => {
    const id = '11111111-1111-4111-8111-111111111111'
    expect(attachmentLabel(`${id}/${id}-my-brief.pdf`)).toBe('my-brief.pdf')
  })
})

describe('canEditDescription', () => {
  const mine = mk({ reporter_member_id: 30 })
  it('the reporter and a leader may edit a waiting report', () => {
    expect(canEditDescription(mine, { memberId: 30, isLeader: false })).toBe(true)
    expect(canEditDescription(mine, { memberId: 99, isLeader: true })).toBe(true)
  })
  it('another member may not', () => {
    expect(canEditDescription(mine, { memberId: 31, isLeader: false })).toBe(false)
    expect(canEditDescription(mine, { memberId: null, isLeader: false })).toBe(false)
  })
  it('nobody may once it is taken up, solved or declined', () => {
    for (const p of [{ taken_up: true }, { solved: true }, { declined_reason: 'no' }] as Array<Partial<BugReport>>) {
      expect(canEditDescription(mk({ reporter_member_id: 30, ...p }), { memberId: 30, isLeader: true })).toBe(false)
    }
  })
  it('a member editing an approved report loses the approval, a leader does not', () => {
    expect(editClearsApproval(mk({ approved_for_fix: true }), { isLeader: false })).toBe(true)
    expect(editClearsApproval(mk({ approved_for_fix: true }), { isLeader: true })).toBe(false)
    expect(editClearsApproval(mk({ approved_for_fix: false }), { isLeader: false })).toBe(false)
  })
  it('an edit shows in the change log with the previous text', () => {
    expect(eventSentence({ kind: 'edited', actor_label: 'Test Member', note: 'previous text: old words' }))
      .toBe('Test Member edited the description. previous text: old words')
  })
})

describe('eventSentence', () => {
  it('reads as a sentence and carries the actor', () => {
    expect(eventSentence({ kind: 'taken_up', actor_label: 'routine', note: null })).toBe('routine took this up.')
    expect(eventSentence({ kind: 'solved', actor_label: 'routine', note: 'https://x/pull/1' })).toContain('Fix: https://x/pull/1')
    expect(eventSentence({ kind: 'verified', actor_label: 'Aarav', note: null })).toContain('live site')
  })
  it('reads an imported entry as its own note', () => {
    expect(eventSentence({ kind: 'imported', actor_label: 'import', note: 'Imported from the sheet.' })).toBe('Imported from the sheet.')
  })
  it('does not use em dashes', () => {
    for (const kind of ['filed', 'approved_for_fix', 'approval_removed', 'severity_changed', 'taken_up', 'untaken',
      'solved', 'reopened', 'verified', 'unverified', 'declined', 'needs_info', 'fix_linked', 'imported', 'other']) {
      expect(eventSentence({ kind, actor_label: 'A', note: 'n' })).not.toContain('—')
    }
  })
})

describe('shrinkTarget', () => {
  it('leaves a small image alone', () => { expect(shrinkTarget(800, 600, 1600)).toBeNull() })
  it('scales the longest edge down and keeps the ratio', () => {
    expect(shrinkTarget(3200, 1600, 1600)).toEqual({ w: 1600, h: 800 })
    expect(shrinkTarget(1170, 2532, 1600)).toEqual({ w: 739, h: 1600 })
  })
  it('ignores a zero-size image', () => { expect(shrinkTarget(0, 0, 1600)).toBeNull() })
})

describe('safePageUrl', () => {
  const origin = 'https://www.ngoaquaterra.com'
  it('keeps a same-origin link and splits the path', () => {
    expect(safePageUrl('https://www.ngoaquaterra.com/projects/1018?x=1', origin))
      .toEqual({ url: 'https://www.ngoaquaterra.com/projects/1018?x=1', path: '/projects/1018?x=1' })
  })
  it('turns a bare path into a full link', () => {
    expect(safePageUrl('/director/member-of-month', origin).url).toBe('https://www.ngoaquaterra.com/director/member-of-month')
  })
  it('never keeps another site or a script link', () => {
    expect(safePageUrl('https://evil.example/login', origin).url).toBe('https://www.ngoaquaterra.com/')
    expect(safePageUrl('javascript:alert(1)', origin).url).toBe('https://www.ngoaquaterra.com/')
  })
  it('falls back to the home page on junk', () => {
    expect(safePageUrl('', origin).path).toBe('/')
  })
})

describe('safeHref', () => {
  it('allows http and https only', () => {
    expect(safeHref('https://github.com/kaxx4/vercelaq/pull/1')).toBe('https://github.com/kaxx4/vercelaq/pull/1')
    expect(safeHref('http://localhost:5173/x')).toBe('http://localhost:5173/x')
  })
  it('rejects script, data, file and relative values and empties', () => {
    for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', 'file:///etc/passwd', '/just/a/path', '', null, undefined]) {
      expect(safeHref(bad as any)).toBeNull()
    }
  })
})

describe('the two-layer check', () => {
  const solved = { ...base, taken_up: true, solved: true, verified: false, declined_reason: null }

  it('a solved report nobody has verified is waiting for a leader', () => {
    expect(awaitingCheck(solved)).toBe(true)
    expect(awaitingCheck({ ...solved, verified: true })).toBe(false)
    expect(awaitingCheck({ ...solved, solved: false })).toBe(false)
    expect(awaitingCheck({ ...solved, declined_reason: 'no' })).toBe(false)
  })

  it('counts and words a send-back, treating a missing count as zero', () => {
    expect(reworkCount({})).toBe(0)
    expect(reworkLabel({})).toBeNull()
    expect(reworkLabel({ rework_count: 1 })).toBe('sent back once')
    expect(reworkLabel({ rework_count: 3 })).toBe('sent back 3 times')
  })

  it('the change log says it was sent back and why', () => {
    expect(eventSentence({ kind: 'reopened', actor_label: 'Test Leader', note: 'still broken on phone' }))
      .toBe('Test Leader reopened this and sent it back. still broken on phone')
    expect(eventSentence({ kind: 'reopened', actor_label: 'Test Leader', note: null })).toBe('Test Leader reopened this.')
  })
})


import { TRACK, isClosedOut, trackIndex, nextStepAction, backStepAction } from './bugModel'

describe('the progress tracker', () => {
  const f = (o: Record<string, unknown> = {}) => ({ taken_up: false, solved: false, verified: false, declined_reason: null, closed_no_change: false, ...o }) as any
  it('has four steps in order', () => expect(TRACK.map(t => t.key)).toEqual(['reported', 'taken_up', 'solved', 'verified']))
  it('places a report on the tracker', () => {
    expect(trackIndex(f())).toBe(0)
    expect(trackIndex(f({ taken_up: true }))).toBe(1)
    expect(trackIndex(f({ taken_up: true, solved: true }))).toBe(2)
    expect(trackIndex(f({ taken_up: true, solved: true, verified: true }))).toBe(3)
  })
  it('offers exactly the next forward step', () => {
    // Only the routine takes a report up; a leader has no forward step on a report nobody has started.
    expect(nextStepAction(f())).toBeNull()
    expect(nextStepAction(f({ taken_up: true }))!.id).toBe('solve')
    expect(nextStepAction(f({ taken_up: true, solved: true }))!.id).toBe('verify')
    expect(nextStepAction(f({ taken_up: true, solved: true, verified: true }))).toBeNull()
  })
  it('offers exactly one step back, never from the start', () => {
    expect(backStepAction(f())).toBeNull()
    expect(backStepAction(f({ taken_up: true }))!.id).toBe('untake')
    expect(backStepAction(f({ taken_up: true, solved: true }))!.id).toBe('unsolve')
    expect(backStepAction(f({ taken_up: true, solved: true, verified: true }))!.id).toBe('unverify')
  })
  it('a declined report is closed out and offers no steps', () => {
    const d = f({ declined_reason: 'not a bug' })
    expect(isClosedOut(d)).toBe(true)
    expect(nextStepAction(d)).toBeNull()
    expect(backStepAction(d)).toBeNull()
  })
  it('checked with nothing to change is closed out, but a solved one is not', () => {
    expect(isClosedOut(f({ taken_up: true, closed_no_change: true }))).toBe(true)
    expect(isClosedOut(f({ taken_up: true, solved: true, closed_no_change: true }))).toBe(false)
  })
})


describe('lanes and types', () => {
  it('uses the stored lane, and otherwise done when closed and later when not', () => {
    expect(laneOf(mk({ lane: 'today' }))).toBe('today')
    expect(laneOf(mk({}))).toBe('later')
    expect(laneOf(mk({ solved: true }))).toBe('done')
    expect(laneOf(mk({ closed_no_change: true }))).toBe('done')
  })
  it('falls back to the filed kind for a type the routine has not set', () => {
    expect(typeOf(mk({}))).toBe('bug')
    expect(typeOf(mk({ kind: 'feature' }))).toBe('feature')
    expect(typeOf(mk({ kind: 'feature', report_type: 'design' }))).toBe('design')
  })
  it('counts every lane and has a label for every type', () => {
    const c = laneCounts([mk({ id: 'a', lane: 'today' }), mk({ id: 'b' }), mk({ id: 'c', solved: true })])
    expect(c).toEqual({ today: 1, next: 0, later: 1, done: 1 })
    expect(LANES.map(l => l.key)).toEqual(['today', 'next', 'later', 'done'])
    expect(Object.keys(TYPE_LABEL).sort()).toEqual(['bug', 'content', 'design', 'feature', 'performance'])
  })
  it('filters by lane, type and area, and searches the area', () => {
    const list = [mk({ id: 'a', lane: 'today', report_type: 'design', area: 'Teams' }), mk({ id: 'b', area: 'Home' })]
    expect(filterBugs(list, { stage: 'all', lane: 'today' }).map(b => b.id)).toEqual(['a'])
    expect(filterBugs(list, { stage: 'all', type: 'design' }).map(b => b.id)).toEqual(['a'])
    expect(filterBugs(list, { stage: 'all', area: 'Home' }).map(b => b.id)).toEqual(['b'])
    expect(filterBugs(list, { stage: 'all', text: 'teams' }).map(b => b.id)).toEqual(['a'])
  })
})

describe('duplicates and demand', () => {
  const a = mk({ id: 'a', me_too_count: 2 })
  const b = mk({ id: 'b', duplicate_of: 'a', me_too_count: 1 })
  const c = mk({ id: 'c', duplicate_of: 'gone' })
  it('folds a duplicate under its parent and keeps an orphan visible', () => {
    const g = groupDuplicates([a, b, c])
    expect(g.parents.map(x => x.id)).toEqual(['a', 'c'])
    expect(g.also['a'].map(x => x.id)).toEqual(['b'])
  })
  it('never folds a report under itself', () => {
    expect(groupDuplicates([mk({ id: 'x', duplicate_of: 'x' })]).parents).toHaveLength(1)
  })
  it('counts the reporter, every me too, and each folded duplicate with its own me toos', () => {
    expect(demand(a)).toBe(3)
    expect(demand(a, groupDuplicates([a, b]).also)).toBe(3 + 2)
    expect(demand(mk({}))).toBe(1)
  })
  it('sorts the most wanted first, then by importance, then the oldest', () => {
    const x = mk({ id: 'x', me_too_count: 0, severity: 'low', created_at: '2026-10-01T00:00:00Z' })
    const y = mk({ id: 'y', me_too_count: 0, severity: 'high', created_at: '2026-10-02T00:00:00Z' })
    const z = mk({ id: 'z', me_too_count: 3, severity: 'low', created_at: '2026-10-03T00:00:00Z' })
    const w = mk({ id: 'w', me_too_count: 0, severity: 'high', created_at: '2026-10-01T00:00:00Z' })
    expect(sortBugs([x, y, z, w], 'wanted').map(b => b.id)).toEqual(['z', 'w', 'y', 'x'])
    expect(sortBugs([x, y], 'newest').map(b => b.id)).toEqual(['x', 'y'])
  })
})

describe('names and confirmations', () => {
  it('gives a first name, or a neutral word', () => {
    expect(firstName('Nysa Khetan')).toBe('Nysa')
    expect(firstName('  Madonna ')).toBe('Madonna')
    expect(firstName(null)).toBe('a member')
    expect(firstName('')).toBe('a member')
  })
  it('asks "did this fix it" only of the reporter or a me-too voter, on a solved and unverified report', () => {
    const solved = { solved: true, verified: false, reporter_member_id: 7 }
    expect(canConfirm(solved, { memberId: 7 }, false)).toBe(true)
    expect(canConfirm(solved, { memberId: 8 }, true)).toBe(true)
    expect(canConfirm(solved, { memberId: 8 }, false)).toBe(false)
    expect(canConfirm({ ...solved, verified: true }, { memberId: 7 }, false)).toBe(false)
    expect(canConfirm({ ...solved, solved: false }, { memberId: 7 }, false)).toBe(false)
    expect(canConfirm(solved, { memberId: null }, true)).toBe(false)
  })
})

describe('evidence pictures', () => {
  it('keeps only files under /bug-evidence/', () => {
    expect(evidenceOf(mk({ evidence: { before: '/bug-evidence/ab12cd34/before.webp', after: '/bug-evidence/ab12cd34/after.webp' } })))
      .toEqual({ before: '/bug-evidence/ab12cd34/before.webp', after: '/bug-evidence/ab12cd34/after.webp' })
  })
  it('drops another site, a traversal, a wrong type and junk', () => {
    const e = evidenceOf(mk({ evidence: { before: 'https://evil.test/x.webp', after: '/bug-evidence/../secrets.png' } }))
    expect(e).toEqual({ before: undefined, after: undefined })
    expect(evidenceOf(mk({ evidence: { before: '/bug-evidence/a/b.svg' } })).before).toBeUndefined()
    expect(evidenceOf(mk({ evidence: null }))).toEqual({ before: undefined, after: undefined })
  })
})

describe('the routine run log', () => {
  const now = new Date('2026-10-22T08:00:00Z')
  it('says how long ago in plain words', () => {
    expect(ago('2026-10-22T07:59:00Z', now)).toBe('just now')
    expect(ago('2026-10-22T07:30:00Z', now)).toBe('30 minutes ago')
    expect(ago('2026-10-22T07:00:00Z', now)).toBe('1 hour ago')
    expect(ago('2026-10-22T02:00:00Z', now)).toBe('6 hours ago')
    expect(ago('2026-10-21T08:00:00Z', now)).toBe('yesterday')
    expect(ago('2026-10-19T08:00:00Z', now)).toBe('3 days ago')
  })
  it('is fresh within 36 hours, late after, and none before the first run', () => {
    expect(routineState(null, now)).toBe('none')
    expect(routineState({ started_at: '2026-10-21T02:00:00Z' }, now)).toBe('fresh')
    expect(routineState({ started_at: '2026-10-20T10:00:00Z' }, now)).toBe('late')
  })
})

describe('plain words for the page', () => {
  const f = { taken_up: false, solved: false, verified: false, declined_reason: null, needs_info_note: null, closed_no_change: false }
  it('reads one status a person can understand', () => {
    expect(friendlyStatus(f).label).toBe('waiting its turn')
    expect(friendlyStatus({ ...f, taken_up: true }).label).toBe('being fixed')
    expect(friendlyStatus({ ...f, taken_up: true, needs_info_note: 'which box?' }).label).toBe('we have a question')
    expect(friendlyStatus({ ...f, taken_up: true, solved: true }).label).toBe('fixed')
    expect(friendlyStatus({ ...f, solved: true, verified: true }).label).toBe('fixed and checked')
    expect(friendlyStatus({ ...f, closed_no_change: true }).label).toBe('nothing to change')
    expect(friendlyStatus({ ...f, declined_reason: 'no' }).label).toBe('not going ahead')
  })
  it('lets a decline or a verification win over everything else, like bugStage', () => {
    expect(friendlyStatus({ ...f, declined_reason: 'no', solved: true }).key).toBe('declined')
    expect(friendlyStatus({ ...f, verified: true, closed_no_change: true }).key).toBe('checked')
  })
  it('sorts every report into exactly one of three tabs', () => {
    expect(tabOf(f)).toBe('open')
    expect(tabOf({ ...f, taken_up: true })).toBe('open')
    expect(tabOf({ ...f, solved: true })).toBe('fixed')
    expect(tabOf({ ...f, verified: true })).toBe('fixed')
    expect(tabOf({ ...f, closed_no_change: true })).toBe('closed')
    expect(tabOf({ ...f, declined_reason: 'x', solved: true })).toBe('closed')
    const rows = [base, { ...base, id: 'b2', solved: true }, { ...base, id: 'b3', closed_no_change: true }, { ...base, id: 'b4', declined_reason: 'x' }]
    const c = tabCounts(rows)
    expect(c).toEqual({ open: 1, fixed: 1, closed: 2 })
    expect(c.open + c.fixed + c.closed).toBe(rows.length)
  })
  it('filters by tab', () => {
    const rows = [base, { ...base, id: 'b2', solved: true }]
    expect(filterBugs(rows, { stage: 'all', tab: 'fixed' }).map(b => b.id)).toEqual(['b2'])
    expect(filterBugs(rows, { stage: 'all', tab: 'all' })).toHaveLength(2)
  })
  it('makes a short title from the first sentence', () => {
    expect(shortTitle('The menu is cut off. I cannot reach the links at the bottom.')).toBe('The menu is cut off.')
    expect(shortTitle('  line one\nline two  ')).toBe('line one line two')
    expect(shortTitle('')).toBe('untitled report')
    const long = 'word '.repeat(60)
    const t = shortTitle(long, 40)
    expect(t.length).toBeLessThanOrEqual(43)
    expect(t.endsWith('...')).toBe(true)
    expect(t).not.toContain('wor...')
  })
  it('names a page from its path', () => {
    expect(pageName('/')).toBe('home')
    expect(pageName('')).toBe('home')
    expect(pageName(null)).toBe('home')
    expect(pageName('/teams/abc?x=1')).toBe('teams')
    expect(pageName('/my-posts')).toBe('my posts')
  })
  it('has a plain word for every type and every tracker step', () => {
    expect(Object.keys(TYPE_PLAIN).sort()).toEqual(Object.keys(TYPE_LABEL).sort())
    expect(TRACK_PLAIN).toHaveLength(TRACK.length)
    expect(TYPE_PLAIN.feature).toBe('idea')
  })
})
