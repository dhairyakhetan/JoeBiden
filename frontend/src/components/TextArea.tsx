import { TextareaHTMLAttributes, forwardRef, useId } from 'react'

/**
 * REDESIGN 2026-09: same dead-Tailwind problem as Input.tsx. Now uses the
 * app's own `.textarea` class plus the `.aqf-*` field wrapper in
 * styles/v6.css. The API is unchanged.
 */
interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
}

const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    // Associate the label + error/helper text with the control so screen
    // readers announce a proper accessible name and the reason for an error.
    const autoId = useId()
    const areaId = id ?? autoId
    const describedBy = error ? `${areaId}-error` : helperText ? `${areaId}-help` : undefined
    return (
      <div className="aqf">
        {label && (
          <label htmlFor={areaId} className="aqf-label">
            {label}
            {props.required && <span className="aqf-req">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={areaId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={('textarea ' + className).trim()}
          {...props}
        />
        {error && (
          <p id={`${areaId}-error`} role="alert" className="aqf-msg is-error">{error}</p>
        )}
        {helperText && !error && (
          <p id={`${areaId}-help`} className="aqf-msg">{helperText}</p>
        )}
      </div>
    )
  }
)

TextArea.displayName = 'TextArea'

export default TextArea
