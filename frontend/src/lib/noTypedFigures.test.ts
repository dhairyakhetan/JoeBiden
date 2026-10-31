import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Copy must not carry a typed department count or elapsed-years phrase: they go stale (the About page said
// "eight departments" over a chart that showed seven). Use departmentsPhrase() / yearsPhrase() from
// lib/orgFigures. Comments are skipped; the Terra Notes and Paradox sub-apps keep their own copy.
const SKIP_DIRS = new Set(['terranotes', 'paradox', 'node_modules'])
const PATTERNS = [
  /\b(?:eight|seven|nine|[6-9]) (?:student-(?:run|led) )?departments\b/i,
  /\b(?:four|five|six|seven) years of it\b/i,
  /\b(?:four|five|six) years later\b/i,
]

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(full, out)
    } else if (/\.(tsx?|jsx?)$/.test(name) && !/\.test\./.test(name)) out.push(full)
  }
  return out
}

describe('no typed department counts or elapsed years in copy', () => {
  it('finds none outside comments', () => {
    const hits: string[] = []
    for (const file of walk('src')) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        const t = line.trim()
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('{/*')) return
        if (PATTERNS.some(p => p.test(line))) hits.push(`${file}:${i + 1}: ${t.slice(0, 100)}`)
      })
    }
    expect(hits).toEqual([])
  })
})
