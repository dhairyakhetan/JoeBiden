import '../styles/routes/director.css'
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useToast } from '../components/Toast'
import { isDemoShadowActive } from '../demo/runtime/demoShadow'
import { useModalA11y, MODAL_FOCUSABLE } from '../hooks/useDialog'
import {
  EllipsisHorizontalIcon,
  ExclamationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

/**
 * Admin desk kit - the small shared design system the HoD desk routes through.
 *
 * Goal: one header, one toolbar, one badge, one empty state across all 12 tabs,
 * so the desk reads as ONE product instead of twelve. The design rule as of the
 * 2026-07 brutalist handoff (superseding the old "calm, efficient controls with
 * a few branded accents" framing): CHROME IS BRUTALIST, DATA IS LEGIBLE. Stickers,
 * torn edges, stamps, rotation, and hard offset shadows are for chrome - headers,
 * empty states, section labels, status marks, the bulk-action bar, confirmations.
 * Row content - names, dates, counts, body text - stays flat, high-contrast, and
 * unrotated, so it's fast to scan even where the shell around it is playful.
 * Styling lives under `.adm-*` / `.hod-*` in director.css; the whole desk is
 * wrapped in `.admin`, which also flattens the public site's playful motion.
 *
 * Redesign section 04 (2026-09) restyled this kit once so all seventeen desks
 * inherit it. The desk takes exactly TWO things from the poster system: the
 * radius pair (--r-card 26px containers, --r-sm 20px inners) and the sticker
 * keyline (paper ring then ink ring, on the stamp only). It takes NONE of the
 * poster's rotation-as-layout, torn edges or 9px gutter beyond the chrome that
 * was already here. A desk is not a poster.
 */

/**
 * One max-width + page padding for every tab - kills the width-jump on switch.
 *
 * `wide` (default false) is the one opt-out: a desk that renders a genuine
 * two-pane composition at >= 1025px (ContentManager's triage deck) gets 1180px
 * instead of the shared 900px. Phone and tablet are unaffected, so the desks
 * still agree at every width a phone will ever see.
 */
export function AdminLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <div className={'adm-layout' + (wide ? ' adm-layout--wide' : '')}>{children}</div>
}

/**
 * One header treatment everywhere: branded sticker label + clean title + count
 * + actions.
 *
 * The title is an `h1` — finding F1 of the 2026-09-10 audit, fixed 2026-09-11.
 * It was an `h2`, and since each desk tab is its own ROUTE with no other
 * heading above it, every one of the 17 `/director/*` tabs reported `h1: 0`
 * and started its outline at level 2. A screen-reader user tabbing into a desk
 * got a page whose top-level heading did not exist.
 *
 * `h1` is right rather than a visually-hidden one bolted onto the shell: on a
 * routed page this string IS the page title — it is what `useMeta` already
 * puts in `document.title` for that same route. Purely a semantic change;
 * `.adm-header-title` carries all the styling and is unchanged, so nothing
 * moves by a pixel.
 */
export function AdminTabHeader({
  label, title, subtitle, count, actions,
}: {
  label?: string
  title: string
  subtitle?: string
  count?: number
  actions?: ReactNode
}) {
  return (
    <header className="adm-header">
      <div className="adm-header-main">
        {label && <span className="adm-header-label">{label}</span>}
        <div className="adm-header-titlerow">
          <h1 className="adm-header-title">{title}</h1>
          {count != null && count > 0 && (
            <span className="adm-header-count" aria-label={`${count} ${count === 1 ? 'item' : 'items'}`}>{count}</span>
          )}
        </div>
        {subtitle && <p className="adm-header-sub">{subtitle}</p>}
      </div>
      {actions && <div className="adm-header-actions">{actions}</div>}
    </header>
  )
}

/** Search + filters + right-aligned primary actions - lifted from the best tab (Members). */
export function DataToolbar({
  search, onSearch, searchPlaceholder = 'Search…', children, actions, actionsInline = false,
}: {
  search?: string
  onSearch?: (v: string) => void
  searchPlaceholder?: string
  children?: ReactNode
  actions?: ReactNode
  /**
   * By default the `actions` slot becomes a FIXED, bottom-right floating
   * cluster on phones (director.css, ≤600px) — right for a primary button
   * like "+ Add HoD", wrong for anything the user reads as part of the
   * toolbar.
   *
   * MemberDirectory passes a sort <select> here, and the fixed rule tore it
   * out of the toolbar and pinned it near the bottom of the screen: measured
   * at 375px it rendered at y=680, ~330px BELOW the result area, completely
   * detached from the filters it controls.
   *
   * Set this when the actions are inline controls rather than a floating
   * action button, and they stay in the toolbar where they belong.
   */
  actionsInline?: boolean
}) {
  return (
    <div className="adm-toolbar">
      {onSearch && (
        <div className="adm-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="search"
            value={search ?? ''}
            onChange={e => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            autoComplete="off"
          />
        </div>
      )}
      {children && <div className="adm-toolbar-filters">{children}</div>}
      {actions && (
        <div className={'adm-toolbar-actions' + (actionsInline ? ' adm-toolbar-actions-inline' : '')}>
          {actions}
        </div>
      )}
    </div>
  )
}

export type BadgeTone = 'neutral' | 'success' | 'warn' | 'danger' | 'info'

/** One status vocabulary - replaces the desk's 5 different status representations. */
export function StatusBadge({ children, tone = 'neutral', dot }: { children: ReactNode; tone?: BadgeTone; dot?: boolean }) {
  return (
    <span className={'adm-badge adm-badge-' + tone}>
      {dot && <span className="adm-badge-dot" aria-hidden />}
      {children}
    </span>
  )
}

/** One empty state - title + optional hint + optional action. */
export function EmptyState({ icon = '-', title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="adm-empty">
      <div className="adm-empty-icon" aria-hidden>{icon}</div>
      <div className="adm-empty-title">{title}</div>
      {hint && <p className="adm-empty-hint">{hint}</p>}
      {action && <div className="adm-empty-action">{action}</div>}
    </div>
  )
}

export type StampTone = 'pending' | 'approved' | 'rejected' | 'custom'

/**
 * StatusStamp - one status vocabulary for every queue row. Redesign 06.6.1
 * replaced the rotated ink-stamp rendering (rotated data, animated in on
 * every render, needed a manual contrast patch per hue) with a tinted pill
 * + dot: a `*-ink` label colour at a guaranteed ratio instead. The props
 * (and therefore every call site - HiringResponses/FormResponses/
 * ContentManager's STATUS_TONE maps, the `queued` relabel) are UNCHANGED;
 * only what this component renders changed.
 */
export function StatusStamp({
  label, tone = 'pending', color,
}: {
  label: string
  tone?: StampTone
  /** Only used when tone === 'custom' - pass a CSS color (e.g. a category token). */
  color?: string
}) {
  const toneClass = tone === 'custom' ? '' : ` is-${tone}`
  return (
    <span
      className={'adm-status' + toneClass}
      /* CONTRAST (DESIGN.md §2). `custom` used to set --sc-ink to the SAME
         saturated hue as the 22% fill, so the 9px label was e.g. --sky on a
         22%-sky tint: 2.08:1. That is the exact defect the comment above
         .adm-status in styles/routes/director.css says was fixed for the
         three built-in tones - `custom` was simply never converted. Every
         built-in tone pairs the fill with its DARKENED *-ink partner; a
         caller-supplied colour has no partner to look up, so the label takes
         full ink, which clears 12:1 on a 22% tint of any palette hue and is
         what §2 mandates on a fill regardless. The dot keeps the caller's
         hue (--sc-dot) so the colour cue survives; a 6px dot is not text. */
      style={tone === 'custom' && color
        ? { ['--sc' as any]: color, ['--sc-dot' as any]: color, ['--sc-ink' as any]: 'var(--ink)' }
        : undefined}
    >
      <span className="adm-status-dot" aria-hidden />
      <span className="adm-status-label">{label}</span>
    </span>
  )
}

/**
 * EmptyLedger - the desk's shared empty state: a short display-type note,
 * standing in for generic "no X pending" copy. `message` is the
 * pre-composed line (e.g. "nothing waiting - nice work" or a
 * category-scoped variant like "no welfare posts pending") - this component
 * doesn't know about categories, the caller composes the string.
 * Redesign 06.7 removed the hand-drawn squiggly-arrow doodle and the
 * rotated Caveat handwriting - a fifth, uncontrolled typeface - in favour of
 * a plain display-face note on a flat cream fill.
 */
export function EmptyLedger({ message, sub, action }: { message: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="ledger-empty">
      <p className="ledger-empty-note">{message}</p>
      {sub && <p className="ledger-empty-sub">{sub}</p>}
      {/* Optional escape hatch under `sub` - an empty ledger produced by a
          filter or a search term must offer the way back out of it, or the
          desk reads as "there is no work" when the work is simply filtered
          away. Additive and optional: every existing caller is unchanged. */}
      {action && <div className="ledger-empty-action">{action}</div>}
    </div>
  )
}

/**
 * Filter pill used inside DataToolbar (consistent with the brand chip, calmed).
 * `count`, when given, renders as a muted trailing mono number (06.5) - only
 * meaningful on the active pill, so callers pass it conditionally.
 */
export function FilterPill({ active, onClick, children, count }: { active?: boolean; onClick: () => void; children: ReactNode; count?: number }) {
  return (
    <button type="button" className={'adm-pill' + (active ? ' is-active' : '')} onClick={onClick} aria-pressed={active}>
      {children}
      {count != null && <span className="adm-pill-count">{count}</span>}
    </button>
  )
}

/**
 * Floating bulk-action bar - appears once ≥1 row is selected in a desk with
 * multi-select (row checkboxes). Was duplicated ad hoc (own fixed-position
 * markup, own "N selected" label, own ✕ clear button) between
 * VolunteerApplications and other list desks; this is the one shared shell.
 * `children` are the desk-specific actions (label buttons, export, etc.) -
 * this component only owns the position/count/clear chrome around them.
 *
 * Redesign 06.6.2: the bar itself became an ink capsule (`--hod-shadow-md`,
 * now `var(--lift-3)`) and the count is DATA, not chrome - it reads as plain
 * mono text on ink instead of a rotated lemon sticker chip (`.adm-bulkbar-
 * chip` removed a rotation from a number).
 */
export function BulkActionBar({
  count, onClear, children, busy,
}: {
  count: number
  onClear: () => void
  children?: ReactNode
  busy?: boolean
}) {
  if (count === 0) return null
  return (
    // The divider and the flex spacer are gone deliberately. A `nowrap` row of
    // fixed-width children measured 418px intrinsic inside a 360px content box
    // and pushed the clear button outside the frame, where the bar's own
    // `overflow: hidden` swallowed it. Actions now shrink (`flex: 1 1 auto;
    // min-width: 0`) and the clear button is a fixed 44x44 that never shrinks.
    <div className="adm-bulkbar" aria-live="polite">
      <span className="adm-bulkbar-count mono">{count} selected</span>
      <div className="adm-bulkbar-actions" aria-busy={busy}>{children}</div>
      <button type="button" className="adm-bulkbar-clear" onClick={onClear} aria-label="Clear selection" title="Clear selection">
        <XMarkIcon width={18} height={18} strokeWidth={2.2} aria-hidden />
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   3.1 - AdminSkeleton: one loading vocabulary for all twelve desks.
   ═══════════════════════════════════════════════════════════════════════ */

/** A single shimmer bar - reuses the `.v6-skeleton` shimmer already defined
 * for the public site so both surfaces animate identically. */
function SkelBar({ w, h = 12, r = 6 }: { w: string | number; h?: number; r?: number }) {
  return <div className="v6-skeleton adm-skel-bar" style={{ width: w, height: h, borderRadius: r }} />
}

/** Row-list skeleton - approximates an `<AdminRow>`'s height/rhythm (a
 * stamp-width block, a two-line text stack, and 2 action-circle placeholders)
 * so real data resolving in doesn't jump the layout. */
function SkelRow({ i }: { i: number }) {
  return (
    <div className="adm-skel-row" style={{ ['--row-i' as any]: i }}>
      <div className="adm-skel-row-main">
        <SkelBar w="62%" h={15} />
        <SkelBar w="38%" h={11} />
      </div>
      <SkelBar w={54} h={20} r={4} />
      <div className="adm-skel-row-acts">
        <div className="v6-skeleton adm-skel-circle" />
        <div className="v6-skeleton adm-skel-circle" />
      </div>
    </div>
  )
}

/** Card-grid skeleton - for MemberDirectory-style avatar/name grids. */
function SkelCardGrid({ i }: { i: number }) {
  return (
    <div className="adm-skel-card" style={{ ['--row-i' as any]: i }}>
      <div className="v6-skeleton adm-skel-avatar" />
      <SkelBar w="70%" h={13} />
      <SkelBar w="45%" h={10} />
    </div>
  )
}

/** Generic card skeleton - a single wide panel placeholder (e.g. a stat
 * block or a detail panel loading). */
function SkelCard({ i }: { i: number }) {
  return (
    <div className="adm-skel-card adm-skel-card--wide" style={{ ['--row-i' as any]: i }}>
      <SkelBar w="40%" h={11} />
      <SkelBar w="80%" h={20} />
      <SkelBar w="60%" h={13} />
    </div>
  )
}

export function AdminSkeleton({ rows = 5, variant = 'row' }: { rows?: number; variant?: 'row' | 'card' | 'grid' }) {
  const items = Array.from({ length: rows })
  if (variant === 'grid') {
    return (
      <div className="adm-skel-gridwrap" aria-busy="true" aria-label="Loading">
        {items.map((_, i) => <SkelCardGrid key={i} i={i} />)}
      </div>
    )
  }
  if (variant === 'card') {
    return (
      <div className="adm-skel-cardwrap" aria-busy="true" aria-label="Loading">
        {items.map((_, i) => <SkelCard key={i} i={i} />)}
      </div>
    )
  }
  return (
    <div className="card adm-skel-listwrap" aria-busy="true" aria-label="Loading">
      {items.map((_, i) => <SkelRow key={i} i={i} />)}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   3.2 - AdminRow: a row that owns its OWN busy state, structurally.
   ─────────────────────────────────────────────────────────────────────────
   Fixes a real bug: several desks disabled every row's actions while ANY
   one row's mutation was in flight (a single desk-wide `actionLoading`
   guard). AdminRow takes `busy` per-instance and only pointer-events:none's
   its own `.adm-row-acts` slot - there is no prop or mechanism here that can
   reach a sibling row, so the global-freeze bug is structurally impossible
   to reintroduce through this component, not just avoided by convention.
   ═══════════════════════════════════════════════════════════════════════ */
export function AdminRow({
  busy, selected, onSelect, stamp, primary, secondary, meta, actions, expanded, onToggleExpand,
  className,
}: {
  busy?: boolean
  /**
   * One extra class on the row shell. Additive and optional, so every existing
   * caller is unchanged. It exists for row STATES a desk owns and the kit
   * cannot know about - the yearbook's skipped entries stepping back out of
   * the scan, PostModeration's "approving, undo below" window. It is never a
   * hook for a desk to re-style the shared row geometry.
   */
  className?: string
  selected?: boolean
  onSelect?: () => void
  /** Top-right slot - rotated, uses the `.stamp`/`StatusStamp` visual language. */
  stamp?: ReactNode
  /** Flat, legible, unrotated - display font, high contrast. */
  primary: ReactNode
  /** Mono, muted - a secondary line under `primary`. */
  secondary?: ReactNode
  /** Mono, muted - right-aligned meta (counts, dates). */
  meta?: ReactNode
  actions?: ReactNode
  /** Progressive disclosure - a long body/reason revealed on toggle. */
  expanded?: ReactNode
  onToggleExpand?: () => void
}) {
  return (
    <div className={'adm-row' + (selected ? ' is-selected' : '') + (className ? ' ' + className : '')} aria-busy={busy || undefined}>
      <div className="adm-row-main" style={busy ? { opacity: 0.55 } : undefined}>
        {onSelect && (
          /* 06.6.2: the hit target is the whole cell (38px wide x the 44px
             row), not the 18px box. The <label> is the hit area; the input
             keeps its own aria/accent-color semantics. */
          <label className="adm-checkcell">
            <input
              type="checkbox"
              className="adm-row-check"
              checked={!!selected}
              onChange={onSelect}
              aria-label="Select row"
            />
          </label>
        )}
        <div
          className="adm-row-body"
          onClick={onToggleExpand}
          role={onToggleExpand ? 'button' : undefined}
          tabIndex={onToggleExpand ? 0 : undefined}
          aria-expanded={onToggleExpand ? !!expanded : undefined}
          onKeyDown={onToggleExpand ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleExpand() } }) : undefined}
          style={onToggleExpand ? { cursor: 'pointer' } : undefined}
        >
          <div className="adm-row-primary">{primary}</div>
          {secondary && <div className="adm-row-secondary">{secondary}</div>}
        </div>
        {meta && <div className="adm-row-meta">{meta}</div>}
        {stamp && <div className="adm-row-stamp">{stamp}</div>}
        <div className="adm-row-acts" style={busy ? { pointerEvents: 'none' } : undefined}>
          {busy ? <span className="adm-row-spinner" aria-hidden /> : actions}
        </div>
      </div>
      {onToggleExpand && expanded && (
        <div className="adm-row-expand">{expanded}</div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   3.3 - useRowSelection: shift-click range select, clears on refetch.
   ═══════════════════════════════════════════════════════════════════════ */
export function useRowSelection<T extends { id: string }>(items: T[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const lastIndex = useRef<number | null>(null)
  const itemsRef = useRef(items)

  // Clear stale selection whenever the items array's IDENTITY changes (a new
  // fetch/refetch/route change gives a brand-new array reference) - this
  // deliberately does NOT compare ids, so a fresh fetch that happens to
  // return the same rows still clears, which is the safer default (a stale
  // "selected" id silently surviving a refetch is worse than an extra click).
  // itemsRef is synced here too (after render, not during) so `toggle`'s
  // closure always reads the latest list without a render-phase ref write.
  useEffect(() => {
    itemsRef.current = items
    setSelected(new Set())
    lastIndex.current = null
  }, [items])

  const toggle = useCallback((id: string, shiftKey?: boolean) => {
    const list = itemsRef.current
    const idx = list.findIndex(it => it.id === id)
    setSelected(prev => {
      const next = new Set(prev)
      if (shiftKey && lastIndex.current != null && idx !== -1) {
        const [lo, hi] = lastIndex.current < idx ? [lastIndex.current, idx] : [idx, lastIndex.current]
        const shouldSelect = !prev.has(id)
        for (let i = lo; i <= hi; i++) {
          const rowId = list[i]?.id
          if (!rowId) continue
          if (shouldSelect) next.add(rowId); else next.delete(rowId)
        }
      } else {
        if (next.has(id)) next.delete(id); else next.add(id)
      }
      return next
    })
    if (idx !== -1) lastIndex.current = idx
  }, [])

  const toggleAll = useCallback(() => {
    setSelected(prev => {
      const list = itemsRef.current
      if (prev.size === list.length && list.length > 0) return new Set()
      return new Set(list.map(it => it.id))
    })
  }, [])

  const clear = useCallback(() => { setSelected(new Set()); lastIndex.current = null }, [])
  const isSelected = useCallback((id: string) => selected.has(id), [selected])

  return {
    selected,
    toggle: (id: string) => toggle(id, (window.event as MouseEvent | undefined)?.shiftKey),
    toggleAll,
    clear,
    isSelected,
    allSelected: items.length > 0 && selected.size === items.length,
    someSelected: selected.size > 0 && selected.size < items.length,
    count: selected.size,
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   3.4 - useUndoableAction: optimistic mutation + toast-based undo window.
   ─────────────────────────────────────────────────────────────────────────
   This hook owns the TIMING (the window, the toast, the pending-set) - not
   the list. The caller is responsible for optimistically updating its own
   list state when `run()` is called and for reverting it if `undo()` fires;
   this just decides when the real network `action()` actually goes out.
   ═══════════════════════════════════════════════════════════════════════ */
export function useUndoableAction<T>({
  action, undo, label, windowMs = 5000,
}: {
  action: (item: T) => Promise<void>
  undo: (item: T) => Promise<void>
  label: (item: T) => string
  windowMs?: number
}) {
  const toast = useToast()
  const [pending, setPending] = useState<Set<string>>(new Set())
  // The settle fn is stored WITH its timer so unmount can run it rather than
  // only being able to throw it away - see the unmount effect below.
  const timers = useRef<Map<string, { timer: ReturnType<typeof setTimeout>; settle: () => Promise<void> }>>(new Map())

  const keyOf = (item: T): string => {
    const anyItem = item as any
    return anyItem?.id != null ? String(anyItem.id) : JSON.stringify(item)
  }

  const run = useCallback((item: T) => {
    const key = keyOf(item)
    setPending(prev => new Set(prev).add(key))

    const settle = async () => {
      timers.current.delete(key)
      try {
        await action(item)
      } catch {
        // `label(item)` reads like a success statement ("X approved") - it's
        // written for the pending/undo toast, not a failure. Reusing it
        // verbatim as the error detail read as "DIDN'T GO THROUGH. / X
        // approved" side by side, which looked like a contradiction rather
        // than an explanation of what failed.
        toast.error('approval didn’t go through - please retry.', label(item))
      } finally {
        setPending(prev => { const next = new Set(prev); next.delete(key); return next })
      }
    }

    const timer = setTimeout(settle, windowMs)
    timers.current.set(key, { timer, settle })

    toast.action(label(item), {
      label: 'Undo',
      onClick: async () => {
        const t = timers.current.get(key)
        if (t) { clearTimeout(t.timer); timers.current.delete(key) }
        setPending(prev => { const next = new Set(prev); next.delete(key); return next })
        try { await undo(item) } catch { toast.error('couldn’t undo that.') }
      },
    }, { duration: windowMs })
  }, [action, undo, label, windowMs, toast])

  /*
   * ON UNMOUNT: FLUSH ON THE REAL DESK, CANCEL ONLY INSIDE THE DEMO SANDBOX.
   *
   * Every `run()` parks the real write behind a `windowMs` timer so Undo can
   * cancel it. The question is what happens when the component goes away with
   * a timer still armed, and the two callers want opposite things:
   *
   *   - The DEMO must cancel. Its walkthrough completes a step the moment the
   *     undo toast appears, so a flow can be torn down mid-window - and
   *     teardown is exactly when `demoShadow` uninstalls. `settle` is async,
   *     so a flushed `await action(item)` would resume AFTER the synchronous
   *     cleanup chain and land on the real database, as the real signed-in
   *     member, from a walkthrough that promises it touches nothing.
   *
   *   - The REAL DESK must flush. This effect used to cancel unconditionally,
   *     and the comment here admitted the cost in as many words: "a moderator
   *     who approves someone and navigates away inside 5 seconds now loses
   *     that approval, having been told it happened." That is not a
   *     theoretical cost. It happened on 2026-09-12: a member was approved,
   *     the row left the queue, the toast said so, and `members` still read
   *     status='pending_approval' with a null `approved_at`. Silent data loss
   *     on the desk's single most consequential action.
   *
   * `isDemoShadowActive()` is a synchronous module-level flag, so it is exact
   * at cleanup time rather than a guess. Cancel when the sandbox is installed,
   * flush otherwise - both callers get what they need, and neither pays the
   * other's price.
   *
   * `settle` calls `setPending` after unmount; that is a no-op in React 18+,
   * not a warning. Its error toast still renders: the ToastProvider is
   * app-level and outlives the desk tab.
   */
  useEffect(() => {
    const map = timers.current
    return () => {
      const armed = [...map.values()]
      map.clear()
      const sandboxed = isDemoShadowActive()
      armed.forEach(({ timer, settle }) => {
        clearTimeout(timer)
        if (!sandboxed) void settle()
      })
    }
  }, [])

  return { run, pending }
}

/* ═══════════════════════════════════════════════════════════════════════
   4.1 - useIsPhone / BottomSheet / AdminRowActions (Part 4 markup support)
   ─────────────────────────────────────────────────────────────────────────
   The phone rule "row actions collapse into a single ⋯ opening a bottom
   sheet" can't be done in CSS alone - the sheet needs state and a portal.
   These three are the markup half of the responsive system; the CSS half
   lives under "PART 4" in styles/routes/director.css.
   ═══════════════════════════════════════════════════════════════════════ */

/** True at the phone breakpoint (≤600px) - the same value the CSS uses. */
export function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 600px)').matches,
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 600px)')
    const onChange = () => setIsPhone(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return isPhone
}

/**
 * BottomSheet - a full-screen sheet on phones (sticky header, scrolling body,
 * safe-area-aware footer padding via CSS) and a centred card above that.
 * Escape closes; clicking the scrim closes.
 */
export function BottomSheet({
  open, onClose, title, children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const sheetRef = useRef<HTMLDivElement>(null)
  useModalA11y(open, sheetRef, onClose)
  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <div className="adm-sheet-back" role="presentation" onClick={onClose}>
      <div ref={sheetRef} tabIndex={-1} className="adm-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="adm-sheet-head">
          <span>{title}</span>
          <button type="button" className="adm-sheet-close" onClick={onClose} aria-label="Close" title="Close">
            <XMarkIcon width={20} height={20} strokeWidth={2.2} aria-hidden />
          </button>
        </div>
        <div className="adm-sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * AdminRowActions - an inline action cluster on tablet/desktop that becomes a
 * single 44×44 `⋯` button opening a `BottomSheet` on phones, instead of a
 * shrunken inline cluster nobody can hit. Pass the SAME children either way;
 * the sheet copy is `sheetTitle`.
 *
 * Queue verdicts (approve/reject) deliberately do NOT go through this - see
 * `.adm-verdicts` in director.css, which keeps them inline, full-width and
 * stacked on phones because that's the entire job of a triage desk.
 */
export function AdminRowActions({
  sheetTitle, children,
}: {
  sheetTitle: string
  children: ReactNode
}) {
  const isPhone = useIsPhone()
  const [open, setOpen] = useState(false)
  return (
    <div className={'adm-rowacts' + (isPhone ? ' has-sheet' : '')}>
      {children}
      <button type="button" className="adm-more" onClick={() => setOpen(true)} aria-label={`Actions for ${sheetTitle}`} aria-haspopup="dialog">
        <EllipsisHorizontalIcon width={22} height={22} strokeWidth={2.2} aria-hidden />
      </button>
      {isPhone && (
        <BottomSheet open={open} onClose={() => setOpen(false)} title={sheetTitle}>
          <div onClick={() => setOpen(false)} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
        </BottomSheet>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   3.5 - AdminErrorState: torn-edge note + retry, for a failed desk fetch.
   ═══════════════════════════════════════════════════════════════════════ */
export function AdminErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  // The torn-paper seams above/below the body are DELETED (06.4.2 removes
  // `.torn-divider` product-wide after grepping for callers - this and
  // DirectorLanding's landing were the only two, and both are in scope
  // here). The card's own hairline edge is enough of a boundary.
  return (
    <div className="adm-error">
      <div className="adm-error-body">
        <span className="adm-error-icon" aria-hidden>
          <ExclamationCircleIcon width={20} height={20} strokeWidth={1.8} />
        </span>
        <p className="adm-error-msg">{message}</p>
        <button type="button" className="btn btn-sm adm-error-retry" onClick={onRetry}>Retry</button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Dialog a11y — re-export of the app-wide hook.
   ═══════════════════════════════════════════════════════════════════════ */

// The implementation moved to hooks/useDialog.ts, which is now the app's ONE
// dialog-a11y core — the desk's version and the (previously absent) handling on
// the public/member modals had drifted apart, and the desk's was missing the
// body scroll-lock. Imported at the top of this file (BottomSheet now calls it
// directly) and re-exported here so the five director call sites keep
// importing it from adminKit, unchanged.
export { useModalA11y, MODAL_FOCUSABLE }
