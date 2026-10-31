import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react'
import './GatedButton.css'

/**
 * changelog/11-system-states.md §11.9 state 11 — "disabled / ineligible:
 * `var(--bg)` ground, `var(--ink-3)` text, **and a reason**."
 *
 * Today a greyed-out control in this app says nothing about why, which reads
 * as the app being broken rather than as a rule the member can satisfy.
 *
 * ## Why `aria-disabled` and not `disabled`
 *
 * A native `disabled` button is removed from the tab order entirely, is not
 * hit-testable, and — the part that matters here — anything it points at with
 * `aria-describedby` is never reached, because focus can never land on it.
 * `title` is no better: it is not announced by screen readers on a disabled
 * control and does not exist on touch at all. So a `disabled` button
 * physically cannot carry a reason to assistive tech.
 *
 * This component therefore keeps the control **enabled and focusable**, marks
 * it `aria-disabled="true"`, points it at a visible reason line via
 * `aria-describedby`, and cancels the activation itself. A keyboard user tabs
 * to it and hears the label plus the reason; a screen-reader user browsing the
 * page reads the same sentence as ordinary text; a sighted user sees it under
 * the control. One sentence, three routes to it.
 *
 * The activation guard uses `preventDefault()` in the capture phase, so a
 * `type="submit"` gated button cannot submit its form either.
 *
 * `reason` is `null`/`undefined` for the normal, usable state — pass it a
 * string only when the control is genuinely unavailable and the cause is
 * knowable. A busy/in-flight control is NOT this: it should stay natively
 * `disabled` with `aria-busy`, because "posting…" already says why.
 */
export interface GatedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Short, lowercase, one clause. `null` when the control is usable. */
  reason?: string | null
  /** Where the reason line renders. `none` for callers that place it themselves. */
  hint?: 'below' | 'none'
  /** Optional announcer (components/LiveRegion's `useAnnouncer`) for a blocked tap. */
  onBlocked?: (reason: string) => void
  children?: ReactNode
}

export default function GatedButton({
  reason, hint = 'below', onBlocked, children, onClick, onKeyDown, disabled, ...rest
}: GatedButtonProps) {
  const hintId = useId()
  const gated = !!reason

  return (
    <>
      <button
        {...rest}
        // `disabled` is still honoured, and still means BUSY: a control
        // mid-write should not be operable, and its own label ("saving…")
        // already says why. A `reason` is the other thing entirely - an
        // eligibility rule - and it wins, because it is the case that needs
        // to stay reachable.
        disabled={disabled && !gated}
        aria-disabled={gated || undefined}
        aria-describedby={gated ? hintId : rest['aria-describedby']}
        data-gated={gated || undefined}
        onClick={e => {
          if (gated) {
            // Cancels the default action too, so a submit button in this state
            // cannot post the form it sits in.
            e.preventDefault()
            e.stopPropagation()
            if (reason) onBlocked?.(reason)
            return
          }
          onClick?.(e)
        }}
        onKeyDown={e => {
          if (gated && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            if (reason) onBlocked?.(reason)
            return
          }
          onKeyDown?.(e)
        }}
      >
        {children}
      </button>
      {gated && hint === 'below' && (
        <span id={hintId} className="gated-reason mono">{reason}</span>
      )}
    </>
  )
}

/**
 * The reason line on its own, for a control that cannot become a
 * `GatedButton` — a native `<input>`/`<select>`, or a button whose markup
 * belongs to another component. Wire it by hand:
 * `aria-describedby={id}` on the control, `<DisabledReason id={id} …/>` after.
 */
export function DisabledReason({ id, children }: { id: string; children: ReactNode }) {
  return <span id={id} className="gated-reason mono">{children}</span>
}
