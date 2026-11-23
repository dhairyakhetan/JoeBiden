import { describe, it, expect } from 'vitest'
import {
  buildTeamTree, tagPath, tagShort, joinList, validateApplication, isValid, applicationRpcArgs, parseHours, formatHours,
  formatMonth, isMonth, monthOf, periodLabel, ordinalDate, letterDate,
  certificateErrorCode, certificateErrorMessage, standardWording, groupIntoCases, pendingCases, clearedCases,
  summariseHods, powersFor, hoursLine, certificateFilename, LIMITS,
  type ApplicationInput, type CertTypeInfo, type DeskDoc, type OrgTeam, type OrgSubTeam,
} from './certificateLogic'

// Shaped like the live tree read on 2026-11-20: Marketing > Social Media > LinkedIn Team, with a retired duplicate.
const TEAMS: OrgTeam[] = [
  { teamId: 18, name: 'Marketing', parentTeamId: null, isActive: true },
  { teamId: 9, name: 'Social Media', parentTeamId: 18, isActive: true },
  { teamId: 17, name: 'Digital Magazine', parentTeamId: 18, isActive: true },
  { teamId: 8, name: 'Welfare Projects', parentTeamId: null, isActive: true },
  { teamId: 10, name: 'Collabs Team', parentTeamId: null, isActive: false },
]
const SUBS: OrgSubTeam[] = [
  { subTeamId: 9, teamId: 9, name: 'LinkedIn Team', isActive: true },
  { subTeamId: 8, teamId: 9, name: 'Reels Team', isActive: true },
  { subTeamId: 41, teamId: 9, name: 'Reels Team', isActive: false },
  { subTeamId: 7, teamId: 9, name: 'Blogs', isActive: false },
  { subTeamId: 2, teamId: 8, name: 'Dog Feeding', isActive: false },
]
const TYPES: CertTypeInfo[] = [
  { key: 'cert_recognition', label: 'Certificate of Recognition', blurb: '', kind: 'certificate', layout: 'landscape', needsHod: false, structured: true, routineDrafts: false, hasStandardWording: true, sampleImageUrl: null, displayOrder: 10 },
  { key: 'lor', label: 'Letter of Recommendation', blurb: '', kind: 'letter', layout: 'portrait', needsHod: true, structured: false, routineDrafts: true, hasStandardWording: false, sampleImageUrl: null, displayOrder: 30 },
]
const NOW = new Date(2026, 10, 20)   // 20 Nov 2026

describe('buildTeamTree', () => {
  const tree = buildTeamTree(TEAMS, SUBS)
  it('nests child teams under their parent, three levels deep', () => {
    const marketing = tree.find(n => n.name === 'Marketing')!
    expect(marketing.children.map(c => c.name)).toEqual(['Digital Magazine', 'Social Media'])
    const social = marketing.children.find(c => c.name === 'Social Media')!
    expect(social.subTeams.map(s => s.name)).toContain('LinkedIn Team')
  })
  it('keeps retired teams and sub-teams, because alumni ask for letters too', () => {
    expect(tree.some(n => n.name === 'Collabs Team' && !n.isActive)).toBe(true)
    const welfare = tree.find(n => n.name === 'Welfare Projects')!
    expect(welfare.subTeams.map(s => s.name)).toEqual(['Dog Feeding'])
    const social = tree.find(n => n.name === 'Marketing')!.children.find(c => c.name === 'Social Media')!
    expect(social.subTeams.map(s => s.name)).toContain('Blogs')
  })
  it('drops a retired duplicate only when an active twin exists', () => {
    const social = tree.find(n => n.name === 'Marketing')!.children.find(c => c.name === 'Social Media')!
    const reels = social.subTeams.filter(s => s.name === 'Reels Team')
    expect(reels).toHaveLength(1)
    expect(reels[0].isActive).toBe(true)
  })
  it('puts active teams before retired ones', () => {
    expect(tree[tree.length - 1].name).toBe('Collabs Team')
  })
  it('does not loop on a parent cycle', () => {
    const cyc: OrgTeam[] = [{ teamId: 1, name: 'A', parentTeamId: 2, isActive: true }, { teamId: 2, name: 'B', parentTeamId: 1, isActive: true }]
    expect(() => buildTeamTree(cyc, [])).not.toThrow()
    expect(() => tagPath({ teamId: 1, subTeamId: null }, cyc, [])).not.toThrow()
  })
})

describe('tag labels', () => {
  it('writes the full path for a sub-team', () => {
    expect(tagPath({ teamId: 9, subTeamId: 9 }, TEAMS, SUBS)).toBe('Marketing > Social Media > LinkedIn Team')
  })
  it('writes the path for a child team and for a top team', () => {
    expect(tagPath({ teamId: 9, subTeamId: null }, TEAMS, SUBS)).toBe('Marketing > Social Media')
    expect(tagPath({ teamId: 18, subTeamId: null }, TEAMS, SUBS)).toBe('Marketing')
  })
  it('writes the short sentence form', () => {
    expect(tagShort({ teamId: 9, subTeamId: 9 }, TEAMS, SUBS)).toBe('LinkedIn Team in Social Media')
    expect(tagShort({ teamId: 8, subTeamId: null }, TEAMS, SUBS)).toBe('Welfare Projects')
  })
  it('joins lists in plain English', () => {
    expect(joinList([])).toBe('')
    expect(joinList(['a'])).toBe('a')
    expect(joinList(['a', 'b'])).toBe('a and b')
    expect(joinList(['a', 'b', 'c'])).toBe('a, b and c')
  })
})

describe('validateApplication', () => {
  const ok: ApplicationInput = { docTypes: ['lor'], hodIds: [77], teams: [{ teamId: 9, subTeamId: 9 }], minHours: 40, periodStart: '2025-03', periodEnd: '2026-07', highlights: '' }
  const check = (i: ApplicationInput) => validateApplication(i, TYPES, NOW)
  it('accepts a complete form', () => expect(isValid(check(ok))).toBe(true))
  it('needs a document, a team, hours and a period', () => {
    const e = check({ ...ok, docTypes: [], teams: [], minHours: null, periodStart: '', periodEnd: '' })
    expect(Object.keys(e).sort()).toEqual(['docTypes', 'hours', 'period', 'teams'])
  })
  it('refuses a period that runs backwards, starts before AQ existed, or ends in the future', () => {
    expect(check({ ...ok, periodStart: '2026-08', periodEnd: '2026-07' }).period).toMatch(/cannot be after/)
    expect(check({ ...ok, periodStart: '2020-12' }).period).toMatch(/started in 2021/)
    expect(check({ ...ok, periodEnd: '2026-12' }).period).toMatch(/future/)
  })
  it('lets the period end in the current month and start and end in the same month', () => {
    expect(isValid(check({ ...ok, periodEnd: '2026-11' }))).toBe(true)
    expect(isValid(check({ ...ok, periodStart: '2026-03', periodEnd: '2026-03' }))).toBe(true)
  })
  it('needs a HoD only for types that need one', () => {
    expect(check({ ...ok, hodIds: [] }).hods).toMatch(/letter of recommendation needs one/)
    expect(isValid(check({ ...ok, docTypes: ['cert_recognition'], hodIds: [] }))).toBe(true)
  })
  it('names every type that needs a HoD when several do', () => {
    const more = [...TYPES, { ...TYPES[1], key: 'letter_recognition', label: 'Letter of Recognition' }]
    expect(validateApplication({ ...ok, docTypes: ['lor', 'letter_recognition'], hodIds: [] }, more, NOW).hods)
      .toMatch(/letter of recommendation and letter of recognition need one/)
  })
  it('bounds the hours, as the database does', () => {
    expect(check({ ...ok, minHours: 0 }).hours).toBeTruthy()
    expect(check({ ...ok, minHours: LIMITS.maxHours + 1 }).hours).toBeTruthy()
    expect(check({ ...ok, minHours: NaN }).hours).toBeTruthy()
    expect(isValid(check({ ...ok, minHours: LIMITS.maxHours }))).toBe(true)
  })
  it('caps teams, HoDs and the free text', () => {
    const many = Array.from({ length: 17 }, (_, i) => ({ teamId: i + 1, subTeamId: null }))
    expect(check({ ...ok, teams: many }).teams).toBeTruthy()
    expect(check({ ...ok, hodIds: Array.from({ length: 11 }, (_, i) => i) }).hods).toBeTruthy()
    expect(check({ ...ok, highlights: 'x'.repeat(1001) }).highlights).toBeTruthy()
  })
  it('never uses an em dash in copy a member reads', () => {
    const e = validateApplication({ docTypes: [], hodIds: [], teams: [], minHours: null, periodStart: '', periodEnd: '', highlights: 'x'.repeat(2000) }, TYPES, NOW)
    expect(JSON.stringify(e)).not.toContain('—')
  })
})

describe('applicationRpcArgs', () => {
  it('shapes the exact rpc payload, dedupes, and sends null for empty highlights', () => {
    const args = applicationRpcArgs({ docTypes: ['cert_recognition', 'cert_recognition', 'lor'], hodIds: [3, 3, 4], teams: [{ teamId: 9, subTeamId: 9 }, { teamId: 18, subTeamId: null }], minHours: 40.5, periodStart: '2025-03', periodEnd: '2026-07', highlights: '   ' })
    expect(args).toEqual({
      p_doc_types: ['cert_recognition', 'lor'], p_hod_ids: [3, 4],
      p_teams: [{ team_id: 9, sub_team_id: 9 }, { team_id: 18, sub_team_id: null }],
      p_min_hours: 40.5, p_period_start: '2025-03-01', p_period_end: '2026-07-01', p_highlights: null,
    })
  })
})

describe('hours', () => {
  it('parses only plain numbers with at most one decimal', () => {
    expect(parseHours(' 40 ')).toBe(40)
    expect(parseHours('40.5')).toBe(40.5)
    for (const bad of ['', 'abc', '40.55', '-3', '1e3', '40h', '12345']) expect(parseHours(bad)).toBeNull()
  })
  it('formats whole numbers without a decimal', () => {
    expect(formatHours(40)).toBe('40')
    expect(formatHours(40.5)).toBe('40.5')
    expect(formatHours(null)).toBe('?')
  })
})

describe('error mapping', () => {
  it('finds the code inside a postgres message and maps it', () => {
    const err = { message: 'certificate_already_pending' }
    expect(certificateErrorCode(err)).toBe('certificate_already_pending')
    expect(certificateErrorMessage(err)).toMatch(/already have one of these waiting/)
  })
  it('falls back safely for anything unknown', () => {
    expect(certificateErrorMessage({ message: 'permission denied for table x' })).toBe('try again in a moment.')
    expect(certificateErrorMessage(null)).toBe('try again in a moment.')
  })
  it('has copy for every code the migration raises, with no em dash', () => {
    const codes = ['certificate_not_signed_in', 'certificate_members_only', 'certificate_pick_a_type', 'certificate_bad_hours', 'certificate_pick_a_hod',
      'certificate_pick_a_team', 'certificate_bad_team', 'certificate_already_pending', 'certificate_already_decided', 'certificate_not_tagged',
      'certificate_own_request', 'certificate_not_allowed', 'certificate_needs_text', 'certificate_field_locked', 'certificate_bad_hod']
    for (const c of codes) {
      const m = certificateErrorMessage({ message: c }, 'FALLBACK')
      expect(m).not.toBe('FALLBACK')
      expect(m).not.toContain('—')
    }
  })
})

describe('months', () => {
  it('prints a month the way the templates do', () => {
    expect(formatMonth('2024-03')).toBe('March, 2024')
    expect(formatMonth('2026-07-01')).toBe('July, 2026')
    expect(formatMonth('2026-13')).toBe('')
    expect(formatMonth(null)).toBe('')
  })
  it('validates month fields and reads a date as one', () => {
    expect(isMonth('2026-07')).toBe(true)
    for (const bad of ['', '2026-7', '2026-13', '26-07', '2026-07-01']) expect(isMonth(bad)).toBe(false)
    expect(monthOf(new Date(2026, 0, 5))).toBe('2026-01')
  })
  it('labels a period', () => {
    expect(periodLabel('2024-03-01', '2026-07-01')).toBe('March, 2024 to July, 2026')
    expect(periodLabel(null, '2026-07-01')).toBe('')
  })
})

describe('standardWording', () => {
  const base = { structured: true, memberName: 'Asha Verma', minHours: 40, periodStart: '2024-03-01', periodEnd: '2026-07-01' }
  it('writes the certificate sentence exactly as the database does', () => {
    expect(standardWording(base)).toBe('This is to certify that Asha Verma has been a valuable part of our organization and contributed over 40 hours to our welfare endeavours between March, 2024 and July, 2026.')
  })
  it('keeps a half hour', () => {
    expect(standardWording({ ...base, minHours: 40.5 })).toContain('over 40.5 hours')
  })
  it('offers nothing for a type that a person writes, or when a field is missing', () => {
    expect(standardWording({ ...base, structured: false })).toBeNull()
    expect(standardWording({ ...base, periodEnd: null })).toBeNull()
    expect(standardWording({ ...base, minHours: null })).toBeNull()
  })
})

const doc = (over: Partial<DeskDoc>): DeskDoc => ({
  id: 1, memberId: 30, memberName: 'Asha Verma', typeKey: 'lor', typeLabel: 'Letter of Recommendation', status: 'pending', submissionId: 's1',
  claimedMinHours: 40, periodStart: '2025-03-01', periodEnd: '2026-07-01', verifiedHours: 0, verifyCode: null, highlights: null, requestedAt: '2026-11-01T10:00:00Z', decidedBy: null, decidedByName: null,
  decidedAt: null, decisionNote: null, tags: [], hods: [], notes: [], draft: null, ...over,
})

describe('cases', () => {
  const docs = [
    doc({ id: 1, memberId: 30, requestedAt: '2026-11-05T00:00:00Z' }),
    doc({ id: 2, memberId: 30, typeKey: 'lov', requestedAt: '2026-11-02T00:00:00Z' }),
    doc({ id: 3, memberId: 30, status: 'issued', decidedAt: '2026-03-01T00:00:00Z' }),
    doc({ id: 4, memberId: 41, memberName: 'Ben', requestedAt: '2026-10-20T00:00:00Z' }),
    doc({ id: 5, memberId: 52, memberName: 'Cy', status: 'declined', decidedAt: '2026-11-10T00:00:00Z' }),
  ]
  const cases = groupIntoCases(docs)
  it('clubs every document of one member into one case, across rounds', () => {
    const asha = cases.find(c => c.memberId === 30)!
    expect(asha.open.map(d => d.id)).toEqual([2, 1])
    expect(asha.closed.map(d => d.id)).toEqual([3])
  })
  it('shows past decisions as history on a case that is still open', () => {
    expect(pendingCases(cases).find(c => c.memberId === 30)!.closed).toHaveLength(1)
  })
  it('orders the pending tab by who has waited longest', () => {
    expect(pendingCases(cases).map(c => c.memberId)).toEqual([41, 30])
  })
  it('puts only people with decisions on the cleared tab, newest decision first', () => {
    expect(clearedCases(cases).map(c => c.memberId)).toEqual([52, 30])
  })
})

describe('summariseHods', () => {
  it('counts each answer and those who have not answered', () => {
    expect(summariseHods([{ response: 'approve' }, { response: 'approve' }, { response: 'disapprove' }, { response: 'clueless' }, { response: null }]))
      .toEqual({ approve: 2, disapprove: 1, clueless: 1, waiting: 1, total: 5 })
  })
})

describe('powersFor: who may do what', () => {
  const tagged = doc({ hods: [{ memberId: 77, name: 'H', response: null, respondedAt: null }], draft: { body: 'x', source: 'claude', draftedBy: null, draftedByName: null, draftedAt: '' } })
  const hod = (id: number) => ({ memberId: id, role: 'hod' })

  it('lets a tagged HoD answer, note and write text, but not decide', () => {
    const p = powersFor(hod(77), tagged)
    expect(p).toMatchObject({ isTagged: true, canRespond: true, canNote: true, canSetText: true, canDecide: false })
  })
  it('lets an untagged HoD add a note and nothing else', () => {
    const p = powersFor(hod(88), tagged)
    expect(p).toMatchObject({ canRespond: false, canNote: true, canSetText: false, canDecide: false })
  })
  it('lets HR decide, write text and note, when there is text', () => {
    const p = powersFor({ memberId: 4, role: 'hr' }, tagged)
    expect(p).toMatchObject({ canDecide: true, canSetText: true, canNote: true, canRespond: false })
  })
  it('treats super_admin like HR, as the database does', () => {
    expect(powersFor({ memberId: 5, role: 'super_admin' }, tagged).canDecide).toBe(true)
  })
  it('refuses a decision with no text and says why', () => {
    const p = powersFor({ memberId: 4, role: 'hr' }, { ...tagged, draft: null })
    expect(p.canDecide).toBe(false)
    expect(p.decideBlockedReason).toMatch(/no text yet/)
  })
  it('gives a person nothing on their own request, even HR', () => {
    const p = powersFor({ memberId: 30, role: 'hr' }, tagged)
    expect(p).toMatchObject({ isOwn: true, canDecide: false, canNote: false, canSetText: false, canRespond: false })
    expect(p.decideBlockedReason).toMatch(/your own request/)
  })
  it('gives a plain member nothing', () => {
    expect(powersFor({ memberId: 99, role: 'member' }, tagged)).toMatchObject({ canDecide: false, canNote: false, canSetText: false, canRespond: false, canDownload: false })
  })
  it('freezes everything once decided, and lets any leader download an issued one', () => {
    const issued = { ...tagged, status: 'issued' as const }
    expect(powersFor({ memberId: 4, role: 'hr' }, issued)).toMatchObject({ canDecide: false, canSetText: false, canNote: false, canDownload: true })
    expect(powersFor(hod(88), issued).canDownload).toBe(true)
    expect(powersFor({ memberId: 99, role: 'member' }, issued).canDownload).toBe(false)
    expect(powersFor(hod(88), { ...issued, status: 'declined' }).canDownload).toBe(false)
  })
})

describe('hoursLine', () => {
  it('labels the claim as a claim and never shows zero as verified', () => {
    expect(hoursLine({ claimedMinHours: 40, verifiedHours: 0 })).toBe('claims at least 40 h · no attendance on record')
    expect(hoursLine({ claimedMinHours: 40, verifiedHours: null })).toBe('claims at least 40 h · no attendance on record')
  })
  it('shows attendance when there is some', () => {
    expect(hoursLine({ claimedMinHours: 40, verifiedHours: 12.5 })).toBe('claims at least 40 h · attendance shows 12.5 h')
  })
})

describe('certificateFilename', () => {
  it('makes a safe, readable name', () => {
    expect(certificateFilename('lor', 'Asha  Verma-Dutta!')).toBe('aquaterra-lor-asha-verma-dutta.pdf')
    expect(certificateFilename('cert_recognition', '')).toBe('aquaterra-cert_recognition-member.pdf')
  })
})

describe('dates as the templates print them', () => {
  it('writes the ordinal date, with the 11th, 12th and 13th as "th"', () => {
    expect(ordinalDate('2026-11-01T06:00:00Z')).toBe('1st November, 2026')
    expect(ordinalDate('2026-11-02T06:00:00Z')).toBe('2nd November, 2026')
    expect(ordinalDate('2026-11-03T06:00:00Z')).toBe('3rd November, 2026')
    expect(ordinalDate('2026-11-11T06:00:00Z')).toBe('11th November, 2026')
    expect(ordinalDate('2026-11-12T06:00:00Z')).toBe('12th November, 2026')
    expect(ordinalDate('2026-11-21T06:00:00Z')).toBe('21st November, 2026')
    expect(ordinalDate('2026-11-16T06:00:00Z')).toBe('16th November, 2026')
  })
  it('writes the letter date padded', () => {
    expect(letterDate('2026-02-01T06:00:00Z')).toBe('01-02-2026')
    expect(letterDate('2026-10-23T06:00:00Z')).toBe('23-10-2026')
  })
  it('dates by Indian time, not the viewer\u2019s: 11pm IST on the 5th is still the 5th', () => {
    expect(letterDate('2026-11-05T17:30:00Z')).toBe('05-11-2026')   // 23:00 IST on the 5th
    expect(letterDate('2026-11-05T18:45:00Z')).toBe('06-11-2026')   // 00:15 IST on the 6th
  })
  it('falls back to today for a missing or broken date', () => {
    expect(letterDate(null)).toMatch(/^\d{2}-\d{2}-\d{4}$/)
    expect(ordinalDate('not a date')).toMatch(/^\d+(st|nd|rd|th) [A-Z][a-z]+, \d{4}$/)
  })
})
