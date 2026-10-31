import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { EVENT } from '../config'
import type { PublicEvent } from '../lib/types'
import { GENERAL_RULES } from '../lib/generalRules'
import { Markdown } from './Markdown'

/**
 * The event rules, over the form rather than instead of it.
 *
 * "event rules" in the consent line used to be a link to /terrathon/rules with
 * target="_blank". That was chosen so reading them never cost a half-filled
 * form, and it did work, but it is still a second tab to find your way back
 * from on a phone, for a document most people want to skim for ten seconds.
 * This keeps the form on screen underneath.
 *
 * It is a real <dialog> opened with showModal(), not a div with a high
 * z-index. That buys, from the browser, the things a hand-rolled overlay
 * nearly always gets wrong: Esc closes it, focus is trapped inside while it is
 * open and restored to the trigger when it shuts, and everything behind it is
 * inert to both the pointer and a screen reader.
 *
 * The full page still exists and is still linked from in here, because it is
 * what a shared link needs to point at.
 */
interface Props {
  open: boolean
  onClose: () => void
  /** The sport being signed up for, if one is chosen. Its `rules_md` is shown
   *  under the general rules. */
  event?: PublicEvent
}

export function RulesDialog({ open, onClose, event }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // showModal() throws if it is already open, and close() on an already
    // closed dialog fires a spurious `close` event, so both are guarded.
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  // The backdrop is part of the dialog element, so a click lands on the
  // <dialog> itself rather than on any child. Comparing the target to the
  // element is what tells the two apart.
  const onBackdrop = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === ref.current) onClose()
  }

  // Esc is meant to come free with showModal(), and for a real visitor it
  // does. It is backstopped here anyway because it could not be verified:
  // Chrome routes Esc through CloseWatcher, which only runs for keys that
  // arrive through the browser's own input pipeline, so a key injected by
  // automation reaches the dialog as a trusted keydown, is not prevented by
  // anything, and still fires neither `cancel` nor `close`. That is a real
  // blind spot in the test, not evidence of a bug, but "the spec says so"
  // is not the same as having seen it work, and this costs three lines.
  // If the native path does fire, this is a no-op: both routes end at the
  // same setState, and the effect above only calls close() on an open dialog.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === 'Escape') onClose()
  }

  return (
    <dialog ref={ref} className="tt-dialog" onClose={onClose} onClick={onBackdrop} onKeyDown={onKeyDown} aria-labelledby="tt-rules-h">
      <div className="tt-dialog__head">
        <h2 id="tt-rules-h">Event rules</h2>
        <button type="button" className="tt-dialog__x" onClick={onClose} aria-label="Close the rules" title="Close the rules">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="tt-dialog__body">
        <p className="tt-dialog__kicker">Applies to everyone</p>
        <ul className="tt-dialog__list">
          {GENERAL_RULES.map((r) => (
            <li key={r.rest}>
              {r.strong && <strong>{r.strong}</strong>}{r.rest}
            </li>
          ))}
        </ul>

        {event?.rules_md && (
          <>
            <p className="tt-dialog__kicker">{event.display_name}</p>
            <Markdown source={event.rules_md} />
          </>
        )}
      </div>

      <div className="tt-dialog__foot">
        <Link
          to={event ? `${EVENT.base}/rules#${event.slug}` : `${EVENT.base}/rules`}
          target="_blank"
          rel="noreferrer noopener"
          className="tt-btn tt-btn--quiet"
        >
          Open the full page
        </Link>
        <button type="button" className="tt-btn" onClick={onClose}>Got it</button>
      </div>
    </dialog>
  )
}
