import { describe, it, expect } from 'vitest'
import { canGoLive } from './ProjectManagerShared'

describe('canGoLive', () => {
  it('needs a non-blank hero image', () => {
    expect(canGoLive({ main_image: null })).toBe(false)
    expect(canGoLive({ main_image: '  ' })).toBe(false)
    expect(canGoLive({})).toBe(false)
    expect(canGoLive({ main_image: 'https://x/y.jpg' })).toBe(true)
  })
})
