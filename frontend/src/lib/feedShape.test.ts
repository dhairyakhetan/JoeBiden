import { describe, expect, it } from 'vitest'
import {
  CATEGORY_HAS_HUE,
  FAMILY_ORDER,
  SHAPE_CATALOGUE,
  chooseCardShape,
  imageCountOf,
  isRealPostBody,
  newShapeSession,
  shapesInFamily,
  splitPostBody,
  type CardShape,
  type FeedItem,
} from './feedShape'

/* ─────────────────────────────────────────────────────────────────────────
   Section 10 step 8 names four verifications by hand. Three of them are pure
   and live here; the fourth (44px targets at 375px) is a render check and is
   recorded in CHANGELOG_SEC10_34.md instead of being faked with a unit test.

   The rest of this file pins the two orders that section 10 calls
   load-bearing: family order, and the family-05 tie-break order.
   ───────────────────────────────────────────────────────────────────────── */

const post = (over: Partial<FeedItem> = {}): FeedItem => ({
  id: 'p1',
  kind: 'post',
  category: 'welfare',
  body: 'x'.repeat(300),
  imageCount: 0,
  authorId: 1143,
  display: {},
  ...over,
})

describe('the catalogue', () => {
  it('is 30 shapes', () => {
    expect(SHAPE_CATALOGUE).toHaveLength(30)
  })

  it('has no duplicate ids', () => {
    const ids = SHAPE_CATALOGUE.map(s => s.id)
    expect(new Set(ids).size).toBe(30)
  })

  it('is 8 families and every shape belongs to one of them', () => {
    expect(FAMILY_ORDER).toHaveLength(8)
    for (const s of SHAPE_CATALOGUE) expect(FAMILY_ORDER).toContain(s.family)
  })

  it('matches the family membership section 10 prints', () => {
    // Canvas numbering. Section 10's own table writes family 03 as
    // "C11 project active, C11b project delivered", a typo for the C10 / C11
    // pair the 30 rendered cards actually carry.
    const ids = (f: Parameters<typeof shapesInFamily>[0]) => shapesInFamily(f).map(s => s.id).sort()
    expect(ids('00-chrome')).toEqual(['C08', 'C23', 'C24'])
    expect(ids('01-moments')).toEqual(['C14', 'C15', 'C16'])
    expect(ids('02-asks')).toEqual(['C18', 'C19', 'C26', 'C27', 'C30'])
    expect(ids('03-records')).toEqual(['C09', 'C10', 'C11', 'C12', 'C13', 'C20', 'C21'])
    expect(ids('04-editorial')).toEqual(['C06'])
    expect(ids('05-posts')).toEqual(['C01', 'C02', 'C03', 'C04', 'C05', 'C07'])
    expect(ids('06-digest')).toEqual(['C17', 'C22', 'C28'])
    expect(ids('07-fallback')).toEqual(['C25', 'C29'])
  })

  it('records the shapes the real table cannot populate', () => {
    // Counted, not sampled. See CHANGELOG_SEC10_34.md for the full ledger.
    //
    // C03 was removed from this list on 2026-09-07. It never belonged: it is
    // the single most reachable content shape (504 of 585 rows carry exactly
    // one image; it measured 36 of 51 cards on the real feed). This test
    // pinning it as unpopulatable is what forced an earlier correct fix to be
    // reverted, so the owner unfroze the test and both were fixed together.
    //
    // C02, C04 and C06 were removed on 2026-09-11, on a second owner decision
    // recorded in ACCEPTANCE.md §E. None of the three was ever blocked by the
    // shape of the data:
    //   C04  post_feed_view emitted only welfare_projects.main_image and threw
    //        away image_1..image_4. 100 projects carry three or more photos.
    //   C02  the 240-character floor made the colour block impossible rather
    //        than rare - 0 of 586 rows fell in 240-600, while 311 sit at
    //        120-179. The floor moved to 120.
    //   C06  36 blog rows are already in this feed. The blocker was the CARD:
    //        it rendered no engagement row, so routing a blog through it would
    //        have silently dropped like/bookmark/comment/share.
    const none = SHAPE_CATALOGUE.filter(s => s.data === 'none').map(s => s.id).sort()
    // C01 STAYS. It needs an image aspect ratio and nothing in the schema
    // stores width or height, so it is the one content shape still blocked by
    // the data rather than by a threshold or a card.
    expect(none).toEqual(['C01', 'C17', 'C20', 'C21', 'C22', 'C26', 'C28'])
  })

  it('says why C06 long read is now reachable', () => {
    // Was "says why C06 long read has no data", asserting data === 'none' and
    // a note about the 900-character ceiling. Both were wrong about the
    // reason: the blogs ARE in this feed (post_feed_view joins them), and the
    // real blocker was the card's missing engagement row. Owner decision
    // 2026-09-11, ACCEPTANCE.md §E.
    const c06 = SHAPE_CATALOGUE.find(s => s.id === 'C06')!
    expect(c06.data).toBe('live')
    expect(c06.dataNote).toContain('36 blog rows')
  })
})

describe('family order', () => {
  it('00 chrome resolves before anything else: a pinned post is C08 whatever else it carries', () => {
    const s = newShapeSession()
    const item = post({ pinned: true, featured: true, imageCount: 1, aspect: 1.5, body: 'short', moment: 'birthday', ask: 'hiring' })
    expect(chooseCardShape(item, s).shape).toBe('C08')
  })

  it('01 moments outrank a content row', () => {
    const s = newShapeSession()
    expect(chooseCardShape(post({ moment: 'birthday', momentKey: 'b:9' }), s).shape).toBe('C15')
    expect(chooseCardShape(post({ moment: 'welcome', momentKey: 'w:9' }), s).shape).toBe('C14')
    expect(chooseCardShape(post({ moment: 'break', momentKey: 'k:9' }), s).shape).toBe('C16')
  })

  it('a moment seen once is suppressed and the row falls through to the next family', () => {
    const s = newShapeSession()
    const item = post({ moment: 'birthday', momentKey: 'b:9', body: 'a short line' })
    expect(chooseCardShape(item, s).shape).toBe('C15')
    // same member, same day, second appearance
    const again = chooseCardShape({ ...item, id: 'p2' }, s)
    expect(again.shape).toBe('C05')
    expect(again.family).toBe('05-posts')
  })

  it('02 asks are throttled to one per five cards, and a throttled ask falls through', () => {
    const s = newShapeSession()
    expect(chooseCardShape(post({ ask: 'hiring' }), s).shape).toBe('C19')
    // next card, an ask again: too soon
    const second = chooseCardShape(post({ ask: 'poll', body: 'x'.repeat(200) }), s)
    expect(second.shape).not.toBe('C26')
    expect(second.family).toBe('05-posts')
    // walk out to five cards apart
    for (let i = 0; i < 3; i++) chooseCardShape(post({ authorId: 900 + i }), s)
    expect(chooseCardShape(post({ ask: 'poll' }), s).shape).toBe('C26')
  })

  it('03 records take their shape from the record type, never from body length', () => {
    const s = newShapeSession()
    const long = 'x'.repeat(5000)
    expect(chooseCardShape(post({ record: 'drive', body: long }), s).shape).toBe('C09')
    expect(chooseCardShape(post({ record: 'certificate', body: '' }), s).shape).toBe('C13')
    expect(chooseCardShape(post({ record: 'project_active' }), s).shape).toBe('C10')
    expect(chooseCardShape(post({ record: 'project_delivered' }), s).shape).toBe('C11')
  })

  it('04 editorial beats 05 posts', () => {
    const s = newShapeSession()
    expect(chooseCardShape(post({ longRead: true, imageCount: 1, aspect: 2 }), s).shape).toBe('C06')
  })

  it('06 digest never fires twice in one session', () => {
    const s = newShapeSession()
    expect(chooseCardShape({ id: 'd1', kind: 'system', digest: 'roundup', display: {} }, s).shape).toBe('C22')
    expect(chooseCardShape({ id: 'd2', kind: 'system', digest: 'spotlight', display: {} }, s).shape).toBe('C25')
  })

  it('07 always matches: an unclassifiable row still gets a shape', () => {
    const s = newShapeSession()
    expect(chooseCardShape({ id: 'x', kind: 'labs', display: {} }, s).shape).toBe('C25')
    expect(chooseCardShape({ id: 'y', kind: 'system', terminal: true, display: {} }, s).shape).toBe('C29')
  })
})

describe('family 05 tie-break', () => {
  it('rule 1: featured, exactly one landscape image, body under 240 gives the hero', () => {
    const s = newShapeSession()
    const d = chooseCardShape(post({ featured: true, imageCount: 1, aspect: 1.5, body: 'a short recap' }), s)
    expect(d.shape).toBe('C01')
    expect(s.heroUsed).toBe(true)
  })

  it('SECTION 10 STEP 8: a featured post with three images and a 200-char body is C04, not C01', () => {
    const s = newShapeSession()
    const d = chooseCardShape(post({ featured: true, imageCount: 3, aspect: 1.5, body: 'x'.repeat(200) }), s)
    // Rule 1 requires EXACTLY one image. That clause is the whole tie-break.
    expect(d.shape).toBe('C04')
  })

  it('one hero per session: the second qualifying post falls through', () => {
    const s = newShapeSession()
    const hero = post({ featured: true, imageCount: 1, aspect: 1.5, body: 'short', authorId: 11 })
    expect(chooseCardShape(hero, s).shape).toBe('C01')
    expect(chooseCardShape({ ...hero, id: 'p2', authorId: 12 }, s).shape).toBe('C03')
  })

  it('rule 3 needs a mapped hue, a picture and a 120 to 600 body', () => {
    const s = newShapeSession()
    const d = chooseCardShape(post({ imageCount: 1, category: 'welfare', body: 'x'.repeat(300) }), s)
    expect(d.shape).toBe('C02')
  })

  it('rule 3 does not fire for an unmapped category, it falls to rule 4', () => {
    const s = newShapeSession()
    // 'hr' is not one of the five write-path categories.
    expect(CATEGORY_HAS_HUE).not.toContain('hr')
    const d = chooseCardShape(post({ imageCount: 1, category: 'hr', body: 'x'.repeat(300) }), s)
    expect(d.shape).toBe('C03')
  })

  it('cap: two colour blocks in a row with the same hue demote the second to C03', () => {
    const s = newShapeSession()
    const block = post({ imageCount: 1, category: 'welfare', body: 'x'.repeat(300), authorId: 1 })
    expect(chooseCardShape(block, s).shape).toBe('C02')
    const second = chooseCardShape({ ...block, id: 'p2', authorId: 2 }, s)
    expect(second.shape).toBe('C03')
    expect(second.rule).toContain('demoted')
  })

  it('cap: one ink card every ten rows, so a different hue too soon is still demoted', () => {
    const s = newShapeSession()
    expect(chooseCardShape(post({ imageCount: 1, category: 'welfare', body: 'x'.repeat(300), authorId: 1 }), s).shape).toBe('C02')
    const soon = chooseCardShape(post({ imageCount: 1, category: 'events', body: 'x'.repeat(300), authorId: 2 }), s)
    expect(soon.shape).toBe('C03')
    expect(soon.rule).toContain('ink cap')
  })

  it('rule 5 vs rule 6: 180 characters is the line', () => {
    const s = newShapeSession()
    expect(chooseCardShape(post({ body: 'x'.repeat(179), authorId: 1 }), s).shape).toBe('C05')
    expect(chooseCardShape(post({ body: 'x'.repeat(180), authorId: 2 }), s).shape).toBe('C07')
  })

  it('rule 7: below the fold overrides every content rule above it', () => {
    const s = newShapeSession()
    const d = chooseCardShape(post({ featured: true, imageCount: 1, aspect: 2, body: 'short', belowFold: true }), s)
    expect(d.shape).toBe('C25')
    expect(s.heroUsed).toBe(false)
  })

  it('rule 7: the fourth card from one author collapses to C25, the first three do not', () => {
    const s = newShapeSession()
    const shapes: CardShape[] = []
    for (let i = 0; i < 5; i++) shapes.push(chooseCardShape(post({ id: `p${i}`, authorId: 1143 }), s).shape)
    expect(shapes).toEqual(['C07', 'C07', 'C07', 'C25', 'C25'])
  })

  it('the author cap is per author, not per feed', () => {
    const s = newShapeSession()
    for (let i = 0; i < 4; i++) chooseCardShape(post({ id: `a${i}`, authorId: 1143 }), s)
    expect(chooseCardShape(post({ id: 'b', authorId: 477 }), s).shape).toBe('C07')
  })
})

describe('display guards', () => {
  it('skips the junk that is actually published today', () => {
    // post 774, live in the table
    expect(isRealPostBody('xcv xv')).toBe(false)
    expect(isRealPostBody('')).toBe(false)
    expect(isRealPostBody('   ')).toBe(false)
    expect(isRealPostBody('n/a')).toBe(false)
    expect(isRealPostBody('TBD')).toBe(false)
  })

  it('keeps real writing, including the short single-line bodies', () => {
    expect(isRealPostBody('We ran out of food in forty minutes.')).toBe(true)
    expect(isRealPostBody('Plantation drive at Rabindra Sarobar')).toBe(true)
  })

  it('imageCountOf never returns a negative or a fraction', () => {
    expect(imageCountOf({ imageCount: undefined })).toBe(0)
    expect(imageCountOf({ imageCount: -3 })).toBe(0)
    expect(imageCountOf({ imageCount: 2.7 })).toBe(2)
  })
})

describe('splitPostBody', () => {
  it('splits the 583 title / blank line / sentence bodies', () => {
    const { title, rest } = splitPostBody('Plantation drive\n\nWe planted forty saplings near the canal.')
    expect(title).toBe('Plantation drive')
    expect(rest).toBe('We planted forty saplings near the canal.')
  })

  it('gives the 3 single-line bodies a title-only fallback', () => {
    const { title, rest } = splitPostBody('Feeding drive at Topsia')
    expect(title).toBe('Feeding drive at Topsia')
    expect(rest).toBe('')
  })

  it('falls back to a single newline when there is no blank line', () => {
    const { title, rest } = splitPostBody('Book drive\nSix classrooms.')
    expect(title).toBe('Book drive')
    expect(rest).toBe('Six classrooms.')
  })
})
