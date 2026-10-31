# About — `/about`

**File:** `public/AboutPage.tsx` (515 lines) + `AboutPage.css`.

## What this page is

**Intent:** a skeptical or curious visitor deciding whether the org is real, legitimate, and worth their time — and, if convinced, a way to act on that.

## Current design

A 200vh scroll-jacked hero (sticky dark panel, huge type, floating decorative cards) into a dark "impact" stats section, then a marquee band, then conventional sections: origin story, "what AquaTerra actually is" (NGO/Crftd/Ventures/ShikshAQ), four values, a six-year timeline, a department grid, founders quote + DARPAN registration, and a final CTA card.

**Working well:**
- Real credibility signals throughout: DARPAN registration number stated twice (own section + footer elsewhere), a named "self-funded, zero donations" claim repeated consistently, a dated origin story with specific detail ("11 June 2021," "Sundarbans relief trip") rather than vague founding-myth language.
- `DynamicIslandTOC` gives this specific long page a floating jump-menu — the right call for its length, and not over-applied to shorter pages.
- Department cards are real, working affordances: `role="button"`, keyboard-activatable (`Enter`/`Space`), not just divs with an `onClick` — accessible by construction, not retrofitted.
- Decorative motion (floating cards, spinning badge) is either gated behind `isMobile || shouldReduce` per-instance, or (for the ones that aren't, like `SpinBadge`'s inline rotation) still caught by the app-wide `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important } }` catch-all in `v6.css` — checked, this genuinely neutralizes it. No reduced-motion gap here.
- The bottom CTA's "2 minutes to apply. Usually replies within a week." is not a one-off — it's `APPROVAL_TIME` from `lib/orgFacts.ts`, a shared constant. That file's own comment explains this was previously a real drift bug (24 hours on one screen, a week on the next) and was deliberately resolved to the slower, honest figure everywhere. This is the right call for an org whose pitch is "we're straight with people," and it's now applied consistently (About, FAQ, Home all cite the same figure) — worth calling out as a strength, not just clearing a flag.

## Intent-driven affordance audit

### P1 — Eight distinctly-labeled department cards all lead to the exact same, generic destination
"the departments" section renders 8 cards — each with its own initials avatar, name (Welfare, Content, Ops, Labs, etc.), and stat line — inviting a visitor to pick the one that matches their interest. Every card's `onClick` is identical: `navigate('/teams')`. A visitor who taps "Content" because that's the one they care about lands on the generic team list and has to re-find Content themselves — the specific choice they just made is discarded. If `TeamsPage` supports a department filter or anchor (worth checking directly — see the Teams audit), wire each card to it (`/teams?dept=content` or similar); if it doesn't yet, that's a small, high-payoff addition given the cards already do the work of asking the question.

### P2 — The headline stats appear twice, verbatim, one scroll apart
The "Impact" section's dark stats row (1,200+ members / 550+ projects / 3,500+ kids / 15,000 bananas, with a "not a typo" badge on the last one) is followed almost immediately by the Story section's stat grid — the same four numbers, the same joke badge, a different background color. Repeating a headline number across a long page (hero card, footer, etc.) is fine reinforcement; repeating the *entire set* back-to-back with no new framing reads as filler. Consolidate to one presentation, or give the second instance a genuinely different angle (e.g., per-department breakdown instead of the same four totals).

### P2 — No secondary CTA between the hero and the final "come build with us" block
The page is legitimately story-first (fine for an About page), and the persistent nav pill's "Apply →" does stay reachable throughout, which covers the core risk. But a visitor convinced early (say, right after "four values") has no on-page nudge besides that small nav button — six sections separate the point they might decide from the point the page asks them to act. A single lightweight CTA mid-page (after Values or the Timeline) would meet that reader without waiting for the bottom.
