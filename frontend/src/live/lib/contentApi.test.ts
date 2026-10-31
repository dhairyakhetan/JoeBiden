import { beforeEach, describe, expect, it, vi } from 'vitest'

// a chainable fake that records what the page asked for
const calls: { table: string; select?: string; filters: [string, unknown][]; insert?: unknown; update?: unknown }[] = []
vi.mock('../../lib/supabaseCommunity', () => ({
  supabaseCommunity: {
    from: (table: string) => {
      const c: (typeof calls)[number] = { table, filters: [] }
      calls.push(c)
      const b: any = {
        select: (s: string) => { c.select = s; return b },
        eq: (col: string, v: unknown) => { c.filters.push([col, v]); return b },
        order: () => b,
        insert: (v: unknown) => { c.insert = v; return Promise.resolve({ error: null }) },
        update: (v: unknown) => { c.update = v; return b },
        then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: [{ slug: 'x', name: 'x' }], error: null }).then(ok),
      }
      return b
    },
  },
}))

import { EVENT_PUBLIC_COLS, PROGRAMME_PUBLIC_COLS, fetchAllEvents, fetchAllProgrammes, fetchPublishedEvents, fetchPublishedProgrammes, saveEvent, saveProgramme } from './contentApi'
import type { EventRow, ProgrammeRow } from './content'

const ev: EventRow = { slug: 'a-night', name: 'A', edition: null, status: 'past', when_key: '2025', date_label: 'x', blurb: 'x', venue: null, time_label: null, href: null, photo_ids: [], highlights: [], sort: 0, published: true }
const pr: ProgrammeRow = { name: 'P', line: 'l', photo: null, photo_alt: null, sort: 0, published: true }

beforeEach(() => { calls.length = 0 })

describe('what the public site reads from the editable tables', () => {
  it('names its columns and never asks for everything, so a column added later is not published by accident', async () => {
    await fetchPublishedEvents(); await fetchPublishedProgrammes(); await fetchAllEvents(); await fetchAllProgrammes()
    expect(calls).toHaveLength(4)
    for (const c of calls) { expect(c.select).not.toBe('*'); expect(c.select).not.toMatch(/updated_by/) }
    expect(EVENT_PUBLIC_COLS).not.toMatch(/updated_by|\*/)
    expect(PROGRAMME_PUBLIC_COLS).not.toMatch(/updated_by|\*/)
  })
  it('filters to published rows itself, because a signed-in leader\'s policy would otherwise return drafts to the public page', async () => {
    await fetchPublishedEvents(); await fetchPublishedProgrammes()
    for (const c of calls) expect(c.filters).toContainEqual(['published', true])
  })
  it('the admin list does NOT filter, so a hidden night can be shown again', async () => {
    await fetchAllEvents()
    expect(calls[0].filters).toEqual([])
  })
})

describe('what an admin save sends', () => {
  it('never sends an editor identity, on insert or on update', async () => {
    await saveEvent(ev, true); await saveEvent(ev, false); await saveProgramme(pr, true); await saveProgramme(pr, false)
    const bodies = calls.map(c => c.insert ?? c.update) as Record<string, unknown>[]
    expect(bodies).toHaveLength(4)
    for (const b of bodies) expect(Object.keys(b)).not.toContain('updated_by')
  })
  it('updates a night by its address and leaves the address out of the changed fields', async () => {
    await saveEvent(ev, false)
    expect(calls[0].filters).toContainEqual(['slug', 'a-night'])
    expect(Object.keys(calls[0].update as object)).not.toContain('slug')
  })
})
