import { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { XMarkIcon } from '@heroicons/react/24/outline'
import useDialog from '../hooks/useDialog'

/**
 * Shared modal.
 *
 * REDESIGN 2026-09: this component was written against Tailwind, which the app
 * no longer loads (Tailwind moved to paradox/tailwind.css, imported only by the
 * lazy ParadoxRoot; main.tsx loads tokens/v6/index). Every layout-critical
 * class here resolved to nothing - `fixed inset-0 z-50`, `bg-black/50`,
 * `flex min-h-full items-center justify-center`, `max-w-md`, `rounded-2xl`,
 * `max-h-[85vh]`, `h-11 w-11`. The modal therefore had no fixed positioning,
 * no scrim, no centring, no width cap and no 44px close target, on two live
 * member-facing surfaces (teams/CreateTeamPostModal, teams/JoinRequestModal).
 *
 * It now uses the .aqm-* classes in styles/v6.css. The public API is unchanged
 * so no call site needed editing.
 */

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  fullScreenMobile?: boolean
}

const Modal = ({ isOpen, onClose, title, children, size = 'md', fullScreenMobile = false }: ModalProps) => {
  // Escape, Tab trap, focus restore and body scroll-lock all come from the
  // shared hook. This component's own copy was correct but was one of three
  // parallel implementations; the one difference worth noting is that it reset
  // `body.overflow` to the literal 'unset' on close rather than to its previous
  // value, which unlocked the page early when a dialog opened over another one.
  const panelRef = useDialog(isOpen, onClose)

  if (!isOpen) return null

  const fs = fullScreenMobile ? ' is-fullscreen' : ''

  return createPortal(
    <div className="aqm-back">
      {/* Scrim. Its own element rather than a background on .aqm-back, so a
          click on the padding around the panel also closes. */}
      <div className="aqm-scrim" onClick={onClose} />

      <div className={'aqm-wrap' + fs}>
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          className={`aqm-panel aqm-${size}${fs}`}
          onClick={e => e.stopPropagation()}
        >
          {/* Header. Always renders the close control, even with no title:
              JoinRequestModal passes `title=''` once its form is submitted (so
              the success state reads as unlabeled), which used to make the
              header - and with it the only visible close affordance -
              disappear at exactly the moment a user wants to close the dialog.
              `title` now only controls whether a heading also appears. */}
          <div className={'aqm-head' + (title ? ' has-title' : '')}>
            {title && <h3 className="aqm-title">{title}</h3>}
            <button onClick={onClose} aria-label="Close" className="aqm-close" type="button" title="Close">
              <XMarkIcon width={20} height={20} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          <div className="aqm-body">{children}</div>
        </div>
      </div>
    </div>,
    document.body
  )
}

interface ModalFooterProps {
  children: ReactNode
  className?: string
}

Modal.Footer = ({ children, className = '' }: ModalFooterProps) => (
  <div className={('aqm-foot ' + className).trim()}>{children}</div>
)

export default Modal
