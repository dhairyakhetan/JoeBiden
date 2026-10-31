/**
 * Offline check-in queue, ADM-15 / PRD 7.7.
 *
 * Venue Wi-Fi is the thing that actually breaks gate scanning, and it breaks at
 * exactly the moment a queue forms. Every scan is written to IndexedDB FIRST
 * and reflected in the UI immediately, then flushed to Supabase when the
 * network returns. The volunteer never waits on a round trip.
 *
 * Deduped by registration id + day, which is the same key the database's unique
 * index uses, so a replayed flush is harmless.
 *
 * Known limit, stated rather than hidden: two phones scanning the same ticket
 * while BOTH are offline will each admit it, because neither can see the
 * other's queue. That is why Saturday runs one scanner phone per gate
 * (decided 2026-09-19).
 */
const DB_NAME = 'terrathon-checkin'
const STORE = 'queue'
const VERSION = 1

export interface QueuedScan {
  key: string           // `${registrationId}|${day}`
  registrationId: string
  token: string
  day: string
  at: number
  label: string         // team or player name, so the UI can render without the network
}

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') { resolve(null); return }
    let req: IDBOpenDBRequest
    try { req = indexedDB.open(DB_NAME, VERSION) } catch { resolve(null); return }
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await open()
  if (!db) return null
  return new Promise((resolve) => {
    let req: IDBRequest<T>
    try { req = fn(db.transaction(STORE, mode).objectStore(STORE)) } catch { resolve(null); return }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
  })
}

/**
 * Returns whether the scan actually landed in IndexedDB. `tx()` resolves
 * `null` (never rejects) both when `indexedDB` is unavailable and when the
 * write itself failed, so that `null` is the only signal the caller has that
 * nothing was persisted. A `put` that succeeds always resolves with the key,
 * which is never `null`, so `res !== null` is a safe success check.
 */
export async function enqueue(scan: QueuedScan): Promise<boolean> {
  const res = await tx('readwrite', (s) => s.put(scan) as IDBRequest<any>)
  return res !== null
}

export async function allQueued(): Promise<QueuedScan[]> {
  const rows = await tx<QueuedScan[]>('readonly', (s) => s.getAll() as IDBRequest<QueuedScan[]>)
  return rows ?? []
}

export async function dequeue(key: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(key) as IDBRequest<any>)
}

/**
 * Sends each queued scan through `send`. An item is removed only once its write
 * lands, so a partial flush leaves the rest queued rather than losing them.
 * Safe to call repeatedly and concurrently.
 *
 * `send` can mark an error `.permanent = true` to say the server has
 * definitively rejected the scan (the team was cancelled, wrong day, and so
 * on) rather than the request merely failing to reach it. A permanent
 * rejection is dropped from the queue immediately instead of being retried
 * forever, and is returned separately so the caller can tell a human "this
 * person was let in on an invalid ticket" instead of "still offline".
 */
export async function flush(
  send: (scan: QueuedScan) => Promise<void>,
): Promise<{ ok: number; failed: number; rejected: QueuedScan[] }> {
  const items = await allQueued()
  let ok = 0
  let failed = 0
  const rejected: QueuedScan[] = []
  for (const item of items) {
    try {
      await send(item)
      await dequeue(item.key)
      ok++
    } catch (e: any) {
      if (e?.permanent) {
        await dequeue(item.key)
        rejected.push(item)
      } else {
        failed++
      }
    }
  }
  return { ok, failed, rejected }
}

export function scanKey(registrationId: string, day: string): string {
  return `${registrationId}|${day}`
}
