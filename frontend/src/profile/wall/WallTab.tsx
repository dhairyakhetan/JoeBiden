import { useEffect, useRef, useState } from 'react'
import wallService, { type WallNote as WallNoteData } from '../../services/wallService'
import WallNote from './WallNote'
import WallComposer from './WallComposer'
import { useToast } from '../../components/Toast'
import { Mascot } from '../../components/Mascot'

const UNDO_WINDOW_MS = 5000

/**
 * The wall tab's content - changelog/16-profile-wall.md §16.1-16.3, §16.5.
 * Fully controlled: `notes`/`wallEnabled` are owned by the profile page
 * (fetched once alongside its other tab counts, same pattern as
 * achievements/posts/tagged already use there) so the tab's own count label
 * stays in sync with every local mutation via the on*Change callbacks,
 * without a second, redundant fetch of the same data.
 */
export default function WallTab({
  recipientUuid, recipientName, isOwn, currentMemberUuid, notes, wallEnabled, loading,
  onNotesChange, onWallEnabledChange,
}: {
  recipientUuid: string
  recipientName: string
  isOwn: boolean
  /** The current member's own uuid, for the "author removing their own note
   *  on someone else's wall" case (RLS: recipient OR author may soft-delete).
   *  Undefined when signed out. */
  currentMemberUuid?: string
  notes: WallNoteData[]
  wallEnabled: boolean
  loading: boolean
  onNotesChange: (notes: WallNoteData[]) => void
  onWallEnabledChange: (enabled: boolean) => void
}) {
  const toast = useToast()
  const [composerOpen, setComposerOpen] = useState(false)
  const [togglingWall, setTogglingWall] = useState(false)
  // Optimistic-remove-with-undo, hand-rolled here rather than importing
  // director/adminKit.tsx's useUndoableAction: that hook is HoD-desk chrome
  // (a different visual/behavioural system per CLAUDE.md), and importing
  // across that boundary risked a real collision with the desk-shell rebuild
  // running concurrently in this same tree. Same mechanism, independent code.
  const [removing, setRemoving] = useState<Map<string, WallNoteData>>(new Map())
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  // The latest `notes` for the deferred commit below to filter against -
  // the timeout fires up to 5s after handleRemove closed over its own
  // snapshot, by which time a post/undo may have changed the list.
  const notesRef = useRef(notes)
  notesRef.current = notes

  useEffect(() => () => {
    // Unmounting mid-undo-window: let the pending removals actually reach
    // the server rather than silently cancelling them. clearTimeout alone
    // WAS the silent cancel this comment warned about - navigating away (or
    // switching tab, which unmounts this component) inside the 5s window
    // left `deleted_at` unset, so a note the recipient believed removed came
    // straight back on reload. Fire each outstanding removal before
    // clearing. `handleUndo` deletes its timer from the map first, so a real
    // undo is never in here.
    const pending = timers.current
    pending.forEach((t, id) => {
      clearTimeout(t)
      // Fire-and-forget: the component is going away, there is nobody left
      // to toast at. A failure leaves the note in place, which is the
      // pre-removal state.
      void wallService.removeNote(id).catch(() => {})
    })
    pending.clear()
  }, [])

  const handlePosted = (note: WallNoteData) => {
    onNotesChange([note, ...notes])
    setComposerOpen(false)
    toast.success('pinned to the wall.')
  }

  const handleRemove = (id: string) => {
    const note = notes.find(n => n.id === id)
    if (!note) return
    // The note STAYS in the list, dimmed in place (WallNote's `removing`
    // prop) rather than vanishing and leaving a hole the undo banner has to
    // explain. It only leaves the list once the write actually lands.
    setRemoving(prev => new Map(prev).set(id, note))

    const timer = setTimeout(async () => {
      timers.current.delete(id)
      try {
        await wallService.removeNote(id)
        onNotesChange(notesRef.current.filter(n => n.id !== id))
      } catch (e: any) {
        toast.error("couldn't remove that note - please retry.", e?.message)
        // Nothing to put back - the note never left the list.
      } finally {
        setRemoving(prev => { const next = new Map(prev); next.delete(id); return next })
      }
    }, UNDO_WINDOW_MS)
    timers.current.set(id, timer)
  }

  const handleUndo = (id: string) => {
    // Deleting the timer from the map BEFORE the unmount cleanup can see it
    // is what distinguishes a real undo from "unmounted with a removal
    // pending" - the cleanup fires everything still in the map.
    const timer = timers.current.get(id)
    if (timer) { clearTimeout(timer); timers.current.delete(id) }
    setRemoving(prev => { const next = new Map(prev); next.delete(id); return next })
  }

  const handleToggleWall = async () => {
    const next = !wallEnabled
    setTogglingWall(true)
    onWallEnabledChange(next) // a plain boolean flip is safe to show optimistically
    try {
      await wallService.setWallEnabled(next)
      if (next) {
        // Notes come back once the wall is back on - re-fetch rather than
        // trusting stale local state, which may be empty from having been
        // hidden while off.
        const fresh = await wallService.getWall(recipientUuid)
        onNotesChange(fresh.notes)
      }
    } catch (e: any) {
      onWallEnabledChange(!next)
      toast.error("couldn't update your wall setting.", e?.message)
    } finally {
      setTogglingWall(false)
    }
  }

  if (loading) {
    // Two columns of tinted radius-22 skeletons at varying heights, matching
    // the real note geometry (per 11-system-states.md's "loading state
    // matches what actually arrives" rule) - reuses the app-wide
    // `.v6-skeleton` shimmer rather than a bespoke animation.
    return (
      <div className="wall-board" aria-hidden="true">
        {[210, 150, 185, 235, 165, 200].map((h, i) => (
          <div key={i} className="wall-note wall-skel v6-skeleton" style={{ height: h, animationDelay: `${i * 0.06}s` }} />
        ))}
      </div>
    )
  }

  const showOffOrEmptyCard = isOwn && (notes.length === 0 || !wallEnabled)

  if (showOffOrEmptyCard) {
    const showLede = notes.length === 0 && wallEnabled
    return (
      <div className="card wall-empty-card">
        {showLede && (
          <div className="wall-empty-lede">
            {/* 18.0: the profile wall's empty state gets tuk, "on the empty
                state only" - replaces the generic chat-bubble glyph that
                stood in before the cast existed. */}
            <span className="wall-empty-disc" aria-hidden="true">
              <Mascot character="tuk" pose="idle" size={44} />
            </span>
            <div className="h-display wall-empty-title">nothing on your wall yet.</div>
            <p className="wall-empty-copy">
              Anyone at AquaTerra can leave you a note. You can delete any of them, and you can turn the wall off.
            </p>
          </div>
        )}
        <div className="wall-toggle-row">
          <div>
            <div className="wall-toggle-label" id="wall-toggle-label">Wall is {wallEnabled ? 'on' : 'off'}</div>
            <div className="wall-toggle-sub">
              {wallEnabled ? 'visible to everyone, including visitors' : 'notes are hidden, not deleted'}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={wallEnabled}
            /* Labelled by the visible line above, which already tracks the
               state - a hard-coded "Wall is on" made a screen reader
               announce the wrong state whenever the wall was off. */
            aria-labelledby="wall-toggle-label"
            className={'wall-toggle' + (wallEnabled ? ' is-on' : '')}
            onClick={handleToggleWall}
            disabled={togglingWall}
          >
            <span className="wall-toggle-knob" />
          </button>
        </div>
      </div>
    )
  }

  // Visitor with nothing to show - the tab shouldn't have rendered at all
  // (the caller gates that), but stay safe rather than show a broken board.
  if (!isOwn && (!wallEnabled || notes.length === 0)) return null

  return (
    <div>
      <div className="wall-board">
        {notes.map(note => (
          <WallNote
            key={note.id}
            note={note}
            canRemove={isOwn || (!!currentMemberUuid && note.authorUuid === currentMemberUuid)}
            onRemove={handleRemove}
            removing={removing.has(note.id)}
          />
        ))}
      </div>

      {Array.from(removing.keys()).map(id => (
        <div key={id} className="wall-removed-banner" role="status">
          <div>
            <div className="wall-removed-title">Note removed</div>
            <div className="wall-removed-sub">hidden from your wall · kept for 30 days</div>
          </div>
          <button type="button" className="wall-removed-undo" onClick={() => handleUndo(id)}>Undo</button>
        </div>
      ))}

      {!isOwn && wallEnabled && (
        <button type="button" className="wall-sticky-bar" onClick={() => setComposerOpen(true)}>
          leave {recipientName.split(' ')[0]} a note…
        </button>
      )}

      <WallComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        recipientUuid={recipientUuid}
        recipientName={recipientName}
        onPosted={handlePosted}
      />
    </div>
  )
}
