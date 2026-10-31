---
tags: [flow, profile, moderation]
---

# Flow — Achievements

Members claim external achievements; directors verify them. Small feature, best
review lifecycle in the codebase.

## The loop

```mermaid
sequenceDiagram
  autonumber
  actor M as Member
  participant AM as AddAchievementModal
  participant AS as achievementService
  participant EA as external_achievements
  participant TR as reset_achievement_status_on_owner_edit
  participant D as /director/achievements
  participant PP as Public profile

  M->>AM: title, description, type, dates, proof_url
  AM->>AS: createAchievement(...)
  AS->>EA: INSERT — RLS forces member_id = me AND status='pending'
  D->>AS: getPendingReviews({limit: 50})
  alt approve
    D->>AS: approveAchievement(uuid)
    AS->>EA: status='approved', reviewed_by/at
    EA->>PP: now publicly visible
  else reject
    D->>AS: rejectAchievement(uuid, note)
    AS->>EA: status='rejected' + review_note
  end
  opt owner edits an approved/rejected claim
    M->>AS: updateAchievement(uuid, ...)
    AS->>EA: UPDATE
    EA->>TR: BEFORE UPDATE
    TR->>EA: status='pending'; clear reviewed_by/at/note
    Note over TR,D: back in the queue — a director's<br/>own edits never trigger this
  end
  opt share it
    M->>AS: shareAsPost(uuid)
    AS->>AS: map achievement_type → post category
    AS->>AS: dynamic import feedService → createPost
    Note over AS: enters the normal moderation queue
  end
```

## Two mechanisms worth reusing

### 1. RLS makes "self-submit as pending" structural

```sql
INSERT CHECK (member_id = get_current_member_id()
              AND (is_director() OR status = 'pending'))
```

No client code enforces it. A member can only ever create a pending claim for
themselves; a director may insert pre-approved.

### 2. Re-review on substantive edit

`reset_achievement_status_on_owner_edit()` fires when **the owner** (and not a
director) changes any of `title`, `description`, `achievement_type`,
`achievement_date`, `achievement_end_date`, `proof_url` on an `approved` or
`rejected` row. It sets `status='pending'` and clears all review metadata.

> [!tip] This closes the bait-and-switch that most review systems have
> Get something innocuous approved, then rewrite it and keep the badge. The
> trigger's field list *is* the definition of "substantive", and director edits are
> exempt so a moderator can fix a typo without resetting their own decision.
>
> **[[posts]] lacks this.** A published post cannot be edited at all — safe, but
> blunt. Achievements found the better answer; consider porting it.

## Visibility

`SELECT: status='approved' OR own OR is_director()`. So a member always sees their
own pending and rejected claims (with the reviewer's note), the public sees only
approved ones, and directors see everything.

## Share-as-post mapping

`shareAsPost` maps `achievement_type` through a local `categoryByType` record,
defaulting to `content`, then dynamically imports `feedService` (code-splitting —
the feed module is not pulled into the profile bundle) and calls `createPost`. So
a shared achievement is an ordinary post and takes the ordinary moderation path.

## Surfaces

| Surface | File |
|---|---|
| Profile list | `profile/AchievementsList.tsx` |
| Add | `profile/AddAchievementModal.tsx` |
| Edit | `profile/EditAchievementModal.tsx` |
| Review queue | `director/AchievementReviews.tsx` |
| Desk badge | `stats.pendingAchievementReviews` in `getDashboardStats` |

Pagination exists on `getMyAchievements` / `getMemberAchievements`
(`{page, limit, type}`); the review queue is a flat `limit: 50` with no paging —
fine at 3 rows, a gap at 300.

## Live shape

3 rows. Like most of the social layer, this is built and barely used. See
[[Improvement Backlog]].

Related: [[external_achievements]] · [[Desk - Queues]] · [[Flow - Create Post and Moderation]]
