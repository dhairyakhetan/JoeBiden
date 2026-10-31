import { ButtonHTMLAttributes, ReactNode } from 'react'
import Spinner from './Spinner'

type Category = 'events' | 'welfare' | 'labs' | 'ops' | 'content'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'category'
  /** When variant="category", tints the button with that vertical's hue (ink text per the AA contrast law). */
  category?: Category
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

// All lookup tables are render-invariant → hoisted to module scope so the app's
// most-reused primitive doesn't rebuild them every render.

// Scrapbook system (§Phase 2): hover lifts up/left onto a hard ink offset shadow;
// active presses into a 1px shadow. Focus ring is global (*:focus-visible, 3px grape).
const BASE =
  'inline-flex items-center justify-center font-medium rounded-full ' +
  '[transition:background-color_180ms,box-shadow_140ms,color_180ms,transform_140ms] ' +
  'hover:-translate-y-0.5 hover:[box-shadow:var(--lift-2)] ' +
  'active:translate-y-0 active:scale-[0.96] active:[box-shadow:none] ' +
  'disabled:opacity-45 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:[box-shadow:none]'

// Tokens only (no raw hex). Category/welfare/tomato surfaces take INK text
// (contrast law §1.2); the one white-text flip is on the darker --accent-h hover.
const VARIANTS: Record<string, string> = {
  primary: '[color:var(--ink)] [background-color:var(--accent)] [border:var(--bd)] hover:[background-color:var(--accent-h)] hover:[color:#fff]',
  secondary: '[background-color:var(--card)] [color:var(--ink)] [border:var(--bd)] hover:[background-color:var(--bg-2)]',
  danger: '[color:var(--ink)] [background-color:var(--tomato)] [border:var(--bd)]',
  success: '[color:var(--ink)] [background-color:var(--welfare)] [border:var(--bd)]',
  ghost: 'bg-transparent [color:var(--ink)] [border:2px_solid_transparent] hover:[background-color:var(--surface)]',
}

// Category hues as PRE-WRITTEN static classes (one per closed-union value) so the
// Tailwind JIT actually emits them - a runtime-interpolated `var(--c-${x})` class
// never is. Keeps the category variant in the class cascade (no inline-style escape hatch).
const CATEGORY: Record<Category, string> = {
  events:  '[color:var(--ink)] [border:var(--bd)] [background-color:var(--c-events)]',
  welfare: '[color:var(--ink)] [border:var(--bd)] [background-color:var(--c-welfare)]',
  labs:    '[color:var(--ink)] [border:var(--bd)] [background-color:var(--c-labs)]',
  ops:     '[color:var(--ink)] [border:var(--bd)] [background-color:var(--c-ops)]',
  content: '[color:var(--ink)] [border:var(--bd)] [background-color:var(--c-content)]',
}

// min-h enforces ≥44×44 touch targets (Apple HIG): sm 40px (dense rows, never <40),
// md 44px (standard CTA), lg 52px (hero CTAs).
const SIZES = {
  sm: 'px-3 py-1.5 text-sm min-h-10',
  md: 'px-4 py-2 text-sm min-h-11',
  lg: 'px-6 py-3 text-base min-h-[52px]',
}

const Button = ({
  children,
  variant = 'primary',
  category = 'welfare',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) => {
  const variantClass = variant === 'category' ? CATEGORY[category] : VARIANTS[variant]

  return (
    <button
      className={`${BASE} ${variantClass} ${SIZES[size]} ${loading ? 'pointer-events-none' : ''} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner size="sm" className="mr-2" />}
      {children}
    </button>
  )
}

export default Button
