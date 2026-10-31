import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from './Toast'
import { receiptService } from '../services/receiptService'
import {
  buildReceiptRows,
  formatStatus,
  markReceiptPrinted,
  receiptReference,
  receiptSignoff,
  receiptStamp,
  type ReceiptRow,
  type ReceiptSource,
} from '../lib/receiptRecord'
import { APPROVAL_SENTENCE, PLACE_AND_YEAR } from '../lib/orgFacts'
import './SignInReceipt.css'

/**
 * The first sign-in receipt. Section 12, design reference AQ Receipt.dc.html
 * cards R1 and R2.
 *
 * A dot-matrix printer feeds a slip carrying the member's own record, one row
 * at a time, and an HoD stamp thunks onto it. It fires ONCE, on the first
 * authenticated render after a member row is created, and never again.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * IT IS A PROVENANCE DOCUMENT, WHICH IS THE WHOLE POINT.
 *
 * Every row names where its value came from, in `ReceiptRow.source`, rendered
 * as the row's `title` and reachable to a screen reader through the row's
 * description. A row whose value could not be sourced renders the dashed
 * `live` marker, never a placeholder and never a plausible number. `1,247`
 * entered this project as an invented member number ON THIS SCREEN and spread
 * to seven places as a fake member count; the canonical public headcount is
 * displayCount(ORG_FACTS.membersTotal) (lib/orgFacts.ts), and a member number is not a count.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * MOTION. Every delay is an `animation-delay` on one element. No JS timers, no
 * animation library, so a skip is removing one class: `.done` sets
 * `animation: none; opacity: 1` on every animated part.
 *
 * The reduced-motion block ships in the SAME file as the `opacity: 0` rules
 * and is the reason this component is not blank for a member who has motion
 * turned off. Seventeen elements are authored transparent. Never add an
 * `opacity: 0` here without adding it to the reduce block.
 *
 * The whole cue sheet is 2.6s and tapping anywhere ends it. It is a moment,
 * not a gate.
 */

type LoadState = 'loading' | 'ready' | 'empty' | 'error'

export interface SignInReceiptProps {
  /**
   * Called when the member leaves the receipt, whichever way. The mounting
   * surface owns what happens next (the spec's next step is the feed).
   */
  onDone: () => void
  /** Label for the primary action. The canvas reads "see what's happening →". */
  primaryLabel?: string
}

export default function SignInReceipt({ onDone, primaryLabel = "see what's happening →" }: SignInReceiptProps) {
  const toast = useToast()
  const stageRef = useRef<HTMLDivElement | null>(null)

  const [state, setState] = useState<LoadState>('loading')
  const [record, setRecord] = useState<(ReceiptSource & { uuid: string }) | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const own = await receiptService.getOwnRecord()
        if (cancelled) return
        if (!own) { setState('empty'); return }
        // The desk row is a soft read: a pending member cannot see
        // team_members at all, and a new member has no team either way.
        const deskName = await receiptService.getPrimaryDeskName(own.member_id)
        if (cancelled) return
        setRecord({ ...own, deskName })
        setState('ready')
        // The once-only flag is written as soon as the record renders, not on
        // dismissal: a member who closes the tab mid-print has still seen it,
        // and reprinting on the next sign-in is exactly what the spec forbids.
        if (own.uuid) markReceiptPrinted(own.uuid)
      } catch {
        if (!cancelled) setState('error')
      }
    })()
    return () => { cancelled = true }
  }, [])

  const rows = useMemo<ReceiptRow[]>(() => (record ? buildReceiptRows(record) : []), [record])
  const reference = useMemo(() => receiptReference(record?.member_no ?? null), [record])
  const signoff = useMemo(() => receiptSignoff(record?.member_no ?? null), [record])
  const stamp = useMemo(() => receiptStamp(record?.status ?? null), [record])
  const status = useMemo(() => formatStatus(record?.status ?? null), [record])

  /** Tapping anywhere on the stage jumps to the end state. */
  const skip = useCallback(() => setDone(true), [])

  const copyRecord = useCallback(async () => {
    if (!record) return
    const text = [
      'AQUATERRA',
      PLACE_AND_YEAR,
      '',
      ...rows.map(r => `${r.key}: ${r.value ?? 'not recorded'}`),
      reference ?? '',
    ].filter(Boolean).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied your record.')
    } catch {
      toast.error('Could not copy.', 'Your browser blocked clipboard access. The slip is selectable text, so you can select it by hand.')
    }
  }, [record, rows, reference, toast])

  if (state === 'loading') {
    return (
      <div className="aq-receipt-shell" aria-busy="true">
        <p className="aq-receipt-status">printing your record…</p>
      </div>
    )
  }

  if (state === 'error' || state === 'empty') {
    return (
      <div className="aq-receipt-shell" role="alert">
        <p className="aq-receipt-status">
          {state === 'error'
            ? 'We could not print your record just now.'
            : 'Your record is still being created.'}
        </p>
        <button type="button" className="aq-receipt-btn aq-receipt-btn-primary" onClick={onDone}>
          {primaryLabel}
        </button>
      </div>
    )
  }

  return (
    <div className="aq-receipt-shell">
      <div
        ref={stageRef}
        className={`aq-receipt${done ? ' done' : ''}`}
        onClick={skip}
        role="group"
        aria-label="your member record, printing"
      >
        <div className="aq-receipt-led" aria-hidden="true">
          <span className="aq-receipt-led-dot" />
          <span className="aq-receipt-led-label">record written</span>
        </div>

        {/* The printer housing. It rattles while the sheet feeds. */}
        <div className="aq-receipt-housing-wrap">
          <div className="aq-receipt-housing" aria-hidden="true">
            <span className="aq-receipt-slot" />
            <span className="aq-receipt-brand">aquaterra</span>
          </div>
        </div>

        {/* The slip. Real selectable text, never an image, so a member can
            copy their member number straight off it. */}
        <div className="aq-receipt-feed">
          <div className="aq-receipt-sheet">
            <div className="ln aq-receipt-masthead" style={{ animationDelay: '.35s' }}>
              <div className="aq-receipt-wordmark">AQUATERRA</div>
              <div className="aq-receipt-place">{PLACE_AND_YEAR}</div>
            </div>

            <div className="ln aq-receipt-rule" style={{ animationDelay: '.5s' }} />
            <div className="ln aq-receipt-caption" style={{ animationDelay: '.62s' }}>member record</div>

            <dl className="aq-receipt-rows">
              {rows.map((row, i) => (
                <div
                  key={row.key}
                  className="ln aq-receipt-row"
                  style={{ animationDelay: `${0.78 + i * 0.12}s` }}
                  title={`source: ${row.source}`}
                >
                  <dt className="aq-receipt-key">{row.key}</dt>
                  <dd className={`aq-receipt-val${row.strong ? ' is-strong' : ''}`}>
                    {row.value !== null ? (
                      row.value
                    ) : (
                      /* Rule 4: never render a figure with no source. The
                         dashed marker says the value is read at render and
                         was not there, which is information. A placeholder
                         would be a claim. */
                      <span className="aq-live aq-live--sm" title={`source: ${row.source}`}>
                        live
                        <span className="sr-only"> value not recorded yet</span>
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="ln aq-receipt-rule" style={{ animationDelay: `${0.78 + rows.length * 0.12}s` }} />

            <div className="aq-receipt-verdict">
              <div className="ln" style={{ animationDelay: `${0.9 + rows.length * 0.12}s` }}>
                <div className="aq-receipt-key">status</div>
                <div className="aq-receipt-statusword">
                  {status ?? <span className="aq-live aq-live--sm">live</span>}
                </div>
                <p className="aq-receipt-sla">{APPROVAL_SENTENCE}</p>
              </div>
              {stamp && (
                <span className="stamp aq-receipt-stamp" style={{ animationDelay: '2.1s' }}>{stamp}</span>
              )}
            </div>

            {reference && (
              <div className="ln aq-receipt-ref" style={{ animationDelay: '2.3s' }}>{reference}</div>
            )}
            {signoff && (
              <div className="ln aq-receipt-signoff" style={{ animationDelay: '2.42s' }}>{signoff}</div>
            )}

            <div className="aq-receipt-tearpad" />
            {/* The perforation is a repeating radial-gradient, not an image. */}
            <div className="aq-receipt-perf" aria-hidden="true" />
          </div>
        </div>

        <div className="rise aq-receipt-actions" style={{ animationDelay: '2.6s' }}>
          <button
            type="button"
            className="aq-receipt-btn aq-receipt-btn-primary"
            onClick={e => { e.stopPropagation(); onDone() }}
          >
            {primaryLabel}
          </button>
          <button
            type="button"
            className="aq-receipt-btn aq-receipt-btn-ghost"
            onClick={e => { e.stopPropagation(); void copyRecord() }}
          >
            copy my record
          </button>
        </div>
      </div>
    </div>
  )
}
