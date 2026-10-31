# Calendar — `/calendar`

**File:** `calendar/CalendarPage.tsx` (453 lines).

## What this page is

**Intent:** a member checking what's coming up — drives, their own exam breaks, hiring deadlines, or opted-in birthdays — in one place.

## Assessment

No faults found. This page is a strong example of restraint done right: four independently toggleable layers, a real month grid on desktop and an agenda list on mobile at the same 900px breakpoint the rest of the app already uses for grid-to-stack collapses (consistency, not a one-off). Birthdays are correctly indexed by recurring month-day rather than a fixed year, and a member's own birthday always shows regardless of their `birthday_public` setting — a private view of your own data shouldn't be gated by a toggle that only controls what *other people* see. The "N drives since {FOUNDED_YEAR}" subheading only renders once real data has loaded, never as a placeholder guess. Per-day event dots use the same layer colors as the toggle chips, so the legend and the grid agree without needing a separate key.
