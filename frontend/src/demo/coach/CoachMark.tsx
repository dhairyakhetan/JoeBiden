import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useReducedMotion } from 'framer-motion'
import type { DemoStep, DemoStepContext } from '../flows/types'

const SPOTLIGHT_CLASS = 'demo-spotlit'
const PULSE_CLASS = 'demo-spotlit--pulse'
/**
 * How long a target may stay missing before it is treated as really gone
 * rather than "still animating in". 19's own states list: "a spotlit element
 * disappears... advance or abort with a clear message. Never leave a
 * spotlight on nothing." A momentary miss is normal mid-transition (a modal's
 * enter animation, a re-render); this only fires for a target that stays gone.
 *
 * MEASURED IN MILLISECONDS, not frames. It used to be
 * `LOST_TARGET_GRACE_FRAMES = 45 // ~0.75s at 60fps`, which silently assumed
 * frames keep arriving - see the watchdog below for why that assumption is
 * the one thing this loop must not make.
 *
 * Raised from 750ms after a real report of the "lost the spot" card firing
 * on a step whose target never actually left the DOM - a step-to-step
 * handoff (the outgoing step's own unspotlight/scroll settling, or a
 * sibling re-render on the same tick) can eat most of a second on a slower
 * device before the next step's `findTarget` gets a clean read. 750ms was
 * tuned against a fast dev machine; this gives real hardware more room
 * before treating a still-transitioning screen as a genuinely lost target.
 */
const LOST_TARGET_GRACE_MS = 1500

/**
 * The watchdog interval, in ms.
 *
 * The find/track/complete loop ran on `requestAnimationFrame` ALONE, and rAF
 * is not a clock - the browser is entitled to stop delivering frames whenever
 * it decides the surface is not being presented: a background or occluded
 * tab, an embedded webview, battery saver, a headless/automation surface.
 *
 * When that happens every part of this loop stops at once, and the failure is
 * silent and total: the step never completes even after the member has
 * genuinely done the thing, AND the lost-target safety net never fires either
 * (it was counting frames that are no longer arriving), so there is not even
 * an error card. The member is left staring at a spotlight that will never
 * move, with no way forward.
 *
 * Reproduced exactly that way on 2026-09-11: in a surface that produces zero
 * frames (a plain CSS animation reported playState 'running' with currentTime
 * stuck at 0), post-to-feed's step 1 opened the composer correctly - its own
 * `isComplete` was true - and the walkthrough sat on "1 / 4" indefinitely.
 *
 * So the loop now has two drivers: rAF for smoothness when frames flow, and
 * this timer as the floor. `tick` is idempotent and guarded by `advancedRef`,
 * so running it from both is safe; the timer alone is enough to complete a
 * whole flow, just less smoothly.
 */
const WATCHDOG_MS = 120

interface CoachMarkProps {
  step: DemoStep
  stepIndex: number
  totalSteps: number
  context: Omit<DemoStepContext, 'target'>
  onAdvance: () => void
  onBack: () => void
  onLostTarget: () => void
  isFirstStep: boolean
}

export default function CoachMark({
  step, stepIndex, totalSteps, context, onAdvance, onBack, onLostTarget, isFirstStep,
}: CoachMarkProps) {
  const reducedMotion = useReducedMotion()
  const [target, setTarget] = useState<HTMLElement | null>(null)
  // Desktop only (19.2's mobile sheet stays pinned to the bottom regardless
  // - "on a phone that space is taken by the thumb"). Found by actually
  // trying to click the real control during verification: the floating
  // card defaults to bottom-right, and a control that ALSO lives near the
  // bottom-right (this flow's own send button, sitting in the composer's
  // bottom dock) can end up sitting UNDER the card - invisible to nothing,
  // but unclickable by a real pointer, which is a manual-completion dead
  // end the spec explicitly says must never happen. Flipping the card to
  // the opposite corner whenever it would overlap the spotlit element's own
  // footprint is a simple, general fix rather than a one-step special case.
  const [cardAtTop, setCardAtTop] = useState(false)
  const [lost, setLost] = useState(false)
  const [doingItForMe, setDoingItForMe] = useState(false)
  const spotlitRef = useRef<HTMLElement | null>(null)
  /** When the target first went missing, or null while it is present. Was a
   *  frame COUNTER; a counter of frames is meaningless in a surface that has
   *  stopped producing them. */
  const missingSinceRef = useRef<number | null>(null)
  const rafRef = useRef<number | undefined>(undefined)
  /** The timer half of the two-driver loop - see WATCHDOG_MS. */
  const watchdogRef = useRef<number | undefined>(undefined)
  const advanceTimeoutRef = useRef<number | undefined>(undefined)
  const cardRef = useRef<HTMLDivElement>(null)
  const advancedRef = useRef(false)

  // The find/track/complete loop. One rAF loop per mounted step - it tears
  // itself down (cancels + un-spotlights) whenever `step` changes, so the
  // next step always starts from a clean slate rather than inheriting a
  // stale spotlighted node.
  useEffect(() => {
    advancedRef.current = false
    missingSinceRef.current = null
    setLost(false)

    const tick = () => {
      // Guard: both drivers call this, and the rAF one can have a frame in
      // flight when the timer already advanced.
      if (advancedRef.current) return
      const found = step.findTarget()

      if (found) {
        missingSinceRef.current = null
        if (found !== spotlitRef.current) {
          spotlitRef.current?.classList.remove(SPOTLIGHT_CLASS, PULSE_CLASS)
          found.classList.add(SPOTLIGHT_CLASS)
          if (!reducedMotion) found.classList.add(PULSE_CLASS)
          spotlitRef.current = found
          setTarget(found)
          found.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'center' })
        }
        // Re-checked every frame (not just on target change): the card's
        // own footprint is fixed, but the TARGET can move under it from a
        // layout shift the target-change branch above wouldn't catch (a
        // sibling field growing, the viewport resizing).
        const r = found.getBoundingClientRect()
        const cardZoneLeft = window.innerWidth - 400
        const cardZoneTop = window.innerHeight - 340
        const overlapsCardZone = r.right > cardZoneLeft && r.bottom > cardZoneTop
        setCardAtTop(prev => (prev !== overlapsCardZone ? overlapsCardZone : prev))
      } else if (missingSinceRef.current == null) {
        missingSinceRef.current = Date.now()
      }

      // Checked every frame regardless of whether `found` exists THIS frame -
      // see the interface's own doc comment on why a step's completion
      // signal and its spotlight target are not always the same element.
      if (!advancedRef.current && step.isComplete(found)) {
        advancedRef.current = true
        // A short, fixed breath before handing off to the next step - long
        // enough to see the control's own confirmation (a chip turning
        // solid, "posted!" replacing the send icon) register, short enough
        // that the walkthrough still feels immediate. The spotlight stays
        // lit through the pause; only after it ends do we un-spotlight and
        // let the parent swap in the next step.
        advanceTimeoutRef.current = window.setTimeout(() => {
          spotlitRef.current?.classList.remove(SPOTLIGHT_CLASS, PULSE_CLASS)
          spotlitRef.current = null
          onAdvance()
        }, reducedMotion ? 120 : 650)
        return
      }

      if (
        !found &&
        missingSinceRef.current != null &&
        Date.now() - missingSinceRef.current > LOST_TARGET_GRACE_MS &&
        !lost
      ) {
        setLost(true)
      }
    }

    // Two drivers, one tick. rAF keeps the spotlight tracking smoothly while
    // frames flow; the interval is the floor that guarantees a step can still
    // complete, and a lost target can still be reported, in a surface that has
    // stopped painting entirely. See WATCHDOG_MS.
    const rafLoop = () => {
      tick()
      if (!advancedRef.current) rafRef.current = requestAnimationFrame(rafLoop)
    }
    rafRef.current = requestAnimationFrame(rafLoop)
    watchdogRef.current = window.setInterval(tick, WATCHDOG_MS)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (watchdogRef.current) window.clearInterval(watchdogRef.current)
      if (advanceTimeoutRef.current) window.clearTimeout(advanceTimeoutRef.current)
      spotlitRef.current?.classList.remove(SPOTLIGHT_CLASS, PULSE_CLASS)
      spotlitRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // Move focus to the card on every new step, so a screen-reader / keyboard
  // user is told what changed instead of staying wherever focus was left by
  // the previous step's control.
  useEffect(() => {
    const t = setTimeout(() => cardRef.current?.focus(), reducedMotion ? 0 : 260)
    return () => clearTimeout(t)
  }, [step, reducedMotion])

  const handleDoItForMe = useCallback(async () => {
    if (!target || doingItForMe) return
    setDoingItForMe(true)
    try {
      await step.doItForMe({ ...context, target })
    } finally {
      setDoingItForMe(false)
    }
  }, [target, step, context, doingItForMe])

  if (lost) {
    return createPortal(
      <div className="demo-card demo-card--lost" role="alertdialog" aria-labelledby="demo-lost-title">
        <h4 id="demo-lost-title" className="demo-card-title">lost the spot for a second.</h4>
        <p className="demo-card-body">the screen changed before we could point at the next thing. let's pick this step back up.</p>
        <div className="demo-card-actions">
          <button type="button" className="demo-btn demo-btn--primary" onClick={() => { setLost(false); missingSinceRef.current = null }}>
            try again
          </button>
          <button type="button" className="demo-btn" onClick={onLostTarget}>leave the demo</button>
        </div>
      </div>,
      document.body,
    )
  }

  return createPortal(
    <div
      key={step.id}
      ref={cardRef}
      className={'demo-card' + (cardAtTop ? ' demo-card--top' : '')}
      role="region"
      aria-label={`Walkthrough step ${stepIndex + 1} of ${totalSteps}`}
      tabIndex={-1}
    >
      <div className="demo-card-progress">
        <span className="demo-card-dots" aria-hidden="true">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span key={i} className={'demo-card-dot' + (i <= stepIndex ? ' is-filled' : '')} />
          ))}
        </span>
        <span className="demo-card-count mono">{stepIndex + 1} / {totalSteps}</span>
      </div>
      <h4 className="demo-card-title">{step.title}</h4>
      <p className="demo-card-body">{step.body}</p>
      <div className="demo-card-actions">
        {!isFirstStep && (
          <button type="button" className="demo-btn" onClick={onBack}>Back</button>
        )}
        <button
          type="button"
          className="demo-btn demo-btn--primary"
          onClick={handleDoItForMe}
          disabled={!target || doingItForMe}
        >
          {doingItForMe ? 'doing it…' : 'Do it for me'}
        </button>
      </div>
      <p className="demo-card-hint mono">{step.manualHint ?? 'or do it yourself'}</p>
    </div>,
    document.body,
  )
}
