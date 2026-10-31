import { useId, type ReactNode } from 'react'
import './GatedButton.css'

interface ToggleProps {
  checked: boolean
  onChange: (next: boolean) => void
  label?: string
  /** Hidden-visually label for screen readers when no visible label is shown. */
  ariaLabel?: string
  disabled?: boolean
  id?: string
  /**
   * changelog/11-system-states.md §11.9 state 11 - why this switch cannot be
   * used right now, in one lowercase clause. A native `disabled` switch is out
   * of the tab order, so nothing it points at with `aria-describedby` is ever
   * reachable; with a reason the switch stays focusable and `aria-disabled`,
   * and the sentence renders under it. Leave `null` when the switch is only
   * BUSY - "saving…" is not an eligibility rule.
   */
  reason?: ReactNode
}

/**
 * Accessible switch - real `role="switch"` + `aria-checked`, operable with
 * Space/Enter (native <button>), token-driven scrapbook styling. On = welfare
 * fill; the knob is an ink-ringed sticker that slides. Honors reduced-motion via
 * the global CSS transition catch-all.
 */
const Toggle = ({ checked, onChange, label, ariaLabel, disabled = false, id, reason = null }: ToggleProps) => {
  const autoId = useId()
  const switchId = id || autoId
  const hintId = `${switchId}-reason`
  // A reason takes over from `disabled`: same look, but focusable and
  // described, and the click is cancelled below instead of by the browser.
  const gated = !!reason
  const off = disabled || gated

  const control = (
    <button
      type="button"
      role="switch"
      id={switchId}
      aria-checked={checked}
      aria-label={!label ? ariaLabel : undefined}
      disabled={disabled && !gated}
      aria-disabled={gated || undefined}
      aria-describedby={gated ? hintId : undefined}
      onClick={() => { if (gated) return; onChange(!checked) }}
      style={{
        position: 'relative',
        width: 46,
        height: 28,
        flexShrink: 0,
        borderRadius: 999,
        border: 'var(--hair-3)',
        background: checked ? 'var(--welfare)' : 'var(--bg-3)',
        transition: 'background 160ms',
        cursor: off ? 'not-allowed' : 'pointer',
        opacity: off ? 0.45 : 1,
        padding: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 1,
          left: checked ? 20 : 1,
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: 'var(--card)',
          boxShadow: 'var(--lift-2)',
          transition: 'left 180ms var(--ease-pop)',
        }}
      />
    </button>
  )

  const hint = gated
    ? <span id={hintId} className="gated-reason mono">{reason}</span>
    : null

  if (!label) return <>{control}{hint}</>

  return (
    <label
      htmlFor={switchId}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        cursor: off ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--eina)',
        fontSize: 14,
        color: 'var(--ink)',
      }}
    >
      {control}
      <span>{label}</span>
      {hint}
    </label>
  )
}

export default Toggle
