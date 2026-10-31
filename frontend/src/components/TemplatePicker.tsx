// Shared "choose a design" chip row for the generator studio modals (Poster,
// Blog, Carousel-cover, Story). Always includes a "Surprise me" option
// (selected = null) that keeps the existing random-roll behavior; picking a
// named chip pins that specific template for the next generate/regenerate.

interface TemplatePickerProps {
  names: string[]
  selected: string | null
  onSelect: (name: string | null) => void
  label?: string
  /** Chips wrap onto several rows instead of scrolling sideways. For wide panels. */
  wrap?: boolean
}

export default function TemplatePicker({ names, selected, onSelect, label = 'design', wrap = false }: TemplatePickerProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      <span className="mono" style={{ fontSize: 9.5, color: 'var(--ink-3)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <div style={wrap ? { display: 'flex', flexWrap: 'wrap', gap: 6 } : { display: 'flex', gap: 6, overflowX: 'auto', padding: '1px 1px 4px', scrollbarWidth: 'none', overscrollBehaviorX: 'none' }}>
        <Chip label="Surprise me" active={selected === null} onClick={() => onSelect(null)} />
        {names.map(name => (
          <Chip key={name} label={name} active={selected === name} onClick={() => onSelect(name)} />
        ))}
      </div>
    </div>
  )
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        flexShrink: 0, padding: '7px 14px', borderRadius: 999, cursor: 'pointer',
        // resting chip edge -> hairline; the selected chip keeps an ink edge
        // because the fill behind it is ink too and it reads as the state,
        // just at 1px instead of 1.5px.
        border: active ? '1px solid var(--ink)' : 'var(--hair-2)',
        background: active ? 'var(--ink)' : 'var(--bg-2)',
        color: active ? 'var(--card)' : 'var(--ink-2)',
        fontFamily: 'var(--display)', fontWeight: 700, fontSize: 11.5, whiteSpace: 'nowrap',
        transition: 'background 0.14s, border-color 0.14s, color 0.14s',
      }}
      onMouseDown={e => ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.96)')}
      onMouseUp={e => ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)')}
      onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)')}
    >
      {label}
    </button>
  )
}
