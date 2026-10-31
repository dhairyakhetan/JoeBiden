import { describe, it, expect } from 'vitest'
import { derivePostHeadline, HEADLINE_LIMIT, SNIPPET_LIMIT } from './postHeadline'

/* The defect this pins, found by a fresh visual review 2026-09-07: the pinned
   hero card's <h2> contained the post's title line PLUS a sentence of its body,
   and then repeated that body underneath. Both live pinned rows are covered
   below with their real opening text. */
describe('derivePostHeadline', () => {
  it('does not swallow the body into the heading (the live pinned hero)', () => {
    const body = "People in the Mirror\n\nI've been a lot of people in the mirror. At 8, I was your average kid."
    const { headline, rest } = derivePostHeadline(body)
    expect(headline).toBe('People in the Mirror')
    expect(headline).not.toContain("I've been")
    expect(rest).toContain("I've been a lot of people")
  })

  it('handles the second live pinned row the same way', () => {
    const { headline } = derivePostHeadline(
      'Once Upon - Storytelling Workshop\n\nOnce Upon workshop captured hearts with every story.',
    )
    expect(headline).toBe('Once Upon - Storytelling Workshop')
  })

  it('never lets a heading carry a paragraph break', () => {
    for (const b of [
      'A\n\nB',
      'title\n\nbody\n\nmore',
      'one line only',
      'x'.repeat(400),
      ['long line without any blank line separator '.repeat(6)].join(''),
    ]) {
      expect(derivePostHeadline(b).headline).not.toMatch(/\n\n/)
    }
  })

  it('degrades to a boundary cut for a run-on paragraph, never mid-word', () => {
    const body = `${'word '.repeat(60)}end.`
    const { headline, truncated } = derivePostHeadline(body)
    expect(truncated).toBe(true)
    expect(headline.length).toBeLessThanOrEqual(HEADLINE_LIMIT)
    expect(headline.endsWith('wor')).toBe(false)
  })

  it('loses no text when it cuts - the remainder moves into the snippet', () => {
    const body = `${'alpha '.repeat(40)}beta.`
    const { headline, rest } = derivePostHeadline(body)
    expect(rest.length).toBeGreaterThan(0)
    expect(`${headline} ${rest}`).toContain('alpha')
  })

  it('returns empty for an empty or missing body rather than throwing', () => {
    for (const b of ['', '   ', null, undefined]) {
      expect(derivePostHeadline(b as string).headline).toBe('')
    }
  })
  /* ── the snippetLimit override, added 2026-09-18 ──────────────────────────
     The `.aqc` family-05 cards render `rest` with no clamp on two of their
     shapes, so they pass Infinity. Before this, they bypassed the guard
     entirely by calling splitPostBody() directly, and one live post put 416
     characters into `.aqc-title` at weight 900 - seventeen lines on a phone.
     These pin both halves: the guard applies, and the remainder survives. */

  it('caps the heading but keeps the whole remainder when snippetLimit is Infinity', () => {
    const runOn = 'x'.repeat(400)
    const { headline, rest } = derivePostHeadline(runOn, Infinity)
    expect(headline.length).toBeLessThanOrEqual(HEADLINE_LIMIT)
    // Nothing is lost: what the heading dropped is all still in the snippet.
    expect(headline.length + rest.length).toBe(runOn.length)
  })

  it('still applies the default snippet cap when no limit is passed', () => {
    const long = `Short headline

${'body '.repeat(200)}`
    expect(derivePostHeadline(long).rest.length).toBeLessThanOrEqual(SNIPPET_LIMIT)
    expect(derivePostHeadline(long, Infinity).rest.length).toBeGreaterThan(SNIPPET_LIMIT)
  })

  it('leaves a normal headline untouched at either limit', () => {
    const normal = `Plantation drive

We planted forty saplings near the canal.`
    for (const lim of [undefined, Infinity] as const) {
      const { headline, truncated } = derivePostHeadline(normal, lim as number | undefined)
      expect(headline).toBe('Plantation drive')
      expect(truncated).toBe(false)
    }
  })
})
