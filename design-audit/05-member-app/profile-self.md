# Profile (self / member view) — `/profile/me`, `/profile/:uuid`

**File:** `profile/ProfilePage.tsx` (515 lines). Distinct from `profile/PublicProfilePage.tsx` (`/member/:uuid`, audited separately) — this component serves the authenticated self-view and the authenticated member-to-member view (no follow graph; instead break status, points ledger, hours/certificate tracking — features that make sense only inside the logged-in community, which is a real, justified reason for the two profile components to differ rather than share one).

## What this page is

**Intent:** checking your own standing (points, hours, achievements) or a fellow member's, inside the authenticated app.

## What's genuinely working — the most disciplined anti-fabrication code in the audit

Several separate, deliberate choices all point the same direction: never show a number or state that isn't real.
- Achievement count for a profile you're *not* the owner of counts only `status === 'approved'` — pending/rejected submissions stay private to the owner, so a public stat card can't leak how many unapproved claims someone has made.
- "Likes earned" calls a real lifetime-aggregation method specifically because an older version "summed only the first page" (per the comment) — an undercount masquerading as a total.
- `membershipDuration()` is computed straight from `created_at` and returns `null` below one month rather than rounding down to a number that reads as real but isn't ("0 months" or "less than a month" would both be worse than showing nothing).
- The achievements tab always renders the real, interactive component for the owner — even at zero achievements — specifically so the "+ Add achievement" action stays reachable; a *visitor* viewing someone else's empty achievements gets honest text instead, with the comment explaining exactly why: a decorative mock grid there could be mistaken for real badges that person holds.

This is the standard the "anti-slop" direction is asking for, already built. Worth using as the internal reference when writing fix recommendations for pages that don't hold this line as well.

## Findings

### P2 — "On a break" status is hidden from everyone except the member themselves, even though only the action needs to be
The break banner ("on a break · back on {date}") is gated entirely behind `isOwn`, with a comment explaining that *starting or ending* a break is rightly member-initiated only. But that reasoning only justifies restricting the **action** — it doesn't explain hiding the **read-only status** from a teammate or lead who's checking whether someone is currently active. A team lead viewing a member's profile to gauge availability currently has no way to see this at all outside their own profile. Split the gate: show the status to any viewer, keep the start/end controls owner-only.
