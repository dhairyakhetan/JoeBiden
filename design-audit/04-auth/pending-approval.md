# Pending Approval — `/pending`

**File:** `auth/PendingApprovalPage.tsx` (456 lines), `PendingApprovalPage.css`.

## What this page is

**Intent:** someone who has just applied and is waiting — the single highest-anxiety, highest-trust-sensitivity moment in the whole funnel, since this is where "is this org even real" gets tested against real evidence (or the absence of it) for the first time.

## What's genuinely working

This page's most important fix is a trust-specific one, and its own comment names the stakes precisely: the feed preview here used to silently render the same `SAMPLE_POSTS` fixture as the homepage's empty-state fallback (invented students, invented numbers — "847 attendees," "₹24,300 raised") but *without* the homepage's "sample preview" caption. The comment states the consequence directly: *"someone waiting on approval — deciding whether the org they just applied to is real — was reading fabricated activity as the live feed."* The fix tracks which source is showing and captions honestly. This is the single best-targeted anti-fabrication fix found anywhere in this codebase, because it's the one place a fabricated-data slip would have done the most damage to exactly the trust this audit's "intent" lens cares about.

Also well done: the 30-second auto-refresh of membership status, the skippable 3-2-1 approval countdown (never a hard-coded blocking delay — `?skipCountdown=1` exists specifically so automated checks aren't stuck behind it), and the locked, disabled "share what you're working on…" composer previewing exactly what unlocks on approval rather than just saying so in text.

## Findings

### P2 — The sticky review banner runs two independent "status" indicators that could drift apart
A pulsing green dot + "your account is under review," a lemon "pending approval" sticker, and a separate mint "checking status automatically…" sticker all sit in the same banner, each communicating a slightly different fact (the account's state vs. the polling mechanism's state). The comment shows this was a deliberate choice ("distinct from the 'checking...' sticker, which describes the polling mechanism, not the status itself"), which is reasonable, but three simultaneous status affordances for one wait-state is on the edge of over-explaining a simple fact. Not a fault, worth a glance during the energy/boldness pass — this banner could likely say the same thing with one strong sticker instead of two.
