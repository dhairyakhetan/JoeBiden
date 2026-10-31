import { supabaseCommunity } from '../lib/supabaseCommunity'
import { getCachedMemberId } from '../lib/authCache'
import notificationService from './notificationService'
import { logSupabaseError } from '../lib/errorTracking'
import { withFunctionLogging } from '../lib/functionLog'

// `profile_notes` and `members.wall_enabled` were added by
// scripts/profile_wall_2026_09_06.sql in this same work session, so
// database.types.ts's generated `Database` type does not know about them
// yet - every `.from('profile_notes')`/`wall_enabled` call below fails
// strict type-checking against the stale generated shape. Same convention
// notificationService.ts already uses for create_notification() (see its
// own comment): a narrow, local `any` cast, dropped once the types are
// regenerated. Ordinary, already-typed `members` columns (uuid, full_name,
// avatar_url, member_id) elsewhere in this file are NOT cast - only the two
// genuinely new surfaces need it.
const db = supabaseCommunity as any

// ─────────────────────────────────────────────────────────────────────────────
// wallService - changelog/16-profile-wall.md. Backed by public.profile_notes
// (frontend/scripts/profile_wall_2026_09_06.sql) + members.wall_enabled.
//
// Per CLAUDE.md's service-layer contract: every function here THROWS on
// error. It does not catch-and-toast. Every caller wraps its own call in
// try/catch and owns its own user-facing feedback (Toast/Confirm).
//
// RLS does almost all of the real work (see the migration): a live note is
// readable by anyone, incl. signed-out visitors, as long as the recipient's
// wall is on; only the recipient or the author may soft-delete a note;
// nobody may ever edit `body`. This file's job is shaping rows into a nice
// TS shape and running the one multi-step write (image upload + insert).
// ─────────────────────────────────────────────────────────────────────────────

export interface WallNote {
  id: string
  recipientUuid: string
  authorUuid: string
  authorName: string
  authorAvatarUrl?: string | null
  body: string
  imageUrl?: string | null
  label?: string | null
  createdAt: string
}

export interface RemovedWallNote extends WallNote {
  recipientName: string
  recipientAvatarUrl?: string | null
  deletedAt: string
  deletedBy: string | null
  deletedByName?: string | null
  /** true when the note's own author removed it themselves (a change of
   *  mind); false when the recipient removed someone else's note (a
   *  report). Undefined if deleted_by could not be resolved to either. */
  removedByAuthor?: boolean
}

export interface WallData {
  notes: WallNote[]
  wallEnabled: boolean
}

function mapNoteRow(row: any): WallNote {
  // `author` is the embedded members!author_uuid(...) relation - PostgREST
  // returns it as an object for a to-one FK.
  const author = row.author ?? {}
  return {
    id: row.id,
    recipientUuid: row.recipient_uuid,
    authorUuid: row.author_uuid,
    authorName: author.full_name || 'Member',
    authorAvatarUrl: author.avatar_url ?? null,
    body: row.body,
    imageUrl: row.image_url ?? null,
    label: row.label ?? null,
    createdAt: row.created_at,
  }
}

const wallServiceImpl = {
  /**
   * A member's wall: their live (non-deleted) notes, and whether the wall is
   * currently on. `wall_enabled` is read from `members` directly (not
   * derived from the notes query) because the OWNER must still be able to
   * tell their wall is off even while every note is invisible under RLS -
   * see the migration's RLS comment and 16.2's "the same card... one line
   * saying notes are hidden, not deleted".
   */
  async getWall(recipientUuid: string): Promise<WallData> {
    const [{ data: memberRow }, { data: noteRows, error }] = await Promise.all([
      db.from('members').select('wall_enabled').eq('uuid', recipientUuid).maybeSingle(),
      db
        .from('profile_notes')
        .select('id, recipient_uuid, author_uuid, body, image_url, label, created_at, author:members!author_uuid(full_name, avatar_url)')
        .eq('recipient_uuid', recipientUuid)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
    ])
    if (error) throw logSupabaseError('wallService.getWall', error)

    return {
      // Defaults to true (the column's own DB default) if the member row
      // itself isn't visible to this viewer for some reason - never treat an
      // unknown state as "off" and hide a wall that is actually on.
      wallEnabled: memberRow?.wall_enabled ?? true,
      notes: (noteRows ?? []).map(mapNoteRow),
    }
  },

  /**
   * Leave a note on someone's wall. Resizes an attached image client-side
   * (see profile/wall/resizeImage.ts) before upload - there is no shared
   * upload-time resize helper in this codebase yet (lib/imageUrl.ts's
   * sized() only downscales already-hosted images for display), so this is
   * scoped locally to the wall rather than guessing at a general one.
   *
   * Throws on: not authenticated, an empty/too-long body, an image upload
   * failure, or an RLS/trigger rejection (recipient not active,
   * recipient's wall is off, the DB rate-limit trigger, ...) - the raised
   * Postgres message is passed through as `error.message` for the caller to
   * show as-is or translate.
   */
  async postNote(params: {
    recipientUuid: string
    body: string
    label?: string | null
    imageFile?: File | null
  }): Promise<WallNote> {
    const authorId = await getCachedMemberId()
    if (!authorId) throw new Error('Not authenticated')

    const body = params.body.trim()
    if (!body) throw new Error('Write something first.')
    if (body.length > 280) throw new Error('Notes are capped at 280 characters.')

    const { data: author, error: authorErr } = await supabaseCommunity
      .from('members')
      .select('uuid, full_name, avatar_url')
      .eq('member_id', authorId)
      .single()
    if (authorErr || !author) throw authorErr || new Error('Could not resolve your member record.')

    let imageUrl: string | null = null
    let uploadedPath: string | null = null
    // NOTE: no resize here on purpose. WallComposer is the only caller and it
    // already runs the file through resizeImageForWall() (-> lib/resizeImage.ts,
    // 1600 px / JPEG q0.82) before handing it over; resizing again would be a
    // second lossy re-encode for zero byte saving. Verified 2026-09-07: this is
    // the sole call path into postNote.
    if (params.imageFile) {
      const ext = params.imageFile.name.split('.').pop() || 'jpg'
      const path = `${authorId}/${crypto.randomUUID()}.${ext}`
      const { data: uploaded, error: upErr } = await supabaseCommunity.storage
        .from('wall-images')
        .upload(path, params.imageFile, { contentType: params.imageFile.type })
      if (upErr) throw logSupabaseError('wallService.postNote', upErr)
      uploadedPath = uploaded.path
      const { data: pub } = supabaseCommunity.storage.from('wall-images').getPublicUrl(uploaded.path)
      imageUrl = pub.publicUrl
    }

    const { data, error } = await db
      .from('profile_notes')
      .insert({
        recipient_uuid: params.recipientUuid,
        author_uuid: (author as any).uuid,
        body,
        label: params.label || null,
        image_url: imageUrl,
      })
      .select('id, recipient_uuid, author_uuid, body, image_url, label, created_at')
      .single()

    if (error) {
      // Roll back the upload rather than leaving an orphan blob - mirrors
      // profileService.uploadAvatar's own rollback-on-failure comment.
      if (uploadedPath) {
        await supabaseCommunity.storage.from('wall-images').remove([uploadedPath])
          .catch(err => console.warn('[wallService] orphan image cleanup failed for', uploadedPath, err))
      }
      throw logSupabaseError('wallService.postNote', error)
    }

    // §16.4: "someone left a note on your wall" - deep-links to the wall
    // (never a notification detail), batched to one row per hour
    // (create_notification()'s new 'wall_note' branch), no notification to
    // the author. Fire-and-forget by notificationService's own contract -
    // never blocks or fails the note itself.
    const { data: recipient } = await supabaseCommunity
      .from('members')
      .select('member_id')
      .eq('uuid', params.recipientUuid)
      .maybeSingle()
    if (recipient) {
      void notificationService.create({
        memberId: (recipient as any).member_id,
        type: 'wall_note',
        title: 'someone left a note on your wall',
        link: `/member/${params.recipientUuid}?tab=wall`,
      })
    }

    return {
      ...mapNoteRow(data),
      authorName: (author as any).full_name || 'Member',
      authorAvatarUrl: (author as any).avatar_url ?? null,
    }
  },

  /** Soft-delete only - sets deleted_at (deleted_by is stamped server-side
   *  by the guard trigger from the session, never client-supplied). RLS
   *  restricts this to the note's recipient or its author. */
  async removeNote(noteId: string): Promise<void> {
    const { error } = await db
      .from('profile_notes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', noteId)
    if (error) throw logSupabaseError('wallService.removeNote', error)
  },

  /** Owner-only. `members` RLS ("Users can update own member row") is what
   *  actually enforces "writable only by its owner" for an ordinary member -
   *  see the migration file's comment on why no additional policy was added. */
  async setWallEnabled(enabled: boolean): Promise<void> {
    const memberId = await getCachedMemberId()
    if (!memberId) throw new Error('Not authenticated')
    const { error } = await db
      .from('members')
      .update({ wall_enabled: enabled })
      .eq('member_id', memberId)
    if (error) throw logSupabaseError('wallService.setWallEnabled', error)
  },

  /**
   * Leader-only (RLS: profile_notes_select_removed_for_leaders, is_director()
   * - director/hod/hr/super_admin per lib/roles.ts's hasLeaderAccess). Every
   * soft-deleted note, regardless of whose wall it was on, newest removal
   * first.
   *
   * HAS NO CALLER as of 2026-09-11. It backed director/WallModeration.tsx,
   * the "Removed Notes" desk, deleted that day on the user's instruction
   * (walkthrough item 4.1) - a whole nav entry over a table holding zero rows.
   * Kept rather than deleted with it: the desk was the thing judged not worth
   * its place in the nav, not leaders' ability to audit removed notes, and
   * this is the one read that expresses it. `profile_notes`'
   * `_select_removed_for_leaders` policy is untouched.
   */
  async listRemoved(params: { limit?: number } = {}): Promise<RemovedWallNote[]> {
    const limit = params.limit ?? 100
    const { data, error } = await db
      .from('profile_notes')
      .select(`
        id, recipient_uuid, author_uuid, body, image_url, label, created_at, deleted_at, deleted_by,
        recipient:members!recipient_uuid(full_name, avatar_url),
        author:members!author_uuid(full_name, avatar_url),
        remover:members!deleted_by(full_name)
      `)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(limit)
    if (error) throw logSupabaseError('wallService.listRemoved', error)

    return (data ?? []).map((row: any) => {
      const base = mapNoteRow(row)
      return {
        ...base,
        recipientName: row.recipient?.full_name || 'Member',
        recipientAvatarUrl: row.recipient?.avatar_url ?? null,
        deletedAt: row.deleted_at,
        deletedBy: row.deleted_by,
        deletedByName: row.remover?.full_name ?? undefined,
        removedByAuthor: row.deleted_by ? row.deleted_by === row.author_uuid : undefined,
      }
    })
  },
}

export const wallService = withFunctionLogging('wallService', wallServiceImpl)

export default wallService
