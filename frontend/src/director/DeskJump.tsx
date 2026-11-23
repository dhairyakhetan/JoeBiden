import { useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Desk } from './deskAccess'
import { matchDesks } from './deskJump'

/**
 * "Jump to a desk": a combobox over the desks this viewer can already see
 * (bug tracker e11544ed). Arrow keys move, Enter goes, Escape clears.
 * Searches names, the words people use for a desk, group names and blurbs.
 */
export default function DeskJump({ groups, onNavigate }: { groups: { label: string; items: Desk[] }[]; onNavigate?: () => void }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const navigate = useNavigate()
  const listId = useId()
  const inputId = useId()
  const hits = useMemo(() => matchDesks(groups, query), [groups, query])
  const open = query.trim().length > 0

  const go = (i: number) => {
    const hit = hits[i]
    if (!hit) return
    setQuery('')
    setActive(0)
    navigate(`/director/${hit.desk.path}`)
    onNavigate?.()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, hits.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); go(active) }
    else if (e.key === 'Escape') { setQuery(''); setActive(0) }
  }

  return (
    <div className="ops-jump">
      <label htmlFor={inputId} className="sr-only">Jump to a desk</label>
      <input
        id={inputId}
        type="search"
        className="ops-jump-input"
        placeholder="jump to a desk…"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && hits[active] ? `${listId}-${active}` : undefined}
        value={query}
        onChange={e => { setQuery(e.target.value); setActive(0) }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul id={listId} role="listbox" aria-label="Matching desks" className="ops-jump-list">
          {hits.length === 0 ? (
            <li className="ops-jump-empty" role="option" aria-selected={false} aria-disabled>no desk matches</li>
          ) : hits.map((h, i) => (
            <li
              key={h.desk.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={'ops-jump-item' + (i === active ? ' is-active' : '')}
              onMouseDown={e => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(i)}
            >
              <span className="ops-jump-label">{h.desk.label}</span>
              <span className="ops-jump-group mono">{h.group}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
