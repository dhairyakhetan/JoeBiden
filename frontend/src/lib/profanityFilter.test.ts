import { describe, it, expect } from 'vitest'
import { checkText, BLOCK_MESSAGE } from './profanityFilter'

// The custom block/flag lists in profanityWords.json are empty by design
// (see that file's _readme - Claude does not author entries there), so these
// tests exercise checkText's own structural behavior rather than hardcoding
// real profanity into the repo. The 'obscenity' package's English coverage
// is a maintained third-party dataset - not something to pin exact matches
// against here, since that would make this suite fragile to upstream updates.

describe('checkText', () => {
  it('is clean for empty, whitespace-only, or missing text', async () => {
    expect(await checkText('')).toEqual({ severity: 'clean', matches: [] })
    expect(await checkText('   \n\t  ')).toEqual({ severity: 'clean', matches: [] })
  })

  it('is clean for ordinary text', async () => {
    const result = await checkText('we planted 40 trees in the Sundarbans this weekend')
    expect(result.severity).toBe('clean')
    expect(result.matches).toEqual([])
  })

  it('resolves without throwing on a long, punctuation-heavy input', async () => {
    const longText = 'a '.repeat(500) + '!!! ??? ... @#$%'
    await expect(checkText(longText)).resolves.toHaveProperty('severity')
  })
})

describe('BLOCK_MESSAGE', () => {
  it('is a non-empty, generic message that never quotes matched content', () => {
    expect(BLOCK_MESSAGE.length).toBeGreaterThan(0)
    // The design intent (see file header) is to never surface the trigger
    // word - a crude guard against that regressing is checking the message
    // doesn't contain a quoted fragment marker.
    expect(BLOCK_MESSAGE).not.toMatch(/["'].*["']/)
  })
})
