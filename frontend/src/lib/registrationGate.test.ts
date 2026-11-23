import { describe, it, expect } from 'vitest'
import { registrationGateTarget } from './registrationGate'

const complete = { class_grade: 'Class 10', phone: '9876543210', status: 'active', email: 'a@example.com' }
const noPhone = { ...complete, phone: null }
const noClass = { ...complete, class_grade: null }

describe('registrationGateTarget', () => {
  it('sends an approved member with no number to /register from any ordinary page, public ones included', () => {
    expect(registrationGateTarget({ pathname: '/', member: noPhone, isLoading: false })).toBe('/register')
    expect(registrationGateTarget({ pathname: '/projects', member: noPhone, isLoading: false })).toBe('/register')
    expect(registrationGateTarget({ pathname: '/feed', member: noPhone, isLoading: false })).toBe('/register')
    expect(registrationGateTarget({ pathname: '/director/approvals', member: noPhone, isLoading: false })).toBe('/register')
  })

  it('also catches a member still missing their class, and a pending member', () => {
    expect(registrationGateTarget({ pathname: '/', member: noClass, isLoading: false })).toBe('/register')
    expect(registrationGateTarget({ pathname: '/', member: { ...noPhone, status: 'pending_approval' }, isLoading: false })).toBe('/register')
  })

  it('lets a complete member through', () => {
    expect(registrationGateTarget({ pathname: '/', member: complete, isLoading: false })).toBeNull()
  })

  it('never redirects while loading or when signed out', () => {
    expect(registrationGateTarget({ pathname: '/', member: noPhone, isLoading: true })).toBeNull()
    expect(registrationGateTarget({ pathname: '/', member: null, isLoading: false })).toBeNull()
  })

  it('leaves the pages needed to finish or leave the flow, the legal pages and the event sub-apps alone', () => {
    for (const p of ['/register', '/login', '/auth/callback', '/pending', '/rejected', '/privacy-policy', '/equity-policy', '/contact', '/terrathon/register', '/live/admin', '/paradox/tickets']) {
      expect(registrationGateTarget({ pathname: p, member: noPhone, isLoading: false })).toBeNull()
    }
  })

  it('does not exempt a look-alike path', () => {
    expect(registrationGateTarget({ pathname: '/registerx', member: noPhone, isLoading: false })).toBe('/register')
    expect(registrationGateTarget({ pathname: '/contacts', member: noPhone, isLoading: false })).toBe('/register')
  })

  it('leaves rejected, suspended and deleted accounts to the route guard', () => {
    for (const status of ['rejected', 'suspended', 'deleted']) {
      expect(registrationGateTarget({ pathname: '/', member: { ...noPhone, status }, isLoading: false })).toBeNull()
    }
  })
})
