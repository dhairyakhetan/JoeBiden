import { describe, it, expect } from 'vitest'
import { templateFor, isCertificateTemplate, BACKDROP, LETTER_HAS_CLOSING, SINGLE_SIGNATORY, type TemplateId } from './certificateTemplates'

describe('templateFor', () => {
  it('maps every seeded document type to a real template', () => {
    expect(templateFor('cert_recognition', [])).toBe('cert_recognition')
    expect(templateFor('lor', [])).toBe('letter_recommendation')
    expect(templateFor('letter_recognition', [])).toBe('letter_recognition')
    expect(templateFor('letter_internship', [])).toBe('letter_internship')
    expect(templateFor('letter_acceptance', [])).toBe('letter_acceptance')
    expect(templateFor('letter_offer', [])).toBe('letter_offer')
  })
  it('picks the AQ.Ventures internship certificate from the tagged teams, however the name is spelled', () => {
    expect(templateFor('cert_internship', ['Social Media'])).toBe('cert_internship')
    for (const n of ['AQ.Ventures', 'AQ Ventures', 'aq.ventures', 'AQVentures']) expect(templateFor('cert_internship', ['Welfare Projects', n])).toBe('cert_internship_ventures')
  })
  it('does not switch any other type to the Ventures edition', () => {
    expect(templateFor('cert_recognition', ['AQ.Ventures'])).toBe('cert_recognition')
    expect(templateFor('lor', ['AQ.Ventures'])).toBe('letter_recommendation')
  })
  it('has no template for an unknown type, so nothing is drawn under the wrong title', () => {
    expect(templateFor('something_new', [])).toBeNull()
  })
  it('knows which templates are certificates, and every template has artwork', () => {
    const all = Object.keys(BACKDROP) as TemplateId[]
    expect(all.filter(isCertificateTemplate).sort()).toEqual(['cert_internship', 'cert_internship_ventures', 'cert_recognition'])
    for (const t of all) expect(BACKDROP[t]).toMatch(/^\/certificates\/bg-.*\.webp$/)
  })
  it('records the real letters’ closings and the single-signature acceptance letter', () => {
    expect(LETTER_HAS_CLOSING.letter_recommendation).toBe(true)
    expect(LETTER_HAS_CLOSING.letter_internship).toBe(false)
    expect(SINGLE_SIGNATORY.letter_acceptance).toBe(true)
  })
})
