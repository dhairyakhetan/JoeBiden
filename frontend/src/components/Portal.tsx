import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

/**
 * Render children at the end of <body>. Use it for any full-screen overlay (`position: fixed; inset: 0`) that is mounted
 * inside page content: a fixed element inside an ancestor with a transform, filter or will-change is positioned against that
 * ancestor, not the screen, so the overlay covers one card and the dialog lands beside it.
 */
export default function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body)
}
