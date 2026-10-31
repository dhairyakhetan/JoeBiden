import { describe, expect, it } from 'vitest'
import { loaderLine } from './loader'

describe('loaderLine', () => {
  it('says Masks on. on the Disco Diwali page and under it', () => {
    expect(loaderLine('/live/disco-diwali')).toBe('Masks on.')
    expect(loaderLine('/live/disco-diwali/')).toBe('Masks on.')
    expect(loaderLine('/live/disco-diwali/anything')).toBe('Masks on.')
  })
  it('keeps the hub line everywhere else, including look-alike paths', () => {
    for (const p of ['/live', '/live/events', '/live/disco-diwali-2025', '/live/events/disco-diwali-2026']) expect(loaderLine(p)).toBe('Turning the lights on')
  })
})
