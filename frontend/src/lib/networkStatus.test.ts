import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getNetworkStatus,
  reportNetworkFailure,
  reportNetworkSuccess,
  subscribeNetworkStatus,
  __resetNetworkStatus,
} from './networkStatus'

// changelog/11-system-states.md §11.5 — "navigator.onLine plus a failed-request
// signal. onLine alone lies on captive portals."
//
// The banner itself needs a signed-in surface to be seen, so the two-input rule
// is verified here instead: this is the whole decision the banner renders.

function setOnLine(v: boolean) {
  Object.defineProperty(navigator, 'onLine', { value: v, configurable: true })
}

describe('networkStatus', () => {
  beforeEach(() => {
    __resetNetworkStatus()
    setOnLine(true)
  })

  it('is online by default', () => {
    expect(getNetworkStatus()).toEqual({ offline: false, reason: 'none' })
  })

  it('believes navigator.onLine === false immediately', () => {
    setOnLine(false)
    expect(getNetworkStatus()).toEqual({ offline: true, reason: 'browser' })
  })

  it('does NOT go offline on a single failed request', () => {
    // One dead image URL is a dead URL, not an outage. Telling a member they
    // are offline when they are not is worse than saying nothing.
    reportNetworkFailure()
    expect(getNetworkStatus().offline).toBe(false)
  })

  it('goes offline after repeated failures even while onLine is true', () => {
    // The captive-portal case: associated but not authenticated.
    reportNetworkFailure()
    reportNetworkFailure()
    expect(getNetworkStatus()).toEqual({ offline: true, reason: 'requests' })
  })

  it('clears on a single success', () => {
    reportNetworkFailure()
    reportNetworkFailure()
    expect(getNetworkStatus().offline).toBe(true)
    reportNetworkSuccess()
    expect(getNetworkStatus().offline).toBe(false)
  })

  it('does not count failures spread beyond the window', () => {
    vi.useFakeTimers()
    try {
      reportNetworkFailure()
      vi.advanceTimersByTime(9000)
      reportNetworkFailure()
      expect(getNetworkStatus().offline).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('notifies subscribers when the state flips, and unsubscribes cleanly', () => {
    const seen: boolean[] = []
    const off = subscribeNetworkStatus(s => seen.push(s.offline))
    reportNetworkFailure()
    reportNetworkFailure()
    reportNetworkSuccess()
    off()
    reportNetworkFailure()
    reportNetworkFailure()
    expect(seen).toEqual([true, false])
  })
})
