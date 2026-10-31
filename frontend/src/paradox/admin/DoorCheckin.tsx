// @ts-nocheck
// ─── Paradox OS · Phase 5 — offline-first door check-in ──────────────────────
// The on-day, one-thumb skin: big tap targets, search, check in. Every check-in
// is written to an IndexedDB queue first (optimistic), so it works with NO
// network — the failure that killed scanning on the day this year. A pending
// badge shows unsynced count; the queue auto-flushes on reconnect and via
// "sync now", deduped by registration id. Participants + volunteers (volunteer
// rows live in paradox_registrations too, or extend the source as needed).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toast'
import { enqueue, allQueued, flush } from '../lib/offlineQueue'

export function DoorCheckin() {
  const { success, error: toastError } = useToast()
  const [regs, setRegs] = useState([])
  const [pending, setPending] = useState({})   // id -> true (queued, unsynced)
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const refreshPending = useCallback(async () => {
    const items = await allQueued()
    setPending(Object.fromEntries(items.map((i) => [i.key, true])))
    return items
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('paradox_registrations')
      .select('id, reg_id, name, event_name, attended, paid').order('created_at', { ascending: false }).limit(2000)
    if (error) { toastError('Load failed', error.message); setLoading(false); return }
    setRegs(data || [])
    await refreshPending()
    setLoading(false)
  }, [toastError, refreshPending])
  useEffect(() => { load() }, [load])

  // Sync the queue to Supabase. Deduped by id (queue keyPath). Safe to call
  // repeatedly; only removes an op once its write lands.
  const sync = useCallback(async () => {
    if (syncing) return
    setSyncing(true)
    const { ok, failed } = await flush(async (it) => {
      const { data, error } = await supabase.from('paradox_registrations')
        .update({ attended: it.attended }).eq('id', it.key).select('id')
      if (error || !data?.length) throw new Error(error?.message || 'no row')
    })
    setSyncing(false)
    await refreshPending()
    if (ok) { success(`Synced ${ok} check-in${ok > 1 ? 's' : ''}`); load() }
    else if (failed) toastError('Sync failed', 'still offline? will retry')
  }, [syncing, refreshPending, success, toastError, load])

  // Online/offline listeners — auto-flush the moment the network returns.
  useEffect(() => {
    const on = () => { setOnline(true); sync() }
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [sync])

  const checkIn = async (r, next = true) => {
    // optimistic: queue + reflect immediately
    setRegs((prev) => prev.map((x) => (x.id === r.id ? { ...x, attended: next } : x)))
    await enqueue({ key: r.id, attended: next })
    setPending((p) => ({ ...p, [r.id]: true }))
    if (online) sync()
  }

  const view = useMemo(() => {
    const s = q.trim().toLowerCase()
    const list = s ? regs.filter((r) => `${r.name ?? ''} ${r.reg_id ?? ''} ${r.event_name ?? ''}`.toLowerCase().includes(s)) : regs
    return list.slice(0, 300)
  }, [regs, q])

  const pendingCount = Object.keys(pending).length
  const inCount = regs.filter((r) => r.attended).length

  if (loading) return <div className="py-16 text-center font-mono text-sm opacity-60">loading door…</div>

  return (
    <div className="px-4 sm:px-6 py-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 className="font-display text-xl">Door check-in</h2>
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="inline-flex items-center gap-1.5">
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: online ? '#1a7a4a' : '#a8380e' }} />
            {online ? 'online' : 'OFFLINE'}
          </span>
          {pendingCount > 0 && (
            <button onClick={sync} disabled={syncing} className="rounded-full px-2.5 py-1 font-bold" style={{ background: 'rgba(255,67,56,0.12)', color: 'var(--c1)' }}>
              {syncing ? 'syncing…' : `⇅ ${pendingCount} pending`}
            </button>
          )}
          <span className="opacity-50 tabular-nums">{inCount} in</span>
        </div>
      </div>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search name / ticket / event…"
        className="w-full mb-3 px-4 py-3 rounded-xl border-[1.5px] text-base" style={{ borderColor: 'var(--ink)' }} autoFocus />

      <div className="flex flex-col gap-2">
        {view.map((r) => {
          const isIn = !!r.attended
          return (
            <button key={r.id} onClick={() => checkIn(r, !isIn)}
              className="flex items-center gap-3 rounded-xl border-[1.5px] px-4 py-3 text-left active:scale-[0.99] transition-transform"
              style={{ borderColor: isIn ? '#1a7a4a' : 'var(--ink)', background: isIn ? 'rgba(26,122,74,0.10)' : 'transparent' }}>
              <span className="shrink-0 grid place-items-center rounded-lg font-display text-lg" style={{ width: 44, height: 44, border: '1.5px solid var(--ink)', background: isIn ? '#1a7a4a' : 'transparent', color: isIn ? '#fff' : 'var(--ink)' }}>{isIn ? '✓' : '○'}</span>
              <span className="flex-1 min-w-0">
                <span className="block font-display text-[15px] truncate">{r.name}</span>
                <span className="block font-mono text-[10px] opacity-50 truncate">{r.reg_id} · {r.event_name}{!r.paid && ' · ⚠ unpaid'}</span>
              </span>
              {pending[r.id] && <span className="shrink-0 font-mono text-[9px] rounded px-1.5 py-0.5" style={{ background: 'rgba(255,67,56,0.12)', color: 'var(--c1)' }}>queued</span>}
            </button>
          )
        })}
        {view.length === 0 && <div className="py-8 text-center font-mono text-[12px] opacity-50">no match</div>}
      </div>
    </div>
  )
}

export default DoorCheckin
