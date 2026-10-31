---
tags: [data, security, core]
verified: 2026-08-10
---

# RLS Policy Matrix

**This is the entire authorisation layer.** There is no API server, so anything
not blocked here is reachable from any browser with the anon key. Live policies,
read from `pg_policies` on 2026-08-10.

Shorthand: `me` = `get_current_member_id()` · `DIR` = `is_director()` (director,
hod, or super_admin, all `status='active'`) · `SA` = `is_super_admin()`.

## Content

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `posts` | `status='published'` ∨ author=me ∨ DIR | author=me **∧ my status='active'** | (author=me ∧ `status='pending_review'`) ∨ DIR | author=me ∨ DIR |
| `post_images` | if the post is visible | post author | — | post author ∨ DIR |
| `post_documents` | if the post is visible | post author | — | post author ∨ DIR |
| `post_tags` | **`true`** | ALL: post author ∨ DIR | ↑ | ↑ |
| `post_categories` | **`true`** | ALL: post author ∨ DIR | ↑ | ↑ |
| `post_approvals` | DIR | `is_assigned_to_category(category)` ∧ `approved_by=me` | — | — |
| `comments` | **`true`** | author=me | author=me | author=me ∨ DIR |
| `likes` | **`true`** | member=me | — | member=me |

> [!danger] `post_tags` and `post_categories` SELECT are `USING (true)`
> The tag rows of a **pending or scheduled** post are world-readable even though
> the post itself is not. Anyone can enumerate "who is tagged in post 412" before
> that post is approved. Low severity, real leak. See [[Known Gaps and Debt]].

> [!note] `post_images` / `post_documents` SELECT is weaker than it looks
> The policy is `EXISTS (SELECT 1 FROM posts WHERE posts.post_id = …)` — it checks
> the post **exists**, not that it is visible. In practice the nested SELECT is
> itself RLS-filtered, so it resolves correctly; but the policy text does not say
> what it means, and a future refactor could easily break it. Worth rewriting to
> an explicit status check.

## Identity

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `members` | `status='active'` ∨ DIR ∨ `auth_uid=auth.uid()` | **none** — impossible from client | DIR ∨ own row *(then filtered by the guard trigger)* | **SA only** |
| `director_categories` | DIR | SA | — | SA |
| `community_audit_logs` | **SA only** | — | — | — |
| `schools` | `true` | DIR | DIR | **SA** |

Plus column-level grants: `email`, `phone`, `auth_uid`, `google_id` are revoked
from `authenticated`. See [[members]].

## Teams

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `teams` | `true` | DIR | DIR ∨ team lead | DIR |
| `team_members` | `true` | DIR ∨ team lead | DIR ∨ team lead | self ∨ DIR ∨ team lead |
| `team_join_requests` | own ∨ (team lead ∨ DIR) | member=me | own **while pending** (cancel) ∨ team lead ∨ DIR | — |

"Team lead" is `EXISTS (team_members WHERE team_id = … AND member_id = me AND
role = 'lead')` — i.e. **lead is per-team membership, not a global role**. See
[[Role Model]].

## Editorial (CMS)

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `welfare_projects` | `is_draft IS NOT TRUE` ∨ DIR ∨ SA | DIR ∨ SA | DIR ∨ SA | DIR ∨ SA |
| `blogs` | (`published_date IS NOT NULL` ∧ `<= now()`) ∨ DIR ∨ own draft | DIR ∨ (author=me ∧ `published_date IS NULL`) | DIR ∨ (author=me ∧ **still unpublished**) | DIR ∨ (author=me ∧ still unpublished) |

`blogs` is the **only** table with a genuine member-authorship model: a member
may create and freely edit their own draft, and the moment it is published they
lose write access. That is what makes the blog composer possible without giving
members director rights. See [[blogs]] and [[Flow - Blog Authoring]].

Note the `welfare_projects` UPDATE/DELETE policy is `is_director() OR
is_super_admin()` — **not** the `USING (true)` that
`scripts/welfare_projects_allow_admin_write_2026_07.sql` describes. That file is
stale; do not use it as RLS truth.

## Recruitment

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `job_openings` | `status <> 'deleted'` (public) | DIR ∨ SA | DIR ∨ SA | DIR ∨ SA |
| `job_applications` | own ∨ role ∈ (director, hod, super_admin) *(inline check, not `is_director()`)* | **`auth.role() = 'authenticated'`** | role ∈ (director, hod, super_admin) | — |

> [!warning] `job_applications` INSERT is the loosest policy in the database
> `CHECK (auth.role() = 'authenticated')` — **any** signed-in user can insert a
> row with **any** `applicant_id`, `applicant_name` and `applicant_email`. Nothing
> ties the row to the caller. A pending, unapproved account can apply, and can
> apply *as someone else*. The only backstop is `UNIQUE (opening_id,
> applicant_id)`. This should be `applicant_id = get_current_member_id()`. See
> [[Known Gaps and Debt]].
>
> Note also that this table's policies hand-roll the role list inline instead of
> calling `is_director()` — the same drift the codebase's own rules forbid in
> TypeScript.

## Engagement

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `follows` | **`true`** | follower=me | — | follower=me |
| `saved_posts` | **own only** | member=me | — | member=me |
| `notifications` | own only | **`service_role` only** | own only | — |

> [!check] The `service_role`-only notifications INSERT is correct by design
> Direct INSERT is revoked deliberately. `notificationService.create()` calls the
> **`create_notification(...)` `SECURITY DEFINER` RPC** instead, which additionally
> restricts *authority* notification types (`post_approved`, `system`, …) to leaders
> while allowing *social* types to any member. Verified live — 23 `post_approved`
> and 8 `like` rows exist. See [[Simulation Log 2026-08-10]] SIM-3.
>
> **Pattern to copy:** when a table must only be written under conditions RLS cannot
> express, revoke the write and expose a `SECURITY DEFINER` RPC that encodes the
> rules. This is the cleanest authorisation design in the schema.

## Achievements

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `external_achievements` | `status='approved'` ∨ own ∨ DIR | member=me ∧ (DIR ∨ `status='pending'`) | own ∨ DIR *(plus the reset trigger)* | own ∨ DIR |

The INSERT check is neat: a member may only ever self-submit as `pending`; a
director may insert pre-approved.

## Public intake

| Table | SELECT | INSERT | UPDATE |
|---|---|---|---|
| `volunteer_applications` | role ∈ (director, hod, super_admin) | **anon + authenticated, `true`** | same roles |
| `contact_submissions` | DIR | **anon + authenticated, `true`** | DIR |
| `collaboration_submissions` | DIR | **anon + authenticated, `true`** | DIR |
| `legacy_volunteer_applications` | DIR | anon, `true` | — |

Write-only inboxes: the public can post, only leaders can read. Correct pattern.
The cost is that **nothing rate-limits them** — see [[Intake Tables]].

## Arcade

| Table | SELECT | INSERT | ALL |
|---|---|---|---|
| `arcade_scores` | authenticated, `true` | `member_uuid = auth.uid()` | — |
| `arcade_trivia_questions` | `is_active = true` | — | SA (via `trivia_admin_write`) |

> [!bug] `arcade_scores` INSERT compares the wrong things
> `CHECK (member_uuid = auth.uid())` — but `arcade_scores.member_uuid` FKs to
> `members(uuid)`, which is **not** the same uuid as `auth.users.id`. The check can
> essentially never pass. The same `members.uuid = auth.uid()` confusion appears in
> `trivia_admin_write`. Both are dormant (the route redirects home), but if the
> arcade is ever revived, start here.

## Reading this matrix as a checklist

When you add a table:
1. `rls_auto_enable` turns RLS on for you — it will return **zero rows** until you
   write policies. That is the correct default.
2. Write policies using `is_director()` / `is_super_admin()` /
   `get_current_member_id()`. Do **not** hand-roll the role list (see
   `job_applications` and `volunteer_applications` for what that drift looks like).
3. If an INSERT should belong to the caller, say
   `= get_current_member_id()`. `auth.role() = 'authenticated'` is not ownership.
4. If a column is PII, revoke the column grant as well — a policy protects rows,
   not columns.

Related: [[Views and RPCs]] · [[Permission Matrix]] · [[Known Gaps and Debt]]
