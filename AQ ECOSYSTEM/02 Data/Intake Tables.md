---
tags: [data, table, intake, funnel]
---

# Intake Tables

Four public write-only inboxes. Anonymous visitors INSERT; only leaders SELECT.

| Table | Rows | Form | Reviewed in |
|---|---|---|---|
| `volunteer_applications` | **495** | volunteer lead capture | `director/VolunteerApplications.tsx` (super-admin only) |
| `legacy_volunteer_applications` | 26 | the older version of the same form | read-only, director SELECT |
| `contact_submissions` | 0 | `/contact` | `director/FormResponses.tsx` |
| `collaboration_submissions` | 1 | `/collaborations` | `director/FormResponses.tsx` |

## `volunteer_applications` — the WhatsApp outreach desk

> [!important] This is **not** the login path
> A first-time Google sign-in *is* the signup ([[Flow - Signup and Approval]]).
> This table is a genuinely separate lead-capture and outreach-tracking desk.
> Conflating the two is the single most common misreading of this codebase.

| Column | Purpose |
|---|---|
| `full_name`, `email`, `phone`, `age` int, `college`, `year_of_study` | the applicant |
| `interests` text[], `availability` | fit |
| `why_aquaterra` NOT NULL, `previous_experience` | free text |
| `instagram_handle` | how most of them arrive |
| `reviewed` bool, `review_note` | triage |
| **`texted`** bool NOT NULL, **`texted_by`** text | WhatsApp outreach tracking |
| **`added`** bool NOT NULL | added to the group |
| `vol_label` | free-text tag |

`texted` / `texted_by` / `added` make the operational model explicit: an
application is **a phone number to message**, and the desk is a call sheet. This
is why the table has 495 rows while `members` engagement is near zero — the real
funnel runs through WhatsApp, outside the product.

That is worth designing *for* rather than around. See [[Improvement Backlog]].

## `legacy_volunteer_applications`

Same fields, `age` as **text** rather than int (the schema tightened when it was
replaced). Director SELECT + anon INSERT — the anon INSERT policy is still open
on a retired table, which should probably be revoked.

## `contact_submissions` / `collaboration_submissions`

Small and uniform: identity fields, a `message` NOT NULL, `status` default
`new`. `collaboration_submissions` adds `org_name`, `contact_name`, `collab_type`.

Both submit from public pages and land in `director/FormResponses.tsx`.
`/thank-you` is the post-submit confirmation route.

## RLS pattern (identical across all four)

```sql
INSERT  TO anon, authenticated  WITH CHECK (true)
SELECT  USING (is_director())          -- or an inline role list
UPDATE  USING (is_director())          -- status / review flags
```

> [!warning] Nothing rate-limits these
> `WITH CHECK (true)` for `anon` on a table with no captcha, no honeypot, and no
> per-IP throttle is an open write endpoint. 495 legitimate rows means it has not
> been abused yet; one scripted afternoon changes that, and the only recourse would
> be manual deletion. Options: a Supabase Edge Function in front, a
> `created_at`-windowed constraint, or Cloudflare Turnstile. See
> [[Known Gaps and Debt]].

`volunteer_applications` and `legacy_volunteer_applications` hand-roll their role
check inline (`members.role = ANY(ARRAY['director','hod','super_admin'])`) rather
than calling `is_director()` — the same drift the codebase forbids in TypeScript.

## Funnel instrumentation

`lib/funnel.ts` tracks four Vercel Analytics events — `signin_started`,
`signup_profile_started`, `signup_profile_completed`, `signup_awaiting_approval`
— covering the **OAuth** funnel, not these forms. The file is emphatic that **no
personal data** goes into events: members are students, many of them minors.

There is currently **no instrumentation on these intake forms at all** — nobody
knows the submit or drop rate on `/contact` or `/collaborations`.

Related: [[Flow - Signup and Approval]] · [[Desk - Intake]] · [[Flow - Public Visitor Journey]]
