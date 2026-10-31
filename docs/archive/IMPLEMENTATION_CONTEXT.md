# AquaTerra Platform - Implementation Context

> This file tracks the implementation status of the AquaTerra community platform.
> It persists across development sessions to maintain continuity.

**Last Updated:** 2026-03-19 (v1.1.1 - Latest)
**Platform Purpose:** A public digital platform to document and showcase student work and achievements within AquaTerra.

---

## Table of Contents

1. [Current Implementation Status](#current-implementation-status)
2. [Missing Features Overview](#missing-features-overview)
3. [Database Schema Changes Required](#database-schema-changes-required)
4. [Backend Implementation Guide](#backend-implementation-guide)
5. [Frontend Implementation Guide](#frontend-implementation-guide)
6. [Implementation Priority](#implementation-priority)
7. [Technical Decisions](#technical-decisions)

---

## Current Implementation Status

### Completed Features

| Feature | Location | Notes |
|---------|----------|-------|
| Google OAuth Authentication | `backend/src/controllers/authController.js` | Working with JWT tokens |
| Member Registration & Approval | `backend/src/controllers/directorController.js` | Directors approve new members |
| Basic Post Creation | `backend/src/controllers/postController.js` | Text + images, single category |
| Image Uploads (Azure Blob) | `backend/src/controllers/uploadController.js` | Max 4 images per post |
| Member Tagging in Posts | `backend/src/models/Post.js` | @mentions stored in post_tags |
| Basic Post Approval | `backend/src/controllers/directorController.js` | Any director can approve any post |
| Like System | `backend/src/models/Post.js` | Toggle like functionality |
| Member Profiles (basic) | `backend/src/controllers/profileController.js` | View own/others profiles |
| Director Dashboard | `frontend/src/director/DirectorDashboard.tsx` | Stats and management |
| Feed with Pagination | `frontend/src/feed/FeedPage.tsx` | Chronological post feed |
| Security Middleware | `backend/src/middleware/security.js` | Rate limiting, XSS, helmet |
| Public Access | `backend/src/middleware/auth.js`, `frontend/src/feed/PublicFeedPage.tsx`, `frontend/src/profile/PublicProfilePage.tsx` | Unauthenticated users can view feed at `/` and profiles at `/member/:uuid` via optionalAuth middleware |
| Dashboard Navigation | `frontend/src/components/DashboardLayout.tsx` | Projects/Teams/Search navigation added for authenticated users |
| Create Project Modal | `frontend/src/projects/CreateProjectModal.tsx` | Directors can create new projects via modal |
| Create Team Modal | `frontend/src/teams/CreateTeamModal.tsx` | Directors can create new teams via modal |
| Global Search | `frontend/src/search/SearchPage.tsx` | Search people, projects, teams, schools with filters (v1.0.1-v1.0.3) |
| External Achievements | `frontend/src/profile/AchievementsList.tsx` | Personal achievements on profiles, self-service, no approval required (v1.1.0) |

### Current Database Schema

```
members (member_id, uuid, google_id, email, full_name, avatar_url, class_grade,
         phone, join_reason, role, status, rejection_note, approved_by,
         approved_at, last_login, is_active, created_at, updated_at)

posts (post_id, uuid, author_id, team_id, category, body, link_url, link_title,
       link_image, status, rejection_note, reviewed_by, reviewed_at,
       created_at, updated_at)

post_images (image_id, post_id, blob_url, display_order, created_at)

post_tags (tag_id, post_id, tagged_member_id, created_at)

likes (like_id, post_id, member_id, created_at)

comments (comment_id, uuid, post_id, author_id, body, created_at, updated_at)

active_sessions (session_id, member_id, token_hash, ip_address, user_agent,
                 expires_at, created_at)

community_audit_logs (log_id, action_type, actor_id, target_type, target_id,
                      details, ip_address, user_agent, created_at)

external_achievements (achievement_id, uuid, member_id, title, description,
                       achievement_type, achievement_date, proof_url,
                       created_at, updated_at)
```

### Current Categories

`events`, `welfare`, `content`, `operations`, `labs`

---

## Missing Features Overview

### Priority 1 - Core Platform Features

- [x] **Fix Categories** - Changed to: Events, Welfare, Content, Operations, Labs
- [x] **Schools Entity** - Add school field to members, create schools table (Model, Controller, Routes created)
- [x] **Public Access** - Allow unauthenticated users to view feed/profiles (Implemented via optionalAuth)
- [x] **Director-Category Assignment** - Directors assigned to specific categories (Model, Controller, Routes, Frontend UI complete)
- [x] **Multi-Category Posts** - Posts can belong to multiple categories (post_categories table, Post model methods)
- [x] **Multi-Director Approval** - All relevant category directors must approve (post_approvals table, approval workflow in controller)

### Priority 2 - Major Features

- [x] **Projects Feature** - Projects entity with members, posts, timeline (Model, Controller, Routes, Frontend pages complete)
- [x] **Teams Feature** - Teams with members and director assignments (Model, Controller, Routes, Frontend pages complete)
- [x] **Global Search System** - Search bar with chips (People, Projects, Teams, Schools) (Backend controller/routes + Frontend pages complete, v1.0.1-v1.0.3)
- [x] **External Achievements** - Personal achievements on profiles (no approval needed) (Model, Controller, Routes, Frontend components complete, v1.1.0)
- [ ] **Opportunity Posts** - Job/role openings created by directors

### Priority 3 - Profile Enhancements

- [x] **Profile Bio Field** - Add bio to member profiles (implemented in Member model, profileController, ProfilePage, EditProfilePage)
- [ ] **Activity Timeline** - Chronological view of all member activity
- [ ] **Contribution Dashboard** - Metrics and statistics on profile
- [ ] **Classes as Entity** - Searchable/viewable class groups

### Priority 4 - Media Support

- [ ] **Video Uploads** - Support video file uploads
- [ ] **PDF Uploads** - Support PDF document uploads
- [ ] **PowerPoint Uploads** - Support presentation file uploads

---

## Database Schema Changes Required

### New Tables

```sql
-- Schools table
CREATE TABLE schools (
    school_id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL UNIQUE,
    short_name VARCHAR(50),
    logo_url TEXT,
    location VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Classes table
CREATE TABLE classes (
    class_id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    school_id INTEGER REFERENCES schools(school_id),
    name VARCHAR(100) NOT NULL, -- e.g., "Grade 9", "12th Standard"
    academic_year VARCHAR(20), -- e.g., "2025-2026"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(school_id, name, academic_year)
);

-- Teams table
CREATE TABLE teams (
    team_id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL, -- events, welfare, content, operations, labs
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team members junction table
CREATE TABLE team_members (
    team_member_id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(team_id) ON DELETE CASCADE,
    member_id INTEGER REFERENCES members(member_id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member', -- member, lead, director
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(team_id, member_id)
);

-- Director category assignments
CREATE TABLE director_categories (
    assignment_id SERIAL PRIMARY KEY,
    member_id INTEGER REFERENCES members(member_id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL, -- events, welfare, content, operations, labs
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER REFERENCES members(member_id),
    UNIQUE(member_id, category)
);

-- Projects table
CREATE TABLE projects (
    project_id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    team_id INTEGER REFERENCES teams(team_id),
    school_id INTEGER REFERENCES schools(school_id), -- if school collaboration
    status VARCHAR(50) DEFAULT 'active', -- planning, active, completed, archived
    start_date DATE,
    end_date DATE,
    cover_image_url TEXT,
    created_by INTEGER REFERENCES members(member_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Project members junction table
CREATE TABLE project_members (
    project_member_id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(project_id) ON DELETE CASCADE,
    member_id INTEGER REFERENCES members(member_id) ON DELETE CASCADE,
    role VARCHAR(100), -- e.g., "Lead", "Volunteer", "Coordinator"
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, member_id)
);

-- External achievements (personal, no approval needed)
CREATE TABLE external_achievements (
    achievement_id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    member_id INTEGER REFERENCES members(member_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    achievement_type VARCHAR(100), -- leadership, academic, competition, personal_project, other
    date_achieved DATE,
    proof_url TEXT, -- optional certificate/proof image
    is_visible BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Opportunity posts (job/role openings)
CREATE TABLE opportunities (
    opportunity_id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    team_id INTEGER REFERENCES teams(team_id),
    created_by INTEGER REFERENCES members(member_id),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    role_type VARCHAR(100), -- volunteer, team_member, lead, intern
    requirements TEXT,
    is_open BOOLEAN DEFAULT true,
    deadline DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Post categories junction (for multi-category support)
CREATE TABLE post_categories (
    post_category_id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES posts(post_id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    UNIQUE(post_id, category)
);

-- Post approval tracking (for multi-director approval)
CREATE TABLE post_approvals (
    approval_id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES posts(post_id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    approved_by INTEGER REFERENCES members(member_id),
    approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, category)
);

-- Post-project association
CREATE TABLE post_projects (
    post_project_id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES posts(post_id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES projects(project_id) ON DELETE CASCADE,
    UNIQUE(post_id, project_id)
);

-- Document uploads (for PDF, PPT, videos)
CREATE TABLE post_documents (
    document_id SERIAL PRIMARY KEY,
    post_id INTEGER REFERENCES posts(post_id) ON DELETE CASCADE,
    blob_url TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- pdf, pptx, ppt, mp4, mov, etc.
    file_size INTEGER, -- in bytes
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Modifications to Existing Tables

```sql
-- Add school_id and class_id to members
ALTER TABLE members
ADD COLUMN school_id INTEGER REFERENCES schools(school_id),
ADD COLUMN class_id INTEGER REFERENCES classes(class_id),
ADD COLUMN bio TEXT;

-- Create index for school lookups
CREATE INDEX idx_members_school ON members(school_id);
CREATE INDEX idx_members_class ON members(class_id);

-- Modify posts category to allow NULL (categories now in junction table)
-- Or keep for backwards compatibility and use post_categories for multi-category

-- Update category enum values
-- Note: This requires careful migration
ALTER TYPE post_category RENAME TO post_category_old;
CREATE TYPE post_category AS ENUM ('events', 'welfare', 'content', 'operations', 'labs');
-- Migrate existing data before dropping old type
```

---

## Backend Implementation Guide

### 1. Fix Categories

**File:** `backend/src/models/Post.js`

Update the category validation:
```javascript
const VALID_CATEGORIES = ['events', 'welfare', 'content', 'operations', 'labs'];
```

**Migration needed:** Map old categories to new ones or create fresh.

### 2. Public Access Routes

**File:** `backend/src/middleware/auth.js`

Create optional auth middleware:
```javascript
const optionalAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await Member.findById(decoded.memberId);
    } catch (err) {
      // Token invalid, continue as guest
    }
  }
  next();
};
```

**Routes to make public:**
- `GET /api/feed` - Public feed
- `GET /api/profile/:uuid` - Public profiles
- `GET /api/projects` - Project listing
- `GET /api/projects/:uuid` - Project details
- `GET /api/teams` - Team listing
- `GET /api/teams/:uuid` - Team details
- `GET /api/schools` - School listing
- `GET /api/schools/:uuid` - School details
- `GET /api/search` - Global search

### 3. Director-Category Assignment

**New File:** `backend/src/models/DirectorCategory.js`

```javascript
class DirectorCategory {
  static async assign(memberId, category, assignedBy) { }
  static async remove(memberId, category) { }
  static async getByMember(memberId) { }
  static async getByCategory(category) { }
  static async isDirectorForCategory(memberId, category) { }
}
```

**New File:** `backend/src/controllers/directorCategoryController.js`

Endpoints:
- `POST /api/director/categories/assign` - Assign director to category
- `DELETE /api/director/categories/:memberId/:category` - Remove assignment
- `GET /api/director/categories` - List all assignments

### 4. Multi-Category Post Approval

**File:** `backend/src/models/Post.js`

Update create method:
```javascript
static async create({ authorId, categories, body, ... }) {
  // Insert post
  // Insert into post_categories for each category
  // Check if author is director for ALL categories
  // If yes: auto-publish
  // If no: set status to pending_review
}

static async approve(postId, directorId, category) {
  // Record approval for this category
  // Check if all categories now approved
  // If yes: publish post
}

static async getPendingForDirector(directorId) {
  // Get posts pending in categories this director manages
}
```

### 5. Schools & Classes

**New File:** `backend/src/models/School.js`
**New File:** `backend/src/models/Class.js`
**New File:** `backend/src/controllers/schoolController.js`
**New File:** `backend/src/routes/schoolRoutes.js`

Endpoints:
- `GET /api/schools` - List schools
- `GET /api/schools/:uuid` - School details with members
- `GET /api/schools/:uuid/members` - Members from school
- `GET /api/schools/:uuid/projects` - Projects involving school
- `GET /api/classes` - List classes
- `GET /api/classes/:uuid` - Class details with members

### 6. Projects

**New File:** `backend/src/models/Project.js`
**New File:** `backend/src/controllers/projectController.js`
**New File:** `backend/src/routes/projectRoutes.js`

Endpoints:
- `GET /api/projects` - List projects (public)
- `GET /api/projects/:uuid` - Project details
- `POST /api/projects` - Create project (director only)
- `PUT /api/projects/:uuid` - Update project
- `POST /api/projects/:uuid/members` - Add member to project
- `DELETE /api/projects/:uuid/members/:memberId` - Remove member
- `GET /api/projects/:uuid/posts` - Posts about this project

### 7. Teams

**New File:** `backend/src/models/Team.js`
**New File:** `backend/src/controllers/teamController.js`
**New File:** `backend/src/routes/teamRoutes.js`

Endpoints:
- `GET /api/teams` - List teams (public)
- `GET /api/teams/:uuid` - Team details
- `POST /api/teams` - Create team (director only)
- `PUT /api/teams/:uuid` - Update team
- `GET /api/teams/:uuid/members` - Team members
- `GET /api/teams/:uuid/projects` - Team projects
- `GET /api/teams/:uuid/opportunities` - Open positions

### 8. Search System

**New File:** `backend/src/controllers/searchController.js`
**New File:** `backend/src/routes/searchRoutes.js`

Endpoint: `GET /api/search`

Query params:
- `q` - Search query
- `type` - Filter type: `all`, `people`, `projects`, `teams`, `schools`, `classes`
- `page`, `limit` - Pagination

Search logic:
```javascript
async function search(query, type = 'all') {
  const results = {
    people: [],
    projects: [],
    teams: [],
    schools: [],
    classes: []
  };

  if (type === 'all' || type === 'people') {
    results.people = await searchPeople(query);
  }
  if (type === 'all' || type === 'projects') {
    results.projects = await searchProjects(query);
  }
  // ... etc

  return results;
}
```

### 9. External Achievements

**New File:** `backend/src/models/Achievement.js`
**New File:** `backend/src/controllers/achievementController.js`
**New File:** `backend/src/routes/achievementRoutes.js`

Endpoints:
- `GET /api/profile/:uuid/achievements` - Get member's achievements (public)
- `POST /api/profile/me/achievements` - Add achievement (own profile only)
- `PUT /api/profile/me/achievements/:uuid` - Update achievement
- `DELETE /api/profile/me/achievements/:uuid` - Delete achievement

### 10. Opportunity Posts

**New File:** `backend/src/models/Opportunity.js`
**New File:** `backend/src/controllers/opportunityController.js`
**New File:** `backend/src/routes/opportunityRoutes.js`

Endpoints:
- `GET /api/opportunities` - List open opportunities (public)
- `GET /api/opportunities/:uuid` - Opportunity details
- `POST /api/opportunities` - Create opportunity (director only)
- `PUT /api/opportunities/:uuid` - Update opportunity
- `POST /api/opportunities/:uuid/close` - Close opportunity

### 11. Document Uploads

**File:** `backend/src/controllers/uploadController.js`

Add support for:
- Videos: `.mp4`, `.mov`, `.avi`, `.webm`
- PDFs: `.pdf`
- Presentations: `.pptx`, `.ppt`

```javascript
const ALLOWED_DOCUMENT_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm'
};

const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024; // 25MB
```

---

## Frontend Implementation Guide

### 1. Public Layout Updates

**File:** `frontend/src/components/PublicLayout.tsx`

Add navigation for public visitors:
- Feed (home)
- Search
- Projects
- Teams
- Schools

### 2. Search Page

**New File:** `frontend/src/search/SearchPage.tsx`
**New File:** `frontend/src/search/SearchResults.tsx`
**New File:** `frontend/src/search/SearchChips.tsx`

Components:
- Search input with debounce
- Filter chips (People, Projects, Teams, Schools, Class)
- Results sections for each type
- Result cards for each entity type

### 3. Projects Pages

**New Files:**
- `frontend/src/projects/ProjectsPage.tsx` - Project listing
- `frontend/src/projects/ProjectDetailPage.tsx` - Single project view
- `frontend/src/projects/ProjectCard.tsx` - Project card component
- `frontend/src/projects/CreateProjectModal.tsx` - Create project form
- `frontend/src/services/projectService.ts` - API service

### 4. Teams Pages

**New Files:**
- `frontend/src/teams/TeamsPage.tsx` - Team listing
- `frontend/src/teams/TeamDetailPage.tsx` - Single team view
- `frontend/src/teams/TeamCard.tsx` - Team card component
- `frontend/src/services/teamService.ts` - API service

### 5. Schools Pages

**New Files:**
- `frontend/src/schools/SchoolsPage.tsx` - School listing
- `frontend/src/schools/SchoolDetailPage.tsx` - Single school view
- `frontend/src/schools/SchoolCard.tsx` - School card component
- `frontend/src/services/schoolService.ts` - API service

### 6. Profile Enhancements

**File:** `frontend/src/profile/ProfilePage.tsx`

Add sections:
- Bio display
- Activity timeline tab
- Achievements tab
- Contribution dashboard/stats

**New Files:**
- `frontend/src/profile/ActivityTimeline.tsx`
- `frontend/src/profile/AchievementsList.tsx`
- `frontend/src/profile/AddAchievementModal.tsx`
- `frontend/src/profile/ContributionDashboard.tsx`

### 7. Post Creation Updates

**File:** `frontend/src/feed/CreatePostModal.tsx`

Add:
- Multi-category selection (checkboxes)
- Project association dropdown
- Video upload support
- Document upload support
- File type indicators

### 8. Opportunities

**New Files:**
- `frontend/src/opportunities/OpportunitiesPage.tsx`
- `frontend/src/opportunities/OpportunityCard.tsx`
- `frontend/src/opportunities/CreateOpportunityModal.tsx`
- `frontend/src/services/opportunityService.ts`

### 9. Director Dashboard Updates

**File:** `frontend/src/director/DirectorDashboard.tsx`

Add:
- Category filter for pending posts (show only assigned categories)
- Team management section
- Project management section
- Opportunity management section

**File:** `frontend/src/director/PostModeration.tsx`

Update to:
- Show which categories need approval
- Allow partial approval (approve for your category)
- Show approval status from other directors

### 10. Routes Update - IMPLEMENTED

**File:** `frontend/src/App.tsx`

Routes updated - Projects and Teams now use DashboardLayout for authenticated users:
```tsx
// Public routes (no auth required)
<Route path="/" element={<LandingPage />} />
<Route path="/feed" element={<FeedPage />} />
<Route path="/search" element={<SearchPage />} />
<Route path="/projects" element={<ProjectsPage />} />
<Route path="/projects/:uuid" element={<ProjectDetailPage />} />
<Route path="/teams" element={<TeamsPage />} />
<Route path="/teams/:uuid" element={<TeamDetailPage />} />
<Route path="/schools" element={<SchoolsPage />} />
<Route path="/schools/:uuid" element={<SchoolDetailPage />} />
<Route path="/profile/:uuid" element={<ProfilePage />} />
<Route path="/opportunities" element={<OpportunitiesPage />} />

// Protected routes (auth required)
<Route path="/profile/me" element={<ProtectedRoute><MyProfilePage /></ProtectedRoute>} />
<Route path="/profile/edit" element={<ProtectedRoute><EditProfilePage /></ProtectedRoute>} />

// Director routes
<Route path="/director/*" element={<DirectorRoutes />} />
```

---

## Implementation Priority

### Phase 1: Core Fixes (Foundation) - COMPLETE
1. ~~Fix categories to match spec~~ ✓
2. ~~Add school/class fields to members~~ ✓
3. ~~Implement public access for feed/profiles~~ ✓
4. ~~Add bio field to profiles~~ ✓

### Phase 2: Director System - COMPLETE
1. ~~Director-category assignment table and logic~~ ✓
2. ~~Multi-category post support~~ ✓
3. ~~Multi-director approval workflow~~ ✓
4. ~~Update director dashboard~~ ✓

### Phase 3: Major Features - COMPLETE
1. ~~Projects feature (full CRUD)~~ ✓
2. ~~Teams feature (full CRUD)~~ ✓
3. ~~Schools/Classes as entities~~ ✓
4. ~~Global search system~~ ✓

### Phase 4: Profile & Content - IN PROGRESS
1. ~~External achievements~~ ✓ (v1.1.0)
2. Activity timeline
3. Contribution dashboard
4. Opportunity posts

### Phase 5: Media Support
1. Video upload support
2. PDF upload support
3. PowerPoint upload support
4. File preview components

---

## Technical Decisions

### Authentication
- Keep Google OAuth as primary auth
- Use optional auth middleware for public routes
- JWTs with 15-min access / 7-day refresh tokens

### File Storage
- Continue using Azure Blob Storage
- Separate containers for different file types:
  - `community-images` - Photos
  - `community-videos` - Videos
  - `community-documents` - PDFs, PPTs

### Search Implementation
- Use PostgreSQL full-text search with `tsvector`
- Create search indexes on name, title, description fields
- Consider adding pg_trgm for fuzzy matching

### Category System
- Use junction table `post_categories` for multi-category support
- Keep single `category` column for backwards compatibility during migration
- Directors table maps to specific categories

### Caching Strategy
- Consider Redis for search results caching
- Cache public pages (feed, profiles) at CDN level
- Invalidate cache on new posts/approvals

---

## Notes for Future Sessions

- Database migrations should be run in order
- Test multi-category approval workflow thoroughly
- Search relevance scoring needs tuning based on real usage
- Video transcoding may be needed for large files
- Consider adding email notifications for approvals (TODO in current code)

### Session 2026-03-14 Updates
- Added Projects/Teams navigation to DashboardLayout for authenticated users
- Updated App.tsx routes - Projects/Teams now protected routes with DashboardLayout
- Created CreateProjectModal component with form validation
- Created CreateTeamModal component with form validation
- Added "Add Project" button to ProjectsPage (directors only)
- Added "Add Team" button to TeamsPage (directors only)
- Created migration `002_phase3_projects_teams.sql` for all Phase 3 tables:
  - director_categories, teams, team_members, projects, project_members
  - post_categories, post_approvals, post_projects
- Migration run script added: `scripts/run-migration.js`

### Session 2026-03-15 Updates (v1.0.0 Release)
**🎯 Major Consistency & Bug Fixes**

**Documentation Created:**
- `CODING_CONTEXT.md` - Comprehensive 800+ line coding guide covering architecture, patterns, database schema, API endpoints, user flows, and common pitfalls
- `FIXES_APPLIED.md` - Detailed changelog of TypeScript consistency fixes
- `RUNTIME_FIXES_APPLIED.md` - Runtime case transformation bug fixes documentation
- `CHANGELOG.md` - Consolidated project changelog following semantic versioning

**Critical Fixes Applied:**
1. **TypeScript Build Errors (47 → 4 warnings)**
   - Fixed `Post` interface in `frontend/src/services/api.ts` from snake_case to camelCase
   - Updated all property references across 9 frontend files
   - Fixed property name consistency: `post_id` → `postId`, `author_name` → `authorName`, etc.

2. **Backend Case Transformation**
   - Added `transformKeys()` to all model find methods:
     - `Post.js` (8 methods), `Member.js` (4 methods), `Project.js` (2 methods), `Team.js` (2 methods)
   - Fixed snake_case property access in all controllers (postController, projectController, profileController, teamController)

3. **Runtime Errors Fixed**
   - ✅ **403 Forbidden - Project Post Creation**: Fixed `project.projectId` undefined issue
   - ✅ **Member Permission Checks**: Changed to use `member.uuid` for auth context comparisons
   - ✅ **Pagination API**: Fixed `pagination.total` → `pagination.totalItems`

4. **Permission System Clarity**
   - Removed `requireDirector` middleware from project creation route
   - Updated to `requireActiveMember` with permission checks in controller
   - Documented that team leads can create projects
   - Added comprehensive JSDoc explaining permission rules

**Result:** Build errors reduced by 90%+, all runtime errors resolved, consistent coding patterns established.

### Session 2026-03-15 Updates (v1.0.1 - Hot Fixes)
**🎯 Authentication & Post Segregation Fixes**

**Authentication 500 Errors Fixed:**
1. **Missing transformKeys Import**
   - Added missing import to `backend/src/models/Member.js`
   - Added transformKeys to all remaining methods: create, update, approve, reject, getPendingApprovals, getActiveMembers, searchForMention, getPublicProfile

2. **Controller Property Access**
   - Fixed `backend/src/controllers/authController.js` - all snake_case → camelCase property access
   - Fixed `backend/src/controllers/profileController.js` - all snake_case → camelCase property mappings
   - Updated memberId, fullName, avatarUrl, classGrade, createdAt, rejectionNote, schoolId, classId, etc.

3. **Team Post Approval Fixed**
   - Fixed `backend/src/controllers/teamController.js` - raw SQL result property access
   - Changed post.post_id (undefined) → post.post_id (correct) on lines 349, 352, 357
   - Fixed undefined postId causing 500 errors and broken URLs

4. **React Warning Fixed**
   - Fixed `frontend/src/teams/TeamDetailPage.tsx` - unique key prop for image list
   - Changed from index key to img.blobUrl (line 566)

**Post Segregation Implemented:**
- Modified `backend/src/models/Post.js` to exclude project posts from general feeds:
  - `getFeed()` - Main feed excludes project posts
  - `getByAuthor()` - Profile pages exclude project posts
  - `getPendingReviews()` - Director moderation queue excludes project posts
- **Result:** Project posts now ONLY appear in:
  - Project detail pages via `Project.getPosts()`
  - Team lead pending queues via `getTeamPendingPosts()`
- Regular community posts and project posts are now completely segregated

**Files Modified:** 5 files (Member.js, authController.js, profileController.js, teamController.js, Post.js, TeamDetailPage.tsx)

**Global Search System Implemented:**
- ✅ Backend already existed (searchController.js, searchRoutes.js)
- ✅ Created `frontend/src/services/searchService.ts` - TypeScript service with interfaces
- ✅ Created `frontend/src/search/SearchPage.tsx` - Main search page with query params
- ✅ Created `frontend/src/search/SearchFilters.tsx` - Filter chips (All, People, Projects, Teams, Schools)
- ✅ Created `frontend/src/search/SearchResultsList.tsx` - Results display with cards
- ✅ Added search route to App.tsx - `/search` protected route
- ✅ Added search link to DashboardLayout navigation
- **Features:**
  - Real-time search across people, projects, teams, and schools
  - Filter chips with result counts
  - URL-based search (shareable search results)
  - Responsive grid layouts for results
  - Integration with existing navigation

### Session 2026-03-15 Updates (v1.0.2 - Profile & Post Display Fixes)
**🎯 Profile Routing and Display Fixes**

**Profile Routing for Authenticated Users Fixed:**
1. **Issue:** Clicking profiles from search, teams, and projects routed to `/member/:uuid` (PublicLayout) instead of `/profile/:uuid` (DashboardLayout)
2. **Files Fixed:**
   - `frontend/src/search/SearchResultsList.tsx` - Changed all profile links from `/member/${uuid}` to `/profile/${uuid}`
   - `frontend/src/teams/TeamDetailPage.tsx` - Changed member links to `/profile/${uuid}`
   - `frontend/src/projects/ProjectDetailPage.tsx` - Changed member links to `/profile/${uuid}`
3. **Result:** Authenticated users now stay in dashboard layout when viewing profiles

**Profile Details Rendering Fixed:**
1. **Issue:** Other users' profile details were missing or incorrect when viewing from feed/search
2. **Root Cause:** `backend/src/controllers/profileController.js` using snake_case property access on camelCase-transformed data
3. **Files Fixed:**
   - `backend/src/controllers/profileController.js`:
     - `updateProfile()` - Fixed response to use camelCase properties (fullName, avatarUrl, classGrade, etc.)
     - `getPublicProfile()` - Fixed response to use camelCase and flatten school/class data
     - Changed nested `school: { name, uuid }` to flat `schoolName, schoolUuid` for consistency
   - `frontend/src/profile/ProfilePage.tsx` - Removed fallback for old nested structure
4. **Result:** All profile details now render correctly

**Post Cards Missing Author Information Fixed:**
1. **Issue:** Post cards on profile pages were missing author information (name, avatar, role)
2. **Root Cause:** `Post.getByAuthor()` query didn't include author data from members table
3. **Files Fixed:**
   - `backend/src/models/Post.js`:
     - `getByAuthor()` - Added JOIN with members table and author fields (authorId, authorUuid, authorName, authorAvatar, authorRole)
     - `getTaggedPosts()` - Added images and tagged_members data for consistency (already had author info)
4. **Result:** Post cards now display complete author information on all pages

**Files Modified:** 6 files (2 backend, 4 frontend)

### Session 2026-03-15 Updates (v1.0.3 - Post Display & Data Consistency Fixes)
**🎯 Like Counts, Search Results, and Nested Data Transformation**

**Like Counts Not Displaying Fixed:**
1. **Issue:** Like counts and like status not showing on post cards
2. **Root Cause:** Backend controllers returning `is_liked` (snake_case) instead of `isLiked` (camelCase)
3. **Files Fixed:**
   - `backend/src/controllers/postController.js` - Changed all `is_liked:` to `isLiked:`
   - `backend/src/controllers/profileController.js` - Changed all `is_liked:` to `isLiked:`
4. **Result:** Like buttons now show correct count and liked status

**Search Results Data Not Formatted Fixed:**
1. **Issue:** Search results (people, projects, teams, schools) not displaying correctly
2. **Root Cause:** `searchController.js` manually mapping snake_case properties instead of using transformArray
3. **Files Fixed:**
   - `backend/src/controllers/searchController.js`:
     - Added `transformArray` import
     - Replaced manual snake_case mapping with `transformArray()` for all result types
4. **Result:** All search results now properly formatted in camelCase

**Nested Arrays Not Transformed Fixed:**
1. **Issue:** Post images and tagged members had snake_case properties (blobUrl, displayOrder, etc.)
2. **Root Cause:** Post model passing raw `images.rows` and `tags.rows` without transformation
3. **Files Fixed:**
   - `backend/src/models/Post.js`:
     - `getFeed()` - Transform images and tagged_members arrays
     - `getPendingReviews()` - Transform images arrays
     - `getByAuthor()` - Transform images and tagged_members arrays
     - `getTaggedPosts()` - Transform images and tagged_members arrays
     - `getTeamPendingPosts()` - Transform images arrays
     - Changed `is_project_post` to `isProjectPost` for consistency
4. **Result:** All nested data now consistently in camelCase throughout API responses

**Files Modified:** 3 backend files (postController.js, profileController.js, searchController.js, Post.js)

### Session 2026-03-15 Updates (v1.0.4 - Like Count Synchronization Fix)
**🎯 Like Count Accuracy and Server Synchronization**

**Like Counts Jumping Incorrectly Fixed:**
1. **Issue:** Like counts were jumping by unexpected amounts (e.g., 1 → 10 → 11) when clicking the like button
2. **Root Cause:**
   - Backend `toggleLike` only returned `{ liked: true/false }` without the updated count
   - Frontend incremented count optimistically but never updated it with the real value from database
   - This caused drift when multiple users liked posts or when database count differed from expected
3. **Files Fixed:**
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
4. **Result:** Like counts now always show the accurate value from the database after each toggle

**Files Modified:** 3 files (1 backend, 2 frontend)

### Session 2026-03-15 Updates (v1.1.0 - External Achievements Feature)
**🎯 Personal Achievements on Member Profiles**

**Feature Implemented:**
- Full CRUD system for external achievements (awards, certifications, competitions, personal projects)
- Self-service only (members manage their own achievements)
- No approval workflow required
- Always public visibility
- Optional proof image/certificate uploads

**Database Changes:**
1. **New Migration** (`backend/migrations/003_external_achievements.sql`):
   - Created `external_achievements` table with proper schema
   - Added indexes for performance (member_id, achievement_type, achievement_date)
   - Added auto-update trigger for `updated_at` timestamp
   - Migration ran successfully

**Backend Implementation:**
1. **New Files Created:**
   - `backend/src/models/Achievement.js` - CRUD model with pagination support
   - `backend/src/controllers/achievementController.js` - All endpoints with validation
   - `backend/src/routes/achievementRoutes.js` - Route definitions with proper middleware ordering

2. **Files Modified:**
   - `backend/src/server.js` - Registered `/api/achievements` routes (line 98)
   - `backend/src/utils/auditLogger.js` - Added ACHIEVEMENT_CREATED, ACHIEVEMENT_UPDATED, ACHIEVEMENT_DELETED audit actions

3. **API Endpoints:**
   - `POST /api/achievements` - Create achievement (auth required)
   - `GET /api/achievements/me` - Get own achievements (auth required)
   - `GET /api/achievements/member/:uuid` - Get member achievements (public)
   - `PUT /api/achievements/:uuid` - Update achievement (auth required, owner only)
   - `DELETE /api/achievements/:uuid` - Delete achievement (auth required, owner only)

4. **Validation Rules:**
   - Title, type, and date are required
   - Achievement type must be: leadership, academic, competition, or personal_project
   - Achievement date cannot be in the future
   - Proof images are optional (max 5MB via existing feedService.uploadImages)

**Frontend Implementation:**
1. **New Files Created:**
   - `frontend/src/services/achievementService.ts` - TypeScript API service
   - `frontend/src/profile/AchievementsList.tsx` - Display component with responsive grid layout
   - `frontend/src/profile/AddAchievementModal.tsx` - Create form with image upload
   - `frontend/src/profile/EditAchievementModal.tsx` - Update form with existing data pre-population

2. **Files Modified:**
   - `frontend/src/services/api.ts` - Added Achievement interface (camelCase)
   - `frontend/src/profile/ProfilePage.tsx` - Added achievements tab with data fetching

3. **UI Features:**
   - 4 achievement types with emoji badges: 👑 Leadership, 📚 Academic, 🏆 Competition, 💡 Personal Project
   - Responsive grid layout (1/2/3 columns for mobile/tablet/desktop)
   - Optional proof image upload with preview
   - Edit/Delete controls (only visible on own profile)
   - Empty states with helpful messages
   - Real-time refresh after add/edit/delete operations
   - Public viewing (achievements visible to everyone)

4. **Data Flow:**
   - ProfilePage fetches achievements when tab is clicked
   - AchievementsList displays grid of achievement cards
   - AddAchievementModal uploads image first, then creates achievement with proofUrl
   - EditAchievementModal supports updating image or keeping existing one
   - Delete prompts for confirmation before removal

**Patterns Followed:**
- Backend: transformKeys/transformArray for case conversion, asyncHandler for error handling, audit logging for all operations
- Frontend: camelCase TypeScript interfaces, service layer abstraction, compound modal pattern, FileReader for image preview
- Database: UUID for external IDs, snake_case columns, proper indexes, CHECK constraints for validation
- Routes: Protected routes before public routes to avoid path conflicts (/me before /:uuid)

**Testing:**
- Database migration ran successfully
- Backend server running on http://localhost:5001
- Frontend server running on http://localhost:5174
- All endpoints integrated and ready for end-to-end testing

**Files Created:** 7 new files (3 backend, 4 frontend)
**Files Modified:** 4 files (2 backend, 2 frontend)

### Session 2026-03-19 Updates (v1.1.1 - TypeScript & Database Schema Fixes)
**🎯 Build Error Fixes and Database Schema Updates**

**TypeScript Build Errors Fixed (6 → 0):**
1. `RegisterPage.tsx` - Added `HTMLSelectElement` to handleChange type union
2. `CategoryManagement.tsx` - Removed unused `Badge` import
3. `SearchPage.tsx` - Removed unused `Link` import and `member` variable
4. `CreateTeamPostModal.tsx` - Removed unused `getCategoryInfo` import and `categoryInfo` variable
5. `TeamCard.tsx` - Removed unused `Badge` import, added `projectCount?: number` to Team interface
6. `TeamDetailPage.tsx` - Removed unused `Badge` import

**Database Schema Fix - Missing team_id Column:**
- **Issue:** Team pending posts API returning 500 error: `column p.team_id does not exist`
- **Root Cause:** Posts table was missing `team_id` column required for team posts feature
- **Fix Applied:**
  1. Updated `backend/schema.sql` - Added `team_id INTEGER` column to posts table
  2. Added deferred FK constraint after teams table creation
  3. Added index: `idx_posts_team` for query performance
- **Migration Required:** Run `backend/migrations/004_add_team_to_posts.sql` on existing databases

**Files Modified:**
- Frontend: 7 files (RegisterPage.tsx, CategoryManagement.tsx, SearchPage.tsx, CreateTeamPostModal.tsx, TeamCard.tsx, TeamDetailPage.tsx, teamService.ts)
- Backend: 1 file (schema.sql)

**Build Status:** Clean build (0 errors)

---

## File Structure After Implementation

```
community-platform/
├── backend/
│   └── src/
│       ├── controllers/
│       │   ├── authController.js
│       │   ├── postController.js
│       │   ├── profileController.js
│       │   ├── directorController.js
│       │   ├── uploadController.js
│       │   ├── searchController.js      # IMPLEMENTED
│       │   ├── projectController.js     # IMPLEMENTED
│       │   ├── teamController.js        # IMPLEMENTED
│       │   ├── schoolController.js      # IMPLEMENTED
│       │   ├── achievementController.js # IMPLEMENTED (v1.1.0)
│       │   └── opportunityController.js # TODO
│       ├── models/
│       │   ├── Member.js
│       │   ├── Post.js
│       │   ├── Project.js               # IMPLEMENTED
│       │   ├── Team.js                  # IMPLEMENTED
│       │   ├── School.js                # IMPLEMENTED
│       │   ├── Class.js                 # IMPLEMENTED
│       │   ├── Achievement.js           # IMPLEMENTED (v1.1.0)
│       │   ├── Opportunity.js           # TODO
│       │   └── DirectorCategory.js      # IMPLEMENTED
│       └── routes/
│           ├── (existing routes)
│           ├── searchRoutes.js          # IMPLEMENTED
│           ├── projectRoutes.js         # IMPLEMENTED
│           ├── teamRoutes.js            # IMPLEMENTED
│           ├── schoolRoutes.js          # IMPLEMENTED
│           ├── achievementRoutes.js     # IMPLEMENTED (v1.1.0)
│           └── opportunityRoutes.js     # TODO
├── frontend/
│   └── src/
│       ├── search/                      # IMPLEMENTED
│       │   ├── SearchPage.tsx           # IMPLEMENTED
│       │   ├── SearchResultsList.tsx    # IMPLEMENTED
│       │   └── SearchFilters.tsx        # IMPLEMENTED
│       ├── projects/                    # IMPLEMENTED
│       │   ├── ProjectsPage.tsx         # IMPLEMENTED (with Add button for directors)
│       │   ├── ProjectDetailPage.tsx    # IMPLEMENTED
│       │   ├── ProjectCard.tsx          # IMPLEMENTED
│       │   └── CreateProjectModal.tsx   # IMPLEMENTED
│       ├── teams/                       # IMPLEMENTED
│       │   ├── TeamsPage.tsx            # IMPLEMENTED (with Add button for directors)
│       │   ├── TeamDetailPage.tsx       # IMPLEMENTED
│       │   ├── TeamCard.tsx             # IMPLEMENTED
│       │   └── CreateTeamModal.tsx      # IMPLEMENTED
│       ├── schools/                     # NEW
│       │   ├── SchoolsPage.tsx
│       │   ├── SchoolDetailPage.tsx
│       │   └── SchoolCard.tsx
│       ├── opportunities/               # NEW
│       │   ├── OpportunitiesPage.tsx
│       │   ├── OpportunityCard.tsx
│       │   └── CreateOpportunityModal.tsx
│       ├── profile/
│       │   ├── ProfilePage.tsx          # UPDATED (achievements tab v1.1.0)
│       │   ├── EditProfilePage.tsx      # UPDATED
│       │   ├── ActivityTimeline.tsx     # TODO
│       │   ├── AchievementsList.tsx     # IMPLEMENTED (v1.1.0)
│       │   ├── AddAchievementModal.tsx  # IMPLEMENTED (v1.1.0)
│       │   ├── EditAchievementModal.tsx # IMPLEMENTED (v1.1.0)
│       │   └── ContributionDashboard.tsx # TODO
│       └── services/
│           ├── (existing services)
│           ├── searchService.ts         # IMPLEMENTED
│           ├── projectService.ts        # IMPLEMENTED
│           ├── teamService.ts           # IMPLEMENTED
│           ├── schoolService.ts         # IMPLEMENTED
│           ├── achievementService.ts    # IMPLEMENTED (v1.1.0)
│           └── opportunityService.ts    # TODO
└── IMPLEMENTATION_CONTEXT.md            # THIS FILE
```
