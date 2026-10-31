import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useAuth } from '../auth/AuthContext'
import { ConfettiBurst } from './ConfettiBurst'
import { SuccessCheck } from './SuccessCheck'
import { Mascot } from './Mascot'
import useDialog from '../hooks/useDialog'

// One-shot celebration shown the moment a member's account flips from
// pending_approval -> active. PendingApprovalPage sets FLAG_KEY in
// sessionStorage right before it redirects to "/" on approval; this modal
// (mounted once on the active-member home route) reads and clears that
// flag on first mount, so it fires exactly once per approval, not on
// every subsequent visit to the homepage.
import { APPROVED_WELCOME_FLAG_KEY as FLAG_KEY } from '../lib/firstRunFlags'

/* REDESIGN 2026-09-09: was a hard-2px-ink-border, 6px-offset-shadow
   neubrutalist card - the pre-rounded-minimalism visual language most of the
   app has already moved off. Approved first as a design-canvas mockup: an
   envelope opening into a letter, using the real mascot cast (no new art)
   and the same warm paper-letter treatment the footer's closing note uses,
   so the two "AquaTerra writes you a letter" moments in the app read as one
   system. Every real behavior (the one-shot flag, the confetti burst, the
   member's real first name, the copy) is unchanged. */
export default function ApprovedWelcomeModal({ onDismiss }: { onDismiss?: () => void } = {}) {
  const { member } = useAuth()
  const reducedMotion = useReducedMotion()
  // Read the one-shot flag at init (read-only - idempotent under StrictMode's
  // double-invoke). The flag is CONSUMED (removed) in the effect below, kept
  // separate from the read so the double-invoke can't clear it before we see it.
  const readFlag = () => { try { return sessionStorage.getItem(FLAG_KEY) === '1' } catch { return false } }
  const [open, setOpen] = useState(readFlag)
  const [confetti, setConfetti] = useState(readFlag)

  useEffect(() => {
    if (!open) return
    try { sessionStorage.removeItem(FLAG_KEY) } catch { /* ignore */ }
  }, [open])

  const close = () => { setOpen(false); onDismiss?.() }

  const panelRef = useDialog(open, close)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="presentation"
          onClick={close}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          /* Scrim routed onto the shared tokens (tokens.css, added 2026-09-10).
             This one owns the screen - it is a one-shot celebration - so it
             takes the strong value rather than the default. */
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--scrim-strong)', backdropFilter: 'var(--scrim-blur)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          {confetti && (
            <ConfettiBurst x={window.innerWidth / 2} y={window.innerHeight / 2 - 80} onDone={() => setConfetti(false)} />
          )}

          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: '100%', maxWidth: 400 }}>
            {/* The envelope, peeking above the letter - a real mascot carrying
                it rather than decoration alone. */}
            <motion.div
              aria-hidden
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] }}
              style={{ position: 'absolute', left: '50%', bottom: '100%', transform: 'translate(-50%, 26px)', width: 200, height: 112, zIndex: 1 }}
            >
              <div style={{ position: 'absolute', inset: 0, background: 'var(--welfare)', borderRadius: '18px 18px 0 0', clipPath: 'polygon(0 100%, 50% 35%, 100% 100%)' }} />
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 68, background: 'var(--welfare-ink)', borderRadius: '18px 18px 0 0' }} />
              <div style={{ position: 'absolute', left: '50%', top: 44, transform: 'translateX(-50%)', width: 46, height: 46, borderRadius: '50%', background: 'var(--card)', border: '2px solid var(--ink)', display: 'grid', placeItems: 'center' }}>
                <SuccessCheck size={26} color="var(--welfare)" />
              </div>
              <span style={{ position: 'absolute', right: -26, bottom: -8, zIndex: -1 }}>
                <Mascot character="nolen" pose="cheer" size={64} />
              </span>
            </motion.div>

            {/* The letter itself. */}
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Welcome to AquaTerra"
              tabIndex={-1}
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.32, ease: [0.2, 0, 0, 1], delay: reducedMotion ? 0 : 0.08 }}
              style={{
                position: 'relative', zIndex: 2, background: '#FFFDF2', borderRadius: 'var(--r-outer)',
                boxShadow: '0 24px 56px -20px rgba(10,10,10,.35)',
                padding: '44px 32px 30px', textAlign: 'center', outline: 'none',
              }}
            >
              <p style={{ margin: '0 0 18px', fontFamily: 'var(--mono)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink-3)' }}>
                AQUATERRA · KOLKATA · SINCE 2021
              </p>

              <div className="h-display" style={{ fontSize: 28, letterSpacing: '-0.03em' }}>
                you&apos;re in, {member?.full_name?.split(' ')[0] || 'friend'}.
              </div>

              <p style={{ fontFamily: 'var(--eina)', fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.65, margin: '14px 0 0' }}>
                your account has been approved - full access to the feed, teams, openings and everything else AquaTerra is building, unlocked.
              </p>

              <p style={{ fontFamily: 'var(--font-hand, "Caveat", cursive)', fontSize: 24, color: 'var(--welfare-ink)', margin: '18px 0 0' }}>
                welcome to the team.
              </p>

              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', marginTop: 22, borderRadius: 999, boxShadow: 'var(--shadow-cta)' }}
                onClick={close}
              >
                let&apos;s go →
              </button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// APPROVED_WELCOME_FLAG_KEY now lives in lib/firstRunFlags.ts. Re-exporting it
// from here is what put this modal (and framer-motion with it) on the eager
// critical path, because FirstRunController needs the key but not the modal.
