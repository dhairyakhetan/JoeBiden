/**
 * The success burst. PRD 6.5.
 *
 * Written by hand rather than pulling in `canvas-confetti` for three reasons:
 * the lazy TerraThon chunk has a 200 KB budget, the PRD wants a second emitter
 * throwing sport-specific balls that a generic library cannot draw anyway, and
 * one canvas doing both is cheaper than two stacked ones.
 *
 * Budget, straight from the PRD: 120 paper + 18 sprites on desktop, 70 + 10 on
 * mobile. Both totals sit under the 150-particle ceiling that keeps a mid-range
 * Android at frame rate.
 *
 * Under `prefers-reduced-motion` nothing animates: a single static burst is
 * painted once and faded out, so the moment still reads as a celebration
 * without any movement at all.
 */
import type { SportSlug } from './types'

// AquaTerra's accent hues. Paper white is in the mix so the burst reads against
// both the cream page and the ink slabs.
const PAPER = ['#FFC700', '#FF4D2E', '#3DA9FC', '#FF4D8C', '#1B8A5A', '#FFFFFF']

type Ball = { kind: 'cricket' | 'pickleball' | 'football' }
const BALL: Record<SportSlug, Ball['kind']> = {
  cricket: 'cricket',
  pickleball: 'pickleball',
  fifa: 'football',
}

interface P {
  x: number; y: number; vx: number; vy: number
  rot: number; vrot: number
  w: number; h: number
  color: string
  sprite: Ball['kind'] | null
  life: number
}

function drawBall(ctx: CanvasRenderingContext2D, kind: Ball['kind'], r: number) {
  if (kind === 'cricket') {
    ctx.fillStyle = '#C6300F'
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#F4EFE0'; ctx.lineWidth = Math.max(1, r * 0.16)
    ctx.beginPath(); ctx.arc(0, 0, r * 0.66, -0.9, 0.9); ctx.stroke()
  } else if (kind === 'pickleball') {
    ctx.fillStyle = '#FFC700'
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(10,10,10,0.6)'
    for (const [hx, hy] of [[-0.4, -0.3], [0.35, -0.25], [0, 0.35], [0.45, 0.35]]) {
      ctx.beginPath(); ctx.arc(hx * r, hy * r, r * 0.16, 0, Math.PI * 2); ctx.fill()
    }
  } else {
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#0A0A0A'
    ctx.beginPath(); ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2); ctx.fill()
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      ctx.beginPath()
      ctx.arc(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72, r * 0.17, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

/**
 * Fires the burst and resolves once the canvas has removed itself. Safe to call
 * when the document is hidden or the canvas context is unavailable: it
 * degrades to a no-op rather than throwing inside a success handler.
 */
export function fireConfetti(sport: SportSlug, reduceMotion = false): () => void {
  if (typeof document === 'undefined') return () => {}

  const canvas = document.createElement('canvas')
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const W = window.innerWidth
  const H = window.innerHeight
  canvas.width = W * dpr
  canvas.height = H * dpr
  Object.assign(canvas.style, {
    position: 'fixed', inset: '0', width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: '60',
  } as CSSStyleDeclaration)
  document.body.appendChild(canvas)

  const ctx = canvas.getContext('2d')
  if (!ctx) { canvas.remove(); return () => {} }
  ctx.scale(dpr, dpr)

  const mobile = W < 768
  const paperCount = mobile ? 70 : 120
  const spriteCount = mobile ? 10 : 18
  const ps: P[] = []

  // Two bursts from the bottom corners, the way the PRD describes it.
  for (let i = 0; i < paperCount; i++) {
    const left = i % 2 === 0
    const angle = (left ? -60 : -120) * (Math.PI / 180) + (Math.random() - 0.5) * 0.9
    const speed = 9 + Math.random() * 9
    ps.push({
      x: left ? 0 : W, y: H,
      vx: Math.cos(angle) * speed * (left ? 1 : -1),
      vy: Math.sin(angle) * speed,
      rot: Math.random() * Math.PI, vrot: (Math.random() - 0.5) * 0.3,
      w: 6 + Math.random() * 5, h: 9 + Math.random() * 6,
      color: PAPER[i % PAPER.length], sprite: null, life: 1,
    })
  }
  for (let i = 0; i < spriteCount; i++) {
    ps.push({
      x: W * (0.2 + Math.random() * 0.6), y: H * 0.92,
      vx: (Math.random() - 0.5) * 9, vy: -(13 + Math.random() * 8),
      rot: Math.random() * Math.PI, vrot: (Math.random() - 0.5) * 0.4,
      w: 9 + Math.random() * 7, h: 0,
      color: '', sprite: BALL[sport], life: 1,
    })
  }

  let raf = 0
  let done = false
  const cleanup = () => {
    if (done) return
    done = true
    cancelAnimationFrame(raf)
    canvas.remove()
  }

  if (reduceMotion) {
    // One painted frame, then a CSS fade. No rAF loop at all.
    for (const p of ps) {
      ctx.save(); ctx.translate(p.x + p.vx * 14, p.y + p.vy * 10 + 180); ctx.rotate(p.rot)
      if (p.sprite) drawBall(ctx, p.sprite, p.w)
      else { ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h) }
      ctx.restore()
    }
    canvas.style.transition = 'opacity 900ms ease 600ms'
    requestAnimationFrame(() => { canvas.style.opacity = '0' })
    const t = setTimeout(cleanup, 1800)
    return () => { clearTimeout(t); cleanup() }
  }

  const GRAVITY = 0.42
  const DRAG = 0.985
  const start = performance.now()

  const tick = (now: number) => {
    const elapsed = now - start
    ctx.clearRect(0, 0, W, H)
    for (const p of ps) {
      p.vy += GRAVITY
      p.vx *= DRAG
      p.vy *= DRAG
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vrot
      // Sprites fade out after 1.8s, paper rides the full 4s window.
      p.life = p.sprite ? Math.max(0, 1 - elapsed / 1800) : Math.max(0, 1 - elapsed / 3600)
      if (p.life <= 0) continue
      ctx.save()
      ctx.globalAlpha = p.life
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      if (p.sprite) drawBall(ctx, p.sprite, p.w)
      else { ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h) }
      ctx.restore()
    }
    if (elapsed < 4000) raf = requestAnimationFrame(tick)
    else cleanup()
  }
  raf = requestAnimationFrame(tick)

  return cleanup
}
