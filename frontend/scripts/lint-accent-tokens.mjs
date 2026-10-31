#!/usr/bin/env node
/**
 * lint-accent-tokens.mjs — DESIGN.md §2, mechanised.
 *
 *   "An accent hue is a FILL, never text on cream."
 *   "Text on a saturated accent fill is ALWAYS full-opacity ink."
 *   "Each hue has an --*-ink partner for when it must be text."
 *
 * DESIGN.md says that one rule explains four of its five worst recorded
 * defects. It has since been re-broken by per-instance patching six separate
 * times (the /directory + /teams + TeamDetailPage triplicated dark-fill check
 * that rendered Crftd at 1.00:1; adminKit's `custom` tone at 2.08:1; the
 * .adm-status built-ins at 3.32–4.42:1; BlogListPage 3.77:1; LabsPage.css
 * 3.42:1; FAQPage 2.73:1; and /brand — the page that documents the rule —
 * across 5 of 10 poster palettes). This script is what stops the seventh.
 *
 * ── WHY A STANDALONE NODE SCRIPT, AND NOT ESLINT / STYLELINT ────────────────
 * The violations live in TWO syntaxes at once: JSX inline
 * `style={{ color: 'var(--pink)' }}` (the majority) and plain `.css`
 * `color: var(--pink)`.
 *   · An ESLint rule sees the JSX and is blind to every .css file.
 *   · A Stylelint rule sees the .css and is blind to every inline style.
 *   · Doing both means TWO new dev dependencies and TWO implementations of the
 *     same exemption model — which is precisely the failure mode that re-broke
 *     this rule six times: N copies of one check, patched individually.
 *   · Extending scripts/audit-design.sh was considered and rejected. Its rule
 *     §4 is already this check as a plain grep, with no exemption model: it
 *     reports ~171 hits of which almost all are legal. The file also already
 *     exits non-zero on ~15 unrelated rules, so a new rule inside it can never
 *     "fail loudly"; it sits at repo root outside frontend/package.json; and
 *     bash cannot compute a contrast ratio.
 * One script, zero new dependencies, both syntaxes, ONE exemption model, and
 * real WCAG arithmetic — which is the difference between a lint rule and a
 * grep.
 *
 * ── WHAT THIS CHECKS vs. WHAT IT MERELY FLAGS ──────────────────────────────
 * CHECKED (hard failure): a raw accent token or accent hex in a `color:`
 *   position whose ground is resolvable and is LIGHT.
 * CHECKED (hard failure): an accent as text on a resolvable DARK ground that
 *   still measures under 4.5:1 — legal by ground, illegal by arithmetic.
 * FLAGGED, NOT FAILED (review section): a `color:` whose ground this script
 *   cannot resolve — the ground lives on an ancestor element, in another file,
 *   or arrives through a variable. A static checker cannot resolve a computed
 *   ground and this one does not pretend to.
 * NOT REPORTED AT ALL, BY DESIGN: an accent inside a data object (a hue table
 *   such as departments.ts, BrandPage's PAL[], CAT_COLORS). Those are FILL
 *   DEFINITIONS, not text colours, and are legal. See isInsideStyleObject().
 *
 * Run:  npm run lint:accent
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const SRC = join(ROOT, 'src')

/* ── the accent hues, by token name and by literal hex ─────────────────────
   These are FILLS. Each has an --*-ink partner which is always legal as text
   and is deliberately absent from this list. */
const ACCENT_TOKENS = [
  'pink', 'lemon', 'sky', 'grape', 'teal', 'tomato', 'welfare', 'events',
  'labs', 'ops', 'content', 'c-events', 'c-welfare', 'c-labs', 'c-ops',
  'c-content', 'accent', 'danger', 'rust', 'danger-lift',
  /* THE INK TOKENS ARE IN THIS LIST ON PURPOSE.
     The worst of the six historical defects was not an accent at all: after a
     palette change, /directory's and /teams' duplicated dark-fill checks left
     the Crftd tile rendering `color: var(--ink)` on `background: var(--ink)`
     — 1.00:1, an invisible black rectangle on a live public page — and
     TeamDetailPage.tsx's third copy of the check did the same in its hero.
     An earlier draft of this list held only the accents, and a reintroduction
     test showed it sailed straight past that defect. Since the verdict here is
     the MEASURED RATIO and not the token's name, ink-on-cream passes trivially
     (18.3:1) and costs nothing, while ink-on-ink fails at 1.00:1 and is
     caught. Do not remove these. */
  'ink', 'ink-2', 'ink-3', 'paper-ink', 'txt', 'txt-2', 'txt-3',
]
const ACCENT_HEXES = [
  '#FF4D8C', '#FFC700', '#3DA9FC', '#7E5BFF', '#12909C', '#FF4D2E',
  '#1B8A5A', '#C4231A', '#FF6B4D',
]

/* ── tokens.css → hex, following var() aliases ──────────────────────────── */
const normHex = (h) => {
  let s = h.replace('#', '')
  if (s.length === 3) s = s.split('').map((c) => c + c).join('')
  return '#' + s.toUpperCase()
}

function loadTokens() {
  const css = readFileSync(join(SRC, 'styles', 'tokens.css'), 'utf8')
  const raw = new Map()
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;}]+);/gi)) {
    if (!raw.has(m[1])) raw.set(m[1], m[2].trim()) // first (:root) definition wins
  }
  const resolve = (name, depth = 0) => {
    if (depth > 8) return null
    const v = raw.get(name)
    if (!v) return null
    const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})\b/i)
    if (hex) return normHex(hex[0])
    const alias = v.match(/^var\((--[a-z0-9-]+)\)$/i)
    if (alias) return resolve(alias[1], depth + 1)
    return null // color-mix(), rgba(), gradients — not a flat colour
  }
  const out = new Map()
  for (const k of raw.keys()) {
    const h = resolve(k)
    if (h) out.set(k, h)
  }
  return out
}

/* ── WCAG relative luminance + contrast ─────────────────────────────────── */
function lum(hex) {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}
function contrast(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const TOK = loadTokens()
const hexOf = (name) => TOK.get(name) || null

/* A ground is DARK when full-strength ink is unreadable on it — i.e. it is a
   dark slab, and an accent is one of the few things that CAN be legible on
   it. That is the exact condition DESIGN.md permits accent-as-text under. */
const INK = hexOf('--ink') || '#0A0A0A'
const isDarkGround = (hex) => contrast(INK, hex) < 4.5

/* Dark grounds this script recognises by literal form. Anything that resolves
   through tokens.css is handled automatically; these cover the functional and
   literal forms tokens.css cannot answer for. */
const DARK_LITERALS = [
  /var\(--ink(-2)?\)/i,
  /var\(--paper-ink\)/i,
  /var\(--ink-slab\)/i,
  /#0a0a0a\b/i,
  /#1a1a1a\b/i,
  /#111\b/i,
  /#000\b/i,
  /rgba?\(\s*10\s*,\s*10\s*,\s*10\s*[,)]/i,
  /rgba?\(\s*0\s*,\s*0\s*,\s*0\s*[,)]/i,
]

/* ── TWO SIGNALS THAT ARE NOT A TEXT-ON-CREAM VIOLATION ─────────────────────

   1. THE ink-GROUND NAMING CONVENTION, which this codebase already uses
      consistently and self-documentingly:
        .ep-slab--ink { background: var(--ink) }   .ep-h--ink { color: … }
        .ab-story-h-onink { color: var(--paper) }  .ab-story-h-em-onink { … }
        .lab-ink { background: var(--ink) }        .lab-ink-year { … }
      The ground sits on a PARENT element in the JSX, so no ancestor walk can
      reach it from the CSS file — but the name says it outright. A first pass
      of the sweep swapped six of these to their --*-ink partners and made them
      WORSE; AboutPage.css:181 even carries a measured comment saying so:
      "--welfare-ink is tuned for text on PAPER (3.20:1 on ink). The bright hue
      is 4.55:1 on ink, so the ink variant of this heading takes it."
      Treat the name as the ground it declares itself to be.

   2. A `color:` THAT IS NOT PAINTING GLYPHS. `color` on a decorative
      `.halftone` overlay at opacity 0.1, or on an `<svg stroke="currentColor">`
      line drawing, is a FILL routed through currentColor — the same category
      DESIGN.md explicitly permits. Darkening those to an ink partner changes
      artwork, not legibility. */
const INK_GROUND_NAME = /(?:--ink\b|-onink\b|-on-ink\b|\bink-slab\b|\.lab-ink\b|\bis-onink\b|\bon-ink\b)/i
const NOT_GLYPHS = /halftone|stroke\s*[:=]\s*['"]?currentColor|<svg|WebkitTextStroke/i

/* ── the exemption pragma ───────────────────────────────────────────────────
   `accent-lint-ok: <reason>` on the offending line or the line above. The
   reason is MANDATORY — a bare pragma is itself reported as an error, so an
   exemption can never become a silent escape hatch. This is deliberately NOT
   a file-level skip: /brand's `.bp-inkpair-fail` chips break the rule ON
   PURPOSE, as the failing half of a documented demonstration, and every other
   check in this file must keep applying to that file. */
const PRAGMA = /accent-lint-ok:\s*(\S[^*\n]*)/

/* ── is this `color:` a real style declaration, or data? ────────────────────
   In a .ts/.tsx file, `color: 'var(--pink)'` is only a TEXT COLOUR when it
   sits inside a style object. Inside a plain data object — departments.ts's
   hue table, BrandPage's PAL[], CAT_COLORS — it is a FILL DEFINITION and is
   legal by DESIGN.md. Resolve this structurally rather than by naming
   convention: walk out from the `color:` through the enclosing brace chain
   and ask whether any enclosing brace was opened by `style={{`, `style:` or a
   CSSProperties-typed declaration. */
function isInsideStyleObject(text, idx) {
  let depth = 0
  for (let i = idx; i >= 0; i--) {
    const c = text[i]
    if (c === '}') depth++
    else if (c === '{') {
      if (depth > 0) { depth--; continue }
      const before = text.slice(Math.max(0, i - 90), i)
      if (/style\s*=\s*\{\s*$/.test(before)) return true // style={{ … }}
      if (/\bstyle\s*:\s*$/.test(before)) return true // { style: { … } }
      if (/CSSProperties[^=]*=\s*$/.test(before)) return true // typed const
      // otherwise keep walking outward — style={{ a: { color } }} is still style
    }
  }
  return false
}

/* ── the ground for a hit ───────────────────────────────────────────────────
   CSS: the nearest enclosing rule block's own background declaration.
   TS/TSX: the enclosing style object's own background declaration.
   Returns { hex } | { literalDark } | null (= unresolvable). */
function blockStart(text, idx) {
  let depth = 0
  for (let i = idx; i >= 0; i--) {
    if (text[i] === '}') depth++
    else if (text[i] === '{') { if (depth === 0) return i; depth-- }
  }
  return null
}
function blockEnd(text, open) {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') { depth--; if (depth === 0) return i }
  }
  return text.length
}
function bgIn(block, isCss) {
  const bg = block.match(
    isCss
      ? /background(?:-color)?\s*:\s*([^;}]+)/i
      : /background(?:Color)?\s*:\s*(?:'([^']+)'|"([^"]+)"|`([^`]+)`)/,
  )
  return bg ? (bg[1] || bg[2] || bg[3] || '').trim() : null
}

/* The ground for a hit, in three escalating steps:
     1. the declaration's OWN block / style object;
     2. an ANCESTOR — for CSS, the background on any prefix of the rule's own
        selector chain (`.dark-panel .label` -> `.dark-panel`); for TSX, the
        nearest enclosing `style={{ … }}` at a shallower JSX indent;
     3. failing both, the DEFAULT: DESIGN.md's ground stack is "cream page ->
        white card -> cream well -> white chip". Every default surface in this
        app is light, and a dark slab always declares its own background — so
        an undeclared ground is a light ground. We evaluate against BOTH --card
        and --bg and condemn only if the accent fails on both.
   Step 3 is what gives the rule teeth: without it 153 of 154 sites resolve to
   "unknown" and the check catches nothing. The pragma covers the residue. */
function findGround(text, idx, isCss, lines, lineNo) {
  const open = blockStart(text, idx)
  if (open == null) return null
  let val = bgIn(text.slice(open, blockEnd(text, open)), isCss)

  if (!val) val = ancestorBg(text, open, isCss, lines, lineNo)

  if (!val) {
    const over = [hexOf('--card') || '#FFFFFF', hexOf('--bg') || '#F4EFE0']
    return { candidates: over, val: 'undeclared', inherited: true }
  }
  /* A dark ground is RESOLVED, never short-circuited. An earlier draft
     returned `{ literalDark: true }` here and skipped the measurement — which
     made `background: var(--ink); color: var(--ink)` legal, i.e. it whitelisted
     the exact 1.00:1 invisible-tile defect this script exists to catch. Dark
     grounds get measured like every other ground; they are merely exempt from
     the "never on cream" clause, not from the 4.5:1 floor. */
  /* rgba() WITH AN ALPHA IS NOT ITS BASE COLOUR.
     `background: rgba(10,10,10,0.1)` is a 10%-ink PILL on a light card, not an
     ink slab. Treating it as solid #0A0A0A reported seven live sites
     (CreatePostModal's chip-remove buttons, SearchPage, demo.css,
     family01Moments) as 1.00:1 invisible text when they in fact measure ~17:1.
     Composite it over the light stack instead, exactly as with color-mix. */
  const rgba = val.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/i)
  if (rgba) {
    const a = normHex('#' + [1, 2, 3].map((i) => (+rgba[i]).toString(16).padStart(2, '0')).join(''))
    const p = parseFloat(rgba[4])
    if (p >= 0.97) return { hex: a, val }
    const over = [hexOf('--card') || '#FFFFFF', hexOf('--bg') || '#F4EFE0']
    return { candidates: over.map((b) => blend(a, b, p)), val, assumed: true }
  }
  if (!flat(val) && DARK_LITERALS.some((re) => re.test(val))) {
    return { hex: hexOf('--ink') || '#0A0A0A', val }
  }

  /* color-mix(in srgb, <accent> N%, <base>) — the tint. This form is NOT a
     side case: it is the exact shape of two of the six historical defects
     (adminKit's `custom` tone, and .adm-status's built-ins putting an accent
     label on a 22% tint of ITSELF). Resolving it is most of the value here. */
  const mix = val.match(
    /color-mix\(\s*in\s+srgb\s*,\s*([^,]+?)\s+([\d.]+)%\s*,\s*([^)]+?)\s*\)/i,
  )
  if (mix) {
    const a = flat(mix[1])
    const p = parseFloat(mix[2]) / 100
    const baseRaw = mix[3].trim()
    if (!a) return null
    if (/^transparent$/i.test(baseRaw)) {
      /* Composited over "whatever is behind". DESIGN.md's stack is
         cream page -> white card -> cream well, so the ground is one of
         --card or --bg. Evaluate BOTH and fail only if both fail — a
         conservative reading that cannot manufacture a false positive. */
      const over = [hexOf('--card') || '#FFFFFF', hexOf('--bg') || '#F4EFE0']
      return { candidates: over.map((b) => blend(a, b, p)), val, assumed: true }
    }
    const b = flat(baseRaw)
    return b ? { hex: blend(a, b, p), val } : null
  }

  const h = flat(val)
  return h ? { hex: h, val } : null // gradient / rgba alpha -> unresolvable
}
/* ── ancestor grounds ────────────────────────────────────────────────────── */
function ancestorBg(text, open, isCss, lines, lineNo) {
  if (isCss) {
    /* the rule's selector is the text before its `{` on that line */
    const selStart = text.lastIndexOf('\n', open) + 1
    const sel = text.slice(selStart, open).trim()
    /* every proper prefix of the descendant chain, longest first */
    const parts = sel.split(/\s+/).filter((p) => /^[.#][\w-]/.test(p))
    for (let n = parts.length - 1; n >= 1; n--) {
      const anc = parts.slice(0, n).join(' ')
      /* find `<anc> {` or `<anc>:hover {` etc. anywhere in the file */
      const re = new RegExp(
        '(?:^|[,\\n])\\s*' + anc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
          '(?:[:.\\[][^{\\n]*)?\\s*\\{',
        'm',
      )
      const hit = re.exec(text)
      if (hit) {
        const o = text.indexOf('{', hit.index)
        const v = bgIn(text.slice(o, blockEnd(text, o)), true)
        if (v) return v
      }
    }
    return null
  }
  /* TSX: DELIBERATELY NOT ATTEMPTED.
     An indentation-based "nearest shallower style={{ background }}" walk was
     built here and then removed: it cannot tell an ANCESTOR from a SIBLING.
     On RegisterPage.tsx it read the `.sticker` chip's `background:
     var(--welfare)` — a sibling two lines above the <h1> — as the ground for
     the h1's welfare-coloured "?", and reported a 1.00:1 invisible-text
     defect that does not exist. Four such phantom 1.00:1 hits were produced
     before it was pulled.
     A rule that forces wrong fixes is worse than no rule, so for TSX the
     ground is either declared in the style object itself or it falls to the
     documented light default below. */
  void lines; void lineNo
  return null
}

/* a single flat colour out of a token, a hex, or `transparent` */
function flat(raw) {
  const v = raw.trim()
  const tok = v.match(/^var\((--[a-z0-9-]+)\)/i)
  if (tok) return hexOf(tok[1])
  const hx = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})\b/i)
  if (hx) return normHex(hx[0])
  return null
}
/* p of a over b, sRGB, per color-mix(in srgb, …) */
function blend(a, b, p) {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const ch = (sh) => Math.round((((pa >> sh) & 255) * p) + (((pb >> sh) & 255) * (1 - p)))
  return normHex(
    '#' + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join(''),
  )
}

/* ── the scan ───────────────────────────────────────────────────────────── */
/* `(?<![-\w])color` so that border-color, outline-color, background-color,
   text-decoration-color, caret-color and their camelCase twins are NOT
   matched. Only the glyph colour is in scope; a hue on a BORDER is a fill
   edge and is legal. */
const COLOR_DECL = new RegExp(
  String.raw`(?<![-\w])color\s*:\s*(?:'|"|\x60)?\s*(` +
    String.raw`var\(--(?:${ACCENT_TOKENS.join('|')})\)` +
    `|${ACCENT_HEXES.join('|')}` +
    `)`,
  'gi',
)

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'paradox' || e === 'terranotes' || e === 'node_modules') continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx?|css)$/.test(e)) out.push(p)
  }
  return out
}

const violations = []
const review = []
const exempt = []
const badPragmas = []

for (const file of walk(SRC)) {
  const rel = relative(ROOT, file).split(sep).join('/')
  const text = readFileSync(file, 'utf8')
  const isCss = file.endsWith('.css')
  const lines = text.split('\n')

  for (const m of text.matchAll(COLOR_DECL)) {
    const idx = m.index
    const line = text.slice(0, idx).split('\n').length
    const src = lines[line - 1] ?? ''
    const prev = lines[line - 2] ?? ''

    // a data object is a fill definition, not a text colour → legal, unreported
    if (!isCss && !isInsideStyleObject(text, idx)) continue

    const rec = { rel, line, token: m[1], src: src.trim().slice(0, 150) }

    /* The pragma is checked FIRST, deliberately.
       It used to sit below the INK_GROUND_NAME test, which meant an explicit
       exemption could be swallowed by a heuristic before it was ever read - the
       declaration then appeared in NO bucket at all (not a violation, not an
       exemption, not for-review), so it was silently unguarded rather than
       visibly excused. Found 2026-09-10 on AdaptiveGrid.css, where a perfectly
       ordinary justification comment mentioning `var(--ink)` disabled the check
       for the rule beneath it. An exemption must always be visible in the
       ledger; that is the whole point of the reason being mandatory. */
    const pr = src.match(PRAGMA) || prev.match(PRAGMA)
    if (pr) {
      const reason = pr[1].trim().replace(/\*\/\s*$/, '').trim()
      if (reason.length < 8) badPragmas.push(rec)
      else exempt.push({ ...rec, reason })
      continue
    }

    /* the ink-ground naming convention, and colour that is not painting glyphs.
       Comments are stripped from the selector text before the ink-ground test:
       the slice runs back to the previous `}`, so it picks up any comment
       sitting above the declaration, and a comment that merely MENTIONS
       `var(--ink)` is not evidence that this rule's ground is ink. */
    const selLine = isCss
      ? text.slice(text.lastIndexOf('}', idx) + 1, idx).replace(/\/\*[\s\S]*?\*\//g, '')
      : src
    if (INK_GROUND_NAME.test(selLine)) continue
    if (NOT_GLYPHS.test(src)) continue

    // a commented-out declaration is not shipped code
    const t = src.trim()
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue

    const ground = findGround(text, idx, isCss, lines, line)
    const fgTok = m[1].startsWith('var(') ? m[1].slice(4, -1) : null
    const fg = fgTok ? hexOf(fgTok) : normHex(m[1])

    const isInk = /^var\(--(ink|ink-2|ink-3|paper-ink|txt|txt-2|txt-3)\)$/.test(m[1])
    const toReview = (r) => { if (!isInk) review.push(r) } // ink on an unresolvable ground is not interesting; an accent is
    if (!ground) { toReview({ ...rec, why: 'no background in this block — ground is inherited' }); continue }
    if (!fg) { toReview({ ...rec, why: `"${m[1]}" does not resolve to a flat hex` }); continue }

    /* The verdict is the MEASUREMENT, not the token's name. DESIGN.md states
       the rule as "an accent hue is a FILL, never text on cream" because on
       cream every display hue fails; but --danger #C4231A measures 5.83:1 on
       --card and is a legitimate text colour there. Failing it on identity
       alone would force a wrong fix, and a rule that forces wrong fixes is
       worse than no rule. So: fail on the number.
       A DARK ground is exempt from the "never on cream" clause but NOT from
       the floor — accent-on-ink still has to clear 4.5:1. */
    const grounds = ground.candidates || (ground.hex ? [ground.hex] : null)
    if (!grounds) { toReview({ ...rec, why: `ground "${ground.val}" is not a flat colour` }); continue }

    const rs = grounds.map((g) => contrast(fg, g))
    const best = Math.max(...rs)
    if (best >= 4.5) continue // passes on at least one possible ground → legal

    const worstG = grounds[rs.indexOf(Math.min(...rs))]
    violations.push({
      ...rec,
      ground: grounds.join(' / ') + (ground.assumed ? ' (tint composited over --card / --bg)' : ''),
      r: rs.map((x) => x.toFixed(2)).join(' / '),
      kind: isDarkGround(worstG)
        ? 'dark ground, but still under 4.5:1'
        : 'accent as text on a light ground',
    })
  }
}

/* ── the outstanding-debt ledger ────────────────────────────────────────────
   scripts/accent-lint-baseline.json lists REAL violations in files that were
   locked by other agents during the sweep. They are separated from `violations`
   so the build is not permanently red for work this agent was not allowed to
   do — but they are printed loudly every run and the list only shrinks. A
   ledger entry that no longer matches a real hit is itself an error, so the
   file cannot rot. */
let ledger = { outstanding: [] }
try {
  ledger = JSON.parse(readFileSync(join(ROOT, 'scripts', 'accent-lint-baseline.json'), 'utf8'))
} catch { /* no ledger — everything is a hard failure */ }
const key = (v) => `${v.file || v.rel}:${v.line}`
const ledgerKeys = new Set(ledger.outstanding.map(key))
const outstanding = violations.filter((v) => ledgerKeys.has(key(v)))
const stale = ledger.outstanding.filter((e) => !violations.some((v) => key(v) === key(e)))
for (const v of outstanding) violations.splice(violations.indexOf(v), 1)

/* ── report ─────────────────────────────────────────────────────────────── */
const B = (s) => `\x1b[1m${s}\x1b[0m`
console.log(B('\naccent-token lint — DESIGN.md §2: an accent hue is a FILL, never text on cream\n'))

if (violations.length) {
  console.log(B(`x  ${violations.length} violation(s)\n`))
  for (const v of violations) {
    console.log(`   ${v.rel}:${v.line}`)
    console.log(`      ${v.kind} — ${v.token} on ${v.ground} = ${v.r}:1 (floor 4.5)`)
    console.log(`      ${v.src}`)
    console.log('      fix: use the --*-ink partner, or move this onto an ink ground.\n')
  }
} else {
  console.log('ok  0 violations — no accent token reads as text on a resolvable light ground.\n')
}

if (badPragmas.length) {
  console.log(B(`x  ${badPragmas.length} exemption(s) with no usable reason\n`))
  for (const v of badPragmas) console.log(`   ${v.rel}:${v.line}  "accent-lint-ok:" needs a real reason.\n`)
}

if (exempt.length) {
  console.log(B(`.  ${exempt.length} explicit exemption(s)`))
  for (const v of exempt) console.log(`   ${v.rel}:${v.line} — ${v.reason}`)
  console.log()
}

if (review.length) {
  console.log(B(`!  ${review.length} site(s) this checker CANNOT resolve — for human review, not a failure`))
  console.log('   A static checker cannot compute an inherited ground. Each of these is an')
  console.log('   accent in a `color:` position whose background sits on an ancestor element,')
  console.log('   in another file, or behind a variable. Confirm by eye that the ground is ink.\n')
  if (process.argv.includes('--verbose')) {
    for (const v of review) console.log(`   ${v.rel}:${v.line}  ${v.token}  (${v.why})`)
  } else {
    const byFile = new Map()
    for (const v of review) byFile.set(v.rel, (byFile.get(v.rel) || 0) + 1)
    for (const [f, n] of [...byFile].sort((a, b) => b[1] - a[1])) {
      console.log(`   ${String(n).padStart(3)}  ${f}`)
    }
    console.log('\n   (run with --verbose for line numbers)')
  }
  console.log()
}

if (outstanding.length) {
  console.log(B(`!  ${outstanding.length} OUTSTANDING violation(s) — real defects, deferred, see scripts/accent-lint-baseline.json`))
  for (const v of outstanding) {
    const e = ledger.outstanding.find((x) => key(x) === key(v))
    console.log(`   ${v.rel}:${v.line}  ${v.token} = ${v.r}:1  (${e?.owner || 'deferred'})`)
  }
  console.log('   These do NOT fail the build only because another agent owned the file.')
  console.log('   Fix them and delete the ledger entry; the list must only ever shrink.\n')
}
if (stale.length) {
  console.log(B(`x  ${stale.length} stale ledger entr(ies) — no longer a real hit, delete them\n`))
  for (const e of stale) console.log(`   ${e.file}:${e.line}\n`)
}

const fail = violations.length + badPragmas.length + stale.length
console.log(B(fail ? `FAILED — ${fail} problem(s)` : 'PASS'))
process.exit(fail ? 1 : 0)
