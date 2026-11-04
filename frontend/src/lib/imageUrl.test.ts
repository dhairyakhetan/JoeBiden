import { describe, it, expect } from 'vitest'
import { sized } from './imageUrl'

const FRAMER = 'https://framerusercontent.com/images/abc123.jpg'

describe('sized', () => {
  it('appends scale-down-to for a bare Framer URL', () => {
    expect(sized(FRAMER, 'card')).toBe(`${FRAMER}?scale-down-to=1280`)
  })

  it('uses & when the URL already has a query string', () => {
    const withQuery = `${FRAMER}?foo=bar`
    expect(sized(withQuery, 'card')).toBe(`${withQuery}&scale-down-to=1280`)
  })

  it('picks the right pixel target per context', () => {
    expect(sized(FRAMER, 'avatar')).toContain('scale-down-to=192')
    expect(sized(FRAMER, 'thumb')).toContain('scale-down-to=320')
    expect(sized(FRAMER, 'card')).toContain('scale-down-to=1280')
    expect(sized(FRAMER, 'cover')).toContain('scale-down-to=1600')
    expect(sized(FRAMER, 'full')).toContain('scale-down-to=2000')
  })

  it('defaults to the card context when none is passed', () => {
    expect(sized(FRAMER)).toBe(`${FRAMER}?scale-down-to=1280`)
  })

  it('respects a size already baked into the URL - never doubles the param', () => {
    const preset = `${FRAMER}?scale-down-to=800`
    expect(sized(preset, 'full')).toBe(preset)
  })

  it('passes through any non-Framer host untouched', () => {
    const supabaseUrl = 'https://hzowuwffjqtgszecngpe.supabase.co/storage/v1/object/public/avatars/x.jpg'
    expect(sized(supabaseUrl, 'avatar')).toBe(supabaseUrl)
    expect(sized('/local/relative/path.png', 'card')).toBe('/local/relative/path.png')
  })

  it('never upscales past what the URL already declares (leaves data:/blob: URIs alone)', () => {
    expect(sized('data:image/png;base64,AAA', 'full')).toBe('data:image/png;base64,AAA')
    expect(sized('blob:https://example.com/xyz', 'full')).toBe('blob:https://example.com/xyz')
  })

  it('handles null/undefined/empty without throwing', () => {
    expect(sized(null)).toBe('')
    expect(sized(undefined)).toBe('')
    expect(sized('')).toBe('')
  })

  describe('mirrored project images (C-09)', () => {
    const key = 'a'.repeat(40)
    const big = `https://x.supabase.co/storage/v1/object/public/project-images/framer/${key}-1600.jpg`
    const small = `https://x.supabase.co/storage/v1/object/public/project-images/framer/${key}-640.jpg`

    it('serves the 640 copy to small slots and the 1600 copy to large ones', () => {
      expect(sized(big, 'avatar')).toBe(small)
      expect(sized(big, 'thumb')).toBe(small)
      expect(sized(big, 'card')).toBe(big)
      expect(sized(big, 'full')).toBe(big)
    })

    it('leaves svg and gif alone (no 640 copy exists) and other bucket paths alone', () => {
      const svg = `https://x.supabase.co/storage/v1/object/public/project-images/framer/${key}-1600.svg`
      expect(sized(svg, 'thumb')).toBe(svg)
      const other = 'https://x.supabase.co/storage/v1/object/public/avatars/me-1600.jpg'
      expect(sized(other, 'thumb')).toBe(other)
    })
  })
})
