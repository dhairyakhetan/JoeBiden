import Img from '../components/Img'
import './BrandPage.css'
import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import DynamicIslandTOC from '../components/DynamicIslandTOC'
import { supabase, normalizeObj, OBJ_COLORS } from '../lib/supabase'
import { StatCountUp } from '../components/StatCountUp'
import { sized } from '../lib/imageUrl'
import { useMeta } from '../hooks/useMeta'
import { useToast } from '../components/Toast'
import { ORG_FACTS, displayCount } from '../lib/orgFacts'
import { capitalise, yearsPhrase } from '../lib/orgFigures'
import { Mascot } from '../components/Mascot'
import { CAST, CHARACTERS, POSES, SIZES, type MascotPose } from '../lib/mascotCast'
import iconSource from '../assets/brand/aquaterra-icon-source.png'
import iconWordmarkSource from '../assets/brand/aquaterra-icon-wordmark-source.png'
import wordmarkSource from '../assets/brand/aquaterra-wordmark-source.png'

const DRIVES = displayCount(ORG_FACTS.drivesWrittenUp)
const MEMBERS = displayCount(ORG_FACTS.membersTotal)
// A couple of the poster specimens below (the bare-numeral 'statshot'/'stat'
// types) deliberately drop the "+" for a cleaner big-numeral look - matches
// the existing '8' Sundarbans-trips specimen, which was never "8+" either.
// Same underlying figure as DRIVES/MEMBERS, just without the display suffix.
const noPlus = (s: string) => s.replace(/\+$/, '')
// Cleared cumulative-impact fact, sourced from ORG_FACTS rather than retyped
// (changelog/21-org-facts.md §21.0/§21.4). Value unchanged.
const SAPLINGS = displayCount(ORG_FACTS.saplingsPlanted)

/* ════════════════════════════════════════════════════════════════════
   AQUATERRA - DESIGN LANGUAGE
   A visual brand showcase: warm cream paper, heavy ink, sticker-bright
   accents, and real documentary photography from the field. No code -
   just the system, shown.
   ════════════════════════════════════════════════════════════════════ */

// ── Token data (real values, pulled from the live CSS custom properties) ──
type Swatch = { name: string; hex: string; fg: string; note: string }

const FOUNDATION: Swatch[] = [
  { name: 'Paper',   hex: '#F4EFE0', fg: '#0A0A0A', note: 'The canvas. ~90% of every screen.' },
  { name: 'Paper 2', hex: '#EDE6D0', fg: '#0A0A0A', note: 'Cards, wells, inset surfaces.' },
  { name: 'Paper 3', hex: '#E2D9BD', fg: '#0A0A0A', note: 'Deepest cream - hover / active.' },
  { name: 'Ink',     hex: '#0A0A0A', fg: '#F4EFE0', note: 'Text, borders, the dark sections.' },
  { name: 'Ink 2',   hex: '#2A2A28', fg: '#F4EFE0', note: 'Secondary text, warm near-black.' },
  { name: 'Ink 3',   hex: '#5A5A55', fg: '#F4EFE0', note: 'Muted labels, captions, meta.' },
]

const ACCENTS: Swatch[] = [
  /* CONTRAST (DESIGN.md §2). Mint, Tomato and Grape carried fg '#F4EFE0' -
     paper on a saturated accent - which is the exact pairing §2's table marks
     FAIL for all three (3.78 / 2.88 / 3.78:1 at the chip's 13px). The rule the
     page itself documents is "text on a saturated accent fill is ALWAYS ink",
     and ink measures 4.55 / 6.71 / 4.55:1 on them. */
  { name: 'Mint',   hex: '#1B8A5A', fg: '#0A0A0A', note: 'Primary brand. Welfare, growth, “go”.' },
  { name: 'Lemon',  hex: '#FFC700', fg: '#0A0A0A', note: 'Energy. Big CTA blocks, highlights.' },
  { name: 'Pink',   hex: '#FF4D8C', fg: '#0A0A0A', note: 'The accent. Links, focus, emphasis.' },
  { name: 'Tomato', hex: '#FF4D2E', fg: '#0A0A0A', note: 'Alerts, heat, urgency.' },
  { name: 'Sky',    hex: '#3DA9FC', fg: '#0A0A0A', note: 'Info, calm, secondary data.' },
  { name: 'Grape',  hex: '#7E5BFF', fg: '#0A0A0A', note: 'Paradox, events, the playful edge.' },
]

/* 12.7: "the palette section must show the *-ink partners and label which
   pairs fail - that is the rule people get wrong most." Each display hue is
   tuned as a FILL (ink sits on top); as TEXT on a light ground, most of them
   fail AA and need the darkened *-ink partner instead. Ratios below are the
   ones tokens.css's own §00.4 comment measures - not re-derived here, so
   this specimen can't drift from the tokens it's documenting. */
const INK_PAIRS: { name: string; hue: string; hueRatio: number; ink: string; inkHex: string; inkRatio: number }[] = [
  { name: 'Mint',   hue: 'var(--welfare)', hueRatio: 4.35, ink: 'var(--welfare-ink)', inkHex: '#146F47', inkRatio: 6.18 },
  { name: 'Grape',  hue: 'var(--grape)',   hueRatio: 4.33, ink: 'var(--grape-ink)',   inkHex: '#6B44E8', inkRatio: 5.81 },
  { name: 'Tomato', hue: 'var(--tomato)',  hueRatio: 3.31, ink: 'var(--tomato-ink)',  inkHex: '#C6300F', inkRatio: 5.45 },
  { name: 'Pink',   hue: 'var(--pink)',    hueRatio: 3.14, ink: 'var(--pink-ink)',    inkHex: '#C4185C', inkRatio: 5.71 },
  { name: 'Sky',    hue: 'var(--sky)',     hueRatio: 2.54, ink: 'var(--sky-ink)',     inkHex: '#0B6BB8', inkRatio: 5.52 },
  { name: 'Lemon',  hue: 'var(--lemon)',   hueRatio: 1.61, ink: 'var(--lemon-ink)',   inkHex: '#7E6000', inkRatio: 5.92 },
]

/* 12.7: the concentric radius scale, in its own words - one number and two
   subtractions (00.1). Only 999/32/22/14 exist on it. */
const RADII: { name: string; token: string; px: number; note: string }[] = [
  { name: 'Outer', token: '--r-outer', px: 32, note: 'a card, sitting on the page' },
  { name: 'Inner', token: '--r-inner', px: 22, note: '32 − 10px padding: a well inside a card' },
  { name: 'Tight',  token: '--r-tight', px: 14, note: '22 − 8px padding: a thumbnail, a nested chip' },
  { name: 'Pill',  token: '--r-pill', px: 999, note: 'buttons, chips, avatars - always a true capsule' },
]

/* 12.7: the paper-on-ink ladder (02.2) - six measured rungs, composited
   against #0A0A0A. §00's own rule: pick a rung, never invent an alpha
   between them. */
const INK_LADDER: { token: string; alpha: number; ratio: number; use: string }[] = [
  { token: '--nav-fg',        alpha: 1.00, ratio: 15.6, use: 'primary label, active glyph' },
  { token: '--nav-fg-strong', alpha: 0.82, ratio: 10.1, use: 'nav link + rail item labels' },
  { token: '--nav-fg-dim',    alpha: 0.78, ratio: 9.4,  use: 'inactive label' },
  { token: '--nav-fg-mid',    alpha: 0.72, ratio: 7.9,  use: 'icon glyphs, dock buttons' },
  { token: '--nav-fg-soft',   alpha: 0.60, ratio: 6.5,  use: 'secondary meta' },
  { token: '--nav-fg-faint',  alpha: 0.55, ratio: 5.6,  use: 'the FLOOR for text on ink' },
]

/* 12.7: the eight sticker silhouettes (13.2), rendered with the real
   `.sticker--*` shape classes - not redrawn as illustration, so this
   specimen can never drift from what actually ships. */
const STICKER_SHAPES: { shape: string; label: string; diecutOnly?: boolean }[] = [
  { shape: 'circle', label: 'circle' },
  { shape: 'squircle', label: 'squircle' },
  { shape: 'pill', label: 'pill' },
  { shape: 'oval', label: 'oval' },
  { shape: 'bubble', label: 'bubble' },
  { shape: 'starburst', label: 'starburst', diecutOnly: true },
  { shape: 'rosette', label: 'rosette', diecutOnly: true },
  { shape: 'diamond', label: 'diamond', diecutOnly: true },
]

// audit-ok: this IS the Pop sticker palette's source of truth - the /brand
// page's job is to print the palette, so it names every hex literally.
const STICKERS: Swatch[] = [
  { name: 'Pop Mint',   hex: '#00E5A0', fg: '#0A0A0A', note: 'mint' },
  { name: 'Pop Pink',   hex: '#FF6BD6', fg: '#0A0A0A', note: 'pink' },
  { name: 'Pop Lemon',  hex: '#FFE94A', fg: '#0A0A0A', note: 'lemon' },
  { name: 'Pop Orange', hex: '#FF7A1A', fg: '#0A0A0A', note: 'orange' },
  { name: 'Pop Sky',    hex: '#6FD7FF', fg: '#0A0A0A', note: 'sky' },
  { name: 'Pop Grape',  hex: '#B084FF', fg: '#0A0A0A', note: 'grape' },
]

// The brand six, for the colophon easter egg (names → hex, memorable).
const BRAND_SIX: [string, string][] = [
  ['Mint', '#1B8A5A'], ['Lemon', '#FFC700'], ['Pink', '#FF4D8C'],
  ['Tomato', '#FF4D2E'], ['Sky', '#3DA9FC'], ['Grape', '#7E5BFF'],
]

// [css-var key, short label, real font-family name]
const TESTER_FONTS: [string, string, string][] = [
  ['display', 'Display', 'NeutralFace'],
  ['serif', 'Serif', 'Instrument Serif'],
  ['eina', 'Body', 'Eina01'],
  ['mono', 'Label', 'NeutralFace'],
  ['code', 'Code', 'JetBrains Mono'],
]

// ── Logo assets - real files, on both grounds they actually ship on ──
type LogoAsset = { name: string; file: string; note: string; ground: 'cream' | 'ink' }
const LOGO_ASSETS: LogoAsset[] = [
  { name: 'Icon', file: iconSource, note: 'App icon, favicon, avatar fallback. Square crop.', ground: 'cream' },
  { name: 'Icon + wordmark', file: iconWordmarkSource, note: 'The full lockup - nav bar, letterhead, the loading screen.', ground: 'ink' },
  { name: 'Wordmark', file: wordmarkSource, note: 'Text only. Footers, printed materials, anywhere the icon is redundant.', ground: 'cream' },
]

type Photo = { image: string; alt: string; header: string; tag: string; color: string; location?: string; stat?: string }

// Subtle paper grain (inline SVG noise) - gives the cream a tactile texture.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")"

export default function BrandPage() {
  // Unlisted internal reference sheet - noindex so it stays out of search
  // results (it's not in nav, footer, or sitemap.xml).
  useMeta({
    title: 'Design Language | AquaTerra Brand',
    description: 'AquaTerra\'s internal visual system reference: colours, type, and components.',
    noIndex: true,
  })
  const toast = useToast()
  const [copied, setCopied] = useState<string | null>(null)
  const [copiedLabel, setCopiedLabel] = useState<string>('')
  const [testerFont, setTesterFont] = useState<string>('display')
  const [accentIdx, setAccentIdx] = useState<number>(0)
  const [photos, setPhotos] = useState<Photo[]>([])
  // Per-character pose, so tapping one mascot cycles only that one.
  const [mascotPose, setMascotPose] = useState<Record<string, MascotPose>>({})
  const rootRef = useRef<HTMLDivElement>(null)

  // The `copied` flag must follow the write, not the attempt: the old shape
  // swallowed the rejection and reported success either way.
  const copy = useCallback(async (text: string, key: string, label?: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      toast.error('couldn’t copy that.', 'your browser blocked clipboard access - select and copy the text manually.')
      return
    }
    setCopied(key)
    setCopiedLabel(label ?? key)
    window.setTimeout(() => setCopied(c => (c === key ? null : c)), 1500)
  }, [toast])

  // Copies the actual image to the clipboard (paste straight into a doc or
  // deck), not just its URL - `ClipboardItem` with an image MIME type, which
  // Chrome/Edge/Safari support and Firefox does not yet. Falls back to
  // copying the URL as text so the button still does *something* useful
  // everywhere, rather than failing silently on an unsupported browser.
  const copyImage = useCallback(async (url: string, name: string, key: string) => {
    try {
      if (!('ClipboardItem' in window)) throw new Error('unsupported')
      const res = await fetch(url)
      const blob = await res.blob()
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
      setCopied(key)
      setCopiedLabel(name)
      window.setTimeout(() => setCopied(c => (c === key ? null : c)), 1500)
    } catch {
      // Same key/label so the floating toast still confirms something happened.
      await copy(new URL(url, window.location.origin).href, key, `${name} URL`)
    }
  }, [copy])

  // Export the whole sheet to PDF via the browser's print pipeline. We first
  // force every scroll-revealed block visible and freeze animations (otherwise
  // anything not yet scrolled into view prints blank), then open the dialog.
  const handleExportPdf = useCallback(() => {
    const root = rootRef.current
    if (root) {
      root.querySelectorAll('.bp-reveal').forEach(e => e.classList.add('in'))
      root.classList.add('bp-printing')
    }
    window.setTimeout(() => {
      window.print()
      root?.classList.remove('bp-printing')
    }, 150)
  }, [])

  // Pull real documentary photography from the welfare projects to show the
  // brand applied to actual work. Degrades gracefully - if the legacy welfare
  // DB is unreachable the photo blocks simply don't render.
  useEffect(() => {
    let cancelled = false
    supabase
      .from('welfare_projects')
      .select('slug,header,objective,location,key_statistic,main_image,main_image_alt,workshop_date')
      .eq('is_draft', false)
      .not('main_image', 'is', null)
      .order('workshop_date', { ascending: false })
      .limit(14)
      .then(({ data }) => {
        if (cancelled || !data) return
        const mapped: Photo[] = (data as any[])
          .filter(r => r.main_image)
          .map(r => {
            const norm = normalizeObj(r.objective)
            return {
              image: r.main_image as string,
              alt: (r.main_image_alt || r.header) as string,
              header: r.header as string,
              tag: norm,
              color: OBJ_COLORS[norm] || OBJ_COLORS['Others'],
              location: r.location || undefined,
              stat: r.key_statistic || undefined,
            }
          })
        setPhotos(mapped)
      })
    return () => { cancelled = true }
  }, [])

  // Scroll-triggered reveals - each section choreographs in as it enters view.
  // Bulletproofed: a safety timer reveals whatever's still hidden, on a
  // recurring sweep, so content can never get permanently stuck invisible.
  // (An earlier version tracked "has the observer ever fired at all" - but
  // IntersectionObserver always fires once immediately per element with its
  // CURRENT state, including isIntersecting:false for anything below the
  // fold, so that flag went true almost instantly and disabled the safety
  // net for the rest of the page, regardless of whether those elements ever
  // actually got revealed. Checking "is anything still un-revealed" instead
  // of "did the observer ever report anything" is what actually guarantees
  // nothing stays hidden forever.)
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const els = Array.from(root.querySelectorAll<HTMLElement>('.bp-reveal'))
    const revealAll = () => els.forEach(e => e.classList.add('in'))
    if (!('IntersectionObserver' in window)) { revealAll(); return }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target) } })
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 })
    els.forEach(e => io.observe(e))
    const sweep = () => { if (els.some(e => !e.classList.contains('in'))) revealAll() }
    const safety = window.setTimeout(sweep, 2200)
    return () => { io.disconnect(); window.clearTimeout(safety) }
  }, [])

  const accentName = BRAND_SIX[accentIdx][0]
  const accentHex = BRAND_SIX[accentIdx][1]
  const cycleAccent = () => {
    const n = (accentIdx + 1) % BRAND_SIX.length
    setAccentIdx(n)
    copy(BRAND_SIX[n][1], '__accent__', `${BRAND_SIX[n][0]} ${BRAND_SIX[n][1]}`)
  }

  const onMastMove = (e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
  }

  // Distribute photos across the visual blocks.
  const poster = photos[0]
  const cards = photos.slice(1, 5)
  const stickerPhotos = photos.slice(5, 7)
  const wildCard = photos[7] || photos[0]
  const mosaic = photos.slice(0, 9)

  return (
    <div className="route-enter brandpage" ref={rootRef} style={{ background: 'var(--bg)', color: 'var(--ink)', position: 'relative' }}>
      {/* Paper grain overlay */}
      <div aria-hidden className="bp-grain" style={{ backgroundImage: GRAIN }} />

      {/* Floating dynamic-island table of contents */}
      <DynamicIslandTOC />

      {/* Floating copy toast */}
      <div className={'bp-toast' + (copied ? ' on' : '')} aria-live="polite">
        Copied <b>{copiedLabel}</b> <span className="bp-toast-tick" key={copiedLabel}>✓</span>
      </div>

      {/* ═══════════ MASTHEAD ═══════════ */}
      <header className="bp-mast bp-reveal in" onPointerMove={onMastMove}>
        <div aria-hidden className="bp-aurora" />
        <div aria-hidden className="bp-mast-spot" />

        <div className="bp-mast-inner">
          <div className="bp-mast-kicker bp-rise" style={{ ['--rd' as string]: '40ms' }}>
            <span>AQUATERRA</span>
            <span className="bp-dash" />
            <span>VISUAL SYSTEM - V6</span>
            <span className="bp-dash" />
            <span>KOLKATA · EST 2021</span>
          </div>

          <h1 className="bp-mast-title">
            <span className="bp-rise" style={{ ['--rd' as string]: '90ms' }}>DESIGN</span>
            <span className="bp-rise bp-serif" style={{ ['--rd' as string]: '200ms' }}>language.</span>
          </h1>

          <p className="bp-mast-sub bp-rise" style={{ ['--rd' as string]: '320ms' }}>
            One cream page, one heavy face, six loud accents - and real documentary
            photography doing the talking. This is how AquaTerra looks, head to toe.
          </p>

          <div className="bp-mast-scroll bp-rise" style={{ ['--rd' as string]: '460ms' }}>scroll the sheet ↓</div>
        </div>

        {/* rotated stickers - decorative, not tappable, so die-cut per 13.1 */}
        <span className="sticker sticker-mint bp-sticker sticker--diecut" style={{ top: '15%', right: '8%', ['--rot' as string]: '-7deg', ['--sticker-ground' as string]: 'var(--bg)' }}>★ STUDENT-LED</span>
        <span className="sticker sticker-pink bp-sticker sticker--diecut" style={{ bottom: '22%', right: '13%', ['--rot' as string]: '5deg', ['--sticker-ground' as string]: 'var(--bg)' }}>NON-PROFIT</span>
        <span className="sticker sticker-lemon bp-sticker bp-sticker-hide sticker--diecut" style={{ top: '42%', left: '4%', ['--rot' as string]: '4deg', ['--sticker-ground' as string]: 'var(--bg)' }}>♥ ZERO FEES</span>
      </header>

      {/* ═══════════ 01 · PALETTE ═══════════ */}
      <Section index="01" title="Palette" lead="Cream rules. Ink structures. Exactly one accent gets to shout per view.">
        <div className="bp-block-label bp-rise">Foundation</div>
        <div className="bp-swatch-grid">
          {FOUNDATION.map((s, i) => <SwatchCard key={s.hex} s={s} i={i} copied={copied} onCopy={copy} />)}
        </div>

        <div className="bp-block-label bp-rise" style={{ marginTop: 40 }}>Accents - the brand six</div>
        <div className="bp-swatch-grid">
          {ACCENTS.map((s, i) => <SwatchCard key={s.hex} s={s} i={i} copied={copied} onCopy={copy} />)}
        </div>

        <div className="bp-block-label bp-rise" style={{ marginTop: 40 }}>The *-ink partners - where the pair fails</div>
        <div className="bp-inkpairs bp-rise">
          {INK_PAIRS.map(pair => (
            <div key={pair.name} className="bp-inkpair">
              <span className="bp-inkpair-name">{pair.name}</span>
              <div className="bp-inkpair-row">
                <span className="bp-inkpair-chip" style={{ background: 'var(--card)', color: pair.hue }}>
                  {pair.name.toLowerCase()} as text
                  <b className="bp-inkpair-fail">FAILS · {pair.hueRatio.toFixed(2)}:1</b>
                </span>
                <span className="bp-inkpair-chip" style={{ background: 'var(--card)', color: pair.ink }}>
                  {pair.inkHex} as text
                  <b className="bp-inkpair-pass">PASSES · {pair.inkRatio.toFixed(2)}:1</b>
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="bp-block-label bp-rise" style={{ marginTop: 40 }}>Sticker pops - loud, for stickers only</div>
        <div className="bp-pop-row">
          {STICKERS.map((s, i) => {
            const isC = copied === s.hex
            return (
              <button key={s.hex} className="bp-pop bp-rise"
                style={{ background: s.hex, color: s.fg, ['--rd' as string]: `${i * 45}ms` }}
                onClick={() => copy(s.hex, s.hex)} title="click to copy">
                <span className="bp-pop-hex">{isC ? <>copied <b className="bp-tick">✓</b></> : s.hex}</span>
                <span className="bp-pop-name">{s.note}</span>
              </button>
            )
          })}
        </div>

        <div className="bp-block-label bp-rise" style={{ marginTop: 40 }}>Combinations - pairs that work</div>
        <div className="bp-combos">
          {COMBOS.map(([a, b, name, note], i) => <Combo key={name} a={a} b={b} name={name} note={note} i={i} />)}
        </div>

        <Tutorial>
          <b>The 90 / 8 / 2 rule.</b> Paper is ~90% of the surface, ink is ~8% (type
          + hairlines), and a single accent is the last ~2%. Two accents fighting in
          one viewport is the fastest way to break the system.
        </Tutorial>
      </Section>

      {/* ═══════════ 02 · TYPE ═══════════ */}
      <Section index="02" title="Typography" lead="A brutal display face, a human serif, a clean body, a mono for the machine voice." dark>
        <div className="bp-tester bp-rise">
          <div className="bp-tester-controls">
            <span className="bp-tester-fontname" style={{ fontFamily: `var(--${testerFont})`, fontStyle: testerFont === 'serif' ? 'italic' : 'normal' }}>
              {(TESTER_FONTS.find(([k]) => k === testerFont) || ['', '', ''])[2]}
            </span>
            {TESTER_FONTS.map(([key, label]) => (
              <button key={key} type="button" aria-pressed={testerFont === key} className={'bp-tchip' + (testerFont === key ? ' on' : '')} onClick={() => setTesterFont(key)}>{label}</button>
            ))}
          </div>
          <div className="bp-tester-stage" contentEditable suppressContentEditableWarning spellCheck={false}
            role="textbox" aria-multiline="true" aria-label="Type sample text to preview the font"
            style={{
              fontFamily: `var(--${testerFont})`,
              fontStyle: testerFont === 'serif' ? 'italic' : 'normal',
              textTransform: testerFont === 'mono' ? 'uppercase' : 'none',
              letterSpacing: testerFont === 'display' ? '-0.03em' : testerFont === 'mono' ? '0.04em' : '0',
              fontWeight: testerFont === 'display' ? 900 : 500,
            }}>
            Type something gorgeous.
          </div>
        </div>

        <div className="bp-type-grid">
          <TypeSpec role="Display" token="--display" family="NeutralFace" sample="OUR PROJECTS."
            note="900 weight, tight −0.04em, usually UPPERCASE. Headlines & numbers." />
          <TypeSpec role="Serif" token="--serif" family="Instrument Serif" sample="ects." italic
            note="Italic. The human counterpoint - one word, never a sentence." />
          <TypeSpec role="Body" token="--eina" family="Eina01" sample="Real work, real impact, zero fees."
            note="The reading voice. 1.6–1.7 line-height, generous and calm." />
          <TypeSpec role="Label" token="--mono" family="NeutralFace" sample="[ FEATURED ]"
            note="Labels & meta only. Caps-only by design, 0.08em tracked, tiny." mono />
          <TypeSpec role="Code" token="--code" family="JetBrains Mono" sample="/directory  1,327"
            note="Only where the glyphs ARE the content: paths, hex, keycaps, digit columns." />
        </div>

        <div className="bp-scale">
          {[
            { px: 92, label: 'Hero / display', txt: 'Join the movement.' },
            { px: 52, label: 'Section head', txt: 'Explore our pillars.' },
            { px: 28, label: 'Card title', txt: 'Sunderbans Plantation 5.0' },
            { px: 16, label: 'Body', txt: 'Documented since 2021, run entirely by volunteers.' },
            // Specimen text, but it's a live public page and 534 read as a real count
    // against the 550+ every other surface states. Same number as the rest.
    // Now sourced from ORG_FACTS instead of a second hardcoded copy of "the
    // number every other surface states" (changelog/21-org-facts.md).
    { px: 11, label: 'Mono label', txt: `[ ALL DRIVES ] · ${DRIVES} DRIVES` },
          ].map((row, i) => (
            <div key={row.px} className="bp-scale-row bp-rise" style={{ ['--rd' as string]: `${i * 60}ms` }}>
              <span className="bp-scale-meta">{row.px}px · {row.label}</span>
              <span className="bp-scale-txt" style={{
                fontSize: Math.min(row.px, 56),
                fontFamily: row.px <= 11 ? 'var(--mono)' : row.px <= 16 ? 'var(--eina)' : 'var(--display)',
                textTransform: row.px <= 11 ? 'uppercase' : 'none',
                letterSpacing: row.px >= 28 ? '-0.03em' : row.px <= 11 ? '0.08em' : '0',
                fontWeight: row.px >= 28 ? 900 : 500,
              }}>{row.txt}</span>
            </div>
          ))}
        </div>

        <Tutorial dark>
          <b>Pair, don’t pile.</b> A headline is NeutralFace; drop one Instrument-Serif
          italic word into it for warmth (<i>PROJ<span style={{ fontStyle: 'italic', fontFamily: 'var(--serif)' }}>ects</span></i>).
          Mono never sets paragraphs - it’s the label voice.
        </Tutorial>
      </Section>

      {/* ═══════════ 03 · PHOTOGRAPHY ═══════════ */}
      <Section index="03" title="Photography" lead="The brand lives on real work - documentary frames wrapped in cream and ink, one accent per picture.">
        {poster && (
          <div className="bp-poster bp-rise">
            <Img className="bp-poster-img" src={sized(poster.image, 'card')} alt={poster.alt} loading="lazy" />
            <div className="bp-poster-grad" />
            <span className="sticker sticker-lemon bp-poster-sticker sticker--diecut" style={{ ['--sticker-ground' as string]: 'var(--paper)' }}>★ since 2021</span>
            <div className="bp-poster-body">
              <span className="bp-photo-tag">{poster.tag}</span>
              <h3 className="bp-poster-title">welfare,<br /><span className="bp-serif">documented.</span></h3>
              {poster.location && <div className="bp-photo-meta">{poster.location}</div>}
            </div>
          </div>
        )}

        {cards.length > 0 && <>
          <div className="bp-block-label bp-rise" style={{ marginTop: 36 }}>Magazine cards</div>
          <div className="bp-photocards">
            {cards.map((p, i) => <PhotoCard key={p.image} p={p} i={i} num={i + 1} />)}
          </div>
        </>}

        {stickerPhotos.length > 0 && <>
          <div className="bp-block-label bp-rise" style={{ marginTop: 40 }}>Stickers, in the field</div>
          <div className="bp-stickerframes">
            {stickerPhotos.map((p, i) => (
              <figure key={p.image} className="bp-stickerframe bp-rise" style={{ ['--rd' as string]: `${i * 80}ms` }}>
                <Img ctx="card" src={p.image} alt={p.alt} loading="lazy" />
                <span className={'sticker sticker--diecut ' + (i % 2 ? 'sticker-pink' : 'sticker-mint')}
                  style={{ position: 'absolute', top: 14, left: 14, transform: `rotate(${i % 2 ? 4 : -5}deg)`, ['--sticker-ground' as string]: 'var(--paper)' }}>
                  {i % 2 ? 'good vibes' : '★ on ground'}
                </span>
                <span className="sticker sticker-lemon sticker--diecut"
                  style={{ position: 'absolute', bottom: 14, right: 14, transform: 'rotate(-3deg)', ['--sticker-ground' as string]: 'var(--paper)' }}>
                  {p.tag}
                </span>
              </figure>
            ))}
          </div>
        </>}

        <Tutorial>
          <b>Framing rules.</b> Every photo gets the same recipe: a 16px frame, a hairline
          black outline, a dark gradient rising from the bottom so type stays legible, and
          exactly one sticker or accent. Let the photograph carry the colour.
        </Tutorial>
      </Section>

      {/* ═══════════ 04 · IN THE WILD ═══════════ */}
      <Section index="04" title="In the wild" lead="The full kit, assembled - photography, type, colour and stickers doing their jobs together.">
        <div className="bp-wild">
          {wildCard
            ? <PhotoCard p={wildCard} i={0} num={1} />
            : <article className="bp-card bp-rise"><div className="bp-card-img bp-card-img-fallback" /></article>}

          <article className="bp-announce bp-rise" style={{ ['--rd' as string]: '80ms' }}>
            <div className="bp-photo-tag bp-photo-tag-dark">[ Be a part ]</div>
            <h3 className="bp-announce-title">join the<br /><span className="bp-serif">community.</span></h3>
            <p className="bp-announce-sub">LoRs and certificates for the best. Real work, real impact. Zero fees, always.</p>
            <span className="bp-cta-demo bp-cta-invert">Come do the work with us →</span>
          </article>

          <article className="bp-stats bp-rise" style={{ ['--rd' as string]: '160ms' }}>
            {/* All four from ORG_FACTS (§21.0/§21.4) - saplings, kids and the
                Sundarbans trip count were hand-typed here, DRIVES already was
                not. No value changed. sundarbansTrips renders raw: it is a
                small exact count, never floored through displayCount(). */}
            {[
              { k: displayCount(ORG_FACTS.saplingsPlanted), v: 'saplings planted' },
              { k: displayCount(ORG_FACTS.childrenReached), v: 'kids reached' },
              { k: DRIVES, v: 'welfare drives' },
              { k: String(ORG_FACTS.sundarbansTrips), v: 'Sundarbans trips' },
            ].map(s => (
              <div key={s.v} className="bp-stat">
                <div className="bp-stat-k"><StatCountUp value={s.k} /></div>
                <div className="bp-stat-v">{s.v}</div>
              </div>
            ))}
          </article>
        </div>

        {mosaic.length > 2 && <>
          <div className="bp-block-label bp-rise" style={{ marginTop: 40 }}>{capitalise(yearsPhrase())}, in frames</div>
          <div className="bp-mosaic">
            {mosaic.map((p, i) => (
              <figure key={p.image} className="bp-mosaic-item bp-rise" style={{ ['--rd' as string]: `${i * 50}ms` }}>
                <Img ctx="card" src={p.image} alt={p.alt} loading="lazy" />
                <figcaption>{p.tag}{p.location ? ` · ${p.location}` : ''}</figcaption>
              </figure>
            ))}
          </div>
        </>}
      </Section>

      {/* ═══════════ 05 · POSTERS ═══════════ */}
      <Section index="05" title="Posters" lead="Real photography, full-bleed or in cute frames - polaroids, taped prints, film strips, stamps - with a few pure-type frames between. Every one is a deliberate composition.">
        <span className="sticker sticker-lemon bp-float-sticker sticker--diecut" style={{ ['--rot' as string]: '-4deg', ['--sticker-ground' as string]: 'var(--bg)' }}>★ shot on cream</span>
        <div className="bp-posters">
          {(() => {
            const n = Math.max(1, photos.length)
            return POSTERS.reduce<{ off: number; cards: ReactNode[] }>((acc, d, i) => {
              const need = picsNeeded(d.t)
              const pics = Array.from({ length: need }, (_, j) => photos[(acc.off + j) % n])
              return { off: acc.off + need, cards: [...acc.cards, <PosterCard key={i} d={d} i={i} pics={pics} />] }
            }, { off: 0, cards: [] }).cards
          })()}
        </div>
        <Tutorial>
          <b>Infinite from a few parts.</b> Big type, a stat, a quote, an outline, a sticker
          bomb, a colour block - swap the palette and the copy and the system makes a fresh
          poster every time. Constraint is what makes it recognisable.
        </Tutorial>
      </Section>

      {/* ═══════════ 06 · SYSTEM ═══════════
          12.7: the fifth section this specimen page needed - the sticker
          system (13), the concentric radius scale and the paper-on-ink
          ladder (both 00.1/02.2). "A design system page that omits its own
          two spine rules is incomplete." Built after every other page in
          this pass landed, so what's documented here is real - the sticker
          shapes are the live `.sticker--*` classes, not a redrawn mock. */}
      <Section index="06" title="System" lead="The two spine rules and the sticker kit - the parts every other section quietly depends on." dark>
        <div className="bp-block-label bp-rise">Stickers - stamped presses, die-cut doesn't</div>
        <div className="bp-stickerkit bp-rise">
          {STICKER_SHAPES.map((s, i) => (
            <div key={s.shape} className="bp-stickerkit-item" style={{ ['--rd' as string]: `${i * 45}ms` }}>
              <span className={`sticker sticker-mint sticker--${s.shape}${s.diecutOnly ? '' : ' sticker--stamped'}`} style={{ ['--sticker-ground' as string]: 'var(--ink)' }}>
                {s.diecutOnly ? '' : 'AQ'}
              </span>
              <span className="bp-stickerkit-label">{s.label}{s.diecutOnly ? ' · die-cut only (13.2: clip-path drops the keyline)' : ''}</span>
            </div>
          ))}
        </div>
        <p className="bp-system-note bp-rise">
          Three sizes - <code>sm</code> / <code>md</code> / <code>lg</code>. <code>sm</code> sits under the 44px hit-target
          floor, so it is die-cut only; a stamped sticker is always <code>md</code> or larger, in a hit area
          of at least 44px even when the pill itself reads smaller.
        </p>

        <div className="bp-block-label bp-rise" style={{ marginTop: 40 }}>The radius scale - one number, two subtractions</div>
        <div className="bp-radii bp-rise">
          {RADII.map(r => (
            <div key={r.token} className="bp-radius-item">
              <div className="bp-radius-box" style={{ borderRadius: r.px >= 999 ? 999 : r.px }}>
                <span className="bp-radius-px">{r.px}</span>
              </div>
              <div className="bp-radius-name">{r.name}</div>
              <code className="bp-radius-token">{r.token}</code>
              <div className="bp-radius-note">{r.note}</div>
            </div>
          ))}
        </div>
        <p className="bp-system-note bp-rise">
          Only these four exist. A radius that isn’t 999, 32, 22 or 14 is a bug, not a design choice.
        </p>

        <div className="bp-block-label bp-rise" style={{ marginTop: 40 }}>Paper on ink - six rungs, never a seventh</div>
        <div className="bp-ladder bp-rise">
          {INK_LADDER.map(rung => (
            <div key={rung.token} className="bp-ladder-row">
              <span className="bp-ladder-sample" style={{ color: `rgba(244,239,224,${rung.alpha})` }}>Aa</span>
              <span className="bp-ladder-token">{rung.token}</span>
              <span className="bp-ladder-alpha">{rung.alpha.toFixed(2)}</span>
              <span className="bp-ladder-ratio">{rung.ratio.toFixed(1)}:1</span>
              <span className="bp-ladder-use">{rung.use}</span>
            </div>
          ))}
        </div>
        <Tutorial dark>
          <b>Pick a rung, never invent an alpha between them.</b> 0.55 is the floor for text on ink;
          0.50 measures 4.78:1 and quietly passes too, but it isn’t a named rung, so it doesn’t get
          used as one. Below 0.47 fails.
        </Tutorial>
      </Section>

      {/* ═══════════ 07 · LOGO ═══════════ */}
      <Section index="07" title="Logo" lead="Three lockups, real files - click to copy the image straight to your clipboard, or grab the source file.">
        <div className="bp-logo-grid">
          {LOGO_ASSETS.map((l, i) => {
            const copyKey = `logo-${l.name}`
            const isCopied = copied === copyKey
            return (
              <figure key={l.name} className="bp-logo-card bp-rise" style={{ ['--rd' as string]: `${i * 70}ms` }}>
                <div className={'bp-logo-stage' + (l.ground === 'ink' ? ' bp-logo-stage-ink' : '')}>
                  <img src={l.file} alt={`AquaTerra ${l.name.toLowerCase()}`} className="bp-logo-img" loading="lazy" />
                </div>
                <figcaption className="bp-logo-info">
                  <div className="bp-logo-name">{l.name}</div>
                  <div className="bp-logo-note">{l.note}</div>
                  <div className="bp-logo-actions">
                    <button type="button" className="bp-logo-btn" onClick={() => copyImage(l.file, l.name, copyKey)}>
                      {isCopied ? <>copied <b className="bp-tick">✓</b></> : 'copy image'}
                    </button>
                    <a className="bp-logo-btn bp-logo-btn-dl" href={l.file} download={`aquaterra-${l.name.toLowerCase().replace(/\s+\+?\s*/g, '-')}.png`}>
                      download
                    </a>
                  </div>
                </figcaption>
              </figure>
            )
          })}
        </div>
        <Tutorial>
          <b>Full-resolution source files.</b> These are the same masters the icon,
          favicon, and social-preview images are all generated from - not a
          downscaled export. If your browser can't copy an image directly (Firefox,
          mainly), the button falls back to copying the file's URL instead.
        </Tutorial>
      </Section>

      {/* ═══════════ 08 · MASCOTS ═══════════
          The cast (lib/mascotCast.ts) is pure CSS - no image, no SVG, no icon
          font, which is exactly why it belongs on a page about the *system*
          rather than assets. Tap any character to step through its poses. */}
      <Section index="08" title="Mascots" lead="Six characters, eight poses, four sizes - every one a border-radius box, nothing else. Tap one to see it move." dark>
        <div className="bp-mascot-row">
          {CHARACTERS.map((key, i) => {
            const c = CAST[key]
            const pose = mascotPose[key] ?? 'idle'
            const cycle = () => {
              const idx = POSES.indexOf(pose)
              setMascotPose(m => ({ ...m, [key]: POSES[(idx + 1) % POSES.length] }))
            }
            return (
              <button key={key} type="button" className="bp-mascot-card bp-rise" style={{ ['--rd' as string]: `${i * 60}ms` }} onClick={cycle} title={`tap for the next pose (currently ${pose})`}>
                <span className="bp-mascot-stage">
                  <Mascot character={key} pose={pose} size={64} />
                </span>
                <span className="bp-mascot-name" style={{ color: c.hue }}>{c.name}</span>
                <span className="bp-mascot-desk">{c.desk} · {c.temperament}</span>
                <span className="bp-mascot-pose">{pose}</span>
              </button>
            )
          })}
        </div>

        <div className="bp-block-label bp-rise" style={{ marginTop: 40 }}>Size ladder - four steps, nothing between</div>
        <div className="bp-mascot-sizes bp-rise">
          {SIZES.map(sz => (
            <div key={sz} className="bp-mascot-size">
              <Mascot character="nolen" pose="idle" size={sz} />
              <span className="bp-mascot-size-label">{sz}px</span>
            </div>
          ))}
        </div>

        <Tutorial dark>
          <b>A character always looks like itself.</b> Callers only ever pick a
          character (or a seed, so a member's mascot is stable) and a pose - never
          body, eyes, mouth or limbs directly. That configuration lives once in
          <code> lib/mascotCast.ts</code>, which is also what lets every mascot
          recolour from the palette with zero image assets.
        </Tutorial>
      </Section>

      {/* ═══════════ COLOPHON (easter egg) ═══════════ */}
      <footer className="bp-colophon bp-reveal">
        <div className="bp-colophon-row bp-rise">
          <span>MADE ON CREAM</span>
          <span className="bp-dash" />
          <span>#F4EFE0 + #0A0A0A + ONE LOUD THING</span>
          <span className="bp-dash" />
          <span>AQUATERRA · 2021-</span>
        </div>
        <button className="bp-colophon-big bp-rise" onClick={cycleAccent} title="tap to recolour the accent" style={{ ['--rd' as string]: '80ms' }}>
          AQUA<span style={{ color: accentHex, transition: 'color 0.45s cubic-bezier(.2,.7,.2,1)' }}>TERRA</span>
          <span style={{ color: accentHex, transition: 'color 0.45s cubic-bezier(.2,.7,.2,1)' }}>.</span>
        </button>
        <div className="bp-colophon-hint bp-rise" style={{ ['--rd' as string]: '160ms' }}>
          accent → <b style={{ color: accentHex }}>{accentName} {accentHex}</b> · tap the wordmark to cycle
        </div>
      </footer>

      {/* ═══════════ EXPORT ═══════════ */}
      <div className="bp-export bp-reveal in">
        <button className="bp-export-btn" onClick={handleExportPdf}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export this page as PDF
        </button>
        <div className="bp-export-note">opens your browser’s print dialog - choose “Save as PDF”.</div>
      </div>
    </div>
  )
}

/* ───────────────────────── sub-components ───────────────────────── */

function Section({ index, title, lead, children, dark }: {
  index: string; title: string; lead: string; children: ReactNode; dark?: boolean
}) {
  return (
    <section className={'bp-section bp-reveal' + (dark ? ' bp-section-dark' : '')}>
      <div className="bp-section-head">
        <span className="bp-section-idx bp-rise">{index}</span>
        <div>
          <h2 className="bp-section-title bp-rise" style={{ ['--rd' as string]: '60ms' }} data-toc data-toc-title={title}>{title}</h2>
          <p className="bp-section-lead bp-rise" style={{ ['--rd' as string]: '120ms' }}>{lead}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function SwatchCard({ s, i, copied, onCopy }: {
  s: Swatch; i: number; copied: string | null; onCopy: (t: string, k: string) => void
}) {
  const isCopied = copied === s.hex
  return (
    <button className="bp-swatch bp-rise" style={{ ['--rd' as string]: `${i * 55}ms` }}
      onClick={() => onCopy(s.hex, s.hex)} title="Click to copy hex">
      <div className="bp-swatch-chip" style={{ background: s.hex, color: s.fg }}>
        <span className="bp-swatch-hint">click to copy</span>
        <span className="bp-swatch-hexbig">{isCopied ? <>copied <b className="bp-tick">✓</b></> : s.hex}</span>
      </div>
      <div className="bp-swatch-info">
        <div className="bp-swatch-name">{s.name}</div>
        <div className="bp-swatch-note">{s.note}</div>
      </div>
    </button>
  )
}

function TypeSpec({ role, token, family, sample, note, italic, mono }: {
  role: string; token: string; family: string; sample: string; note: string; italic?: boolean; mono?: boolean
}) {
  return (
    <div className="bp-spec">
      <div className="bp-spec-aa" style={{ fontFamily: `var(${token})`, fontStyle: italic ? 'italic' : 'normal' }}>Aa</div>
      <div className="bp-spec-meta">
        <div className="bp-spec-role">{role}</div>
        <div className="bp-spec-fam">{family}</div>
      </div>
      <div className="bp-spec-sample" style={{
        fontFamily: `var(${token})`, fontStyle: italic ? 'italic' : 'normal',
        textTransform: mono ? 'uppercase' : 'none',
        letterSpacing: mono ? '0.06em' : role === 'Display' ? '-0.03em' : '0',
        fontWeight: role === 'Display' ? 900 : 500,
      }}>{sample}</div>
      <div className="bp-spec-note">{note}</div>
    </div>
  )
}

function PhotoCard({ p, i, num }: { p: Photo; i: number; num: number }) {
  return (
    <article className="bp-card bp-rise" style={{ ['--rd' as string]: `${i * 70}ms` }}>
      <div className="bp-card-img">
        <Img className="bp-card-photo" src={sized(p.image, 'card')} alt={p.alt} loading="lazy" />
        <div className="bp-card-num">#{String(num).padStart(3, '0')}</div>
        <div className="bp-card-grad" />
        <div className="bp-card-body">
          <span className="bp-photo-tag">{p.tag}</span>
          <h3 className="bp-card-title">{p.header}</h3>
          {(p.location || p.stat) && <div className="bp-photo-meta">{[p.location, p.stat].filter(Boolean).join(' · ')}</div>}
        </div>
      </div>
    </article>
  )
}

function Tutorial({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <div className={'bp-tut bp-rise' + (dark ? ' bp-tut-dark' : '')}>
      <span className="bp-tut-mark">TIP</span>
      <p>{children}</p>
    </div>
  )
}

/* ───────────────────── colour combinations ───────────────────── */
// [colour A, colour B, name, when-to-use]
const COMBOS: [string, string, string, string][] = [
  ['var(--welfare)', 'var(--lemon)', 'Mint + Lemon', 'the default duo'],
  ['var(--ink)', 'var(--lemon)', 'Ink + Lemon', 'max-contrast CTA'],
  ['var(--accent)', 'var(--ink)', 'Pink + Ink', 'editorial pop'],
  ['var(--grape)', 'var(--lemon)', 'Grape + Lemon', 'paradox energy'],
  ['var(--sky)', 'var(--ink)', 'Sky + Ink', 'calm & clear'],
  ['var(--tomato)', 'var(--bg)', 'Tomato + Cream', 'warm alarm'],
  ['var(--welfare)', 'var(--accent)', 'Mint + Pink', 'playful clash'],
  ['var(--bg)', 'var(--ink)', 'Cream + Ink', 'the foundation'],
]

function Combo({ a, b, name, note, i }: { a: string; b: string; name: string; note: string; i: number }) {
  return (
    <div className="bp-combo bp-rise" style={{ ['--rd' as string]: `${i * 45}ms` }}>
      <div className="bp-combo-swatch">
        <span style={{ background: a }} />
        <span style={{ background: b }} />
      </div>
      <div className="bp-combo-info">
        <div className="bp-combo-name">{name}</div>
        <div className="bp-combo-note">{note}</div>
      </div>
    </div>
  )
}

/* ───────────────────── poster generator ───────────────────── */
// 10 brand palettes: [background, foreground, accent]
//
// CONTRAST (DESIGN.md §2). This table is the single source of every `bpp-*`
// foreground on the poster wall, so it is the only place the wall's contrast
// can be fixed once. Five of the ten rows set a foreground §2's own table
// marks FAIL, and each failure reached ~9 rendered posters at 9-11px:
//
//   [2] welfare  fg #06140d  4.34:1  -> var(--ink)  4.55:1
//   [4] accent   fg #22000c  4.50:1  -> var(--ink)  4.55:1   (--accent IS welfare)
//   [6] grape    fg #f4efe0  3.78:1  -> var(--ink)  4.55:1
//   [7] tomato   fg #f4efe0  2.88:1  -> var(--ink)  6.71:1
//   [9] #06140d  fg welfare  4.34:1  -> var(--bg)  15.1:1
//
// Rows [2] [4] [6] [7] all resolve to the same rule - "text on a saturated
// accent fill is ALWAYS full-opacity ink" - and the two hand-mixed
// near-blacks (#06140d, #22000c) were colour-mix-toward-black patches of
// exactly the kind styles/routes/director.css removed from .adm-status for
// the same reason. Row [9] inverts: on a near-black ground the raw hue is the
// text, so it takes paper instead. #04101e on sky (row [5]) already measures
// 8.6:1 and is left alone.
const PAL: [string, string, string][] = [
  ['var(--bg)', 'var(--ink)', 'var(--welfare)'],
  ['var(--ink)', 'var(--bg)', 'var(--lemon)'],
  // accent was --lemon: 2.78:1 on welfare, which misses even the 3:1 large-text
  // bar the type-only posters (.bpp-num at 98px, the stack's 56px words) rely
  // on. Paper is 3.32:1 on welfare - the one value §2 measures as clearing it.
  ['var(--welfare)', 'var(--ink)', 'var(--bg)'],
  ['var(--lemon)', 'var(--ink)', 'var(--tomato)'],
  ['var(--accent)', 'var(--ink)', '#ffffff'],
  ['var(--sky)', '#04101e', 'var(--ink)'],
  ['var(--grape)', 'var(--ink)', 'var(--lemon)'],
  ['var(--tomato)', 'var(--ink)', 'var(--lemon)'],
  ['var(--bg-2)', 'var(--ink)', 'var(--accent)'],
  ['#06140d', 'var(--bg)', 'var(--lemon)'],
]

type PosterT =
  | 'editorial' | 'cover' | 'statshot' | 'quoteshot'   // full-bleed photo
  | 'polaroid' | 'taped' | 'window' | 'circle' | 'filmstrip' | 'stamp' // cute frames
  | 'mega' | 'stat' | 'stack' | 'serifquote'           // type-only
type Poster = { t: PosterT; p: number; a?: string[]; s?: string; k?: string; v?: string; m?: string; tag?: string; lines?: string[] }

const PHOTO_T = new Set<PosterT>(['editorial', 'cover', 'statshot', 'quoteshot', 'polaroid', 'taped', 'window', 'circle', 'filmstrip', 'stamp'])
const picsNeeded = (t: PosterT) => (t === 'filmstrip' ? 3 : PHOTO_T.has(t) ? 1 : 0)

// 28 curated posters - photography-forward (full-bleed or cute frames) with a
// few pure-type frames for rhythm. Each is a deliberate composition.
const POSTERS: Poster[] = [
  { t: 'editorial', p: 0, tag: 'WELFARE', k: 'on the\nground.', m: 'kolkata · since 2021' },
  { t: 'polaroid', p: 1, v: 'sundarbans, ’23' },
  { t: 'mega', p: 2, k: 'grow.', m: `${SAPLINGS} saplings` },

  { t: 'window', p: 3, k: 'PLANT' },
  { t: 'statshot', p: 4, k: noPlus(DRIVES), v: 'welfare drives' },
  { t: 'stack', p: 5, a: ['REAL', 'WORK', 'ZERO', 'FEES'], m: '★ student-led' },

  { t: 'cover', p: 9, lines: [`${DRIVES} drives`, 'zero fees', 'open access'], v: 'ISSUE 06' },
  { t: 'taped', p: 6, v: 'feeding drive' },
  { t: 'serifquote', p: 7, s: 'why? why not.', v: '- the founders' },

  { t: 'circle', p: 8, k: 'teach.' },
  { t: 'filmstrip', p: 0, v: yearsPhrase() },
  { t: 'stat', p: 1, k: noPlus(MEMBERS), v: 'members strong', m: 'kolkata born' },

  { t: 'quoteshot', p: 2, s: 'leave it greener.', v: 'sundarbans 8.0' },
  { t: 'stamp', p: 3, v: 'kolkata', m: '₹0' },
  { t: 'mega', p: 4, k: 'rise.', m: 'real work, real impact' },

  { t: 'editorial', p: 5, tag: 'DISTRIBUTION', k: '1000 kgs\ndonated.', m: 'goonj × aquaterra' },
  { t: 'polaroid', p: 6, v: 'workshop kids' },
  { t: 'window', p: 7, k: 'Crftd' },

  { t: 'statshot', p: 8, k: '8', v: 'sundarbans trips' },
  { t: 'taped', p: 9, v: 'plantation day' },
  { t: 'stack', p: 2, a: ['PLANT', 'FEED', 'TEACH'], m: `★ ${DRIVES} drives` },

  { t: 'cover', p: 4, lines: ['paradox 3.0', '300 attendees', 'annual fest'], v: 'EVENTS' },
  { t: 'circle', p: 1, k: 'feed.' },
  { t: 'serifquote', p: 0, s: 'show up. stand out.', v: '- the handbook' },

  { t: 'filmstrip', p: 3, v: 'in the field' },
  { t: 'stamp', p: 5, v: 'sundarbans', m: 'EST 2021' },
  { t: 'quoteshot', p: 6, s: 'real work, real impact.', v: 'every drive' },
  { t: 'editorial', p: 7, tag: 'PLANTATION', k: 'leave it\ngreener.', m: `${SAPLINGS} saplings` },
]

function Pic({ photo, className, alt = '' }: { photo?: Photo; className?: string; alt?: string }) {
  return photo?.image
    ? <Img className={className} src={sized(photo.image, 'card')} alt={alt} loading="lazy" />
    : <div className={(className || '') + ' bpp-noimg'} />
}

function PosterCard({ d, i, pics }: { d: Poster; i: number; pics: Photo[] }) {
  const [bg, fg, ac] = PAL[d.p]
  const vars = { background: bg, color: fg, ['--pac' as string]: ac, ['--pfg' as string]: fg, ['--pbg' as string]: bg, ['--rd' as string]: `${(i % 6) * 45}ms` } as React.CSSProperties
  const p0 = pics[0]

  return (
    <div className={`bp-poster-card bpt-${d.t} bp-rise`} style={vars} aria-hidden>

      {/* ── full-bleed photo ── */}
      {d.t === 'editorial' && <>
        <Pic photo={p0} className="bpp-photo" />
        <div className="bpp-photo-grad" />
        {d.tag && <span className="bpp-chip bpp-chip-photo">{d.tag}</span>}
        <div className="bpp-photo-foot">
          <div className="bpp-photo-title">{d.k}</div>
          {d.m && <div className="bpp-photo-meta">{d.m}</div>}
        </div>
      </>}

      {d.t === 'cover' && <>
        <Pic photo={p0} className="bpp-photo" />
        <div className="bpp-cover-grad" />
        <div className="bpp-cover-mast">AQUA<span>TERRA</span></div>
        <div className="bpp-cover-lines">{d.lines!.map((l, j) => <span key={j}>{l}</span>)}</div>
        <span className="bpp-cover-issue">{d.v}</span>
      </>}

      {d.t === 'statshot' && <>
        <Pic photo={p0} className="bpp-photo" />
        <div className="bpp-scrim" />
        <div className="bpp-shot-num">{d.k}</div>
        <div className="bpp-shot-lbl">{d.v}</div>
      </>}

      {d.t === 'quoteshot' && <>
        <Pic photo={p0} className="bpp-photo" />
        <div className="bpp-scrim" />
        <span className="bpp-shot-q">“</span>
        <div className="bpp-shot-quote">{d.s}</div>
        {d.v && <div className="bpp-shot-attr">- {d.v}</div>}
      </>}

      {/* ── cute frames ── */}
      {d.t === 'polaroid' && (
        <figure className="bpp-polaroid">
          <Pic photo={p0} className="bpp-polaroid-img" />
          <figcaption className="bpp-polaroid-cap">{d.v}</figcaption>
        </figure>
      )}

      {d.t === 'taped' && (
        <figure className="bpp-taped">
          <span className="bpp-tape bpp-tape-1" />
          <span className="bpp-tape bpp-tape-2" />
          <Pic photo={p0} className="bpp-taped-img" />
          <figcaption className="bpp-taped-cap">{d.v}</figcaption>
        </figure>
      )}

      {d.t === 'window' && <>
        <div className="bpp-window"><Pic photo={p0} className="bpp-window-img" /></div>
        <div className="bpp-window-label">{d.k}</div>
        <span className="bpp-window-mono">aquaterra · welfare</span>
      </>}

      {d.t === 'circle' && <>
        <div className="bpp-circle"><Pic photo={p0} className="bpp-circle-img" /></div>
        <div className="bpp-circle-word">{d.k}</div>
      </>}

      {d.t === 'filmstrip' && (
        <div className="bpp-filmstrip">
          {[0, 1, 2].map(j => <div key={j} className="bpp-film-frame"><Pic photo={pics[j]} className="bpp-film-img" /></div>)}
          <span className="bpp-film-label">{d.v}</span>
        </div>
      )}

      {d.t === 'stamp' && (
        <figure className="bpp-stamp">
          <Pic photo={p0} className="bpp-stamp-img" />
          <figcaption className="bpp-stamp-foot">
            <span className="bpp-stamp-name">AQUATERRA</span>
            <span className="bpp-stamp-loc">{d.v}</span>
            <span className="bpp-stamp-val">{d.m}</span>
          </figcaption>
        </figure>
      )}

      {/* ── type only ── */}
      {d.t === 'mega' && <>
        <div className="bpp-mega">{d.k}</div>
        {d.m && <div className="bpp-foot">{d.m}</div>}
        <span className="bpp-corner">AQ</span>
      </>}

      {d.t === 'stat' && <>
        <span className="bpp-bar" />
        <div className="bpp-num">{d.k}</div>
        <div className="bpp-sub">{d.v}</div>
        {d.m && <div className="bpp-foot">{d.m}</div>}
      </>}

      {d.t === 'stack' && <>
        <div className="bpp-stack">{d.a!.map((w, j) => <span key={j} style={{ color: j % 2 ? ac : fg }}>{w}</span>)}</div>
        {d.m && <div className="bpp-foot">{d.m}</div>}
      </>}

      {d.t === 'serifquote' && <>
        <span className="bpp-qmark">“</span>
        <div className="bpp-serifquote">{d.s}</div>
        <span className="bpp-rule" />
        {d.v && <div className="bpp-foot">{d.v}</div>}
      </>}
    </div>
  )
}

