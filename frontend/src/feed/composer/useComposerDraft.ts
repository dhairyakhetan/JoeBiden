// Composer draft autosave (03.2.2). Debounced localStorage, one key, never
// image blobs (attachments always re-prompt). Net-new behaviour - unlike the
// rest of CreatePostModal.tsx this piece is extracted into its own file
// per the changelog's explicit file list for `feed/composer/`, since it is
// genuinely isolated (no existing handler to move "verbatim") and a hook is
// easy to verify in isolation.
import { useCallback, useEffect, useRef, useState } from 'react'

export interface ComposerDraft {
  body: string
  title: string
  category: string
  linkUrl: string
  taggedMemberIds: number[]
  teamUuid: string
}

export const EMPTY_DRAFT: ComposerDraft = {
  body: '', title: '', category: '', linkUrl: '', taggedMemberIds: [], teamUuid: '',
}

const STORAGE_KEY = 'aq_composer_draft_v1'
const DEBOUNCE_MS = 800

/**
 * Drop the stored draft without a mounted composer.
 *
 * The key is not member-scoped, so on a shared browser - which is most of this
 * org's users - the next person to sign in opened the composer and found the
 * previous member's unsent post waiting in it. Sign-out calls this.
 */
export function discardComposerDraft(): void {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* nothing to clear */ }
}

/**
 * Read whatever draft is currently stored, or null. Additive: lets a caller
 * outside the composer ask "would seeding a draft destroy something?" without
 * duplicating the key or the corrupt-value handling.
 */
export function readComposerDraft(): ComposerDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as Partial<ComposerDraft>
    const merged: ComposerDraft = { ...EMPTY_DRAFT, ...d, taggedMemberIds: Array.isArray(d.taggedMemberIds) ? d.taggedMemberIds : [] }
    return hasContent(merged) ? merged : null
  } catch { return null }
}

/**
 * Write a draft for the composer to restore on its next open.
 *
 * This is the seam `feed/MyPostsPage.tsx`'s "edit and resubmit" uses
 * (changelog/22-social-engine.md §22.1) to get a rejected post's text into the
 * composer. It is the composer's own documented restore path, not a back door:
 * the modal reads exactly this key on open and labels the result "draft
 * restored", which is an honest description of what happened.
 *
 * What this seam does NOT decide any more is where the submit goes. This
 * comment used to say editing a rejected post in place was "an open owner
 * decision" and that CreatePostModal "owns no prefill prop"; both are now out
 * of date. The owner ruled for a real in-place edit, so MyPostsPage also passes
 * CreatePostModal an `editPost` prop and the submit runs
 * `feedService.updatePost(uuid, { body, category, status: 'pending_review' })`
 * against the existing row instead of creating a new post. Prefilling still
 * flows through here; only the write target changed. (`updatePost` itself has
 * always existed — `director/ContentManager.tsx` and `feed/PostPage.tsx` have
 * used it all along, whatever earlier comments in this repo claimed.)
 *
 * Callers MUST check `readComposerDraft()` first and get the member's
 * agreement before overwriting a draft with content in it - §11.5: "losing a
 * half-written post to a dropped connection is the worst failure in the
 * product", and losing one to a button is no better.
 */
export function seedComposerDraft(draft: Partial<ComposerDraft>): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...EMPTY_DRAFT, ...draft }))
    return true
  } catch { return false }
}

function hasContent(d: ComposerDraft): boolean {
  return !!(d.body || d.title || d.category || d.linkUrl || d.taggedMemberIds.length || d.teamUuid)
}

export type DraftStatus = 'none' | 'restored' | 'saved'

/**
 * `current` should be a fresh object each render built from the composer's
 * live fields (see CreatePostModal.tsx). `apply` writes a restored draft back
 * onto those same fields - called at most once per open.
 */
export function useComposerDraft(isOpen: boolean, current: ComposerDraft, apply: (d: ComposerDraft) => void) {
  const [status, setStatus] = useState<DraftStatus>('none')
  const restoredRef = useRef(false)
  const skipFirstSaveRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset the per-open guards when the sheet closes, so the NEXT open
  // re-checks storage instead of remembering this session's state.
  useEffect(() => {
    if (isOpen) return
    restoredRef.current = false
    skipFirstSaveRef.current = false
    setStatus('none')
  }, [isOpen])

  // Restore at most once per open. Storage can be read-`null` (nothing
  // saved), corrupt (a hand-edited/old-shape value) or blocked (private
  // browsing) - all three just mean "nothing to restore", never a thrown error.
  useEffect(() => {
    if (!isOpen || restoredRef.current) return
    restoredRef.current = true
    let draft: Partial<ComposerDraft> | null = null
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      draft = raw ? JSON.parse(raw) : null
    } catch { draft = null }
    if (!draft) return
    const merged: ComposerDraft = { ...EMPTY_DRAFT, ...draft, taggedMemberIds: Array.isArray(draft.taggedMemberIds) ? draft.taggedMemberIds : [] }
    if (!hasContent(merged)) return
    apply(merged)
    setStatus('restored')
    // The very next autosave effect run is caused by OUR OWN apply() above,
    // not a real edit - skip relabelling it "draft saved".
    skipFirstSaveRef.current = true
  }, [isOpen, apply])

  useEffect(() => {
    if (!isOpen) return
    // Order matters: right after a restore, THIS pass still sees the
    // pre-restore (empty) `current` - the setters `apply()` called land on
    // the NEXT render. Check hasContent() first so the skip flag is only
    // consumed on the pass where there is actually something to (not) save;
    // checking it here first used to consume it a render early, on the
    // render where `current` was still empty anyway, so the very next
    // render (the one that actually carries the restored text) fell through
    // and saved immediately - relabelling "draft restored" as "draft saved"
    // before the user had touched anything.
    if (!hasContent(current)) return
    if (skipFirstSaveRef.current) { skipFirstSaveRef.current = false; return }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
        setStatus('saved')
      } catch { /* storage full/blocked - the draft just doesn't persist this time */ }
    }, DEBOUNCE_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, current.body, current.title, current.category, current.linkUrl, current.teamUuid, current.taggedMemberIds.join(',')])

  /** Call on a successful post - the draft it described no longer exists. */
  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* nothing to clear */ }
    if (timerRef.current) clearTimeout(timerRef.current)
    setStatus('none')
  }, [])

  return { draftStatus: status, clearDraft }
}
