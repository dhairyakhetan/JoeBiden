import { describe, it, expect } from 'vitest'
import {
  MAX_EDGE,
  JPEG_QUALITY,
  isResizableType,
  targetDimensions,
  outputType,
  resizeImageFile,
  resizeForUpload,
} from './resizeImage'

// Pure logic only - vitest runs with `environment: 'node'`, so the canvas half
// of resizeImageFile() is exercised in a real browser instead (see the build
// report). What IS covered here is everything that can silently rot: the
// dimension maths, the never-upscale rule and every pass-through case.

describe('targetDimensions', () => {
  it('scales the long edge down to the cap, preserving aspect ratio', () => {
    expect(targetDimensions(3840, 2160, 1920)).toEqual({ width: 1920, height: 1080 })
    expect(targetDimensions(2160, 3840, 1920)).toEqual({ width: 1080, height: 1920 })
  })

  it('never upscales - a smaller image returns null (pass through)', () => {
    expect(targetDimensions(800, 600, 1920)).toBeNull()
    expect(targetDimensions(40, 40, 512)).toBeNull()
  })

  it('treats exactly-at-the-cap as no work needed', () => {
    expect(targetDimensions(1920, 1080, 1920)).toBeNull()
    expect(targetDimensions(1080, 1920, 1920)).toBeNull()
  })

  it('resizes when only one edge exceeds the cap', () => {
    expect(targetDimensions(4000, 100, 1920)).toEqual({ width: 1920, height: 48 })
  })

  it('never rounds an edge down to zero', () => {
    const t = targetDimensions(100000, 3, 1920)
    expect(t).not.toBeNull()
    expect(t!.height).toBeGreaterThanOrEqual(1)
  })

  it('rejects degenerate / unreadable dimensions', () => {
    expect(targetDimensions(0, 0, 1920)).toBeNull()
    expect(targetDimensions(-10, 500, 1920)).toBeNull()
    expect(targetDimensions(NaN, 500, 1920)).toBeNull()
    expect(targetDimensions(Infinity, 500, 1920)).toBeNull()
  })
})

describe('isResizableType', () => {
  it('accepts the raster photo formats we actually receive', () => {
    for (const t of ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/avif']) {
      expect(isResizableType(t)).toBe(true)
    }
  })

  it('passes GIF through so animation is not flattened to one frame', () => {
    expect(isResizableType('image/gif')).toBe(false)
  })

  it('passes SVG through rather than rasterising vector art', () => {
    expect(isResizableType('image/svg+xml')).toBe(false)
  })

  it('never touches a non-image (PDF / PPTX attachments)', () => {
    expect(isResizableType('application/pdf')).toBe(false)
    expect(isResizableType('application/vnd.openxmlformats-officedocument.presentationml.presentation')).toBe(false)
    expect(isResizableType('')).toBe(false)
  })
})

describe('outputType', () => {
  it('keeps PNG as PNG so alpha and hard edges survive', () => {
    expect(outputType('image/png', false)).toBe('image/png')
  })

  it('re-encodes other rasters to JPEG', () => {
    expect(outputType('image/jpeg', false)).toBe('image/jpeg')
    expect(outputType('image/webp', false)).toBe('image/jpeg')
    expect(outputType('image/heic', false)).toBe('image/jpeg')
  })

  it('forceJpeg wins - the wall composer converts everything to JPEG', () => {
    expect(outputType('image/png', true)).toBe('image/jpeg')
  })
})

describe('caps', () => {
  it('keeps the wall at its shipped 1600 px / q0.82 output', () => {
    expect(MAX_EDGE.wall).toBe(1600)
    expect(JPEG_QUALITY).toBe(0.82)
  })

  it('sizes each context from what the UI renders', () => {
    expect(MAX_EDGE.avatar).toBe(512)
    expect(MAX_EDGE.yearbook).toBe(1200)
    expect(MAX_EDGE.post).toBe(1920)
    expect(MAX_EDGE.project).toBe(1920)
  })

  it('never caps below the wall for the lightboxable contexts', () => {
    expect(MAX_EDGE.post).toBeGreaterThanOrEqual(MAX_EDGE.wall)
    expect(MAX_EDGE.project).toBeGreaterThanOrEqual(MAX_EDGE.wall)
  })
})

describe('resizeImageFile pass-through (no DOM available)', () => {
  it('returns a non-image file byte-identical and unrenamed', async () => {
    const pdf = new File([new Uint8Array([1, 2, 3, 4])], 'deck.pdf', { type: 'application/pdf' })
    const out = await resizeImageFile(pdf, { maxEdge: 1920 })
    expect(out).toBe(pdf)
    expect(out.name).toBe('deck.pdf')
    expect(out.size).toBe(4)
  })

  it('returns a GIF untouched', async () => {
    const gif = new File([new Uint8Array(10)], 'party.gif', { type: 'image/gif' })
    expect(await resizeForUpload(gif, 'post')).toBe(gif)
  })

  it('returns the original rather than failing when there is no canvas', async () => {
    // `document` is undefined under environment: 'node' - this is the same
    // guard that protects an exotic browser, and it must degrade to the
    // original file, never throw and never lose the upload.
    const jpg = new File([new Uint8Array(2048)], 'photo.jpg', { type: 'image/jpeg' })
    const out = await resizeForUpload(jpg, 'project')
    expect(out).toBe(jpg)
    expect(out.size).toBe(2048)
  })
})
