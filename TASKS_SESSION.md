# Live task queue

Status: [ ] todo  [~] in progress  [x] done + verified

- [x] 1. Instagram in members view, super-admin only.
       Found live: `members.instagram` was READABLE BY EVERY AUTHENTICATED
       ACCOUNT (phone/email were already closed). Column revoked + view gated
       + UI moved behind the same capability as phone. Applied live.
- [x] 2. Deleted /paradox/legacy (fabricated winners and money figures).
- [x] 3. Logo invisible on dark pages. Root cause: stamp-white.png is a flat
       silhouette, not a reversed mark. Built stamp-light.png. Verified live.
- [x] 4. Notifications "WHAT'S NEW." header. The red square is the brand full
       stop (NeutralFace draws a square period); it read as broken because the
       count floated beside it in a second, near-identical red. Now a badge.
- [~] 5. Changeable joining date. Migration written, NOT YET APPLIED -- the
       GRANT statements were blocked by a permission gate. Frontend work is
       held until the SQL runs, because reading a column that does not exist
       would break the directory outright.
       -> frontend/scripts/members_joined_on_2026_09_21.sql
- [x] 6. Deleted /paradox/winners (owner's call; it read live data, unlike
       Legacy). Its "see the winners" CTAs now point at /paradox/scores.
- [x] 7. TerraThon promo banner restricted to the home page only.
- [~] 8. TerraThon visual upgrade to match the real event poster. Opus agent.
       Grounding measured from the poster + sticker PNGs rather than described:
       ground #000000 true black + starfield (site currently runs NAVY-black
       #05060A), sticker green #2BD382, star blue #1486D9, outline orchid
       #DE68F0, torn-paper cream #F6F0E0.
       The existing --tt-* night tokens ALREADY match the poster to within a
       couple of points, so the palette is not the gap; application is.
       Contract check on true black: green 10.74, orchid 7.45, text 18.23 --
       all text-safe. But surface #0B0E16 on #000000 is 1.09, decorative, so
       cards must separate by border, never by fill.
