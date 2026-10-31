---
tags: [flow, hiring]
---

# Flow — Hiring and Applications

Openings are the third mirror source, and applications carry the schema's most
serious permission gap.

## Posting an opening

```mermaid
sequenceDiagram
  autonumber
  actor D as Director
  participant QB as OpeningQuestionBuilder
  participant JO as lib/jobOpenings.create
  participant T as job_openings
  participant TR as mirror_job_opening_to_post
  participant P as posts
  participant F as Feed + /opportunities

  D->>QB: title, description, category, team_name,<br/>skills[], commitment, deadline
  D->>QB: build custom_questions (jsonb)
  QB->>JO: create(...)
  JO->>T: INSERT status='open',<br/>created_by_name/role frozen as text
  T->>TR: BEFORE INSERT (status='open', linked_post_id NULL)
  TR->>P: INSERT post status='published'<br/>body = title + blank line + description
  TR->>T: set linked_post_id
  T->>F: /opportunities card + OpeningsStrip in the feed
```

## Applying

```mermaid
sequenceDiagram
  autonumber
  actor M as Member
  participant OD as /opportunities/:id
  participant OP as OpeningPickerModal
  participant JO as jobOpenings.apply
  participant JA as job_applications
  participant HR as /director/hiring

  M->>OD: read the role
  OD->>JO: hasApplied(openingId) — hides the button if so
  M->>OP: message + answers to custom_questions
  OP->>JO: apply(...)
  JO->>JA: INSERT applicant_id, name, email, phone,<br/>custom_answers jsonb, status='pending'
  Note over JA: UNIQUE (opening_id, applicant_id)<br/>is the only thing preventing duplicates
  HR->>JA: getApplicationsForOpenings(...)
  HR->>JA: updateApplicationStatus(id, status)
```

## The security gap

```sql
-- job_applications INSERT policy
CHECK (auth.role() = 'authenticated')
```

> [!danger] Any signed-in user can create an application as anyone
> `applicant_id`, `applicant_name`, `applicant_email` and `applicant_phone` are all
> client-supplied and **nothing ties the row to the caller**. So:
> - a `pending_approval` account, never approved by anyone, can apply
> - a member can submit an application **in another member's name**
> - the only accidental guard is `UNIQUE (opening_id, applicant_id)`
>
> One-line fix:
> ```sql
> ALTER POLICY job_applications_auth_insert ON job_applications
>   WITH CHECK (applicant_id = get_current_member_id());
> ```
> This is the highest-value security change available in the schema. See
> [[Known Gaps and Debt]].

Also: SELECT and UPDATE on this table **hand-roll** the role list
(`role = ANY(ARRAY['director','hod','super_admin'])`) instead of calling
`is_director()` — the same drift the codebase forbids in TypeScript. And there is
**no DELETE policy**, so an applicant cannot withdraw.

## The status machine — client-enforced only

`ALLOWED_TRANSITIONS` in `lib/jobOpenings.ts`, with `pause()` / `resume()` /
`close()` / `delete_()` wrapping `transition()`.

```mermaid
stateDiagram-v2
  [*] --> open
  open --> paused
  paused --> open
  open --> closed
  paused --> closed
  open --> deleted
  closed --> deleted
```

RLS lets any director set any status — the state machine lives entirely in the
client. Two independent delete signals coexist: `status='deleted'` (what the
public SELECT policy filters) and `deleted_at`. `getAllIncludeDeleted()` is the
admin view.

## The retraction side effect

`post_feed_view`'s WHERE clause is
`(jo.opening_id IS NULL OR jo.status = 'open')`.

> [!important] Pausing or closing a role silently removes its feed post
> No `posts` row is touched. The post still exists, `/post/:uuid` still resolves,
> but the feed drops it. Resuming brings it back. This is elegant — and completely
> invisible if you are debugging from the `posts` table. See [[post_feed_view]].

The trigger also **never updates** the mirrored post. Editing an opening's title
or description leaves a stale feed post that will not correct itself.

## Custom questions

`job_openings.custom_questions` (jsonb array) pairs with
`job_applications.custom_answers` (jsonb object). Built by
`OpeningQuestionBuilder.tsx`, rendered by `OpeningPickerModal.tsx`. There is **no
schema validation** on either side — a question shape change silently orphans old
answers.

## Surfaces

| Surface | File |
|---|---|
| Public list | `public/OpportunitiesPage.tsx` |
| Public detail + apply | `public/OpeningDetailPage.tsx` |
| Feed strip / card | `components/OpeningsStrip.tsx`, `HiringCard.tsx` |
| Admin | `director/HiringResponses.tsx` |

Reuse the exported `CAT_COLORS`, `STATUS_COLORS`, `STATUS_LABELS`.

## Historical note

`lib/jobOpenings.ts` referenced `job_applications` for a long time before the
table existed live — every apply failed silently. It exists now (5 rows).
Cross-check the live schema, never the `.sql` files. See
[[Deployment and Vercel]].

Related: [[job_openings]] · [[post_feed_view]] · [[Desk - Intake]] · [[RLS Policy Matrix]]
