# AquaTerra Community Platform - Changelog

> **Project:** AquaTerra Community Platform
> **Purpose:** Public digital platform to document and showcase student work

---

## [1.0.0] - 2026-03-15

### 🎯 Major Consistency & Bug Fixes Release

This release focuses on establishing consistent coding patterns, fixing case transformation issues, and resolving runtime errors.

---

### ✅ Added

#### Documentation
- **CODING_CONTEXT.md** - Comprehensive 800+ line coding guide covering:
  - Complete architecture documentation
  - Coding patterns and conventions for backend/frontend
  - Database schema reference with all tables
  - API endpoints catalog
  - User flow diagrams
  - Common pitfalls section
  - Development guidelines and checklists

- **FIXES_APPLIED.md** - Detailed changelog of TypeScript consistency fixes
- **RUNTIME_FIXES_APPLIED.md** - Runtime case transformation bug fixes
- **CHANGELOG.md** (this file) - Consolidated project changelog

#### Code Improvements
- Added comprehensive inline documentation to all route files
- Added JSDoc comments explaining permission rules for project creation
- Added detailed post status transition documentation in models and controllers

---

### 🔧 Fixed

#### Critical Build Errors (47 → 4 warnings)

**TypeScript Interface Consistency**
- Fixed `Post` interface using snake_case instead of camelCase
- Updated all property names across 9 frontend files:
  - `post_id` → `postId`
  - `author_name` → `authorName`
  - `author_uuid` → `authorUuid`
  - `author_avatar` → `authorAvatar`
  - `created_at` → `createdAt`
  - `like_count` → `likeCount`
  - `comment_count` → `commentCount`
  - `tagged_members` → `taggedMembers`
  - `link_url` → `linkUrl`
  - And 10+ more property name fixes

**Files Fixed:**
- `frontend/src/services/api.ts`
- `frontend/src/feed/PostCard.tsx`
- `frontend/src/feed/FeedPage.tsx`
- `frontend/src/feed/PublicFeedPage.tsx`
- `frontend/src/director/PostModeration.tsx`
- `frontend/src/profile/ProfilePage.tsx`
- `frontend/src/profile/PublicProfilePage.tsx`
- `frontend/src/projects/ProjectDetailPage.tsx`
- `frontend/src/teams/TeamDetailPage.tsx`

#### Backend Case Transformation

**Models - Added `transformKeys()` to all find methods:**
- `backend/src/models/Post.js` (8 methods)
- `backend/src/models/Member.js` (4 methods)
- `backend/src/models/Project.js` (2 methods)
- `backend/src/models/Team.js` (2 methods)

**Controllers - Fixed snake_case property access:**
- `backend/src/controllers/postController.js`
- `backend/src/controllers/projectController.js`
- `backend/src/controllers/profileController.js`
- `backend/src/controllers/teamController.js`

#### Runtime Errors

**403 Forbidden - Project Post Creation** ✅ FIXED
- **Issue:** Members couldn't create project posts
- **Root Cause:** `project.projectId` was undefined due to missing case transformation
- **Fix:** Added `transformKeys()` to `Project.findByUuid()` and updated all property access in controllers

**Member Permission Checks** ✅ FIXED
- Fixed comparisons using non-existent `member.memberId`
- Changed to use `member.uuid` for auth context comparisons

**Pagination API** ✅ FIXED
- Fixed `pagination.total` → `pagination.totalItems`

#### Permission System Clarity

**Director vs Team Director Confusion** ✅ FIXED
- Removed `requireDirector` middleware from project creation route
- Updated to `requireActiveMember` with permission checks in controller
- Documented that team directors and leads can create projects
- Added comprehensive JSDoc explaining permission rules

---

### 📝 Changed

#### Route Documentation
- Added detailed inline comments to all route files explaining:
  - `optionalAuth` vs `authMiddleware` usage
  - Why routes are ordered in specific ways
  - What permissions each route requires

**Files Updated:**
- `backend/src/routes/feedRoutes.js`
- `backend/src/routes/projectRoutes.js`

#### Status Transition Documentation
- Added comprehensive documentation block in `Post.js` explaining:
  - Valid status values
  - Status transition flows
  - Terminal states
  - Multi-category approval workflow

#### Code Comments
- Added JSDoc comments to `createPost()` controller documenting all status transitions
- Added JSDoc to `createProject()` controller documenting permission rules

---

### 🗑️ Removed

**Outdated Documentation**
- Removed `BUG_FIX_REPORT.md` (superseded by FIXES_APPLIED.md)
- Removed `BUG_FIX_SUMMARY.md` (superseded by RUNTIME_FIXES_APPLIED.md)

**Unused Imports**
- Removed various unused TypeScript imports (Badge, navigate, etc.)

---

### 🔐 Security

No security changes in this release.

---

### 📊 Statistics

**Build Status:**
- Before: 47+ TypeScript errors
- After: 4 minor warnings (unused imports)
- Reduction: 90%+ error reduction

**Files Modified:**
- Backend: 8 files
- Frontend: 9 files
- Documentation: 5 files (3 created, 2 removed)
- Total: 22 files changed

**Lines Changed:**
- Backend: ~150 lines
- Frontend: ~200 lines
- Documentation: ~1200 lines added

---

## [1.0.1] - 2026-03-15 (Later)

### 🎯 Authentication & Post Segregation Fixes

**Hot fixes applied after v1.0.0 to resolve authentication errors and implement proper post segregation.**

---

### 🔧 Fixed

#### Authentication 500 Errors ✅ FIXED
- **Issue:** All auth endpoints returning 500 Internal Server Error
- **Root Cause 1:** Missing `transformKeys` import in `Member.js`
- **Root Cause 2:** `authController.js` and `profileController.js` still using snake_case properties after transformKeys was added
- **Files Fixed:**
  - `backend/src/models/Member.js` - Added missing import, added transformKeys to all methods (create, update, approve, reject, getPendingApprovals, getActiveMembers, searchForMention, getPublicProfile)
  - `backend/src/controllers/authController.js` - Updated all property access to camelCase (memberId, fullName, avatarUrl, classGrade, createdAt, rejectionNote)
  - `backend/src/controllers/profileController.js` - Updated all property mappings to camelCase

#### Team Post Approval Errors ✅ FIXED
- **Issue:** Post approval failing with 500 error, URL showing `undefined` instead of postId
- **Root Cause:** `teamController.js` accessing camelCase properties on raw SQL results (snake_case)
- **Fix:** Changed `post.post_id` → `post.post_id` (use raw result), `post.author_id` in teamController line 349, 352, 357

#### React Key Prop Warning ✅ FIXED
- **Issue:** "Each child in a list should have a unique key prop" in TeamDetailPage
- **Fix:** Changed image map key from index to `img.blobUrl` (line 566)

#### Post Segregation ✅ IMPLEMENTED
- **Feature:** Project posts now completely segregated from main feed
- **Implementation:** Added `NOT EXISTS (SELECT 1 FROM post_projects pp WHERE pp.post_id = ...)` to:
  - `Post.getFeed()` - Main public feed excludes project posts
  - `Post.getByAuthor()` - Profile pages exclude project posts
  - `Post.getPendingReviews()` - Global director queue excludes project posts (those go to team directors)
- **Result:**
  - Regular posts appear in main feed, profiles, and global director moderation
  - Project posts ONLY appear in project detail pages and team director queues
  - Clean separation between general community posts and project-specific posts

---

### 📊 Statistics

**Fixes Applied:**
- Backend files: 4 (Member.js, authController.js, profileController.js, teamController.js, Post.js)
- Frontend files: 1 (TeamDetailPage.tsx)
- Total: 5 files changed

**Issues Resolved:**
- Auth endpoint errors (500)
- Team post approval errors (500)
- React warnings (key prop)
- Post segregation implementation

---

## [1.0.2] - 2026-03-15 (Latest)

### 🎯 Profile & Post Display Fixes

**Profile routing and display issues resolved for authenticated users.**

---

### 🔧 Fixed

#### Profile Routing for Authenticated Users ✅ FIXED
- **Issue:** Clicking profiles from search, teams, and projects routed to `/member/:uuid` (public layout) instead of `/profile/:uuid` (dashboard layout)
- **Fix:** Updated all authenticated pages to use `/profile/:uuid` links
- **Files Fixed:**
  - `frontend/src/search/SearchResultsList.tsx` - Search results now link to `/profile/:uuid`
  - `frontend/src/teams/TeamDetailPage.tsx` - Team member links use `/profile/:uuid`
  - `frontend/src/projects/ProjectDetailPage.tsx` - Project member links use `/profile/:uuid`

#### Other Users' Profile Details Not Rendering ✅ FIXED
- **Issue:** When viewing other members' profiles from feed/search, profile details were missing or incorrect
- **Root Cause:** Backend profileController using snake_case property access on camelCase-transformed data
- **Fix:** Updated `backend/src/controllers/profileController.js`:
  - `updateProfile()` - Fixed response to use camelCase properties (fullName, avatarUrl, classGrade, etc.)
  - `getPublicProfile()` - Fixed response to use camelCase properties and flatten school/class data
  - Changed nested `school: { name, uuid }` to flat `schoolName, schoolUuid` for consistency
- **Frontend Fix:** Removed fallback for old nested structure in `ProfilePage.tsx`

#### Post Cards Missing Details in Profiles ✅ FIXED
- **Issue:** Post cards on profile pages were missing author information (name, avatar, role)
- **Root Cause:** `Post.getByAuthor()` query didn't include author data from members table
- **Fix:** Updated `backend/src/models/Post.js`:
  - `getByAuthor()` - Added JOIN with members table and author fields (authorId, authorUuid, authorName, authorAvatar, authorRole)
  - `getTaggedPosts()` - Added images and tagged_members data for consistency (already had author info)

---

### 📊 Statistics

**Fixes Applied:**
- Backend files: 2 (profileController.js, Post.js)
- Frontend files: 4 (SearchResultsList.tsx, TeamDetailPage.tsx, ProjectDetailPage.tsx, ProfilePage.tsx)
- Total: 6 files changed

**Issues Resolved:**
- Profile routing for authenticated users
- Profile details rendering for other users
- Post card author information display
- Post images and tags in tagged posts

---

## [1.0.3] - 2026-03-15 (Latest)

### 🎯 Post Display & Data Consistency Fixes

**Fixed like counts, search results, and nested data transformation issues.**

---

### 🔧 Fixed

#### Likes Count Not Displaying ✅ FIXED
- **Issue:** Like counts and like status not showing on post cards
- **Root Cause:** Backend controllers returning `is_liked` (snake_case) instead of `isLiked` (camelCase)
- **Fix:** Updated all controllers to use camelCase:
  - `backend/src/controllers/postController.js` - Changed `is_liked:` to `isLiked:`
  - `backend/src/controllers/profileController.js` - Changed `is_liked:` to `isLiked:`
- **Result:** Like buttons now show correct count and liked status

#### Search Results Data Not Properly Formatted ✅ FIXED
- **Issue:** Search results (people, projects, teams, schools) not displaying correctly
- **Root Cause:** `searchController.js` manually mapping snake_case properties instead of using transformArray
- **Fix:** Updated `backend/src/controllers/searchController.js`:
  - Added `transformArray` import
  - Replaced manual mapping with `transformArray()` for all result types
- **Result:** All search results now properly formatted in camelCase

#### Nested Arrays Not Transformed ✅ FIXED
- **Issue:** Post images and tagged members had snake_case properties (blobUrl, displayOrder, etc.)
- **Root Cause:** Post model passing raw `images.rows` and `tags.rows` without transformation
- **Fix:** Updated `backend/src/models/Post.js` to use `transformArray()` on nested data:
  - `getFeed()` - Transform images and tagged_members arrays
  - `getPendingReviews()` - Transform images arrays
  - `getByAuthor()` - Transform images and tagged_members arrays
  - `getTaggedPosts()` - Transform images and tagged_members arrays
  - `getTeamPendingPosts()` - Transform images arrays
  - Changed `is_project_post` to `isProjectPost` for consistency
- **Result:** All nested data now consistently in camelCase

---

### 📊 Statistics

**Fixes Applied:**
- Backend files: 3 (postController.js, profileController.js, searchController.js, Post.js)
- Total: 3 files changed

**Issues Resolved:**
- Like counts and status display
- Search results formatting
- Nested array data transformation
- Consistent camelCase throughout API responses

---

## [1.0.4] - 2026-03-15 (Latest)

### 🎯 Like Count Synchronization Fix

**Fixed like counts jumping incorrectly when liking posts.**

---

### 🔧 Fixed

#### Like Counts Jumping Incorrectly (1 → 10 → 11) ✅ FIXED
- **Issue:** Like counts were jumping by unexpected amounts (e.g., 1 to 10 to 11) when clicking the like button
- **Root Cause:** Frontend was using only optimistic updates without syncing actual count from server
  - Backend `toggleLike` only returned `{ liked: true/false }` without the updated count
  - Frontend incremented count optimistically but never updated it with the real value from database
  - This caused drift when multiple users liked posts or when database count differed from expected
- **Fix:**
  - **Backend** (`backend/src/models/Post.js`):
    - Updated `toggleLike()` to query and return actual like count after toggle
    - Now returns `{ liked: boolean, likeCount: number }`
  - **Frontend** (`frontend/src/feed/PostCard.tsx`):
    - Updated like handler to use server-returned count instead of relying solely on optimistic increment
    - Changed from: `setIsLiked(result.data.liked)` only
    - Changed to: `setIsLiked(result.data.liked)` AND `setLikeCount(result.data.likeCount)`
    - Fixed error recovery to restore previous values correctly
  - **TypeScript** (`frontend/src/services/feedService.ts`):
    - Updated toggleLike response type to include `likeCount: number`
- **Result:** Like counts now always show the accurate value from the database after each toggle

---

### 📊 Statistics

**Fixes Applied:**
- Backend files: 1 (Post.js)
- Frontend files: 2 (PostCard.tsx, feedService.ts)
- Total: 3 files changed

**Issues Resolved:**
- Like count synchronization with database
- Accurate real-time like counts
- Prevention of count drift from optimistic updates

---

## [1.1.0] - 2026-03-15 (Latest)

### 🎯 External Achievements Feature

**Major new feature allowing members to showcase personal achievements on their profiles.**

---

### ✅ Added

#### New Feature: Personal Achievements System
- **Self-service achievement management** - Members can add, edit, and delete their own achievements
- **No approval required** - Achievements are immediately visible when added
- **Always public** - All achievements are visible to everyone
- **4 Achievement types** with emoji badges:
  - 👑 Leadership
  - 📚 Academic
  - 🏆 Competition
  - 💡 Personal Project
- **Optional proof images** - Upload certificates, photos, or other proof (max 5MB)
- **Date validation** - Achievement dates cannot be in the future
- **Responsive grid layout** - Displays 1/2/3 columns based on screen size

#### Database Changes
- **New Table:** `external_achievements`
  - Fields: achievement_id, uuid, member_id, title, description, achievement_type, achievement_date, proof_url, created_at, updated_at
  - Indexes: member_id, achievement_type, achievement_date (DESC)
  - Trigger: Auto-update updated_at timestamp
- **Migration:** `003_external_achievements.sql` successfully applied

#### Backend Implementation
- **New Model:** `backend/src/models/Achievement.js`
  - CRUD operations: create, findById, findByUuid, update, delete
  - Pagination support: getByMember with page/limit/type filtering
  - Count method: getCountByMember for profile stats
  - Proper case transformation with transformKeys/transformArray

- **New Controller:** `backend/src/controllers/achievementController.js`
  - createAchievement - POST /api/achievements (auth required)
  - getMyAchievements - GET /api/achievements/me (auth required)
  - getMemberAchievements - GET /api/achievements/member/:uuid (public)
  - updateAchievement - PUT /api/achievements/:uuid (auth required, owner only)
  - deleteAchievement - DELETE /api/achievements/:uuid (auth required, owner only)
  - Full validation: title, type, date required; type must be valid enum; date not in future
  - Ownership checks: only achievement owner can update/delete

- **New Routes:** `backend/src/routes/achievementRoutes.js`
  - Protected routes before public routes (/me before /:uuid)
  - Auth middleware + requireActiveMember for write operations
  - Public read access for viewing member achievements

- **Audit Logging:** Added to `backend/src/utils/auditLogger.js`
  - ACHIEVEMENT_CREATED
  - ACHIEVEMENT_UPDATED
  - ACHIEVEMENT_DELETED

- **Server Integration:** Registered `/api/achievements` routes in `backend/src/server.js` (line 98)

#### Frontend Implementation
- **New Service:** `frontend/src/services/achievementService.ts`
  - TypeScript API service with full CRUD methods
  - getMyAchievements, getMemberAchievements, createAchievement, updateAchievement, deleteAchievement
  - Proper typing with Achievement interface

- **New Components:**
  - `frontend/src/profile/AchievementsList.tsx` - Main display component
    - Responsive grid layout (1/2/3 columns)
    - Type badges with emojis and colors
    - Edit/Delete controls (only on own profile)
    - Empty states with helpful messages
    - Integration with Add/Edit modals

  - `frontend/src/profile/AddAchievementModal.tsx` - Create achievement form
    - Form validation (title, type, date required)
    - Optional description and proof image upload
    - FileReader for image preview
    - 5MB file size limit
    - Two-step submit: upload image → create achievement

  - `frontend/src/profile/EditAchievementModal.tsx` - Update achievement form
    - Pre-populates form with existing data
    - useEffect sync with achievement prop changes
    - Handles existing proof image (shows preview)
    - Supports updating image or keeping existing one
    - Same validation as Add modal

- **Profile Integration:** Updated `frontend/src/profile/ProfilePage.tsx`
  - Added 'achievements' to Tab type
  - Added achievements state management
  - Updated useEffect to fetch achievements when tab is clicked
  - Added Achievements tab button in navigation
  - Conditional rendering of AchievementsList component
  - Real-time refresh callback for add/edit/delete operations

- **TypeScript Interface:** Added to `frontend/src/services/api.ts`
  - Achievement interface with all fields in camelCase
  - Proper typing for achievementType enum

#### UI/UX Features
- **Badge styling** - Each achievement type has distinct color (orange, forest, success, info)
- **Proof image display** - 32px height card with object-cover for consistency
- **Date formatting** - Full date display (e.g., "January 15, 2026")
- **Delete confirmation** - Prevents accidental deletions
- **Loading states** - Spinner shown while fetching
- **Error handling** - Alert component for validation/API errors
- **Optimistic UI** - Real-time updates after successful operations

---

### 📊 Statistics

**New Files Created:**
- Backend: 3 files (Achievement.js, achievementController.js, achievementRoutes.js)
- Frontend: 4 files (achievementService.ts, AchievementsList.tsx, AddAchievementModal.tsx, EditAchievementModal.tsx)
- Database: 1 migration file (003_external_achievements.sql)
- Total: 8 new files

**Files Modified:**
- Backend: 2 files (server.js, auditLogger.js)
- Frontend: 2 files (api.ts, ProfilePage.tsx)
- Total: 4 files modified

**Code Statistics:**
- Backend: ~300 lines (model + controller + routes)
- Frontend: ~600 lines (service + 3 components)
- Database: ~50 lines (schema + indexes + trigger)
- Total: ~950 lines of new code

**API Endpoints Added:** 5 new endpoints
**Database Tables Added:** 1 table with 3 indexes
**Audit Actions Added:** 3 audit log types

---

### 🔐 Security

**Validation:**
- Title, type, and date are required fields
- Achievement type validated against enum (leadership, academic, competition, personal_project)
- Date cannot be in the future
- File uploads limited to 5MB
- Only achievement owner can update/delete

**Authorization:**
- Write operations require authentication + active member status
- Ownership checks prevent unauthorized edits/deletes
- Public read access for viewing (no auth required)
- All operations logged in audit trail

**Data Integrity:**
- UUID used for external identification
- CASCADE delete when member is deleted
- Proper indexes for query performance
- Auto-updating timestamps

---

### 📝 Patterns Followed

**Backend:**
- transformKeys/transformArray for case conversion (snake_case DB → camelCase API)
- asyncHandler wrapper for error handling
- Standardized response helpers (successResponse, errorResponse, paginatedResponse)
- Audit logging with getClientInfo() for all operations
- COALESCE for partial updates in SQL

**Frontend:**
- camelCase TypeScript interfaces matching API responses
- Service layer abstraction (achievementService)
- Compound component pattern (Modal, Card)
- useState + useEffect for data fetching
- FileReader for image preview
- Native HTML elements (select, date input)
- Optimistic UI updates with error recovery

**Database:**
- UUID for external IDs, integer for internal IDs
- snake_case column naming
- Proper indexing for query performance
- CHECK constraints for data validation
- Triggers for auto-updating timestamps

---

### 🧪 Testing

**Migration:**
- ✅ Database migration ran successfully
- ✅ Table created with all fields and indexes
- ✅ Trigger installed for auto-updating updated_at

**Servers:**
- ✅ Backend running on http://localhost:5001
- ✅ Frontend running on http://localhost:5174
- ✅ All endpoints registered and accessible

**Integration:**
- ✅ All API endpoints integrated with frontend
- ✅ Profile page displays achievements tab
- ✅ Add/Edit/Delete modals functional
- ✅ Image upload working via feedService
- ✅ Real-time refresh after operations

---

## [1.1.1] - 2026-03-19

### 🎯 TypeScript & Database Schema Fixes

**Build error fixes and database schema updates for team posts feature.**

---

### 🔧 Fixed

#### TypeScript Build Errors (6 errors → 0 errors) ✅ FIXED

| File | Issue | Fix |
|------|-------|-----|
| `RegisterPage.tsx:64` | `handleChange` type didn't include `HTMLSelectElement` | Added `HTMLSelectElement` to union type |
| `CategoryManagement.tsx:5` | Unused `Badge` import | Removed unused import |
| `SearchPage.tsx:2,12` | Unused `Link` import and `member` variable | Removed unused imports |
| `CreateTeamPostModal.tsx:8,102` | Unused `getCategoryInfo` import and `categoryInfo` variable | Removed unused code |
| `TeamCard.tsx:4,55,58` | Unused `Badge` import + `projectCount` missing on `Team` type | Removed import, added `projectCount?: number` to Team interface |
| `TeamDetailPage.tsx:15` | Unused `Badge` import | Removed unused import |

**Files Fixed:**
- `frontend/src/auth/RegisterPage.tsx`
- `frontend/src/director/CategoryManagement.tsx`
- `frontend/src/search/SearchPage.tsx`
- `frontend/src/teams/CreateTeamPostModal.tsx`
- `frontend/src/teams/TeamCard.tsx`
- `frontend/src/teams/TeamDetailPage.tsx`
- `frontend/src/services/teamService.ts`

#### Database Schema - Missing `team_id` Column ✅ FIXED

- **Issue:** Team pending posts API returning 500 error: `column p.team_id does not exist`
- **Root Cause:** Posts table missing `team_id` column required for team posts feature
- **Fix:**
  1. Updated `backend/schema.sql` - Added `team_id INTEGER` column to posts table
  2. Added deferred foreign key constraint: `ALTER TABLE posts ADD CONSTRAINT fk_posts_team FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE SET NULL`
  3. Added index: `CREATE INDEX idx_posts_team ON posts(team_id) WHERE team_id IS NOT NULL`
- **Migration:** `backend/migrations/004_add_team_to_posts.sql` already exists - needs to be applied to existing databases

---

### 📝 Changed

#### Schema Documentation
- Updated `backend/schema.sql` with team_id column and proper foreign key constraints
- Added index for posts.team_id for query performance

---

### 📊 Statistics

**Build Status:**
- Before: 6 TypeScript errors
- After: 0 errors (clean build)
- Warning: Node.js version 20.12.2 vs recommended 20.19+ (non-blocking)

**Files Modified:**
- Frontend: 7 files
- Backend: 1 file (schema.sql)
- Total: 8 files changed

---

### 🚨 Action Required

**For existing databases, run migration 004:**
```bash
cd backend
psql -U postgres -d aquaterra_community -f migrations/004_add_team_to_posts.sql
```

Or run this SQL directly:
```sql
ALTER TABLE posts ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(team_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_posts_team ON posts(team_id);
```

---

## [0.9.0] - Previous Release

Previous features include:
- ✅ Google OAuth Authentication
- ✅ Member Registration & Approval System
- ✅ Post System with Categories
- ✅ Multi-Category Posts
- ✅ Multi-Director Approval Workflow
- ✅ Projects & Teams
- ✅ Public Feed
- ✅ Profile Pages (Public & Private)
- ✅ Director Dashboard
- ✅ Post Moderation
- ✅ Member Directory
- ✅ Category Management
- ✅ Global Search
- ✅ Image Uploads (Azure Blob Storage)
- ✅ @Mentions and Tags
- ✅ Like System
- ⏳ Schools Integration (partial)

---

## Versioning

This project follows [Semantic Versioning](https://semver.org/):
- **MAJOR** version for incompatible API changes
- **MINOR** version for new functionality in a backward compatible manner
- **PATCH** version for backward compatible bug fixes

---

## Links

- **Main Documentation:** CODING_CONTEXT.md
- **Architecture:** ARCHITECTURE.md
- **Testing:** TESTING_GUIDE.md
- **Features:** IMPLEMENTATION_CONTEXT.md

---

**Last Updated:** 2026-03-19 (v1.1.1)
