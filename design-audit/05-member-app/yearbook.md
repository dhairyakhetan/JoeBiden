# Yearbook — `/yearbook`

**File:** `yearbook/YearbookPage.tsx` (202 lines).

## What this page is

**Intent:** an invited member submitting (or skipping) their photo and one-line quote for the annual yearbook.

## Assessment

No faults found. The invite-gating is handled honestly: a member who wasn't invited sees a plain "not on this year's list" state pointing at HR, rather than a broken or dead form. The "skip this year" flow uses a real confirm dialog that explicitly says the decision isn't final ("you can change your mind and submit later, any time before the yearbook is exported"), and revisiting after skipping offers a direct "submit a photo & quote" way back in rather than leaving the member stuck in the skipped state. Reusing the existing profile picture as the default, with upload as an explicit opt-out, is the lower-friction default most members will want.
