import Img from '../../components/Img'
import { getInitials, hashColor, timeAgo } from '../../lib/uiHelpers'
import { noteTintBackground, labelOnLeft, pillRotation, isLongBody, bodyFontSize } from './wallShape'
import type { WallNote as WallNoteData } from '../../services/wallService'

/**
 * One pin on the wall board (16.1). Every rule here exists because an
 * earlier draft broke it once:
 *   - the note itself is `display:flex; flex-direction:column` and NEVER
 *     `position:relative` with absolutely-positioned children - the hash
 *     pill is a static first child, sized by its own text, overhanging via
 *     negative margins only.
 *   - an image note is a white card, never tinted.
 *   - the body is never rotated - only the label pill (chrome) rotates.
 */
export default function WallNote({
  note, canRemove, onRemove, removing,
}: {
  note: WallNoteData
  canRemove: boolean
  onRemove: (id: string) => void
  /** true while this note is inside its own undo window - dims it in place
   *  rather than letting it vanish with nothing left where it was. */
  removing?: boolean
}) {
  const hasImage = !!note.imageUrl
  const long = isLongBody(note.body)
  const size = bodyFontSize(note.id, note.body)
  const onLeft = labelOnLeft(note.id)

  return (
    <div
      className={'wall-note' + (hasImage ? ' has-image' : '') + (removing ? ' is-removing' : '')}
      style={!hasImage ? { background: noteTintBackground(note.id) } : undefined}
    >
      {/* The hash pill - a STATIC first child. See the file comment above
          and changelog/16-profile-wall.md §16.1 for why this can never
          become `position: absolute`. */}
      {!hasImage && note.label && (
        <span
          className={'wall-label' + (onLeft ? ' is-left' : ' is-right')}
          style={{ ['--rot' as any]: `${pillRotation(note.id)}deg` }}
        >
          #{note.label}
        </span>
      )}

      {hasImage && (
        <div className="wall-note-image">
          <Img src={note.imageUrl} alt="" ctx="card" />
        </div>
      )}

      <p className={'wall-note-body' + (long ? ' is-long' : '')} style={{ fontSize: size }}>
        {note.body}
      </p>

      {/* Every note carries the author's avatar, name, and the note's OWN
          age (a relative timestamp) - NOT the author's personal age. The
          codebase has an explicit, deliberate rule that member age is never
          computed or shown anywhere (see members.birthday_public's own
          comment); reading 16.1's "avatar, name and age" as a literal
          member age would contradict that, so this renders timeAgo()
          instead - recency is also the thing 16.1 says CSS-column reordering
          needs to stay legible for. */}
      <div className="wall-note-foot">
        <span className="wall-note-avatar" aria-hidden="true" style={{ background: hashColor(note.authorName) }}>
          {note.authorAvatarUrl
            ? <Img src={note.authorAvatarUrl} alt="" ctx="avatar" referrerPolicy="no-referrer" />
            : getInitials(note.authorName)}
        </span>
        <span className="wall-note-author">{note.authorName}</span>
        <span className="wall-note-age mono">{timeAgo(note.createdAt)}</span>
        {canRemove && !removing && (
          <button
            type="button"
            className="wall-note-remove"
            onClick={() => onRemove(note.id)}
            aria-label="Remove this note"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}
