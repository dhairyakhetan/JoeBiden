import { supabaseCommunity } from './supabaseCommunity'
import { Post } from '../services/api'

/**
 * Batch-attach `post_documents` rows to an array of already-mapped posts.
 *
 * Why this lives in a shared helper:
 *   - 6+ selectors across feedService / profileService / teamService /
 *     savedPostsService all return Post arrays and all need docs.
 *   - Inlining the same `.in('post_id', ...)` query in each one creates
 *     copy-paste drift the next time the schema or mapping changes.
 *   - The work is cheap (one extra SELECT per page-load) and the cast
 *     stays bounded to one file.
 *
 * Mutates `posts` in place. Safe to call with an empty array (no-op).
 */
// Fetch the raw post_documents rows for a set of post ids (one batched SELECT).
// Exposed so callers that already know the ids can run this CONCURRENTLY with
// other per-page queries (e.g. the feed runs it in parallel with the likes
// query) instead of waterfalling.
export async function fetchDocumentRows(postIds: number[]): Promise<any[]> {
  if (!postIds.length) return []
  const { data } = await (supabaseCommunity.from('post_documents' as any) as any)
    .select('post_id, blob_url, file_name, mime_type, file_size, display_order')
    .in('post_id', postIds)
    .order('display_order', { ascending: true })
  return (data as any[]) ?? []
}

// Pure mapping step - attach already-fetched doc rows onto posts (in place).
export function attachDocumentRows(posts: Post[], allDocs: any[]): void {
  if (!posts?.length || !allDocs?.length) return
  const docsByPostId = new Map<number, NonNullable<Post['documents']>>()
  for (const d of allDocs) {
    const list = docsByPostId.get(d.post_id) ?? []
    list.push({
      url: d.blob_url,
      fileName: d.file_name,
      mimeType: d.mime_type,
      size: d.file_size,
      displayOrder: d.display_order,
    })
    docsByPostId.set(d.post_id, list)
  }
  for (const p of posts) {
    const docs = docsByPostId.get(p.postId)
    if (docs) p.documents = docs
  }
}

export async function attachDocuments(posts: Post[]): Promise<void> {
  if (!posts || posts.length === 0) return
  const postIds = posts.map(p => p.postId).filter((id): id is number => typeof id === 'number')
  if (postIds.length === 0) return
  attachDocumentRows(posts, await fetchDocumentRows(postIds))
}
