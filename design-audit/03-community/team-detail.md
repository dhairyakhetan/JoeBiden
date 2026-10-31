# Team Detail — `/teams/:uuid`

**File:** `teams/TeamDetailPage.tsx` (1069 lines, orchestrates `teams/detail/{AboutTab,MembersTab,PendingPostsTab,OpeningsTab,ApplicationsTab,ResponsesTab}.tsx`).

## What this page is

**Intent:** varies sharply by viewer — a prospective joiner deciding whether to apply, a member checking team activity, or a lead/director running the team's recruitment and moderation.

## What's genuinely working

This is the deepest, most feature-complete page in the audit, and the engineering discipline holds up under that weight: a banner-image existence check uses a detached `Image()` probe specifically because the SPA's catch-all rewrite answers a missing image with a 200 HTML response, which never fires an `<img>`'s `error` event and would otherwise leave a broken-image box rendered forever; the openings fetch races a timeout against the query itself because the real failure mode observed was a *hang* (Supabase session-restore stalling), not a thrown error, so a naive retry-on-catch would never even see it and retry; per-opening "did I apply" state is deliberately filtered to the viewer's own applicant ID rather than trusting "any row came back," because a director/HoD viewer's RLS-visible rows include *everyone's* applications, not just their own. Each of these is a real, previously-live bug described precisely in its own fix comment — the codebase is unusually good at recording why, not just what.

## Findings

### P1 — The "About" tab's activity ticker isn't actually interleaved by date, despite its own comment saying it is
The comment directly above `aboutTickerItems` states the goal: *"team's own posts + the welfare projects it ran, interleaved most-recent-first so the strip reads as one activity feed rather than two separate lists bolted together."* The actual construction is `[...teamPosts.slice(0,6)..., ...teamProjects.slice(0,6)...]` — a plain concatenation, posts always first and projects always second, with no date-based merge or sort step at all. If a team's most recent activity is a project rather than a post, the ticker will still show up to 6 (possibly older) posts before it. Either add the sort the comment describes, or correct the comment.

### P2 — A "database not set up" error screen shows a raw SQL filename to any visitor who can trigger it
The `db_not_setup` fallback state instructs the viewer to "Run `community_supabase_teams_setup.sql` in your Supabase SQL editor" — clearly written for a developer/self-host context. The surrounding comment shows this was already narrowed once (permission errors were mis-triggering it and got carved out into `not_found` instead), which is good, but the branch itself is still reachable and, if it is, leaks real backend implementation detail (the hosting provider, a specific setup script name) to a public, unauthenticated visitor. Worth routing this to the same generic "team not found" state in production and keeping the detailed message behind a dev-only flag.

### Worth a second look — a manage popover's styling comment points to the opposite of what the neighboring modal argues
`OpportunitiesPage.tsx`'s `OpeningFormModal` comment explicitly states this class of modal should use the brand's neubrutalist shell, *not* the flat `--hod-*` admin look, because it's rendered on a public/member route. Its sibling `ManagePopover` in the same file cites "see the note in OpeningFormModal above" while doing the opposite — reaching for `var(--hod-surface-1, var(--card))` and friends. In practice this likely resolves safely (the `--hod-*` tokens are scoped under `.admin`, so outside that scope the fallback values apply and the popover renders in brand style anyway) — but the comment's claim of consistency with OpeningFormModal is backwards, which is worth fixing so a future edit doesn't trust the wrong precedent. (This lives in `OpportunitiesPage.tsx`, not this file, but surfaces from the same audit pass — noted here since Team Detail's own opening-management surfaces share the pattern.)
