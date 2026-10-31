import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import '../styles/lightbox.css'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useModalA11y } from '../hooks/useDialog'

interface ImageLightboxProps {
  /**
   * When truthy, the lightbox opens. Pass `null` to dismiss - the
   * component stays mounted and AnimatePresence plays the exit
   * animation before unmounting the inner overlay.
   */
  src: string | null
  alt?: string
  /** Optional visible caption shown under the image (e.g. "photo 2 of 4"). */
  caption?: string
  onClose: () => void
}

export default function ImageLightbox({ src, alt, caption, onClose }: ImageLightboxProps) {
  // Keep the last non-null src around so the exit animation has
  // something to render (otherwise we'd flash to a blank img).
  const [lastSrc, setLastSrc] = useState<string | null>(src)
  const [lastCaption, setLastCaption] = useState<string | undefined>(caption)
  const dialogRef = useRef<HTMLDivElement>(null)
  const shouldReduceMotion = useReducedMotion()
  // Adjusted during render (same prevBase technique as components/Img.tsx)
  // instead of an effect, so a new src/caption lands in the same render.
  const [prevSrc, setPrevSrc] = useState(src)
  const [prevCaption, setPrevCaption] = useState(caption)
  if (src !== prevSrc || caption !== prevCaption) {
    setPrevSrc(src)
    setPrevCaption(caption)
    if (src) { setLastSrc(src); setLastCaption(caption) }
  }

  // Escape, focus restore and scroll-lock were already here; the Tab trap was
  // not, so Tab walked from the lightbox onto the page hidden behind it.
  useModalA11y(!!src, dialogRef, onClose)

  const scaleAnim = shouldReduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.98 } }

  return createPortal(
    <AnimatePresence>
      {src && (
        <motion.div
          className="aq-lightbox-overlay"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={alt || 'Image preview'}
          ref={dialogRef}
          tabIndex={-1}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        >
          <motion.img
            src={lastSrc ?? src}
            alt={alt || ''}
            className="aq-lightbox-img"
            onClick={e => e.stopPropagation()}
            draggable={false}
            initial={scaleAnim.initial}
            animate={scaleAnim.animate}
            exit={scaleAnim.exit}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
          />
          {(caption || lastCaption) && (
            <motion.p
              className="aq-lightbox-caption"
              onClick={e => e.stopPropagation()}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            >
              {caption ?? lastCaption}
            </motion.p>
          )}
          <button
            className="aq-lightbox-close"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
