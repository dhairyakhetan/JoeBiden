# AquaTerra Comprehensive Audit
## UI/UX + Backend Integrity + Paradox Admin Redesign

**Date:** May 14, 2026
**Scope:** Full-stack audit covering frontend UI/UX discrepancies, social-platform backend integrity, and Paradox Admin section redesign
**Total Issues Found:** 63 (30 UI/UX, 20 backend, 13 admin tab problems + redesign)

---

# PART 1 — Frontend UI/UX Audit

## 🔴 BREAKING (User-blocking)

| # | File | Line | Issue | Fix |
|---|------|------|-------|-----|
| 1 | `feed/CreatePostModal.tsx` | 315 | Modal closes on backdrop click — silently drops unsaved form data | Add "unsaved changes" confirm or persist to localStorage |
| 2 | `auth/LoginPage.tsx` | 63-87 | Email/password inputs don't submit on Enter | Add `onKeyDown` Enter handler |
| 3 | `search/SearchPage.tsx` | 71-74 | Client-side string-match only — preloads all data into memory | Server-side search endpoint with debounce |
| 4 | `director/PostModeration.tsx` | 197-222 | Reject modal has no Escape-to-close | Add `onKeyDown` Escape handler + focus trap |
| 5 | `teams/TeamDetailPage.tsx` | — | Failed team fetch leaves page stuck in loading state | Add error boundary + retry UI |

## 🟠 HIGH (Significant frustration)

| # | File | Issue | Fix |
|---|------|-------|-----|
| 6 | `feed/PostCard.tsx:115-121` | Delete uses double-click state toggle — no "Are you sure?" dialog | Confirmation modal with post preview |
| 7 | `feed/CreatePostModal.tsx:230-280` | Some failures fire both `toastError()` + `flashError()` — duplicate messaging | Standardize: one toast per outcome |
| 8 | `profile/EditProfilePage.tsx:80-91` | Avatar uploads immediately, no cancel/undo | Preview → "Upload" / "Keep Original" buttons |
| 9 | `teams/JoinRequestModal.tsx` | Submit not disabled during in-flight request → multi-submit possible | `disabled={isSubmitting}` |
| 10 | `feed/PostCard.tsx:112`, `profile/PublicProfilePage.tsx:104` | "Copied!" toast only 2s — easy to miss | Extend to 3-4s or persistent inline indicator |

## 🟡 MEDIUM (Polish & consistency)

| # | Area | Issue | Fix |
|---|------|-------|-----|
| 11 | All async buttons | Loading text inconsistent ("…" / spinner / "sending…") | Standardize: spinner + label |
| 12 | `feed/CreatePostModal.tsx:176-184` | Char limits only block at submit, no real-time visual warnings | Red text at 90%, block at 100% |
| 13 | Multiple | Hardcoded `isMobile` JS checks instead of CSS media queries → resize flicker | Use CSS breakpoints |
| 14 | `search/SearchPage.tsx:56-69` | 300ms debounce may show stale results on fast typing | 400-500ms + cancel pending |
| 15 | `feed/PostCard.tsx:156-160` | Author links don't show active state on own profile | Add `isActive` class |
| 16 | `feed/CreatePostModal.tsx:152,730,732` | Disabled buttons keep `cursor: pointer` | `cursor: not-allowed` when disabled |
| 17 | `feed/FeedPage.tsx:407-415` | Empty state text indistinguishable from content | Larger, centered, 80px+ padding |
| 18 | `feed/FeedPage.tsx:41,52` | Skeleton 140px ≠ actual post height → layout shift | Match real heights |
| 19 | `feed/CreatePostModal.tsx:373` | Switching teams doesn't clear tag search | Reset `tagQuery` + `tagResults` |
| 20 | `feed/CreatePostModal.tsx:512-520` | Pasted multiline text not normalized | `onPaste` handler |

## 🟢 LOW (Refinements)

| # | Area | Issue | Fix |
|---|------|-------|-----|
| 21 | Design tokens | Border radius mixed: 16/20/999 with no system | Standardize: card r-lg, modal r-xl, input r-md |
| 22 | Spacing | No spacing scale — arbitrary pixel values | Define xs/sm/md/lg/xl tokens |
| 23 | `profile/EditProfilePage.tsx` | Tab order: avatar before name field | `tabIndex` reorder |
| 24 | Sidebars | Links vs. buttons used inconsistently | `<Link>` for nav, `<button>` for actions |
| 25 | `feed/CreatePostModal.tsx:530-532` | Team member list shows "LOADING..." text, no skeleton | Add 2-3 skeleton rows |
| 26 | `feed/PostCard.tsx:177` | Category chip text on busy image may fail WCAG AA | Add text shadow or overlay |
| 27 | `feed/FeedPage.tsx:279-280` | Filter buttons not keyboard-focusable visibly | `:focus-visible` styles |
| 28 | `feed/PostCard.tsx:663` | Long post body has no line-clamp or "Read more" | `-webkit-line-clamp: 4` + expand |
| 29 | All avatars | `alt=""` hides screen-reader info | `alt={user.name}` |
| 30 | Modals | Footer position varies (sticky vs. flow) | Use `position: sticky; bottom: 0` consistently |

---

# PART 2 — Backend / Social Platform Integrity Audit

## 🔴 CRITICAL (Data integrity / Security / Platform broken)

### A. Dual-Database Architecture Without Sync
**Layer:** DB + FE
**Files:** `frontend/src/lib/supabase.ts` (hardcoded URL), `lib/supabaseCommunity.ts` (env-driven), `backend/config/database.js`
**Problem:** Two Supabase projects exist:
- **General** (hardcoded): welfare projects, blogs
- **Community** (env): members, posts, teams, likes, comments

The Express backend only connects to ONE database via `DATABASE_URL`. The frontend bypasses the backend for feed operations, reading directly from `supabaseCommunity`. This means:
- Member approvals in backend DB don't sync to community DB
- Backend can't audit posts/likes created via direct Supabase calls
- Data drift is silent and unrecoverable

**Fix:** Consolidate to single Supabase project OR enforce all writes via backend API (frontend cannot bypass).

### B. Comments Table Orphaned (Schema Exists, Endpoint Doesn't)
**Layer:** BE
**Files:** `schema.sql:103-112`, `services/feedService.ts:335-448` (frontend CRUD), `backend/src/routes/feedRoutes.js` (no comment routes)
**Problem:** Frontend implements full comment CRUD against `supabaseCommunity` directly. Backend has zero comment endpoints. The `comments` table exists in schema but is abandoned.
**Impact:** No audit trail for comments, no rate limiting, no moderation. Counts drift.
**Fix:** Implement `POST/GET/DELETE /api/feed/:uuid/comments` and migrate frontend to call backend.

### C. Post Status Mismatch — Posts Are Orphaned at Creation
**Layer:** FE/BE/DB
**Files:** `feedService.ts:155-166` (createPost, no status field), `postController.js:176` (status logic)
**Problem:** Frontend inserts posts directly to `supabaseCommunity` without `status`. Backend logic (directors auto-publish, members go to pending_review) is never executed. Post defaults to NULL/undefined → `post_feed_view` filters by `status='published'` → post never appears. `getPendingReviews` also filters by `status='pending_review'` → moderation queue misses it. **Posts are orphaned at creation.**
**Fix:** Frontend must POST to `/api/feed`, not insert directly.

### D. Hard Delete Posts, No Recovery Path
**Layer:** BE/DB
**Files:** `Post.js:336-342` (DELETE), `schema.sql:61` (no `deleted_at`)
**Problem:** Director accidentally deletes a published post → cascade deletes images, tags, comments. Cached UUIDs on shares 404. Audit log shows it, but recovery is impossible.
**Fix:** Add `deleted_at TIMESTAMP`, soft-delete by default; expose hard-delete as super-admin only.

### E. Team Post Auth Missing — Privilege Escalation
**Layer:** BE/DB
**Files:** `Post.js:624-671` (createTeamPost transaction is good), `teamController.js:172-180` (no membership check)
**Problem:** A member can create a "team post" for a team they're not in — no `team_members` membership check before allowing `team_id` to be set on the post.
**Fix:** Pre-flight check that `req.member` is in `team_members` for that team; add DB CHECK constraint.

## 🟠 HIGH

### F. Role Hierarchy Inconsistency — 'hod' Role Doesn't Exist in Schema
**Layer:** DB/Auth
**Files:** Migration 011 references `role IN ('director', 'hod', 'super_admin')`, Migration 001 CHECK constraint is `('member', 'director')`
**Problem:** Code checks for 'hod' role but DB constraint forbids it. Any insertion of 'hod' would violate the CHECK. Either remove 'hod' references or update constraint.
**Fix:** Drop & recreate CHECK constraint with all valid roles, OR remove all 'hod' references.

### G. Team Creation Privilege Escalation
**Layer:** BE
**Files:** `teamController.js:69` (sub-check only restricts non-super directors, not non-directors)
**Problem:** Endpoint requires only `requireActiveMember`, not `requireDirector`. A regular member with active status can create a team.
**Fix:** Add `requireDirector` middleware to `POST /api/teams`.

### H. Pending Approval UX Bug — Logged-In Members Can See Feed but Can't Act
**Layer:** FE
**Files:** `authController.js:86-90` (returns success for pending users), `AuthContext.tsx` (doesn't surface status)
**Problem:** Pending users are logged in, can view feed (via `optionalAuth`), but every write fails silently. No "waiting for approval" page.
**Fix:** Surface `member.status` in `AuthContext`, redirect pending users to `/pending-approval`.

### I. Achievements Endpoints Missing on Backend
**Layer:** BE
**Files:** `achievementService.ts` reads directly from Supabase; `achievementController.js` lacks CRUD methods
**Problem:** No audit trail; date range filtering only works via direct DB query.
**Fix:** Implement `GET/POST /api/achievements` and move frontend to call backend.

### J. Volunteer Applications Orphaned Table
**Layer:** BE/DB
**Files:** Migration 011 creates `volunteer_applications` in community DB; no backend controller
**Problem:** Submissions exist in DB but no API to list/approve; directors must read DB directly.
**Fix:** Create `volunteerController.js` with director-only endpoints.

## 🟡 MEDIUM

| # | Area | Issue |
|---|------|-------|
| K | `Post.js:423-451` | Like toggle has SELECT-then-INSERT/DELETE without transaction → race condition / lost updates |
| L | `Post.js:51` | `is_active` not filtered in JOINs → deleted members' posts stay visible |
| M | Multi-category posts | No notification to other directors when one approves → silent publish |
| N | Migration 002 vs 004 | `posts.team_id` is `ON DELETE SET NULL` but `team_members` cascades → orphan team posts |
| O | Director categories | No DELETE endpoint to unassign → ex-directors retain approval power |
| P | Migration 007 | Not guaranteed idempotent (DROP CONSTRAINT not "IF EXISTS") |

## 🟢 LOW

| # | Area | Issue |
|---|------|-------|
| Q | `supabase.ts:4` | Hardcoded Supabase URL + anon key in source |
| R | `feedRoutes.js:24` | Route ordering comment but no enforcement (potential future bug) |
| S | Pagination | FE default limit=10, BE max=100, inconsistent across services |
| T | Schools/classes | Tables and services exist but unintegrated in main UI — dead feature |

---

# PART 3 — Paradox Admin Section: The Big Picture

## State of the Admin

**4,251 lines. 13 tabs. 60+ useState hooks. One file.**

### Tab Inventory & Health
| Tab | Status | Mobile? | Top Issue |
|-----|--------|---------|-----------|
| Registrations | ✅ Solid | ⚠️ Card actions wrap | No pagination — jank at 1000+ rows |
| Updates | 🟡 Functional | ❌ `min-w-[900px]` table | Can't edit existing |
| Inquiries | 🟡 Functional | ❌ `min-w-[1000px]` table | No CSV export |
| Check-in | ✅ Solid | ✅ Mostly OK | No torch toggle; 3-step "mark paid + check in" |
| Events | 🟡 Functional | ❌ `min-w-[1100px]` table | Free-text date/time, no conflicts detection |
| Scores | 🔴 Painful | ❌ Slow | One-at-a-time entry, no CSV import, no leaderboard |
| Volunteers | 🔴 Stub | — | Loaded but no UI |
| Winners | 🟡 Functional | ❌ Table scroll | Photo URL is free text; no image upload |
| Blog | 🟡 Functional | ❌ Table scroll | No edit; no markdown preview; no SEO meta |
| Team | ✅ Card-based | ⚠️ 7×7px reorder buttons fail WCAG | Arrow-only labels |
| Settings | 🟡 Minimal | ❌ — | No validation; opaque key naming |
| Audit | 🟡 Read-only | ❌ Table scroll | No timeline view |
| Accounts | ✅ Comprehensive | ❌ `min-w-[900px]` perm grid | No loading state on perm changes |

### Critical Mobile Failures
1. **8 tables** with `min-w-[900px]`+ — forces horizontal scroll or zoom-out
2. **Team reorder buttons** at 7×7px — fail WCAG 44×44px
3. **WA dropdown** can render off-screen near right edge of cards
4. **Top bar** crowded with 5+ elements on a single 64px row
5. **Tab pills** use `overflow-x-auto no-scrollbar` — no scroll indicator hint

### Workflow Gaps (Real Event-Day Pain)
1. Score entry is one-at-a-time — judges need bulk CSV import
2. No leaderboard view — live rankings invisible to admin
3. Check-in unpaid registrant flow = 3 steps + tab-switch
4. No bulk operations (mark paid, send updates, delete old)
5. No volunteer assignment UI despite data being collected
6. No comms tab (push/email/SMS announcements)
7. Blog has no edit — typo = delete + recreate
8. No conflict detection (double-booked judges, venues)

---

## 🎯 Proposed Redesign — 13 Tabs → 8 Tabs

```
┌─ DASHBOARD ─────────────────────────────┐
│ • KPIs: today's events, paid%, attended%│
│ • Quick actions: Mark Paid, Check In,   │
│   Post Update                            │
│ • Live audit feed                        │
│ • Conflicts panel                        │
└──────────────────────────────────────────┘

┌─ REGISTRATIONS ─┬─ CHECK-IN ─────────────┐
│ Cards on mobile │ QR scan + torch        │
│ Bulk export     │ Mark Paid & Check In   │
│ Pagination      │ Live counter           │
└─────────────────┴─────────────────────────┘

┌─ EVENTS & SCORES ─ (subtabs) ─────────────┐
│ Events │ Live Scoring │ Leaderboard │ CSV │
└─────────────────────────────────────────────┘

┌─ UPDATES & COMMS ─ (subtabs) ─────────────┐
│ Updates │ Push │ Schedule │ SMS/Email     │
└─────────────────────────────────────────────┘

┌─ WINNERS & SPONSORS ─ (subtabs) ──────────┐
│ Winners │ Blog (with edit + markdown)     │
│         │ Sponsors (tier, assets)         │
└─────────────────────────────────────────────┘

┌─ TEAM & VOLUNTEERS ─ (subtabs) ───────────┐
│ Team │ Volunteers (roster, assign)        │
│      │ Role Assignments                   │
└─────────────────────────────────────────────┘

┌─ SETTINGS & ADMIN ─ (subtabs) ────────────┐
│ Settings │ Accounts │ Audit │ Integrations│
└─────────────────────────────────────────────┘
```

## 📅 Implementation Roadmap

### Phase 1 — Stop the Bleeding (3 days)
- Convert 8 tables to mobile-responsive card layouts via `<TableOrCards>` wrapper
- Fix team reorder buttons (7×7 → 36×36 minimum)
- Add loading state to permission checkboxes
- Paginate registrations (100 + Load More OR react-window)
- **Verify on iPhone SE + Android via Vercel preview**

### Phase 2 — Reduce Friction (3-4 days)
- Edit existing blog posts
- Bulk score CSV import
- Date/time pickers on event form (replace free text)
- Toast feedback on all permission/setting changes
- One-click "Mark Paid & Check In" button
- WA menu repositioning (Popper.js or fixed dropdown lib)

### Phase 3 — Reorganize IA (5-7 days)
- Split `Admin.tsx` into 8 modules:
  - `AdminDashboard.tsx`, `AdminRegistrations.tsx`, `AdminCheckin.tsx`,
  - `AdminEventsScores.tsx`, `AdminUpdatesComms.tsx`,
  - `AdminWinnersSponsors.tsx`, `AdminTeamVolunteers.tsx`,
  - `AdminSettingsAudit.tsx`
- Shared components: `<AdminTableOrCards>`, `<AdminFormModal>`
- Sync active tab to URL query param (bookmarkable)
- Subtab navigation within merged tabs

### Phase 4 — Power Features (3-5 days)
- Dashboard with KPIs + quick actions
- Live leaderboard view (calculated rankings)
- Volunteer assignment UI
- Markdown preview for blog
- Torch toggle on QR scanner
- Scheduled announcements
- Conflict detection (judges/venues)

### Phase 5 — Delight (2-3 days, stretch)
- Push notifications via FCM
- SMS via Twilio
- Email templates for confirmations/reminders
- PDF roster exports
- Analytics dashboard
- Dark mode toggle

---

# Cross-Cutting Themes

## What's Actually Good ✅
- Backend SEO infrastructure (sitemap, robots.txt, llms.txt) is production-quality
- Auth & session management with RPC + rollback is solid
- Barcode scanner integration (@zxing/library) is well-done
- Audit logging is comprehensive
- Realtime updates work for sessions/permissions
- Vercel Speed Insights now integrated

## Systemic Problems ⚠️
1. **Two databases without a sync strategy** — guaranteed to diverge
2. **Frontend bypasses backend API** — services/api.ts says "no HTTP client" while backend has 9 controllers ready
3. **Status enums + role enums fragmented** across migrations
4. **No transactions on multi-step writes** (likes, multi-category approvals)
5. **God components & god files** drive complexity (HomePage 1202 LOC, TeamDetailPage 1353 LOC, Admin 4251 LOC)
6. **No tests** — no unit, no integration, no E2E

## 🎯 Recommended Triage Order

| Priority | Effort | Item |
|----------|--------|------|
| 1 | 1d | **Fix critical broken UX**: Enter on login (#2), Escape on modals (#4), modal data loss (#1), delete confirmations (#6) |
| 2 | 2-3d | **Backend integrity**: Route post creation through `/api/feed` (#C), add team-member check (#E), fix 'hod' role inconsistency (#F) |
| 3 | 3d | **Paradox Admin Phase 1**: mobile tables, button sizes, pagination, permission feedback |
| 4 | 1d | **Unify auth status flow**: surface `member.status`, redirect pending users (#H) |
| 5 | 2d | **DB cleanup**: add `deleted_at` to posts (#D), filter `is_active` (#L) |
| 6 | 1w | **Refactor god components** (in parallel with feature work) |
| 7 | Ongoing | **Decide on backend strategy**: consolidate DBs or enforce backend-as-gateway |

---

# Statistics

```
Files audited:        140+
Issues found:         63
  - UI/UX:            30 (5 breaking, 5 high, 10 medium, 10 low)
  - Backend/DB:       20 (5 critical, 5 high, 6 medium, 4 low)
  - Paradox Admin:    13 tabs + redesign proposal

Lines analyzed:       38,298 frontend + ~3,000 backend + 11 migrations
Critical user-blockers: 10
Estimated total fix effort: ~6-8 weeks for full remediation
Quickest wins (1 day each): 8 items
```

---

**This audit is a snapshot.** The platform is functional and shipping — these are the gaps between "works" and "feels crafted." Prioritize ruthlessly: fix critical breakages first, defer polish until the foundation is solid.
