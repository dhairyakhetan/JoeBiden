# Classes — `/classes`

**File:** `public/ClassesPage.tsx` (125 lines, no dedicated CSS).

## What this page is

**Intent:** a member wanting to find peers in their own school year, or a visitor exploring the peer-tutoring program.

## Current design

A live-computed grid of "cohorts" (grouped from real `members.class_grade` values, not a static list), each clickable, plus a closing peer-tutoring CTA (apply to teach / request a class).

**Working well:** cohorts are genuinely derived from live data client-side (counted, sorted by size) rather than a hand-maintained list — this avoids the exact staleness risk flagged on the Collaborations partner wall. The `<details>`-adjacent color-contrast fix on "class of" (backing it with a solid lemon chip + near-black ink instead of yellow serif text directly on the cream page background, which the comment measures at 1.36:1) is a specific, correctly-reasoned accessibility fix, not a guess.

## Findings

### P2 — Tapping a cohort routes to a generic search, not a dedicated view
Each cohort card's intent is specific ("show me the people in Class 11"), but the click target is `/search?q=<class>&type=members` — a general search results page rather than a purpose-built roster. Given there's no `classes` table (per the page's own comment, `class_grade` is free text), this is a reasonable stand-in, but it does mean the fidelity of the answer depends entirely on whether `/search` actually honors `type=members` and produces a clean, class-scoped result set rather than a noisy general search (checked separately in the Search page audit).
