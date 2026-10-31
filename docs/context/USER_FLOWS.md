# User flows

Who is trying to do what, step by step, and where they can get stuck. Built 2026-10-08 from five
read-only passes over `frontend/src`; the same caution as `SITE_MAP.md` applies. Use it to judge
whether a change helps or breaks a flow, and to name the flow in the PR (`Flow affected:`).

## The people

| who | wants | comes from |
| --- | --- | --- |
| a student visitor (14 to 19) | to see what AquaTerra does and whether to join | a friend's WhatsApp link, Instagram |
| an applicant | to get approved and into a team | `/login` |
| a member | recognition, a team, a certificate, something to do this weekend | the feed and WhatsApp |
| a team lead or HoD | to run a team, recruit, record what was done | the desk and WhatsApp |
| a director | to approve and keep quality up | the desk |
| HR | to approve accounts and issue certificates | the desk |
| a sponsor or school contact | to trust the organisation and ask to work together | `/about`, `/projects`, `/collaborations` |

## Visitor and applicant

1. Visitor lands on `/` from a link, reads the drive stream, opens `/projects`, opens a drive, taps "come do the work with us", lands on `/login`.
2. Visitor on `/about` taps "start your application" (or a department row, which goes to `/teams?category=` without a login).
3. Visitor reads `/opportunities`, opens a role, taps "log in to apply".
4. Applicant signs in with Google at `/login`; `/auth/callback` reads their member row (`get_own_member`); with none, `ensure_member` creates a `pending_approval` row, then `claim_member_preauth` runs.
5. A missing class or an implausible phone sends them to `/register` (writes `members` directly), then `/pending`, which re-checks every 30 seconds.
6. HR or a super admin approves in the approvals desk (`approveMember`: status active, approver, time, a welcome notification). The pending page sees `active`, claims any stored referral, counts down and goes to `/`. `/choose-team` is an optional nudge.
7. Rejection lands on `/rejected` with the note; a rejected applicant waits 30 days and reapplies from scratch. A suspended or deleted member can appeal, which re-enters the same queue.

Where they get stuck: an implausible phone number, a member row that fails to load (the "almost there" card), and an applicant who does not know approval is manual and takes time.

## Member

8. Opens `/`, likes a post: a `like` notification goes to the author through `create_notification`; signed out sends them to `/login`.
9. Writes a post: a non-leader's post is `pending_review`, invisible in the public feed until a leader approves; a rejected post is edited in place, never duplicated. Welfare and event posts need a location, two or more photos, a drive link, a tagged person and a volunteer count. A failed upload aborts the whole post.
10. Opens `/teams/:uuid`, requests to join: a lead is notified, approval inserts the roster row.
11. Sets a break on the profile: writes `members.break_*` and `member_breaks`; a break is not a lock, and only HR is alerted.
12. Checks in at a drive (`/drive/:id/check-in`): offline-first, queued entries sync on reconnect and are never dropped; the drive lead completes the drive, and hours on certificates come from these records.
13. Requests a certificate: a `certificate_requests` row, HR decides, hours shown are a floor when records are incomplete.
14. Invites a friend at `/invite`: the referral is claimed when the invitee is approved, not at signup; a stale link fails silently.
15. Files a bug or a feature request at `/bugs` or with the shortcut: the database stamps who filed it; every report is worked by the daily routine, most wanted first; they follow it as waiting, being fixed, fixed, checked, can say "me too" on someone else's, and answer "did this fix it?" on the card.

## Leader and desk

16. Post moderation: a leader approves or rejects a pending post within the categories they hold.
17. Member of the Month: open the month, pick per team (several honorees per team are allowed, never the same member twice), write the citation; a pick posts to the feed. A HoD picks only for a team they are on the roster of.
18. Open roles: a team lead creates, pauses or closes an opening; applicants apply; the hiring desk sets status. Expired openings are paused when a leader's list is read.
19. Team page: HoD edits the description and cover picture; tagged posts appear on the team page automatically.
20. Bug triage: the routine takes a report up and marks it solved; a leader checks the live site and verifies, or sends it back with a reason; a leader can decline with a reason the reporter sees.

## Sponsor or school

21. Reads `/about`, `/projects` and `/accounts` to decide whether to trust the organisation, then submits `/collaborations` or `/contact` (insert, then `/thank-you`; a mail draft is the fallback if the insert fails).

## Rules these flows depend on

Google sign-in is the application. Plain member posts need a leader before they are public. Joining a
team creates a request only. Nothing scores or ranks people (points are retired). No in-app hard
delete. Destructive or bulk actions need a named human. A verified-by-record certificate beats a
claim. See `docs/PRODUCT_PRD.md` for the full list and `docs/context/AQ_CONTEXT.md` section 6 for
defaults.
