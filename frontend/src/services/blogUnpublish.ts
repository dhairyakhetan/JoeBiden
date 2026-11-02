// Pure rules for taking a live essay back to drafts. No Supabase here so it
// can be unit tested; blogService.ts does the I/O.

/** Statuses an essay can be taken back from. */
export const LIVE_STATUSES = ['published', 'scheduled'] as const

export function isLiveStatus(status: string | null | undefined): boolean {
  return !!status && (LIVE_STATUSES as readonly string[]).includes(status)
}

/** The row update: back to the review queue, schedule cleared. Cover and text are not touched. */
export function unpublishPatch() {
  return { status: 'pending_review', scheduled_for: null, published_at: null }
}

/**
 * Why a status-guarded unpublish touched zero rows. Returns the message for an
 * "already changed" case, or null when the row still looks live (so the cause is permission).
 */
export function unpublishAlreadyChangedMessage(
  row: { status: string | null; deleted_at: string | null } | null | undefined,
): string | null {
  if (!row) return null
  if (row.deleted_at) return 'This essay was already deleted.'
  if (!isLiveStatus(row.status)) {
    return row.status === 'pending_review'
      ? 'This essay is already back in drafts. Refresh the list.'
      : `This essay was already dealt with (it is now "${row.status}"). Refresh the list.`
  }
  return null
}

/** Plain-language line for the author. */
export function unpublishNotice(title: string | null | undefined) {
  return {
    title: 'Your essay is back in drafts',
    subtitle: `"${title || 'Your essay'}" is back in drafts. A leader took it off the blog for now; your text is safe.`,
  }
}
