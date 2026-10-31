# HoD Desk — Team Management, SOPs & Goals, Drive Management

**Files:** `director/TeamManagement.tsx` (392 lines), `director/SopManagement.tsx` (579 lines), `director/DriveManagement.tsx` (190 lines).

## What these desks are

**Intent:** creating/editing the org's teams, tracking standing procedures and deadlined goals per department, and assigning a real lead to each welfare drive so attendance gets taken instead of staying "on paper."

## What's genuinely working

**TeamManagement** removes a genuinely dead write path — a legacy "mirror to a second Supabase project" call that nothing ever read, since `TeamsPage` and `teamService` both already read from the real one — and fixes a real, silent failure: auto-assigning a new team's creator as its lead used to run through a raw `.eq('auth_uid', ...)` filter that started throwing once `authenticated` lost `SELECT` on that column in a security-hardening pass, silently skipping the auto-assign. It's now routed through a `SECURITY DEFINER` RPC (`get_own_member()`) instead. Categories are sourced from one canonical list (`lib/categories.ts`) after the comment notes this exact list used to be hand-duplicated here and in `directorService.ts`, silently drifting.

**SopManagement** is unusually disciplined about a subtle content-integrity problem: `isRealTask()` filters out leftover placeholder rows ("n/a," "tbd," "-") from a historical data import so they never render as if they were real procedures — a deliberate, narrow anti-slop guard for imported legacy content specifically. Procedures and goals are kept as two genuinely separate render paths per the desk's own spec ("never merge them into one list"), rather than one generic table pretending they're the same kind of row.

**DriveManagement** frames its entire purpose in one honest phrase — drives without an assigned lead are "still on paper" — which is a sharper, more consequential way to say "no lead assigned" and correctly implies the real-world stakes (no lead means no real attendance record).

## Findings

### P1 — SOPs' urgency labels invert the near-universal "P1 = highest priority" convention, with no visible correction anywhere in the UI
`SopManagement.tsx`'s own comment admits this directly: *"P3 tomato, P2 lemon, P1 paper... unusual next to typical P0/P1 severity conventions, but this is the spec's literal colour table — P3 reads as the hottest/most urgent chip, P1 the calmest."* That's the opposite of how P1/P2/P3 is used almost everywhere else (P1 = drop everything, P3 = whenever) — including, plausibly, whatever other tools directors already use. Nothing in the rendered page — no legend, no tooltip, no label text — tells a director this desk's numbering runs backwards. A HoD glancing at a "P1" goal chip will very reasonably read it as the most urgent one in the list, based on convention alone, when it's actually the calmest. Either add a one-line legend near the urgency filter/chips ("P3 = most urgent"), or reconsider fighting the near-universal convention at all.

### P2 — A stale code comment claims a real, live feature "isn't wired into routing"
`DriveManagement.tsx`'s file comment describes `DriveCheckIn.tsx` as "a member-facing check-in sheet, not yet wired into routing." `App.tsx` already defines real routes for it (`/drive/:id/check-in` and `/drive/:id/wrap`, both protected). This is a documentation-drift bug, not a user-facing one — but it's exactly the kind of stale claim that could lead a future contributor to skip verifying a working flow, or worse, to "finish" wiring something that's already live. Worth a quick correction pass.
