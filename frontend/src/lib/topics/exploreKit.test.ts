import { describe, it, expect } from 'vitest'
import { QUIZ, scoreQuiz, normalisePlace, monthKey, monthLabel, EXPLORERS, MAP_PINS, shuffle, yearStats } from './exploreKit'
import { TOPIC_BY_SLUG } from './topicKit'

describe('explorers', () => {
  it('quiz points only at real library pages', () => {
    for (const q of QUIZ) for (const o of q.options) for (const s of Object.keys(o.scores)) expect(TOPIC_BY_SLUG[s], s).toBeTruthy()
  })
  it('scores the strongest answer first', () => {
    expect(scoreQuiz({ 0: 0, 1: 0, 2: 3, 3: 0 })[0]).toBe('tails-and-treats')
    expect(scoreQuiz({ 0: 2, 1: 1, 2: 0, 3: 2 })[0]).toBe('grow-green')
  })
  it('merges spellings of one place', () => {
    expect(normalisePlace('Pather Saathi ')).toBe('Pather Sathi')
    expect(normalisePlace('AIM 2 FOUNDATION')).toBe('AIM Foundation')
    expect(normalisePlace('  ')).toBe('')
  })
  it('labels months', () => {
    expect(monthKey('2024-05-10')).toBe('2024-05')
    expect(monthLabel('2024-05')).toBe('May 2024')
  })
  it('keeps house voice in explorer copy', () => {
    for (const e of EXPLORERS) for (const s of [e.title, e.description, e.lede, e.blurb]) { expect(s).not.toMatch(/[–—!]/); expect(s).not.toMatch(/\bpartner/i) }
  })
  it('map pins point at real neighbourhood pages and sit inside the map', () => {
    for (const p of MAP_PINS) { expect(TOPIC_BY_SLUG[p.slug], p.slug).toBeTruthy(); expect(p.x).toBeGreaterThan(0); expect(p.x).toBeLessThan(100); expect(p.y).toBeGreaterThan(0); expect(p.y).toBeLessThan(100) }
  })
  it('shuffles without losing anything', () => {
    let i = 0; const rnd = () => [0.1, 0.9, 0.5, 0.3][i++ % 4]
    expect(shuffle([1, 2, 3, 4, 5], rnd).sort()).toEqual([1, 2, 3, 4, 5])
  })
  it('counts a year', () => {
    const ds = [{ s: 'a', t: 'A', d: '2024-05-01', p: 'Salt Lake', v: 3, k: 'tails-and-treats' }, { s: 'b', t: 'B', d: '2024-06-01', p: 'salt lake ', v: 2, k: 'tails-and-treats' }, { s: 'c', t: 'C', d: '2023-01-01', p: 'X', v: 9 }]
    const y = yearStats(ds, 2024)
    expect(y.count).toBe(2); expect(y.turnouts).toBe(5); expect(y.places).toBe(1); expect(y.topSeries[0]).toEqual(['tails-and-treats', 2])
  })
})
