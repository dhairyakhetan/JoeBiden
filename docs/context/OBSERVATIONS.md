# Observations (not instructions)

Things noticed while mapping the site on 2026-10-08. **None of these is a task.** The routine does
not build from this file: work comes from bug reports and the sheet. Use it to recognise a real report
when one arrives, and to mention a pattern in the weekly digest. Each item says whether it was
confirmed in code by the author or only reported by a read-only pass.

## Confirmed in code by the author

- `games/games.ts` exports `GAMES = []`, yet `components/AQNav.tsx` links to `/games` in the menu: a visitor reaches an empty hub.
- `directorService.approvePostCategory` has no caller in `src`, so per-category approval is not wired: a post is published whole by `approvePost`.
- `public/AccountsPage.tsx` writes `ledger_comments` from the browser. Whether RLS allows an anonymous insert, and whether comments are moderated, was not checked.
- No `archived` handling exists in `auth/AuthCallbackPage.tsx`, `auth/HomeRoute.tsx` or `auth/ProtectedRoute.tsx`: an archived member may land on the recovery card with no way forward (not run).
- No `id="story"` found in `public/AboutPage.tsx`, though `DirectoryPage` links to `/about#story` (a dead anchor, not seen in a browser).

## Reported by a read-only pass, not confirmed

- `/join` has no in-app link; only the route and its metadata reference it.
- `lead` is no longer a member role (retired 2026-09-15) but per-team `team_members.role = 'lead'` still drives join-request alerts, and `lib/roles.ts` still labels it.
- The `hr` self-lockout guard in `lib/capabilities.ts` depends on a migration its comment says is not applied.
- Org-account posts return before the follower notification step, so followers may not be told (inferred from code order).
- Break state is read differently by `HomePage` (needs a start and a future end) and `ProfilePage` (end only).
- A leader's category scope for post moderation is a UI query filter; the posts RLS has no category clause (per `Known Gaps and Debt.md`, S4).
- Certificate hours can be a floor when attendance records are thin, and nothing repairs it.
- There is no bulk approve for members or posts; bulk reject and bulk hiring status exist.

## Process notes

- A mapping subagent accidentally started a stray remote session while working. Subagents must be read-only and must not call session tools.
- The accent-lint ledger holds one outstanding entry (`src/public/AboutPage.css:728`), owned by the redesign lead.
