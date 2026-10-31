import { describe, expect, it } from 'vitest'
import {
  GRID_COLUMNS,
  GRID_RECIPES,
  ROW_UNIT_PX,
  WASH_FILL,
  chooseGridRecipe,
  endsWithMapTile,
  hasNoHoles,
  hueTileCount,
  iconsOnlyOnTallTiles,
  packGrid,
  spansFitTheGrid,
  tilesFor,
  type GridContext,
} from './gridRecipes'

/* ─────────────────────────────────────────────────────────────────────────
   Section 34 step 5 lists the verifications by name: the row unit is 72px;
   exactly one solid hue tile per recipe; icons only on the 2x2; every recipe
   ends with the map tile; G38 renders when the profile call fails; no tile
   shows a zero it did not fetch. Each has a test below with the same name.
   ───────────────────────────────────────────────────────────────────────── */

const NOW = new Date('2026-09-04T09:00:00Z')

const base: GridContext = { signedIn: true, now: NOW }

describe('the invariants', () => {
  it('the row unit is 72px', () => {
    // 58px was derived before the tile label was legible and clipped 13 of 16
    // tiles. Section 34 non-negotiable 2. Do not re-derive it.
    expect(ROW_UNIT_PX).toBe(72)
    expect(GRID_COLUMNS).toBe(4)
  })

  it('the wash is the paper at 7% on ink', () => {
    expect(WASH_FILL).toBe('rgba(244,239,224,.07)')
  })

  it('is nine recipes plus the fallback, in the order section 34 sets', () => {
    // 2026-09-07: G27 moved from fifth to third (a leader's waiting rows
    // outrank G19's generic browse prompt, and G19 matches nearly everyone
    // because drive_attendance is empty), and G21/G09/G30 were added. G33
    // still sits immediately above the floor.
    expect(GRID_RECIPES.map(r => r.id)).toEqual(
      ['G12', 'G04', 'G27', 'G01', 'G21', 'G09', 'G30', 'G19', 'G33', 'G38'],
    )
  })

  it('every recipe carries a written predicate, an intent and a provenance line', () => {
    for (const r of GRID_RECIPES) {
      expect(r.predicateText.length).toBeGreaterThan(0)
      expect(r.intent.length).toBeGreaterThan(40)
      expect(r.provenance.length).toBeGreaterThan(20)
    }
  })
})

// One representative context per recipe, so every recipe's tile list is
// actually exercised rather than only the ones a default context reaches.
const CONTEXTS: Record<string, GridContext> = {
  G12: { ...base, upcomingSignup: { title: 'Science City', inDays: 5, dateLabel: '18 dec', goingCount: 13 }, labsCount: 7, teamsCount: 8 },
  G04: { ...base, attendedCount: 3, nextOpenDrive: { title: 'Khidirpur books' }, hours: 18.5, teamName: 'Welfare Projects' },
  G19: { ...base, attendedCount: 0, daysSinceApproved: 40, openRolesCount: 3 },
  G01: { ...base, daysSinceApproved: 2, departmentName: 'Welfare Projects', openRolesCount: 3 },
  G27: {
    ...base,
    isDirector: true,
    queueDepth: 59,
    deptLabel: 'welfare and content',
    queues: [
      { key: 'approvals', label: 'members to approve', count: 54, href: '/director/approvals' },
      { key: 'teams', label: 'join requests', count: 3, href: '/director/teams' },
      { key: 'hiring', label: 'applications to read', count: 1, href: '/director/hiring' },
      { key: 'enquiries', label: 'enquiries', count: 1, href: '/director/enquiries' },
      { key: 'posts', label: 'posts to review', count: 0, href: '/director/posts' },
    ],
  },
  G30: { ...base, isDirector: true, queueDepth: 0, deptLabel: 'labs', teamsCount: 8, labsCount: 7 },
  G21: { ...base, ownPending: { label: 'your join request is waiting', count: 1, href: '/teams' }, teamsCount: 2 },
  G09: { ...base, unreadCount: 4, savedCount: 2 },
  G33: { ...base, breakStart: '2026-08-20', breakEnd: '2026-10-14' },
  G38: {},
}

describe('every recipe, on its own context', () => {
  for (const recipe of GRID_RECIPES) {
    const ctx = CONTEXTS[recipe.id]
    const tiles = tilesFor(recipe, ctx)

    it(`${recipe.id} carries at most one solid hue tile`, () => {
      expect(hueTileCount(tiles)).toBeLessThanOrEqual(1)
    })

    it(`${recipe.id} ends with the full-width map tile`, () => {
      expect(endsWithMapTile(tiles)).toBe(true)
    })

    it(`${recipe.id} puts icons only on tiles spanning two or more rows`, () => {
      expect(iconsOnlyOnTallTiles(tiles)).toBe(true)
    })

    it(`${recipe.id} fits a 4-column grid with no dead cells`, () => {
      expect(spansFitTheGrid(tiles)).toBe(true)
      expect(hasNoHoles(tiles)).toBe(true)
    })
  }

  it('every recipe but the fallback carries exactly one hue tile; only G38 carries none', () => {
    for (const r of GRID_RECIPES) {
      const n = hueTileCount(tilesFor(r, CONTEXTS[r.id]))
      expect(n).toBe(r.id === 'G38' ? 0 : 1)
    }
  })
})

describe('first match wins, top to bottom', () => {
  it('G12 wins when a signup sits inside 14 days', () => {
    expect(chooseGridRecipe(CONTEXTS.G12).id).toBe('G12')
  })

  it('a signup further out than 14 days does not reach G12', () => {
    const ctx = { ...base, upcomingSignup: { title: 'Science City', inDays: 20 }, attendedCount: 2 }
    expect(chooseGridRecipe(ctx).id).not.toBe('G12')
  })

  it('G04 wins with no signup but a history', () => {
    expect(chooseGridRecipe(CONTEXTS.G04).id).toBe('G04')
  })

  it('G19 wins after the first week with nothing attended', () => {
    expect(chooseGridRecipe(CONTEXTS.G19).id).toBe('G19')
  })

  it('G27 outranks G19: a leader with a full desk is not told to go and find something to do', () => {
    // This is the live shape today - drive_attendance holds 0 rows, so every
    // leader has attendedCount 0 and would otherwise match G19.
    const hodWithDesk: GridContext = { ...CONTEXTS.G27, attendedCount: 0, daysSinceApproved: 90 }
    expect(chooseGridRecipe(hodWithDesk).id).toBe('G27')
  })

  it('G27 decomposes the depth into the two biggest queues it was given', () => {
    const tiles = tilesFor(GRID_RECIPES.find(r => r.id === 'G27')!, CONTEXTS.G27)
    expect(tiles.find(t => t.key === 'q-approvals')!.figure).toBe('54')
    expect(tiles.find(t => t.key === 'q-teams')!.figure).toBe('3')
    // A queue at zero is never one of the two named.
    expect(tiles.some(t => t.key === 'q-posts')).toBe(false)
  })

  it('G27 still packs with no holes when the breakdown did not resolve', () => {
    const noBreakdown: GridContext = { ...base, isDirector: true, queueDepth: 12 }
    const tiles = tilesFor(GRID_RECIPES.find(r => r.id === 'G27')!, noBreakdown)
    expect(hasNoHoles(tiles)).toBe(true)
    expect(hueTileCount(tiles)).toBe(1)
  })

  it('G30 needs a queue that RESOLVED to zero, never one that failed to resolve', () => {
    expect(chooseGridRecipe(CONTEXTS.G30).id).toBe('G30')
    // Unresolved: no queueDepth at all. G30 must not claim the desk is clear.
    const unresolved: GridContext = { ...base, isDirector: true, daysSinceApproved: 90, attendedCount: 0 }
    expect(chooseGridRecipe(unresolved).id).not.toBe('G30')
  })

  it('G21 wins for a member whose own submission is still waiting', () => {
    expect(chooseGridRecipe(CONTEXTS.G21).id).toBe('G21')
    // Resolved-and-empty is not a reminder.
    expect(chooseGridRecipe({ ...base, ownPending: null, daysSinceApproved: 90, attendedCount: 0 }).id).toBe('G19')
  })

  it('G09 wins on the member own trail, and needs at least one real row', () => {
    expect(chooseGridRecipe(CONTEXTS.G09).id).toBe('G09')
    expect(chooseGridRecipe({ ...base, unreadCount: 0, savedCount: 0, daysSinceApproved: 90, attendedCount: 0 }).id).toBe('G19')
  })

  it('G21 outranks G09: an open loop of theirs beats a reading list', () => {
    expect(chooseGridRecipe({ ...CONTEXTS.G21, unreadCount: 9, savedCount: 4 }).id).toBe('G21')
  })

  it('G01 outranks both: a week-old account has no trail to pick up', () => {
    expect(chooseGridRecipe({ ...CONTEXTS.G09, daysSinceApproved: 2 }).id).toBe('G01')
  })

  it('G01 wins inside the first week', () => {
    expect(chooseGridRecipe(CONTEXTS.G01).id).toBe('G01')
  })

  it('G19 outranks G01 for an account older than 7 days, and G01 catches the new one', () => {
    expect(chooseGridRecipe({ ...base, attendedCount: 0, daysSinceApproved: 8 }).id).toBe('G19')
    expect(chooseGridRecipe({ ...base, attendedCount: 0, daysSinceApproved: 7 }).id).toBe('G01')
  })

  it('G27 wins for a leader with rows waiting, and not for an empty queue', () => {
    expect(chooseGridRecipe(CONTEXTS.G27).id).toBe('G27')
    // A drive they chose still beats the desk, exactly as G33 is beaten.
    expect(chooseGridRecipe({ ...base, isDirector: true, queueDepth: 0, attendedCount: 4 }).id).toBe('G04')
  })

  it('G33 sits last on purpose: a member on a break who signed up for a drive sees the drive', () => {
    const onBreakWithDrive: GridContext = {
      ...CONTEXTS.G33,
      upcomingSignup: { title: 'Science City', inDays: 3 },
    }
    expect(chooseGridRecipe(onBreakWithDrive).id).toBe('G12')
    expect(chooseGridRecipe(CONTEXTS.G33).id).toBe('G33')
  })

  it('a break whose end date has passed is not a break', () => {
    expect(chooseGridRecipe({ ...base, breakStart: '2026-01-01', breakEnd: '2026-02-01' }).id).toBe('G38')
  })

  it('G33 asks for nothing: no CTA-shaped tile beyond the map, and no points or hours', () => {
    const tiles = tilesFor(GRID_RECIPES.find(r => r.id === 'G33')!, CONTEXTS.G33)
    expect(tiles.some(t => t.key === 'points' || t.key === 'hours')).toBe(false)
    expect(tiles.some(t => typeof t.figure === 'string')).toBe(false)
  })
})

describe('G38, the floor', () => {
  it('renders when the profile call fails and the context is empty', () => {
    expect(chooseGridRecipe({}).id).toBe('G38')
  })

  it('renders when a guest is looking at the page', () => {
    expect(chooseGridRecipe({ signedIn: false, daysSinceApproved: 1 }).id).toBe('G38')
    // Not even a guest with someone else's counts attached reaches a member
    // recipe: every predicate opens on signedIn.
    expect(chooseGridRecipe({ signedIn: false, isDirector: true, queueDepth: 9, unreadCount: 4 }).id).toBe('G38')
  })

  it('reproduces the 2026-09-07 fall-through, and shows the fix', () => {
    // The owner: a super_admin whose members.approved_at is NULL (5 of the 17
    // leader rows are), no break, no drive rows anywhere in the database, and
    // no host that ever summed a queue. Every predicate above the floor missed.
    const before: GridContext = { ...base, isDirector: true, attendedCount: 0 }
    expect(chooseGridRecipe(before).id).toBe('G38')
    // The same viewer once the queue reads resolve.
    expect(chooseGridRecipe({ ...before, queueDepth: 281 }).id).toBe('G27')
    expect(chooseGridRecipe({ ...before, queueDepth: 0 }).id).toBe('G30')
  })

  it('renders when a predicate throws', () => {
    // A break_end that is not a date is the realistic version of this.
    expect(chooseGridRecipe({ ...base, breakStart: '2026-08-01', breakEnd: 'not a date' }).id).toBe('G38')
  })

  it('is never empty: the map tile is always there', () => {
    const g38 = GRID_RECIPES.find(r => r.id === 'G38')!
    const tiles = tilesFor(g38, {})
    expect(tiles).toHaveLength(1)
    expect(endsWithMapTile(tiles)).toBe(true)
  })
})

describe('no tile shows a zero it did not fetch', () => {
  // These used `points` as their worked example until 2026-09-04, when the
  // welfare-points system was retired and `pointsTile` became `profileTile`.
  // `labs` carries the same rule and is still figure-bearing, so the assertion
  // is unchanged in substance.
  it('an unresolved figure is null, which is the dashed live marker', () => {
    // Nothing resolved: labs and teams are both unknown.
    const ctx: GridContext = { ...base, upcomingSignup: { title: 'Science City', inDays: 5 } }
    const tiles = tilesFor(GRID_RECIPES[0], ctx)
    const labs = tiles.find(t => t.key === 'labs')!
    expect(labs.figure).toBeNull()
    expect(labs.figure).not.toBe('0')
  })

  it('a real zero is still printed as a zero', () => {
    const tiles = tilesFor(GRID_RECIPES.find(r => r.id === 'G19')!, { ...CONTEXTS.G19, openRolesCount: 0 })
    expect(tiles.find(t => t.key === 'roles')!.figure).toBe('0')
  })

  it('the retired points tile is gone from every recipe', () => {
    for (const recipe of GRID_RECIPES) {
      const tiles = tilesFor(recipe, CONTEXTS[recipe.id] ?? base)
      expect(tiles.some(t => t.key === 'points')).toBe(false)
    }
  })
})

describe('packGrid', () => {
  it('places a 2x2 beside a 2x1 pair exactly as CSS grid would', () => {
    const grid = packGrid([
      { key: 'a', kind: 'hue', cols: 2, rows: 2, label: 'a' },
      { key: 'b', kind: 'wash', cols: 2, rows: 1, label: 'b' },
      { key: 'c', kind: 'wash', cols: 1, rows: 1, label: 'c' },
      { key: 'd', kind: 'wash', cols: 1, rows: 1, label: 'd' },
    ])
    expect(grid).toHaveLength(2)
    expect(grid.every(r => r.every(Boolean))).toBe(true)
  })

  it('catches the hole a 2-wide tile leaves under a 2x2', () => {
    const holed = [
      { key: 'a', kind: 'hue' as const, cols: 2 as const, rows: 2 as const, label: 'a' },
      { key: 'b', kind: 'wash' as const, cols: 2 as const, rows: 1 as const, label: 'b' },
      { key: 'm', kind: 'map' as const, cols: 4 as const, rows: 1 as const, label: 'map' },
    ]
    expect(hasNoHoles(holed)).toBe(false)
  })
})
