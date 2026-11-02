import { describe, it, expect } from 'vitest'
import { roleChangeMessage, AlreadyDecidedError, isAlreadyDecided } from './directorServiceTypes'

describe('roleChangeMessage', () => {
  it('has plain, em-dash-free copy for every role', () => {
    for (const r of ['member', 'hod', 'director', 'super_admin', 'other']) {
      const m = roleChangeMessage(r)
      expect(m.title.length).toBeGreaterThan(0)
      expect(`${m.title} ${m.subtitle}`).not.toMatch(/[—–]/)
    }
  })
  it('points a demoted member at the feed, not the desk', () => {
    expect(roleChangeMessage('member').link).toBe('/feed')
    expect(roleChangeMessage('hod').link).toBe('/director')
  })
})

describe('AlreadyDecidedError', () => {
  it('is recognised by the guard and not by plain errors', () => {
    expect(isAlreadyDecided(new AlreadyDecidedError())).toBe(true)
    expect(isAlreadyDecided(new Error('x'))).toBe(false)
    expect(isAlreadyDecided(null)).toBe(false)
  })
})
