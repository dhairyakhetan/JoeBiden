---
tags: [data, table, engagement]
---

# Engagement Tables

`likes` · `saved_posts` · `follows` · `comments` · `post_tags` ·
`post_images` · `post_documents` · `post_categories` · `post_approvals`

All small, all simple. The interesting facts are the **live row counts** and the
two tables that exist without any UI.

| Table | Rows | Key shape | RLS SELECT |
|---|---|---|---|
| `likes` | **4** | UNIQUE (post_id, member_id) | `true` |
| `saved_posts` | **2** | UNIQUE (member_id, post_id) | **own only** |
| `follows` | **1** | UNIQUE (follower_id, followee_id) | `true` |
| `comments` | **0** | uuid UNIQUE, `body`, `updated_at` | `true` |
| `post_tags` | 0 | UNIQUE (post_id, tagged_member_id) | `true` |
| `post_images` | 0 | `blob_url`, `blob_name`, `display_order` | via post |
| `post_documents` | 0 | + `file_name`, `file_size`, `mime_type` | via post |
| `post_categories` | 0 | UNIQUE (post_id, category) + CHECK on the 5 categories | `true` |
| `post_approvals` | 0 | UNIQUE (post_id, category), `approved_by` | director only |

## The engagement numbers are the headline

586 posts. **4 likes, 1 follow, 2 saves, 0 comments.** Against 1343 members.

The social layer is fully built — like/save/follow/tag services, notification
types, saved-posts page, follower counts, lifetime-likes on profiles — and
essentially **unused**. Any roadmap conversation should start here rather than
with new features. See [[Improvement Backlog]].

## `comments` — built, never shipped

Full table (`uuid`, `body`, `created_at`, `updated_at`, an `updated_at` trigger),
full RLS (public read, author insert/update, author-or-director delete), a
`comment_count` correlated subquery in [[post_feed_view]], and a `comment`
notification type.

**There is no comment UI anywhere in `frontend/src`.** So `comment_count` is
permanently 0 and renders as such on every card.

Decision to make: ship it or hide the count. See [[Improvement Backlog]].

## `post_approvals` — the per-category approval that is not used

Designed for **multi-category approval**: a post in several categories needs a
sign-off from an assigned director per category, and only publishes when all are
in. The machinery all exists:

- table with `UNIQUE (post_id, category)`
- INSERT policy `is_assigned_to_category(category) AND approved_by = me`
- RPC `approve_post_category(post_uuid, category)` returning
  `{success, published?, categories_remaining?}`
- client method `directorService.approvePostCategory()`

**0 rows.** The desk in practice uses the simpler
`directorService.approvePost(postId)`, which flips `posts.status` directly. So
there are two approval paths and only the simple one is exercised.

And the sophisticated one is **broken for HoDs**: its policy calls
`is_assigned_to_category()`, which omits the `hod` role — see [[Views and RPCs]].

## `post_documents`

PDF/PPTX attachments (migration 013). Bucket cap **15 MB**
([[Storage Buckets]]). The generated TypeScript types predate the migration, so
`feedService` casts through `any` to write it. Read back by `attachDocuments()`
after every feed/post fetch. See `lib/postDocuments.ts`.

## `follows`

`follower_id` / `followee_id`, both → `members` CASCADE, UNIQUE pair. There is
**no self-follow constraint** — nothing stops `follower_id = followee_id`. The
client presumably prevents it; the database does not.

`followService` exposes uuid-based convenience wrappers (`followByUuid`,
`unfollowByUuid`) because the client works in uuids while the table works in
ints.

## `post_tags`

Tagging drives the tag notification. `post_tags` SELECT is `USING (true)`, so
tags on a **pending** post are world-readable before the post is — see
[[RLS Policy Matrix]].

For scheduled posts the tag rows are written immediately but the notification is
deferred to publish time by the cron, so the "tagged you" link never dead-ends.

Related: [[posts]] · [[post_feed_view]] · [[notifications]] · [[Flow - Engagement and Notifications]]
