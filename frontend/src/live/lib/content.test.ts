import { describe, expect, it } from 'vitest'
import { emptyEventForm, emptyProgrammeForm, eventToForm, programmeToForm, rowToEvent, rowToProgramme, validateEventForm, validateProgrammeForm, type EventRow, type ProgrammeRow } from './content'
import { EVENTS, PROGRAMMES, pastOf, upcomingOf } from '../data/content'

const good = () => ({ ...emptyEventForm(), slug: 'disco-diwali-2027', name: 'Disco Diwali', status: 'upcoming', whenKey: '2027-11-02', dateLabel: '2 November 2027', blurb: 'The next one.' })
const row = (o: Partial<EventRow> = {}): EventRow => ({
  slug: 'a-night', name: 'A night', edition: null, status: 'past', when_key: '2025-10', date_label: 'October 2025', blurb: 'x', venue: null, time_label: null, href: null,
  photo_ids: ['booth', 'not-a-photo'], highlights: [], sort: 0, published: true, ...o,
})

describe('rowToEvent', () => {
  it('maps the database names to the page names, null to absent', () => {
    const e = rowToEvent(row({ edition: 'Edition 2.0', venue: '60, Chowringhee Banquets', time_label: '4:30 PM onwards', href: '/live/disco-diwali' }))
    expect(e).toMatchObject({ dateLabel: 'October 2025', when: '2025-10', edition: 'Edition 2.0', venue: '60, Chowringhee Banquets', time: '4:30 PM onwards', href: '/live/disco-diwali' })
    expect(rowToEvent(row()).edition).toBeUndefined()
  })
  it('drops a photo id it has no file for, instead of rendering a broken image', () => {
    expect(rowToEvent(row()).photos).toEqual(['booth'])
  })
  it('round-trips through the form unchanged', () => {
    const r = row({ edition: 'Edition 2.0', highlights: ['One', 'Two'], photo_ids: ['booth'], sort: 20 })
    const back = validateEventForm(eventToForm(r))
    expect(back.ok && back.row).toEqual(r)
  })
})

describe('validateEventForm', () => {
  it('accepts a complete night and trims it', () => {
    const r = validateEventForm({ ...good(), name: '  Disco Diwali ', venue: ' ', href: '' })
    expect(r.ok && r.row).toMatchObject({ name: 'Disco Diwali', venue: null, href: null, photo_ids: [], highlights: [], sort: 0 })
  })
  it.each(['Disco Diwali', 'disco_diwali', '-x-', 'ab', 'a--b', 'x'.repeat(61)])('refuses the page address %j', (slug) => {
    const r = validateEventForm({ ...good(), slug })
    expect(!r.ok && r.errors.slug).toBeTruthy()
  })
  it('refuses an address another night already uses', () => {
    const r = validateEventForm(good(), ['disco-diwali-2027'])
    expect(!r.ok && r.errors.slug).toMatch(/already/)
  })
  it.each(['2026-13', '26-11-10', 'November 2026', '2026-11-1'])('refuses the sort key %j', (whenKey) => {
    expect(validateEventForm({ ...good(), whenKey }).ok).toBe(false)
  })
  it.each(['javascript:alert(1)', 'http://insecure.example', 'live/events', '//evil.example', '/has space'])('refuses the link %j', (href) => {
    const r = validateEventForm({ ...good(), href })
    expect(!r.ok && r.errors.href).toBeTruthy()
  })
  it.each(['/live/disco-diwali', '/terrathon', 'https://instagram.com/aquaterra.live'])('accepts the link %j', (href) => {
    expect(validateEventForm({ ...good(), href }).ok).toBe(true)
  })
  it('names the photo ids that do not exist', () => {
    const r = validateEventForm({ ...good(), photoIds: 'booth, nope, alsonope' })
    expect(!r.ok && r.errors.photoIds).toMatch(/nope, alsonope/)
  })
  it('splits photos on commas and spaces and highlights on lines, and caps the highlights at 8', () => {
    const ok = validateEventForm({ ...good(), photoIds: 'booth drapes,friends', highlights: 'One\n\n Two ' })
    expect(ok.ok && ok.row.photo_ids).toEqual(['booth', 'drapes', 'friends'])
    expect(ok.ok && ok.row.highlights).toEqual(['One', 'Two'])
    const many = validateEventForm({ ...good(), highlights: Array.from({ length: 9 }, (_, i) => `line ${i}`).join('\n') })
    expect(many.ok).toBe(false)
  })
  it('keeps rupee figures off the site, in the blurb and in the highlights (owner rule)', () => {
    for (const text of ['Tickets are ₹450', 'Entry Rs. 450', 'raised 2 lakh', '500 rupees']) {
      expect(validateEventForm({ ...good(), blurb: text }).ok, text).toBe(false)
    }
    expect(validateEventForm({ ...good(), blurb: 'ok', highlights: 'Entry INR 450' }).ok).toBe(false)
  })
  it('refuses a non-numeric order and an over-long blurb', () => {
    expect(validateEventForm({ ...good(), sort: 'first' }).ok).toBe(false)
    expect(validateEventForm({ ...good(), blurb: 'x'.repeat(401) }).ok).toBe(false)
    expect(validateEventForm({ ...good(), sort: '-5' }).ok).toBe(true)
  })
})

describe('programmes', () => {
  const p = (o: Partial<ProgrammeRow> = {}): ProgrammeRow => ({ name: 'Food distribution', line: 'Meals.', photo: 'food', photo_alt: 'A volunteer.', sort: 10, published: true, ...o })
  it('only shows a programme photo it has a file for, and its description with it', () => {
    expect(rowToProgramme(p())).toMatchObject({ photo: 'food', photoAlt: 'A volunteer.' })
    expect(rowToProgramme(p({ photo: 'mystery' }))).toEqual({ name: 'Food distribution', line: 'Meals.', photo: undefined, photoAlt: undefined })
  })
  it('requires a description whenever a photo is chosen, for accessibility', () => {
    const r = validateProgrammeForm({ ...emptyProgrammeForm(), name: 'X', line: 'y', photo: 'food', photoAlt: ' ' })
    expect(!r.ok && r.errors.photoAlt).toBeTruthy()
    expect(validateProgrammeForm({ ...emptyProgrammeForm(), name: 'X', line: 'y' }).ok).toBe(true)
  })
  it('refuses an unknown photo, a duplicate name and a rupee figure', () => {
    expect(validateProgrammeForm({ ...emptyProgrammeForm(), name: 'X', line: 'y', photo: 'nope', photoAlt: 'z' }).ok).toBe(false)
    expect(validateProgrammeForm({ ...emptyProgrammeForm(), name: 'Pather Sathi', line: 'y' }, ['Pather Sathi']).ok).toBe(false)
    expect(validateProgrammeForm({ ...emptyProgrammeForm(), name: 'X', line: 'Costs ₹500 a month' }).ok).toBe(false)
  })
  it('clears the description when the photo is removed, so no orphan text is stored', () => {
    const r = validateProgrammeForm({ ...programmeToForm(p()), photo: '', photoAlt: 'left over' })
    expect(r.ok && r.row.photo_alt).toBeNull()
  })
})

describe('the built-in fallback the site shows before, or without, the database', () => {
  it('passes the same rules the editor enforces, so seeding it can never be refused', () => {
    for (const e of EVENTS) {
      const r = validateEventForm({ ...emptyEventForm(), slug: e.slug, name: e.name, edition: e.edition ?? '', status: e.status, whenKey: e.when, dateLabel: e.dateLabel, blurb: e.blurb, venue: e.venue ?? '', timeLabel: e.time ?? '', href: e.href ?? '', photoIds: (e.photos ?? []).join(','), highlights: (e.highlights ?? []).join('\n') })
      expect(r.ok, e.slug).toBe(true)
    }
    for (const pr of PROGRAMMES) expect(validateProgrammeForm({ ...emptyProgrammeForm(), name: pr.name, line: pr.line, photo: pr.photo ?? '', photoAlt: pr.photoAlt ?? '' }).ok, pr.name).toBe(true)
  })
  it('splits into upcoming and past, past newest first', () => {
    expect(upcomingOf(EVENTS)).toHaveLength(1)
    const w = pastOf(EVENTS).map(e => e.when)
    expect([...w].sort().reverse()).toEqual(w)
  })
})
