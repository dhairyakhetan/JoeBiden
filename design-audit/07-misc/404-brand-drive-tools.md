# 404, Brand Reference, and Drive Check-in / Wrap Tools

**Files:** `pages/NotFoundPage.tsx` (103 lines), `public/BrandPage.tsx` (778 lines, unlisted), `drives/DriveCheckIn.tsx` (378 lines), `drives/DriveWrap.tsx` (201 lines) — both drive tools standalone, outside the normal nav chrome.

## What these are

**Intent:** landing somewhere broken and needing a way back (404); an internal reference for the visual system (Brand); and a drive lead running check-in and closing out a drive's real numbers in the field, often with a bad connection.

## What's genuinely working

**NotFoundPage** carries the same "glyph must actually render" fix seen elsewhere in this audit (`MemberDirectory`'s trash icon, `ProjectManager`'s feature star) — a compass emoji with no color-emoji fallback in this font stack painted as a flat, wrong-looking glyph, replaced with the brand's own ★ mark; a 🔍 emoji was swapped for the real search icon component used everywhere else. "Lost in the field" as the tagline is genuinely on-brand rather than a generic 404 joke — it reuses the org's own drive/volunteer language.

**BrandPage** pulls its photography examples live from real welfare-project records rather than placeholder images, and its scroll-reveal system has a specifically-reasoned safety net: the comment walks through why an earlier "has the observer ever fired" flag failed (`IntersectionObserver` fires once immediately per element regardless of visibility, so that flag went true almost instantly and disabled the real safety net for the rest of the page) — the fix checks "is anything still un-revealed" instead, which actually guarantees nothing stays permanently hidden. A specimen text row showing "550+ DRIVES" is deliberately kept matched to the real canonical figure rather than an arbitrary demo number, with a comment explaining why: this is technically a live page, and a stray wrong number here would contradict every other surface.

**DriveCheckIn** and **DriveWrap** are offline-first by design (an IndexedDB queue, optimistic local roster updates that never block on the network, a visible online/offline state with a manual sync button and pending count) — the right architecture for a volunteer standing at a table with a phone and inconsistent signal. Both treat "complete the drive" as a one-time, idempotent payout, and both distinguish clearly between "this will pay out points" and "points were already paid out, this just updates the numbers." `DriveWrap` suggests a first outcome stat from the real attendance roster the moment nothing's typed yet — editable, never forced, and explicitly "a real number, not a guess," the same anti-fabrication instinct found throughout the HoD desk.

## Findings

No faults found on any of the four. This closes out the audit's page-by-page pass with the same verdict as most of the admin surfaces: careful, specific, well-reasoned engineering with the fixes' own reasoning documented in place.
