import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { TOPICS, TOPIC_BY_SLUG, fillTokens, splitLinks, topicsForDrive, type TopicCopy, type TopicFacts } from './topicKit'

/**
 * Guards for the impact library copy (lib/topics/copy/*.json). The copy was drafted from the drive records and is
 * edited by hand, so these pin the rules that keep it honest and self-updating:
 *   - every count is a token, never typed (only years, dates and digits inside real names may appear literally)
 *   - every token is one fillTokens() knows, and resolves to something
 *   - house voice: no em or en dashes, no exclamation marks
 *   - links only to real site pages
 */
const DIR = join(__dirname, 'copy')
const FACTS_DIR = join(__dirname, 'facts')
const files = existsSync(DIR) ? readdirSync(DIR).filter(f => f.endsWith('.json')) : []
const ALLOWED_LINK = /^\/(impact(\/(stories|explore)\/[a-z0-9-]+|\/[a-z0-9-]+)?(#[a-z0-9-]+)?|projects|about|join|support|crftd|shikshaq|sports|ai|terranotes|teams|volunteer|faq|contact|collaborations)$/
const KNOWN = /^(count|volunteers|firstYear|lastYear|years|placesCount|topPlace|members|drives|children|saplings|bananas|checkups|dogMeals|sundarbansTrips|clothesKg)$/

function allStrings(c: TopicCopy): string[] {
  return [c.title, c.description, c.h1Lead, c.h1Accent, c.lede, ...c.sections.flatMap(s => [s.heading, ...s.body]), ...(c.learnings || []), ...c.faqs.flatMap(f => [f.q, f.a])]
}

describe('impact library copy', () => {
  it('has a copy file for most topics', () => {
    expect(files.length).toBeGreaterThanOrEqual(30)
  })

  for (const f of files) {
    const slug = f.replace(/\.json$/, '')
    describe(slug, () => {
      const copy = JSON.parse(readFileSync(join(DIR, f), 'utf8')) as TopicCopy
      const facts = JSON.parse(readFileSync(join(FACTS_DIR, f), 'utf8')) as TopicFacts
      const strings = allStrings(copy)

      it('belongs to a defined topic and has the right shape', () => {
        expect(TOPIC_BY_SLUG[slug]).toBeTruthy()
        expect(copy.slug).toBe(slug)
        expect(copy.sections.length).toBeGreaterThanOrEqual(3)
        expect(copy.faqs.length).toBeGreaterThanOrEqual(3)
        expect(new Set(copy.sections.map(s => s.id)).size).toBe(copy.sections.length)
        for (const s of copy.sections) expect(s.id).toMatch(/^[a-z0-9-]+$/)
      })

      it('uses only known tokens, and every one resolves', () => {
        for (const s of strings) {
          for (const m of s.matchAll(/\{([a-zA-Z]+)(?::([a-z0-9-]+))?\}/g)) {
            const [, key, arg] = m
            if (arg !== undefined) {
              expect(['year', 'count', 'volunteers'], `${slug}: {${key}:${arg}}`).toContain(key)
              if (key !== 'year') expect(TOPIC_BY_SLUG[arg], `${slug}: unknown topic in {${key}:${arg}}`).toBeTruthy()
            } else {
              expect(key, `${slug}: unknown token {${key}}`).toMatch(KNOWN)
            }
          }
          expect(fillTokens(s, facts)).not.toMatch(/[{}]/)
        }
      })

      it('types no totals: counts of drives, volunteers or turnouts are tokens', () => {
        // Dates ("26 March"), drive versions ("Plantation Drive 26.0"), addresses ("Ward 58") and a single drive's own
        // attributed figure are fine as literals. What must never be typed is a running total, because it would go
        // stale: anything with a "+", anything comma-grouped, or a bare number counting drives/volunteers/turnouts.
        for (const s of strings) {
          const bare = s.replace(/\{[^}]*\}/g, '')
          expect(bare, `${slug}: typed total in "${s.slice(0, 90)}"`).not.toMatch(/\d\+|\d,\d{3}/)
          expect(bare, `${slug}: typed count in "${s.slice(0, 90)}"`).not.toMatch(/\b(?!20[12]\d\b)\d+\s+(drives?|volunteers?|volunteer turnouts|turnouts|workshops|sessions|members|children|kids)\b/i)
        }
      })

      it('reads as a page, not as notes on a dataset', () => {
        for (const s of strings) {
          expect(s, `${slug}: the organisations where drives happen are places, not partners (owner, 15 Nov 2026)`).not.toMatch(/\bpartner(s|ed|ing|ship|ships)?\b(?! with us)/i)
          expect(s, `${slug}: Open Books is retired (CA, 15 Nov 2026)`).not.toMatch(/open books|public ledger|\/accounts/i)
          expect(s, `${slug}: dataset talk in "${s.slice(0, 90)}"`).not.toMatch(/\b(the rows?|in the rows|rows? (show|log|record|name)|the data(set)?|in the data|spreadsheet|records show|write-ups? (record|log|note)s?|labelled|header|numbering|spellings?|on this page logged)\b/i)
        }
      })

      it('keeps the house voice', () => {
        for (const s of strings) {
          expect(s, `${slug}: dash in "${s.slice(0, 80)}"`).not.toMatch(/[–—]/)
          expect(s, `${slug}: exclamation in "${s.slice(0, 80)}"`).not.toMatch(/!/)
        }
        expect(copy.title.length).toBeLessThanOrEqual(70)
      })

      it('links only to real pages', () => {
        for (const s of strings) for (const p of splitLinks(s)) if (p.href) expect(p.href, slug).toMatch(ALLOWED_LINK)
        for (const s of strings) {
          for (const m of s.matchAll(/\/impact\/(?!stories\/|explore\/)([a-z0-9-]+)/g)) expect(TOPIC_BY_SLUG[m[1]], `${slug} links to /impact/${m[1]}`).toBeTruthy()
        }
      })
    })
  }
})

describe('topic matching', () => {
  it('puts a stray dog feeding drive in its series, first', () => {
    const hits = topicsForDrive({ header: 'Tails and Treats | Feeding Stray Dogs 12', location: 'Salt Lake', workshop_date: '2024-03-02' })
    expect(hits[0].slug).toBe('tails-and-treats')
    expect(hits.map(h => h.slug)).toContain('year-2024')
  })
  it('never matches whole-organisation guide pages to a single drive', () => {
    const hits = topicsForDrive({ header: 'Anything', workshop_date: '2023-01-01' })
    expect(hits.every(h => !h.match.all)).toBe(true)
  })
  it('every related link points at a real topic', () => {
    for (const t of TOPICS) for (const r of t.related) expect(TOPIC_BY_SLUG[r], `${t.slug} → ${r}`).toBeTruthy()
  })
})
