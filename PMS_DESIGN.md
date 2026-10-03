# PMS — Project Management System
## UI / UX Design Specification

---

# 1. Design Goal

Create a modern professional Project Management System focused on:

- Clarity
- Speed
- Information density
- Excellent hierarchy
- Minimal visual noise
- Responsive behavior
- Accessibility
- Consistent interaction patterns

The visual language should feel suitable for a serious software/product team.

Reference the usability principles of products such as Linear, Notion, Jira, and modern admin applications, but do not copy their branding or UI directly.

---

# 2. Design Personality

The interface should be:

```text
Professional
Minimal
Focused
Technical
Calm
Fast
Organized
```

Avoid:

```text
Overly colorful dashboards
Huge decorative cards
Excessive gradients
Heavy shadows
Unnecessary glass effects
Excessive animation
Crowded navigation
```

The application is a productivity tool, so content and workflow should dominate the visual design.

---

# 3. Theme

Support:

```text
Light
Dark
System
```

Theme switching should be available from the application settings/user menu.

Use CSS variables and shadcn theme tokens.

Do not hard-code colors throughout components.

Use semantic tokens:

```text
background
foreground
card
card-foreground
popover
popover-foreground
primary
primary-foreground
secondary
secondary-foreground
muted
muted-foreground
accent
accent-foreground
destructive
border
input
ring
```

---

# 4. Color Strategy

Base palette should be neutral.

Use color primarily for:

- Status
- Priority
- Labels
- Notifications
- Important actions

Suggested semantic status colors:

```text
Todo          neutral
In Progress   blue
Review        purple
Done          green
Cancelled     red
```

Priority:

```text
Urgent        red
High          orange
Medium        yellow/amber
Low           blue/neutral
```

The exact colors should use theme tokens rather than hard-coded values.

Dark mode must remain readable and should not simply invert every color.

---

# 5. Typography

Use a clean modern sans-serif font.

Recommended:

```text
Inter
```

or another high-quality system/UI font.

Hierarchy:

```text
Page title       28–32px
Section title    18–22px
Card title       15–17px
Body             14–15px
Secondary        13–14px
Metadata         12–13px
```

Do not use too many font weights.

Recommended:

```text
400 Regular
500 Medium
600 Semibold
700 Bold
```

---

# 6. Spacing

Use a consistent spacing system based on Tailwind.

Prefer:

```text
4
6
8
12
16
20
24
32
40
48
```

Avoid random spacing values.

Desktop page padding:

```text
24px–32px
```

Mobile:

```text
16px
```

---

# 7. Border Radius

Use moderate radius.

Suggested:

```text
Small controls: 6px
Inputs: 6–8px
Cards: 8–12px
Dialogs: 12px
Large surfaces: 12–16px
```

Avoid excessive pill-shaped UI unless it represents:

- Status
- Priority
- Tags
- Filters

---

# 8. Shadows

Keep shadows subtle.

Most UI should rely on:

```text
border
background contrast
spacing
```

rather than large shadows.

Use stronger elevation only for:

- Dropdown
- Dialog
- Popover
- Command menu
- Floating panel

---

# 9. Application Shell

Desktop layout:

```text
┌─────────────────────────────────────────────────────────┐
│ Sidebar │ Top Header                                   │
│         ├───────────────────────────────────────────────┤
│         │                                               │
│         │ Main Content                                  │
│         │                                               │
│         │                                               │
└─────────┴───────────────────────────────────────────────┘
```

Sidebar:

- Workspace switcher
- Main navigation
- Projects
- Teams
- Reports
- Settings
- User profile

Top header:

- Breadcrumb / page title
- Search
- Quick create
- Notifications
- User menu

---

# 10. Sidebar

Desktop:

```text
Workspace
────────────
Dashboard
My Tasks
Inbox
Calendar

Projects
────────────
Project A
Project B
Project C

Workspace
────────────
Teams
Members
Reports

────────────
Settings
```

Sidebar behavior:

- Collapsible
- Persistent on desktop
- Drawer/sheet on mobile
- Active route clearly visible
- Avoid too many nested navigation levels

Use Lucide icons.

---

# 11. Workspace Switcher

Top of sidebar:

```text
┌───────────────────────┐
│ ◉ NextStep       ▾    │
└───────────────────────┘
```

Menu:

```text
NextStep
Artificium
Personal

+ Create workspace
```

Only show this when multiple organizations exist.

---

# 12. Dashboard Design

Dashboard should prioritize useful information over decorative cards.

Header:

```text
Good morning, Arkar

Here's what's happening across your workspace.
```

Quick summary:

```text
Open Tasks     Due Today     Overdue     Projects
    24             7            3           8
```

Then:

```text
My Tasks
────────────────────────────────────

Upcoming
────────────────────────────────────

Project Progress
────────────────────────────────────

Recent Activity
────────────────────────────────────
```

Use compact panels rather than turning every item into a large card.

---

# 13. Project Page

Header:

```text
Project Name
Project description

Owner   Members   Status   Due Date

Overview   Board   List   Calendar   Timeline   Files
```

Tabs should remain visible and easy to access.

The project header should stay compact.

---

# 14. Kanban Design

Example:

```text
BACKLOG       TODO          IN PROGRESS       REVIEW        DONE

┌────────┐   ┌────────┐    ┌────────┐       ┌────────┐   ┌────────┐
│ Task   │   │ Task   │    │ Task   │       │ Task   │   │ Task   │
│        │   │        │    │        │       │        │   │        │
└────────┘   └────────┘    └────────┘       └────────┘   └────────┘
```

Kanban requirements:

- Horizontal scrolling
- Fixed column width
- Drag and drop
- Drop indicator
- Compact task cards
- Status counts
- Add task button
- Quick actions

Task card:

```text
[High]

Implement authentication

○ Arkar       📅 Oct 5

#backend #auth
```

Do not put too much information on the card.

---

# 15. Task Detail

Use a large drawer or dialog.

Layout:

```text
┌───────────────────────────────────────────────┐
│ Task title                              ⋯  X │
├───────────────────────────────────────────────┤
│                                               │
│ Description                                   │
│                                               │
│ Checklist                                     │
│                                               │
│ Subtasks                                      │
│                                               │
│ Comments                                      │
│                                               │
├─────────────────────┬─────────────────────────┤
│ Main                │ Properties              │
│                     │                         │
│                     │ Status                  │
│                     │ Priority                │
│                     │ Assignee                │
│                     │ Due Date                │
│                     │ Labels                  │
│                     │ Project                 │
└─────────────────────┴─────────────────────────┘
```

Desktop can use a two-column layout.

Mobile should become a single-column layout.

---

# 16. Task Creation

Quick-create dialog:

```text
Create task

Title
Description

Project
Status
Assignee
Priority
Due date
Labels

[Cancel] [Create task]
```

Support keyboard-friendly operation.

Potential shortcut:

```text
C
```

for create task, when not typing in an input.

---

# 17. List View

Use a compact data table.

Columns:

```text
Task
Status
Priority
Assignee
Project
Due
Labels
```

Features:

- Search
- Filter
- Sort
- Column visibility
- Pagination if needed
- Bulk selection later

Avoid horizontal overflow on mobile where possible.

---

# 18. Calendar View

Use:

```text
Month
Week
Day
```

Task appearance:

```text
[In Progress] Build API
[High] Fix login
[Done] Create UI
```

Use status/priority indicators carefully.

Calendar must remain readable in dark mode.

---

# 19. Timeline / Gantt

Initial visual:

```text
Task                 Oct 1     Oct 5     Oct 10    Oct 15

Authentication       ███████████

Dashboard                     █████████████

API Integration                        █████████████
```

Keep the first version simple.

Avoid complex dependency lines until core timeline functionality is stable.

---

# 20. Project Cards

Project card:

```text
NextStep Website

Website redesign and development

██████████████░░░░  78%

8 tasks     2 overdue

Oct 1 — Oct 30

● Arkar   ● Min   +3
```

Project cards should not become giant dashboard cards.

---

# 21. Tables

Tables should have:

- Clear headers
- Comfortable row height
- Hover state
- Keyboard focus
- Sort indicators
- Selection state
- Empty state
- Loading skeleton

Avoid excessive borders.

Use subtle separators.

---

# 22. Forms

Form principles:

- Clear labels
- Helpful descriptions
- Inline validation
- Logical grouping
- Required fields marked
- Submit action visible
- Loading state
- Error state

For long forms use sections.

Do not put every field inside its own card.

---

# 23. Dialogs

Use dialogs for:

- Create
- Edit
- Confirmation
- Short workflows

Use drawers/sheets for:

- Task details
- Notifications
- Mobile navigation
- Contextual editing

Avoid opening multiple dialogs on top of each other.

---

# 24. Empty States

Every major page needs a useful empty state.

Example:

```text
No projects yet

Create your first project to start organizing
your team's work.

[Create project]
```

Avoid empty screens with only:

```text
No data
```

---

# 25. Loading States

Use skeletons for:

- Dashboard
- Tables
- Project lists
- Task lists
- Task details

Avoid full-screen spinners for normal navigation.

Use small loading indicators for actions.

---

# 26. Error States

Example:

```text
Something went wrong

We couldn't load this project.

[Try again]
```

Errors should be understandable and actionable.

Do not expose raw database errors to normal users.

---

# 27. Toasts

Use Sonner.

Examples:

```text
Task created
Project updated
Member invited
Task moved to Done
File uploaded
```

Errors:

```text
Couldn't update task.
Please try again.
```

Do not show unnecessary success notifications for every tiny interaction.

---

# 28. Notifications

Header:

```text
🔔 3
```

Dropdown:

```text
Notifications

Arkar assigned you a task
5m

A task is due tomorrow
1h

Min mentioned you in a comment
2h

View all
```

Unread items should have a subtle visual distinction.

---

# 29. Search

Global search should eventually search:

```text
Projects
Tasks
Members
Comments
```

Command-style interface:

```text
Search...

⌘ K
```

Possible shortcuts:

```text
Create task
Create project
Go to dashboard
Go to project
Search tasks
```

Implement advanced command functionality after the core search works.

---

# 30. Responsive Design

Desktop:

```text
≥ 1280px
```

Tablet:

```text
768px–1279px
```

Mobile:

```text
< 768px
```

Desktop:

- Persistent sidebar
- Multi-column layouts
- Full Kanban
- Expanded task detail

Mobile:

- Sidebar becomes drawer
- Tables become cards or horizontally scrollable where necessary
- Task detail becomes single-column
- Kanban horizontally scrolls
- Filters become a sheet
- Header becomes compact

Never simply shrink desktop UI until it becomes unusable.

---

# 31. Accessibility

Requirements:

- Keyboard navigation
- Visible focus states
- Semantic HTML
- Proper labels
- Accessible dialogs
- Accessible dropdowns
- Accessible tooltips
- Color must not be the only status indicator
- Sufficient contrast
- Screen-reader-friendly buttons

Use shadcn/ui primitives because they provide accessible foundations, but still verify the composed experience.

---

# 32. Motion

Motion should communicate state, not decorate the interface.

Good:

- Dialog entrance
- Drawer entrance
- Toast
- Drag feedback
- Hover feedback
- Page transition where subtle

Avoid:

- Constant floating animations
- Large background animations
- Excessive parallax
- Long transitions

Recommended transition duration:

```text
100ms–200ms
```

Respect:

```text
prefers-reduced-motion
```

---

# 33. Icons

Use Lucide React consistently.

Examples:

```text
LayoutDashboard
FolderKanban
CheckSquare
Calendar
Users
Settings
Bell
Search
Plus
MoreHorizontal
ChevronDown
Clock
Paperclip
MessageSquare
```

Do not mix multiple icon libraries.

---

# 34. Buttons

Primary actions should be obvious.

Example:

```text
+ Create task
+ New project
```

Secondary:

```text
Cancel
Filter
Export
```

Destructive:

```text
Delete
Remove member
Archive
```

Use shadcn Button variants.

Do not use many primary buttons on one screen.

---

# 35. Status / Priority UI

Use badges.

Example:

```text
[In Progress]
[High]
[Due Today]
```

Status should use both:

- Text
- Optional color/icon

so meaning is not dependent on color.

---

# 36. UX Rules

1. A user should understand the current location immediately.
2. The primary action should be obvious.
3. Common actions should require minimal clicks.
4. Preserve user input when validation fails.
5. Confirm destructive actions.
6. Provide undo where practical.
7. Keep task editing fast.
8. Keep navigation predictable.
9. Avoid unnecessary modal workflows.
10. Never hide critical information behind decoration.
11. Keep filters visible when they materially affect results.
12. Maintain consistent terminology.

---

# 37. Design System Components

Build reusable components for:

```text
AppShell
Sidebar
Topbar
PageHeader
Breadcrumbs
SearchCommand
UserAvatar
UserAvatarGroup

StatusBadge
PriorityBadge
LabelBadge

ProjectCard
TaskCard
TaskRow
TaskDetail
TaskForm

EmptyState
ErrorState
LoadingState
ConfirmDialog

DataTable
FilterBar
DatePicker
MemberSelect
ProjectSelect
StatusSelect
PrioritySelect

ActivityFeed
NotificationList
CommentList
FileList
```

---

# 38. Design Quality Checklist

Before considering a screen complete:

- Does the hierarchy make sense?
- Is the primary action obvious?
- Is there unnecessary decoration?
- Does it work in light mode?
- Does it work in dark mode?
- Does it work on mobile?
- Are loading states implemented?
- Are empty states implemented?
- Are errors understandable?
- Is keyboard navigation usable?
- Is the contrast sufficient?
- Are status colors consistent?
- Are spacing and typography consistent?
- Does the screen feel like part of the same product?

---

# 39. Overall Visual Target

The final application should feel like:

```text
Modern SaaS
+
Professional developer tool
+
Clean project workspace
```

Prioritize:

```text
Usability
Hierarchy
Speed
Consistency
Accessibility
```

over:

```text
Decoration
Visual effects
Large cards
Complex animations
```

The UI should feel polished because the system is well organized, not because it contains many visual effects.
