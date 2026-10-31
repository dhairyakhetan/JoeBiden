import { useCallback, useEffect, useState } from 'react'
import './ProfileNudgeCard.css'
import { useToast } from './Toast'
import profileNudgeService, { type NudgeContext } from '../services/profileNudgeService'
import { isPlausiblePhone, maskPhone } from '../lib/profileNudge'

/*
  The one definition of AquaTerra's "whose number is this?" UX.

  Used in two places — the in-feed profile nudge (components/ProfileNudgeCard)
  and the settings screen (auth/SettingsPage) — so the safeguarding-critical
  part of it cannot drift between them:

    · "my number" and "a guardian's" are two halves of one segmented control,
      equal width, both visible, neither hidden behind a disclosure. A member
      who does not want to give their own mobile sees the alternative in the
      same glance as the default.
    · Whose number it is, is restated in the control, the field label, the
      placeholder and the helper line. They write to two different columns
      (members.phone / members.guardian_phone) and are never interchangeable.
    · Nothing is ever echoed back except a last-4 mask of the member's OWN
      number. A guardian's number is not shown at all, to anyone, here.

  PII: `members.phone` and `members.guardian_phone` are both UPDATE-only for
  the `authenticated` role — no SELECT grant, verified live 2026-09-07. The
  masks below come from `get_own_member()` (SECURITY DEFINER, own row only).
  Nothing in this file selects a phone column by name.
*/

export type PhoneOwner = 'self' | 'guardian'

/** The presentational form. The caller owns saving and error surfacing. */
export function PhoneOwnerForm({
  owner, setOwner, value, setValue, busy, error, guardianAvailable,
  onSave, onCancel, saveLabel = 'save number', idPrefix = 'phone',
}: {
  owner: PhoneOwner
  setOwner: (o: PhoneOwner) => void
  value: string
  setValue: (v: string) => void
  busy: boolean
  error: string | null
  /** Runtime guard. NOTE, verified live 2026-09-10: that migration IS applied -
   *  members.guardian_phone exists (UPDATE-only for `authenticated`, no SELECT,
   *  matching `phone`). This used to claim the migration was outstanding. */
  guardianAvailable: boolean
  onSave: () => void
  onCancel?: () => void
  saveLabel?: string
  idPrefix?: string
}) {
  const inputId = `${idPrefix}-input`
  const helpId = `${idPrefix}-help`
  return (
    <div className="pnudge-phone">
      <div className="pnudge-seg" role="radiogroup" aria-label="whose number is this?">
        <button
          type="button"
          role="radio"
          aria-checked={owner === 'self'}
          className={'pnudge-seg-btn ' + (owner === 'self' ? 'is-on' : '')}
          onClick={() => setOwner('self')}
        >
          my number
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={owner === 'guardian'}
          className={'pnudge-seg-btn ' + (owner === 'guardian' ? 'is-on' : '')}
          onClick={() => setOwner('guardian')}
        >
          a guardian&rsquo;s
        </button>
      </div>

      <label className="pnudge-label" htmlFor={inputId}>
        {owner === 'self' ? 'your WhatsApp number' : "your parent or guardian's WhatsApp number"}
      </label>
      <input
        id={inputId}
        className="pnudge-input"
        type="tel"
        inputMode="tel"
        autoComplete={owner === 'self' ? 'tel' : 'off'}
        placeholder={owner === 'self' ? 'your 10-digit number' : 'their 10-digit number'}
        value={value}
        onChange={e => setValue(e.target.value)}
        disabled={busy}
        aria-describedby={helpId}
      />
      <p className="pnudge-help" id={helpId}>
        {owner === 'self'
          ? 'saved as your own number. only Directors can see it, and it never appears on your profile.'
          : "saved as your guardian's number, kept separate from yours. only Directors can see it, and it never appears on your profile."}
      </p>
      {!guardianAvailable && owner === 'guardian' && (
        <p className="pnudge-err" role="alert">
          guardian numbers aren&rsquo;t switched on yet — tell a Director. your own number still works.
        </p>
      )}
      {error && <p className="pnudge-err" role="alert">{error}</p>}
      <div className="pnudge-phone-actions">
        <button type="button" className="pnudge-save" onClick={onSave} disabled={busy}>
          {busy ? 'saving…' : saveLabel}
        </button>
        {onCancel && (
          <button type="button" className="pnudge-cancel" onClick={onCancel} disabled={busy}>
            cancel
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * The settings-screen section: shows what is on file (masked, own number
 * only) and lets the member CHANGE their number or add/replace a guardian's.
 * Self-contained — loads its own context, throws nothing at its parent.
 */
export default function ContactNumberFields() {
  const toast = useToast()
  const [ctx, setCtx] = useState<NudgeContext | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [owner, setOwner] = useState<PhoneOwner>('self')
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setCtx(await profileNudgeService.getContext())
      setLoadFailed(false)
    } catch {
      setLoadFailed(true)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const onSave = async () => {
    if (!ctx) return
    const raw = value.trim()
    if (!isPlausiblePhone(raw)) {
      setError('that does not look like a phone number yet.')
      return
    }
    if (owner === 'guardian' && !ctx.hasGuardianColumn) {
      const msg = 'guardian numbers are not switched on yet. tell a Director — your own number still works.'
      setError(msg)
      toast.error("couldn't save a guardian's number yet.", msg)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await profileNudgeService.saveContactNumbers(
        ctx,
        owner === 'self' ? { ownPhone: raw } : { guardianPhone: raw },
      )
      setValue('')
      await load()
      toast.success(
        owner === 'self' ? 'your number is updated.' : "your guardian's number is saved.",
        'only Directors can see it. it never appears on your profile.',
      )
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'that number did not save.'
      setError(msg)
      toast.error("that number didn't save.", msg)
    } finally {
      setBusy(false)
    }
  }

  if (loadFailed) {
    return (
      <div className="card" style={{ padding: '14px 18px', background: 'var(--bg-2)' }}>
        <p className="pnudge-err" role="alert" style={{ margin: 0 }}>
          couldn&rsquo;t load your contact numbers just now.{' '}
          <button type="button" className="pnudge-later" onClick={() => void load()} style={{ minHeight: 'auto', padding: 0, textDecoration: 'underline' }}>
            try again
          </button>
        </p>
      </div>
    )
  }

  if (!ctx) {
    return (
      <div className="card" style={{ padding: '14px 18px', background: 'var(--bg-2)' }} aria-hidden="true">
        <span className="pnudge-sk pnudge-sk-sub" style={{ marginTop: 0 }} />
      </div>
    )
  }

  const ownPhone = ctx.facts.phone
  const hasGuardian = !!ctx.facts.guardianPhone

  return (
    <div className="col gap-3">
      {/* What is on file. The member's own number is confirmed back masked;
          a guardian's is reported as present/absent and NEVER rendered. */}
      <div className="card" style={{ padding: '14px 18px', background: 'var(--bg-2)' }}>
        <div className="mono xs upper muted" style={{ marginBottom: 6 }}>on file</div>
        <div style={{ fontSize: 14, color: 'var(--ink-2)' }}>
          your number:{' '}
          <span style={{ fontFamily: 'var(--mono, monospace)' }}>
            {ownPhone ? maskPhone(ownPhone) : 'none yet'}
          </span>
        </div>
        <div style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 4 }}>
          guardian&rsquo;s number:{' '}
          {!ctx.hasGuardianColumn ? 'not available yet' : hasGuardian ? 'saved' : 'none yet'}
        </div>
      </div>

      <PhoneOwnerForm
        owner={owner}
        setOwner={setOwner}
        value={value}
        setValue={setValue}
        busy={busy}
        error={error}
        guardianAvailable={ctx.hasGuardianColumn}
        onSave={onSave}
        idPrefix="settings-phone"
        saveLabel={
          owner === 'self'
            ? (ownPhone ? 'change my number' : 'save my number')
            : (hasGuardian ? "replace guardian's number" : "save guardian's number")
        }
      />
    </div>
  )
}
