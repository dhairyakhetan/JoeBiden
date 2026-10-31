import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useToast } from '../../components/Toast'
import { acquireScrollLock } from '../../lib/scrollLock'
import { normalisePhone, prettyPhone, rupees, tidyPhone } from '../lib/format'
import { cleanDobNote, DOB_NOTE_MAX, findByPhone, normaliseInstagram, parseEntry, phoneKey, type DiscoPhase, type DiscoReg } from '../lib/discoDiwali'
import { addDiscoReg, deleteDiscoReg } from '../lib/discoDiwaliApi'

/**
 * Fast entry: a full-screen, one-handed way to log tickets from a phone while
 * WhatsApp confirmations come in or a queue builds at the door.
 *
 * Everything here exists to keep the keyboard up and the thumb in one place:
 *
 *  - Two fields, name then number. Enter on the name moves to the number, Enter
 *    on the number adds. School is behind a "+ school" tap because it is rarely
 *    known and costs a field every time.
 *  - The phase is a row of big chips, defaulting to whichever is live.
 *  - Buttons swallow pointerdown, so tapping Add never blurs the input and the
 *    keyboard does not drop and rise on every ticket.
 *  - The layout tracks the visual viewport, so the Add bar sits on top of the
 *    keyboard instead of under it (iOS does not resize fixed elements for it).
 *  - "Same buyer" keeps the number for the next ticket: one person paying for
 *    four friends is one number and four names.
 *  - Paste reads "Riya Das 98300 11111" straight off WhatsApp.
 *  - Every ticket added this session is listed with a one-tap undo, and
 *    "Copy message" bundles the buyer's tickets into one thank-you.
 */

const keepFocus = (e: React.PointerEvent) => e.preventDefault()

/** Height and offset of what is actually visible, so the bottom bar rides above the on-screen keyboard. */
function useVisualViewport(): { top: number; height: number } {
  const read = () => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    return { top: vv?.offsetTop ?? 0, height: vv?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 800) }
  }
  const [box, setBox] = useState(read)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const on = () => setBox(read())
    vv.addEventListener('resize', on)
    vv.addEventListener('scroll', on)
    return () => { vv.removeEventListener('resize', on); vv.removeEventListener('scroll', on) }
  }, [])
  return box
}

interface Added { row: DiscoReg; cash: boolean }

export function DiscoFastEntry({ phases, defaultPhase, regs, adminName, onAdded, onRemoved, onCopy, onClose }: {
  phases: DiscoPhase[]
  defaultPhase: string
  /** Everything already logged, for the same-number notice. */
  regs: DiscoReg[]
  adminName: string | null
  onAdded: (row: DiscoReg) => void
  onRemoved: (id: string) => void
  onCopy: (list: DiscoReg[]) => void | Promise<void>
  onClose: () => void
}) {
  const { success, error: toastError, info } = useToast()
  const vv = useVisualViewport()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [school, setSchool] = useState('')
  const [insta, setInsta] = useState('')
  const [dobText, setDobText] = useState('')
  const [closeFriend, setCloseFriend] = useState(false)
  const [showSchool, setShowSchool] = useState(false)
  const [phaseKey, setPhaseKey] = useState(defaultPhase)
  const [sameBuyer, setSameBuyer] = useState(false)
  const [busy, setBusy] = useState(false)
  const [added, setAdded] = useState<Added[]>([])
  const [flash, setFlash] = useState<string | null>(null)

  const nameRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const inFlight = useRef(false)

  useEffect(() => acquireScrollLock(), [])
  useEffect(() => { nameRef.current?.focus() }, [])
  // Escape closes it, as it would a dialog.
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [onClose])

  const phase = phases.find((p) => p.key === phaseKey) ?? phases.find((p) => p.key === defaultPhase) ?? phases[0]
  const normalised = normalisePhone(phone)
  const phoneOk = normalised !== null
  const ig = normaliseInstagram(insta)
  const dobNote = cleanDobNote(dobText)
  const canAdd = name.trim().length > 0 && phoneOk && !ig.error && !busy

  const sessionIds = useMemo(() => new Set(added.map((a) => a.row.id)), [added])
  const sameNumber = useMemo(() => (phoneOk ? findByPhone(regs, phone) : []), [regs, phone, phoneOk])
  const earlier = sameNumber.filter((r) => !sessionIds.has(r.id))

  const sessionTotal = added.reduce((s, a) => s + (a.row.amount ?? 0), 0)

  const submit = useCallback(async (cash: boolean) => {
    if (inFlight.current) return
    const n = name.trim()
    const p = normalisePhone(phone)
    if (!n || !p) {
      if (!n) nameRef.current?.focus(); else phoneRef.current?.focus()
      return
    }
    inFlight.current = true
    setBusy(true)
    try {
      const row = await addDiscoReg({
        name: n, phone: p, school: school.trim() || null, instagram: ig.handle, dob: dobNote, igCloseFriend: closeFriend && !!ig.handle, phase: phase.key,
        amount: phase.amount, cashWalkIn: cash, createdBy: adminName,
      })
      onAdded(row)
      setAdded((a) => [{ row, cash }, ...a])
      setFlash(`Added ${row.dd_id} · ${row.name}`)
      navigator.vibrate?.(15)
      setName('')
      if (!sameBuyer) setPhone('')
      setSchool('')
      setInsta('')
      setDobText('')
      setCloseFriend(false)
      setShowSchool(false)
      // Same buyer: the number stays, so the next ticket is just a name. Otherwise start again from the name.
      nameRef.current?.focus()
    } catch (e: any) {
      toastError("Couldn't add ticket", e?.message ?? 'Try again.')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }, [name, phone, school, ig.handle, dobNote, closeFriend, phase, adminName, sameBuyer, onAdded, toastError])

  const undo = async (a: Added) => {
    try {
      await deleteDiscoReg(a.row.id)
      onRemoved(a.row.id)
      setAdded((list) => list.filter((x) => x.row.id !== a.row.id))
      setFlash(`Removed ${a.row.dd_id}`)
    } catch (e: any) {
      toastError("Couldn't undo", e?.message ?? 'Try again.')
    }
  }

  const paste = async () => {
    try {
      const parsed = parseEntry(await navigator.clipboard.readText())
      if (!parsed) { info('Nothing to paste', 'Copy a name and number first.'); return }
      if (parsed.name) setName(parsed.name)
      if (parsed.phone) setPhone(parsed.phone)
      if (parsed.instagram) setInsta(parsed.instagram)
      if (parsed.name && parsed.phone) success('Pasted', `${parsed.name} · ${prettyPhone(parsed.phone)}`)
      else (parsed.name ? phoneRef : nameRef).current?.focus()
    } catch {
      toastError("Couldn't read the clipboard", 'Allow paste in the browser, or type it.')
    }
  }

  // The latest buyer's tickets from this session, for one bundled message.
  const lastKey = added[0] ? phoneKey(added[0].row.phone) : ''
  const buyerGroup = added.filter((a) => phoneKey(a.row.phone) === lastKey).map((a) => a.row).reverse()

  // Portalled to <body>: rendered in place, a parent's stacking context (the admin shell, AQ's fixed nav and phone tab bar)
  // would sit over the Add bar. 9000 is under the toast stack (9999) and Confirm (10000), so feedback still shows.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Fast entry"
      className="tt-root"
      style={{
        position: 'fixed', left: 0, right: 0, top: vv.top, height: vv.height, zIndex: 9000,
        display: 'flex', flexDirection: 'column', background: 'var(--tt-paper)', color: 'var(--tt-text)',
        overscrollBehavior: 'contain',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px 10px 16px', borderBottom: '1px solid var(--tt-hairline)' }}>
        <h2 style={{ margin: 0, marginRight: 'auto', fontFamily: 'var(--tt-display)', fontSize: 'clamp(16px, 5.2vw, 20px)', textTransform: 'uppercase', lineHeight: 1, whiteSpace: 'nowrap' }}>Fast entry</h2>
        <button type="button" className="tt-btn tt-btn--quiet" style={{ minHeight: 44, minWidth: 44, padding: '0 12px', flexShrink: 0 }} onClick={onClose} aria-label="Close fast entry">
          Done
        </button>
      </div>

      {/* Scrolling body */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '14px 16px 8px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gridAutoRows: 'max-content', alignContent: 'start', gap: 14 }}>
        {/* Phase */}
        <div role="radiogroup" aria-label="Phase" style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -16px', padding: '2px 16px 4px', scrollSnapType: 'x proximity' }}>
          {phases.map((p) => {
            const on = p.key === phase.key
            return (
              <button
                key={p.key} type="button" role="radio" aria-checked={on} onPointerDown={keepFocus} onClick={() => setPhaseKey(p.key)}
                className={`tt-chip ${on ? 'tt-chip--go' : ''}`}
                style={{
                  flex: '0 0 auto', minHeight: 52, padding: '0 18px', scrollSnapAlign: 'start', cursor: 'pointer',
                  display: 'grid', alignContent: 'center', gap: 0, textAlign: 'left',
                  border: on ? 'none' : '1px solid var(--tt-hairline-2)', opacity: p.closedManually ? 0.55 : 1,
                }}
              >
                <span>{p.label}</span>
                <span className="tt-num" style={{ fontSize: 'var(--tt-fs-meta)', opacity: 0.85 }}>{rupees(p.amount)}{p.closedManually ? ' · closed' : ''}</span>
              </button>
            )
          })}
        </div>

        {/* Name */}
        <div>
          <label className="tt-label" htmlFor="fe-name">Name</label>
          <input
            id="fe-name" ref={nameRef} className="tt-input" style={{ minHeight: 58, fontSize: 18 }}
            value={name} onChange={(e) => setName(e.target.value)}
            autoComplete="off" autoCapitalize="words" autoCorrect="off" spellCheck={false} enterKeyHint="next" placeholder="full name"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); phoneRef.current?.focus() } }}
          />
        </div>

        {/* Phone */}
        <div>
          <label className="tt-label" htmlFor="fe-phone">WhatsApp number</label>
          <div style={{ position: 'relative' }}>
            <span aria-hidden="true" className="tt-num" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--tt-muted)', fontSize: 18 }}>+91</span>
            <input
              id="fe-phone" ref={phoneRef} className="tt-input tt-num"
              style={{ minHeight: 58, fontSize: 20, paddingLeft: 58, paddingRight: 64, letterSpacing: '0.04em' }}
              value={phone} onChange={(e) => setPhone(tidyPhone(e.target.value))}
              type="tel" inputMode="numeric" autoComplete="off" enterKeyHint="done" placeholder="98300 11111" maxLength={16}
              aria-invalid={phone.length >= 10 && !phoneOk ? true : undefined}
              aria-describedby="fe-phone-hint"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void submit(false) } }}
            />
            <span
              className="tt-num" aria-hidden="true"
              style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 'var(--tt-fs-meta)', color: phoneOk ? 'var(--tt-volt)' : 'var(--tt-muted)' }}
            >
              {phoneOk ? '✓' : `${phone.length}/10`}
            </span>
          </div>
          <div id="fe-phone-hint" style={{ minHeight: 18, marginTop: 6, fontSize: 'var(--tt-fs-meta)' }} role="status">
            {phone.length >= 10 && !phoneOk ? (
              <span style={{ color: 'var(--tt-danger)' }}>Indian mobile numbers start with 6, 7, 8 or 9.</span>
            ) : earlier.length > 0 ? (
              <span style={{ color: 'var(--tt-amber)' }}>
                Already on this number: {earlier.slice(0, 2).map((r) => `${r.name} ${r.dd_id}`).join(', ')}{earlier.length > 2 ? ` +${earlier.length - 2}` : ''}. Fine for a second ticket.
              </span>
            ) : sameNumber.length > 0 ? (
              <span style={{ color: 'var(--tt-muted)' }}>{sameNumber.length} ticket{sameNumber.length === 1 ? '' : 's'} on this number so far.</span>
            ) : null}
          </div>
        </div>

        {/* Instagram: one per ticket, so it clears after every add (unlike the buyer's number). */}
        <div>
          <label className="tt-label" htmlFor="fe-insta">Instagram (optional)</label>
          <div style={{ position: 'relative' }}>
            <span aria-hidden="true" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--tt-muted)', fontSize: 18 }}>@</span>
            <input
              id="fe-insta" className="tt-input" style={{ minHeight: 58, fontSize: 18, paddingLeft: 40 }}
              value={insta} onChange={(e) => setInsta(e.target.value)}
              autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="done" placeholder="handle or profile link"
              aria-invalid={ig.error ? true : undefined} aria-describedby="fe-insta-hint"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void submit(false) } }}
            />
          </div>
          <div id="fe-insta-hint" role="status" style={{ minHeight: 18, marginTop: 6, fontSize: 'var(--tt-fs-meta)', color: ig.error ? 'var(--tt-danger)' : 'var(--tt-muted)' }}>
            {ig.error ?? (ig.handle && ig.handle !== insta.trim() ? `Will save as @${ig.handle}` : '')}
          </div>
        </div>

        {/* Date of birth: optional, one per ticket, and just a NOTE: whatever is typed is stored as typed (no date format, no checks). */}
        <div>
          <label className="tt-label" htmlFor="fe-dob">Date of birth (optional)</label>
          <input
            id="fe-dob" className="tt-input" style={{ minHeight: 58, fontSize: 18 }} value={dobText} onChange={(e) => setDobText(e.target.value)}
            type="text" maxLength={DOB_NOTE_MAX} placeholder="type it any way you like" autoComplete="off" enterKeyHint="done"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void submit(false) } }}
          />
        </div>

        {/* Options row */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button" role="switch" aria-checked={sameBuyer} onPointerDown={keepFocus} onClick={() => setSameBuyer((v) => !v)}
            className={`tt-chip ${sameBuyer ? 'tt-chip--go' : ''}`} style={{ minHeight: 48, padding: '0 12px', whiteSpace: 'nowrap', cursor: 'pointer', border: sameBuyer ? 'none' : '1px solid var(--tt-hairline-2)' }}
            title="Keep the number after adding, so the next ticket is just a name"
          >
            Same buyer
          </button>
          <button
            type="button" role="switch" aria-checked={closeFriend} onPointerDown={keepFocus} onClick={() => setCloseFriend((v) => !v)} disabled={!ig.handle}
            className={`tt-chip ${closeFriend ? 'tt-chip--go' : ''}`} style={{ minHeight: 48, padding: '0 12px', whiteSpace: 'nowrap', cursor: ig.handle ? 'pointer' : 'not-allowed', opacity: ig.handle ? 1 : 0.5, border: closeFriend ? 'none' : '1px solid var(--tt-hairline-2)' }}
            title={ig.handle ? 'Tick when you have already added them to Close Friends' : 'Add an Instagram handle first'}
          >
            In close friends
          </button>
          <button type="button" onPointerDown={keepFocus} onClick={() => void paste()} className="tt-chip" style={{ minHeight: 48, padding: '0 12px', whiteSpace: 'nowrap', cursor: 'pointer', border: '1px solid var(--tt-hairline-2)' }}>
            Paste
          </button>
          {!showSchool && (
            <button type="button" onPointerDown={keepFocus} onClick={() => setShowSchool(true)} className="tt-chip" style={{ minHeight: 48, padding: '0 12px', whiteSpace: 'nowrap', cursor: 'pointer', border: '1px solid var(--tt-hairline-2)' }}>
              + School
            </button>
          )}
        </div>
        {showSchool && (
          <div>
            <label className="tt-label" htmlFor="fe-school">School (optional)</label>
            <input id="fe-school" className="tt-input" value={school} onChange={(e) => setSchool(e.target.value)} autoComplete="off" autoCapitalize="words" enterKeyHint="done"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void submit(false) } }} />
          </div>
        )}

        {/* This session */}
        <section aria-label="Added this session" style={{ display: 'grid', gap: 8, marginTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 32 }}>
            <strong style={{ fontSize: 'var(--tt-fs-label)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--tt-muted)' }}>This session</strong>
            <span
              className="tt-chip tt-chip--go tt-num" style={{ marginLeft: 'auto', minHeight: 32, padding: '0 12px', whiteSpace: 'nowrap' }}
              role="status" aria-label={`${added.length} added this session, ${rupees(sessionTotal)}`}
            >
              {added.length} · {rupees(sessionTotal)}
            </span>
          </div>
          <div role="status" aria-live="polite" className="tt-num" style={{ minHeight: 18, color: 'var(--tt-volt)', fontSize: 'var(--tt-fs-meta)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {flash ?? ''}
          </div>
          {added.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--tt-muted)', fontSize: 'var(--tt-fs-body)' }}>
              Type a name and number, press Enter. Each ticket lands here with an undo.
            </p>
          ) : (
            <>
              {buyerGroup.length > 0 && (
                <button type="button" className="tt-btn tt-btn--go" style={{ minHeight: 48 }} onPointerDown={keepFocus} onClick={() => void onCopy(buyerGroup)}>
                  Copy message{buyerGroup.length > 1 ? ` for ${buyerGroup.length} (same buyer)` : ''}
                </button>
              )}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
                {added.slice(0, 8).map((a) => (
                  <li key={a.row.id} className="tt-card" style={{ padding: '8px 8px 8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                        <span className="tt-num" style={{ color: 'var(--tt-cyan)', fontWeight: 700 }}>{a.row.dd_id}</span>
                        {a.cash && <span className="tt-chip tt-chip--go" style={{ minHeight: 0, padding: '1px 8px', fontSize: 11 }}>Cash · in</span>}
                      </div>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.row.name}</div>
                      <div className="tt-num" style={{ color: 'var(--tt-muted)', fontSize: 'var(--tt-fs-meta)' }}>{prettyPhone(a.row.phone)} · {rupees(a.row.amount)}{a.row.instagram ? ` · @${a.row.instagram}${a.row.ig_close_friend ? ' ✓' : ''}` : ''}</div>
                    </div>
                    <button type="button" className="tt-btn tt-btn--quiet" style={{ minHeight: 48, minWidth: 48, padding: '0 12px' }} onPointerDown={keepFocus} onClick={() => void onCopy([a.row])} aria-label={`Copy message for ${a.row.name}`}>
                      Copy
                    </button>
                    <button type="button" className="tt-btn tt-btn--quiet" style={{ minHeight: 48, minWidth: 48, padding: '0 12px', color: 'var(--tt-danger)' }} onPointerDown={keepFocus} onClick={() => void undo(a)} aria-label={`Undo ${a.row.dd_id}`}>
                      Undo
                    </button>
                  </li>
                ))}
              </ul>
              {added.length > 8 && <p style={{ margin: 0, color: 'var(--tt-muted)', fontSize: 'var(--tt-fs-meta)' }}>+ {added.length - 8} earlier, all on the main list.</p>}
            </>
          )}
        </section>
      </div>

      {/* Action bar: sits on the keyboard, thumb-height, never scrolls away. */}
      <div style={{ display: 'flex', gap: 10, padding: '10px 14px calc(10px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--tt-hairline)', background: 'var(--tt-paper-2)' }}>
        <button
          type="button" className="tt-btn tt-btn--quiet" disabled={!canAdd} onPointerDown={keepFocus} onClick={() => void submit(true)}
          style={{ flex: '0 0 auto', minHeight: 58, padding: '0 14px', whiteSpace: 'nowrap', color: 'var(--tt-volt)' }} title="Paid cash and walking in now: logged as paid and checked in"
        >
          Cash + in
        </button>
        <button
          type="button" className="tt-btn" disabled={!canAdd} onPointerDown={keepFocus} onClick={() => void submit(false)}
          style={{ flex: '1 1 0', minWidth: 0, minHeight: 58, fontSize: 17, whiteSpace: 'nowrap' }}
        >
          {busy ? 'Adding…' : `Add · ${rupees(phase.amount)}`}
        </button>
      </div>
    </div>,
    document.body,
  )
}
