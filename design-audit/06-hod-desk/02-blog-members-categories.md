# HoD Desk — Blog Drafts, Member Directory, Category Management

**Files:** `director/BlogDrafts.tsx` (238 lines), `director/MemberDirectory.tsx` (580 lines), `director/CategoryManagement.tsx` (241 lines).

## What these desks are

**Intent:** turning a submitted draft into a live post, managing who has what access, and assigning HoDs to the categories they moderate.

## What's genuinely working

**BlogDrafts** disables its own publish control until a cover image exists, and states the real mechanical reason in the tooltip rather than just "disabled": *"Add a cover first: without one the feed card renders blank"* — this is because `mirror_blog_to_post()` only auto-publishes the mirrored feed post when both a live date and an image exist, so the UI is preventing a real broken downstream state, not an arbitrary rule.

**MemberDirectory** documents and fixes a genuinely funny/serious bug on the product's most destructive control: the delete button used to render a bare 🗑 emoji at 14px, which the desk's font stack has no color-emoji glyph for — so it drew as an illegible ~10.5px vertical stroke on the one button that permanently deletes an account. It's now a real outline SVG. Beyond that specific fix, the guard rails throughout are careful and complete: you can't delete or demote yourself from this screen, only a super admin can touch another super admin, and role changes go through a real confirmation modal specifically because "a mis-click on this `<select>` silently mutated a role before."

**CategoryManagement** tracks busy state per individual assignment (`memberId:category`), not one desk-wide lock — the comment explains why directly: a single lock "used to freeze every other HoD's chips while a single assignment was in flight," which is exactly the kind of interaction-quality bug that's invisible in a screenshot and only shows up under real multi-admin use.

## Findings

### Cross-reference — the role vocabulary gap already flagged on the public Members page shows up here as the source of truth
`MemberDirectory`'s role `<select>` here correctly offers all five real roles (`member / lead / hod / director / super_admin`), confirming that `lead` and `super_admin` are real, live role values — which sharpens the finding already raised on the public `/members` directory: that page's role filter only exposes `all / member / hod / director`, omitting `lead` entirely and offering a `director` filter that (per this project's own architecture notes) matches zero live members, while the 15 real `super_admin`-role members have no public filter that surfaces them. This desk is the confirmation that the public-facing gap is a real vocabulary mismatch, not a guess.
