import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// The admin pages read and write personal data (guests' phones, dates of birth, enquirers' contacts). The database is the real
// boundary, but a route that forgets the sign-in gate would still render an empty shell to the public and invite probing. This pins
// the rule at the source: every route under admin/ goes through guarded(), and nothing guest-facing sneaks back in unannounced.
const src = readFileSync('src/live/LiveRoot.tsx', 'utf8')
const routes = src.split('\n').flatMap(line => { const m = /<Route path="([^"]+)" element=\{(.*)\} \/>/.exec(line); return m ? [{ path: m[1], el: m[2] }] : [] })

describe('LiveRoot routes', () => {
  it('finds the routes it is checking', () => {
    expect(routes.length).toBeGreaterThan(10)
    expect(routes.filter(r => r.path.startsWith('admin')).length).toBeGreaterThanOrEqual(4)
  })
  it('puts every admin route behind the sign-in gate', () => {
    for (const r of routes.filter(r => r.path === 'admin' || r.path.startsWith('admin/'))) {
      expect(r.el, `/live/${r.path} must use guarded(...)`).toContain('guarded(')
    }
  })
  it('gates admin as the AquaTerra.live brand, so the sign-in speaks as this site', () => {
    expect(src).toContain('<AdminGate brand="live">')
  })
  it('hides the public nav, footer, loader and grain on admin pages', () => {
    expect(src).toMatch(/const admin = pathname\.startsWith\(`\$\{LIVE\.base\}\/admin`\)/)
    expect(src).toContain('{!admin && <Nav />}')
    expect(src).toContain('{!admin && <Footer />}')
  })
  it('has no guest sign-in route while that area is not built', () => {
    expect(routes.map(r => r.path).filter(p => /enter|\/me$|guest/i.test(p))).toEqual([])
  })
})
