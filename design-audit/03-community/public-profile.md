# Public Profile — `/member/:uuid`

**File:** `profile/PublicProfilePage.tsx` (690 lines).

## What this page is

**Intent:** checking out a specific person — a fellow member deciding whether to follow/connect, or a visitor evaluating a specific volunteer's real contribution.

## Current design

A hero (avatar, role/join-date/school chips, follow/share actions, five stat counters) over four tabs (Posts / Tagged / Achievements / About), plus a "builders alongside" rail of shared-team peers.

**Working well — two things worth real praise:**
- The "Tagged" tab exists specifically because a volunteer who shows up consistently but never posts personally would otherwise present an empty, contribution-free profile — the fix (surfacing posts where they're tagged, not just authored) directly serves the person the feature is for, not just a engineering nicety.
- The JSON-LD `Person` schema is deliberately restricted to name, role label, bio, and avatar — the component holds email, phone, school, and class in memory but explicitly excludes them from what gets published to search engines. This is the correct, privacy-conscious counterpart to the issue flagged on the Equity Policy page (personal phone numbers published in the open) — worth noting the codebase clearly knows how to do this right when it thinks about it.
- "Builders alongside" (shared-team peers) is a genuinely distinctive feature or the profile: it answers "who does this person actually work with" rather than stopping at their own content, which fits the org's own stated value ("community is the point," per the About page's principles) better than a typical profile page would.

## Findings

### P2 — Two separate "join AquaTerra" CTAs stack in the same screen for logged-out visitors
The hero's action slot shows "Find your people here →" (→ `/login`) for a logged-out viewer, and immediately below the hero, a full-width yellow banner repeats the ask with different copy ("join AquaTerra to interact with {name} and 1,200+ members," → `/login` again). Both are visible without scrolling. Not harmful — the intent is consistent — but it's two versions of the same message competing for attention in one viewport, where one clear ask would read as more deliberate.
