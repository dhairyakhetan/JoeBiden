# Search — `/search`

**File:** `search/SearchPage.tsx` (467 lines, no dedicated CSS).

## What this page is

**Intent:** the app's universal "find it" tool — reachable via ⌘K from anywhere — for posts, members, teams, projects, schools, or classes.

## What's genuinely working

Real server-side full-text search across six entity types in one call, with per-branch error resilience (a schools RLS hiccup doesn't blank out members or posts that loaded fine — the comment states this explicitly). The page deliberately skips its own route-enter animation, with a precise, correct reason: search is opened via ⌘K "dozens of times a day," and an entrance animation on a keyboard-triggered action "reads as lag, not polish." That's an unusually sharp, correct call most of this codebase's sibling pages don't need to make (they're navigated to, not summoned).

## Findings

### P1 — Filtering to a single result type doesn't unlock more results, even though the count implies there are more
Every result section (`posts`, `teams`, `projects`, `schools`, `classes`) renders its header count from the real total (e.g. "posts (15)") but then hard-caps the rendered cards at `.slice(0, 6)` or `.slice(0, 8)` — and critically, that slice is unconditional, applied identically whether `type === 'all'` or the viewer has filtered down to that one type specifically. So switching the type chip from "all" to "posts" does not reveal the other 9 of 15 matching posts — the render cap doesn't know or care which view mode is active. The chip's own count (visible in its label, e.g. "posts (15)") actively tells the user there's more to see, and picking the one filter that should show it does nothing. Either make the per-type filtered view lift the slice cap (up to the service's real limit of 20), or add a real "see all N →" affordance per section.
