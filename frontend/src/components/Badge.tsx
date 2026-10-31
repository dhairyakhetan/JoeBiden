import { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'forest'
  size?: 'sm' | 'md'
  className?: string
}

// Static lookup tables - hoisted to module scope so they aren't rebuilt per render.
// All variants token-driven (no raw hex/Tailwind palette). Tinted fills carry ink
// text (contrast law); the accent fills use the welfare-derived tint tokens.
const VARIANTS = {
  default: '[background-color:var(--surface-2)] [color:var(--ink-2)]',
  success: '[background-color:var(--accent-bg)] [color:var(--ink)]',
  warning: '[background-color:color-mix(in_srgb,var(--lemon)_18%,transparent)] [color:var(--ink)]',
  error: '[background-color:color-mix(in_srgb,var(--tomato)_14%,transparent)] [color:var(--ink)]',
  info: '[background-color:color-mix(in_srgb,var(--sky)_16%,transparent)] [color:var(--ink)]',
  forest: '[background-color:var(--accent-bg)] [color:var(--accent-ink)]',
} as const

const SIZES = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
} as const

const Badge = ({ children, variant = 'default', size = 'sm', className = '' }: BadgeProps) => {
  return (
    <span className={`inline-flex items-center font-medium rounded-full ${VARIANTS[variant]} ${SIZES[size]} ${className}`}>
      {children}
    </span>
  )
}

export default Badge
