import { describe, it, expect } from 'vitest'
import { profilePath } from './profilePath'

describe('profilePath', () => {
  it('sends you to your own editable profile', () => {
    expect(profilePath('a', 'a')).toBe('/profile/a')
  })
  it('sends everyone else to the public profile', () => {
    expect(profilePath('a', 'b')).toBe('/member/b')
    expect(profilePath(null, 'b')).toBe('/member/b')
    expect(profilePath(undefined, 'b')).toBe('/member/b')
  })
})
