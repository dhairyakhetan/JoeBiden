# Shared Shell — Nav, Footer, Layouts, Core Primitives

Not a routed page — this covers the chrome and primitives that wrap every audited page (`AQNav`, `AQFooter`, `PublicLayout`, `DashboardLayout`, `Button`, `Card`, `Modal`, `EmptyState`). Referenced by every page file below rather than re-explained per page.

## What's genuinely working

- **Button** is a strong primitive: touch targets enforced by `min-h` (40/44/52px) rather than convention, category-tint variants pre-written as static classes so Tailwind JIT actually emits them, disabled state visually distinct (opacity + no shadow + no lift), loading state swaps in a spinner and sets `aria-busy`. This is the kind of systemic care that makes affordances predictable everywhere it's used.
- **EmptyState** gives every "nothing here" screen one voice (title + warm hint + optional action) instead of each page inventing its own. Good — a template for intent (tells the user what to do next, not just that there's nothing).
- **Skip-to-content link** and `main` landmark with `tabIndex={-1}` are present in both layouts — real accessibility infrastructure, not just a token gesture.
- **DashboardLayout's `.admin` gating by path** is a deliberate fix for a real shipped bug (bookmarking a director sub-route used to render brand chrome instead of desk chrome) — good catch, documented in its own comment.
- The nav's realtime unread-count subscription and head-count-only query show real attention to perceived performance, not just visual polish.

## Intent-driven affordance audit

**Primary intents at the nav:** (1) get to a top-level section fast, (2) find something less common ("explore"), (3) act on my account (notifications/profile), (4) a visitor deciding whether to join.

### P0 — The "explore" quick-menu is a menu that opens another menu for anything not in its own short list
`AQNav.tsx`'s `showDrop` panel lists only home/projects/teams/blog/members/openings/about... actually **omits About** from the compact 7-item `dropLinks` array (`home, projects, teams, blog, members, openings` — no About) while advertising an **8th action, "full menu ⌤,"** whose only job is to open the *actual* full list (the mega menu on desktop). A user who wants About, FAQ, Support, Collaborations, Schools, Classes, Crftd, Equity Policy, or Quick Links has to: open the compact dropdown → notice their target isn't there → click "full menu" → re-scan a denser grid. That's two disclosure levels for a link list that isn't large enough to need one. On mobile this is worse: `.aq-drop-full` is hidden by CSS (`@media max-width:767px { .aq-drop-full { display:none } }`) with a comment admitting it's "a redundant second path to the identical destination" as the hamburger — meaning mobile users get the *same* short list with no visible way to reach About/FAQ/Support/etc. from this control at all; they'd need to already know the hamburger and the "explore" pill open different things, or stumble into the footer.

**Fix:** either make the compact dropdown the *actual* full link list (it's not visually cramped — a 260px-wide 2-col grid handles 12-14 items fine) and delete the mega-menu redundancy, or clearly label the compact menu as partial ("popular" / "shortcuts") so users don't read it as exhaustive and give up.

### P0 — Three separate hamburger-shaped buttons, all wired to the same `showDrop` state, with no clear reason a fourth control ("MENU") exists alongside them
`aq-hamburger-left-btn`, `aq-hamburger-btn` (id `aq-hamburger`), and the desktop-only `aq-menu-btn` all call `setShowDrop`. CSS presumably hides the redundant ones per breakpoint (mobile hides the desktop MENU text-button; one of the two hamburger icons is probably also hidden), but three hand-rolled triggers for one piece of state is a maintenance and consistency risk — a future edit to "close on click" or aria state is one `setShowDrop` away from being wired inconsistently across the three. Consolidate to one trigger component parameterized by position, not three copy-pasted buttons.

### P1 — The unauthenticated CTA says "Apply →" to everyone, including someone who just wants to log back in
The comment in the code names this directly: *"A distinct nav-level 'Log in' vs 'Apply' split is a Phase 9 design-pass decision, not a routing one."* A returning member's intent at the nav is "sign back in," not "apply" — "Apply" reads as a fresh-application prompt and is the wrong verb for that intent, creating a moment of doubt ("wait, do I have to re-apply?") for exactly the audience (returning members) who should have the most frictionless path back in. This is a one-line copy fix once the audience is known client-side (which it partially is — `isAuthenticated` already branches the whole block; a `returningVisitor` localStorage flag already exists and is explicitly *not* read here, per the comment).

### P1 — A permanent "NEW" badge on the HoD Desk nav link
`<span className="chip" style={{background:'var(--lemon)'...}}>NEW</span>` next to "HoD Desk" has no time-based or dismissal logic — it's the same "showHodPulse" pattern (which *does* clear once visited, via `aq_hod_visited` in localStorage) sitting right next to a badge that never clears. A "NEW" tag that's always new stops meaning anything and teaches directors to ignore badges generally, which weakens the one pulse-dot that *is* meaningfully time-limited two pixels away.

### P2 — Footer's sequential 01–19 numbering is decorative complexity with no payoff
The four footer columns number every link 01 through 19 across columns (fixed in a past pass from a broken per-column formula). It's on-brand (mono/scrapbook), but it doesn't correspond to visual reading order (col 1 is 1-3, col 2 is 4-8, etc., not a left-to-right, top-to-bottom count a user would predict) and adds nothing functionally — a link either helps wayfinding or it's noise. Low cost, low priority.

## Systemic fault carried into every modal in the app

### P1 — `Modal` renders its close button only when a `title` is passed, and at least one real usage exercises exactly that gap
`Modal.tsx`: `{title && (<div>...<button onClick={onClose}>×</button></div>)}` — the header block, including the only *visible* close affordance, doesn't render at all without a title. `teams/JoinRequestModal.tsx` calls `<Modal title={submitted ? '' : \`Apply to Join ${teamName}\`} ...>` — meaning the moment a user successfully submits a join request, the modal's title (and with it, the × button) disappears. The user's intent at that exact moment — "okay, I'm done, close this" — has no visible affordance; they're left to discover Escape or a backdrop click, neither hinted at anywhere in the panel. This is the affordance audit's core failure mode: an intent with no visible path. Every page that reaches this modal (Team Detail's join flow) inherits the bug. Fix at the source: `Modal` should always render a close control, with `title` only controlling whether a heading *also* appears next to it.
