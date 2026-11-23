import { describe, it, expect } from 'vitest'
import { eventPhase, effectiveStatus, settleStatuses, pastLines, ANNOUNCE_HANDLE } from './eventPhase'
import { countdownTo } from './countdown'
import { ticketHref, ticketMessage } from '../components/ContactLine'
import { NEXT_EVENT } from '../config'
import type { LiveEvent } from '../data/content'

const D = '2026-11-10'
// midnight IST on 10 Nov is 18:30 UTC on 9 Nov; on 11 Nov it is 18:30 UTC on 10 Nov
const BEFORE = new Date('2026-11-09T18:29:59.000Z')
const DAY_START = new Date('2026-11-09T18:30:00.000Z')
const DAY_END = new Date('2026-11-10T18:29:59.000Z')
const NEXT_DAY = new Date('2026-11-10T18:30:00.000Z')
const TODAY = new Date('2026-11-15T06:00:00.000Z')

describe('the phase of a one-day night, on the IST day boundary', () => {
  it('is upcoming while the countdown runs', () => {
    expect(eventPhase(D, BEFORE)).toBe('upcoming')
    expect(countdownTo(D, BEFORE).done).toBe(false)
  })
  it('is today from the moment the countdown is done until midnight IST', () => {
    expect(countdownTo(D, DAY_START).done).toBe(true)
    expect(eventPhase(D, DAY_START)).toBe('today')
    expect(eventPhase(D, DAY_END)).toBe('today')
  })
  it('is past from midnight IST the next day, and on 15 November 2026', () => {
    expect(eventPhase(D, NEXT_DAY)).toBe('past')
    expect(eventPhase(D, TODAY)).toBe('past')
  })
})

describe('the status a visitor sees', () => {
  const ev = (status: LiveEvent['status'], when: string): LiveEvent => ({ slug: 's', name: 'N', status, when, dateLabel: 'x', blurb: 'b', highlights: ['Bring a mask.'] })
  it('reads a row still marked upcoming as past once its date has gone', () => {
    expect(effectiveStatus(ev('upcoming', D), TODAY)).toBe('past')
    expect(effectiveStatus(ev('upcoming', D), DAY_END)).toBe('upcoming')
    expect(effectiveStatus(ev('upcoming', D), BEFORE)).toBe('upcoming')
  })
  it('never expires a bare year or month, and never turns past into upcoming', () => {
    expect(effectiveStatus(ev('upcoming', '2025-10'), TODAY)).toBe('upcoming')
    expect(effectiveStatus(ev('upcoming', '2025'), TODAY)).toBe('upcoming')
    expect(effectiveStatus(ev('past', '2027-01-01'), TODAY)).toBe('past')
  })
  it('settles a list, dropping the before-you-go highlights only from the nights it flipped', () => {
    const keep = ev('past', '2026-10-02')
    const live = ev('upcoming', '2027-01-01')
    const stale = ev('upcoming', D)
    const out = settleStatuses([keep, live, stale], TODAY)
    expect(out[0]).toBe(keep)
    expect(out[1]).toBe(live)
    expect(out[2].status).toBe('past')
    expect(out[2].highlights).toBeUndefined()
    expect(stale.status).toBe('upcoming')
  })
})

describe('the past-tense block', () => {
  it('says the night took place, thanks people, and points at Instagram, with no figures or dates invented', () => {
    const { said, next } = pastLines({ name: NEXT_EVENT.name, dateLabel: NEXT_EVENT.dateLabel })
    expect(said).toBe("Disco Diwali took place on 10 November 2026 in Kolkata. Thank you to everyone who came; every ticket funded AquaTerra's welfare drives.")
    expect(next).toContain(ANNOUNCE_HANDLE)
    expect(ANNOUNCE_HANDLE).toBe('@ngo.aquaterra')
    expect(said + next).not.toMatch(/—|₹|\d+\s*(people|guests|tickets sold)/)
  })
})

describe('the ticket link', () => {
  it('builds its message from the config', () => {
    expect(ticketMessage()).toBe('Hi, I would like a ticket for Disco Diwali on 10 November.')
  })
  it('offers a ticket up to and on the day, and none once the night is over', () => {
    const before = ticketHref(BEFORE)
    if (before !== null) expect(before).toContain(encodeURIComponent(ticketMessage()))
    expect(ticketHref(DAY_END)).toBe(before)
    expect(ticketHref(NEXT_DAY)).toBeNull()
    expect(ticketHref(TODAY)).toBeNull()
  })
})
