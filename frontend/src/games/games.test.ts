import { describe, it, expect } from 'vitest'
import { isNewBest } from './gameKit'
import { ITEMS, dealRound, judge, nextStreak, pointsFor, gradeFor, ROUND_SIZE, BINS } from './sorter/sorterLogic'
import { waitMs, average, toneFor, isFalseStart } from './reaction/reactionLogic'
import { buildDeck, isMatch, isWon, starsFor, SYMBOLS } from './match/matchLogic'

describe('gameKit.isNewBest', () => {
  it('first result is always a best', () => expect(isNewBest(null, 5, true)).toBe(true))
  it('scores: higher wins', () => { expect(isNewBest(50, 60, true)).toBe(true); expect(isNewBest(50, 50, true)).toBe(false) })
  it('times: lower wins', () => { expect(isNewBest(300, 250, false)).toBe(true); expect(isNewBest(300, 300, false)).toBe(false) })
  it('rejects NaN', () => expect(isNewBest(50, NaN, true)).toBe(false))
})

describe('sorter', () => {
  it('every item belongs to a real bin and ids are unique', () => {
    const bins = new Set(BINS.map(b => b.id))
    for (const i of ITEMS) expect(bins.has(i.bin)).toBe(true)
    expect(new Set(ITEMS.map(i => i.id)).size).toBe(ITEMS.length)
  })
  it('deals a reproducible round of the right size with no repeats', () => {
    const a = dealRound(11)
    expect(a).toEqual(dealRound(11))
    expect(a).toHaveLength(ROUND_SIZE)
    expect(new Set(a.map(i => i.id)).size).toBe(ROUND_SIZE)
    expect(dealRound(12).map(i => i.id)).not.toEqual(a.map(i => i.id))
  })
  it('a round always has every bin represented across seeds', () => {
    for (let s = 1; s <= 20; s++) expect(new Set(dealRound(s).map(i => i.bin)).size).toBe(3)
  })
  it('judges, streaks and scores', () => {
    expect(judge(ITEMS[0], 'dry')).toBe(true)
    expect(judge(ITEMS[0], 'wet')).toBe(false)
    expect(nextStreak(3, true)).toBe(4)
    expect(nextStreak(3, false)).toBe(0)
    expect(pointsFor(false, 4)).toBe(0)
    expect(pointsFor(true, 0)).toBe(10)
    expect(pointsFor(true, 9)).toBe(20)
  })
  it('grades by share correct', () => {
    expect(gradeFor(12, 12)).toBe('tree')
    expect(gradeFor(8, 12)).toBe('sapling')
    expect(gradeFor(3, 12)).toBe('seedling')
    expect(gradeFor(0, 0)).toBe('seedling')
  })
})

describe('reaction', () => {
  it('waits between 1.2 and 4 seconds', () => {
    expect(waitMs(0)).toBe(1200)
    expect(waitMs(1)).toBeLessThan(4001)
    expect(waitMs(5)).toBeLessThan(4001)
    expect(waitMs(-1)).toBe(1200)
  })
  it('averages and tones', () => {
    expect(average([200, 300])).toBe(250)
    expect(average([])).toBe(0)
    expect(toneFor(150)).toBe('lightning')
    expect(toneFor(250)).toBe('quick')
    expect(toneFor(350)).toBe('steady')
    expect(toneFor(600)).toBe('dreamy')
  })
  it('only a tap during the wait is a false start', () => {
    expect(isFalseStart('wait', true)).toBe(true)
    expect(isFalseStart('go', true)).toBe(false)
    expect(isFalseStart('wait', false)).toBe(false)
  })
})

describe('match', () => {
  it('builds a reproducible deck with every symbol exactly twice', () => {
    const d = buildDeck(5)
    expect(d).toEqual(buildDeck(5))
    expect(d).toHaveLength(SYMBOLS * 2)
    for (let s = 0; s < SYMBOLS; s++) expect(d.filter(c => c.symbol === s)).toHaveLength(2)
  })
  it('matches two different cards of one symbol, never a card with itself', () => {
    const d = buildDeck(5)
    const first = d[0]
    const twin = d.find(c => c.symbol === first.symbol && c.id !== first.id)!
    expect(isMatch(first, twin)).toBe(true)
    expect(isMatch(first, first)).toBe(false)
    expect(isMatch(first, d.find(c => c.symbol !== first.symbol)!)).toBe(false)
  })
  it('is won only when every card is matched', () => {
    const d = buildDeck(5)
    expect(isWon(d)).toBe(false)
    expect(isWon(d.map(c => ({ ...c, matched: true })))).toBe(true)
    expect(isWon([])).toBe(false)
  })
  it('awards stars by moves', () => {
    expect(starsFor(8)).toBe(3)
    expect(starsFor(14)).toBe(2)
    expect(starsFor(30)).toBe(1)
  })
})
