# HoD Desk — Shell & Landing (`/director`)

**Files:** `director/DirectorDashboard.tsx` (319 lines, layout shell) + `director/DirectorLanding.tsx` (133 lines, `/director` index route).

## What this is

**Intent:** a director/HoD/super-admin's daily entry point — orienting to "who am I acting as, what's the state of the desk, what needs me today" before picking a specific queue.

## What's genuinely working — the strongest anti-fabrication discipline in the whole codebase

`DirectorLanding`'s own comment states the rule outright: *"EVERY number here comes from `DashboardStats`... nothing on this page is invented or approximated."* Three specific decisions back that up:
- **"Approved," not "onboarded."** The comment explains precisely why: most of these member rows have never actually signed in (pre-seeded by email, adopted only on first Google sign-in), so labeling the count as active usage would overstate it. The label was chosen to be true, not to look good.
- **An empty "what needs you today" list is a real answer, not a gap.** When every queue is at zero, the page shows `EmptyLedger`'s "nothing waiting — nice work" instead of five zero-value rows, which the comment correctly identifies as "far more useful than five zeroes."
- **Enquiries and Hiring used to be silently excluded from "what needs you today"** specifically because the stats service didn't produce a real count for them — and the comment states the standard directly: *"inventing one would have been worse than omitting it."* They're only shown now that real counts exist.

The shell itself (`DirectorDashboard`) carries real engineering care too: the mobile nav strip and desktop sidebar render from one `NAV_GROUPS` data source rather than two parallel implementations; the nav auto-hides on scroll-down and reappears on scroll-up specifically to give a phone screen's ~52px back during reading, with the desktop sidebar correctly unaffected; and the scoped pending-post count fetched here is deliberately kept in sync with what `PostModeration` will actually filter down to once opened, with a comment explicitly flagging the risk it's guarding against ("a category-restricted director/hod otherwise sees the global pending-post count on the tab and a smaller, scoped list once they open it").

## Findings

### P2 — One of seven landing stat tiles is silently inert for non-super-admins, with no visual distinction from the other six
`DirectorLanding`'s "published posts" tile sets `to: isSuperAdmin ? '/director/content' : null`. For any director/HoD who isn't a super admin, that tile renders with `cursor: 'default'` and a disabled button state — but it's styled identically to the six genuinely clickable tiles beside it (same card, same layout, same `hod-statrow` treatment). Nothing marks it as inert except a cursor style that's easy to miss on a stat-tile grid nobody is hovering carefully. A director scanning the row and clicking "published posts" out of curiosity gets nothing, with no explanation why this one tile — unlike its six neighbors — doesn't go anywhere for them. Either drop the hover/pointer affordance more visibly (muted color, no shadow-lift) for the non-clickable case, or give super-admin-only tiles a small lock icon so the restriction reads as intentional rather than broken.
