# Teams — `/teams`

**File:** `teams/TeamsPage.tsx` (358 lines), `TeamsPage.css`.

## What this page is

**Intent:** a prospective or current member picking a department to actually join, or checking who's already on one.

## Current design

A hero with an upfront "how joining a team works" explainer (three steps), an "open roles" banner when postings exist, category filter chips, and a grid of team cards (colored header band, bio, roster or a roster-substitute, "View team →").

**Working well:** the `HowItWorks` explainer is a direct, named fix for a real problem — the comment states it plainly: *"Browsing teams posed the same unanswered question the login page used to: 'what happens if I press this?'"* Answering it up front, before the click, is exactly the kind of intent-first sequencing this whole audit is built to reward. The card-color fix (`deptColorForTeamName` before falling back to the colliding `CAT_COLORS[category]` lookup, since 8 teams share only 5 category values) is a specific, correctly-diagnosed fix, not a guess.

## Intent-driven affordance audit

### P1 — The file's own stated honesty rule ("nothing here invents a number") is contradicted by its own fetch-failure fallback
The component's comment is unambiguous about the design intent: real roster counts are thin (per the comment, "five of the eight teams return 0 and the rest return 1" today), so rather than show an embarrassing "0 members" four clicks from a nav claiming 1,200+ members, cards below a 3-member threshold (`hasRoster = count >= 3`) show "taking applications" instead of a fabricated or literal tiny number — a correct, deliberate honesty call, explicitly stated: *"nothing here invents a number."*

But `SAMPLE_TEAMS` — the fallback rendered specifically "only for a dead-database render," per its own comment — does exactly the thing that rule forbids: it ships confident, specific, fabricated member counts (40, 60, 20, 25, 15, 12, 10, 18) with no visual distinction from real data, triggered silently whenever `teamService.getTeams()` merely fails (not just when it's empty). A visitor who happens to load this page during a transient fetch error sees a fully-populated, specifically-numbered team roster that is entirely invented, with no error state shown at all. This is a real, narrow, but genuine contradiction within the same file's own stated principle — worth either dropping the specific counts from the sample data (mirroring the honest `hasRoster` treatment) or showing a real error state instead of a silent fake-data substitution.

### Observation — the honest "taking applications" fallback is, today, the only state any visitor actually sees
A direct consequence of the roster-count reality described above: since no live team currently clears the 3-member threshold, every real team card today shows "taking applications," not the "★ N strong" badge + stacked-avatar treatment the component clearly invested in building. Not a fault — this is the correct behavior given real data — but it's the same "built-ahead-of-content, unexercised in practice" pattern flagged on the Blog Post page (verse-detection logic) and Home (the sample-post fallback path): the more visually rewarding code path here isn't the one anyone currently sees.
