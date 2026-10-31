// ── AquaTerra Instagram/WhatsApp Story generator ─────────────────────────────
// Turns a feed post or a team opening into a 1080×1920 Story graphic, in the
// exact brand language of the poster/carousel/blog studios - same palette,
// type, grid, stars, stickers and logo badge (all reused from
// posterGenerator's brandKit, nothing duplicated). Every call rolls a random
// template + accent + decoration, so "regenerate" in ShareModal produces a
// genuinely different design each time.

import { brandKit, type Rng } from './posterGenerator'
import { getInitials, hashColor } from '../lib/uiHelpers'

const {
  INK, WHITE, CREAM, ACCENTS, DISPLAY, MONO, SERIF, EINA, catColor, inkTextOn,
  mulberry32, pick, rrange, chance,
  grid, star, rrect, layoutLines, fitHeadline, drawLines, logo, drawCover,
  decorate, darkBg, accentBg, creamBg, hardShadow, stripEmoji,
  loadImage, loadLogo,
} = brandKit

const W = 1080, H = 1920

// ── Story data types ─────────────────────────────────────────────
export interface StoryData {
  type: 'post' | 'opening' | 'member_of_month'
  title?: string; body?: string; authorName?: string; authorAvatar?: string
  authorSchool?: string; category?: string; uuid?: string
  imageUrl?: string
  openingTitle?: string; description?: string; skills?: string[]
  teamName?: string; teamCategory?: string; teamUuid?: string
  focal?: { fx: number; fy: number } // 0–1 crop focal point for the cover photo; default center
  // member_of_month only. `imageUrl` above doubles as the member's photo -
  // absent means the fixed initials placeholder renders instead (see
  // sMemberOfMonth). `period` is pre-formatted ("SEPTEMBER 2026"), matching
  // memberOfMonthService's formatPeriod output rather than a raw date here.
  memberName?: string; period?: string; citation?: string
}

export interface StoryResult { dataUrl: string; template: string }

type C2D = CanvasRenderingContext2D

// ── Shared chrome ─────────────────────────────────────────────────────────

function topBottomBars(ctx: C2D, accent: string, accent2: string) {
  ctx.fillStyle = accent; ctx.fillRect(0, 0, W, 12)
  ctx.fillStyle = accent2; ctx.fillRect(0, H - 12, W, 12)
}

function kicker(ctx: C2D, text: string, x: number, y: number, color: string) {
  ctx.font = `700 26px ${MONO}`; ctx.fillStyle = color
  ctx.fillText(text.toUpperCase(), x, y)
}

function topScrim(ctx: C2D, to = 0.3) {
  const g = ctx.createLinearGradient(0, 0, 0, H * to)
  g.addColorStop(0, 'rgba(0,0,0,0.62)'); g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * to)
}
function bottomScrim(ctx: C2D, from = 0.4) {
  const g = ctx.createLinearGradient(0, H * from, 0, H)
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.92)')
  ctx.fillStyle = g; ctx.fillRect(0, H * from, W, H * (1 - from))
}

// "read full post →" + handle, pinned above the bottom edge. `ink` = drawn on
// a light/cream/flood surface (ink text); otherwise white-on-dark/photo.
function ctaFooter(ctx: C2D, ink: boolean) {
  const fg = ink ? INK : WHITE
  ctx.font = `700 30px ${DISPLAY}`; ctx.fillStyle = fg
  ctx.fillText('read full post →', 72, H - 150)
  ctx.font = `500 24px ${MONO}`; ctx.fillStyle = ink ? 'rgba(10,10,10,0.5)' : 'rgba(255,255,255,0.5)'
  ctx.fillText('ngoaquaterra.com', 72, H - 108)
  ctx.font = `600 24px ${MONO}`; ctx.fillStyle = ink ? 'rgba(10,10,10,0.42)' : 'rgba(255,255,255,0.42)'
  ctx.fillText('@ngo.aquaterra  ·  student-run NGO', 72, H - 66)
}

// Washi-tape strip - translucent, rotated, faint outline. Matches poster/blog/carousel.
function tape(ctx: C2D, cx: number, cy: number, rot: number, color: string) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot)
  ctx.globalAlpha = 0.62; ctx.fillStyle = color; ctx.fillRect(-56, -17, 112, 34)
  ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = 1.5; ctx.strokeRect(-56, -17, 112, 34)
  ctx.restore()
}

// ── Post-share templates ─────────────────────────────────────────────────
// Each receives ctx, the story data, an accent pair, the seeded rng, and
// (when a post photo loaded) the image. `img`-dependent templates are only
// entered into the pool when a photo is actually available (see generateStory).

type PostCtx = { ctx: C2D; d: StoryData; accent: string; accent2: string; r: Rng; img: HTMLImageElement | null }

// S1 - IMAGE FULL: full-bleed post photo, scrims, excerpt bottom-anchored.
function sImageFull({ ctx, d, accent, accent2, r, img }: PostCtx) {
  if (img) drawCover(ctx, img, 0, 0, W, H, d.focal?.fx, d.focal?.fy); else darkBg(ctx, W, H, accent, r)
  topScrim(ctx, 0.3); bottomScrim(ctx, 0.42)
  topBottomBars(ctx, accent, accent2)
  logo(ctx, 72, 120, accent, 50, false, img ? 'photo' : undefined)
  kicker(ctx, d.category || 'AquaTerra', 76, 190, accent)

  const body = (d.body || d.title || 'AquaTerra community update').slice(0, 260)
  const { size, lines, font, lhMul } = fitHeadline(ctx, body, W - 150, 6, 84, 44, r)
  const lh = size * 1.14 * lhMul
  const blockH = lines.length * lh
  const top = H - 300 - blockH
  ctx.font = font; ctx.fillStyle = WHITE
  drawLines(ctx, lines, 76, top, lh)
  ctx.fillStyle = accent; ctx.fillRect(76, top + blockH + 20, 110, 9)

  ctaFooter(ctx, false)
}

// S2 - CREAM CARD: cream paper, a bordered hard-shadowed white card holding the excerpt.
function sCreamCard({ ctx, d, accent, accent2, r }: PostCtx) {
  creamBg(ctx, W, H)
  decorate(ctx, W, H, r, accent, false)
  topBottomBars(ctx, accent, accent2)
  logo(ctx, 72, 120, accent, 50, true)
  kicker(ctx, d.category || 'AquaTerra', 76, 190, accent)

  const cx = 64, cw = W - 128, cy = 280
  const rawBody = (d.body || d.title || 'AquaTerra community update')
  const body = rawBody.slice(0, 320)
  // Short excerpts leave the card small and high with a dead zone below. Bump the
  // headline one size step so the few lines render bigger and hold the top third.
  const bodyShort = rawBody.trim().length < 130
  const { size, lines, font, lhMul } = fitHeadline(ctx, body, cw - 100, 9, bodyShort ? 84 : 62, 34, r)
  const lh = size * 1.24 * lhMul
  const blockH = lines.length * lh
  const ch = blockH + 220
  hardShadow(ctx, cx, cy, cw, ch, 28, INK, 10)
  rrect(ctx, cx, cy, cw, ch, 28); ctx.fillStyle = WHITE; ctx.fill()
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke()
  // accent tab
  const tabLabel = (d.category || 'update').toUpperCase().slice(0, 14)
  rrect(ctx, cx + 40, cy - 26, 200, 52, 26); ctx.fillStyle = accent; ctx.fill()
  ctx.font = `900 24px ${DISPLAY}`; ctx.fillStyle = INK; ctx.fillText(tabLabel, cx + 66, cy + 8)

  ctx.font = font; ctx.fillStyle = INK
  drawLines(ctx, lines, cx + 50, cy + 110, lh)
  ctx.fillStyle = accent; ctx.fillRect(cx + 50, cy + 110 + blockH + 10, 100, 8)
  if (d.authorName) {
    ctx.font = `700 26px ${MONO}`; ctx.fillStyle = 'rgba(10,10,10,0.55)'
    ctx.fillText(('- ' + d.authorName).slice(0, 40), cx + 50, cy + ch - 40)
  }

  ctaFooter(ctx, true)
}

// S3 - INK QUOTE: dark field, giant serif quote mark, statement beneath it.
function sInkQuote({ ctx, d, accent, accent2, r }: PostCtx) {
  darkBg(ctx, W, H, accent, r)
  if (chance(r, 0.8)) grid(ctx, W, H)
  topBottomBars(ctx, accent, accent2)
  logo(ctx, 72, 120, accent)
  kicker(ctx, d.category || 'AquaTerra', 76, 190, accent)

  ctx.fillStyle = accent; ctx.font = `900 240px ${SERIF}`
  ctx.fillText('“', 60, 400)

  const body = (d.body || d.title || 'AquaTerra community update').slice(0, 240)
  const { size, lines, font, lhMul } = fitHeadline(ctx, body, W - 150, 7, 74, 40, r)
  const lh = size * 1.16 * lhMul
  const top = 440
  ctx.font = font; ctx.fillStyle = WHITE
  drawLines(ctx, lines, 76, top, lh)
  const blockH = lines.length * lh
  if (d.authorName) {
    ctx.font = `700 26px ${MONO}`; ctx.fillStyle = accent
    ctx.fillText(('- ' + d.authorName).toUpperCase().slice(0, 40), 76, Math.min(top + blockH + 60, H - 340))
  }

  ctaFooter(ctx, false)
}

// S4 - POLAROID STORY: tilted, taped photo near the top on cream paper, excerpt below.
function sPolaroidStory({ ctx, d, accent, accent2, r, img }: PostCtx) {
  creamBg(ctx, W, H)
  topBottomBars(ctx, accent, accent2)
  logo(ctx, 72, 120, accent, 50, true)
  kicker(ctx, d.category || 'AquaTerra', 76, 190, accent)

  const fw = W * 0.72, fh = fw * 0.86, pad = 30
  const fx = (W - fw) / 2, fy = 250
  ctx.save()
  ctx.translate(fx + fw / 2, fy + (fh + pad * 2) / 2); ctx.rotate(rrange(r, -0.05, 0.05)); ctx.translate(-(fx + fw / 2), -(fy + (fh + pad * 2) / 2))
  hardShadow(ctx, fx, fy, fw, fh + pad * 2 + 50, 12, INK, 10)
  rrect(ctx, fx, fy, fw, fh + pad * 2 + 50, 12); ctx.fillStyle = WHITE; ctx.fill()
  if (img) drawCover(ctx, img, fx + pad, fy + pad, fw - pad * 2, fh); else { ctx.fillStyle = '#e8e8e8'; ctx.fillRect(fx + pad, fy + pad, fw - pad * 2, fh) }
  tape(ctx, fx + 44, fy + 4, -0.5, accent); tape(ctx, fx + fw - 44, fy + 4, 0.5, accent2)
  ctx.font = `italic 400 34px ${SERIF}`; ctx.fillStyle = INK; ctx.textAlign = 'center'
  ctx.fillText((d.category || 'aquaterra').toLowerCase(), fx + fw / 2, fy + pad + fh + 38); ctx.textAlign = 'left'
  ctx.restore()
  star(ctx, W - 110, fy - 20, rrange(r, 40, 56), accent, 0.85, rrange(r, -0.3, 0.3))

  const body = (d.body || d.title || 'AquaTerra community update').slice(0, 180)
  const top = fy + fh + pad * 2 + 130
  const { size, lines, font, lhMul } = fitHeadline(ctx, body, W - 160, 4, 56, 34, r)
  const lh = size * 1.18 * lhMul
  ctx.font = font; ctx.fillStyle = INK
  drawLines(ctx, lines, 80, top, lh)

  ctaFooter(ctx, true)
}

// S5 - ACCENT FLOOD: bright accent background, ink type, giant star watermark.
function sAccentFlood({ ctx, d, accent, accent2, r }: PostCtx) {
  accentBg(ctx, W, H, accent, accent2, r)
  star(ctx, W * rrange(r, 0.68, 0.88), H * rrange(r, 0.14, 0.24), rrange(r, 300, 420), INK, 0.07, rrange(r, -0.4, 0.4))
  ctx.fillStyle = INK; ctx.fillRect(0, 0, W, 14); ctx.fillRect(0, H - 14, W, 14)
  logo(ctx, 72, 120, accent)
  ctx.fillStyle = INK; ctx.globalAlpha = 0.55; ctx.font = `700 26px ${MONO}`
  ctx.fillText((d.category || 'AquaTerra').toUpperCase(), 76, 200); ctx.globalAlpha = 1

  const body = (d.body || d.title || 'AquaTerra').slice(0, 220)
  const { size, lines, font, lhMul } = fitHeadline(ctx, body, W - 150, 7, 88, 42, r)
  const lh = size * 1.12 * lhMul
  const top = (H - lines.length * lh) / 2 - 40
  ctx.font = font; ctx.fillStyle = INK
  drawLines(ctx, lines, 76, top, lh)
  const blockH = lines.length * lh
  ctx.fillStyle = INK; ctx.fillRect(76, top + blockH + 24, 140, 10)

  ctaFooter(ctx, true)
}

// ── Opening/recruiting templates ─────────────────────────────────────────
// Openings never carry a photo - every template here is typographic.

type OpeningCtx = { ctx: C2D; d: StoryData; accent: string; accent2: string; r: Rng }

// O1 - HERO DARK: dark hero, skill chips, ink CTA pill.
function oHeroDark({ ctx, d, accent, accent2, r }: OpeningCtx) {
  darkBg(ctx, W, H, accent, r); grid(ctx, W, H, 0.05)
  topBottomBars(ctx, accent, accent2)
  star(ctx, W - 105, 118, 108, WHITE, 0.06)
  logo(ctx, 72, 120, accent)

  rrect(ctx, 72, 190, 400, 58, 29); ctx.fillStyle = accent; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke()
  ctx.font = `900 27px ${MONO}`; ctx.fillStyle = INK; ctx.fillText("★ WE'RE HIRING", 100, 229)

  const tl = (d.teamName || 'AquaTerra').toUpperCase()
  ctx.font = `700 28px ${MONO}`; const tw = ctx.measureText(tl).width + 52
  rrect(ctx, 72, 284, tw, 54, 27); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 2; ctx.stroke()
  ctx.fillStyle = WHITE; ctx.fillText(tl, 98, 321)

  const title = (d.openingTitle || 'Open Role').toUpperCase()
  const { size, lines, font, lhMul } = fitHeadline(ctx, title, W - 144, 3, 108, 56, r)
  const lh = size * 1.1 * lhMul
  const top = 408
  ctx.font = font; ctx.fillStyle = WHITE
  drawLines(ctx, lines, 72, top, lh)
  const blockH = lines.length * lh
  ctx.fillStyle = accent; ctx.fillRect(72, top + blockH + 14, 190, 10)

  let nextY = top + blockH + 70
  if (d.description) {
    ctx.font = `400 34px ${EINA}`; ctx.fillStyle = 'rgba(255,255,255,0.68)'
    const desc = d.description.slice(0, 180) + (d.description.length > 180 ? '…' : '')
    const dLines = layoutLines(ctx, desc, W - 160).slice(0, 4)
    dLines.forEach((ln, k) => ctx.fillText(ln, 80, nextY + 34 + k * 44))
    nextY += 34 + dLines.length * 44 + 30
  }

  if (d.skills?.length) {
    ctx.font = `700 22px ${MONO}`; ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillText('SKILLS', 72, nextY)
    let sx = 72, sy = nextY + 24
    for (const sk of d.skills.slice(0, 7)) {
      ctx.font = `700 25px ${MONO}`; const sw = ctx.measureText(sk).width + 36
      if (sx + sw > W - 72) { sx = 72; sy += 58 }
      rrect(ctx, sx, sy, sw, 48, 24); ctx.fillStyle = 'rgba(255,255,255,0.09)'; ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.17)'; ctx.lineWidth = 1.5; ctx.stroke()
      ctx.fillStyle = WHITE; ctx.fillText(sk, sx + 18, sy + 33); sx += sw + 14
    }
  }

  const ctaY = H - 300
  rrect(ctx, 72, ctaY, W - 144, 178, 24); ctx.fillStyle = accent; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke()
  ctx.font = `900 44px ${DISPLAY}`; ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.fillText('JOIN THE WORK →', W / 2, ctaY + 66)
  ctx.font = `700 27px ${MONO}`; ctx.fillStyle = 'rgba(0,0,0,0.52)'; ctx.fillText('aquaterrakolkata@gmail.com', W / 2, ctaY + 128); ctx.textAlign = 'left'
}

// O2 - CREAM BOARD: cream "job board" - bordered role card, outlined skill pills, ink CTA.
function oCreamBoard({ ctx, d, accent, accent2, r }: OpeningCtx) {
  creamBg(ctx, W, H)
  decorate(ctx, W, H, r, accent, false)
  topBottomBars(ctx, accent, accent2)
  logo(ctx, 72, 120, accent, 50, true)

  kicker(ctx, "WE'RE HIRING", 76, 190, accent)
  const tl = (d.teamName || 'AquaTerra').toUpperCase()
  ctx.font = `700 26px ${MONO}`; const tw = ctx.measureText(tl).width + 44
  rrect(ctx, 76, 216, tw, 48, 24); ctx.fillStyle = INK; ctx.fill()
  ctx.fillStyle = CREAM; ctx.fillText(tl, 76 + 22, 216 + 32)

  const cx = 64, cw = W - 128, cy = 310
  const title = d.openingTitle || 'Open Role'
  const { size, lines, font, lhMul } = fitHeadline(ctx, title, cw - 100, 4, 72, 40, r)
  const lh = size * 1.14 * lhMul
  const blockH = lines.length * lh

  let descLines: string[] = []
  if (d.description) {
    const desc = d.description.slice(0, 160) + (d.description.length > 160 ? '…' : '')
    ctx.font = `400 27px ${EINA}`
    descLines = layoutLines(ctx, desc, cw - 100).slice(0, 4)
  }
  const skillRows = d.skills?.length ? Math.ceil(Math.min(d.skills.length, 6) / 2) : 0
  const ch = 100 + blockH + (descLines.length ? descLines.length * 36 + 30 : 0) + (skillRows ? skillRows * 58 + 20 : 0) + 50

  hardShadow(ctx, cx, cy, cw, ch, 28, INK, 10)
  rrect(ctx, cx, cy, cw, ch, 28); ctx.fillStyle = WHITE; ctx.fill()
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke()

  let y = cy + 90
  ctx.font = font; ctx.fillStyle = INK
  drawLines(ctx, lines, cx + 50, y, lh)
  y += blockH + 34

  if (descLines.length) {
    ctx.font = `400 27px ${EINA}`; ctx.fillStyle = 'rgba(10,10,10,0.68)'
    descLines.forEach((ln, k) => ctx.fillText(ln, cx + 50, y + k * 36))
    y += descLines.length * 36 + 24
  }

  if (d.skills?.length) {
    let sx = cx + 50, sy = y
    for (const sk of d.skills.slice(0, 6)) {
      ctx.font = `700 22px ${MONO}`; const sw = ctx.measureText(sk).width + 32
      if (sx + sw > cx + cw - 50) { sx = cx + 50; sy += 58 }
      rrect(ctx, sx, sy, sw, 44, 22); ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.stroke()
      ctx.fillStyle = accent; ctx.fillText(sk, sx + 16, sy + 29); sx += sw + 12
    }
  }

  const ctaY = H - 280
  rrect(ctx, 72, ctaY, W - 144, 168, 24); ctx.fillStyle = INK; ctx.fill()
  ctx.font = `900 40px ${DISPLAY}`; ctx.fillStyle = CREAM; ctx.textAlign = 'center'
  ctx.fillText('JOIN THE WORK →', W / 2, ctaY + 62)
  ctx.font = `700 25px ${MONO}`; ctx.fillStyle = accent
  ctx.fillText('aquaterrakolkata@gmail.com', W / 2, ctaY + 118); ctx.textAlign = 'left'
}

// O3 - ACCENT BANNER: accent-flood top banner, cream lower panel with role + skills + CTA.
function oAccentBanner({ ctx, d, accent, accent2, r }: OpeningCtx) {
  creamBg(ctx, W, H)
  const bannerH = Math.round(H * 0.4)
  accentBg(ctx, W, bannerH, accent, accent2, r)
  star(ctx, W - 100, bannerH * 0.35, rrange(r, 90, 130), INK, 0.08, rrange(r, -0.3, 0.3))
  ctx.fillStyle = INK; ctx.fillRect(0, bannerH - 8, W, 8)
  logo(ctx, 72, 120, accent)

  const { size, lines, font, lhMul } = fitHeadline(ctx, "WE'RE HIRING", W - 150, 2, 120, 60, r)
  const lh = size * 1.05 * lhMul
  ctx.font = font; ctx.fillStyle = INK
  drawLines(ctx, lines, 76, bannerH * 0.62, lh)

  const tl = (d.teamName || 'AquaTerra').toUpperCase()
  ctx.font = `700 26px ${MONO}`; ctx.fillStyle = INK; ctx.globalAlpha = 0.6
  ctx.fillText(tl, 76, bannerH - 40); ctx.globalAlpha = 1

  let y = bannerH + 90
  const title = d.openingTitle || 'Open Role'
  const { lines: tLines, font: tFont, lhMul: tlhMul, size: tSize } = fitHeadline(ctx, title, W - 150, 3, 76, 42, r)
  const tlh = tSize * 1.1 * tlhMul
  ctx.font = tFont; ctx.fillStyle = INK
  drawLines(ctx, tLines, 76, y, tlh)
  y += tLines.length * tlh + 30
  ctx.fillStyle = accent; ctx.fillRect(76, y - 22, 140, 10)

  if (d.skills?.length) {
    let sx = 76, sy = y + 30
    for (const sk of d.skills.slice(0, 6)) {
      ctx.font = `700 23px ${MONO}`; const sw = ctx.measureText(sk).width + 34
      if (sx + sw > W - 76) { sx = 76; sy += 58 }
      rrect(ctx, sx, sy, sw, 46, 23); ctx.fillStyle = accent + '1F'; ctx.fill()
      ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.stroke()
      ctx.fillStyle = INK; ctx.fillText(sk, sx + 17, sy + 31); sx += sw + 12
    }
  }

  const ctaY = H - 260
  rrect(ctx, 76, ctaY, W - 152, 160, 24); ctx.fillStyle = INK; ctx.fill()
  ctx.font = `900 38px ${DISPLAY}`; ctx.fillStyle = CREAM; ctx.textAlign = 'center'
  ctx.fillText('JOIN THE WORK →', W / 2, ctaY + 60)
  ctx.font = `700 24px ${MONO}`; ctx.fillStyle = accent
  ctx.fillText('aquaterrakolkata@gmail.com', W / 2, ctaY + 112); ctx.textAlign = 'left'
  ctx.fillStyle = accent; ctx.fillRect(0, H - 12, W, 12)
}

// O4 - POSTER: bold cutout/ransom-style role title, maximum attention.
function oPoster({ ctx, d, accent, accent2, r }: OpeningCtx) {
  darkBg(ctx, W, H, accent, r); grid(ctx, W, H, 0.05)
  topBottomBars(ctx, accent, accent2)
  logo(ctx, 72, 116, accent)
  kicker(ctx, "WE'RE HIRING · " + (d.teamName || 'AquaTerra'), 76, 200, accent)

  const words = (d.openingTitle || 'Open Role').toUpperCase().replace(/\s+/g, ' ').trim().split(' ').slice(0, 8)
  const fonts = [DISPLAY, SERIF, MONO]
  const cols = [...ACCENTS, WHITE]
  ctx.textBaseline = 'middle'
  // Keep word rows clear of the skills row / bottom bar below.
  const maxY = H - 320, maxRowW = W - 168
  let x = 84, y = H * 0.34, lineH = 0
  for (const w of words) {
    let fs = Math.round(rrange(r, 56, 108))
    const font = pick(r, fonts)
    ctx.font = `900 ${fs}px ${font}`
    let tw = ctx.measureText(w).width
    const padX = 18, padY = 12
    // Shrink an over-wide single word instead of drawing past the right edge.
    while (tw + padX * 2 > maxRowW && fs > 30) {
      fs -= 4; ctx.font = `900 ${fs}px ${font}`; tw = ctx.measureText(w).width
    }
    const bw = tw + padX * 2, bh = fs + padY * 2
    if (x + bw > W - 84) { x = 84; y += lineH + 22; lineH = 0 }
    if (y + bh / 2 > maxY) break // out of vertical room - drop remaining words
    ctx.save(); ctx.translate(x + bw / 2, y); ctx.rotate(rrange(r, -0.12, 0.12))
    hardShadow(ctx, -bw / 2, -bh / 2, bw, bh, 8, INK, 6)
    rrect(ctx, -bw / 2, -bh / 2, bw, bh, 8); ctx.fillStyle = pick(r, cols); ctx.fill()
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke()
    ctx.fillStyle = INK; ctx.fillText(w, -tw / 2, 2)
    ctx.restore()
    x += bw + 18; lineH = Math.max(lineH, bh)
  }
  ctx.textBaseline = 'alphabetic'

  if (d.skills?.length) {
    let sx = 76, sy = y + lineH + 60
    ctx.font = `700 22px ${MONO}`; ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillText('SKILLS', 76, sy); sy += 26
    for (const sk of d.skills.slice(0, 6)) {
      ctx.font = `700 24px ${MONO}`; const sw = ctx.measureText(sk).width + 34
      if (sx + sw > W - 76) { sx = 76; sy += 56 }
      rrect(ctx, sx, sy, sw, 46, 23); ctx.fillStyle = 'rgba(255,255,255,0.09)'; ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.17)'; ctx.lineWidth = 1.5; ctx.stroke()
      ctx.fillStyle = WHITE; ctx.fillText(sk, sx + 17, sy + 31); sx += sw + 12
    }
  }

  const ctaY = H - 260
  rrect(ctx, 76, ctaY, W - 152, 160, 24); ctx.fillStyle = accent; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke()
  ctx.font = `900 38px ${DISPLAY}`; ctx.fillStyle = INK; ctx.textAlign = 'center'
  ctx.fillText('JOIN THE WORK →', W / 2, ctaY + 60)
  ctx.font = `700 24px ${MONO}`; ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillText('aquaterrakolkata@gmail.com', W / 2, ctaY + 112); ctx.textAlign = 'left'
}

// ── Member of the month - ONE fixed layout, deliberately not part of the
// random pool machinery above. "Zero possibility of breaking" per the brief:
// every text block is measured and shrunk/truncated to a hard box before it
// draws, so a very long name or a full-length citation degrades gracefully
// instead of overflowing the canvas - never a random template roll.

// Same overflow-safe technique as posterGenerator's fitSerif/fitHeadline
// (shrink until it fits `maxLines`, then hard-truncate the last line with an
// ellipsis) but in the fixed body face this template always uses, since
// fitHeadline's un-seeded path is pinned to the bold DISPLAY face only.
function fitBody(ctx: C2D, text: string, maxW: number, maxLines: number, start: number, min: number): { size: number; lines: string[] } {
  for (let s = start; s >= min; s -= 2) {
    ctx.font = `400 ${s}px ${EINA}`
    const lines = layoutLines(ctx, text, maxW)
    const widest = lines.reduce((m, ln) => Math.max(m, ctx.measureText(ln).width), 0)
    if (lines.length <= maxLines && widest <= maxW) return { size: s, lines }
  }
  ctx.font = `400 ${min}px ${EINA}`
  let lines = layoutLines(ctx, text, maxW)
  const dropped = lines.length > maxLines
  if (dropped) lines = lines.slice(0, maxLines)
  lines = lines.map((ln, idx) => {
    const isCutTail = dropped && idx === lines.length - 1
    if (ctx.measureText(ln).width <= maxW) return isCutTail ? ln.trimEnd() + '…' : ln
    let s = ln
    while (s.length > 0 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1).trimEnd()
    return s.trimEnd() + '…'
  })
  return { size: min, lines }
}

// Initials-on-a-colour placeholder for a member with no photo yet. Takes the
// slide's own muted accent directly (a flat neon ACCENTS block behind giant
// white initials read as a bright poster sticker, not a portrait stand-in) -
// callers with no accent of their own fall back to hashColor/ACCENTS, same
// as every other avatar placeholder in the app.
function drawMemberPlaceholder(ctx: C2D, x: number, y: number, w: number, h: number, name: string, accent?: string) {
  const bg = accent || hashColor(name || 'AquaTerra', ACCENTS)
  ctx.fillStyle = bg; ctx.fillRect(x, y, w, h)
  const fg = accent ? WHITE : inkTextOn(bg)
  ctx.font = `700 ${Math.round(Math.min(w, h) * 0.3)}px ${DISPLAY}`
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(getInitials(name), x + w / 2, y + h / 2)
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
}

// Member of the Month poster. Redesigned 2026-10-09 (report a86b0c13, "members of
// the month graphic looks horrible"). The old layout had four real faults: the
// name ran into the photo card's hard shadow, the team/period pills sat on top
// of the citation, the photo was a huge dull square, and the deck's muted
// category tone read as grey. This one is lemon, the colour of the in-app
// "member of the month" card, and every block is placed from the bottom of the
// one above it, so nothing can collide however long the name or citation is.
const LEMON_FLOOD = '#FFE94A'

function sMemberOfMonth(ctx: C2D, d: StoryData, img: HTMLImageElement | null) {
  const SIDE = 76, CX = W / 2
  ctx.fillStyle = LEMON_FLOOD; ctx.fillRect(0, 0, W, H)
  grid(ctx, W, H, 0.06, 84, '10,10,10')

  // Header: logo left, period pill right.
  logo(ctx, SIDE, 128, INK, 48, false)
  if (d.period) {
    ctx.font = `700 26px ${MONO}`
    const label = d.period.toUpperCase().slice(0, 24)
    const pw = ctx.measureText(label).width + 52
    rrect(ctx, W - SIDE - pw, 84, pw, 56, 28); ctx.fillStyle = INK; ctx.fill()
    ctx.fillStyle = LEMON_FLOOD; ctx.fillText(label, W - SIDE - pw + 26, 121)
  }

  // Headline.
  ctx.font = `900 96px ${DISPLAY}`; ctx.fillStyle = INK
  drawLines(ctx, ['MEMBER OF', 'THE MONTH'], SIDE, 290, 100)

  // Photo card: a square, slightly tilted, ink border, hard shadow. The tilt
  // and the shadow are drawn inside one transform so they stay together.
  const ps = 700, px = CX - ps / 2, py = 450
  ctx.save(); ctx.translate(CX, py + ps / 2); ctx.rotate(-0.035); ctx.translate(-CX, -(py + ps / 2))
  hardShadow(ctx, px, py, ps, ps, 26, INK, 16)
  rrect(ctx, px, py, ps, ps, 26); ctx.fillStyle = WHITE; ctx.fill()
  ctx.save(); rrect(ctx, px + 12, py + 12, ps - 24, ps - 24, 18); ctx.clip()
  if (img) drawCover(ctx, img, px + 12, py + 12, ps - 24, ps - 24, d.focal?.fx, d.focal?.fy)
  else drawMemberPlaceholder(ctx, px + 12, py + 12, ps - 24, ps - 24, d.memberName || 'Member', INK)
  ctx.restore()
  rrect(ctx, px, py, ps, ps, 26); ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke()
  ctx.restore()

  // Burst on the photo's top-right corner: pink, ink-outlined.
  star(ctx, px + ps - 20, py + 26, 112, INK, 1, 0.1)
  star(ctx, px + ps - 20, py + 26, 98, '#FF4D8C', 1, 0.1)
  ctx.font = `900 30px ${DISPLAY}`; ctx.fillStyle = WHITE; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('MoM', px + ps - 20, py + 28); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'

  // Name. Starts well below the photo's shadow (16px) and its tilt.
  const photoBottom = py + ps + 40
  const name = (d.memberName || 'AquaTerra member').slice(0, 120)
  const { size: nSize, lines: nLines, lhMul: nLhMul } = fitHeadline(ctx, name, W - SIDE * 2, 2, 100, 38)
  const nLh = nSize * 1.05 * nLhMul
  const nTop = photoBottom + 40 + nSize * 0.8
  ctx.font = `900 ${nSize}px ${DISPLAY}`; ctx.fillStyle = INK
  drawLines(ctx, nLines, CX, nTop, nLh, 'center')
  const nBottom = nTop + (nLines.length - 1) * nLh + nSize * 0.25

  // Team pill, centred under the name.
  let y = nBottom + 36
  if (d.teamName) {
    ctx.font = `700 28px ${MONO}`
    const label = d.teamName.toUpperCase().slice(0, 30)
    const pw = ctx.measureText(label).width + 56
    rrect(ctx, CX - pw / 2, y, pw, 60, 30); ctx.fillStyle = INK; ctx.fill()
    ctx.fillStyle = LEMON_FLOOD; ctx.textAlign = 'center'; ctx.fillText(label, CX, y + 40); ctx.textAlign = 'left'
    y += 60 + 40
  }

  // Citation card: white, ink border, hard shadow, sized to its text and held
  // above the footer. fitBody shrinks, then truncates, to the room that is left.
  const footerTop = H - 110
  const periodWords = d.period ? d.period.charAt(0) + d.period.slice(1).toLowerCase() : 'this month'
  const citation = (d.citation || '').trim() || `${d.teamName || 'AquaTerra'}'s pick for ${periodWords}.`
  const pad = 40, cardW = W - SIDE * 2 - 16
  const room = footerTop - 40 - y - pad * 2 - 16
  const maxCLines = Math.max(2, Math.min(6, Math.floor(room / 39)))
  const { size: cSize, lines: cLines } = fitBody(ctx, citation, cardW - pad * 2, maxCLines, 38, 26)
  const cLh = cSize * 1.45
  const cardH = Math.min(room + pad * 2, cLines.length * cLh + pad * 2 - (cLh - cSize))
  hardShadow(ctx, SIDE, y, cardW, cardH, 24, INK, 12)
  rrect(ctx, SIDE, y, cardW, cardH, 24); ctx.fillStyle = WHITE; ctx.fill()
  rrect(ctx, SIDE, y, cardW, cardH, 24); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke()
  ctx.font = `400 ${cSize}px ${EINA}`; ctx.fillStyle = INK
  drawLines(ctx, cLines, SIDE + pad, y + pad + cSize * 0.82, cLh)

  // Footer bar.
  ctx.fillStyle = INK; ctx.fillRect(0, footerTop, W, H - footerTop)
  ctx.font = `700 26px ${MONO}`; ctx.fillStyle = LEMON_FLOOD
  ctx.fillText('AQUATERRA', SIDE, footerTop + 66)
  ctx.font = `600 24px ${MONO}`; ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.textAlign = 'right'; ctx.fillText('student-run NGO  \u00b7  ngoaquaterra.com', W - SIDE, footerTop + 66); ctx.textAlign = 'left'
}

// ── Template pools ───────────────────────────────────────────────────────

const POST_TEMPLATES: ((c: PostCtx) => void)[] = [sImageFull, sCreamCard, sInkQuote, sPolaroidStory, sAccentFlood]
// Photo-dependent templates are excluded when there's no post image - picking
// them anyway would just render their (plainer) no-photo fallback.
const POST_TEMPLATES_NO_PHOTO: ((c: PostCtx) => void)[] = [sCreamCard, sInkQuote, sAccentFlood]
const OPENING_TEMPLATES: ((c: OpeningCtx) => void)[] = [oHeroDark, oCreamBoard, oAccentBanner, oPoster]

const POST_NAMES = new Map<(c: PostCtx) => void, string>([
  [sImageFull, 'Image Full'], [sCreamCard, 'Cream Card'], [sInkQuote, 'Ink Quote'],
  [sPolaroidStory, 'Polaroid'], [sAccentFlood, 'Accent Flood'],
])
const OPENING_NAMES = new Map<(c: OpeningCtx) => void, string>([
  [oHeroDark, 'Hero Dark'], [oCreamBoard, 'Cream Board'], [oAccentBanner, 'Accent Banner'], [oPoster, 'Poster'],
])

// Ordered name lists for a "choose a design" UI, one per story type - pass
// the list matching `storyData.type` since the two pools are unrelated.
export const STORY_POST_TEMPLATE_NAMES: string[] = POST_TEMPLATES.map(fn => POST_NAMES.get(fn)!)
export const STORY_OPENING_TEMPLATE_NAMES: string[] = OPENING_TEMPLATES.map(fn => OPENING_NAMES.get(fn)!)

// ── Public API ────────────────────────────────────────────────────────────

// Generate one story. `seed` makes the pick reproducible if supplied;
// `template` pins a specific named design instead of letting the pool roll
// one. Omit both (or pass a fresh seed) to get a brand-new design each call -
// this is what makes ShareModal's "regenerate" button actually do something.
export async function generateStory(data: StoryData, opts?: { seed?: number; template?: string; exclude?: string }): Promise<StoryResult> {
  await Promise.all([document.fonts?.ready ?? Promise.resolve(), loadLogo()])
  // No emojis on graphics - brand law. Strip once here rather than at every
  // template's text-drawing call site.
  const se = (s?: string | null): string | undefined => (s ? stripEmoji(s) : s ?? undefined)
  data = {
    ...data,
    title: se(data.title),
    body: se(data.body),
    description: se(data.description),
    openingTitle: se(data.openingTitle),
    teamName: se(data.teamName),
    memberName: se(data.memberName),
    citation: se(data.citation),
  }

  if (data.type === 'member_of_month') {
    const canvas0 = document.createElement('canvas'); canvas0.width = W; canvas0.height = H
    const ctx0 = canvas0.getContext('2d')!
    ctx0.imageSmoothingEnabled = true; ctx0.imageSmoothingQuality = 'high'
    ctx0.textBaseline = 'alphabetic'
    const img = data.imageUrl ? await loadImage(data.imageUrl) : null
    sMemberOfMonth(ctx0, data, img)
    let dataUrl: string
    try { dataUrl = canvas0.toDataURL('image/png') }
    catch { ctx0.clearRect(0, 0, W, H); sMemberOfMonth(ctx0, data, null); dataUrl = canvas0.toDataURL('image/png') }
    return { dataUrl, template: 'Member of the Month' }
  }

  const s = opts?.seed ?? Math.floor(Math.random() * 0xffffffff)
  const r = mulberry32(s)

  const accent = chance(r, 0.5)
    ? catColor(data.type === 'post' ? data.category : data.teamCategory)
    : pick(r, ACCENTS)
  const accent2 = pick(r, ACCENTS.filter((a: string) => a !== accent))

  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
  ctx.textBaseline = 'alphabetic'

  if (data.type === 'post') {
    const img = data.imageUrl ? await loadImage(data.imageUrl) : null
    const fullPool = img ? POST_TEMPLATES : POST_TEMPLATES_NO_PHOTO
    // Drop the last-used template so "regenerate" on a small (no-photo) pool
    // doesn't redraw the same design; fall back to the full pool if that empties it.
    const excluded = opts?.exclude ? fullPool.filter(fn => POST_NAMES.get(fn) !== opts.exclude) : fullPool
    const pool = excluded.length ? excluded : fullPool
    const template = (opts?.template && pool.find(fn => POST_NAMES.get(fn) === opts.template)) || pick(r, pool)
    template({ ctx, d: data, accent, accent2, r, img })

    let dataUrl: string
    try { dataUrl = canvas.toDataURL('image/png') }
    catch {
      // CORS-tainted photo - redraw without it and export clean.
      ctx.clearRect(0, 0, W, H)
      const r2 = mulberry32(s + 1)
      const fallback = pick(r2, POST_TEMPLATES_NO_PHOTO)
      fallback({ ctx, d: data, accent, accent2, r: r2, img: null })
      dataUrl = canvas.toDataURL('image/png')
      return { dataUrl, template: POST_NAMES.get(fallback) || 'Story' }
    }
    return { dataUrl, template: POST_NAMES.get(template) || 'Story' }
  }

  // Openings never touch a photo, so no CORS fallback path is needed.
  const openingExcluded = opts?.exclude ? OPENING_TEMPLATES.filter(fn => OPENING_NAMES.get(fn) !== opts.exclude) : OPENING_TEMPLATES
  const openingPool = openingExcluded.length ? openingExcluded : OPENING_TEMPLATES
  const template = (opts?.template && openingPool.find(fn => OPENING_NAMES.get(fn) === opts.template)) || pick(r, openingPool)
  template({ ctx, d: data, accent, accent2, r })
  const dataUrl = canvas.toDataURL('image/png')
  return { dataUrl, template: OPENING_NAMES.get(template) || 'Story' }
}

export function downloadStory(dataUrl: string, filename: string) {
  const a = document.createElement('a'); a.href = dataUrl; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
}
