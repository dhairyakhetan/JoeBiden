---
tags: [roles, security, reference]
---

# Permission Matrix

What each role can actually do, combining the client gates (`ProtectedRoute`,
`NAV_GROUPS`) with the database gates (RLS + triggers). Where the two disagree,
**the database wins** — and the disagreements are called out.

Legend: ✅ yes · ⛔ no · 🟡 conditional · ⚠️ client-only gate (bypassable via API)

## Reading and browsing

| Capability | anon | pending | member | lead | hod/director | super_admin |
|---|---|---|---|---|---|---|
| Published posts, projects, blogs, teams, openings | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Active member profiles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Own pending posts | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| **All** pending posts | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ✅ |
| Draft welfare projects | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ✅ |
| Own blog drafts | ⛔ | ⛔ | ✅ | ✅ | ✅ | ✅ |
| Any member's full row (incl. inactive) | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ✅ |
| `members.email` / `phone` | ⛔ | ⛔ | own only | own only | own + via helper RPCs | own + helpers |
| Audit logs | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ |
| Intake inboxes | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | ✅ |

## Content

| Capability | pending | member | lead | hod/director | super_admin |
|---|---|---|---|---|---|
| Create a post | ⛔ *(RLS: author must be `active`)* | ✅ → `pending_review` | ✅ | ✅ → **auto-published** | ✅ auto-published |
| Schedule a post | ⛔ | ⛔ | ⛔ | ✅ | ✅ |
| Bypass the profanity hold | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Edit own post | 🟡 while `pending_review` | 🟡 while pending | 🟡 | ✅ any post | ✅ |
| Delete own post | ✅ | ✅ | ✅ | ✅ any post | ✅ |
| Approve / reject a post | ⛔ | ⛔ | 🟡 **team posts only** | ✅ | ✅ |
| Moderate only my categories | — | — | — | ⚠️ client-side only | n/a |
| Create a blog draft | ⛔ | ✅ own | ✅ | ✅ | ✅ |
| Publish a blog | ⛔ | ⛔ | ⛔ | ✅ | ✅ |
| Edit a published blog | ⛔ | ⛔ | ⛔ | ✅ | ✅ |
| Create / edit welfare projects | ⛔ | ⛔ | ⛔ | ✅ *(RLS)* / ⚠️ desk is super-admin-only | ✅ |
| Create / edit job openings | ⛔ | ⛔ | ⛔ | ✅ | ✅ |
| Apply to an opening | ⚠️ **RLS allows any authenticated** | ✅ | ✅ | ✅ | ✅ |
| Submit an achievement | ✅ *(RLS only needs `member_id = me`)* | ✅ | ✅ | ✅ | ✅ |
| Approve an achievement | ⛔ | ⛔ | ⛔ | ✅ | ✅ |

## People and org

| Capability | member | lead | hod/director | super_admin |
|---|---|---|---|---|
| Edit own profile / avatar / bio | ✅ | ✅ | ✅ | ✅ |
| Change own **role** | ⛔ *(trigger reverts)* | ⛔ | ⛔ | ✅ |
| Change anyone's status (approve/reject) | ⛔ | ⛔ | 🟡 needs `operations` scope | ✅ |
| Change anyone's role | ⛔ | ⛔ | ⛔ *(trigger reverts)* | ✅ |
| Delete a member | ⛔ | ⛔ | ⛔ | ✅ |
| Create a team | ⛔ | ⛔ | ✅ | ✅ |
| Edit a team | ⛔ | ✅ own team | ✅ | ✅ |
| Add / remove team members | ⛔ | ✅ own team | ✅ | ✅ |
| Leave a team | ✅ | ✅ | ✅ | ✅ |
| Approve a join request | ⛔ | ✅ own team | ✅ | ✅ |
| Assign moderation categories | ⛔ | ⛔ | ⛔ | ✅ |

## Desk access (`/director/*`)

| Route | Gate |
|---|---|
| `index`, `posts`, `achievements`, `blogs`, `members`, `categories`, `teams`, `hiring`, `enquiries` | `requireDirector` |
| `approvals` | `requireDirector` **+** `operations` category or super admin (nav-level) |
| `content`, `projects`, `directors`, `volunteers` | `requireSuperAdmin` **on the route and** `superOnly` in nav |

## The four places client and database disagree

These are the ones to fix or consciously accept:

| # | Client says | Database says | Impact |
|---|---|---|---|
| 1 | A scoped HoD moderates only their categories | Any director may read/approve **any** post | Category scoping is a UI convention, not a boundary. [[Category Scoping]] |
| 2 | Welfare projects / Content are super-admin desks | RLS permits **any** director to write `welfare_projects` | A plain director can edit projects via the API. [[welfare_projects]] |
| 3 | Only an approved member applies to an opening | Any authenticated user, as **any** applicant id | Highest-severity gap in the schema. [[job_openings]] |
| 4 | Team-lead admin lives behind `requireDirector` | RLS grants team leads real powers | Unsurfaced capability, not a leak. [[teams]] |

Plus two role-list drifts: `is_assigned_to_category()` omits `hod`, and
`job_applications` / `volunteer_applications` policies hand-roll the role array
instead of calling `is_director()`.

All six are catalogued in [[Known Gaps and Debt]].

Related: [[Role Model]] · [[Category Scoping]] · [[RLS Policy Matrix]] · [[HoD Desk Overview]]
