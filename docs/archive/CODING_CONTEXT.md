# AquaTerra Community Platform - Coding Context & Guidelines

> **Last Updated:** 2026-03-19
>
> **Purpose:** This file provides comprehensive context about the codebase structure, coding patterns, conventions, and implementation guidelines to ensure consistency across coding sessions and reduce build errors.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture & Project Structure](#architecture--project-structure)
4. [Coding Patterns & Conventions](#coding-patterns--conventions)
5. [Database Schema & Models](#database-schema--models)
6. [API Structure & Endpoints](#api-structure--endpoints)
7. [Frontend Patterns](#frontend-patterns)
8. [User Flows](#user-flows)
9. [Authentication & Authorization](#authentication--authorization)
10. [Common Pitfalls & Inconsistencies](#common-pitfalls--inconsistencies)
11. [Development Guidelines](#development-guidelines)
12. [Build & Deployment](#build--deployment)

---

## Project Overview

### Platform Purpose
A public digital platform to document and showcase student work and achievements within AquaTerra, a student community organization.

### Key Features
- **Google OAuth Authentication** - Login via Google accounts
- **Member Management** - Registration, director approval, profiles
- **Post System** - Create posts with images, links, tags, likes
- **Multi-Category Posts** - Posts can belong to multiple categories
- **Multi-Director Approval** - Category-specific director approvals
- **Projects & Teams** - Organize members into teams and projects
- **Public Access** - Unauthenticated users can view feed, profiles, projects, teams
- **Schools Integration** - Link members to schools and classes (partial implementation)

### Categories
`events`, `welfare`, `content`, `operations`, `labs`

---

## Technology Stack

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express 5.x
- **Database:** PostgreSQL 14+
- **File Storage:** Azure Blob Storage
- **Authentication:** JWT (access + refresh tokens), Google OAuth
- **Security:** helmet, xss-clean, hpp, express-rate-limit
- **Dependencies:**
  - pg (PostgreSQL client)
  - jsonwebtoken
  - bcrypt
  - multer (file uploads)
  - @azure/storage-blob
  - express-validator

### Frontend
- **Framework:** React 19.2.0
- **Language:** TypeScript 5.8
- **Build Tool:** Vite 7.x
- **Styling:** TailwindCSS 4.x
- **Routing:** React Router DOM 7.x
- **HTTP Client:** Axios 1.13
- **UI Components:** Headless UI, Heroicons
- **Key Dependencies:**
  - react-router-dom
  - axios
  - @tailwindcss/vite

---

## Architecture & Project Structure

### Directory Structure

```
community-platform/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js          # PostgreSQL connection pool
│   │   │   └── azure.js             # Azure Blob Storage config
│   │   ├── middleware/
│   │   │   ├── auth.js              # JWT auth, optionalAuth, requireDirector
│   │   │   └── security.js          # Rate limiting, helmet, xss
│   │   ├── models/
│   │   │   ├── Member.js
│   │   │   ├── Post.js
│   │   │   ├── Project.js
│   │   │   ├── Team.js
│   │   │   ├── School.js
│   │   │   ├── Class.js
│   │   │   └── DirectorCategory.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── postController.js
│   │   │   ├── profileController.js
│   │   │   ├── directorController.js
│   │   │   ├── projectController.js
│   │   │   ├── teamController.js
│   │   │   ├── schoolController.js
│   │   │   ├── searchController.js
│   │   │   └── uploadController.js
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── feedRoutes.js
│   │   │   ├── profileRoutes.js
│   │   │   ├── directorRoutes.js
│   │   │   ├── projectRoutes.js
│   │   │   ├── teamRoutes.js
│   │   │   ├── schoolRoutes.js
│   │   │   ├── searchRoutes.js
│   │   │   └── uploadRoutes.js
│   │   ├── utils/
│   │   │   ├── responseHelper.js    # Standardized API responses
│   │   │   ├── errorHandler.js      # Error handling, asyncHandler
│   │   │   ├── jwtHelper.js         # Token generation/verification
│   │   │   ├── auditLogger.js       # Audit logging
│   │   │   └── caseTransform.js     # snake_case ↔ camelCase
│   │   └── server.js                # Express app entry point
│   ├── migrations/
│   │   ├── 001_phase1_core_fixes.sql
│   │   └── 002_phase3_projects_teams.sql
│   ├── schema.sql                   # Complete database schema
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── auth/
│   │   │   ├── AuthContext.tsx      # Auth state management
│   │   │   ├── ProtectedRoute.tsx   # Route guards
│   │   │   ├── HomeRoute.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── PendingApprovalPage.tsx
│   │   │   └── RejectedPage.tsx
│   │   ├── components/
│   │   │   ├── PublicLayout.tsx
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Avatar.tsx
│   │   │   ├── Spinner.tsx
│   │   │   └── Alert.tsx
│   │   ├── feed/
│   │   │   ├── FeedPage.tsx
│   │   │   ├── PublicFeedPage.tsx
│   │   │   ├── PostCard.tsx
│   │   │   ├── CreatePostModal.tsx
│   │   │   └── CategoryFilter.tsx
│   │   ├── profile/
│   │   │   ├── ProfilePage.tsx
│   │   │   ├── PublicProfilePage.tsx
│   │   │   └── EditProfilePage.tsx
│   │   ├── director/
│   │   │   ├── DirectorDashboard.tsx
│   │   │   ├── AccountApprovals.tsx
│   │   │   ├── PostModeration.tsx
│   │   │   ├── MemberDirectory.tsx
│   │   │   └── CategoryManagement.tsx
│   │   ├── projects/
│   │   │   ├── ProjectsPage.tsx
│   │   │   ├── ProjectDetailPage.tsx
│   │   │   ├── ProjectCard.tsx
│   │   │   ├── CreateProjectModal.tsx
│   │   │   └── CreateProjectPostModal.tsx
│   │   ├── teams/
│   │   │   ├── TeamsPage.tsx
│   │   │   ├── TeamDetailPage.tsx
│   │   │   ├── TeamCard.tsx
│   │   │   ├── CreateTeamModal.tsx
│   │   │   └── AddMemberModal.tsx
│   │   ├── services/
│   │   │   ├── api.ts               # Axios instance, interceptors
│   │   │   ├── feedService.ts
│   │   │   ├── profileService.ts
│   │   │   ├── directorService.ts
│   │   │   ├── projectService.ts
│   │   │   ├── teamService.ts
│   │   │   └── schoolService.ts
│   │   ├── hooks/
│   │   │   └── useDebounce.ts
│   │   ├── App.tsx                  # Route definitions
│   │   └── main.tsx                 # React entry point
│   ├── tsconfig.json
│   └── package.json
├── IMPLEMENTATION_CONTEXT.md        # Feature tracking
├── CODING_CONTEXT.md                # THIS FILE
└── ARCHITECTURE.md
```

---

## Coding Patterns & Conventions

### Backend Patterns

#### 1. Model Layer Pattern

**Location:** `backend/src/models/*.js`

**Pattern:**
```javascript
const { pool } = require('../config/database');
const { transformKeys, transformArray } = require('../utils/caseTransform');

const VALID_CATEGORIES = ['events', 'welfare', 'content', 'operations', 'labs'];

const ModelName = {
  /**
   * Create a resource
   */
  async create({ param1, param2 }) {
    const result = await pool.query(
      `INSERT INTO table_name (column1, column2)
       VALUES ($1, $2)
       RETURNING *`,
      [param1, param2]
    );
    return transformKeys(result.rows[0]);
  },

  /**
   * Find by ID
   */
  async findById(id) {
    const result = await pool.query(
      `SELECT * FROM table_name WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Find by UUID
   */
  async findByUuid(uuid) {
    const result = await pool.query(
      `SELECT * FROM table_name WHERE uuid = $1`,
      [uuid]
    );
    return result.rows[0] ? transformKeys(result.rows[0]) : null;
  }
};

module.exports = ModelName;
```

**Key Points:**
- Use `pool.query()` directly (no ORM)
- Always use parameterized queries (`$1`, `$2`) to prevent SQL injection
- Return `transformKeys()` for camelCase conversion when returning to API
- Return `null` if not found (not undefined)
- Use descriptive function names (findByUuid, create, update, delete, getAll)
- Include JSDoc comments for all methods

#### 2. Controller Layer Pattern

**Location:** `backend/src/controllers/*.js`

**Pattern:**
```javascript
const Model = require('../models/Model');
const { successResponse, errorResponse, notFoundResponse, paginatedResponse } = require('../utils/responseHelper');
const { asyncHandler } = require('../utils/errorHandler');
const { logAuditEvent, getClientInfo, AuditActions } = require('../utils/auditLogger');

/**
 * Get resource
 * GET /api/resource/:uuid
 */
const getResource = asyncHandler(async (req, res) => {
  const { uuid } = req.params;

  const resource = await Model.findByUuid(uuid);
  if (!resource) {
    return notFoundResponse(res, 'Resource');
  }

  return successResponse(res, { resource });
});

/**
 * Create resource
 * POST /api/resource
 */
const createResource = asyncHandler(async (req, res) => {
  const { field1, field2 } = req.body;

  // Validation
  if (!field1) {
    return errorResponse(res, 'field1 is required', 400);
  }

  const resource = await Model.create({
    field1,
    field2,
    createdBy: req.member.memberId
  });

  // Audit log
  const clientInfo = getClientInfo(req);
  await logAuditEvent({
    memberId: req.member.memberId,
    action: 'RESOURCE_CREATED',
    entityType: 'resource',
    entityId: resource.id,
    ...clientInfo
  });

  return successResponse(res, { resource }, 'Resource created successfully', 201);
});

module.exports = {
  getResource,
  createResource
};
```

**Key Points:**
- Always wrap async functions with `asyncHandler()`
- Use standardized response helpers (successResponse, errorResponse, etc.)
- Validate input before processing
- Log audit events for sensitive operations
- Return appropriate HTTP status codes
- Extract req.params, req.query, req.body at function start
- Check permissions before operations

#### 3. Route Layer Pattern

**Location:** `backend/src/routes/*.js`

**Pattern:**
```javascript
const express = require('express');
const router = express.Router();
const controller = require('../controllers/controller');
const { authMiddleware, optionalAuth, requireDirector } = require('../middleware/auth');

// Public routes (no auth)
router.get('/', optionalAuth, controller.getAll);
router.get('/:uuid', optionalAuth, controller.getOne);

// Protected routes (auth required)
router.post('/', authMiddleware, controller.create);
router.put('/:uuid', authMiddleware, controller.update);

// Director-only routes
router.delete('/:uuid', authMiddleware, requireDirector, controller.delete);

module.exports = router;
```

**Middleware Order:**
1. `optionalAuth` - For public routes that benefit from auth context
2. `authMiddleware` - For protected routes (requires valid token)
3. `requireActiveMember` - Requires active status (not pending/rejected)
4. `requireDirector` - Director-only access (returns 404 for non-directors)
5. Rate limiters - For write operations (postLimiter, etc.)

#### 4. Case Transformation Pattern

**Database ↔ API:**
- Database: `snake_case` (e.g., `member_id`, `full_name`, `created_at`)
- API Response: `camelCase` (e.g., `memberId`, `fullName`, `createdAt`)

**Usage:**
```javascript
// Transform single object
const transformed = transformKeys(dbRow);

// Transform array
const transformed = transformArray(dbRows);
```

**IMPORTANT:** Always transform before sending to API, but use snake_case in SQL queries.

### Frontend Patterns

#### 1. Component Structure

**Functional Components with TypeScript:**
```typescript
import { useState, useEffect } from 'react'
import api from '../services/api'

interface Props {
  propName: string
  optional?: boolean
}

export default function ComponentName({ propName, optional }: Props) {
  const [data, setData] = useState<DataType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const response = await api.get('/endpoint')
      setData(response.data.data)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="container">
      {/* Component JSX */}
    </div>
  )
}
```

#### 2. Service Layer Pattern

**Location:** `frontend/src/services/*.ts`

**Pattern:**
```typescript
import api, { PaginatedResponse } from './api'

export interface ResourceType {
  uuid: string
  name: string
  createdAt: string
}

export const resourceService = {
  /**
   * Get all resources
   */
  async getAll(params: { page?: number; limit?: number } = {}): Promise<PaginatedResponse<ResourceType>> {
    const response = await api.get('/resources', { params })
    return response.data
  },

  /**
   * Get single resource
   */
  async get(uuid: string): Promise<{ success: boolean; data: { resource: ResourceType } }> {
    const response = await api.get(`/resources/${uuid}`)
    return response.data
  },

  /**
   * Create resource
   */
  async create(data: Partial<ResourceType>): Promise<{ success: boolean; data: { resource: ResourceType }; message: string }> {
    const response = await api.post('/resources', data)
    return response.data
  }
}
```

**Key Points:**
- Export interfaces for TypeScript types
- All methods return Promise with typed responses
- Use api instance (handles auth tokens automatically)
- Match backend API structure

#### 3. TailwindCSS Patterns

**Common Classes:**
```css
/* Container */
max-w-7xl mx-auto px-4 sm:px-6 lg:px-8

/* Card */
bg-white rounded-lg shadow-md p-6

/* Button Primary */
bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg

/* Button Secondary */
bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg

/* Input */
w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent

/* Text */
text-3xl font-bold text-gray-900    # Heading
text-lg text-gray-600               # Subheading
text-sm text-gray-500               # Caption
```

---

## Database Schema & Models

### Key Tables

#### members
```sql
member_id SERIAL PRIMARY KEY
uuid UUID UNIQUE
google_id VARCHAR(255) UNIQUE
email VARCHAR(255) UNIQUE
full_name VARCHAR(255)
avatar_url TEXT
class_grade VARCHAR(50)
phone VARCHAR(20)
bio TEXT                          -- Added in Phase 1
school_id INTEGER                 -- Added in Phase 1
class_id INTEGER                  -- Added in Phase 1
role VARCHAR(20)                  -- 'member', 'director'
status VARCHAR(20)                -- 'pending_approval', 'active', 'rejected', 'suspended'
```

#### posts
```sql
post_id SERIAL PRIMARY KEY
uuid UUID UNIQUE
author_id INTEGER → members(member_id)
team_id INTEGER → teams(team_id)  -- For team posts (v1.1.1)
category VARCHAR(50)              -- Single category (legacy)
body TEXT
status VARCHAR(20)                -- 'pending_review', 'published', 'rejected'
```

#### post_categories (Multi-category support)
```sql
post_category_id SERIAL PRIMARY KEY
post_id INTEGER → posts(post_id)
category VARCHAR(50)              -- 'events', 'welfare', 'content', 'operations', 'labs'
UNIQUE(post_id, category)
```

#### post_approvals (Multi-director approval)
```sql
approval_id SERIAL PRIMARY KEY
post_id INTEGER → posts(post_id)
category VARCHAR(50)
approved_by INTEGER → members(member_id)
approved_at TIMESTAMP
UNIQUE(post_id, category)
```

#### teams
```sql
team_id SERIAL PRIMARY KEY
uuid UUID UNIQUE
name VARCHAR(255)
description TEXT
category VARCHAR(50)
logo_url TEXT
is_active BOOLEAN
created_by INTEGER → members(member_id)
```

#### team_members
```sql
team_member_id SERIAL PRIMARY KEY
team_id INTEGER → teams(team_id)
member_id INTEGER → members(member_id)
role VARCHAR(50)                  -- 'member', 'lead', 'director'
is_active BOOLEAN
UNIQUE(team_id, member_id)
```

#### projects
```sql
project_id SERIAL PRIMARY KEY
uuid UUID UNIQUE
title VARCHAR(255)
description TEXT
category VARCHAR(50)
team_id INTEGER → teams(team_id)
status VARCHAR(50)                -- 'planning', 'active', 'completed', 'archived'
start_date DATE
end_date DATE
cover_image_url TEXT
created_by INTEGER → members(member_id)
```

#### project_members
```sql
project_member_id SERIAL PRIMARY KEY
project_id INTEGER → projects(project_id)
member_id INTEGER → members(member_id)
role VARCHAR(100)                 -- 'lead', 'contributor', etc.
UNIQUE(project_id, member_id)
```

#### post_projects (Link posts to projects)
```sql
post_project_id SERIAL PRIMARY KEY
post_id INTEGER → posts(post_id)
project_id INTEGER → projects(project_id)
UNIQUE(post_id, project_id)
```

#### director_categories
```sql
assignment_id SERIAL PRIMARY KEY
member_id INTEGER → members(member_id)
category VARCHAR(50)
assigned_by INTEGER → members(member_id)
UNIQUE(member_id, category)
```

### Data Access Patterns

1. **Always use UUIDs for external IDs** (URLs, API responses)
2. **Use integer IDs internally** (foreign keys, queries)
3. **Soft deletes** where applicable (teams: is_active, team_members: is_active)
4. **Timestamps** - created_at, updated_at (auto-updated via triggers)
5. **Audit logging** for sensitive operations

---

## API Structure & Endpoints

### Response Format

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Error message"
}
```

**Paginated Response:**
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 100,
    "itemsPerPage": 20,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### API Endpoints

#### Auth (`/api/auth`)
- `POST /google` - Login with Google OAuth
- `POST /register` - Register new member
- `GET /me` - Get current member info
- `POST /refresh-token` - Refresh access token
- `POST /logout` - Logout (invalidate session)

#### Feed (`/api/feed`)
- `GET /` - Get feed (public, optionalAuth)
- `GET /:uuid` - Get single post (public, optionalAuth)
- `POST /` - Create post (auth required)
- `POST /project-post` - Create project post (auth required)
- `POST /:uuid/like` - Toggle like (auth required)
- `DELETE /:uuid` - Delete post (auth required, own post or director)
- `GET /members/search` - Search members for @mention (auth required)

#### Profile (`/api/profile`)
- `GET /me` - Get own profile (auth required)
- `PUT /me` - Update own profile (auth required)
- `GET /:uuid` - Get member profile (public, optionalAuth)
- `GET /:uuid/posts` - Get member's posts (public, optionalAuth)

#### Projects (`/api/projects`)
- `GET /` - Get all projects (public, optionalAuth)
- `GET /:uuid` - Get project details (public, optionalAuth)
- `GET /:uuid/members` - Get project members (public)
- `GET /:uuid/posts` - Get project posts (public)
- `GET /my/list` - Get current member's projects (auth required)
- `POST /` - Create project (director only)
- `PUT /:uuid` - Update project (creator or director)
- `DELETE /:uuid` - Delete project (director only)
- `POST /:uuid/members` - Add member to project (auth required)
- `DELETE /:uuid/members/:memberId` - Remove member (auth required)

#### Teams (`/api/teams`)
- `GET /` - Get all teams (public, optionalAuth)
- `GET /:uuid` - Get team details (public, optionalAuth)
- `GET /:uuid/members` - Get team members (public)
- `GET /:uuid/projects` - Get team projects (public)
- `GET /my/list` - Get current member's teams (auth required)
- `POST /` - Create team (director with category assignment or super admin)
- `PUT /:uuid` - Update team (super admin, global director, team creator, or team lead)
- `DELETE /:uuid` - Delete team (director only)
- `POST /:uuid/members` - Add member to team (team lead or above)
- `DELETE /:uuid/members/:memberId` - Remove member (team lead or above)

#### Schools (`/api/schools`)
- `GET /` - Get all schools (public)
- `GET /:uuid` - Get school details (public)
- `GET /:uuid/members` - Get school members (public)
- `POST /` - Create school (director only)

#### Search (`/api/search`)
- `GET /` - Global search (public, optionalAuth)
  - Query params: `q`, `type` (all, people, projects, teams, schools, classes)

#### Director (`/api/director`)
- `GET /dashboard` - Get dashboard stats (director only)
- `GET /approvals` - Get pending member approvals (director only)
- `POST /approvals/:id/approve` - Approve member (director only)
- `POST /approvals/:id/reject` - Reject member (director only)
- `GET /posts/pending` - Get pending posts (director only)
- `POST /posts/:uuid/approve` - Approve post (director only)
- `POST /posts/:uuid/reject` - Reject post (director only)
- `GET /categories` - Get director category assignments (director only)
- `POST /categories/assign` - Assign director to category (director only)

#### Upload (`/api/upload`)
- `POST /images` - Upload images to Azure Blob (auth required)
- Max 4 images per post, 5MB per image

---

## Frontend Patterns

### Route Structure

```typescript
// Public Routes (PublicLayout)
/ - Landing page / Public feed
/member/:uuid - Public profile
/login - Login page
/register - Registration page
/pending - Pending approval page
/rejected - Rejection page

// Protected Routes (DashboardLayout + ProtectedRoute)
/feed - Authenticated feed
/profile/me - Own profile
/profile/edit - Edit profile
/profile/:uuid - Member profile (authenticated view)
/projects - Projects listing
/projects/:uuid - Project detail
/teams - Teams listing
/teams/:uuid - Team detail

// Director Routes (DashboardLayout + requireDirector)
/director - Director dashboard
/director/approvals - Member approvals
/director/posts - Post moderation
/director/members - Member directory
/director/categories - Category management
```

### State Management

**Auth State:** `AuthContext` (Context API)
- member (Member | null)
- isAuthenticated (boolean)
- isLoading (boolean)
- login(), register(), logout(), refreshMember()

**Local Storage:**
- `aquaterra_access_token` - JWT access token
- `aquaterra_refresh_token` - JWT refresh token
- `aquaterra_member` - Member object (cached)

### HTTP Interceptors

**Request Interceptor:**
- Attaches `Authorization: Bearer <token>` header

**Response Interceptor:**
- Handles 401 errors
- Attempts token refresh
- Redirects to /login if refresh fails

---

## User Flows

### 1. Authentication & Registration Flow

```
User clicks "Login with Google"
  ↓
Google OAuth popup
  ↓
Frontend receives Google profile
  ↓
POST /api/auth/google { googleId, email, name, picture }
  ↓
Backend checks if member exists
  ├─ Exists & Active → Return tokens + member → Login
  ├─ Exists & Pending → Return status → Redirect to /pending
  ├─ Exists & Rejected → Return status → Redirect to /rejected
  └─ Not exists → Return status → Redirect to /register
       ↓
  User fills registration form (class, phone, reason, school)
       ↓
  POST /api/auth/register
       ↓
  Member created with status = 'pending_approval'
       ↓
  Redirect to /pending
       ↓
  Director reviews and approves
       ↓
  Member status = 'active'
       ↓
  User can login
```

### 2. Post Creation Flow

```
Member creates post
  ↓
Selects category/categories
  ↓
Writes body, adds images, links, tags
  ↓
POST /api/feed
  ↓
Backend checks member role
  ├─ Director → status = 'published' (auto-publish)
  └─ Member → status = 'pending_review'
       ↓
  Director reviews post
       ↓
  POST /api/director/posts/:uuid/approve
       ↓
  status = 'published'
       ↓
  Post visible on feed
```

### 3. Multi-Category Post Approval Flow

```
Member creates post with multiple categories (e.g., events + welfare)
  ↓
POST /api/feed with categories: ['events', 'welfare']
  ↓
Backend creates post with status = 'pending_review'
Backend inserts into post_categories: [(post_id, 'events'), (post_id, 'welfare')]
  ↓
Director A (assigned to 'events') approves
  ↓
Backend inserts into post_approvals: (post_id, 'events', director_A_id)
Backend checks if all categories approved → NO (missing 'welfare')
  ↓
Director B (assigned to 'welfare') approves
  ↓
Backend inserts into post_approvals: (post_id, 'welfare', director_B_id)
Backend checks if all categories approved → YES
  ↓
Backend updates post status = 'published'
  ↓
Post visible on feed
```

### 4. Project Creation Flow

```
Director creates project
  ↓
POST /api/projects { title, description, category, teamUuid }
  ↓
Backend validates:
  - Director role OR team lead role
  - Team exists
  - Category is valid
  ↓
Backend creates project with created_by = member_id
Backend adds creator as project member with role = 'lead'
  ↓
Creator adds members
  ↓
POST /api/projects/:uuid/members { memberId, role }
  ↓
Members can create project posts
  ↓
POST /api/feed/project-post { projectUuid, body, category }
  ↓
Backend validates:
  - User is project member OR team member OR director
  - Auto-publish if director or team lead
  - Otherwise pending_review for team lead approval
```

### 5. Team Creation Flow

```
Director (with category assignment) or Super Admin creates team
  ↓
POST /api/teams { name, description, category }
  ↓
Backend validates director has category assignment (unless super admin)
Backend creates team with created_by = member_id
Creator automatically added as team lead
  ↓
Team creator/lead adds members with roles
  ↓
POST /api/teams/:uuid/members { memberId, role }
  - role: 'member', 'lead' (multiple leads allowed)
  ↓
Team leads can create projects
Team members can join projects
```

---

## Authentication & Authorization

### JWT Structure

**Access Token (15 min expiry):**
```javascript
{
  memberId: 123,
  email: "user@example.com",
  role: "member",
  iat: 1234567890,
  exp: 1234568790
}
```

**Refresh Token (7 days expiry):**
- Stored in `active_sessions` table
- Used to generate new access tokens

### Permission Levels

1. **Public (No auth)**
   - View feed
   - View profiles
   - View projects/teams
   - View schools

2. **Authenticated Member**
   - Create posts (requires approval)
   - Like posts
   - Edit own profile
   - Join projects/teams

3. **Team Lead** (team_members.role = 'lead')
   - Create projects for their team
   - Add/remove members in their team
   - Approve team posts
   - Multiple leads per team allowed

4. **Team Creator**
   - All team lead permissions
   - Can assign 'lead' role to other members

5. **Category Director** (global director with category assignment)
   - Create teams in assigned categories
   - Manage teams in assigned categories
   - Approve posts in their assigned categories

6. **Global Director** (members.role = 'director')
   - All member permissions
   - Approve member registrations
   - Approve all posts (global)
   - Access director dashboard

7. **Super Admin** (members.is_super_admin = true)
   - All director permissions
   - Create teams in any category
   - Manage director category assignments
   - Assign lead role in any team

### Middleware Chain

```javascript
// Public with optional auth context
router.get('/', optionalAuth, controller.get);

// Protected (active members only)
router.post('/', authMiddleware, requireActiveMember, controller.create);

// Director only
router.post('/', authMiddleware, requireDirector, controller.create);

// Rate limited
router.post('/', authMiddleware, postLimiter, controller.create);
```

---

## Common Pitfalls & Inconsistencies

### 1. Case Transformation Inconsistencies

**Issue:** Some models transform keys, others don't consistently.

**Example:**
```javascript
// Post.js - transforms in findByUuid
async findByUuid(uuid) {
  const result = await pool.query(...);
  return result.rows[0] ? transformKeys(result.rows[0]) : null;
}

// Post.js - doesn't transform in create
async create({ authorId, category, body }) {
  const result = await pool.query(...);
  return result.rows[0];  // ⚠️ NOT TRANSFORMED
}
```

**Fix:** Always use `transformKeys()` or `transformArray()` before returning from model methods.

### 2. Mixed Casing in Frontend Types

**Issue:** `Post` interface uses snake_case but other interfaces use camelCase.

**Example:**
```typescript
// api.ts
export interface Post {
  post_id: number        // ⚠️ snake_case
  uuid: string
  author_name: string    // ⚠️ snake_case
  // ...
}

export interface Project {
  uuid: string
  title: string          // ✓ camelCase
  memberCount: number    // ✓ camelCase
}
```

**Fix:** Use camelCase consistently in all frontend TypeScript interfaces.

### 3. Inconsistent Auth Middleware Usage

**Issue:** Some routes use `optionalAuth`, some use `authMiddleware`, some use both incorrectly.

**Guidelines:**
- `optionalAuth` - Public routes that benefit from user context (e.g., feed shows liked status if logged in)
- `authMiddleware` - Protected routes requiring authentication
- `requireActiveMember` - Routes requiring active status
- `requireDirector` - Director-only routes

### 4. Team Permissions Clarification

**Resolved:** Team authority structure simplified.

**Team Roles:**
- `member` - Basic team participant
- `lead` - Full team management, post approval (multiple allowed per team)

**Permission Rules:**
- Super admins can create teams in any category
- Global directors with category assignment can create teams in their assigned categories
- Team creators automatically become team leads
- Team leads can add/remove members and approve posts
- Only super admins and team creators can assign the 'lead' role

### 5. Missing School Implementation

**Issue:** Migration references `school_id` in projects table, but schools aren't fully implemented in base schema.

**Status:** Schools model and controller exist, but not fully integrated everywhere.

### 6. Post Status Transitions

**Issue:** Unclear post status transition rules.

**Correct Flow:**
```
Create → pending_review → published (via approval)
       ↘ rejected (via rejection)

Director Create → published (immediately)
```

---

## Development Guidelines

### 1. Adding a New Feature

**Backend Checklist:**
1. Update database schema (add migration file)
2. Create/update model in `backend/src/models/`
3. Create/update controller in `backend/src/controllers/`
4. Create/update routes in `backend/src/routes/`
5. Register routes in `server.js`
6. Add validation and error handling
7. Add audit logging if sensitive operation
8. Transform keys (snake_case → camelCase) before API response
9. Write JSDoc comments

**Frontend Checklist:**
1. Create TypeScript interface in service file
2. Add service methods in `frontend/src/services/`
3. Create components in appropriate directory
4. Add routes in `App.tsx`
5. Update navigation in layouts if needed
6. Use existing UI components (Button, Input, Modal, etc.)
7. Follow TailwindCSS patterns
8. Add error handling and loading states

### 2. Database Migrations

**Pattern:**
```sql
-- migrations/XXX_feature_name.sql
-- Add description at top

CREATE TABLE IF NOT EXISTS table_name (
  -- columns
);

CREATE INDEX IF NOT EXISTS idx_name ON table(column);

-- Add comments
COMMENT ON TABLE table_name IS 'Description';
```

**Run Migration:**
```bash
psql -U username -d database_name -f migrations/XXX_feature_name.sql
```

### 3. Naming Conventions

**Database:**
- Tables: `snake_case` plural (members, posts, projects)
- Columns: `snake_case` (member_id, full_name, created_at)
- Indexes: `idx_table_column` (idx_posts_author)
- Foreign keys: `table_id` (member_id, post_id)
- UUIDs: `uuid` column

**Backend:**
- Files: `camelCase.js` (postController.js, authRoutes.js)
- Classes/Objects: `PascalCase` (Member, Post, Project)
- Functions: `camelCase` (findByUuid, createPost)
- Constants: `UPPER_SNAKE_CASE` (VALID_CATEGORIES)

**Frontend:**
- Files: `PascalCase.tsx` (FeedPage.tsx, CreatePostModal.tsx)
- Components: `PascalCase` (function FeedPage())
- Services: `camelCase` (projectService, feedService)
- Interfaces: `PascalCase` (interface Project {})

### 4. Error Handling

**Backend:**
```javascript
// Use asyncHandler for async routes
const handler = asyncHandler(async (req, res) => {
  // Validation
  if (!field) {
    return errorResponse(res, 'Field is required', 400);
  }

  // Not found
  const item = await Model.findByUuid(uuid);
  if (!item) {
    return notFoundResponse(res, 'Item');
  }

  // Forbidden
  if (!hasPermission) {
    return forbiddenResponse(res, 'Not authorized');
  }

  // Success
  return successResponse(res, { item });
});
```

**Frontend:**
```typescript
try {
  const response = await api.get('/endpoint');
  setData(response.data.data);
} catch (error: any) {
  console.error('Error:', error);
  const message = error.response?.data?.message || 'An error occurred';
  // Show error to user (toast, alert, etc.)
}
```

### 5. Testing Checklist

Before committing:
- [ ] Backend builds without errors (`npm run dev` in backend/)
- [ ] Frontend builds without errors (`npm run dev` in frontend/)
- [ ] TypeScript compiles (`npm run build` in frontend/)
- [ ] No console errors in browser
- [ ] Test all CRUD operations for new features
- [ ] Test permissions (member, director, public)
- [ ] Test error cases (validation, not found, forbidden)

---

## Build & Deployment

### Environment Variables

**Backend (.env):**
```env
NODE_ENV=development
PORT=5001

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=aquaterra_community
DB_USER=postgres
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id

# Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING=your_connection_string
AZURE_STORAGE_CONTAINER_NAME=community-images

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173
```

**Frontend (.env):**
```env
VITE_API_URL=http://localhost:5001
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

### Build Commands

**Backend:**
```bash
cd backend
npm install
npm run dev          # Development
npm start            # Production
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev          # Development (Vite dev server)
npm run build        # Production build
npm run preview      # Preview production build
```

### Common Build Errors

1. **TypeScript errors in frontend:**
   - Check interface definitions match API responses
   - Ensure all imports use correct casing
   - Run `npm run build` to see all errors

2. **Module not found:**
   - Check import paths are correct
   - Ensure file extensions (.tsx, .ts, .js) are correct
   - Frontend: don't include file extensions in imports

3. **Database connection errors:**
   - Check .env file exists and has correct values
   - Ensure PostgreSQL is running
   - Run migrations if tables don't exist

4. **CORS errors:**
   - Check FRONTEND_URL in backend .env
   - Ensure backend server is running on correct port
   - Check browser console for specific CORS error

---

## Quick Reference

### Categories (System-wide)
```javascript
['events', 'welfare', 'content', 'operations', 'labs']
```

### Member Roles
```javascript
['member', 'director']
```

### Member Status
```javascript
['pending_approval', 'active', 'rejected', 'suspended']
```

### Post Status
```javascript
['pending_review', 'published', 'rejected']
```

### Project Status
```javascript
['planning', 'active', 'completed', 'archived']
```

### Team Member Roles
```javascript
['member', 'lead', 'director']
```

### HTTP Status Codes
- 200 - Success (GET, PUT, DELETE)
- 201 - Created (POST)
- 400 - Bad Request (validation error)
- 401 - Unauthorized (not authenticated)
- 403 - Forbidden (authenticated but not authorized)
- 404 - Not Found
- 500 - Internal Server Error

---

## Next Steps & TODO

### Incomplete Features (from IMPLEMENTATION_CONTEXT.md)

**Priority 2:**
- [ ] External Achievements (personal achievements on profiles)
- [ ] Opportunity Posts (job/role openings)

**Priority 3:**
- [ ] Activity Timeline (chronological member activity)
- [ ] Contribution Dashboard (metrics on profile)
- [ ] Classes as Entity (searchable class groups)

**Priority 4:**
- [ ] Video Uploads
- [ ] PDF Uploads
- [ ] PowerPoint Uploads

### Known Issues

1. ~~**Case transformation inconsistency**~~ - ✅ FIXED (2026-03-15)
2. ~~**Frontend Post interface**~~ - ✅ FIXED (2026-03-15)
3. **Schools integration** - ⏳ Partial (models exist, not fully integrated)
4. **Search implementation** - ✅ COMPLETE (global search working)
5. ~~**Director permissions**~~ - ✅ FIXED (2026-03-15, documented clearly)
6. **Unused TypeScript imports** - ⚠️ Minor (4 warnings, non-blocking)

---

## Changelog

### 2026-03-15 - Major Consistency Fixes Applied

**Session 1: Initial Context & TypeScript Fixes (v1.0.0)**
- Created comprehensive CODING_CONTEXT.md (this file)
- Fixed 47+ TypeScript errors by standardizing case conventions
- Updated Post interface from snake_case to camelCase
- Fixed all frontend components to use consistent property names
- Documented all coding patterns and conventions
- Status: Build compiles with only 4 minor warnings

**Session 2: Runtime Case Transformation Fixes (v1.0.1)**
- Fixed 403 Forbidden error on project post creation
- Added `transformKeys()` to all Model find* methods
- Updated all controllers to use camelCase property access
- Fixed Member, Project, and Team models
- Implemented post segregation (project posts excluded from main feed)
- Implemented global search system (SearchPage, SearchFilters, SearchResultsList)
- Status: All runtime errors resolved

**Session 3: Profile & Post Display Fixes (v1.0.2)**
- Fixed profile routing for authenticated users (SearchResultsList, TeamDetailPage, ProjectDetailPage)
- Fixed profile details rendering (profileController using camelCase)
- Fixed post cards missing author information (Post.getByAuthor added JOIN with members)
- Flattened school/class data structure in public profile response
- Files Modified: 6 files (2 backend, 4 frontend)

**Session 4: Like Counts & Search Results Fixes (v1.0.3)**
- Fixed like counts not displaying (`is_liked` → `isLiked` in controllers)
- Fixed search results data formatting (added transformArray to searchController)
- Fixed nested arrays not transformed (images, tagged_members in Post model)
- Changed `is_project_post` to `isProjectPost` for consistency
- Files Modified: 3 backend files (postController, profileController, searchController, Post.js)

**Session 5: Like Count Synchronization Fix (v1.0.4)**
- Fixed like counts jumping incorrectly (1 → 10 → 11)
- Updated Post.toggleLike() to return actual like count from database
- Updated PostCard.tsx to use server-returned count instead of pure optimistic updates
- Updated feedService.ts TypeScript interface to include likeCount
- Files Modified: 3 files (1 backend, 2 frontend)

**Total Files Modified Today:**
- Backend: 12 files (models, controllers, routes)
- Frontend: 14 files (components, services, types)
- Documentation: 5 files (CODING_CONTEXT, CHANGELOG, IMPLEMENTATION_CONTEXT, FIXES_APPLIED, RUNTIME_FIXES_APPLIED)

---

**For questions or clarifications, refer to:**
- **CODING_CONTEXT.md** (this file) - Detailed coding guidelines and patterns
- **FIXES_APPLIED.md** - TypeScript interface consistency fixes (2026-03-15)
- **RUNTIME_FIXES_APPLIED.md** - Runtime case transformation fixes (2026-03-15)
- **IMPLEMENTATION_CONTEXT.md** - Feature tracking and implementation status
- **ARCHITECTURE.md** - High-level architecture overview
- **TESTING_GUIDE.md** - Testing procedures and guidelines
