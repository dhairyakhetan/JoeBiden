import { describe, it, expect, vi } from 'vitest'
vi.mock('../services/coreMemberService', () => ({ default: {} }))
import { parseEmailList } from './coreMembers'

describe('parseEmailList', () => {
  it('reads a pasted sheet column', () => {
    expect(parseEmailList('a@example.com\nB@Example.com\n\n')).toEqual(['a@example.com', 'b@example.com'])
  })
  it('reads commas, semicolons, tabs and "Name <email>"', () => {
    expect(parseEmailList('Test One <one@x.in>; two@x.in,\tthree@x.in')).toEqual(['one@x.in', 'two@x.in', 'three@x.in'])
  })
  it('drops duplicates regardless of case', () => {
    expect(parseEmailList('dup@x.in DUP@x.in')).toEqual(['dup@x.in'])
  })
  it('ignores headers, names and phone numbers', () => {
    expect(parseEmailList('Name\tEmail\tPhone\nTest\t\t+91 98300 00000')).toEqual([])
  })
})
