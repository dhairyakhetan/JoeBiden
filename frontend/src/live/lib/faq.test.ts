import { describe, it, expect } from 'vitest'
import { faqFor } from './faq'

const text = (qa: { q: string; a: string }[]) => qa.map(x => `${x.q} ${x.a}`).join('\n')
const answer = (qa: { q: string; a: string }[], re: RegExp) => qa.find(x => re.test(x.q))?.a

describe('the FAQ, in the tense the night is in', () => {
  it('answers in the future tense before and on the day', () => {
    for (const phase of ['upcoming', 'today'] as const) {
      const qa = faqFor(phase)
      expect(answer(qa, /When and where is it\?/)).toContain('is on 10 November 2026')
      expect(answer(qa, /How do I get/)).toMatch(/Message .* on WhatsApp/)
      expect(qa.some(x => /Who is performing/.test(x.q))).toBe(true)
    }
  })
  it('answers the date, tickets and venue in the past tense once it is over', () => {
    const qa = faqFor('past')
    const all = text(qa)
    expect(answer(qa, /When and where was it\?/)).toBe('Disco Diwali, The Masquerade Sangeet Edition, took place on 10 November 2026, from 4:30 PM, at 60, Chowringhee Banquets in Kolkata. Photos from the nights are in the Vault.')
    expect(answer(qa, /How did .* tickets work\?/)).toContain('@ngo.aquaterra')
    expect(all).not.toMatch(/is on 10 November|How do I get|bring a mask|Who is performing|has not been announced/i)
  })
  it('keeps the answers that still help, word for word', () => {
    const before = faqFor('upcoming')
    const after = faqFor('past')
    for (const q of ['What is AquaTerra.live?', 'Where does the money go?', 'Can I get a photo of me taken down?', 'Something else?']) {
      expect(answer(after, new RegExp(q.replace(/[?.]/g, '\\$&')))).toBe(answer(before, new RegExp(q.replace(/[?.]/g, '\\$&'))))
    }
  })
  it('never uses an em dash and never invents a figure', () => {
    for (const phase of ['upcoming', 'today', 'past'] as const) expect(text(faqFor(phase))).not.toMatch(/—|₹|\braised\b|\battended\b/)
  })
})
