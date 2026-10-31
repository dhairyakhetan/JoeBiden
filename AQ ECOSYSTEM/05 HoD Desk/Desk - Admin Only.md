---
tags: [hod-desk, admin, security]
---

# Desk — Admin Only

Four desks, all `superOnly` in nav **and** `requireSuperAdmin` on the route:
`/director/content` · `/projects` · `/directors` · `/volunteers`.

> [!danger] Both gates, every time
> ```tsx
> <Route path="projects" element={
>   <ProtectedRoute requireSuperAdmin><ProjectManager /></ProtectedRoute>} />
> ```
> plus `superOnly: true` in `NAV_GROUPS`. The nav flag alone only *hides* the tab —
> an hod/director types the URL and walks in. That has shipped as a real bug. See
> [[Permission Matrix]].

---

## `/director/content` — ContentManager (393 lines)

Global content administration over published posts: pin (`pinned`,
`pinned_title`), feature (`featured`), soft-delete (`deleted_at`), and stat blocks
(`posts.stats` jsonb, max 2 `{value,label}` pairs).

Linked from `DirectorLanding`'s "published posts" tile — but **only for super
admins**; for anyone else that tile has no destination (`to: null`).

---

## `/director/projects` — ProjectManager (371 lines)

The welfare-project CMS. `ProjectManager.tsx` + `ProjectManagerShared.tsx` (383)
+ `ProjectModal.tsx` (311) + their own CSS.

The largest content surface in the product — **558 rows**, more than the 586
posts.

Three things to hold in mind while working here:

1. **`is_draft` is a one-way door.** Publishing fires
   `mirror_welfare_project_to_post()` once, creating a `published` post with **no
   review step**. Flipping back to draft removes the project from `/projects` but
   **does not unpublish the post**. See
   [[Flow - Welfare Project Publishing]].
2. **`bustProjectsCache()` after every write.** `/projects` serves a localStorage
   snapshot and revalidates only every 30 minutes, so without the bust a super
   admin sees their own stale list for half an hour and concludes the publish
   failed. See [[Caching Layers]].
3. **None of this is typechecked.** These files import the `any`-typed `supabase`
   alias, so a renamed column surfaces as `undefined` at runtime rather than a
   build failure. See [[Supabase Clients]].

> [!warning] RLS is broader than the desk
> `welfare_projects` INSERT/UPDATE/DELETE is `is_director() OR is_super_admin()` —
> **any** director can write projects via the API, even though the desk is
> super-admin-only. Either tighten the policy to `is_super_admin()` or open the desk.
> Also note `scripts/welfare_projects_allow_admin_write_2026_07.sql` describes a
> `USING (true)` policy that is **no longer live** — do not use it as RLS truth.

`ProjectManager.tsx` is one of the files that had to be reworked to route through
`.card`/`.panel-h` instead of inline styles. See [[Two Design Languages]].

---

## `/director/directors` — DirectorManagement (266 lines)

Role administration. The only place a role changes.

| Action | Method |
|---|---|
| List leaders | `getAllDirectors()` |
| List promotable members | `getEligibleMembers({page, limit, search})` |
| Promote | `promoteToDirector(memberId)` |
| Demote | `demoteToMember(memberId)` |
| Set any role | `changeRole(memberId, 'member'\|'hod'\|'director'\|'super_admin')` |
| Delete a member | `deleteMember(memberId)` |

> [!important] The database, not this screen, is what makes it super-admin-only
> `members_guard_privileged_cols()` reverts `NEW.role` to `OLD.role` unless the
> caller `is_super_admin()`. So **a director cannot promote anyone, including
> themselves**, even by calling the API directly. `members` DELETE is
> `is_super_admin()` too. This desk is the UI over an already-enforced rule — the
> right way round. See [[members]].

`getAllDirectors()` and `getEligibleMembers()` both demonstrate the PII
workaround: emails come from a **separate** privileged query stitched in via an
`emailById` Map, because `members.email` is revoked at the column level.
`getEligibleMembers` also runs its `search` through `sanitizeFilterTerm`.

---

## `/director/volunteers` — VolunteerApplications (476 lines + 246 in Parts)

**The largest desk in the codebase**, over the largest intake table (495 rows).

It is a **WhatsApp outreach call sheet**, not a login queue:

| Column | Meaning |
|---|---|
| `texted` / `texted_by` | who has messaged this applicant |
| `added` | added to the WhatsApp group |
| `reviewed` / `review_note` | triage |
| `vol_label` | free-text tag |

> [!important] Do not confuse this with account approvals
> A first Google sign-in *is* the signup ([[Flow - Signup and Approval]]).
> `/director/approvals` handles accounts that already exist. **This** desk tracks
> leads captured from a public form, and the real recruitment funnel runs through
> WhatsApp, outside the product. That is why 495 rows here coexist with near-zero
> in-app engagement. See [[Intake Tables]].

`legacy_volunteer_applications` (26 rows) still has an open `anon` INSERT policy
on a retired form — worth revoking.

Related: [[HoD Desk Overview]] · [[Permission Matrix]] · [[welfare_projects]] · [[Intake Tables]]
