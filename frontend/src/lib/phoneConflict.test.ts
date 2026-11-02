import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpc = vi.fn()
vi.mock('./supabaseCommunity', () => ({ supabaseCommunity: { rpc: (...a: unknown[]) => rpc(...a) } }))

import {
  isPhoneConflict,
  phoneConflictText,
  PhoneConflictError,
  checkPhoneAvailable,
  asPhoneConflict,
  HR_WHATSAPP_DISPLAY,
  HR_WHATSAPP_URL,
  PHONE_CONFLICT_HEADLINE,
  PHONE_CONFLICT_ACTION,
} from './phoneConflict'

beforeEach(() => { rpc.mockReset() })

describe('isPhoneConflict', () => {
  it('matches the trigger error', () => {
    expect(isPhoneConflict({ code: '23505', message: 'phone_already_registered' })).toBe(true)
  })
  it('rejects other unique violations and other codes', () => {
    expect(isPhoneConflict({ code: '23505', message: 'duplicate key value violates members_email_key' })).toBe(false)
    expect(isPhoneConflict({ code: '42501', message: 'phone_already_registered' })).toBe(false)
  })
  it('rejects non-objects', () => {
    expect(isPhoneConflict(null)).toBe(false)
    expect(isPhoneConflict('phone_already_registered')).toBe(false)
    expect(isPhoneConflict(undefined)).toBe(false)
  })
})

describe('copy', () => {
  it('uses the owner wording, the masked email and the HR number', () => {
    const t = phoneConflictText('jo*******h@gmail.com')
    expect(t).toContain(PHONE_CONFLICT_HEADLINE)
    expect(t).toContain('jo*******h@gmail.com')
    expect(t).toContain(PHONE_CONFLICT_ACTION)
    expect(t).toContain(`HR Team (${HR_WHATSAPP_DISPLAY})`)
  })
  it('omits the email line when the server gave none', () => {
    expect(phoneConflictText(null)).not.toContain('registered email:')
  })
  it('has no em dashes and points at the public WhatsApp', () => {
    expect(phoneConflictText('a*@b.c')).not.toContain('—')
    expect(HR_WHATSAPP_URL).toBe('https://wa.me/919748679979')
  })
  it('PhoneConflictError carries the text and the email', () => {
    const e = new PhoneConflictError('jo*******h@gmail.com')
    expect(e).toBeInstanceOf(Error)
    expect(e.maskedEmail).toBe('jo*******h@gmail.com')
    expect(e.message).toBe(phoneConflictText('jo*******h@gmail.com'))
  })
})

describe('checkPhoneAvailable', () => {
  it('sends the normalised number and reads the first row', async () => {
    rpc.mockResolvedValue({ data: [{ taken: true, masked_email: 'jo***h@gmail.com' }], error: null })
    await expect(checkPhoneAvailable(' +91 98300-12345 ')).resolves.toEqual({
      taken: true,
      maskedEmail: 'jo***h@gmail.com',
    })
    expect(rpc).toHaveBeenCalledWith('check_phone_available', { p_phone: '+919830012345' })
  })
  it('reads a single object result too', async () => {
    rpc.mockResolvedValue({ data: { taken: true, masked_email: null }, error: null })
    await expect(checkPhoneAvailable('9830012345')).resolves.toEqual({ taken: true, maskedEmail: null })
  })
  it('reports free numbers', async () => {
    rpc.mockResolvedValue({ data: [{ taken: false, masked_email: null }], error: null })
    await expect(checkPhoneAvailable('9830012345')).resolves.toEqual({ taken: false, maskedEmail: null })
  })
  it('fails open on an RPC error, a missing function and a thrown error', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'not found' } })
    expect((await checkPhoneAvailable('9830012345')).taken).toBe(false)
    rpc.mockImplementation(() => Promise.reject(new Error('network')))
    expect((await checkPhoneAvailable('9830012345')).taken).toBe(false)
  })
})

describe('asPhoneConflict', () => {
  it('returns null for unrelated errors without calling the server', async () => {
    expect(await asPhoneConflict({ code: '42501', message: 'rls' }, '9830012345')).toBeNull()
    expect(rpc).not.toHaveBeenCalled()
  })
  it('builds a PhoneConflictError with the masked email', async () => {
    rpc.mockResolvedValue({ data: [{ taken: true, masked_email: 'jo***h@gmail.com' }], error: null })
    const e = await asPhoneConflict({ code: '23505', message: 'phone_already_registered' }, '9830012345')
    expect(e).toBeInstanceOf(PhoneConflictError)
    expect(e?.maskedEmail).toBe('jo***h@gmail.com')
  })
  it('still builds the error when the lookup fails', async () => {
    rpc.mockImplementation(() => Promise.reject(new Error('network')))
    const e = await asPhoneConflict({ code: '23505', message: 'phone_already_registered' }, '9830012345')
    expect(e?.maskedEmail).toBeNull()
  })
})
