# Saved Posts — `/saved`

**File:** `feed/SavedPostsPage.tsx` (140 lines, no dedicated CSS).

## What this page is

**Intent:** getting back to something you bookmarked to read or act on later.

## Assessment

No faults found. Optimistic unsave rolls back cleanly on failure with a real error toast; the "unsave" button was specifically resized to meet the 40px hit-area floor without inflating its visual chrome (padding, not bigger text); the empty state uses a rotating joke-line helper (`useEmptyJoke`) so the empty state doesn't say the exact same thing every time a member clears their saves, a small personality touch consistent with the brand's tone. A genuinely clean, complete page with nothing left to flag.
