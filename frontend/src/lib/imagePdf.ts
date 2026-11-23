/**
 * Wrap one JPEG in a one-page PDF. No dependency: the certificate is drawn on a
 * canvas, so the PDF only has to place that picture on a page that fills it.
 *
 * Why not a PDF library: a library is hundreds of KB for the one thing we need,
 * and the eager bundle is at its budget (CLAUDE.md, check-bundle-budget). A
 * single image page is five objects and a cross-reference table.
 *
 * The page is sized in PDF points (1/72 inch). A4 is 595.28 x 841.89.
 */

export const A4_PT = { w: 595.28, h: 841.89 } as const

const enc = new TextEncoder()
const n2 = (x: number) => x.toFixed(2)

export function jpegToPdf(jpeg: Uint8Array, widthPx: number, heightPx: number, pageWpt: number, pageHpt: number): Uint8Array {
  if (!(jpeg.length > 4 && jpeg[0] === 0xff && jpeg[1] === 0xd8)) throw new Error('not a JPEG')

  const chunks: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0
  const push = (b: Uint8Array | string) => {
    const u = typeof b === 'string' ? enc.encode(b) : b
    chunks.push(u)
    length += u.length
  }
  const object = (id: number, write: () => void) => {
    offsets[id] = length
    push(`${id} 0 obj\n`)
    write()
    push('\nendobj\n')
  }

  push('%PDF-1.4\n%âãÏÓ\n')
  object(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'))
  object(2, () => push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'))
  object(3, () => push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n2(pageWpt)} ${n2(pageHpt)}] /Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>`,
  ))
  object(4, () => {
    push(`<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`)
    push(jpeg)
    push('\nendstream')
  })
  const content = `q ${n2(pageWpt)} 0 0 ${n2(pageHpt)} 0 0 cm /Im0 Do Q`
  object(5, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`))

  const xrefAt = length
  push('xref\n0 6\n0000000000 65535 f \n')
  for (let id = 1; id <= 5; id++) push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`)
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`)

  const out = new Uint8Array(length)
  let at = 0
  for (const c of chunks) { out.set(c, at); at += c.length }
  return out
}

/** "data:image/jpeg;base64,...." to bytes. */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',')
  const bin = atob(dataUrl.slice(comma + 1))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
