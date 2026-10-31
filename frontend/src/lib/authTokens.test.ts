import { describe, it, expect } from 'vitest'
import {
  CANONICAL_FIGURES,
  countToken,
  photoToken,
  isCanonicalFigure,
  splitHeadline,
} from './authTokens'
import { ORG_FACTS, displayCount } from './orgFacts'

/**
 * These tests exist to stop three specific decisions from being quietly undone
 * by a later pass. Two of them are privacy decisions, not style preferences.
 */

describe('count tokens carry canonical figures only', () => {
  it('accepts every canonical figure', () => {
    for (const f of CANONICAL_FIGURES) {
      expect(countToken(f, 'projects')).not.toBeNull()
    }
  })

  it('rejects the two placeholder figures github.md records as fake', () => {
    // "12,480 lives reached" and "41 projects delivered" exist nowhere in the
    // codebase. They were in the design canvas and are the reason this guard
    // exists.
    expect(countToken('12,480', 'lives reached')).toBeNull()
    expect(countToken('41', 'projects')).toBeNull()
  })

  it('rejects the live member count, which is not the public figure', () => {
    // ORG_FACTS.membersTotal is the real live count (1,317 as of the last
    // regeneration); the public figure is displayCount(ORG_FACTS.membersTotal)
    // ('1,300+' at that count), deliberately rounded DOWN from it. Rendering
    // the raw live number would be a new, un-rounded claim.
    expect(countToken(String(ORG_FACTS.membersTotal), 'members')).toBeNull()
    expect(countToken('1,370', 'members')).toBeNull()
  })

  it('rejects an invented member number, which is how 1,247 spread', () => {
    expect(countToken('1,247', 'members')).toBeNull()
  })

  it('rejects an arbitrary number', () => {
    expect(countToken('7', 'labs projects')).toBeNull()
    expect(countToken('999', 'anything')).toBeNull()
    expect(countToken('', 'empty')).toBeNull()
  })

  it('isCanonicalFigure narrows correctly', () => {
    expect(isCanonicalFigure('1,300+')).toBe(true)
    expect(isCanonicalFigure('1,301+')).toBe(false)
  })

  it('CANONICAL_FIGURES\' two derived entries match displayCount(ORG_FACTS.*) — see the comment above CANONICAL_FIGURES in authTokens.ts', () => {
    // These two literals cannot be computed inline (a TS literal-union type
    // needs literal values), so they are kept in sync by convention instead.
    // This is the guard that turns a silent drift into a loud test failure the
    // next time scripts/compute-org-facts.mjs moves either figure enough to
    // change its rounded display.
    expect(CANONICAL_FIGURES).toContain(displayCount(ORG_FACTS.membersTotal))
    expect(CANONICAL_FIGURES).toContain(displayCount(ORG_FACTS.drivesWrittenUp))
  })
})

describe('photo tokens', () => {
  it('rejects a Google Drive URL, which is not a public image source', () => {
    // These render for the uploader and 404 for everyone else, so the failure
    // is invisible in development. All 26 AQ Labs photos are this shape.
    expect(photoToken('https://drive.google.com/open?id=abc', 'a drive')).toBeNull()
    expect(photoToken('https://DRIVE.GOOGLE.COM/file/d/x', 'a drive')).toBeNull()
  })

  it('rejects a photo with no real alt text', () => {
    expect(photoToken('/photos/drive.jpg', '')).toBeNull()
  })

  it('rejects a non-URL', () => {
    expect(photoToken('photos/drive.jpg', 'a drive')).toBeNull()
  })

  it('accepts a hosted absolute or root-relative image with alt text', () => {
    expect(photoToken('/photos/khidirpur.jpg', 'Volunteers at the Khidirpur drive')).not.toBeNull()
    expect(photoToken('https://cdn.example.org/a.jpg', 'A workshop in progress')).not.toBeNull()
  })
})

describe('the initials-disc token does not exist, and that is deliberate', () => {
  it('has exactly two token kinds', () => {
    // Section 02 step 40 names three kinds. The third, a member's initials
    // disc, is not implemented: /login is a signed-out public page, the funnel
    // constraint is "never name a member who has not opted into being named",
    // and there is no opt-in-to-be-named column. If this test is failing
    // because someone added 'initials', that column had better exist now.
    const kinds = new Set(
      [countToken('540+', 'projects'), photoToken('/a.jpg', 'alt')]
        .filter(Boolean)
        .map(t => t!.kind),
    )
    expect(kinds).toEqual(new Set(['count', 'photo']))
  })

  it('no factory can produce a token carrying a person', () => {
    // A name or initials must not reach a token through the count path either.
    expect(countToken('AK', 'member')).toBeNull()
    expect(countToken('Aarushi', 'member')).toBeNull()
  })
})

describe('splitHeadline', () => {
  it('with no emphasis, the whole headline stays ink', () => {
    expect(splitHeadline('back again.', undefined)).toEqual([
      { text: 'back again.', strong: true },
    ])
  })

  it('greys everything but the marked clause', () => {
    expect(splitHeadline('the work behind the posts.', 'posts.')).toEqual([
      { text: 'the work behind the ', strong: false },
      { text: 'posts.', strong: true },
    ])
  })

  it('handles emphasis in the middle', () => {
    expect(splitHeadline('you were approved.', 'approved')).toEqual([
      { text: 'you were ', strong: false },
      { text: 'approved', strong: true },
      { text: '.', strong: false },
    ])
  })

  it('an unmatched emphasis degrades to today behaviour, not to a broken line', () => {
    expect(splitHeadline('still deciding?', 'nope')).toEqual([
      { text: 'still deciding?', strong: true },
    ])
  })

  it('emphasis equal to the whole headline is a single strong segment', () => {
    expect(splitHeadline('back again.', 'back again.')).toEqual([
      { text: 'back again.', strong: true },
    ])
  })

  it('never drops or duplicates a character', () => {
    const h = 'the work behind the posts.'
    for (const e of ['posts.', 'work', 'the', undefined, 'zzz', h]) {
      const joined = splitHeadline(h, e).map(s => s.text).join('')
      expect(joined).toBe(h)
    }
  })
})
