import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

/**
 * The living product guide must match the code. This runs the generator in --check mode, which fails when a page or
 * desk exists with no entry in scripts/feature-map/features.json, when an entry points at something that is gone, or
 * when a feature's audience contradicts how its route is gated. If it fails, edit features.json in the same change
 * (plain language, written for a member). See CLAUDE.md, "The living product guide".
 */
describe('product guide', () => {
  it('has an entry for every page and desk, and no entry for one that is gone', () => {
    const script = path.resolve(__dirname, '../../scripts/feature-map/generate.mjs')
    let out = ''
    try {
      out = execFileSync(process.execPath, [script, '--check'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (e) {
      const err = e as { stdout?: string; stderr?: string }
      throw new Error(`${err.stderr || ''}${err.stdout || ''}`.trim() || 'the guide generator failed')
    }
    expect(out).toContain('product guide:')
  })
})
