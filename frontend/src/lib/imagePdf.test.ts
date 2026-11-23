import { describe, it, expect } from 'vitest'
import { jpegToPdf, dataUrlToBytes, A4_PT } from './imagePdf'

// A real, tiny JPEG (1x1 white pixel) so the file is a structurally valid PDF, not just bytes.
const TINY_JPEG_B64 =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='
const jpeg = dataUrlToBytes(`data:image/jpeg;base64,${TINY_JPEG_B64}`)
const latin1 = (b: Uint8Array) => Array.from(b, c => String.fromCharCode(c)).join('')

describe('jpegToPdf', () => {
  const pdf = jpegToPdf(jpeg, 1600, 1131, A4_PT.h, A4_PT.w)
  const text = latin1(pdf)

  it('is a PDF with the usual head and tail', () => {
    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true)
  })

  it('points startxref at the xref table and every entry at its object', () => {
    const startxref = Number(/startxref\n(\d+)\n/.exec(text)![1])
    expect(text.slice(startxref, startxref + 4)).toBe('xref')
    const entries = [...text.slice(startxref).matchAll(/(\d{10}) 00000 n /g)].map(m => Number(m[1]))
    expect(entries).toHaveLength(5)
    entries.forEach((off, i) => expect(text.slice(off, off + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`))
  })

  it('carries the JPEG bytes untouched, with a matching /Length', () => {
    const declared = Number(/\/Filter \/DCTDecode \/Length (\d+)/.exec(text)![1])
    expect(declared).toBe(jpeg.length)
    const at = text.indexOf('stream\n', text.indexOf('/DCTDecode')) + 'stream\n'.length
    expect(Array.from(pdf.slice(at, at + jpeg.length))).toEqual(Array.from(jpeg))
  })

  it('sizes the page and the picture to fill it', () => {
    expect(text).toContain('/MediaBox [0 0 841.89 595.28]')
    expect(text).toContain('q 841.89 0 0 595.28 0 0 cm /Im0 Do Q')
    expect(text).toContain('/Width 1600 /Height 1131')
  })

  it('refuses something that is not a JPEG', () => {
    expect(() => jpegToPdf(new Uint8Array([1, 2, 3, 4, 5]), 10, 10, 100, 100)).toThrow(/JPEG/)
  })
})

describe('dataUrlToBytes', () => {
  it('round-trips base64', () => {
    expect(Array.from(dataUrlToBytes('data:text/plain;base64,aGk='))).toEqual([104, 105])
  })
})
