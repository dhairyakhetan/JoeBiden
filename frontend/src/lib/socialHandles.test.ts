import { describe, it, expect } from 'vitest'
import { normalizeLinkedIn, normalizeInstagram } from './socialHandles'

describe('normalizeLinkedIn', () => {
  it('accepts the shapes people paste', () => {
    const want = { value: 'https://www.linkedin.com/in/asha-rao-12' }
    for (const s of ['https://www.linkedin.com/in/asha-rao-12', 'http://linkedin.com/in/asha-rao-12/', 'linkedin.com/in/asha-rao-12?utm=x', 'www.linkedin.com/in/asha-rao-12', 'in/asha-rao-12', 'asha-rao-12', 'https://in.linkedin.com/in/asha-rao-12']) {
      expect(normalizeLinkedIn(s)).toEqual(want)
    }
  })
  it('treats blank as a clear', () => {
    expect(normalizeLinkedIn('  ')).toEqual({ empty: true })
    expect(normalizeLinkedIn(null)).toEqual({ empty: true })
  })
  it('refuses other sites, other LinkedIn paths and script schemes', () => {
    for (const s of ['https://example.com/in/asha', 'javascript:alert(1)', 'linkedin.com/company/aquaterra', 'https://www.linkedin.com/in/a/b', 'ab']) {
      expect('error' in normalizeLinkedIn(s)).toBe(true)
    }
  })
})

describe('normalizeInstagram', () => {
  it('accepts handles and profile links', () => {
    for (const s of ['@asha.rao', 'asha.rao', 'https://instagram.com/asha.rao/', 'instagram.com/asha.rao?hl=en', 'www.instagram.com/asha.rao']) {
      expect(normalizeInstagram(s)).toEqual({ value: 'asha.rao' })
    }
  })
  it('treats blank as a clear', () => { expect(normalizeInstagram('')).toEqual({ empty: true }) })
  it('refuses anything that is not a handle', () => {
    for (const s of ['two words', 'a'.repeat(31), '..bad', 'name.', 'https://example.com/asha', 'asha/rao', '<script>']) {
      expect('error' in normalizeInstagram(s)).toBe(true)
    }
  })
})
