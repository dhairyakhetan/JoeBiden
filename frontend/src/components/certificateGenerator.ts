// ── AquaTerra certificate and letter renderer ────────────────────────────────
// Draws the document a member downloads, on the REAL templates HR used by hand until 20 Nov 2026 (the Canva designs).
//
// Each template's backdrop (public/certificates/bg-*.webp) is the blank page exactly as designed: title art, logo, the fixed
// wording of a certificate ("This is to certify that...") and the bottom band are already in the picture. This file draws only
// what changes: the name, the hours and months, the date, a letter's text, the signatures and a verification code. Positions
// and type sizes were measured from the blank reference pages (points on an A4 page); sizes are calibrated by the width of the
// reference placeholder ("Full Name", "N hours", "month"), so the look follows the original without its commercial font (Garet).
//
// TEXT-DRIVEN: a letter's words come from the stored draft (certificate_drafts), written by the drafting routine or by a
// person and approved by HR. Nothing is composed here, so a page can never say something the desk did not approve.
//
// Output is a one-page A4 PDF (lib/imagePdf.ts), like the Canva export.

import '@fontsource/montserrat/latin-400.css'
import '@fontsource/montserrat/latin-700.css'
import '@fontsource/montserrat/latin-800.css'
import { A4_PT, dataUrlToBytes, jpegToPdf } from '../lib/imagePdf'
import { formatHours, formatMonth, letterDate, ordinalParts } from '../certificates/certificateLogic'
import {
  BACKDROP, isCertificateTemplate, LETTER_HAS_CLOSING, SIGNATURES_IMAGE, SINGLE_SIGNATORY, templateFor, type TemplateId,
} from '../certificates/certificateTemplates'

const FONT = 'Montserrat, "Helvetica Neue", Arial, sans-serif'
const INK = '#141414'

export interface RenderInput {
  template: TemplateId
  memberName: string
  /** ISO instant the document was issued; null draws today (previews). */
  issuedAt: string | null
  /** Assigned by the database at issue; null on a preview or sample. */
  verifyCode: string | null
  /** A faint diagonal word across the page ("SAMPLE", "PREVIEW") so a draft is never mistaken for a document. */
  watermark?: string | null
  /** Certificates: filled into the fixed wording. */
  hours?: number | null
  periodStart?: string | null
  periodEnd?: string | null
  /** Letters: the approved text. Paragraphs are separated by a blank line. */
  body?: string
}

/** Thrown when text cannot fit the page at a readable size. Never truncates silently. */
export class CertificateTextTooLongError extends Error {
  readonly code = 'CERTIFICATE_TEXT_TOO_LONG'
  constructor() { super('This text is too long for one page. Shorten it a little.') }
}

/** Thrown for a document type with no template, so nothing is ever drawn under the wrong title. */
export class CertificateTemplateMissingError extends Error {
  readonly code = 'CERTIFICATE_TEMPLATE_MISSING'
  constructor(typeKey: string) { super(`There is no template for "${typeKey}" yet.`) }
}

/** Turn what a screen knows into what the renderer needs. Throws if the type has no template. */
export function buildRenderInput(args: {
  typeKey: string
  teamNames: readonly string[]
  memberName: string
  issuedAt: string | null
  verifyCode: string | null
  body?: string
  hours?: number | null
  periodStart?: string | null
  periodEnd?: string | null
  watermark?: string | null
}): RenderInput {
  const template = templateFor(args.typeKey, args.teamNames)
  if (!template) throw new CertificateTemplateMissingError(args.typeKey)
  return {
    template, memberName: args.memberName, issuedAt: args.issuedAt, verifyCode: args.verifyCode, watermark: args.watermark ?? null,
    hours: args.hours ?? null, periodStart: args.periodStart ?? null, periodEnd: args.periodEnd ?? null, body: args.body,
  }
}

// ── Measured from the reference pages (A4, points) ──────────────────────────

const PAGE = { landscape: { w: 842.25, h: 595.5 }, portrait: { w: 595.5, h: 842.25 } } as const

/** Where the signature block's INK goes on the page (points): left, top, width. The asset has transparent padding, so it is placed by its ink. */
type Ink = { x: number; y: number; w: number }
/** The ink inside signatures.png, in its own pixels (measured from the file). */
const SIG_INK = { x: 31, y: 43, w: 525 }

type Cert = { name: [number, number]; hours: [number, number]; m1: [number, number]; m2: [number, number]; sig: Ink; url: { right: number; baseline: number; w: number } }
const CERT: Record<'cert_recognition' | 'cert_internship' | 'cert_internship_ventures', Cert> = {
  cert_recognition:         { name: [339.3, 402.0], hours: [451.1, 502.6], m1: [520.1, 554.0], m2: [545.2, 579.1], sig: { x: 473, y: 443, w: 320.5 }, url: { right: 832.9, baseline: 65.4, w: 107.8 } },
  cert_internship:          { name: [336.5, 399.2], hours: [439.8, 491.2], m1: [507.7, 541.6], m2: [532.8, 566.7], sig: { x: 473, y: 443, w: 320.5 }, url: { right: 832.9, baseline: 73.9, w: 107.8 } },
  cert_internship_ventures: { name: [317.1, 379.8], hours: [438.9, 490.3], m1: [507.7, 541.6], m2: [532.8, 566.7], sig: { x: 534.5, y: 456, w: 261.5 }, url: { right: 834.4, baseline: 138.0, w: 87.7 } },
}
const CERT_X = { left: 32.26, m1: 128.4, m2: 79.5, dateRight: 804 }
// The placeholder widths the original type is calibrated against (points).
const REF = { name: 194.9, hours: 125.3, month: 74.0, date: 192.2 }

const LETTER = {
  left: 27.1, right: 559.5, pitch: 14.25, sizeRef: 318.4, salutationRef: 215.5, salutationBaseline: 185.3,
  firstBaseline: 218.8, bodyBottom: 690, sigX: 228.5, sigY: 704.5, sigW: 320.5, dateRight: 588.05, dateBaseline: 140.5, dateRef: 66.69,
  darpan: [
    { text: 'DARPAN Certified NGO by Govt. of India', ref: 131.6, baseline: 54.2 },
    { text: 'Reg: AAFTT2300ME20251', ref: 84.7, baseline: 61.9 },
    { text: 'www.ngoaquaterra.com', ref: 84.2, baseline: 70.4 },
  ],
  darpanRight: 579.6,
}

// ── Assets ──────────────────────────────────────────────────────────────────

const images = new Map<string, Promise<HTMLImageElement>>()
function loadImage(src: string): Promise<HTMLImageElement> {
  let p = images.get(src)
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => { images.delete(src); reject(new Error(`Could not load ${src}`)) }
      img.src = src
    })
    images.set(src, p)
  }
  return p
}

async function loadFonts() {
  if (!document.fonts) return
  await Promise.all(['400', '700', '800'].map(w => document.fonts.load(`${w} 20px Montserrat`).catch(() => [])))
  await document.fonts.ready
}

// ── Text helpers ────────────────────────────────────────────────────────────

/** The size at which `weight` Montserrat sets `text` exactly `widthPx` wide. */
function sizeForWidth(ctx: CanvasRenderingContext2D, weight: string, text: string, widthPx: number): number {
  ctx.font = `${weight} 100px ${FONT}`
  return (widthPx / ctx.measureText(text).width) * 100
}

/** `bold` is how many leading characters are bold: the person's name (and a possessive), never the comma after it. */
type Word = { t: string; bold: number }

/** Bold the person's own name wherever it appears, as the real letters do ("Asha's", "Asha Verma"). */
function toWords(paragraph: string, nameParts: Set<string>): Word[] {
  return paragraph.split(/\s+/).filter(Boolean).map(t => {
    const body = t.replace(/[^\p{L}’']+$/u, '')                 // drop trailing punctuation
    const core = body.replace(/[’']s$/i, '').replace(/^[^\p{L}]+/u, '')
    return { t, bold: core.length >= 3 && nameParts.has(core.toLowerCase()) ? body.length : 0 }
  })
}

const wordWidth = (ctx: CanvasRenderingContext2D, w: Word, reg: string, bold: string) => {
  if (!w.bold) { ctx.font = reg; return ctx.measureText(w.t).width }
  ctx.font = bold; const a = ctx.measureText(w.t.slice(0, w.bold)).width
  ctx.font = reg; return a + (w.bold < w.t.length ? ctx.measureText(w.t.slice(w.bold)).width : 0)
}

function layout(ctx: CanvasRenderingContext2D, paragraphs: Word[][], sizePx: number, maxWidth: number): Word[][][] {
  const reg = `400 ${sizePx}px ${FONT}`, bold = `700 ${sizePx}px ${FONT}`
  ctx.font = reg
  const space = ctx.measureText(' ').width
  return paragraphs.map(words => {
    const lines: Word[][] = []
    let line: Word[] = [], width = 0
    for (const w of words) {
      const ww = wordWidth(ctx, w, reg, bold)
      if (line.length && width + space + ww > maxWidth) { lines.push(line); line = []; width = 0 }
      width += (line.length ? space : 0) + ww
      line.push(w)
    }
    if (line.length) lines.push(line)
    return lines
  })
}

export function splitParagraphs(body: string): string[] {
  return body.replace(/\r\n/g, '\n').split(/\n\s*\n/).map(p => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean)
}

function drawWatermark(ctx: CanvasRenderingContext2D, W: number, H: number, word: string) {
  ctx.save()
  ctx.translate(W / 2, H / 2)
  ctx.rotate(-Math.PI / 6)
  ctx.fillStyle = 'rgba(20,20,20,0.09)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `800 ${W * 0.2}px ${FONT}`
  ctx.fillText(word.toUpperCase(), 0, 0)
  ctx.restore()
}

// ── The drawing ─────────────────────────────────────────────────────────────

export async function renderCertificateCanvas(input: RenderInput): Promise<HTMLCanvasElement> {
  const certificate = isCertificateTemplate(input.template)
  const [bg, sig] = await Promise.all([loadImage(BACKDROP[input.template]), loadImage(SIGNATURES_IMAGE), loadFonts()])

  const canvas = document.createElement('canvas')
  canvas.width = bg.naturalWidth; canvas.height = bg.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bg, 0, 0)

  const page = certificate ? PAGE.landscape : PAGE.portrait
  const s = canvas.width / page.w            // pixels per point
  /** Draw the signature image so its ink lands on `ink` (points). `fromX` crops to a right-hand part. */
  const drawSig = (ink: Ink, part?: { fromX: number; ox: number }) => {
    const k = (ink.w / SIG_INK.w) * s                      // canvas pixels per native pixel
    const sx = part?.fromX ?? 0
    const ox = part ? part.ox : SIG_INK.x
    ctx.drawImage(sig, sx, 0, sig.naturalWidth - sx, sig.naturalHeight, ink.x * s - (ox - sx) * k, ink.y * s - SIG_INK.y * k, (sig.naturalWidth - sx) * k, sig.naturalHeight * k)
  }
  ctx.textBaseline = 'alphabetic'

  if (certificate) {
    const c = CERT[input.template as keyof typeof CERT]
    ctx.fillStyle = INK
    ctx.textAlign = 'left'

    // Name: shrinks, never overflows into the signatures.
    const name = input.memberName || 'AquaTerra Member'
    let nameSize = sizeForWidth(ctx, '800', 'Full Name', REF.name * s)
    ctx.font = `800 ${nameSize}px ${FONT}`
    const nameMax = 700 * s
    if (ctx.measureText(name).width > nameMax) { nameSize *= nameMax / ctx.measureText(name).width; ctx.font = `800 ${nameSize}px ${FONT}` }
    ctx.fillText(name, CERT_X.left * s, (c.name[0] + 0.735 * (c.name[1] - c.name[0])) * s)

    const hours = input.hours != null ? `${formatHours(input.hours)} ${input.hours === 1 ? 'hour' : 'hours'}` : ''
    ctx.font = `800 ${sizeForWidth(ctx, '800', 'N hours', REF.hours * s)}px ${FONT}`
    ctx.fillText(hours, CERT_X.left * s, (c.hours[0] + 0.72 * (c.hours[1] - c.hours[0])) * s)

    ctx.font = `800 ${sizeForWidth(ctx, '800', 'month', REF.month * s)}px ${FONT}`
    ctx.fillText(formatMonth(input.periodStart), CERT_X.m1 * s, (c.m1[0] + 0.755 * (c.m1[1] - c.m1[0])) * s)
    ctx.fillText(formatMonth(input.periodEnd), CERT_X.m2 * s, (c.m2[0] + 0.755 * (c.m2[1] - c.m2[0])) * s)

    drawSig(c.sig)

    // The website under the registration text is not in the certificate artwork: draw it, underlined, in the original's blue.
    ctx.textAlign = 'right'
    ctx.font = `700 ${sizeForWidth(ctx, '700', 'www.ngoaquaterra.com', c.url.w * s)}px ${FONT}`
    ctx.fillStyle = '#1A1AE6'
    ctx.fillText('www.ngoaquaterra.com', c.url.right * s, c.url.baseline * s)
    ctx.fillRect((c.url.right - c.url.w) * s, (c.url.baseline + 1.6) * s, c.url.w * s, 0.7 * s)
    ctx.fillStyle = INK
    ctx.textAlign = 'left'

    ctx.textAlign = 'right'
    // Right-aligned, with the ordinal raised and smaller as on the printed certificates ("1st").
    const dateSize = sizeForWidth(ctx, '700', 'Date of issuance - 16th November, 2025', REF.date * s)
    const parts = ordinalParts(input.issuedAt)
    const sup = dateSize * 0.62
    const segs: { t: string; size: number; lift: number }[] = [
      { t: 'Date of issuance - ' + parts.day, size: dateSize, lift: 0 }, { t: parts.suffix, size: sup, lift: dateSize * 0.32 }, { t: parts.rest, size: dateSize, lift: 0 },
    ]
    const widths = segs.map(g => { ctx.font = `700 ${g.size}px ${FONT}`; return ctx.measureText(g.t).width })
    let dx = CERT_X.dateRight * s - widths.reduce((a, b) => a + b, 0)
    ctx.textAlign = 'left'
    segs.forEach((g, i) => { ctx.font = `700 ${g.size}px ${FONT}`; ctx.fillText(g.t, dx, 539.6 * s - g.lift); dx += widths[i] })
    ctx.textAlign = 'right'

    if (input.verifyCode) {
      ctx.font = `700 ${7.6 * s}px ${FONT}`
      ctx.fillStyle = 'rgba(20,20,20,0.62)'
      ctx.fillText(`Verify at ngoaquaterra.com/verify  ·  ${input.verifyCode}`, CERT_X.dateRight * s, 558 * s)
    }
  } else {
    drawLetter(ctx, input, s, drawSig)
  }

  if (input.watermark) drawWatermark(ctx, canvas.width, canvas.height, input.watermark)
  return canvas
}

function drawLetter(ctx: CanvasRenderingContext2D, input: RenderInput, s: number, drawSig: (ink: Ink, part?: { fromX: number; ox: number }) => void) {
  const L = LETTER
  const W = ctx.canvas.width

  // The acceptance letter reuses the offer letter's artwork: cover that title and draw its own.
  if (input.template === 'letter_acceptance') {
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(20, 60, 720, 224)
    ctx.textAlign = 'left'
    ctx.fillStyle = INK
    ctx.font = `800 ${84}px ${FONT}`
    ctx.fillText('Letter of', 34, 134)
    ctx.font = `800 ${84}px ${FONT}`
    const w = ctx.measureText('Acceptance').width
    const g = ctx.createLinearGradient(34, 0, 34 + w, 0)
    g.addColorStop(0, '#1E6BFF'); g.addColorStop(0.55, '#4FD6E8'); g.addColorStop(1, '#8CF5BF')
    ctx.lineJoin = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = INK
    ctx.strokeText('Acceptance', 34, 238)
    ctx.fillStyle = g
    ctx.fillText('Acceptance', 34, 238)
  }

  // Registration line under the logo (the letters' artwork does not carry it).
  ctx.textAlign = 'right'
  L.darpan.forEach((d, i) => {
    const url = i === 2
    ctx.font = `700 ${sizeForWidth(ctx, '700', d.text, d.ref * s)}px ${FONT}`
    ctx.fillStyle = url ? '#1A1AE6' : INK
    ctx.fillText(d.text, L.darpanRight * s, d.baseline * s)
    if (url) { const w = ctx.measureText(d.text).width; ctx.fillRect(L.darpanRight * s - w, d.baseline * s + 1.6 * s, w, 0.7 * s) }
  })

  // Date, top right.
  ctx.fillStyle = INK
  ctx.font = `700 ${sizeForWidth(ctx, '700', '1-11-2026', L.dateRef * s)}px ${FONT}`
  ctx.fillText(letterDate(input.issuedAt), L.dateRight * s, L.dateBaseline * s)

  // Salutation.
  ctx.textAlign = 'left'
  ctx.font = `400 ${sizeForWidth(ctx, '400', 'To whomsoever it may concern,', L.salutationRef * s)}px ${FONT}`
  ctx.fillText('To whomsoever it may concern,', L.left * s, L.salutationBaseline * s)

  // Body, in the original's size and line spacing; smaller only if it will not fit above the signatures.
  const nameParts = new Set((input.memberName || '').split(/\s+/).map(p => p.toLowerCase()).filter(p => p.length >= 3))
  const paragraphs = splitParagraphs(input.body ?? '').map(p => toWords(p, nameParts))
  const closing = LETTER_HAS_CLOSING[input.template]
  const closingLines = ['Sincerely,', 'Krish Goenka,', 'Founder, AquaTerra']
  const baseSize = sizeForWidth(ctx, '400', 'and environmental welfare through youth-driven initiatives.', L.sizeRef * s)
  const maxWidth = (L.right - L.left) * s

  let scale = 1, blocks: Word[][][] = []
  const startY = L.firstBaseline * s
  const limit = (L.bodyBottom + 4) * s
  for (;;) {
    const size = baseSize * scale, pitch = L.pitch * s * scale
    blocks = layout(ctx, paragraphs, size, maxWidth)
    const lines = blocks.reduce((n, b) => n + b.length, 0) + Math.max(0, blocks.length - 1) + (closing ? 1 + closingLines.length : 0)
    if (startY + (lines - 1) * pitch <= limit) break
    scale -= 0.02
    if (scale < 0.55) throw new CertificateTextTooLongError()
  }

  const size = baseSize * scale, pitch = L.pitch * s * scale
  const reg = `400 ${size}px ${FONT}`, bold = `700 ${size}px ${FONT}`
  ctx.fillStyle = INK
  ctx.font = reg
  const space = ctx.measureText(' ').width
  let y = startY
  const drawLine = (line: Word[]) => {
    let x = L.left * s
    line.forEach((w, i) => {
      if (w.bold) {
        ctx.font = bold; ctx.fillText(w.t.slice(0, w.bold), x, y)
        const bw = ctx.measureText(w.t.slice(0, w.bold)).width
        ctx.font = reg; ctx.fillText(w.t.slice(w.bold), x + bw, y)
      } else { ctx.font = reg; ctx.fillText(w.t, x, y) }
      x += wordWidth(ctx, w, reg, bold) + (i < line.length - 1 ? space : 0)
    })
  }
  blocks.forEach((block, bi) => {
    block.forEach(line => { drawLine(line); y += pitch })
    if (bi < blocks.length - 1) y += pitch
  })
  if (closing) {
    y += pitch
    ctx.font = reg
    closingLines.forEach(t => { ctx.fillText(t, L.left * s, y); y += pitch })
  }
  const bodyEnd = y

  // Signatures: both founders at the foot of the page; the acceptance letter has one signatory, under the text.
  if (SINGLE_SIGNATORY[input.template]) {
    // The right-hand signature only (Kanishk Agarwal), starting at the middle of the image.
    const mid = 300, k = L.sigW / SIG_INK.w
    const hPts = 116 * k
    drawSig({ x: L.left, y: Math.min(bodyEnd / s + 20, L.bodyBottom - hPts), w: L.sigW }, { fromX: mid, ox: mid + 10 })
  } else {
    drawSig({ x: L.sigX, y: L.sigY, w: L.sigW })
  }

  if (input.verifyCode) {
    ctx.fillStyle = 'rgba(20,20,20,0.62)'
    ctx.font = `700 ${6.4 * s}px ${FONT}`
    ctx.fillText('Verification code', L.left * s, 752 * s)
    ctx.fillText(input.verifyCode, L.left * s, 761 * s)
    ctx.fillText('ngoaquaterra.com/verify', L.left * s, 770 * s)
  }
  void W
}

/** A PNG data URL, for the desk's preview and the member's sample. */
export async function renderCertificatePreview(input: RenderInput): Promise<string> {
  const canvas = await renderCertificateCanvas(input)
  return canvas.toDataURL('image/png')
}

/** The A4 PDF a person downloads. */
export async function renderCertificatePdf(input: RenderInput): Promise<Blob> {
  const canvas = await renderCertificateCanvas(input)
  const bytes = dataUrlToBytes(canvas.toDataURL('image/jpeg', 0.93))
  const landscape = isCertificateTemplate(input.template)
  const pdf = jpegToPdf(bytes, canvas.width, canvas.height, landscape ? A4_PT.h : A4_PT.w, landscape ? A4_PT.w : A4_PT.h)
  return new Blob([pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer], { type: 'application/pdf' })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Made-up words for the sample a member sees before applying. Clearly a sample (and watermarked), never a real person. */
export const SAMPLE_LETTER_BODY =
  'AquaTerra is a student-led non-profit organisation based in Kolkata, committed to promoting social and environmental welfare through youth-driven initiatives.\n\n' +
  'We are pleased to write this letter for Sample Name, who has been associated with AquaTerra from March, 2025 to present. This is a sample of the letter layout: a real letter names the teams a person served in, the hours they gave, and what the people who worked with them have said.\n\n' +
  'It is written by AquaTerra, read by our HR team, and signed off before it is issued.'

export const SAMPLE_CERTIFICATE = { hours: 40, periodStart: '2025-03-01', periodEnd: '2026-07-01' }
