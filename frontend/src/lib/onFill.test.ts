import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { INK_HEX, PAPER_HEX, contrastRatio } from './stickerShapes'
import { FILL_HEX, onFill, onFillHex, onFillVar, type FillToken } from './onFill'

/* Section 29 rule 5a has been reintroduced five times on this project by
   patching an instance instead of the component. These tests are the guard:
   they assert the branch against MEASURED contrast, and they assert that the
   CSS token block in styles/tokens.css gives the same answer as the TS module,
   so the two halves of the rule cannot drift apart. */

const ALL = Object.keys(FILL_HEX) as FillToken[]

describe('onFill — the section 29 rule 5a branch', () => {
  it('never returns a colour that fails 4.5:1 on its own fill', () => {
    for (const fill of ALL) {
      const ratio = contrastRatio(onFillHex(fill), FILL_HEX[fill])
      expect(ratio, `${fill} carries ${onFillHex(fill)}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('pins the two pinks apart: --pink passes with ink, --pink-ink does not', () => {
    // #FF4D8C, the display hue. 6.31:1 with ink — it is NOT the problem.
    expect(contrastRatio(INK_HEX, FILL_HEX.pink)).toBeGreaterThan(6)
    expect(onFill('pink')).toBe('var(--ink)')
    // #C4185C, the darkened partner. 3.42:1 with ink, 5.03:1 with paper.
    expect(contrastRatio(INK_HEX, FILL_HEX['pink-ink'])).toBeLessThan(3.55)
    expect(contrastRatio(PAPER_HEX, FILL_HEX['pink-ink'])).toBeGreaterThan(4.9)
    expect(onFill('pink-ink')).toBe('var(--paper)')
  })

  it('takes paper on rust and ink, and ink on every other palette hue', () => {
    expect(onFill('rust')).toBe('var(--paper)')
    expect(onFill('ink')).toBe('var(--paper)')
    expect(onFill('ink-2')).toBe('var(--paper)')
    for (const fill of ['welfare', 'events', 'sky', 'labs', 'lemon', 'ops', 'teal', 'content', 'grape', 'tomato', 'pink'] as FillToken[]) {
      expect(onFill(fill), fill).toBe('var(--ink)')
    }
  })

  it('resolves a var() fill string, and falls back to ink on an unknown one', () => {
    expect(onFillVar('var(--pink-ink)')).toBe('var(--paper)')
    expect(onFillVar('var(--welfare)')).toBe('var(--ink)')
    expect(onFillVar('var(--ink-2)')).toBe('var(--paper)')
    expect(onFillVar('var(--nope)')).toBe('var(--ink)')
    expect(onFillVar('#C4185C')).toBe('var(--ink)')
  })

  it('never returns an alpha: rgba(10,10,10,.6) on welfare is 2.79:1', () => {
    for (const fill of ALL) {
      expect(onFill(fill)).toMatch(/^var\(--(ink|paper)\)$/)
    }
  })
})

describe('the --on-<fill> tokens in styles/tokens.css agree with onFill()', () => {
  const css = readFileSync(fileURLToPath(new URL('../styles/tokens.css', import.meta.url)), 'utf8')

  it('declares an --on-<fill> token for every fill, with the computed value', () => {
    for (const fill of ALL) {
      const re = new RegExp(`--on-${fill}:\\s*var\\(--(ink|paper)\\)`)
      const m = re.exec(css)
      expect(m, `--on-${fill} is not declared in tokens.css`).not.toBeNull()
      expect(`var(--${m![1]})`, `--on-${fill}`).toBe(onFill(fill))
    }
  })

  it('states the keyline exactly once', () => {
    expect(css.match(/--keyline:/g)).toHaveLength(1)
    expect(css).toContain('--keyline: 0 0 0 2px var(--keyline-bg), 0 0 0 4px var(--ink);')
  })

  it('carries the poster gutter at 9px', () => {
    expect(css).toContain('--poster-gutter: 9px;')
  })
})

describe('FILL_HEX matches the palette in styles/tokens.css', () => {
  const css = readFileSync(fileURLToPath(new URL('../styles/tokens.css', import.meta.url)), 'utf8')
  const direct: Partial<Record<FillToken, string>> = {
    welfare: '--c-welfare',
    events: '--c-events',
    labs: '--c-labs',
    ops: '--c-ops',
    content: '--c-content',
    teal: '--teal',
    lemon: '--lemon',
    tomato: '--tomato',
    pink: '--pink',
    'pink-ink': '--pink-ink',
    sky: '--sky',
    grape: '--grape',
    ink: '--ink',
    'ink-2': '--ink-2',
  }

  it('reads the same hex the token file declares', () => {
    for (const [fill, token] of Object.entries(direct) as [FillToken, string][]) {
      const m = new RegExp(`${token}:\\s*(#[0-9A-Fa-f]{6})`).exec(css)
      expect(m, `${token} not found in tokens.css`).not.toBeNull()
      expect(m![1].toUpperCase(), fill).toBe(FILL_HEX[fill].toUpperCase())
    }
  })

  it('keeps --rust an alias of --danger, not a new hue', () => {
    expect(css).toContain('--rust:       var(--danger);')
    expect(/--danger:\s*#C4231A/.test(css)).toBe(true)
    expect(FILL_HEX.rust).toBe('#C4231A')
  })
})
