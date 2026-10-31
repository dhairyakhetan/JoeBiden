import { describe, it, expect } from 'vitest'
import { isBugChord, movedTooFar, shortcutAllowed, captureBox, HOLD_SLOP } from './shortcutLogic'

const key = (o: Partial<Parameters<typeof isBugChord>[0]> = {}) =>
  ({ altKey: true, shiftKey: true, ctrlKey: false, metaKey: false, code: 'KeyB', ...o })

describe('isBugChord', () => {
  it('matches Alt+Shift+B on the physical key', () => { expect(isBugChord(key())).toBe(true) })
  it('ignores a held key repeating', () => { expect(isBugChord(key({ repeat: true }))).toBe(false) })
  it('ignores any other combination', () => {
    expect(isBugChord(key({ altKey: false }))).toBe(false)
    expect(isBugChord(key({ shiftKey: false }))).toBe(false)
    expect(isBugChord(key({ ctrlKey: true }))).toBe(false)
    expect(isBugChord(key({ metaKey: true }))).toBe(false)
    expect(isBugChord(key({ code: 'KeyV' }))).toBe(false)
  })
})

describe('movedTooFar', () => {
  const start = [{ x: 100, y: 100 }, { x: 200, y: 100 }]
  it('allows a small drift', () => {
    expect(movedTooFar(start, [{ x: 104, y: 103 }, { x: 198, y: 102 }])).toBe(false)
  })
  it('cancels when a finger moves past the slop', () => {
    expect(movedTooFar(start, [{ x: 100 + HOLD_SLOP + 1, y: 100 }, { x: 200, y: 100 }])).toBe(true)
  })
  it('cancels when a finger lifts or a third lands', () => {
    expect(movedTooFar(start, [{ x: 100, y: 100 }])).toBe(true)
    expect(movedTooFar(start, [...start, { x: 5, y: 5 }])).toBe(true)
  })
})

describe('shortcutAllowed', () => {
  it('needs an active member', () => { expect(shortcutAllowed('/projects', false)).toBe(false) })
  it('works on ordinary pages', () => {
    for (const p of ['/', '/projects/1018', '/director/member-of-month', '/bugs', '/terranotes']) expect(shortcutAllowed(p, true)).toBe(true)
  })
  it('stays quiet in the sign-in flow', () => {
    for (const p of ['/login', '/register', '/pending', '/rejected', '/welcome', '/auth/callback']) expect(shortcutAllowed(p, true)).toBe(false)
  })
  it('does not mistake a longer path for a blocked one', () => { expect(shortcutAllowed('/loginfo', true)).toBe(true) })
})

describe('captureBox', () => {
  it('renders from the top to the bottom of the viewport and crops the scrolled part', () => {
    const b = captureBox({ innerWidth: 1440, innerHeight: 900, scrollY: 0, dpr: 1 })
    expect(b).toEqual({ ratio: 1, renderHeight: 900, cropTop: 0, cropHeight: 900 })
    const s = captureBox({ innerWidth: 1440, innerHeight: 900, scrollY: 2000, dpr: 1 })
    expect(s.renderHeight).toBe(2900)
    expect(s.cropTop).toBe(2000)
  })
  it('caps the ratio at 2 even on a 3x phone', () => {
    expect(captureBox({ innerWidth: 390, innerHeight: 844, scrollY: 0, dpr: 3 }).ratio).toBe(2)
  })
  it('lowers the ratio until a deep scroll fits the pixel budget', () => {
    const b = captureBox({ innerWidth: 390, innerHeight: 844, scrollY: 12000, dpr: 3 })
    expect(390 * b.ratio * b.renderHeight * b.ratio).toBeLessThanOrEqual(14_000_000)
    expect(b.ratio).toBeLessThan(2)
    expect(b.ratio).toBeGreaterThanOrEqual(0.25)
  })
  it('never returns a zero-size render', () => {
    expect(captureBox({ innerWidth: 0, innerHeight: 0, scrollY: 0, dpr: 0 }).renderHeight).toBe(1)
  })
})
