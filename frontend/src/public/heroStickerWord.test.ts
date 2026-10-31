import { describe, it, expect } from 'vitest'
import { heroStickerWord, HERO_STICKER_MAX } from './heroStickerWord'

describe('heroStickerWord', () => {
  it('shortens the live objectives that overflowed the ticket (project 1018)', () => {
    expect(heroStickerWord('Distribution Workshop')).toBe('Workshop')
    expect(heroStickerWord('Old Age Home Visit')).toBe('Old Age')
    expect(heroStickerWord('Distribution Drive')).toBe('Distribution')
  })
  it('leaves short objectives alone', () => {
    expect(heroStickerWord('Workshop')).toBe('Workshop')
    expect(heroStickerWord('Stalls')).toBe('Stalls')
  })
  it('never returns more than the ticket can hold, for any live objective', () => {
    for (const o of ["Children's Day Fete", 'Fundraiser', 'Others', 'Some Brand New Long Objective', 'Extraordinarilylongsingleword']) {
      expect(heroStickerWord(o).length).toBeLessThanOrEqual(HERO_STICKER_MAX)
    }
  })
})
