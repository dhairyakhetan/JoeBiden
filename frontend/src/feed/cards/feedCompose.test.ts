import { describe, expect, it } from 'vitest'
import { GROUP_MAX, composeFeed, groupKeyOf, varyRuns } from './feedCompose'
import type { FeedItem, ShapeDecision } from '../../lib/feedShape'

/* The composition layer's failure mode is silent: it produces a feed that
   renders, just badly (seventeen one-row "more from AquaTerra" cards). So the
   cases pinned here are the degeneracies, not the happy path. */

let n = 0
const post = (over: Partial<FeedItem> = {}, display: Partial<FeedItem['display']> = {}): FeedItem => ({
  id: `p${++n}`,
  kind: 'post',
  category: 'welfare',
  body: 'x'.repeat(300),
  imageCount: 0,
  authorId: 1,
  display: { authorName: 'AquaTerra', timeLabel: '2h', href: '/post/x', ...display },
  ...over,
})

describe('groupKeyOf', () => {
  it('keys a post by its author', () => {
    expect(groupKeyOf(post({ authorId: 7 }))).toBe('author:7')
  })

  it('refuses a row with no href - ACCEPTANCE §E needs every C25 row openable', () => {
    expect(groupKeyOf(post({}, { href: undefined }))).toBeNull()
  })

  it('refuses a row with no author, and anything that is not a post', () => {
    expect(groupKeyOf(post({ authorId: null }))).toBeNull()
    expect(groupKeyOf(post({ kind: 'drive' }))).toBeNull()
  })
})

describe('composeFeed · the group-of-1 fallback', () => {
  it('never renders a single demoted post as a one-row group', () => {
    // Three posts from one author: under AUTHOR_CAP, so none is demoted, and
    // the fourth is the first C25. One demoted row on its own must come back
    // as its content shape, not as C25 with a count of 1.
    const items = [post(), post(), post(), post()]
    const out = composeFeed(items)
    expect(out).toHaveLength(4)
    expect(out.every(c => c.size === 1)).toBe(true)
    // The 4th tripped rule 05.7 and was re-shaped back to its content shape.
    expect(out[3].decision.shape).not.toBe('C25')
    expect(out[3].decision.shape).toBe('C07') // imageless, body >= 180
  })

  it('re-shapes a short demoted post to C05 and a photo post to its image rule', () => {
    // Separate runs, so each demoted row really is a group of one.
    const lead = () => [post(), post(), post()]
    const a = composeFeed([...lead(), post({ body: 'a short one.' })])
    expect(a[3].size).toBe(1)
    expect(a[3].decision.shape).toBe('C05')
    const b = composeFeed([...lead(), post({ imageCount: 1 })])
    expect(b[3].size).toBe(1)
    // body 240-600 + a mapped hue -> 05.3, the colour block. The point is that
    // it is an image shape and not the row list.
    expect(b[3].decision.shape).toBe('C02')
  })

  it('does not resurrect a moment that a cap already suppressed', () => {
    // Same momentKey twice: the second is suppressed and falls through to the
    // post rules. A naive fresh-session re-shape would bring C15 back.
    const a = post({ moment: 'birthday', momentKey: 'b:1' })
    const b = post({ moment: 'birthday', momentKey: 'b:1', belowFold: true })
    const out = composeFeed([a, b])
    expect(out[0].decision.shape).toBe('C15')
    expect(out[1].decision.shape).not.toBe('C15')
  })

  it('leaves a 07.2 fallback alone - it has no author to name', () => {
    const sys: FeedItem = { id: 's1', kind: 'system', display: {} }
    const out = composeFeed([sys])
    expect(out[0].decision.shape).toBe('C25')
    expect(out[0].size).toBe(1)
    expect(out[0].members).toBeUndefined()
  })
})

describe('composeFeed · the real 2-author feed', () => {
  it('collapses a run instead of emitting one card per post', () => {
    // 20 posts, one author - the live shape of this feed.
    const items = Array.from({ length: 20 }, () => post())
    const out = composeFeed(items)
    // 3 uncollapsed (under the cap) + the rest in groups of GROUP_MAX.
    const groups = out.filter(c => c.size > 1)
    expect(groups.length).toBeGreaterThan(0)
    expect(out.length).toBeLessThan(items.length)
    // Nothing is lost and nothing is duplicated.
    const seen = out.flatMap(c => c.members ? c.members.map(m => m.id) : [c.item.id])
    expect(seen).toEqual(items.map(i => i.id))
    // No group has a count of 1.
    expect(out.some(c => c.decision.shape === 'C25' && c.size === 1 && c.members)).toBe(false)
  })

  it('caps a group at GROUP_MAX rather than swallowing the page', () => {
    const items = Array.from({ length: 40 }, () => post())
    const out = composeFeed(items)
    expect(Math.max(...out.map(c => c.size))).toBe(GROUP_MAX)
  })

  it('does not group across authors, and does not reorder', () => {
    // A,A,A,A,B,A,A,A,A - the two demoted A-runs must stay either side of B.
    const mk = (author: number) => post({ authorId: author }, { authorName: `A${author}` })
    const items = [mk(1), mk(1), mk(1), mk(1), mk(2), mk(1), mk(1), mk(1), mk(1)]
    const out = composeFeed(items)
    const flat = out.flatMap(c => c.members ? c.members.map(m => m.id) : [c.item.id])
    expect(flat).toEqual(items.map(i => i.id))
    for (const c of out) {
      if (!c.members) continue
      expect(new Set(c.members.map(m => m.authorId)).size).toBe(1)
    }
  })

  it('every row of every group carries an href and a real verb', () => {
    const items = Array.from({ length: 12 }, (_, i) =>
      post({ body: `Headline ${i}.\n\nThe rest of it.` }, { href: `/post/${i}` }))
    const out = composeFeed(items)
    const rows = out.flatMap(c => c.item.display.rows ?? [])
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      expect(r.href).toBeTruthy()
      expect(r.verb).not.toBe('')
      expect(r.verb).not.toContain('\n\n') // splitPostBody, not a slice
    }
  })

  it('drops the category rather than claiming one when a group is mixed', () => {
    const items = [
      ...Array.from({ length: 4 }, () => post({}, { category: 'welfare' })),
      ...Array.from({ length: 4 }, () => post({}, { category: 'events' })),
    ]
    const out = composeFeed(items)
    const group = out.find(c => c.size > 1)
    expect(group).toBeTruthy()
    expect(group!.item.display.category).toBeNull()
  })

  it('emits an href-less row as its own card instead of a dead link', () => {
    const items = [post(), post(), post(), post(), post({}, { href: undefined }), post(), post(), post(), post()]
    const out = composeFeed(items)
    const rows = out.flatMap(c => c.item.display.rows ?? [])
    expect(rows.every(r => !!r.href)).toBe(true)
    // The href-less one still appears, as a single card.
    const flat = out.flatMap(c => c.members ? c.members.map(m => m.id) : [c.item.id])
    expect(flat).toHaveLength(items.length)
  })
})

/* ────────────────────────────────────────────────────────────────────────────
   varyRuns · the same content on different card designs

   These exist because the defect they pin was reported by the owner looking at
   the page, twice, after the code had been called done: first "I only see 3-4"
   card designs, then a wall of eight identical blog cards further down. Neither
   is visible to a typecheck or to any grep, and neither surfaces in a browser
   without scrolling past the first screen - so they are pinned here, where the
   gates actually run, rather than trusted to another manual look.
   ──────────────────────────────────────────────────────────────────────────── */
describe('varyRuns · design variety', () => {
  const d = (shape: string, family = '05-posts'): ShapeDecision =>
    ({ shape, family, rule: 'test' } as ShapeDecision)

  /** A row with N photos, a mapped category and a body of the given length. */
  const photo = (images: number, bodyLen = 300, category: string | null = 'welfare'): FeedItem => ({
    id: `i${++n}`,
    kind: 'post',
    category,
    body: 'x'.repeat(bodyLen),
    imageCount: images,
    authorId: 1,
    display: {
      authorName: 'AquaTerra',
      timeLabel: '2h',
      href: '/post/x',
      category,
      imageUrl: images ? 'u0' : undefined,
      imageUrls: images ? Array.from({ length: images }, (_, k) => ({ url: `u${k}`, alt: '' })) : undefined,
    },
  })

  it('rotates a repeated photo shape onto DIFFERENT designs, not one fallback', () => {
    // Five photo-shoot rows in a row - the live feed's actual shape once the
    // welfare image columns were exposed. The old rule turned this into
    // C04,C04,C03,C04,C04: two designs, still a wall.
    const items = Array.from({ length: 5 }, () => photo(3))
    const out = varyRuns(items.map(() => d('C04')), items)
    const shapes = out.map(s => s.shape)
    expect(new Set(shapes).size).toBeGreaterThanOrEqual(3)
    for (let i = 1; i < shapes.length; i++) {
      expect(shapes[i]).not.toBe(shapes[i - 1])
    }
  })

  it('never spends more than one hero on a page', () => {
    const items = Array.from({ length: 12 }, () => photo(3))
    const shapes = varyRuns(items.map(() => d('C04')), items).map(s => s.shape)
    expect(shapes.filter(s => s === 'C01')).toHaveLength(1)
  })

  it('refuses C02 for an unmapped category - .aqc-block would paint ink on ink', () => {
    // The colour block sits its type on hueOrInk(), which falls back to the
    // ink when a category is not one of the five. Rotating onto it anyway
    // renders an invisible headline.
    const items = Array.from({ length: 6 }, () => photo(3, 300, 'not-a-category'))
    const shapes = varyRuns(items.map(() => d('C04')), items).map(s => s.shape)
    expect(shapes).not.toContain('C02')
  })

  it('refuses C04 for a row that has no stack to show', () => {
    const items = Array.from({ length: 6 }, () => photo(1))
    const shapes = varyRuns(items.map(() => d('C03')), items).map(s => s.shape)
    expect(shapes).not.toContain('C04')
  })

  it('refuses the quote for a long body and keeps the text card instead', () => {
    const items = Array.from({ length: 4 }, () => photo(0, 900))
    const shapes = varyRuns(items.map(() => d('C07')), items).map(s => s.shape)
    // No image and a 900-char body: C05 is the only ring entry and it is
    // correctly refused, so the repeat stands rather than becoming a quote.
    expect(shapes.every(s => s === 'C07')).toBe(true)
  })

  it('breaks the wall of blogs, and relabels the family when it does', () => {
    // Eight C06s in a row, measured on the live feed once 36 blog rows came
    // into range. A rotated blog must not still claim '04-editorial'.
    const items = Array.from({ length: 8 }, () => ({ ...photo(1), longRead: true }))
    const out = varyRuns(items.map(() => d('C06', '04-editorial')), items)
    const shapes = out.map(s => s.shape)
    expect(new Set(shapes).size).toBeGreaterThanOrEqual(2)
    for (let i = 1; i < shapes.length; i++) expect(shapes[i]).not.toBe(shapes[i - 1])
    for (const s of out) {
      if (s.shape === 'C06') expect(s.family).toBe('04-editorial')
      else expect(s.family).toBe('05-posts')
    }
  })

  it('only ever calls something a long read if it IS one', () => {
    const items = Array.from({ length: 6 }, () => photo(1, 2000))
    const shapes = varyRuns(items.map(() => d('C03')), items).map(s => s.shape)
    expect(shapes).not.toContain('C06')
  })

  it('leaves C25 alone - composeFeed branches on those decisions', () => {
    const items = Array.from({ length: 6 }, () => photo(0))
    const shapes = varyRuns(items.map(() => d('C25')), items).map(s => s.shape)
    expect(shapes.every(s => s === 'C25')).toBe(true)
  })

  it('is idempotent - a second pass finds nothing left to change', () => {
    const items = Array.from({ length: 9 }, () => photo(3))
    const once = varyRuns(items.map(() => d('C04')), items)
    const twice = varyRuns(once, items)
    expect(twice.map(s => s.shape)).toEqual(once.map(s => s.shape))
  })

  it('passes everything through untouched when it is handed no items', () => {
    // The signature keeps `items` optional so a caller that only has decisions
    // still compiles. Without content it cannot check feasibility, so it must
    // change nothing rather than guess.
    const list = Array.from({ length: 6 }, () => d('C04'))
    expect(varyRuns(list).map(s => s.shape)).toEqual(list.map(s => s.shape))
  })

  it('composeFeed applies it, so the composed cards are what varied', () => {
    const items = Array.from({ length: 5 }, () => photo(3))
    const shapes = composeFeed(items).map(c => c.decision.shape)
    for (let i = 1; i < shapes.length; i++) expect(shapes[i]).not.toBe(shapes[i - 1])
  })
})
