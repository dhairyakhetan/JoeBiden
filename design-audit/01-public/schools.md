# Schools — `/schools`

**File:** `public/SchoolsPage.tsx` (55 lines, no dedicated CSS).

## What this page is

**Intent:** a school administrator or student rep considering whether to bring a campus chapter to their own school.

## Current design

Three pillar cards (campus chapters / inter-school collabs / certificates) and one CTA block ("bring AQ to your campus" → start a chapter / talk to us). Short, single-purpose, no filler.

**Working well:** the page's own comment explains a real, good restraint decision — there's no public school directory yet (the `schools` table is empty), so rather than fabricate placeholder school names/logos to look more populated, the page tells the real story of the program and routes straight to the collaboration flow. That's the right call, and it's rare enough to be worth naming as a model for the rest of the site (contrast with Collaborations' hardcoded partner wall, flagged separately, which took the opposite approach).

## Findings

### P2 — The three pillar cards' intended "resting tilt" never renders
Each card sets a `--card-rot` custom property (`${i % 2 ? -0.6 : 0.6}deg`) intended to give it the scrapbook-tilt signature used throughout the site. But in `v6.css`, `var(--card-rot)` is only read by the `.card-hover` selector (`.card-hover { transform: rotate(var(--card-rot, 0deg)) }`) — these cards use plain `className="card"`, which never references that variable. The three cards render perfectly square. Compare `RootsPage`'s drop cards and `ClassesPage`'s cohort cards, which correctly use `"card card-hover"` and do tilt. One-line fix: add `card-hover` to the className (harmless here even though these cards aren't clickable — `.card-hover` only adds the transform + a hover lift, not an implied link).
