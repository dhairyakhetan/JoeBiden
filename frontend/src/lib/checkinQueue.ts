// Offline write queue for the welfare check-in sheet (handoff/16 §2 rule 2:
// "Offline first, visibly... It must never look like a failure — it is the
// expected condition."). Raw IndexedDB, no dependency — the same shape as
// paradox/lib/offlineQueue.ts (reused pattern per handoff/16 §1: "already
// built. Reuse the pattern; do not write a second queue."), kept as its own
// module rather than importing paradox's because that one is @ts-nocheck and
// keyed to a different DB/store name — this is the typed, community-app twin.
//
// keyPath 'key' makes the queue dedupe automatically: re-tapping the same
// person while offline just overwrites the one pending op for them, instead
// of stacking duplicate writes.

const DB_NAME = 'aq_community'
const STORE = 'checkin_queue'

export interface CheckInQueueItem {
  key: string // `${welfareProjectId}:${memberId ?? walkupName}`
  welfareProjectId: number
  memberId: number | null
  walkupName: string | null
  status: 'here' | 'left' | 'no_show' | 'walk_up'
  consentSigned: boolean
  checkedInAt: string | null
  checkedOutAt: string | null
  queued_at?: number
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function enqueue(item: CheckInQueueItem): Promise<true> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put({ ...item, queued_at: Date.now() })
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => reject(tx.error)
  })
}

export async function allQueued(): Promise<CheckInQueueItem[]> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const rq = tx.objectStore(STORE).getAll()
    rq.onsuccess = () => resolve(rq.result || [])
    rq.onerror = () => reject(rq.error)
  })
}

export async function dequeue(key: string): Promise<true> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => reject(tx.error)
  })
}

/** Flush pending ops through `handler(item) -> Promise`. Removes each on
 *  success; leaves failures queued for the next attempt. */
export async function flush(
  handler: (item: CheckInQueueItem) => Promise<void>
): Promise<{ ok: number; failed: number }> {
  const items = await allQueued()
  let ok = 0, failed = 0
  for (const it of items) {
    try { await handler(it); await dequeue(it.key); ok++ }
    catch { failed++ }
  }
  return { ok, failed }
}
