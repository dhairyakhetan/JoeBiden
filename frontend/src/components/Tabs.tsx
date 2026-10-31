import { KeyboardEvent, ReactNode, useRef } from 'react'

export interface TabItem {
  id: string
  label: ReactNode
}

interface TabsProps {
  tabs: TabItem[]
  active: string
  onChange: (id: string) => void
  /** Accessible name for the tablist. */
  ariaLabel: string
  /** Base id used to wire aria-controls → the consumer's role="tabpanel" (`${idBase}-panel-${id}`). */
  idBase?: string
  className?: string
}

/**
 * ARIA tablist with roving tabindex + arrow-key navigation (WAI-ARIA tabs
 * pattern). Token-driven scrapbook chips - the active tab is an ink pill.
 * The consumer renders the matching panels:
 *   <div role="tabpanel" id={`${idBase}-panel-${active}`} aria-labelledby={`${idBase}-tab-${active}`}>
 */
const Tabs = ({ tabs, active, onChange, ariaLabel, idBase = 'tabs', className = '' }: TabsProps) => {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % tabs.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    if (next < 0) return
    e.preventDefault()
    onChange(tabs[next].id)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={className}
      style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
    >
      {tabs.map((t, i) => {
        const selected = t.id === active
        return (
          <button
            key={t.id}
            ref={el => { refs.current[i] = el }}
            role="tab"
            id={`${idBase}-tab-${t.id}`}
            aria-selected={selected}
            aria-controls={`${idBase}-panel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={e => onKeyDown(e, i)}
            style={{
              minHeight: 40,
              padding: '8px 16px',
              borderRadius: 999,
              border: selected ? '1px solid var(--ink)' : 'var(--hair-2)',
              background: selected ? 'var(--ink)' : 'var(--card)',
              color: selected ? 'var(--bg)' : 'var(--ink)',
              fontFamily: 'var(--mono)',
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'lowercase',
              letterSpacing: '0.02em',
              transition: 'background 140ms, color 140ms, transform 140ms',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

export default Tabs
