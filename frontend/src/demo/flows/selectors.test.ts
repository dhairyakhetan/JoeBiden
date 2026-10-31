import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The guard that makes a design change unable to break a walkthrough silently.
 * ────────────────────────────────────────────────────────────────────────────
 * A guided demo spotlights REAL controls on REAL screens, and it finds them the
 * only way anything outside React can: by CSS class, id or aria-label. That is
 * the right design - it means the demo drives the actual product rather than a
 * mock - but it creates one specific, invisible failure mode:
 *
 *     rename `.cp-chiprow` while restyling the composer, ship it, and
 *     post-to-feed's step 2 now points at nothing. Nothing fails to compile.
 *     No test goes red. The next person to open /demo/post-to-feed gets
 *     "lost the spot for a second." and no walkthrough.
 *
 * Every selector below was, until this file existed, a silent dependency from
 * the demo package onto a class name owned by a completely different file.
 * This test makes that dependency explicit and CHECKED: it reads the flow
 * modules, extracts every hook they depend on, and asserts each one still
 * appears somewhere in the source. Rename a class the demos rely on and this
 * goes red in the same run as `npm test`, naming the flow and the selector.
 *
 * WHAT IT DOES AND DOES NOT PROVE.
 * It is a STATIC check: it proves the hook still exists in the codebase, not
 * that it is still rendered at the right moment in the right screen. Only
 * actually driving the flows proves that, which is why this sits alongside
 * that run rather than replacing it. What it buys is the thing a human is
 * worst at: noticing, months later and in an unrelated file, that a class
 * rename had a second consumer.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, '..', '..')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue
      walk(p, out)
    } else if (/\.(tsx|ts|css)$/.test(entry)) {
      out.push(p)
    }
  }
  return out
}

/** Every non-demo source file - the demo package cannot satisfy its own hooks. */
const PRODUCT_SOURCE = walk(SRC)
  .filter(p => !p.includes(`${'demo'}${'/'}`) && !p.includes('\\demo\\'))
  .map(p => readFileSync(p, 'utf8'))
  .join('\n')

const FLOW_DIR = HERE
const FLOW_FILES = readdirSync(FLOW_DIR)
  .filter(f => f.endsWith('.tsx'))
  .map(f => ({ name: f, body: readFileSync(join(FLOW_DIR, f), 'utf8') }))

/**
 * Class hooks the flows rely on, pulled out of their own source rather than
 * hand-listed, so a NEW step's new selector is covered the day it is written
 * instead of the day someone remembers to update this file.
 *
 * Only bare class tokens are extracted. Attribute selectors
 * (`[aria-label^="Apply for"]`), ids and `:is()`-style syntax are deliberately
 * out of scope: an aria-label is prose that legitimately changes wording, and
 * asserting on it here would turn a copy edit into a failed build.
 */
function classHooksIn(body: string): string[] {
  const hooks = new Set<string>()
  // `'.foo .bar button'` / `".cp-sheet #post-body"` inside a querySelector or
  // findByText call - take the class tokens out of the selector string.
  for (const m of body.matchAll(/querySelector(?:All)?<[^>]*>\(\s*'([^']+)'/g)) collect(m[1], hooks)
  for (const m of body.matchAll(/querySelector(?:All)?\(\s*'([^']+)'/g)) collect(m[1], hooks)
  for (const m of body.matchAll(/findByText\(\s*\w+\s*,\s*'([^']+)'/g)) collect(m[1], hooks)
  return [...hooks]
}

function collect(selector: string, into: Set<string>) {
  for (const m of selector.matchAll(/\.([a-zA-Z][\w-]*)/g)) into.add(m[1])
}

describe('guided demos: every class hook still exists in the product', () => {
  const all: { flow: string; hook: string }[] = []
  for (const f of FLOW_FILES) {
    for (const hook of classHooksIn(f.body)) all.push({ flow: f.name, hook })
  }

  it('extracts hooks from every flow (the scan itself works)', () => {
    // If this ever drops to zero the regexes above have silently stopped
    // matching, and every assertion below would vacuously pass.
    expect(all.length).toBeGreaterThan(10)
    expect(new Set(all.map(a => a.flow)).size).toBeGreaterThan(4)
  })

  for (const { flow, hook } of dedupe(all)) {
    it(`${flow} → .${hook}`, () => {
      const present =
        PRODUCT_SOURCE.includes(`"${hook}"`) ||
        PRODUCT_SOURCE.includes(`'${hook}'`) ||
        PRODUCT_SOURCE.includes(`.${hook}`) ||
        PRODUCT_SOURCE.includes(`${hook} `) ||
        PRODUCT_SOURCE.includes(`${hook}'`)
      expect(
        present,
        `The demo flow ${flow} spotlights ".${hook}", which no longer appears anywhere ` +
        `outside the demo package. A class was probably renamed during a redesign. ` +
        `Update that flow's findTarget, or restore the hook - otherwise the walkthrough ` +
        `will show "lost the spot for a second." to every visitor who opens it.`,
      ).toBe(true)
    })
  }
})

function dedupe(list: { flow: string; hook: string }[]) {
  const seen = new Set<string>()
  return list.filter(x => {
    const k = x.flow + '|' + x.hook
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
