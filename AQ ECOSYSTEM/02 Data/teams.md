---
tags: [data, table, teams]
rows: "teams 8 / team_members 3 / team_join_requests 2"
---

# `teams`, `team_members`, `team_join_requests`

The org-structure trio. Also the home of the **only per-scope role** in the
system: `lead`.

## `teams`

`team_id` serial PK · `uuid` UNIQUE (`/teams/:uuid`) · `name` NOT NULL ·
`description` · `category` NOT NULL · `logo_url` · `banner_url` ·
`skills` text[] NOT NULL default `{}` · `is_active` bool · `created_by` →
`members` · `created_at`/`updated_at`.

## `team_members`

`team_member_id` PK · `team_id` → `teams` CASCADE · `member_id` → `members`
CASCADE · `role` varchar default `member` · `joined_at` · `left_at` ·
`is_active` bool · **UNIQUE (team_id, member_id)**.

> [!important] `role` here is `'lead'` or `'member'` — per team
> `members.role` is the global role. `team_members.role = 'lead'` is a
> *membership* fact. A person can be a lead of team A and an ordinary member of
> team B. Every "team lead" RLS check is literally:
> ```sql
> EXISTS (SELECT 1 FROM team_members tm
>         WHERE tm.team_id = <table>.team_id
>           AND tm.member_id = get_current_member_id()
>           AND tm.role = 'lead')
> ```
> Note this check ignores `is_active` and `left_at` — **a lead who left the team
> retains lead powers** until their row is deleted. See [[Known Gaps and Debt]].

## `team_join_requests`

`request_id` PK · `uuid` UNIQUE · `team_id` CASCADE · `member_id` CASCADE ·
`status` default `pending` · `message` · `reviewed_by` · `reviewed_at` ·
`created_at`/`updated_at` · **UNIQUE (team_id, member_id, status)**.

> [!note] That UNIQUE constraint is cleverer than it looks
> Uniqueness on `(team, member, status)` means one *pending* request per person per
> team — but a rejected request does not block a later pending one, and re-applying
> after rejection works. It also means you cannot have two rejected requests for
> the same pair, which is why rejection flows update in place rather than insert.

## RLS

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `teams` | `true` | `is_director()` | `is_director()` ∨ lead-of-this-team | `is_director()` |
| `team_members` | `true` | DIR ∨ lead | DIR ∨ lead | **self** ∨ DIR ∨ lead |
| `team_join_requests` | own ∨ (lead ∨ DIR) | `member_id = me` | own **while `status='pending'`** (cancel) ∨ lead ∨ DIR | — |

`team_members` DELETE including `member_id = me` is how "leave team" works — a
member removes their own row.

## The gap between RLS and the desk

RLS lets a **team lead** create members, edit the team, and approve join
requests. But there is no `/lead` surface — team administration lives in
`director/TeamManagement.tsx` behind `requireDirector`, and
`teams/TeamDetailPage.tsx` exposes lead actions inline.

So the database grants a capability the product barely surfaces. That is a
product opportunity (a real team-lead desk) rather than a bug — see
[[Improvement Backlog]].

## Team posts

A team post is a `posts` row with `team_id` set. `teamService` has its **own**
`getPendingPosts` / `approvePost` / `rejectPost` — a *second* moderation queue,
scoped to a team, parallel to the director queue. Both write the same
`posts.status`. See [[Flow - Teams and Join Requests]] and
[[Flow - Create Post and Moderation]].

## Reading contacts

`get_team_member_contacts(member_ids[], team_id)` is the **only** sanctioned path
to a team member's `email`/`phone`, since those columns are revoked from
`authenticated` ([[members]]).

## Live shape

8 teams, **3 memberships**, 2 join requests. The structure is built; the org has
not populated it. Any feature work here is greenfield, not maintenance.

Related: [[Flow - Teams and Join Requests]] · [[Role Model]] · [[Desk - People]]
