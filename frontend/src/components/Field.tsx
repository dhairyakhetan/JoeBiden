import { useId, type ReactNode, type CSSProperties } from 'react'

/**
 * A label bound to its control.
 *
 * The pattern this replaces was everywhere in the app:
 *
 *     <label style={LBL}>Title <span>*</span></label>
 *     <input className="input" name="title" … />
 *
 * That renders a `<label>` with no `htmlFor` next to an `<input>` with no `id`,
 * so the two are siblings that share nothing. Screen readers announce the
 * control as an unlabelled edit field and clicking the label doesn't focus it —
 * WCAG 1.3.1, 3.3.2 and 4.1.2. A live audit counted ~97 of these.
 *
 * `Field` generates the id once and hands it to both sides, so the association
 * can't be forgotten:
 *
 *     <Field label="Title" required labelStyle={LBL}>
 *       {id => <input id={id} className="input" name="title" … />}
 *     </Field>
 *
 * The render-prop (rather than cloneElement) keeps the wiring visible at the
 * call site and works with any control — input, textarea, select, or a custom
 * composite — without guessing at which child to patch.
 *
 * `error` and `hint` are wired through `aria-describedby` via the same id, so a
 * control that renders one gets it announced. Pass `describedBy` into the
 * control when you use either.
 */

interface FieldProps {
  /** Visible label text. Required — a Field with nothing to say isn't a Field. */
  label: ReactNode
  /** Marks the control required and appends the asterisk. */
  required?: boolean
  /** Validation message. Announced via role="alert" and linked to the control. */
  error?: string
  /** Supporting text shown under the control when there's no error. */
  hint?: ReactNode
  labelStyle?: CSSProperties
  labelClassName?: string
  /** Wrapper style, for call sites that were laying the pair out themselves. */
  style?: CSSProperties
  className?: string
  /**
   * Receives the generated id, plus the aria-describedby value when an error or
   * hint is present. Spread both onto the control.
   */
  children: (id: string, describedBy: string | undefined) => ReactNode
}

export default function Field({
  label,
  required,
  error,
  hint,
  labelStyle,
  labelClassName,
  style,
  className,
  children,
}: FieldProps) {
  const id = useId()
  const msgId = `${id}-msg`
  const describedBy = error || hint ? msgId : undefined

  return (
    <div style={style} className={className}>
      <label htmlFor={id} style={labelStyle} className={labelClassName}>
        {label}
        {required && <span style={{ color: 'var(--danger)', marginLeft: 3 }} aria-hidden>*</span>}
      </label>
      {children(id, describedBy)}
      {error
        ? <p id={msgId} role="alert" style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--danger)' }}>{error}</p>
        : hint
          ? <p id={msgId} style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--ink-3)' }}>{hint}</p>
          : null}
    </div>
  )
}
