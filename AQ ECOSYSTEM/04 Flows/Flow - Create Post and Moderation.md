---
tags: [flow, content, moderation, core]
---

# Flow — Create Post and Moderation

The core loop of the product.

## Compose to publish

```mermaid
sequenceDiagram
  autonumber
  actor A as Author
  participant CPM as CreatePostModal
  participant PF as profanityFilter
  participant ST as Storage buckets
  participant FS as feedService.createPost
  participant DB as posts + children
  participant NS as notificationService
  participant Q as Director queue

  A->>CPM: body, category, images, docs, tags, stats, link
  CPM->>PF: check body
  PF-->>CPM: clean | flagged → forceReview = true
  CPM->>ST: upload images → post-images<br/>docs → post-documents
  Note over CPM,ST: minutes possible — this is why a<br/>stale scheduled_for must NOT become instant publish
  CPM->>FS: createPost(data)
  FS->>FS: getCachedMemberId()
  FS->>DB: read own role + full_name
  FS->>FS: decide status (see table)
  FS->>DB: INSERT posts
  par best-effort, parallel, non-blocking
    FS->>DB: post_images
    FS->>DB: post_documents
    FS->>DB: post_tags
    FS->>DB: post_categories (23505/23514 swallowed)
  end
  opt tagged AND not scheduled
    FS->>NS: create('tag') per tagged member
  end
  FS->>A: getPost(uuid) — the mapped post back
  alt status = pending_review
    DB-->>Q: appears in pending_post_reviews
  end
```

## The status decision

```
isLeader = role in (director, hod, super_admin)

forceReview            → 'pending_review'     ← always wins
else scheduledFor set  → 'scheduled'          ← leaders only
else isLeader          → 'published'
else                   → 'pending_review'
```

> [!danger] Two invariants the code calls out explicitly
> **1. `forceReview` beats everything.** It is set by the profanity filter. If
> scheduling could override it, scheduling becomes a moderation bypass.
> **2. Never downgrade a schedule to an instant publish.** Uploads run first and
> can take minutes; a `scheduled_for` that has already passed stays `scheduled`, and
> pg_cron publishes it within a minute. Firing immediately would contradict what
> the author was told.

## Attachments are best-effort

All four child inserts run in one `Promise.all`, each `.then`-ing to a
`console.warn` on failure. **A failed image insert does not roll back the post.**

Consequence: a post can go live with its images silently missing, with no repair
job and no user-facing signal. See [[Improvement Backlog]].

## Moderation

```mermaid
flowchart TD
  P["posts.status = pending_review"] --> V(["pending_post_reviews view"])
  V --> PM["/director/posts — PostModeration"]
  PM -->|"client-side filter to myCategories"| L["visible list"]
  L --> AP["approvePost(postId)<br/>status=published, reviewed_by/at"]
  L --> RJ["rejectPost(postId, note)<br/>status=rejected, rejection_note"]
  AP --> N1["notify author: post_approved"]
  RJ --> N2["notify author: post_rejected"]
  AP --> F(["post_feed_view → the feed"])
```

The badge count uses `getScopedPendingPostsCount(cats)` so the number on the tab
matches the list behind it — see [[Category Scoping]].

> [!warning] Category scoping here is client-side only
> `posts` SELECT/UPDATE is `is_director()` with **no** category clause. A scoped
> HoD can read and approve any pending post through the API; `PostModeration`
> merely filters the list it renders. See [[Permission Matrix]].

## The second, parallel moderation queue

`teamService` has its **own** `getPendingPosts` / `approvePost` / `rejectPost`
for **team posts** (`posts.team_id` set), surfaced in `TeamDetailPage` for team
leads. Both queues write the same `posts.status`.

> [!note] Nothing coordinates the two
> A team post pending review appears in **both** the team lead's queue and the
> director queue. Either can approve it. There is no lock, so the second approver
> just re-approves an already-published post. Benign today; worth knowing.

## The four ways a post comes into existence

```mermaid
flowchart LR
  M["member / leader<br/>CreatePostModal"] --> P[("posts")]
  T["team post<br/>CreateTeamPostModal"] --> P
  A["achievement<br/>shareAsPost()"] --> P
  MI["mirror triggers<br/>welfare_projects · blogs · job_openings"] --> P
  P --> V(["post_feed_view"])
```

Mirrored posts **skip moderation entirely** — the welfare and job triggers insert
with `status='published'` directly. Only human-authored posts see the queue. See
[[Triggers and Cron]].

## Reading it back

Never query `posts` for display. `feedService.getFeed({page, limit, category})`
selects from `post_feed_view` using `POST_FEED_COLS`, then:

1. in parallel, fetches the caller's `likes` for the returned `post_id`s and the
   `post_documents` rows
2. maps rows through `mapPostFromDB(post, likedPostIds)` so each card knows
   whether *you* liked it
3. returns `{posts, totalItems, totalPages}`

`getPost(uuid)` uses the wider `POST_DETAIL_COLS`. `getTrending({limit, days})`
and `getCategoryPulse({days})` are windowed aggregates over the same view.

## Profanity filter

`lib/profanityFilter.ts` + `profanityWords.json`, unit-tested
(`profanityFilter.test.ts`). It does **not** block — it sets `forceReview`, which
routes the post to a human. Leaders are not exempt.

Related: [[posts]] · [[post_feed_view]] · [[Flow - Scheduled Publishing]] · [[Desk - Queues]] · [[Category Scoping]]
