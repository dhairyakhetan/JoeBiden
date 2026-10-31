# AquaTerra Community Learning Platform - Architecture Decision

## Executive Summary

After thorough analysis of the existing volunteer dashboard codebase, I recommend **creating a new separate application** (`community-platform/`) that **reuses patterns and Azure infrastructure** from the existing dashboard but maintains its own codebase. This document explains the reasoning and outlines the architecture.

---

## Existing Codebase Analysis

### Database (PostgreSQL)
- **Tables**: schools, organizations, students, teachers, verifiers, activities, activity_categories, audit_logs, active_sessions
- **Pattern**: UUID-based IDs, comprehensive audit logging, session management
- **Approval workflow**: pending → approved/rejected/revision_requested

### Backend (Node.js + Express)
- JWT authentication with refresh tokens and session tracking
- Azure Blob Storage integration (`@azure/storage-blob`)
- Role-based access control: student, teacher, verifier
- Security: helmet, rate limiting, XSS clean, HPP protection
- Audit logging for sensitive operations

### Frontend (React 19 + Vite + Tailwind CSS 4)
- Component library: Card, Button, Badge, Modal, Alert, Spinner, Pagination, etc.
- AuthContext with token management and auto-refresh
- ProtectedRoute with role-based guards
- API layer with axios interceptors

---

## Decision: New Separate Application

### Why NOT extend the existing codebase:

1. **Different Domain Model**
   - Existing: Volunteer hours tracking (students → activities → organizations → verifiers)
   - New: Community feed (members → posts → likes/comments → directors)
   - Mixing these would create confusing hybrid entities

2. **Different User Model**
   - Existing: Three distinct roles (student/teacher/verifier) tied to schools/organizations
   - New: Two global roles (member/director) with team-based structure
   - **Global roles**: `member` (regular user), `director` (can manage teams in assigned categories)
   - **Team roles**: `member` (basic participant), `lead` (team management, post approval)
   - Directors can be assigned to specific categories (events, welfare, content, operations, labs)
   - The school/organization hierarchy doesn't apply

3. **Different Approval Flow**
   - Existing: Verifiers approve activities for their specific organization
   - New: Directors approve member accounts AND moderate all posts
   - Different granularity and scope

4. **Clean Separation of Concerns**
   - Both platforms can evolve independently
   - No risk of breaking volunteer dashboard when updating community platform
   - Easier to deploy, test, and maintain separately

### What We WILL Reuse:

| Component | Reuse Strategy |
|-----------|----------------|
| Azure Blob Storage | Same connection, new container (`community-posts`) |
| JWT Auth Pattern | Same approach, adapt for Google OAuth |
| Security Middleware | Copy helmet, rate limiting, XSS config |
| UI Components | Copy and adapt Card, Button, Modal, etc. |
| API Structure | Same axios interceptor pattern |
| Approval Workflow UI | Adapt PendingActivitiesPage pattern for posts/accounts |

---

## New Architecture

### Tech Stack
```
Frontend: React 19 + TypeScript + Vite + Tailwind CSS 4
Backend:  Node.js + Express 5
Database: PostgreSQL (Azure SQL compatible)
Storage:  Azure Blob Storage (new container)
Auth:     Azure AD B2C + Google OAuth external identity
```

### Folder Structure
```
community-platform/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js      # PostgreSQL connection
│   │   │   └── azure.js         # Azure Blob Storage
│   │   ├── middleware/
│   │   │   ├── auth.js          # JWT + Google OAuth verification
│   │   │   ├── security.js      # Helmet, rate limiting, etc.
│   │   │   └── roleGuard.js     # Member vs Director access
│   │   ├── models/
│   │   │   ├── Member.js
│   │   │   ├── Post.js
│   │   │   ├── Like.js
│   │   │   ├── Comment.js
│   │   │   ├── Tag.js
│   │   │   ├── Team.js
│   │   │   └── DirectorCategory.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── memberController.js
│   │   │   ├── postController.js
│   │   │   ├── teamController.js
│   │   │   └── directorController.js
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── feedRoutes.js
│   │   │   ├── profileRoutes.js
│   │   │   ├── teamRoutes.js
│   │   │   └── directorRoutes.js
│   │   ├── utils/
│   │   │   ├── jwtHelper.js
│   │   │   ├── responseHelper.js
│   │   │   └── auditLogger.js
│   │   └── server.js
│   ├── schema.sql
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── auth/                # Google OAuth + Azure AD B2C
│   │   │   ├── AuthContext.tsx
│   │   │   ├── GoogleAuthProvider.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   ├── feed/                # Main community feed
│   │   │   ├── FeedPage.tsx
│   │   │   ├── PostCard.tsx
│   │   │   ├── CreatePostModal.tsx
│   │   │   └── CategoryFilter.tsx
│   │   ├── profile/             # Member profiles
│   │   │   ├── ProfilePage.tsx
│   │   │   ├── EditProfileModal.tsx
│   │   │   └── ProfilePosts.tsx
│   │   ├── director/            # Director-only panel
│   │   │   ├── DirectorDashboard.tsx
│   │   │   ├── AccountApprovals.tsx
│   │   │   ├── PostModeration.tsx
│   │   │   └── MemberDirectory.tsx
│   │   ├── teams/               # Team management
│   │   │   ├── TeamsPage.tsx
│   │   │   ├── TeamDetailPage.tsx
│   │   │   ├── TeamCard.tsx
│   │   │   ├── CreateTeamModal.tsx
│   │   │   ├── AddMemberModal.tsx
│   │   │   └── CreateTeamPostModal.tsx
│   │   ├── components/          # Shared UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Avatar.tsx
│   │   │   ├── RichTextEditor.tsx
│   │   │   └── ImageUpload.tsx
│   │   ├── hooks/
│   │   │   ├── useApi.ts
│   │   │   ├── useAuth.ts
│   │   │   └── useDebounce.ts
│   │   ├── services/
│   │   │   ├── api.ts
│   │   │   ├── authService.ts
│   │   │   ├── feedService.ts
│   │   │   ├── teamService.ts
│   │   │   └── uploadService.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── ARCHITECTURE.md              # This file
└── SETUP.md                     # Setup instructions (Phase 8)
```

---

## Database Schema (New)

```sql
-- Members (students aged 14-19)
CREATE TABLE members (
    member_id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    google_id VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    class_grade VARCHAR(50),
    phone VARCHAR(20),
    join_reason TEXT,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('member', 'director')),
    status VARCHAR(20) DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'active', 'rejected', 'suspended')),
    rejection_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Posts
CREATE TABLE posts (
    post_id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    author_id INTEGER NOT NULL REFERENCES members(member_id),
    category VARCHAR(50) NOT NULL CHECK (category IN ('community_drives', 'startup_ventures', 'self_improvement', 'announcements', 'milestones')),
    body TEXT NOT NULL,
    link_url TEXT,
    link_title TEXT,
    link_image TEXT,
    status VARCHAR(20) DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'published', 'rejected')),
    rejection_note TEXT,
    reviewed_by INTEGER REFERENCES members(member_id),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Post Images (max 4 per post)
CREATE TABLE post_images (
    image_id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
    blob_url TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Post Tags (member mentions)
CREATE TABLE post_tags (
    tag_id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
    tagged_member_id INTEGER NOT NULL REFERENCES members(member_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, tagged_member_id)
);

-- Likes
CREATE TABLE likes (
    like_id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
    member_id INTEGER NOT NULL REFERENCES members(member_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, member_id)
);

-- Comments (scaffolded for v2)
CREATE TABLE comments (
    comment_id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
    author_id INTEGER NOT NULL REFERENCES members(member_id),
    body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Teams
CREATE TABLE teams (
    team_id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN ('events', 'welfare', 'content', 'operations', 'labs')),
    logo_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES members(member_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team Members (roles: 'member', 'lead')
CREATE TABLE team_members (
    team_member_id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
    member_id INTEGER NOT NULL REFERENCES members(member_id),
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('member', 'lead')),
    is_active BOOLEAN DEFAULT TRUE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP,
    UNIQUE(team_id, member_id)
);

-- Director Category Assignments (which categories a director can manage)
CREATE TABLE director_categories (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL CHECK (category IN ('events', 'welfare', 'content', 'operations', 'labs')),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(member_id, category)
);

-- Audit log
CREATE TABLE community_audit_logs (
    log_id SERIAL PRIMARY KEY,
    member_id INTEGER,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    details JSONB,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Key Workflows

### 1. Member Registration & Approval
```
User clicks "Sign in with Google"
    → Azure AD B2C handles OAuth
    → Backend receives Google profile
    → If new user:
        → Redirect to registration form (name, class, phone, join reason)
        → Save with status='pending_approval'
        → Show "Under review" screen
    → If existing user:
        → Check status
        → pending_approval → Show waiting screen
        → rejected → Show rejection message
        → active → Redirect to feed
        → director → Redirect to feed (full access)
```

### 2. Post Creation & Moderation
```
Member clicks "Create Post"
    → Fills form (category, body, images, link, tags)
    → POST /api/posts
    → If author is director:
        → status='published', immediately visible
    → If author is member:
        → status='pending_review'
        → Visible only to author on their profile
        → Directors see it in moderation queue
        → On approval → status='published', visible on feed
```

### 3. Team Creation & Management
```
Director/Super Admin creates team:
    → POST /api/teams (requires category assignment for directors)
    → Creator automatically becomes 'lead' of the team
    → Can add members with 'member' or 'lead' role

Team Permission Matrix:
    | Action            | Super Admin | Global Director (with category) | Team Creator | Team Lead | Team Member |
    |-------------------|-------------|----------------------------------|--------------|-----------|-------------|
    | Create Team       | Any category| Assigned categories only         | -            | -         | -           |
    | Manage Team       | Yes         | Yes                              | Yes          | Yes       | No          |
    | Add/Remove Members| Yes         | Yes                              | Yes          | Yes       | No          |
    | Approve Posts     | Yes         | Yes                              | Yes          | Yes       | No          |
    | Assign Lead Role  | Yes         | No                               | Yes          | No        | No          |
```

### 4. Team Post Workflow
```
Team member creates post for team:
    → POST /api/teams/:uuid/posts
    → If author is super admin, director with category, team creator, or team lead:
        → status='published', immediately visible
    → If author is regular team member:
        → status='pending_review'
        → Team leads see it in pending posts tab
        → On approval → status='published', visible on feed
```

### 5. Director Route Protection
```
Router checks user.role
    → If role !== 'director':
        → Return 404 (not 403, for security)
    → If role === 'director':
        → Allow access to /director/* routes
```

---

## Azure Integration

### Existing Azure Resources to Reuse
- **Azure Blob Storage**: Same storage account, new container `community-posts`
- **Azure AD B2C**: Configure Google as external identity provider

### New Azure Configuration Needed
1. Add Google OAuth to Azure AD B2C tenant
2. Create `community-posts` blob container
3. (Optional) Azure SQL Database if not using existing PostgreSQL

---

## Design System: AquaTerra Brand

```css
/* Colors */
--aquaterra-forest: #2D6A4F;
--aquaterra-orange: #E07B39;
--aquaterra-cream: #F9F6F0;
--aquaterra-beige: #E8DFD0;

/* Typography */
font-family: 'Halant', serif;        /* Headings */
font-family: 'Geist', sans-serif;    /* Body/UI */

/* Components */
- Rounded cards with soft shadows
- Wavy section dividers
- Subtle entrance animations
- Mobile-first responsive design
```

---

## Implementation Phases Summary

| Phase | Deliverable |
|-------|-------------|
| 1 | Codebase analysis, architecture decision, scaffold |
| 2 | Google OAuth via Azure AD B2C, registration flow |
| 3 | Director approval system for member accounts, director category assignments |
| 4 | Community feed with category filters |
| 5 | Post creation with moderation workflow |
| 6 | Member profile pages |
| 7 | Director panel (approvals, moderation, directory) |
| 8 | Teams: creation, membership, team posts, lead permissions |
| 9 | Polish, mobile responsive, accessibility, SETUP.md |

---

## Security Considerations

1. **Director routes return 404**: Not 403, to prevent enumeration
2. **Posts never bypass moderation**: Except for directors
3. **Directors backend-only**: No self-registration endpoint
4. **Azure Blob SAS tokens**: Time-limited for uploads
5. **JWT tokens**: Short-lived access (15m) + refresh tokens
6. **Rate limiting**: On auth and post creation endpoints
7. **Input sanitization**: XSS protection on all user content
