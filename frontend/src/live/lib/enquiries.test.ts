import { describe, expect, it } from 'vitest'
import { validateEnquiry } from './enquiries'

const ok = { name: 'Riya Das', contact: '98300 11111', topic: 'tickets', message: 'Do you have a family ticket?' }

describe('validateEnquiry', () => {
  it('accepts a mobile number and stores it in +91 form', () => {
    const r = validateEnquiry(ok)
    expect(r.ok && r.value.contact).toBe('+919830011111')
  })
  it('accepts an email and lowercases it', () => {
    const r = validateEnquiry({ ...ok, contact: ' Riya@Example.COM ' })
    expect(r.ok && r.value.contact).toBe('riya@example.com')
  })
  it('collapses stray spaces in the name', () => {
    const r = validateEnquiry({ ...ok, name: '  Riya    Das ' })
    expect(r.ok && r.value.name).toBe('Riya Das')
  })
  it.each([['12345'], ['hello'], ['riya@'], ['']])('rejects contact %j', (contact) => {
    const r = validateEnquiry({ ...ok, contact })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.errors.contact).toBeTruthy()
  })
  it('rejects a short message, an unknown topic and a missing name, each with its own message', () => {
    const r = validateEnquiry({ name: ' ', contact: ok.contact, topic: 'nope', message: 'hi' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['message', 'name', 'topic'])
  })
  it('caps the message at 1000 characters', () => {
    expect(validateEnquiry({ ...ok, message: 'x'.repeat(1001) }).ok).toBe(false)
    expect(validateEnquiry({ ...ok, message: 'x'.repeat(1000) }).ok).toBe(true)
  })
  it('reports a filled honeypot as spam with no field errors, so a bot learns nothing', () => {
    const r = validateEnquiry({ ...ok, website: 'http://spam.example' })
    expect(r).toEqual({ ok: false, spam: true, errors: {} })
  })
})
