/**
 * deskModules is the desk's chunk-loader map and prefetcher. `tsc -b` already
 * proves `DESK_LOADERS` is TOTAL over `NavKey` (it's a `Record<NavKey, …>`),
 * so what's left to assert at runtime is the part the type system can't see:
 *
 *  - the loader map and `DESKS` describe the same set of desks, so a desk
 *    added to deskAccess.ts without a loader fails here as well as in tsc;
 *  - `deskKeyForPath` agrees with the real route paths in both directions,
 *    since the landing page's tiles prefetch by path and a wrong answer there
 *    would silently warm the wrong chunk (or, worse, a desk the viewer can't
 *    open);
 *  - a path OUTSIDE the desk set resolves to null rather than being guessed.
 *
 * Deliberately no React and no DOM, same as deskAccess.test.ts, so this runs
 * under vitest's node environment. It does not execute the loaders - calling
 * one would pull eighteen React components into a node test for no benefit.
 */
import { describe, it, expect } from 'vitest'
import { DESKS } from './deskAccess'
import { DESK_LOADERS, deskKeyForPath } from './deskModules'

describe('DESK_LOADERS', () => {
  it('covers exactly the desks declared in deskAccess', () => {
    expect(Object.keys(DESK_LOADERS).sort()).toEqual(DESKS.map(d => d.key).sort())
  })

  it('gives every desk its own distinct loader', () => {
    const fns = Object.values(DESK_LOADERS)
    expect(new Set(fns).size).toBe(fns.length)
    for (const fn of fns) expect(typeof fn).toBe('function')
  })
})

describe('deskKeyForPath', () => {
  it('round-trips every desk route back to its key', () => {
    for (const desk of DESKS) {
      expect(deskKeyForPath(`/director/${desk.path}`)).toBe(desk.key)
      // trailing slash, and a nested sub-route, both resolve to the same desk
      expect(deskKeyForPath(`/director/${desk.path}/`)).toBe(desk.key)
      expect(deskKeyForPath(`/director/${desk.path}/anything`)).toBe(desk.key)
    }
  })

  it('returns null for the desk index and for non-desk paths', () => {
    expect(deskKeyForPath('/director')).toBeNull()
    expect(deskKeyForPath('/director/')).toBeNull()
    expect(deskKeyForPath('/profile/me')).toBeNull()
    expect(deskKeyForPath('/notifications')).toBeNull()
    expect(deskKeyForPath('/director/not-a-desk')).toBeNull()
  })

  it('does not match a desk on a mere path PREFIX', () => {
    // `members` must not swallow a hypothetical `/director/members-export`.
    for (const desk of DESKS) {
      expect(deskKeyForPath(`/director/${desk.path}-export`)).not.toBe(desk.key)
    }
  })
})
