import { describe, it, expect } from 'vitest'
import { effectsAllowed, centerOf } from './delight'

describe('effectsAllowed', () => {
  it('is on by default', () => expect(effectsAllowed(false, null)).toBe(true))
  it('is off when the member turned it off', () => expect(effectsAllowed(false, 'off')).toBe(false))
  it('is off under reduced motion even if the member never touched the switch', () => expect(effectsAllowed(true, null)).toBe(false))
  it('treats any other stored value as on', () => expect(effectsAllowed(false, 'on')).toBe(true))
})

describe('centerOf', () => {
  it('returns the middle of a rectangle', () => {
    expect(centerOf({ left: 10, top: 20, width: 100, height: 40 })).toEqual({ x: 60, y: 40 })
  })
})
