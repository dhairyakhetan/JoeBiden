// Root cause of the "Lock 'lock:sb-...-auth-token' was released because
// another request stole it" error class: supabase-js serializes session
// refresh through the browser's Web Locks API, and when the SAME account is
// open in two tabs at once, both tabs' clients contend for that lock during
// a refresh. withRetry (asyncUtils.ts) makes a lost race self-heal instead of
// surfacing an error, but the cheapest real fix is removing the race
// entirely: only one tab should be doing live Supabase work at a time.
//
// This is a lightweight BroadcastChannel leader election, not a full
// distributed-lock library - deliberately so, since the only thing at stake
// is "which tab's Supabase client is allowed to be the active one", not
// correctness-critical shared state. A tab that loses the election (or a
// browser with no BroadcastChannel support, which just always wins
// leadership - never worse than today) is told via `onLeaderChange(false)`
// and the caller decides what to do with that (see SingleTabGate.tsx).
type Msg =
  | { type: 'ping' }
  | { type: 'here'; id: string }
  | { type: 'claim'; id: string }
  | { type: 'bye'; id: string }

const TAB_ID = (typeof crypto !== 'undefined' && crypto.randomUUID)
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2)}`

export interface TabLock {
  /** Force this tab to become the active one (used by the "use this tab instead" button). */
  takeOver: () => void
  destroy: () => void
}

export function createTabLock(onLeaderChange: (isLeader: boolean) => void): TabLock {
  if (typeof BroadcastChannel === 'undefined') {
    onLeaderChange(true)
    return { takeOver() {}, destroy() {} }
  }

  const channel = new BroadcastChannel('aq-active-tab')
  let isLeader = false
  let leaderKnown = false

  const announceLeader = () => {
    isLeader = true
    leaderKnown = true
    onLeaderChange(true)
    channel.postMessage({ type: 'here', id: TAB_ID } satisfies Msg)
  }

  /**
   * Validate before acting. BroadcastChannel is same-origin, but "same origin"
   * includes every other tab, an extension content script and any future code on
   * this domain - and a message that merely LOOKS like a claim makes this tab a
   * follower, which SingleTabGate renders as a blanked app. Losing the UI to a
   * malformed postMessage is a bad failure mode for a control whose only job is
   * choosing which tab refreshes a token, so anything unrecognised is ignored.
   * Audit 2026-09-17, security P3.
   */
  const isValidMsg = (m: unknown): m is Msg => {
    if (!m || typeof m !== 'object') return false
    const { type, id } = m as { type?: unknown; id?: unknown }
    if (type === 'ping') return true
    if (type === 'here' || type === 'claim' || type === 'bye') {
      return typeof id === 'string' && id.length > 0 && id.length <= 128
    }
    return false
  }

  channel.onmessage = (e: MessageEvent<Msg>) => {
    if (!isValidMsg(e.data)) return
    const msg = e.data
    if (msg.type === 'ping') {
      if (isLeader) channel.postMessage({ type: 'here', id: TAB_ID } satisfies Msg)
    } else if (msg.type === 'here') {
      if (msg.id !== TAB_ID) {
        leaderKnown = true
        isLeader = false
        onLeaderChange(false)
      }
    } else if (msg.type === 'claim') {
      if (msg.id !== TAB_ID) {
        leaderKnown = true
        isLeader = false
        onLeaderChange(false)
      }
    } else if (msg.type === 'bye') {
      // The leader tab closed/navigated away - re-elect. Random delay so
      // several surviving followers don't all self-promote simultaneously.
      if (msg.id !== TAB_ID && !isLeader) {
        leaderKnown = false
        setTimeout(() => {
          if (!leaderKnown) announceLeader()
        }, 80 + Math.random() * 220)
      }
    }
  }

  channel.postMessage({ type: 'ping' } satisfies Msg)
  const electionTimer = setTimeout(() => {
    if (!leaderKnown) announceLeader()
  }, 200)

  const handleUnload = () => channel.postMessage({ type: 'bye', id: TAB_ID } satisfies Msg)
  window.addEventListener('beforeunload', handleUnload)

  return {
    takeOver() {
      channel.postMessage({ type: 'claim', id: TAB_ID } satisfies Msg)
      announceLeader()
    },
    destroy() {
      clearTimeout(electionTimer)
      window.removeEventListener('beforeunload', handleUnload)
      channel.close()
    },
  }
}
