# HoD Desk — Yearbook Management, Content Manager, Project Manager

**Files:** `director/YearbookManagement.tsx` (195 lines), `director/ContentManager.tsx` (394 lines), `director/ProjectManager.tsx` (372 lines, + `ProjectManagerShared.tsx`, `ProjectModal.tsx` not individually read).

## What these desks are

**Intent:** running the yearbook invite/submission cycle, editing or moderating any post site-wide (a super-admin escalation above the category-scoped Post Queue), and managing the full welfare-projects CMS behind the public `/projects` directory.

## What's genuinely working

**ProjectManager** is the strongest single piece of engineering discipline found in this pass, on two fronts at once:
- **A real, load-bearing pagination fix, correctly communicated.** With 558 real projects, rendering every row measured out to ~11,400 DOM nodes on every visit. The fix caps rendering at 60 rows — but explicitly runs search/filtering across the *entire* list before that cap applies, so nothing becomes unreachable, and the footer states both numbers plainly: *"showing 60 of 340 matched · 558 total."* That footer line is exactly the missing piece flagged as a fault on this audit's Search page and Projects directory (where a header count implies more results exist than the UI actually lets you reach) — this desk is the model of doing it right.
- **A recurring "looked like text, wasn't a button" bug, fixed twice more.** The featured-project star used to be "a bare unicode glyph with only an opacity toggle... read as a stray character rather than a button" — the same failure shape as `MemberDirectory`'s illegible 🗑 emoji, now fixed here too with a real bordered button state.

**ContentManager** tolerates a not-yet-applied database migration gracefully: if the `featured` column doesn't exist on the view yet, the query retries without it rather than breaking the whole moderation tab — the comment states the priority directly: *"this critical moderation tab never breaks just because the migration is pending."* Changing a post's status away from `scheduled` requires confirmation specifically because there's no way to restore a cleared schedule from any screen, and "publish now" resets `created_at` to match what the cron job does on a real auto-publish, so a manually-published post doesn't get buried at its original authoring timestamp in every feed query that orders by it.

**YearbookManagement** reuses the existing Instagram poster generator to export a submitted entry — a yearbook entry is just fed in as the same `PosterData` shape everything else already uses, no new export machinery.

Across all three, the `.select('id')` + zero-row check to catch a silently RLS-blocked write shows up yet again (`ProjectManager`'s save/toggle/delete handlers) — now confirmed as a systemic, consistently-applied pattern across essentially every write path in the HoD desk, not a one-off.

## Findings

No faults found. This trio, together with the moderation queues and the intake desks audited earlier, closes out the HoD desk as the most consistently well-engineered section of the entire application.
