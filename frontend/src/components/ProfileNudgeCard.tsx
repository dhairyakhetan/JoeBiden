import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import './ProfileNudgeCard.css'
import { useToast } from './Toast'
import { useConfirm } from './Confirm'
import SuccessCheck from './SuccessCheck'
import { PhoneOwnerForm, type PhoneOwner } from './ContactNumberFields'
import { fadeInUp, staggerContainer, tapScale } from '../lib/motion'
import profileService from '../services/profileService'
import profileNudgeService, { type NudgeContext } from '../services/profileNudgeService'
import {
  computeCompleteness,
  dismissNudge,
  nudgeVisibility,
  retireNudge,
  isPlausiblePhone,
  maskPhone,
  type NudgeItem,
  type NudgeProgress,
} from '../lib/profileNudge'

/*
  The in-feed "complete your profile" nudge.

  PLACEMENT: an in-stream card, first in `.home-feed-list`, styled as a feed
  card so it belongs to the column rather than floating over it (the mascot
  companion already owns the floating layer). Self-contained — it fetches its
  own context and needs nothing from the feed except permission to render.

  DESIGN: rounded minimalism, per the Sept-2026 handoff. Shell borrows
  `.feed-card` (hairline edge, --r-outer 32, --pad-card 10, --lift-2) so it is
  the same object as its neighbours; the checklist sits in a --bg-2 well at
  --r-inner 22 (32 - 10), and each row is a white chip at --r-tight 14
  (22 - 8). Depth is that cream -> white -> cream -> white stack, not shadow.

  MEASURED CONTRAST (WCAG 2.1, computed not assumed):
    --ink #0A0A0A        on --card  #FFFFFF   20.35:1   headline, row labels
    --ink-2 #2A2A28      on --card  #FFFFFF   14.35:1   sub-line
    --ink-3 #5A5A55      on --bg-2  #EDE6D0    5.56:1   "why" lines in the well
    --ink-3 #5A5A55      on --card  #FFFFFF    6.94:1   "why" lines on a chip
    --welfare-ink        on --bg-2  #EDE6D0    4.96:1   the "n of 5" counter
    --welfare-ink        on --card  #FFFFFF    6.18:1   done-row label
    --danger #C4231A     on --card  #FFFFFF    5.83:1   inline error text
    --danger #C4231A     on --bg-2  #EDE6D0    4.67:1   inline error in the well
    --ink #0A0A0A        on --welfare #1B8A5A   4.56:1   tick glyph on its dot
    --welfare fill       on --bg-2 track        3.48:1   progress bar (>=3:1 UI)
  No accent is ever used as `color` on cream or white; the only saturated
  fills carry full-opacity ink on top.
*/

export interface ProfileNudgeCardProps {
  /**
   * Render at all. HomePage passes its own `isActive` here so the card never
   * mounts for a logged-out visitor or a pending/rejected account.
   */
  enabled?: boolean
  /** Extra class on the card shell, if the feed ever needs to position it. */
  className?: string
  /** Fired once the card leaves for good, so the feed can re-measure. */
  onDismissed?: () => void
}

type Phase = 'loading' | 'ready' | 'celebrating' | 'gone'

const AVATAR_MAX_BYTES = 5 * 1024 * 1024

function TickIcon() {
  return (
    <svg viewBox="0 0 20 20" width="12" height="12" aria-hidden="true" focusable="false">
      <path
        d="M4 10.5l4 4 8-9"
        fill="none"
        stroke="#0A0A0A"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function ProfileNudgeCard({ enabled = true, className, onDismissed }: ProfileNudgeCardProps) {
  const toast = useToast()
  const confirm = useConfirm()
  const reduced = useReducedMotion()

  const [phase, setPhase] = useState<Phase>('loading')
  const [ctx, setCtx] = useState<NudgeContext | null>(null)
  const [memberUuid, setMemberUuid] = useState('')
  const [progress, setProgress] = useState<NudgeProgress | null>(null)

  // Per-row busy + error, so one failing row never blanks the card.
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [rowError, setRowError] = useState<{ key: string; message: string } | null>(null)

  // The phone sub-form.
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [phoneOwner, setPhoneOwner] = useState<PhoneOwner>('self')
  const [phoneValue, setPhoneValue] = useState('')
  const [savedMask, setSavedMask] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement | null>(null)

  // ── Load ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const next = await profileNudgeService.getContext()
      const uuid = (await profileService.getCurrentMember()).uuid as string
      setMemberUuid(uuid)
      setCtx(next)
      const p = computeCompleteness(next.facts)
      setProgress(p)
      // Already finished, or snoozed, or retired -> never render.
      if (p.isComplete || nudgeVisibility(next.state, Date.now()) !== 'show') {
        setPhase('gone')
        return
      }
      setPhase('ready')
    } catch {
      // A decorative prompt must never take the feed down or shout at a
      // member who did not ask for it. If we cannot tell what is missing,
      // we do not guess — the card simply does not appear. (Mutation
      // failures, which the member DID ask for, are surfaced loudly below.)
      setPhase('gone')
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void load()
  }, [enabled, load])

  const refresh = useCallback(async () => {
    const next = await profileNudgeService.getContext()
    setCtx(next)
    const p = computeCompleteness(next.facts)
    setProgress(p)
    return p
  }, [])

  /** Shared tail for every successful edit: celebrate + retire at 5/5. */
  const afterEdit = useCallback(
    async (p: NudgeProgress, uuid: string, context: NudgeContext) => {
      if (!p.isComplete) return
      try {
        await profileNudgeService.saveState(context, uuid, retireNudge())
      } catch {
        // The profile change itself already succeeded and has been toasted.
        // Failing to record "stop asking" is not worth a second error at the
        // member; the card retires locally for this session either way.
      }
      setPhase('celebrating')
      window.setTimeout(() => {
        setPhase('gone')
        onDismissed?.()
      }, reduced ? 1200 : 2400)
    },
    [onDismissed, reduced],
  )

  // ── Avatar ──────────────────────────────────────────────────────────────
  const onPickAvatar = () => {
    setRowError(null)
    fileRef.current?.click()
  }

  const onAvatarChosen = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Reset immediately so re-picking the same file fires change again.
    e.target.value = ''
    if (!file || !ctx) return
    if (!file.type.startsWith('image/')) {
      setRowError({ key: 'avatar', message: 'that file is not an image.' })
      toast.error("that's not an image.", 'pick a jpg, png or heic from your photos.')
      return
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setRowError({ key: 'avatar', message: 'that photo is over 5 MB.' })
      toast.error('that photo is too big.', 'anything under 5 MB works.')
      return
    }
    setBusyKey('avatar')
    setRowError(null)
    try {
      // Reuse the ONE avatar upload path the profile editor already uses —
      // it uploads to the `avatars` bucket, persists members.avatar_url,
      // rolls the blob back if the write fails and cleans up the old file.
      await profileService.uploadAvatar(file)
      const p = await refresh()
      toast.success('photo saved.', 'it shows on your posts and comments now.')
      await afterEdit(p, memberUuid, ctx)
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || 'the upload did not go through.'
      setRowError({ key: 'avatar', message })
      toast.error("that photo didn't save.", message)
    } finally {
      setBusyKey(null)
    }
  }

  // ── Phone ───────────────────────────────────────────────────────────────
  const onSavePhone = async () => {
    if (!ctx) return
    const raw = phoneValue.trim()
    if (!isPlausiblePhone(raw)) {
      setRowError({ key: 'phone', message: 'that does not look like a phone number yet.' })
      return
    }
    if (phoneOwner === 'guardian' && !ctx.hasGuardianColumn) {
      const message = 'guardian numbers are not switched on yet. tell a Director — or use your own number for now.'
      setRowError({ key: 'phone', message })
      toast.error("couldn't save a guardian's number yet.", message)
      return
    }
    setBusyKey('phone')
    setRowError(null)
    try {
      await profileNudgeService.saveContactNumbers(
        ctx,
        phoneOwner === 'self' ? { ownPhone: raw } : { guardianPhone: raw },
      )
      // The member's own number is confirmed back to them, masked. A
      // guardian's number is NEVER echoed — it is not the viewer's to see.
      setSavedMask(phoneOwner === 'self' ? maskPhone(raw) : null)
      setPhoneValue('')
      setPhoneOpen(false)
      const p = await refresh()
      toast.success(
        phoneOwner === 'self' ? 'your number is saved.' : "your guardian's number is saved.",
        'only Directors can see it. it is never shown on your profile.',
      )
      await afterEdit(p, memberUuid, ctx)
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || 'the number did not save.'
      setRowError({ key: 'phone', message })
      toast.error("that number didn't save.", message)
    } finally {
      setBusyKey(null)
    }
  }

  // ── Dismiss ─────────────────────────────────────────────────────────────
  const onDismiss = async () => {
    if (!ctx) return
    const isLastAsk = ctx.state.dismissCount >= 1
    if (isLastAsk) {
      const ok = await confirm({
        title: 'hide this for good?',
        body: "we won't ask again. you can still finish your profile any time from the profile editor.",
        confirmLabel: 'hide it for good',
        cancelLabel: 'keep it',
      })
      if (!ok) return
    }
    const next = dismissNudge(ctx.state, Date.now())
    setBusyKey('dismiss')
    try {
      await profileNudgeService.saveState(ctx, memberUuid, next)
      setPhase('gone')
      onDismissed?.()
      toast.info(
        isLastAsk ? "that's the last of it." : 'hidden for two weeks.',
        isLastAsk
          ? 'finish your profile any time from settings.'
          : "we'll ask once more, then leave it alone.",
      )
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || 'that did not save.'
      setRowError({ key: 'dismiss', message })
      toast.error("couldn't hide that.", message)
    } finally {
      setBusyKey(null)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  if (!enabled || phase === 'gone') return null

  if (phase === 'loading') {
    // Same shell, same height class as the real card, so nothing jumps.
    return (
      <div className={'feed-card pnudge pnudge-skeleton ' + (className ?? '')} aria-hidden="true">
        <div className="pnudge-head">
          <span className="pnudge-sk pnudge-sk-title" />
          <span className="pnudge-sk pnudge-sk-sub" />
        </div>
        <div className="pnudge-well">
          {[0, 1, 2].map(i => (
            <span key={i} className="pnudge-sk pnudge-sk-row" />
          ))}
        </div>
      </div>
    )
  }

  if (phase === 'celebrating') {
    return (
      <div className={'feed-card pnudge pnudge-done ' + (className ?? '')} role="status">
        <SuccessCheck size={52} />
        <div className="pnudge-done-title">that&rsquo;s your profile, finished.</div>
        <p className="pnudge-done-sub">
          nice one. we won&rsquo;t ask again — everything else lives in the profile editor.
        </p>
      </div>
    )
  }

  if (!progress || !ctx) return null

  const { items, doneCount, total, percent, isOneLeft } = progress
  const headline =
    doneCount === 0
      ? 'let’s set you up.'
      : isOneLeft
        ? 'one thing left.'
        : 'you’re getting there.'
  const sub =
    doneCount === 0
      ? 'five small things. the first one takes a tap.'
      : isOneLeft
        ? 'finish this and the card is gone for good.'
        : 'each one takes seconds.'

  // Reduced motion: the same DOM, with the stagger/slide simply not declared.
  // No second code path to drift out of sync with the animated one.
  return (
    <motion.div
      className={'feed-card pnudge ' + (className ?? '')}
      aria-labelledby="pnudge-title"
      variants={reduced ? undefined : staggerContainer}
      initial={reduced ? undefined : 'hidden'}
      animate={reduced ? undefined : 'visible'}
    >
      <div className="pnudge-head">
        <div className="pnudge-head-text">
          <h2 className="pnudge-title" id="pnudge-title">{headline}</h2>
          <p className="pnudge-sub">{sub}</p>
        </div>
        <button
          type="button"
          className="pnudge-x"
          onClick={onDismiss}
          disabled={busyKey === 'dismiss'}
          aria-label={ctx.state.dismissCount >= 1 ? 'hide this for good' : 'hide this for two weeks'}
          title={ctx.state.dismissCount >= 1 ? 'hide this for good' : 'hide this for two weeks'}
        >
          {busyKey === 'dismiss' ? '…' : '✕'}
        </button>
      </div>

      {/* Progress. The number is the honest headline, not the percentage: at
          1/5 "20%" reads as failure while "1 of 5" reads as started. */}
      <div className="pnudge-meter">
        <div
          className="pnudge-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={doneCount}
          aria-valuetext={`${doneCount} of ${total} done`}
        >
          <span
            className="pnudge-fill"
            style={{
              width: `${Math.max(percent, doneCount > 0 ? 8 : 0)}%`,
              transition: reduced ? 'none' : 'width 420ms cubic-bezier(0.2,0,0,1)',
            }}
          />
        </div>
        <span className="pnudge-count">{doneCount} of {total}</span>
      </div>

      <div className="pnudge-well">
        {items.map((item, i) => (
          <Row
            key={item.key}
            item={item}
            index={i}
            reduced={!!reduced}
            busy={busyKey === item.key}
            error={rowError?.key === item.key ? rowError.message : null}
            phoneOpen={phoneOpen && item.key === 'phone'}
            onAvatar={onPickAvatar}
            onTogglePhone={() => {
              setRowError(null)
              setPhoneOpen(v => !v)
            }}
          >
            {item.key === 'phone' && phoneOpen && !item.done && (
              <PhoneOwnerForm
                owner={phoneOwner}
                setOwner={setPhoneOwner}
                value={phoneValue}
                setValue={setPhoneValue}
                busy={busyKey === 'phone'}
                error={rowError?.key === 'phone' ? rowError.message : null}
                guardianAvailable={ctx.hasGuardianColumn}
                onSave={onSavePhone}
                onCancel={() => { setPhoneOpen(false); setRowError(null) }}
                idPrefix="pnudge-phone"
              />
            )}
            {item.key === 'phone' && item.done && savedMask && (
              <p className="pnudge-mask">saved: {savedMask}</p>
            )}
          </Row>
        ))}
      </div>

      <div className="pnudge-foot">
        <Link to="/profile/edit" className="pnudge-foot-link">open the full editor →</Link>
        <button
          type="button"
          className="pnudge-later"
          onClick={onDismiss}
          disabled={busyKey === 'dismiss'}
        >
          {ctx.state.dismissCount >= 1 ? "don't ask again" : 'not now'}
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="pnudge-file"
        onChange={onAvatarChosen}
        tabIndex={-1}
        aria-hidden="true"
      />
    </motion.div>
  )
}

// ── Row ──────────────────────────────────────────────────────────────────
function Row({
  item, index, reduced, busy, error, phoneOpen, onAvatar, onTogglePhone, children,
}: {
  item: NudgeItem
  index: number
  reduced: boolean
  busy: boolean
  error: string | null
  phoneOpen: boolean
  onAvatar: () => void
  onTogglePhone: () => void
  children?: ReactNode
}) {

  const label = (
    <>
      <span className="pnudge-row-label">{item.label}</span>
      {!item.done && <span className="pnudge-row-why">{item.why}</span>}
    </>
  )

  const mark = item.done ? (
    <span className="pnudge-mark pnudge-mark-done" aria-hidden="true"><TickIcon /></span>
  ) : (
    <span className="pnudge-mark" aria-hidden="true">{index + 1}</span>
  )

  const inner =
    item.done ? (
      <div className="pnudge-row pnudge-row-done">
        {mark}
        <span className="pnudge-row-text">{label}</span>
        <span className="pnudge-row-tag">done</span>
      </div>
    ) : item.action === 'link' ? (
      <Link to={item.href!} className="pnudge-row pnudge-row-tap">
        {mark}
        <span className="pnudge-row-text">{label}</span>
        <span className="pnudge-row-go" aria-hidden="true">→</span>
      </Link>
    ) : (
      <button
        type="button"
        className="pnudge-row pnudge-row-tap"
        onClick={item.action === 'avatar' ? onAvatar : onTogglePhone}
        disabled={busy}
        aria-expanded={item.action === 'phone' ? phoneOpen : undefined}
      >
        {mark}
        <span className="pnudge-row-text">{label}</span>
        <span className="pnudge-row-go" aria-hidden="true">
          {busy ? '…' : item.action === 'phone' ? (phoneOpen ? '▴' : '▾') : '→'}
        </span>
      </button>
    )

  const body = (
    <div className="pnudge-row-wrap">
      {reduced || item.done ? inner : <motion.div whileTap={tapScale}>{inner}</motion.div>}
      {error && <p className="pnudge-err" role="alert">{error}</p>}
      {children}
    </div>
  )

  return <motion.div variants={reduced ? undefined : fadeInUp}>{body}</motion.div>
}

export { ProfileNudgeCard }
