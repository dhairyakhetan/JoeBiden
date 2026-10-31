import { describe, it, expect } from 'vitest'
import { BADGES, badgeStates, levelFor, nextUp, unseenEarned, type BadgeInputs } from './badges'

const zero: BadgeInputs = { posts: 0, likes: 0, drives: 0, hours: 0, teams: 0, achievements: 0 }

describe('badgeStates', () => {
  it('earns nothing from nothing', () => expect(badgeStates(zero).every(s => !s.earned)).toBe(true))
  it('earns exactly at the target and not one short', () => {
    const at = badgeStates({ ...zero, drives: 5 }).find(s => s.def.id === 'regular')!
    const short = badgeStates({ ...zero, drives: 4 }).find(s => s.def.id === 'regular')!
    expect(at.earned).toBe(true)
    expect(short.earned).toBe(false)
    expect(short.progress).toBeCloseTo(0.8)
  })
  it('clamps progress to 1 and ignores negatives and NaN', () => {
    const s = badgeStates({ ...zero, posts: 99, likes: -4, hours: NaN })
    expect(s.find(x => x.def.id === 'storyteller')!.progress).toBe(1)
    expect(s.find(x => x.def.id === 'loved')!.value).toBe(0)
    expect(s.find(x => x.def.id === 'long-haul')!.value).toBe(0)
  })
  it('ids are unique and targets positive', () => {
    expect(new Set(BADGES.map(b => b.id)).size).toBe(BADGES.length)
    for (const b of BADGES) expect(b.target).toBeGreaterThan(0)
  })
})

describe('levelFor', () => {
  it('grows with earned badges', () => {
    expect(levelFor(0).name).toBe('new here')
    expect(levelFor(1).name).toBe('sprout')
    expect(levelFor(4).name).toBe('sapling')
    expect(levelFor(7).name).toBe('young tree')
    expect(levelFor(8).name).toBe('banyan')
  })
  it('steps are in order and bounded', () => {
    expect(levelFor(0).step).toBe(0)
    expect(levelFor(8).step).toBe(levelFor(8).of)
  })
})

describe('unseenEarned', () => {
  it('returns earned ids not yet seen, in order', () => expect(unseenEarned(['a', 'b', 'c'], ['b'])).toEqual(['a', 'c']))
  it('is empty when everything was seen', () => expect(unseenEarned(['a'], ['a', 'z'])).toEqual([]))
})

describe('nextUp', () => {
  it('picks the unearned badge with the most progress', () => {
    const n = nextUp(badgeStates({ ...zero, posts: 1, drives: 4, likes: 5 }))!
    expect(n.def.id).toBe('regular')
  })
  it('is null when everything is earned', () => {
    expect(nextUp(badgeStates({ posts: 99, likes: 99, drives: 99, hours: 99, teams: 9, achievements: 9 }))).toBeNull()
  })
})
