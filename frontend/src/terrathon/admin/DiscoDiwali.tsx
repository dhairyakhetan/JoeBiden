import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/Confirm'
import { useAuth } from '../../auth/AuthContext'
import { EVENT } from '../config'
import { rupees, relativeTime, istDateTime, prettyPhone, waNumber } from '../lib/format'
import { useServerOffset } from '../lib/hooks'
import {
  DD_PHASES_DEFAULT, DD_SETTINGS_PHASES, DD_SETTINGS_THANKYOU, DD_SETTINGS_THANKYOU_MULTI,
  DD_THANKYOU_DEFAULT, DD_THANKYOU_MULTI_DEFAULT,
  buildCsv, composeThankYou, computeLivePhase, hasCashNote, nextPhaseKey, parsePhases, phaseCounts,
  istDateKey, viewRegs, normaliseInstagram, cleanDobNote, DOB_NOTE_MAX, closeFriendsToAdd, instagramUrl,
  type DiscoFilter, type DiscoPhase, type DiscoReg, type DiscoSort,
} from '../lib/discoDiwali'
import {
  addDiscoReg, deleteDiscoReg, listDiscoRegs, listDiscoSettings, saveDiscoSetting, savePhases,
  updateDiscoReg,
} from '../lib/discoDiwaliApi'
import { DiscoFastEntry } from './DiscoFastEntry'
import { DiscoCatchUp } from './DiscoCatchUp'
import '../terrathon.css'

/**
 * Disco Diwali desk: the Paradox After Party desk, ported to the TerraThon admin.
 *
 * Admins log confirmed tickets by hand as payments arrive, copy a thank-you
 * message (one ticket, or several bundled for one customer), and tick people in
 * at the door. Rows are cards, not a wide table, because this is run from a
 * phone at the venue and a 10-column table does not survive a 375px screen.
 *
 * Schema and RLS: scripts/disco_diwali_registrations_2026_10_01.sql
 */

const GREEN = 'var(--tt-volt)'

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="tt-card" style={{ padding: 14, minWidth: 0 }}>
      <div style={{ fontSize: 'var(--tt-fs-meta)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--tt-muted)' }}>{label}</div>
      {/* `.tt-num`, not an inline family: this is a live count on a screen that
          stays open all night, and NeutralFace has no tabular figures. */}
      <div className="tt-num" style={{ fontSize: 30, lineHeight: 1.05, marginTop: 4, color: accent ?? 'var(--tt-text)' }}>{value}</div>
    </div>
  )
}

/** Native <dialog> via showModal(): focus trap, Escape and focus restore for free. Same approach as ManualAdd. */
function Dialog({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = ref.current
    if (el && !el.open) el.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose() }}
      style={{ border: 'none', padding: 16, margin: 'auto', background: 'transparent', color: 'var(--tt-text)', maxWidth: '100vw', maxHeight: '100vh' }}
    >
      {children}
    </dialog>
  )
}

function EditModal({ reg, phases, onClose, onSave }: {
  reg: DiscoReg
  phases: DiscoPhase[]
  onClose: () => void
  onSave: (patch: Partial<DiscoReg>) => Promise<boolean>
}) {
  const [f, setF] = useState({
    name: reg.name, phone: reg.phone, school: reg.school ?? '', instagram: reg.instagram ?? '', dob: reg.dob ?? '', closeFriend: !!reg.ig_close_friend, phase: reg.phase,
    amount: reg.amount?.toString() ?? '', paid: reg.paid, notes: reg.notes ?? '',
  })
  const [saving, setSaving] = useState(false)

  // Picking a phase fills in its price; the amount can still be overridden afterwards (comp, refund, part payment).
  const onPhase = (key: string) => {
    const p = phases.find((x) => x.key === key)
    setF((s) => ({ ...s, phase: key, amount: p ? String(p.amount) : s.amount }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.name.trim() || !f.phone.trim()) return
    if (normaliseInstagram(f.instagram).error) return
    setSaving(true)
    const n = f.amount.trim() === '' ? null : parseInt(f.amount, 10)
    const ok = await onSave({
      name: f.name.trim(), phone: f.phone.trim(), school: f.school.trim() || null, instagram: normaliseInstagram(f.instagram).handle, dob: cleanDobNote(f.dob), ig_close_friend: !!normaliseInstagram(f.instagram).handle && f.closeFriend, phase: f.phase,
      amount: n !== null && Number.isFinite(n) && n >= 0 ? n : null, paid: f.paid, notes: f.notes.trim() || null,
    })
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <Dialog label={`Edit ${reg.dd_id}`} onClose={onClose}>
      <form onSubmit={submit} className="tt-card tt-card--raised" style={{ width: 'min(430px, 100%)', maxHeight: '92dvh', overflowY: 'auto', display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div>
            <h2 style={{ fontSize: 24, textTransform: 'uppercase' }}>Edit {reg.dd_id}</h2>
            <div style={{ fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-muted)' }}>The ID is permanent once issued.</div>
          </div>
          <button type="button" className="tt-btn tt-btn--quiet" style={{ marginLeft: 'auto', minHeight: 'var(--tt-ctl)' }} onClick={onClose}>Close</button>
        </div>
        <div>
          <label className="tt-label" htmlFor="dd-e-name">Name</label>
          <input id="dd-e-name" className="tt-input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <div>
          <label className="tt-label" htmlFor="dd-e-phone">Phone</label>
          <input id="dd-e-phone" className="tt-input" type="tel" inputMode="tel" required value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </div>
        <div>
          <label className="tt-label" htmlFor="dd-e-insta">Instagram (optional)</label>
          <input id="dd-e-insta" className="tt-input" value={f.instagram} onChange={(e) => setF({ ...f, instagram: e.target.value })} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="@handle or profile link" aria-invalid={normaliseInstagram(f.instagram).error ? true : undefined} />
          {normaliseInstagram(f.instagram).error && <div role="alert" style={{ marginTop: 6, fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-danger)' }}>{normaliseInstagram(f.instagram).error}</div>}
        </div>
        <label className="tt-check">
          <input type="checkbox" checked={f.closeFriend} disabled={!normaliseInstagram(f.instagram).handle} onChange={(e) => setF({ ...f, closeFriend: e.target.checked })} />
          <span>Added to Instagram Close Friends</span>
        </label>
        <div>
          <label className="tt-label" htmlFor="dd-e-dob">Date of birth (optional)</label>
          <input id="dd-e-dob" className="tt-input" type="text" autoComplete="off" maxLength={DOB_NOTE_MAX} placeholder="type it any way you like" value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} />
        </div>
        <div>
          <label className="tt-label" htmlFor="dd-e-school">School (optional)</label>
          <input id="dd-e-school" className="tt-input" value={f.school} onChange={(e) => setF({ ...f, school: e.target.value })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
          <div>
            <label className="tt-label" htmlFor="dd-e-phase">Phase</label>
            <select id="dd-e-phase" className="tt-select" value={f.phase} onChange={(e) => onPhase(e.target.value)}>
              {/* A row can sit under a phase an admin has since removed; keep it selectable so saving does not move it. */}
              {!phases.some((p) => p.key === f.phase) && <option value={f.phase}>{f.phase}</option>}
              {phases.map((p) => <option key={p.key} value={p.key}>{p.label} · {rupees(p.amount)}</option>)}
            </select>
          </div>
          <div>
            <label className="tt-label" htmlFor="dd-e-amt">Amount (₹)</label>
            <input id="dd-e-amt" className="tt-input" type="number" inputMode="numeric" min={0} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          </div>
        </div>
        <label className="tt-check">
          <input type="checkbox" checked={f.paid} onChange={(e) => setF({ ...f, paid: e.target.checked })} />
          <span>Paid</span>
        </label>
        <div>
          <label className="tt-label" htmlFor="dd-e-notes">Notes</label>
          <textarea id="dd-e-notes" className="tt-textarea" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="anything to remember" />
        </div>
        <button type="submit" className="tt-btn" disabled={saving || !f.name.trim() || !f.phone.trim()}>{saving ? 'Saving…' : 'Save'}</button>
      </form>
    </Dialog>
  )
}

function TicketCard({ reg, phases, onClose, onCopyMessage }: {
  reg: DiscoReg
  phases: DiscoPhase[]
  onClose: () => void
  onCopyMessage: () => void
}) {
  const { success, error: toastError } = useToast()
  const p = phases.find((x) => x.key === reg.phase)
  const rows: Array<[string, string]> = [
    ['Name', reg.name],
    ['Phone', prettyPhone(reg.phone)],
    ...(reg.instagram ? [['Instagram', `@${reg.instagram}${reg.ig_close_friend ? ' (in close friends)' : ' (not yet in close friends)'}`] as [string, string]] : []),
    ...(reg.dob ? [['Date of birth', reg.dob] as [string, string]] : []),
    ...(reg.school ? [['School', reg.school] as [string, string]] : []),
    ['Phase', `${p?.label ?? reg.phase} · ${rupees(reg.amount ?? p?.amount ?? 0)}`],
  ]
  const copyId = () => {
    navigator.clipboard.writeText(reg.dd_id).then(
      () => success('Copied', reg.dd_id),
      () => toastError("Couldn't copy", 'Clipboard permission denied.'),
    )
  }
  return (
    <Dialog label={`Ticket ${reg.dd_id}`} onClose={onClose}>
      <div className="tt-card tt-card--raised" style={{ width: 'min(400px, 100%)', display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="tt-kicker">Disco Diwali</div>
          <button type="button" className="tt-btn tt-btn--quiet" style={{ marginLeft: 'auto', minHeight: 'var(--tt-ctl)' }} onClick={onClose}>Close</button>
        </div>
        <div className="tt-num" style={{ fontSize: 34, color: 'var(--tt-cyan)' }}>{reg.dd_id}</div>
        <dl style={{ margin: 0, display: 'grid', gap: 8 }}>
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <dt style={{ color: 'var(--tt-muted)', fontSize: 'var(--tt-fs-meta)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k}</dt>
              <dd style={{ margin: 0, fontWeight: 600, textAlign: 'right' }}>{v}</dd>
            </div>
          ))}
        </dl>
        <button type="button" className="tt-btn tt-btn--go" onClick={onCopyMessage}>Copy thank-you message</button>
        <button type="button" className="tt-btn tt-btn--quiet" onClick={copyId}>Copy ID only</button>
      </div>
    </Dialog>
  )
}

/** One editable phase. Local draft, commit on blur, re-sync when the saved value changes (so a rolled-back save is not left on screen). */
function PhaseRow({ phase, canRemove, onChange, onRemove }: {
  phase: DiscoPhase
  canRemove: boolean
  onChange: (patch: Partial<DiscoPhase>) => void
  onRemove: () => void
}) {
  const [label, setLabel] = useState(phase.label)
  const [amount, setAmount] = useState(String(phase.amount))
  const [opens, setOpens] = useState(phase.opensAt ?? '')
  // Adjusted during render (the prevBase technique NotesField uses) rather than in
  // an effect, so a rolled-back save lands in the same render instead of a tick later.
  const [base, setBase] = useState(phase)
  if (base.label !== phase.label || base.amount !== phase.amount || base.opensAt !== phase.opensAt) {
    setBase(phase)
    setLabel(phase.label)
    setAmount(String(phase.amount))
    setOpens(phase.opensAt ?? '')
  }

  return (
    <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'minmax(120px, 1.5fr) minmax(80px, 1fr) minmax(140px, 1.3fr) auto auto', alignItems: 'center' }}>
      <input
        className="tt-input" aria-label={`${phase.label} label`} value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => { const v = label.trim(); if (v && v !== phase.label) onChange({ label: v }); else setLabel(phase.label) }}
      />
      <input
        className="tt-input" type="number" inputMode="numeric" min={0} aria-label={`${phase.label} price`} value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onBlur={() => {
          const n = parseInt(amount, 10)
          if (Number.isFinite(n) && n >= 0 && n !== phase.amount) onChange({ amount: n })
          else setAmount(String(phase.amount))
        }}
      />
      <input
        className="tt-input" type="date" aria-label={`${phase.label} opens`} value={opens}
        onChange={(e) => setOpens(e.target.value)}
        onBlur={() => { const v = opens || null; if (v !== phase.opensAt) onChange({ opensAt: v }) }}
      />
      <label className="tt-check" title="Sold out or closed by hand">
        <input type="checkbox" checked={phase.closedManually} onChange={(e) => onChange({ closedManually: e.target.checked })} aria-label={`${phase.label} closed`} />
        <span style={{ fontSize: 'var(--tt-fs-meta)' }}>Closed</span>
      </label>
      <button
        type="button" className="tt-btn tt-btn--quiet" disabled={!canRemove}
        style={{ minHeight: 'var(--tt-ctl)', color: canRemove ? 'var(--tt-danger)' : undefined }}
        aria-label={`Remove ${phase.label}`} title={canRemove ? `Remove ${phase.label}` : 'At least one phase must remain'}
        onClick={onRemove}
      >
        Remove
      </button>
    </div>
  )
}

function DiscoDeskInner() {
  // /live/admin links straight into a mode: ?fast=1 opens fast entry, ?catchup=1 the catch-up sheet, ?checkin=1 check-in mode, ?filter=closefriends the checklist
  const deep = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const { success, error: toastError, info } = useToast()
  const confirm = useConfirm()
  const { member } = useAuth()
  const serverOffset = useServerOffset()

  const [regs, setRegs] = useState<DiscoReg[]>([])
  const [settings, setSettings] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [form, setForm] = useState({ name: '', phone: '', school: '', instagram: '', dob: '', closeFriend: false })
  // null means "follow whichever phase is live"; set once the admin picks one by hand.
  const [formPhase, setFormPhase] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const [checkinMode, setCheckinMode] = useState(deep?.get('checkin') === '1')
  const [fastOpen, setFastOpen] = useState(deep?.get('fast') === '1')
  const [catchUpOpen, setCatchUpOpen] = useState(deep?.get('catchup') === '1')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<DiscoSort>('recent')
  const [filter, setFilter] = useState<DiscoFilter>(deep?.get('filter') === 'closefriends' ? 'closefriends' : 'all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lastCheckIn, setLastCheckIn] = useState<DiscoReg | null>(null)
  const [editing, setEditing] = useState<DiscoReg | null>(null)
  const [ticketFor, setTicketFor] = useState<DiscoReg | null>(null)
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const adminName: string | null = (member as any)?.email ?? (member as any)?.full_name ?? (member as any)?.name ?? null

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [r, s] = await Promise.all([listDiscoRegs(), listDiscoSettings()])
      setRegs(r)
      setSettings(s)
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load Disco Diwali registrations.')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const phases = useMemo(() => parsePhases(settings[DD_SETTINGS_PHASES]), [settings])
  // The device clock is not trusted (see lib/hooks.ts), and "which phase is live" turns on the IST date.
  const now = new Date(Date.now() + serverOffset)
  const live = computeLivePhase(phases, now)
  const hasZeroPrice = phases.some((p) => p.amount === 0)

  const singleTpl = typeof settings[DD_SETTINGS_THANKYOU] === 'string' && (settings[DD_SETTINGS_THANKYOU] as string).trim()
    ? (settings[DD_SETTINGS_THANKYOU] as string) : DD_THANKYOU_DEFAULT
  const multiTpl = typeof settings[DD_SETTINGS_THANKYOU_MULTI] === 'string' && (settings[DD_SETTINGS_THANKYOU_MULTI] as string).trim()
    ? (settings[DD_SETTINGS_THANKYOU_MULTI] as string) : DD_THANKYOU_MULTI_DEFAULT

  const view = useMemo(() => viewRegs(regs, search, filter, sort), [regs, search, filter, sort])
  const counts = useMemo(() => phaseCounts(regs), [regs])
  const checkedIn = useMemo(() => regs.filter((r) => r.attended).length, [regs])
  const totalInr = useMemo(() => regs.reduce((s, r) => s + (r.amount ?? 0), 0), [regs])

  const effectivePhase = formPhase && phases.some((p) => p.key === formPhase)
    ? formPhase
    : (live?.key ?? phases[0].key)

  // ── Settings writes: optimistic, rolled back if the database refuses. ──────
  const persist = async (key: string, value: unknown, save: () => Promise<void>, failMsg: string): Promise<boolean> => {
    const prev = settings
    setSettings((s) => ({ ...s, [key]: value }))
    try {
      await save()
      return true
    } catch (e: any) {
      setSettings(prev)
      toastError(failMsg, e?.message ?? 'Try again.')
      return false
    }
  }

  const editPhases = (next: DiscoPhase[], failMsg: string) =>
    persist(DD_SETTINGS_PHASES, next, () => savePhases(next), failMsg)

  const patchPhase = (idx: number, patch: Partial<DiscoPhase>) =>
    void editPhases(phases.map((p, i) => (i === idx ? { ...p, ...patch } : p)), "Couldn't save phase")

  const removePhase = async (idx: number) => {
    if (phases.length <= 1) return
    const p = phases[idx]
    const ok = await confirm({
      title: `remove ${p.label}?`,
      body: 'Existing registrations under this phase keep their data and show its key, but the phase disappears from the add form.',
      confirmLabel: 'remove it',
      danger: true,
    })
    if (!ok) return
    if (await editPhases(phases.filter((_, i) => i !== idx), "Couldn't remove phase")) success('Phase removed', p.label)
  }

  const addPhase = async () => {
    const { key, n } = nextPhaseKey(phases)
    // Open from today, so a freshly added phase does not silently become the live one a day early or late.
    const added: DiscoPhase = { key, label: `Phase ${n}`, amount: 0, opensAt: istDateKey(now), closedManually: false }
    if (await editPhases([...phases, added], "Couldn't add phase")) success('Phase added', `${added.label}: set its price and date.`)
  }

  const resetPhases = async () => {
    const ok = await confirm({
      title: 'reset the phases?',
      body: 'Back to a single placeholder phase at ₹0. Existing registrations are not changed.',
      confirmLabel: 'reset them',
      danger: true,
    })
    if (!ok) return
    if (await editPhases(DD_PHASES_DEFAULT, 'Reset failed')) success('Phases reset')
  }

  const saveTemplate = async (key: string, value: string, label: string) => {
    if (await persist(key, value, () => saveDiscoSetting(key, value), "Couldn't save template")) success(`${label} saved`)
  }

  // ── Registration writes. ───────────────────────────────────────────────────
  const addReg = async (cashWalkIn: boolean) => {
    const name = form.name.trim()
    const phone = form.phone.trim()
    if (!name || !phone) { toastError('Missing fields', 'Name and phone are required.'); return }
    const ig = normaliseInstagram(form.instagram)
    if (ig.error) { toastError('Check the Instagram handle', ig.error); return }
    const p = phases.find((x) => x.key === effectivePhase)
    setAdding(true)
    try {
      const row = await addDiscoReg({
        name, phone, school: form.school.trim() || null, instagram: ig.handle, dob: cleanDobNote(form.dob), igCloseFriend: form.closeFriend && !!ig.handle, phase: effectivePhase,
        amount: p?.amount ?? null, cashWalkIn, createdBy: adminName,
      })
      setRegs((r) => [row, ...r])
      setForm({ name: '', phone: '', school: '', instagram: '', dob: '', closeFriend: false })
      if (cashWalkIn) {
        success('Checked in', `${row.name} · ${row.dd_id} · cash`)
      } else {
        // Select the new row so several tickets for one customer bundle into one message with no extra taps.
        setSelected((s) => new Set(s).add(row.id))
        success('Logged', `${row.name} · ${row.dd_id}. Select and copy when ready.`)
      }
    } catch (e: any) {
      toastError("Couldn't add registration", e?.message ?? 'Try again.')
    } finally {
      setAdding(false)
    }
  }

  /** Optimistic patch with rollback. An amount follows a phase change unless it was set explicitly. */
  const updateReg = async (id: string, patch: Partial<DiscoReg>): Promise<boolean> => {
    const prev = regs.find((r) => r.id === id)
    if (!prev) return false
    const body = { ...patch }
    if (body.phase && body.amount === undefined) {
      const p = phases.find((x) => x.key === body.phase)
      if (p) body.amount = p.amount
    }
    setRegs((list) => list.map((r) => (r.id === id ? { ...r, ...body } : r)))
    try {
      await updateDiscoReg(id, body)
      return true
    } catch (e: any) {
      setRegs((list) => list.map((r) => (r.id === id ? prev : r)))
      toastError("Couldn't save", e?.message ?? 'Try again.')
      return false
    }
  }

  const setAttended = async (r: DiscoReg, next: boolean) => {
    if (next && !r.paid) {
      const ok = await confirm({
        title: `${r.name} is marked unpaid. check them in anyway?`,
        body: 'The door decides. This only records that they came in.',
        confirmLabel: 'check them in',
      })
      if (!ok) return
    }
    setBusyId(r.id)
    const ok = await updateReg(r.id, { attended: next })
    setBusyId(null)
    if (!ok) return
    if (next) { setLastCheckIn({ ...r, attended: true }); success('Checked in', `${r.name} · ${r.dd_id}`) }
    else setLastCheckIn((cur) => (cur && cur.id === r.id ? null : cur))
  }

  const saveNote = async (r: DiscoReg, raw: string) => {
    const next = raw.trim() || null
    if ((r.notes ?? null) !== next) await updateReg(r.id, { notes: next })
    setNoteDraft((d) => { const n = { ...d }; delete n[r.id]; return n })
  }

  const removeReg = async (r: DiscoReg) => {
    const ok = await confirm({
      title: `delete ${r.dd_id} for good?`,
      body: `This removes ${r.name}'s ticket from the list and the counts. It cannot be undone. Use it for a mistake or a refund, not for someone who did not come.`,
      confirmLabel: 'delete it',
      danger: true,
    })
    if (!ok) return
    setBusyId(r.id)
    try {
      await deleteDiscoReg(r.id)
      setRegs((list) => list.filter((x) => x.id !== r.id))
      setSelected((s) => { if (!s.has(r.id)) return s; const n = new Set(s); n.delete(r.id); return n })
      setLastCheckIn((cur) => (cur && cur.id === r.id ? null : cur))
      success('Deleted', r.dd_id)
    } catch (e: any) {
      toastError('Delete failed', e?.message ?? 'Try again.')
    } finally {
      setBusyId(null)
    }
  }

  const copyMessage = async (list: DiscoReg[]) => {
    try {
      await navigator.clipboard.writeText(composeThankYou(list, phases, singleTpl, multiTpl))
      success('Copied', list.length === 1 ? '1 booking ID copied.' : `${list.length} booking IDs in one message.`)
    } catch {
      toastError("Couldn't copy", 'Clipboard permission denied. Paste it by hand.')
    }
  }

  const openWhatsApp = (r: DiscoReg) => {
    const text = composeThankYou([r], phases, singleTpl, multiTpl)
    window.open(`https://wa.me/${waNumber(r.phone)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
    info('Opened WhatsApp', 'Check the message before you send it.')
  }

  const exportCsv = () => {
    try {
      // BOM so Excel reads the file as UTF-8 and keeps the rupee sign and any non-Latin names.
      const blob = new Blob(['﻿' + buildCsv(view, phases)], { type: 'text/csv;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `disco-diwali-CONFIDENTIAL-${istDateKey(now)}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
      success('Export ready', `${view.length} registrations`)
    } catch (e: any) {
      toastError('Export failed', e?.message ?? 'Try again.')
    }
  }

  const selectedRegs = regs.filter((r) => selected.has(r.id))
  const allVisibleSelected = view.length > 0 && view.every((r) => selected.has(r.id))
  const toggleVisible = (on: boolean) =>
    setSelected((s) => { const n = new Set(s); view.forEach((r) => (on ? n.add(r.id) : n.delete(r.id))); return n })

  const chip = (on: boolean, accent: string) => ({
    cursor: 'pointer', minHeight: 'var(--tt-ctl)',
    border: on ? 'none' : '1px solid var(--tt-hairline)',
    ...(on ? {} : { color: accent }),
  })

  return (
    <div className="tt-wrap tt-page" style={{ maxWidth: 1400 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <div className="tt-kicker">AquaTerra.live admin</div>
          <h1 style={{ fontSize: 34, textTransform: 'uppercase', lineHeight: 1 }}>Disco Diwali</h1>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="tt-btn" onClick={() => setFastOpen(true)}>Fast entry</button>
          <button type="button" className="tt-btn tt-btn--quiet" onClick={() => setCatchUpOpen(true)} disabled={loading || !!loadError || regs.length === 0}>
            Catch up ({regs.filter((r) => !r.instagram || !r.dob).length})
          </button>
          <Link to={`${EVENT.base}/admin`} className="tt-btn tt-btn--quiet">TerraThon registrations</Link>
          <button
            type="button" className={`tt-btn ${checkinMode ? 'tt-btn--go' : 'tt-btn--quiet'}`} aria-pressed={checkinMode}
            onClick={() => { if (checkinMode) setLastCheckIn(null); setCheckinMode((v) => !v) }}
          >
            {checkinMode ? 'Check-in mode on' : 'Check-in mode'}
          </button>
          <button type="button" className="tt-btn tt-btn--quiet" onClick={exportCsv} disabled={view.length === 0}>Export CSV</button>
        </div>
      </header>

      {loadError ? (
        <div className="tt-card" role="alert" style={{ borderColor: 'var(--tt-danger)' }}>
          <h2 style={{ fontSize: 22, color: 'var(--tt-danger)' }}>Couldn't load Disco Diwali</h2>
          <p style={{ margin: '8px 0 16px', color: 'var(--tt-muted)', fontSize: 'var(--tt-fs-body)' }}>
            {loadError} If the tables do not exist yet, run <code>scripts/disco_diwali_registrations_2026_10_01.sql</code> in the community Supabase project.
          </p>
          <button type="button" className="tt-btn tt-btn--ghost" onClick={() => void load()}>Try again</button>
        </div>
      ) : loading ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <span className="tt-sr" role="status">Loading Disco Diwali</span>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            {[0, 1, 2].map((i) => <div key={i} className="tt-card" style={{ height: 72, opacity: 0.35 }} aria-hidden="true" />)}
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 16 }}>
            <Stat label="Total" value={String(regs.length)} />
            <Stat label="Attended" value={String(checkedIn)} accent={GREEN} />
            <Stat label="Total ₹" value={rupees(totalInr)} accent="var(--tt-cyan)" />
          </div>

          {hasZeroPrice && (
            <div className="tt-card" role="status" style={{ marginBottom: 16, borderColor: 'var(--tt-amber)' }}>
              <strong>A phase is priced at ₹0.</strong>{' '}
              <span style={{ color: 'var(--tt-muted)' }}>Open "Edit phases" and set the real price before logging tickets, or they are recorded at ₹0.</span>
            </div>
          )}

          {!checkinMode && (
            <>
              <details className="tt-card" style={{ padding: '4px 16px', marginBottom: 12 }}>
                <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong>Edit phases (prices and dates)</strong>
                  <span style={{ color: 'var(--tt-muted)', fontSize: 'var(--tt-fs-meta)' }}>
                    {live ? `live now: ${live.label} ${rupees(live.amount)}` : 'no phase live'}
                  </span>
                </summary>
                <div style={{ display: 'grid', gap: 8, padding: '8px 0 14px' }}>
                  <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'minmax(120px, 1.5fr) minmax(80px, 1fr) minmax(140px, 1.3fr) auto auto', fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    <span>Label</span><span>Price (₹)</span><span>Opens</span><span>Closed</span><span aria-hidden="true" />
                  </div>
                  {phases.map((p, idx) => (
                    <PhaseRow
                      key={p.key} phase={p} canRemove={phases.length > 1}
                      onChange={(patch) => patchPhase(idx, patch)} onRemove={() => void removePhase(idx)}
                    />
                  ))}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
                    <span style={{ marginRight: 'auto', color: 'var(--tt-muted)', fontSize: 'var(--tt-fs-meta)' }}>
                      Changes save when you leave a field. No date means open from the start.
                    </span>
                    <button type="button" className="tt-btn tt-btn--quiet" style={{ minHeight: 'var(--tt-ctl)' }} onClick={() => void addPhase()}>+ Add phase</button>
                    <button type="button" className="tt-btn tt-btn--quiet" style={{ minHeight: 'var(--tt-ctl)', color: 'var(--tt-danger)' }} onClick={() => void resetPhases()}>Reset</button>
                  </div>
                </div>
              </details>

              <details className="tt-card" style={{ padding: '4px 16px', marginBottom: 16 }}>
                <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>
                  <strong>Edit thank-you templates</strong>
                </summary>
                <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', padding: '8px 0 14px' }}>
                  {([
                    [DD_SETTINGS_THANKYOU, 'One ticket', singleTpl, DD_THANKYOU_DEFAULT, '{name} {id} {phase} {amount}', 'Template'],
                    [DD_SETTINGS_THANKYOU_MULTI, 'Two or more tickets, one message', multiTpl, DD_THANKYOU_MULTI_DEFAULT, '{names} {tickets} {total} {count}', 'Bundle template'],
                  ] as const).map(([key, title, value, fallback, tokens, saved]) => (
                    <div key={key} style={{ display: 'grid', gap: 6 }}>
                      <label className="tt-label" htmlFor={`dd-t-${key}`}>{title}</label>
                      <textarea
                        id={`dd-t-${key}`} className="tt-textarea" rows={9} spellCheck={false} value={value} placeholder={fallback}
                        onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value }))}
                        onBlur={(e) => void saveTemplate(key, e.target.value, saved)}
                      />
                      <div style={{ fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-muted)' }}>placeholders: <code>{tokens}</code></div>
                    </div>
                  ))}
                </div>
              </details>
            </>
          )}

          {/* Add form: one sweep per confirmation. */}
          <form
            className="tt-card" style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}
            onSubmit={(e) => { e.preventDefault(); void addReg(false) }}
          >
            <div style={{ flex: '2 1 180px' }}>
              <label className="tt-label" htmlFor="dd-name">Name</label>
              <input id="dd-name" className="tt-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="full name" />
            </div>
            <div style={{ flex: '1 1 150px' }}>
              <label className="tt-label" htmlFor="dd-phone">Phone</label>
              <input id="dd-phone" className="tt-input" type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 …" />
            </div>
            <div style={{ flex: '1 1 150px' }}>
              <label className="tt-label" htmlFor="dd-insta">Instagram (optional)</label>
              <input id="dd-insta" className="tt-input" value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="@handle" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-invalid={normaliseInstagram(form.instagram).error ? true : undefined} />
            </div>
            <div style={{ flex: '1 1 150px' }}>
              <label className="tt-label" htmlFor="dd-dob">Date of birth (optional)</label>
              <input id="dd-dob" className="tt-input" type="text" autoComplete="off" maxLength={DOB_NOTE_MAX} placeholder="type it any way you like" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
            </div>
            <label className="tt-check" style={{ flex: '0 0 auto', alignSelf: 'flex-end', minHeight: 44 }}>
              <input type="checkbox" checked={form.closeFriend} disabled={!normaliseInstagram(form.instagram).handle} onChange={(e) => setForm({ ...form, closeFriend: e.target.checked })} />
              <span>In close friends</span>
            </label>
            <div style={{ flex: '1 1 150px' }}>
              <label className="tt-label" htmlFor="dd-school">School (optional)</label>
              <input id="dd-school" className="tt-input" value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} placeholder="school / college" />
            </div>
            <div style={{ flex: '1 1 150px' }}>
              <label className="tt-label" htmlFor="dd-phase">Phase</label>
              <select id="dd-phase" className="tt-select" value={effectivePhase} onChange={(e) => setFormPhase(e.target.value)}>
                {phases.map((p) => <option key={p.key} value={p.key}>{p.label} · {rupees(p.amount)}</option>)}
              </select>
            </div>
            <button type="submit" className="tt-btn" disabled={adding || !form.name.trim() || !form.phone.trim()}>{adding ? 'Adding…' : '+ Add'}</button>
            <button
              type="button" className="tt-btn tt-btn--go" disabled={adding || !form.name.trim() || !form.phone.trim()}
              title="Paid cash and walking in now: logged as paid and checked in" onClick={() => void addReg(true)}
            >
              {adding ? 'Adding…' : 'Cash & check in'}
            </button>
          </form>

          {checkinMode && (
            <div className="tt-card" style={{ padding: 16, marginBottom: 16, display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span className="tt-num" style={{ fontSize: 'clamp(30px, 6vw, 44px)', lineHeight: 1, color: GREEN }}>{checkedIn}</span>
                <span style={{ color: 'var(--tt-muted)' }}>/ {regs.length} checked in</span>
                {regs.length > 0 && <span className="tt-num" style={{ marginLeft: 'auto', color: 'var(--tt-muted)' }}>{Math.round((checkedIn / regs.length) * 100)}%</span>}
              </div>
              {counts.size > 1 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[...counts.entries()].map(([key, c]) => (
                    <span key={key} className={`tt-chip ${c.total > 0 && c.checked === c.total ? 'tt-chip--go' : ''}`}>
                      {phases.find((p) => p.key === key)?.label ?? key} {c.checked}/{c.total}
                    </span>
                  ))}
                </div>
              )}
              {lastCheckIn && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--tt-volt)', borderRadius: 'var(--tt-r-in)', padding: '8px 12px' }}>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Checked in <strong>{lastCheckIn.name}</strong></span>
                  <button type="button" className="tt-btn tt-btn--quiet" style={{ marginLeft: 'auto', minHeight: 44 }} onClick={() => void setAttended(lastCheckIn, false)}>Undo</button>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <input
              className="tt-input" style={{ flex: '1 1 220px', minHeight: 44 }} aria-label="Search registrations"
              placeholder="Search name, phone, @insta, school, ID…" value={search} onChange={(e) => setSearch(e.target.value)}
            />
            <select className="tt-select" style={{ minHeight: 44, maxWidth: 220 }} aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as DiscoSort)}>
              <option value="recent">Most recent</option>
              <option value="name">A to Z</option>
              <option value="unchecked">Not checked in first</option>
              <option value="checked">Checked in first</option>
              <option value="unpaid">Unpaid first</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
            {([['all', 'All'], ['unchecked', 'Not in'], ['checked', 'In'], ['unpaid', 'Unpaid'], ['cash', 'Cash'], ['closefriends', `To add to close friends (${closeFriendsToAdd(regs).length})`]] as Array<[DiscoFilter, string]>).map(([k, label]) => (
              <button
                key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}
                className={`tt-chip ${filter === k ? 'tt-chip--go' : ''}`} style={chip(filter === k, 'inherit')}
              >
                {label}
              </button>
            ))}
            {!checkinMode && view.length > 0 && (
              <label className="tt-check" style={{ marginLeft: 8 }}>
                <input type="checkbox" checked={allVisibleSelected} onChange={(e) => toggleVisible(e.target.checked)} aria-label="Select all shown" />
                <span style={{ fontSize: 'var(--tt-fs-meta)' }}>Select all shown</span>
              </label>
            )}
            <span className="tt-num" style={{ marginLeft: 'auto', color: 'var(--tt-muted)', fontSize: 'var(--tt-fs-meta)' }}>{view.length} shown</span>
          </div>

          {!checkinMode && selectedRegs.length > 0 && (
            <div
              className="tt-card"
              style={{ position: 'sticky', top: 8, zIndex: 20, padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderColor: 'var(--tt-amber)' }}
            >
              <strong style={{ marginRight: 'auto' }}>
                {selectedRegs.length} selected · {rupees(selectedRegs.reduce((s, r) => s + (r.amount ?? 0), 0))}
              </strong>
              <button type="button" className="tt-btn tt-btn--quiet" style={{ minHeight: 44 }} onClick={() => setSelected(new Set())}>Clear</button>
              <button type="button" className="tt-btn tt-btn--go" style={{ minHeight: 44 }} onClick={() => void copyMessage(selectedRegs)}>
                Copy message for {selectedRegs.length}
              </button>
            </div>
          )}

          {view.length === 0 ? (
            <div className="tt-card">
              <h2 style={{ fontSize: 22 }}>{regs.length === 0 ? 'No registrations yet' : 'Nothing matches those filters'}</h2>
              <p style={{ margin: '8px 0 0', color: 'var(--tt-muted)', fontSize: 'var(--tt-fs-body)' }}>
                {regs.length === 0 ? 'Log the first one above.' : 'Clear the search or pick a different filter.'}
              </p>
            </div>
          ) : checkinMode ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {view.map((r) => {
                const p = phases.find((x) => x.key === r.phase)
                const cash = hasCashNote(r.notes)
                return (
                  <div
                    key={r.id} className="tt-card"
                    style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12, borderColor: r.attended || cash ? 'var(--tt-volt)' : undefined }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: 17 }}>{r.name}</strong>
                        <span style={{ color: 'var(--tt-cyan)', fontWeight: 700 }}>{r.dd_id}</span>
                        {cash && <span className="tt-chip tt-chip--go">Cash</span>}
                        {!r.paid && <span className="tt-chip tt-chip--hot">Unpaid</span>}
                      </div>
                      <div style={{ color: 'var(--tt-muted)', fontSize: 'var(--tt-fs-meta)', marginTop: 2 }}>
                        {p?.label ?? r.phase} · {rupees(r.amount ?? p?.amount ?? 0)} · {prettyPhone(r.phone)}
                      </div>
                    </div>
                    <button
                      type="button" className={`tt-btn ${r.attended ? 'tt-btn--quiet' : 'tt-btn--go'}`}
                      style={{ minHeight: 52, minWidth: 128 }} disabled={busyId === r.id}
                      onClick={() => void setAttended(r, !r.attended)}
                    >
                      {r.attended ? 'Checked in' : 'Check in'}
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {view.map((r) => {
                const p = phases.find((x) => x.key === r.phase)
                const cash = hasCashNote(r.notes)
                const isSel = selected.has(r.id)
                return (
                  <article
                    key={r.id} className="tt-card"
                    style={{ padding: 16, boxShadow: isSel ? '0 0 0 2px var(--tt-amber)' : undefined, opacity: busyId === r.id ? 0.6 : 1 }}
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <label className="tt-check" style={{ padding: 0 }}>
                        <input
                          type="checkbox" checked={isSel} aria-label={`Select ${r.dd_id}`}
                          onChange={(e) => setSelected((s) => { const n = new Set(s); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n })}
                        />
                      </label>
                      <button
                        type="button" className="tt-hit" title="Copy ID"
                        style={{ background: 'none', border: 'none', padding: 0, color: 'var(--tt-cyan)', fontFamily: 'var(--tt-display)', fontWeight: 700, fontSize: 19, cursor: 'pointer' }}
                        onClick={() => { void navigator.clipboard?.writeText(r.dd_id).catch(() => {}); success('Copied', r.dd_id) }}
                      >
                        {r.dd_id}
                      </button>
                      {cash && <span className="tt-chip tt-chip--go">Cash</span>}
                      {!r.paid && <span className="tt-chip tt-chip--hot">Unpaid</span>}
                      {r.attended && <span className="tt-chip tt-chip--sky">In</span>}
                      <span style={{ marginLeft: 'auto', fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-muted)' }} title={istDateTime(r.created_at)}>
                        {relativeTime(r.created_at, now)}
                      </span>
                    </div>

                    <div style={{ marginTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 600 }}>{r.name}</div>
                        <div style={{ fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-muted)' }}>
                          {prettyPhone(r.phone)}{r.instagram ? ` · @${r.instagram}` : ''}{r.school ? ` · ${r.school}` : ''}
                        </div>
                        <div style={{ fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-muted)' }}>
                          {p?.label ?? r.phase} · {rupees(r.amount ?? p?.amount ?? 0)}
                        </div>
                      </div>
                      <input
                        className="tt-input" style={{ flex: '1 1 200px', minHeight: 44 }} aria-label={`Notes for ${r.dd_id}`} placeholder="add note…"
                        value={noteDraft[r.id] ?? r.notes ?? ''}
                        onChange={(e) => setNoteDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                        onBlur={(e) => void saveNote(r, e.target.value)}
                      />
                    </div>

                    <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <button
                        type="button" className={`tt-btn ${r.attended ? 'tt-btn--go' : 'tt-btn--quiet'}`} style={{ minHeight: 44 }}
                        disabled={busyId === r.id} onClick={() => void setAttended(r, !r.attended)}
                      >
                        {r.attended ? 'In' : 'Mark in'}
                      </button>
                      {r.instagram && (
                        <>
                          <a className="tt-btn tt-btn--quiet" style={{ minHeight: 44 }} href={instagramUrl(r.instagram)} target="_blank" rel="noopener noreferrer" aria-label={`Open @${r.instagram} on Instagram`}>@{r.instagram}</a>
                          <button
                            type="button" className={`tt-btn ${r.ig_close_friend ? 'tt-btn--go' : 'tt-btn--quiet'}`} style={{ minHeight: 44 }}
                            aria-pressed={!!r.ig_close_friend} disabled={busyId === r.id}
                            onClick={() => void updateReg(r.id, { ig_close_friend: !r.ig_close_friend })}
                            title="Tick once you have added them to Close Friends"
                          >
                            {r.ig_close_friend ? 'In close friends ✓' : 'Add to close friends'}
                          </button>
                        </>
                      )}
                      <button type="button" className="tt-btn tt-btn--quiet" style={{ minHeight: 44 }} onClick={() => setTicketFor(r)}>Ticket</button>
                      <button type="button" className="tt-btn tt-btn--quiet" style={{ minHeight: 44 }} onClick={() => openWhatsApp(r)}>WhatsApp</button>
                      <button type="button" className="tt-btn tt-btn--quiet" style={{ minHeight: 44 }} onClick={() => setEditing(r)}>Edit</button>
                      <button
                        type="button" className="tt-btn tt-btn--quiet" disabled={busyId === r.id}
                        style={{ minHeight: 44, marginLeft: 'auto', color: 'var(--tt-danger)' }} onClick={() => void removeReg(r)}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </>
      )}

      {fastOpen && (
        <DiscoFastEntry
          phases={phases}
          defaultPhase={(live ?? phases[0]).key}
          regs={regs}
          adminName={adminName}
          onAdded={(row) => setRegs((r) => [row, ...r])}
          onRemoved={(id) => setRegs((r) => r.filter((x) => x.id !== id))}
          onCopy={copyMessage}
          onClose={() => setFastOpen(false)}
        />
      )}
      {catchUpOpen && !loading && !loadError && <DiscoCatchUp regs={regs} onSave={updateReg} onClose={() => setCatchUpOpen(false)} />}
      {editing && (
        <EditModal
          reg={editing} phases={phases} onClose={() => setEditing(null)}
          onSave={async (patch) => {
            const ok = await updateReg(editing.id, patch)
            if (ok) success('Updated', `${patch.name ?? editing.name} saved.`)
            return ok
          }}
        />
      )}
      {ticketFor && (
        <TicketCard
          reg={ticketFor} phases={phases} onClose={() => setTicketFor(null)}
          onCopyMessage={() => void copyMessage([ticketFor])}
        />
      )}
    </div>
  )
}

/**
 * The desk. Reachable at /live/admin/disco-diwali (inside the live admin frame) and at /terrathon/admin/disco-diwali. It wears
 * TerraThon's own look in both places; there is no separate theme.
 */
export function TerraThonDiscoDiwali() {
  return <DiscoDeskInner />
}
