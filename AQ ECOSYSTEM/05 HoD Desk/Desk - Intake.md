---
tags: [hod-desk, intake]
---

# Desk — Intake

`/director/hiring` · `/director/enquiries`. Both `requireDirector`.

These two desks handle **inbound humans**. Neither has a badge count, and
`DirectorLanding` deliberately omits them from "what needs you today" because
`getDashboardStats()` produces no count for them — "inventing one would be worse
than omitting it."

> [!note] That is the honest choice, and also the gap
> Two of the desk's ten director-visible surfaces have **no unread signal at all**.
> A contact enquiry can sit for a week with nothing anywhere indicating it exists.
> Adding `contact_submissions`/`collaboration_submissions` where `status='new'` and
> `job_applications` where `status='pending'` to `getDashboardStats` is a small,
> high-value change. See [[Improvement Backlog]].

---

## `/director/hiring` — HiringResponses (251 lines)

Applications to job openings.

| Reads | Method |
|---|---|
| Applications for a set of openings | `jobOpenings.getApplicationsForOpenings(ids)` |
| Applications for one opening | `jobOpenings.getApplications(openingId)` |
| Status change | `jobOpenings.updateApplicationStatus(id, status)` |

Each row carries the applicant's denormalised `applicant_name` / `email` /
`phone` (snapshotted at apply time, so they survive a member edit) plus
`custom_answers` jsonb, paired against the opening's `custom_questions`.

> [!danger] Treat the applicant identity on these rows as unverified
> `job_applications` INSERT is `CHECK (auth.role() = 'authenticated')` — **any**
> signed-in user can insert a row with **any** `applicant_id`, name and email.
> Nothing ties the row to the caller. A reviewer here cannot assume the person named
> actually applied. Fix:
> `WITH CHECK (applicant_id = get_current_member_id())`. See
> [[Flow - Hiring and Applications]].

There is **no DELETE policy** on `job_applications`, so an applicant cannot
withdraw and this desk cannot purge — only status changes.

Opening lifecycle (`pause` / `resume` / `close` / `delete_`) is managed from the
opening side, and remember pausing or closing **silently removes the opening's
feed post** via `post_feed_view`'s WHERE clause. See [[job_openings]].

---

## `/director/enquiries` — FormResponses (325 lines)

Two public inboxes in one desk:

| Table | Source form | Fields |
|---|---|---|
| `contact_submissions` | `/contact` | name, email, phone, role, message, `status` |
| `collaboration_submissions` | `/collaborations` | org_name, contact_name, email, phone, collab_type, message, `status` |

RLS on both: `anon` + `authenticated` may INSERT with `CHECK (true)`; only
`is_director()` may SELECT and UPDATE. A correct write-only-inbox pattern.

> [!warning] Nothing rate-limits the inbox
> No captcha, no honeypot, no per-IP throttle. 0 and 1 live rows mean it has not
> been abused; one scripted afternoon changes that, and the only recourse is manual
> deletion. Options: an Edge Function in front, a `created_at`-windowed constraint,
> or Turnstile. See [[Intake Tables]].

Also unmeasured: there is **no analytics instrumentation on these forms at all**
(`lib/funnel.ts` covers only the OAuth funnel), so nobody knows the submit or
abandon rate on `/contact`.

`/thank-you` is the shared post-submit confirmation route.

---

## Not in this group, but related

`/director/volunteers` — the 495-row `volunteer_applications` WhatsApp-outreach
desk — is **super-admin only** and lives in [[Desk - Admin Only]]. It is the
largest intake surface by far, and it is genuinely unrelated to the login path.

Related: [[HoD Desk Overview]] · [[Intake Tables]] · [[job_openings]] · [[Flow - Public Visitor Journey]]
