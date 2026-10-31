import { describe, expect, it } from 'vitest'
import {
  CAST,
  CHARACTERS,
  POSES,
  SIZES,
  blinkDelay,
  characterForSeed,
  hashSeed,
  type MascotCharacter,
} from './mascotCast'

describe('the cast', () => {
  it('is six, and CHARACTERS matches CAST exactly', () => {
    expect(CHARACTERS).toHaveLength(6)
    expect([...CHARACTERS].sort()).toEqual((Object.keys(CAST) as MascotCharacter[]).sort())
  })

  it('gives every character its own hue, so two are never confusable', () => {
    const hues = CHARACTERS.map(c => CAST[c].hue)
    expect(new Set(hues).size).toBe(6)
  })

  it('paints only from token references, never a literal', () => {
    for (const c of CHARACTERS) {
      expect(CAST[c].hue).toMatch(/^var\(--[a-z-]+\)$/)
      expect(CAST[c].hueHex).toMatch(/^#[0-9A-F]{6}$/)
    }
  })

  it('names are caps-only, because NeutralFace has no lowercase glyphs', () => {
    for (const c of CHARACTERS) {
      expect(CAST[c].name).toBe(CAST[c].name.toUpperCase())
    }
  })

  it('Bhoot is the deadpan one and never smiles', () => {
    expect(CAST.bhoot.mouth).toBe('flat')
    expect(CAST.bhoot.eyes).toBe('worried')
  })

  it('the antenna is on one character only', () => {
    expect(CHARACTERS.filter(c => CAST[c].antenna)).toEqual(['tuk'])
  })

  it('has eight poses and four sizes, no more', () => {
    expect(POSES).toHaveLength(8)
    expect([...SIZES]).toEqual([26, 44, 64, 110])
  })
})

describe('seeding', () => {
  it('is stable: the same member always gets the same character', () => {
    const id = '3f5b1c22-9d41-4e0a-8a5c-4b6d2e7f1a90'
    const first = characterForSeed(id)
    for (let i = 0; i < 50; i++) expect(characterForSeed(id)).toBe(first)
  })

  it('returns a real cast member for any input, including the empty string', () => {
    for (const seed of ['', 'a', '1143', 'official@ngoaquaterra.com', '🙂']) {
      expect(CHARACTERS).toContain(characterForSeed(seed))
    }
  })

  it('spreads across all six over a realistic member population', () => {
    const seen = new Map<MascotCharacter, number>()
    for (let i = 0; i < 1370; i++) {
      const c = characterForSeed(`member-${i}`)
      seen.set(c, (seen.get(c) ?? 0) + 1)
    }
    expect(seen.size).toBe(6)
    // no character should swallow more than a third of the roster
    for (const n of seen.values()) expect(n).toBeLessThan(1370 / 3)
  })

  it('hashSeed is unsigned and deterministic', () => {
    expect(hashSeed('aquaterra')).toBe(hashSeed('aquaterra'))
    expect(hashSeed('aquaterra')).toBeGreaterThanOrEqual(0)
    expect(hashSeed('a')).not.toBe(hashSeed('b'))
  })
})

describe('blink stagger', () => {
  it('stays inside one blink cycle', () => {
    for (let i = 0; i < 200; i++) {
      const d = blinkDelay(`m${i}`)
      expect(d).toBeGreaterThanOrEqual(0)
      expect(d).toBeLessThan(4.2)
    }
  })

  it('a row of avatars does not blink in unison', () => {
    const delays = new Set(Array.from({ length: 12 }, (_, i) => blinkDelay(`row-${i}`)))
    expect(delays.size).toBeGreaterThan(8)
  })
})
