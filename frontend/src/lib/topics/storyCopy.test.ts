import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import defs from './topicDefs.json'
import { fillTokens, splitLinks, TOPIC_BY_SLUG, type TopicFacts } from './topicKit'

/**
 * Guards for the photo story copy (lib/topics/copy/stories/*.json): same honesty and voice rules as the library
 * pages (topicCopy.test.ts), plus one chapter for every year the story's drives cover, so a new year of drives
 * shows up as a missing chapter here rather than as a gap on the page.
 */
const DIR = join(__dirname, 'copy', 'stories')
const FACTS = join(__dirname, 'facts', 'stories')
const files = existsSync(DIR) ? readdirSync(DIR).filter(f => f.endsWith('.json')) : []
const STORIES = (defs as { stories: { slug: string; topic: string }[] }).stories
const ALLOWED_LINK = /^\/(impact(\/[a-z0-9-]+)?(\/[a-z0-9-]+)?(#[a-z0-9-]+)?|projects|about|join|support|crftd|shikshaq|sports|ai|terranotes|teams|volunteer|faq|contact|collaborations)$/
const KNOWN = /^(count|volunteers|firstYear|lastYear|years|placesCount|topPlace|members|drives|children|saplings|bananas|checkups|dogMeals|sundarbansTrips|clothesKg)$/

interface StoryCopy {
  slug: string; title: string; description: string; h1Lead: string; h1Accent: string; lede: string
  chapters: Record<string, { heading: string; text: string }>; closing: string; faqs: { q: string; a: string }[]
}

describe('photo story copy', () => {
  it('has a copy file for every story', () => {
    expect(files.length).toBe(STORIES.length)
  })
  for (const f of files) {
    const slug = f.replace(/\.json$/, '')
    describe(slug, () => {
      const copy = JSON.parse(readFileSync(join(DIR, f), 'utf8')) as StoryCopy
      const facts = JSON.parse(readFileSync(join(FACTS, f), 'utf8')) as TopicFacts & { chapters: { year: number }[] }
      const strings = [copy.title, copy.description, copy.h1Lead, copy.h1Accent, copy.lede, copy.closing,
        ...Object.values(copy.chapters).flatMap(c => [c.heading, c.text]), ...copy.faqs.flatMap(q => [q.q, q.a])]

      it('is a defined story with a chapter for every year', () => {
        expect(STORIES.find(s => s.slug === slug)).toBeTruthy()
        expect(copy.slug).toBe(slug)
        expect(Object.keys(copy.chapters).sort()).toEqual(facts.chapters.map(c => String(c.year)).sort())
        expect(copy.faqs.length).toBeGreaterThanOrEqual(2)
      })
      it('uses only known tokens, and every one resolves', () => {
        for (const s of strings) {
          for (const m of s.matchAll(/\{([a-zA-Z]+)(?::([a-z0-9-]+))?\}/g)) {
            const [, key, arg] = m
            if (arg !== undefined) {
              expect(['year', 'count', 'volunteers'], `${slug}: {${key}:${arg}}`).toContain(key)
              if (key !== 'year') expect(TOPIC_BY_SLUG[arg], `${slug}: {${key}:${arg}}`).toBeTruthy()
            } else expect(key, `${slug}: unknown token {${key}}`).toMatch(KNOWN)
          }
          expect(fillTokens(s, facts)).not.toMatch(/[{}]/)
        }
      })
      it('types no totals', () => {
        for (const s of strings) {
          const bare = s.replace(/\{[^}]*\}/g, '')
          expect(bare, `${slug}: typed total in "${s.slice(0, 80)}"`).not.toMatch(/\d\+|\d,\d{3}/)
          expect(bare, `${slug}: typed count in "${s.slice(0, 80)}"`).not.toMatch(/\b(?!20[12]\d\b)\d+\s+(drives?|volunteers?|volunteer turnouts|turnouts|workshops|sessions|members|children|kids)\b/i)
        }
      })
      it('keeps the voice and the owner rules', () => {
        for (const s of strings) {
          expect(s, `${slug}: dash`).not.toMatch(/[–—]/)
          expect(s, `${slug}: exclamation`).not.toMatch(/!/)
          expect(s, `${slug}: dataset talk in "${s.slice(0, 80)}"`).not.toMatch(/\b(the rows?|in the rows|rows? (show|log|record|name)|the data(set)?|in the data|spreadsheet|records show|write-ups? (record|log|note)s?|labelled|header|numbering|spellings?)\b/i)
          expect(s, `${slug}: places, not partners`).not.toMatch(/\bpartner(s|ed|ing|ship|ships)?\b(?! with us)/i)
          expect(s, `${slug}: Open Books is retired`).not.toMatch(/open books|public ledger|\/accounts/i)
        }
        expect(copy.title.length).toBeLessThanOrEqual(75)
      })
      it('links only to real pages', () => {
        for (const s of strings) for (const p of splitLinks(s)) if (p.href) expect(p.href, slug).toMatch(ALLOWED_LINK)
      })
    })
  }
})
