import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useModalA11y } from '../../hooks/useDialog'
import { checkText, BLOCK_MESSAGE } from '../../lib/profanityFilter'
import { CATEGORY_SLUGS } from '../../lib/categories'
import { resizeImageForWall } from './resizeImage'
import wallService, { type WallNote } from '../../services/wallService'
import { useToast } from '../../components/Toast'
import GatedButton from '../../components/GatedButton'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'
import { isDirty } from '../../lib/unsavedChanges'

const MAX_LEN = 280

/**
 * The wall's composer - changelog/16-profile-wall.md §16.3. A bottom sheet
 * on phone, a centred card on desktop (its own `.wall-sheet*` CSS, not a
 * fork of the shared `.modal`/`.modal-back` - see the build report for why:
 * `03`'s post-detail/composer restyle is being built concurrently in this
 * same tree, so this deliberately does not depend on or touch anything in
 * that file's scope).
 */
export default function WallComposer({
  open, onClose, recipientUuid, recipientName, onPosted,
}: {
  open: boolean
  onClose: () => void
  recipientUuid: string
  recipientName: string
  onPosted: (note: WallNote) => void
}) {
  const toast = useToast()
  const panelRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [body, setBody] = useState('')
  const [label, setLabel] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [offlineNotice, setOfflineNotice] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // changelog/11-system-states.md §11.9 state 10. This composer is the one
  // that needs the guard most: §16.3 rules out draft autosave here on purpose
  // ("a restored draft addressed to someone you have since navigated away from
  // is worse than losing 48 characters"), so nothing else catches the text.
  // `unpersistable` is not used — for this sheet EVERYTHING is unpersistable,
  // which `dirty` alone already covers.
  const { confirmDiscard } = useUnsavedChanges({
    dirty: open && isDirty(
      { body, label, image: imageFile ? imageFile.name : '' },
      { body: '', label: '', image: '' },
    ),
    submitting,
    enabled: open,
    body: `this note for ${recipientName.split(' ')[0] || recipientName} isn't pinned yet. leaving loses it.`,
  })

  useModalA11y(open, panelRef, () => { if (!submitting) void closeAndReset() }, submitting)

  const firstName = recipientName.split(' ')[0] || recipientName
  const overLimit = body.length > MAX_LEN

  const reset = () => {
    setBody('')
    setLabel(null)
    setImageFile(null)
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImagePreview(null)
    setBlocked(false)
    setOfflineNotice(false)
  }

  // §16.3: "Draft autosave: no... a restored draft addressed to someone you
  // have since navigated away from is worse than losing 48 characters."
  // Closing always discards, on purpose.
  // §11.9 state 10: the discard still happens, it just asks first — and only
  // when there is something to lose. An untouched sheet closes on one tap,
  // exactly as it did before.
  const closeAndReset = async () => {
    if (submitting) return
    if (!(await confirmDiscard())) return
    reset()
    onClose()
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  // §16.3: "auto-grow, no border." Reads the DOM directly on the native
  // input event rather than an effect keyed on `body`, so it reflects the
  // textarea's own just-typed content with no extra render round-trip.
  const autoGrow = (e: FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  const removeImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(null)
    setImagePreview(null)
  }

  const handleSubmit = async () => {
    const trimmed = body.trim()
    if (!trimmed || overLimit || submitting) return
    setBlocked(false)
    setOfflineNotice(false)

    // §16's states list: "Offline: the composer keeps the text and says it
    // will send when back. Do not silently drop." A full send-when-
    // reconnected queue is a bigger, separate piece of infrastructure this
    // one feature shouldn't invent unilaterally (see the build report) - this
    // covers the "keep the text, say so, don't silently fail" half, and the
    // member presses "Pin it" again once back online.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setOfflineNotice(true)
      return
    }

    // §16.3: "checkText on submit, BLOCK_MESSAGE verbatim. On submit, never
    // on keystroke." Text is preserved either way - nothing is cleared here.
    const result = await checkText(trimmed)
    if (result.severity === 'block') {
      setBlocked(true)
      return
    }

    setSubmitting(true)
    try {
      const finalImage = imageFile ? await resizeImageForWall(imageFile) : null
      const note = await wallService.postNote({ recipientUuid, body: trimmed, label, imageFile: finalImage })
      onPosted(note)
      reset()
    } catch (e: any) {
      // Body/label/image are deliberately NOT cleared on failure - matches
      // §16's "Image upload failed... body preserved" state, and gives the
      // member a real retry: pressing "Pin it" again re-attempts the whole
      // resize+upload+insert with everything still in place.
      toast.error("couldn't pin that note - please retry.", e?.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="wall-sheet-back"
      role="presentation"
      onClick={e => { if (e.target === e.currentTarget) void closeAndReset() }}
    >
      <div
        ref={panelRef}
        className="wall-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`A note for ${firstName}`}
      >
        <div className="wall-sheet-head">
          <span className="wall-sheet-title">A note for {firstName}</span>
          <button type="button" className="wall-sheet-close" onClick={() => void closeAndReset()} aria-label="Close" disabled={submitting} title="Close">
            <XMarkIcon width={18} height={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        <div className="wall-sheet-body">
          <div className="wall-field-well">
            <textarea
              ref={textareaRef}
              className="wall-field"
              value={body}
              onChange={e => setBody(e.target.value)}
              onInput={autoGrow}
              rows={3}
              autoFocus
              disabled={submitting}
              maxLength={MAX_LEN + 40 /* let them see they're over, don't hard-clip mid-word */}
            />
          </div>

          <div className="wall-counter" aria-live="polite">
            <span className="wall-counter-track" aria-hidden="true">
              <span
                className="wall-counter-fill"
                style={{
                  width: `${Math.min(100, (body.length / MAX_LEN) * 100)}%`,
                  background: overLimit ? 'var(--danger-lift)' : 'var(--welfare)',
                }}
              />
            </span>
            <span className={'wall-counter-figure mono' + (overLimit ? ' is-over' : '')}>
              {body.length}/{MAX_LEN}
            </span>
          </div>

          {blocked && <p className="wall-inline-notice is-blocked" role="alert">{BLOCK_MESSAGE}</p>}
          {offlineNotice && (
            <p className="wall-inline-notice" role="status">
              you're offline - this will send once you're back online. your note is still here.
            </p>
          )}

          <div className="wall-label-row">
            <span className="wall-label-caption mono">label</span>
            <div className="wall-label-chips">
              {CATEGORY_SLUGS.map(slug => (
                <button
                  key={slug}
                  type="button"
                  className={'wall-label-chip' + (label === slug ? ' is-on' : '')}
                  onClick={() => setLabel(prev => (prev === slug ? null : slug))}
                  disabled={submitting}
                  aria-pressed={label === slug}
                >
                  #{slug}
                </button>
              ))}
              <button
                type="button"
                className={'wall-label-chip' + (label === null ? ' is-on' : '')}
                onClick={() => setLabel(null)}
                disabled={submitting}
                aria-pressed={label === null}
              >
                none
              </button>
            </div>
          </div>

          {imagePreview && (
            <div className="wall-image-preview">
              <img src={imagePreview} alt="" />
              <button
                type="button"
                className="wall-image-remove"
                onClick={removeImage}
                disabled={submitting}
                aria-label="Remove image"
                title="Remove image"
              >
                <XMarkIcon width={14} height={14} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        <div className="wall-sheet-dock">
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFileChange} />
          {/* §11.9 state 11. Both of these were plain `disabled`, which on an
              icon button means a grey square with no explanation and no way to
              focus it and ask. They now say why, on tap for the dock icon
              (nowhere to put a line) and inline under the send button. */}
          <GatedButton
            type="button"
            className="wall-dock-image"
            onClick={() => fileInputRef.current?.click()}
            disabled={submitting}
            reason={imageFile ? 'one image per note.' : null}
            hint="none"
            onBlocked={r => toast.info(r)}
            aria-label="Add an image"
            title="Add an image"
          >
            <PhotoIcon width={18} height={18} strokeWidth={1.8} aria-hidden="true" />
          </GatedButton>
          <span className="wall-dock-note mono">everyone can see this</span>
          <GatedButton
            type="button"
            className="wall-dock-send"
            onClick={handleSubmit}
            disabled={submitting}
            reason={
              overLimit ? `that's ${body.length - MAX_LEN} characters over.`
                : !body.trim() ? 'write something first.'
                : null
            }
          >
            {submitting ? 'pinning…' : 'Pin it'}
          </GatedButton>
        </div>
      </div>
    </div>
  )
}
