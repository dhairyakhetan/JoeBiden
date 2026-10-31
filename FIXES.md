# AquaTerra — live fix log

Running list of issues found by using the site, and what happened to each.
Newest first within each section. Kept in the repo (not chat) so nothing gets
lost between sessions.

**Status:** ⬜ reported · 🔧 in progress · ✅ fixed & verified · 🚢 shipped to main
· ⚠️ needs a decision from Kanishk · ⏭️ won't fix (reason given)

---

## Open

_(nothing yet — add reports here as they come in)_

| # | What's wrong | Where | Status |
|---|---|---|---|

---

## Waiting on Kanishk

| # | Item | Why it's blocked |
|---|---|---|
| B1 | **Run the HR data import** | Needs `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Settings → API → `service_role`). Schema is live but empty. Dry run: 1,937 contacts / 166 preauths / 89 SOPs. Command is in `frontend/scripts/hr_sheet_retirement_2026_09_02.sql`. |
| B2 | **Member PII in git history** | All four HR workbooks were committed in `72c28f5`, pushed to `origin/claude/redesign-handoff-2026-08-31`. Gone from HEAD but recoverable from history — ~2,360 students' emails and phones, many minors. Repo is private (404 unauthenticated), which contains it but doesn't remove it. Purging is a force-push: your call. |
| B3 | **Approve the v7 design language** | Branch `design-spike/home-feed`. Everything else in the redesign waits on this. |

---

## Done since the 2026-09-02 deploy

| # | Item | Status |
|---|---|---|
| D1 | Revoke `members.UPDATE(email)` — deferred until the new frontend was live, since the old one still sent it | ✅ done post-deploy; verified zero SELECT/INSERT/UPDATE grants on `members.email` for `authenticated` and `anon` |
| D2 | Canary routes verified against production after the deploy | ✅ `/`, `/login`, `/director`, `/post/abc`, `/my-posts`, `/privacy-policy`, `/member/abc` all 200 |

---

## Shipped 2026-09-02 (merge `b76fb69`)

Production breaks that were live before this deploy:

| Item | Detail |
|---|---|
| Yearbook was throwing | `yearbook_entries` never existed; feature shipped in `bb30ba0` |
| Logged-out homepage showed fabricated content | `if (false && …)` discarded the real feed for `SAMPLE_POSTS` |
| Failed image uploads reported success | post published text-only, button still said "✓ posted!" |
| Four writes reported success when RLS blocked them | `teamService` ×3, `achievementService` |
| First-time login could loop forever | no error shown at any point |
| `/my-posts` unreachable + rejection notice had no link | rejected authors had no path forward |
| Self-promotion to team lead | writable `members.email` + `claim_member_preauth` matching on it |
| Minors' profiles indexable as bare URLs | `Disallow` without `noindex` |
| Homepage `h1` was "the feed." | on the page targeting "student-led NGO Kolkata" |
| Entry CSS 31.8 → 19.6 KB gz | Tailwind moved into the lazy `/paradox` chunk |
| Mascot ran a permanent 60fps forced-layout loop | now settles and stops |
| HoD sort control stranded ~330px below its results on mobile | `DataToolbar` `actionsInline` |

---

## The people model (agreed 2026-09-02)

Four separate things, often conflated:

| Thing | What it is | Count |
|---|---|---|
| `aq_contacts` | Contact archive. People HR has details for. **Most have no account.** | ~1,955 |
| `member_preauth` | Expected to join. Claimed automatically on their first Google sign-in. | 166 |
| `members` | Real accounts. `status` = pending_approval → active. | 1,369 |
| `team_members` | Which member is on which of the 8 departments. | 93 today |

**Two different "roles", and they are not the same field:**

- `members.role` — org-wide standing: `member` < `lead` < `hod` = `director` < `super_admin`.
  Only `hod`, `director`, `super_admin` pass `hasLeaderAccess()` and reach the
  HoD desk. **`lead` does not** — it is team-scoped only.
- `team_members.role` — standing on ONE department: `member` or `lead`.

So a person can be `members.role='member'` org-wide while being
`team_members.role='lead'` of Social Media: they run that team, but they cannot
moderate the org.

**Core = HoD.** The 46 rows in Core Records get `members.role='hod'` (org-wide
moderation) **and** `team_members.role='lead'` on each department they list.

### Decisions

| Question | Decision |
|---|---|
| 5 core rows whose only department is ALUM | **Not promoted.** Stay `member`. Promote individually from the desk if wanted. |
| 7 core rows with no department listed | **Promoted to `hod`**, no team membership until a department is filled in. |
| Role when accepted into a team via hiring | **Always `member`.** A lead promotes them afterwards. |
| Core members on their departments | **`lead` on each** department they list. |
| "Rotaract" as a department | Not an AQ team — a partner org. Reported, never guessed at. |

---

## Notes

- Ship gate before every merge to `main`: `tsc -b` clean → `npm run build` clean
  → `npm test` if a covered file moved → canary routes 200 against production.
- `main` is the live Vercel branch. Every push deploys.
- Migrations are manual. A `.sql` file in the repo is **not** evidence it ran —
  this project has been burned by that four times. Verify against the live DB.
