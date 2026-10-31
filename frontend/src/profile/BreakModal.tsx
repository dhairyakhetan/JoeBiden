import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import { useToast } from '../components/Toast'
import { springPop, tapScale } from '../lib/motion'
import { useIsMobile } from '../hooks/useMobile'
import breakService, { BREAK_REASONS, BreakReason } from '../services/breakService'
import useDialog from '../hooks/useDialog'
import '../styles/routes/profile.css'

interface BreakModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

const todayStr = () => new Date().toISOString().slice(0, 10)

/**
 * The one reassurance sentence a member reads when they set a break, and again
 * on the break banner on their own profile. Exported so the two surfaces cannot
 * drift: it used to be typed only here and the banner said nothing at all.
 *
 * REWRITTEN 2026-09-04. It read, verbatim:
 *   "your leads will see this. nothing is removed, and you keep your points."
 * The changelog freezes that string, and this is the single sanctioned
 * exception: decision 12 in REDESIGN_FEATURE_REQUESTS.md retires the welfare
 * points system, so the final clause promised a thing that no longer exists.
 * The sentence's job is unchanged — tell the member a break costs them nothing
 * — so the clause was replaced, not dropped, and the first half is byte-identical.
 */
export const BREAK_REASSURANCE =
  'your leads will see this. nothing is removed, and your place on the team is kept.'

/**
 * "Set a break" — member-initiated only, reachable from ProfilePage (own
 * profile). Section 06: a bottom sheet with a 44x5 handle at <= 1024 and a
 * centred 480px panel at >= 1025; --bd-hero keyline, --r-lg radius,
 * --shadow-cta on the centred panel and none on the sheet (a sheet flush to
 * the bottom edge has nothing to cast onto). Writes members.break_* AND a
 * member_breaks history row together (see breakService.setBreak).
 */
export default function BreakModal({ isOpen, onClose, onSaved }: BreakModalProps) {
  const toast = useToast()
  // Section 06 step 8: bottom sheet at <= 1024 (the redesign's tablet ceiling),
  // centred panel at >= 1025. The hook's 640 default was the old phone-only
  // breakpoint and left tablets with a small centred dialog.
  const isSheet = useIsMobile(1024)
  const [start, setStart] = useState(todayStr())
  const [end, setEnd] = useState('')
  const [reason, setReason] = useState<BreakReason>('boards')
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  const endMissing = !end
  const showBlocked = touched && endMissing

  const handleClose = () => { if (!saving) onClose() }

  /* Section 06 step 9: duration presets. Each writes the SAME two values the
     date inputs write (start = today, end = today + n days), so there is one
     code path into breakService.setBreak and nothing new to persist.
     Deviation from the spec's chip list, recorded in CHANGELOG_SEC06.md:
     the spec names "board exams" and "until I say". "board exams" is dropped
     because the reason row below already has a `boards` chip reading from
     BREAK_REASONS, and two controls setting the same thing is the duplication
     the guardrails ask us to consolidate. "until I say" is dropped because the
     end date is required by the form, by breakService and by the banner that
     renders "back on <date>"; a preset by that name would have to invent a
     return date, and this form's own error copy is "pick a date so your team
     knows when to expect you." The three that remain state their own span. */
  const PRESETS: { label: string; days: number }[] = [
    { label: 'one week', days: 7 },
    { label: 'two weeks', days: 14 },
    { label: 'a month', days: 30 },
  ]
  const applyPreset = (days: number) => {
    const from = new Date()
    const to = new Date(from.getTime() + days * 86400000)
    setStart(from.toISOString().slice(0, 10))
    setEnd(to.toISOString().slice(0, 10))
    setTouched(true)
  }
  const activePreset = (() => {
    if (!end || start !== todayStr()) return null
    const diff = Math.round((new Date(end + 'T00:00:00').getTime() - new Date(start + 'T00:00:00').getTime()) / 86400000)
    return PRESETS.find(p => p.days === diff)?.label ?? null
  })()

  // `aria-modal="true"` below tells assistive tech the page behind is inert.
  // The shared hook is what makes that true: Escape, a Tab trap, focus into the
  // panel on open and back to the trigger on close. Escape is suppressed while
  // saving, so a mid-submit keypress can't discard a write in flight.
  const panelRef = useDialog(isOpen, handleClose, { closeOnEscape: !saving })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (endMissing || saving) return
    setSaving(true)
    try {
      await breakService.setBreak({ start, end, reason, note: note.trim() || undefined })
      toast.success('break set.', `back on ${new Date(end + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`)
      onSaved()
      onClose()
    } catch (err: any) {
      toast.error("that didn't save.", err?.message)
    } finally {
      setSaving(false)
    }
  }

  const labelSt: React.CSSProperties = {
    fontFamily: 'var(--display)', fontWeight: 700, fontSize: 10,
    letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-3)',
    display: 'block', marginBottom: 8,
  }

  return createPortal(
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="aq-modal-overlay"
            onClick={handleClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 10000,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: isSheet ? 'flex-end' : 'center',
              justifyContent: 'center',
              padding: isSheet ? 0 : 20,
            }}
          >
            <motion.div
              ref={panelRef}
              className="aq-break-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="break-modal-title"
              tabIndex={-1}
              initial={isSheet ? { opacity: 0, y: '40%' } : { opacity: 0, scale: 0.96, y: 10 }}
              animate={isSheet ? { opacity: 1, y: 0 } : { opacity: 1, scale: 1, y: 0 }}
              exit={isSheet ? { opacity: 0, y: 24 } : { opacity: 0, scale: 0.98, y: 6 }}
              transition={springPop}
              onClick={e => e.stopPropagation()}
              style={{
                maxWidth: isSheet ? '100%' : 480, width: '100%', outline: 'none',
                background: 'var(--card)',
                border: 'none',
                borderRadius: isSheet ? 'var(--r-outer) var(--r-outer) 0 0' : 'var(--r-outer)',
                padding: 'var(--pad-card)',
                paddingBottom: isSheet ? 'max(var(--pad-card), env(safe-area-inset-bottom))' : 'var(--pad-card)',
                maxHeight: isSheet ? '92dvh' : '90dvh', overflowY: 'auto',
                boxShadow: isSheet ? 'none' : 'var(--lift-4)',
              }}
            >
              {/* 44x5 grab handle, sheet only. Decorative: the sheet is closed
                  by the ✕, by Escape and by the overlay, all already wired. */}
              {isSheet && (
                <div aria-hidden="true" style={{ width: 44, height: 5, borderRadius: 999, background: 'var(--ink)', opacity: 0.28, margin: '0 auto 16px' }} />
              )}
              {/* 04.9's "padding: var(--pad-card), with var(--r-inner)
                  sections inside" is written for card-shaped content; this
                  panel is a plain form with no natural sections to well, so
                  the concentric principle is applied as one inner wrap
                  (comfortable form padding) inside the 10px outer reveal,
                  rather than forcing every field group into its own tinted
                  well - reported as a judgment call for a form-shaped modal. */}
              <div style={{ padding: '8px 10px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 12 }}>
                <div>
                  <h3 id="break-modal-title" className="h-display" style={{ fontSize: 26, margin: 0 }}>
                    set a break<span style={{ color: 'var(--welfare-ink)' }}>.</span>
                  </h3>
                  <p style={{ fontFamily: 'var(--eina)', fontSize: 13, lineHeight: 1.5, color: 'var(--ink-2)', margin: '8px 0 0' }}>
                    {BREAK_REASSURANCE}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={saving}
                  className="pf-modal-close"
                  style={{ flexShrink: 0 }}
                  aria-label="Close"
                  title="Close"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <span style={labelSt}>how long</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {PRESETS.map(pr => (
                      <motion.button
                        key={pr.label}
                        type="button"
                        whileTap={tapScale}
                        onClick={() => applyPreset(pr.days)}
                        aria-pressed={activePreset === pr.label}
                        className={'chip' + (activePreset === pr.label ? ' chip-active' : '')}
                      >
                        {pr.label}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label htmlFor="brk-start" style={labelSt}>from</label>
                    <input id="brk-start" type="date" className="input" style={{ width: '100%' }}
                      value={start} onChange={e => setStart(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="brk-end" style={labelSt}>back on <span style={{ color: 'var(--danger)' }}>*</span></label>
                    {/* The error below was rendered but never associated: the field
                        announced itself as invalid and gave no reason, because the
                        <p> carried no id and nothing pointed at it. Same wiring
                        ContactPage and CollaborationsPage already use - described-by
                        only while the error is on screen, so the field is never
                        described by a node that isn't in the document. */}
                    <input id="brk-end" type="date" className="input" style={{ width: '100%' }}
                      value={end} min={start} required
                      onChange={e => setEnd(e.target.value)}
                      onBlur={() => setTouched(true)}
                      aria-invalid={showBlocked}
                      aria-describedby={showBlocked ? 'brk-end-error' : undefined}
                    />
                  </div>
                </div>
                {showBlocked && (
                  <p id="brk-end-error" role="alert" style={{ margin: '-8px 0 0', fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--danger)' }}>
                    pick a date so your team knows when to expect you.
                  </p>
                )}

                <div>
                  <span style={labelSt}>reason</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {BREAK_REASONS.map(r => (
                      <motion.button
                        key={r.value}
                        type="button"
                        whileTap={tapScale}
                        onClick={() => setReason(r.value)}
                        className={'chip' + (reason === r.value ? ' chip-active' : '')}
                      >
                        {r.label}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="brk-note" style={labelSt}>note to your team lead (optional)</label>
                  <textarea id="brk-note" className="textarea" style={{ width: '100%', minHeight: 70, resize: 'vertical' }}
                    rows={2} maxLength={280} value={note} onChange={e => setNote(e.target.value)}
                    placeholder="anything they should know" />
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                  <button type="button" className="btn" onClick={handleClose} disabled={saving}>cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving} aria-busy={saving}>
                    {saving ? 'saving...' : 'set break'}
                  </button>
                </div>
              </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>,
    document.body,
  )
}
