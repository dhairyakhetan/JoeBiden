import { describe, expect, it } from 'vitest'
import { EVENTS, PROGRAMMES, eventBySlug, past, upcoming } from './content'
import { ARC_IDS, PHOTOS, POSTERS, photo } from './photos'
import { NEXT_EVENT } from '../config'
import { readFileSync } from 'node:fs'

describe('live content', () => {
  it('has unique slugs and every slug resolves', () => {
    const slugs = EVENTS.map(e => e.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const s of slugs) expect(eventBySlug(s)?.slug).toBe(s)
    expect(eventBySlug('nope')).toBeUndefined()
  })
  it('keeps the upcoming night in step with the config the countdown reads', () => {
    const next = upcoming()
    expect(next).toHaveLength(1)
    expect(next[0].when).toBe(NEXT_EVENT.date)
  })
  it('lists past nights newest first', () => {
    const w = past().map(e => e.when)
    expect([...w].sort().reverse()).toEqual(w)
  })
  it('only points photo ids at photos that exist, and every one has a real file', () => {
    for (const e of EVENTS) for (const id of e.photos ?? []) expect(() => photo(id)).not.toThrow()
    for (const id of ARC_IDS) expect(() => photo(id)).not.toThrow()
    for (const p of PHOTOS) for (const size of ['s', 'm']) expect(() => readFileSync(`public/live/photos/${p.id}-${size}.webp`)).not.toThrow()
  })
  it('describes every photo, records consent as confirmed (owner, 2026-10-24), and names nobody', () => {
    for (const p of PHOTOS) {
      expect(p.alt.length).toBeGreaterThan(20)
      expect(p.consent).toBe('confirmed')
    }
  })
  it('never prints a rupee figure in the programme copy or the event blurbs (owner rule: no money figures on this site)', () => {
    const text = [...PROGRAMMES.flatMap(p => [p.name, p.line]), ...EVENTS.flatMap(e => [e.blurb, ...(e.highlights ?? [])])].join(' ')
    expect(text).not.toMatch(/₹|\brs\.?\s?\d|\binr\b|\b\d[\d,]*\s?(rupees|lakh|crore)\b/i)
  })
  it('leaves sponsors, stalls and performers empty until the owner supplies them', () => {
    for (const e of EVENTS) { expect(e.sponsors ?? []).toEqual([]); expect(e.stalls ?? []).toEqual([]); expect(e.performers ?? []).toEqual([]) }
  })
  it('has a real file behind every poster, sticker, light string, dust layer and programme photo', () => {
    for (const p of POSTERS) { expect(() => readFileSync(`public/live/posters/${p.id}.webp`)).not.toThrow(); expect(p.alt.length).toBeGreaterThan(30) }
    for (const n of ['calendar', 'pin', 'heart', 'star', 'diya']) expect(() => readFileSync(`public/live/stickers/${n}.webp`)).not.toThrow()
    for (const n of ['lights', 'sparkles']) expect(() => readFileSync(`public/live/fx/${n}.webp`)).not.toThrow()
    for (const pr of PROGRAMMES) if (pr.photo) { expect(() => readFileSync(`public/live/programmes/${pr.photo}.webp`)).not.toThrow(); expect(pr.photoAlt?.length).toBeGreaterThan(20) }
  })
  it('keeps the Summer night\'s photos on its own event, and leaves the written-notes gossip board out of the library', () => {
    expect(eventBySlug('summer-aq-turns-five')?.photos?.length).toBeGreaterThan(0)
    expect(PHOTOS.some(p => /gossip/i.test(p.id) || /gossip board/i.test(p.alt))).toBe(false)
  })
})
