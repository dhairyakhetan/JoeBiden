# Opportunities — `/opportunities`, `/opportunities/:id`

**Files:** `public/OpportunitiesPage.tsx` (884 lines), `public/OpeningDetailPage.tsx` (255 lines).

## What these pages are

**Intent:** a prospective volunteer deciding which specific role to apply for, and (for leaders) managing the postings and reading applications.

## What's genuinely working

`OpeningDetailPage`'s own comment states the design thesis plainly: *"The page described the role in detail and then said nothing about what applying costs you or what comes back. For a teenager who has never applied to anything, 'Apply →' with no stated outcome is a reason to close the tab, not a call to action."* — and then actually fixes it with a `HowItWorks` explainer stating the real steps and a real timeframe. This is the single clearest statement of this whole audit's central lens found anywhere in the codebase, written by whoever built this page, independently. The `JobPosting` structured data on both pages is deliberately restricted to fields the org can honestly claim (`employmentType: VOLUNTEER`, no salary or remote-work fields fabricated) and is only emitted at all once the required fields are genuinely present. The reload logic's comment names a real, previously-shipped bug precisely: a single failed fetch with no retry left the page "sometimes blank until you refresh a few times," and the fix keeps the last-good list on screen rather than wiping it on a transient error.

## Findings

### P2 — A required-field asterisk uses the brand accent color instead of the danger color used for the identical marker elsewhere in the same file
`ApplyModal`'s phone-number label renders its required marker as `<span style={{color:'var(--accent)'}}>*</span>` (green), while `OpeningFormModal`'s category label — a few hundred lines away in the same file — renders its own required marker as `<span style={{color:'var(--danger)'}}>*</span>` (red). Same meaning, same file, two different colors. Small, but worth aligning to one convention so "required" reads consistently everywhere it appears.

### Nothing further to flag
Both pages correctly cover the states this audit checks for: an empty-board state that still gives a logged-out visitor two real paths forward (apply generally, read the handbook) rather than a dead end; auth-aware CTAs that swap to "log in to apply →" instead of hiding the action entirely; and a "general application" fallback CTA for a visitor whose interest doesn't match any currently-open role. This is close to the reference implementation for how the rest of the site's action-oriented pages should read.
