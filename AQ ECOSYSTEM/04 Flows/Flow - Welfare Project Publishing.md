---
tags: [flow, content, cms]
---

# Flow — Welfare Project Publishing

558 rows, the largest content table. A project is the org's actual work product:
a field workshop or drive, with photos, a collaborator, a location and a headline
statistic.

## The path

```mermaid
sequenceDiagram
  autonumber
  actor SA as Super admin
  participant PM as /director/projects<br/>ProjectManager + ProjectModal
  participant WP as welfare_projects
  participant TR as mirror_welfare_project_to_post
  participant P as posts
  participant PC as projectsCache
  participant PUB as /projects and the feed

  SA->>PM: create — is_draft = true
  PM->>WP: INSERT (no post created; still a draft)
  SA->>PM: fill header, summary, objective, long_writeup,<br/>main_image, image_1..4 + alts + labels,<br/>location, key_statistic, volunteers, collaborator
  SA->>PM: flip is_draft → false
  PM->>WP: UPDATE
  WP->>TR: BEFORE UPDATE (OLD.is_draft AND NOT NEW.is_draft)
  TR->>P: INSERT post, status='published' — NO REVIEW<br/>body = header + blank line + short_summary<br/>author = official@ngoaquaterra.com
  TR->>WP: set linked_post_id
  PM->>PC: bustProjectsCache()
  WP->>PUB: /projects card + /projects/:slug + feed post
```

## `is_draft` is a one-way door

The trigger fires only on the **draft to live** transition, and only when
`linked_post_id IS NULL`. Three consequences:

1. Publishing creates exactly **one** post, and it **skips moderation entirely**
   (`status='published'` directly).
2. Editing a live project never spawns a duplicate — the trigger is idempotent.
3. **Flipping back to draft does not unpublish the post.** The project disappears
   from `/projects` (RLS hides drafts) while its feed post stays live and its
   `/post/:uuid` permalink keeps working.

> [!danger] Unpublishing is broken and there is no UI hint
> A super admin who un-publishes a project reasonably believes it is gone. It is
> not. The fix is a companion `AFTER UPDATE` branch that sets
> `posts.deleted_at` (or `status='pending_review'`) when `is_draft` flips back to
> true. See [[Known Gaps and Debt]].

## What the feed reads live vs. what goes stale

`post_feed_view` LEFT JOINs `welfare_projects` on `linked_post_id`, so the feed
card re-reads these **at query time** and they always stay current:

`header` → `source_title` · `short_summary` → `source_summary` ·
`main_image` → the image fallback · `key_statistic` → `source_stat` and derived
stats · `location` → `source_location` · `workshop_date` → `source_date` ·
`slug` → `source_slug`, which is what makes the card deep-link to
`/projects/:slug`.

Only the **stored `posts.body`** (the `header + short_summary` snapshot taken at
publish time) goes stale. In practice the card renders from the joined columns,
so the staleness is mostly invisible — but a search over `posts.body` sees the
old text.

## The `key_statistic` parsing trap

The view derives up to two stat blocks. The `key_statistic` branch only fires if
the string **starts with a digit** and is **≤ 40 characters**:

| Editor writes | Feed shows |
|---|---|
| `1,200+ students reached` | ✅ `1,200+` / `students reached` |
| `500 trees planted.` | ✅ `500` / `trees planted` (trailing `.` stripped) |
| `Reached 1200 students` | ⛔ nothing — does not start with a digit |
| a 45-character statistic | ⛔ nothing — over the length cap |

> [!warning] Silent, and the editor cannot tell
> There is no validation, no preview, and no warning. This belongs in the CMS
> field's help text as much as in the SQL. `volunteers` is the safer stat — it is
> a plain int and the singular/plural label is handled in SQL. See
> [[post_feed_view]].

## Cache busting is manual and load-bearing

`/projects` serves a localStorage snapshot instantly and revalidates only every
30 minutes. Without `bustProjectsCache()` a super admin sees their own stale list
for half an hour and reasonably concludes the publish failed.

> [!important] Any new code path that writes `welfare_projects` must call
> `bustProjectsCache()`. Nothing enforces it. See [[Caching Layers]].

## Four hardcoded image slots

`image_1..image_4` with parallel `_alt` and `label_` columns. Every consumer
unrolls the same four-way repetition, and five photos is impossible. A
`project_images` child table is the right shape; it is also a 558-row migration
plus a rewrite of `PublicProjectsPage`, `PublicProjectDetailPage`,
`ProjectManager`, `ProjectManagerShared` and `ProjectModal`. See
[[Improvement Backlog]].

## Typing

All three surfaces use the `any`-typed `supabase` alias, so **none of these
queries are typechecked** — a renamed column surfaces as `undefined` at runtime.
See [[Supabase Clients]].

Related: [[welfare_projects]] · [[post_feed_view]] · [[Triggers and Cron]] · [[Desk - Admin Only]]
