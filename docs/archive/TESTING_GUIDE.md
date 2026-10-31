# End-to-End Testing Guide: Project Post Approval Flow

## 🎯 Test Objective
Verify the complete workflow where:
1. Directors create teams and add members
2. Teams undertake projects
3. Team members create posts about projects
4. Team directors approve/reject those posts

---

## ⚙️ Setup

### Servers Running
- ✅ Backend: http://localhost:5001
- ✅ Frontend: http://localhost:5174

### Test Accounts Available
Run the seed script if you haven't already:
```bash
cd backend
npm run db:seed-director
node scripts/seed-data.js
```

**Available Test Accounts:**
- **Director**: director@aquaterra.org (Sarah Director)
- **Members**:
  - alex@example.com (Alex Johnson)
  - maya@example.com (Maya Patel)
  - james@example.com (James Wilson)
  - emma@example.com (Emma Chen)

---

## 📋 Test Scenario: Complete Workflow

### **TEST 1: Team Creation (As Director)**

**User**: director@aquaterra.org

**Steps**:
1. Navigate to http://localhost:5174
2. Login as director@aquaterra.org (use Google OAuth mock)
3. Go to `/teams` page
4. Click "Create Team" button
5. Fill in the form:
   - **Name**: "Environmental Initiatives"
   - **Description**: "Team focused on environmental awareness and sustainability projects"
   - **Category**: Select "Events"
6. Click "Create Team"

**Expected Result**:
- ✅ Team is created successfully
- ✅ Redirected to team detail page
- ✅ Creator is automatically added as a team lead
- ✅ Team appears in teams listing

**Screenshot Location**: _[Take screenshot of team detail page]_

---

### **TEST 2: Add Members to Team (As Director)**

**User**: director@aquaterra.org

**Steps**:
1. On the "Environmental Initiatives" team detail page
2. Click on the "Members" tab
3. Click "Add Member" button
4. Select **Alex Johnson** from dropdown
5. Choose role: **member**
6. Click "Add Member"
7. Repeat for **Maya Patel** - choose role: **lead**

**Expected Result**:
- ✅ Alex Johnson appears in members list with "Member" badge
- ✅ Maya Patel appears in members list with "Lead" badge
- ✅ Creator (Sarah Director) shows as "Lead"
- ✅ Member count updates to 3

**Screenshot Location**: _[Take screenshot of members tab]_

---

### **TEST 3: Create Project for Team (As Director)**

**User**: director@aquaterra.org

**Steps**:
1. Still on "Environmental Initiatives" team page
2. Click on the "Projects" tab
3. Click "Create Project" button
4. Fill in the form:
   - **Title**: "Beach Cleanup Drive 2026"
   - **Description**: "Monthly beach cleanup initiative to keep our coastlines clean"
   - **Category**: "Events" (should match team category)
   - **Status**: "Active"
   - **Start Date**: Select today's date
   - **Team**: Should be pre-selected as "Environmental Initiatives"
5. Click "Create Project"

**Expected Result**:
- ✅ Project is created successfully
- ✅ Project appears in team's projects tab
- ✅ Can click on project to view detail page
- ✅ Project shows team name: "Environmental Initiatives"

**Screenshot Location**: _[Take screenshot of project detail page]_

---

### **TEST 4: Create Project Post (As Regular Member - Alex)**

**User**: alex@example.com

**Steps**:
1. Logout from director account
2. Login as alex@example.com
3. Navigate to `/projects` (or use navigation)
4. Click on "Beach Cleanup Drive 2026" project
5. Go to "Posts" tab
6. Click "Create Post" button
7. In the modal:
   - Notice the **amber notice**: "Your post will be sent to the team leads for approval"
   - Write post body: "Just completed our first beach cleanup session! Collected over 50kg of plastic waste. Amazing turnout from the community. Photos coming soon! 🌊♻️"
   - Note: Post must be at least 10 characters
8. Click "Submit for Approval"

**Expected Result**:
- ✅ Modal shows approval notice (amber background)
- ✅ Button says "Submit for Approval" (not "Publish Post")
- ✅ Post is created with status = "pending_review"
- ✅ Post does NOT appear in project's posts tab (since it's pending)
- ✅ Success message appears

**API Check** (Optional):
```bash
# Check post in database
psql -d aquaterra_community -c "SELECT post_id, body, status FROM posts ORDER BY created_at DESC LIMIT 1;"
```

**Screenshot Location**: _[Take screenshot of create post modal with notice]_

---

### **TEST 5: View Pending Posts (As Team Director)**

**User**: director@aquaterra.org

**Steps**:
1. Logout from Alex's account
2. Login as director@aquaterra.org
3. Navigate to `/teams`
4. Click on "Environmental Initiatives" team
5. Notice the **"Pending Posts" tab** with a badge showing count (should show "1")
6. Click on "Pending Posts" tab

**Expected Result**:
- ✅ "Pending Posts" tab is visible (only for team leads)
- ✅ Badge shows "1" pending post
- ✅ Tab content shows Alex's post:
  - Author: Alex Johnson
  - Project: Beach Cleanup Drive 2026
  - Post body is displayed
  - "Approve" button (green)
  - "Reject" button (red)

**Screenshot Location**: _[Take screenshot of pending posts tab]_

---

### **TEST 6: Approve Project Post (As Team Director)**

**User**: director@aquaterra.org

**Steps**:
1. On the Pending Posts tab
2. Read Alex's post
3. Click "Approve" button
4. Wait for confirmation

**Expected Result**:
- ✅ Post disappears from pending list
- ✅ Pending count badge updates to "0"
- ✅ Message shows "No pending posts"
- ✅ Go to project detail page → Posts tab
- ✅ Alex's post now appears in the published posts

**API Check** (Optional):
```bash
# Check post status changed to published
psql -d aquaterra_community -c "SELECT post_id, body, status FROM posts WHERE body LIKE '%beach cleanup%';"
```

**Screenshot Location**: _[Take screenshot of post now visible in project posts]_

---

### **TEST 7: Create & Reject Project Post**

**User Flow**: maya@example.com → director@aquaterra.org

**Steps**:
1. Logout and login as **maya@example.com**
2. Navigate to "Beach Cleanup Drive 2026" project
3. Go to Posts tab → Click "Create Post"
4. Write: "I think we should start using drones to monitor beach pollution levels."
5. Submit for approval
6. Logout and login as **director@aquaterra.org**
7. Go to "Environmental Initiatives" team → Pending Posts tab
8. Click "Reject" button on Maya's post
9. In the rejection note textarea, write: "Good idea! But please provide more details about the implementation plan and budget."
10. Click "Confirm Reject"

**Expected Result**:
- ✅ Rejection note textarea appears when clicking "Reject"
- ✅ Cannot confirm without writing a note
- ✅ Post disappears from pending list after rejection
- ✅ Post status in DB = "rejected"
- ✅ Rejection note is saved

**API Check**:
```bash
psql -d aquaterra_community -c "SELECT post_id, body, status, rejection_note FROM posts WHERE body LIKE '%drones%';"
```

**Screenshot Location**: _[Take screenshot of rejection note input]_

---

### **TEST 8: Auto-Publish for Directors**

**User**: director@aquaterra.org

**Steps**:
1. As director, go to "Beach Cleanup Drive 2026" project
2. Go to Posts tab → Click "Create Post"
3. Notice: **NO approval notice** appears (no amber box)
4. Write: "Great work everyone! The beach cleanup was a huge success. We've been featured in the local news! 📰"
5. Notice button says **"Publish Post"** (not "Submit for Approval")
6. Click "Publish Post"

**Expected Result**:
- ✅ No approval notice in modal
- ✅ Button says "Publish Post"
- ✅ Post appears IMMEDIATELY in project posts (no approval needed)
- ✅ Post status = "published" directly
- ✅ Does NOT appear in Pending Posts tab

**Screenshot Location**: _[Take screenshot showing director's post published immediately]_

---

### **TEST 9: Team Lead Post (Maya as Lead)**

**User**: maya@example.com (who is a team Lead)

**Steps**:
1. Login as maya@example.com
2. Create a new post on the project
3. Check if it requires approval or auto-publishes

**Expected Result**:
- ✅ Should require approval (only directors and team leads auto-publish)
- ✅ Team "lead" role still needs approval

**Note**: If you want leads to auto-publish, this is a potential enhancement.

---

## 🐛 Bug Tracking

### Issues Found

| # | Issue | Severity | Status | Notes |
|---|-------|----------|--------|-------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

---

## ✅ Test Results Summary

| Test | Status | Notes |
|------|--------|-------|
| 1. Team Creation | ⬜ Pass / ⬜ Fail | |
| 2. Add Members | ⬜ Pass / ⬜ Fail | |
| 3. Create Project | ⬜ Pass / ⬜ Fail | |
| 4. Member Post Creation | ⬜ Pass / ⬜ Fail | |
| 5. View Pending Posts | ⬜ Pass / ⬜ Fail | |
| 6. Approve Post | ⬜ Pass / ⬜ Fail | |
| 7. Reject Post | ⬜ Pass / ⬜ Fail | |
| 8. Director Auto-Publish | ⬜ Pass / ⬜ Fail | |
| 9. Team Lead Approval | ⬜ Pass / ⬜ Fail | |

---

## 🔍 Additional Checks

### Database Verification Queries

```sql
-- Check team and members
SELECT t.name, tm.role, m.full_name
FROM teams t
JOIN team_members tm ON t.team_id = tm.team_id
JOIN members m ON tm.member_id = m.member_id
WHERE t.name = 'Environmental Initiatives';

-- Check project
SELECT p.title, p.status, t.name as team_name
FROM projects p
JOIN teams t ON p.team_id = t.team_id
WHERE p.title LIKE '%Beach Cleanup%';

-- Check project posts
SELECT p.body, p.status, m.full_name as author, pr.title as project
FROM posts p
JOIN members m ON p.author_id = m.member_id
JOIN post_projects pp ON p.post_id = pp.post_id
JOIN projects pr ON pp.project_id = pr.project_id;

-- Check pending posts for team
SELECT p.post_id, p.body, p.status, m.full_name as author, pr.title as project
FROM posts p
JOIN members m ON p.author_id = m.member_id
JOIN post_projects pp ON p.post_id = pp.post_id
JOIN projects pr ON pp.project_id = pr.project_id
JOIN teams t ON pr.team_id = t.team_id
WHERE p.status = 'pending_review' AND t.name = 'Environmental Initiatives';
```

---

## 📝 Notes

- **Authentication**: Make sure the Google OAuth mock is working properly
- **Permissions**: Verify that only team leads see the "Pending Posts" tab
- **Counts**: Badge counts should update in real-time after approval/rejection
- **Navigation**: Test that clicking on project names, team names, and member names navigates correctly

---

## 🎬 Next Steps After Testing

1. Document all bugs found
2. Fix any critical issues
3. Test edge cases (empty teams, deleted projects, etc.)
4. Add automated tests for the approval workflow
5. Consider adding email notifications for approvals/rejections

---

**Testing Date**: _______________
**Tester**: _______________
**Environment**: Development (localhost)
