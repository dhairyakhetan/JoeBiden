import { InputHTMLAttributes, forwardRef, useId } from 'react'

/**
 * REDESIGN 2026-09: was styled with Tailwind utilities and arbitrary-value
 * classes (`w-full px-4 py-2.5 rounded-lg`, `[color:var(--ink-2)]`,
 * `focus:ring-2`) that this app does not load, so the control rendered as a
 * bare browser input. It now uses the app's own `.input` class plus the
 * `.aqf-*` field wrapper in styles/v6.css. The API is unchanged.
 */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    // Associate the label + error/helper text with the control so screen
    // readers announce a proper accessible name and the reason for an error.
    const autoId = useId()
    const inputId = id ?? autoId
    const describedBy = error ? `${inputId}-error` : helperText ? `${inputId}-help` : undefined
    return (
      <div className="aqf">
        {label && (
          <label htmlFor={inputId} className="aqf-label">
            {label}
            {props.required && <span className="aqf-req">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={('input ' + className).trim()}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} role="alert" className="aqf-msg is-error">{error}</p>
        )}
        {helperText && !error && (
          <p id={`${inputId}-help`} className="aqf-msg">{helperText}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
