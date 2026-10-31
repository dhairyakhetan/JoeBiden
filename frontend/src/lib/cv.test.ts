import { describe, it, expect } from 'vitest'
import { present, formatCvMonth, formatCvRange, formatCvYearRange, buildCvContact, buildCvSections, cvFileName, type CvIdentity } from './cv'
import type { CvRecord } from '../services/cvService'

const emptyRecord: CvRecord = {
  teams: [],
  achievements: [],
  education: [],
  hours: { totalHours: 0, driveCount: 0, earliestDate: null, latestDate: null, undercounted: false },
}

const bareIdentity: CvIdentity = { fullName: 'Ananya Sen', roleLabel: null }

describe('present', () => {
  it('keeps a real string, trimmed', () => {
    expect(present('  hello ')).toBe('hello')
  })
  it('treats whitespace-only, empty, null and undefined as absent', () => {
    expect(present('   ')).toBeNull()
    expect(present('')).toBeNull()
    expect(present(null)).toBeNull()
    expect(present(undefined)).toBeNull()
  })
})

describe('formatCvMonth', () => {
  it('formats a plain date column', () => {
    expect(formatCvMonth('2024-07-19')).toBe('Jul 2024')
  })
  it('formats an ISO timestamp without shifting the month', () => {
    expect(formatCvMonth('2021-01-01T00:00:00.000Z')).toBe('Jan 2021')
    expect(formatCvMonth('2021-12-31T23:59:59.000Z')).toBe('Dec 2021')
  })
  it('returns null rather than "Invalid Date" for junk or absent input', () => {
    expect(formatCvMonth(null)).toBeNull()
    expect(formatCvMonth('')).toBeNull()
    expect(formatCvMonth('not a date')).toBeNull()
    expect(formatCvMonth('2024-13-01')).toBeNull()
  })
})

describe('formatCvRange', () => {
  it('joins both ends with an en dash, never an em dash', () => {
    const range = formatCvRange('2024-07-01', '2026-03-01')
    expect(range).toBe('Jul 2024 – Mar 2026')
    expect(range).not.toContain('—')
  })
  it('collapses an identical month', () => {
    expect(formatCvRange('2024-07-01', '2024-07-28')).toBe('Jul 2024')
  })
  it('still says something useful with one end', () => {
    expect(formatCvRange('2024-07-01', null)).toBe('from Jul 2024')
    expect(formatCvRange(null, '2024-07-01')).toBe('until Jul 2024')
  })
  it('is null with neither end', () => {
    expect(formatCvRange(null, null)).toBeNull()
  })
})

describe('formatCvYearRange', () => {
  it('joins both ends with an en dash, never an em dash', () => {
    const range = formatCvYearRange(2018, 2022)
    expect(range).toBe('2018 – 2022')
    expect(range).not.toContain('—')
  })
  it('collapses an identical year', () => {
    expect(formatCvYearRange(2020, 2020)).toBe('2020')
  })
  it('still says something useful with one end', () => {
    expect(formatCvYearRange(2018, null)).toBe('from 2018')
    expect(formatCvYearRange(null, 2022)).toBe('until 2022')
  })
  it('is null with neither end, or with junk input', () => {
    expect(formatCvYearRange(null, null)).toBeNull()
    expect(formatCvYearRange(undefined, undefined)).toBeNull()
    expect(formatCvYearRange(NaN, Infinity)).toBeNull()
  })
})

describe('buildCvContact', () => {
  it('omits every absent field rather than placeholdering it', () => {
    expect(buildCvContact(bareIdentity)).toEqual([])
    expect(buildCvContact({ ...bareIdentity, email: '  ', phone: null, classGrade: '' })).toEqual([])
  })
  it('keeps only the fields that exist', () => {
    const lines = buildCvContact({ ...bareIdentity, email: 'a@b.com', classGrade: 'Class 11' })
    expect(lines).toEqual([
      { label: 'email', value: 'a@b.com' },
      { label: 'class', value: 'Class 11' },
    ])
  })
})

describe('buildCvSections', () => {
  it('produces no sections at all for a member with an empty record', () => {
    expect(buildCvSections(bareIdentity, emptyRecord)).toEqual([])
  })

  it('never prints an hours line when the member has no counted drives', () => {
    const sections = buildCvSections(bareIdentity, emptyRecord)
    expect(JSON.stringify(sections)).not.toContain('hours volunteered')
  })

  it('does not print "0 hours" even when a drive exists but the total is zero', () => {
    const sections = buildCvSections(bareIdentity, {
      ...emptyRecord,
      hours: { totalHours: 0, driveCount: 1, earliestDate: '2024-07-01', latestDate: '2024-07-01', undercounted: true },
    })
    const record = sections.find(s => s.key === 'record')!
    // driveCount > 0, so the line is legitimate — but the "+" and the floor
    // note must both be there, because the figure is not the real total.
    expect(record.entries[0].title).toBe('0+ hours volunteered')
    expect(record.entries[0].body).toContain('floor')
  })

  it('omits the "+" and the floor note when the hours are exact', () => {
    const sections = buildCvSections(bareIdentity, {
      ...emptyRecord,
      hours: { totalHours: 18.5, driveCount: 7, earliestDate: '2024-07-01', latestDate: '2026-03-01', undercounted: false },
    })
    const entry = sections.find(s => s.key === 'record')!.entries[0]
    expect(entry.title).toBe('18.5 hours volunteered')
    expect(entry.meta).toBe('7 drives · Jul 2024 – Mar 2026')
    expect(entry.body).toBeUndefined()
  })

  it('singularises a single drive', () => {
    const sections = buildCvSections(bareIdentity, {
      ...emptyRecord,
      hours: { totalHours: 3, driveCount: 1, earliestDate: '2024-07-01', latestDate: '2024-07-01', undercounted: false },
    })
    expect(sections.find(s => s.key === 'record')!.entries[0].meta).toBe('1 drive · Jul 2024')
  })

  it('states tenure from joinedAt and the role label, and nothing when both are absent', () => {
    const withTenure = buildCvSections({ ...bareIdentity, roleLabel: 'Team Lead', joinedAt: '2021-06-11' }, emptyRecord)
    expect(withTenure[0].entries[0]).toEqual({ title: 'Team Lead, AquaTerra', meta: 'member since Jun 2021' })
    expect(buildCvSections(bareIdentity, emptyRecord).find(s => s.key === 'record')).toBeUndefined()
  })

  it('drops the about section when the bio is empty', () => {
    expect(buildCvSections({ ...bareIdentity, bio: '   ' }, emptyRecord).find(s => s.key === 'about')).toBeUndefined()
    expect(buildCvSections({ ...bareIdentity, bio: 'I build things.' }, emptyRecord)[0]).toEqual({
      key: 'about', heading: 'about', entries: [{ title: 'I build things.' }],
    })
  })

  it('drops the education section entirely when there are no entries', () => {
    expect(buildCvSections(bareIdentity, emptyRecord).find(s => s.key === 'education')).toBeUndefined()
  })

  it('renders an education entry with institution, credential, year range and grade all present', () => {
    const sections = buildCvSections(bareIdentity, {
      ...emptyRecord,
      education: [{ id: 1, institution: 'Techno India', credential: 'B.Tech Computer Science', startYear: 2018, endYear: 2022, grade: '8.7 CGPA' }],
    })
    const education = sections.find(s => s.key === 'education')!
    expect(education.heading).toBe('education')
    expect(education.entries[0]).toEqual({
      title: 'Techno India',
      meta: 'B.Tech Computer Science · 2018 – 2022 · Grade: 8.7 CGPA',
    })
  })

  it('omits credential, years and grade independently when each is absent, keeping only the institution', () => {
    const sections = buildCvSections(bareIdentity, {
      ...emptyRecord,
      education: [{ id: 1, institution: 'St. Xavier’s School', credential: null, startYear: null, endYear: null, grade: null }],
    })
    expect(sections.find(s => s.key === 'education')!.entries[0]).toEqual({
      title: 'St. Xavier’s School', meta: undefined,
    })
  })

  it('never labels a grade the member chose not to share', () => {
    const sections = buildCvSections(bareIdentity, {
      ...emptyRecord,
      education: [{ id: 1, institution: 'La Martiniere', credential: 'Class 12', startYear: 2020, endYear: 2022, grade: null }],
    })
    expect(sections.find(s => s.key === 'education')!.entries[0].meta).toBe('Class 12 · 2020 – 2022')
  })

  it('treats a currently-ongoing entry (no end year) as "from", not a closed range', () => {
    const sections = buildCvSections(bareIdentity, {
      ...emptyRecord,
      education: [{ id: 1, institution: 'Presidency University', credential: 'B.A. Economics', startYear: 2023, endYear: null, grade: null }],
    })
    expect(sections.find(s => s.key === 'education')!.entries[0].meta).toBe('B.A. Economics · from 2023')
  })

  it('lists multiple education entries in the order the service returned them', () => {
    const sections = buildCvSections(bareIdentity, {
      ...emptyRecord,
      education: [
        { id: 2, institution: 'Presidency University', credential: 'B.A. Economics', startYear: 2023, endYear: null, grade: null },
        { id: 1, institution: 'La Martiniere', credential: 'Class 12', startYear: 2011, endYear: 2023, grade: null },
      ],
    })
    const entries = sections.find(s => s.key === 'education')!.entries
    expect(entries.map(e => e.title)).toEqual(['Presidency University', 'La Martiniere'])
  })

  it('labels a team lead, singularises one team, and omits an unknown join date', () => {
    const sections = buildCvSections(bareIdentity, {
      ...emptyRecord,
      teams: [{ name: 'Human Resources', category: 'operations', roleInTeam: 'lead', joinedAt: null }],
    })
    const teams = sections.find(s => s.key === 'teams')!
    expect(teams.heading).toBe('team')
    expect(teams.entries[0]).toEqual({ title: 'Human Resources', meta: 'team lead · operations' })
  })

  it('does not label an ordinary member as a lead', () => {
    const sections = buildCvSections(bareIdentity, {
      ...emptyRecord,
      teams: [{ name: 'Crftd', category: null, roleInTeam: 'member', joinedAt: '2024-02-01' }],
    })
    expect(sections.find(s => s.key === 'teams')!.entries[0].meta).toBe('joined Feb 2024')
  })

  it('renders achievements with a humanised type and drops an empty description', () => {
    const sections = buildCvSections(bareIdentity, {
      ...emptyRecord,
      achievements: [{ title: 'Regional Olympiad', description: '  ', type: 'personal_project', date: '2025-04-01', endDate: null }],
    })
    expect(sections.find(s => s.key === 'achievements')!.entries[0]).toEqual({
      title: 'Regional Olympiad', meta: 'personal project · Apr 2025',
    })
  })

  it('does not turn a one-off achievement into an open-ended "from" range', () => {
    const sections = buildCvSections(bareIdentity, {
      ...emptyRecord,
      achievements: [{ title: 'Olympiad', description: null, type: null, date: '2025-04-01', endDate: null }],
    })
    expect(sections.find(s => s.key === 'achievements')!.entries[0].meta).toBe('Apr 2025')
  })

  it('keeps a real range when the achievement has an end date', () => {
    const sections = buildCvSections(bareIdentity, {
      ...emptyRecord,
      achievements: [{ title: 'Internship', description: null, type: null, date: '2025-04-01', endDate: '2025-09-01' }],
    })
    expect(sections.find(s => s.key === 'achievements')!.entries[0].meta).toBe('Apr 2025 – Sep 2025')
  })

  it('omits the date entirely when the achievement has none', () => {
    const sections = buildCvSections(bareIdentity, {
      ...emptyRecord,
      achievements: [{ title: 'Olympiad', description: null, type: null, date: null, endDate: null }],
    })
    expect(sections.find(s => s.key === 'achievements')!.entries[0].meta).toBeUndefined()
  })
})

describe('cvFileName', () => {
  it('slugs a name', () => {
    expect(cvFileName('Ananya Sen')).toBe('ananya-sen-aquaterra-cv')
  })
  it('falls back rather than producing a bare suffix', () => {
    expect(cvFileName(null)).toBe('member-aquaterra-cv')
    expect(cvFileName('!!!')).toBe('member-aquaterra-cv')
  })
})
