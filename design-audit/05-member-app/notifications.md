# Notifications — `/notifications`

**File:** `feed/NotificationsPage.tsx` (268 lines, no dedicated CSS).

## What this page is

**Intent:** checking what happened since last visit, and clearing the unread count.

## What's genuinely working

"Mark all read" firing only on an explicit click, not a silent 1.5s timer, is a real, well-reasoned fix — the comment notes the old behavior could mark something read before the member had actually seen it (e.g. a quick tab-through). The like-rollup logic (collapsing repeated "X liked your post" rows for the same link into one "N people reacted" row) prevents a popular post from flooding the whole list with duplicate entries, without touching any other notification type. Internal links navigate client-side instead of a full page reload — worth noting since this is, per the comment, "the app's highest-frequency re-engagement tap," exactly where a full SPA teardown-and-reload would cost the most.

## Findings

### P2 — Six of ten notification types have no filter of their own
`FILTER_LABEL` offers `all / unread / like / comment / tag / follow`, but `ICON_FOR_TYPE` shows the real type union also includes `post_approved`, `post_rejected`, `team_invite`, `team_join_request`, `team_join_accepted`, and `system` — arguably the highest-stakes types (did my post get rejected, was I invited to a team) — with no way to isolate them except scrolling "all." Worth adding at minimum a "team" and a "posts" filter grouping those six.
