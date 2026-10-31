/**
 * "Edit and resubmit" (changelog/22-social-engine.md §22.1).
 *
 * A rejected post is now edited IN PLACE — `feedService.updatePost` writes the
 * new body/category back onto the same row and flips `status` back to
 * `pending_review`, so the moderation queue gets the SAME post back rather than
 * a second one. That is the owner's ruling; this file holds the one piece of
 * pure logic it needs, so it can be tested without a browser or a session.
 *
 * Why a resubmit is narrower than a new post: everything that is NOT body and
 * category already lives on the row and stays attached (photos, documents,
 * tags, links, team). The composer cannot see those, so it must not pretend to
 * edit them — and it must not silently drop new attachments a member adds
 * expecting them to stick. `resubmitBlockReason` is that guard: it names the
 * one thing the member did that a resubmit cannot carry, in the composer's own
 * lowercase voice, so the submit fails visibly instead of quietly losing work.
 */

export interface ResubmitTarget {
  uuid: string
  body: string
  category: string
}

export interface ResubmitAttempt {
  imageCount: number
  documentCount: number
  blogContent: string
  scheduleOn: boolean
  teamUuid: string
}

/**
 * `null` means the resubmit may proceed. A string is a member-facing sentence
 * explaining why it may not — the caller routes it through the same
 * fail()/toast/shake path as every other composer validation.
 */
export function resubmitBlockReason(a: ResubmitAttempt): string | null {
  if (a.imageCount > 0 || a.documentCount > 0) {
    return "resubmitting keeps the files already on this post — remove the new ones and add them from the post instead."
  }
  if (a.blogContent.trim()) {
    return "a rejected post can't be turned into a blog. clear the article text first."
  }
  if (a.scheduleOn) {
    return "a resubmitted post goes back for review, so it can't be scheduled."
  }
  if (a.teamUuid) {
    return "this post keeps the team it was posted to. clear the team selection to resubmit it."
  }
  return null
}

/**
 * The exact patch sent to `feedService.updatePost`. Kept here (and tested)
 * because `status: 'pending_review'` is the whole point of the feature and the
 * only value `posts_status_check` + the "Authors can update pending posts" RLS
 * policy will both accept from a member.
 */
export function buildResubmitPatch(body: string, category: string) {
  return { body: body.trim(), category, status: 'pending_review' as const }
}
