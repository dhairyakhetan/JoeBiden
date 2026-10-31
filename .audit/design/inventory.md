# AquaTerra design inventory (from 3 read-only surveys, 2026-07-23)

## Design system tokens
- Backgrounds: `--bg #F4EFE0` cream, `--bg-2 #EDE6D0`, `--bg-3 #E2D9BD`. Ink `--ink #0A0A0A`.
- Category hues: `--c-events #3DA9FC` sky, `--c-welfare #1B8A5A` green, `--c-labs #FFC700` amber, `--c-ops`, `--c-content #7E5BFF` grape.
- Hard offset shadows: `--sh-sm 2px`, `--sh 4px`, `--sh-lg 6px`, `--sh-xl 8px`, all `N Npx 0 0 var(--ink)`. Borders `--bd 2px`, hero `3px`.
- Signature: `.sticker` (rotate -3deg pill, 7 hues; globally flattened border/shadow via v6.css:1487 !important), `.card` (2px ink + 4px offset), `.pcard` (3px ink, №badge, dashed footer — the strongest brutalist component), `.deco` floating doodles, `.underline-doodle`, `.taped` scrapbook tape.

## Director desk tokens (director.css, NOT v6.css anymore)
- `--hod-border-w 3px`, `--hod-shadow 4px 4px 0 ink`, `--hod-radius 20px`, `--hod-danger #c0341f`, per-instance `--cc` category color.
- adminKit exports: AdminLayout, AdminTabHeader, DataToolbar, StatusStamp (rotated ink stamp), EmptyLedger (dashed + handwritten Caveat), FilterPill, BulkActionBar (fixed, rotated mint chip), AdminSkeleton (row/card/grid), AdminRow (owns busy — structural freeze fix), useRowSelection (shift-click), useUndoableAction (5s undo), BottomSheet, AdminRowActions, AdminErrorState.
- DEAD exports: StatusBadge, EmptyState (superseded by StatusStamp/EmptyLedger; no desk uses them). Dead CSS `.adm-bulkbar-count`.

## CROSS-CUTTING WEAKNESSES (audit spine)
1. **Two shadow idioms** — core hard `N Npx 0 0 ink` offsets vs soft blurred shadows leaking into About glass cards, BlogPost graphic btn, TeamManagement modals (backdrop-filter blur), nav chrome. Off-brand.
2. **Stickers globally flattened** (v6.css:1487 `!important` strips border+shadow) — read as plain rotated pills, undercutting the bordered-sticker intent.
3. **Duplicated `dhero`** hand-inlined in PublicProjects + Opportunities (echoed About/Collab) — drift risk, already diverging (accent, stat rows). No shared component.
4. **Inconsistent inputs** — MembersPage search soft (16px radius, --line-2, no shadow) vs PublicProjects brutalist (2px ink + hard shadow). Radii sprawl 10/12/14/16/18/20/22.
5. **Two greens** — headline doodles `--welfare #1B8A5A` dark vs sticker-mint `#00E5A0`.
6. **Four+ empty-state patterns** — shared <EmptyState>/EmptyLedger vs 📭 mono (Notifications) vs ¯\_(ツ)_/¯ card (Profile) vs plain .card (Teams). No single voice.
7. **Three+ skeleton implementations** — shared <Skeleton>, local SkeletonCard, inline .v6-skeleton; many tab-loads fall back to "loading…" text with NO skeleton (Profile, TeamDetail).
8. **Clickable/interactive divs (a11y)** — notif rows (window.location.href full reload), feed comment-cloud, team-card article, pending masonry cards (don't even navigate), ProjectManager <tr> onClick, VolunteerApplications <td> onClick, nav <a> without href.
9. **JS onMouseEnter/Leave hover instead of CSS :hover** — open-roles cards, bookmark/poster buttons, saved-unsave, partner wall. No focus-visible equivalent.
10. **Pervasive inline styling** — Home 78k, About 31k, Brand 37k, Pending, TeamDetail, CreatePostModal, FeedPostCard sheet. Border/shadow language re-typed inline → drift.
11. **Off-palette colors** — #e05c5c red (TeamDetail), rgba(255,122,26) orange (FeedPostCard badge), hardcoded avatar hexes (TeamsPage).
12. **Two chip languages** — brutalist ink-border chips (feed/teams) vs translucent rgba(255,255,255,.07) dark-panel chips (PostPage side, Pending, TeamDetail hero) — softer/generic.
13. **Light content columns are the flat zones** — PostPage right col, TeamDetail tab panels, Profile tab content, MyPosts cards. Brand energy stuck in dark panels/colored heroes.

## PER-SURFACE HIGHLIGHTS (now → could-be)
### Public
- HomePage `/`: 3-col feed shell (LeftRail identity/cats, center feed, right notice-board taped + open-roles + trending). Now: enormous inline styles, hand-rolled ⋯ menus, feed media onClick on div. Could: extract rail/section header classes, real menu component, keyboard feed cards.
- AboutPage `/about`: dark sticky hero (giant STUDENT/KOLKATA/NGO words), welfare marquee, story cards, principles grid, dashed timeline, teams grid, dark CTA. Weak: iOS-glass floating stat cards (blur, translucent) break brutalism → convert to hard-ink rotated stat cards.
- ContactPage `/contact`: rotated postcard form + dashed postage stamp + ruled-paper textarea. Strong; minor dupe copy.
- FAQPage `/faq`: <details> card accordion + rotating +. Weak: card-hover lift on non-clickable details; + doesn't rotate to ×.
- MembersPage `/members`: header band + soft search + role chips + avatar grid + lemon CTA. Weak: soft search inconsistent; flat uniform grid (no tilt/texture).
- BlogList `/blog`: magazine masthead + LeadStoryCard + №-badge card grid (alt rotation) + tag chips + dark IG CTA. Minor: two badge treatments.
- BlogPost `/blog/:slug`: full-bleed cover masthead + drop-cap + serif pullquotes + dashed divider + more grid. Weak: HOD graphic btn soft grape blur shadow.
- Collaborations `/collaborations`: dark hero giant ghost type + partner marquee + logo wall + who-we-work-with + lemon CTA + proposal form. Weak: partner wall inline JS hover on non-interactive divs (no keyboard).
- Opportunities `/opportunities`: dark dhero (spinning ✦, livedot) + chip filters + OpeningCard grid + all-quiet empty + general-app CTA. Weak: dhero inline-dupe; empty/CTA flat (no hard shadow).
- PublicProjects `/projects`: teams intro + dark dhero + featured band + sticky floating filter (brutalist search) + .pcard stream. Strongest page. Weak: dhero dupe, mixed radii.
- BrandPage `/brand`: the living style guide (90/8/2 color rule benchmark). Most on-system.

### Member-facing
- FeedPostCard: 3px ink, 3px offset, cap bar, resting tilt→straighten. Weak: whole <article> onClick (no keyboard), comment-cloud div onClick, massive inline sheet, off-token orange badge.
- PostPage `/post/:uuid`: dark sticky left info card (6px offset, radius22) + light body. Weak: light column generic; translucent dark-panel chips; action bar plain (not dashed seam); inline skeleton/not-found.
- NotificationsPage `/notifications`: sticker + h-display + chip filter + .card notif rows. Weak: div rows via window.location.href full reload; flattest surface (emoji marks, lone 📭 empty); hand-rolled error box.
- SavedPosts `/saved`: dark hero + FeedPostCard list. Most consistent (shared Skeleton/EmptyState/ErrorState). Weak: redundant unsave (inline hover btn + card bookmark).
- MyPosts `/my-posts`: chip filter + .card list + StatusBadge + rejection callout. Weak: plain .card (no cap/tilt/sticker); local SkeletonCard dupe; 3rd empty pattern.
- CreatePostModal: 64KB almost entirely inline-styled; no shared field component.
- TeamsPage `/teams`: hero + open-roles dark card + filter + team-card grid (3px ink, per-card tilt, emoji watermark). Weak: whole article onClick + duplicate cta button; open-roles inline JS hover; hardcoded avatar hexes.
- TeamDetailPage `/teams/:uuid`: full-hue hero (watermark) + scroll tabs + .card panels. Weak: content panels generic .card + inline; "loading…" text not skeletons; #e05c5c off-palette; inline tab badges.
- ProfilePage: hero (decorations, stat blocks) + tabs. Weak: "loading…" text tabs; shrug empty (4th pattern); visitor achievements = fake mock grid at opacity .4; inline hero.
- EditProfile `/profile/edit`: card form. Weak: low-affordance avatar caption; all inline; generic error/success.

### Auth (AuthShell 2-col, dark AuthFeaturePanel, dashed-tomato error w/ rotated ! stamp)
- Login `/login`: google pill + password toggle. Weak: low-affordance underlined toggle; plain inputs; only top banner errors.
- Register `/register`: 2-step + success. Weak: no progress bar (only text sticker); banner-only validation; plain success.
- PendingApproval `/pending`: sticky review banner (pulse) + locked compose teaser + masonry preview + 3-2-1 countdown. Most bespoke. Weak: MasonryPostCard non-interactive div dead-end; all inline; two border treatments.
- Rejected `/rejected`: emoji + sticker + note card + what-now list. Weak: returns null during redirect (blank flash); inline; plain cards.
- AuthCallback `/auth/callback`: bare spinner (fine).

### Director desk (chrome brutalist, data legible)
- Shell: .ops-topbar (3px ink, command *desk*, jurisdiction chip, pulse dot), phone navstrip auto-hide + desktop sidebar, active=ink fill.
- Landing: .ops-statrow category-edged stat tiles (№ index) + "what needs you today" ledger panel / EmptyLedger.
- Gold-standard desks (AdminRow+verdict+bulk): AccountApprovals, PostModeration, AchievementReviews.
- AdminRow no-bulk: FormResponses, HiringResponses, DirectorManagement, TeamManagement.
- Divergent primitives: MemberDirectory (card grid, intentional), ProjectManager (<table> pm-*, no ErrorState), VolunteerApplications (<table> vol-*, hand-rolled selection duplicating useRowSelection), ContentManager (inline cards, no ErrorState, tiny flat status select no aria-label), CategoryManagement (cat-* rows).
- Desk inconsistencies: bulk only 4 desks; ErrorState missing on ProjectManager+ContentManager; avatar split (adm-tape vs flat .avatar/.people-av); modal split (useModalA11y focus-trap vs Achievement portal-Escape-only vs TeamManagement bespoke blur modals); 4 category-chip representations; QUEUE bulk not on Form/Hiring/Achievement(has)/etc; dead StatusBadge/EmptyState exports.
