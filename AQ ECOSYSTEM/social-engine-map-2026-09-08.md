---
tags: [audit, engagement, social, diagnostic]
date: 2026-09-08
---

# Social Engine Map — 2026-09-08

Diagnostic pass over AquaTerra's feed/engagement subsystem: posts, likes, comments,
follows, saved posts, notifications, tags, profile wall, moderation. **Read-only** —
no app code was changed. Every claim below was checked against at least two of:
(a) the design docs in `interface-redesign-with-rounded-minimalism/project/changelog/`
and `AQ ECOSYSTEM/`, (b) the live `frontend/src` code, (c) the live Supabase project
`hzowuwffjqtgszecngpe` (schema, RLS, function bodies, row counts) via the Supabase MCP
tools on 2026-09-08.

**Headline finding, before the detail: the existing `AQ ECOSYSTEM/` audit vault is
stale on more of its social-engine claims than it gets right.** Five separate
specific claims in `04 Flows/Flow - Engagement and Notifications.md` and
`02 Data/Engagement Tables.md` are now demonstrably false against the live schema/code
(comment UI, post_tags RLS, follows self-follow constraint, HoD category-approval role
list, like-notification dedup mechanism). This confirms the staleness flagged in this
session's own memory and should update the confidence anyone places in that vault for
this subsystem specifically.

---

## 1. The map — how it actually works today

### 1.1 Tables (live, `hzowuwffjqtgszecngpe`, checked 2026-09-08)

| Table | Rows | Key shape | Notes |
|---|---|---|---|
| `posts` | 586 (0 pending, 0 rejected, 0 scheduled) | `status`, `rejection_note`, `reviewed_by/at`, `pinned`, `featured`, `scheduled_for`, `deleted_at` | Newest post is from **2026-08-06** — over a month before this audit date. No post has been created via the live app since. |
| `likes` | 6 | UNIQUE(post_id, member_id), SELECT `true` | Two of six are from today (2026-09-08), on old imported posts — active manual testing, not organic use. |
| `comments` | **1** | uuid, `body`, `updated_at` trigger, SELECT `true` | The one row was created today, 2026-09-08 05:31 UTC. See §2.1 — this directly contradicts the ECOSYSTEM vault. |
| `follows` | 1 | UNIQUE(follower_id, followee_id), CHECK `follower_id <> followee_id`, SELECT `true` | See §2.1 — the self-follow CHECK exists live; the vault says it doesn't. |
| `saved_posts` | 3 | UNIQUE(member_id, post_id), **own-row SELECT only** | |
| `notifications` | 62 (58 unread) | no actor column, no DELETE policy | |
| `post_tags` | 0 | UNIQUE(post_id, tagged_member_id) | RLS gates SELECT on the parent post's visibility (see §2.1) |
| `post_categories` | 0 | UNIQUE(post_id, category), CHECK on 5 categories | Never actually written despite `feedService.createPost` attempting it on every post — see §3.3 |
| `post_approvals` | 0 | UNIQUE(post_id, category), `approved_by` | Built for multi-category sign-off, never exercised — see §3.3 |
| `profile_notes` (wall) | 0 | soft-delete via `deleted_at`/`deleted_by` | Shipped 2026-09-06, genuinely unused so far, not itself a bug |
| `external_achievements` | 3 | `status` now defaults to `'approved'` | Review columns (`reviewed_by/at`, `review_note`) are vestigial since the 2026-09-03 decision to auto-approve on submit |

### 1.2 Services and their write/read paths

- **`feedService.ts`** — the hub. `createPost` decides `status` (`pending_review` / `published` / `scheduled`, `forceReview` always wins), inserts `posts` then best-effort-inserts `post_images`/`post_documents`/`post_tags`/`post_categories` in parallel (each arm swallows its own error into a warning string, never fails the post). `toggleLike`, `getLikers`, `getComments`/`addComment`/`deleteComment`, `updatePost` (edit-and-resubmit), `pinPost`/`featurePost`, `getFeed` (three tabs — see §1.4).
- **`notificationService.ts`** — thin wrapper around the `notifications` table plus the `create_notification()` SECURITY DEFINER RPC (direct INSERT is revoked by RLS — `notifications_service_insert` only allows `service_role`). `create()` is the sole write path and is fire-and-forget/non-throwing by contract. `withLikeDigests()` re-derives the true like count from `post_feed_view` to relabel a stale "X liked your post" row as "N people liked" once more people have liked since. **There is no delete/retract method of any kind** — confirmed by reading the whole file; see §3.1.
- **`followService.ts`** — `follow`/`unfollow`/`isFollowing`/`getCounts`/`getFollowers`/`getFollowing`, backed 1:1 by the `follows` table. Notifies on a genuine new follow only (idempotent re-follow is silent).
- **`savedPostsService.ts`** — straightforward bookmark CRUD, own-row RLS.
- **`wallService.ts`** — `profile_notes` + `members.wall_enabled`. Fully isolated from the rest of the social graph: a wall note is not a post, isn't liked/commented/tagged, doesn't appear in the feed, and only interacts with the notification system via its own `wall_note` type (batched to one notification per recipient per hour by `create_notification()`).
- **`achievementService.ts`** — CRUD over `external_achievements`, plus `shareAsPost()` which re-posts an approved achievement through `feedService.createPost` (so a shared achievement re-enters the exact same moderation/notification pipeline as a normal post).

### 1.3 Moderation — more complete than the design docs claim

Live RLS + code trace (`director/PostModeration.tsx`, `services/directorService.ts`,
`feed/MyPostsPage.tsx`):

- `posts.status`/`rejection_note`/`reviewed_by`/`reviewed_at` are real columns, exposed
  to the feed view (`post_feed_view`, which is `security_invoker=on` so it correctly
  respects the underlying `posts` RLS — a stranger cannot fetch a pending/rejected
  post by guessing its uuid; only the author or a director can).
- `PostModeration.tsx` gives a director approve / reject (with a required reason) /
  "ask for more detail" (non-blocking, keeps the post in queue) verdict. Approve and
  reject both write directly to `posts` (`approvePost`/`rejectPost` in
  `directorService.ts`) and fire a `post_approved`/`post_rejected` notification.
- `MyPostsPage.tsx` gives the author a full status view (`published`/`in review`/
  `scheduled`/`rejected` badges) with a **rejection banner + "edit and resubmit"**
  button that re-opens the composer pre-filled and calls
  `feedService.updatePost(uuid, { body, category, status: 'pending_review' })` against
  the *same* row (not a duplicate — an earlier version of this exact flow did
  duplicate; the comment in `MyPostsPage.tsx` documents that this was fixed).
- **This means `interface-redesign-with-rounded-minimalism/project/changelog/22-social-engine.md`'s "Unresolved" items 1 and 2** ("Is there a readable moderation status on posts?" / "Does the desk capture a rejection reason?") **are stale — both are already true in shipped code.** The doc is dated later than the code that answers its own open questions.

### 1.4 The feed ranking (`feedService.getFeed`)

Three tabs, `?tab=` persisted in the URL, `role="tablist"` (`HomePage.tsx`):
`foryou` (default) buckets a pooled page into "your teams" → "authors you've liked
before" → "everything", with a backfill of the 30-day top-liked posts appended when
the first page returns fewer than 5 rows; `latest` is unchanged chronological;
`myteams` filters by `team_uuid`. All three exclude pinned posts from the ranged
query and hoist up to 5 pinned posts onto page 1 only. This matches
`22-social-engine.md §22.5` closely — implemented, not just specified.

**Notably, "for you" personalizes on `likes`, never on `follows`.** See §2.2 — the
follow graph plays no role in ranking anywhere in this codebase.

---

## 2. Findings

### 2.1 Design/audit docs vs. live reality — confirm or refute each documented claim

| Claim | Source | Status today | Evidence |
|---|---|---|---|
| "No comment UI ships anywhere in `frontend/src`... every card renders a permanent 0" | `AQ ECOSYSTEM/04 Flows/Flow - Engagement and Notifications.md`, `02 Data/Engagement Tables.md` | **FALSE.** `feed/post/PostComments.tsx` + `feed/post/CommentBubble.tsx` are a complete comment UI (add, delete, sort oldest/newest, reply-prefill via `onReplyTo`), wired from `PostPage.tsx` and a bottom sheet in `FeedPostCard.tsx`. | Read both files in full. Live `comments` table has 1 row, created 2026-09-08 05:31 UTC (`comment_id=5`, `post_id=326`, body `"hui"`) — a real write through this UI, today. |
| "`post_tags` SELECT is `USING (true)`, so tags on a pending post are world-readable" | `AQ ECOSYSTEM/02 Data/Engagement Tables.md` | **FALSE.** Live policy `"Post tags follow post visibility"` gates SELECT on `posts.status='published' OR posts.author_id=self OR is_director()`. | `pg_policies` query against the live project. |
| "There is no self-follow constraint in the database — only the client prevents it" | `AQ ECOSYSTEM/02 Data/Engagement Tables.md` | **FALSE.** Live constraint `follows_no_self CHECK (follower_id <> followee_id)` exists. | `pg_constraint` query against `follows`. |
| "The [multi-category approval] RPC is broken for HoDs: `is_assigned_to_category()` omits the `hod` role" | `AQ ECOSYSTEM/02 Data/Engagement Tables.md` | **FALSE as written** — live function reads `m.role IN ('director', 'hod', 'super_admin')`, `hod` is present. **But see the new, related finding in §2.4** — it omits `hr`, which `is_director()` includes. | `pg_get_functiondef` on `is_assigned_to_category`. |
| "8 like notifications against 4 rows in likes... nothing dedups on (post, actor, type)" | `AQ ECOSYSTEM/04 Flows/Flow - Engagement and Notifications.md` | **Partially stale.** `create_notification()` now dedupes `like`/`follow`/`tag` inserts within a rolling 24h window keyed on `(member_id, type, link)`, and `notificationService.withLikeDigests()` + `NotificationsPage.tsx`'s `rollupDigestable()` correctly relabel/roll up the display to "N people liked". The specific storage-layer flooding described no longer happens. | Read `create_notification()`'s live body, `notificationService.ts`, `NotificationsPage.tsx`. |
| "Unlike leaves the notification behind; nothing retracts it" | Same doc, and this session's own CLAUDE.md-equivalent knowledge | **CONFIRMED STILL TRUE.** See §2.2 — the dedup above prevents new duplicate rows, it does not delete the existing one when the like is undone. | `feedService.toggleLike` only calls `notificationService.create` on the `liked===true` branch; `notificationService.ts` has no delete/retract method at all (only `list`, `getUnreadCount`, `markRead`, `markAllRead`, `withLikeDigests`, `create`). |
| "Following does not filter the feed... the follow graph is decorative" | `AQ ECOSYSTEM/04 Flows/Flow - Engagement and Notifications.md` | **CONFIRMED STILL TRUE**, and still true after the Sept redesign's "for you" tab shipped — that tab was the natural place to wire it in and didn't. | See §2.2. |
| `22-social-engine.md` "Unresolved" #1/#2 (moderation status + rejection reason readability) | `interface-redesign-with-rounded-minimalism` changelog | **Stale — both resolved.** See §1.3. | `MyPostsPage.tsx`, `PostModeration.tsx`, live `posts` columns. |

### 2.2 [LIVE-BROKEN] A `tag` notification can point at a post the tagged member cannot see yet

**This is the most concrete, previously-undocumented bug found in this pass.**

`feedService.createPost` (lines ~559–577) fires a `tag` notification to every tagged
member right after inserting the post:

```ts
if (data.taggedMemberIds?.length && !scheduledFor) {
  const postLink = `/post/${post.uuid}`
  ...
  await Promise.all(data.taggedMemberIds.map(taggedId =>
    notificationService.create({ memberId: taggedId, type: 'tag', ..., link: postLink })
  ))
}
```

The only guard is `!scheduledFor` (correctly deferring the notification for
*scheduled* posts — the code comment explicitly explains this is to avoid a
dead-linking notification, and `publish_due_scheduled_posts()`'s cron job re-fires the
`tag` notification at actual publish time for that case). **There is no equivalent
guard for `pending_review`.** A non-leader's post is inserted with
`status: 'pending_review'` by default (see the status-decision table in
`feedService.createPost`), and if that post tags anyone, they get a `tag`
notification **immediately**, before any director has approved it.

Following that notification's link calls `feedService.getPost(uuid)`, which selects
from `post_feed_view` (RLS `security_invoker=on`, correctly inheriting `posts`' own
RLS: `Public can view published posts` OR `author_id=self` OR `is_director()`). A
tagged member who is neither the author nor a director gets **zero rows**, `.single()`
throws, and `PostPage.tsx`'s `.catch(() => setNotFound(true))` renders the page's
"not found" state (`frontend/src/feed/PostPage.tsx` lines ~151, ~206, ~472).

**Net effect: a tagged member receives a notification whose destination reads as a
dead/broken link for as long as the post sits in review** (live data shows 0 posts
currently pending, so nothing is visibly broken *right now*, but nothing prevents it
recurring the next time a non-leader tags someone). This is exactly the failure mode
`22-social-engine.md §22.2` explicitly rules out ("no notification without a
destination") and that the scheduled-post code path was clearly written to avoid —
the pending-review path just wasn't given the same treatment.

- **Verified via:** code read (`feedService.ts` createPost, `PostPage.tsx`), and live
  RLS policies on `posts` (`pg_policies` query).
- **Severity:** live-broken (reproducible today by any non-leader tagging someone in a
  post), narrow blast radius (self-heals once the post is approved or the member
  revisits later — but a `pending_review` post that's later `rejected` never heals, and
  the tagged member is left with a permanently dead notification link).
- **Suggested fix direction:** gate the tag-notification fan-out on `status ===
  'published'` the same way `scheduledFor` is gated, and have
  `publish_due_scheduled_posts()`'s existing pattern (or a symmetric hook in
  `approvePost`) fire the deferred `tag` notifications at approval time — the cron
  function already contains the exact SQL shape needed (`notif AS (...)` CTE) for the
  scheduled-post case; the same idea applies at `approvePost()`.

### 2.3 [LIVE-BROKEN, low blast radius] Unlike does not retract the "liked your post" notification

Confirmed still true (was already known). `feedService.toggleLike` only calls
`notificationService.create({type:'like', ...})` inside the `if (liked)` branch — there
is no corresponding delete/suppress when a like is undone, and
`notificationService.ts` exposes no delete/retract capability at all (only
`list`/`getUnreadCount`/`markRead`/`markAllRead`/`withLikeDigests`/`create`).

Because `create_notification()`'s 24h dedup key is `(member_id, type, link)` —
**not** including the liker's identity — this is also the *only* like-notification a
post's author will see in a given rolling day, regardless of how many different
people like-then-unlike it. `withLikeDigests()` softens this by relabeling the row
with the post's *current* live like count when rendering the notifications page, so a
sustained multi-like post reads correctly ("N people liked") — but a single
like-then-immediate-unlike leaves a permanent, never-corrected "{name} liked your
post" notification, because `withLikeDigests` only rewrites the title when the live
count is `> 1`; at count `0` or `1` it is "left exactly as they were written" (see its
own doc-comment).

- **Verified via:** full read of `notificationService.ts` and `feedService.toggleLike`.
- **Severity:** live-broken but cosmetic/trust-only (no data corruption, no broken
  navigation — the link still resolves, it's just describing something that's no
  longer true).
- **Suggested fix direction:** either delete the matching `notifications` row on
  unlike (requires a DELETE RLS policy scoped to the row's own recent unactioned
  state, or another SECURITY DEFINER RPC), or suppress display for a like row whose
  underlying `likes` row no longer exists (would need a light join/exists check,
  more expensive per list() call).

### 2.4 [LATENT-RISK] `follows` is a fully-built feature with no product effect

`follows` (table + `followService.ts` + follow buttons in `PostHeader.tsx` /
`PublicProfilePage.tsx`) drives exactly two things: a `follow` notification, and a
follower/following count on a profile. It is not consumed anywhere else in the
codebase — confirmed by grepping every reference to the `follows` table and to
`followService`/`isFollowing` across `frontend/src` (four call sites total: the
service itself, `PublicProfilePage.tsx`, `PostHeader.tsx`, and a demo flow file).

Specifically, `feedService.getFeed`'s "for you" tab — the one feature in this
codebase explicitly designed to personalize the feed by relationship
(`22-social-engine.md §22.5`: "your teams' posts, then authors you have liked before,
then everything") — buckets by **team membership and like history**, never by
`follows`. There is no "people you follow" filter/tab anywhere in the UI. This matches
what `AQ ECOSYSTEM`'s own audit already flagged as "decorative," and it is **still
true after the entire Sept-2026 redesign shipped the for-you tab** — the natural place
to wire it in came and went without doing so.

- **Verified via:** code read + grep across `frontend/src`; live `follows` has 1 row.
- **Severity:** latent-risk / design-gap, not a crash — but arguably the single most
  consequential finding for product value, since it represents a fully-built,
  correctly-RLS'd, UI-complete feature that currently cannot move a single metric
  besides a vanity count.
- **Suggested fix direction:** either fold `follows` into the "for you" bucketing
  (alongside or instead of like-history), or be explicit that `follows` is a
  lightweight social gesture only and stop implying (via its prominent placement next
  to like/comment/save) that it does more.

### 2.5 [LATENT-RISK] Two parallel post-approval data models; only the simpler one is live

`post_categories` (denormalized per-post category rows) and `post_approvals`
(per-category director sign-off, with a `approve_post_category()` RPC that only
publishes a post once every recorded category has a matching approval row) are both
**empty — 0 rows each — despite 586 posts and months of moderation activity.**

Tracing the actual UI: `feedService.createPost` does attempt a best-effort
`post_categories` insert on every post (silently swallowing `23505`/`23514` errors),
but the live moderation queue (`director/PostModeration.tsx` →
`directorService.approvePost`/`rejectPost`) writes directly to `posts.status` and
never touches `post_approvals` or reads `post_categories` at all. The more
sophisticated `approvePostCategory`/`approve_post_category()` path exists in
`directorService.ts` (line 672) but **has no UI caller anywhere** — confirmed by grep,
the only two non-schema references to `post_approvals`/`approvePostCategory` in the
whole frontend are the service method's own definition and the generated
`database.types.ts`.

This matches what `AQ ECOSYSTEM/02 Data/Engagement Tables.md` already documented
("designed for multi-category approval... 0 rows... the desk in practice uses the
simpler path") and that observation **is still accurate** — unlike several of that
same document's other claims (§2.1).

- **Verified via:** live row counts, code read of `PostModeration.tsx` and
  `directorService.ts`, grep for `post_approvals`/`approvePostCategory` call sites.
- **Severity:** latent-risk / dead-code maintenance hazard, not user-visible today
  (no post currently needs multi-category approval in practice — `post_categories`
  being empty means every live post is effectively single-category as far as the DB
  is concerned).
- **New, related finding not in any doc:** `is_assigned_to_category()` (the RLS/RPC
  gate for the *unused* per-category path) checks `role IN ('director', 'hod',
  'super_admin')` — it does **not** include `'hr'`, while `is_director()` (the gate
  used by the *live* single-approval path) **does** include `'hr'` (`role in
  ('director','hod','super_admin','hr')`, confirmed via `pg_get_functiondef`). If this
  dead path is ever revived, or if an `hr`-role member is ever assigned a
  `director_categories` row, `approve_post_category()` would silently reject them
  while `is_director()`-gated actions elsewhere would accept them — a real
  inconsistency, currently inert only because the surrounding feature is unused.
- **Suggested fix direction:** either delete the unused `post_approvals`/
  `post_categories`/`approve_post_category` machinery (it adds real cognitive load —
  a reader of `directorService.ts` has to figure out which of two approval paths is
  "real"), or wire `PostModeration.tsx` to it properly and fix the role-list mismatch
  as part of that work. Don't leave it half-built indefinitely.

### 2.6 [COSMETIC / MINOR] Achievements review columns are vestigial

`external_achievements.reviewed_by`, `reviewed_at`, `review_note` still exist in the
schema and `achievementService.ts`'s `mapAchievementFromDB` still reads and exposes
them, but `createAchievement` has hard-coded `status: 'approved'` since the
2026-09-03 decision to retire the achievements review desk (per the code's own
comment), and no UI writes those three columns anymore. This is the same shape of
issue CLAUDE.md already calls out for `pointsTile` (a UI/schema surface rendering a
retired concept) — smaller blast radius here since nothing currently displays these
fields to end users in a misleading way, but worth a note for whoever eventually
prunes retired-feature debt.

- **Verified via:** live column list for `external_achievements`, code read of
  `achievementService.ts`.
- **Severity:** cosmetic.
- **Suggested fix direction:** drop the three columns (with a migration) once
  confirmed nothing else reads them, or leave a comment explaining they're
  intentionally dormant so a future reader doesn't assume a review desk still exists.

### 2.7 [COSMETIC] `toggleLike`'s returned count is a trusted client estimate, not re-verified

`feedService.toggleLike(uuid, knownPostId, knownLikeCount)` computes its returned
`likeCount` as `knownLikeCount ± 1` using the caller-supplied count (an optimization
to skip a round trip), never re-querying the real count from the database on that
same call. This is harmless in the steady state because `post_feed_view`'s
`like_count` is a live correlated subquery over the real `likes` table and any
subsequent fetch self-corrects — but under concurrent likes on the same post, two
users' immediate optimistic UI can briefly disagree with each other and with the
eventual server truth until their next feed refresh.

- **Verified via:** code read of `feedService.toggleLike`.
- **Severity:** cosmetic (self-heals on next fetch; no persisted incorrect state).

### 2.8 [LATENT-RISK, previously documented, still true] No notification retention/deletion story

`notifications` has SELECT/UPDATE RLS scoped to the owning member and an INSERT
policy restricted to `service_role` (i.e. only reachable through the
`create_notification()` SECURITY DEFINER RPC) — but **no DELETE policy of any kind**,
and no scheduled job purges old rows. Live: 62 rows, 58 unread, for what is still a
handful of active testers. This was already flagged in
`AQ ECOSYSTEM/04 Flows/Flow - Engagement and Notifications.md` and remains accurate.
Not urgent at current scale, but worth tracking before this becomes a real member
base generating one row per like/comment/tag/approval indefinitely.

- **Verified via:** `pg_policies` on `notifications`; row counts.
- **Severity:** latent-risk (works fine today, will not scale gracefully without a
  retention policy).

### 2.9 [CONTEXT, not a bug] The whole subsystem is effectively unused in production

Corroborating `AQ ECOSYSTEM`'s own framing: the newest `posts` row is from
**2026-08-06**, over a month before this audit. `likes`/`comments`/`follows` row
counts (6/1/1) are dominated by same-day manual testing (member_id 29's two most
recent likes and the sole comment are all timestamped 2026-09-08, the day of this
audit) rather than organic member activity. None of the findings above are currently
causing visible harm to real users simply because there is close to no live traffic
exercising these paths yet. This doesn't change the correctness of the findings, but
it does mean priority should weigh "will this bite the first real cohort of users"
over "is this bothering anyone today."

---

## 3. Summary table

| # | Finding | Severity | New or already documented |
|---|---|---|---|
| 2.2 | `tag` notification can link to a not-yet-visible pending post | **Live-broken** | **New** |
| 2.3 | Unlike never retracts the "liked your post" notification | Live-broken (cosmetic blast radius) | Already known, reconfirmed |
| 2.4 | `follows` has zero effect on ranking/personalization/UI beyond a count + notification | Latent-risk / design-gap | Already known (AQ ECOSYSTEM), reconfirmed still true post-redesign |
| 2.5 | `post_approvals`/`post_categories`/`approve_post_category` are dead code; `is_assigned_to_category()` omits `hr` | Latent-risk | Partially known (dead-path fact); the `hr` role-list gap is **new** |
| 2.6 | `external_achievements` review columns vestigial post points-retirement | Cosmetic | New (minor) |
| 2.7 | `toggleLike`'s returned count is an unverified client estimate | Cosmetic | New (minor) |
| 2.8 | No notification retention/deletion policy | Latent-risk | Already known, reconfirmed |
| 2.9 | Subsystem essentially unused live (no post since 2026-08-06) | Context | Already known, reconfirmed |
| 2.1 | 5 specific AQ ECOSYSTEM claims (comment UI, post_tags RLS, follows self-follow constraint, HoD role list, like-notification dedup) are now stale/false | — | Doc-hygiene finding |

Related: [[Flow - Engagement and Notifications]] · [[Engagement Tables]] ·
[[Flow - Create Post and Moderation]] · [[post_feed_view]] · [[notifications]]
