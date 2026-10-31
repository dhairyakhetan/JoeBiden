---
tags: [data, rpc, view, security]
---

# Views and RPCs

24 functions, 17 of them `SECURITY DEFINER`. Four views.

## The five authorisation primitives

Every RLS policy in the database composes from these. All `STABLE SECURITY
DEFINER` with `search_path` pinned to `public, pg_temp`.

| Function | Returns | Definition |
|---|---|---|
| `is_director()` | bool | a `members` row where `auth_uid = auth.uid()` **AND** `role IN ('director','hod','super_admin')` **AND** `status = 'active'` |
| `is_super_admin()` | bool | same, `role = 'super_admin'` |
| `is_assigned_to_category(cat)` | bool | joins `director_categories`; true if the category matches **OR** the caller is `super_admin`. Note: checks `role IN ('director','super_admin')` — **`hod` is excluded here** |
| `get_current_member_id()` | int | `SELECT member_id FROM members WHERE auth_uid = auth.uid()` |
| `current_member_id()` | int | duplicate of the above, used as `blogs.author_id`'s DEFAULT |

> [!warning] Two real inconsistencies in these five
> **1. `hod` is missing from `is_assigned_to_category`.** `is_director()` accepts
> `hod`; this one does not. So an `hod` passes every generic director gate but
> **cannot** insert a `post_approvals` row (whose policy uses this function),
> even though the desk shows them the queue. Given the codebase's stated rule
> that hod and director have identical power, this is a bug, not a design.
>
> **2. `get_current_member_id()` and `current_member_id()` are the same
> function twice.** Policies use the former, `blogs`' column default uses the
> latter. Consolidating is safe but touches a default. See
> [[Known Gaps and Debt]].

## Client-callable RPCs

| RPC | Called from | Purpose |
|---|---|---|
| `get_own_member()` → `SETOF members` | `AuthContext.fetchMember` | returns the caller's own row **bypassing the column-level PII lockdown** on `email`/`phone`/`auth_uid`/`google_id`. A plain `select('*')` would fail |
| `ensure_member()` → void | `AuthContext.fetchMember` fallback | self-heals a session with no members row; can only create the caller's own `pending_approval` row |
| `approve_post_category(p_post_uuid, p_category)` → json/jsonb | `directorService.approvePostCategory` | records a per-category approval; returns `{success, published?, categories_remaining?}`. **Overloaded twice** (`varchar` and `text` variants) — see below |
| `get_team_member_contacts(member_ids[], team_id)` → TABLE | team admin UI | the only sanctioned way to read team members' `email`/`phone`, scoped to one team |
| `create_notification(...)` → void | server-side notification writes | `notifications` INSERT policy requires `service_role`, so this is the bridge |
| `publish_due_scheduled_posts()` → int | pg_cron | [[Triggers and Cron]] |

> [!bug] `approve_post_category` exists twice
> `(uuid, varchar) → json` and `(uuid, text) → jsonb`. PostgREST resolves by
> argument type, and the client sends a JS string. Two overloads with **different
> return types** means the shape the client parses depends on resolution — a real
> ambiguity worth removing. See [[Improvement Backlog]].

## Content-formatting functions (not `SECURITY DEFINER`)

| Function | Used by |
|---|---|
| `blog_post_writeup(headliner, body, written_by) → text` | `mirror_blog_to_post()` — composes the feed body for a mirrored blog |
| `format_blog_body(src) → text` | blog body normalisation |

## Views

### `post_feed_view`
The content engine. Its own note: [[post_feed_view]].

### `member_directory_view`
`member_id, uuid, email, full_name, avatar_url, class_grade, role, status,
created_at, role_rank`. The `role_rank` int exists so the directory can sort
leaders first in SQL instead of with a client-side comparator.

### `pending_member_approvals`
`member_id, uuid, email, full_name, avatar_url, class_grade, phone, join_reason,
bio, created_at`. Powers `director/AccountApprovals`. Note it **does** surface
`phone` and `join_reason` — an approver needs them, and access is constrained by
the underlying `members` policies.

### `pending_post_reviews`
`post_id, uuid, category, body, link_url, created_at, author_id, author_name,
author_avatar`. Powers `director/PostModeration`.

## The view security model — two different mechanisms

Verified 2026-08-10. The four views split into two groups, and the difference
matters:

| View | `security_invoker` | Gated by |
|---|---|---|
| `post_feed_view` | `on` | **RLS on the base tables** |
| `pending_post_reviews` | `true` | **RLS on the base tables** |
| `member_directory_view` | **`false`** | a `WHERE is_director() OR is_super_admin()` **inside the view body** |
| `pending_member_approvals` | **`false`** | `WHERE status='pending_approval' AND is_active AND (is_director() OR is_super_admin())` |

> [!warning] The two PII views carry their own gate — do not remove it
> `security_invoker=false` means they execute with the owner's privileges and
> **cannot rely on RLS**. They are safe only because the director check is baked into
> their `WHERE` clause. Tested as `authenticated` with no user context: both return
> **0 rows**, correctly.
>
> Delete or loosen that predicate while refactoring and both views become
> unauthenticated dumps of every member's email, phone, `join_reason` and bio — with
> **no policy anywhere to catch it.** Add an SQL comment on both saying so.
>
> See [[Simulation Log 2026-08-10]] SIM-2.

The two `security_invoker` views are the safer pattern; prefer it for anything new.

Related: [[RLS Policy Matrix]] · [[Triggers and Cron]] · [[members]] · [[Category Scoping]]
