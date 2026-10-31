import { ReactNode } from 'react'
import { XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline'

/**
 * Inline alert. Distinct from a toast: this stays in the layout next to the
 * thing it describes, where a toast is transient and global.
 *
 * REDESIGN 2026-09: the variants were Tailwind palette classes
 * (`bg-green-50 border-green-200 text-green-800` and so on) from a Tailwind
 * build this app no longer loads, so every variant rendered as unstyled black
 * text with no border and no background - and the dismiss button had no hit
 * area. Rebuilt on the app's own tokens via the `.aqa-*` classes in
 * styles/v6.css. The API is unchanged.
 *
 * The hue is a 4px left edge rather than a fill: these alerts carry body copy
 * at 13.5px, and --welfare under ink measures 4.35:1, which is under the AA
 * floor for text that size. A left edge keeps the variant readable.
 */
interface AlertProps {
  children: ReactNode
  variant?: 'success' | 'error' | 'warning' | 'info'
  onClose?: () => void
  className?: string
}

const ICONS = {
  success: CheckCircleIcon,
  error: ExclamationTriangleIcon,
  warning: ExclamationTriangleIcon,
  info: InformationCircleIcon,
} as const

const Alert = ({ children, variant = 'info', onClose, className = '' }: AlertProps) => {
  const Icon = ICONS[variant]

  // An error or a warning interrupts; a success or an info notice waits its
  // turn. This mapping was already correct and is preserved.
  const isUrgent = variant === 'error' || variant === 'warning'

  return (
    <div
      className={`aqa aqa-${variant} ${className}`.trim()}
      role={isUrgent ? 'alert' : 'status'}
      aria-live={isUrgent ? 'assertive' : 'polite'}
    >
      <Icon className="aqa-ic" strokeWidth={2} aria-hidden="true" />
      <div className="aqa-body">{children}</div>
      {onClose && (
        <button onClick={onClose} aria-label="Dismiss" className="aqa-close" type="button" title="Dismiss">
          <XMarkIcon width={16} height={16} strokeWidth={2.5} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export default Alert
