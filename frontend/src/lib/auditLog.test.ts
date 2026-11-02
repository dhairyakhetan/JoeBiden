import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpc = vi.fn()
vi.mock('./supabaseCommunity', () => ({ supabaseCommunity: { rpc: (...a: unknown[]) => rpc(...a) } }))
import { logAction } from './auditLog'

describe('logAction', () => {
  beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ error: null }) })
  it('sends p_entity_uuid and nulls the rest', () => {
    logAction('x', 'job_application', undefined, { a: 1 }, 'u-1')
    expect(rpc).toHaveBeenCalledWith('log_action', { p_action: 'x', p_entity_type: 'job_application', p_entity_id: null, p_details: { a: 1 }, p_entity_uuid: 'u-1' })
  })
  it('defaults entity uuid to null and never throws on rpc error', async () => {
    rpc.mockResolvedValue({ error: { message: 'no' } })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => logAction('y')).not.toThrow()
    expect(rpc.mock.calls[0][1].p_entity_uuid).toBeNull()
  })
})
