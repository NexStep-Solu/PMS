# PMS — Project Management System
## Engineering & Build Specification

**Stack:** React + Vite + TypeScript + Supabase + Vercel + Tailwind CSS + shadcn/ui

---

## 1. Product Goal

Build a modern, responsive Project Management System for software teams and organizations.

The system should support:

- Organizations / workspaces
- Teams and members
- Projects
- Tasks and subtasks
- Kanban boards
- List view
- Calendar view
- Timeline / Gantt view
- Milestones
- Comments and mentions
- Attachments
- Labels and priorities
- Time tracking
- Notifications
- Activity / audit logs
- Dashboards and reports
- Role-based permissions
- Multi-tenant data isolation

The first release should prioritize a clean, reliable core workflow over advanced automation.

---

# 2. Technology Stack

## Frontend

- React
- Vite
- TypeScript
- React Router
- Tailwind CSS
- shadcn/ui
- Lucide React
- TanStack Query
- React Hook Form
- Zod
- date-fns
- TanStack Table
- Recharts where charts are required
- Sonner for toast notifications

Optional when needed:

- dnd-kit for Kanban drag and drop
- react-pdf for PDF generation
- xlsx for spreadsheet exports

## Backend

Supabase:

- PostgreSQL
- Supabase Auth
- Row Level Security
- Supabase Storage
- Supabase Realtime
- Database Functions / Triggers when appropriate

## Deployment

- GitHub
- Vercel
- Supabase Cloud

---

# 3. Architecture Principles

Use a feature-oriented frontend architecture.

Avoid putting all application logic into generic `components/` and `pages/` folders.

Recommended structure:

```text
src/
├── app/
│   ├── router.tsx
│   ├── providers.tsx
│   └── query-client.ts
│
├── components/
│   ├── ui/
│   ├── layout/
│   ├── data-table/
│   ├── forms/
│   └── shared/
│
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── organizations/
│   ├── teams/
│   ├── projects/
│   ├── tasks/
│   ├── milestones/
│   ├── calendar/
│   ├── time-tracking/
│   ├── notifications/
│   ├── reports/
│   └── settings/
│
├── hooks/
├── lib/
│   ├── supabase.ts
│   ├── utils.ts
│   ├── permissions.ts
│   └── constants.ts
│
├── schemas/
├── types/
├── routes/
├── assets/
├── App.tsx
├── main.tsx
└── index.css
```

Each feature should contain its own:

```text
feature/
├── components/
├── hooks/
├── queries/
├── mutations/
├── schemas.ts
├── types.ts
└── utils.ts
```

Do not over-engineer this structure before the feature requires it.

---

# 4. Multi-Tenant Model

The system should support multiple organizations.

Core hierarchy:

```text
Organization
    │
    ├── Members
    ├── Teams
    ├── Projects
    │      ├── Members
    │      ├── Milestones
    │      └── Tasks
    │
    └── Settings
```

Every tenant-owned resource must be traceable to an organization.

Never rely on frontend filtering for tenant isolation.

Use PostgreSQL Row Level Security as the real security boundary.

---

# 5. Authentication

Use Supabase Auth.

Initial authentication:

- Email/password
- Email verification
- Password reset
- Logout
- Session persistence
- Profile setup

Future-ready:

- Google OAuth
- GitHub OAuth
- Magic link

After authentication, resolve:

```text
User
→ Profile
→ Organization memberships
→ Current organization
→ Role / permissions
```

---

# 6. Roles

Initial roles:

```text
Owner
Admin
Manager
Member
Viewer
```

Suggested permissions:

```text
organization.view
organization.update
members.view
members.invite
members.update
members.remove

projects.view
projects.create
projects.update
projects.delete

tasks.view
tasks.create
tasks.update
tasks.delete
tasks.assign

comments.create
comments.delete

files.upload
files.delete

time.view
time.create
time.update

reports.view
settings.manage
```

Permissions should be checked in:

1. UI
2. Application logic
3. Supabase RLS

Never treat UI hiding as security.

---

# 7. Database Schema

Start with the following tables.

## Profiles

```text
profiles
- id UUID PK → auth.users.id
- full_name
- avatar_url
- timezone
- created_at
- updated_at
```

## Organizations

```text
organizations
- id UUID PK
- name
- slug
- logo_url
- created_by
- created_at
- updated_at
```

## Organization Members

```text
organization_members
- id UUID PK
- organization_id FK
- user_id FK
- role
- joined_at
```

Unique:

```text
organization_id + user_id
```

## Teams

```text
teams
- id UUID PK
- organization_id FK
- name
- description
- created_at
- updated_at
```

## Team Members

```text
team_members
- id UUID PK
- team_id FK
- user_id FK
- created_at
```

## Projects

```text
projects
- id UUID PK
- organization_id FK
- name
- key
- description
- status
- priority
- start_date
- due_date
- owner_id
- created_by
- created_at
- updated_at
```

Example project key:

```text
NXT
WEB
MOB
ERP
```

## Project Members

```text
project_members
- id UUID PK
- project_id FK
- user_id FK
- role
- created_at
```

## Tasks

```text
tasks
- id UUID PK
- organization_id FK
- project_id FK
- parent_task_id nullable
- title
- description
- status_id
- priority_id
- assignee_id nullable
- reporter_id
- start_date nullable
- due_date nullable
- estimated_minutes nullable
- position
- created_at
- updated_at
- completed_at nullable
```

`parent_task_id` supports subtasks.

## Task Statuses

```text
task_statuses
- id UUID PK
- organization_id FK
- project_id nullable
- name
- key
- category
- color
- position
- is_default
- is_completed
```

Example:

```text
Backlog
Todo
In Progress
Review
Done
Cancelled
```

## Priorities

```text
priorities
- id UUID PK
- organization_id FK
- name
- key
- level
- position
```

Example:

```text
Urgent
High
Medium
Low
```

## Labels

```text
labels
- id UUID PK
- organization_id FK
- name
- color
```

## Task Labels

```text
task_labels
- task_id FK
- label_id FK
```

## Comments

```text
task_comments
- id UUID PK
- task_id FK
- user_id FK
- content
- created_at
- updated_at
```

## Checklists

```text
task_checklists
- id UUID PK
- task_id FK
- title
- position
- is_completed
```

## Attachments

```text
task_attachments
- id UUID PK
- task_id FK
- uploaded_by FK
- file_name
- storage_path
- file_size
- mime_type
- created_at
```

## Milestones

```text
milestones
- id UUID PK
- project_id FK
- name
- description
- due_date
- status
- position
- created_at
- updated_at
```

## Time Entries

```text
time_entries
- id UUID PK
- organization_id FK
- project_id FK
- task_id FK
- user_id FK
- started_at
- ended_at
- duration_minutes
- description
- created_at
```

## Notifications

```text
notifications
- id UUID PK
- user_id FK
- organization_id FK
- type
- title
- message
- data JSONB
- read_at nullable
- created_at
```

## Activity Logs

```text
activity_logs
- id UUID PK
- organization_id FK
- user_id FK
- entity_type
- entity_id
- action
- metadata JSONB
- created_at
```

Use activity logs for important changes such as:

```text
created task
updated task
assigned task
changed status
changed due date
added member
removed member
completed project
```

---

# 8. RLS Strategy

RLS is mandatory.

A user should only access organization data when:

```text
organization_members.user_id = auth.uid()
```

For project resources, additionally verify:

```text
project.organization_id
```

belongs to an organization where the current user is a member.

For project-specific restrictions, verify project membership when appropriate.

Do not expose the Supabase service-role key in Vite client code.

Only use the public anon/publishable client key in the browser.

---

# 9. Routing

Recommended routes:

```text
/
├── login
├── register
├── forgot-password
│
└── app
    ├── dashboard
    ├── my-tasks
    ├── calendar
    ├── projects
    │   ├── :projectId
    │   ├── :projectId/overview
    │   ├── :projectId/board
    │   ├── :projectId/list
    │   ├── :projectId/calendar
    │   ├── :projectId/timeline
    │   ├── :projectId/milestones
    │   └── :projectId/files
    │
    ├── teams
    ├── members
    ├── reports
    └── settings
        ├── profile
        ├── organization
        ├── members
        ├── roles
        └── preferences
```

Protect authenticated routes.

---

# 10. Core Screens

## Dashboard

Display:

- My open tasks
- Tasks due today
- Overdue tasks
- Recently updated projects
- Project progress
- Upcoming milestones
- Recent activity

Do not make every section a large card.

Use compact information-dense sections.

## Projects

Support:

- Search
- Filter
- Sort
- Create project
- Edit project
- Archive project

## Project Overview

Display:

- Project status
- Progress
- Dates
- Owner
- Members
- Milestones
- Recent activity
- Task summary

## Kanban

Columns:

```text
Backlog
Todo
In Progress
Review
Done
```

Support:

- Drag task
- Move between statuses
- Reorder
- Open task details
- Quick add

## Task Details

Task detail should support:

- Title
- Description
- Status
- Priority
- Assignee
- Due date
- Labels
- Subtasks
- Checklist
- Comments
- Attachments
- Time tracking
- Activity

Prefer a side drawer or large dialog for quick task editing where appropriate.

## Calendar

Show tasks and milestones.

Support:

- Month
- Week
- Day
- Date navigation
- Click task
- Create task

## Timeline

Initial implementation can be simple.

Display:

```text
Task
Start
End
Progress
Dependencies
```

Do not build a complicated enterprise Gantt engine in the first MVP.

---

# 11. Data Fetching

Use TanStack Query for server state.

Examples:

```text
useProjectsQuery()
useProjectQuery()
useTasksQuery()
useTaskQuery()
useMembersQuery()
useMilestonesQuery()
```

Mutations:

```text
useCreateProjectMutation()
useUpdateProjectMutation()
useCreateTaskMutation()
useUpdateTaskMutation()
useDeleteTaskMutation()
```

Invalidate or update the relevant query after mutations.

Avoid manually duplicating server state throughout React state.

---

# 12. Forms and Validation

Use:

```text
React Hook Form
+
Zod
```

Every important form needs:

- Client validation
- Clear error messages
- Loading state
- Disabled submit while saving
- Success feedback
- Error feedback

Examples:

```text
CreateProjectSchema
CreateTaskSchema
UpdateTaskSchema
InviteMemberSchema
ProfileSchema
```

---

# 13. Realtime

Use Supabase Realtime selectively.

Good candidates:

```text
Task updates
Comments
Notifications
Kanban changes
Presence later
```

Do not subscribe every component to realtime events.

Subscribe at feature boundaries and invalidate/update relevant queries.

---

# 14. Storage

Use Supabase Storage for:

```text
avatars
project-files
task-attachments
```

Recommended storage organization:

```text
organizations/{organizationId}/projects/{projectId}/...
```

Never trust a client-provided storage path for authorization.

Use RLS/storage policies.

---

# 15. Notifications

Initial notifications:

```text
Task assigned
Task mentioned
Task due soon
Task overdue
Comment added
Project invitation
Milestone approaching
```

Notification behavior:

```text
Unread
Read
```

Support:

- Header notification dropdown
- Notification page
- Mark as read
- Mark all as read

---

# 16. Audit / Activity

Every important mutation should generate an activity record.

Example:

```text
Arkar assigned "API Integration"
to Min
```

or:

```text
Task status changed
Todo → In Progress
```

Use human-readable activity messages in the UI.

---

# 17. Error Handling

Provide consistent handling for:

```text
Network error
Unauthorized
Forbidden
Validation error
Not found
Database error
Upload failure
```

Create reusable:

```text
ErrorState
EmptyState
LoadingState
Skeleton
NotFoundPage
```

Do not leave blank screens when a request fails.

---

# 18. Environment Variables

Use:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Never put:

```text
SUPABASE_SERVICE_ROLE_KEY
```

into the frontend.

For local development:

```text
.env.local
```

Do not commit secrets.

Provide:

```text
.env.example
```

---

# 19. Development Workflow

Build in this order:

### Phase 1 — Foundation

- Vite
- TypeScript
- Tailwind
- shadcn/ui
- Supabase client
- React Router
- TanStack Query
- App shell
- Theme

### Phase 2 — Authentication

- Login
- Register
- Password reset
- Profile
- Auth guard

### Phase 3 — Organization

- Organization
- Members
- Roles
- Permissions
- RLS

### Phase 4 — Projects

- Project CRUD
- Project members
- Project overview

### Phase 5 — Tasks

- Task CRUD
- Subtasks
- Labels
- Priorities
- Comments
- Attachments

### Phase 6 — Views

- Kanban
- List
- Calendar

### Phase 7 — Collaboration

- Notifications
- Realtime
- Activity logs

### Phase 8 — Productivity

- Time tracking
- Milestones
- Reports

### Phase 9 — Advanced

- Timeline/Gantt
- Dependencies
- Templates
- Automations
- Custom fields

---

# 20. Testing

At minimum test:

## Authentication

- Login
- Logout
- Invalid credentials
- Session persistence
- Password reset

## Authorization

- Member cannot access another organization
- Viewer cannot mutate restricted resources
- Admin can manage members
- Project member permissions work

## Tasks

- Create
- Update
- Delete
- Assign
- Status change
- Drag and drop
- Subtasks
- Comments

## Projects

- Create
- Update
- Archive
- Member management

## Security

Verify RLS using different test users.

Never rely only on frontend tests for authorization.

---

# 21. Coding Rules

1. TypeScript strict mode.
2. Avoid `any`.
3. Prefer reusable components.
4. Do not duplicate Supabase queries.
5. Keep database logic inside feature query/mutation modules.
6. Validate all user input.
7. Never expose service-role secrets.
8. Use RLS for authorization.
9. Use semantic names.
10. Keep components reasonably small.
11. Avoid giant page components.
12. Do not introduce Redux unless a real requirement appears.
13. Do not add libraries without a clear reason.
14. Use shadcn/ui components instead of recreating common UI.
15. Keep business logic separate from presentation.
16. Handle loading, empty, error, and success states.
17. Make all core screens responsive.
18. Preserve accessibility.
19. Avoid unnecessary animations.
20. Build MVP functionality before advanced features.

---

# 22. Definition of Done

A feature is not complete until:

- UI implemented
- Mobile/responsive behavior handled
- Loading state handled
- Empty state handled
- Error state handled
- Validation implemented
- Permission checks implemented
- RLS verified
- Query/mutation behavior tested
- Toast/feedback implemented
- TypeScript has no relevant errors
- No secrets committed
- Code is reusable and documented where necessary

---

# 23. MVP Definition

The first production-capable MVP should contain:

```text
Authentication
Organizations
Members
Roles
Projects
Project Members
Tasks
Subtasks
Statuses
Priorities
Labels
Comments
Attachments
Kanban
List
Calendar
Dashboard
Notifications
Activity Logs
RLS
Responsive UI
Vercel Deployment
```

Do not implement billing, complex automation, advanced Gantt dependencies, or external integrations until the core workflow is stable.
