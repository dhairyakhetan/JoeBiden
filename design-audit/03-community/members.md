# Members Directory — `/members`

**File:** `public/MembersPage.tsx` (279 lines, no dedicated CSS).

## What this page is

**Intent:** browsing the community by name or role — a visitor sizing up "who's actually here," or a member looking for someone specific.

## Current design

Search (debounced, sanitized against filter-injection via `sanitizeFilterTerm`) + role chips (All/Members/HoDs/Directors), infinite-scroll grid of avatar cards, URL-synced filters for shareable links, a closing join banner for logged-out visitors.

**Working well:** filters round-trip through the URL (`setSearchParams`) so a filtered view is a real, shareable/bookmarkable link, not just client state that resets on reload — a small thing most of the sibling list pages (Blog, Projects) don't bother with. The 250ms debounce only applies when there's an actual query (empty query fetches immediately), and the "clear" button was specifically resized after failing the 40×40 touch-target floor per its own comment.

## Findings

### P1 — The "Directors" role filter returns zero results by construction; the org's actual top leadership has no filter that surfaces them
Per this project's own architecture documentation, the live membership has **15 `super_admin`** and **0 `director`**-role members — the role hierarchy moved past a literal "director" role in practice, but this page's `ROLE_FILTERS` array still only offers `all / member / hod / director`. Tapping "Directors" — a completely reasonable thing for a visitor to try when looking for who's in charge — will filter to a role with nobody in it, while the 15 people who actually hold the org's senior-most role are unreachable through any role filter at all. Update the filter set to match the roles that actually exist in the data (`super_admin` in place of, or alongside, `director`).
