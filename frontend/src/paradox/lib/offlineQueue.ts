// @ts-nocheck
// ─── Paradox OS · Phase 5 — offline write queue (raw IndexedDB, no dependency) ─
// Check-in/attendance writes go here first so a dead venue network never loses a
// scan (scanning was abandoned on the day this year when the network failed).
// keyPath 'key' makes the queue dedupe by ticket/registration id automatically —
// re-scanning the same person while offline just overwrites the one pending op.
const DB = 'paradox_os'
const STORE = 'checkin_queue'

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function enqueue(item) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put({ ...item, queued_at: Date.now() })
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => reject(tx.error)
  })
}

export async function allQueued() {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const rq = tx.objectStore(STORE).getAll()
    rq.onsuccess = () => resolve(rq.result || [])
    rq.onerror = () => reject(rq.error)
  })
}

export async function dequeue(key) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => reject(tx.error)
  })
}

// Flush pending ops through `handler(item) -> Promise`. Removes each on success;
// leaves failures queued for the next attempt. Returns {ok, failed}.
export async function flush(handler) {
  const items = await allQueued()
  let ok = 0, failed = 0
  for (const it of items) {
    try { await handler(it); await dequeue(it.key); ok++ }
    catch { failed++ }
  }
  return { ok, failed }
}
