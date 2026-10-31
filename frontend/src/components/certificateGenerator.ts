// ── AquaTerra certificate / LoR / LoV generator ──────────────────────────────
// Owner: "generate certificate option with all formalities." Issuing a
// request on the Certificates desk (certificateService.decide) only ever
// flipped a status flag - there was no actual document for HR to hand the
// member. This draws one, in the same brand language (palette, type, logo)
// the poster/carousel/story generators already share via posterGenerator's
// brandKit, so it isn't a fourth visual system.
//
// Every number on the page comes from the request's own DB-derived snapshot
// (hours_at_request / drive_count_at_request / date_range_*, stamped by
// certificate_request_derive_snapshot - see certificateService.ts's own
// header) - never recomputed or re-typed here, so the document can't drift
// from what the desk actually approved.

import { brandKit } from './posterGenerator'
import type { CertificateRequest, DocType } from '../services/certificateService'

const {
  INK, CREAM, DISPLAY, MONO, SERIF, EINA,
  logo, loadLogo,
} = brandKit

// A formal document reads badly in the site's loud neon accent palette
// (ACCENTS - hot pink/lemon/grape, meant for feed cards and posters) and its
// eight-point "sticker" stars - both correctly flagged live as looking
// amateurish/cluttered on something meant to be handed to a member or an
// external institution as proof of hours. This file uses its own quiet,
// desaturated palette and a plain circular seal instead - same ink/cream
// paper and same fonts as the rest of the brand kit, just restrained.
const DEEP_FOREST = '#1B4332', DEEP_NAVY = '#1D3557', DEEP_WALNUT = '#5C4033'
const DOC_ACCENT: Record<DocType, string> = { certificate: DEEP_FOREST, lor: DEEP_NAVY, lov: DEEP_WALNUT }

// Landscape, ~A4 ratio (1.414), high enough resolution to print cleanly.
const W = 1600, H = 1131

const TITLE: Record<DocType, string> = {
  certificate: 'Certificate of Appreciation',
  lor: 'Letter of Recommendation',
  lov: 'Letter of Volunteering',
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) }
  catch { return '' }
}

function bodyText(req: CertificateRequest): string {
  const hours = req.hoursAtRequest != null ? `${req.hoursAtRequest}` : 'a number of'
  const drives = req.driveCountAtRequest != null ? req.driveCountAtRequest : 'several'
  const range = req.dateRangeStart && req.dateRangeEnd
    ? `between ${fmtDate(req.dateRangeStart)} and ${fmtDate(req.dateRangeEnd)}`
    : ''
  const driveWord = drives === 1 ? 'drive' : 'drives'

  switch (req.docType) {
    case 'lor':
      return `${req.memberName || 'This volunteer'} has been an active member of AquaTerra, a student-run community NGO based in Kolkata, contributing ${hours} volunteer hours across ${drives} ${driveWord} ${range}. Their commitment, reliability and initiative throughout this time are gladly recommended to any organisation or institution they go on to work with.`
    case 'lov':
      return `This is to confirm that ${req.memberName || 'the above-named individual'} has volunteered with AquaTerra for ${hours} hours across ${drives} ${driveWord} ${range}, as an active, verified member of the organisation.`
    default:
      return `In recognition of ${hours} hours of volunteer service across ${drives} ${driveWord} with AquaTerra ${range}, contributing real, on-the-ground welfare and community work.`
  }
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w }
    else line = test
  }
  if (line) lines.push(line)
  return lines
}

export async function generateCertificate(req: CertificateRequest): Promise<string> {
  await Promise.all([document.fonts?.ready ?? Promise.resolve(), loadLogo()])

  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
  ctx.textBaseline = 'alphabetic'

  const accent = DOC_ACCENT[req.docType]

  // Paper + a bold top band in the doc's own accent (one hue, full
  // confidence) instead of a thin hairline - still one colour, just given
  // real presence instead of whispering it.
  ctx.fillStyle = CREAM; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = accent; ctx.fillRect(0, 0, W, 26)
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5
  ctx.strokeRect(40, 46, W - 80, H - 86)
  ctx.strokeStyle = accent; ctx.lineWidth = 2
  ctx.strokeRect(58, 64, W - 116, H - 122)

  // Solid corner wedges in the accent, not a whisper-thin bracket - a formal
  // document can still carry real graphic weight in ONE colour.
  const wedge = (cx: number, cy: number, sx: number, sy: number) => {
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.moveTo(cx, cy); ctx.lineTo(cx + sx * 46, cy); ctx.lineTo(cx, cy + sy * 46)
    ctx.closePath(); ctx.fill()
  }
  wedge(72, 72, 1, 1); wedge(W - 72, 72, -1, 1)
  wedge(72, H - 72, 1, -1); wedge(W - 72, H - 72, -1, -1)

  logo(ctx, W / 2 - 22, 148, accent, 44, true)
  ctx.textAlign = 'center'
  ctx.font = `700 19px ${MONO}`; ctx.fillStyle = accent
  ctx.fillText('AQUATERRA · STUDENT-RUN NGO · KOLKATA', W / 2, 216)

  ctx.font = `900 58px ${DISPLAY}`; ctx.fillStyle = INK
  ctx.fillText(TITLE[req.docType].toUpperCase(), W / 2, 300)
  ctx.fillStyle = accent; ctx.fillRect(W / 2 - 70, 322, 140, 6)

  ctx.font = `400 22px ${EINA}`; ctx.fillStyle = 'rgba(10,10,10,0.6)'
  ctx.fillText('This is to certify that', W / 2, 380)

  // Shrink-to-fit: an unbounded 64px name (this desk has real names longer
  // than "AquaTerra Member") could overflow past the card's inner border
  // with nothing to catch it, unlike every other text-drawing generator in
  // this codebase (posterGenerator/StoryGenerator's fitHeadline family) -
  // this is the same guarantee, sized for a single centred line.
  const name = req.memberName || 'AquaTerra Member'
  const nameMaxWidth = W - 260
  let nameSize = 64
  ctx.font = `italic 700 ${nameSize}px ${SERIF}`
  while (nameSize > 32 && ctx.measureText(name).width > nameMaxWidth) {
    nameSize -= 2
    ctx.font = `italic 700 ${nameSize}px ${SERIF}`
  }
  ctx.fillStyle = INK
  ctx.fillText(name, W / 2, 460)
  ctx.strokeStyle = accent; ctx.lineWidth = 2
  const nameWidth = Math.min(ctx.measureText(name).width, nameMaxWidth)
  ctx.beginPath(); ctx.moveTo(W / 2 - nameWidth / 2 - 10, 478); ctx.lineTo(W / 2 + nameWidth / 2 + 10, 478); ctx.stroke()

  // Shrink-to-fit for the body paragraph, same guarantee as the name above -
  // was a hard `.slice(0, 6)` with no ellipsis, so a long name + a wide date
  // range (an LoR's body text runs ~300 characters) could silently cut a
  // sentence mid-way with nothing showing it had been truncated. The
  // available box is fixed (body starts at y=560, footer starts at
  // H-150=981, so ~380px minus a little breathing room before the footer);
  // shrink the font until the wrapped text fits inside it instead of
  // dropping lines.
  const bodyTop = 560
  const bodyBottom = H - 150 - 40
  const bodyMaxWidth = W - 340
  const body = bodyText(req)
  let bodySize = 25
  let lineHeight = Math.round(bodySize * 1.6)
  ctx.font = `400 ${bodySize}px ${EINA}`
  let lines = wrapLines(ctx, body, bodyMaxWidth)
  while (bodySize > 15 && bodyTop + lines.length * lineHeight > bodyBottom) {
    bodySize -= 1
    lineHeight = Math.round(bodySize * 1.6)
    ctx.font = `400 ${bodySize}px ${EINA}`
    lines = wrapLines(ctx, body, bodyMaxWidth)
  }
  ctx.font = `400 ${bodySize}px ${EINA}`; ctx.fillStyle = 'rgba(10,10,10,0.82)'
  ctx.textAlign = 'center'
  const maxLines = Math.max(1, Math.floor((bodyBottom - bodyTop) / lineHeight))
  lines.slice(0, maxLines).forEach((ln, i) => ctx.fillText(ln, W / 2, bodyTop + i * lineHeight))
  const bodyTextBottom = bodyTop + (Math.min(lines.length, maxLines) - 1) * lineHeight

  // A short body (a certificate/LoV with few hours+drives, or any body that
  // no longer needs the shrink loop above) left the whole lower half of the
  // page empty between the paragraph and the footer - confirmed by actually
  // rendering one, not just reading the layout math. Fill genuinely leftover
  // room with a large, faint version of the corner stars rather than a void.
  const emptyBelow = bodyBottom - bodyTextBottom
  if (emptyBelow > 160) {
    // A concentric seal with real presence - given more visible weight than
    // a near-invisible watermark, but still one hue, so it reads as a
    // deliberate emblem rather than a sticker.
    const rad = Math.min(110, emptyBelow * 0.38)
    const cx = W / 2, cy = bodyTextBottom + emptyBelow / 2
    ctx.save(); ctx.globalAlpha = 0.14; ctx.strokeStyle = accent
    ctx.lineWidth = rad * 0.1; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke()
    ctx.lineWidth = rad * 0.06; ctx.beginPath(); ctx.arc(cx, cy, rad * 0.72, 0, Math.PI * 2); ctx.stroke()
    ctx.globalAlpha = 0.22
    ctx.beginPath(); ctx.arc(cx, cy, rad * 0.42, 0, Math.PI * 2); ctx.fillStyle = accent; ctx.fill()
    ctx.restore()
  }

  // Footer: issued date (left) + signature line (right), the two facts that
  // make this a real issued document rather than a template mockup.
  ctx.textAlign = 'left'
  ctx.font = `600 16px ${MONO}`; ctx.fillStyle = 'rgba(10,10,10,0.45)'
  ctx.fillText('ISSUED', 140, H - 150)
  ctx.font = `400 22px ${EINA}`; ctx.fillStyle = INK
  ctx.fillText(fmtDate(req.decidedAt) || fmtDate(new Date().toISOString()), 140, H - 118)

  ctx.textAlign = 'right'
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(W - 400, H - 150); ctx.lineTo(W - 140, H - 150); ctx.stroke()
  ctx.font = `600 20px ${SERIF}`; ctx.fillStyle = INK
  ctx.fillText('AquaTerra HR', W - 140, H - 118)
  ctx.font = `600 16px ${MONO}`; ctx.fillStyle = 'rgba(10,10,10,0.45)'
  ctx.fillText('authorised signatory', W - 140, H - 96)

  ctx.textAlign = 'left'
  return canvas.toDataURL('image/png')
}

export function downloadCertificate(dataUrl: string, filename: string) {
  const a = document.createElement('a'); a.href = dataUrl; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
}
