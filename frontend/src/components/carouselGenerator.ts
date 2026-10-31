// ── AquaTerra project carousel generator ─────────────────────────────────────
// Turns one welfare project into a multi-slide Instagram carousel (1080×1350,
// 4:5) in the exact brand language of the poster studio - same palette, type,
// grid, stars, stickers and logo badge (all reused from posterGenerator's
// brandKit, nothing duplicated). A project yields a coherent deck: a cover, a
// "what we did" slide, an impact-stat slide, one slide per captioned photo, and
// a closing CTA. One seeded accent runs across every slide so the set reads as a
// single piece. "Regenerate" rolls a new seed → new accent + decoration.

import { zipSync } from 'fflate'
import { brandKit, type Rng } from './posterGenerator'

const {
  INK, WHITE, CREAM, DISPLAY, MONO,
  mulberry32, pick, rrange, chance,
  grid, star, rrect, fitHeadline, drawLines, logo, drawCover,
  decorate, darkBg, accentBg, creamBg, hardShadow, stripEmoji, loadImage, loadLogo,
} = brandKit

// The brand kit's loud, saturated ACCENTS (hot pink/lemon/grape - right for
// feed cards and posters) and a second, unrelated colour randomly paired
// with it as accent2 is exactly the "clashing colours" complaint - two
// competing hues plus a busy grid/tape/word-sticker treatment read as
// amateurish on a document meant to represent a specific project externally.
// One muted, desaturated accent per category, and accent2 derived as a
// lighter tint of the SAME hue rather than a second random colour, so a
// deck is monochromatic-with-depth instead of two-tone-clash.
const MUTED_CAT: Record<string, string> = {
  welfare: '#1B4332', events: '#1D3557', labs: '#7A5C00', operations: '#0F5257', content: '#4A3F6B',
}
const mutedCatColor = (c?: string) => MUTED_CAT[(c || '').toLowerCase()] || MUTED_CAT.welfare
function tint(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const mix = (c: number) => Math.round(c + (255 - c) * amount)
  return `#${[mix(r), mix(g), mix(b)].map(v => v.toString(16).padStart(2, '0')).join('')}`
}

// Matches the AQ brand kit's carousel spec - same canvas as a single post, not
// a separate 4:5 ratio.
const W = 1080, H = 1440

export interface CarouselImage { url: string; label?: string | null }
export interface CarouselProject {
  title: string
  location?: string | null
  keyStatistic?: string | null
  objective?: string | null
  shortSummary?: string | null
  longWriteup?: string | null
  collabName?: string | null
  volunteers?: number | null
  workshopDate?: string | null
  category?: string
  slug?: string
  mainImage?: string | null
  images?: CarouselImage[]
  focal?: { fx: number; fy: number } // 0–1 crop focal point for cover/photo slides; default center
}

export interface CarouselSlide { blob: Blob; url: string; kind: string }
export interface CarouselResult { slides: CarouselSlide[]; accent: string; seed: number; coverStyle: string }

// ── Small local helpers (carousel-specific chrome) ───────────────────────────

// A flat ink-outlined chip with a hard offset shadow - the deck's persistent
// chrome (progress dots, page counter) reads as one piece of print-native
// furniture, not a floating glass overlay. Brand law bans blur/translucency/
// glassmorphism outright (soft/glowing effects break AQ's flat cut-paper +
// hard-shadow depth language); this is the same "sticker/chip" vocabulary
// already used for word-boxes elsewhere in the deck, just at capsule scale.
function inkChip(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, onDark: boolean) {
  const r = h / 2
  hardShadow(ctx, x, y, w, h, r, INK, 4)
  rrect(ctx, x, y, w, h, r)
  ctx.fillStyle = onDark ? INK : CREAM; ctx.fill()
  ctx.strokeStyle = onDark ? 'rgba(255,255,255,0.35)' : INK
  ctx.lineWidth = 2; ctx.stroke()
}

// Tiny "01 / 06" page counter, bottom-left, on its own flat ink chip.
function pageTag(ctx: CanvasRenderingContext2D, i: number, total: number, color: string) {
  const onDark = color.includes('255,255,255')
  ctx.save()
  ctx.font = `700 22px ${MONO}`
  const s = `${String(i + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`
  const tw = ctx.measureText(s).width
  inkChip(ctx, 72 - 14, H - 60 - 23, tw + 28, 34, onDark)
  ctx.fillStyle = color; ctx.globalAlpha = 0.95
  ctx.fillText(s, 72, H - 60)
  ctx.restore()
}

// Progress dots across the top, on a flat ink chip, so the deck reads as a set.
function progressDots(ctx: CanvasRenderingContext2D, i: number, total: number, accent: string, onDark: boolean) {
  const gap = 22, d = 9, totalW = (total - 1) * gap
  const startX = W / 2 - totalW / 2, y = 64
  const padX = 20, capH = 30
  inkChip(ctx, startX - d / 2 - padX, y - capH / 2, totalW + d + padX * 2, capH, onDark)
  for (let k = 0; k < total; k++) {
    ctx.beginPath(); ctx.arc(startX + k * gap, y, d / 2, 0, Math.PI * 2)
    if (k === i) { ctx.fillStyle = accent; ctx.fill() }
    else { ctx.fillStyle = onDark ? 'rgba(255,255,255,0.4)' : 'rgba(10,10,10,0.32)'; ctx.fill() }
  }
}

// "swipe →" nudge, bottom-right of the cover.
function swipeHint(ctx: CanvasRenderingContext2D, color: string) {
  ctx.save()
  ctx.font = `700 24px ${MONO}`; ctx.fillStyle = color
  const label = 'swipe →'
  const w = ctx.measureText(label).width
  ctx.fillText(label, W - 72 - w, H - 58)
  ctx.restore()
}

// Bottom scrim so white type stays legible over any photo.
// Bottom scrim anchored to where a text block actually begins, instead of a
// fixed viewport fraction. A fixed-fraction scrim stays mostly transparent
// near its own top edge, so a long multi-line headline/caption starts inside
// a still-see-through zone and reads as text sitting directly on a busy
// photo rather than on a legible dark scrim - worse the longer the text
// runs. Anchoring the gradient's dark ramp to the text block's top (with a
// cushion) keeps it legible at any text length while still showing the
// photo through above short text.
//
// Floored at 48% of the frame regardless of text length: text call sites are
// themselves capped to a small line budget (see fitHeadline calls below), so
// this floor is a last-resort guard rather than the normal case - it exists
// so one long, unlucky title/caption can't ever black out most of the photo.
// That's the actual point of a photo carousel - the picture stays the lead
// element, the scrim is just there to keep type readable, not to compete.
function textScrim(ctx: CanvasRenderingContext2D, textTop: number, maxOpacity = 0.82) {
  const cushion = 90
  const gradTop = Math.max(H * 0.48, Math.max(0, textTop - cushion))
  const span = Math.max(1, H - gradTop)
  const g = ctx.createLinearGradient(0, gradTop, 0, H)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(Math.min(0.4, cushion / span), `rgba(0,0,0,${(maxOpacity * 0.7).toFixed(2)})`)
  g.addColorStop(1, `rgba(0,0,0,${maxOpacity})`)
  ctx.fillStyle = g
  ctx.fillRect(0, gradTop, W, span)
}

function topBottomBars(ctx: CanvasRenderingContext2D, accent: string, accent2: string) {
  ctx.fillStyle = accent; ctx.fillRect(0, 0, W, 12)
  ctx.fillStyle = accent2; ctx.fillRect(0, H - 12, W, 12)
}

// Mono kicker label (e.g. "WHAT WE DID").
function kicker(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, accent: string) {
  ctx.font = `700 26px ${MONO}`; ctx.fillStyle = accent
  ctx.fillText(text.toUpperCase(), x, y)
}

// Washi-tape strip - translucent, rotated, faint outline.
function tape(ctx: CanvasRenderingContext2D, cx: number, cy: number, rot: number, color: string) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot)
  ctx.globalAlpha = 0.62; ctx.fillStyle = color; ctx.fillRect(-56, -17, 112, 34)
  ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = 1.5; ctx.strokeRect(-56, -17, 112, 34)
  ctx.restore()
}

// ── Decorative vocabulary ────────────────────────────────────────────────────
// Every slide used to reach for the same starburst in whichever corner was
// empty - recognisable, but repeated across every deck it starts reading as
// "the AI generator's sparkle" rather than a specific design choice. These
// give the same "fill this quiet corner" job three genuinely different
// silhouettes; flourish() rolls between them so a deck's decorative accents
// vary slide to slide instead of being visibly the same shape recoloured.

// Halftone dot cluster - a scattered screen-print texture patch. Reads as
// printed matter, not a UI sparkle.
function dotCluster(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, color: string, r: Rng) {
  const n = 22
  ctx.save()
  for (let k = 0; k < n; k++) {
    const ang = rrange(r, 0, Math.PI * 2)
    const rad = Math.sqrt(rrange(r, 0, 1)) * radius
    const x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad
    const size = rrange(r, 2.5, 7) * (1 - (rad / radius) * 0.55)
    ctx.globalAlpha = rrange(r, 0.22, 0.55)
    ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2)
    ctx.fillStyle = color; ctx.fill()
  }
  ctx.restore()
}

// Bold photographic crop-mark bracket - an editorial accent, not a shape.
function cornerBracket(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, corner: 'tl' | 'tr' | 'bl' | 'br') {
  ctx.save()
  ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.lineCap = 'square'
  ctx.beginPath()
  if (corner === 'tl') { ctx.moveTo(x, y + size); ctx.lineTo(x, y); ctx.lineTo(x + size, y) }
  if (corner === 'tr') { ctx.moveTo(x - size, y); ctx.lineTo(x, y); ctx.lineTo(x, y + size) }
  if (corner === 'bl') { ctx.moveTo(x, y - size); ctx.lineTo(x, y); ctx.lineTo(x + size, y) }
  if (corner === 'br') { ctx.moveTo(x - size, y); ctx.lineTo(x, y); ctx.lineTo(x, y - size) }
  ctx.stroke()
  ctx.restore()
}

// Shared "fill this quiet corner" picker - rolls between the starburst
// (still the signature mark, so weighted heaviest) and the two alternatives
// above. Swap star() for flourish() at the generic decorative placements
// (not the ones precisely tucked beside a taped photo frame, which stay put).
function flourish(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, r: Rng, alpha = 0.7) {
  const kind = pick(r, ['star', 'star', 'dots', 'bracket'] as const)
  if (kind === 'star') star(ctx, x, y, size, color, alpha, rrange(r, -0.3, 0.3))
  else if (kind === 'dots') dotCluster(ctx, x, y, size * 0.75, color, r)
  else cornerBracket(ctx, x, y, size * 0.5, color, pick(r, ['tl', 'tr', 'bl', 'br'] as const))
}

// ── Slides ───────────────────────────────────────────────────────────────────

type SlideCtx = {
  ctx: CanvasRenderingContext2D; p: CarouselProject; accent: string; accent2: string
  r: Rng; i: number; total: number
}

// COVER - main photo full-bleed, duotone-tinted, a photo taped to the paper,
// or (no photo) cream type. Cream/paper is the lead surface per brand law;
// the photo paths are the ones that go dark (they need the scrim for legible
// white type over a real image). `coverStyle` pins a specific sub-look
// (from the studio's design picker) instead of letting it roll.
function slideCover({ ctx, p, accent, accent2, r, i, total }: SlideCtx, img: HTMLImageElement | null, coverStyle?: string) {
  const validStyles = img ? ['taped', 'fullBleed', 'duotone'] : ['cream']
  let picked = coverStyle && validStyles.includes(coverStyle) ? coverStyle : null
  if (!picked) {
    if (!img) picked = 'cream'
    else { const m = r(); picked = m < 0.35 ? 'taped' : m < 0.68 ? 'fullBleed' : 'duotone' }
  }
  const taped = picked === 'taped'
  const fullBleed = picked === 'fullBleed'
  const duotone = picked === 'duotone'
  const fg = (fullBleed || duotone) ? WHITE : INK

  // Measure the title block up front - the scrim below needs to know where
  // the text actually starts so it can guarantee legibility regardless of
  // title length, instead of a fixed-fraction scrim that stays too faint
  // near its own top edge for long, multi-line titles. Cropped to a
  // headline-length statement (not the full project title) and capped at 3
  // lines - a cover is meant to be a punchy title card over the photo, not a
  // paragraph; the old 5-line/116px budget could eat well over half the
  // image on a long title.
  const title = extractHeadline(p.title || 'AquaTerra project', 72)
  let { lines, font, lhMul, size } = fitHeadline(ctx, title, W - 150, 3, 88, 46, r)
  let lh = size * 1.04 * lhMul
  let blockH = lines.length * lh
  let top = H - 230 - blockH

  if (taped) {
    // TAPED scrapbook cover - the photo in a tilted, taped frame on paper.
    // The title used to share the same bottom-anchored fit as the full-bleed
    // styles, sized for filling the whole 1440px canvas - but taped only
    // leaves the paper strip below the frame for it, so a 3-line title could
    // run up under the frame's corner and visually collide with it. Refit to
    // a smaller budget that actually matches the space below the frame.
    creamBg(ctx, W, H)
    const fw = W * 0.7, fh = fw * 0.8, pad = 24
    const fx = (W - fw) / 2, fy = H * 0.17
    ctx.save()
    ctx.translate(fx + fw / 2, fy + fh / 2); ctx.rotate(rrange(r, -0.05, 0.05)); ctx.translate(-(fx + fw / 2), -(fy + fh / 2))
    hardShadow(ctx, fx, fy, fw, fh + 50, 10, INK, 10)
    rrect(ctx, fx, fy, fw, fh + 50, 10); ctx.fillStyle = WHITE; ctx.fill()
    drawCover(ctx, img!, fx + pad, fy + pad, fw - pad * 2, fh - pad)
    tape(ctx, fx + 44, fy + 2, -0.5, accent); tape(ctx, fx + fw - 44, fy + 2, 0.5, accent2)
    ctx.restore()
    star(ctx, W - 116, fy + fh + 30, rrange(r, 46, 60), accent, 0.85, rrange(r, -0.3, 0.3))

    const frameBottom = fy + fh + 50 + 10 // + hard-shadow offset
    const refit = fitHeadline(ctx, title, W - 150, 2, 60, 38, r)
    lines = refit.lines; font = refit.font; lhMul = refit.lhMul; size = refit.size
    lh = size * 1.04 * lhMul
    blockH = lines.length * lh
    top = Math.max(H - 230 - blockH, frameBottom + 56)
  } else if (fullBleed) {
    drawCover(ctx, img!, 0, 0, W, H, p.focal?.fx, p.focal?.fy)
    // top scrim for the logo + kicker
    const tg = ctx.createLinearGradient(0, 0, 0, H * 0.28)
    tg.addColorStop(0, 'rgba(0,0,0,0.62)'); tg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = tg; ctx.fillRect(0, 0, W, H * 0.28)
    textScrim(ctx, top)
  } else if (duotone) {
    // Lighter wash than before - this used to flatten the whole photo under a
    // 42% black fill plus a 50% accent overlay-blend before the bottom scrim
    // even ran, which left almost no true photo tone visible anywhere on the
    // frame. Toned down so the tint reads as a color grade over a photo,
    // not a nearly-opaque color card with a photo underneath it.
    drawCover(ctx, img!, 0, 0, W, H, p.focal?.fx, p.focal?.fy)
    ctx.fillStyle = 'rgba(10,10,10,0.22)'; ctx.fillRect(0, 0, W, H)
    ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.28; ctx.fillStyle = accent; ctx.fillRect(0, 0, W, H); ctx.restore()
    textScrim(ctx, top)
  } else {
    creamBg(ctx, W, H)
    flourish(ctx, W - 120, H * 0.24, rrange(r, 120, 170), accent, r, 0.14)
    decorate(ctx, W, H, r, accent, false)
  }
  const onPhoto = fullBleed || duotone
  topBottomBars(ctx, accent, accent2)
  logo(ctx, 72, 120, accent, 50, !onPhoto, onPhoto ? 'photo' : undefined)
  kicker(ctx, p.category === 'welfare' ? 'WELFARE PROJECT' : (p.category || 'AQUATERRA'), 76, 188, accent)

  // Title block, bottom-anchored (layout already measured above).
  ctx.font = font; ctx.fillStyle = fg
  drawLines(ctx, lines, 76, top, lh)
  ctx.fillStyle = accent; ctx.fillRect(76, top + blockH + 22, 130, 10)
  ctx.fillStyle = accent2; ctx.fillRect(76 + 142, top + blockH + 22, 42, 10)

  // Location + date row.
  const meta = [p.location, p.workshopDate].filter(Boolean).join('  ·  ')
  if (meta) {
    ctx.font = `700 26px ${MONO}`; ctx.fillStyle = onPhoto ? 'rgba(255,255,255,0.82)' : 'rgba(10,10,10,0.62)'
    ctx.fillText(ellipsize(ctx, meta.toUpperCase(), W - 150), 76, top + blockH + 78)
  }
  progressDots(ctx, i, total, accent, onPhoto)
  swipeHint(ctx, accent)
}

// Pull a punchy, poster-length headline out of a longer paragraph - the
// first sentence if it's a reasonable length, else the longest whole-word
// prefix that fits. This is the difference between "a confident cropped
// statement" and "an arbitrary mid-sentence word count cutoff".
function extractHeadline(text: string, maxChars = 90): string {
  const cleaned = text.trim()
  const firstSentence = cleaned.match(/^[^.!?\n]+[.!?]?/)
  let candidate = (firstSentence ? firstSentence[0] : cleaned).trim()
  if (candidate.length > maxChars) {
    candidate = candidate.slice(0, maxChars).replace(/\s+\S*$/, '').trim()
  }
  return candidate.replace(/[.,;:!?]+$/, '')
}

// TEXT - the deck's one statement beat. Used to roll between a calm tilted
// card and a "RANSOM" mode (mixed fonts, random cut-out colours from the
// full loud ACCENTS array, washi tape) that was the single biggest source
// of the "clashing colours / cluttered / amateurish" complaint - found by
// actually rendering one and seeing an unrelated hot-pink/lemon/grape word
// stack next to a tape-taped card two slides later. The card layout is now
// the only one: same deck accent throughout, no tape, no random per-word
// colour, no mixed fonts.
function slideText({ ctx, accent, accent2, r, i, total }: SlideCtx, head: string, body: string) {
  creamBg(ctx, W, H)
  topBottomBars(ctx, accent, accent2)
  logo(ctx, 72, 120, accent, 50, true)

  const headline = extractHeadline(body || '', 90)

  // A tilted card with washi tape again - now safe to bring back: accent2 is
  // a lighter TINT of the same deck accent (not a second random colour from
  // the old ACCENTS grab-bag), so the tape can't clash with anything else on
  // the slide the way it used to.
  const cw = W - 176, ch = H - 560, cx = 88, cy = 300
  ctx.save()
  ctx.translate(cx + cw / 2, cy + ch / 2); ctx.rotate(rrange(r, -0.025, 0.025)); ctx.translate(-(cx + cw / 2), -(cy + ch / 2))
  hardShadow(ctx, cx, cy, cw, ch, 14, INK, 10)
  rrect(ctx, cx, cy, cw, ch, 14); ctx.fillStyle = WHITE; ctx.fill()
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke()
  tape(ctx, cx + 60, cy + 4, -0.4, accent2); tape(ctx, cx + cw - 60, cy + 4, 0.4, accent2)

  ctx.font = `700 24px ${MONO}`; ctx.fillStyle = accent
  ctx.fillText(head.toUpperCase(), cx + 44, cy + 68)
  ctx.fillStyle = accent; ctx.fillRect(cx + 44, cy + 84, 56, 6)

  const { lines, font, lhMul, size } = fitHeadline(ctx, headline, cw - 88, 5, 68, 38, r)
  const lh = size * 1.16 * lhMul
  ctx.font = font; ctx.fillStyle = INK
  // A short objective (a project write-up can be as terse as two words)
  // fits in one line at max size and top-anchoring it left most of this
  // tall card looking blank underneath - found live, reported as "is this
  // supposed to be blank?". Centre the headline block in the remaining
  // card height below the kicker instead of always starting at a fixed
  // offset, so a short statement still reads as a deliberate composition.
  const textTop = cy + 84
  const textBottom = cy + ch - 44
  const blockH = (lines.length - 1) * lh + size
  const headlineY = Math.max(textTop + size, textTop + size + (textBottom - textTop - blockH) / 2)
  drawLines(ctx, lines, cx + 44, headlineY, lh)
  ctx.restore()
  flourish(ctx, W - 100, cy - 30, rrange(r, 46, 64), accent, r, 0.85)

  progressDots(ctx, i, total, accent, false)
  pageTag(ctx, i, total, 'rgba(10,10,10,0.55)')
}

// STAT - the "impact" beat. Three layouts on a roll so a deck with more than
// one stat (or several projects posted back to back) doesn't repeat the
// identical composition every time: a bright accent flood, a dark field with
// the number boxed in an offset outlined card, or - the calmer, cream-paper
// option that used to be missing entirely - the number directly on paper.
function slideStat({ ctx, accent, accent2, r, i, total }: SlideCtx, stat: string, sub: string) {
  const roll = r()
  const mode: 'dark' | 'flood' | 'cream' = roll < 0.33 ? 'dark' : roll < 0.66 ? 'flood' : 'cream'
  const ink = mode === 'dark' ? WHITE : INK
  const big = (stat || '').slice(0, 22)

  if (mode === 'dark') {
    darkBg(ctx, W, H, accent, r); grid(ctx, W, H, 0.04)
    flourish(ctx, 120, H * 0.82, rrange(r, 90, 140), accent, r, 0.16)
  } else if (mode === 'flood') {
    accentBg(ctx, W, H, accent, accent2, r)
    flourish(ctx, W * rrange(r, 0.72, 0.9), H * rrange(r, 0.18, 0.3), rrange(r, 240, 320), INK, r, 0.06)
  } else {
    creamBg(ctx, W, H)
    flourish(ctx, W - 130, H * 0.22, rrange(r, 100, 150), accent, r, 0.14)
  }
  ctx.fillStyle = ink; ctx.fillRect(0, 0, W, 14); ctx.fillRect(0, H - 14, W, 14)
  // Dark and flood both count as "dark/colored" per brand law and want the
  // cream pill; only genuine cream paper skips it.
  logo(ctx, 72, 120, accent, 50, mode === 'cream')
  kicker(ctx, 'BY THE NUMBERS', 76, 250, mode === 'dark' ? accent : INK)

  if (big) {
    if (mode === 'dark') {
      // Boxed card - the number offset in an outlined frame rather than
      // flooding the whole canvas, a calmer, more editorial beat.
      const boxY = 360, boxH = 420
      rrect(ctx, 76, boxY, W - 152, boxH, 18)
      ctx.strokeStyle = accent; ctx.lineWidth = 4; ctx.stroke()
      let bs = 220
      ctx.font = `900 ${bs}px ${DISPLAY}`
      while (ctx.measureText(big).width > W - 152 - 88 && bs > 44) { bs -= 8; ctx.font = `900 ${bs}px ${DISPLAY}` }
      ctx.fillStyle = WHITE
      const by = boxY + 60 + bs * 0.72
      ctx.fillText(big, 120, by)

      if (sub) {
        ctx.font = `700 30px ${DISPLAY}`; ctx.fillStyle = accent
        const capTop = by + 56, availH = (boxY + boxH - 40) - capTop
        const maxCapLines = Math.max(1, Math.floor(availH / 38))
        const subLines = wrap(ctx, sub.toUpperCase(), W - 152 - 88, maxCapLines)
        subLines.forEach((ln, k) => ctx.fillText(ln, 120, capTop + k * 38))
      }
    } else if (mode === 'cream') {
      // Calm, restrained: the number directly on paper, a thin accent rule,
      // no box - the deck's quietest beat.
      let bs = 260
      ctx.font = `900 ${bs}px ${DISPLAY}`
      while (ctx.measureText(big).width > W - 150 && bs > 44) { bs -= 8; ctx.font = `900 ${bs}px ${DISPLAY}` }
      ctx.fillStyle = INK
      const by = H / 2 + bs * 0.18
      ctx.fillText(big, 76, by)
      ctx.fillStyle = accent; ctx.fillRect(76, by + 26, 120, 8)

      if (sub) {
        ctx.font = `800 34px ${DISPLAY}`; ctx.fillStyle = 'rgba(10,10,10,0.68)'
        const capTop = by + 70, availH = (H - 150) - capTop
        const maxCapLines = Math.max(2, Math.floor(availH / 44))
        const subLines = wrap(ctx, sub.toUpperCase(), W - 150, maxCapLines)
        subLines.forEach((ln, k) => ctx.fillText(ln, 76, capTop + k * 44))
      }
    } else {
      // The number, as large as it fits - shrink to the width, no hard floor
      // that would let it overflow the canvas.
      let bs = 280
      ctx.font = `900 ${bs}px ${DISPLAY}`
      while (ctx.measureText(big).width > W - 150 && bs > 44) { bs -= 8; ctx.font = `900 ${bs}px ${DISPLAY}` }
      ctx.fillStyle = INK
      const by = H / 2 + bs * 0.18
      ctx.fillText(big, 76, by)

      // Caption beneath the number. Most real stats are a full sentence ("100
      // toffees were distributed to passerbys and..."), not a short label -
      // so give it however many lines actually fit above the page tag instead
      // of a blind 2-line cap that chopped real sentences off mid-word.
      if (sub) {
        ctx.font = `800 38px ${DISPLAY}`; ctx.fillStyle = INK; ctx.globalAlpha = 0.78
        const capTop = by + 70, availH = (H - 150) - capTop
        const maxCapLines = Math.max(2, Math.floor(availH / 46))
        const subLines = wrap(ctx, sub.toUpperCase(), W - 150, maxCapLines)
        subLines.forEach((ln, k) => ctx.fillText(ln, 76, capTop + k * 46))
        ctx.globalAlpha = 1
      }
    }
  } else if (sub) {
    // No numeric value - render the whole stat as a wrapped headline instead
    // of a truncated fake "number".
    const { lines, font, lhMul, size } = fitHeadline(ctx, sub, W - 150, 5, 96, 44, r)
    const lh = size * 1.08 * lhMul
    const top = H / 2 - (lines.length * lh) / 2
    ctx.font = font; ctx.fillStyle = ink
    drawLines(ctx, lines, 76, top, lh)
  }
  progressDots(ctx, i, total, mode === 'dark' ? accent : INK, mode === 'dark')
  pageTag(ctx, i, total, mode === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(10,10,10,0.55)')
}

// PHOTO - captioned full-bleed image with a label chip, a tilted taped
// polaroid on cream, or a fixed print-poster "framed" inset - three
// genuinely distinct silhouettes (moody/full-bleed, loose/scrapbook,
// structured/geometric) so a multi-photo deck never repeats the identical
// composition twice in a row.
function slidePhoto({ ctx, p, accent, accent2, r, i, total }: SlideCtx, img: HTMLImageElement | null, label: string | null) {
  const mode: 'fullBleed' | 'polaroid' | 'framed' = !img ? 'fullBleed' : pick(r, ['fullBleed', 'fullBleed', 'polaroid', 'framed'] as const)

  if (mode === 'framed') {
    // FRAMED - fixed (non-tilted) photo inset with a solid accent-colored
    // colophon bar along the bottom holding the logo + caption, print-poster
    // style. Deliberately square and structured next to the loose taped
    // polaroid and the moody full-bleed-with-scrim below.
    creamBg(ctx, W, H)
    // Measure the caption BEFORE sizing the colophon bar, and size the bar to
    // what it actually needs to hold. The page-tag chip is always drawn near
    // the very bottom of the canvas (H - 83..H - 49) regardless of bar
    // height - a fixed bar height with a 2-line caption could previously push
    // the caption's second line down far enough to overlap that chip. Growing
    // the bar with the measured line count guarantees clearance every time,
    // and a captionless photo still gets the small bar back (just the logo).
    // 172 is the floor even with no caption - anything shorter puts the logo
    // badge at the same height as the page-tag chip (always drawn near
    // H - 83..H - 49), which collide the same way a too-tall caption would.
    const margin = 96
    let capLines: string[] = [], capFont = '', capLh = 0, capSize = 0, barH = 172
    if (label) {
      const text = label.slice(0, 80)
      const fit = fitHeadline(ctx, text, W - 150, 2, 40, 28, r)
      capLines = fit.lines; capFont = fit.font; capSize = fit.size; capLh = capSize * 1.14 * fit.lhMul
      barH = 228 + (capLines.length - 1) * capLh + capSize * 0.3
    }
    const fx = margin, fy = margin, fw = W - margin * 2, fh = H - margin - barH - margin
    drawCover(ctx, img!, fx, fy, fw, fh)
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(fx, fy, fw, fh)
    if (chance(r, 0.35)) cornerBracket(ctx, fx + fw - 4, fy + 4, 46, WHITE, 'tr')

    ctx.fillStyle = accent; ctx.fillRect(0, H - barH, W, barH)
    logo(ctx, 72, H - barH + 68, accent, 44, false)

    if (capLines.length) {
      ctx.font = capFont; ctx.fillStyle = INK
      drawLines(ctx, capLines, 76, H - barH + 128, capLh)
    }
    progressDots(ctx, i, total, INK, false)
    pageTag(ctx, i, total, 'rgba(10,10,10,0.6)')
    return
  }

  if (mode === 'polaroid') {
    creamBg(ctx, W, H)
    topBottomBars(ctx, accent, accent2)
    logo(ctx, 72, 120, accent, 50, true)
    const fw = W * 0.74, fh = fw * 0.86, pad = 30
    const fx = (W - fw) / 2, fy = H * 0.16
    ctx.save()
    ctx.translate(fx + fw / 2, fy + (fh + pad * 2) / 2); ctx.rotate(rrange(r, -0.05, 0.05)); ctx.translate(-(fx + fw / 2), -(fy + (fh + pad * 2) / 2))
    hardShadow(ctx, fx, fy, fw, fh + pad * 2 + 40, 12, INK, 10)
    rrect(ctx, fx, fy, fw, fh + pad * 2 + 40, 12); ctx.fillStyle = WHITE; ctx.fill()
    drawCover(ctx, img!, fx + pad, fy + pad, fw - pad * 2, fh)
    ctx.restore()
    if (chance(r, 0.45)) star(ctx, W - 110, fy - 10, rrange(r, 40, 56), accent, 0.85, rrange(r, -0.3, 0.3))

    if (label) {
      const text = label.slice(0, 90)
      const top = fy + fh + pad * 2 + 100
      const { lines, font, lhMul, size } = fitHeadline(ctx, text, W - 160, 2, 48, 32, r)
      const lh = size * 1.14 * lhMul
      ctx.font = font; ctx.fillStyle = INK
      drawLines(ctx, lines, 80, top, lh)
    }
    progressDots(ctx, i, total, accent, false)
    pageTag(ctx, i, total, 'rgba(10,10,10,0.55)')
    return
  }

  // Measure the caption block up front (if any) so the scrim under it can be
  // anchored to where the text actually starts, same fix as slideCover.
  // Capped smaller and shorter than before (2 lines / 56px max, not 3 / 72px)
  // - a caption's job is a quiet label under the photo, not a second
  // headline competing with the image for attention.
  let capLines: string[] = [], capFont = '', capLh = 0, capTop = 0, capSize = 0
  if (label) {
    const text = label.slice(0, 100)
    const { lines, font, lhMul, size } = fitHeadline(ctx, text, W - 150, 2, 56, 34, r)
    capLines = lines; capFont = font; capLh = size * 1.12 * lhMul; capSize = size
    capTop = H - 150 - capLines.length * capLh
  }

  // No caption → no scrim. The logo and page-tag/progress-dot chips already
  // carry their own solid background (see inkChip), so a captionless photo
  // slide doesn't need a dark wash for legibility - it can just be the photo.
  if (img) { drawCover(ctx, img, 0, 0, W, H, p.focal?.fx, p.focal?.fy); if (label) textScrim(ctx, capTop) }
  else { creamBg(ctx, W, H); decorate(ctx, W, H, r, accent, false) }
  topBottomBars(ctx, accent, accent2)
  logo(ctx, 72, 120, accent, 50, !img, img ? 'photo' : undefined)

  if (label) {
    ctx.font = capFont; ctx.fillStyle = img ? WHITE : INK
    drawLines(ctx, capLines, 76, capTop, capLh)
    ctx.fillStyle = accent; ctx.fillRect(76, capTop - capSize - 14, 90, 9)
  }
  progressDots(ctx, i, total, accent, !!img)
  pageTag(ctx, i, total, img ? 'rgba(255,255,255,0.7)' : 'rgba(10,10,10,0.55)')
}

export interface FactItem { label: string; value: string }

// Pull whatever concrete facts a project actually has into small label/value
// pairs. A project can be thin on free-text (no write-up, no stat) and still
// carry plenty of real information - where, when, what kind, how many people,
// who with. Used to build a real designed beat instead of an empty one.
function buildFacts(p: CarouselProject): FactItem[] {
  const facts: FactItem[] = []
  if (p.location) facts.push({ label: 'Where', value: p.location })
  if (p.workshopDate) facts.push({ label: 'When', value: p.workshopDate })
  if (p.objective) facts.push({ label: 'Type', value: p.objective })
  if (p.volunteers && p.volunteers > 0) facts.push({ label: 'Volunteers', value: String(p.volunteers) })
  if (p.collabName) facts.push({ label: 'With', value: p.collabName })
  return facts
}

// FACTS - "at a glance": title + whatever real facts the project has, laid
// out as a designed list/chip-row. This is what a sparse project (no
// write-up, no stat, one or no photos) gets instead of a lone slide that just
// echoed the title back at a giant size - a project's location, date,
// category and volunteer count are real content, not filler. Two moods on a
// roll so it doesn't become its own new repeated template.
function slideFacts({ ctx, p, accent, accent2, r, i, total }: SlideCtx, facts: FactItem[]) {
  const mode: 'board' | 'ticket' = chance(r, 0.5) ? 'board' : 'ticket'
  const title = (p.title || 'AquaTerra project').slice(0, 90)

  if (mode === 'board') {
    // A dark info-board - title up top, facts as a numbered-tab list below.
    darkBg(ctx, W, H, accent, r); grid(ctx, W, H, 0.045)
    topBottomBars(ctx, accent, accent2)
    logo(ctx, 72, 120, accent, 50, false)
    kicker(ctx, 'AT A GLANCE', 76, 250, accent)
    const { lines, font, lhMul, size } = fitHeadline(ctx, title, W - 150, 3, 72, 40, r)
    const lh = size * 1.08 * lhMul
    ctx.font = font; ctx.fillStyle = WHITE
    drawLines(ctx, lines, 76, 320, lh)
    let y = 320 + lines.length * lh + 76
    facts.slice(0, 4).forEach(f => {
      ctx.fillStyle = accent; ctx.fillRect(76, y - 30, 8, 38)
      ctx.font = `700 22px ${MONO}`; ctx.fillStyle = accent
      ctx.fillText(f.label.toUpperCase(), 100, y - 8)
      ctx.font = `800 36px ${DISPLAY}`; ctx.fillStyle = WHITE
      ctx.fillText(ellipsize(ctx, f.value, W - 176), 100, y + 30)
      y += 88
    })
    if (chance(r, 0.55)) cornerBracket(ctx, W - 76, H - 200, 60, accent, 'br')
    progressDots(ctx, i, total, accent, true)
    pageTag(ctx, i, total, 'rgba(255,255,255,0.6)')
  } else {
    // A cream "ticket" - title, then facts as wrapped mono chips.
    creamBg(ctx, W, H)
    topBottomBars(ctx, accent, accent2)
    logo(ctx, 72, 120, accent, 50, true)
    kicker(ctx, 'AT A GLANCE', 76, 250, accent)
    const { lines, font, lhMul, size } = fitHeadline(ctx, title, W - 150, 3, 72, 40, r)
    const lh = size * 1.08 * lhMul
    ctx.font = font; ctx.fillStyle = INK
    drawLines(ctx, lines, 76, 320, lh)
    let x = 76, y = 320 + lines.length * lh + 66
    facts.slice(0, 5).forEach(f => {
      const label = `${f.label}: ${f.value}`.toUpperCase().slice(0, 40)
      ctx.font = `700 22px ${MONO}`
      const tw = ctx.measureText(label).width, padX = 18, chipW = tw + padX * 2, chipH = 46
      if (x + chipW > W - 76) { x = 76; y += chipH + 14 }
      rrect(ctx, x, y, chipW, chipH, chipH / 2)
      ctx.fillStyle = accent; ctx.fill()
      ctx.fillStyle = INK; ctx.fillText(label, x + padX, y + 30)
      x += chipW + 14
    })
    if (chance(r, 0.5)) flourish(ctx, W - 110, H - 250, rrange(r, 60, 90), accent2, r, 0.7)
    progressDots(ctx, i, total, accent, false)
    pageTag(ctx, i, total, 'rgba(10,10,10,0.55)')
  }
}

// NUMBERS - "by the numbers": up to three of the project's hard figures stacked
// as big value/label pairs. Gives a photo-less deck a bold non-text beat so it
// doesn't read as a wall of paragraphs. Two moods on a roll so it doesn't become
// its own repeated template.
function slideNumbers({ ctx, accent, accent2, r, i, total }: SlideCtx, numbers: FactItem[]) {
  const nums = numbers.slice(0, 3)
  const dark = chance(r, 0.55)
  if (dark) { darkBg(ctx, W, H, accent, r); grid(ctx, W, H, 0.05) }
  else { creamBg(ctx, W, H); decorate(ctx, W, H, r, accent, false) }
  topBottomBars(ctx, accent, accent2)
  logo(ctx, 72, 120, accent, 50, !dark)
  kicker(ctx, 'BY THE NUMBERS', 76, 250, accent)

  const fg = dark ? WHITE : INK
  const sub = dark ? 'rgba(255,255,255,0.6)' : 'rgba(10,10,10,0.55)'
  // Evenly space the stacked figures down the body of the slide.
  const top = 380, bottom = H - 300
  const step = (bottom - top) / nums.length
  nums.forEach((n, k) => {
    const y = top + step * k
    ctx.fillStyle = accent; ctx.fillRect(76, y - 4, 90, 9)
    // Value - shrink to fit the width so a long stat/date never bleeds.
    let vs = 132; ctx.font = `900 ${vs}px ${DISPLAY}`
    while (ctx.measureText(n.value).width > W - 152 && vs > 56) { vs -= 6; ctx.font = `900 ${vs}px ${DISPLAY}` }
    ctx.fillStyle = fg; ctx.fillText(n.value, 76, y + vs * 0.78)
    if (n.label) {
      ctx.font = `700 30px ${MONO}`; ctx.fillStyle = sub
      ctx.fillText(n.label.toUpperCase().slice(0, 40), 78, y + vs * 0.78 + 46)
    }
  })
  progressDots(ctx, i, total, dark ? accent : INK, dark)
  pageTag(ctx, i, total, dark ? 'rgba(255,255,255,0.6)' : 'rgba(10,10,10,0.55)')
}

// CLOSING - recap + CTA + handle. Three moods on a roll (dark, accent flood,
// cream) instead of the identical dark composition every single deck used to
// end on regardless of seed.
function slideClosing({ ctx, p, accent, accent2, r, i, total }: SlideCtx) {
  const roll = r()
  const mode: 'dark' | 'flood' | 'cream' = roll < 0.5 ? 'dark' : roll < 0.75 ? 'flood' : 'cream'
  const ink = mode === 'dark' ? WHITE : INK

  if (mode === 'dark') {
    darkBg(ctx, W, H, accent, r); grid(ctx, W, H, 0.05)
    flourish(ctx, 120, H * 0.78, rrange(r, 120, 160), accent, r, 0.12)
    decorate(ctx, W, H, r, accent)
  } else if (mode === 'flood') {
    accentBg(ctx, W, H, accent, accent2, r)
    flourish(ctx, W * rrange(r, 0.7, 0.9), H * rrange(r, 0.14, 0.26), rrange(r, 260, 360), INK, r, 0.07)
  } else {
    creamBg(ctx, W, H)
    decorate(ctx, W, H, r, accent, false)
  }
  topBottomBars(ctx, accent, accent2)
  logo(ctx, 72, 130, accent, 56, mode === 'cream')

  kicker(ctx, 'STUDENT-RUN · KOLKATA', 76, 250, mode === 'dark' ? accent : mode === 'cream' ? accent : INK)
  // Deck-specific closing: lead with the project's headline stat when it has one
  // (e.g. "4,000 saplings planted."), else its title, else the brand default -
  // so the last slide recaps THIS project instead of a generic sign-off. Sized
  // via fitHeadline so a long stat/title can't bleed past the canvas.
  let head = 'this is what\nshowing up\nlooks like.'
  if (p.keyStatistic && p.keyStatistic.trim()) {
    const parts = splitStat(p.keyStatistic.trim())
    head = parts.value ? `${parts.value}\n${parts.label || 'and counting.'}`.trim() : parts.label
  } else if (p.title && p.title.trim()) {
    head = p.title.trim()
  }
  const hf = fitHeadline(ctx, head, W - 152, 3, 96, 52, r)
  const hlh = hf.size * 1.02 * hf.lhMul
  ctx.font = hf.font; ctx.fillStyle = ink
  drawLines(ctx, hf.lines, 76, 400, hlh)
  const headlineBottom = 400 + (hf.lines.length - 1) * hlh + hf.size

  // Collab credit, if any - shrink to fit the width so long names don't bleed.
  let contentBottom = headlineBottom
  if (p.collabName) {
    const credit = ('WITH ' + p.collabName).toUpperCase().slice(0, 48)
    let cs = 28; ctx.font = `700 ${cs}px ${MONO}`
    while (ctx.measureText(credit).width > W - 152 && cs > 16) { cs -= 2; ctx.font = `700 ${cs}px ${MONO}` }
    ctx.fillStyle = mode === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(10,10,10,0.6)'
    ctx.fillText(credit, 76, 760)
    contentBottom = 760
  }

  // The headline is 1-3 lines depending on the project's own content, but the
  // CTA pill below is always pinned to H-280 (deliberately - a bottom-anchored
  // CTA is a real Instagram-carousel convention, thumb-reachable and
  // consistent across slides, not itself a bug). A short 1-line headline with
  // no collab credit left a large plain gap between the two with nothing in
  // it - found the same way the other two "empty middle" bugs were, by
  // actually rendering one. Same fix: fill genuinely leftover room with a
  // faint flourish instead of leaving it blank.
  const emptyBelow = (H - 280) - contentBottom - 40
  if (emptyBelow > 160) {
    flourish(ctx, W / 2, contentBottom + 40 + emptyBelow / 2, Math.min(160, emptyBelow * 0.4), accent2, r, mode === 'dark' ? 0.15 : 0.12)
  }

  // CTA pill.
  const cta = 'JOIN THE MOVEMENT'
  ctx.font = `900 34px ${DISPLAY}`
  const cw = ctx.measureText(cta).width + 72
  rrect(ctx, 76, H - 280, cw, 76, 38)
  ctx.fillStyle = mode === 'cream' ? INK : accent; ctx.fill()
  ctx.fillStyle = mode === 'cream' ? CREAM : INK
  ctx.fillText(cta, 76 + 36, H - 280 + 50)

  // Handle.
  ctx.font = `700 30px ${MONO}`; ctx.fillStyle = mode === 'dark' ? accent2 : mode === 'flood' ? INK : accent
  ctx.fillText('@ngo.aquaterra', 76, H - 165)

  progressDots(ctx, i, total, mode === 'dark' ? accent : INK, mode === 'dark')
}

// Single-line truncate at the current font - trims to whatever actually fits
// `maxW` and appends "…", instead of a blind character-count slice that can
// either overflow the canvas (string narrower than its char count implies) or
// cut a short one needlessly (string wider than it implies).
function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let s = text
  while (s.length > 0 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1).trimEnd()
  return s.trimEnd() + '…'
}

// Local word-wrap at current font (slideStat caption). Wraps the FULL text
// first, then - only if it still runs past `maxLines` - caps it there and
// ellipsizes the last visible line. This is the difference between a sentence
// reading as complete (or cleanly "…"-cut) and one that just stops mid-word.
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines = Infinity): string[] {
  // Forced paragraph breaks first (see layoutLines in posterGenerator.ts for
  // why - a literal newline in a stat sentence must not collapse into a space).
  const lines: string[] = []
  for (const para of text.split(/\n+/)) {
    const words = para.split(/\s+/).filter(Boolean)
    let line = ''
    for (const w of words) {
      const t = line ? `${line} ${w}` : w
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w } else line = t
    }
    lines.push(line)
  }
  while (lines.length && lines[lines.length - 1] === '') lines.pop()
  const dropped = lines.length > maxLines
  const cut = dropped ? lines.slice(0, maxLines) : lines
  // A single word longer than maxW (a pasted URL, a run-on hashtag) comes
  // back from the loop above as its own overlong "line" - ellipsize any line
  // that's still too wide, not just the one cut for running past maxLines,
  // or that word bleeds off the canvas edge untouched.
  return cut.map((ln, idx) => {
    const isCutTail = dropped && idx === cut.length - 1
    if (ctx.measureText(ln).width <= maxW) return isCutTail ? ln.trimEnd() + '…' : ln
    return ellipsize(ctx, ln, maxW)
  })
}

// ── Deck planning ─────────────────────────────────────────────────────────────

type Plan =
  | { kind: 'cover' }
  | { kind: 'text'; head: string; body: string }
  | { kind: 'stat'; stat: string; sub: string }
  | { kind: 'photo'; src: string; label: string | null }
  | { kind: 'facts'; facts: FactItem[] }
  | { kind: 'numbers'; numbers: FactItem[] }
  | { kind: 'closing' }

// The concrete figures a project carries - its headline stat, volunteer count
// and date - as up to three big value/label pairs. Feeds the "by the numbers"
// slide that gives an all-typographic (no-photo) deck some rhythm.
function buildNumbers(p: CarouselProject): FactItem[] {
  const nums: FactItem[] = []
  if (p.keyStatistic && p.keyStatistic.trim()) {
    const parts = splitStat(p.keyStatistic.trim())
    nums.push({ value: parts.value || parts.label, label: parts.value ? parts.label : '' })
  }
  if (p.volunteers && p.volunteers > 0) nums.push({ value: String(p.volunteers), label: 'volunteers' })
  if (p.workshopDate && p.workshopDate.trim()) nums.push({ value: p.workshopDate.trim(), label: 'when' })
  return nums.slice(0, 3)
}

// Decide which slides this project supports. Always cover + closing; the middle
// is filled from whatever content exists. `coverSrc` is the resolved cover image
// URL so the same photo is never repeated as a photo slide.
function planDeck(p: CarouselProject, coverSrc: string | null): Plan[] {
  const plan: Plan[] = [{ kind: 'cover' }]

  // Exactly ONE statement slide - objective first, falling back to whatever
  // summary/write-up text exists so a project without an explicit objective
  // still gets its one punchy beat. This used to also stack a second "the
  // story" text slide pulled from the write-up, which pushed decks toward
  // "text-heavy report" instead of "mostly photos, boldly branded, with one
  // strong statement" - text is now deliberately rationed to the cover plus
  // this single slide.
  const textStat: Plan[] = []
  const statement = (p.objective || p.shortSummary || p.longWriteup || '').trim()
  if (statement) textStat.push({ kind: 'text', head: 'what we set out to do', body: statement })

  if (p.keyStatistic && p.keyStatistic.trim()) {
    const parts = splitStat(p.keyStatistic.trim())
    textStat.push({ kind: 'stat', stat: parts.value, sub: parts.label })
  } else if (p.volunteers && p.volunteers > 0) {
    textStat.push({ kind: 'stat', stat: String(p.volunteers), sub: 'volunteers on the ground' })
  }

  // Every project photo gets its own slide (skipping whichever photo the
  // cover already uses) - a project's photos are its main evidence of the
  // work, and used to get silently dropped once the deck's old 3-slide
  // middle cap filled up with text/stat content first.
  const photoPlans: Plan[] = (p.images || [])
    .filter(im => im.url && im.url !== coverSrc)
    .map(im => ({ kind: 'photo' as const, src: im.url, label: im.label || null }))

  // Instagram allows up to 10 items per carousel post. Reserve 1 for the
  // cover and 1 for the closing CTA, leaving up to 8 for content. Photos
  // always win that budget first - if text/stat + photos would exceed it,
  // trim text/stat (least essential, lowest-priority items last).
  const MAX_MIDDLE = 8
  const budget = Math.max(0, MAX_MIDDLE - photoPlans.length)

  // A photo-less deck is all type and reads flat. If the project carries at
  // least two hard figures, promote a "by the numbers" multi-stat slide for
  // rhythm - and drop the lone single-stat slide it supersedes.
  const noPhotos = photoPlans.length === 0
  const numbers = noPhotos ? buildNumbers(p) : []
  const useNumbers = numbers.length >= 2
  const middleText = useNumbers ? textStat.filter(t => t.kind === 'text') : textStat
  const middle = [...middleText.slice(0, budget), ...photoPlans.slice(0, MAX_MIDDLE)]
  if (useNumbers) middle.push({ kind: 'numbers', numbers })

  // A thin deck (no write-up, no stat, one or no photos) used to fall back to
  // a single slide that just echoed the title back at a giant size - reads
  // as empty rather than designed. If the project has real concrete facts
  // (location, date, category, volunteers, collab) even without free text,
  // give it an actual "at a glance" beat instead.
  const facts = buildFacts(p)
  if (middle.length < 2 && facts.length >= 2) middle.push({ kind: 'facts', facts })

  // Real project data always carries at least a title, but guard the
  // theoretical empty case (no facts either) so the deck is never just cover
  // + closing.
  if (middle.length === 0) middle.push({ kind: 'text', head: 'the story', body: p.title || 'a project by AquaTerra.' })

  plan.push(...middle)
  plan.push({ kind: 'closing' })
  return plan
}

// Pull a leading number out of a stat string ("4,000 saplings planted" → value
// "4,000", label "saplings planted"; "₹2.5L raised" → "₹2.5L" / "raised"). When
// there's no leading number, value is empty and the whole string is the label so
// the stat slide renders it as text instead of a broken truncated "number".
function splitStat(s: string): { value: string; label: string } {
  const m = s.match(/^\s*([₹$]?\d[\d,.]*\+?%?\s*(?:[kKmMbB]|[lL](?:akh)?|[cC]r|[mM]n)?)\s*(.*)$/)
  if (m && m[1]) return { value: m[1].trim(), label: m[2].trim() }
  return { value: '', label: s }
}

// ── Public API ────────────────────────────────────────────────────────────────

// Named cover looks a "choose a design" UI can offer - only surfaced when the
// project actually has a photo (a project with none only ever gets 'cream').
export const CAROUSEL_COVER_STYLES = ['Taped', 'Full-bleed', 'Duotone', 'Cream'] as const
const COVER_STYLE_KEYS: Record<string, string> = { Taped: 'taped', 'Full-bleed': 'fullBleed', Duotone: 'duotone', Cream: 'cream' }
const COVER_STYLE_NAMES: Record<string, string> = { taped: 'Taped', fullBleed: 'Full-bleed', duotone: 'Duotone', cream: 'Cream' }

// Render one carousel. `seed` makes the accent + decoration reproducible;
// `coverStyle` (one of CAROUSEL_COVER_STYLES) pins the cover's look instead of
// letting it roll. Omit both (or pass a fresh seed) for a fresh look each
// call ("regenerate").
export async function generateCarousel(p: CarouselProject, opts?: { seed?: number; coverStyle?: string; exclude?: string }): Promise<CarouselResult> {
  await Promise.all([document.fonts?.ready ?? Promise.resolve(), loadLogo()])
  // No emojis on graphics - brand law. Strip once here rather than at every
  // slide's text-drawing call site.
  const se = (s?: string | null) => (s ? stripEmoji(s) : s)
  p = {
    ...p,
    title: stripEmoji(p.title || '') || p.title,
    location: se(p.location),
    keyStatistic: se(p.keyStatistic),
    objective: se(p.objective),
    shortSummary: se(p.shortSummary),
    longWriteup: se(p.longWriteup),
    collabName: se(p.collabName),
    images: p.images?.map(im => ({ ...im, label: se(im.label) })),
  }
  const s = opts?.seed ?? Math.floor(Math.random() * 0xffffffff)
  const r = mulberry32(s)

  // One muted accent for the whole deck, plus a lighter TINT of that same
  // hue as accent2 (monochromatic depth) rather than a second, unrelated
  // colour picked at random - that random pairing was the actual source of
  // the "clashing colours" complaint, since every slide below uses
  // accent/accent2 as its dominant scheme.
  const accent = mutedCatColor(p.category)
  const accent2 = tint(accent, 0.45)

  // Resolve the cover image first so photo slides can dedupe against it.
  const coverSrc = p.mainImage || (p.images && p.images[0]?.url) || null
  const plan = planDeck(p, coverSrc)

  // Resolve the cover style up front: a pinned choice wins; otherwise roll one,
  // excluding the last-used look so "regenerate" doesn't redraw the same cover.
  const validCover = coverSrc ? ['taped', 'fullBleed', 'duotone'] : ['cream']
  let coverStyleKey = opts?.coverStyle ? COVER_STYLE_KEYS[opts.coverStyle] : undefined
  if (!coverStyleKey) {
    const excludeKey = opts?.exclude ? COVER_STYLE_KEYS[opts.exclude] : undefined
    let cands = excludeKey ? validCover.filter(v => v !== excludeKey) : validCover
    if (!cands.length) cands = validCover
    coverStyleKey = pick(r, cands)
  }
  const coverStyleName = COVER_STYLE_NAMES[coverStyleKey] || 'Cream'

  // Preload every photo the deck needs (cover + photo slides), in parallel.
  const photoSrcs = plan.filter(pl => pl.kind === 'photo').map(pl => (pl as { src: string }).src)
  const [coverImg, ...photoImgs] = await Promise.all([
    coverSrc ? loadImage(coverSrc) : Promise.resolve(null),
    ...photoSrcs.map(src => loadImage(src)),
  ])
  const photoQueue = [...photoImgs]

  const total = plan.length
  const slides: CarouselSlide[] = []

  for (let i = 0; i < plan.length; i++) {
    const item = plan[i]
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
    ctx.textBaseline = 'alphabetic'
    // Each slide gets its own rng stream seeded from the deck seed so decoration
    // varies slide-to-slide but is still reproducible.
    const sr = mulberry32(s + i * 1013 + 7)
    const base: SlideCtx = { ctx, p, accent, accent2, r: sr, i, total }

    switch (item.kind) {
      case 'cover': slideCover(base, coverImg, coverStyleKey); break
      case 'text': slideText(base, item.head, item.body); break
      case 'stat': slideStat(base, item.stat, item.sub); break
      case 'photo': slidePhoto(base, photoQueue.shift() ?? null, item.label); break
      case 'facts': slideFacts(base, item.facts); break
      case 'numbers': slideNumbers(base, item.numbers); break
      case 'closing': slideClosing(base); break
    }

    const toBlob = () => new Promise<Blob>((res, rej) => {
      canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/png')
    })

    let blob: Blob
    try { blob = await toBlob() }
    catch {
      // Photo tainted by CORS - redraw that slide as a typographic fallback.
      ctx.clearRect(0, 0, W, H)
      if (item.kind === 'cover') slideCover(base, null)
      else if (item.kind === 'photo') slidePhoto(base, null, item.label)
      blob = await toBlob()
    }
    slides.push({ blob, url: URL.createObjectURL(blob), kind: item.kind })
  }

  return { slides, accent, seed: s, coverStyle: coverStyleName }
}

// Bundle the whole deck into ONE .zip and hand the browser a single download.
//
// The old approach fired one programmatic <a download> per slide, staggered by
// ~250ms. That never worked on iOS (Safari and Chrome-on-iOS both use WebKit),
// where only the *first* user-gesture-initiated download in a burst is honored
// and the rest are silently dropped - so a 10-slide deck saved 1 file. Zipping
// to a single blob means a single download, which iOS allows. fflate is
// statically imported (this whole module is already lazy-loaded with the
// studio modal) so the zip is built synchronously inside the click handler's
// call stack - a dynamic import here would yield before a.click() and could
// let iOS's transient user-activation window expire.
export async function downloadCarousel(slides: CarouselSlide[], slug: string): Promise<void> {
  // Read every slide's bytes FIRST (this awaits), then zip + click
  // synchronously in the same continuation - keeps the click as close as
  // possible to the tail of the async work so iOS's transient user-activation
  // window (still open across a handful of microtask/short-async hops) isn't
  // spent on a burst of separate downloads instead.
  const entries = await Promise.all(slides.map(async (sl, i) => {
    const name = `aquaterra-${slug}-${String(i + 1).padStart(2, '0')}.png`
    return [name, new Uint8Array(await sl.blob.arrayBuffer())] as const
  }))
  const files: Record<string, Uint8Array> = {}
  entries.forEach(([name, bytes]) => { files[name] = bytes })
  // PNGs are already compressed - skip re-deflating (level 0) to keep it fast.
  const zipped = zipSync(files, { level: 0 })
  const blob = new Blob([zipped as unknown as BlobPart], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = `aquaterra-${slug}-carousel.zip`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  } finally {
    // Revoke on the next tick so the download has a chance to start first.
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }
}
