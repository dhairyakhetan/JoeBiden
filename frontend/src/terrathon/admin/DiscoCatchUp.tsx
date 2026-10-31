import { useEffect, useMemo, useRef, useState } from 'react'
import { cleanDobNote, DOB_NOTE_MAX, normaliseInstagram, type DiscoReg } from '../lib/discoDiwali'

/**
 * The catch-up space: one row per ticket, with the Instagram handle, date of birth and the Close Friends tick as inline fields, so
 * the people who registered BEFORE those fields existed can be filled in quickly, without opening each ticket.
 *
 * Every field saves by itself when you leave it (the tick and the date save the moment they change) and shows a small "Saved" mark,
 * so there is no Save button to forget. A bad value is refused with its reason and nothing is sent. The list is a snapshot taken when
 * the sheet opens, so a row does not jump away from under your cursor the moment it is complete.
 */
export function DiscoCatchUp({ regs, onSave, onClose }: {
  regs: DiscoReg[]
  onSave: (id: string, patch: Partial<DiscoReg>) => Promise<boolean>
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = ref.current
    if (el && !el.open) el.showModal()
  }, [])

  // Taken once, on open. Missing = no handle, no date of birth, or a handle that is not yet ticked into Close Friends.
  const [missingIds] = useState(() => new Set(regs.filter((r) => !r.instagram || !r.dob || !r.ig_close_friend).map((r) => r.id)))
  const [onlyMissing, setOnlyMissing] = useState(true)
  const [search, setSearch] = useState('')
  const [drafts, setDrafts] = useState<Record<string, { ig?: string; dob?: string }>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<Set<string>>(new Set())

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return regs
      .filter((r) => (!onlyMissing || missingIds.has(r.id)) && (!q || `${r.name} ${r.phone} ${r.dd_id} ${r.instagram ?? ''}`.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [regs, onlyMissing, missingIds, search])

  const remaining = regs.filter((r) => !r.instagram || !r.dob).length

  const mark = (id: string) => setSaved((s) => new Set(s).add(id))
  const setErr = (key: string, msg: string | null) =>
    setErrors((e) => { const n = { ...e }; if (msg) n[key] = msg; else delete n[key]; return n })

  const saveInsta = async (r: DiscoReg) => {
    const raw = drafts[r.id]?.ig
    if (raw === undefined) return
    const { handle, error } = normaliseInstagram(raw)
    if (error) { setErr(`${r.id}:ig`, error); return }
    setErr(`${r.id}:ig`, null)
    if (handle === (r.instagram ?? null)) return
    // Removing a handle also clears the tick: nobody is in Close Friends without one.
    const ok = await onSave(r.id, handle ? { instagram: handle } : { instagram: null, ig_close_friend: false })
    if (ok) { mark(r.id); setDrafts((d) => ({ ...d, [r.id]: { ...d[r.id], ig: undefined } })) }
  }

  const saveDob = async (r: DiscoReg) => {
    // A free-text note: it saves when you leave the field (or press Enter), exactly as typed (trimmed). Nothing is parsed or refused.
    // Untouched, or unchanged, means nothing to do.
    const raw = drafts[r.id]?.dob
    if (raw === undefined) return
    const dob = cleanDobNote(raw)
    if (dob === (r.dob ?? null)) { setDrafts((d) => ({ ...d, [r.id]: { ...d[r.id], dob: undefined } })); return }
    const ok = await onSave(r.id, { dob })
    if (ok) { mark(r.id); setDrafts((d) => ({ ...d, [r.id]: { ...d[r.id], dob: undefined } })) }
  }

  const saveTick = async (r: DiscoReg, next: boolean) => {
    if (await onSave(r.id, { ig_close_friend: next })) mark(r.id)
  }

  return (
    <dialog
      ref={ref}
      aria-label="Catch up on Instagram and date of birth"
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose() }}
      // A <dialog> sets its own colour (CanvasText), which is dark on this night-sky frame, so put the text colour back.
      style={{ border: 'none', padding: 16, margin: 'auto', background: 'transparent', color: 'var(--tt-text)', maxWidth: '100vw', maxHeight: '100vh' }}
    >
      <div className="tt-card tt-card--raised" style={{ width: 'min(860px, 100%)', maxHeight: '92dvh', overflowY: 'auto', display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: 24, textTransform: 'uppercase' }}>Catch up</h2>
            <div style={{ fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-muted)' }}>
              Instagram, date of birth and Close Friends for tickets already booked. Each field saves when you leave it.
              {' '}<span className="tt-num">{remaining}</span> still missing a handle or a date of birth.
            </div>
          </div>
          <button type="button" className="tt-btn tt-btn--quiet" style={{ marginLeft: 'auto', minHeight: 'var(--tt-ctl)' }} onClick={onClose}>Done</button>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="tt-input" style={{ flex: '1 1 220px', minHeight: 44 }} aria-label="Search tickets"
            placeholder="Search name, phone, ID…" value={search} onChange={(e) => setSearch(e.target.value)}
          />
          <label className="tt-check">
            <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
            <span>Only tickets missing something</span>
          </label>
          <span className="tt-num" style={{ color: 'var(--tt-muted)', fontSize: 'var(--tt-fs-meta)' }}>{rows.length} shown</span>
        </div>

        {rows.length === 0 ? (
          <p style={{ color: 'var(--tt-muted)', margin: 0 }}>Nothing to show. {onlyMissing ? 'Every ticket here has a handle, a date of birth and its Close Friends tick.' : 'No ticket matches that search.'}</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
            {rows.map((r) => {
              const igDraft = drafts[r.id]?.ig ?? r.instagram ?? ''
              const dobDraft = drafts[r.id]?.dob ?? r.dob ?? ''
              const igErr = errors[`${r.id}:ig`]
              const hasHandle = !!r.instagram
              return (
                <li key={r.id} className="tt-card" style={{ padding: 12, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', alignItems: 'start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{r.name}</div>
                    <div className="tt-num" style={{ color: 'var(--tt-muted)', fontSize: 'var(--tt-fs-meta)' }}>{r.dd_id} · {r.phone}</div>
                    {saved.has(r.id) && <div role="status" style={{ color: 'var(--tt-volt)', fontSize: 'var(--tt-fs-meta)', marginTop: 2 }}>Saved ✓</div>}
                  </div>
                  <div>
                    <label className="tt-label" htmlFor={`cu-ig-${r.id}`}>Instagram</label>
                    <input
                      id={`cu-ig-${r.id}`} className="tt-input" value={igDraft} placeholder="@handle or profile link"
                      autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-invalid={igErr ? true : undefined}
                      onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: { ...d[r.id], ig: e.target.value } }))}
                      onBlur={() => void saveInsta(r)}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    />
                    {igErr && <div role="alert" style={{ marginTop: 4, fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-danger)' }}>{igErr}</div>}
                  </div>
                  <div>
                    <label className="tt-label" htmlFor={`cu-dob-${r.id}`}>Date of birth</label>
                    <input
                      id={`cu-dob-${r.id}`} className="tt-input" type="text" autoComplete="off" maxLength={DOB_NOTE_MAX} placeholder="type it any way you like"
                      value={dobDraft}
                      onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: { ...d[r.id], dob: e.target.value } }))}
                      onBlur={() => void saveDob(r)}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    />
                  </div>
                  <label className="tt-check" style={{ alignSelf: 'center' }}>
                    <input
                      type="checkbox" checked={!!r.ig_close_friend} disabled={!hasHandle}
                      onChange={(e) => void saveTick(r, e.target.checked)}
                    />
                    <span>{hasHandle ? 'In Close Friends' : 'Add a handle first'}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </dialog>
  )
}
