// @ts-nocheck
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import type { Event } from '../lib/types'
import { fadeUp, stagger, SPRING, SPRING_SOFT } from '../lib/motion'

// Pre-loaded taglines per event slug. Fall back to generic for unknown.
const TAGLINES: Record<string, string> = {
  picklejam:            "Paddles up. Groups locked. PickleJam at Paradox 4.0 — let's go. 🏓🔥",
  'startup-standoff':   "Pitching my startup to the sharks at Paradox 4.0. Got a better idea? Come prove it. 💼🦈",
  'the-prodigy':        "4 rounds. Elimination cuts deep. I'm going for it at Paradox 4.0. 🧠⚡",
  'wicket-wars':        "Full arm only. Wides count 3. Wicket Wars at Paradox 4.0 — no mercy. 🏏🏆",
  'score-for-a-smile':  "EA FC 24. Knockout bracket. One controller. No hiding. 🎮⚽",
  terramun:             "Taking the floor at TerraMUN, Paradox 4.0. Come change my mind. 🌐🎙️",
  'dream-deck':         "100 crores. 15 players. My franchise. The Dream Deck at Paradox 4.0. 🏏📊",
  showstopper:          "Stage set. Judges watching. Showstopper at Paradox 4.0 — watch me move. 💃🔥",
  shutternaut:          "My lens. One shot. Shutternaut at Paradox 4.0. 📸✨",
  afterparty:           "See you at the After Party. Paradox 4.0 — 60 Chowringhee rooftop. 🪩🎶",
}

const PAL = ['#FF4338', '#FFD23F', '#B79CED', '#B79CED'] as const

export function StoryPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [eventSlug, setEventSlug] = useState('cricket')
  const [name, setName] = useState('')
  const [paletteIdx, setPaletteIdx] = useState(0)
  const [pngUrl, setPngUrl] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    supabase.from('paradox_events')
      .select('id, name, slug')
      .eq('active', true)
      .order('sort_order')
      .then(({ data }) => setEvents((data ?? []) as Event[]))
  }, [])

  // Re-render canvas whenever inputs change
  useEffect(() => {
    if (!canvasRef.current) return
    const c = canvasRef.current
    const ctx = c.getContext('2d')
    if (!ctx) return

    const W = c.width, H = c.height
    const accent = PAL[paletteIdx]
    const ev = events.find(e => e.slug === eventSlug)
    const tagline = TAGLINES[eventSlug] ?? `See you at Paradox 4.0. June 1–6, Kolkata. 🔥`

    // Background — dark base
    ctx.fillStyle = '#181818'
    ctx.fillRect(0, 0, W, H)

    // Decorative tilted color blocks
    ctx.save()
    ctx.translate(W * 0.5, H * 0.18)
    ctx.rotate(-0.06)
    ctx.fillStyle = accent
    ctx.fillRect(-W * 0.45, 0, W * 0.9, 220)
    ctx.restore()

    ctx.save()
    ctx.translate(W * 0.5, H * 0.66)
    ctx.rotate(0.04)
    ctx.fillStyle = '#FFD23F'
    ctx.fillRect(-W * 0.4, 0, W * 0.8, 140)
    ctx.restore()

    // Stars sprinkled
    ctx.fillStyle = '#FBF5E6'
    for (const [x, y, s] of [[120,150,18],[W-160,260,14],[200,H-380,16],[W-120,H-200,20]] as [number,number,number][]) {
      drawStar(ctx, x, y, s)
    }

    // Top label "PARADOX 2026"
    ctx.fillStyle = '#FBF5E6'
    ctx.font = '500 28px "JetBrains Mono", "Courier New", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('PARADOX ★ 4.0', W / 2, 90)

    // Tilted big event name on accent block
    ctx.save()
    ctx.translate(W * 0.5, H * 0.18 + 100)
    ctx.rotate(-0.06)
    ctx.fillStyle = '#181818'
    ctx.font = '700 96px "Boldonse", "Bricolage Grotesque", sans-serif'
    ctx.textAlign = 'center'
    const eventName = (ev?.name ?? 'Paradox').toLowerCase()
    ctx.fillText(eventName.length > 18 ? eventName.slice(0, 18) + '…' : eventName, 0, 50)
    ctx.restore()

    // Big "I'M IN." or participant name
    ctx.fillStyle = accent
    ctx.font = '700 140px "Boldonse", "Bricolage Grotesque", sans-serif'
    ctx.textAlign = 'center'
    const headline = name.trim() ? `i'm ${name.split(' ')[0].toLowerCase()}.` : `i'm in.`
    ctx.fillText(headline.slice(0, 14), W / 2, H * 0.5)

    // Tagline (wrap to ~22 chars per line)
    ctx.fillStyle = '#FBF5E6'
    ctx.font = '500 36px "Bricolage Grotesque", system-ui, sans-serif'
    ctx.textAlign = 'center'
    wrapText(ctx, tagline, W / 2, H * 0.62, W * 0.85, 46)

    // Date stripe
    ctx.save()
    ctx.translate(W * 0.5, H * 0.66 + 70)
    ctx.rotate(0.04)
    ctx.fillStyle = '#181818'
    ctx.font = '600 44px "Boldonse", "Bricolage Grotesque", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('JUN 1–6 · KOLKATA', 0, 0)
    ctx.restore()

    // Bottom — handle and url
    ctx.fillStyle = '#FBF5E6'
    ctx.font = '500 26px "JetBrains Mono", "Courier New", monospace'
    ctx.textAlign = 'center'
    ctx.fillText('@ngo.aquaterra · ngoaquaterra.com/paradox', W / 2, H - 80)

    setPngUrl(c.toDataURL('image/png'))
  }, [events, eventSlug, name, paletteIdx])

  const downloadPng = () => {
    if (!pngUrl) return
    const a = document.createElement('a')
    a.href = pngUrl
    a.download = `paradox-2026-${eventSlug}.png`
    a.click()
  }

  const sharePng = async () => {
    if (!pngUrl) return
    try {
      const blob = await (await fetch(pngUrl)).blob()
      const file = new File([blob], `paradox-2026-${eventSlug}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Paradox 2026', text: TAGLINES[eventSlug] ?? '#Paradox2026' })
      } else {
        downloadPng()
        alert('Shared via download — open Instagram and add to your story manually.')
      }
    } catch { /* user cancelled */ }
  }

  return (
    <div className="min-h-[100dvh] bg-bg text-ink">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...SPRING }}
        className="bg-ink text-bg px-4 sm:px-8 py-6 sm:py-10"
      >
        <div className="font-mono text-[10px] tracking-[0.18em] uppercase opacity-55">/story</div>
        <div
          className="font-display leading-[0.92] tracking-tight text-balance mt-2 text-bg"
          style={{ fontSize: 'clamp(34px, 6vw, 64px)', letterSpacing: '-0.02em' }}
        >
          make a <span className="text-c2">story.</span>
        </div>
        <p className="font-body text-[15px] opacity-75 mt-3 max-w-md text-pretty">
          Generate a branded Instagram story in 5 seconds. Pick your event, drop your name, share.
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-5 p-5">
        {/* Form */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ ...SPRING, delay: 0.1 }}
          className="space-y-4 order-2 lg:order-1"
        >
          <div>
            <label htmlFor="story-event" className="font-mono text-[10px] tracking-[0.14em] uppercase opacity-70 block mb-1.5">Your event</label>
            <select
              id="story-event"
              value={eventSlug}
              onChange={e => setEventSlug(e.target.value)}
              className="w-full px-3.5 py-3 font-body text-[16px] text-ink bg-bg border-[1.5px] border-ink outline-none cursor-pointer focus:shadow-[3px_3px_0_var(--ink)] transition-shadow"
            >
              {events.length === 0 && <option value="cricket">Cricket</option>}
              {events.map(e => <option key={e.id} value={e.slug}>{e.name}</option>)}
              <option value="afterparty">After Party</option>
            </select>
          </div>

          <div>
            <label htmlFor="story-name" className="font-mono text-[10px] tracking-[0.14em] uppercase opacity-70 block mb-1.5">Your first name</label>
            <input
              id="story-name"
              value={name}
              aria-describedby="story-name-hint"
              onChange={e => setName(e.target.value)}
              placeholder="riya"
              className="w-full px-3.5 py-3 font-body text-[16px] text-ink bg-bg border-[1.5px] border-ink outline-none focus:shadow-[3px_3px_0_var(--ink)] transition-shadow"
            />
            <p id="story-name-hint" className="mt-1.5 font-mono text-[10px] opacity-50">leave blank for "i&apos;m in."</p>
          </div>

          {/* Palette buttons — a group, not one control. */}
          <div role="group" aria-labelledby="story-vibe-cap">
            <span id="story-vibe-cap" className="font-mono text-[10px] tracking-[0.14em] uppercase opacity-70 block mb-2">Vibe</span>
            {/* Staggered palette buttons */}
            <motion.div
              variants={stagger(0.07)}
              initial="hidden"
              animate="show"
              className="flex gap-2"
            >
              {PAL.map((c, i) => (
                <motion.button
                  key={c}
                  variants={fadeUp}
                  whileHover={{ scale: 1.08, transition: { type: 'spring', stiffness: 300, damping: 20 } }}
                  whileTap={{ scale: 0.96, transition: { type: 'spring', stiffness: 400, damping: 20 } }}
                  onClick={() => setPaletteIdx(i)}
                  style={{ background: c }}
                  className={`w-12 h-12 border-[1.5px] border-ink ${paletteIdx === i ? 'shadow-[4px_4px_0_#181818] -translate-y-0.5' : ''} transition-[transform,box-shadow]`}
                  aria-label={`Palette ${i + 1}`}
                />
              ))}
            </motion.div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <motion.button
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              onClick={downloadPng}
              className="bg-ink text-bg px-4 py-3.5 min-h-[52px] w-full font-body font-bold text-[15px] flex justify-between items-center"
            >
              <span>Download</span>
              <span className="font-mono text-[11px] opacity-80">PNG</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              onClick={sharePng}
              className="bg-c1 text-white px-4 py-3.5 min-h-[52px] w-full border-[2px] border-ink shadow-[4px_4px_0_#181818] font-body font-bold text-[15px] flex justify-between items-center"
            >
              <span>Share →</span>
              <span className="font-mono text-[11px] opacity-90">IG</span>
            </motion.button>
          </div>

          <p className="font-mono text-[10px] opacity-50 pt-2">
            Share opens your phone&apos;s share sheet. Pick Instagram → Add to story.
          </p>
        </motion.div>

        {/* Preview */}
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...SPRING_SOFT, delay: 0.2 }}
          className="flex justify-center order-1 lg:order-2"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${eventSlug}-${paletteIdx}`}
              initial={{ rotate: -3, opacity: 0, scale: 0.95 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 3, opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="border-[1.5px] border-ink shadow-[6px_6px_0_#181818]"
            >
              <canvas
                ref={canvasRef}
                width={1080}
                height={1920}
                className="block"
                style={{ width: 'min(320px, 85vw)', height: 'auto' }}
              />
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}

// ── Canvas helpers ─────────────────────────────────────────────────────
function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath()
  ctx.moveTo(x, y - s)
  ctx.lineTo(x + s * 0.3, y - s * 0.3)
  ctx.lineTo(x + s, y)
  ctx.lineTo(x + s * 0.3, y + s * 0.3)
  ctx.lineTo(x, y + s)
  ctx.lineTo(x - s * 0.3, y + s * 0.3)
  ctx.lineTo(x - s, y)
  ctx.lineTo(x - s * 0.3, y - s * 0.3)
  ctx.closePath()
  ctx.fill()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ')
  let line = ''
  let cy = y
  for (const word of words) {
    const test = line + word + ' '
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, cy)
      line = word + ' '
      cy += lineHeight
    } else {
      line = test
    }
  }
  ctx.fillText(line.trim(), x, cy)
}
