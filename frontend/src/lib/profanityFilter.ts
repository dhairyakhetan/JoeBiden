// Site-wide obscenity filter. See docs/superpowers/specs/2026-07-20-obscenity-filter-design.md.
//
// Two sources, combined:
//  1. English coverage via the `obscenity` npm package's curated, MIT-licensed
//     `englishDataset` (https://github.com/words/cuss via obscenity) - a
//     maintained third-party list, not authored here. Its own transformer
//     pipeline already handles spacing/leetspeak/repeat-letter evasion for
//     this half. Treated entirely as 'block' tier: the library doesn't ship
//     its own severity split, and defaulting to the stricter tier is the
//     safe choice until someone deliberately re-tiers specific entries.
//  2. `profanityWords.json` - a plain word list for Hinglish/Bengali slang
//     (or anything else) that the team supplies directly; empty until then.
//     Matched with a lighter, hand-rolled normalizer (below) since these are
//     plain strings, not obscenity's special pattern syntax.
import customWords from './profanityWords.json'

export type Severity = 'clean' | 'flag' | 'block'

export interface FilterResult {
  severity: Severity
  /** Which list entries matched - for logging only. Never shown verbatim to
      the end user (see design doc: revealing the exact trigger both feels
      accusatory on a false positive and teaches evasion). */
  matches: string[]
}

// The obscenity package + its built dataset cost ~17KB gzip and a non-trivial
// matcher build, but are only needed at submit time - never on page render.
// Loaded on first checkText() call so it stays out of the feed's critical path.
type EnglishMatcher = { hasMatch(t: string): boolean; getAllMatches(t: string): { termId: number }[] }
let englishMatcherPromise: Promise<EnglishMatcher> | null = null

function getEnglishMatcher(): Promise<EnglishMatcher> {
  if (!englishMatcherPromise) {
    englishMatcherPromise = import('obscenity').then(
      ({ RegExpMatcher, englishDataset, englishRecommendedTransformers }) =>
        new RegExpMatcher({
          ...englishDataset.build(),
          ...englishRecommendedTransformers,
        }),
    )
  }
  return englishMatcherPromise
}

// ── Normalization for the custom list ───────────────────────────────────
// Mirrors the design doc: lowercase, strip punctuation/whitespace between
// letters, map common leetspeak, collapse 3+ repeated letters to 2.
const LEET_MAP: Record<string, string> = { '4': 'a', '3': 'e', '1': 'i', '0': 'o', '5': 's', '@': 'a', '$': 's' }

function normalize(text: string): string {
  let out = text.toLowerCase()
  out = out.replace(/[^a-z0-9]/g, '') // strip spacing/punctuation entirely for substring matching
  out = out.replace(/[43105@$]/g, ch => LEET_MAP[ch] ?? ch)
  out = out.replace(/(.)\1{2,}/g, '$1$1') // aaaa -> aa
  return out
}

function wordBoundaryTest(raw: string, word: string): boolean {
  const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
  return re.test(raw)
}

function matchCustomList(text: string, words: string[]): string[] {
  if (words.length === 0) return []
  const raw = text.toLowerCase()
  const normalized = normalize(text)
  const hits: string[] = []
  for (const word of words) {
    const w = word.toLowerCase()
    if (wordBoundaryTest(raw, w) || normalized.includes(normalize(w))) hits.push(word)
  }
  return hits
}

/**
 * Checks free text for obscene/profane content. Client-side only (see design
 * doc for why) - call this at submit time on any user-authored text field.
 */
export async function checkText(text: string): Promise<FilterResult> {
  if (!text || !text.trim()) return { severity: 'clean', matches: [] }

  const englishMatcher = await getEnglishMatcher()
  if (englishMatcher.hasMatch(text)) {
    const matches = englishMatcher.getAllMatches(text).map(m => `en:${m.termId}`)
    return { severity: 'block', matches }
  }

  const blockHits = matchCustomList(text, customWords.block)
  if (blockHits.length > 0) return { severity: 'block', matches: blockHits }

  const flagHits = matchCustomList(text, customWords.flag)
  if (flagHits.length > 0) return { severity: 'flag', matches: flagHits }

  return { severity: 'clean', matches: [] }
}

/** Generic, non-accusatory copy for a 'block' result - never quotes the matched word. */
export const BLOCK_MESSAGE = "This contains language that isn't allowed here. Please edit and try again."
